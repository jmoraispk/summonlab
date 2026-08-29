import { describe, expect, it } from 'vitest';

import { drawApprovedIdentity, eligibleSummonEntries } from './approved-summon-pool';

const approved = {
	id: 'approved',
	manifest: { name: 'Approved' },
	manifestHash: 'a'.repeat(64),
	sourceApproval: 'approved' as const,
	summonEligibility: 'eligible' as const,
	portrait: { publicPath: '/approved.webp', width: 768, height: 1152 }
};

describe('approval-gated summon pool', () => {
	it('draws deterministically only from identities with approved cached portraits', () => {
		const pool = [
			approved,
			{ ...approved, id: 'candidate', sourceApproval: 'candidate' as const },
			{ ...approved, id: 'blocked', summonEligibility: 'blocked' as const },
			{ ...approved, id: 'missing', portrait: null }
		];

		expect(eligibleSummonEntries(pool)).toEqual([approved]);
		expect(drawApprovedIdentity(pool, 'same-seed')).toEqual(approved);
		expect(drawApprovedIdentity(pool, 'same-seed')).toEqual(approved);
	});

	it('refuses a player-facing draw when every portrait is still a candidate', () => {
		expect(
			drawApprovedIdentity([{ ...approved, sourceApproval: 'candidate' }], 'blocked-seed')
		).toBeNull();
	});
});
