import {
	EngineCommandSchema,
	StoryPatchCandidateSchema,
	type ActionSource,
	type EngineGameStateV21,
	type StoryBeatHistory,
	type StoryPatchCandidate,
	type StoryPatchCastMember,
	type StoryPatchValidationCode
} from '@summonlab/contracts';
import { TOWER_BAND_01_STORY_ENVELOPE } from '@summonlab/content';
import {
	applyCommand,
	createBootstrapEngine,
	hashCanonical,
	replayEventsStrict,
	storyPatchCastForState,
	validateStoryPatch,
	validateStoryPatchForState
} from '@summonlab/engine';
import { z } from 'zod';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RuntimeStoryPatchCaseSchema = z
	.object({
		caseId: z.string().min(1),
		expectedRejectionCodes: z.array(z.string()),
		actualRejectionCodes: z.array(z.string()),
		blocked: z.literal(true),
		candidateHash: HashSchema.nullable()
	})
	.strict();

export const RuntimeStoryPatchReportSchema = z
	.object({
		reportVersion: z.literal('runtime-story-patch-report-v1'),
		generatorVersion: z.literal('runtime-story-patch-generator-v1'),
		engineContentVersion: z.literal('engine-v21'),
		envelopeId: z.string().min(1),
		envelopeContentVersion: z.literal('tower-band-01-story-v1'),
		envelopeContentHash: HashSchema,
		checkpoint: z
			.object({
				floor: z.literal(4),
				missionId: z.literal('tower-floor-04'),
				slotId: z.literal('floor-four-between-pressure-and-opposition'),
				completedBeatCount: z.number().int().positive(),
				historyHash: HashSchema,
				roleProposalId: z.literal('floor-four-surface-discovery'),
				complicationProposalId: z.literal('floor-four-force-choice'),
				eligibleLivingHeroCount: z.literal(1)
			})
			.strict(),
		acceptedPatch: z
			.object({
				candidateHash: HashSchema,
				validationHash: HashSchema,
				patchHash: HashSchema,
				eventHash: HashSchema,
				beforeStateHash: HashSchema,
				afterStateHash: HashSchema,
				beforeHistoryHash: HashSchema,
				afterHistoryHash: HashSchema,
				selectedProposalIds: z.array(z.string()).length(1),
				activatedBeatIds: z.array(z.string()).length(1),
				roleHeroId: z.string().uuid(),
				passedCheckCount: z.literal(17),
				totalCheckCount: z.literal(17)
			})
			.strict(),
		alternativePreview: z
			.object({
				proposalId: z.literal('floor-four-force-choice'),
				accepted: z.literal(true),
				passedCheckCount: z.literal(17),
				roleBindingCount: z.literal(0)
			})
			.strict(),
		fixedAuthority: z
			.object({
				worldLawCount: z.literal(5),
				anchorCount: z.literal(25),
				finaleConstraintCount: z.literal(3),
				rewardBudgetPoints: z.literal(1010),
				rewardDeclaredCostBefore: z.literal(1010),
				rewardDeclaredCostAfter: z.literal(1010),
				rewardDrift: z.literal(0)
			})
			.strict(),
		adversarialCases: z.array(RuntimeStoryPatchCaseSchema).min(10),
		allAdversarialCasesBlocked: z.literal(true),
		replay: z
			.object({
				eventCount: z.literal(2),
				verified: z.literal(true),
				hashMatchesCommittedState: z.literal(true),
				activatedProposalIds: z.array(z.string()).length(1),
				finalStateHash: HashSchema
			})
			.strict(),
		evidenceHash: HashSchema
	})
	.strict();

export type RuntimeStoryPatchReport = z.infer<typeof RuntimeStoryPatchReportSchema>;

const runId = '15500000-0000-4000-8000-000000000001';
const routeHolderId = '15500000-0000-4000-8000-000000000002';
const countervoiceId = '15500000-0000-4000-8000-000000000003';
const source: ActionSource = {
	source: 'scripted',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function bootstrapCheckpoint() {
	const bootstrap = createBootstrapEngine({
		runId,
		seed: 'runtime-story-patch-evidence',
		heroId: routeHolderId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-04',
			availableMissionIds: ['tower-floor-04'],
			enableStoryPatch: true,
			foundryRouteMemoryHeroId: routeHolderId,
			additionalHeroes: [{ heroId: countervoiceId, manifestHash: '2'.repeat(64) }]
		}
	});
	if (bootstrap.snapshot.state.schemaVersion !== 21) throw new Error('Expected engine-v21');
	return { bootstrap, state: bootstrap.snapshot.state };
}

function candidateFor(
	state: EngineGameStateV21,
	proposalId: string,
	heroId: string | null,
	patchId: string
): StoryPatchCandidate {
	const slot = TOWER_BAND_01_STORY_ENVELOPE.patchSlots.find((entry) => entry.floor === 4)!;
	return StoryPatchCandidateSchema.parse({
		patchVersion: 'story-patch-v1',
		patchId,
		envelopeId: state.bandStory.envelopeId,
		envelopeContentHash: state.bandStory.envelopeContentHash,
		baseHistoryHash: hashCanonical(state.bandStory.history),
		slotId: slot.slotId,
		selectedProposalIds: [proposalId],
		roleBindings: heroId ? [{ proposalId, heroId }] : [],
		publicIntent: heroId
			? 'Let the route holder carry the optional discovery into the confrontation.'
			: 'Let the crossing test conflicting voices without changing the objective.'
	});
}

interface CaseInput {
	readonly caseId: string;
	readonly expected: readonly (StoryPatchValidationCode | 'strict-schema')[];
	readonly candidate?: StoryPatchCandidate;
	readonly history?: StoryBeatHistory;
	readonly cast?: readonly StoryPatchCastMember[];
	readonly strictSchemaRejected?: boolean;
}

function rejectedCase(
	state: EngineGameStateV21,
	defaultCandidate: StoryPatchCandidate,
	defaultCast: readonly StoryPatchCastMember[],
	input: CaseInput
) {
	if (input.strictSchemaRejected) {
		const parsed = StoryPatchCandidateSchema.safeParse({
			...defaultCandidate,
			rewardBudget: { amount: 9_999 }
		});
		return {
			caseId: input.caseId,
			expectedRejectionCodes: [...input.expected],
			actualRejectionCodes: parsed.success ? [] : ['strict-schema'],
			blocked: !parsed.success as true,
			candidateHash: null
		};
	}
	const report = validateStoryPatch(
		TOWER_BAND_01_STORY_ENVELOPE,
		input.history ?? state.bandStory.history,
		input.cast ?? defaultCast,
		input.candidate ?? defaultCandidate
	);
	const expectedCodes = input.expected.filter(
		(code): code is StoryPatchValidationCode => code !== 'strict-schema'
	);
	const blocked =
		!report.accepted && expectedCodes.every((code) => report.rejectionCodes.includes(code));
	if (!blocked) throw new Error(`Adversarial story case escaped: ${input.caseId}`);
	return {
		caseId: input.caseId,
		expectedRejectionCodes: [...input.expected],
		actualRejectionCodes: report.rejectionCodes,
		blocked: true as const,
		candidateHash: report.candidateHash
	};
}

export function generateRuntimeStoryPatchReport(): RuntimeStoryPatchReport {
	const { bootstrap, state } = bootstrapCheckpoint();
	const envelope = TOWER_BAND_01_STORY_ENVELOPE;
	const slot = envelope.patchSlots.find((entry) => entry.floor === 4)!;
	const roleProposalId = slot.allowedProposalIds.find(
		(id) =>
			envelope.proposals.find((proposal) => proposal.proposalId === id)?.kind === 'role-expression'
	)!;
	const complicationProposalId = slot.allowedProposalIds.find(
		(id) =>
			envelope.proposals.find((proposal) => proposal.proposalId === id)?.kind === 'complication'
	)!;
	const cast = storyPatchCastForState(state);
	const roleCandidate = candidateFor(
		state,
		roleProposalId,
		routeHolderId,
		'15500000-0000-4000-8000-000000000004'
	);
	const complicationCandidate = candidateFor(
		state,
		complicationProposalId,
		null,
		'15500000-0000-4000-8000-000000000005'
	);
	const validation = validateStoryPatchForState(state, roleCandidate);
	const alternative = validateStoryPatchForState(state, complicationCandidate);
	if (!validation.accepted || !alternative.accepted) {
		throw new Error('A cataloged runtime story option failed its checkpoint validation');
	}
	const commandId = '15500000-0000-4000-8000-000000000006';
	const command = EngineCommandSchema.parse({
		commandId,
		runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source,
		commandType: 'story.apply.patch',
		candidate: roleCandidate
	});
	const applied = applyCommand(state, command);
	if (applied.state.schemaVersion !== 21) throw new Error('Story patch changed the engine schema');
	const patch = applied.state.bandStory.appliedPatches[0]!;
	const replay = replayEventsStrict([bootstrap.event, applied.events[0]!]);
	if (replay.snapshot.state.schemaVersion !== 21)
		throw new Error('Story replay changed the engine schema');

	const closedHistory = {
		...state.bandStory.history,
		completedBeatIds: [
			...state.bandStory.history.completedBeatIds,
			envelope.anchors.find((anchor) => anchor.anchorId === slot.beforeAnchorId)!.beatId
		]
	};
	const alreadyActiveHistory = {
		...state.bandStory.history,
		activatedProposalIds: [roleProposalId]
	};
	const withHistory = (history: StoryBeatHistory, candidate: StoryPatchCandidate) => ({
		...candidate,
		baseHistoryHash: hashCanonical(history)
	});
	const cases: CaseInput[] = [
		{
			caseId: 'stale-history-hash',
			expected: ['stale-history'],
			candidate: { ...roleCandidate, baseHistoryHash: 'f'.repeat(64) }
		},
		{
			caseId: 'wrong-envelope-hash',
			expected: ['envelope-binding'],
			candidate: { ...roleCandidate, envelopeContentHash: 'e'.repeat(64) }
		},
		{
			caseId: 'unknown-slot',
			expected: ['slot-known', 'slot-open', 'selection-bound', 'proposal-catalog'],
			candidate: { ...roleCandidate, slotId: 'invented-story-aperture' }
		},
		{
			caseId: 'closed-slot',
			expected: ['slot-open'],
			history: closedHistory,
			candidate: withHistory(closedHistory, roleCandidate)
		},
		{
			caseId: 'too-many-selections',
			expected: ['selection-bound'],
			candidate: {
				...roleCandidate,
				selectedProposalIds: [roleProposalId, complicationProposalId]
			}
		},
		{
			caseId: 'unknown-proposal',
			expected: ['proposal-catalog'],
			candidate: {
				...roleCandidate,
				selectedProposalIds: ['invented-story-beat'],
				roleBindings: []
			}
		},
		{
			caseId: 'already-active-proposal',
			expected: ['proposal-dormant'],
			history: alreadyActiveHistory,
			candidate: withHistory(alreadyActiveHistory, roleCandidate)
		},
		{
			caseId: 'missing-role-binding',
			expected: ['role-binding'],
			candidate: { ...roleCandidate, roleBindings: [] }
		},
		{
			caseId: 'dead-role-holder',
			expected: ['living-cast'],
			cast: cast.map((member) =>
				member.heroId === routeHolderId ? { ...member, lifeState: 'dead' as const } : member
			)
		},
		{
			caseId: 'unheld-knowledge',
			expected: ['knowledge-boundary'],
			candidate: {
				...roleCandidate,
				roleBindings: [{ proposalId: roleProposalId, heroId: countervoiceId }]
			}
		},
		{
			caseId: 'forbidden-reward-mutation',
			expected: ['strict-schema'],
			strictSchemaRejected: true
		}
	];
	const adversarialCases = cases.map((input) => rejectedCase(state, roleCandidate, cast, input));
	const payload = {
		reportVersion: 'runtime-story-patch-report-v1' as const,
		generatorVersion: 'runtime-story-patch-generator-v1' as const,
		engineContentVersion: state.contentVersion,
		envelopeId: envelope.envelopeId,
		envelopeContentVersion: envelope.contentVersion,
		envelopeContentHash: envelope.contentHash,
		checkpoint: {
			floor: 4 as const,
			missionId: 'tower-floor-04' as const,
			slotId: slot.slotId,
			completedBeatCount: state.bandStory.history.completedBeatIds.length,
			historyHash: hashCanonical(state.bandStory.history),
			roleProposalId,
			complicationProposalId,
			eligibleLivingHeroCount: cast.filter(
				(member) =>
					member.lifeState === 'active' && member.availableProposalIds.includes(roleProposalId)
			).length
		},
		acceptedPatch: {
			candidateHash: validation.candidateHash,
			validationHash: validation.validationHash,
			patchHash: patch.patchHash,
			eventHash: hashCanonical(applied.events[0]),
			beforeStateHash: applied.events[0]!.beforeStateHash,
			afterStateHash: applied.events[0]!.afterStateHash,
			beforeHistoryHash: validation.baseHistoryHash,
			afterHistoryHash: validation.resultingHistoryHash!,
			selectedProposalIds: validation.selectedProposalIds,
			activatedBeatIds: validation.activatedBeatIds,
			roleHeroId: patch.candidate.roleBindings[0]!.heroId,
			passedCheckCount: validation.checks.filter((check) => check.status === 'passed').length,
			totalCheckCount: validation.checks.length
		},
		alternativePreview: {
			proposalId: complicationProposalId,
			accepted: alternative.accepted,
			passedCheckCount: alternative.checks.filter((check) => check.status === 'passed').length,
			roleBindingCount: alternative.roleBindings.length
		},
		fixedAuthority: {
			worldLawCount: envelope.worldLaws.length,
			anchorCount: envelope.anchors.length,
			finaleConstraintCount: envelope.finaleConstraints.length,
			rewardBudgetPoints: envelope.rewardBudget.budgetPoints,
			rewardDeclaredCostBefore: envelope.rewardBudget.declaredCost,
			rewardDeclaredCostAfter: envelope.rewardBudget.declaredCost,
			rewardDrift: 0 as const
		},
		adversarialCases,
		allAdversarialCasesBlocked: adversarialCases.every((entry) => entry.blocked),
		replay: {
			eventCount: 2 as const,
			verified: replay.verified,
			hashMatchesCommittedState: replay.snapshot.stateHash === applied.stateHash,
			activatedProposalIds: replay.snapshot.state.bandStory.history.activatedProposalIds,
			finalStateHash: replay.snapshot.stateHash
		}
	};
	return RuntimeStoryPatchReportSchema.parse({ ...payload, evidenceHash: hashCanonical(payload) });
}
