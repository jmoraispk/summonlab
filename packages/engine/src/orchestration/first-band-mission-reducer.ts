import {
	EngineGameStateV23Schema,
	MissionRunStateV8Schema,
	type AuthoritativeEvent,
	type EngineGameState,
	type EngineGameStateV23,
	type MissionRunStateV8
} from '@summonlab/contracts';

import type { EngineEventReducer } from '../core/types.js';
import type {
	BuildFirstBandMissionCommandConsequences,
	FirstBandMissionCommandConsequences
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
	if (state.schemaVersion !== 23) return reduceMissionEvent(state, event);
	return reduceFirstBandMissionTransition(
		EngineGameStateV23Schema.parse(state),
		event,
		reduceFirstBandMissionConsequences
	);
}

export const buildFirstBandMissionCommandConsequences: BuildFirstBandMissionCommandConsequences = (
	state: EngineGameStateV23,
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

export const firstBandMissionEventReducer: EngineEventReducer = {
	ownerId: 'first-band-mission',
	eventTypes: FIRST_BAND_MISSION_EVENT_TYPES,
	reduce: reduceFirstBandMissionEvent
};
