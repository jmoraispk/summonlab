import { describe, expect, it } from 'vitest';

import { CampaignSummonRequestSchema, CampaignSummonedHeroCountSchema } from './campaign.js';

describe('campaign summon progress contract', () => {
	it.each([0, 1, 2, 3] as const)('accepts %i committed summons', (count) => {
		expect(CampaignSummonedHeroCountSchema.parse(count)).toBe(count);
	});

	it.each([-1, 4, 1.5])('rejects an invalid committed summon count: %s', (count) => {
		expect(CampaignSummonedHeroCountSchema.safeParse(count).success).toBe(false);
	});

	it('accepts only an ordinal and the expected committed count', () => {
		expect(CampaignSummonRequestSchema.parse({ ordinal: 1, expectedSummonedHeroCount: 0 })).toEqual(
			{ ordinal: 1, expectedSummonedHeroCount: 0 }
		);
		expect(
			CampaignSummonRequestSchema.safeParse({
				ordinal: 2,
				expectedSummonedHeroCount: 0,
				heroId: 'browser-selected-identity'
			}).success
		).toBe(false);
	});
});
