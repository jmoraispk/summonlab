import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE_AFFINITIES = ['Fire', 'Earth', 'Wind', 'Water'] as const;
export const DUAL_AFFINITIES = [
	{ name: 'Mist', parents: ['Water', 'Fire'], status: 'Shroud' },
	{ name: 'Lightning', parents: ['Fire', 'Wind'], status: 'Shock' },
	{ name: 'Sand', parents: ['Wind', 'Earth'], status: 'Abrade' },
	{ name: 'Rot', parents: ['Earth', 'Water'], status: 'Decay' },
	{ name: 'Magma', parents: ['Fire', 'Earth'], status: 'Melt' },
	{ name: 'Ice', parents: ['Water', 'Wind'], status: 'Freeze' }
] as const;
export const OVERCOMING_EDGES = [
	['Earth', 'Water'],
	['Water', 'Fire'],
	['Fire', 'Wind'],
	['Wind', 'Earth']
] as const;

type CatalogEntry = {
	wikiId?: unknown;
	path?: unknown;
	pageType?: unknown;
};

type MarkdownFile = {
	relativePath: string;
	source: string;
	entry: CatalogEntry;
};

type DualDefinition = {
	name: string;
	parents: string[];
	status: string;
};

const requiredBaseNames = BASE_AFFINITIES.join(', ');
const requiredDualNames = DUAL_AFFINITIES.map(({ name }) => name).join(', ');
const requiredEdges = OVERCOMING_EDGES.map(([from, to]) => `${from}>${to}`).join(', ');
const circleSvgPath = 'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg';
const matrixSvgPath = 'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg';

function relative(root: string, filePath: string): string {
	return path.relative(root, filePath).split(path.sep).join('/');
}

function unique(values: readonly string[]): string[] {
	return [...new Set(values)];
}

function sameSet(actual: readonly string[], expected: readonly string[]): boolean {
	return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

function tableRows(source: string): string[][][] {
	const tables: string[][][] = [];
	let table: string[][] = [];
	for (const line of source.split(/\r?\n/u)) {
		if (line.trim().startsWith('|')) {
			const cells = line
				.trim()
				.split('|')
				.slice(1, -1)
				.map((cell) => cell.replace(/\*+/gu, '').trim());
			if (!cells.every((cell) => /^:?-{3,}:?$/u.test(cell))) table.push(cells);
			continue;
		}
		if (table.length > 0) {
			tables.push(table);
			table = [];
		}
	}
	if (table.length > 0) tables.push(table);
	return tables;
}

function namesInCanonicalTables(source: string, header: string): string[] {
	return unique(
		tableRows(source)
			.filter((table) => table[0]?.[0]?.toLowerCase() === header.toLowerCase())
			.flatMap((table) => table.slice(1).map((row) => row[0] ?? ''))
			.filter(Boolean)
	);
}

function text(cell: string): string {
	return cell.replace(/\*+/gu, '').trim();
}

function dualDefinitionsInCanonicalTables(source: string): DualDefinition[] {
	return tableRows(source).flatMap((table) => {
		const headers = table[0]?.map((header) => text(header).toLowerCase()) ?? [];
		const nameIndex = headers.indexOf('dual');
		const parentsIndex = headers.indexOf('from');
		const statusIndex = headers.indexOf('status');
		if (nameIndex === -1 || parentsIndex === -1 || statusIndex === -1) return [];
		return table.slice(1).map((row) => ({
			name: text(row[nameIndex] ?? ''),
			parents: text(row[parentsIndex] ?? '')
				.split(/\s*(?:×|✕|x)\s*/iu)
				.filter(Boolean),
			status: text((row[statusIndex] ?? '').split(/[—–-]/u)[0] ?? '')
		}));
	});
}

function dualSummary(definitions: readonly DualDefinition[]): string {
	return definitions
		.map(({ name, parents, status }) => `${name} (${parents.join(' × ')}, ${status})`)
		.join(', ');
}

function cycleEdges(source: string): string[] | undefined {
	const statement = source.match(/\bOvercoming\s*:\s*([^\n]+)/iu)?.[1];
	if (!statement) return undefined;
	const names = [...statement.matchAll(/\b(Fire|Earth|Wind|Water)\b/giu)].map(
		(match) => `${match[1]![0]!.toUpperCase()}${match[1]!.slice(1).toLowerCase()}`
	);
	if (names.length < 2) return [];
	return names.slice(0, -1).map((name, index) => `${name}>${names[index + 1]}`);
}

async function existingSource(filePath: string): Promise<string | undefined> {
	if (!existsSync(filePath)) return undefined;
	return readFile(filePath, 'utf8');
}

async function filesIn(directory: string, extension: string): Promise<string[]> {
	if (!existsSync(directory)) return [];
	const entries = await readdir(directory, { recursive: true, withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(extension))
		.map((entry) => path.join(entry.parentPath, entry.name))
		.sort();
}

function renderedContentFindings(relativePath: string, source: string): string[] {
	const findings: string[] = [];
	if (/\bresonance\b/iu.test(source)) {
		findings.push(`${relativePath}: rendered wiki content uses retired term "Resonance".`);
	}
	if (/\bwood affinity\b/iu.test(source)) {
		findings.push(`${relativePath}: rendered wiki content presents "Wood affinity" as current.`);
	}
	if (/\bmetal affinity\b/iu.test(source)) {
		findings.push(`${relativePath}: rendered wiki content presents "Metal affinity" as current.`);
	}
	if (/\bfive(?:[-\s]+base)?\s+affinit(?:y|ies|y variants)\b/iu.test(source)) {
		findings.push(`${relativePath}: rendered wiki content claims five base affinities.`);
	}
	if (/\bWind\s+(?:is\s+)?derived\b|\bderived\s+(?:from\s+\w+\s+)?Wind\b/iu.test(source)) {
		findings.push(`${relativePath}: rendered wiki content presents Wind as derived.`);
	}
	return findings;
}

function catalogFindings(catalogPath: string, entries: readonly CatalogEntry[]): string[] {
	const findings: string[] = [];
	for (const entry of entries) {
		if (typeof entry.wikiId === 'string' && /^affinity\.(wood|metal)$/iu.test(entry.wikiId)) {
			const affinity = entry.wikiId.split('.')[1]!;
			findings.push(
				`${catalogPath}: affinity catalog entry "${entry.wikiId}" publishes retired affinity ${affinity[0]!.toUpperCase()}${affinity.slice(1)}.`
			);
		}
	}
	return findings;
}

function monsterVariantFinding(file: MarkdownFile): string | undefined {
	if (file.entry.pageType !== 'monster-entry') return undefined;
	if (
		/\b(?:Wood|Metal)\b[\s\S]{0,160}\b(?:current\s+)?affinity variants?\b/iu.test(file.source) ||
		/\b(?:Wood|Metal)\b[\s\S]{0,160}\bas variants? of\b/iu.test(file.source)
	) {
		return `${file.relativePath}: monster page presents Wood or Metal imagery as a current affinity variant.`;
	}
	return undefined;
}

function sourceTerm(source: string): string | undefined {
	if (/\bresonance\b/iu.test(source)) return 'Resonance';
	if (/\bwood affinity\b/iu.test(source)) return 'Wood affinity';
	if (/\bmetal affinity\b/iu.test(source)) return 'Metal affinity';
	return undefined;
}

async function immutableSkillSourceFindings(root: string): Promise<string[]> {
	const sourcePath = path.join(root, 'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json');
	const migrationPath = path.join(root, 'docs/wiki/mechanics/skills/migration-v2.json');
	const [source, migration] = await Promise.all([
		existingSource(sourcePath),
		existingSource(migrationPath)
	]);
	if (!source || !migration) return [];

	let legacyRecords: unknown;
	let migrationLedger: unknown;
	try {
		legacyRecords = JSON.parse(source);
		migrationLedger = JSON.parse(migration);
	} catch {
		return [];
	}
	if (!Array.isArray(legacyRecords) || !migrationLedger || typeof migrationLedger !== 'object')
		return [];
	const migrationRecords = Array.isArray((migrationLedger as { records?: unknown }).records)
		? ((migrationLedger as { records: unknown[] }).records as unknown[])
		: [];
	const findings: string[] = [];

	for (const record of legacyRecords) {
		if (!record || typeof record !== 'object') continue;
		const legacy = record as { sourceId?: unknown };
		if (typeof legacy.sourceId !== 'string') continue;
		const term = sourceTerm(JSON.stringify(record));
		if (!term) continue;
		const migrationRecord = migrationRecords.find(
			(candidate) =>
				candidate &&
				typeof candidate === 'object' &&
				(candidate as { sourceId?: unknown }).sourceId === legacy.sourceId
		);
		const target =
			migrationRecord && typeof migrationRecord === 'object'
				? (migrationRecord as { target?: unknown }).target
				: undefined;
		const targetSource = JSON.stringify(target ?? {});
		const targetUsesRetiredTerm =
			(term === 'Resonance' &&
				(/\bresonance\b/iu.test(targetSource) ||
					!/\b(?:affinity rank|resonant)\b/iu.test(targetSource))) ||
			(term === 'Wood affinity' && /\bWood\b/iu.test(targetSource)) ||
			(term === 'Metal affinity' && /\bMetal\b/iu.test(targetSource));
		if (targetUsesRetiredTerm) {
			findings.push(
				`docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json: immutable skill-source exception for ${legacy.sourceId} is invalid because its migration target retains "${term}".`
			);
		}
	}
	return findings;
}

function svgEdgeFinding(relativePath: string, source: string): string | undefined {
	const edges = [...source.matchAll(/\bdata-overcomes\s*=\s*["']([^"']+)["']/giu)].map(
		(match) => match[1]!
	);
	if (
		sameSet(
			edges,
			OVERCOMING_EDGES.map(([from, to]) => `${from}>${to}`)
		)
	)
		return undefined;
	return `${relativePath}: data-overcomes edges must contain exactly ${requiredEdges}; found ${edges.join(', ') || 'none'}.`;
}

function svgMatrixFinding(relativePath: string, source: string): string | undefined {
	const baseCount = [...source.matchAll(/\bdata-kind\s*=\s*["']base["']/giu)].length;
	const dualCount = [...source.matchAll(/\bdata-kind\s*=\s*["']dual["']/giu)].length;
	if (baseCount === BASE_AFFINITIES.length && dualCount === DUAL_AFFINITIES.length)
		return undefined;
	return `${relativePath}: affinity matrix must contain exactly four data-kind="base" cells and six data-kind="dual" cells; found ${baseCount} base and ${dualCount} dual.`;
}

export async function validateAffinityWiki(root: string): Promise<string[]> {
	const findings: string[] = [];
	const catalogRelativePath = 'docs/wiki/catalog.json';
	const catalogPath = path.join(root, catalogRelativePath);
	const catalogSource = await existingSource(catalogPath);
	let entries: CatalogEntry[] = [];
	if (!catalogSource) {
		return [`${catalogRelativePath}: required wiki catalog is missing.`];
	}
	try {
		const catalog = JSON.parse(catalogSource) as { entries?: unknown };
		if (!Array.isArray(catalog.entries)) {
			return [`${catalogRelativePath}: required wiki catalog has malformed entries structure.`];
		}
		entries = catalog.entries as CatalogEntry[];
	} catch {
		return [`${catalogRelativePath}: required wiki catalog contains malformed JSON.`];
	}

	const markdownFiles: MarkdownFile[] = [];
	for (const entry of entries) {
		if (typeof entry.path !== 'string' || !entry.path.endsWith('.md')) continue;
		const source = await existingSource(path.join(root, entry.path));
		if (source !== undefined) markdownFiles.push({ entry, relativePath: entry.path, source });
	}

	for (const filePath of await filesIn(
		path.join(root, 'apps/web/src/lib/components/wiki'),
		'.svelte'
	)) {
		const source = await readFile(filePath, 'utf8');
		findings.push(...renderedContentFindings(relative(root, filePath), source));
	}

	findings.push(...catalogFindings(catalogRelativePath, entries));
	for (const file of markdownFiles) {
		findings.push(...renderedContentFindings(file.relativePath, file.source));
		const monsterFinding = monsterVariantFinding(file);
		if (monsterFinding) findings.push(monsterFinding);
	}

	const canonicalEntry = entries.find(
		(entry) => entry.wikiId === 'mechanics.progression.affinities'
	);
	if (!canonicalEntry) {
		findings.push(
			`${catalogRelativePath}: required canonical affinity entry "mechanics.progression.affinities" is missing.`
		);
	} else if (typeof canonicalEntry.path !== 'string' || !canonicalEntry.path.endsWith('.md')) {
		findings.push(
			`${catalogRelativePath}: required canonical affinity entry "mechanics.progression.affinities" requires a Markdown path.`
		);
	} else {
		const canonical = markdownFiles.find((file) => file.entry === canonicalEntry);
		if (!canonical) {
			findings.push(`${canonicalEntry.path}: required canonical affinity page is missing.`);
		} else {
			const baseNames = namesInCanonicalTables(canonical.source, 'Affinity');
			if (!sameSet(baseNames, BASE_AFFINITIES)) {
				findings.push(
					`${canonical.relativePath}: canonical base table must contain exactly ${requiredBaseNames}; found ${baseNames.join(', ') || 'none'}.`
				);
			}
			const dualDefinitions = dualDefinitionsInCanonicalTables(canonical.source);
			const dualNames = unique(dualDefinitions.map(({ name }) => name));
			const expectedDualNames = DUAL_AFFINITIES.map(({ name }) => name);
			if (!sameSet(dualNames, expectedDualNames)) {
				findings.push(
					`${canonical.relativePath}: canonical dual table must contain exactly ${requiredDualNames}; found ${dualNames.join(', ') || 'none'}.`
				);
			} else {
				const expectedDefinitions = DUAL_AFFINITIES.map(({ name, parents, status }) => ({
					name,
					parents: [...parents],
					status
				}));
				const definitionsMatch =
					dualDefinitions.length === expectedDefinitions.length &&
					expectedDefinitions.every((expected) => {
						const actual = dualDefinitions.find(({ name }) => name === expected.name);
						return (
							actual?.status === expected.status &&
							actual.parents.length === expected.parents.length &&
							actual.parents.every((parent, index) => parent === expected.parents[index])
						);
					});
				if (!definitionsMatch) {
					findings.push(
						`${canonical.relativePath}: canonical dual definitions must match ${dualSummary(expectedDefinitions)}; found ${dualSummary(dualDefinitions)}.`
					);
				}
			}
			const edges = cycleEdges(canonical.source);
			const expectedEdges = OVERCOMING_EDGES.map(([from, to]) => `${from}>${to}`);
			if (!edges || !sameSet(edges, expectedEdges)) {
				findings.push(
					`${canonical.relativePath}: overcoming cycle must contain exactly ${requiredEdges}; found ${edges?.join(', ') || 'none'}.`
				);
			}
		}
	}

	findings.push(...(await immutableSkillSourceFindings(root)));

	for (const [relativePath, check] of [
		[circleSvgPath, svgEdgeFinding],
		[matrixSvgPath, svgMatrixFinding]
	] as const) {
		const source = await existingSource(path.join(root, relativePath));
		if (!source) continue;
		const finding = check(relativePath, source);
		if (finding) findings.push(finding);
	}

	return findings;
}

const isDirectInvocation =
	process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectInvocation) {
	const findings = await validateAffinityWiki(process.cwd());
	if (findings.length > 0) {
		process.stderr.write(`${findings.join('\n')}\n`);
		process.exitCode = 1;
	} else {
		process.stdout.write('Wiki affinity contract passed.\n');
	}
}
