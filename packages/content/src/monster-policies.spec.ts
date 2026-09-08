import { describe, expect, it } from 'vitest';

import {
	MONSTER_POLICY_CATALOG,
	MONSTER_READINESS_DUTY_ACTIONS_V1,
	calculateMonsterPolicyContentHash,
	loadMonsterPolicyCatalog,
	monsterPolicy
} from './monster-policies.js';
import { TOWER_FLOOR_01_PACKAGE } from './tower-floor-01.js';

describe('monster policy catalog', () => {
	it('verifies its immutable content hash and every Floor 01 duty reference', async () => {
		const catalog = await loadMonsterPolicyCatalog();

		expect(await calculateMonsterPolicyContentHash(catalog)).toBe(catalog.contentHash);
		expect(Object.isFrozen(catalog)).toBe(true);
		expect(
			TOWER_FLOOR_01_PACKAGE.monsterDuties.map((duty) => monsterPolicy(duty.policyId))
		).toHaveLength(2);
	});

	it('defines a furnace-linked Foundry Warden without placing it on Floor 01', () => {
		const warden = monsterPolicy('foundry-warden-v1');

		expect(warden).toMatchObject({
			behavior: 'foundry-warden',
			archetype: 'construct',
			armor: { kind: 'furnace-linked', litReduction: 3, quenchedReduction: 0 }
		});
		expect(MONSTER_POLICY_CATALOG.policies).toHaveLength(3);
		expect(
			TOWER_FLOOR_01_PACKAGE.monsterDuties.some((duty) => duty.policyId === warden.policyId)
		).toBe(false);
	});

	it('authors one zero-Mana readiness duty fallback for every monster policy', () => {
		expect(Object.keys(MONSTER_READINESS_DUTY_ACTIONS_V1).sort()).toStrictEqual(
			MONSTER_POLICY_CATALOG.policies.map((policy) => policy.policyId).sort()
		);
		for (const action of Object.values(MONSTER_READINESS_DUTY_ACTIONS_V1)) {
			expect(action.actionId).toMatch(/^monster-hold-/u);
			expect(action.fallbackId).toBe('hold-duty');
		}
	});
});
