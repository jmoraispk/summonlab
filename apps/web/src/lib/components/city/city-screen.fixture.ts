import type { SettlementPresentation } from '@summonlab/contracts';
import { loadHearth01Scene } from '@summonlab/content';

import type { CityResidentSource, CityViewModel } from '$lib/city';
import { projectCityView } from '$lib/server/city';

const heroIds = [
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000003'
] as const;

export async function cityScreenFixture(): Promise<CityViewModel> {
	const scene = await loadHearth01Scene();
	const presentation: SettlementPresentation = {
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
			beliefCount: index + 2,
			latestObservation: {
				kind: 'awakening',
				summary: 'The resident is settling into Hearth 01.',
				observedAt: '2026-09-09T19:30:00.000Z'
			},
			relationshipToMaster: { tone: 'receptive', latestEvidence: null },
			authority: { standing: 'recognized', latestEvidence: null },
			activePromiseTerms: []
		}))
	};
	const city = projectCityView({
		mode: 'village',
		scene,
		presentation,
		residents: residentSources(),
		objectives: null,
		inventory: null,
		eventCue: null
	});
	return deepFreeze(city);
}

function residentSources(): readonly CityResidentSource[] {
	return [
		resident(
			heroIds[0],
			1,
			'Yaso Dreno',
			'/runtime/summonable-heroes-v1/yaso-dreno/summon.7ac986a9c0e7.webp',
			'/runtime/summonable-heroes-v1/yaso-dreno/village-cutout.07459c13b322.webp'
		),
		resident(
			heroIds[1],
			2,
			'Oren Sorin',
			'/runtime/summonable-heroes-v1/oren-sorin/summon.6233321998e5.webp',
			'/runtime/summonable-heroes-v1/oren-sorin/village-cutout.68870a30726e.webp'
		),
		resident(
			heroIds[2],
			3,
			'Joror Pelleth',
			'/runtime/summonable-heroes-v1/joror-pelleth/summon.2f1f4c16ceda.webp',
			'/runtime/summonable-heroes-v1/joror-pelleth/village-cutout.174acd04e1bd.webp'
		)
	];
}

function resident(
	heroId: string,
	ordinal: number,
	name: string,
	portraitPath: string,
	scenePath: string
): CityResidentSource {
	return {
		heroId,
		ordinal,
		name,
		rarityStars: ordinal + 2,
		pronouns: 'they/them',
		role: ordinal === 1 ? 'Vanguard' : 'Resident',
		firstReply: 'I will help make this place a home.',
		health: { current: 80 + ordinal * 4, maximum: 100 },
		level: ordinal + 5,
		detailRows: [{ label: 'Readiness', value: ordinal === 1 ? 'Available' : 'Occupied' }],
		portrait: { publicPath: portraitPath, width: 1024, height: 1536 },
		sceneArt: { publicPath: scenePath, width: 1024, height: 1536 }
	};
}

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

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}
