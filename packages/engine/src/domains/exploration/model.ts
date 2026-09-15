import type {
	ExplorationAttemptState,
	ExplorationFloorDefinition,
	ExplorationTravelResult,
	ExplorationTileDefinition,
	ExplorationTileProjection
} from '@summonlab/contracts/exploration';

export type { ExplorationAttemptState } from '@summonlab/contracts/exploration';

export type ExplorationLegalStep = Readonly<{
	tileId: string;
	row: number;
	column: number;
	direction: 'north' | 'east' | 'south' | 'west';
	label: string;
}>;

export type ExplorationReachableDestination = Readonly<{
	tileId: string;
	row: number;
	column: number;
	zoneLabel: string;
	distance: number;
	pathTileIds: readonly string[];
}>;

export type ExplorationTravelPlan = ExplorationTravelResult;

export type SafeExplorationDestination = ExplorationReachableDestination &
	Readonly<{ intent: 'travel' | 'encounter' }>;

export type ExplorationWindowProjection = Readonly<{
	floorId: string;
	displayName: string;
	columns: number;
	rows: number;
	chunkSize: number;
	positionTileId: string;
	revealedCount: number;
	chunkIds: readonly string[];
	tiles: readonly ExplorationTileProjection[];
}>;

type CreateAttemptInput = Readonly<{
	attemptId: string;
	runId: string;
	partyHeroIds: readonly string[];
	leaderHeroId: string;
}>;

function coordinateKey(row: number, column: number): string {
	return `${row}:${column}`;
}

function tileIndexes(floor: ExplorationFloorDefinition) {
	return {
		byId: new Map(floor.tiles.map((tile) => [tile.tileId, tile])),
		byCoordinate: new Map(floor.tiles.map((tile) => [coordinateKey(tile.row, tile.column), tile]))
	};
}

function neighboringTiles(
	floor: ExplorationFloorDefinition,
	tile: ExplorationTileDefinition
): readonly ExplorationTileDefinition[] {
	const { byCoordinate } = tileIndexes(floor);
	return [
		byCoordinate.get(coordinateKey(tile.row - 1, tile.column)),
		byCoordinate.get(coordinateKey(tile.row, tile.column + 1)),
		byCoordinate.get(coordinateKey(tile.row + 1, tile.column)),
		byCoordinate.get(coordinateKey(tile.row, tile.column - 1))
	].filter((candidate): candidate is ExplorationTileDefinition => candidate !== undefined);
}

function touchingTileIds(
	floor: ExplorationFloorDefinition,
	tile: ExplorationTileDefinition
): ReadonlySet<string> {
	const { byCoordinate } = tileIndexes(floor);
	const touching = new Set<string>();
	for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
		for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
			const candidate = byCoordinate.get(
				coordinateKey(tile.row + rowOffset, tile.column + columnOffset)
			);
			if (candidate) touching.add(candidate.tileId);
		}
	}
	return touching;
}

function revealRadius(
	floor: ExplorationFloorDefinition,
	tile: ExplorationTileDefinition,
	previous: readonly string[] = [],
	radius = 5
): string[] {
	const revealed = new Set(previous);
	for (const candidate of floor.tiles) {
		const distance = Math.abs(candidate.row - tile.row) + Math.abs(candidate.column - tile.column);
		if (distance <= radius) revealed.add(candidate.tileId);
	}
	const order = new Map(floor.tiles.map((candidate, index) => [candidate.tileId, index]));
	return [...revealed].sort((left, right) => order.get(left)! - order.get(right)!);
}

export function createExplorationAttempt(
	floor: ExplorationFloorDefinition,
	input: CreateAttemptInput
): ExplorationAttemptState {
	if (input.partyHeroIds.length === 0) throw new Error('Exploration requires at least one hero');
	if (!input.partyHeroIds.includes(input.leaderHeroId))
		throw new Error('Exploration leader must belong to the party');
	const entry = floor.tiles.find((tile) => tile.tileId === floor.entryTileId);
	if (!entry?.walkable) throw new Error('Exploration entry tile must be walkable');
	return {
		attemptId: input.attemptId,
		runId: input.runId,
		floorId: floor.floorId,
		contentVersion: floor.contentVersion,
		contentHash: floor.contentHash,
		status: 'exploring',
		partyHeroIds: [...input.partyHeroIds],
		leaderHeroId: input.leaderHeroId,
		positionTileId: entry.tileId,
		revealedTileIds: revealRadius(floor, entry),
		resolvedInteractionTileIds: [],
		objectiveComplete: false,
		pendingLoot: [],
		version: 0
	};
}

function directionBetween(
	from: ExplorationTileDefinition,
	to: ExplorationTileDefinition
): ExplorationLegalStep['direction'] {
	if (to.row < from.row) return 'north';
	if (to.column > from.column) return 'east';
	if (to.row > from.row) return 'south';
	return 'west';
}

export function legalExplorationSteps(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState
): readonly ExplorationLegalStep[] {
	if (state.status !== 'exploring' && state.status !== 'returning') return [];
	const { byId } = tileIndexes(floor);
	const current = byId.get(state.positionTileId);
	if (!current) return [];
	const revealed = new Set(state.revealedTileIds);
	return neighboringTiles(floor, current)
		.filter((tile) => tile.walkable && revealed.has(tile.tileId))
		.map((tile) => ({
			tileId: tile.tileId,
			row: tile.row,
			column: tile.column,
			direction: directionBetween(current, tile),
			label: `${directionBetween(current, tile)} to ${tile.zoneLabel}`
		}));
}

export function reachableExplorationDestinations(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState,
	maxSteps = 5
): readonly ExplorationReachableDestination[] {
	if (maxSteps < 1 || (state.status !== 'exploring' && state.status !== 'returning')) return [];
	const { byId } = tileIndexes(floor);
	const start = byId.get(state.positionTileId);
	if (!start) return [];
	const revealed = new Set(state.revealedTileIds);
	const paths = new Map<string, readonly string[]>([[start.tileId, []]]);
	const queue = [start];
	const destinations: ExplorationReachableDestination[] = [];

	for (let index = 0; index < queue.length; index += 1) {
		const current = queue[index]!;
		const currentPath = paths.get(current.tileId)!;
		if (currentPath.length >= maxSteps) continue;

		for (const neighbor of neighboringTiles(floor, current)) {
			if (!neighbor.walkable || !revealed.has(neighbor.tileId) || paths.has(neighbor.tileId))
				continue;
			const pathTileIds = [...currentPath, neighbor.tileId];
			paths.set(neighbor.tileId, pathTileIds);
			queue.push(neighbor);
			destinations.push({
				tileId: neighbor.tileId,
				row: neighbor.row,
				column: neighbor.column,
				zoneLabel: neighbor.zoneLabel,
				distance: pathTileIds.length,
				pathTileIds
			});
		}
	}

	return destinations;
}

export function planExplorationTravel(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState,
	requestedTileId: string,
	maxSteps = 5
): ExplorationTravelPlan {
	if (maxSteps < 1 || (state.status !== 'exploring' && state.status !== 'returning')) {
		throw new Error(`No safe route to this tile: ${requestedTileId}`);
	}
	const { byId } = tileIndexes(floor);
	const start = byId.get(state.positionTileId);
	const requested = byId.get(requestedTileId);
	const revealed = new Set(state.revealedTileIds);
	if (!start || !requested?.walkable || !revealed.has(requestedTileId) || start === requested) {
		throw new Error(`No safe route to this tile: ${requestedTileId}`);
	}

	const resolved = new Set(state.resolvedInteractionTileIds);
	const unresolvedEncounters = floor.tiles.filter(
		(tile) => tile.interaction?.kind === 'encounter' && !resolved.has(tile.tileId)
	);
	const requestedEncounter =
		requested.interaction?.kind === 'encounter' && !resolved.has(requested.tileId)
			? requested
			: null;
	const targetDanger = requestedEncounter ? touchingTileIds(floor, requestedEncounter) : new Set();
	const blockedDanger = new Set<string>();
	for (const encounter of unresolvedEncounters) {
		if (encounter.tileId === requestedEncounter?.tileId) continue;
		for (const tileId of touchingTileIds(floor, encounter)) blockedDanger.add(tileId);
	}
	if (!requestedEncounter) {
		for (const encounter of unresolvedEncounters) {
			for (const tileId of touchingTileIds(floor, encounter)) blockedDanger.add(tileId);
		}
	}

	type SearchNode = {
		tile: ExplorationTileDefinition;
		pathTileIds: string[];
		lastDirection: ExplorationLegalStep['direction'] | null;
		turns: number;
		dangerSteps: number;
		directionTrace: string;
	};
	const directionRank: Record<ExplorationLegalStep['direction'], string> = {
		north: '0',
		east: '1',
		south: '2',
		west: '3'
	};
	const compare = (left: SearchNode, right: SearchNode) =>
		left.pathTileIds.length - right.pathTileIds.length ||
		left.dangerSteps - right.dangerSteps ||
		left.turns - right.turns ||
		left.directionTrace.localeCompare(right.directionTrace);
	const frontier: SearchNode[] = [
		{
			tile: start,
			pathTileIds: [],
			lastDirection: null,
			turns: 0,
			dangerSteps: 0,
			directionTrace: ''
		}
	];
	const best = new Map<string, SearchNode>();
	let destination: SearchNode | undefined;

	while (frontier.length > 0) {
		frontier.sort(compare);
		const current = frontier.shift()!;
		if (current.tile.tileId === requestedTileId) {
			destination = current;
			break;
		}
		if (current.pathTileIds.length >= maxSteps) continue;

		for (const neighbor of neighboringTiles(floor, current.tile)) {
			if (
				!neighbor.walkable ||
				!revealed.has(neighbor.tileId) ||
				blockedDanger.has(neighbor.tileId)
			) {
				continue;
			}
			const direction = directionBetween(current.tile, neighbor);
			const candidate: SearchNode = {
				tile: neighbor,
				pathTileIds: [...current.pathTileIds, neighbor.tileId],
				lastDirection: direction,
				turns:
					current.turns +
					(current.lastDirection !== null && current.lastDirection !== direction ? 1 : 0),
				dangerSteps: current.dangerSteps + (targetDanger.has(neighbor.tileId) ? 1 : 0),
				directionTrace: `${current.directionTrace}${directionRank[direction]}`
			};
			const key = `${neighbor.tileId}:${direction}`;
			const previous = best.get(key);
			if (!previous || compare(candidate, previous) < 0) {
				best.set(key, candidate);
				frontier.push(candidate);
			}
		}
	}

	if (!destination) throw new Error(`No safe route to this tile: ${requestedTileId}`);

	const firstInteractionIndex = destination.pathTileIds.findIndex((tileId) => {
		const tile = byId.get(tileId);
		return tile?.interaction !== null && tile?.interaction !== undefined && !resolved.has(tileId);
	});
	const pathTileIds =
		firstInteractionIndex === -1
			? destination.pathTileIds
			: destination.pathTileIds.slice(0, firstInteractionIndex + 1);

	return {
		requestedTileId,
		destinationTileId: pathTileIds.at(-1)!,
		pathTileIds,
		stopReason: firstInteractionIndex === -1 ? 'destination' : 'interaction'
	};
}

export function safeExplorationDestinations(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState
): readonly SafeExplorationDestination[] {
	if (state.status !== 'exploring' && state.status !== 'returning') return [];
	const revealed = new Set(state.revealedTileIds);
	return floor.tiles.flatMap((tile) => {
		if (!tile.walkable || !revealed.has(tile.tileId) || tile.tileId === state.positionTileId)
			return [];
		try {
			const plan = planExplorationTravel(floor, state, tile.tileId, floor.tiles.length);
			return [
				{
					tileId: tile.tileId,
					row: tile.row,
					column: tile.column,
					zoneLabel: tile.zoneLabel,
					distance: plan.pathTileIds.length,
					pathTileIds: plan.pathTileIds,
					intent:
						tile.interaction?.kind === 'encounter' &&
						!state.resolvedInteractionTileIds.includes(tile.tileId)
							? ('encounter' as const)
							: ('travel' as const)
				}
			];
		} catch {
			return [];
		}
	});
}

export function applyExplorationTravel(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState,
	pathTileIds: readonly string[]
): ExplorationAttemptState {
	if (pathTileIds.length === 0) throw new Error('Exploration travel requires at least one tile');
	let next = state;
	for (const [index, tileId] of pathTileIds.entries()) {
		const tile = floor.tiles.find((candidate) => candidate.tileId === tileId);
		const unresolvedInteraction =
			tile?.interaction !== null &&
			tile?.interaction !== undefined &&
			!next.resolvedInteractionTileIds.includes(tileId);
		next = stepExploration(floor, next, tileId);
		if (unresolvedInteraction && index < pathTileIds.length - 1) {
			throw new Error('Exploration travel must stop at the first unresolved interaction');
		}
	}
	return next;
}

export function stepExploration(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState,
	destinationTileId: string
): ExplorationAttemptState {
	const legal = legalExplorationSteps(floor, state).find(
		(candidate) => candidate.tileId === destinationTileId
	);
	if (!legal) throw new Error(`Illegal exploration step to ${destinationTileId}`);
	const destination = floor.tiles.find((tile) => tile.tileId === destinationTileId)!;
	const alreadyResolved = state.resolvedInteractionTileIds.includes(destinationTileId);
	const interaction = destination.interaction;
	const resolvesOnEntry =
		interaction !== null &&
		interaction.kind !== 'entry-extraction' &&
		interaction.kind !== 'encounter';
	const pendingLoot = [...state.pendingLoot];
	if (resolvesOnEntry && !alreadyResolved && interaction) {
		if (interaction.kind === 'resource') {
			pendingLoot.push({
				kind: 'resource',
				key: interaction.resourceId,
				amount: interaction.amount
			});
		} else if (interaction.kind === 'experience') {
			pendingLoot.push({
				kind: 'experience',
				key: 'company-experience',
				amount: interaction.amount
			});
		} else if (interaction.kind === 'equipment') {
			pendingLoot.push({ kind: 'equipment', key: interaction.definitionId, amount: 1 });
		} else if (interaction.kind === 'consumable') {
			pendingLoot.push({ kind: 'consumable', key: interaction.itemId, amount: interaction.amount });
		}
	}
	return {
		...state,
		positionTileId: destinationTileId,
		revealedTileIds: revealRadius(floor, destination, state.revealedTileIds),
		resolvedInteractionTileIds:
			resolvesOnEntry && !alreadyResolved
				? [...state.resolvedInteractionTileIds, destinationTileId]
				: state.resolvedInteractionTileIds,
		objectiveComplete: state.objectiveComplete || interaction?.kind === 'objective',
		pendingLoot,
		version: state.version + 1
	};
}

export function suspendExplorationForEncounter(
	state: ExplorationAttemptState
): ExplorationAttemptState {
	if (state.status !== 'exploring') throw new Error('Only an exploring attempt can enter combat');
	return { ...state, status: 'encounter', version: state.version + 1 };
}

export function resumeExplorationAfterEncounter(
	state: ExplorationAttemptState,
	outcome: 'victory' | 'defeat'
): ExplorationAttemptState {
	if (state.status !== 'encounter') throw new Error('Only an active encounter can settle');
	return {
		...state,
		status: outcome === 'victory' ? 'exploring' : 'defeated',
		resolvedInteractionTileIds:
			outcome === 'victory' && !state.resolvedInteractionTileIds.includes(state.positionTileId)
				? [...state.resolvedInteractionTileIds, state.positionTileId]
				: state.resolvedInteractionTileIds,
		version: state.version + 1
	};
}

function chunkCoordinate(chunkId: string): { row: number; column: number } {
	const match = /-k-r(\d{3})-c(\d{3})$/u.exec(chunkId);
	if (!match) throw new Error(`Invalid exploration chunk ID: ${chunkId}`);
	return { row: Number(match[1]), column: Number(match[2]) };
}

export function projectExplorationWindow(
	floor: ExplorationFloorDefinition,
	state: ExplorationAttemptState,
	chunkMargin = 1
): ExplorationWindowProjection {
	const current = floor.tiles.find((tile) => tile.tileId === state.positionTileId);
	if (!current) throw new Error('Exploration position is not in the bound floor');
	const center = chunkCoordinate(current.chunkId);
	const projectedChunkIds = new Set(
		floor.tiles
			.filter((tile) => {
				const chunk = chunkCoordinate(tile.chunkId);
				return (
					Math.abs(chunk.row - center.row) <= chunkMargin &&
					Math.abs(chunk.column - center.column) <= chunkMargin
				);
			})
			.map((tile) => tile.chunkId)
	);
	const revealed = new Set(state.revealedTileIds);
	const tiles: ExplorationTileProjection[] = floor.tiles
		.filter((tile) => projectedChunkIds.has(tile.chunkId))
		.map((tile) =>
			revealed.has(tile.tileId)
				? { ...tile, knowledge: 'revealed' as const }
				: {
						tileId: tile.tileId,
						chunkId: tile.chunkId,
						row: tile.row,
						column: tile.column,
						knowledge: 'hidden' as const
					}
		);
	return {
		floorId: floor.floorId,
		displayName: floor.displayName,
		columns: floor.columns,
		rows: floor.rows,
		chunkSize: floor.chunkSize,
		positionTileId: state.positionTileId,
		revealedCount: state.revealedTileIds.length,
		chunkIds: [...projectedChunkIds].sort(),
		tiles
	};
}
