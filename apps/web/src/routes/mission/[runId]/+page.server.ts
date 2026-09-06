import { getConfig } from '@summonlab/config';
import {
	IRON_MOON_PACKAGE,
	TOWER_BAND_01_RUNTIME_PACKAGES,
	TOWER_FLOOR_01_PACKAGE,
	projectMissionArenaKnowledge
} from '@summonlab/content';
import { getEngineReplay, getProofRun } from '@summonlab/database';
import { supportsMissionApi } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import { runtimePortraitFor } from '$lib/server/runtime-portraits';
import { projectProofRunForPublic } from '$lib/server/proof-presentation';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const [report, proof] = await Promise.all([
		getEngineReplay(config.databaseUrl, params.runId).catch(() => null),
		getProofRun(config.databaseUrl, params.runId).catch(() => null)
	]);
	if (!report || !proof) error(404, 'This summoned company could not be loaded.');
	if (!supportsMissionApi(report.snapshot.state)) {
		error(409, 'This run predates authoritative mission turns.');
	}
	const isPortal = report.snapshot.state.schemaVersion === 15;
	const isMasterTiming =
		report.snapshot.state.schemaVersion === 19 || report.snapshot.state.schemaVersion === 20;
	const isAttemptAftermath = report.snapshot.state.schemaVersion === 18 || isMasterTiming;
	const isAftermath = report.snapshot.state.schemaVersion === 16 || isAttemptAftermath;
	const isMasterRisk = report.snapshot.state.schemaVersion === 17 || isAttemptAftermath;
	const missionBindingId = report.snapshot.state.mission.binding.missionId;
	const missionPackage = isPortal
		? IRON_MOON_PACKAGE.mission
		: (TOWER_BAND_01_RUNTIME_PACKAGES.find(
				(candidate) => candidate.missionId === missionBindingId
			) ?? TOWER_FLOOR_01_PACKAGE);
	const attempt = report.snapshot.state.mission.attempt;
	const knowledge = attempt?.knowledge ?? { discoveryIds: [], visitedNodeIds: [] };
	const projection = projectMissionArenaKnowledge(missionPackage, knowledge);
	const primaryObjective = missionPackage.objectives.find((objective) => objective.primary)!;
	return {
		report,
		proof: projectProofRunForPublic(proof),
		heroPortrait: runtimePortraitFor(proof.manifestHash, proof.manifest.artKey, 'roster'),
		missionDefinition: {
			isPortal,
			isAftermath,
			isMasterRisk,
			isAttemptAftermath,
			isMasterTiming,
			displayName: missionPackage.displayName,
			tagline: missionPackage.tagline,
			objectiveTitle: primaryObjective.title,
			objectiveSummary: primaryObjective.summary,
			maximumRounds: isPortal ? IRON_MOON_PACKAGE.portal.durationRounds : 48,
			portal: isPortal ? IRON_MOON_PACKAGE.portal : null
		},
		arena: {
			width: missionPackage.design.width,
			height: missionPackage.design.height,
			nodes: missionPackage.arena.nodes
				.filter((node) => projection.nodeIds.includes(node.nodeId))
				.map((node) => ({
					nodeId: node.nodeId,
					label: node.label,
					kind: node.kind,
					position: node.position,
					visited: projection.visitedNodeIds.includes(node.nodeId)
				})),
			edges: missionPackage.arena.edges
				.filter((edge) => projection.edgeIds.includes(edge.edgeId))
				.map((edge) => ({
					edgeId: edge.edgeId,
					fromNodeId: edge.fromNodeId,
					toNodeId: edge.toNodeId,
					exposure: edge.exposure,
					visualPath: edge.visualPath
				})),
			observations: missionPackage.arena.observations
				.filter((observation) => projection.observationIds.includes(observation.observationId))
				.map((observation) => ({
					observationId: observation.observationId,
					nodeId: observation.nodeId,
					summary: observation.summary
				}))
		}
	};
};
