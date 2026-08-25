import { getConfig } from '@summonlab/config';
import { loadTowerBand01, planMissionRoute } from '@summonlab/content';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

function combinations(values: readonly string[]): string[][] {
	return values.reduce<string[][]>(
		(result, value) => [...result, ...result.map((combination) => [...combination, value])],
		[[]]
	);
}

function keyFor(discoveryIds: readonly string[]): string {
	return [...discoveryIds].sort().join('|') || 'none';
}

export const load: PageServerLoad = async () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Not found.');
	const missions = await loadTowerBand01();
	const routes = Object.fromEntries(
		missions.map((mission) => {
			const entryNodeId = mission.deployment.entryNodeIds[0]!;
			const objectiveNodeId = mission.objectives.find((objective) => objective.primary)!
				.targetNodeIds[0]!;
			return [
				mission.missionId,
				Object.fromEntries(
					combinations(mission.arena.discoveries.map((discovery) => discovery.discoveryId)).map(
						(discoveryIds) => [
							keyFor(discoveryIds),
							planMissionRoute(mission, entryNodeId, objectiveNodeId, {
								discoveryIds,
								visitedNodeIds: [entryNodeId]
							})
						]
					)
				)
			];
		})
	);

	return { missions, routes };
};
