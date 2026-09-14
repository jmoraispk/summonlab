import { describe, expect, it } from 'vitest';

import {
	AGENT_READINESS_CONTENT_BINDING_V2,
	loadAgentReadinessContentBindingV2
} from './agent-readiness-content-binding.js';
import {
	MONSTER_READINESS_ACTIONS_V2_CONTENT_HASH,
	calculateMonsterReadinessActionsV2ContentHash
} from './monster-policies.js';

describe('agent readiness content binding v2', () => {
	it('binds the exact damaging monster action catalog with the base combat content', async () => {
		expect(await calculateMonsterReadinessActionsV2ContentHash()).toBe(
			MONSTER_READINESS_ACTIONS_V2_CONTENT_HASH
		);
		expect(await loadAgentReadinessContentBindingV2()).toBe(AGENT_READINESS_CONTENT_BINDING_V2);
		expect(AGENT_READINESS_CONTENT_BINDING_V2.components.at(-1)?.contentVersion).toBe(
			'monster-readiness-actions-v2'
		);
	});
});
