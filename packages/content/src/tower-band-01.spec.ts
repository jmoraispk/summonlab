import type { MissionArenaKnowledge } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { monsterPolicy } from './monster-policies.js';
import { TOWER_BAND_01_PACKAGES, loadTowerBand01, loadTowerFloor } from './tower-band-01.js';
import {
	applyMissionDiscoveryAffordance,
	calculateMissionContentHash,
	listLegalMissionDiscoveryAffordances,
	planMissionRoute,
	visitMissionNode
} from './tower-floor-01.js';

function entryKnowledge(): MissionArenaKnowledge {
	return { discoveryIds: [], visitedNodeIds: ['tower-threshold'] };
}

describe('Tower Band 01 mission catalog', () => {
	it('loads five consecutive immutable floors with verified unique hashes', async () => {
		const missions = await loadTowerBand01();

		expect(missions.map((mission) => mission.tower?.floor)).toEqual([1, 2, 3, 4, 5]);
		expect(new Set(missions.map((mission) => mission.contentHash))).toHaveLength(5);
		for (const mission of missions) {
			expect(await calculateMissionContentHash(mission)).toBe(mission.contentHash);
			expect(Object.isFrozen(mission)).toBe(true);
			expect(mission.story.storySpineId).toBe('band-one-unclaimed-authority');
			expect(mission.story.anchors).toHaveLength(5);
			expect(mission.story.patchSlots).toHaveLength(1);
			expect(mission.arena.observations.length).toBeGreaterThanOrEqual(6);
			expect(mission.rewards.grants.length).toBeGreaterThanOrEqual(3);
		}
	});

	it('gives every floor a default objective route and a lower-exposure authored alternative', async () => {
		for (const mission of TOWER_BAND_01_PACKAGES) {
			const primary = mission.objectives.find((objective) => objective.primary)!;
			const defaultRoute = planMissionRoute(
				mission,
				mission.deployment.entryNodeIds[0]!,
				primary.targetNodeIds[0]!,
				entryKnowledge()
			);
			expect(defaultRoute, `${mission.missionId} default route`).not.toBeNull();
			expect(defaultRoute?.maximumExposure).toBe('exposed');
			expect(mission.arena.discoveries.some((discovery) => discovery.kind === 'route')).toBe(true);
		}
	});

	it('carries Floor 04 route knowledge into a gated Floor 05 cooling strategy', async () => {
		const floor04 = await loadTowerFloor(4);
		let floor04Knowledge = visitMissionNode(floor04, 'left-relay', entryKnowledge());
		floor04Knowledge = applyMissionDiscoveryAffordance(
			floor04,
			'open-archive-niche',
			floor04Knowledge
		);
		floor04Knowledge = visitMissionNode(floor04, 'archive-niche', floor04Knowledge);
		floor04Knowledge = applyMissionDiscoveryAffordance(
			floor04,
			'read-foundry-schematic',
			floor04Knowledge
		);
		expect(floor04Knowledge.discoveryIds).toContain('foundry-maintenance-route');

		const floor05 = await loadTowerFloor(5);
		const atIntake = visitMissionNode(floor05, 'ash-intake', entryKnowledge());
		expect(listLegalMissionDiscoveryAffordances(floor05, 'ash-intake', atIntake)).toEqual([]);
		const legalWithMemory = listLegalMissionDiscoveryAffordances(
			floor05,
			'ash-intake',
			atIntake,
			new Set(['relay-route-memory'])
		);
		expect(legalWithMemory.map((affordance) => affordance.affordanceId)).toEqual([
			'recall-maintenance-seam'
		]);
		const recalled = applyMissionDiscoveryAffordance(
			floor05,
			'recall-maintenance-seam',
			atIntake,
			new Set(['relay-route-memory'])
		);
		expect(planMissionRoute(floor05, 'tower-threshold', 'cooling-control', recalled)).toMatchObject(
			{
				nodeIds: ['tower-threshold', 'ash-intake', 'maintenance-seam', 'cooling-control'],
				maximumExposure: 'low'
			}
		);
	});

	it('places the reusable Foundry Warden exactly once and only on Floor 05', async () => {
		const placements = TOWER_BAND_01_PACKAGES.flatMap((mission) =>
			mission.monsterDuties
				.filter((duty) => duty.policyId === 'foundry-warden-v1')
				.map((duty) => ({ missionId: mission.missionId, duty }))
		);

		expect(placements).toEqual([
			expect.objectContaining({
				missionId: 'tower-floor-05',
				duty: expect.objectContaining({
					dutySlotId: 'foundry-warden',
					count: { min: 1, max: 1 }
				})
			})
		]);
		expect(monsterPolicy('foundry-warden-v1')).toMatchObject({
			behavior: 'foundry-warden',
			armor: { kind: 'furnace-linked', litReduction: 3 }
		});
	});

	it('rejects floors outside the authored first band', async () => {
		await expect(loadTowerFloor(6)).rejects.toThrow('does not contain floor 6');
	});
});
