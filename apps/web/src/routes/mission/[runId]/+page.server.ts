import { getConfig } from '@summonlab/config';
import { TOWER_FLOOR_01_PACKAGE, projectMissionArenaKnowledge } from '@summonlab/content';
import { getEngineReplay, getProofRun } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const [report, proof] = await Promise.all([
		getEngineReplay(config.databaseUrl, params.runId).catch(() => null),
		getProofRun(config.databaseUrl, params.runId).catch(() => null)
	]);
	if (!report || !proof) error(404, 'This summoned company could not be loaded.');
	if (report.snapshot.state.schemaVersion !== 12) {
		error(409, 'This run predates authoritative mission turns.');
	}
	const attempt = report.snapshot.state.mission.attempt;
	const knowledge = attempt?.knowledge ?? { discoveryIds: [], visitedNodeIds: [] };
	const projection = projectMissionArenaKnowledge(TOWER_FLOOR_01_PACKAGE, knowledge);
	return {
		report,
		proof,
		arena: {
			width: TOWER_FLOOR_01_PACKAGE.design.width,
			height: TOWER_FLOOR_01_PACKAGE.design.height,
			nodes: TOWER_FLOOR_01_PACKAGE.arena.nodes
				.filter((node) => projection.nodeIds.includes(node.nodeId))
				.map((node) => ({
					nodeId: node.nodeId,
					label: node.label,
					kind: node.kind,
					position: node.position,
					visited: projection.visitedNodeIds.includes(node.nodeId)
				})),
			edges: TOWER_FLOOR_01_PACKAGE.arena.edges
				.filter((edge) => projection.edgeIds.includes(edge.edgeId))
				.map((edge) => ({
					edgeId: edge.edgeId,
					fromNodeId: edge.fromNodeId,
					toNodeId: edge.toNodeId,
					exposure: edge.exposure,
					visualPath: edge.visualPath
				})),
			observations: TOWER_FLOOR_01_PACKAGE.arena.observations
				.filter((observation) => projection.observationIds.includes(observation.observationId))
				.map((observation) => ({
					observationId: observation.observationId,
					nodeId: observation.nodeId,
					summary: observation.summary
				}))
		}
	};
};
