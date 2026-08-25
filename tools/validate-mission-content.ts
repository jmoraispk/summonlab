import {
	applyMissionDiscoveryAffordance,
	listLegalMissionDiscoveryAffordances,
	loadTowerFloor01,
	planMissionRoute,
	projectMissionArenaKnowledge,
	visitMissionNode
} from '../packages/content/src/index.js';

const mission = await loadTowerFloor01();
const initialKnowledge = {
	discoveryIds: [],
	visitedNodeIds: [...mission.deployment.entryNodeIds]
};
const defaultProjection = projectMissionArenaKnowledge(mission, initialKnowledge);
const defaultRoute = planMissionRoute(
	mission,
	mission.deployment.entryNodeIds[0]!,
	mission.objectives.find((objective) => objective.primary)!.targetNodeIds[0]!,
	initialKnowledge
);
if (!defaultRoute) throw new Error('Tower Floor 01 has no authored default objective route');

const atOathHall = visitMissionNode(mission, 'oath-hall', initialKnowledge);
if (
	!listLegalMissionDiscoveryAffordances(mission, 'oath-hall', atOathHall).some(
		(affordance) => affordance.affordanceId === 'inspect-soot-seam'
	)
) {
	throw new Error('Tower Floor 01 soot-seam discovery is not legally available at Oath Hall');
}
const discoveredKnowledge = applyMissionDiscoveryAffordance(
	mission,
	'inspect-soot-seam',
	atOathHall
);
const discoveredProjection = projectMissionArenaKnowledge(mission, discoveredKnowledge);
const discoveredRoute = planMissionRoute(
	mission,
	mission.deployment.entryNodeIds[0]!,
	mission.objectives.find((objective) => objective.primary)!.targetNodeIds[0]!,
	discoveredKnowledge
);
if (
	!discoveredRoute ||
	discoveredRoute.totalTraversalActions >= defaultRoute.totalTraversalActions
) {
	throw new Error('Tower Floor 01 discovery does not create a real route alternative');
}

process.stdout.write(
	`${JSON.stringify(
		{
			contentVersion: mission.contentVersion,
			contentHash: mission.contentHash,
			missionId: mission.missionId,
			objectiveId: mission.objectives.find((objective) => objective.primary)!.objectiveId,
			partyBoundary: {
				minimum: mission.deployment.minimumPartyMembers,
				maximum: mission.deployment.maximumPartyMembers,
				masterRequired: mission.deployment.masterRequired
			},
			canonicalTopology: {
				nodes: mission.arena.nodes.length,
				edges: mission.arena.edges.length
			},
			initialProjection: {
				nodes: defaultProjection.nodeIds.length,
				edges: defaultProjection.edgeIds.length,
				observations: defaultProjection.observationIds.length
			},
			discoveredProjection: {
				nodes: discoveredProjection.nodeIds.length,
				edges: discoveredProjection.edgeIds.length,
				observations: discoveredProjection.observationIds.length
			},
			defaultRouteActions: defaultRoute.totalTraversalActions,
			discoveredRouteActions: discoveredRoute.totalTraversalActions,
			discoveryAffordances: mission.arena.discoveryAffordances.length,
			storyAnchors: mission.story.anchors.length,
			storyPatchSlots: mission.story.patchSlots.length,
			rewardBudgetPoints: mission.rewards.budgetPoints
		},
		null,
		2
	)}\n`
);
