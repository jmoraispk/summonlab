import {
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	MissionRunStateV8Schema,
	type AuthoritativeEvent,
	type EngineGameState,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type MissionRunStateV8
} from '@summonlab/contracts';

import type { EngineCommandHandler, EngineEventReducer } from '../core/types.js';
import {
	missionCommandHandler,
	type BuildFirstBandMissionCommandConsequences,
	type FirstBandMissionCommandConsequences,
	type MissionCommand
} from '../domains/mission/commands.js';
import {
	reduceFirstBandMissionTransition,
	reduceMissionEvent
} from '../domains/mission/reducer.js';
import { completeFirstBandStory, recoverFirstBandArchive } from '../domains/story/archive.js';
import { reduceFirstBandMissionConsequences } from '../domains/story/reducer.js';

export const FIRST_BAND_MISSION_EVENT_TYPES = [
	'mission.preparation.started',
	'mission.party.revised',
	'mission.preparation.canceled',
	'mission.deployed',
	'mission.extracted',
	'mission.retreated'
] as const;

function reduceFirstBandMissionEvent(
	state: EngineGameState,
	event: AuthoritativeEvent
): EngineGameState {
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
	commandTypes: missionCommandHandler.commandTypes,
	assertLegal: missionCommandHandler.assertLegal,
	buildEvent: (state: EngineGameState, command: MissionCommand) =>
		missionCommandHandler.buildEvent(state, command, buildFirstBandMissionCommandConsequences)
} satisfies EngineCommandHandler<MissionCommand>;

export const firstBandMissionEventReducer: EngineEventReducer = {
	ownerId: 'first-band-mission',
	eventTypes: FIRST_BAND_MISSION_EVENT_TYPES,
	reduce: reduceFirstBandMissionEvent
};
