import {
	STORY_WORKSHOP_FLOOR_RHYTHM,
	STORY_WORKSHOP_PROMPT_VERSION,
	StoryArcProposalSchema,
	StoryWorkshopBriefSchema,
	type StoryArcProposal,
	type StoryWorkshopBrief
} from '@summonlab/contracts';
import { hashCanonical } from '@summonlab/engine';
import { z } from 'zod';

export const STORY_WORKSHOP_SOURCE_VERSION = 'story-workshop-source-v1' as const;
export const STORY_WORKSHOP_REPORT_VERSION = 'story-workshop-report-v1' as const;
export const STORY_WORKSHOP_VERSION = 'story-workshop-v1' as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });
const ModelUsageSchema = z
	.object({
		inputTokens: z.number().int().nonnegative(),
		cachedInputTokens: z.number().int().nonnegative(),
		outputTokens: z.number().int().nonnegative(),
		reasoningTokens: z.number().int().nonnegative(),
		totalTokens: z.number().int().nonnegative()
	})
	.strict();

export const StoryWorkshopReviewCriterionSchema = z.enum([
	'causality',
	'mechanical-fit',
	'emotional-arc',
	'character-agency',
	'production-scope',
	'envelope-compile'
]);

const StoryWorkshopCriterionReviewSchema = z
	.object({
		criterion: StoryWorkshopReviewCriterionSchema,
		verdict: z.enum(['pass', 'concern']),
		note: z.string().trim().min(8).max(280)
	})
	.strict();

export const StoryWorkshopReviewSchema = z
	.object({
		proposalId: z.string().min(1),
		proposalVersion: z.string().min(1),
		status: z.enum(['revise', 'accepted', 'rejected']),
		summary: z.string().trim().min(12).max(360),
		criteria: z
			.array(StoryWorkshopCriterionReviewSchema)
			.length(StoryWorkshopReviewCriterionSchema.options.length)
	})
	.strict()
	.superRefine((review, context) => {
		const criteria = review.criteria.map((criterion) => criterion.criterion);
		if (new Set(criteria).size !== StoryWorkshopReviewCriterionSchema.options.length) {
			context.addIssue({
				code: 'custom',
				path: ['criteria'],
				message: 'A review must assess every criterion exactly once'
			});
		}
		const hasConcern = review.criteria.some((criterion) => criterion.verdict === 'concern');
		if (review.status === 'accepted' && hasConcern) {
			context.addIssue({
				code: 'custom',
				path: ['status'],
				message: 'An accepted proposal cannot retain an unresolved review concern'
			});
		}
		if (review.status === 'revise' && !hasConcern) {
			context.addIssue({
				code: 'custom',
				path: ['status'],
				message: 'A revise decision must identify at least one concern'
			});
		}
	});

const StoryWorkshopGenerationSchema = z
	.object({
		mode: z.enum(['scripted-fixture', 'model']),
		promptVersion: z.literal(STORY_WORKSHOP_PROMPT_VERSION),
		generatorId: z.string().min(1).max(120),
		requestedModel: z.string().min(1).max(120).nullable(),
		resolvedModel: z.string().min(1).max(120).nullable(),
		providerResponseId: z.string().min(1).max(160).nullable(),
		requestHash: HashSchema.nullable(),
		outputHash: HashSchema.nullable(),
		usage: ModelUsageSchema.nullable()
	})
	.strict()
	.superRefine((generation, context) => {
		const providerValues = [
			generation.requestedModel,
			generation.resolvedModel,
			generation.providerResponseId,
			generation.requestHash,
			generation.outputHash,
			generation.usage
		];
		if (generation.mode === 'scripted-fixture' && providerValues.some((value) => value !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'A scripted fixture cannot claim provider or model provenance'
			});
		}
		if (generation.mode === 'model' && providerValues.some((value) => value === null)) {
			context.addIssue({
				code: 'custom',
				message: 'A model generation record requires complete provider provenance'
			});
		}
	});

export const StoryWorkshopSourceSchema = z
	.object({
		schemaVersion: z.literal(STORY_WORKSHOP_SOURCE_VERSION),
		workshopVersion: z.literal(STORY_WORKSHOP_VERSION),
		generatedAt: IsoDateTimeSchema,
		brief: StoryWorkshopBriefSchema,
		generation: StoryWorkshopGenerationSchema,
		proposals: z.array(StoryArcProposalSchema).min(2).max(6),
		reviews: z.array(StoryWorkshopReviewSchema).max(6)
	})
	.strict()
	.superRefine((source, context) => {
		const proposalKeys = source.proposals.map(
			(proposal) => `${proposal.proposalId}@${proposal.proposalVersion}`
		);
		if (new Set(proposalKeys).size !== proposalKeys.length) {
			context.addIssue({
				code: 'custom',
				path: ['proposals'],
				message: 'Proposal ID and version pairs must be unique'
			});
		}

		const proposalIds = new Set(source.proposals.map((proposal) => proposal.proposalId));
		for (const [index, proposal] of source.proposals.entries()) {
			if (proposal.supersedesProposalId && !proposalIds.has(proposal.supersedesProposalId)) {
				context.addIssue({
					code: 'custom',
					path: ['proposals', index, 'supersedesProposalId'],
					message: 'A proposal revision must point to a retained prior proposal'
				});
			}
		}

		const reviewed = new Set<string>();
		for (const [index, review] of source.reviews.entries()) {
			const key = `${review.proposalId}@${review.proposalVersion}`;
			if (!proposalKeys.includes(key)) {
				context.addIssue({
					code: 'custom',
					path: ['reviews', index],
					message: 'A review must reference an exact retained proposal version'
				});
			}
			if (reviewed.has(key)) {
				context.addIssue({
					code: 'custom',
					path: ['reviews', index],
					message: 'A proposal version may have only one final review decision'
				});
			}
			reviewed.add(key);
		}

		if (source.reviews.filter((review) => review.status === 'accepted').length > 1) {
			context.addIssue({
				code: 'custom',
				path: ['reviews'],
				message: 'Only one proposal version may be accepted for compilation'
			});
		}
	});

const StoryWorkshopValidationCheckSchema = z
	.object({
		checkId: z.enum([
			'brief-binding',
			'five-floor-range',
			'floor-rhythm',
			'objective-catalog',
			'mechanic-catalog',
			'enemy-duty-catalog',
			'world-law-catalog',
			'anchor-identity',
			'reward-bound',
			'production-bound'
		]),
		passed: z.boolean(),
		detail: z.string().min(1)
	})
	.strict();

const StoryWorkshopProposalReportSchema = z
	.object({
		proposal: StoryArcProposalSchema,
		proposalHash: HashSchema,
		validationChecks: z.array(StoryWorkshopValidationCheckSchema).length(10),
		validForReview: z.boolean(),
		productionWarnings: z.array(z.string()),
		reviewStatus: z.enum(['pending', 'revise', 'accepted', 'rejected']),
		review: StoryWorkshopReviewSchema.nullable(),
		readyForCompilation: z.boolean()
	})
	.strict();

export const StoryWorkshopReportSchema = z
	.object({
		schemaVersion: z.literal(STORY_WORKSHOP_REPORT_VERSION),
		workshopVersion: z.literal(STORY_WORKSHOP_VERSION),
		generatedAt: IsoDateTimeSchema,
		brief: StoryWorkshopBriefSchema,
		briefHash: HashSchema,
		generation: StoryWorkshopGenerationSchema,
		authorityBoundary: z
			.object({
				developmentOnly: z.literal(true),
				proposalsAreCanonical: z.literal(false),
				modelMayMutateRuntime: z.literal(false),
				acceptedContentRequiresDeveloperReview: z.literal(true),
				acceptedContentRequiresEnvelopeCompilation: z.literal(true)
			})
			.strict(),
		status: z.enum(['generated', 'under-review', 'accepted-for-compilation', 'blocked']),
		summary: z
			.object({
				proposalCount: z.number().int().min(2).max(6),
				validForReviewCount: z.number().int().nonnegative(),
				pendingReviewCount: z.number().int().nonnegative(),
				acceptedCount: z.number().int().min(0).max(1),
				readyForCompilationCount: z.number().int().min(0).max(1)
			})
			.strict(),
		proposals: z.array(StoryWorkshopProposalReportSchema).min(2).max(6),
		reportHash: HashSchema
	})
	.strict();

export type StoryWorkshopSource = z.infer<typeof StoryWorkshopSourceSchema>;
export type StoryWorkshopReport = z.infer<typeof StoryWorkshopReportSchema>;

function check(
	checkId: z.infer<typeof StoryWorkshopValidationCheckSchema>['checkId'],
	passed: boolean,
	detail: string
) {
	return StoryWorkshopValidationCheckSchema.parse({ checkId, passed, detail });
}

function validateProposal(brief: StoryWorkshopBrief, proposal: StoryArcProposal) {
	const mechanics = new Map(
		brief.mechanicCatalog.map((mechanic) => [mechanic.mechanicId, mechanic])
	);
	const dutyIds = new Set(brief.enemyFamily.dutyCatalog.map((duty) => duty.dutyId));
	const lawIds = new Set(brief.worldBible.laws.map((law) => law.lawId));
	const objectives = new Set(brief.productionConstraints.permittedObjectiveKinds);
	const floors = proposal.floors.map((floor) => floor.floor);
	const expectedFloors = Array.from(
		{ length: 5 },
		(_, index) => brief.targetBand.firstFloor + index
	);
	const floorRhythm = proposal.floors.map((floor) => floor.narrativeJob);
	const referencedMechanics = proposal.floors.flatMap((floor) => floor.mechanicIds);
	const referencedDuties = proposal.floors.flatMap((floor) => floor.enemyDutyIds);
	const anchorIds = proposal.floors.map((floor) => floor.requiredAnchor.anchorId);

	const checks = [
		check(
			'brief-binding',
			proposal.briefId === brief.briefId,
			'Proposal binds the exact versioned workshop brief.'
		),
		check(
			'five-floor-range',
			floors.every((floor, index) => floor === expectedFloors[index]) &&
				proposal.floors.every((floor, index) => floor.floorInBand === index + 1),
			'Floors are consecutive and occupy the requested five-floor band.'
		),
		check(
			'floor-rhythm',
			floorRhythm.every((job, index) => job === STORY_WORKSHOP_FLOOR_RHYTHM[index]),
			'Arc follows setup, complication, division, consequence, and payoff.'
		),
		check(
			'objective-catalog',
			proposal.floors.every((floor) => objectives.has(floor.primaryObjectiveKind)),
			'Every primary objective uses the permitted objective catalog.'
		),
		check(
			'mechanic-catalog',
			referencedMechanics.every((mechanicId) => mechanics.has(mechanicId)),
			'Every mechanic reference exists in the brief.'
		),
		check(
			'enemy-duty-catalog',
			referencedDuties.every((dutyId) => dutyIds.has(dutyId)),
			'Every enemy duty reference exists in the brief.'
		),
		check(
			'world-law-catalog',
			proposal.worldLawIds.every((lawId) => lawIds.has(lawId)) &&
				new Set(proposal.worldLawIds).size === proposal.worldLawIds.length,
			'Every cited world law is unique and immutable in the supplied bible.'
		),
		check(
			'anchor-identity',
			new Set(anchorIds).size === anchorIds.length,
			'Each floor contributes a distinct required anchor.'
		),
		check(
			'reward-bound',
			proposal.rewardBudgetPoints <= brief.rewardBudgetPoints,
			'Proposed rewards stay inside the authored band budget.'
		),
		check(
			'production-bound',
			proposal.newNamedLocations.length <= brief.productionConstraints.maxNewNamedLocations &&
				proposal.newEnemyPolicyIds.length <= brief.productionConstraints.maxNewEnemyPolicies,
			'New location and enemy-policy counts stay inside production scope.'
		)
	];
	const prototypeMechanics = [
		...new Set(
			referencedMechanics.filter(
				(mechanicId) => mechanics.get(mechanicId)?.productionStatus === 'prototype'
			)
		)
	];
	return {
		checks,
		validForReview: checks.every((entry) => entry.passed),
		productionWarnings: prototypeMechanics.map(
			(mechanicId) => `Prototype mechanic requires production proof: ${mechanicId}`
		)
	};
}

export function createStoryWorkshopReport(input: StoryWorkshopSource): StoryWorkshopReport {
	const source = StoryWorkshopSourceSchema.parse(input);
	const reviewByProposal = new Map(
		source.reviews.map((review) => [`${review.proposalId}@${review.proposalVersion}`, review])
	);
	const proposals = source.proposals.map((proposal) => {
		const validation = validateProposal(source.brief, proposal);
		const review =
			reviewByProposal.get(`${proposal.proposalId}@${proposal.proposalVersion}`) ?? null;
		const reviewStatus = review?.status ?? 'pending';
		return {
			proposal,
			proposalHash: hashCanonical(proposal),
			validationChecks: validation.checks,
			validForReview: validation.validForReview,
			productionWarnings: validation.productionWarnings,
			reviewStatus,
			review,
			readyForCompilation:
				validation.validForReview &&
				reviewStatus === 'accepted' &&
				validation.productionWarnings.length === 0
		};
	});
	const validForReviewCount = proposals.filter((proposal) => proposal.validForReview).length;
	const pendingReviewCount = proposals.filter(
		(proposal) => proposal.reviewStatus === 'pending'
	).length;
	const acceptedCount = proposals.filter((proposal) => proposal.reviewStatus === 'accepted').length;
	const readyForCompilationCount = proposals.filter(
		(proposal) => proposal.readyForCompilation
	).length;
	const status = proposals.some((proposal) => !proposal.validForReview)
		? 'blocked'
		: readyForCompilationCount === 1
			? 'accepted-for-compilation'
			: source.reviews.length > 0
				? 'under-review'
				: 'generated';
	const unsigned = {
		schemaVersion: STORY_WORKSHOP_REPORT_VERSION,
		workshopVersion: STORY_WORKSHOP_VERSION,
		generatedAt: source.generatedAt,
		brief: source.brief,
		briefHash: hashCanonical(source.brief),
		generation: source.generation,
		authorityBoundary: {
			developmentOnly: true,
			proposalsAreCanonical: false,
			modelMayMutateRuntime: false,
			acceptedContentRequiresDeveloperReview: true,
			acceptedContentRequiresEnvelopeCompilation: true
		},
		status,
		summary: {
			proposalCount: proposals.length,
			validForReviewCount,
			pendingReviewCount,
			acceptedCount,
			readyForCompilationCount
		},
		proposals
	};
	return StoryWorkshopReportSchema.parse({ ...unsigned, reportHash: hashCanonical(unsigned) });
}
