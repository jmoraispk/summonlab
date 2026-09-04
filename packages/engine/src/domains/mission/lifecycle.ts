import {
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
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
	type EngineGameStateV22,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type EntropyDraw,
	type MissionRunState,
	type MissionRunStateV2,
	type MissionRunStateV3,
	type MissionRunStateV4,
	type MissionRunStateV5,
	type MissionRunStateV6,
	type MissionRunStateV7,
	type MissionRunStateV8
} from '@summonlab/contracts';
import { IRON_MOON_PACKAGE, MONSTER_POLICY_CATALOG } from '@summonlab/content';

import { createEntropyCursor } from '../../entropy.js';
import { IllegalActionError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import {
	missionContentForState,
	verifiedMissionBinding,
	verifiedMissionContent
} from '../../core/content-bindings.js';
import { spawnMissionCombatants } from './monster-policy.js';

type PortalAttempt = NonNullable<EngineGameStateV15['mission']['attempt']>;
type PortalRuntime = PortalAttempt['turnState']['portal'];

export type AppendPortalCargoLosses = (
	attempt: PortalAttempt,
	portalInput: PortalRuntime,
	roundNumber: number,
	positions?: Readonly<Record<string, string>>
) => PortalRuntime;

const ACTIVE_MISSION_STATUSES = new Set(['preparing', 'deployed', 'resolving', 'extraction']);

export type MissionEngineState =
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
	| EngineGameStateV21
	| EngineGameStateV22
	| EngineGameStateV23
	| EngineGameStateV24;
export type MissionEngineRunState =
	| MissionRunState
	| MissionRunStateV2
	| MissionRunStateV3
	| MissionRunStateV4
	| MissionRunStateV5
	| MissionRunStateV6
	| MissionRunStateV7
	| MissionRunStateV8;

export function parseMissionRunState(
	state: MissionEngineState,
	value: unknown
): MissionEngineRunState {
	return state.schemaVersion === 24 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 22 ||
		state.schemaVersion === 21 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 18
		? MissionRunStateV8Schema.parse(value)
		: state.schemaVersion === 17
			? MissionRunStateV7Schema.parse(value)
			: state.schemaVersion === 16
				? MissionRunStateV6Schema.parse(value)
				: state.schemaVersion === 15
					? MissionRunStateV5Schema.parse(value)
					: state.schemaVersion === 14
						? MissionRunStateV4Schema.parse(value)
						: state.schemaVersion === 13
							? MissionRunStateV3Schema.parse(value)
							: state.schemaVersion === 12
								? MissionRunStateV2Schema.parse(value)
								: MissionRunStateSchema.parse(value);
}

export function missionPartyIsReserved(state: MissionEngineState, actorId: string): boolean {
	const attempt = state.mission.attempt;
	return Boolean(
		attempt &&
		ACTIVE_MISSION_STATUSES.has(attempt.status) &&
		attempt.party.memberIds.includes(actorId)
	);
}

export function normalizedMissionHeroIds(heroIds: readonly string[]): string[] {
	return [...heroIds].sort((left, right) => left.localeCompare(right));
}

export function assertMissionPartyReady(
	state: MissionEngineState | EngineGameStateV24,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId
): void {
	if (
		state.schemaVersion !== 14 &&
		state.schemaVersion !== 15 &&
		state.schemaVersion !== 16 &&
		state.schemaVersion !== 17 &&
		state.schemaVersion !== 18 &&
		state.schemaVersion !== 19 &&
		state.schemaVersion !== 20 &&
		state.schemaVersion !== 23 &&
		state.schemaVersion !== 24 &&
		missionId !== state.mission.binding.missionId
	) {
		throw new IllegalActionError('mission.party');
	}
	if (
		(state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23 ||
			state.schemaVersion === 24) &&
		!state.mission.availableMissionIds.includes(missionId)
	) {
		throw new IllegalActionError('mission.party');
	}
	const mission = verifiedMissionContent(missionId);
	const normalized = normalizedMissionHeroIds(heroIds);
	const partySize = normalized.length + 1;
	if (
		new Set(normalized).size !== normalized.length ||
		partySize < mission.deployment.minimumPartyMembers ||
		partySize > mission.deployment.maximumPartyMembers ||
		state.master.lifeState !== 'alive' ||
		state.master.location !== 'summoning-gate'
	) {
		throw new IllegalActionError('mission.party');
	}
	for (const heroId of normalized) {
		const hero = state.heroes[heroId];
		if (
			!hero ||
			hero.lifeState !== 'active' ||
			hero.location !== 'summoning-gate' ||
			hero.currentActivity !== null ||
			hero.currentTravel !== null ||
			hero.currentRoutine !== null ||
			('currentForging' in hero && hero.currentForging !== null) ||
			hero.assignment !== null
		) {
			throw new IllegalActionError('mission.party');
		}
	}
}

export function prepareMissionAttempt(
	state: MissionEngineState,
	commandId: string,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId
): MissionEngineRunState {
	assertMissionPartyReady(state, heroIds, missionId);
	const prior = state.mission.attempt;
	if (
		prior &&
		!['canceled', 'retreat', 'failure', 'death'].includes(prior.status) &&
		!(
			(state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23 ||
				state.schemaVersion === 24) &&
			prior.status === 'success'
		)
	) {
		throw new IllegalActionError('mission.prepare');
	}
	const mission = verifiedMissionContent(missionId);
	const normalized = normalizedMissionHeroIds(heroIds);
	const ordinal = state.mission.attemptCount + 1;
	const attemptId = deterministicUuid(`${commandId}:mission-attempt:${ordinal}`);
	return parseMissionRunState(state, {
		...state.mission,
		binding: verifiedMissionBinding(missionId),
		...(state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24
			? {
					aftermath: {
						...state.mission.aftermath,
						activeAttemptId: attemptId,
						consequences: [],
						archives: prior
							? [
									...state.mission.aftermath.archives,
									{
										attemptId: prior.attemptId,
										ordinal: prior.ordinal,
										binding: state.mission.binding,
										outcome: prior.outcome!,
										preparedAt: prior.preparedAt,
										deployedAt: prior.deployedAt,
										endedAt: prior.endedAt!,
										finalRoundNumber: state.mission.attempt!.turnState.roundNumber,
										consequences: state.mission.aftermath.consequences
									}
								]
							: state.mission.aftermath.archives
					}
				}
			: {}),
		attemptCount: ordinal,
		attempt: {
			attemptId,
			ordinal,
			status: 'preparing',
			party: {
				masterId: state.master.masterId,
				heroIds: normalized,
				memberIds: [state.master.masterId, ...normalized]
			},
			entryNodeId: mission.deployment.entryNodeIds[0]!,
			extractionNodeId: mission.deployment.extractionNodeIds[0]!,
			positions: {},
			knowledge: { discoveryIds: [], visitedNodeIds: [] },
			completedObjectiveIds: [],
			preparedAt: state.simulatedAt,
			deployedAt: null,
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			...(state.schemaVersion === 15
				? {
						turnState: {
							turnVersion: 'mission-turn-v3',
							maximumRounds: IRON_MOON_PACKAGE.portal.durationRounds,
							roundNumber: 0,
							objective: {
								objectiveId: mission.objectives.find((objective) => objective.primary)!.objectiveId,
								status: 'available',
								quota: IRON_MOON_PACKAGE.portal.extractionQuota,
								minedAmount: 0,
								quotaReachedOnRound: null,
								deliveredOnRound: null
							},
							policyBinding: {
								contentVersion: MONSTER_POLICY_CATALOG.contentVersion,
								contentHash: MONSTER_POLICY_CATALOG.contentHash
							},
							monsters: {},
							partyGuard: Object.fromEntries(
								[state.master.masterId, ...normalized].map((actorId) => [
									actorId,
									{
										actorId,
										guard: 3,
										maximumGuard: 3,
										status: 'ready',
										lastChangedOnRound: 0
									}
								])
							),
							arena: {
								furnaceState: 'absent',
								coolingControlNodeId: null,
								coolingControlExposed: false
							},
							currentThreatIntents: [],
							portal: {
								portalVersion: 'portal-runtime-v1',
								portalId: IRON_MOON_PACKAGE.portal.portalId,
								durationRounds: IRON_MOON_PACKAGE.portal.durationRounds,
								roundsRemaining: IRON_MOON_PACKAGE.portal.durationRounds,
								warningAtRemainingRounds: IRON_MOON_PACKAGE.portal.warningAtRemainingRounds,
								criticalAtRemainingRounds: IRON_MOON_PACKAGE.portal.criticalAtRemainingRounds,
								pressureStage: 'stable',
								extractionQuota: IRON_MOON_PACKAGE.portal.extractionQuota,
								cargoCapacityPerActor: IRON_MOON_PACKAGE.portal.cargoCapacityPerActor,
								deposits: Object.fromEntries(
									IRON_MOON_PACKAGE.portal.deposits.map((deposit) => [
										deposit.depositId,
										{
											...deposit,
											remainingAmount: deposit.initialAmount
										}
									])
								),
								cargo: Object.fromEntries(
									[state.master.masterId, ...normalized].map((actorId) => [
										actorId,
										{
											actorId,
											resource: 'iron-ore',
											amount: 0,
											capacity: IRON_MOON_PACKAGE.portal.cargoCapacityPerActor
										}
									])
								),
								oreLedger: [],
								extractedAmount: 0,
								extractionCredited: false
							},
							rounds: []
						}
					}
				: state.schemaVersion === 12
					? {
							turnState: {
								turnVersion: 'mission-turn-v1',
								maximumRounds: 48,
								roundNumber: 0,
								objective: {
									objectiveId: mission.objectives.find((objective) => objective.primary)!
										.objectiveId,
									status: 'available',
									carrierId: null,
									recoveredOnRound: null,
									deliveredOnRound: null
								},
								rounds: []
							}
						}
					: state.schemaVersion === 13 ||
						  state.schemaVersion === 14 ||
						  state.schemaVersion === 16 ||
						  state.schemaVersion === 17 ||
						  state.schemaVersion === 18 ||
						  state.schemaVersion === 19 ||
						  state.schemaVersion === 20 ||
						  state.schemaVersion === 23 ||
						  state.schemaVersion === 24
						? {
								turnState: {
									turnVersion: 'mission-turn-v2',
									maximumRounds: 48,
									roundNumber: 0,
									objective: {
										objectiveId: mission.objectives.find((objective) => objective.primary)!
											.objectiveId,
										status: 'available',
										carrierId: null,
										recoveredOnRound: null,
										deliveredOnRound: null
									},
									policyBinding: {
										contentVersion: MONSTER_POLICY_CATALOG.contentVersion,
										contentHash: MONSTER_POLICY_CATALOG.contentHash
									},
									monsters: {},
									partyGuard: Object.fromEntries(
										[state.master.masterId, ...normalized].map((actorId) => [
											actorId,
											{
												actorId,
												guard: 3,
												maximumGuard: 3,
												status: 'ready',
												lastChangedOnRound: 0
											}
										])
									),
									arena: {
										furnaceState: mission.missionId === 'tower-floor-05' ? 'lit' : 'absent',
										coolingControlNodeId:
											mission.missionId === 'tower-floor-05' ? 'cooling-control' : null,
										coolingControlExposed: false
									},
									currentThreatIntents: [],
									rounds: []
								}
							}
						: {})
		}
	});
}

export function reviseMissionParty(
	state: MissionEngineState,
	heroIds: readonly string[]
): MissionEngineRunState {
	const attempt = state.mission.attempt;
	if (attempt?.status !== 'preparing') throw new IllegalActionError('mission.revise.party');
	assertMissionPartyReady(state, heroIds);
	const normalized = normalizedMissionHeroIds(heroIds);
	return parseMissionRunState(state, {
		...state.mission,
		attempt: {
			...attempt,
			party: {
				masterId: state.master.masterId,
				heroIds: normalized,
				memberIds: [state.master.masterId, ...normalized]
			},
			...(state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23 ||
			state.schemaVersion === 24
				? {
						turnState: {
							...state.mission.attempt!.turnState,
							partyGuard: Object.fromEntries(
								[state.master.masterId, ...normalized].map((actorId) => [
									actorId,
									state.mission.attempt!.turnState.partyGuard[actorId] ?? {
										actorId,
										guard: 3,
										maximumGuard: 3,
										status: 'ready',
										lastChangedOnRound: 0
									}
								])
							),
							...(state.schemaVersion === 15
								? {
										portal: {
											...state.mission.attempt!.turnState.portal,
											cargo: Object.fromEntries(
												[state.master.masterId, ...normalized].map((actorId) => [
													actorId,
													state.mission.attempt!.turnState.portal.cargo[actorId] ?? {
														actorId,
														resource: 'iron-ore',
														amount: 0,
														capacity: state.mission.attempt!.turnState.portal.cargoCapacityPerActor
													}
												])
											)
										}
									}
								: {})
						}
					}
				: {})
		}
	});
}

export function cancelMissionPreparation(state: MissionEngineState): MissionEngineRunState {
	const attempt = state.mission.attempt;
	if (attempt?.status !== 'preparing') throw new IllegalActionError('mission.cancel');
	return parseMissionRunState(state, {
		...state.mission,
		attempt: { ...attempt, status: 'canceled', endedAt: state.simulatedAt, outcome: 'canceled' }
	});
}

export type MissionDeploymentResolution = {
	readonly mission: MissionEngineRunState;
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
};

export function deployMissionAttempt(state: MissionEngineState): MissionDeploymentResolution {
	const attempt = state.mission.attempt;
	if (attempt?.status !== 'preparing') throw new IllegalActionError('mission.deploy');
	assertMissionPartyReady(state, attempt.party.heroIds);
	const positions = Object.fromEntries(
		attempt.party.memberIds.map((memberId) => [memberId, attempt.entryNodeId])
	);
	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const combat =
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24
			? spawnMissionCombatants(state, state.mission.attempt!, positions, entropy)
			: null;
	if (combat) entropy = combat.entropy;
	const entropyDraws = combat ? [...combat.entropyDraws] : [];
	const mission = parseMissionRunState(state, {
		...state.mission,
		attempt: {
			...attempt,
			status: 'deployed',
			positions,
			knowledge: { discoveryIds: [], visitedNodeIds: [attempt.entryNodeId] },
			deployedAt: state.simulatedAt,
			...(combat
				? {
						turnState: {
							...(state.schemaVersion === 13 ||
							state.schemaVersion === 14 ||
							state.schemaVersion === 16 ||
							state.schemaVersion === 17 ||
							state.schemaVersion === 18 ||
							state.schemaVersion === 19 ||
							state.schemaVersion === 20 ||
							state.schemaVersion === 23 ||
							state.schemaVersion === 24
								? state.mission.attempt!.turnState
								: {}),
							monsters: combat.monsters,
							currentThreatIntents: combat.threatIntents
						}
					}
				: {})
		}
	});
	return { mission, entropyCursor: entropy.cursor, entropyDraws };
}

export function openMissionExtraction(
	state: EngineGameStateV11,
	completedObjectiveIds: readonly string[]
): MissionRunState {
	const attempt = state.mission.attempt;
	if (!attempt || !['deployed', 'resolving'].includes(attempt.status)) {
		throw new IllegalActionError('mission.open.extraction');
	}
	const mission = missionContentForState(state);
	const declaredIds = new Set(mission.objectives.map((objective) => objective.objectiveId));
	const normalized = [...completedObjectiveIds].sort((left, right) => left.localeCompare(right));
	const primaryIds = mission.objectives
		.filter((objective) => objective.primary)
		.map((objective) => objective.objectiveId);
	if (
		new Set(normalized).size !== normalized.length ||
		normalized.some((objectiveId) => !declaredIds.has(objectiveId)) ||
		primaryIds.some((objectiveId) => !normalized.includes(objectiveId))
	) {
		throw new IllegalActionError('mission.open.extraction');
	}
	return MissionRunStateSchema.parse({
		...state.mission,
		attempt: {
			...attempt,
			status: 'extraction',
			completedObjectiveIds: normalized,
			extractionOpenedAt: state.simulatedAt
		}
	});
}

export function allPartyAtNode(state: MissionEngineState, nodeIds: readonly string[]): boolean {
	const attempt = state.mission.attempt;
	return Boolean(
		attempt &&
		attempt.party.memberIds.every((memberId) => nodeIds.includes(attempt.positions[memberId]!))
	);
}

export function completeMissionExtraction(state: MissionEngineState): MissionEngineRunState {
	const attempt = state.mission.attempt;
	const mission = missionContentForState(state);
	const primaryIds = mission.objectives
		.filter((objective) => objective.primary)
		.map((objective) => objective.objectiveId);
	if (
		attempt?.status !== 'extraction' ||
		primaryIds.some((objectiveId) => !attempt.completedObjectiveIds.includes(objectiveId)) ||
		!allPartyAtNode(state, [attempt.extractionNodeId])
	) {
		throw new IllegalActionError('mission.extract');
	}
	return parseMissionRunState(state, {
		...state.mission,
		attempt: { ...attempt, status: 'success', endedAt: state.simulatedAt, outcome: 'success' }
	});
}

export function retreatMissionAttempt(
	state: MissionEngineState,
	appendCargoLosses?: AppendPortalCargoLosses
): MissionEngineRunState {
	const attempt = state.mission.attempt;
	const mission = missionContentForState(state);
	if (
		!attempt ||
		!['deployed', 'resolving', 'extraction'].includes(attempt.status) ||
		!allPartyAtNode(state, mission.retreat.nodeIds)
	) {
		throw new IllegalActionError('mission.retreat');
	}
	if (state.schemaVersion === 15) {
		const portalAttempt = state.mission.attempt!;
		if (!appendCargoLosses) throw new Error('Portal retreat requires cargo-loss derivation');
		const portal = appendCargoLosses(
			portalAttempt,
			portalAttempt.turnState.portal,
			Math.max(1, portalAttempt.turnState.roundNumber)
		);
		return MissionRunStateV5Schema.parse({
			...state.mission,
			attempt: {
				...portalAttempt,
				status: 'retreat',
				endedAt: state.simulatedAt,
				outcome: 'retreat',
				turnState: { ...portalAttempt.turnState, portal }
			}
		});
	}
	return parseMissionRunState(state, {
		...state.mission,
		attempt: { ...attempt, status: 'retreat', endedAt: state.simulatedAt, outcome: 'retreat' }
	});
}
