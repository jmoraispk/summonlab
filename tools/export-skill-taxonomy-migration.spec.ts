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
	it('generates and verifies the approved five-family Craft consolidation', async () => {
		await expect(exportSkillTaxonomyMigration({ mode: 'check' })).resolves.toEqual({
			mode: 'check',
			sourceRowCount: 520,
			inSync: true,
			written: false
		});

		const workspaceRoot = await mkdtemp(path.join(os.tmpdir(), 'skill-taxonomy-sync-'));
		temporaryRoots.push(workspaceRoot);
		const inventoryPath = path.join(workspaceRoot, LEGACY_SKILL_INVENTORY_V1_PATH);
		await mkdir(path.dirname(inventoryPath), { recursive: true });
		await writeFile(inventoryPath, await readFile(LEGACY_SKILL_INVENTORY_V1_PATH, 'utf8'));

		await expect(exportSkillTaxonomyMigration({ workspaceRoot, mode: 'write' })).resolves.toEqual({
			mode: 'write',
			sourceRowCount: 520,
			inSync: true,
			written: true
		});
		await expect(exportSkillTaxonomyMigration({ workspaceRoot, mode: 'check' })).resolves.toEqual({
			mode: 'check',
			sourceRowCount: 520,
			inSync: true,
			written: false
		});

		const ledger = JSON.parse(
			await readFile(path.join(workspaceRoot, SKILL_MIGRATION_V2_PATH), 'utf8')
		) as {
			records: Array<{
				sourceId: string;
				disposition: string;
				requires: string;
				effect: string;
				target?: { domain: string; family: string; skill: string };
				mergeTarget?: { domain: string; family: string; skill: string };
				replacementRequires?: string;
				replacementEffect?: string;
			}>;
		};
		const activeRecords = ledger.records.filter(
			(record) => record.disposition !== 'delete' && record.disposition !== 'merge'
		);
		const bySource = new Map(ledger.records.map((record) => [record.sourceId, record]));
		const familyCounts = Object.fromEntries(
			['Alchemy', 'Cooking', 'Forging', 'Gathering', 'Knowledge'].map((family) => [
				family,
				activeRecords.filter(
					(record) => record.target?.domain === 'Craft' && record.target.family === family
				).length
			])
		);
		const domainCounts = Object.fromEntries(
			['Martial', 'Magical', 'Craft'].map((domain) => [
				domain,
				activeRecords.filter((record) => record.target?.domain === domain).length
			])
		);

		expect(Object.keys(familyCounts).sort()).toEqual([
			'Alchemy',
			'Cooking',
			'Forging',
			'Gathering',
			'Knowledge'
		]);
		expect(familyCounts).toEqual({
			Alchemy: 16,
			Cooking: 12,
			Forging: 16,
			Gathering: 18,
			Knowledge: 13
		});
		expect(domainCounts).toEqual({ Martial: 258, Magical: 160, Craft: 75 });
		expect(activeRecords).toHaveLength(493);
		expect(bySource.get('craft-and-life.md#beast:2')).toMatchObject({
			disposition: 'merge',
			mergeTarget: { domain: 'Craft', family: 'Gathering', skill: 'Animal Handling' }
		});
		expect(bySource.get('craft-and-life.md#beast:3')).toMatchObject({
			disposition: 'merge',
			mergeTarget: { domain: 'Craft', family: 'Gathering', skill: 'Animal Handling' }
		});
		expect(bySource.get('craft-and-life.md#beast:1')).toMatchObject({
			target: { domain: 'Craft', family: 'Gathering', skill: 'Animal Handling' },
			replacementEffect: expect.stringMatching(/calm hostile beasts.*feeding/iu)
		});
		expect(bySource.get('craft-and-life.md#beast:7')).toMatchObject({
			target: { domain: 'Martial', family: 'Body', skill: 'Pack Bond' },
			replacementEffect: expect.stringMatching(/several tamed companions.*coordinate attacks/iu)
		});
		expect(bySource.get('craft-and-life.md#beast:10')).toMatchObject({
			target: { domain: 'Craft', family: 'Gathering', skill: 'Greater Taming' },
			replacementRequires: expect.stringMatching(/^Taming Master/u)
		});
		expect(bySource.get('craft-and-life.md#beast:8')).toMatchObject({
			target: { domain: 'Martial', family: 'Body', skill: 'Mounted Combat' },
			replacementRequires: 'Riding Master, another Martial skill at Expert'
		});
		expect(
			Object.fromEntries(
				ledger.records
					.filter(
						(record) =>
							record.sourceId.startsWith('craft-and-life.md#beast:') &&
							record.disposition !== 'merge'
					)
					.map((record) => [
						record.target?.skill,
						`${record.target?.domain}/${record.target?.family}`
					])
			)
		).toEqual({
			'Animal Handling': 'Craft/Gathering',
			Riding: 'Martial/Body',
			Taming: 'Craft/Gathering',
			'Beast Speech': 'Craft/Knowledge',
			'Pack Bond': 'Martial/Body',
			'Mounted Combat': 'Martial/Body',
			Breeding: 'Craft/Gathering',
			'Greater Taming': 'Craft/Gathering',
			'Bonded Mount': 'Martial/Body',
			'Monarch of Beasts': 'Craft/Gathering'
		});
		expect(
			activeRecords.flatMap((record) => [
				record.replacementRequires ?? record.requires,
				record.replacementEffect ?? record.effect
			])
		).not.toContainEqual(
			expect.stringMatching(/\b(?:Beast|Lore)(?:[ -]+family)?[ -]+prerequisite\b/iu)
		);
	});

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
