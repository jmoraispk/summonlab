import { CombatRulesV1Schema, type CombatRulesV1 } from '@summonlab/contracts';

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const COMBAT_RULES_V1: CombatRulesV1 = deepFreeze(
	CombatRulesV1Schema.parse({
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
		armour: { curveConstant: 100, maximumGeneralReductionBasisPoints: 7_499 },
		resistance: { capBasisPoints: 7_500 },
		learning: {
			cognitiveMinimumBasisPoints: 9_000,
			cognitiveMaximumBasisPoints: 11_000,
			domainMinimumBasisPoints: 8_000,
			domainMaximumBasisPoints: 12_000
		},
		affinity: { contributionNudgeCapBasisPoints: 1_000 },
		hit: {
			minimumChanceBasisPoints: 500,
			maximumChanceBasisPoints: 9_950,
			defenderAgilityEvasionBasisPointsPerPoint: 1,
			relativeAgilityBasisPointsPerPoint: 10,
			relativeAgilityCapBasisPoints: 900,
			flankBasisPoints: 600,
			surroundBasisPoints: 700,
			unawareBasisPoints: 1_200
		},
		readiness: {
			tickDurationMilliseconds: 100,
			threshold: 10_000,
			baseGainPerTick: 100,
			agilityGainPerTick: 1,
			actionRecoverySource: 'authored-action-recovery-ticks',
			safety: {
				maximumTicksAdvanced: 1_000_000,
				maximumEventsEmitted: 100_000,
				maximumNoProgressCycles: 1_000
			}
		}
	})
);
