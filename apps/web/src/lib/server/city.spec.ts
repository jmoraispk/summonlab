import type {
	CampaignObjectiveProjection,
	SettlementPresentation,
	SettlementSceneDefinition
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import type { CityResidentSource, CitySummonHero } from '../city';
import { projectCityView } from './city';

const heroIds = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003'
] as const;

const scene = {
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
	],
	nodeProjections: [
		{ nodeId: 'gate-dais', point: { x: 0.2, y: 0.3 } },
		{ nodeId: 'training-ring', point: { x: 0.7, y: 0.3 } },
		{ nodeId: 'dormitory-bunks', point: { x: 0.3, y: 0.7 } }
	]
} as SettlementSceneDefinition;

const presentation = {
	runId: '10000000-0000-4000-8000-000000000001',
	version: 17,
	eventCursor: 24,
	stateHash: 'a'.repeat(64),
	gameTime: '2026-09-09T20:15:00.000Z',
	dayIndex: 2,
	dayNumber: 3,
	minuteOfDay: 1215,
	dayPhase: 'night',
	firstEmber: null,
	buildings: [
		building('summoning-gate', 'reserve', [heroIds[0]], 1, 8),
		building('kitchen', 'powered', [], 0, 3),
		building('dormitory', 'reserve', [heroIds[2]], 1, 6),
		building('training-ground', 'reserve', [heroIds[1]], 1, 8),
		building('workshop', 'unpowered', [], 0, 3)
	],
	occupants: [
		occupant(heroIds[0], 'gate-dais', 'summoning-gate', 'idle', 'Keeping watch'),
		occupant(heroIds[1], 'training-ring', 'training-ground', 'train', 'Training'),
		occupant(heroIds[2], 'dormitory-bunks', 'dormitory', 'sleep', 'Resting')
	],
	social: heroIds.map((heroId, index) => ({
		heroId,
		beliefCount: index,
		latestObservation: null,
		relationshipToMaster: { tone: 'neutral' as const, latestEvidence: null },
		authority: { standing: 'recognized' as const, latestEvidence: null },
		activePromiseTerms: []
	}))
} satisfies SettlementPresentation;

const residents: readonly CityResidentSource[] = [
	residentSource(heroIds[2], 3, 'Third'),
	residentSource(heroIds[0], 1, 'First'),
	residentSource(heroIds[1], 2, 'Second')
];

const summonHeroes: readonly CitySummonHero[] = heroIds.map((heroId, index) => ({
	heroId,
	ordinal: (index + 1) as 1 | 2 | 3,
	name: `Summon ${index + 1}`,
	rarityStars: 1,
	adultAge: 30,
	heightCm: 170,
	bodyBuild: 'athletic',
	voice: 'measured',
	role: 'resident',
	primaryValue: 'duty',
	primaryDrive: 'protect',
	socialStyle: 'direct',
	stressResponse: 'prepare',
	dailyHabit: 'checks exits',
	summonArt: { publicPath: `/summon-${index + 1}.webp`, width: 1024, height: 1536 },
	rosterArt: null,
	firstReply: null
}));

function campaign(summonedHeroCount: 0 | 1 | 2 | 3, onboardingStep = 0) {
	return {
		summonedHeroCount,
		onboardingStep,
		heroes: heroIds.map((heroId, index) => ({
			ordinal: index + 1,
			draft: { manifest: { characterId: heroId } }
		}))
	} as never;
}

const objectives = {
	projectionVersion: 'campaign-objectives-v1',
	runId: presentation.runId,
	stateHash: presentation.stateHash,
	activeObjectiveId: null,
	completedCount: 0,
	objectives: [],
	projectionHash: 'b'.repeat(64)
} as unknown as CampaignObjectiveProjection;

describe('City projection', () => {
	it('combines campaign residents, scene facilities, and operational occupancy once', () => {
		const city = projectCityView({
			mode: 'village',
			scene,
			presentation,
			residents,
			campaign: campaign(3, 3),
			summonHeroes,
			visibleHeroIds: heroIds,
			objectives,
			inventory: null,
			eventCue: null
		});

		expect(city.runId).toBe(presentation.runId);
		expect(city.expectedVersion).toBe(17);
		expect(city.eventCursor).toBe(24);
		expect(city.stateHash).toBe('a'.repeat(64));
		expect(city.dayNumber).toBe(3);
		expect(city.gameTime).toBe('2026-09-09T20:15:00.000Z');
		expect(city.dayPhase).toBe('night');
		expect(city.objectives).toBe(objectives);
		expect(city.residents.map((entry) => entry.name)).toEqual(['First', 'Second', 'Third']);
		expect(city.sceneResidents.map((entry) => entry.point)).toEqual([
			{ x: 0.2, y: 0.3 },
			{ x: 0.7, y: 0.3 },
			{ x: 0.3, y: 0.7 }
		]);
		expect(city.facilities.map((entry) => entry.label)).toEqual([
			'Summoning Circle',
			'Residence',
			'Training Grounds',
			'Forge',
			'Portal'
		]);
		expect(city.facilities[1]).toMatchObject({
			buildingIds: ['kitchen', 'dormitory'],
			occupantHeroIds: [heroIds[2]],
			occupantCount: 1,
			assignmentCount: 1,
			assignmentCapacity: 9,
			powerState: 'powered'
		});
		expect(city.occupancy).toEqual([
			{
				id: 'dormitory',
				label: 'Dorm',
				occupantCount: 1,
				assignmentCount: 1,
				assignmentCapacity: 6,
				powerState: 'reserve'
			},
			{
				id: 'kitchen',
				label: 'Kitchen',
				occupantCount: 0,
				assignmentCount: 0,
				assignmentCapacity: 3,
				powerState: 'powered'
			},
			{
				id: 'summoning-gate',
				label: 'Gate',
				occupantCount: 1,
				assignmentCount: 1,
				assignmentCapacity: 8,
				powerState: 'reserve'
			},
			{
				id: 'training-ground',
				label: 'Training',
				occupantCount: 1,
				assignmentCount: 1,
				assignmentCapacity: 8,
				powerState: 'reserve'
			},
			{
				id: 'workshop',
				label: 'Forge',
				occupantCount: 0,
				assignmentCount: 0,
				assignmentCapacity: 3,
				powerState: 'unpowered'
			}
		]);
	});

	it('offers world-changing actions only to an idle resident', () => {
		const city = projectCityView({
			mode: 'village',
			scene,
			presentation,
			residents,
			campaign: campaign(3, 3),
			summonHeroes,
			visibleHeroIds: heroIds,
			objectives: null,
			inventory: null,
			eventCue: null
		});

		expect(city.residents[0]).toMatchObject({
			name: 'First',
			readiness: 'available',
			availableActions: ['court-training', 'rest', 'details']
		});
		expect(city.residents[1]).toMatchObject({
			name: 'Second',
			readiness: 'busy',
			availableActions: ['details']
		});
		expect(city.residents[2]).toMatchObject({
			name: 'Third',
			readiness: 'busy',
			availableActions: ['details']
		});
	});

	it.each([
		{ count: 0 as const, residentCount: 0, stage: 'village-entry', nextOrdinal: 1 },
		{ count: 1 as const, residentCount: 1, stage: 'summoning', nextOrdinal: 2 },
		{ count: 3 as const, residentCount: 3, stage: 'first-voices', nextOrdinal: null }
	])(
		'projects $count committed summons without leaking latent candidates',
		({ count, residentCount, stage, nextOrdinal }) => {
			const city = projectCityView({
				mode: 'village',
				scene,
				presentation,
				residents,
				campaign: campaign(count),
				summonHeroes,
				visibleHeroIds: heroIds.slice(0, count),
				objectives: null,
				inventory: null,
				eventCue: null
			});

			expect(city.residents).toHaveLength(residentCount);
			expect(city.sceneResidents).toHaveLength(residentCount);
			expect(city.introduction).toMatchObject({
				stage,
				summonedHeroCount: count,
				nextHero: nextOrdinal === null ? null : { ordinal: nextOrdinal }
			});
			expect(city.occupancy.reduce((total, row) => total + row.occupantCount, 0)).toBe(
				residentCount
			);
		}
	);
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

function occupant(
	heroId: string,
	nodeId: string,
	buildingId: string,
	pose: SettlementPresentation['occupants'][number]['pose'],
	activityLabel: string
): SettlementPresentation['occupants'][number] {
	return { heroId, lifeState: 'active', nodeId, buildingId, pose, activityLabel, travel: null };
}

function residentSource(heroId: string, ordinal: number, name: string): CityResidentSource {
	return {
		heroId,
		ordinal,
		name,
		rarityStars: ordinal,
		pronouns: 'they/them',
		role: 'resident',
		firstReply: null,
		health: { current: 80, maximum: 100 },
		level: ordinal,
		detailRows: [],
		portrait: null,
		sceneArt: null
	};
}
