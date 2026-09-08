import { describe, expect, it } from 'vitest';

import { AGENT_READINESS_RULES_V1 } from './agent-readiness-rules.js';

describe('agent-readiness-rules-v1', () => {
	it('owns the calibrated regeneration cadence outside combat-rules-v1', () => {
		expect(AGENT_READINESS_RULES_V1).toStrictEqual({
			rulesVersion: 'agent-readiness-rules-v1',
			combatRulesVersion: 'combat-rules-v1',
			regenerationPulseTicks: 100
		});
		expect(Object.isFrozen(AGENT_READINESS_RULES_V1)).toBe(true);
	});
});
