import {
	CombatResultSchema,
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
	MissionRunStateV9Schema,
	MissionRunStateV10Schema,
	type CombatModeBinding,
	type CombatResult,
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
	type EngineGameStateV25,
	type EngineGameStateV26,
	type EngineGameStateV27,
	type EntropyDraw,
	type MissionRunState,
	type MissionRunStateV2,
	type MissionRunStateV3,
	type MissionRunStateV4,
	type MissionRunStateV5,
	type MissionRunStateV6,
	type MissionRunStateV7,
	type MissionRunStateV8,
	type MissionRunStateV9,
	type MissionRunStateV10
} from '@summonlab/contracts';
import {
	COMBAT_CONTENT_BINDING,
	IRON_MOON_PACKAGE,
	MONSTER_POLICY_CATALOG
} from '@summonlab/content';
import { z } from 'zod';

import { createEntropyCursor } from '../../entropy.js';
import { IllegalActionError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import {
	CombatClaimReceiptSchema,
	parseCombatClaimReceipt,
	type CombatClaimReceipt
} from '../../core/combat-claims.js';
import {
	missionContentForState,
	verifiedMissionBinding,
	verifiedMissionContent
} from '../../core/content-bindings.js';
import { assertLegacyAutoBinding, combatModeAvailability } from './combat-mode.js';
import { spawnMissionCombatants } from './monster-policy.js';
import {
	createMissionReadinessState,
	projectCurrentStateForLegacyResolver,
	restoreCurrentLegacyMission
} from './readiness-runtime.js';

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
	| EngineGameStateV24
	| EngineGameStateV25
	| EngineGameStateV26
	| EngineGameStateV27;
export type MissionEngineRunState =
	| MissionRunState
	| MissionRunStateV2
	| MissionRunStateV3
	| MissionRunStateV4
	| MissionRunStateV5
	| MissionRunStateV6
	| MissionRunStateV7
	| MissionRunStateV8
	| MissionRunStateV9
	| MissionRunStateV10;

export function parseMissionRunState(
	state: MissionEngineState,
	value: unknown
): MissionEngineRunState {
	return state.schemaVersion === 26 || state.schemaVersion === 27
		? MissionRunStateV10Schema.parse(value)
		: state.schemaVersion === 25
			? MissionRunStateV9Schema.parse(value)
			: state.schemaVersion === 24 ||
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

export type MissionHeroReadinessReason =
	| 'ready'
	| 'hero-not-found'
	| 'hero-terminal'
	| 'away-from-threshold'
	| 'active-activity'
	| 'in-transit'
	| 'active-routine'
	| 'active-forging'
	| 'assigned';

export interface MissionHeroReadiness {
	readonly heroId: string;
	readonly ready: boolean;
	readonly reason: MissionHeroReadinessReason;
}

export type MissionPreparationReadinessReason =
	| MissionHeroReadinessReason
	| 'mission-unavailable'
	| 'party-duplicate'
	| 'party-size'
	| 'master-terminal'
	| 'master-away';

export interface MissionPreparationReadiness {
	readonly ready: boolean;
	readonly reason: MissionPreparationReadinessReason;
	readonly blockedHeroId: string | null;
}

export function missionHeroReadiness(
	state: MissionEngineState,
	heroId: string
): MissionHeroReadiness {
	const hero = state.heroes[heroId];
	if (!hero) return { heroId, ready: false, reason: 'hero-not-found' };
	if (hero.lifeState !== 'active') return { heroId, ready: false, reason: 'hero-terminal' };
	if (hero.currentTravel !== null) return { heroId, ready: false, reason: 'in-transit' };
	if (hero.currentActivity !== null) return { heroId, ready: false, reason: 'active-activity' };
	if (hero.currentRoutine !== null) return { heroId, ready: false, reason: 'active-routine' };
	if ('currentForging' in hero && hero.currentForging !== null) {
		return { heroId, ready: false, reason: 'active-forging' };
	}
	if (hero.assignment !== null) return { heroId, ready: false, reason: 'assigned' };
	if (
		hero.location !== 'summoning-gate' ||
		((state.schemaVersion === 25 || state.schemaVersion === 26 || state.schemaVersion === 27) &&
			hero.locationNodeId !== 'gate-dais')
	) {
		return { heroId, ready: false, reason: 'away-from-threshold' };
	}
	return { heroId, ready: true, reason: 'ready' };
}

export function missionPreparationReadiness(
	state: MissionEngineState,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId
): MissionPreparationReadiness {
	const supportsMissionSelection =
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24 ||
		state.schemaVersion === 25 ||
		state.schemaVersion === 26 ||
		state.schemaVersion === 27;
	if (
		(!supportsMissionSelection && missionId !== state.mission.binding.missionId) ||
		(supportsMissionSelection && !state.mission.availableMissionIds.includes(missionId))
	) {
		return { ready: false, reason: 'mission-unavailable', blockedHeroId: null };
	}
	const mission = verifiedMissionContent(missionId);
	const normalized = normalizedMissionHeroIds(heroIds);
	if (new Set(normalized).size !== normalized.length) {
		return { ready: false, reason: 'party-duplicate', blockedHeroId: null };
	}
	const partySize = normalized.length + 1;
	if (
		partySize < mission.deployment.minimumPartyMembers ||
		partySize > mission.deployment.maximumPartyMembers
	) {
		return { ready: false, reason: 'party-size', blockedHeroId: null };
	}
	if (state.master.lifeState !== 'alive') {
		return { ready: false, reason: 'master-terminal', blockedHeroId: null };
	}
	if (state.master.location !== 'summoning-gate') {
		return { ready: false, reason: 'master-away', blockedHeroId: null };
	}
	for (const heroId of normalized) {
		const readiness = missionHeroReadiness(state, heroId);
		if (!readiness.ready) {
			return { ready: false, reason: readiness.reason, blockedHeroId: heroId };
		}
	}
	return { ready: true, reason: 'ready', blockedHeroId: null };
}

export function assertMissionPartyReady(
	state: MissionEngineState,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId
): void {
	if (!missionPreparationReadiness(state, heroIds, missionId).ready) {
		throw new IllegalActionError('mission.party');
	}
}

function prepareV26MissionAttempt(
	state: EngineGameStateV26 | EngineGameStateV27,
	commandId: string,
	heroIds: readonly string[],
	missionId: string,
	combatModeBinding: CombatModeBinding
): MissionRunStateV10 {
	if (combatModeBinding.boundAt !== state.simulatedAt)
		throw new IllegalActionError('mission.prepare');
	const availability = combatModeAvailability(combatModeBinding, state.schemaVersion);
	if (availability.status !== 'available') throw new IllegalActionError('mission.prepare');
	const structural = prepareMissionAttempt(
		projectCurrentStateForLegacyResolver(state),
		commandId,
		heroIds,
		missionId,
		{
			...combatModeBinding,
			modeId: 'legacy-auto-v1',
			rulesVersion: 'legacy-auto-rules-v1',
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		}
	);
	const attempt = structural.attempt as NonNullable<EngineGameStateV25['mission']['attempt']>;
	const baseAttempt = Object.fromEntries(
		Object.entries(attempt).filter(([key]) => key !== 'turnState' && key !== 'combatModeBinding')
	);
	return MissionRunStateV10Schema.parse({
		...structural,
		attempt: {
			...baseAttempt,
			combatModeBinding,
			combatState:
				combatModeBinding.modeId === 'legacy-auto-v1'
					? { modeId: 'legacy-auto-v1', turnState: attempt.turnState }
					: {
							modeId: 'agent-readiness-v1',
							readinessState: createMissionReadinessState(
								state,
								attempt.attemptId,
								heroIds,
								missionId,
								combatModeBinding.rulesVersion
							)
						}
		}
	});
}

export function prepareMissionAttempt(
	state: MissionEngineState,
	commandId: string,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId,
	combatModeBinding?: CombatModeBinding
): MissionEngineRunState {
	if (state.schemaVersion === 26 || state.schemaVersion === 27) {
		if (!combatModeBinding) throw new IllegalActionError('mission.prepare');
		return prepareV26MissionAttempt(state, commandId, heroIds, missionId, combatModeBinding);
	}
	if (state.schemaVersion === 25) {
		if (!combatModeBinding || combatModeBinding.boundAt !== state.simulatedAt) {
			throw new IllegalActionError('mission.prepare');
		}
		assertLegacyAutoBinding(combatModeBinding);
	} else if (combatModeBinding) {
		throw new IllegalActionError('mission.prepare');
	}
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
				state.schemaVersion === 24 ||
				state.schemaVersion === 25) &&
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
		state.schemaVersion === 24 ||
		state.schemaVersion === 25
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
										...(state.schemaVersion === 25
											? {
													combatModeBinding: state.mission.attempt!.combatModeBinding
												}
											: {}),
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
			...(state.schemaVersion === 25 ? { combatModeBinding } : {}),
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
						  state.schemaVersion === 24 ||
						  state.schemaVersion === 25
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
	if (state.schemaVersion === 26 || state.schemaVersion === 27) {
		const currentAttempt = state.mission.attempt!;
		if (currentAttempt.combatState.modeId === 'agent-readiness-v1') {
			return MissionRunStateV10Schema.parse({
				...state.mission,
				attempt: {
					...currentAttempt,
					party: {
						masterId: state.master.masterId,
						heroIds: normalized,
						memberIds: [state.master.masterId, ...normalized]
					},
					combatState: {
						modeId: 'agent-readiness-v1',
						readinessState: createMissionReadinessState(
							state,
							currentAttempt.attemptId,
							normalized,
							state.mission.binding.missionId,
							currentAttempt.combatModeBinding.rulesVersion
						)
					}
				}
			});
		}
		const revised = reviseMissionParty(
			projectCurrentStateForLegacyResolver(state),
			normalized
		) as MissionRunStateV9;
		return restoreCurrentLegacyMission(state, revised);
	}
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
			state.schemaVersion === 24 ||
			state.schemaVersion === 25
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
	if (state.schemaVersion === 26 || state.schemaVersion === 27) {
		const currentAttempt = state.mission.attempt!;
		if (currentAttempt.combatState.modeId === 'legacy-auto-v1') {
			const deployed = deployMissionAttempt(projectCurrentStateForLegacyResolver(state));
			const mission = deployed.mission as MissionRunStateV9;
			return {
				...deployed,
				mission: restoreCurrentLegacyMission(state, mission)
			};
		}
		const positions = Object.fromEntries(
			currentAttempt.party.memberIds.map((memberId) => [memberId, currentAttempt.entryNodeId])
		);
		return {
			mission: MissionRunStateV10Schema.parse({
				...state.mission,
				attempt: {
					...currentAttempt,
					status: 'deployed',
					positions,
					knowledge: { discoveryIds: [], visitedNodeIds: [currentAttempt.entryNodeId] },
					deployedAt: state.simulatedAt
				}
			}),
			entropyCursor: state.entropyCursor,
			entropyDraws: []
		};
	}
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
		state.schemaVersion === 24 ||
		state.schemaVersion === 25
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
							state.schemaVersion === 24 ||
							state.schemaVersion === 25
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

export interface CombatMissionClaimCombatantSeed {
	readonly health: number;
	readonly mana: number;
	readonly maximumHealth: number;
	readonly maximumMana: number;
	readonly downed: boolean;
	readonly lost: boolean;
	readonly injuryIds: readonly string[];
}

export type CombatMissionClaimCombatantState = CombatMissionClaimCombatantSeed;

/** Ephemeral claim transition projection; canonical mission/aftermath state remains authoritative. */
export interface CombatMissionClaimProjection {
	readonly combatants: Readonly<Record<string, CombatMissionClaimCombatantState>>;
	readonly harm: Readonly<
		Record<string, { readonly damageTaken: number; readonly downed: boolean }>
	>;
	readonly recoveries: Readonly<Record<string, { readonly minimumSafeHealth: number }>>;
	readonly loot: Readonly<Record<string, Readonly<Record<string, number>>>>;
	readonly objectives: Readonly<Record<string, boolean>>;
	readonly attempts: Readonly<
		Record<
			string,
			{
				readonly outcome: CombatResult['outcome'];
				readonly modeId: CombatResult['modeId'];
				readonly rulesVersion: string;
				readonly traceHash: string;
			}
		>
	>;
	readonly receipts: Readonly<Record<string, CombatClaimReceipt>>;
}

const SafeCountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const CombatMissionClaimCombatantStateSchema = z
	.object({
		health: SafeCountSchema,
		mana: SafeCountSchema,
		maximumHealth: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		maximumMana: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
		downed: z.boolean(),
		lost: z.boolean(),
		injuryIds: z.array(z.string().trim().min(1).max(120)).max(1_000)
	})
	.strict()
	.superRefine((combatant, context) => {
		if (combatant.health > combatant.maximumHealth || combatant.mana > combatant.maximumMana) {
			context.addIssue({
				code: 'custom',
				message: 'Combat projection resources exceed their caps'
			});
		}
		if ((combatant.health === 0) !== combatant.downed || (combatant.lost && !combatant.downed)) {
			context.addIssue({ code: 'custom', message: 'Combat projection life state is inconsistent' });
		}
		if (new Set(combatant.injuryIds).size !== combatant.injuryIds.length) {
			context.addIssue({ code: 'custom', message: 'Combat projection injuries must be unique' });
		}
	});

export const CombatMissionClaimProjectionSchema = z
	.object({
		combatants: z.record(z.string().uuid(), CombatMissionClaimCombatantStateSchema),
		harm: z.record(
			z.string().uuid(),
			z.object({ damageTaken: SafeCountSchema, downed: z.boolean() }).strict()
		),
		recoveries: z.record(
			z.string().uuid(),
			z.object({ minimumSafeHealth: z.number().int().positive() }).strict()
		),
		loot: z.record(
			z.string().uuid(),
			z.record(z.string().trim().min(1).max(120), z.number().int().positive())
		),
		objectives: z.record(z.string().trim().min(1).max(120), z.boolean()),
		attempts: z.record(
			z.string().uuid(),
			z
				.object({
					outcome: z.enum([
						'victory',
						'extraction',
						'retreat',
						'party-downed',
						'death',
						'deadline',
						'safety-stop'
					]),
					modeId: z.enum(['legacy-auto-v1', 'agent-readiness-v1']),
					rulesVersion: z.string().trim().min(1).max(80),
					traceHash: HashSchema
				})
				.strict()
		),
		receipts: z.record(z.string().trim().min(1).max(240), CombatClaimReceiptSchema)
	})
	.strict()
	.superRefine((projection, context) => {
		for (const [key, receiptInput] of Object.entries(projection.receipts)) {
			const receipt = parseCombatClaimReceipt(receiptInput);
			if (receipt.idempotencyKey !== key || receipt.owner !== 'mission-aftermath') {
				context.addIssue({
					code: 'custom',
					path: ['receipts', key],
					message: 'Mission combat claim receipt key or owner is inconsistent'
				});
			}
		}
	});

export function parseCombatMissionClaimProjection(input: unknown): CombatMissionClaimProjection {
	return CombatMissionClaimProjectionSchema.parse(input);
}

export function createCombatMissionClaimProjection(
	combatants: Readonly<Record<string, CombatMissionClaimCombatantSeed>>
): CombatMissionClaimProjection {
	return parseCombatMissionClaimProjection({
		combatants: Object.fromEntries(
			Object.entries(combatants).map(([combatantId, combatant]) => [
				combatantId,
				{
					...combatant,
					injuryIds: [...combatant.injuryIds]
				}
			])
		),
		harm: {},
		recoveries: {},
		loot: {},
		objectives: {},
		attempts: {},
		receipts: {}
	});
}

export interface CombatMissionAttemptTransition {
	readonly status: 'success' | 'retreat' | 'failure';
	readonly outcome: 'success' | 'retreat' | 'failure';
	readonly cause: CombatResult['outcome'];
	readonly authoredFailure: boolean;
}

/** Keeps engine safety termination visibly distinct from authored encounter failure. */
export function missionAttemptTransitionForCombatResult(
	resultInput: CombatResult
): CombatMissionAttemptTransition {
	const result = CombatResultSchema.parse(resultInput);
	if (result.outcome === 'victory' || result.outcome === 'extraction') {
		return { status: 'success', outcome: 'success', cause: result.outcome, authoredFailure: false };
	}
	if (result.outcome === 'retreat') {
		return { status: 'retreat', outcome: 'retreat', cause: result.outcome, authoredFailure: false };
	}
	if (result.outcome === 'safety-stop' && result.safetyStop?.disposition === 'forced-retreat') {
		return { status: 'retreat', outcome: 'retreat', cause: result.outcome, authoredFailure: false };
	}
	return {
		status: 'failure',
		outcome: 'failure',
		cause: result.outcome,
		authoredFailure: ['deadline', 'party-downed', 'death'].includes(result.outcome)
	};
}
