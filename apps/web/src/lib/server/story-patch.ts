import { TOWER_BAND_01_STORY_ENVELOPE } from '@summonlab/content';
import {
	StoryPatchCandidateSchema,
	type EngineGameStateV21,
	type StoryPatchCandidate
} from '@summonlab/contracts';
import {
	deterministicUuid,
	hashCanonical,
	storyPatchCastForState,
	validateStoryPatchForState
} from '@summonlab/engine';

const floor = 4;

export function runtimeStoryPatchView(state: EngineGameStateV21, stateHash: string) {
	const envelope = TOWER_BAND_01_STORY_ENVELOPE;
	const slot = envelope.patchSlots.find((entry) => entry.floor === floor);
	if (!slot) throw new Error('The Floor 04 story patch slot is unavailable.');
	const historyHash = hashCanonical(state.bandStory.history);
	const cast = storyPatchCastForState(state);
	const options =
		state.bandStory.appliedPatches.length > 0
			? []
			: slot.allowedProposalIds.flatMap((proposalId) => {
					const proposal = envelope.proposals.find((entry) => entry.proposalId === proposalId);
					if (!proposal) throw new Error(`Story proposal is unavailable: ${proposalId}`);
					const beat = envelope.beats.find((entry) => entry.beatId === proposal.beatId);
					if (!beat) throw new Error(`Story beat is unavailable: ${proposal.beatId}`);
					const bindingHeroIds =
						proposal.kind === 'role-expression'
							? cast
									.filter((member) => member.availableProposalIds.includes(proposalId))
									.map((member) => member.heroId)
							: [null];
					return bindingHeroIds.map((heroId): RuntimeStoryPatchOption => {
						const candidate = StoryPatchCandidateSchema.parse({
							patchVersion: 'story-patch-v1',
							patchId: deterministicUuid(
								`${state.runId}:${state.version}:${historyHash}:${proposalId}:${heroId ?? 'unbound'}`
							),
							envelopeId: state.bandStory.envelopeId,
							envelopeContentHash: state.bandStory.envelopeContentHash,
							baseHistoryHash: historyHash,
							slotId: slot.slotId,
							selectedProposalIds: [proposalId],
							roleBindings: heroId ? [{ proposalId, heroId }] : [],
							publicIntent:
								proposal.kind === 'role-expression'
									? 'Let the summon who holds the scorched route make that knowledge consequential.'
									: 'Let conflicting voices test the isolated crossing without changing the objective.'
						});
						return {
							candidate,
							proposal,
							beat,
							boundHeroId: heroId,
							validation: validateStoryPatchForState(state, candidate)
						};
					});
				});
	const afterAnchor = envelope.anchors.find((entry) => entry.anchorId === slot.afterAnchorId)!;
	const beforeAnchor = envelope.anchors.find((entry) => entry.anchorId === slot.beforeAnchorId)!;
	return {
		runId: state.runId,
		version: state.version,
		eventCursor: state.eventCursor,
		stateHash,
		contentVersion: state.contentVersion,
		envelope: {
			id: envelope.envelopeId,
			title: envelope.title,
			theme: envelope.theme,
			emotionalQuestion: envelope.emotionalQuestion,
			contentVersion: envelope.contentVersion,
			contentHash: envelope.contentHash,
			worldLawCount: envelope.worldLaws.length,
			anchorCount: envelope.anchors.length,
			finaleConstraintCount: envelope.finaleConstraints.length,
			rewardBudgetPoints: envelope.rewardBudget.budgetPoints,
			rewardDeclaredCost: envelope.rewardBudget.declaredCost
		},
		checkpoint: {
			floor,
			missionId: slot.missionId,
			slotId: slot.slotId,
			historyHash,
			completedBeatCount: state.bandStory.history.completedBeatIds.length,
			afterBeat: envelope.beats.find((entry) => entry.beatId === afterAnchor.beatId)!,
			beforeBeat: envelope.beats.find((entry) => entry.beatId === beforeAnchor.beatId)!
		},
		cast: cast.map((member) => ({
			...member,
			role: member.availableProposalIds.length > 0 ? 'route holder' : 'countervoice',
			mind: state.heroes[member.heroId]!.mind
		})),
		options,
		appliedPatch: state.bandStory.appliedPatches.at(-1) ?? null
	};
}

export interface RuntimeStoryPatchOption {
	readonly candidate: StoryPatchCandidate;
	readonly proposal: (typeof TOWER_BAND_01_STORY_ENVELOPE.proposals)[number];
	readonly beat: (typeof TOWER_BAND_01_STORY_ENVELOPE.beats)[number];
	readonly boundHeroId: string | null;
	readonly validation: ReturnType<typeof validateStoryPatchForState>;
}
