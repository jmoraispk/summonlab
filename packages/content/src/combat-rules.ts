import { CombatRulesV1Schema, type CombatRulesV1 } from '@summonlab/contracts';

export const COMBAT_RULES_V1: CombatRulesV1 = CombatRulesV1Schema.parse({
	rulesVersion: 'combat-rules-v1',
	attributes: {
		intrinsicMinimum: 1,
		intrinsicMaximum: 100,
		effectiveMinimum: 1,
		effectiveMaximum: 200,
		modifierStackingOrder: ['additive-flat', 'additive-basis-points']
	},
	damage: {
		physicalBasisPointsPerMight: 100,
		magicalBasisPointsPerSpirit: 100
	},
	health: {
		baseMaximum: 100,
		perVitality: 4,
		safeRestRegenerationBase: 2,
		safeRestRegenerationVitalityDivisor: 10,
		combatRegenerationDelayTicks: 50,
		combatRecoveryBasisPoints: 2_000
	},
	mana: {
		baseMaximum: 40,
		perSpirit: 2,
		regenerationBase: 2,
		regenerationSpiritBonus: 8,
		regenerationSaturationConstant: 50,
		combatRecoveryBasisPoints: 5_000
	},
	armour: { curveConstant: 100 },
	resistance: { capBasisPoints: 7_500 },
	learning: {
		cognitiveMinimumBasisPoints: 9_000,
		cognitiveMaximumBasisPoints: 11_000,
		domainMinimumBasisPoints: 8_000,
		domainMaximumBasisPoints: 12_000
	},
	affinity: { contributionNudgeCapBasisPoints: 1_000 }
});
