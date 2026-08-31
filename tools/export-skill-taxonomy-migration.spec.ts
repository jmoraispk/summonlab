import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	exportSkillTaxonomyMigration,
	LEGACY_SKILL_INVENTORY_V1_PATH,
	SKILL_MIGRATION_V2_PATH
} from './export-skill-taxonomy-migration.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

describe('skill taxonomy migration exporter', () => {
	it('rejects a coordinated inventory and ledger rewrite outside the frozen digest', async () => {
		const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-taxonomy-digest-'));
		temporaryRoots.push(workspaceRoot);
		const inventory = JSON.parse(await readFile(LEGACY_SKILL_INVENTORY_V1_PATH, 'utf8')) as Array<
			Record<string, unknown>
		>;
		const ledger = JSON.parse(await readFile(SKILL_MIGRATION_V2_PATH, 'utf8')) as {
			records: Array<Record<string, unknown>>;
		};
		inventory[0] = { ...inventory[0], sourcePath: 'rewritten-source.md' };
		ledger.records[0] = { ...ledger.records[0], sourcePath: 'rewritten-source.md' };
		const inventoryPath = path.join(workspaceRoot, LEGACY_SKILL_INVENTORY_V1_PATH);
		const ledgerPath = path.join(workspaceRoot, SKILL_MIGRATION_V2_PATH);
		await mkdir(path.dirname(inventoryPath), { recursive: true });
		await writeFile(inventoryPath, `${JSON.stringify(inventory, null, '\t')}\n`);
		await writeFile(ledgerPath, `${JSON.stringify(ledger, null, '\t')}\n`);

		await expect(exportSkillTaxonomyMigration({ workspaceRoot, mode: 'check' })).rejects.toThrow(
			'legacy inventory SHA-256 mismatch: expected c4b0d6efe79987686fd3cfb6d3400d21c081936c23d7254f63b6b342d2c70df4'
		);
	});
});
