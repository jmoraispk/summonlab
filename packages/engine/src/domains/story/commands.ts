import {
	AuthoritativeEventSchema,
	RuntimeBandStoryStateSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState
} from '@summonlab/contracts';

import { verifiedStoryEnvelope } from '../../core/content-bindings.js';
import { emptyMetadata, eventBase } from '../../core/event-metadata.js';
import type { EngineCommandHandler } from '../../core/types.js';
import { IllegalActionError } from '../../errors.js';
import { applyValidatedStoryPatch } from '../../story.js';
import { FIRST_BAND_ARCHIVE_MESSAGE, revealFirstBandArchive } from './archive.js';
import { storyPatchCastForState, validateStoryPatchForState } from './runtime.js';

export const STORY_COMMAND_TYPES = ['story.apply.patch', 'story.reveal.first.archive'] as const;

export type StoryCommand = Extract<
	EngineCommand,
	{ commandType: (typeof STORY_COMMAND_TYPES)[number] }
>;

function assertStoryCommandLegal(state: EngineGameState, command: StoryCommand): void {
	if (command.commandType === 'story.reveal.first.archive') {
		if (
			state.schemaVersion !== 23 ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step' ||
			state.firstBandArchive.status !== 'recovered' ||
			!state.firstBandArchive.recovery?.survivingHeroIds.includes(command.readerHeroId) ||
			state.heroes[command.readerHeroId]?.lifeState !== 'active'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (
		state.schemaVersion !== 21 ||
		state.status !== 'active' ||
		state.master.lifeState !== 'alive' ||
		command.actorId !== state.master.masterId ||
		!['manual', 'scripted', 'model'].includes(command.source.source) ||
		command.source.fallbackPolicy !== null ||
		command.source.decisionJobId !== null ||
		state.bandStory.appliedPatches.length !== 0 ||
		!validateStoryPatchForState(state, command.candidate).accepted
	) {
		throw new IllegalActionError(command.commandType, []);
	}
}

function buildStoryEvent(state: EngineGameState, command: StoryCommand): AuthoritativeEvent {
	if (command.commandType === 'story.apply.patch') {
		if (state.schemaVersion !== 21) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'story.patch.applied');
		const applied = applyValidatedStoryPatch(
			verifiedStoryEnvelope(),
			state.bandStory.history,
			storyPatchCastForState(state),
			command.candidate,
			base.eventId,
			state.simulatedAt
		);
		const bandStory = RuntimeBandStoryStateSchema.parse({
			...state.bandStory,
			history: applied.history,
			appliedPatches: [...state.bandStory.appliedPatches, applied.patch]
		});
		const selected = command.candidate.selectedProposalIds.join(', ');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				candidate: command.candidate,
				validation: applied.patch.validation,
				patch: applied.patch,
				bandStory,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The runtime director committed ${selected} at ${command.candidate.slotId}; every fixed story boundary remained intact.`
				)
			}
		});
	}
	if (command.commandType === 'story.reveal.first.archive') {
		if (state.schemaVersion !== 23) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'story.first.archive.revealed');
		const resolved = revealFirstBandArchive(state, command.readerHeroId, base.eventId);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				reveal: resolved.reveal,
				firstBandArchive: resolved.archive,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`${resolved.reveal.expression.speakerName} opened the recovered fragment: ${FIRST_BAND_ARCHIVE_MESSAGE}`
				)
			}
		});
	}
	throw new Error('Unreachable story command discriminator');
}

export const storyCommandHandler: EngineCommandHandler<StoryCommand> = {
	ownerId: 'story',
	commandTypes: STORY_COMMAND_TYPES,
	assertLegal: assertStoryCommandLegal,
	buildEvent: buildStoryEvent
};
