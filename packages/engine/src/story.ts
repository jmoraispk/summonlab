import {
	AppliedStoryPatchSchema,
	StoryBeatHistorySchema,
	StoryPatchCandidateSchema,
	StoryPatchCastMemberSchema,
	StoryPatchValidationReportSchema,
	TowerBandStoryEnvelopeSchema,
	type AppliedStoryPatch,
	type StoryBeatHistory,
	type StoryPatchCandidate,
	type StoryPatchCastMember,
	type StoryPatchValidationCheck,
	type StoryPatchValidationCode,
	type StoryPatchValidationReport,
	type TowerBandStoryEnvelope
} from '@summonlab/contracts';
import { evaluateStoryBeatEligibility } from '@summonlab/content';

import { hashCanonical } from './hash.js';

function check(
	code: StoryPatchValidationCode,
	passed: boolean,
	passedSummary: string,
	rejectedSummary: string
): StoryPatchValidationCheck {
	return {
		code,
		status: passed ? 'passed' : 'rejected',
		summary: passed ? passedSummary : rejectedSummary
	};
}

export function validateStoryPatch(
	sourceEnvelope: TowerBandStoryEnvelope,
	sourceHistory: StoryBeatHistory,
	sourceCast: readonly StoryPatchCastMember[],
	sourceCandidate: StoryPatchCandidate
): StoryPatchValidationReport {
	const envelope = TowerBandStoryEnvelopeSchema.parse(sourceEnvelope);
	const history = StoryBeatHistorySchema.parse(sourceHistory);
	const cast = sourceCast.map((member) => StoryPatchCastMemberSchema.parse(member));
	const candidate = StoryPatchCandidateSchema.parse(sourceCandidate);
	const candidateHash = hashCanonical(candidate);
	const currentHistoryHash = hashCanonical(history);
	const slot = envelope.patchSlots.find((entry) => entry.slotId === candidate.slotId);
	const proposals = new Map(envelope.proposals.map((proposal) => [proposal.proposalId, proposal]));
	const anchors = new Map(envelope.anchors.map((anchor) => [anchor.anchorId, anchor]));
	const castById = new Map(cast.map((member) => [member.heroId, member]));
	let historyCausal = true;
	try {
		evaluateStoryBeatEligibility(envelope, history);
	} catch {
		historyCausal = false;
	}

	const envelopeBound =
		candidate.envelopeId === envelope.envelopeId &&
		candidate.envelopeContentHash === envelope.contentHash;
	const historyCurrent = candidate.baseHistoryHash === currentHistoryHash;
	const afterBeatId = slot ? anchors.get(slot.afterAnchorId)?.beatId : undefined;
	const beforeBeatId = slot ? anchors.get(slot.beforeAnchorId)?.beatId : undefined;
	const slotOpen = Boolean(
		slot &&
		historyCausal &&
		history.unlockedFloor >= slot.floor &&
		afterBeatId &&
		history.completedBeatIds.includes(afterBeatId) &&
		beforeBeatId &&
		!history.completedBeatIds.includes(beforeBeatId)
	);
	const existingSlotSelections = slot
		? slot.allowedProposalIds.filter((proposalId) =>
				history.activatedProposalIds.includes(proposalId)
			).length
		: 0;
	const withinSelectionBound = Boolean(
		slot &&
		existingSlotSelections +
			candidate.selectedProposalIds.filter(
				(proposalId) => !history.activatedProposalIds.includes(proposalId)
			).length <=
			slot.maximumSelections
	);
	const selectionsCatalogued = Boolean(
		slot &&
		candidate.selectedProposalIds.every(
			(proposalId) =>
				slot.allowedProposalIds.includes(proposalId) &&
				proposals.get(proposalId)?.missionId === slot.missionId
		)
	);
	const selectionsDormant = candidate.selectedProposalIds.every(
		(proposalId) => !history.activatedProposalIds.includes(proposalId)
	);
	const bindingByProposal = new Map(
		candidate.roleBindings.map((binding) => [binding.proposalId, binding])
	);
	const bindingsMatchKinds = candidate.selectedProposalIds.every((proposalId) => {
		const proposal = proposals.get(proposalId);
		return proposal?.kind === 'role-expression'
			? bindingByProposal.has(proposalId)
			: !bindingByProposal.has(proposalId);
	});
	const boundMembers = candidate.roleBindings.map((binding) => castById.get(binding.heroId));
	const castLiving = boundMembers.every((member) => member?.lifeState === 'active');
	const knowledgeBound = candidate.roleBindings.every((binding) =>
		castById.get(binding.heroId)?.availableProposalIds.includes(binding.proposalId)
	);

	const checks: StoryPatchValidationCheck[] = [
		check(
			'envelope-binding',
			envelopeBound,
			'The candidate names the exact content-addressed first-band envelope.',
			'The candidate envelope id or content hash is unavailable.'
		),
		check(
			'history-causality',
			historyCausal,
			'The canonical beat history satisfies every authored dependency.',
			'The canonical beat history violates an authored dependency.'
		),
		check(
			'stale-history',
			historyCurrent,
			'The candidate is bound to the current canonical history hash.',
			'The candidate was assembled from a stale story history.'
		),
		check(
			'slot-known',
			Boolean(slot),
			'The requested patch slot exists in the envelope.',
			'The requested patch slot is not authored.'
		),
		check(
			'slot-open',
			slotOpen,
			'The opening anchor is complete and the closing anchor has not occurred.',
			'The patch point is not open in the current causal history.'
		),
		check(
			'selection-bound',
			withinSelectionBound,
			'The selection count remains inside the authored slot maximum.',
			'The candidate selects more proposals than the slot permits.'
		),
		check(
			'proposal-catalog',
			selectionsCatalogued,
			'Every selected proposal is catalogued for this mission and slot.',
			'At least one selected proposal is outside this slot or mission.'
		),
		check(
			'proposal-dormant',
			selectionsDormant,
			'Every selected proposal is still dormant in canonical history.',
			'At least one selected proposal is already canonical.'
		),
		check(
			'role-binding',
			bindingsMatchKinds,
			'Role-expression proposals bind exactly one existing cast role; complications bind none.',
			'The candidate role bindings do not match the selected proposal kinds.'
		),
		check(
			'living-cast',
			castLiving,
			'Every authored role is assigned to a living summon.',
			'A bound role has no living summon.'
		),
		check(
			'knowledge-boundary',
			knowledgeBound,
			'Every bound summon is eligible from their own available evidence.',
			'A bound summon would express information they do not hold.'
		),
		check(
			'world-laws',
			true,
			'The patch schema grants no operation over the five fixed world laws.',
			'World-law mutation is forbidden.'
		),
		check(
			'primary-objective',
			true,
			'The patch schema grants no operation over authored primary objectives.',
			'Primary-objective mutation is forbidden.'
		),
		check(
			'arena-truth',
			true,
			'The patch schema cannot create nodes, routes, enemies, or discoveries.',
			'Arena-truth mutation is forbidden.'
		),
		check(
			'reward-budget',
			true,
			`The fixed reward ledger remains ${envelope.rewardBudget.declaredCost} / ${envelope.rewardBudget.budgetPoints} points.`,
			'Reward-budget mutation is forbidden.'
		),
		check(
			'required-anchors',
			true,
			`All ${envelope.anchors.length} immutable anchors remain outside patch authority.`,
			'Required-anchor mutation is forbidden.'
		),
		check(
			'finale-constraints',
			true,
			`All ${envelope.finaleConstraints.length} finale constraints remain mandatory.`,
			'Finale-constraint mutation is forbidden.'
		)
	];
	const rejectionCodes = checks
		.filter((entry) => entry.status === 'rejected')
		.map((entry) => entry.code);
	let resultingHistory: StoryBeatHistory | null = null;
	let activatedBeatIds: string[] = [];
	if (rejectionCodes.length === 0) {
		activatedBeatIds = candidate.selectedProposalIds.map(
			(proposalId) => proposals.get(proposalId)!.beatId
		);
		resultingHistory = StoryBeatHistorySchema.parse({
			...history,
			activatedProposalIds: [...history.activatedProposalIds, ...candidate.selectedProposalIds]
		});
		evaluateStoryBeatEligibility(envelope, resultingHistory);
	}
	const payload = {
		reportVersion: 'story-patch-validation-v1' as const,
		candidateHash,
		accepted: rejectionCodes.length === 0,
		envelopeId: envelope.envelopeId,
		envelopeContentHash: envelope.contentHash,
		slotId: candidate.slotId,
		baseHistoryHash: candidate.baseHistoryHash,
		resultingHistoryHash: resultingHistory ? hashCanonical(resultingHistory) : null,
		selectedProposalIds: [...candidate.selectedProposalIds],
		activatedBeatIds,
		roleBindings: [...candidate.roleBindings],
		checks,
		rejectionCodes
	};
	return StoryPatchValidationReportSchema.parse({
		...payload,
		validationHash: hashCanonical(payload)
	});
}

export function applyValidatedStoryPatch(
	envelope: TowerBandStoryEnvelope,
	history: StoryBeatHistory,
	cast: readonly StoryPatchCastMember[],
	candidate: StoryPatchCandidate,
	appliedEventId: string,
	appliedAt: string
): { readonly history: StoryBeatHistory; readonly patch: AppliedStoryPatch } {
	const validation = validateStoryPatch(envelope, history, cast, candidate);
	if (!validation.accepted || !validation.resultingHistoryHash) {
		throw new Error(`Story patch rejected: ${validation.rejectionCodes.join(', ')}`);
	}
	const nextHistory = StoryBeatHistorySchema.parse({
		...history,
		activatedProposalIds: [...history.activatedProposalIds, ...candidate.selectedProposalIds]
	});
	if (hashCanonical(nextHistory) !== validation.resultingHistoryHash) {
		throw new Error('Accepted story patch history hash diverged');
	}
	const payload = {
		applicationVersion: 'applied-story-patch-v1' as const,
		candidate,
		validation,
		appliedEventId,
		appliedAt
	};
	return {
		history: nextHistory,
		patch: AppliedStoryPatchSchema.parse({ ...payload, patchHash: hashCanonical(payload) })
	};
}
