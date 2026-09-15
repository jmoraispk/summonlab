import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import { createExplorationAttempt } from '@summonlab/engine/exploration';

const mocks = vi.hoisted(() => ({
	getAttempt: vi.fn(),
	commitMove: vi.fn(),
	commitTravel: vi.fn(),
	beginEncounter: vi.fn(),
	getCampaign: vi.fn(),
	getEngineSnapshot: vi.fn()
}));

vi.mock('@summonlab/config', () => ({
	getConfig: () => ({ databaseUrl: 'postgres://unused' })
}));

vi.mock('@summonlab/database', () => ({
	getExplorationAttempt: mocks.getAttempt,
	commitExplorationMove: mocks.commitMove,
	commitExplorationTravel: mocks.commitTravel,
	beginExplorationEncounter: mocks.beginEncounter,
	getCampaignRun: mocks.getCampaign,
	getEngineSnapshot: mocks.getEngineSnapshot
}));

import { POST } from './+server';

const runId = '22222222-2222-4222-8222-222222222222';
const attemptId = '44444444-4444-4444-8444-444444444444';

function postMove(destinationTileId: string) {
	return POST({
		params: { runId },
		request: new Request(`http://summonlab.test/api/runs/${runId}/tower/move`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ attemptId, expectedVersion: 0, destinationTileId })
		})
	} as never) as Promise<Response>;
}

describe('Tower destination travel endpoint', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		const state = createExplorationAttempt(TOWER_FLOOR_01_EXPLORATION, {
			attemptId,
			runId,
			partyHeroIds: ['hero-one'],
			leaderHeroId: 'hero-one'
		});
		mocks.getAttempt.mockResolvedValue({ state, activeEncounter: null, receipts: [] });
		mocks.commitTravel.mockImplementation((_databaseUrl: string, input: { nextState: unknown }) =>
			Promise.resolve({ state: input.nextState, activeEncounter: null, receipts: [] })
		);
	});

	it('returns the authoritative accepted path instead of trusting a client path', async () => {
		const response = await postMove('f001-r011-c005');

		expect(response.status).toBe(200);
		expect((await response.json()).travel).toEqual({
			requestedTileId: 'f001-r011-c005',
			destinationTileId: 'f001-r013-c005',
			pathTileIds: ['f001-r015-c005', 'f001-r014-c005', 'f001-r013-c005'],
			stopReason: 'interaction'
		});
		expect(mocks.commitTravel).toHaveBeenCalledWith(
			'postgres://unused',
			expect.objectContaining({
				attemptId,
				expectedVersion: 0,
				pathTileIds: ['f001-r015-c005', 'f001-r014-c005', 'f001-r013-c005']
			})
		);
		expect(mocks.commitMove).not.toHaveBeenCalled();
	});
});
