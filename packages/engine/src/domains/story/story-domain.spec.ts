import {
	EngineCommandSchema,
	EngineGameStateV23Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { IllegalActionError } from '../../errors.js';
import { hashGameState, replayEventsStrict } from '../../index.js';
import { ENGINE_REPLAY_VECTOR_CASES } from '../../compatibility/replay-vectors.js';
import { storyCommandHandler } from './commands.js';
import {
	type FirstBandMissionConsequenceView,
	reduceFirstBandMissionConsequences,
	storyEventReducer
} from './reducer.js';

const EXPECTED_STORY_COMMAND_TYPES = ['story.apply.patch', 'story.reveal.first.archive'] as const;
const EXPECTED_STORY_EVENT_TYPES = ['story.first.archive.revealed', 'story.patch.applied'] as const;

type StoryCommand = Extract<
	EngineCommand,
	{ commandType: (typeof EXPECTED_STORY_COMMAND_TYPES)[number] }
>;

function vector(id: 'v21-story-patch' | 'v23-first-band-archive') {
	const replayCase = ENGINE_REPLAY_VECTOR_CASES.find((candidate) => candidate.vector.id === id);
	if (!replayCase) throw new Error(`Missing Checkpoint A replay vector: ${id}`);
	return replayCase.vector.events;
}

function stateBefore(
	events: readonly AuthoritativeEvent[],
	eventType: string
): { state: EngineGameState; event: AuthoritativeEvent } {
	const eventIndex = events.findIndex((event) => event.eventType === eventType);
	if (eventIndex < 1) throw new Error(`Missing Checkpoint A event: ${eventType}`);
	return {
		state: replayEventsStrict(events.slice(0, eventIndex)).snapshot.state,
		event: events[eventIndex]!
	};
}

function referenceCommand(state: EngineGameState, event: AuthoritativeEvent): StoryCommand {
	const payload = event.payload as {
		candidate?: unknown;
		reveal?: { readerHeroId: string };
	};
	return EngineCommandSchema.parse({
		commandId: event.commandId,
		runId: event.runId,
		actorId: event.actorId,
		expectedVersion: state.version,
		correlationId: event.correlationId,
		source: event.source,
		...(event.eventType === 'story.patch.applied'
			? { commandType: 'story.apply.patch', candidate: payload.candidate }
			: {
					commandType: 'story.reveal.first.archive',
					readerHeroId: payload.reveal?.readerHeroId
				})
	}) as StoryCommand;
}

describe('story domain ownership', () => {
	it('owns the exact ordered story command and exclusive event discriminators', () => {
		expect(storyCommandHandler.ownerId).toBe('story');
		expect(storyCommandHandler.commandTypes).toStrictEqual(EXPECTED_STORY_COMMAND_TYPES);
		expect(storyEventReducer.ownerId).toBe('story');
		expect(storyEventReducer.eventTypes).toStrictEqual(EXPECTED_STORY_EVENT_TYPES);
		expect(storyEventReducer.eventTypes).not.toContain('mission.extracted');
	});

	it.each([
		['v21-story-patch', 'story.patch.applied'],
		['v23-first-band-archive', 'story.first.archive.revealed']
	] as const)('builds the exact Checkpoint A command event for %s', (vectorId, eventType) => {
		const { state, event } = stateBefore(vector(vectorId), eventType);
		const command = referenceCommand(state, event);
		const before = structuredClone(state);

		storyCommandHandler.assertLegal(state, command);
		const built = storyCommandHandler.buildEvent(state, command);
		const reduced = storyEventReducer.reduce(state, built);
		expect({ ...built, afterStateHash: hashGameState(reduced) }).toStrictEqual(event);
		expect(state).toStrictEqual(before);
	});

	it.each([
		['v21-story-patch', 'story.patch.applied'],
		['v23-first-band-archive', 'story.first.archive.revealed']
	] as const)('reduces the exact Checkpoint A state and hash for %s', (vectorId, eventType) => {
		const events = vector(vectorId);
		const { state, event } = stateBefore(events, eventType);
		const eventIndex = events.indexOf(event);
		const expected = replayEventsStrict(events.slice(0, eventIndex + 1)).snapshot;

		const reduced = storyEventReducer.reduce(state, event);
		expect(reduced).toStrictEqual(expected.state);
		expect(hashGameState(reduced)).toBe(expected.stateHash);
	});

	it('applies first-band extraction consequences without owning the mission discriminator', () => {
		const events = vector('v23-first-band-archive');
		const { state: before, event } = stateBefore(events, 'mission.extracted');
		const eventIndex = events.indexOf(event);
		const expected = EngineGameStateV23Schema.parse(
			replayEventsStrict(events.slice(0, eventIndex + 1)).snapshot.state
		);
		const missionOnly = EngineGameStateV23Schema.parse({
			...expected,
			bandStory: EngineGameStateV23Schema.parse(before).bandStory,
			firstBandArchive: EngineGameStateV23Schema.parse(before).firstBandArchive
		});
		const consequence = {
			eventId: event.eventId,
			sequence: event.sequence,
			transition: 'extract',
			mission: expected.mission,
			bandStory: expected.bandStory,
			firstBandArchive: expected.firstBandArchive
		} satisfies FirstBandMissionConsequenceView;

		expect(Object.keys(consequence)).toStrictEqual([
			'eventId',
			'sequence',
			'transition',
			'mission',
			'bandStory',
			'firstBandArchive'
		]);
		const reduced = reduceFirstBandMissionConsequences(missionOnly, consequence);
		expect(reduced).toStrictEqual(expected);
		expect(hashGameState(reduced)).toBe(event.afterStateHash);
	});

	it.each([
		['v21-story-patch', 'story.patch.applied'],
		['v23-first-band-archive', 'story.first.archive.revealed']
	] as const)('rejects an illegal %s command without mutating input', (vectorId, eventType) => {
		const { state, event } = stateBefore(vector(vectorId), eventType);
		const command = referenceCommand(state, event);
		const illegal =
			command.commandType === 'story.apply.patch'
				? EngineCommandSchema.parse({
						...command,
						candidate: { ...command.candidate, baseHistoryHash: 'f'.repeat(64) }
					})
				: EngineCommandSchema.parse({
						...command,
						readerHeroId: '00000000-0000-4000-8000-000000000001'
					});
		const before = structuredClone(state);

		expect(() => storyCommandHandler.assertLegal(state, illegal as StoryCommand)).toThrow(
			IllegalActionError
		);
		expect(state).toStrictEqual(before);
	});
});
