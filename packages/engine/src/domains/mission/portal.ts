import {
	MissionRoundV3Schema,
	MissionRunStateV5Schema,
	type EngineGameStateV15,
	type EntropyDraw,
	type MissionRoundV3,
	type MissionRunStateV5,
	type MissionTurnChoice
} from '@summonlab/contracts';
import {
	applyMissionDiscoveryAffordance,
	listLegalMissionDiscoveryAffordances,
	visitMissionNode
} from '@summonlab/content';

import { missionContentForState } from '../../core/content-bindings.js';
import { createEntropyCursor, drawInteger } from '../../entropy.js';
import { IllegalActionError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import { normalizedMissionTurnChoices } from './actions.js';
import { activeMissionEnvironmentEvents, missionInitiativeBase } from './combat.js';

const MISSION_MOVE_PREFIX = 'mission.move.';
const MISSION_INSPECT_PREFIX = 'mission.inspect.';
const MISSION_MINE_PREFIX = 'mission.mine.';

export type PortalResourceChange = {
	readonly resource: 'iron-ore';
	readonly before: number;
	readonly after: number;
	readonly delta: number;
	readonly reason: string;
};

function portalResourceChange(input: PortalResourceChange): PortalResourceChange {
	return input;
}

export function portalPressureStage(
	roundsRemaining: number,
	warningAtRemainingRounds: number,
	criticalAtRemainingRounds: number
): 'stable' | 'warning' | 'critical' | 'collapsed' {
	if (roundsRemaining === 0) return 'collapsed';
	if (roundsRemaining <= criticalAtRemainingRounds) return 'critical';
	if (roundsRemaining <= warningAtRemainingRounds) return 'warning';
	return 'stable';
}

export type PortalAttempt = NonNullable<EngineGameStateV15['mission']['attempt']>;
export type PortalRuntime = PortalAttempt['turnState']['portal'];
type PortalOreEntry = PortalRuntime['oreLedger'][number];

export function appendPortalCargoLosses(
	attempt: PortalAttempt,
	portalInput: PortalRuntime,
	roundNumber: number,
	positions: Readonly<Record<string, string>> = attempt.positions
): PortalRuntime {
	let portal = structuredClone(portalInput);
	for (const actorId of attempt.party.memberIds) {
		const cargo = portal.cargo[actorId]!;
		if (cargo.amount === 0) continue;
		const entry: PortalOreEntry = {
			entryId: deterministicUuid(
				`${attempt.attemptId}:round:${roundNumber}:ore:${portal.oreLedger.length + 1}:lost`
			),
			sequence: portal.oreLedger.length + 1,
			roundNumber,
			kind: 'lost',
			actorId,
			depositId: null,
			nodeId: positions[actorId] ?? attempt.extractionNodeId,
			amount: cargo.amount,
			cargoBefore: cargo.amount,
			cargoAfter: 0,
			depositBefore: null,
			depositAfter: null,
			settlementBefore: null,
			settlementAfter: null
		};
		portal = {
			...portal,
			cargo: { ...portal.cargo, [actorId]: { ...cargo, amount: 0 } },
			oreLedger: [...portal.oreLedger, entry]
		};
	}
	return portal;
}

export type PortalTurnResolution = {
	readonly mission: MissionRunStateV5;
	readonly round: MissionRoundV3;
	readonly choices: MissionTurnChoice[];
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
};

export function resolvePortalMissionTurn(
	state: EngineGameStateV15,
	choicesInput: readonly MissionTurnChoice[]
): PortalTurnResolution {
	const choices = normalizedMissionTurnChoices(state, choicesInput);
	const currentAttempt = state.mission.attempt!;
	const missionContent = missionContentForState(state);
	const roundNumber = currentAttempt.turnState.roundNumber + 1;
	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const ranked = choices
		.map((choice) => {
			const tieBreak = drawInteger(entropy, 'initiative-tie-break', 0, 99);
			entropy = tieBreak.next;
			entropyDraws.push(tieBreak.draw);
			const initiativeBase = missionInitiativeBase(state, choice.actorId);
			return {
				choice,
				initiativeBase,
				initiativeTieBreak: tieBreak.draw.value,
				initiative: initiativeBase + tieBreak.draw.value
			};
		})
		.sort(
			(left, right) =>
				right.initiative - left.initiative ||
				left.choice.actorId.localeCompare(right.choice.actorId)
		);

	let positions = { ...currentAttempt.positions };
	let knowledge = { ...currentAttempt.knowledge };
	let objective = { ...currentAttempt.turnState.objective };
	let portal = structuredClone(currentAttempt.turnState.portal);
	const oreLedgerStart = portal.oreLedger.length;
	const resolvedActions: MissionRoundV3['actions'] = [];

	for (const entry of ranked) {
		const { choice } = entry;
		const fromNodeId = positions[choice.actorId]!;
		let toNodeId = fromNodeId;
		let discoveryIds: string[] = [];
		let objectiveTransition: 'recovered' | 'delivered' | null = null;
		let outcome: 'applied' | 'superseded' = 'applied';
		let summary: string;

		if (choice.actionId.startsWith(MISSION_MOVE_PREFIX)) {
			const edgeId = choice.actionId.slice(MISSION_MOVE_PREFIX.length);
			const edge = missionContent.arena.edges.find((candidate) => candidate.edgeId === edgeId)!;
			toNodeId =
				edge.fromNodeId === fromNodeId
					? edge.toNodeId
					: edge.bidirectional && edge.toNodeId === fromNodeId
						? edge.fromNodeId
						: fromNodeId;
			positions = { ...positions, [choice.actorId]: toNodeId };
			knowledge = visitMissionNode(missionContent, toNodeId, knowledge);
			summary = `Moved from ${fromNodeId} to ${toNodeId} with ${portal.cargo[choice.actorId]!.amount} ore in cargo.`;
		} else if (choice.actionId.startsWith(MISSION_INSPECT_PREFIX)) {
			const affordanceId = choice.actionId.slice(MISSION_INSPECT_PREFIX.length);
			const legal = listLegalMissionDiscoveryAffordances(
				missionContent,
				fromNodeId,
				knowledge
			).some((candidate) => candidate.affordanceId === affordanceId);
			if (legal) {
				const before = new Set(knowledge.discoveryIds);
				knowledge = applyMissionDiscoveryAffordance(missionContent, affordanceId, knowledge);
				discoveryIds = knowledge.discoveryIds.filter((id) => !before.has(id));
				summary = `Resolved ${affordanceId} and revealed ${discoveryIds.join(', ')}.`;
			} else {
				outcome = 'superseded';
				summary = `${affordanceId} had already resolved earlier in initiative.`;
			}
		} else if (choice.actionId.startsWith(MISSION_MINE_PREFIX)) {
			const depositId = choice.actionId.slice(MISSION_MINE_PREFIX.length);
			const deposit = portal.deposits[depositId];
			const cargo = portal.cargo[choice.actorId]!;
			const amount = deposit
				? Math.min(
						deposit.mineAmountPerAction,
						deposit.remainingAmount,
						cargo.capacity - cargo.amount
					)
				: 0;
			if (!deposit || deposit.nodeId !== fromNodeId || amount <= 0) {
				outcome = 'superseded';
				summary = 'The selected ore was depleted or cargo had filled earlier in initiative.';
			} else {
				const ledgerEntry: PortalOreEntry = {
					entryId: deterministicUuid(
						`${currentAttempt.attemptId}:round:${roundNumber}:ore:${portal.oreLedger.length + 1}:mined`
					),
					sequence: portal.oreLedger.length + 1,
					roundNumber,
					kind: 'mined',
					actorId: choice.actorId,
					depositId,
					nodeId: fromNodeId,
					amount,
					cargoBefore: cargo.amount,
					cargoAfter: cargo.amount + amount,
					depositBefore: deposit.remainingAmount,
					depositAfter: deposit.remainingAmount - amount,
					settlementBefore: null,
					settlementAfter: null
				};
				portal = {
					...portal,
					deposits: {
						...portal.deposits,
						[depositId]: { ...deposit, remainingAmount: deposit.remainingAmount - amount }
					},
					cargo: {
						...portal.cargo,
						[choice.actorId]: { ...cargo, amount: cargo.amount + amount }
					},
					oreLedger: [...portal.oreLedger, ledgerEntry]
				};
				const minedAmount = objective.minedAmount + amount;
				if (objective.status === 'available' && minedAmount >= objective.quota) {
					objective = {
						...objective,
						status: 'quota-met',
						minedAmount,
						quotaReachedOnRound: roundNumber
					};
					objectiveTransition = 'recovered';
				} else {
					objective = { ...objective, minedAmount };
				}
				summary = `Mined ${amount} iron ore from ${depositId}; cargo is ${cargo.amount + amount}/${cargo.capacity}.`;
			}
		} else {
			summary = 'Held position against the Iron Moon wind.';
		}

		resolvedActions.push({
			actorId: choice.actorId,
			actorKind: choice.actorId === currentAttempt.party.masterId ? 'master' : 'hero',
			actionId: choice.actionId,
			choiceSource: choice.source,
			policyId: choice.policyId,
			packetHash: choice.packetHash,
			legalActionHash: choice.legalActionHash,
			policyResultHash: choice.policyResultHash,
			publicIntent: choice.publicIntent,
			initiativeBase: entry.initiativeBase,
			initiativeTieBreak: entry.initiativeTieBreak,
			initiative: entry.initiative,
			outcome,
			fromNodeId,
			toNodeId,
			targetId: null,
			discoveryIds,
			objectiveTransition,
			effectIds: [],
			summary
		});
	}

	const allAtPortal = currentAttempt.party.memberIds.every(
		(actorId) => positions[actorId] === currentAttempt.extractionNodeId
	);
	const carriedAmount = Object.values(portal.cargo).reduce((sum, cargo) => sum + cargo.amount, 0);
	const extractionReady =
		objective.status === 'quota-met' &&
		allAtPortal &&
		carriedAmount >= objective.quota &&
		portal.roundsRemaining > 1;
	if (extractionReady) {
		objective = { ...objective, status: 'delivered', deliveredOnRound: roundNumber };
	}
	const roundsRemainingBefore = portal.roundsRemaining;
	const roundsRemainingAfter = roundsRemainingBefore - 1;
	const pressureAfter = portalPressureStage(
		roundsRemainingAfter,
		portal.warningAtRemainingRounds,
		portal.criticalAtRemainingRounds
	);
	portal = { ...portal, roundsRemaining: roundsRemainingAfter, pressureStage: pressureAfter };
	const collapsed = roundsRemainingAfter === 0 && !extractionReady;
	if (collapsed) portal = appendPortalCargoLosses(currentAttempt, portal, roundNumber, positions);
	const statusAfter = extractionReady ? 'extraction' : collapsed ? 'failure' : 'resolving';
	const oreLedgerEntryIds = portal.oreLedger
		.slice(oreLedgerStart)
		.map((ledgerEntry) => ledgerEntry.entryId);
	const round = MissionRoundV3Schema.parse({
		roundVersion: 'mission-round-v3',
		roundNumber,
		stateVersion: state.version,
		environmentEventIds: activeMissionEnvironmentEvents(state, roundNumber),
		threatIntents: [],
		monsterActionIds: [],
		initiativeOrder: ranked.map((entry) => entry.choice.actorId),
		actions: resolvedActions,
		monsterActions: [],
		effects: [],
		statusAfter,
		portalWindow: {
			roundsRemainingBefore,
			roundsRemainingAfter,
			pressureBefore: currentAttempt.turnState.portal.pressureStage,
			pressureAfter
		},
		oreLedgerEntryIds
	});
	const completedObjectiveIds = extractionReady ? [objective.objectiveId] : [];
	const mission = MissionRunStateV5Schema.parse({
		...state.mission,
		attempt: {
			...currentAttempt,
			status: statusAfter,
			positions,
			knowledge,
			completedObjectiveIds,
			extractionOpenedAt: extractionReady ? state.simulatedAt : null,
			endedAt: collapsed ? state.simulatedAt : null,
			outcome: collapsed ? 'failure' : null,
			turnState: {
				...currentAttempt.turnState,
				roundNumber,
				objective,
				portal,
				rounds: [...currentAttempt.turnState.rounds, round]
			}
		}
	});
	return { mission, round, choices, entropyCursor: entropy.cursor, entropyDraws };
}

export function completePortalMissionExtraction(state: EngineGameStateV15): {
	readonly mission: MissionRunStateV5;
	readonly resourceChanges: readonly PortalResourceChange[];
} {
	const attempt = state.mission.attempt;
	if (
		attempt?.status !== 'extraction' ||
		attempt.turnState.objective.status !== 'delivered' ||
		!attempt.party.memberIds.every(
			(memberId) => attempt.positions[memberId] === attempt.extractionNodeId
		)
	) {
		throw new IllegalActionError('mission.extract');
	}
	let portal = structuredClone(attempt.turnState.portal);
	let settlementAmount = state.settlement.resources['iron-ore'];
	for (const actorId of attempt.party.memberIds) {
		const cargo = portal.cargo[actorId]!;
		if (cargo.amount === 0) continue;
		const entry: PortalOreEntry = {
			entryId: deterministicUuid(
				`${attempt.attemptId}:round:${attempt.turnState.roundNumber}:ore:${portal.oreLedger.length + 1}:extracted`
			),
			sequence: portal.oreLedger.length + 1,
			roundNumber: attempt.turnState.roundNumber,
			kind: 'extracted',
			actorId,
			depositId: null,
			nodeId: attempt.extractionNodeId,
			amount: cargo.amount,
			cargoBefore: cargo.amount,
			cargoAfter: 0,
			depositBefore: null,
			depositAfter: null,
			settlementBefore: settlementAmount,
			settlementAfter: settlementAmount + cargo.amount
		};
		settlementAmount += cargo.amount;
		portal = {
			...portal,
			cargo: { ...portal.cargo, [actorId]: { ...cargo, amount: 0 } },
			oreLedger: [...portal.oreLedger, entry],
			extractedAmount: portal.extractedAmount + cargo.amount,
			extractionCredited: true
		};
	}
	if (portal.extractedAmount < portal.extractionQuota) {
		throw new IllegalActionError('mission.extract');
	}
	const resourceChanges = [
		portalResourceChange({
			resource: 'iron-ore',
			before: state.settlement.resources['iron-ore'],
			after: settlementAmount,
			delta: settlementAmount - state.settlement.resources['iron-ore'],
			reason: 'Iron Moon portal extraction'
		})
	];
	return {
		mission: MissionRunStateV5Schema.parse({
			...state.mission,
			attempt: {
				...attempt,
				status: 'success',
				endedAt: state.simulatedAt,
				outcome: 'success',
				turnState: { ...attempt.turnState, portal }
			}
		}),
		resourceChanges
	};
}
