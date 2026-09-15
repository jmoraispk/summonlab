import { describe, expect, it } from 'vitest';

import { combatValueHash } from './components/tower/combat/automated/combat-hash';
import {
	TOWER_COMBAT_CLAIM_POLICY,
	TOWER_COMBAT_CLAIM_POLICY_BINDING
} from './tower-combat-policy';

describe('canonical Tower combat policy', () => {
	it('binds one canonical claim policy independently of rat fixtures', () => {
		const { contentId, version, contentHash, ...values } = TOWER_COMBAT_CLAIM_POLICY;
		expect(contentId).toBe('tower-combat-claims');
		expect(version).toBe('tower-combat-claims-v1');
		expect(contentHash).toBe(combatValueHash(values));
		expect(TOWER_COMBAT_CLAIM_POLICY_BINDING).toEqual({ contentId, version, contentHash });
	});
});
