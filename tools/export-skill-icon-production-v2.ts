import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { SkillIconCatalogSchema, type SkillIconCatalog } from '../packages/contracts/src/index.js';

import {
	buildSkillIconCatalog,
	loadCanonicalSkillRows,
	summarizeSkillIconCatalog,
	validateVisualLineage,
	type SkillIconMotifMap,
	type SkillIconVisualLineageRecord,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';
import type { TargetSkillRow } from './skill-taxonomy-lib.js';

const BASE_PATHS = {
	motifMap: 'assets/wiki/skills/icon-production-v1/motif-map.json',
	visualSpecs: 'assets/wiki/skills/icon-production-v1/visual-specs.json',
	catalog: 'assets/wiki/skills/icon-production-v1/catalog.json'
} as const;

const OVERLAY_PATH = 'assets/wiki/skills/icon-production-v2/overlay.json' as const;
const OUTPUT_PATHS = {
	motifMap: 'assets/wiki/skills/icon-production-v2/motif-map.json',
	visualSpecs: 'assets/wiki/skills/icon-production-v2/visual-specs.json',
	catalog: 'assets/wiki/skills/icon-production-v2/catalog.json'
} as const;

export interface SkillIconMotifAppendition {
	readonly mapEntryId: string;
	readonly existingTailTargetId: string;
	readonly targetId: string;
}

export type SkillIconVisualOverlayRecord = SkillIconVisualSpecs['records'][number];

interface BoundFile {
	readonly path: string;
	readonly contentHash: string;
}

interface SkillIconAuthorityOverlay {
	readonly schemaVersion: 'skill-icon-authority-overlay-v1';
	readonly base: {
		readonly motifMap: BoundFile;
		readonly visualSpecs: BoundFile;
		readonly catalog: BoundFile;
	};
	readonly motifSource: BoundFile;
	readonly appenditions: readonly SkillIconMotifAppendition[];
	readonly records: readonly SkillIconVisualOverlayRecord[];
}

export interface SkillIconProductionV2ExportReport {
	readonly mode: 'check' | 'write';
	readonly inSync: boolean;
	readonly written: readonly string[];
	readonly files: readonly { path: string; current: boolean; sha256: string }[];
	readonly summary: ReturnType<typeof summarizeSkillIconCatalog>;
	readonly baseSkillCount: number;
	readonly addedTargetIds: readonly string[];
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function canonicalRecords<T extends { readonly targetId: string }>(
	rows: readonly TargetSkillRow[],
	records: readonly T[]
): T[] {
	const byId = new Map(records.map((record) => [record.targetId, record] as const));
	return rows.map((row) => {
		const record = byId.get(row.targetId);
		if (!record) throw new Error(`Missing successor record ${row.targetId}`);
		return record;
	});
}

export function appendMotifLineage(
	base: SkillIconMotifMap,
	canonicalRows: readonly TargetSkillRow[],
	appenditions: readonly SkillIconMotifAppendition[]
): SkillIconMotifMap {
	const baseIds = new Set(base.records.map((record) => record.targetId));
	const addedRows = canonicalRows.filter((row) => !baseIds.has(row.targetId));
	const additionIds = appenditions.map((addition) => addition.targetId);
	if (
		new Set(additionIds).size !== additionIds.length ||
		[...additionIds].sort().join('|') !==
			addedRows
				.map((row) => row.targetId)
				.sort()
				.join('|')
	) {
		throw new Error('Motif appenditions must exactly cover canonical targets absent from v1');
	}

	const newRecords: SkillIconVisualLineageRecord[] = [];
	const entries = base.entries.map((entry) => {
		const additions = appenditions.filter((addition) => addition.mapEntryId === entry.mapEntryId);
		let memberTargetIds = [...entry.memberTargetIds];
		for (const addition of additions) {
			const tail = memberTargetIds.at(-1);
			if (tail !== addition.existingTailTargetId) {
				throw new Error(
					`${addition.mapEntryId} tail mismatch: expected ${addition.existingTailTargetId}, found ${tail ?? 'none'}`
				);
			}
			const row = canonicalRows.find((candidate) => candidate.targetId === addition.targetId);
			if (!row || row.domain !== entry.domain || row.family !== entry.family) {
				throw new Error(`${addition.targetId} does not belong to ${entry.domain}/${entry.family}`);
			}
			memberTargetIds.push(addition.targetId);
			newRecords.push({
				targetId: addition.targetId,
				mapEntryId: entry.mapEntryId,
				motifFamily: entry.mapEntryId,
				primaryVisualParent: addition.existingTailTargetId
			});
		}
		return { ...entry, memberTargetIds };
	});
	for (const addition of appenditions) {
		if (!base.entries.some((entry) => entry.mapEntryId === addition.mapEntryId)) {
			throw new Error(`Unknown v1 motif entry ${addition.mapEntryId}`);
		}
	}

	const records = canonicalRecords(canonicalRows, [...base.records, ...newRecords]);
	validateVisualLineage(records);
	for (const baseRecord of base.records) {
		const successor = records.find((record) => record.targetId === baseRecord.targetId);
		if (JSON.stringify(successor) !== JSON.stringify(baseRecord)) {
			throw new Error(`Refusing to revise frozen v1 lineage ${baseRecord.targetId}`);
		}
	}
	return { schemaVersion: 'skill-icon-motif-map-v1', entries, records };
}

export function buildSuccessorVisualSpecs(
	base: SkillIconVisualSpecs,
	canonicalRows: readonly TargetSkillRow[],
	overlayRecords: readonly SkillIconVisualOverlayRecord[]
): SkillIconVisualSpecs {
	const baseIds = new Set(base.records.map((record) => record.targetId));
	const addedIds = canonicalRows
		.filter((row) => !baseIds.has(row.targetId))
		.map((row) => row.targetId)
		.sort();
	const overlayIds = overlayRecords.map((record) => record.targetId).sort();
	if (
		new Set(overlayIds).size !== overlayIds.length ||
		overlayIds.join('|') !== addedIds.join('|')
	) {
		throw new Error('Visual overlay must exactly cover canonical targets absent from v1');
	}
	for (const record of overlayRecords) {
		if (record.status !== 'authored' || record.visualSpec === null) {
			throw new Error(`Visual overlay ${record.targetId} must be authored with a visual spec`);
		}
		if (record.assets !== null || record.review !== null || 'producerResult' in record) {
			throw new Error(`Visual overlay ${record.targetId} cannot claim produced or reviewed art`);
		}
	}
	return {
		schemaVersion: 'skill-icon-visual-specs-v1',
		records: canonicalRecords(canonicalRows, [...base.records, ...overlayRecords])
	};
}

async function readBound(root: string, binding: BoundFile, expectedPath?: string): Promise<Buffer> {
	if (expectedPath && binding.path !== expectedPath) {
		throw new Error(`Overlay binding must use ${expectedPath}`);
	}
	const bytes = await readFile(path.resolve(root, binding.path));
	const actualHash = sha256(bytes);
	if (actualHash !== binding.contentHash) {
		throw new Error(`Overlay binding changed: ${binding.path}`);
	}
	return bytes;
}

async function currentBytes(filePath: string): Promise<Buffer | null> {
	const metadata = await lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata) return null;
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing non-regular successor output ${filePath}`);
	}
	return readFile(filePath);
}

async function writeAtomically(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, bytes, { flag: 'wx' });
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
}

export async function exportSkillIconProductionV2(options: {
	readonly root?: string;
	readonly mode: 'check' | 'write';
}): Promise<SkillIconProductionV2ExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const overlay = JSON.parse(await readFile(path.resolve(root, OVERLAY_PATH), 'utf8')) as
		SkillIconAuthorityOverlay | undefined;
	if (!overlay || overlay.schemaVersion !== 'skill-icon-authority-overlay-v1') {
		throw new Error('Invalid skill-icon v2 authority overlay');
	}

	const [rows, motifBytes, visualBytes, catalogBytes] = await Promise.all([
		loadCanonicalSkillRows(root),
		readBound(root, overlay.base.motifMap, BASE_PATHS.motifMap),
		readBound(root, overlay.base.visualSpecs, BASE_PATHS.visualSpecs),
		readBound(root, overlay.base.catalog, BASE_PATHS.catalog),
		readBound(root, overlay.motifSource)
	]);
	const baseMotifMap = JSON.parse(motifBytes.toString('utf8')) as SkillIconMotifMap;
	const baseVisualSpecs = JSON.parse(visualBytes.toString('utf8')) as SkillIconVisualSpecs;
	const baseCatalog = SkillIconCatalogSchema.parse(
		JSON.parse(catalogBytes.toString('utf8'))
	) as SkillIconCatalog;
	const baseIds = new Set(baseCatalog.records.map((record) => record.targetId));
	if (
		baseMotifMap.records.length !== baseCatalog.records.length ||
		baseVisualSpecs.records.length !== baseCatalog.records.length
	) {
		throw new Error('Frozen v1 motif, visual, and catalog counts disagree');
	}

	const motifMap = appendMotifLineage(baseMotifMap, rows, overlay.appenditions);
	const visualSpecs = buildSuccessorVisualSpecs(baseVisualSpecs, rows, overlay.records);
	const catalog = buildSkillIconCatalog(rows, motifMap, visualSpecs);
	const summary = summarizeSkillIconCatalog(catalog);
	const addedTargetIds = rows
		.filter((row) => !baseIds.has(row.targetId))
		.map((row) => row.targetId);
	if (
		summary.canonical !== baseCatalog.records.length + addedTargetIds.length ||
		summary.mapped !== summary.canonical ||
		summary.mapEntries !== new Set(baseCatalog.records.map((record) => record.mapEntryId)).size
	) {
		throw new Error(`Unexpected successor coverage ${JSON.stringify(summary)}`);
	}

	const outputs = [
		{ path: OUTPUT_PATHS.motifMap, bytes: jsonBytes(motifMap) },
		{ path: OUTPUT_PATHS.visualSpecs, bytes: jsonBytes(visualSpecs) },
		{ path: OUTPUT_PATHS.catalog, bytes: jsonBytes(catalog) }
	];
	const files: { path: string; current: boolean; sha256: string }[] = [];
	const written: string[] = [];
	for (const output of outputs) {
		const destination = path.resolve(root, output.path);
		const existing = await currentBytes(destination);
		const matches = existing?.equals(output.bytes) ?? false;
		if (options.mode === 'write' && !matches) {
			await writeAtomically(destination, output.bytes);
			written.push(output.path);
		}
		files.push({
			path: output.path,
			current: options.mode === 'write' ? true : matches,
			sha256: sha256(output.bytes)
		});
	}

	return {
		mode: options.mode,
		inSync: files.every((file) => file.current),
		written,
		files,
		summary,
		baseSkillCount: baseCatalog.records.length,
		addedTargetIds
	};
}

function parseMode(args: readonly string[]): 'check' | 'write' {
	if (args.length !== 1 || !['--check', '--write'].includes(args[0] ?? '')) {
		throw new Error('Usage: tsx tools/export-skill-icon-production-v2.ts --check|--write');
	}
	return args[0] === '--write' ? 'write' : 'check';
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	exportSkillIconProductionV2({ mode: parseMode(process.argv.slice(2)) })
		.then((report) => {
			for (const file of report.files) {
				process.stdout.write(`${file.current ? 'current' : 'stale'} ${file.path} ${file.sha256}\n`);
			}
			process.stdout.write(
				`${report.baseSkillCount} frozen base skills + ${report.addedTargetIds.length} additions = ${report.summary.canonical} canonical skills\n`
			);
			if (!report.inSync) process.exitCode = 1;
		})
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
