import {
	AppliedStoryPatchSchema,
	EngineGameStateV21Schema,
	EngineGameStateV23Schema,
	FirstBandArchiveRevealSchema,
	FirstBandArchiveStateSchema,
	MissionRunStateV8Schema,
	RuntimeBandStoryStateSchema,
	StoryPatchCandidateSchema,
	StoryPatchValidationReportSchema,
	type AuthoritativeEvent,
	type EngineGameState,
	type EngineGameStateV23
} from '@summonlab/contracts';
import { z } from 'zod';

import { verifiedStoryEnvelope } from '../../core/content-bindings.js';
import { EmptyMetadataSchema } from '../../core/event-metadata.js';
import type { EngineEventReducer } from '../../core/types.js';
import { ReplayIntegrityError } from '../../errors.js';
import { hashCanonical } from '../../hash.js';
import { applyValidatedStoryPatch } from '../../story.js';
import {
	completeFirstBandStory,
	recoverFirstBandArchive,
	revealFirstBandArchive
} from './archive.js';
import { storyPatchCastForState } from './runtime.js';

const StoryPatchAppliedPayloadSchema = EmptyMetadataSchema.extend({
	candidate: StoryPatchCandidateSchema,
	validation: StoryPatchValidationReportSchema,
	patch: AppliedStoryPatchSchema,
	bandStory: RuntimeBandStoryStateSchema,
	nextVersion: z.number().int().positive()
}).strict();

const FirstBandArchiveRevealedPayloadSchema = EmptyMetadataSchema.extend({
	reveal: FirstBandArchiveRevealSchema,
	firstBandArchive: FirstBandArchiveStateSchema,
	nextVersion: z.number().int().positive()
}).strict();

export const FirstBandMissionTransitionPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV8Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive(),
	bandStory: RuntimeBandStoryStateSchema,
	firstBandArchive: FirstBandArchiveStateSchema
}).strict();

export const STORY_EVENT_TYPES = ['story.first.archive.revealed', 'story.patch.applied'] as const;

function reduceStoryEvent(state: EngineGameState, event: AuthoritativeEvent): EngineGameState {
	if (event.eventType === 'story.first.archive.revealed') {
		if (
			state.schemaVersion !== 23 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			event.source.source !== 'manual'
		) {
			throw new ReplayIntegrityError(
				'First-band archive reveal precondition failed',
				event.sequence
			);
		}
		const payload = FirstBandArchiveRevealedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('First-band archive reveal version diverged', event.sequence);
		}
		let expected;
		try {
			expected = revealFirstBandArchive(state, payload.reveal.readerHeroId, event.eventId);
		} catch {
			throw new ReplayIntegrityError(
				'First-band archive reveal could not be reproduced',
				event.sequence
			);
		}
		if (
			hashCanonical(expected.reveal) !== hashCanonical(payload.reveal) ||
			hashCanonical(expected.archive) !== hashCanonical(payload.firstBandArchive)
		) {
			throw new ReplayIntegrityError('First-band archive reveal payload diverged', event.sequence);
		}
		return EngineGameStateV23Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			firstBandArchive: payload.firstBandArchive
		});
	}
	if (event.eventType === 'story.patch.applied') {
		if (
			state.schemaVersion !== 21 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			!['manual', 'scripted', 'model'].includes(event.source.source) ||
			state.bandStory.appliedPatches.length !== 0
		) {
			throw new ReplayIntegrityError('Story patch precondition failed', event.sequence);
		}
		const payload = StoryPatchAppliedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Story patch version diverged', event.sequence);
		}
		let expected;
		try {
			expected = applyValidatedStoryPatch(
				verifiedStoryEnvelope(),
				state.bandStory.history,
				storyPatchCastForState(state),
				payload.candidate,
				event.eventId,
				event.gameTime
			);
		} catch {
			throw new ReplayIntegrityError('Story patch could not be revalidated', event.sequence);
		}
		const expectedBandStory = RuntimeBandStoryStateSchema.parse({
			...state.bandStory,
			history: expected.history,
			appliedPatches: [...state.bandStory.appliedPatches, expected.patch]
		});
		if (
			hashCanonical(expected.patch.validation) !== hashCanonical(payload.validation) ||
			hashCanonical(expected.patch) !== hashCanonical(payload.patch) ||
			hashCanonical(expectedBandStory) !== hashCanonical(payload.bandStory)
		) {
			throw new ReplayIntegrityError('Story patch payload diverged', event.sequence);
		}
		return EngineGameStateV21Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			bandStory: payload.bandStory
		});
	}
	throw new ReplayIntegrityError('Story event discriminator is not owned', event.sequence);
}

export function reduceFirstBandMissionConsequences(
	stateInput: EngineGameStateV23,
	event: AuthoritativeEvent
): EngineGameStateV23 {
	const state = EngineGameStateV23Schema.parse(stateInput);
	const payload = FirstBandMissionTransitionPayloadSchema.parse(event.payload);
	const expectedBandStory =
		payload.transition === 'extract' ? completeFirstBandStory(state) : state.bandStory;
	const expectedArchive = recoverFirstBandArchive(
		state,
		event.eventId,
		payload.mission,
		expectedBandStory
	);
	if (
		hashCanonical(expectedBandStory) !== hashCanonical(payload.bandStory) ||
		hashCanonical(expectedArchive) !== hashCanonical(payload.firstBandArchive)
	) {
		throw new ReplayIntegrityError(
			'First-band mission transition payload diverged',
			event.sequence
		);
	}
	return EngineGameStateV23Schema.parse({
		...state,
		bandStory: payload.bandStory,
		firstBandArchive: payload.firstBandArchive
	});
}

export const storyEventReducer: EngineEventReducer = {
	ownerId: 'story',
	eventTypes: STORY_EVENT_TYPES,
	reduce: reduceStoryEvent
};
