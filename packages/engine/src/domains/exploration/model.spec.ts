import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	createExplorationAttempt,
	legalExplorationSteps,
	planExplorationTravel,
	projectExplorationWindow,
	reachableExplorationDestinations,
	resumeExplorationAfterEncounter,
	stepExploration,
	suspendExplorationForEncounter
} from './model.js';

const floor = TOWER_FLOOR_01_EXPLORATION;

function attempt() {
	return createExplorationAttempt(floor, {
		attemptId: 'attempt-floor-01',
		runId: 'run-floor-01',
		partyHeroIds: ['hero-dara-zev', 'hero-mara-vey'],
		leaderHeroId: 'hero-dara-zev'
	});
}

describe('exploration movement model', () => {
	it('starts at the threshold with a five-tile sight radius', () => {
		const state = attempt();
		expect(state.positionTileId).toBe('f001-r016-c005');
		expect(state.revealedTileIds).toHaveLength(36);
		expect(legalExplorationSteps(floor, state).map((step) => step.tileId)).toEqual([
			'f001-r015-c005'
		]);
	});

	it('offers every revealed destination within five walkable steps', () => {
		const destinations = reachableExplorationDestinations(floor, attempt());
		expect(destinations).toHaveLength(15);
		expect(destinations.find((tile) => tile.tileId === 'f001-r011-c005')).toMatchObject({
			distance: 5,
			pathTileIds: [
				'f001-r015-c005',
				'f001-r014-c005',
				'f001-r013-c005',
				'f001-r012-c005',
				'f001-r011-c005'
			]
		});
	});

	it('plans travel to stop at the first interaction on the route', () => {
		expect(planExplorationTravel(floor, attempt(), 'f001-r011-c005')).toEqual({
			requestedTileId: 'f001-r011-c005',
			destinationTileId: 'f001-r013-c005',
			pathTileIds: ['f001-r015-c005', 'f001-r014-c005', 'f001-r013-c005'],
			stopReason: 'interaction'
		});
	});

	it('moves one orthogonal tile and rejects blocked, hidden, or non-adjacent destinations', () => {
		const start = attempt();
		const moved = stepExploration(floor, start, 'f001-r015-c005');
		expect(moved).toMatchObject({ positionTileId: 'f001-r015-c005', version: 1 });
		for (const tileId of ['f001-r016-c004', 'f001-r014-c005', 'f001-r010-c005']) {
			expect(() => stepExploration(floor, start, tileId)).toThrow();
		}
	});

	it('suspends and resumes the exact encounter tile without creating another attempt', () => {
		const atEncounter = { ...attempt(), positionTileId: 'f001-r005-c005', version: 4 };
		const suspended = suspendExplorationForEncounter(atEncounter);
		const resumed = resumeExplorationAfterEncounter(suspended, 'victory');

		expect(suspended).toMatchObject({ status: 'encounter', positionTileId: 'f001-r005-c005' });
		expect(resumed).toMatchObject({
			attemptId: atEncounter.attemptId,
			status: 'exploring',
			positionTileId: 'f001-r005-c005',
			version: 6
		});
		expect(resumed.resolvedInteractionTileIds).toContain('f001-r005-c005');
		expect(resumeExplorationAfterEncounter(suspended, 'defeat').status).toBe('defeated');
	});

	it('collects authored loot once while moving through the floor', () => {
		const atExperience = { ...attempt(), positionTileId: 'f001-r014-c005' };
		const collected = stepExploration(floor, atExperience, 'f001-r013-c005');
		expect(collected.pendingLoot).toContainEqual({
			kind: 'experience',
			key: 'company-experience',
			amount: 25
		});
		expect(collected.resolvedInteractionTileIds).toContain('f001-r013-c005');
	});

	it('projects hidden cells without terrain, zone, or interaction secrets', () => {
		const projection = projectExplorationWindow(floor, attempt());
		const hidden = projection.tiles.find((tile) => tile.knowledge === 'hidden');
		expect(Object.keys(hidden!).sort()).toEqual([
			'chunkId',
			'column',
			'knowledge',
			'row',
			'tileId'
		]);
	});
});
