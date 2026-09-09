import type {
	NormalizedScenePoint,
	SettlementPresentation,
	SettlementSceneDefinition,
	VillageFacilityId
} from '@summonlab/contracts';

import type { VillageResident } from './village-shell';

export interface VillageSceneResident {
	readonly occupant: SettlementPresentation['occupants'][number];
	readonly resident: VillageResident | null;
	readonly point: NormalizedScenePoint;
	readonly clusterOffsetRem: number;
	readonly clusterHalfRem: number;
	readonly label: string;
}

export interface VillageFacilityProjection {
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

const MINIMUM_SCENE_X = 0.08;
const MAXIMUM_SCENE_X = 0.92;
const CLUSTER_SLOT_REM = 7.5;

export function projectVillageFacilities(
	scene: SettlementSceneDefinition,
	presentation: SettlementPresentation
): readonly VillageFacilityProjection[] {
	const buildings = new Map(
		presentation.buildings.map((building) => [building.buildingId, building])
	);

	return scene.hotspots.map((hotspot) => {
		if (hotspot.target.kind === 'village-mode') {
			return {
				hotspot,
				facilityId: hotspot.facilityId,
				label: hotspot.label,
				buildingIds: [],
				occupantHeroIds: [],
				occupantCount: 0,
				assignmentCount: 0,
				assignmentCapacity: 0,
				powerState: 'destination',
				hrefMode: hotspot.target.mode
			};
		}

		const boundBuildings = hotspot.target.buildingIds.map((buildingId) =>
			buildings.get(buildingId)
		);
		const missingBinding = boundBuildings.some((building) => building === undefined);
		const knownBuildings = boundBuildings.filter((building) => building !== undefined);
		const occupantHeroIds = [
			...new Set(knownBuildings.flatMap((building) => building.occupantHeroIds))
		];
		const powerState = missingBinding
			? 'unknown'
			: knownBuildings.some((building) => building.powerState === 'powered')
				? 'powered'
				: knownBuildings.some((building) => building.powerState === 'reserve')
					? 'reserve'
					: 'unpowered';

		return {
			hotspot,
			facilityId: hotspot.facilityId,
			label: hotspot.label,
			buildingIds: hotspot.target.buildingIds,
			occupantHeroIds,
			occupantCount: occupantHeroIds.length,
			assignmentCount: knownBuildings.reduce(
				(total, building) => total + building.assignmentCount,
				0
			),
			assignmentCapacity: knownBuildings.reduce(
				(total, building) => total + building.assignmentCapacity,
				0
			),
			powerState,
			hrefMode: null
		};
	});
}

export function projectVillageSceneResidents(
	scene: SettlementSceneDefinition,
	presentation: SettlementPresentation,
	residents: readonly VillageResident[]
): readonly VillageSceneResident[] {
	const points = new Map(scene.nodeProjections.map((entry) => [entry.nodeId, entry.point]));
	const residentsByHeroId = new Map(residents.map((resident) => [resident.heroId, resident]));
	const basePoints = presentation.occupants.map((occupant) => pointAlongRoute(occupant, points));
	const equalPointGroups = new Map<string, number[]>();

	for (const [index, point] of basePoints.entries()) {
		const key = `${point.x.toFixed(3)}:${point.y.toFixed(3)}`;
		const group = equalPointGroups.get(key) ?? [];
		group.push(index);
		equalPointGroups.set(key, group);
	}

	return presentation.occupants.map((occupant, index) => {
		const basePoint = basePoints[index]!;
		const group = equalPointGroups.get(`${basePoint.x.toFixed(3)}:${basePoint.y.toFixed(3)}`)!;
		const offsetIndex = group.indexOf(index);
		const resident = residentsByHeroId.get(occupant.heroId) ?? null;
		return {
			occupant,
			resident,
			point: {
				x: clamp(basePoint.x, MINIMUM_SCENE_X, MAXIMUM_SCENE_X),
				y: basePoint.y
			},
			clusterOffsetRem: (offsetIndex - (group.length - 1) / 2) * CLUSTER_SLOT_REM,
			clusterHalfRem: (group.length * CLUSTER_SLOT_REM) / 2,
			label: resident?.name ?? 'Resident unavailable'
		};
	});
}

function pointAlongRoute(
	entry: SettlementPresentation['occupants'][number],
	points: ReadonlyMap<string, NormalizedScenePoint>
): NormalizedScenePoint {
	const fallback = points.get(entry.nodeId) ?? { x: 0.5, y: 0.5 };
	if (!entry.travel || entry.travel.routeNodeIds.length < 2) return fallback;
	const routePoints = entry.travel.routeNodeIds
		.map((nodeId) => points.get(nodeId))
		.filter((point): point is NormalizedScenePoint => point !== undefined);
	if (routePoints.length < 2) return fallback;
	const scaled = entry.travel.progress * (routePoints.length - 1);
	const segment = Math.min(Math.floor(scaled), routePoints.length - 2);
	const localProgress = scaled - segment;
	const from = routePoints[segment]!;
	const to = routePoints[segment + 1]!;
	return {
		x: from.x + (to.x - from.x) * localProgress,
		y: from.y + (to.y - from.y) * localProgress
	};
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}
