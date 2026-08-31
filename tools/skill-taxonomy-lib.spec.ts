import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
	parseTargetSkillRows,
	parseSkillMarkdown,
	findForbiddenSkillReferencesInAuthoredSources,
	findForbiddenSkillReferences,
	validateLegacyInventory,
	validateMigrationLedger,
	validateTargetTaxonomy,
	type LegacySkillRow,
	type SkillMigrationLedger
} from './skill-taxonomy-lib.js';

function targetPage(
	family: string,
	skill: string,
	equipment = '—',
	details: { rarity?: string; type?: string; requires?: string; effect?: string } = {}
): string {
	return `# Martial Skills — ${family}

Domain: **Martial**
Family: **${family}**

| # | Skill | Equipment | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **${skill}** | ${equipment} | ${details.rarity ?? 'F'} | ${details.type ?? 'P'} | ${details.requires ?? 'None'} | ${details.effect ?? 'Foundation'} |`;
}

function migrationRecord(family: string, skill: string, row: number, equipment: string[] = []) {
	return {
		sourceId: `legacy.md#${family.toLowerCase()}:${row}`,
		sourcePath: 'legacy.md',
		section: family,
		row,
		name: skill,
		rarity: 'F',
		type: 'P',
		requires: 'None',
		effect: 'Foundation',
		disposition: 'rehome' as const,
		target: {
			domain: 'Martial' as const,
			family,
			skill,
			...(equipment.length > 0
				? { labels: equipment.map((value) => ({ namespace: 'Equipment' as const, value })) }
				: {})
		}
	};
}

function magicalTargetPage(family: string, skill: string, element = '—'): string {
	return `# Magical Skills — ${family}

Domain: **Magical**
Family: **${family}**

| # | Skill | Element | R | T | Requires | Effect |
| ---: | --- | --- | :---: | :---: | --- | --- |
| 1 | **${skill}** | ${element} | F | P | None | Foundation |`;
}

function familiesFor(rows: ReturnType<typeof parseTargetSkillRows>, domain: string): string[] {
	return [...new Set(rows.filter((row) => row.domain === domain).map((row) => row.family))].sort();
}

function elementLabelsForFamily(
	rows: ReturnType<typeof parseTargetSkillRows>,
	family: string
): string[] {
	return [
		...new Set(
			rows
				.filter((row) => row.family === family)
				.flatMap((row) => row.labels)
				.filter((label) => label.namespace === 'Element')
				.map((label) => label.value)
		)
	].sort();
}

describe('skill taxonomy migration inventory', () => {
	it('reports exact obsolete taxonomy identities without banning ordinary prose', () => {
		expect(
			findForbiddenSkillReferences([
				{
					sourcePath: 'docs/wiki/example.md',
					source:
						'Universal Martial\nFire Evocation\n## Paired Blades\nA guard uses motion and protection.'
				},
				{
					sourcePath: 'apps/web/src/example.ts',
					source: "href: '/wiki/mechanics/skills/magical-evocation'"
				}
			])
		).toEqual([
			'docs/wiki/example.md: Universal Martial',
			'docs/wiki/example.md: Fire Evocation',
			'docs/wiki/example.md: ## Paired Blades',
			'apps/web/src/example.ts: /wiki/mechanics/skills/magical-evocation'
		]);
	});

	it('ignores test-only stale identities while scanning authored runtime sources', () => {
		expect(
			findForbiddenSkillReferencesInAuthoredSources([
				{
					sourcePath: 'apps/web/src/routes/wiki/skill-tree.e2e.ts',
					source: "expect('/wiki/mechanics/skills/magical-evocation')"
				},
				{
					sourcePath: 'apps/web/src/lib/components/wiki/SkillTree.svelte',
					source: "href: '/wiki/mechanics/skills/magical-evocation'"
				}
			])
		).toEqual([
			'apps/web/src/lib/components/wiki/SkillTree.svelte: /wiki/mechanics/skills/magical-evocation'
		]);
	});

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
		expect(replacements['martial-blade.md#sword:25']).toBe(
			'Swordsmanship Master, Knifework Expert, Great Blade Expert, Two Blades Expert'
		);
		expect(replacements['craft-and-life.md#beast:8']).toBe(
			'Riding Master, Martial family skill at Expert'
		);
		expect(replacements['craft-and-life.md#forging:14']).toBe(
			'Alloying Master, Beast prerequisite'
		);
	});
});

describe('target skill taxonomy', () => {
	it('parses the final five/five/six family hierarchy and optional Element labels', async () => {
		const paths = [
			'docs/wiki/mechanics/skills/martial-blade.md',
			'docs/wiki/mechanics/skills/martial-body.md',
			'docs/wiki/mechanics/skills/martial-polearm.md',
			'docs/wiki/mechanics/skills/martial-ranged.md',
			'docs/wiki/mechanics/skills/martial-shield.md',
			'docs/wiki/mechanics/skills/magical-elemental.md',
			'docs/wiki/mechanics/skills/magical-disciplines.md',
			'docs/wiki/mechanics/skills/craft-and-life.md'
		];
		const rows = parseTargetSkillRows(
			await Promise.all(
				paths.map(async (sourcePath) => ({
					sourcePath,
					source: await readFile(sourcePath, 'utf8')
				}))
			)
		);
		const ledger = JSON.parse(
			await readFile('docs/wiki/mechanics/skills/migration-v2.json', 'utf8')
		) as SkillMigrationLedger;

		expect(validateTargetTaxonomy(rows, ledger)).toEqual([]);
		expect(familiesFor(rows, 'Magical')).toEqual([
			'Elemental',
			'Enchantment',
			'Mind',
			'Restoration',
			'Ward'
		]);
		expect(familiesFor(rows, 'Craft')).toEqual([
			'Alchemy',
			'Beast',
			'Cooking',
			'Forging',
			'Gathering',
			'Lore'
		]);
		expect(elementLabelsForFamily(rows, 'Elemental')).toEqual([
			'Earth',
			'Fire',
			'Metal',
			'Water',
			'Wood'
		]);
		expect(rows.find((row) => row.name === 'Shield Sigil')?.labels).toEqual([]);
		expect(rows.find((row) => row.name === 'Elemental Guard')?.labels).toEqual([
			{ namespace: 'Element', value: 'Attuned' }
		]);
	});

	it('rejects invalid Element labels and subfamily declarations', () => {
		const ledger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 520,
			records: []
		} as SkillMigrationLedger;
		const neutral = parseTargetSkillRows([
			{ sourcePath: 'elemental.md', source: magicalTargetPage('Elemental', 'Ember', 'Neutral') }
		]);
		const unlabeled = parseTargetSkillRows([
			{ sourcePath: 'elemental.md', source: magicalTargetPage('Elemental', 'Ember') }
		]);
		const attuned = parseTargetSkillRows([
			{ sourcePath: 'elemental.md', source: magicalTargetPage('Elemental', 'Ember', 'Attuned') }
		]);
		const multiple = parseTargetSkillRows([
			{
				sourcePath: 'ward.md',
				source: magicalTargetPage('Ward', 'Elemental Guard', 'Fire, Water')
			}
		]);

		expect(validateTargetTaxonomy(neutral, ledger)).toContain('unknown Element label Neutral');
		expect(validateTargetTaxonomy(unlabeled, ledger)).toContain(
			'Magical/Elemental/Ember requires exactly one concrete Element label'
		);
		expect(validateTargetTaxonomy(attuned, ledger)).toContain(
			'Magical/Elemental/Ember requires exactly one concrete Element label'
		);
		expect(validateTargetTaxonomy(multiple, ledger)).toContain(
			'Magical/Ward/Elemental Guard accepts at most one Element label'
		);
		expect(() =>
			parseTargetSkillRows([
				{
					sourcePath: 'subfamily-metadata.md',
					source: `${magicalTargetPage('Elemental', 'Ember', 'Fire')}\n\nSubfamily: **Fire**`
				}
			])
		).toThrow('subfamily-metadata.md declares a forbidden subfamily');
		expect(() =>
			parseTargetSkillRows([
				{
					sourcePath: 'subfamily-heading.md',
					source: `${magicalTargetPage('Elemental', 'Ember', 'Fire')}\n\n### Fire`
				}
			])
		).toThrow('subfamily-heading.md declares a forbidden subfamily');
	});

	it('parses the five Martial families and keeps Two Blades as an unlabeled Blade skill', () => {
		const twoBladesRequires = 'Equip two compatible Blade-family weapons';
		const twoBladesEffect =
			'Enables coordinated two-blade techniques. **Foundation for the two-blade branch.**';
		const files = [
			[
				'blade.md',
				targetPage('Blade', 'Two Blades', '—', {
					requires: twoBladesRequires,
					effect: twoBladesEffect
				})
			],
			['body.md', targetPage('Body', 'Footing')],
			['polearm.md', targetPage('Polearm', 'Spearcraft', 'Spear, Glaive')],
			['ranged.md', targetPage('Ranged', 'Archery', 'Bow')],
			['shield.md', targetPage('Shield', 'Shield Use')]
		].map(([sourcePath, source]) => ({ sourcePath, source }));
		const rows = parseTargetSkillRows(files);
		const ledger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 520,
			records: [
				{
					...migrationRecord('Blade', 'Two Blades', 1),
					replacementRequires: twoBladesRequires,
					replacementEffect: twoBladesEffect
				},
				migrationRecord('Body', 'Footing', 2),
				migrationRecord('Polearm', 'Spearcraft', 3, ['Spear', 'Glaive']),
				migrationRecord('Ranged', 'Archery', 4, ['Bow']),
				migrationRecord('Shield', 'Shield Use', 5)
			]
		} as SkillMigrationLedger;

		expect(validateTargetTaxonomy(rows, ledger)).toEqual([]);
		expect([...new Set(rows.map((row) => row.family))].sort()).toEqual([
			'Blade',
			'Body',
			'Polearm',
			'Ranged',
			'Shield'
		]);
		expect(rows.find((row) => row.name === 'Two Blades')?.labels).toEqual([]);
		expect(rows.find((row) => row.name === 'Two Blades')?.family).toBe('Blade');
		expect(rows.find((row) => row.name === 'Spearcraft')?.labels).toEqual([
			{ namespace: 'Equipment', value: 'Spear' },
			{ namespace: 'Equipment', value: 'Glaive' }
		]);
	});

	it('rejects invalid Martial structure and broken migration lineage', () => {
		const validRow = parseTargetSkillRows([
			{ sourcePath: 'blade.md', source: targetPage('Blade', 'Two Blades', 'Two Blades') }
		]);
		const unknownFamilyRow = parseTargetSkillRows([
			{ sourcePath: 'duelist.md', source: targetPage('Duelist', 'Lunge') }
		]);
		const unmaterializedLedger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 520,
			records: [migrationRecord('Blade', 'Missing Skill', 1)]
		} as SkillMigrationLedger;
		const retainedWithoutTarget = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 520,
			records: [
				{
					...migrationRecord('Blade', 'Two Blades', 2),
					disposition: 'retain',
					target: undefined
				}
			]
		} as SkillMigrationLedger;

		expect(validateTargetTaxonomy(unknownFamilyRow, unmaterializedLedger)).toContain(
			'unknown Martial family Duelist'
		);
		expect(validateTargetTaxonomy(validRow, unmaterializedLedger)).toEqual(
			expect.arrayContaining([
				'Equipment label Two Blades is forbidden',
				'legacy.md#blade:1 targets missing Martial/Blade/Missing Skill',
				'Martial/Blade/Two Blades has no legacy lineage'
			])
		);
		expect(validateTargetTaxonomy(validRow, retainedWithoutTarget)).toContain(
			'legacy.md#blade:2 has no target'
		);
	});

	it.each([
		['rarity', 'E', 'rarity mismatch for Martial/Blade/Measured Cut: expected F, found E'],
		['type', 'A', 'type mismatch for Martial/Blade/Measured Cut: expected P, found A'],
		[
			'requires',
			'Swordsmanship Expert',
			'requires mismatch for Martial/Blade/Measured Cut: expected None, found Swordsmanship Expert'
		],
		[
			'effect',
			'Changed effect',
			'effect mismatch for Martial/Blade/Measured Cut: expected Foundation, found Changed effect'
		]
	] as const)('rejects target %s drift from its migration record', (field, value, diagnostic) => {
		const [row] = parseTargetSkillRows([
			{ sourcePath: 'blade.md', source: targetPage('Blade', 'Measured Cut') }
		]);
		const ledger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceRowCount: 520,
			records: [migrationRecord('Blade', 'Measured Cut', 3)]
		} as SkillMigrationLedger;

		expect(validateTargetTaxonomy([{ ...row, [field]: value }], ledger)).toContain(diagnostic);
	});
});
