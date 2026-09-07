import {
	CombatChoiceBatchAppliedEventSchema,
	EngineGameStateV26Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	MissionRunStateV8Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type MissionRunStateV8
} from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';

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
import { AGENT_READINESS_RULES_VERSION } from '../domains/mission/combat-mode.js';
import {
	reduceFirstBandMissionTransition,
	reduceMissionEvent
} from '../domains/mission/reducer.js';
import { completeFirstBandStory, recoverFirstBandArchive } from '../domains/story/archive.js';
import { reduceFirstBandMissionConsequences } from '../domains/story/reducer.js';
import { IllegalActionError, ReplayIntegrityError } from '../errors.js';
import { hashCanonical } from '../hash.js';

type ReadinessBatchCommand = Extract<
	EngineCommand,
	{ commandType: 'mission.apply.combat-choice-batch' }
>;
type OrchestratedMissionCommand = MissionCommand | ReadinessBatchCommand;

export const FIRST_BAND_MISSION_COMMAND_TYPES = [
	...MISSION_COMMAND_TYPES.slice(0, 10),
	'mission.apply.combat-choice-batch',
	...MISSION_COMMAND_TYPES.slice(10)
] as const;

export const FIRST_BAND_MISSION_EVENT_TYPES = [
	'mission.preparation.started',
	'mission.party.revised',
	'mission.preparation.canceled',
	'mission.deployed',
	'mission.extracted',
	'mission.retreated',
	'mission.combat.choice-batch.applied'
] as const;

function assertReadinessBatchLegal(state: EngineGameState, command: ReadinessBatchCommand): void {
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
		attempt.combatModeBinding.rulesVersion !== AGENT_READINESS_RULES_VERSION ||
		attempt.combatModeBinding.contentHash !== COMBAT_CONTENT_BINDING.contentHash ||
		attempt.combatState.modeId !== 'agent-readiness-v1' ||
		attempt.combatState.readinessState.status !== 'active' ||
		attempt.combatState.readinessState.attemptId !== attempt.attemptId
	) {
		throw new IllegalActionError(command.commandType, []);
	}
	try {
		applyCombatChoiceBatch(attempt.combatState.readinessState, command.batch, COMBAT_RULES_V1);
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
		COMBAT_RULES_V1
	);
	return CombatChoiceBatchAppliedEventSchema.parse({
		...eventBase(state, command, 'mission.combat.choice-batch.applied'),
		seedCursor: state.entropyCursor,
		payload: { batch: command.batch, resolvedEvents: resolution.events }
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
		attempt.combatModeBinding.rulesVersion !== AGENT_READINESS_RULES_VERSION ||
		attempt.combatModeBinding.contentHash !== COMBAT_CONTENT_BINDING.contentHash ||
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
			COMBAT_RULES_V1
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
	return EngineGameStateV26Schema.parse({
		...state,
		version: state.version + 1,
		eventCursor: parsed.sequence,
		mission: {
			...state.mission,
			attempt: {
				...attempt,
				combatState: {
					modeId: 'agent-readiness-v1',
					readinessState: resolution.state
				}
			}
		}
	});
}

function reduceFirstBandMissionEvent(
	state: EngineGameState,
	event: AuthoritativeEvent
): EngineGameState {
	if (event.eventType === 'mission.combat.choice-batch.applied') {
		return reduceReadinessBatchEvent(state, event);
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
		missionCommandHandler.assertLegal(state, command);
	},
	buildEvent: (state: EngineGameState, command: OrchestratedMissionCommand) =>
		command.commandType === 'mission.apply.combat-choice-batch'
			? buildReadinessBatchEvent(state, command)
			: missionCommandHandler.buildEvent(state, command, buildFirstBandMissionCommandConsequences)
} satisfies EngineCommandHandler<OrchestratedMissionCommand>;

export const firstBandMissionEventReducer: EngineEventReducer = {
	ownerId: 'first-band-mission',
	eventTypes: FIRST_BAND_MISSION_EVENT_TYPES,
	reduce: reduceFirstBandMissionEvent
};
