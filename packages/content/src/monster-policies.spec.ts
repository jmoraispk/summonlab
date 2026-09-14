import { describe, expect, it } from 'vitest';

import {
	MONSTER_POLICY_CATALOG,
	MONSTER_READINESS_DUTY_ACTIONS_V1,
	MONSTER_READINESS_DUTY_ACTIONS_V2,
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

	it('authors one deterministic damaging readiness preference and hold fallback per policy', () => {
		expect(Object.keys(MONSTER_READINESS_DUTY_ACTIONS_V1).sort()).toStrictEqual(
			MONSTER_POLICY_CATALOG.policies.map((policy) => policy.policyId).sort()
		);
		for (const actions of Object.values(MONSTER_READINESS_DUTY_ACTIONS_V2)) {
			expect(actions.preferredActionId).toBe(actions.attack.actionId);
			expect(actions.attack.actionId).toMatch(/^monster-attack-/u);
			expect(actions.attack.conflictPolicy.invalidTarget).toBe('selected-fallback');
			expect(actions.attack.resolutionProfile.damage.baseMagnitude).toBeGreaterThan(0);
			expect(actions.hold.actionId).toMatch(/^monster-hold-/u);
			expect(actions.hold.fallbackId).toBe('hold-duty');
			expect(Object.isFrozen(actions.attack.resolutionProfile.damage)).toBe(true);
		}
	});
});
