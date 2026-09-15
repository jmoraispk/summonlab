import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	TOWER_FLOOR_01_EXPLORATION,
	reachableExplorationTileIds,
	validateExplorationFloor
} from './tower-floor-01-exploration.js';

describe('Floor One exploration content', () => {
	it('authors a scale-safe 11 by 17 proof map', () => {
		const floor = TOWER_FLOOR_01_EXPLORATION;
		expect({ columns: floor.columns, rows: floor.rows, chunkSize: floor.chunkSize }).toEqual({
			columns: 11,
			rows: 17,
			chunkSize: 16
		});
		expect(floor.tiles).toHaveLength(187);
		expect(new Set(floor.tiles.map((tile) => tile.tileId)).size).toBe(187);
	});

	it('contains the accepted proof interactions and encounter weights', () => {
		const interactions = TOWER_FLOOR_01_EXPLORATION.tiles.flatMap((tile) =>
			tile.interaction ? [tile.interaction] : []
		);
		const count = (kind: (typeof interactions)[number]['kind']) =>
			interactions.filter((interaction) => interaction.kind === kind).length;

		expect({
			boundary: count('entry-extraction'),
			objective: count('objective'),
			encounter: count('encounter'),
			resource: count('resource'),
			experience: count('experience'),
			equipment: count('equipment'),
			consumable: count('consumable'),
			discovery: count('discovery')
		}).toEqual({
			boundary: 1,
			objective: 1,
			encounter: 2,
			resource: 2,
			experience: 1,
			equipment: 1,
			consumable: 1,
			discovery: 3
		});
		expect(TOWER_FLOOR_01_EXPLORATION.encounterWeights).toEqual([
			{ dutySlotId: 'goblin-chain-watch', weight: 70 },
			{ dutySlotId: 'goblin-ember-hauler', weight: 30 }
		]);
	});

	it('pins the content hash to the authored payload', () => {
		const { contentHash, ...payload } = TOWER_FLOOR_01_EXPLORATION;
		expect(createHash('sha256').update(JSON.stringify(payload)).digest('hex')).toBe(contentHash);
	});

	it('keeps every interaction reachable and off blocked tiles', () => {
		const floor = TOWER_FLOOR_01_EXPLORATION;
		const reachable = reachableExplorationTileIds(floor, floor.entryTileId);
		const interactive = floor.tiles.filter((tile) => tile.interaction !== null);

		expect(validateExplorationFloor(floor)).toEqual([]);
		expect(interactive.every((tile) => tile.walkable && reachable.has(tile.tileId))).toBe(true);
		expect(reachable.has(floor.objectiveTileId)).toBe(true);
	});
});
