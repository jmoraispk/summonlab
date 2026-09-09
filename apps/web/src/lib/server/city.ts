import type {
	AuthoritativeEvent,
	CampaignObjectiveProjection,
	SettlementPresentation,
	SettlementSceneDefinition
} from '@summonlab/contracts';

import type {
	CityMode,
	CityOccupancyRow,
	CityResident,
	CityResidentReadiness,
	CityResidentSource,
	CityViewModel
} from '../city';
import { projectVillageFacilities, projectVillageSceneResidents } from '../village-scene';
import type { EquipmentWorkshopProjection } from './equipment-runtime';

const OCCUPANCY_ROWS = [
	['dormitory', 'Dorm'],
	['kitchen', 'Kitchen'],
	['summoning-gate', 'Gate'],
	['training-ground', 'Training'],
	['workshop', 'Forge']
] as const;

export interface ProjectCityViewInput {
	readonly mode: CityMode;
	readonly scene: SettlementSceneDefinition;
	readonly presentation: SettlementPresentation;
	readonly residents: readonly CityResidentSource[];
	readonly objectives: CampaignObjectiveProjection | null;
	readonly inventory: EquipmentWorkshopProjection | null;
	readonly eventCue: AuthoritativeEvent | null;
}

export function projectCityView(input: ProjectCityViewInput): CityViewModel {
	const residents = input.residents
		.map((source) => projectResident(source, input.presentation))
		.sort((left, right) => left.ordinal - right.ordinal || left.heroId.localeCompare(right.heroId));
	const facilities = projectVillageFacilities(input.scene, input.presentation).map((facility) => ({
		...facility,
		label: facility.facilityId === 'tower-portal' ? 'Portal' : facility.label
	}));

	return {
		runId: input.presentation.runId,
		expectedVersion: input.presentation.version,
		eventCursor: input.presentation.eventCursor,
		stateHash: input.presentation.stateHash,
		dayNumber: input.presentation.dayNumber,
		gameTime: input.presentation.gameTime,
		dayPhase: input.presentation.dayPhase,
		mode: input.mode,
		scene: input.scene,
		residents,
		sceneResidents: projectVillageSceneResidents(input.scene, input.presentation, residents),
		facilities,
		occupancy: projectOccupancy(input.presentation),
		objectives: input.objectives,
		inventory: input.inventory,
		tower: {
			available: false,
			reason: 'Expedition controls are not connected yet.'
		},
		eventCue: input.eventCue
	};
}

function projectResident(
	source: CityResidentSource,
	presentation: SettlementPresentation
): CityResident {
	const occupant = presentation.occupants.find((entry) => entry.heroId === source.heroId);
	const social = presentation.social.find((entry) => entry.heroId === source.heroId);
	const readiness = residentReadiness(occupant);
	return {
		...source,
		activity: occupant?.activityLabel ?? 'State unavailable',
		location: (occupant?.buildingId ?? occupant?.nodeId ?? 'Hearth 01').replaceAll('-', ' '),
		nodeId: occupant?.nodeId ?? null,
		readiness,
		relationship: social?.relationshipToMaster.tone ?? 'unknown',
		authority: social?.authority.standing ?? 'unknown',
		beliefCount: social?.beliefCount ?? 0,
		latestObservation: social?.latestObservation?.summary ?? null,
		availableActions:
			readiness === 'available'
				? (['court-training', 'rest', 'details'] as const)
				: (['details'] as const)
	};
}

function residentReadiness(
	occupant: SettlementPresentation['occupants'][number] | undefined
): CityResidentReadiness {
	if (!occupant || occupant.lifeState !== 'active') return 'unavailable';
	if (occupant.travel) return 'traveling';
	return occupant.pose === 'idle' || occupant.pose === 'walk' ? 'available' : 'busy';
}

function projectOccupancy(presentation: SettlementPresentation): readonly CityOccupancyRow[] {
	const buildings = new Map(
		presentation.buildings.map((building) => [building.buildingId, building])
	);
	return OCCUPANCY_ROWS.map(([id, label]) => {
		const building = buildings.get(id);
		if (!building) throw new Error(`City projection is missing operational building ${id}`);
		return {
			id,
			label,
			occupantCount: building.occupantHeroIds.length,
			assignmentCount: building.assignmentCount,
			assignmentCapacity: building.assignmentCapacity,
			powerState: building.powerState
		};
	});
}
