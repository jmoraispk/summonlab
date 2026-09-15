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
	contentHash: '221f8b8cbbe2e966584c60c88bb7a963ffbf9c0da4a605d198667aa7b76cd074'
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
