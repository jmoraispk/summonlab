import { z } from 'zod';

export const EQUIPMENT_PRODUCTION_ROOT =
	'assets/equipment/experiments/material-equipment-v1' as const;

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,119}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
const FamilySchema = z.enum(['metal', 'wood', 'hide-scale', 'cloth-fibre']);
const SlotSchema = z.enum(['head', 'torso', 'legs', 'boots']);
const NonEmptyTextSchema = z.string().trim().min(1).max(2_000);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });

const RepositoryPathSchema = z
	.string()
	.min(1)
	.max(500)
	.refine((value) => !value.startsWith('/') && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths cannot contain empty, current, or parent-directory segments' }
	);

const EquipmentPathSchema = RepositoryPathSchema.refine(
	(value) => value.startsWith(`${EQUIPMENT_PRODUCTION_ROOT}/`),
	{ message: `Path must remain under ${EQUIPMENT_PRODUCTION_ROOT}` }
);

function equipmentArtifactPath(directory: string, extension: string) {
	return EquipmentPathSchema.refine(
		(value) =>
			value.startsWith(`${EQUIPMENT_PRODUCTION_ROOT}/${directory}/`) && value.endsWith(extension),
		{ message: `Expected an Equipment ${directory} ${extension} path` }
	);
}

const CandidatePathSchema = equipmentArtifactPath('candidates', '.png');
const ResultPathSchema = equipmentArtifactPath('results', '.json');
const ReviewPathSchema = equipmentArtifactPath('reviews', '.json');
const ProfilePathSchema = equipmentArtifactPath('visual-profile', '.json');
const TargetPathSchema = equipmentArtifactPath('targets', '.json');
const AssignmentPathSchema = equipmentArtifactPath('assignments', '.json');
const RunArtifactPathSchema = equipmentArtifactPath('runs', '.json');

const IsolatedCanvasSchema = z
	.object({
		width: z.literal(1024),
		height: z.literal(1024),
		mediaType: z.literal('image/png'),
		safeMarginPercent: z.literal(8)
	})
	.strict();

const FullSetCanvasSchema = z
	.object({
		width: z.literal(1024),
		height: z.literal(1536),
		mediaType: z.literal('image/png'),
		safeMarginPercent: z.literal(8)
	})
	.strict();

const ReferenceSchema = z
	.object({
		path: RepositoryPathSchema,
		contentHash: HashSchema,
		purpose: NonEmptyTextSchema
	})
	.strict();

const OutputPathsSchema = z
	.object({
		candidatePath: CandidatePathSchema,
		resultPath: ResultPathSchema
	})
	.strict();

const EquipmentStyleSchema = z
	.object({
		medium: NonEmptyTextSchema,
		construction: NonEmptyTextSchema,
		materialResponse: NonEmptyTextSchema,
		lighting: NonEmptyTextSchema,
		background: NonEmptyTextSchema
	})
	.strict();

const IsolatedPresentationProfileSchema = z
	.object({
		mode: z.literal('isolated-item-or-piece'),
		subject: z.literal('one-complete-object-or-required-pair'),
		composition: NonEmptyTextSchema,
		canvas: IsolatedCanvasSchema
	})
	.strict();

const FullSetPresentationProfileSchema = z
	.object({
		mode: z.literal('complete-armour-set'),
		subject: z.literal('featureless-charcoal-display-form'),
		composition: NonEmptyTextSchema,
		canvas: FullSetCanvasSchema
	})
	.strict();

const DependentPiecePresentationProfileSchema = z
	.object({
		mode: z.literal('dependent-armour-piece'),
		subject: z.literal('one-matching-object-or-required-pair'),
		composition: NonEmptyTextSchema,
		canvas: IsolatedCanvasSchema,
		continuityRequirements: z.array(SlugSchema).min(1).max(20)
	})
	.strict();

export const EquipmentVisualProfileSchema = z
	.object({
		schemaVersion: z.literal('equipment-visual-profile-v1'),
		profileId: SlugSchema,
		status: z.literal('approval-candidate'),
		craftsmanship: z
			.object({
				grade: z.literal('Standard'),
				rankAdjustment: z.literal(0)
			})
			.strict(),
		style: EquipmentStyleSchema,
		isolatedPresentation: IsolatedPresentationProfileSchema,
		fullSetPresentation: FullSetPresentationProfileSchema,
		dependentPiecePresentation: DependentPiecePresentationProfileSchema,
		equipmentClassDefaults: z
			.array(
				z
					.object({
						equipmentClass: SlugSchema,
						description: NonEmptyTextSchema
					})
					.strict()
			)
			.min(1)
			.max(30),
		references: z.array(ReferenceSchema).min(1).max(20),
		negativeConstraints: z.array(SlugSchema).min(1).max(50)
	})
	.strict();

export const EquipmentVisualProfileAcceptanceSchema = z
	.object({
		schemaVersion: z.literal('equipment-visual-profile-acceptance-v1'),
		acceptanceId: SlugSchema,
		profileId: SlugSchema,
		profilePath: ProfilePathSchema,
		profileCanonicalSha256: HashSchema,
		decision: z.literal('accepted'),
		reviewer: NonEmptyTextSchema.max(120),
		acceptedAt: IsoDateTimeSchema
	})
	.strict();

const ConsistencySourceSchema = z
	.object({
		targetId: SlugSchema,
		candidatePath: CandidatePathSchema,
		candidateSha256: HashSchema,
		reviewReceiptPath: ReviewPathSchema,
		reviewReceiptCanonicalSha256: HashSchema
	})
	.strict();

const TargetPresentationSchema = z.discriminatedUnion('mode', [
	z
		.object({
			mode: z.literal('isolated-item'),
			subject: z.literal('one-complete-object-or-required-pair'),
			composition: NonEmptyTextSchema,
			canvas: IsolatedCanvasSchema,
			negativeConstraints: z.array(SlugSchema).min(1).max(50)
		})
		.strict(),
	z
		.object({
			mode: z.literal('complete-armour-set'),
			subject: z.literal('featureless-charcoal-display-form'),
			composition: NonEmptyTextSchema,
			canvas: FullSetCanvasSchema,
			negativeConstraints: z.array(SlugSchema).min(1).max(50)
		})
		.strict(),
	z
		.object({
			mode: z.literal('dependent-armour-piece'),
			subject: z.literal('one-matching-object-or-required-pair'),
			composition: NonEmptyTextSchema,
			canvas: IsolatedCanvasSchema,
			negativeConstraints: z.array(SlugSchema).min(1).max(50)
		})
		.strict()
]);

const AcceptanceCriterionSchema = z
	.object({
		criterionId: SlugSchema,
		category: z.enum([
			'canvas-and-framing',
			'object-count',
			'equipment-silhouette',
			'structural-plausibility',
			'material-dominance',
			'material-cue-strength',
			'bounded-rank-behaviour',
			'style-cohesion',
			'negative-constraint-safety',
			'source-continuity'
		]),
		description: NonEmptyTextSchema,
		required: z.literal(true)
	})
	.strict();

export const EquipmentImageTargetSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-target-v1'),
		targetId: SlugSchema,
		productionId: SlugSchema,
		profileId: SlugSchema,
		manifestCanonicalSha256: HashSchema,
		allocationCanonicalSha256: HashSchema,
		profileCanonicalSha256: HashSchema,
		profileAcceptanceCanonicalSha256: HashSchema,
		material: z
			.object({
				id: SlugSchema,
				name: NonEmptyTextSchema.max(120),
				family: FamilySchema,
				rank: RankSchema,
				craftsmanship: z.literal('Standard')
			})
			.strict(),
		equipment: z
			.object({
				class: SlugSchema,
				artifactRole: z.enum(['item', 'set-source']),
				slot: SlotSchema.nullable()
			})
			.strict(),
		consistencySource: ConsistencySourceSchema.nullable(),
		references: z.array(ReferenceSchema).min(1).max(20),
		presentation: TargetPresentationSchema,
		acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1).max(40),
		output: OutputPathsSchema
	})
	.strict()
	.superRefine((target, context) => {
		const isFullSet = target.presentation.mode === 'complete-armour-set';
		const isDependentPiece = target.presentation.mode === 'dependent-armour-piece';
		if (isFullSet !== (target.equipment.artifactRole === 'set-source')) {
			context.addIssue({
				code: 'custom',
				path: ['presentation', 'mode'],
				message: 'Only set-source targets use complete-armour-set presentation'
			});
		}
		if (isDependentPiece !== (target.consistencySource !== null)) {
			context.addIssue({
				code: 'custom',
				path: ['consistencySource'],
				message: 'Dependent pieces require exactly one accepted consistency source'
			});
		}
		if ((target.equipment.slot !== null) !== isDependentPiece) {
			context.addIssue({
				code: 'custom',
				path: ['equipment', 'slot'],
				message: 'Only dependent Armour pieces declare an equipment slot'
			});
		}
		const criterionIds = target.acceptanceCriteria.map(({ criterionId }) => criterionId);
		if (new Set(criterionIds).size !== criterionIds.length) {
			context.addIssue({ code: 'custom', message: 'Acceptance criterion IDs must be unique' });
		}
	});

export const EquipmentImageAssignmentSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-assignment-v1'),
		assignmentId: SlugSchema,
		targetId: SlugSchema,
		contractVersion: SlugSchema,
		rendererVersion: SlugSchema,
		assignedAt: IsoDateTimeSchema,
		dryRun: z.literal(false),
		retryCeiling: z.literal(0),
		permittedOutputs: OutputPathsSchema,
		forbiddenSharedPaths: z.array(RepositoryPathSchema).min(1).max(100),
		completionContract: z
			.object({
				oneTargetOneImage: z.literal(true),
				structuredResultRequired: z.literal(true),
				sharedFilesMustRemainUntouched: z.literal(true),
				selfPromotionForbidden: z.literal(true)
			})
			.strict()
	})
	.strict()
	.superRefine((assignment, context) => {
		const ownedPaths = new Set(Object.values(assignment.permittedOutputs));
		if (assignment.forbiddenSharedPaths.some((path) => ownedPaths.has(path))) {
			context.addIssue({
				code: 'custom',
				path: ['forbiddenSharedPaths'],
				message: 'An assignment-owned output cannot also be forbidden'
			});
		}
	});

const ResultReferenceInputSchema = z
	.object({
		path: RepositoryPathSchema,
		contentHash: HashSchema
	})
	.strict();

const ResultAttemptSchema = z
	.object({
		attemptId: SlugSchema,
		attemptNumber: z.literal(1),
		sourceOutputId: NonEmptyTextSchema.max(300).nullable(),
		requestStartedAt: IsoDateTimeSchema,
		generationCompletedAt: IsoDateTimeSchema,
		inspectionCompletedAt: IsoDateTimeSchema
	})
	.strict()
	.superRefine((attempt, context) => {
		if (
			Date.parse(attempt.generationCompletedAt) < Date.parse(attempt.requestStartedAt) ||
			Date.parse(attempt.inspectionCompletedAt) < Date.parse(attempt.generationCompletedAt)
		) {
			context.addIssue({ code: 'custom', message: 'Attempt timestamps must be chronological' });
		}
	});

const ResultFindingSchema = z
	.object({
		criterionId: SlugSchema,
		outcome: z.enum(['pass', 'concern', 'fail', 'not-applicable']),
		observation: NonEmptyTextSchema
	})
	.strict();

const CandidateOutputSchema = z
	.object({
		path: CandidatePathSchema,
		mediaType: z.literal('image/png'),
		width: z.literal(1024),
		height: z.union([z.literal(1024), z.literal(1536)]),
		bytes: z.number().int().positive(),
		sha256: HashSchema
	})
	.strict();

export const EquipmentImageResultSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-result-v1'),
		resultId: SlugSchema,
		targetId: SlugSchema,
		assignmentId: SlugSchema,
		status: z.enum(['candidate', 'revise', 'failed']),
		promptSha256: HashSchema,
		referenceInputs: z.array(ResultReferenceInputSchema).min(1).max(20),
		attempts: z.array(ResultAttemptSchema).length(1),
		findings: z.array(ResultFindingSchema).min(1).max(100),
		candidate: CandidateOutputSchema.nullable(),
		candidateSha256: HashSchema.nullable(),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema,
		writtenOutputPaths: z
			.array(z.union([CandidatePathSchema, ResultPathSchema]))
			.min(1)
			.max(2),
		noSharedFilesEdited: z.literal(true),
		selfPromoted: z.literal(false)
	})
	.strict()
	.superRefine((result, context) => {
		if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
			context.addIssue({ code: 'custom', message: 'Result timestamps must be chronological' });
		}
		if ((result.candidate === null) !== (result.candidateSha256 === null)) {
			context.addIssue({ code: 'custom', message: 'Candidate data and hash must appear together' });
		}
		if (result.candidate !== null && result.candidate.sha256 !== result.candidateSha256) {
			context.addIssue({ code: 'custom', message: 'Candidate hashes must match' });
		}
		if (result.status === 'failed' && result.candidate !== null) {
			context.addIssue({ code: 'custom', message: 'Failed results cannot claim a candidate' });
		}
		if (result.status !== 'failed' && result.candidate === null) {
			context.addIssue({
				code: 'custom',
				message: 'Candidate and revise results require an image'
			});
		}
	});

export const EquipmentArmourSourceReviewReceiptSchema = z
	.object({
		schemaVersion: z.literal('equipment-armour-source-review-receipt-v1'),
		receiptId: SlugSchema,
		runId: SlugSchema,
		runPlanCanonicalSha256: HashSchema,
		manifestCanonicalSha256: HashSchema,
		allocationCanonicalSha256: HashSchema,
		profileCanonicalSha256: HashSchema,
		gateId: SlugSchema,
		sourceTargetId: SlugSchema,
		sourceResultCanonicalSha256: HashSchema,
		candidateSha256: HashSchema,
		decision: z.enum(['accepted', 'rejected']),
		reviewer: NonEmptyTextSchema.max(120),
		reviewedAt: IsoDateTimeSchema
	})
	.strict();

const BoundArtifactsSchema = z
	.object({
		manifestCanonicalSha256: HashSchema,
		allocationCanonicalSha256: HashSchema,
		profileCanonicalSha256: HashSchema,
		profileAcceptanceCanonicalSha256: HashSchema
	})
	.strict();

const RunVersionsSchema = z
	.object({
		contract: SlugSchema,
		renderer: SlugSchema,
		verifier: SlugSchema,
		persistence: SlugSchema,
		journal: SlugSchema
	})
	.strict();

const RootPacketSchema = z
	.object({
		targetId: SlugSchema,
		targetPath: TargetPathSchema,
		targetCanonicalSha256: HashSchema,
		assignmentPath: AssignmentPathSchema,
		assignmentCanonicalSha256: HashSchema
	})
	.strict();

const RunReviewGateSchema = z
	.object({
		gateId: SlugSchema,
		sourceTargetId: SlugSchema,
		unlocksTargetIds: z.array(SlugSchema).length(4),
		reviewPath: ReviewPathSchema
	})
	.strict();

export const EquipmentRunPlanSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-plan-v1'),
		runId: SlugSchema,
		productionId: SlugSchema,
		createdAt: IsoDateTimeSchema,
		maximumConcurrency: z.literal(16),
		boundArtifacts: BoundArtifactsSchema,
		versions: RunVersionsSchema,
		targetIds: z.array(SlugSchema).length(161),
		rootPackets: z.array(RootPacketSchema).length(77),
		reviewGates: z.array(RunReviewGateSchema).length(21),
		unmaterializedReviewGatedTargetIds: z.array(SlugSchema).length(84),
		reservedPaths: z
			.object({
				candidates: z.array(CandidatePathSchema).min(1).max(161),
				results: z.array(ResultPathSchema).min(1).max(161),
				reviews: z.array(ReviewPathSchema).min(1).max(161),
				runArtifacts: z.array(RunArtifactPathSchema).min(2)
			})
			.strict()
	})
	.strict()
	.superRefine((plan, context) => {
		const rootTargetIds = plan.rootPackets.map(({ targetId }) => targetId);
		const gateSourceTargetIds = plan.reviewGates.map(({ sourceTargetId }) => sourceTargetId);
		const gateChildren = plan.reviewGates.flatMap(({ unlocksTargetIds }) => unlocksTargetIds);
		for (const [label, values] of [
			['target IDs', plan.targetIds],
			['root packet target IDs', rootTargetIds],
			['review gate IDs', plan.reviewGates.map(({ gateId }) => gateId)],
			['review gate source target IDs', gateSourceTargetIds],
			['review gate child target IDs', gateChildren],
			['unmaterialized review-gated target IDs', plan.unmaterializedReviewGatedTargetIds],
			['reserved paths', Object.values(plan.reservedPaths).flat()]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: `Run plan ${label} must be unique` });
			}
		}

		const rootTargetIdSet = new Set(rootTargetIds);
		if (gateSourceTargetIds.some((targetId) => !rootTargetIdSet.has(targetId))) {
			context.addIssue({
				code: 'custom',
				message: 'Every review gate source must be a materialized root target'
			});
		}

		const sameMembers = (left: readonly string[], right: readonly string[]) => {
			const rightSet = new Set(right);
			return left.length === right.length && left.every((value) => rightSet.has(value));
		};
		if (!sameMembers(gateChildren, plan.unmaterializedReviewGatedTargetIds)) {
			context.addIssue({
				code: 'custom',
				message: 'Review gate children must equal the unmaterialized review-gated target set'
			});
		}
		if (
			!sameMembers([...rootTargetIds, ...plan.unmaterializedReviewGatedTargetIds], plan.targetIds)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Run targets must partition exactly into root packets and review-gated children'
			});
		}
	});

export const EquipmentRunActivationSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-activation-v1'),
		activationId: SlugSchema,
		runId: SlugSchema,
		runPlanCanonicalSha256: HashSchema,
		activatedAt: IsoDateTimeSchema,
		activatedBy: NonEmptyTextSchema.max(120)
	})
	.strict();

const EventRequestCommon = {
	schemaVersion: z.literal('equipment-production-event-request-v1'),
	eventId: SlugSchema,
	runId: SlugSchema,
	requestedAt: IsoDateTimeSchema,
	actor: NonEmptyTextSchema.max(120)
} as const;

const FailureKindSchema = z.enum([
	'capacity',
	'provider-throttle',
	'timeout',
	'malformed-output',
	'persistence',
	'operator-confirmed',
	'other'
]);

export const EquipmentRunEventRequestSchema = z.discriminatedUnion('kind', [
	z.object({ ...EventRequestCommon, kind: z.literal('run-started'), epochId: SlugSchema }).strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('job-claimed'),
			epochId: SlugSchema,
			claimId: SlugSchema,
			targetId: SlugSchema,
			workerId: SlugSchema
		})
		.strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('claim-released'),
			claimId: SlugSchema,
			targetId: SlugSchema,
			workerId: SlugSchema,
			reason: NonEmptyTextSchema
		})
		.strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('worker-started'),
			claimId: SlugSchema,
			targetId: SlugSchema,
			workerId: SlugSchema
		})
		.strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('job-terminal'),
			targetId: SlugSchema,
			workerId: SlugSchema,
			status: z.enum(['candidate', 'revise', 'failed']),
			resultCanonicalSha256: HashSchema.nullable(),
			failureKind: FailureKindSchema.nullable()
		})
		.strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('armour-source-reviewed'),
			gateId: SlugSchema,
			sourceTargetId: SlugSchema,
			decision: z.enum(['accepted', 'rejected']),
			receiptCanonicalSha256: HashSchema
		})
		.strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('epoch-paused'),
			epochId: SlugSchema,
			technicalFailureCount: z.literal(3),
			reason: NonEmptyTextSchema
		})
		.strict(),
	z
		.object({
			...EventRequestCommon,
			kind: z.literal('epoch-resumed'),
			previousEpochId: SlugSchema,
			epochId: SlugSchema,
			reason: NonEmptyTextSchema
		})
		.strict()
]);

export const EquipmentRunEventSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-event-v1'),
		sequence: z.number().int().positive(),
		previousEventCanonicalSha256: HashSchema.nullable(),
		recordedAt: IsoDateTimeSchema,
		request: EquipmentRunEventRequestSchema
	})
	.strict();

const ReportBlockerSchema = z
	.object({
		code: SlugSchema,
		message: NonEmptyTextSchema,
		path: RepositoryPathSchema.optional()
	})
	.strict();

export const EquipmentRunReadinessReportSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-readiness-report-v1'),
		runId: SlugSchema,
		checkedAt: IsoDateTimeSchema,
		status: z.enum(['ready', 'blocked']),
		writesPerformed: z.literal(0),
		summary: z
			.object({
				totalJobs: z.literal(161),
				materializedRootJobs: z.literal(77),
				gatedPieceJobs: z.literal(84),
				armourReviewGates: z.literal(21),
				maximumConcurrency: z.literal(16)
			})
			.strict(),
		blockers: z.array(ReportBlockerSchema)
	})
	.strict()
	.superRefine((report, context) => {
		if ((report.status === 'ready') !== (report.blockers.length === 0)) {
			context.addIssue({ code: 'custom', message: 'Ready reports have no blockers' });
		}
	});

export const EquipmentRunReportSchema = z
	.object({
		schemaVersion: z.literal('equipment-production-run-report-v1'),
		reportId: SlugSchema,
		runId: SlugSchema,
		generatedAt: IsoDateTimeSchema,
		status: z.enum(['not-started', 'running', 'paused', 'completed', 'blocked']),
		summary: z
			.object({
				totalJobs: z.literal(161),
				readyJobs: z.number().int().nonnegative().max(161),
				claimedJobs: z.number().int().nonnegative().max(161),
				activeJobs: z.number().int().nonnegative().max(16),
				terminalJobs: z.number().int().nonnegative().max(161),
				acceptedArmourGates: z.number().int().nonnegative().max(21),
				technicalFailuresInEpoch: z.number().int().nonnegative(),
				peakActiveEquipmentWorkers: z.number().int().nonnegative().max(16),
				maximumConcurrency: z.literal(16)
			})
			.strict(),
		readyTargetIds: z.array(SlugSchema).max(161),
		claimedTargetIds: z.array(SlugSchema).max(161),
		activeTargetIds: z.array(SlugSchema).max(16),
		terminalTargetIds: z.array(SlugSchema).max(161),
		blockers: z.array(ReportBlockerSchema)
	})
	.strict();

export type EquipmentVisualProfile = z.infer<typeof EquipmentVisualProfileSchema>;
export type EquipmentVisualProfileAcceptance = z.infer<
	typeof EquipmentVisualProfileAcceptanceSchema
>;
export type EquipmentImageTarget = z.infer<typeof EquipmentImageTargetSchema>;
export type EquipmentImageAssignment = z.infer<typeof EquipmentImageAssignmentSchema>;
export type EquipmentImageResult = z.infer<typeof EquipmentImageResultSchema>;
export type EquipmentArmourSourceReviewReceipt = z.infer<
	typeof EquipmentArmourSourceReviewReceiptSchema
>;
export type EquipmentRunPlan = z.infer<typeof EquipmentRunPlanSchema>;
export type EquipmentRunActivation = z.infer<typeof EquipmentRunActivationSchema>;
export type EquipmentRunEventRequest = z.infer<typeof EquipmentRunEventRequestSchema>;
export type EquipmentRunEvent = z.infer<typeof EquipmentRunEventSchema>;
export type EquipmentRunReadinessReport = z.infer<typeof EquipmentRunReadinessReportSchema>;
export type EquipmentRunReport = z.infer<typeof EquipmentRunReportSchema>;
