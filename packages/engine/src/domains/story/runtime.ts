import {
	EngineGameStateV21Schema,
	RuntimeBandStoryStateSchema,
	StoryPatchCandidateSchema,
	type EngineGameStateV21,
	type StoryPatchCastMember
} from '@summonlab/contracts';
import { z } from 'zod';

import { verifiedStoryEnvelope } from '../../core/content-bindings.js';
import { ReplayIntegrityError } from '../../errors.js';
import { validateStoryPatch } from '../../story.js';

export function createStoryPatchCheckpoint() {
	const envelope = verifiedStoryEnvelope();
	const pressure = envelope.beats.find(
		(beat) => beat.floor === 4 && beat.kind === 'pressure' && beat.required
	);
	if (!pressure) throw new Error('Floor 04 story pressure checkpoint is unavailable');
	const pressureIndex = envelope.defaultBeatOrder.indexOf(pressure.beatId);
	if (pressureIndex < 0) throw new Error('Floor 04 story checkpoint left the default route');
	return RuntimeBandStoryStateSchema.parse({
		storyVersion: 'runtime-band-story-v1',
		envelopeId: envelope.envelopeId,
		envelopeContentVersion: envelope.contentVersion,
		envelopeContentHash: envelope.contentHash,
		history: {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 4,
			completedBeatIds: envelope.defaultBeatOrder.slice(0, pressureIndex + 1),
			activatedProposalIds: []
		},
		appliedPatches: []
	});
}

export function storyPatchCastForState(
	stateInput: EngineGameStateV21
): readonly StoryPatchCastMember[] {
	const state = EngineGameStateV21Schema.parse(stateInput);
	const envelope = verifiedStoryEnvelope();
	const completed = new Set(state.bandStory.history.completedBeatIds);
	const anchors = new Map(envelope.anchors.map((anchor) => [anchor.anchorId, anchor]));
	const openProposalIds = new Set(
		envelope.patchSlots
			.filter((slot) => {
				const after = anchors.get(slot.afterAnchorId);
				const before = anchors.get(slot.beforeAnchorId);
				return Boolean(
					slot.floor <= state.bandStory.history.unlockedFloor &&
					after &&
					completed.has(after.beatId) &&
					before &&
					!completed.has(before.beatId)
				);
			})
			.flatMap((slot) => slot.allowedProposalIds)
	);
	return Object.values(state.heroes)
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((hero) => {
			const heldEvidenceKeys = new Set(
				Object.values(state.mission.evidence)
					.filter((evidence) => evidence.holderActorId === hero.heroId)
					.map((evidence) => evidence.evidenceKey)
			);
			const availableProposalIds = envelope.proposals
				.filter(
					(proposal) =>
						openProposalIds.has(proposal.proposalId) &&
						proposal.kind === 'role-expression' &&
						(proposal.floor !== 4 || heldEvidenceKeys.has('foundry-maintenance-route'))
				)
				.map((proposal) => proposal.proposalId);
			return {
				heroId: hero.heroId,
				lifeState: hero.lifeState,
				availableProposalIds
			};
		});
}

export function validateStoryPatchForState(
	stateInput: EngineGameStateV21,
	candidateInput: z.input<typeof StoryPatchCandidateSchema>
) {
	const state = EngineGameStateV21Schema.parse(stateInput);
	const candidate = StoryPatchCandidateSchema.parse(candidateInput);
	if (
		state.bandStory.envelopeId !== verifiedStoryEnvelope().envelopeId ||
		state.bandStory.envelopeContentHash !== verifiedStoryEnvelope().contentHash
	) {
		throw new ReplayIntegrityError(
			'Runtime story envelope binding is unavailable',
			state.eventCursor
		);
	}
	return validateStoryPatch(
		verifiedStoryEnvelope(),
		state.bandStory.history,
		storyPatchCastForState(state),
		candidate
	);
}
