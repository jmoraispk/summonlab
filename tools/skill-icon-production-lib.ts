import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
	SkillIconCatalogSchema,
	SkillIconRecordSchema,
	type SkillIconCatalog,
	type SkillIconRecord
} from '../packages/contracts/src/index.js';

import {
	parseTargetSkillRows,
	type SkillDomain,
	type SkillMarkdownFile,
	type TargetSkillRow
} from './skill-taxonomy-lib.js';

export const CANONICAL_SKILL_SOURCE_PATHS = [
	'docs/wiki/mechanics/skills/martial-blade.md',
	'docs/wiki/mechanics/skills/martial-polearm.md',
	'docs/wiki/mechanics/skills/martial-ranged.md',
	'docs/wiki/mechanics/skills/martial-shield.md',
	'docs/wiki/mechanics/skills/martial-body.md',
	'docs/wiki/mechanics/skills/magical-elemental.md',
	'docs/wiki/mechanics/skills/magical-disciplines.md',
	'docs/wiki/mechanics/skills/craft-and-life.md'
] as const;

export interface SkillIconVisualLineageRecord {
	readonly targetId: string;
	readonly mapEntryId: string;
	readonly motifFamily: string | null;
	readonly primaryVisualParent: string | null;
}

export interface SkillIconMotifMapEntry {
	readonly mapEntryId: string;
	readonly domain: SkillDomain;
	readonly family: string;
	readonly memberTargetIds: readonly string[];
}

export interface SkillIconMotifMap {
	readonly schemaVersion: 'skill-icon-motif-map-v1';
	readonly entries: readonly SkillIconMotifMapEntry[];
	readonly records: readonly SkillIconVisualLineageRecord[];
}

type VisualStateRecord = Pick<
	SkillIconRecord,
	'targetId' | 'status' | 'visualSpec' | 'assets' | 'review'
> &
	Partial<Pick<Extract<SkillIconRecord, { status: 'candidate' | 'approved' }>, 'producerResult'>>;

export interface SkillIconVisualSpecs {
	readonly schemaVersion: 'skill-icon-visual-specs-v1';
	readonly records: readonly VisualStateRecord[];
}

export interface SkillIconCatalogSummary {
	readonly canonical: number;
	readonly mapped: number;
	readonly missing: readonly string[];
	readonly duplicates: readonly string[];
	readonly mapEntries: number;
	readonly calibrationFamilies: number;
	readonly standalones: number;
	readonly longestLineage: number;
}

const MOTIF_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u;
const VISUAL_STATE_KEYS = new Set([
	'targetId',
	'status',
	'visualSpec',
	'producerResult',
	'assets',
	'review'
]);

interface MarkdownBlockToken {
	readonly type: string;
	readonly raw: string;
	readonly depth?: number;
}

interface MarkdownLexer {
	lexer(source: string): readonly MarkdownBlockToken[];
}

interface MarkdownLexerConstructor {
	new (options: unknown): MarkdownLexer;
}

const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { Marked } = webRequire('marked') as { readonly Marked: MarkdownLexerConstructor };

function commentPrefixedTypeOneHtmlBlock(source: string): MarkdownBlockToken | undefined {
	const opening = /^ {0,3}<!--[\s\S]*?-->[ \t]*<(pre|script|style|textarea)(?:[ \t]|>|$)/iu.exec(
		source
	);
	if (!opening) return undefined;

	const tagName = opening[1] ?? '';
	const closing = new RegExp(`</${tagName}>`, 'iu').exec(source.slice(opening[0].length));
	if (!closing) {
		return { type: 'comment-prefixed-type-one-html', raw: source };
	}

	const closingEnd = opening[0].length + closing.index + closing[0].length;
	const lineEnd = source.indexOf('\n', closingEnd);
	return {
		type: 'comment-prefixed-type-one-html',
		raw: lineEnd === -1 ? source : source.slice(0, lineEnd + 1)
	};
}

const motifMarkdownLexer = new Marked({
	gfm: true,
	extensions: [
		{
			name: 'comment-prefixed-type-one-html',
			level: 'block',
			tokenizer: commentPrefixedTypeOneHtmlBlock
		}
	]
});

function skillKey(domain: SkillDomain, family: string, name: string): string {
	return `${domain}\u0000${family}\u0000${name}`;
}

export async function loadCanonicalSkillRows(
	root = process.cwd()
): Promise<readonly TargetSkillRow[]> {
	const files: SkillMarkdownFile[] = await Promise.all(
		CANONICAL_SKILL_SOURCE_PATHS.map(async (sourcePath) => ({
			sourcePath,
			source: await readFile(path.resolve(root, sourcePath), 'utf8')
		}))
	);
	const rows = parseTargetSkillRows(files);
	const duplicates = rows
		.filter(
			(row, index) => rows.findIndex((candidate) => candidate.targetId === row.targetId) !== index
		)
		.map((row) => row.targetId);
	if (duplicates.length > 0) {
		throw new Error(`Duplicate canonical skill target IDs: ${[...new Set(duplicates)].join(', ')}`);
	}
	return rows;
}

function flattenMapEntries(
	entries: readonly SkillIconMotifMapEntry[]
): SkillIconVisualLineageRecord[] {
	return entries.flatMap((entry) =>
		entry.memberTargetIds.map((targetId, index) => ({
			targetId,
			mapEntryId: entry.mapEntryId,
			motifFamily: entry.memberTargetIds.length === 1 ? null : entry.mapEntryId,
			primaryVisualParent: index === 0 ? null : (entry.memberTargetIds[index - 1] ?? null)
		}))
	);
}

export function parseAcceptedMotifMap(
	markdown: string,
	canonicalRows: readonly TargetSkillRow[],
	options: { readonly allowUnmappedCanonicalRows?: boolean } = {}
): SkillIconMotifMap {
	const tokens = motifMarkdownLexer.lexer(markdown);
	const statuses = tokens.flatMap((token) => {
		if (token.type !== 'paragraph') return [];
		const status = /^\*\*Status:\*\*\s+(.+?)\s*$/u.exec(token.raw.trim());
		return status?.[1] ? [status[1]] : [];
	});
	if (statuses.length !== 1 || statuses[0] !== 'Accepted') {
		throw new Error('Skill icon motif map requires explicit accepted status');
	}

	const rowsByKey = new Map(
		canonicalRows.map((row) => [skillKey(row.domain, row.family, row.name), row] as const)
	);
	const entries: SkillIconMotifMapEntry[] = [];
	let domain: SkillDomain | undefined;
	let family: string | undefined;

	for (const token of tokens) {
		const domainHeading =
			token.type === 'heading' && token.depth === 2
				? /^##\s+(Martial|Magical|Craft)\s*$/u.exec(token.raw.trim())
				: null;
		if (domainHeading) {
			domain = domainHeading[1] as SkillDomain;
			family = undefined;
			continue;
		}
		const familyHeading =
			token.type === 'heading' && token.depth === 3
				? /^###\s+(.+?)(?:\s+—\s+\d+\s+skills?)?\s*$/u.exec(token.raw.trim())
				: null;
		if (familyHeading) {
			family = familyHeading[1]?.trim();
			continue;
		}
		if (!domain || !family || token.type !== 'table') continue;

		// Marked can extend a GFM table token across non-pipe lines. Only the authored,
		// contiguous pipe table belongs to the mapping; any following raw HTML remains inert.
		for (const line of token.raw.split(/\r?\n/u)) {
			if (!/^\s*\|.*\|\s*$/u.test(line)) break;
			const anyTableRow = /^\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/u.exec(line);
			if (
				anyTableRow &&
				/\*\*[^*]+\*\*/u.test(anyTableRow[2] ?? '') &&
				!/^`[^`]+`$/u.test(anyTableRow[1] ?? '')
			) {
				throw new Error(`Motif IDs in assignment table rows must be backticked: ${line}`);
			}
			const tableRow = /^\|\s*`([^`]+)`\s*\|\s*(.*?)\s*\|\s*$/u.exec(line);
			if (!tableRow) continue;
			const mapEntryId = tableRow[1] ?? '';
			if (!MOTIF_ID_PATTERN.test(mapEntryId)) {
				throw new Error(`Invalid backticked motif ID: ${mapEntryId}`);
			}
			const names = [...(tableRow[2] ?? '').matchAll(/\*\*([^*]+)\*\*/gu)].map(
				(match) => match[1]?.trim() ?? ''
			);
			if (names.length === 0) {
				throw new Error(`Motif entry ${mapEntryId} has no bold skill sequence`);
			}
			const currentDomain = domain;
			const currentFamily = family;
			const memberTargetIds = names.map((name) => {
				const row = rowsByKey.get(skillKey(currentDomain, currentFamily, name));
				if (!row) {
					throw new Error(
						`${mapEntryId} references unknown ${currentDomain}/${currentFamily}/${name}`
					);
				}
				return row.targetId;
			});
			entries.push({
				mapEntryId,
				domain: currentDomain,
				family: currentFamily,
				memberTargetIds
			});
		}
	}

	const mapEntryIds = new Set<string>();
	for (const entry of entries) {
		if (mapEntryIds.has(entry.mapEntryId)) {
			throw new Error(`Duplicate motif map entry ID: ${entry.mapEntryId}`);
		}
		mapEntryIds.add(entry.mapEntryId);
	}

	const rawRecords = flattenMapEntries(entries);
	const recordByTargetId = new Map<string, SkillIconVisualLineageRecord>();
	for (const record of rawRecords) {
		if (recordByTargetId.has(record.targetId)) {
			throw new Error(`Duplicate motif assignment for ${record.targetId}`);
		}
		recordByTargetId.set(record.targetId, record);
	}
	const missing = canonicalRows
		.map((row) => row.targetId)
		.filter((targetId) => !recordByTargetId.has(targetId));
	if (missing.length > 0 && !options.allowUnmappedCanonicalRows) {
		throw new Error(`Missing motif assignments: ${missing.join(', ')}`);
	}
	const unknown = rawRecords
		.map((record) => record.targetId)
		.filter((targetId) => !canonicalRows.some((row) => row.targetId === targetId));
	if (unknown.length > 0) throw new Error(`Unknown motif assignments: ${unknown.join(', ')}`);

	const records = canonicalRows.flatMap((row) => {
		const record = recordByTargetId.get(row.targetId);
		return record ? [record] : [];
	});
	validateVisualLineage(records);
	return { schemaVersion: 'skill-icon-motif-map-v1', entries, records };
}

export function validateVisualLineage(rows: readonly SkillIconVisualLineageRecord[]): void {
	const byTargetId = new Map<string, SkillIconVisualLineageRecord>();
	for (const row of rows) {
		if (byTargetId.has(row.targetId))
			throw new Error(`Duplicate visual lineage row ${row.targetId}`);
		byTargetId.set(row.targetId, row);
		if (row.motifFamily === null) {
			if (row.primaryVisualParent !== null)
				throw new Error(`Standalone ${row.targetId} cannot have a visual parent`);
		} else if (row.motifFamily !== row.mapEntryId) {
			throw new Error(`${row.targetId} motif family must match its map entry ID`);
		}
	}

	for (const row of rows) {
		if (row.primaryVisualParent === null) continue;
		const parent = byTargetId.get(row.primaryVisualParent);
		if (!parent)
			throw new Error(`${row.targetId} has missing visual parent ${row.primaryVisualParent}`);
		if (parent.motifFamily !== row.motifFamily || parent.mapEntryId !== row.mapEntryId) {
			throw new Error(`${row.targetId} has visual parent outside motif family ${row.motifFamily}`);
		}
	}

	const visited = new Set<string>();
	const visiting = new Set<string>();
	const visit = (targetId: string): void => {
		if (visiting.has(targetId)) throw new Error(`Detected visual parent cycle at ${targetId}`);
		if (visited.has(targetId)) return;
		visiting.add(targetId);
		const parent = byTargetId.get(targetId)?.primaryVisualParent;
		if (parent) visit(parent);
		visiting.delete(targetId);
		visited.add(targetId);
	};
	for (const targetId of byTargetId.keys()) visit(targetId);

	const groups = new Map<string, SkillIconVisualLineageRecord[]>();
	for (const row of rows) {
		const group = groups.get(row.mapEntryId) ?? [];
		group.push(row);
		groups.set(row.mapEntryId, group);
	}
	for (const [mapEntryId, group] of groups) {
		if (group.length === 1 && group[0]?.motifFamily !== null) {
			throw new Error(`One-member motif entry ${mapEntryId} must be standalone`);
		}
		if (group.length > 1 && group.some((record) => record.motifFamily === null)) {
			throw new Error(`Multi-member motif entry ${mapEntryId} requires a motif family`);
		}
		if (group.filter((record) => record.primaryVisualParent === null).length !== 1) {
			throw new Error(`Motif entry ${mapEntryId} must have exactly one visual root`);
		}
	}
}

function validateVisualSpecsShape(input: SkillIconVisualSpecs): void {
	if (input.schemaVersion !== 'skill-icon-visual-specs-v1' || !Array.isArray(input.records)) {
		throw new Error('Invalid skill-icon visual specs document');
	}
	for (const record of input.records) {
		for (const key of Object.keys(record)) {
			if (!VISUAL_STATE_KEYS.has(key)) {
				throw new Error(`Visual specs record ${record.targetId} contains canonical field ${key}`);
			}
		}
	}
}

export function buildSkillIconCatalog(
	canonicalRows: readonly TargetSkillRow[],
	lineage: SkillIconMotifMap | readonly SkillIconVisualLineageRecord[],
	visualSpecs: SkillIconVisualSpecs
): SkillIconCatalog {
	const lineageRows: readonly SkillIconVisualLineageRecord[] =
		'records' in lineage ? lineage.records : lineage;
	validateVisualLineage(lineageRows);
	validateVisualSpecsShape(visualSpecs);

	const canonicalIds = new Set(canonicalRows.map((row) => row.targetId));
	const lineageById = new Map(lineageRows.map((record) => [record.targetId, record] as const));
	const specsById = new Map<string, VisualStateRecord>();
	for (const record of visualSpecs.records) {
		if (specsById.has(record.targetId))
			throw new Error(`Duplicate visual specs record ${record.targetId}`);
		if (!canonicalIds.has(record.targetId))
			throw new Error(
				`Unknown visual specs record ${record.targetId}; reconcile renamed/deleted skill`
			);
		specsById.set(record.targetId, record);
	}

	const records = canonicalRows.map((row) => {
		const visualLineage = lineageById.get(row.targetId);
		if (!visualLineage) throw new Error(`Missing visual lineage for ${row.targetId}`);
		const visualState = specsById.get(row.targetId);
		if (!visualState) throw new Error(`Missing visual specs record ${row.targetId}`);
		return SkillIconRecordSchema.parse({ ...row, ...visualLineage, ...visualState });
	});
	for (const lineageRecord of lineageRows) {
		if (!canonicalIds.has(lineageRecord.targetId))
			throw new Error(`Unknown visual lineage record ${lineageRecord.targetId}`);
	}
	return SkillIconCatalogSchema.parse({ schemaVersion: 'skill-icon-catalog-v1', records });
}

export function summarizeSkillIconCatalog(catalog: SkillIconCatalog): SkillIconCatalogSummary {
	const targetCounts = new Map<string, number>();
	for (const record of catalog.records) {
		targetCounts.set(record.targetId, (targetCounts.get(record.targetId) ?? 0) + 1);
	}
	const duplicates = [...targetCounts]
		.filter(([, count]) => count > 1)
		.map(([targetId]) => targetId)
		.sort();
	const mapEntrySizes = new Map<string, number>();
	for (const record of catalog.records) {
		mapEntrySizes.set(record.mapEntryId, (mapEntrySizes.get(record.mapEntryId) ?? 0) + 1);
	}
	const recordsById = new Map(catalog.records.map((record) => [record.targetId, record] as const));
	const depths = new Map<string, number>();
	const lineageDepth = (targetId: string): number => {
		const known = depths.get(targetId);
		if (known !== undefined) return known;
		const parent = recordsById.get(targetId)?.primaryVisualParent;
		const depth = parent ? lineageDepth(parent) + 1 : 1;
		depths.set(targetId, depth);
		return depth;
	};
	return {
		canonical: catalog.records.length,
		mapped: targetCounts.size,
		missing: [],
		duplicates,
		mapEntries: mapEntrySizes.size,
		calibrationFamilies: new Set(
			catalog.records.flatMap((record) => (record.motifFamily ? [record.motifFamily] : []))
		).size,
		standalones: catalog.records.filter((record) => record.motifFamily === null).length,
		longestLineage: Math.max(0, ...catalog.records.map((record) => lineageDepth(record.targetId)))
	};
}
