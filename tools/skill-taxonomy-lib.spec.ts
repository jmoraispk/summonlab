import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	parseTargetSkillRows,
	parseSkillMarkdown,
	LEGACY_SKILL_INVENTORY_V1_SHA256,
	findForbiddenSkillReferencesInAuthoredSources,
	findForbiddenSkillReferences,
	validateLegacyInventory,
	validateMigrationLedger,
	validateNetNewSkillProvenance,
	validateTargetTaxonomy,
	type LegacySkillRow,
	type NetNewSkillLedger,
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

function craftTargetPage(family: string, skill: string): string {
	return `# Craft Skills — ${family}

Domain: **Craft**
Family: **${family}**

| # | Skill | R | T | Requires | Effect |
| ---: | --- | :---: | :---: | --- | --- |
| 1 | **${skill}** | F | P | None | Foundation |`;
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

async function authoredSourcePaths(root: string, extensions: readonly string[]): Promise<string[]> {
	const entries = await readdir(path.resolve(root), { recursive: true });
	return entries
		.filter((entry) => extensions.some((extension) => entry.endsWith(extension)))
		.map((entry) => path.join(root, entry));
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

	it('rejects structural focus hierarchy while allowing ordinary focus prose', () => {
		expect(
			findForbiddenSkillReferences([
				{
					sourcePath: 'docs/wiki/framework.md',
					source:
						'Each focus therefore has a **ladder**.\n\n| Family | Foci |\n| --- | --- |\n| Blade | Sword |'
				},
				{
					sourcePath: 'docs/wiki/equipment.md',
					source:
						'A casting focus is equipment. Training focus is a player choice. Labels never create a separate focus or progression layer.'
				}
			])
		).toEqual([
			'docs/wiki/framework.md: structural focus ladder',
			'docs/wiki/framework.md: structural Family/Foci table'
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

	it('rejects retired Craft families and requirement variants in maintained active sources', () => {
		expect(
			findForbiddenSkillReferencesInAuthoredSources([
				{
					sourcePath: 'docs/wiki/mechanics/skills/example.md',
					source:
						'Family: **Beast**\n\n| Craft | Forging, Beast, Lore |\nRequires: Beast family prerequisite'
				},
				{
					sourcePath: 'apps/web/src/routes/living-village-lab/summon/fixtures.ts',
					source: "{ class: 'crafting', description: 'Learned lore', name: 'Lore' }"
				},
				{
					sourcePath: 'apps/web/src/lib/components/wiki/skill-tree-data.ts',
					source: "{ name: 'Beast', description: 'Creature production' }"
				},
				{
					sourcePath: 'docs/decisions/accepted.md',
					source: 'The `Lore` family remains available.'
				},
				{
					sourcePath: 'docs/evidence/handoff.md',
					source: 'Requires: Lore-prerequisite'
				}
			])
		).toEqual([
			'docs/wiki/mechanics/skills/example.md: retired Craft family Beast',
			'docs/wiki/mechanics/skills/example.md: retired Craft family Lore',
			'docs/wiki/mechanics/skills/example.md: retired Craft family requirement',
			'apps/web/src/routes/living-village-lab/summon/fixtures.ts: retired Craft family Lore',
			'apps/web/src/lib/components/wiki/skill-tree-data.ts: retired Craft family Beast',
			'docs/decisions/accepted.md: retired Craft family Lore',
			'docs/evidence/handoff.md: retired Craft family requirement'
		]);
	});

	it('constrains retired family detection to the Craft family cell', () => {
		expect(
			findForbiddenSkillReferencesInAuthoredSources([
				{
					sourcePath: 'docs/evidence/retired-family.md',
					source: '| Craft | Beast | Former family |'
				},
				{
					sourcePath: 'docs/evidence/retained-skill.md',
					source:
						'| Craft | Gathering | Monarch of Beasts |\n| Craft | Gathering | Beast habitat notes |'
				}
			])
		).toEqual(['docs/evidence/retired-family.md: retired Craft family Beast']);
	});

	it('allows retained creature skill names and ordinary beast and lore prose', () => {
		expect(
			findForbiddenSkillReferencesInAuthoredSources([
				{
					sourcePath: 'docs/evidence/creature-notes.md',
					source: 'Monarch of Beasts preserves old village lore about dangerous creatures.'
				},
				{
					sourcePath: 'apps/web/src/lib/components/wiki/skill-tree-data.ts',
					source: "skill('Monarch of Beasts')"
				}
			])
		).toEqual([]);
	});

	it('finds no retired taxonomy structures in the authored validation corpus', async () => {
		const sourcePaths = [
			...(await authoredSourcePaths('docs/wiki', ['.md'])),
			...(await authoredSourcePaths('docs/decisions', ['.md'])),
			...(await authoredSourcePaths('docs/evidence', ['.md'])),
			'apps/web/src/lib/components/wiki/SkillTree.svelte',
			'apps/web/src/lib/components/wiki/skill-tree-data.ts',
			'apps/web/src/routes/living-village-lab/summon/fixtures.ts'
		];
		const sources = await Promise.all(
			sourcePaths.map(async (sourcePath) => ({
				sourcePath,
				source: await readFile(path.resolve(sourcePath), 'utf8')
			}))
		);

		expect(findForbiddenSkillReferencesInAuthoredSources(sources)).toEqual([]);
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
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
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
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
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

	it.each([
		['sourcePath', 'rewritten.md'],
		['section', 'Rewritten'],
		['row', 99],
		['name', 'Rewritten Skill'],
		['rarity', 'A'],
		['type', 'St'],
		['requires', 'Rewritten prerequisite'],
		['effect', 'Rewritten effect']
	] as const)('rejects migration source-field drift in %s', (field, value) => {
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
		const ledger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
			sourceRowCount: 520,
			records: [
				{
					...source,
					[field]: value,
					disposition: 'retain',
					target: { domain: 'Martial', family: 'Blade', skill: 'Swordsmanship' }
				}
			]
		} as SkillMigrationLedger;

		expect(validateMigrationLedger(ledger, [source])).toContain(
			`${source.sourceId} source ${field} mismatch: expected ${source[field]}, found ${value}`
		);
	});

	it('rejects retired structural references in effective prerequisite and effect fields', () => {
		const legacyFallback = {
			...migrationRecord('Body', 'Legacy Fallback', 1),
			requires: 'Riding Master, Beast family prerequisite',
			effect: 'Unlocks a Lore-prerequisite technique'
		};
		const explicitReplacement = {
			...migrationRecord('Body', 'Explicit Replacement', 2),
			requires: 'Beast prerequisite',
			effect: 'Lore prerequisite',
			replacementRequires: 'Animal Handling Expert',
			replacementEffect: 'Interprets creature behavior'
		};
		const retiredReplacement = {
			...migrationRecord('Body', 'Retired Replacement', 3),
			replacementRequires: 'Beast prerequisite',
			replacementEffect: 'Unlocks a Lore family prerequisite technique'
		};
		const ledger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
			sourceRowCount: 520,
			records: [legacyFallback, explicitReplacement, retiredReplacement]
		} as SkillMigrationLedger;
		const errors = validateMigrationLedger(ledger);

		expect(errors).toEqual(
			expect.arrayContaining([
				'legacy.md#body:1 effective requires contains retired Craft family prerequisite',
				'legacy.md#body:1 effective effect contains retired Craft family prerequisite'
			])
		);
		expect(errors).not.toContain(
			'legacy.md#body:2 effective requires contains retired Craft family prerequisite'
		);
		expect(errors).not.toContain(
			'legacy.md#body:2 effective effect contains retired Craft family prerequisite'
		);
		expect(errors).toEqual(
			expect.arrayContaining([
				'legacy.md#body:3 effective requires contains retired Craft family prerequisite',
				'legacy.md#body:3 effective effect contains retired Craft family prerequisite'
			])
		);
	});

	it('records reviewed Polearm replacements instead of short-tool semantics', async () => {
		const ledger = JSON.parse(
			await readFile('docs/wiki/mechanics/skills/migration-v2.json', 'utf8')
		) as SkillMigrationLedger;
		const bySource = new Map(ledger.records.map((record) => [record.sourceId, record]));

		expect(bySource.get('martial-haft-and-fist.md#axe:1')).toMatchObject({
			target: {
				domain: 'Martial',
				family: 'Polearm',
				skill: 'Halberd Handling',
				labels: [{ namespace: 'Equipment', value: 'Halberd' }]
			},
			replacementRequires: 'Hold a halberd',
			replacementEffect: 'Damage bonus with halberds; small armor-shred chance. **Foundation.**'
		});
		expect(bySource.get('martial-haft-and-fist.md#axe:9')).toMatchObject({
			replacementRequires: '10,000 halberd hits',
			replacementEffect: 'Halberd damage causes bleeding without any affinity'
		});
		expect(
			[2, 3, 4].map(
				(row) => bySource.get(`martial-haft-and-fist.md#axe:${row}`)?.replacementRequires
			)
		).toEqual([
			'Halberd Handling Novice',
			'Halberd Handling Novice',
			'Halberd Handling Intermediate'
		]);
		expect(bySource.get('martial-haft-and-fist.md#hammer:1')).toMatchObject({
			target: {
				domain: 'Martial',
				family: 'Polearm',
				skill: 'Polehammer Handling',
				labels: [{ namespace: 'Equipment', value: 'Polehammer' }]
			},
			replacementRequires: 'Might threshold, hold a polehammer',
			replacementEffect: 'Damage and poise-damage bonus with polehammers. **Foundation.**'
		});
		expect(bySource.get('martial-haft-and-fist.md#hammer:9')).toMatchObject({
			replacementRequires: 'Concussive Blow Master, 10,000 polehammer hits',
			replacementEffect: 'Every fourth polehammer hit dazes automatically'
		});
		expect(
			[2, 3, 4].map(
				(row) => bySource.get(`martial-haft-and-fist.md#hammer:${row}`)?.replacementRequires
			)
		).toEqual([
			'Polehammer Handling Novice',
			'Polehammer Handling Novice',
			'Polehammer Handling Intermediate'
		]);
		const retainedPolearmRows = ledger.records.filter(
			(record) => ['Axe', 'Hammer'].includes(record.section) && record.disposition !== 'delete'
		);
		expect(retainedPolearmRows).toHaveLength(27);
		expect(
			retainedPolearmRows.filter((record) =>
				/\b(?:axe|axes|hammer or mace|blunt hit)\b/iu.test(
					`${record.replacementRequires ?? record.requires} ${record.replacementEffect ?? record.effect}`
				)
			)
		).toEqual([]);
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
			'Riding Master, another Martial skill at Expert'
		);
		expect(replacements['craft-and-life.md#forging:14']).toBe(
			'Alloying Master, Animal Handling Expert'
		);
	});

	it("records retired Elemental dispositions and defers Sunfall's alignment rider without rewriting source provenance", async () => {
		const ledger = JSON.parse(
			await readFile('docs/wiki/mechanics/skills/migration-v2.json', 'utf8')
		) as SkillMigrationLedger;
		const woodRows = ledger.records.filter((record) => record.section === 'Evocation — Wood');
		const metalRows = ledger.records.filter((record) => record.section === 'Evocation — Metal');
		const attunement = ledger.records.find(
			(record) => record.sourceId === 'magical-disciplines.md#enchantment:12'
		);
		const sunfall = ledger.records.find(
			(record) => record.sourceId === 'magical-evocation.md#evocation-fire:18'
		);
		const elementalRows = parseTargetSkillRows([
			{
				sourcePath: 'docs/wiki/mechanics/skills/magical-elemental.md',
				source: await readFile('docs/wiki/mechanics/skills/magical-elemental.md', 'utf8')
			}
		]);
		const publishedSunfall = elementalRows.find((row) => row.name === 'Sunfall');

		expect(woodRows).toHaveLength(18);
		expect(
			woodRows.every(
				(record) =>
					record.disposition === 'delete' &&
					record.rationale === 'Wood affinity removed by accepted four-base model' &&
					!('target' in record)
			)
		).toBe(true);
		expect(metalRows).toHaveLength(18);
		expect(
			metalRows.every(
				(record) =>
					record.disposition === 'delete' &&
					record.rationale === 'Metal affinity removed by accepted four-base model' &&
					!('target' in record)
			)
		).toBe(true);
		expect(ledger.records.some((record) => record.target && 'publication' in record.target)).toBe(
			false
		);
		expect(attunement).toMatchObject({
			effect: "Grants an ally the hero's affinity temporarily at reduced Resonance",
			replacementEffect: "Grants an ally the hero's affinity temporarily at reduced affinity rank."
		});
		expect(sunfall).toMatchObject({
			effect:
				'A second sun, briefly. Everything unaligned or Metal-aligned in range is simply gone.',
			target: {
				domain: 'Magical',
				family: 'Elemental',
				skill: 'Sunfall',
				labels: [{ namespace: 'Element', value: 'Fire' }]
			},
			replacementEffect:
				'A second sun, briefly. Its alignment-specific bonus/rider is deferred to the skill-content owner.'
		});
		expect(publishedSunfall).toMatchObject({
			labels: [{ namespace: 'Element', value: 'Fire' }],
			effect:
				'A second sun, briefly. Its alignment-specific bonus/rider is deferred to the skill-content owner.'
		});
		expect(publishedSunfall?.effect).not.toMatch(/\b(?:Wind|Metal)-aligned\b/iu);
	});
});

describe('target skill taxonomy', () => {
	it('accepts explicit net-new provenance without fabricating a legacy source row', () => {
		const rows = parseTargetSkillRows([
			{
				sourcePath: 'blade.md',
				source: targetPage('Blade', 'Reversal Cut', 'Sword', {
					rarity: 'A',
					type: 'A',
					requires:
						"Mirrored Edge Master, Riposte Master, and the deed of parrying a named foe's signature attack",
					effect:
						"After a successful parry, convert the intercepted attack's full force into an unblockable returning cut against a chosen target."
				})
			}
		]);
		const legacyLedger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
			sourceRowCount: 520,
			records: []
		} as SkillMigrationLedger;
		const record = {
			targetId: 'martial:blade:reversal-cut',
			domain: 'Martial' as const,
			family: 'Blade',
			name: 'Reversal Cut',
			labels: [{ namespace: 'Equipment' as const, value: 'Sword' }],
			rarity: 'A',
			type: 'A',
			requires:
				"Mirrored Edge Master, Riposte Master, and the deed of parrying a named foe's signature attack",
			effect:
				"After a successful parry, convert the intercepted attack's full force into an unblockable returning cut against a chosen target.",
			authoredAt: '2026-09-04',
			decisionPath: 'docs/decisions/2026-09-04-reversal-cut.md',
			rationale: 'Owner-approved net-new skill; no legacy inventory source.'
		};
		const provenance = {
			schemaVersion: 'summonlab-net-new-skills-v1',
			records: [record]
		} satisfies NetNewSkillLedger;

		expect(validateNetNewSkillProvenance(rows, legacyLedger, provenance)).toEqual([]);
		expect(
			validateNetNewSkillProvenance(rows, legacyLedger, {
				...provenance,
				records: []
			})
		).toContain('Martial/Blade/Reversal Cut has neither legacy nor net-new provenance');
		expect(
			validateNetNewSkillProvenance(rows, legacyLedger, {
				...provenance,
				records: [record, record]
			})
		).toContain('duplicate net-new target id martial:blade:reversal-cut');
		expect(
			validateNetNewSkillProvenance(
				rows,
				{
					...legacyLedger,
					records: [migrationRecord('Blade', 'Reversal Cut', 1, ['Sword'])]
				},
				provenance
			)
		).toContain('Martial/Blade/Reversal Cut cannot have both legacy and net-new provenance');
	});

	it('keeps the canonical Markdown aligned with the five-family migration ledger', async () => {
		const targetPaths = [
			'docs/wiki/mechanics/skills/martial-blade.md',
			'docs/wiki/mechanics/skills/martial-polearm.md',
			'docs/wiki/mechanics/skills/martial-ranged.md',
			'docs/wiki/mechanics/skills/martial-shield.md',
			'docs/wiki/mechanics/skills/martial-body.md',
			'docs/wiki/mechanics/skills/magical-elemental.md',
			'docs/wiki/mechanics/skills/magical-disciplines.md',
			'docs/wiki/mechanics/skills/craft-and-life.md'
		];
		const [ledgerSource, netNewSource, ...targetSources] = await Promise.all([
			readFile('docs/wiki/mechanics/skills/migration-v2.json', 'utf8'),
			readFile('docs/wiki/mechanics/skills/net-new-v1.json', 'utf8'),
			...targetPaths.map((sourcePath) => readFile(sourcePath, 'utf8'))
		]);
		const ledger = JSON.parse(ledgerSource) as SkillMigrationLedger;
		const netNewLedger = JSON.parse(netNewSource) as NetNewSkillLedger;
		const rows = parseTargetSkillRows(
			targetPaths.map((sourcePath, index) => ({ sourcePath, source: targetSources[index] }))
		);

		expect(familiesFor(rows, 'Craft')).toEqual([
			'Alchemy',
			'Cooking',
			'Forging',
			'Gathering',
			'Knowledge'
		]);
		expect(validateTargetTaxonomy(rows, ledger, netNewLedger)).toEqual([]);
		expect(validateNetNewSkillProvenance(rows, ledger, netNewLedger)).toEqual([]);
		expect(rows.filter((row) => row.domain === 'Craft' && row.family === 'Knowledge')).toHaveLength(
			12
		);
		expect(rows.some((row) => row.name === 'Beast Speech')).toBe(false);
		expect(rows.find((row) => row.name === 'Mounted Combat')).toMatchObject({
			domain: 'Martial',
			family: 'Body',
			requires: 'Riding Master, another Martial skill at Expert'
		});
		expect(rows.find((row) => row.name === 'Reversal Cut')).toMatchObject({
			targetId: 'martial:blade:reversal-cut',
			domain: 'Martial',
			family: 'Blade',
			labels: [{ namespace: 'Equipment', value: 'Sword' }],
			rarity: 'A',
			type: 'A'
		});
	});

	it('allows exactly the five approved Craft families', () => {
		const approvedFamilies = ['Alchemy', 'Cooking', 'Forging', 'Gathering', 'Knowledge'];
		const craftLedger = (family: string) =>
			({
				schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
				sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
				sourceRowCount: 520,
				records: [
					{
						...migrationRecord('Blade', `${family} Foundation`, 1),
						target: { domain: 'Craft' as const, family, skill: `${family} Foundation` }
					}
				]
			}) as SkillMigrationLedger;

		for (const family of approvedFamilies) {
			const rows = parseTargetSkillRows([
				{
					sourcePath: `${family.toLowerCase()}.md`,
					source: craftTargetPage(family, `${family} Foundation`)
				}
			]);
			expect(validateTargetTaxonomy(rows, craftLedger(family))).toEqual([]);
		}

		for (const retiredFamily of ['Beast', 'Lore']) {
			const rows = parseTargetSkillRows([
				{
					sourcePath: `${retiredFamily.toLowerCase()}.md`,
					source: craftTargetPage(retiredFamily, `${retiredFamily} Foundation`)
				}
			]);
			expect(validateTargetTaxonomy(rows, craftLedger(retiredFamily))).toContain(
				`unknown Craft family ${retiredFamily}`
			);
		}
	});

	it('parses the current Martial and Magical family hierarchy and optional Element labels', async () => {
		const paths = [
			'docs/wiki/mechanics/skills/martial-blade.md',
			'docs/wiki/mechanics/skills/martial-body.md',
			'docs/wiki/mechanics/skills/martial-polearm.md',
			'docs/wiki/mechanics/skills/martial-ranged.md',
			'docs/wiki/mechanics/skills/martial-shield.md',
			'docs/wiki/mechanics/skills/magical-elemental.md',
			'docs/wiki/mechanics/skills/magical-disciplines.md'
		];
		const rows = parseTargetSkillRows(
			await Promise.all(
				paths.map(async (sourcePath) => ({
					sourcePath,
					source: await readFile(sourcePath, 'utf8')
				}))
			)
		);
		expect(familiesFor(rows, 'Magical')).toEqual([
			'Elemental',
			'Enchantment',
			'Mind',
			'Restoration',
			'Ward'
		]);
		expect(elementLabelsForFamily(rows, 'Elemental')).toEqual(['Earth', 'Fire', 'Water']);
		expect(rows.find((row) => row.name === 'Shield Sigil')?.labels).toEqual([]);
		expect(rows.find((row) => row.name === 'Elemental Guard')?.labels).toEqual([
			{ namespace: 'Element', value: 'Attuned' }
		]);
	});

	it('keeps Polearm foundations and techniques compatible with their reviewed equipment', async () => {
		const sourcePath = 'docs/wiki/mechanics/skills/martial-polearm.md';
		const rows = parseTargetSkillRows([{ sourcePath, source: await readFile(sourcePath, 'utf8') }]);
		const labelsFor = (name: string) =>
			rows.find((row) => row.name === name)?.labels.map((label) => label.value);

		expect(labelsFor('Polearm Handling')).toEqual([]);
		expect(labelsFor('Butt Strike')).toEqual([]);
		expect(labelsFor('Keep Away')).toEqual([]);
		expect(labelsFor('Sweep Low')).toEqual(['Spear', 'Glaive', 'Halberd']);
		expect(labelsFor('Hook and Pull')).toEqual(['Glaive', 'Halberd']);
		expect(labelsFor('Dragon Tail')).toEqual(['Spear', 'Glaive', 'Halberd']);
		expect(rows.find((row) => row.name === 'Halberd Handling')).toMatchObject({
			requires: 'Hold a halberd',
			effect: 'Damage bonus with halberds; small armor-shred chance. **Foundation.**'
		});
		expect(rows.find((row) => row.name === 'Polehammer Handling')).toMatchObject({
			requires: 'Might threshold, hold a polehammer',
			effect: 'Damage and poise-damage bonus with polehammers. **Foundation.**'
		});
	});

	it('rejects invalid Element labels and subfamily declarations', () => {
		const ledger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
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
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
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
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
			sourceRowCount: 520,
			records: [migrationRecord('Blade', 'Missing Skill', 1)]
		} as SkillMigrationLedger;
		const retainedWithoutTarget = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
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

	it('requires fully qualified merge destinations and resolves exact lineage keys', () => {
		const rows = parseTargetSkillRows([
			{
				sourcePath: 'elemental.md',
				source: magicalTargetPage('Elemental', 'Great Renewal', 'Fire')
			},
			{
				sourcePath: 'restoration.md',
				source: magicalTargetPage('Restoration', 'Great Renewal')
			}
		]);
		const mergeSource = {
			...migrationRecord('Body', 'Legacy Renewal', 7),
			disposition: 'merge',
			target: undefined
		};
		const legacyLedger = {
			schemaVersion: 'summonlab-skill-taxonomy-migration-v2',
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
			sourceRowCount: 520,
			records: [{ ...mergeSource, mergeTarget: 'Great Renewal' }]
		} as unknown as SkillMigrationLedger;
		const qualifiedLedger = {
			...legacyLedger,
			records: [
				{
					...mergeSource,
					mergeTarget: { domain: 'Magical', family: 'Restoration', skill: 'Great Renewal' }
				}
			]
		} as unknown as SkillMigrationLedger;

		expect(validateTargetTaxonomy(rows, legacyLedger)).toContain(
			'legacy.md#body:7 has invalid unqualified mergeTarget Great Renewal'
		);
		expect(validateTargetTaxonomy(rows, qualifiedLedger)).toContain(
			'Magical/Elemental/Great Renewal has no legacy lineage'
		);
		expect(validateTargetTaxonomy(rows, qualifiedLedger)).not.toContain(
			'Magical/Restoration/Great Renewal has no legacy lineage'
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
			sourceInventorySha256: LEGACY_SKILL_INVENTORY_V1_SHA256,
			sourceRowCount: 520,
			records: [migrationRecord('Blade', 'Measured Cut', 3)]
		} as SkillMigrationLedger;

		expect(validateTargetTaxonomy([{ ...row, [field]: value }], ledger)).toContain(diagnostic);
	});
});
