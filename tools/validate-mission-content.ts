import {
	applyMissionDiscoveryAffordance,
	listLegalMissionDiscoveryAffordances,
	loadTowerBand01,
	planMissionRoute,
	projectMissionArenaKnowledge,
	visitMissionNode
} from '../packages/content/src/index.js';

const missions = await loadTowerBand01();
const summaries = missions.map((mission) => {
	const entryNodeId = mission.deployment.entryNodeIds[0]!;
	const objectiveNodeId = mission.objectives.find((objective) => objective.primary)!
		.targetNodeIds[0]!;
	const initialKnowledge = {
		discoveryIds: [],
		visitedNodeIds: [...mission.deployment.entryNodeIds]
	};
	const projection = projectMissionArenaKnowledge(mission, initialKnowledge);
	const defaultRoute = planMissionRoute(mission, entryNodeId, objectiveNodeId, initialKnowledge);
	if (!defaultRoute)
		throw new Error(`${mission.missionId} has no authored default objective route`);
	if (!mission.arena.discoveries.some((discovery) => discovery.kind === 'route')) {
		throw new Error(`${mission.missionId} has no authored route discovery`);
	}
	if (mission.story.anchors.length !== 5) {
		throw new Error(`${mission.missionId} does not declare the five band story jobs`);
	}
	return {
		floor: mission.tower!.floor,
		missionId: mission.missionId,
		displayName: mission.displayName,
		contentVersion: mission.contentVersion,
		contentHash: mission.contentHash,
		objectiveId: mission.objectives.find((objective) => objective.primary)!.objectiveId,
		canonicalTopology: {
			nodes: mission.arena.nodes.length,
			edges: mission.arena.edges.length,
			concealedNodes: mission.arena.nodes.filter((node) => node.initialKnowledge === 'concealed')
				.length
		},
		initialProjection: {
			nodes: projection.nodeIds.length,
			edges: projection.edgeIds.length,
			observations: projection.observationIds.length
		},
		defaultRouteActions: defaultRoute.totalTraversalActions,
		defaultRouteExposure: defaultRoute.maximumExposure,
		discoveries: mission.arena.discoveries.length,
		observations: mission.arena.observations.length,
		monsterDuties: mission.monsterDuties.length,
		storyAnchors: mission.story.anchors.length,
		storyPatchSlots: mission.story.patchSlots.length,
		rewardBudgetPoints: mission.rewards.budgetPoints,
		rewardDeclaredCost: mission.rewards.grants.reduce((sum, grant) => sum + grant.budgetCost, 0)
	};
});

const floor01 = missions[0]!;
const floor01Entry = {
	discoveryIds: [],
	visitedNodeIds: [...floor01.deployment.entryNodeIds]
};
const atOathHall = visitMissionNode(floor01, 'oath-hall', floor01Entry);
if (
	!listLegalMissionDiscoveryAffordances(floor01, 'oath-hall', atOathHall).some(
		(affordance) => affordance.affordanceId === 'inspect-soot-seam'
	)
) {
	throw new Error('Tower Floor 01 soot-seam discovery is not legally available at Oath Hall');
}
const floor01Discovered = applyMissionDiscoveryAffordance(floor01, 'inspect-soot-seam', atOathHall);
const floor01DefaultRoute = planMissionRoute(
	floor01,
	'tower-threshold',
	'ember-vault',
	floor01Entry
)!;
const floor01DiscoveredRoute = planMissionRoute(
	floor01,
	'tower-threshold',
	'ember-vault',
	floor01Discovered
)!;
if (floor01DiscoveredRoute.totalTraversalActions >= floor01DefaultRoute.totalTraversalActions) {
	throw new Error('Tower Floor 01 discovery does not create a real route alternative');
}

const floor04 = missions[3]!;
if (
	!floor04.arena.discoveries.some(
		(discovery) =>
			discovery.discoveryId === 'foundry-maintenance-route' &&
			discovery.canonicalFact?.includes('Floor 05')
	)
) {
	throw new Error('Tower Floor 04 does not author the Foundry maintenance-route evidence');
}

const floor05 = missions[4]!;
const wardenDuties = missions.flatMap((mission) =>
	mission.monsterDuties.filter((duty) => duty.policyId === 'foundry-warden-v1')
);
if (
	wardenDuties.length !== 1 ||
	wardenDuties[0]?.dutySlotId !== 'foundry-warden' ||
	wardenDuties[0].count.min !== 1 ||
	wardenDuties[0].count.max !== 1
) {
	throw new Error('The Foundry Warden must be placed exactly once on Floor 05');
}
const floor05Entry = {
	discoveryIds: [],
	visitedNodeIds: [...floor05.deployment.entryNodeIds]
};
const atAshIntake = visitMissionNode(floor05, 'ash-intake', floor05Entry);
if (listLegalMissionDiscoveryAffordances(floor05, 'ash-intake', atAshIntake).length !== 0) {
	throw new Error('Floor 05 maintenance knowledge leaked without retained Floor 04 route memory');
}
const retainedMemory = new Set(['relay-route-memory']);
if (
	!listLegalMissionDiscoveryAffordances(floor05, 'ash-intake', atAshIntake, retainedMemory).some(
		(affordance) => affordance.affordanceId === 'recall-maintenance-seam'
	)
) {
	throw new Error('Floor 05 does not accept retained Floor 04 route memory');
}
const maintenanceKnowledge = applyMissionDiscoveryAffordance(
	floor05,
	'recall-maintenance-seam',
	atAshIntake,
	retainedMemory
);
const coolingRoute = planMissionRoute(
	floor05,
	'tower-threshold',
	'cooling-control',
	maintenanceKnowledge
);
if (!coolingRoute || coolingRoute.maximumExposure !== 'low') {
	throw new Error('Floor 05 maintenance discovery does not expose the authored cooling route');
}

process.stdout.write(
	`${JSON.stringify(
		{
			contentVersion: 'tower-band-01-v1',
			floors: summaries,
			bandTotals: {
				floors: missions.length,
				observations: summaries.reduce((sum, floor) => sum + floor.observations, 0),
				discoveries: summaries.reduce((sum, floor) => sum + floor.discoveries, 0),
				rewardBudgetPoints: summaries.reduce((sum, floor) => sum + floor.rewardBudgetPoints, 0)
			},
			floor01RouteAlternative: {
				defaultActions: floor01DefaultRoute.totalTraversalActions,
				discoveredActions: floor01DiscoveredRoute.totalTraversalActions
			},
			floor05Confrontation: {
				wardenPolicyId: wardenDuties[0]!.policyId,
				directRouteAuthored: true,
				maintenanceRouteRequires: 'relay-route-memory',
				coolingRouteActions: coolingRoute.totalTraversalActions,
				coolingRouteExposure: coolingRoute.maximumExposure
			}
		},
		null,
		2
	)}\n`
);
