import type {
	AuthoritativeEvent,
	CampaignObjectiveProjection,
	NormalizedScenePoint,
	SettlementPresentation,
	SettlementSceneDefinition,
	VillageFacilityId
} from '@summonlab/contracts';

import type { EquipmentWorkshopProjection } from './server/equipment-runtime';

export const CITY_MODES = [
	{ id: 'village', label: 'Village' },
	{ id: 'residents', label: 'Residents' },
	{ id: 'tower', label: 'Tower' },
	{ id: 'inventory', label: 'Inventory' },
	{ id: 'missions', label: 'Missions' }
] as const;

export type CityMode = (typeof CITY_MODES)[number]['id'];
export type CityResidentAction = 'court-training' | 'rest' | 'details';
export type CityResidentReadiness = 'available' | 'busy' | 'traveling' | 'unavailable';

export interface CityResidentArt {
	readonly publicPath: string;
	readonly width: number;
	readonly height: number;
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
	readonly scene: SettlementSceneDefinition;
	readonly residents: readonly CityResident[];
	readonly sceneResidents: readonly CitySceneResident[];
	readonly facilities: readonly CityFacility[];
	readonly occupancy: readonly CityOccupancyRow[];
	readonly objectives: CampaignObjectiveProjection | null;
	readonly inventory: EquipmentWorkshopProjection | null;
	readonly tower: { readonly available: false; readonly reason: string };
	readonly eventCue: AuthoritativeEvent | null;
}

const CITY_MODE_IDS = new Set<string>(CITY_MODES.map((mode) => mode.id));

export function parseCityMode(value: string | null): CityMode {
	return value !== null && CITY_MODE_IDS.has(value) ? (value as CityMode) : 'village';
}

export function cityModeHref(runId: string, mode: CityMode): string {
	const base = `/play/${encodeURIComponent(runId)}`;
	return mode === 'village' ? base : `${base}?mode=${mode}`;
}
