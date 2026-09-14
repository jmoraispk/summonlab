import { MONSTER_READINESS_DUTY_ACTIONS_V2 } from './monster-policies.js';

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const AGENT_READINESS_RULES_VERSION = 'agent-readiness-rules-v1' as const;

/** Readiness-only mechanics layered over immutable combat-rules-v1. V1-V25 do not consume it. */
export const AGENT_READINESS_RULES_V1 = deepFreeze({
	rulesVersion: AGENT_READINESS_RULES_VERSION,
	combatRulesVersion: 'combat-rules-v1' as const,
	regenerationPulseTicks: 100
});

export const AGENT_READINESS_RULES_V2_VERSION = 'agent-readiness-rules-v2' as const;

/** V2 adds content-bound hostile attack choices without mutating the qualified V1 bytes. */
export const AGENT_READINESS_RULES_V2 = deepFreeze({
	rulesVersion: AGENT_READINESS_RULES_V2_VERSION,
	combatRulesVersion: 'combat-rules-v1' as const,
	regenerationPulseTicks: 100,
	monsterActions: MONSTER_READINESS_DUTY_ACTIONS_V2
});
