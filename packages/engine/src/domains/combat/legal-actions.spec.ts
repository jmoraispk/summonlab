import { describe, expect, it } from 'vitest';

import type {
	CombatEquipmentProfile,
	CombatSkillDefinition,
	LearnedCombatSkillState
} from '@summonlab/contracts';

import { evaluateCombatLoadout, legalCombatSkillActions } from './legal-actions.js';

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
		}
	],
	resistanceGrants: []
} as const satisfies CombatSkillDefinition;

function equipment(
	definitionId: string,
	familyTags: CombatEquipmentProfile['familyTags'],
	load = 10,
	minimumMight: number | null = null,
	proficiencyTags: CombatEquipmentProfile['requirements']['proficiencyTags'] = []
): CombatEquipmentProfile {
	return {
		schemaVersion: 'combat-equipment-profile-v1',
		definitionId,
		familyTags,
		load,
		requirements: { minimumMight, proficiencyTags },
		resistanceGrants: []
	};
}

function learned(
	trainedDeliveryTags: LearnedCombatSkillState['trainedDeliveryTags'],
	mastery = 35
): LearnedCombatSkillState {
	return {
		schemaVersion: 'learned-combat-skill-v1',
		skillId: skill.skillId,
		mastery,
		trainedDeliveryTags
	};
}

describe('combat legal actions', () => {
	it('requires one family to intersect equipment, skill delivery, and trained tags', () => {
		const common = {
			intrinsicMight: 60,
			effectiveLoadMight: 60,
			proficiencyTags: [],
			skills: [skill]
		} as const;
		expect(
			legalCombatSkillActions({
				...common,
				equipment: [equipment('equipment-bronze-sword', ['one-handed-blade'])],
				learnedSkills: [learned(['one-handed-blade'])]
			})
		).toHaveLength(1);
		expect(
			legalCombatSkillActions({
				...common,
				equipment: [equipment('equipment-ash-bow', ['bow'])],
				learnedSkills: [learned(['one-handed-blade'])]
			})
		).toStrictEqual([]);
		expect(
			legalCombatSkillActions({
				...common,
				equipment: [equipment('equipment-blacksteel-sword', ['one-handed-blade'])],
				learnedSkills: [learned(['two-handed-blade'])]
			})
		).toStrictEqual([]);
	});

	it('unlocks a related family only after explicit family familiarization, regardless of item ID', () => {
		const twoHandedBlade = equipment('equipment-steel-greatsword', ['two-handed-blade']);
		const common = {
			intrinsicMight: 60,
			effectiveLoadMight: 60,
			proficiencyTags: [] as const,
			equipment: [twoHandedBlade],
			skills: [skill]
		};
		expect(
			legalCombatSkillActions({
				...common,
				learnedSkills: [learned(['one-handed-blade'])]
			})
		).toStrictEqual([]);
		expect(
			legalCombatSkillActions({
				...common,
				learnedSkills: [learned(['one-handed-blade', 'two-handed-blade'])]
			})
		).toMatchObject([
			{
				skillId: 'combat-skill-cross-cut',
				deliveryTag: 'two-handed-blade',
				accuracyBasisPoints: 6_750,
				reliabilityBasisPoints: 9_000,
				refinementUnlockIds: []
			}
		]);
	});

	it('uses authored per-skill mastery progression without improving unrelated axes', () => {
		const [action] = legalCombatSkillActions({
			intrinsicMight: 60,
			effectiveLoadMight: 60,
			proficiencyTags: [],
			equipment: [equipment('equipment-bronze-sword', ['one-handed-blade'])],
			skills: [skill],
			learnedSkills: [learned(['one-handed-blade'], 75)]
		});
		expect(action).toStrictEqual({
			skillId: 'combat-skill-cross-cut',
			displayName: 'Cross Cut',
			kind: 'attack',
			deliveryTag: 'one-handed-blade',
			accuracyBasisPoints: 8_000,
			reliabilityBasisPoints: 9_500,
			refinementUnlockIds: ['cross-cut-follow-through']
		});
		expect(action).not.toHaveProperty('damageBonus');
		expect(action).not.toHaveProperty('criticalChance');
		expect(action).not.toHaveProperty('manaEfficiency');
		expect(action).not.toHaveProperty('actionCadence');
	});

	it('rejects overloaded or explicitly ineligible loadouts without consulting Vitality', () => {
		const heavyArmour = equipment('equipment-iron-heavy-armour-torso', [], 28, 45, [
			'armour-training'
		]);
		expect(
			evaluateCombatLoadout({
				intrinsicMight: 40,
				effectiveLoadMight: 60,
				proficiencyTags: [],
				equipment: [heavyArmour]
			})
		).toStrictEqual({
			eligible: false,
			totalLoad: 28,
			mightLoadTolerance: 60,
			reasons: [
				'equipment-iron-heavy-armour-torso:minimum-might',
				'equipment-iron-heavy-armour-torso:missing-armour-training'
			]
		});
		expect(
			evaluateCombatLoadout({
				intrinsicMight: 45,
				effectiveLoadMight: 45,
				proficiencyTags: ['armour-training'],
				equipment: [heavyArmour, equipment('equipment-bronze-axe', [], 20)]
			})
		).toMatchObject({ eligible: false, totalLoad: 48, mightLoadTolerance: 45 });
		expect(
			evaluateCombatLoadout({
				intrinsicMight: 60,
				effectiveLoadMight: 60,
				proficiencyTags: ['armour-training'],
				equipment: [heavyArmour]
			})
		).toStrictEqual({ eligible: true, totalLoad: 28, mightLoadTolerance: 60, reasons: [] });
	});

	it('lets scoped effective Might raise load tolerance without satisfying intrinsic requirements', () => {
		const loadOnly = equipment('equipment-iron-shield', ['shield'], 50);
		expect(
			evaluateCombatLoadout({
				intrinsicMight: 40,
				effectiveLoadMight: 60,
				proficiencyTags: [],
				equipment: [loadOnly]
			})
		).toStrictEqual({ eligible: true, totalLoad: 50, mightLoadTolerance: 60, reasons: [] });
		const intrinsicallyGated = equipment('equipment-iron-heavy-armour-torso', [], 28, 45);
		expect(
			evaluateCombatLoadout({
				intrinsicMight: 40,
				effectiveLoadMight: 60,
				proficiencyTags: [],
				equipment: [intrinsicallyGated]
			})
		).toMatchObject({
			eligible: false,
			reasons: ['equipment-iron-heavy-armour-torso:minimum-might']
		});
	});
});
