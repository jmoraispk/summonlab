import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
	parseSkillMarkdown,
	validateLegacyInventory,
	validateMigrationLedger,
	type LegacySkillRow,
	type SkillMigrationLedger
} from './skill-taxonomy-lib.js';

describe('skill taxonomy migration inventory', () => {
	it('parses a catalog row with its page and section identity', () => {
		const rows = parseSkillMarkdown(
			'martial-blade.md',
			'## Sword\n\n| # | Skill | R | T | Requires | Effect |\n|---|---|---|---|---|---|\n| 1 | **Swordsmanship** | F | P | Hold a sword | Foundation |'
		);

		expect(rows).toEqual([
			expect.objectContaining({
				sourcePath: 'martial-blade.md',
				section: 'Sword',
				name: 'Swordsmanship',
				rarity: 'F',
				type: 'P'
			})
		]);
	});

	it('parses an annotated catalog skill from its bold name', () => {
		const rows = parseSkillMarkdown(
			'magical-disciplines.md',
			'## Ward\n\n| # | Skill | R | T | Requires | Effect |\n|---|---|---|---|---|---|\n| 4 | **Elemental Guard** *(elemental)* | F | P | Warding Intermediate | Standing resistance |'
		);

		expect(rows).toEqual([
			expect.objectContaining({
				sourceId: 'magical-disciplines.md#ward:4',
				name: 'Elemental Guard'
			})
		]);
	});

	it('rejects duplicate source identities', () => {
		const row = {
			sourceId: 'martial-blade.md#sword:1',
			sourcePath: 'martial-blade.md',
			section: 'Sword',
			row: 1,
			name: 'Swordsmanship',
			rarity: 'F',
			type: 'P',
			requires: 'Hold a sword',
			effect: 'Foundation'
		} as const;

		expect(validateLegacyInventory([row, row])).toContain(
			'duplicate source id martial-blade.md#sword:1'
		);
	});

	it('reports incomplete and invalid migration dispositions', () => {
		const record = {
			sourceId: 'martial-universal.md#universal-martial:1',
			sourcePath: 'martial-universal.md',
			section: 'Universal Martial',
			row: 1,
			name: 'Footing',
			rarity: 'F',
			type: 'P',
			requires: 'None',
			effect: 'Foundation'
		} as const;
		const ledgerWithUnmappedRecord = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 520,
			records: [{ ...record, disposition: 'unmapped' }]
		} satisfies SkillMigrationLedger;
		const ledgerWithTwoTargetsForOneSource = {
			...ledgerWithUnmappedRecord,
			records: [
				{
					...record,
					sourceId: 'martial-blade.md#sword:1',
					disposition: 'rehome',
					target: { domain: 'Martial', family: 'Blade', skill: 'Footing' }
				},
				{
					...record,
					sourceId: 'martial-blade.md#sword:1',
					disposition: 'rehome',
					target: { domain: 'Martial', family: 'Body', skill: 'Footing' }
				}
			]
		} satisfies SkillMigrationLedger;
		const ledgerWithMergeWithoutTarget = {
			...ledgerWithUnmappedRecord,
			records: [
				{
					...record,
					sourceId: 'martial-hunt-guard-motion.md#protection:8',
					disposition: 'merge'
				}
			]
		} satisfies SkillMigrationLedger;
		const ledgerWithDeleteWithoutRationale = {
			...ledgerWithUnmappedRecord,
			records: [
				{
					...record,
					sourceId: 'martial-hunt-guard-motion.md#tracking:1',
					disposition: 'delete'
				}
			]
		} satisfies SkillMigrationLedger;

		expect(validateMigrationLedger(ledgerWithUnmappedRecord)).toContain(
			'martial-universal.md#universal-martial:1 is unmapped'
		);
		expect(validateMigrationLedger(ledgerWithTwoTargetsForOneSource)).toContain(
			'duplicate source id martial-blade.md#sword:1'
		);
		expect(validateMigrationLedger(ledgerWithMergeWithoutTarget)).toContain(
			'merge record martial-hunt-guard-motion.md#protection:8 requires mergeTarget'
		);
		expect(validateMigrationLedger(ledgerWithDeleteWithoutRationale)).toContain(
			'delete record martial-hunt-guard-motion.md#tracking:1 requires rationale'
		);
	});

	it('compares each migration source id against the frozen inventory', () => {
		const source = {
			sourceId: 'martial-blade.md#sword:1',
			sourcePath: 'martial-blade.md',
			section: 'Sword',
			row: 1,
			name: 'Swordsmanship',
			rarity: 'F',
			type: 'P',
			requires: 'Hold a sword',
			effect: 'Foundation'
		} as const satisfies LegacySkillRow;
		const missingSource = { ...source, sourceId: 'martial-blade.md#sword:2', row: 2 };
		const retainedRecord = {
			...source,
			disposition: 'retain',
			target: { domain: 'Martial', family: 'Blade', skill: 'Swordsmanship' }
		} as const;
		const truncatedLedger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 1,
			records: [retainedRecord]
		} as unknown as SkillMigrationLedger;
		const ledgerWithUnknownSource = {
			...truncatedLedger,
			records: [
				{
					...retainedRecord,
					sourceId: 'martial-blade.md#sword:999',
					row: 999
				}
			]
		} as SkillMigrationLedger;

		expect(validateMigrationLedger(truncatedLedger, [source, missingSource])).toContain(
			'expected 520 ledger records, found 1'
		);
		expect(validateMigrationLedger(truncatedLedger, [source, missingSource])).toContain(
			'missing source id martial-blade.md#sword:2'
		);
		expect(validateMigrationLedger(ledgerWithUnknownSource, [source])).toContain(
			'unknown source id martial-blade.md#sword:999'
		);
	});

	it('records prerequisite replacements for retired taxonomy nodes', async () => {
		const ledger = JSON.parse(
			await readFile(
				new URL('../docs/wiki/mechanics/skills/migration-v2.json', import.meta.url),
				'utf8'
			)
		) as SkillMigrationLedger;
		const replacements = Object.fromEntries(
			ledger.records.map((record) => [record.sourceId, record.replacementRequires])
		);

		expect(replacements['martial-hunt-guard-motion.md#protection:2']).toBe('Shield Use Novice');
		expect(replacements['martial-hunt-guard-motion.md#protection:3']).toBe('Shield Use Novice');
		expect(replacements['martial-blade.md#dagger:20']).toBe('Blade Throw Master');
		expect(replacements['martial-hunt-guard-motion.md#bow:11']).toBe('Archery Intermediate');
		expect(replacements['martial-blade.md#dagger:16']).toBe('Silent Step Expert');
		expect(replacements['craft-and-life.md#beast:8']).toBe(
			'Riding Master, Martial family skill at Expert'
		);
		expect(replacements['craft-and-life.md#forging:14']).toBe(
			'Alloying Master, Beast prerequisite'
		);
	});
});
