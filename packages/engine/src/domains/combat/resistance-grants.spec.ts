import { describe, expect, it } from 'vitest';

import { COMBAT_EQUIPMENT_PROFILE_CATALOG, COMBAT_RULES_V1 } from '@summonlab/content';
import {
	CombatSkillDefinitionSchema,
	NamedResistanceSourceSchema,
	ResistanceGrantReceiptSchema
} from '@summonlab/contracts';

import { namedResistanceReduction } from './capability.js';
import { resistanceGrantReceiptsFromAuthoredSources } from './resistance-grants.js';

describe('authored resistance grant receipts', () => {
	it('adapts real heavy-armor cut grants and applies the global combat-rules cap', () => {
		const heavyArmor = COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles
			.filter((profile) => profile.definitionId.includes('-heavy-armor-'))
			.slice(0, 10)
			.map((profile, index) => ({ sourceInstanceId: `heavy-armor-${index}`, profile }));
		const receipts = resistanceGrantReceiptsFromAuthoredSources(
			{ equipment: heavyArmor, passiveSkills: [], physiology: [] },
			COMBAT_RULES_V1
		);

		expect(receipts).toHaveLength(20);
		expect(
			receipts.every((receipt) => ResistanceGrantReceiptSchema.safeParse(receipt).success)
		).toBe(true);
		expect(receipts[0]).toMatchObject({
			tag: 'cut',
			basisPoints: 800,
			stackingRule: 'additive',
			capBasisPoints: 1_500,
			source: { sourceKind: 'equipment' },
			rulesVersion: 'combat-rules-v1'
		});
		expect(namedResistanceReduction(['physical', 'cut'], receipts, COMBAT_RULES_V1)).toBe(7_500);
	});

	it('uses the stricter of each authored cap and the global rules cap', () => {
		const profile = COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.find(
			(candidate) => candidate.definitionId === 'equipment-iron-heavy-armor-torso'
		)!;
		const strictRules = { ...COMBAT_RULES_V1, resistance: { capBasisPoints: 500 } };
		const receipts = resistanceGrantReceiptsFromAuthoredSources(
			{
				equipment: [{ sourceInstanceId: 'strict-cap-armor', profile }],
				passiveSkills: [],
				physiology: []
			},
			strictRules
		);
		const cut = receipts.find((receipt) => receipt.tag === 'cut');

		expect(cut).toMatchObject({ basisPoints: 500, capBasisPoints: 500 });
		expect(namedResistanceReduction(['cut'], receipts, strictRules)).toBe(500);
	});

	it('gives equipment, passive-skill, and physiology sources stable collision-free identities', () => {
		const profile = COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.find(
			(candidate) => candidate.definitionId === 'equipment-iron-heavy-armor-torso'
		)!;
		const secondProfile = COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.find(
			(candidate) => candidate.definitionId === 'equipment-bronze-heavy-armor-head'
		)!;
		const passiveSkill = CombatSkillDefinitionSchema.parse({
			schemaVersion: 'combat-skill-v1',
			skillId: 'combat-skill-flame-acclimation',
			displayName: 'Flame Acclimation',
			kind: 'passive',
			deliveryTags: [],
			damageTags: [],
			masteryProgression: [
				{ minimumMastery: 0, accuracyBasisPoints: 0, reliabilityBasisPoints: 10_000 }
			],
			resistanceGrants: [{ tag: 'burn', basisPoints: 400, capBasisPoints: 1_000 }]
		});
		const physiology = NamedResistanceSourceSchema.parse({
			schemaVersion: 'named-resistance-source-v1',
			sourceKind: 'physiology',
			sourceId: 'stone-hide',
			grants: [{ tag: 'frost', basisPoints: 300, capBasisPoints: 900 }]
		});
		const sources = {
			equipment: [
				{ sourceInstanceId: 'shared-instance', profile },
				{ sourceInstanceId: 'other-instance', profile: secondProfile }
			],
			passiveSkills: [{ sourceInstanceId: 'shared-instance', skill: passiveSkill }],
			physiology: [{ sourceInstanceId: 'shared-instance', source: physiology }]
		};
		const first = resistanceGrantReceiptsFromAuthoredSources(sources, COMBAT_RULES_V1);
		const second = resistanceGrantReceiptsFromAuthoredSources(
			{
				equipment: [...sources.equipment].reverse(),
				passiveSkills: [...sources.passiveSkills].reverse(),
				physiology: [...sources.physiology].reverse()
			},
			COMBAT_RULES_V1
		);

		expect(second).toStrictEqual(first);
		expect(new Set(first.map((receipt) => receipt.grantId)).size).toBe(6);
		expect(new Set(first.map((receipt) => receipt.source.receiptId)).size).toBe(4);
		expect(first.map((receipt) => receipt.source.sourceKind).sort()).toStrictEqual([
			'equipment',
			'equipment',
			'equipment',
			'equipment',
			'physiology',
			'skill'
		]);
	});

	it('keeps deterministic identities distinct when authored and instance IDs contain separators', () => {
		const firstSource = NamedResistanceSourceSchema.parse({
			schemaVersion: 'named-resistance-source-v1',
			sourceKind: 'physiology',
			sourceId: 'stone:hide',
			grants: [{ tag: 'frost', basisPoints: 300, capBasisPoints: 900 }]
		});
		const secondSource = NamedResistanceSourceSchema.parse({
			schemaVersion: 'named-resistance-source-v1',
			sourceKind: 'physiology',
			sourceId: 'stone',
			grants: [{ tag: 'frost', basisPoints: 300, capBasisPoints: 900 }]
		});
		const receipts = resistanceGrantReceiptsFromAuthoredSources(
			{
				equipment: [],
				passiveSkills: [],
				physiology: [
					{ sourceInstanceId: 'hero', source: firstSource },
					{ sourceInstanceId: 'hide:hero', source: secondSource }
				]
			},
			COMBAT_RULES_V1
		);

		expect(new Set(receipts.map((receipt) => receipt.grantId)).size).toBe(2);
		expect(new Set(receipts.map((receipt) => receipt.source.receiptId)).size).toBe(2);
	});

	it('rejects duplicate equipment source instances before deterministic IDs can alias', () => {
		const profile = COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.find(
			(candidate) => candidate.definitionId === 'equipment-iron-heavy-armor-torso'
		)!;
		const equipment = [
			{ sourceInstanceId: 'duplicate-instance', profile },
			{ sourceInstanceId: 'duplicate-instance', profile }
		];
		expect(() =>
			resistanceGrantReceiptsFromAuthoredSources(
				{ equipment, passiveSkills: [], physiology: [] },
				COMBAT_RULES_V1
			)
		).toThrow(/duplicate authored resistance source instance/iu);
	});

	it('rejects active skills supplied through the passive resistance seam', () => {
		const activeSkill = CombatSkillDefinitionSchema.parse({
			schemaVersion: 'combat-skill-v1',
			skillId: 'combat-skill-burning-cut',
			displayName: 'Burning Cut',
			kind: 'attack',
			deliveryTags: ['one-handed-blade'],
			damageTags: ['physical', 'cut'],
			masteryProgression: [
				{ minimumMastery: 0, accuracyBasisPoints: 6_750, reliabilityBasisPoints: 9_000 }
			],
			resistanceGrants: [{ tag: 'burn', basisPoints: 200, capBasisPoints: 800 }]
		});
		expect(() =>
			resistanceGrantReceiptsFromAuthoredSources(
				{
					equipment: [],
					passiveSkills: [{ sourceInstanceId: 'skill-instance', skill: activeSkill }],
					physiology: []
				},
				COMBAT_RULES_V1
			)
		).toThrow(/must be passive/iu);
	});

	it('rejects non-physiology records supplied through the physiology seam', () => {
		const equipmentSource = NamedResistanceSourceSchema.parse({
			schemaVersion: 'named-resistance-source-v1',
			sourceKind: 'equipment',
			sourceId: 'misrouted-armor',
			grants: [{ tag: 'cut', basisPoints: 300, capBasisPoints: 900 }]
		});
		expect(() =>
			resistanceGrantReceiptsFromAuthoredSources(
				{
					equipment: [],
					passiveSkills: [],
					physiology: [{ sourceInstanceId: 'hero-1', source: equipmentSource }]
				},
				COMBAT_RULES_V1
			)
		).toThrow(/must be physiology/iu);
	});
});
