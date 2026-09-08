import {
	COMBAT_CONTENT_BINDING,
	calculateCombatContentAggregateHash,
	type CombatContentComponentBinding
} from './combat-content-binding.js';
import {
	MONSTER_READINESS_ACTIONS_V2_CONTENT_HASH,
	MONSTER_READINESS_ACTIONS_V2_CONTENT_VERSION,
	calculateMonsterReadinessActionsV2ContentHash
} from './monster-policies.js';

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export const AGENT_READINESS_CONTENT_BINDING_V2 = deepFreeze({
	bindingVersion: 'agent-readiness-content-binding-v2' as const,
	components: [
		...COMBAT_CONTENT_BINDING.components,
		{
			contentVersion: MONSTER_READINESS_ACTIONS_V2_CONTENT_VERSION,
			contentHash: MONSTER_READINESS_ACTIONS_V2_CONTENT_HASH
		}
	] satisfies readonly CombatContentComponentBinding[],
	contentHash: 'e78ed494f1ac78f6b0efca0574248425a1bb1148d54fd39161db600964e8919e'
});

let verifiedBinding: Promise<typeof AGENT_READINESS_CONTENT_BINDING_V2> | undefined;

export function loadAgentReadinessContentBindingV2(): Promise<
	typeof AGENT_READINESS_CONTENT_BINDING_V2
> {
	verifiedBinding ??= (async () => {
		const actionHash = await calculateMonsterReadinessActionsV2ContentHash();
		if (actionHash !== MONSTER_READINESS_ACTIONS_V2_CONTENT_HASH) {
			throw new Error(
				`Monster readiness action content hash drifted: expected ${MONSTER_READINESS_ACTIONS_V2_CONTENT_HASH}, calculated ${actionHash}`
			);
		}
		const aggregate = await calculateCombatContentAggregateHash(
			AGENT_READINESS_CONTENT_BINDING_V2.components
		);
		if (aggregate !== AGENT_READINESS_CONTENT_BINDING_V2.contentHash) {
			throw new Error(
				`Agent readiness content aggregate hash drifted: expected ${AGENT_READINESS_CONTENT_BINDING_V2.contentHash}, calculated ${aggregate}`
			);
		}
		return AGENT_READINESS_CONTENT_BINDING_V2;
	})();
	return verifiedBinding;
}
