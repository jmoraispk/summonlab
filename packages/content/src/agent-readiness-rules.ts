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
