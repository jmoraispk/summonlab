import {
	AuthoritativeEventSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type EngineGameStateV27,
	type EntropyDraw,
	type MissionRunStateV3,
	type MissionRunStateV4,
	type MissionRunStateV6,
	type MissionRunStateV7,
	type MissionRunStateV8,
	type MissionRunStateV9
} from '@summonlab/contracts';

import { emptyMetadata, eventBase } from '../../core/event-metadata.js';
import type { EngineCommandHandler } from '../../core/types.js';
import { IllegalActionError } from '../../errors.js';
import { hashCanonical } from '../../hash.js';
import { buildCombatExperienceOutcomes } from '../progression/combat-experience.js';
import { normalizedMissionTurnChoices } from './actions.js';
import { resolveMissionCombatTurn, resolveMissionTurn } from './combat.js';
import { buildMissionEquipmentDrop } from './equipment-drop.js';
import {
	cancelMissionPreparation,
	completeMissionExtraction,
	deployMissionAttempt,
	normalizedMissionHeroIds,
	openMissionExtraction,
	prepareMissionAttempt,
	retreatMissionAttempt,
	reviseMissionParty,
	type MissionEngineRunState
} from './lifecycle.js';
import {
	applyMasterSafetyStop,
	configureMasterFallback,
	configureMasterTiming,
	configureMasterTimingV2,
	endMasterDecision,
	endMasterDecisionV2,
	masterDecisionWindow,
	masterDecisionWindowV2,
	masterFallbackMissionChoice,
	resolveMasterDecision,
	resolveMasterDecisionV2
} from './master-control.js';
import {
	appendPortalCargoLosses,
	completePortalMissionExtraction,
	resolvePortalMissionTurn,
	type PortalResourceChange
} from './portal.js';
import {
	assertMissionModeAdvanceAvailable,
	resolveMissionModeTurn
} from './mission-mode-runner.js';

export const MISSION_COMMAND_TYPES = [
	'master.configure.timing',
	'master.configure.fallback',
	'master.apply.safety-stop',
	'master.open.decision',
	'mission.prepare',
	'mission.revise.party',
	'mission.cancel',
	'mission.deploy',
	'mission.resolve.turn',
	'mission.advance.automatic',
	'mission.open.extraction',
	'mission.extract',
	'mission.retreat'
] as const;

export type MissionCommand = Extract<
	EngineCommand,
	{ commandType: (typeof MISSION_COMMAND_TYPES)[number] }
>;

export interface FirstBandMissionCommandConsequences {
	readonly bandStory: EngineGameStateV23['bandStory'];
	readonly firstBandArchive: EngineGameStateV23['firstBandArchive'];
}

export type BuildFirstBandMissionCommandConsequences = (
	state: EngineGameStateV23 | EngineGameStateV24,
	eventId: string,
	transition: Exclude<MissionTransition, 'open-extraction'>,
	mission: MissionRunStateV8
) => FirstBandMissionCommandConsequences;

export interface MissionCommandHandler extends EngineCommandHandler<MissionCommand> {
	buildEvent(
		state: EngineGameState,
		command: MissionCommand,
		buildFirstBandConsequences?: BuildFirstBandMissionCommandConsequences
	): AuthoritativeEvent;
}

type MissionTransition =
	'prepare' | 'revise-party' | 'cancel' | 'deploy' | 'open-extraction' | 'extract' | 'retreat';

function assertMissionCommandLegal(state: EngineGameState, command: MissionCommand): void {
	if (
		command.commandType === 'master.configure.timing' ||
		command.commandType === 'master.open.decision' ||
		command.commandType === 'master.configure.fallback' ||
		command.commandType === 'master.apply.safety-stop'
	) {
		if (
			(state.schemaVersion !== 19 && state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		if (
			command.commandType === 'master.configure.timing' ||
			command.commandType === 'master.configure.fallback' ||
			command.commandType === 'master.open.decision'
		) {
			if (command.source.source !== 'manual' || command.source.timing !== 'step') {
				throw new IllegalActionError(command.commandType, []);
			}
			if (
				state.masterControl.activeDecision &&
				Date.parse(command.observedAt) < Date.parse(state.masterControl.activeDecision.openedAt)
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			if (command.commandType === 'master.configure.timing') {
				if (state.schemaVersion === 20) {
					configureMasterTimingV2(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					);
				} else {
					configureMasterTiming(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					);
				}
			} else if (command.commandType === 'master.configure.fallback') {
				if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType, []);
				configureMasterFallback(state.masterControl, command);
			} else if (state.schemaVersion === 20) {
				masterDecisionWindowV2(state.masterControl, command.commandId, command.observedAt);
			} else {
				masterDecisionWindow(state.masterControl, command.commandId, command.observedAt);
			}
		} else {
			if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType, []);
			const active = state.masterControl.activeDecision;
			if (
				!active ||
				command.decisionId !== active.decisionId ||
				command.source.source !== 'system' ||
				command.source.timing !== active.timing ||
				command.source.fallbackPolicy !== active.fallback.policy
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			applyMasterSafetyStop(
				state,
				command.commandId,
				command.decisionId,
				command.observedAt,
				command.source
			);
		}
		return;
	}
	if (
		(state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 15 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20 &&
			state.schemaVersion !== 23 &&
			state.schemaVersion !== 24 &&
			state.schemaVersion !== 25 &&
			state.schemaVersion !== 26 &&
			state.schemaVersion !== 27) ||
		state.status !== 'active' ||
		state.master.lifeState !== 'alive' ||
		command.actorId !== state.master.masterId
	) {
		throw new IllegalActionError(command.commandType, []);
	}
	if (command.commandType === 'mission.open.extraction') {
		if (
			state.schemaVersion !== 11 ||
			command.source.source !== 'system' ||
			command.source.timing !== null
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		openMissionExtraction(state, command.completedObjectiveIds);
		return;
	}
	if (command.commandType === 'mission.resolve.turn') {
		if (
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 15 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20 &&
			state.schemaVersion !== 23 &&
			state.schemaVersion !== 24
		)
			throw new IllegalActionError(command.commandType, []);
		const choices = normalizedMissionTurnChoices(state, command.choices);
		if (state.schemaVersion === 19 || state.schemaVersion === 20) {
			const masterChoice = choices.find((choice) => choice.actorId === state.master.masterId);
			if (!masterChoice || !command.decisionId || !command.resolvedAt) {
				throw new IllegalActionError(command.commandType, []);
			}
			if ((command.source.source === 'manual') !== (masterChoice.source === 'manual')) {
				throw new IllegalActionError(command.commandType, []);
			}
			if (state.schemaVersion === 20) {
				const expected =
					command.source.source === 'manual' ? null : masterFallbackMissionChoice(state);
				if (expected && hashCanonical(expected) !== hashCanonical(masterChoice)) {
					throw new IllegalActionError(command.commandType, []);
				}
				resolveMasterDecisionV2(
					state,
					command.commandId,
					command.decisionId,
					command.resolvedAt,
					masterChoice.actionId,
					command.source,
					false
				);
			} else {
				resolveMasterDecision(
					state.masterControl,
					command.commandId,
					command.decisionId,
					command.resolvedAt,
					masterChoice.actionId,
					command.source,
					false
				);
			}
		} else if (command.source.source !== 'manual' || command.source.timing !== 'step') {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (command.commandType === 'mission.advance.automatic') {
		if (
			(state.schemaVersion !== 25 && state.schemaVersion !== 26 && state.schemaVersion !== 27) ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		assertMissionModeAdvanceAvailable(state);
		return;
	}
	if (command.source.source !== 'manual' || command.source.timing !== 'step') {
		throw new IllegalActionError(command.commandType, []);
	}

	if (
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
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
		state.schemaVersion === 25 ||
		state.schemaVersion === 26 ||
		state.schemaVersion === 27
	) {
		if (command.commandType === 'mission.prepare')
			prepareMissionAttempt(
				state,
				command.commandId,
				command.heroIds,
				command.missionId,
				command.combatModeBinding
			);
		if (command.commandType === 'mission.revise.party') reviseMissionParty(state, command.heroIds);
		if (command.commandType === 'mission.cancel') cancelMissionPreparation(state);
		if (command.commandType === 'mission.deploy') deployMissionAttempt(state);
		if (command.commandType === 'mission.extract') {
			if (state.schemaVersion === 15) completePortalMissionExtraction(state);
			else completeMissionExtraction(state);
		}
		if (command.commandType === 'mission.retreat')
			retreatMissionAttempt(state, appendPortalCargoLosses);
	}
}

export function buildMissionEvent(
	state: EngineGameState,
	command: MissionCommand,
	buildFirstBandConsequences?: BuildFirstBandMissionCommandConsequences
): AuthoritativeEvent {
	if (command.commandType === 'master.configure.timing') {
		if (state.schemaVersion !== 19 && state.schemaVersion !== 20)
			throw new IllegalActionError(command.commandType);
		const configured =
			state.schemaVersion === 20
				? configureMasterTimingV2(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					)
				: configureMasterTiming(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					);
		const base = eventBase(state, command, 'master.timing.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				timing: command.timing,
				countdownSeconds: command.countdownSeconds,
				observedAt: command.observedAt,
				masterControl: configured.control,
				pausedResolution: configured.paused,
				nextVersion: state.version + 1,
				...emptyMetadata(
					configured.paused
						? `The Master paused decision ${configured.paused.ordinal} and changed timing to ${command.timing}.`
						: `Master decision timing changed to ${command.timing}.`
				)
			}
		});
	}
	if (command.commandType === 'master.configure.fallback') {
		if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType);
		const configured = configureMasterFallback(state.masterControl, command);
		const base = eventBase(state, command, 'master.fallback.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				policy: command.policy,
				directionText: command.directionText,
				priorities: command.priorities,
				protectedHeroId: command.protectedHeroId,
				safetyStops: command.safetyStops,
				observedAt: command.observedAt,
				masterControl: configured.control,
				pausedResolution: configured.paused,
				nextVersion: state.version + 1,
				...emptyMetadata(
					configured.paused
						? `Decision ${configured.paused.ordinal} paused; ${command.policy} fallback now owns the next window.`
						: `Master fallback changed to ${command.policy} with explicit safety stops.`
				)
			}
		});
	}
	if (command.commandType === 'master.apply.safety-stop') {
		if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType);
		const stopped = applyMasterSafetyStop(
			state,
			command.commandId,
			command.decisionId,
			command.observedAt,
			command.source
		);
		const reason = stopped.resolution.fallbackSelection!.safetyStopReason!;
		const base = eventBase(state, command, 'master.safety.stopped');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				observedAt: command.observedAt,
				masterControl: stopped.control,
				decisionResolution: stopped.resolution,
				nextVersion: state.version + 1,
				...emptyMetadata(`Safety forced Wait at decision ${stopped.resolution.ordinal}: ${reason}.`)
			}
		});
	}
	if (command.commandType === 'master.open.decision') {
		if (state.schemaVersion !== 19 && state.schemaVersion !== 20)
			throw new IllegalActionError(command.commandType);
		const masterControl =
			state.schemaVersion === 20
				? masterDecisionWindowV2(state.masterControl, command.commandId, command.observedAt)
				: masterDecisionWindow(state.masterControl, command.commandId, command.observedAt);
		const base = eventBase(state, command, 'master.decision.opened');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				observedAt: command.observedAt,
				masterControl,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`Decision ${masterControl.decisionOrdinal} opened in ${masterControl.timing} timing.`
				)
			}
		});
	}

	if (
		state.schemaVersion !== 11 &&
		state.schemaVersion !== 12 &&
		state.schemaVersion !== 13 &&
		state.schemaVersion !== 14 &&
		state.schemaVersion !== 15 &&
		state.schemaVersion !== 16 &&
		state.schemaVersion !== 17 &&
		state.schemaVersion !== 18 &&
		state.schemaVersion !== 19 &&
		state.schemaVersion !== 20 &&
		state.schemaVersion !== 23 &&
		state.schemaVersion !== 24 &&
		state.schemaVersion !== 25 &&
		state.schemaVersion !== 26 &&
		state.schemaVersion !== 27
	)
		throw new IllegalActionError(command.commandType);
	if (
		command.commandType === 'mission.resolve.turn' ||
		command.commandType === 'mission.advance.automatic'
	) {
		if (
			command.commandType === 'mission.advance.automatic' &&
			state.schemaVersion !== 25 &&
			state.schemaVersion !== 26 &&
			state.schemaVersion !== 27
		) {
			throw new IllegalActionError(command.commandType);
		}
		if (
			state.schemaVersion !== 25 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 15 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20 &&
			state.schemaVersion !== 23 &&
			state.schemaVersion !== 24 &&
			state.schemaVersion !== 26 &&
			state.schemaVersion !== 27
		)
			throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'mission.round.resolved');
		const automaticResolution =
			command.commandType === 'mission.advance.automatic'
				? resolveMissionModeTurn(
						state as EngineGameStateV25 | EngineGameStateV26 | EngineGameStateV27,
						base.eventId
					)
				: null;
		const choices =
			command.commandType === 'mission.advance.automatic'
				? automaticResolution!.choices
				: command.choices;
		const resolution =
			automaticResolution ??
			(state.schemaVersion === 15
				? resolvePortalMissionTurn(state, choices)
				: state.schemaVersion === 13 ||
					  state.schemaVersion === 14 ||
					  state.schemaVersion === 16 ||
					  state.schemaVersion === 17 ||
					  state.schemaVersion === 18 ||
					  state.schemaVersion === 19 ||
					  state.schemaVersion === 20 ||
					  state.schemaVersion === 23 ||
					  state.schemaVersion === 24
					? resolveMissionCombatTurn(
							state,
							choices,
							state.schemaVersion === 16 ||
								state.schemaVersion === 17 ||
								state.schemaVersion === 18 ||
								state.schemaVersion === 19 ||
								state.schemaVersion === 20 ||
								state.schemaVersion === 23 ||
								state.schemaVersion === 24
								? base.eventId
								: null
						)
					: state.schemaVersion === 12
						? resolveMissionTurn(state, choices)
						: (() => {
								throw new IllegalActionError(command.commandType);
							})());
		const monsterCount =
			'monsterActions' in resolution.round ? resolution.round.monsterActions.length : 0;
		const timingResolution =
			state.schemaVersion === 19 || state.schemaVersion === 20
				? (() => {
						if (command.commandType !== 'mission.resolve.turn') {
							throw new IllegalActionError(command.commandType);
						}
						const masterChoice = resolution.choices.find(
							(choice) => choice.actorId === state.master.masterId
						);
						if (!masterChoice || !command.decisionId || !command.resolvedAt) {
							throw new IllegalActionError(command.commandType);
						}
						const missionContinues =
							'status' in resolution &&
							resolution.status === 'active' &&
							resolution.mission.attempt !== null &&
							['deployed', 'resolving'].includes(resolution.mission.attempt.status);
						return state.schemaVersion === 20
							? resolveMasterDecisionV2(
									state,
									command.commandId,
									command.decisionId,
									command.resolvedAt,
									masterChoice.actionId,
									command.source,
									missionContinues
								)
							: resolveMasterDecision(
									state.masterControl,
									command.commandId,
									command.decisionId,
									command.resolvedAt,
									masterChoice.actionId,
									command.source,
									missionContinues
								);
					})()
				: null;
		const combatProgressionOutcomes =
			state.schemaVersion === 27 &&
			resolution.mission.attempt !== null &&
			!['preparing', 'deployed', 'resolving', 'extraction'].includes(
				resolution.mission.attempt.status
			)
				? buildCombatExperienceOutcomes(
						{ ...state, mission: resolution.mission } as EngineGameStateV27,
						base.eventId,
						resolution.mission.attempt.status === 'success'
					)
				: [];
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: resolution.entropyCursor,
			payload: {
				transition: 'resolve-turn',
				mission: resolution.mission,
				choices: resolution.choices,
				round: resolution.round,
				...(state.schemaVersion === 27 ? { combatProgressionOutcomes } : {}),
				nextVersion: state.version + 1,
				...emptyMetadata(
					'status' in resolution && resolution.status === 'game_over'
						? `The Master died on Floor 03 during round ${resolution.round.roundNumber}; the run was atomically sealed.`
						: `Round ${resolution.round.roundNumber} resolved ${resolution.round.actions.length} party choices and ${monsterCount} monster duties in seeded initiative order.`
				),
				entropyDraws: resolution.entropyDraws,
				...((state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20 ||
					state.schemaVersion === 23 ||
					state.schemaVersion === 24 ||
					state.schemaVersion === 25 ||
					command.commandType === 'mission.advance.automatic') &&
				'consequences' in resolution
					? { consequences: resolution.consequences }
					: {}),
				...(timingResolution
					? {
							masterControl: timingResolution.control,
							decisionResolution: timingResolution.resolution
						}
					: {})
			}
		});
	}

	let mission: MissionEngineRunState;
	let transition: MissionTransition;
	let eventType: string;
	let summary: string;
	let heroIds: string[] = [];
	let completedObjectiveIds: string[] = [];
	let seedCursor = state.entropyCursor;
	let entropyDraws: EntropyDraw[] = [];
	let resourceChanges: PortalResourceChange[] = [];
	if (command.commandType === 'mission.prepare') {
		transition = 'prepare';
		eventType = 'mission.preparation.started';
		heroIds = normalizedMissionHeroIds(command.heroIds);
		mission = prepareMissionAttempt(
			state,
			command.commandId,
			heroIds,
			command.missionId,
			command.combatModeBinding
		);
		summary = `The Master reserved a ${heroIds.length + 1}-member party for ${mission.binding.missionId}.`;
	} else if (command.commandType === 'mission.revise.party') {
		transition = 'revise-party';
		eventType = 'mission.party.revised';
		heroIds = normalizedMissionHeroIds(command.heroIds);
		mission = reviseMissionParty(state, heroIds);
		summary = `The Master revised the threshold party to ${heroIds.length + 1} members.`;
	} else if (command.commandType === 'mission.cancel') {
		transition = 'cancel';
		eventType = 'mission.preparation.canceled';
		mission = cancelMissionPreparation(state);
		summary = 'The Master stood the party down before deployment.';
	} else if (command.commandType === 'mission.deploy') {
		transition = 'deploy';
		eventType = 'mission.deployed';
		const deployment = deployMissionAttempt(state);
		mission = deployment.mission;
		seedCursor = deployment.entropyCursor;
		entropyDraws = deployment.entropyDraws;
		summary =
			state.schemaVersion === 15
				? `The prepared party crossed the Iron Moon scar with ${state.mission.attempt!.turnState.portal.durationRounds} authoritative rounds remaining.`
				: state.schemaVersion === 13 ||
					  state.schemaVersion === 14 ||
					  state.schemaVersion === 16 ||
					  state.schemaVersion === 17 ||
					  state.schemaVersion === 18 ||
					  state.schemaVersion === 19 ||
					  state.schemaVersion === 20 ||
					  state.schemaVersion === 23 ||
					  state.schemaVersion === 24 ||
					  state.schemaVersion === 25 ||
					  state.schemaVersion === 26 ||
					  state.schemaVersion === 27
					? state.schemaVersion === 26 || state.schemaVersion === 27
						? 'The prepared party crossed the Tower Threshold; combat began under the stored attempt mode.'
						: `The prepared party crossed the Tower Threshold; ${Object.keys((deployment.mission as MissionRunStateV3 | MissionRunStateV4 | MissionRunStateV6 | MissionRunStateV7 | MissionRunStateV8 | MissionRunStateV9).attempt!.turnState.monsters).length} deterministic monster duties activated.`
					: 'The prepared party crossed the Tower Threshold as one authoritative deployment.';
	} else if (command.commandType === 'mission.open.extraction') {
		if (state.schemaVersion !== 11) throw new IllegalActionError(command.commandType);
		transition = 'open-extraction';
		eventType = 'mission.extraction.opened';
		completedObjectiveIds = [...command.completedObjectiveIds].sort((left, right) =>
			left.localeCompare(right)
		);
		mission = openMissionExtraction(state, completedObjectiveIds);
		summary = 'The mission resolver proved the primary objective and opened extraction.';
	} else if (command.commandType === 'mission.extract') {
		transition = 'extract';
		eventType = 'mission.extracted';
		if (state.schemaVersion === 15) {
			const extraction = completePortalMissionExtraction(state);
			mission = extraction.mission;
			resourceChanges = [...extraction.resourceChanges];
			summary = `The complete party crossed the portal scar with ${resourceChanges[0]!.delta} iron ore.`;
		} else {
			mission = completeMissionExtraction(state);
			summary = 'The complete party crossed the extraction boundary with the First Ember.';
		}
	} else if (command.commandType === 'mission.retreat') {
		transition = 'retreat';
		eventType = 'mission.retreated';
		mission = retreatMissionAttempt(state, appendPortalCargoLosses);
		summary =
			state.schemaVersion === 15
				? 'The complete party retreated through the portal scar; carried ore was abandoned.'
				: 'The complete party retreated through an authored boundary; the attempt ended.';
	} else {
		throw new Error('Unreachable mission command discriminator');
	}
	const base = eventBase(state, command, eventType);
	const combatProgressionOutcomes =
		state.schemaVersion === 27 && (transition === 'extract' || transition === 'retreat')
			? buildCombatExperienceOutcomes(state, base.eventId, transition === 'extract')
			: [];
	const firstBandConsequences =
		(state.schemaVersion === 23 || state.schemaVersion === 24) && transition !== 'open-extraction'
			? buildFirstBandConsequences?.(state, base.eventId, transition, mission as MissionRunStateV8)
			: undefined;
	const endedDecision =
		(state.schemaVersion === 19 || state.schemaVersion === 20) &&
		mission.attempt !== null &&
		!['deployed', 'resolving'].includes(mission.attempt.status)
			? state.schemaVersion === 20
				? endMasterDecisionV2(state.masterControl, command.source)
				: endMasterDecision(state.masterControl, command.source)
			: state.schemaVersion === 19 || state.schemaVersion === 20
				? { control: state.masterControl, resolution: null }
				: null;
	return AuthoritativeEventSchema.parse({
		...base,
		seedCursor,
		payload: {
			transition,
			mission,
			heroIds,
			completedObjectiveIds,
			...(state.schemaVersion === 27 ? { combatProgressionOutcomes } : {}),
			nextVersion: state.version + 1,
			...emptyMetadata(
				summary,
				resourceChanges.map((change) => ({
					ownerId: state.master.masterId,
					kind: 'resource' as const,
					key: change.resource,
					before: change.before,
					after: change.after,
					delta: change.delta
				}))
			),
			...(state.schemaVersion === 15 ? { resourceChanges } : {}),
			...(firstBandConsequences ?? {}),
			...(state.schemaVersion === 24
				? {
						equipmentDrop:
							transition === 'extract'
								? buildMissionEquipmentDrop(state, base.eventId, mission as MissionRunStateV8)
								: null
					}
				: {}),
			...(endedDecision
				? {
						masterControl: endedDecision.control,
						decisionResolution: endedDecision.resolution
					}
				: {}),
			entropyDraws
		}
	});
}

export const missionCommandHandler: MissionCommandHandler = {
	ownerId: 'mission',
	commandTypes: MISSION_COMMAND_TYPES,
	assertLegal: assertMissionCommandLegal,
	buildEvent: buildMissionEvent
};
