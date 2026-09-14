import { describe, expect, it } from 'vitest';

import {
	ExplorationChunkIdSchema,
	ExplorationAttemptStateSchema,
	ExplorationFloorDefinitionSchema,
	ExplorationPowerEstimateSchema,
	ExplorationTileIdSchema,
	HiddenExplorationTileProjectionSchema
} from './exploration.js';

describe('exploration contracts', () => {
	it('binds a persistent attempt to one run, floor, party, and version', () => {
		const state = {
			attemptId: '44444444-4444-4444-8444-444444444444',
			runId: '22222222-2222-4222-8222-222222222222',
			floorId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-exploration-v1',
			contentHash: 'a'.repeat(64),
			status: 'exploring',
			partyHeroIds: ['hero-dara-zev'],
			leaderHeroId: 'hero-dara-zev',
			positionTileId: 'f001-r016-c005',
			revealedTileIds: ['f001-r016-c005'],
			version: 0
		};

		expect(ExplorationAttemptStateSchema.parse(state)).toEqual({
			...state,
			resolvedInteractionTileIds: [],
			objectiveComplete: false,
			pendingLoot: []
		});
		expect(ExplorationAttemptStateSchema.safeParse({ ...state, runId: 'not-a-uuid' }).success).toBe(
			false
		);
		expect(
			ExplorationAttemptStateSchema.safeParse({
				...state,
				partyHeroIds: ['hero-a'],
				leaderHeroId: 'hero-b'
			}).success
		).toBe(false);
	});

	it('requires scale-safe three-digit tile and chunk coordinates', () => {
		expect(ExplorationTileIdSchema.parse('f001-r000-c000')).toBe('f001-r000-c000');
		expect(ExplorationTileIdSchema.safeParse('f001-r00-c00').success).toBe(false);
		expect(ExplorationChunkIdSchema.parse('f001-k-r006-c010')).toBe('f001-k-r006-c010');
		expect(ExplorationChunkIdSchema.safeParse('f001-k-r6-c10').success).toBe(false);
	});

	it('keeps hidden tiles opaque at the schema boundary', () => {
		const hidden = {
			tileId: 'f001-r006-c004',
			chunkId: 'f001-k-r000-c000',
			row: 6,
			column: 4,
			knowledge: 'hidden'
		};

		expect(HiddenExplorationTileProjectionSchema.parse(hidden)).toEqual(hidden);
		expect(
			HiddenExplorationTileProjectionSchema.safeParse({
				...hidden,
				interaction: { kind: 'encounter', dutySlotId: 'goblin-chain-watch' }
			}).success
		).toBe(false);
	});

	it('rejects unknown floor fields and inconsistent power totals', () => {
		const floor = {
			schemaVersion: 'exploration-floor-v1',
			floorId: 'tower-floor-01',
			floorNumber: 1,
			displayName: 'The Unlit Muster',
			contentVersion: 'tower-floor-01-exploration-v1',
			contentHash: 'a'.repeat(64),
			columns: 1,
			rows: 1,
			chunkSize: 16,
			entryTileId: 'f001-r000-c000',
			objectiveTileId: 'f001-r000-c000',
			tiles: [
				{
					tileId: 'f001-r000-c000',
					chunkId: 'f001-k-r000-c000',
					row: 0,
					column: 0,
					zoneId: 'tower-threshold',
					zoneLabel: 'Tower Threshold',
					terrain: 'threshold',
					walkable: true,
					interaction: { kind: 'entry-extraction' }
				}
			],
			encounterWeights: [{ dutySlotId: 'goblin-chain-watch', weight: 1 }]
		};

		expect(ExplorationFloorDefinitionSchema.parse(floor)).toEqual(floor);
		expect(
			ExplorationFloorDefinitionSchema.safeParse({ ...floor, routePath: '/lab' }).success
		).toBe(false);
		expect(
			ExplorationPowerEstimateSchema.safeParse({
				schemaVersion: 'exploration-power-v1',
				capability: 120,
				equipment: 25,
				survival: 38,
				skills: 21,
				total: 205
			}).success
		).toBe(false);
	});
});
