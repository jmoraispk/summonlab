import type {
	AuthoritativeEvent,
	CampaignObjectiveProjection,
	CampaignRun,
	SettlementPresentation,
	SettlementSceneDefinition
} from '@summonlab/contracts';

import type {
	CityMode,
	CityOccupancyRow,
	CityResident,
	CityResidentReadiness,
	CityResidentSource,
	CitySummonHero,
	CityViewModel,
	TowerView
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
	readonly campaign: CampaignRun;
	readonly summonHeroes: readonly CitySummonHero[];
	readonly visibleHeroIds: readonly string[];
	readonly objectives: CampaignObjectiveProjection | null;
	readonly inventory: EquipmentWorkshopProjection | null;
	readonly tower?: TowerView;
	readonly eventCue: AuthoritativeEvent | null;
}

export function projectCityView(input: ProjectCityViewInput): CityViewModel {
	const visibleHeroIds = new Set(input.visibleHeroIds);
	const presentation = restrictPresentation(input.presentation, visibleHeroIds);
	const residents = input.residents
		.filter((source) => visibleHeroIds.has(source.heroId))
		.map((source) => projectResident(source, presentation))
		.sort((left, right) => left.ordinal - right.ordinal || left.heroId.localeCompare(right.heroId));
	const facilities = projectVillageFacilities(input.scene, presentation).map((facility) => ({
		...facility,
		label: facility.facilityId === 'tower-portal' ? 'Portal' : facility.label
	}));
	const introduction = projectIntroduction(input.campaign, input.summonHeroes);

	return {
		runId: presentation.runId,
		expectedVersion: presentation.version,
		eventCursor: presentation.eventCursor,
		stateHash: presentation.stateHash,
		dayNumber: presentation.dayNumber,
		gameTime: presentation.gameTime,
		dayPhase: presentation.dayPhase,
		mode: input.mode,
		introduction,
		scene: input.scene,
		residents,
		sceneResidents: projectVillageSceneResidents(input.scene, presentation, residents),
		facilities,
		occupancy: projectOccupancy(presentation),
		objectives: input.objectives,
		inventory: input.inventory,
		tower: input.tower ?? { state: 'floor-list', floors: [] },
		eventCue: input.eventCue
	};
}

function restrictPresentation(
	presentation: SettlementPresentation,
	visibleHeroIds: ReadonlySet<string>
): SettlementPresentation {
	return {
		...presentation,
		buildings: presentation.buildings.map((building) => {
			const occupantHeroIds = building.occupantHeroIds.filter((heroId) =>
				visibleHeroIds.has(heroId)
			);
			return {
				...building,
				occupantHeroIds,
				assignmentCount: Math.min(building.assignmentCount, occupantHeroIds.length)
			};
		}),
		occupants: presentation.occupants.filter((occupant) => visibleHeroIds.has(occupant.heroId)),
		social: presentation.social.filter((entry) => visibleHeroIds.has(entry.heroId))
	};
}

function projectIntroduction(
	campaign: CampaignRun,
	summonHeroes: readonly CitySummonHero[]
): CityViewModel['introduction'] {
	const stage =
		campaign.onboardingStep >= 3
			? 'complete'
			: campaign.summonedHeroCount === 0
				? 'village-entry'
				: campaign.summonedHeroCount < 3
					? 'summoning'
					: 'first-voices';
	return {
		stage,
		summonedHeroCount: campaign.summonedHeroCount,
		nextHero:
			campaign.summonedHeroCount < 3
				? (summonHeroes.find((hero) => hero.ordinal === campaign.summonedHeroCount + 1) ?? null)
				: null,
		summonedHeroes: summonHeroes.filter((hero) => hero.ordinal <= campaign.summonedHeroCount),
		answeredHeroCount: summonHeroes.filter(
			(hero) => hero.ordinal <= campaign.summonedHeroCount && hero.firstReply !== null
		).length
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
