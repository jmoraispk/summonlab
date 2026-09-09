import type { SettlementPresentation, SettlementSceneDefinition } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import type { VillageResident } from './village-shell';
import { projectVillageFacilities, projectVillageSceneResidents } from './village-scene';

const heroIds = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003'
] as const;

const scene = {
	nodeProjections: [{ nodeId: 'gate-dais', point: { x: 0.5, y: 0.25 } }]
} as SettlementSceneDefinition;

function occupant(heroId: string): SettlementPresentation['occupants'][number] {
	return {
		heroId,
		lifeState: 'active',
		nodeId: 'gate-dais',
		buildingId: 'summoning-gate',
		pose: 'idle',
		activityLabel: 'Unassigned',
		travel: null
	};
}

const presentation = {
	occupants: heroIds.map(occupant)
} as SettlementPresentation;

function resident(heroId: string): VillageResident {
	return {
		heroId,
		ordinal: 1,
		name: `Resident ${heroId.at(-1)}`,
		rarityStars: 1,
		pronouns: 'they/them',
		role: 'resident',
		activity: 'Unassigned',
		location: 'gate dais',
		relationship: 'neutral',
		authority: 'unrecognized',
		beliefCount: 0,
		latestObservation: null,
		firstReply: null,
		portrait: null,
		sceneArt: null
	};
}

describe('Village scene residents', () => {
	it('preserves authoritative occupant order while reserving a full label footprint per cluster slot', () => {
		const projected = projectVillageSceneResidents(scene, presentation, heroIds.map(resident));

		expect(projected.map((entry) => entry.resident?.heroId)).toEqual([
			presentation.occupants[0]!.heroId,
			presentation.occupants[1]!.heroId,
			presentation.occupants[2]!.heroId
		]);
		expect(projected.map((entry) => entry.point.x)).toEqual([0.5, 0.5, 0.5]);
		expect(projected.map((entry) => entry.clusterOffsetRem)).toEqual([-7.5, 0, 7.5]);
		expect(projected.map((entry) => entry.clusterHalfRem)).toEqual([11.25, 11.25, 11.25]);
		expect(projected.every((entry) => entry.point.x >= 0.08 && entry.point.x <= 0.92)).toBe(true);
	});

	it('retains unmatched authoritative occupants as unavailable residents', () => {
		const projected = projectVillageSceneResidents(scene, presentation, [resident(heroIds[0])]);

		expect(projected[1]).toMatchObject({
			occupant: { heroId: heroIds[1] },
			resident: null,
			label: 'Resident unavailable'
		});
	});
});

describe('Village facility projections', () => {
	const facilityScene = {
		hotspots: [
			{
				facilityId: 'summoning-circle',
				label: 'Summoning Circle',
				target: {
					kind: 'settlement-buildings',
					buildingIds: ['summoning-gate'],
					entranceNodeIds: ['gate-court']
				}
			},
			{
				facilityId: 'residence',
				label: 'Residence',
				target: {
					kind: 'settlement-buildings',
					buildingIds: ['kitchen', 'dormitory'],
					entranceNodeIds: ['kitchen-entry', 'dormitory-entry']
				}
			},
			{
				facilityId: 'training-grounds',
				label: 'Training Grounds',
				target: {
					kind: 'settlement-buildings',
					buildingIds: ['training-ground'],
					entranceNodeIds: ['training-entry']
				}
			},
			{
				facilityId: 'forge',
				label: 'Forge',
				target: {
					kind: 'settlement-buildings',
					buildingIds: ['workshop'],
					entranceNodeIds: ['workshop-entry']
				}
			},
			{
				facilityId: 'tower-portal',
				label: 'Tower Portal',
				target: { kind: 'village-mode', mode: 'tower' }
			}
		]
	} as SettlementSceneDefinition;

	const facilityPresentation = {
		buildings: [
			building('summoning-gate', 'reserve', [], 0, 8),
			building('kitchen', 'powered', [heroIds[0]], 1, 3),
			building('dormitory', 'reserve', [heroIds[0], heroIds[1]], 2, 6),
			building('training-ground', 'reserve', [], 0, 8),
			building('workshop', 'unpowered', [], 0, 3)
		]
	} as SettlementPresentation;

	it('aggregates authoritative buildings into the five visual facilities', () => {
		const facilities = projectVillageFacilities(facilityScene, facilityPresentation);

		expect(facilities).toEqual([
			expect.objectContaining({
				facilityId: 'summoning-circle',
				occupantCount: 0,
				powerState: 'reserve'
			}),
			expect.objectContaining({
				facilityId: 'residence',
				buildingIds: ['kitchen', 'dormitory'],
				occupantHeroIds: [heroIds[0], heroIds[1]],
				occupantCount: 2,
				assignmentCount: 3,
				assignmentCapacity: 9,
				powerState: 'powered'
			}),
			expect.objectContaining({ facilityId: 'training-grounds', powerState: 'reserve' }),
			expect.objectContaining({ facilityId: 'forge', powerState: 'unpowered' }),
			expect.objectContaining({
				facilityId: 'tower-portal',
				buildingIds: [],
				occupantCount: 0,
				powerState: 'destination',
				hrefMode: 'tower'
			})
		]);
	});

	it('presents the stable tower destination as Portal', () => {
		const facilities = projectVillageFacilities(facilityScene, facilityPresentation);

		expect(facilities.at(-1)).toMatchObject({
			facilityId: 'tower-portal',
			label: 'Portal',
			hrefMode: 'tower'
		});
	});

	it('marks a facility unknown when an authoritative building binding is missing', () => {
		const presentationWithoutDormitory = {
			...facilityPresentation,
			buildings: facilityPresentation.buildings.filter(
				(building) => building.buildingId !== 'dormitory'
			)
		};

		expect(
			projectVillageFacilities(facilityScene, presentationWithoutDormitory).find(
				(facility) => facility.facilityId === 'residence'
			)?.powerState
		).toBe('unknown');
	});
});

function building(
	buildingId: string,
	powerState: 'unpowered' | 'reserve' | 'powered',
	occupantHeroIds: readonly string[],
	assignmentCount: number,
	assignmentCapacity: number
): SettlementPresentation['buildings'][number] {
	return {
		buildingId,
		powerState,
		occupantHeroIds: [...occupantHeroIds],
		assignmentCount,
		assignmentCapacity
	};
}
