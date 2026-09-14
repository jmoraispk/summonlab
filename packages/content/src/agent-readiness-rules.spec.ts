import { describe, expect, it } from 'vitest';

import { AGENT_READINESS_RULES_V1, AGENT_READINESS_RULES_V2 } from './agent-readiness-rules.js';
import {
	MONSTER_READINESS_DUTY_ACTIONS_V1,
	MONSTER_READINESS_DUTY_ACTIONS_V2
} from './monster-policies.js';

describe('agent-readiness-rules-v1', () => {
	it('owns the calibrated regeneration cadence outside combat-rules-v1', () => {
		expect(AGENT_READINESS_RULES_V1).toStrictEqual({
			rulesVersion: 'agent-readiness-rules-v1',
			combatRulesVersion: 'combat-rules-v1',
			regenerationPulseTicks: 100
		});
		expect(Object.isFrozen(AGENT_READINESS_RULES_V1)).toBe(true);
		expect(MONSTER_READINESS_DUTY_ACTIONS_V1['guard-chain-court-v1']).toStrictEqual({
			actionId: 'monster-hold-guard-chain-court-v1',
			publicLabel: 'Guard the duty floor',
			fallbackId: 'hold-duty',
			fallbackLabel: 'Hold duty',
			recoveryTicks: 8
		});
	});

	it('versions damaging enemy actions under readiness rules v2', () => {
		expect(AGENT_READINESS_RULES_V2).toMatchObject({
			rulesVersion: 'agent-readiness-rules-v2',
			combatRulesVersion: 'combat-rules-v1',
			regenerationPulseTicks: 100,
			monsterActions: MONSTER_READINESS_DUTY_ACTIONS_V2
		});
		expect(Object.isFrozen(AGENT_READINESS_RULES_V2.monsterActions)).toBe(true);
	});
});
