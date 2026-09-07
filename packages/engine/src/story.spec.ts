import {
	EngineCommandSchema,
	StoryPatchCandidateSchema,
	type ActionSource,
	type EngineGameStateV21,
	type StoryPatchCandidate
} from '@summonlab/contracts';
import { TOWER_BAND_01_STORY_ENVELOPE } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	applyCommand,
	createBootstrapEngine,
	hashCanonical,
	replayEventsStrict,
	storyPatchCastForState,
	validateStoryPatch,
	validateStoryPatchForState
} from './index.js';

const runId = '15000000-0000-4000-8000-000000000001';
const informedHeroId = '15000000-0000-4000-8000-000000000002';
const otherHeroId = '15000000-0000-4000-8000-000000000003';
const source: ActionSource = {
	source: 'scripted',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function checkpoint() {
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'story-patch-runtime-proof',
		heroId: informedHeroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-04',
			availableMissionIds: ['tower-floor-04'],
			enableStoryPatch: true,
			foundryRouteMemoryHeroId: informedHeroId,
			additionalHeroes: [{ heroId: otherHeroId, manifestHash: '2'.repeat(64) }]
		}
	});
	if (bootstrap.snapshot.state.schemaVersion !== 21) throw new Error('Expected engine-v21');
	return { bootstrap, state: bootstrap.snapshot.state };
}

function roleCandidate(state: EngineGameStateV21): StoryPatchCandidate {
	const slot = TOWER_BAND_01_STORY_ENVELOPE.patchSlots.find((entry) => entry.floor === 4)!;
	const proposalId = slot.allowedProposalIds.find(
		(id) =>
			TOWER_BAND_01_STORY_ENVELOPE.proposals.find((proposal) => proposal.proposalId === id)
				?.kind === 'role-expression'
	)!;
	return StoryPatchCandidateSchema.parse({
		patchVersion: 'story-patch-v1',
		patchId: '15000000-0000-4000-8000-000000000004',
		envelopeId: state.bandStory.envelopeId,
		envelopeContentHash: state.bandStory.envelopeContentHash,
		baseHistoryHash: hashCanonical(state.bandStory.history),
		slotId: slot.slotId,
		selectedProposalIds: [proposalId],
		roleBindings: [{ proposalId, heroId: informedHeroId }],
		publicIntent:
			'Let the summon who retained the scorched route make the optional discovery consequential.'
	});
}

describe('runtime story patches', () => {
	it('accepts one cataloged, knowledge-safe role patch and replays it exactly', () => {
		const { bootstrap, state } = checkpoint();
		const candidate = roleCandidate(state);
		const preview = validateStoryPatchForState(state, candidate);
		expect(preview.accepted).toBe(true);
		expect(preview.rejectionCodes).toEqual([]);
		expect(preview.checks).toHaveLength(17);
		expect(preview.checks.filter((entry) => entry.status === 'passed')).toHaveLength(17);

		const command = EngineCommandSchema.parse({
			commandId: '15000000-0000-4000-8000-000000000005',
			runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: '15000000-0000-4000-8000-000000000005',
			source,
			commandType: 'story.apply.patch',
			candidate
		});
		const applied = applyCommand(state, command);
		expect(applied.events[0]!.eventType).toBe('story.patch.applied');
		expect(applied.state.schemaVersion).toBe(21);
		if (applied.state.schemaVersion !== 21) throw new Error('Expected engine-v21');
		expect(applied.state.bandStory.history.activatedProposalIds).toEqual(
			candidate.selectedProposalIds
		);
		expect(applied.state.bandStory.appliedPatches[0]!.validation.accepted).toBe(true);

		const replay = replayEventsStrict([bootstrap.event, applied.events[0]!]);
		expect(replay.snapshot.stateHash).toBe(applied.stateHash);
		expect(replay.verified).toBe(true);
	});

	it('rejects stale, unheld, and authority-expanding candidates before state mutation', () => {
		const { state } = checkpoint();
		const candidate = roleCandidate(state);
		const stale = validateStoryPatchForState(state, {
			...candidate,
			baseHistoryHash: 'f'.repeat(64)
		});
		expect(stale.accepted).toBe(false);
		expect(stale.rejectionCodes).toContain('stale-history');

		const unheld = validateStoryPatchForState(state, {
			...candidate,
			roleBindings: [{ proposalId: candidate.selectedProposalIds[0]!, heroId: otherHeroId }]
		});
		expect(unheld.accepted).toBe(false);
		expect(unheld.rejectionCodes).toContain('knowledge-boundary');

		expect(
			StoryPatchCandidateSchema.safeParse({ ...candidate, rewardBudget: { amount: 9_999 } }).success
		).toBe(false);
		expect(
			storyPatchCastForState(state)
				.find((member) => member.heroId === otherHeroId)
				?.availableProposalIds.includes(candidate.selectedProposalIds[0]!)
		).toBe(false);
	});

	it('counts already activated slot proposals against the authored maximum', () => {
		const { state } = checkpoint();
		const role = roleCandidate(state);
		const history = {
			...state.bandStory.history,
			activatedProposalIds: [role.selectedProposalIds[0]!]
		};
		const complication = StoryPatchCandidateSchema.parse({
			...role,
			patchId: '15000000-0000-4000-8000-000000000006',
			baseHistoryHash: hashCanonical(history),
			selectedProposalIds: ['floor-four-force-choice'],
			roleBindings: []
		});
		const report = validateStoryPatch(
			TOWER_BAND_01_STORY_ENVELOPE,
			history,
			storyPatchCastForState(state),
			complication
		);
		expect(report.accepted).toBe(false);
		expect(report.rejectionCodes).toContain('selection-bound');
	});
});
