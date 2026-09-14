import type {
	BuildingAssignmentRole,
	EngineGameState,
	SettlementDefinition
} from '@summonlab/contracts';
import { planSettlementRoute } from '@summonlab/content';

import { hasFacilityState } from '../../core/versions.js';

type NavigationState = Extract<
	EngineGameState,
	{
		schemaVersion:
			| 3
			| 4
			| 5
			| 6
			| 7
			| 8
			| 9
			| 10
			| 11
			| 12
			| 13
			| 14
			| 15
			| 16
			| 17
			| 18
			| 19
			| 20
			| 21
			| 22
			| 23
			| 24
			| 25
			| 27;
	}
>;

const BUILDING_OPERATIONS = Object.freeze({
	'summoning-gate': {
		nodeId: 'gate-rail',
		role: 'gate-attendant',
		baselinePowerState: 'reserve'
	},
	kitchen: { nodeId: 'kitchen-hearth', role: 'cook', baselinePowerState: 'reserve' },
	dormitory: { nodeId: 'dormitory-bunks', role: 'resident', baselinePowerState: 'reserve' },
	'training-ground': {
		nodeId: 'training-ring',
		role: 'trainee',
		baselinePowerState: 'reserve'
	},
	workshop: { nodeId: 'workshop-bench', role: 'artisan', baselinePowerState: 'unpowered' }
} as const satisfies Record<
	string,
	{
		readonly nodeId: string;
		readonly role: BuildingAssignmentRole;
		readonly baselinePowerState: 'reserve' | 'unpowered';
	}
>);

export function createBuildingStates(definition: SettlementDefinition) {
	return Object.fromEntries(
		definition.buildings.map((building) => {
			const operation =
				BUILDING_OPERATIONS[building.buildingId as keyof typeof BUILDING_OPERATIONS];
			if (!operation) throw new Error(`Missing building operation: ${building.buildingId}`);
			const node = definition.nodes.find((candidate) => candidate.nodeId === operation.nodeId);
			if (!node || node.buildingId !== building.buildingId) {
				throw new Error(`Invalid assignment node for ${building.buildingId}`);
			}
			return [
				building.buildingId,
				{
					buildingId: building.buildingId,
					systemId: building.systemId,
					assignmentNodeId: operation.nodeId,
					assignmentRole: operation.role,
					assignmentCapacity: node.capacity,
					assignedHeroIds: [],
					baselinePowerState: operation.baselinePowerState,
					powerState: operation.baselinePowerState
				}
			];
		})
	);
}

export function zoneForNode(definition: SettlementDefinition, nodeId: string) {
	const node = definition.nodes.find((candidate) => candidate.nodeId === nodeId);
	if (!node) return null;
	if (!node.buildingId) return 'settlement-exterior' as const;
	return (
		definition.buildings.find((building) => building.buildingId === node.buildingId)?.kind ?? null
	);
}

export function destinationNodeId(
	definition: SettlementDefinition,
	destination: 'kitchen' | 'training-ground'
): string {
	const building = definition.buildings.find((candidate) => candidate.kind === destination);
	if (!building) throw new Error(`Settlement is missing ${destination}`);
	return building.interior.focusNodeId;
}

export function settlementRouteFor(
	state: NavigationState,
	definition: SettlementDefinition,
	heroId: string,
	targetNodeId: string
) {
	const hero = state.heroes[heroId];
	if (!hero) return null;
	return planSettlementRoute(
		definition,
		hero.locationNodeId,
		targetNodeId,
		new Set(state.settlement.navigation.activeSystemIds)
	);
}

export function routeHasCapacity(
	state: NavigationState,
	definition: SettlementDefinition,
	heroId: string,
	targetNodeId: string,
	route: ReturnType<typeof planSettlementRoute>
): boolean {
	if (!route) return false;
	if (!hasFacilityState(state)) return true;
	const targetNode = definition.nodes.find((candidate) => candidate.nodeId === targetNodeId);
	const nodeReservations = Object.values(state.heroes).filter(
		(candidate) =>
			candidate.heroId !== heroId &&
			(candidate.locationNodeId === targetNodeId ||
				candidate.currentTravel?.toNodeId === targetNodeId)
	).length;
	if (!targetNode || nodeReservations >= targetNode.capacity) return false;
	return route.steps.every((step) => {
		const edge = definition.edges.find((candidate) => candidate.edgeId === step.edgeId);
		const reservations = Object.values(state.heroes).filter((candidate) =>
			candidate.currentTravel?.route.steps.some(
				(candidateStep) => candidateStep.edgeId === step.edgeId
			)
		).length;
		return Boolean(edge && reservations < edge.capacity);
	});
}

export function currentTravelFor(state: EngineGameState, heroId: string) {
	return state.schemaVersion === 3 ||
		state.schemaVersion === 4 ||
		state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21 ||
		state.schemaVersion === 22 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24 ||
		state.schemaVersion === 25 ||
		state.schemaVersion === 27
		? (state.heroes[heroId]?.currentTravel ?? null)
		: null;
}
