import { describe, expect, it } from 'vitest';

import {
	CombatSkillDefinitionSchema,
	LearnedCombatSkillStateSchema,
	NamedResistanceSourceSchema
} from './combat-skill.js';
import {
	CombatEquipmentProfileSchema,
	EquipmentFamilyTagSchema,
	EquipmentProficiencyTagSchema
} from './equipment.js';

const swordProfile = {
	schemaVersion: 'combat-equipment-profile-v1',
	definitionId: 'equipment-bronze-sword',
	familyTags: ['one-handed-blade'],
	load: 12,
	requirements: { minimumMight: null, proficiencyTags: [] },
	resistanceGrants: []
} as const;

describe('combat loadout contracts', () => {
	it('freezes family and armour proficiency tags without item-instance training', () => {
		expect(EquipmentFamilyTagSchema.options).toStrictEqual([
			'unarmed',
			'one-handed-blade',
			'two-handed-blade',
			'bow',
			'staff-focus',
			'shield'
		]);
		expect(EquipmentProficiencyTagSchema.options).toStrictEqual(['armour-training']);
		expect(
			LearnedCombatSkillStateSchema.parse({
				schemaVersion: 'learned-combat-skill-v1',
				skillId: 'combat-skill-cross-cut',
				mastery: 35,
				trainedDeliveryTags: ['one-handed-blade', 'two-handed-blade']
			})
		).not.toHaveProperty('equipmentItemId');
	});

	it('keeps load and explicit Might or armour-training requirements separate from Vitality', () => {
		expect(CombatEquipmentProfileSchema.parse(swordProfile)).toStrictEqual(swordProfile);
		const heavyArmour = {
			...swordProfile,
			definitionId: 'equipment-iron-heavy-armour-torso',
			familyTags: [],
			load: 28,
			requirements: { minimumMight: 45, proficiencyTags: ['armour-training'] },
			resistanceGrants: [{ tag: 'cut', basisPoints: 800 }]
		} as const;
		expect(CombatEquipmentProfileSchema.parse(heavyArmour)).toStrictEqual(heavyArmour);
		expect(
			CombatEquipmentProfileSchema.safeParse({
				...heavyArmour,
				requirements: { ...heavyArmour.requirements, minimumVitality: 45 }
			}).success
		).toBe(false);
	});

	it('authors mastery reliability, accuracy, and optional refinements per skill', () => {
		const skill = {
			schemaVersion: 'combat-skill-v1',
			skillId: 'combat-skill-cross-cut',
			displayName: 'Cross Cut',
			kind: 'attack',
			deliveryTags: ['one-handed-blade', 'two-handed-blade'],
			damageTags: ['physical', 'cut'],
			masteryProgression: [
				{ minimumMastery: 0, accuracyBasisPoints: 6_750, reliabilityBasisPoints: 9_000 },
				{
					minimumMastery: 50,
					accuracyBasisPoints: 8_000,
					reliabilityBasisPoints: 9_500,
					refinementUnlockIds: ['cross-cut-follow-through']
				},
				{ minimumMastery: 100, accuracyBasisPoints: 9_250, reliabilityBasisPoints: 9_900 }
			],
			resistanceGrants: []
		} as const;
		expect(CombatSkillDefinitionSchema.parse(skill)).toStrictEqual(skill);
		expect(
			CombatSkillDefinitionSchema.safeParse({
				...skill,
				masteryProgression: [...skill.masteryProgression].reverse()
			}).success
		).toBe(false);
		expect(
			LearnedCombatSkillStateSchema.safeParse({
				schemaVersion: 'learned-combat-skill-v1',
				skillId: 'combat-skill-weathered-hide',
				mastery: 20,
				trainedDeliveryTags: []
			}).success
		).toBe(true);
	});

	it('permits every named resistance on equipment, passive skills, and physiology records', () => {
		const tags = ['cut', 'pierce', 'impact', 'burn', 'frost', 'shock', 'arcane'] as const;
		for (const [index, sourceKind] of ['equipment', 'passive-skill', 'physiology'].entries()) {
			const parsed = NamedResistanceSourceSchema.parse({
				schemaVersion: 'named-resistance-source-v1',
				sourceKind,
				sourceId: `source-${sourceKind}`,
				grants: tags.map((tag, tagIndex) => ({
					tag,
					basisPoints: 100 + index * 10 + tagIndex
				}))
			});
			expect(parsed.grants.map((grant) => grant.tag)).toStrictEqual(tags);
		}
	});

	it('rejects universal poise while permitting an explicitly authored Break meter', () => {
		const shieldStance = {
			schemaVersion: 'combat-skill-v1',
			skillId: 'combat-skill-shield-stance',
			displayName: 'Shield Stance',
			kind: 'stance',
			deliveryTags: ['shield'],
			damageTags: [],
			masteryProgression: [
				{ minimumMastery: 0, accuracyBasisPoints: 10_000, reliabilityBasisPoints: 9_000 }
			],
			resistanceGrants: [{ tag: 'impact', basisPoints: 500 }],
			breakMeter: { maximum: 20, recoveryPerTick: 1 }
		} as const;
		expect(CombatSkillDefinitionSchema.safeParse(shieldStance).success).toBe(true);
		expect(CombatSkillDefinitionSchema.safeParse({ ...shieldStance, poise: 20 }).success).toBe(
			false
		);
		const shield = {
			...swordProfile,
			definitionId: 'equipment-bronze-shield',
			familyTags: ['shield'],
			breakMeter: { maximum: 30, recoveryPerTick: 2 }
		} as const;
		expect(CombatEquipmentProfileSchema.safeParse(shield).success).toBe(true);
		expect(CombatEquipmentProfileSchema.safeParse({ ...shield, poise: 30 }).success).toBe(false);
	});
});
