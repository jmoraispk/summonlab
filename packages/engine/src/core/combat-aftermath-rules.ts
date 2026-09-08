import type { CombatModeId, CombatResult } from '@summonlab/contracts';
import { AGENT_READINESS_RULES_V2_VERSION, COMBAT_RULES_V1 } from '@summonlab/content';

export interface CombatAftermathRules {
	readonly policyVersion: 'combat-aftermath-rules-v1';
	readonly modeId: CombatModeId;
	readonly rulesVersion:
		'legacy-auto-rules-v1' | 'agent-readiness-rules-v1' | 'agent-readiness-rules-v2';
	readonly minimumSafeHealth: number;
	readonly recoverableOutcomes: readonly CombatResult['outcome'][];
	readonly permanentLossOutcomes: readonly CombatResult['outcome'][];
	readonly safetyStopMayCausePermanentLoss: false;
}

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

const RULES_BY_PAIR = deepFreeze({
	'legacy-auto-v1:legacy-auto-rules-v1': {
		policyVersion: 'combat-aftermath-rules-v1',
		modeId: 'legacy-auto-v1',
		rulesVersion: 'legacy-auto-rules-v1',
		minimumSafeHealth: 1,
		recoverableOutcomes: ['victory', 'extraction'],
		permanentLossOutcomes: ['retreat', 'party-downed', 'death', 'deadline'],
		safetyStopMayCausePermanentLoss: false
	},
	'agent-readiness-v1:agent-readiness-rules-v1': {
		policyVersion: 'combat-aftermath-rules-v1',
		modeId: 'agent-readiness-v1',
		rulesVersion: 'agent-readiness-rules-v1',
		minimumSafeHealth: COMBAT_RULES_V1.health.minimumSafeHealth,
		recoverableOutcomes: ['victory', 'extraction'],
		permanentLossOutcomes: ['retreat', 'party-downed', 'death', 'deadline'],
		safetyStopMayCausePermanentLoss: false
	},
	'agent-readiness-v1:agent-readiness-rules-v2': {
		policyVersion: 'combat-aftermath-rules-v1',
		modeId: 'agent-readiness-v1',
		rulesVersion: AGENT_READINESS_RULES_V2_VERSION,
		minimumSafeHealth: COMBAT_RULES_V1.health.minimumSafeHealth,
		recoverableOutcomes: ['victory', 'extraction'],
		permanentLossOutcomes: ['retreat', 'party-downed', 'death', 'deadline'],
		safetyStopMayCausePermanentLoss: false
	}
} as const satisfies Readonly<Record<string, CombatAftermathRules>>);

/** Resolves aftermath solely from the immutable mode/rules pair; there is no caller rules input. */
export function combatAftermathRulesForBinding(
	modeId: CombatResult['modeId'],
	rulesVersion: string
): CombatAftermathRules {
	const rules = RULES_BY_PAIR[`${modeId}:${rulesVersion}` as keyof typeof RULES_BY_PAIR];
	if (!rules)
		throw new Error(`Unsupported combat aftermath rules binding: ${modeId}/${rulesVersion}`);
	return rules;
}
