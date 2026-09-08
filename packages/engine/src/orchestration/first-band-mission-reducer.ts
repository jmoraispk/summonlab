import {
	AuthoritativeEventSchema,
	CombatChoiceBatchAppliedEventSchema,
	EngineGameStateV26Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	MissionRunStateV8Schema,
	ReadinessCombatTerminalCommittedEventSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type MissionRunStateV8
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';

import { eventBase } from '../core/event-metadata.js';
import type { EngineCommandHandler, EngineEventReducer } from '../core/types.js';
import { applyCombatChoiceBatch } from '../domains/combat/arbitration.js';
import {
	MISSION_COMMAND_TYPES,
	missionCommandHandler,
	type BuildFirstBandMissionCommandConsequences,
	type FirstBandMissionCommandConsequences,
	type MissionCommand
} from '../domains/mission/commands.js';
import { combatModeAvailability } from '../domains/mission/combat-mode.js';
import {
	reduceFirstBandMissionTransition,
	reduceMissionEvent
} from '../domains/mission/reducer.js';
import { completeFirstBandStory, recoverFirstBandArchive } from '../domains/story/archive.js';
import { reduceFirstBandMissionConsequences } from '../domains/story/reducer.js';
import { IllegalActionError, ReplayIntegrityError } from '../errors.js';
import { hashCanonical } from '../hash.js';
import {
	resolveMissionModeTurn,
	type CurrentLegacyAutoV1CombatResolution
} from '../domains/mission/mission-mode-runner.js';
import { finalizeV26LegacyRound } from './legacy-terminal.js';
import { advanceReadinessToTerminal, finalizeReadinessMission } from './readiness-terminal.js';

type ReadinessBatchCommand = Extract<
	EngineCommand,
	{ commandType: 'mission.apply.combat-choice-batch' }
>;
type ReadinessTerminalCommand = Extract<
	EngineCommand,
	{ commandType: 'mission.commit.readiness-terminal' }
>;
type OrchestratedMissionCommand = MissionCommand | ReadinessBatchCommand | ReadinessTerminalCommand;

export const FIRST_BAND_MISSION_COMMAND_TYPES = [
	...MISSION_COMMAND_TYPES.slice(0, 10),
	'mission.apply.combat-choice-batch',
	'mission.commit.readiness-terminal',
	...MISSION_COMMAND_TYPES.slice(10)
] as const;

export const FIRST_BAND_MISSION_EVENT_TYPES = [
	'mission.preparation.started',
	'mission.party.revised',
	'mission.preparation.canceled',
	'mission.deployed',
	'mission.extracted',
	'mission.retreated',
	'mission.round.resolved',
	'mission.combat.choice-batch.applied',
	'mission.combat.readiness.terminal.committed'
] as const;

function buildOrchestratedMissionEvent(
	state: EngineGameState,
	command: MissionCommand
): AuthoritativeEvent {
	const event = missionCommandHandler.buildEvent(
		state,
		command,
		buildFirstBandMissionCommandConsequences
	);
	if (
		state.schemaVersion !== 26 ||
		command.commandType !== 'mission.advance.automatic' ||
		state.mission.attempt?.combatState.modeId !== 'legacy-auto-v1' ||
		event.eventType !== 'mission.round.resolved'
	) {
		return event;
	}
	const resolution = resolveMissionModeTurn(
		state,
		event.eventId
	) as CurrentLegacyAutoV1CombatResolution;
	const finalization = finalizeV26LegacyRound(state, resolution);
	return AuthoritativeEventSchema.parse({
		...event,
		payload: { ...event.payload, ...finalization }
	});
}

function assertReadinessSystemCommand(
	state: EngineGameState,
	command: ReadinessBatchCommand | ReadinessTerminalCommand
): asserts state is Extract<EngineGameState, { schemaVersion: 26 }> {
	const attempt = state.schemaVersion === 26 ? state.mission.attempt : null;
	if (
		state.schemaVersion !== 26 ||
		state.status !== 'active' ||
		state.master.lifeState !== 'alive' ||
		command.actorId !== state.master.masterId ||
		command.source.source !== 'system' ||
		command.source.timing !== null ||
		command.source.fallbackPolicy !== null ||
		command.source.directiveIds.length !== 0 ||
		command.source.decisionJobId !== null ||
		!attempt ||
		!['deployed', 'resolving'].includes(attempt.status) ||
		attempt.combatModeBinding.modeId !== 'agent-readiness-v1' ||
		combatModeAvailability(attempt.combatModeBinding, 26).status !== 'available' ||
		attempt.combatState.modeId !== 'agent-readiness-v1' ||
		attempt.combatState.readinessState.status !== 'active' ||
		attempt.combatState.readinessState.attemptId !== attempt.attemptId
	) {
		throw new IllegalActionError(command.commandType, []);
	}
}

function assertReadinessBatchLegal(state: EngineGameState, command: ReadinessBatchCommand): void {
	assertReadinessSystemCommand(state, command);
	const attempt = state.mission.attempt!;
	if (attempt.combatState.modeId !== 'agent-readiness-v1') {
		throw new IllegalActionError(command.commandType, []);
	}
	try {
		applyCombatChoiceBatch(
			attempt.combatState.readinessState,
			command.batch,
			COMBAT_RULES_V1,
			attempt.combatModeBinding
		);
	} catch {
		throw new IllegalActionError(command.commandType, []);
	}
}

function buildReadinessBatchEvent(
	state: EngineGameState,
	command: ReadinessBatchCommand
): AuthoritativeEvent {
	assertReadinessBatchLegal(state, command);
	if (state.schemaVersion !== 26) throw new IllegalActionError(command.commandType, []);
	const attempt = state.mission.attempt!;
	if (attempt.combatState.modeId !== 'agent-readiness-v1') {
		throw new IllegalActionError(command.commandType, []);
	}
	const resolution = applyCombatChoiceBatch(
		attempt.combatState.readinessState,
		command.batch,
		COMBAT_RULES_V1,
		attempt.combatModeBinding
	);
	const base = eventBase(state, command, 'mission.combat.choice-batch.applied');
	const finalization =
		resolution.state.status === 'complete'
			? finalizeReadinessMission(
					state,
					resolution.state,
					base.eventId,
					resolution.terminalAuthority!
				)
			: null;
	return CombatChoiceBatchAppliedEventSchema.parse({
		...base,
		seedCursor: state.entropyCursor,
		payload: {
			batch: command.batch,
			resolvedEvents: resolution.events,
			terminalResult: resolution.state.status === 'complete' ? resolution.state.result : null,
			claimCheckpoint: finalization?.claimCheckpoint ?? null
		}
	});
}

function assertReadinessTerminalLegal(
	state: EngineGameState,
	command: ReadinessTerminalCommand
): void {
	assertReadinessSystemCommand(state, command);
	if (!advanceReadinessToTerminal(state)) throw new IllegalActionError(command.commandType, []);
}

function buildReadinessTerminalEvent(
	state: EngineGameState,
	command: ReadinessTerminalCommand
): AuthoritativeEvent {
	assertReadinessTerminalLegal(state, command);
	if (state.schemaVersion !== 26) throw new IllegalActionError(command.commandType, []);
	const advanced = advanceReadinessToTerminal(state)!;
	const base = eventBase(state, command, 'mission.combat.readiness.terminal.committed');
	if (!advanced.authority) throw new IllegalActionError(command.commandType, []);
	const finalization = finalizeReadinessMission(
		state,
		advanced.state,
		base.eventId,
		advanced.authority
	);
	return ReadinessCombatTerminalCommittedEventSchema.parse({
		...base,
		seedCursor: state.entropyCursor,
		payload: { result: advanced.result, claimCheckpoint: finalization.claimCheckpoint }
	});
}

function reduceReadinessBatchEvent(
	state: EngineGameState,
	event: AuthoritativeEvent
): EngineGameState {
	const parsed = CombatChoiceBatchAppliedEventSchema.parse(event);
	const attempt = state.schemaVersion === 26 ? state.mission.attempt : null;
	if (
		state.schemaVersion !== 26 ||
		state.status !== 'active' ||
		state.master.lifeState !== 'alive' ||
		parsed.actorId !== state.master.masterId ||
		parsed.gameTime !== state.simulatedAt ||
		parsed.seedCursor !== state.entropyCursor ||
		parsed.causationId !== null ||
		parsed.correlationId !== parsed.commandId ||
		parsed.source.source !== 'system' ||
		parsed.source.timing !== null ||
		parsed.source.fallbackPolicy !== null ||
		parsed.source.directiveIds.length !== 0 ||
		parsed.source.decisionJobId !== null ||
		!attempt ||
		!['deployed', 'resolving'].includes(attempt.status) ||
		attempt.combatModeBinding.modeId !== 'agent-readiness-v1' ||
		combatModeAvailability(attempt.combatModeBinding, 26).status !== 'available' ||
		attempt.combatState.modeId !== 'agent-readiness-v1' ||
		attempt.combatState.readinessState.status !== 'active' ||
		attempt.combatState.readinessState.attemptId !== attempt.attemptId
	) {
		throw new ReplayIntegrityError('Readiness combat batch precondition failed', event.sequence);
	}
	let resolution;
	try {
		resolution = applyCombatChoiceBatch(
			attempt.combatState.readinessState,
			parsed.payload.batch,
			COMBAT_RULES_V1,
			attempt.combatModeBinding
		);
	} catch {
		throw new ReplayIntegrityError(
			'Readiness combat batch could not be reproduced',
			event.sequence
		);
	}
	if (hashCanonical(resolution.events) !== hashCanonical(parsed.payload.resolvedEvents)) {
		throw new ReplayIntegrityError('Readiness combat resolved trace diverged', event.sequence);
	}
	const expectedTerminal = resolution.state.status === 'complete' ? resolution.state.result : null;
	if (hashCanonical(expectedTerminal) !== hashCanonical(parsed.payload.terminalResult)) {
		throw new ReplayIntegrityError('Readiness combat terminal result diverged', event.sequence);
	}
	const finalization = expectedTerminal
		? finalizeReadinessMission(
				state,
				resolution.state,
				parsed.eventId,
				resolution.terminalAuthority!
			)
		: null;
	if (
		hashCanonical(finalization?.claimCheckpoint ?? null) !==
		hashCanonical(parsed.payload.claimCheckpoint)
	) {
		throw new ReplayIntegrityError('Readiness combat claim checkpoint diverged', event.sequence);
	}
	const transitioned = finalization?.state ?? state;
	return EngineGameStateV26Schema.parse({
		...transitioned,
		version: state.version + 1,
		eventCursor: parsed.sequence,
		mission: {
			...transitioned.mission,
			attempt: {
				...transitioned.mission.attempt!,
				combatState: {
					modeId: 'agent-readiness-v1',
					readinessState: resolution.state
				}
			}
		}
	});
}

function reduceReadinessTerminalEvent(
	state: EngineGameState,
	event: AuthoritativeEvent
): EngineGameState {
	const parsed = ReadinessCombatTerminalCommittedEventSchema.parse(event);
	if (state.schemaVersion !== 26) {
		throw new ReplayIntegrityError('Readiness terminal requires v26 state', event.sequence);
	}
	const syntheticCommand: ReadinessTerminalCommand = {
		commandType: 'mission.commit.readiness-terminal',
		commandId: parsed.commandId,
		runId: parsed.runId,
		actorId: parsed.actorId!,
		expectedVersion: state.version,
		correlationId: parsed.correlationId,
		source: parsed.source
	};
	try {
		assertReadinessSystemCommand(state, syntheticCommand);
	} catch {
		throw new ReplayIntegrityError('Readiness terminal precondition failed', event.sequence);
	}
	if (
		parsed.gameTime !== state.simulatedAt ||
		parsed.seedCursor !== state.entropyCursor ||
		parsed.causationId !== null ||
		parsed.correlationId !== parsed.commandId
	) {
		throw new ReplayIntegrityError('Readiness terminal metadata diverged', event.sequence);
	}
	const advanced = advanceReadinessToTerminal(state);
	if (!advanced) {
		throw new ReplayIntegrityError(
			'Readiness terminal encountered a decision window',
			event.sequence
		);
	}
	if (hashCanonical(advanced.result) !== hashCanonical(parsed.payload.result)) {
		throw new ReplayIntegrityError('Readiness terminal result diverged', event.sequence);
	}
	if (!advanced.authority) {
		throw new ReplayIntegrityError('Readiness terminal authority is unavailable', event.sequence);
	}
	const finalization = finalizeReadinessMission(
		state,
		advanced.state,
		parsed.eventId,
		advanced.authority
	);
	if (
		hashCanonical(finalization.claimCheckpoint) !== hashCanonical(parsed.payload.claimCheckpoint)
	) {
		throw new ReplayIntegrityError('Readiness terminal claim checkpoint diverged', event.sequence);
	}
	const transitioned = finalization.state;
	return EngineGameStateV26Schema.parse({
		...transitioned,
		version: state.version + 1,
		eventCursor: parsed.sequence
	});
}

function reduceFirstBandMissionEvent(
	state: EngineGameState,
	event: AuthoritativeEvent
): EngineGameState {
	if (event.eventType === 'mission.combat.choice-batch.applied') {
		return reduceReadinessBatchEvent(state, event);
	}
	if (event.eventType === 'mission.combat.readiness.terminal.committed') {
		return reduceReadinessTerminalEvent(state, event);
	}
	if (
		event.eventType === 'mission.round.resolved' &&
		state.schemaVersion === 26 &&
		state.mission.attempt?.combatState.modeId === 'legacy-auto-v1'
	) {
		const { terminalResult = null, claimCheckpoint = null, ...payload } = event.payload;
		const resolution = resolveMissionModeTurn(
			state,
			event.eventId
		) as CurrentLegacyAutoV1CombatResolution;
		const expected = finalizeV26LegacyRound(state, resolution);
		if (
			hashCanonical(expected.terminalResult) !== hashCanonical(terminalResult) ||
			hashCanonical(expected.claimCheckpoint) !== hashCanonical(claimCheckpoint)
		) {
			throw new ReplayIntegrityError('Current legacy terminal claims diverged', event.sequence);
		}
		return reduceMissionEvent(state, { ...event, payload });
	}
	if (state.schemaVersion !== 23 && state.schemaVersion !== 24)
		return reduceMissionEvent(state, event);
	return reduceFirstBandMissionTransition(
		state.schemaVersion === 24
			? EngineGameStateV24Schema.parse(state)
			: EngineGameStateV23Schema.parse(state),
		event,
		reduceFirstBandMissionConsequences
	);
}

export const buildFirstBandMissionCommandConsequences: BuildFirstBandMissionCommandConsequences = (
	state: EngineGameStateV23 | EngineGameStateV24,
	eventId: string,
	transition,
	mission: MissionRunStateV8
): FirstBandMissionCommandConsequences => {
	const bandStory = transition === 'extract' ? completeFirstBandStory(state) : state.bandStory;
	return {
		bandStory,
		firstBandArchive: recoverFirstBandArchive(
			state,
			eventId,
			MissionRunStateV8Schema.parse(mission),
			bandStory
		)
	};
};

export const firstBandMissionCommandHandler = {
	ownerId: missionCommandHandler.ownerId,
	commandTypes: FIRST_BAND_MISSION_COMMAND_TYPES,
	assertLegal: (state: EngineGameState, command: OrchestratedMissionCommand) => {
		if (command.commandType === 'mission.apply.combat-choice-batch') {
			assertReadinessBatchLegal(state, command);
			return;
		}
		if (command.commandType === 'mission.commit.readiness-terminal') {
			assertReadinessTerminalLegal(state, command);
			return;
		}
		missionCommandHandler.assertLegal(state, command);
	},
	buildEvent: (state: EngineGameState, command: OrchestratedMissionCommand) =>
		command.commandType === 'mission.apply.combat-choice-batch'
			? buildReadinessBatchEvent(state, command)
			: command.commandType === 'mission.commit.readiness-terminal'
				? buildReadinessTerminalEvent(state, command)
				: buildOrchestratedMissionEvent(state, command)
} satisfies EngineCommandHandler<OrchestratedMissionCommand>;

export const firstBandMissionEventReducer: EngineEventReducer = {
	ownerId: 'first-band-mission',
	eventTypes: FIRST_BAND_MISSION_EVENT_TYPES,
	reduce: reduceFirstBandMissionEvent
};
