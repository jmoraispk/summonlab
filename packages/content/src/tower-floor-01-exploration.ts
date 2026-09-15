import {
	ExplorationFloorDefinitionSchema,
	type ExplorationFloorDefinition,
	type ExplorationInteraction,
	type ExplorationTileDefinition
} from '@summonlab/contracts/exploration';

export const TOWER_FLOOR_01_EXPLORATION_CONTENT_VERSION = 'tower-floor-01-exploration-v1';

const MAP_ROWS = Object.freeze([
	'####...####',
	'###.....###',
	'####...####',
	'####...####',
	'###.....###',
	'##.......##',
	'####...####',
	'####...####',
	'##.......##',
	'###.....###',
	'####...####',
	'##.......##',
	'###.....###',
	'####...####',
	'####...####',
	'###.....###',
	'#####.#####'
]);

function padded(value: number): string {
	return value.toString().padStart(3, '0');
}

export function floorOneExplorationTileId(row: number, column: number): string {
	return `f001-r${padded(row)}-c${padded(column)}`;
}

export function floorOneExplorationChunkId(row: number, column: number): string {
	return `f001-k-r${padded(Math.floor(row / 16))}-c${padded(Math.floor(column / 16))}`;
}

function zoneForRow(row: number): {
	zoneId: string;
	zoneLabel: string;
	terrain: ExplorationTileDefinition['terrain'];
} {
	if (row <= 2) return { zoneId: 'ember-vault', zoneLabel: 'Ember Vault', terrain: 'vault' };
	if (row <= 6) return { zoneId: 'chain-court', zoneLabel: 'Chain Court', terrain: 'court' };
	if (row <= 9)
		return { zoneId: 'shattered-gallery', zoneLabel: 'Shattered Gallery', terrain: 'gallery' };
	if (row <= 13) return { zoneId: 'oath-hall', zoneLabel: 'Oath Hall', terrain: 'hall' };
	return { zoneId: 'tower-threshold', zoneLabel: 'Tower Threshold', terrain: 'threshold' };
}

const interactions = new Map<string, ExplorationInteraction>([
	[floorOneExplorationTileId(16, 5), { kind: 'entry-extraction' }],
	[floorOneExplorationTileId(0, 5), { kind: 'objective', objectiveId: 'recover-first-ember' }],
	[floorOneExplorationTileId(5, 5), { kind: 'encounter', dutySlotId: 'goblin-chain-watch' }],
	[floorOneExplorationTileId(1, 5), { kind: 'encounter', dutySlotId: 'goblin-ember-hauler' }],
	[floorOneExplorationTileId(8, 2), { kind: 'resource', resourceId: 'ember-cinder', amount: 2 }],
	[floorOneExplorationTileId(11, 8), { kind: 'resource', resourceId: 'mineral-core', amount: 1 }],
	[floorOneExplorationTileId(13, 5), { kind: 'experience', amount: 25 }],
	[floorOneExplorationTileId(9, 7), { kind: 'equipment', definitionId: 'equipment-bronze-shield' }],
	[floorOneExplorationTileId(15, 7), { kind: 'consumable', itemId: 'healing-potion', amount: 1 }],
	[floorOneExplorationTileId(11, 2), { kind: 'discovery', discoveryId: 'soot-seam-route' }],
	[floorOneExplorationTileId(12, 7), { kind: 'discovery', discoveryId: 'muster-tablet-record' }],
	[floorOneExplorationTileId(8, 8), { kind: 'discovery', discoveryId: 'fractured-bell-stair' }]
]);

const tiles = MAP_ROWS.flatMap((rowDefinition, row) =>
	[...rowDefinition].map((symbol, column) => {
		const tileId = floorOneExplorationTileId(row, column);
		const zone = zoneForRow(row);
		const walkable = symbol === '.';
		return {
			tileId,
			chunkId: floorOneExplorationChunkId(row, column),
			row,
			column,
			zoneId: zone.zoneId,
			zoneLabel: zone.zoneLabel,
			terrain: walkable ? zone.terrain : ('wall' as const),
			walkable,
			interaction: interactions.get(tileId) ?? null
		};
	})
);

export const TOWER_FLOOR_01_EXPLORATION = ExplorationFloorDefinitionSchema.parse({
	schemaVersion: 'exploration-floor-v1',
	floorId: 'tower-floor-01',
	floorNumber: 1,
	displayName: 'Floor 01 · The Unlit Muster',
	contentVersion: TOWER_FLOOR_01_EXPLORATION_CONTENT_VERSION,
	contentHash: '0066c883bd19efcbafcc6688322114f25d8735d89d9e58fd6c1830e638fd520a',
	columns: 11,
	rows: 17,
	chunkSize: 16,
	entryTileId: floorOneExplorationTileId(16, 5),
	objectiveTileId: floorOneExplorationTileId(0, 5),
	tiles,
	encounterWeights: [
		{ dutySlotId: 'goblin-chain-watch', weight: 70 },
		{ dutySlotId: 'goblin-ember-hauler', weight: 30 }
	]
});

function tileKey(row: number, column: number): string {
	return `${row}:${column}`;
}

export function reachableExplorationTileIds(
	floor: ExplorationFloorDefinition,
	startTileId: string
): Set<string> {
	const byId = new Map(floor.tiles.map((tile) => [tile.tileId, tile]));
	const byCoordinate = new Map(floor.tiles.map((tile) => [tileKey(tile.row, tile.column), tile]));
	const start = byId.get(startTileId);
	if (!start?.walkable) return new Set();

	const visited = new Set<string>([start.tileId]);
	const queue = [start];
	for (let index = 0; index < queue.length; index += 1) {
		const tile = queue[index]!;
		for (const [row, column] of [
			[tile.row - 1, tile.column],
			[tile.row, tile.column + 1],
			[tile.row + 1, tile.column],
			[tile.row, tile.column - 1]
		] as const) {
			const neighbor = byCoordinate.get(tileKey(row, column));
			if (neighbor?.walkable && !visited.has(neighbor.tileId)) {
				visited.add(neighbor.tileId);
				queue.push(neighbor);
			}
		}
	}
	return visited;
}

export function validateExplorationFloor(floor: ExplorationFloorDefinition): string[] {
	const errors: string[] = [];
	if (floor.tiles.length !== floor.columns * floor.rows)
		errors.push('Tile count does not match bounds');
	if (new Set(floor.tiles.map((tile) => tile.tileId)).size !== floor.tiles.length)
		errors.push('Tile IDs must be unique');

	const reachable = reachableExplorationTileIds(floor, floor.entryTileId);
	for (const tile of floor.tiles) {
		if (tile.interaction && !tile.walkable)
			errors.push(`${tile.tileId} has content on blocked terrain`);
		if (tile.interaction && !reachable.has(tile.tileId))
			errors.push(`${tile.tileId} interaction is unreachable`);
	}
	if (!reachable.has(floor.objectiveTileId)) errors.push('Objective is unreachable from entry');
	return errors;
}
