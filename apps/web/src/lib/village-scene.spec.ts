import type { SettlementPresentation, SettlementSceneDefinition } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import type { VillageResident } from './village-shell';
import { projectVillageSceneResidents } from './village-scene';

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
	it('preserves authoritative occupant order while separating equal scene points', () => {
		const projected = projectVillageSceneResidents(scene, presentation, heroIds.map(resident));

		expect(projected.map((entry) => entry.resident?.heroId)).toEqual([
			presentation.occupants[0]!.heroId,
			presentation.occupants[1]!.heroId,
			presentation.occupants[2]!.heroId
		]);
		expect(projected[0]!.point.x).toBeLessThan(projected[1]!.point.x);
		expect(projected[1]!.point.x).toBeLessThan(projected[2]!.point.x);
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
