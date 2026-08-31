import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	parseLegacySkillRows,
	validateLegacyInventory,
	type LegacySkillRow,
	type SkillMarkdownFile,
	type SkillMigrationLedger
} from './skill-taxonomy-lib.js';

export const LEGACY_SKILL_SOURCE_PATHS = [
	'docs/wiki/mechanics/skills/martial-blade.md',
	'docs/wiki/mechanics/skills/martial-haft-and-fist.md',
	'docs/wiki/mechanics/skills/martial-hunt-guard-motion.md',
	'docs/wiki/mechanics/skills/martial-universal.md',
	'docs/wiki/mechanics/skills/magical-evocation.md',
	'docs/wiki/mechanics/skills/magical-disciplines.md',
	'docs/wiki/mechanics/skills/craft-and-life.md'
] as const;

export const LEGACY_SKILL_INVENTORY_V1_PATH =
	'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json';
export const SKILL_MIGRATION_V2_PATH = 'docs/wiki/mechanics/skills/migration-v2.json';

export type SkillTaxonomyExportMode = 'check' | 'write' | 'write-inventory';

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function compareRows(left: LegacySkillRow, right: LegacySkillRow): number {
	return (
		left.sourcePath.localeCompare(right.sourcePath) ||
		left.section.localeCompare(right.section) ||
		left.row - right.row
	);
}

async function readLegacyCatalog(workspaceRoot: string): Promise<SkillMarkdownFile[]> {
	return Promise.all(
		LEGACY_SKILL_SOURCE_PATHS.map(async (sourcePath) => ({
			sourcePath,
			source: await readFile(path.resolve(workspaceRoot, sourcePath), 'utf8')
		}))
	);
}

async function readInventory(workspaceRoot: string): Promise<LegacySkillRow[]> {
	const inventoryPath = path.resolve(workspaceRoot, LEGACY_SKILL_INVENTORY_V1_PATH);
	const parsed = JSON.parse(await readFile(inventoryPath, 'utf8')) as unknown;
	if (!Array.isArray(parsed)) throw new Error('Legacy skill inventory must be a JSON array');
	return parsed as LegacySkillRow[];
}

function buildLedger(rows: readonly LegacySkillRow[]): SkillMigrationLedger {
	if (rows.length !== 520) throw new Error(`Expected 520 legacy skill rows, found ${rows.length}`);
	return {
		schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
		sourceRowCount: 520,
		records: rows.map((row) => ({ ...row, disposition: 'unmapped' }))
	};
}

async function writeIfDifferent(destination: string, expected: string): Promise<boolean> {
	const current = await readFile(destination, 'utf8').catch(() => null);
	if (current === expected) return false;
	await mkdir(path.dirname(destination), { recursive: true });
	await writeFile(destination, expected, 'utf8');
	return true;
}

export async function exportSkillTaxonomyMigration(options: {
	readonly workspaceRoot?: string;
	readonly mode: SkillTaxonomyExportMode;
}): Promise<{
	mode: SkillTaxonomyExportMode;
	sourceRowCount: number;
	inSync: boolean;
	written: boolean;
}> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());

	if (options.mode === 'write-inventory') {
		const rows = parseLegacySkillRows(await readLegacyCatalog(workspaceRoot)).sort(compareRows);
		const errors = validateLegacyInventory(rows);
		if (errors.length > 0) throw new Error(errors.join('\n'));
		if (rows.length !== 520)
			throw new Error(`Expected 520 legacy skill rows, found ${rows.length}`);

		const inventoryPath = path.resolve(workspaceRoot, LEGACY_SKILL_INVENTORY_V1_PATH);
		const expected = jsonText(rows);
		const current = await readFile(inventoryPath, 'utf8').catch(() => null);
		if (current !== null && current !== expected)
			throw new Error('Refusing to overwrite a non-equivalent legacy skill inventory snapshot');
		const written = current === null ? await writeIfDifferent(inventoryPath, expected) : false;
		return { mode: options.mode, sourceRowCount: rows.length, inSync: true, written };
	}

	const inventory = await readInventory(workspaceRoot);
	const errors = validateLegacyInventory(inventory);
	if (errors.length > 0) throw new Error(errors.join('\n'));
	const ledger = buildLedger(inventory);
	const expected = jsonText(ledger);
	const ledgerPath = path.resolve(workspaceRoot, SKILL_MIGRATION_V2_PATH);
	const current = await readFile(ledgerPath, 'utf8').catch(() => null);
	const inSync = current === expected;
	const written =
		options.mode === 'write' && !inSync ? await writeIfDifferent(ledgerPath, expected) : false;
	return {
		mode: options.mode,
		sourceRowCount: ledger.sourceRowCount,
		inSync: inSync || written,
		written
	};
}

function parseMode(args: readonly string[]): SkillTaxonomyExportMode {
	if (args.length !== 1 || !['--check', '--write', '--write-inventory'].includes(args[0] ?? ''))
		throw new Error(
			'Usage: tsx tools/export-skill-taxonomy-migration.ts --check|--write|--write-inventory'
		);
	return args[0].slice(2) as SkillTaxonomyExportMode;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const report = await exportSkillTaxonomyMigration({ mode: parseMode(process.argv.slice(2)) });
		process.stdout.write(`${report.sourceRowCount} legacy skill rows\n`);
		if (!report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
