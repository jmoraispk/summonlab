import { describe, expect, it } from 'vitest';

import { CityActionRequestSchema } from './city-actions';

const heroId = '00000000-0000-4000-8000-000000000001';

describe('City action request', () => {
	it.each(['court-training', 'rest'] as const)('accepts the narrow %s intent', (action) => {
		expect(CityActionRequestSchema.parse({ action, heroId, expectedVersion: 4 })).toEqual({
			action,
			heroId,
			expectedVersion: 4
		});
	});

	it.each([
		{},
		{ action: 'hunt', heroId, expectedVersion: 4 },
		{ action: 'rest', heroId: 'not-a-uuid', expectedVersion: 4 },
		{ action: 'rest', heroId, expectedVersion: -1 },
		{ action: 'rest', heroId, expectedVersion: 1.5 },
		{ action: 'rest', heroId, expectedVersion: 4, buildingId: 'workshop' },
		{ commandType: 'settlement.assign.hero', heroId, expectedVersion: 4 }
	])('rejects data outside the player-facing City boundary: %j', (request) => {
		expect(CityActionRequestSchema.safeParse(request).success).toBe(false);
	});
});
