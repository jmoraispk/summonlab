import type {
	AuthoritativeEvent,
	CampaignObjectiveProjection,
	ExplorationEncounterRequest,
	NormalizedScenePoint,
	SettlementPresentation,
	SettlementSceneDefinition,
	VillageFacilityId
} from '@summonlab/contracts';

import type { EquipmentWorkshopProjection } from './server/equipment-runtime';

export type TowerFloorStatus = 'available' | 'active' | 'cleared' | 'locked';

export interface TowerFloorView {
	readonly floorId: string;
	readonly floorNumber: number;
	readonly name: string;
	readonly tagline: string;
	readonly objective: string;
	readonly knownMonsters: readonly string[];
	readonly rewards: readonly string[];
	readonly status: TowerFloorStatus;
	readonly lockReason: string | null;
}

export interface TowerExplorationView {
	readonly attemptId: string;
	readonly floorId: string;
	readonly floorName: string;
	readonly status: 'exploring' | 'returning';
	readonly version: number;
	readonly positionTileId: string;
	readonly columns: number;
	readonly rows: number;
	readonly revealedCount: number;
	readonly objectiveComplete: boolean;
	readonly pendingLoot: readonly {
		readonly kind: string;
		readonly key: string;
		readonly amount: number;
	}[];
	readonly tiles: readonly {
		readonly tileId: string;
		readonly row: number;
		readonly column: number;
		readonly knowledge: 'hidden' | 'revealed';
		readonly walkable?: boolean;
		readonly zoneLabel?: string;
		readonly interactionKind?: string | null;
	}[];
	readonly legalSteps: readonly { readonly tileId: string; readonly label: string }[];
	readonly destinations: readonly {
		readonly tileId: string;
		readonly row: number;
		readonly column: number;
		readonly zoneLabel: string;
		readonly distance: number;
		readonly pathTileIds: readonly string[];
		readonly intent: 'travel' | 'encounter';
	}[];
}

export type TowerView =
	| { readonly state: 'floor-list'; readonly floors: readonly TowerFloorView[] }
	| {
			readonly state: 'exploration';
			readonly floors: readonly TowerFloorView[];
			readonly exploration: TowerExplorationView;
	  }
	| {
			readonly state: 'encounter';
			readonly floors: readonly TowerFloorView[];
			readonly exploration: Omit<TowerExplorationView, 'status' | 'legalSteps' | 'destinations'>;
			readonly encounterRequestId: string | null;
			readonly encounterRequest: ExplorationEncounterRequest | null;
	  }
	| {
			readonly state: 'report';
			readonly floors: readonly TowerFloorView[];
			readonly outcome: 'victory' | 'defeat' | 'extracted';
			readonly floorId: string;
			readonly loot: readonly {
				readonly kind: string;
				readonly key: string;
				readonly amount: number;
			}[];
	  };

export const CITY_MODES = [
	{ id: 'village', label: 'Village' },
	{ id: 'residents', label: 'Residents' },
	{ id: 'tower', label: 'Tower' },
	{ id: 'inventory', label: 'Inventory' },
	{ id: 'missions', label: 'Missions' }
] as const;

export type CityMode = (typeof CITY_MODES)[number]['id'];
export const CITY_MODE_PATHS = {
	village: '/village',
	residents: '/residents',
	tower: '/tower',
	inventory: '/inventory',
	missions: '/missions'
} as const satisfies Record<CityMode, `/${string}`>;

export type CityModePath = (typeof CITY_MODE_PATHS)[CityMode];
export type CityResidentAction = 'court-training' | 'rest' | 'details';
export type CityResidentReadiness = 'available' | 'busy' | 'traveling' | 'unavailable';

export interface CityIntent {
	readonly action: 'court-training' | 'rest';
	readonly heroId: string;
	readonly expectedVersion: number;
}

export interface CityResidentArt {
	readonly publicPath: string;
	readonly width: number;
	readonly height: number;
}

export interface CitySummonHero {
	readonly heroId: string;
	readonly ordinal: 1 | 2 | 3;
	readonly name: string;
	readonly rarityStars: number;
	readonly adultAge: number;
	readonly heightCm: number;
	readonly bodyBuild: string;
	readonly voice: string;
	readonly role: string;
	readonly primaryValue: string;
	readonly primaryDrive: string;
	readonly socialStyle: string;
	readonly stressResponse: string;
	readonly dailyHabit: string;
	readonly summonArt: CityResidentArt;
	readonly rosterArt: CityResidentArt | null;
	readonly firstReply: { readonly exactText: string; readonly publicReason: string } | null;
}

export interface CityIntroduction {
	readonly stage: 'village-entry' | 'summoning' | 'first-voices' | 'complete';
	readonly summonedHeroCount: 0 | 1 | 2 | 3;
	readonly nextHero: CitySummonHero | null;
	readonly summonedHeroes: readonly CitySummonHero[];
	readonly answeredHeroCount: number;
}

export interface CitySummonIntent {
	readonly ordinal: 1 | 2 | 3;
	readonly expectedSummonedHeroCount: 0 | 1 | 2;
}

export interface CityResidentSource {
	readonly heroId: string;
	readonly ordinal: number;
	readonly name: string;
	readonly rarityStars: number;
	readonly pronouns: string;
	readonly role: string;
	readonly firstReply: string | null;
	readonly health: { readonly current: number; readonly maximum: number } | null;
	readonly level: number | null;
	readonly detailRows: readonly { readonly label: string; readonly value: string }[];
	readonly portrait: CityResidentArt | null;
	readonly sceneArt: CityResidentArt | null;
	readonly combatArt: CityResidentArt | null;
}

export interface CityResident extends CityResidentSource {
	readonly activity: string;
	readonly location: string;
	readonly nodeId: string | null;
	readonly readiness: CityResidentReadiness;
	readonly relationship: string;
	readonly authority: string;
	readonly beliefCount: number;
	readonly latestObservation: string | null;
	readonly availableActions: readonly CityResidentAction[];
}

export interface CitySceneResident {
	readonly occupant: SettlementPresentation['occupants'][number];
	readonly resident: CityResident | null;
	readonly point: NormalizedScenePoint;
	readonly clusterOffsetRem: number;
	readonly clusterHalfRem: number;
	readonly label: string;
}

export interface CityFacility {
	readonly hotspot: SettlementSceneDefinition['hotspots'][number];
	readonly facilityId: VillageFacilityId;
	readonly label: string;
	readonly buildingIds: readonly string[];
	readonly occupantHeroIds: readonly string[];
	readonly occupantCount: number;
	readonly assignmentCount: number;
	readonly assignmentCapacity: number;
	readonly powerState: 'powered' | 'reserve' | 'unpowered' | 'unknown' | 'destination';
	readonly hrefMode: 'tower' | null;
}

export interface CityOccupancyRow {
	readonly id: 'dormitory' | 'kitchen' | 'summoning-gate' | 'training-ground' | 'workshop';
	readonly label: 'Dorm' | 'Kitchen' | 'Gate' | 'Training' | 'Forge';
	readonly occupantCount: number;
	readonly assignmentCount: number;
	readonly assignmentCapacity: number;
	readonly powerState: 'powered' | 'reserve' | 'unpowered';
}

export interface CityViewModel {
	readonly runId: string;
	readonly expectedVersion: number;
	readonly eventCursor: number;
	readonly stateHash: string;
	readonly dayNumber: number;
	readonly gameTime: string;
	readonly dayPhase: string;
	readonly mode: CityMode;
	readonly introduction: CityIntroduction;
	readonly scene: SettlementSceneDefinition;
	readonly residents: readonly CityResident[];
	readonly sceneResidents: readonly CitySceneResident[];
	readonly facilities: readonly CityFacility[];
	readonly occupancy: readonly CityOccupancyRow[];
	readonly objectives: CampaignObjectiveProjection | null;
	readonly inventory: EquipmentWorkshopProjection | null;
	readonly tower: TowerView;
	readonly eventCue: AuthoritativeEvent | null;
}

const CITY_MODE_IDS = new Set<string>(CITY_MODES.map((mode) => mode.id));

export function parseCityMode(value: string | null): CityMode {
	return value !== null && CITY_MODE_IDS.has(value) ? (value as CityMode) : 'village';
}

export function cityModeHref(mode: CityMode): CityModePath {
	return CITY_MODE_PATHS[mode];
}
