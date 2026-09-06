import { CombatRulesV1Schema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { COMBAT_RULES_V1 } from './combat-rules.js';

describe('combat-rules-v1 content', () => {
	it('publishes the accepted first balance-harness candidates as a valid immutable rules record', () => {
		expect(CombatRulesV1Schema.parse(COMBAT_RULES_V1)).toStrictEqual(COMBAT_RULES_V1);
		expect(COMBAT_RULES_V1).toMatchObject({
			rulesVersion: 'combat-rules-v1',
			attributes: {
				modifierStackingOrder: ['additive-flat', 'additive-basis-points']
			},
			health: {
				baseMaximum: 100,
				perVitality: 4,
				combatRegenerationDelayTicks: 50,
				combatRecoveryBasisPoints: 2_000
			},
			mana: { baseMaximum: 40, perSpirit: 2 },
			armour: { curveConstant: 100 },
			resistance: { capBasisPoints: 7_500 },
			learning: {
				cognitiveMinimumBasisPoints: 9_000,
				cognitiveMaximumBasisPoints: 11_000
			},
			affinity: { contributionNudgeCapBasisPoints: 1_000 }
		});
		expect(COMBAT_RULES_V1.health.combatRecoveryBasisPoints).toBe(10_000 / 5);
	});
});
