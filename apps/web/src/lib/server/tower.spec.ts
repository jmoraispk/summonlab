import { TOWER_FLOOR_01_EXPLORATION, loadTowerBand01 } from '@summonlab/content';
import { createExplorationAttempt } from '@summonlab/engine/exploration';
import { describe, expect, it } from 'vitest';

import type { PersistedExplorationAttempt } from '@summonlab/database';

import { projectTowerViewFromState } from './tower';

describe('canonical Tower projection', () => {
	it('projects the authored first five floors without a Mission Lab copy', async () => {
		const view = projectTowerViewFromState(await loadTowerBand01(), null);
		expect(view.state).toBe('floor-list');
		expect(view.floors.map((floor) => floor.floorNumber)).toEqual([1, 2, 3, 4, 5]);
		expect(view.floors[0]).toMatchObject({ status: 'available', lockReason: null });
		expect(view.floors[1]).toMatchObject({ status: 'locked', lockReason: 'Clear Floor 01 first.' });
		expect(view.floors.every((floor) => floor.objective && floor.knownMonsters.length > 0)).toBe(
			true
		);
	});

	it('keeps exploration and encounter presentation on the exact persisted tile', async () => {
		const state = {
			...createExplorationAttempt(TOWER_FLOOR_01_EXPLORATION, {
				attemptId: '00000000-0000-4000-8000-000000000011',
				runId: '00000000-0000-4000-8000-000000000012',
				partyHeroIds: ['hero-one'],
				leaderHeroId: 'hero-one'
			}),
			positionTileId: 'f001-r015-c005'
		};
		const attempt: PersistedExplorationAttempt = { state, activeEncounter: null, receipts: [] };
		const exploring = projectTowerViewFromState(await loadTowerBand01(), attempt);
		expect(exploring).toMatchObject({
			state: 'exploration',
			exploration: { positionTileId: state.positionTileId }
		});
		if (exploring.state !== 'exploration') throw new Error('Expected exploration view');
		expect(exploring.exploration.destinations).toContainEqual(
			expect.objectContaining({ tileId: 'f001-r011-c005', intent: 'travel' })
		);

		const requestId = '00000000-0000-4000-8000-000000000013';
		const encounter = projectTowerViewFromState(await loadTowerBand01(), {
			...attempt,
			state: { ...state, status: 'encounter', version: 1 },
			activeEncounter: {
				requestId,
				requestHash: 'a'.repeat(64),
				request: { requestId } as never
			}
		});
		expect(encounter).toMatchObject({
			state: 'encounter',
			encounterRequestId: requestId,
			encounterRequest: { requestId },
			exploration: { positionTileId: state.positionTileId }
		});
	});
});
