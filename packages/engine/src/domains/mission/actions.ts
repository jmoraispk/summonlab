import {
	EngineGameStateSchema,
	LegalActionSchema,
	MissionTurnChoiceSchema,
	type EngineGameState,
	type EngineGameStateV11,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV14,
	type EngineGameStateV15,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type LegalAction,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	listLegalMissionDiscoveryAffordances,
	planMissionRoute,
	projectMissionArenaKnowledge
} from '@summonlab/content';

import { missionContentForState } from '../../core/content-bindings.js';
import { IllegalActionError } from '../../errors.js';
import { combatModeAvailability } from './combat-mode.js';
import { allPartyAtNode, missionPartyIsReserved } from './lifecycle.js';

const MISSION_MOVE_PREFIX = 'mission.move.';
const MISSION_INSPECT_PREFIX = 'mission.inspect.';
const MISSION_RECOVER_PREFIX = 'mission.recover.';
const MISSION_ATTACK_PREFIX = 'mission.attack.';
const MISSION_MINE_PREFIX = 'mission.mine.';
const MISSION_COOLING_CONTROL_ACTION_ID = 'mission.control.cooling-wheel';
const MISSION_HOLD_ACTION_ID = 'mission.hold';

function missionAction(input: Parameters<typeof LegalActionSchema.parse>[0]): LegalAction {
	return LegalActionSchema.parse(input);
}

export type MissionTurnEngineState =
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV23
	| EngineGameStateV24
	| EngineGameStateV25;

export function missionToolTagsForActor(
	state: MissionTurnEngineState,
	actorId: string
): Set<string> {
	if (
		state.schemaVersion !== 14 &&
		state.schemaVersion !== 16 &&
		state.schemaVersion !== 17 &&
		state.schemaVersion !== 18 &&
		state.schemaVersion !== 19 &&
		state.schemaVersion !== 20 &&
		state.schemaVersion !== 21 &&
		state.schemaVersion !== 23 &&
		state.schemaVersion !== 24 &&
		state.schemaVersion !== 25
	)
		return new Set();
	return new Set(
		Object.values(state.mission.evidence)
			.filter(
				(evidence) =>
					evidence.holderActorId === actorId && evidence.evidenceKey === 'foundry-maintenance-route'
			)
			.map(() => 'relay-route-memory')
	);
}

export function missionTurnActionsForState(
	state: MissionTurnEngineState,
	actorId: string
): LegalAction[] {
	const attempt = state.mission.attempt;
	if (
		!attempt ||
		!['deployed', 'resolving'].includes(attempt.status) ||
		!attempt.party.memberIds.includes(actorId) ||
		attempt.turnState.roundNumber >= attempt.turnState.maximumRounds
	) {
		return [];
	}
	const mission = missionContentForState(state);
	const nodeId = attempt.positions[actorId];
	if (!nodeId) return [];
	const projection = projectMissionArenaKnowledge(mission, attempt.knowledge);
	const visibleEdgeIds = new Set(projection.edgeIds);
	const objective = attempt.turnState.objective;
	const targetNodeId =
		objective.status === 'available'
			? mission.objectives.find((candidate) => candidate.objectiveId === objective.objectiveId)!
					.targetNodeIds[0]!
			: attempt.extractionNodeId;
	const currentRoute = planMissionRoute(mission, nodeId, targetNodeId, attempt.knowledge);
	const actions: LegalAction[] = [];
	for (const edge of mission.arena.edges) {
		if (!visibleEdgeIds.has(edge.edgeId)) continue;
		const toNodeId =
			edge.fromNodeId === nodeId
				? edge.toNodeId
				: edge.bidirectional && edge.toNodeId === nodeId
					? edge.fromNodeId
					: null;
		if (!toNodeId) continue;
		const routeAfterMove = planMissionRoute(mission, toNodeId, targetNodeId, attempt.knowledge);
		const advancesObjective =
			routeAfterMove !== null &&
			currentRoute !== null &&
			routeAfterMove.totalTraversalActions < currentRoute.totalTraversalActions;
		actions.push(
			missionAction({
				actionId: `${MISSION_MOVE_PREFIX}${edge.edgeId}`,
				actorId,
				kind: 'move',
				label: `Move to ${mission.arena.nodes.find((node) => node.nodeId === toNodeId)!.label}`,
				description: advancesObjective
					? objective.status === 'available'
						? 'Advance along a known route toward the primary objective.'
						: 'Carry the company back along a known return route.'
					: 'Move along a known authored edge without inventing unseen topology.',
				targetIds: [],
				resourceCosts: {},
				tags: [
					'mission',
					'move',
					edge.exposure,
					...(advancesObjective
						? objective.status === 'available'
							? ['objective', 'objective-route', 'advance']
							: ['protect', 'return-route', 'extraction']
						: ['explore'])
				]
			})
		);
	}
	for (const affordance of listLegalMissionDiscoveryAffordances(
		mission,
		nodeId,
		attempt.knowledge,
		missionToolTagsForActor(state, actorId)
	)) {
		actions.push(
			missionAction({
				actionId: `${MISSION_INSPECT_PREFIX}${affordance.affordanceId}`,
				actorId,
				kind: 'interact',
				label: affordance.label,
				description: affordance.description,
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'inspect', 'interact', 'secret', 'explore', 'discovery']
			})
		);
	}
	const objectiveDefinition = mission.objectives.find(
		(candidate) => candidate.objectiveId === objective.objectiveId
	)!;
	if (
		objective.status === 'available' &&
		state.schemaVersion !== 15 &&
		objectiveDefinition.completionRule.kind === 'recover-ledger-item' &&
		objectiveDefinition.targetNodeIds.includes(nodeId)
	) {
		actions.push(
			missionAction({
				actionId: `${MISSION_RECOVER_PREFIX}${objective.objectiveId}`,
				actorId,
				kind: 'interact',
				label:
					state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20
						? `Recover ${objectiveDefinition.title}`
						: 'Lift the First Ember',
				description:
					state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20
						? `Physically recover ${objectiveDefinition.title} before attempting the return route.`
						: 'Physically recover the primary objective before attempting the return route.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'interact', 'recover', 'objective', 'protect', 'work']
			})
		);
	}
	if (state.schemaVersion === 15) {
		const cargo = state.mission.attempt!.turnState.portal.cargo[actorId]!;
		for (const deposit of Object.values(state.mission.attempt!.turnState.portal.deposits)
			.filter(
				(candidate) =>
					candidate.nodeId === nodeId &&
					candidate.remainingAmount > 0 &&
					cargo.amount < cargo.capacity
			)
			.sort((left, right) => left.depositId.localeCompare(right.depositId))) {
			const amount = Math.min(
				deposit.mineAmountPerAction,
				deposit.remainingAmount,
				cargo.capacity - cargo.amount
			);
			actions.push(
				missionAction({
					actionId: `${MISSION_MINE_PREFIX}${deposit.depositId}`,
					actorId,
					kind: 'work',
					label: `Mine ${amount} moon iron`,
					description: `Transfer ${amount} authored ore from this finite deposit into ${actorId === state.master.masterId ? 'the Master’s' : 'this hero’s'} bounded cargo.`,
					targetIds: [],
					resourceCosts: {},
					tags: ['mission', 'portal', 'mine', 'resource', 'iron-ore', 'work']
				})
			);
		}
	}
	if (
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24 ||
		state.schemaVersion === 25
	) {
		const combatAttempt = state.mission.attempt!;
		for (const monster of Object.values(combatAttempt.turnState.monsters)
			.filter((candidate) => candidate.status === 'active' && candidate.nodeId === nodeId)
			.sort((left, right) => left.monsterId.localeCompare(right.monsterId))) {
			actions.push(
				missionAction({
					actionId: `${MISSION_ATTACK_PREFIX}${monster.monsterId}`,
					actorId,
					kind: 'interact',
					label: `Strike ${monster.label}`,
					description:
						'Commit a basic attack against one co-located threat; the engine applies vitality and armor.',
					targetIds: [monster.monsterId],
					resourceCosts: {},
					tags: ['mission', 'attack', 'combat', 'threat', monster.policyId]
				})
			);
		}
	}
	const v14Arena =
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24 ||
		state.schemaVersion === 25
			? state.mission.attempt!.turnState.arena
			: null;
	if (
		v14Arena &&
		nodeId === v14Arena.coolingControlNodeId &&
		attempt.knowledge.discoveryIds.includes('cooling-control-weakness') &&
		v14Arena.furnaceState !== 'absent' &&
		v14Arena.furnaceState !== 'quenched'
	) {
		actions.push(
			missionAction({
				actionId: MISSION_COOLING_CONTROL_ACTION_ID,
				actorId,
				kind: 'interact',
				label: 'Turn the cooling wheel',
				description: 'Advance the engine-owned furnace from lit to cooling, then quenched.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'interact', 'control', 'cooling', 'furnace']
			})
		);
	}
	actions.push(
		missionAction({
			actionId: MISSION_HOLD_ACTION_ID,
			actorId,
			kind: 'defend',
			label: 'Hold position',
			description:
				'Watch the current lane and preserve the present formation for one bounded round.',
			targetIds: [],
			resourceCosts: {},
			tags: ['mission', 'defend', 'guard', 'protect', 'wait']
		})
	);
	return actions.sort((left, right) => left.actionId.localeCompare(right.actionId));
}

export function missionTurnLegalActions(
	stateInput: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	return state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24 ||
		state.schemaVersion === 25
		? missionTurnActionsForState(state, actorId)
		: [];
}

export function normalizedMissionTurnChoices(
	state: MissionTurnEngineState,
	choices: readonly MissionTurnChoice[]
): MissionTurnChoice[] {
	const attempt = state.mission.attempt;
	if (!attempt || !['deployed', 'resolving'].includes(attempt.status)) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	if (attempt.turnState.roundNumber >= attempt.turnState.maximumRounds) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const parsedChoices = choices.map((choice) => MissionTurnChoiceSchema.parse(choice));
	const byActor = new Map(parsedChoices.map((choice) => [choice.actorId, choice]));
	if (
		byActor.size !== parsedChoices.length ||
		parsedChoices.length !== attempt.party.memberIds.length ||
		attempt.party.memberIds.some((actorId) => !byActor.has(actorId))
	) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const normalized = attempt.party.memberIds.map((actorId) => byActor.get(actorId)!);
	for (const choice of normalized) {
		if (
			(choice.actorId === attempt.party.masterId &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				state.schemaVersion !== 25 &&
				choice.source !== 'manual') ||
			(choice.actorId !== attempt.party.masterId && choice.source === 'manual') ||
			(state.schemaVersion === 25 && choice.source !== 'random') ||
			!missionTurnActionsForState(state, choice.actorId).some(
				(candidate) => candidate.actionId === choice.actionId
			)
		) {
			throw new IllegalActionError(choice.actionId);
		}
	}
	return normalized;
}

type MissionActionState =
	| EngineGameStateV11
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV23
	| EngineGameStateV24
	| EngineGameStateV25
	| EngineGameStateV26;

export function supportsMissionActions(state: EngineGameState): state is MissionActionState {
	return [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24, 25, 26].includes(state.schemaVersion);
}

export function missionLegalActions(
	stateInput: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	if (!supportsMissionActions(state)) return [];
	const attempt = state.mission.attempt;
	if (actorId !== state.master.masterId) {
		return missionPartyIsReserved(state, actorId) ? missionTurnLegalActions(state, actorId) : [];
	}
	if (attempt?.status === 'preparing') {
		return [
			missionAction({
				actionId: 'mission.revise.party',
				actorId,
				kind: 'interact',
				label: 'Revise the threshold party',
				description: 'Replace the reserved hero list before deployment.',
				targetIds: attempt.party.heroIds,
				resourceCosts: {},
				tags: ['mission', 'preparation', 'party']
			}),
			missionAction({
				actionId: 'mission.deploy',
				actorId,
				kind: 'move',
				label: 'Cross the Tower Threshold',
				description: 'Commit the exact prepared party to the hash-bound Floor 01 attempt.',
				targetIds: attempt.party.memberIds,
				resourceCosts: {},
				tags: ['mission', 'deployment', 'irreversible-step']
			}),
			missionAction({
				actionId: 'mission.cancel',
				actorId,
				kind: 'wait',
				label: 'Stand the party down',
				description: 'Cancel before deployment and release every reserved hero.',
				targetIds: attempt.party.memberIds,
				resourceCosts: {},
				tags: ['mission', 'preparation', 'cancel']
			})
		];
	}
	if (attempt?.status === 'deployed' || attempt?.status === 'resolving') {
		if (state.schemaVersion === 25 || state.schemaVersion === 26) {
			if (
				state.schemaVersion === 25 &&
				state.mission.attempt!.combatModeBinding.modeId !== 'legacy-auto-v1'
			)
				return [];
			if (
				combatModeAvailability(state.mission.attempt!.combatModeBinding, state.schemaVersion)
					.status !== 'available'
			)
				return [];
			return [
				missionAction({
					actionId: 'mission.advance.automatic',
					actorId,
					kind: 'interact',
					label: 'Continue battle',
					description:
						'Advance one bounded automatic combat round under the attempt’s stored operator mode.',
					targetIds: [],
					resourceCosts: {},
					tags: ['mission', 'combat', 'automatic', 'mode-bound']
				})
			];
		}
		const turnActions = state.schemaVersion === 11 ? [] : missionTurnLegalActions(state, actorId);
		return allPartyAtNode(state, missionContentForState(state).retreat.nodeIds)
			? [
					...turnActions,
					missionAction({
						actionId: 'mission.retreat',
						actorId,
						kind: 'retreat',
						label:
							state.schemaVersion === 15
								? 'Retreat through the portal scar'
								: 'Retreat through the threshold',
						description:
							state.schemaVersion === 15
								? 'End the expedition alive; all carried ore is abandoned.'
								: 'End this attempt without preserving the primary objective.',
						targetIds: attempt.party.memberIds,
						resourceCosts: {},
						tags: ['mission', 'retreat', 'authoritative-boundary']
					})
				]
			: turnActions;
	}
	if (attempt?.status === 'extraction') {
		const actions: LegalAction[] = [];
		if (allPartyAtNode(state, [attempt.extractionNodeId])) {
			actions.push(
				missionAction({
					actionId: 'mission.extract',
					actorId,
					kind: 'interact',
					label:
						state.schemaVersion === 15 ? 'Extract the moon iron' : 'Carry the First Ember home',
					description:
						state.schemaVersion === 15
							? 'Cross the portal scar and atomically credit carried ore to settlement stock.'
							: 'Complete the recovered objective across the authored extraction boundary.',
					targetIds: attempt.party.memberIds,
					resourceCosts: {},
					tags: ['mission', 'extraction', 'success']
				})
			);
		}
		if (allPartyAtNode(state, missionContentForState(state).retreat.nodeIds)) {
			actions.push(
				missionAction({
					actionId: 'mission.retreat',
					actorId,
					kind: 'retreat',
					label: 'Abandon the recovery and retreat',
					description: 'End the attempt without preserving the primary objective.',
					targetIds: attempt.party.memberIds,
					resourceCosts: {},
					tags: ['mission', 'retreat', 'authoritative-boundary']
				})
			);
		}
		return actions;
	}
	if (
		!attempt ||
		['canceled', 'retreat', 'failure', 'death'].includes(attempt.status) ||
		(state.schemaVersion >= 18 && attempt.status === 'success')
	) {
		return [
			missionAction({
				actionId: 'mission.prepare',
				actorId,
				kind: 'interact',
				label: `Prepare ${missionContentForState(state).displayName} party`,
				description: 'Reserve the Master and up to four ready heroes at the Tower Threshold.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'preparation', 'content-bound']
			})
		];
	}
	return [];
}
