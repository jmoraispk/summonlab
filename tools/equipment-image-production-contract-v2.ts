import { z } from 'zod';

import { EQUIPMENT_V2_PRODUCTION_ROOT } from './equipment-material-production-v2.js';

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,159}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const NonEmptyTextSchema = z.string().trim().min(1).max(4_000);
const IsoDateTimeSchema = z.iso.datetime({ offset: true });
const RankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
const FamilySchema = z.enum(['metal', 'wood', 'hide-scale', 'cloth-fibre']);
const SlotSchema = z.enum(['head', 'torso', 'legs', 'boots']);
const EquipmentClassSchema = z.enum([
	'sword',
	'dagger',
	'spear',
	'bow',
	'axe',
	'mace',
	'shield',
	'staff',
	'heavy-armour',
	'light-armour',
	'robes'
]);

export const EquipmentV2RepositoryPathSchema = z
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

const EquipmentV2PathSchema = EquipmentV2RepositoryPathSchema.refine(
	(value) => value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/`),
	{ message: `Path must remain under ${EQUIPMENT_V2_PRODUCTION_ROOT}` }
);

function equipmentV2ArtifactPath(directory: string, extension: string) {
	return EquipmentV2PathSchema.refine(
		(value) =>
			value.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/${directory}/`) &&
			value.endsWith(extension),
		{ message: `Expected an Equipment v2 ${directory} ${extension} path` }
	);
}

const CandidatePathSchema = equipmentV2ArtifactPath('candidates', '.png');
const ResultPathSchema = equipmentV2ArtifactPath('results', '.json');
const ReviewPathSchema = equipmentV2ArtifactPath('reviews', '.json');
const TargetPathSchema = equipmentV2ArtifactPath('targets', '.json');
const AssignmentPathSchema = equipmentV2ArtifactPath('assignments', '.json');

const CanvasSchema = z
	.object({
		width: z.literal(1024),
		height: z.union([z.literal(1024), z.literal(1536)]),
		mediaType: z.literal('image/png')
	})
	.strict();

const FramingSchema = z
	.object({
		compositionTargetPercent: z.literal(8),
		hardMinimumPercent: z.literal(5),
		priority: z.literal('pose-consistency-over-margin-above-hard-minimum')
	})
	.strict();

export const EquipmentV2ProfileAcceptanceSchema = z
	.object({
		schemaVersion: z.literal('equipment-visual-profile-acceptance-v2'),
		acceptanceId: z.literal('equipment-material-visual-profile-v2-acceptance'),
		productionId: z.literal('material-equipment-v2'),
		profileId: z.literal('equipment-material-visual-profile-v2'),
		profileSchemaVersion: z.literal('equipment-visual-profile-v2'),
		profilePath: z.literal(
			'assets/equipment/experiments/material-equipment-v2/visual-profile/profile.json'
		),
		profileCanonicalSha256: HashSchema,
		decision: z.literal('accepted'),
		reviewer: z.literal('owner'),
		acceptedAt: IsoDateTimeSchema,
		authorizationScope: z.literal('visual-profile-only')
	})
	.strict();

const PacketReferenceSchema = z
	.object({
		referenceId: SlugSchema,
		path: EquipmentV2RepositoryPathSchema,
		contentHash: HashSchema,
		usage: z.enum(['style-only', 'pose-only', 'camera-and-display-only', 'continuity-source']),
		purpose: NonEmptyTextSchema
	})
	.strict();

const OutputPathsSchema = z
	.object({ candidatePath: CandidatePathSchema, provenanceResultPath: ResultPathSchema })
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

const ClassDirectionSchema = z
	.object({
		description: NonEmptyTextSchema,
		anchorReferenceId: SlugSchema,
		pose: NonEmptyTextSchema,
		proportionRules: z.array(NonEmptyTextSchema).min(1).max(8),
		consistencyLock: z.tuple([
			z.literal('camera'),
			z.literal('pivot'),
			z.literal('normalized-scale'),
			z.literal('presentation-angle')
		])
	})
	.strict();

const PresentationSchema = z.discriminatedUnion('mode', [
	z
		.object({
			mode: z.literal('isolated-item'),
			subject: z.literal('one-complete-object-or-required-pair'),
			composition: NonEmptyTextSchema,
			canvas: CanvasSchema.extend({ height: z.literal(1024) }).strict(),
			framing: FramingSchema,
			negativeConstraints: z.array(SlugSchema).min(1).max(50)
		})
		.strict(),
	z
		.object({
			mode: z.literal('complete-armour-set'),
			subject: z.literal('empty-self-supporting-armour-set'),
			composition: NonEmptyTextSchema,
			canvas: CanvasSchema.extend({ height: z.literal(1536) }).strict(),
			framing: FramingSchema,
			interior: z.literal('natural-interior-cavity-shadow-only'),
			requiredComponents: z.tuple([
				z.literal('Head'),
				z.literal('Torso'),
				z.literal('Legs'),
				z.literal('Boots')
			]),
			negativeConstraints: z.array(SlugSchema).min(1).max(50)
		})
		.strict(),
	z
		.object({
			mode: z.literal('dependent-armour-piece'),
			subject: z.literal('one-matching-object-or-required-pair'),
			composition: NonEmptyTextSchema,
			canvas: CanvasSchema.extend({ height: z.literal(1024) }).strict(),
			framing: FramingSchema,
			continuityRequirements: z.array(NonEmptyTextSchema).min(1).max(20),
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
			'class-pose-consistency',
			'structural-plausibility',
			'material-dominance',
			'material-cue-strength',
			'bounded-rank-behaviour',
			'style-cohesion',
			'negative-constraint-safety',
			'empty-armour-display',
			'source-continuity'
		]),
		description: NonEmptyTextSchema,
		required: z.literal(true)
	})
	.strict();

export const EquipmentV2ImageTargetSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-target-v2'),
		targetId: SlugSchema,
		productionId: z.literal('material-equipment-v2'),
		profileId: z.literal('equipment-material-visual-profile-v2'),
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
				class: EquipmentClassSchema,
				artifactRole: z.enum(['item', 'set-source']),
				slot: SlotSchema.nullable()
			})
			.strict(),
		classDirection: ClassDirectionSchema,
		consistencySource: ConsistencySourceSchema.nullable(),
		references: z.array(PacketReferenceSchema).min(2).max(4),
		presentation: PresentationSchema,
		acceptanceCriteria: z.array(AcceptanceCriterionSchema).min(1).max(40),
		output: OutputPathsSchema
	})
	.strict()
	.superRefine((target, context) => {
		const isFullSet = target.presentation.mode === 'complete-armour-set';
		const isDependent = target.presentation.mode === 'dependent-armour-piece';
		if (isFullSet !== (target.equipment.artifactRole === 'set-source')) {
			context.addIssue({ code: 'custom', message: 'Only set sources use full-set presentation' });
		}
		if (isDependent !== (target.consistencySource !== null)) {
			context.addIssue({ code: 'custom', message: 'Only dependent pieces bind a source' });
		}
		if ((target.equipment.slot !== null) !== isDependent) {
			context.addIssue({ code: 'custom', message: 'Only dependent pieces declare a slot' });
		}
		const ids = target.references.map(({ referenceId }) => referenceId);
		if (new Set(ids).size !== ids.length) {
			context.addIssue({ code: 'custom', message: 'Packet reference IDs must be unique' });
		}
		if (isDependent && target.references[0]?.usage !== 'continuity-source') {
			context.addIssue({ code: 'custom', message: 'Accepted set source must be first' });
		}
		if (!isDependent && target.references.some(({ usage }) => usage === 'continuity-source')) {
			context.addIssue({ code: 'custom', message: 'Root packets cannot bind continuity sources' });
		}
	});

export const EquipmentV2ImageAssignmentSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-assignment-v2'),
		assignmentId: SlugSchema,
		targetId: SlugSchema,
		contractVersion: z.literal('equipment-image-production-contract-v2'),
		rendererVersion: z.literal('equipment-image-prompt-v2'),
		assignedAt: IsoDateTimeSchema,
		runActivationRequired: z.literal(true),
		dryRun: z.literal(false),
		retryCeiling: z.literal(0),
		permittedOutputs: OutputPathsSchema,
		forbiddenSharedPaths: z.array(EquipmentV2RepositoryPathSchema).min(1).max(100),
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
				message: 'A v2 assignment-owned output cannot also be forbidden'
			});
		}
	});

export const EquipmentV2ImageResultSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-result-v2'),
		resultId: SlugSchema,
		targetId: SlugSchema,
		assignmentId: SlugSchema,
		status: z.enum(['candidate', 'revise', 'failed']),
		humanReviewLabel: z.enum(['Pass', 'Check', 'No image']),
		promptSha256: HashSchema,
		referenceInputs: z
			.array(
				z
					.object({
						referenceId: SlugSchema,
						path: EquipmentV2RepositoryPathSchema,
						contentHash: HashSchema
					})
					.strict()
			)
			.min(1)
			.max(20),
		attempts: z
			.array(
				z
					.object({
						attemptId: SlugSchema,
						attemptNumber: z.literal(1),
						sourceOutputId: NonEmptyTextSchema.max(300).nullable(),
						requestStartedAt: IsoDateTimeSchema,
						generationCompletedAt: IsoDateTimeSchema,
						inspectionCompletedAt: IsoDateTimeSchema
					})
					.strict()
			)
			.length(1),
		findings: z
			.array(
				z
					.object({
						criterionId: SlugSchema,
						outcome: z.enum(['pass', 'concern', 'fail', 'not-applicable']),
						observation: NonEmptyTextSchema
					})
					.strict()
			)
			.min(1)
			.max(40),
		candidate: z
			.object({
				path: CandidatePathSchema,
				mediaType: z.literal('image/png'),
				width: z.literal(1024),
				height: z.union([z.literal(1024), z.literal(1536)]),
				bytes: z.number().int().positive(),
				sha256: HashSchema
			})
			.strict()
			.nullable(),
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
		const expectedLabel = { candidate: 'Pass', revise: 'Check', failed: 'No image' } as const;
		if (result.humanReviewLabel !== expectedLabel[result.status]) {
			context.addIssue({ code: 'custom', message: 'Human review label must match machine status' });
		}
		if ((result.candidate === null) !== (result.candidateSha256 === null)) {
			context.addIssue({ code: 'custom', message: 'Candidate data and hash must appear together' });
		}
		if (result.candidate !== null && result.candidate.sha256 !== result.candidateSha256) {
			context.addIssue({ code: 'custom', message: 'Candidate hashes must match' });
		}
		if ((result.status === 'failed') !== (result.candidate === null)) {
			context.addIssue({ code: 'custom', message: 'Only failed results omit a candidate' });
		}
		const attempt = result.attempts[0];
		if (
			attempt !== undefined &&
			(Date.parse(attempt.generationCompletedAt) < Date.parse(attempt.requestStartedAt) ||
				Date.parse(attempt.inspectionCompletedAt) < Date.parse(attempt.generationCompletedAt))
		) {
			context.addIssue({ code: 'custom', message: 'Attempt timestamps must be chronological' });
		}
		if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
			context.addIssue({ code: 'custom', message: 'Result timestamps must be chronological' });
		}
		if (
			attempt !== undefined &&
			(Date.parse(attempt.requestStartedAt) < Date.parse(result.startedAt) ||
				Date.parse(attempt.inspectionCompletedAt) > Date.parse(result.completedAt))
		) {
			context.addIssue({
				code: 'custom',
				message: 'Attempt timestamps must remain within result bounds'
			});
		}
		if (result.candidate !== null && attempt?.sourceOutputId === null) {
			context.addIssue({ code: 'custom', message: 'Candidate results require a source output ID' });
		}
		const criterionIds = result.findings.map(({ criterionId }) => criterionId);
		if (new Set(criterionIds).size !== criterionIds.length) {
			context.addIssue({ code: 'custom', message: 'Result finding criterion IDs must be unique' });
		}
		const everyFindingPassed = result.findings.every(({ outcome }) => outcome === 'pass');
		if (result.status === 'candidate' && !everyFindingPassed) {
			context.addIssue({
				code: 'custom',
				message: 'Pass candidates require every finding to pass'
			});
		}
		if (result.status === 'revise' && everyFindingPassed) {
			context.addIssue({
				code: 'custom',
				message: 'Check results require at least one concern or fail'
			});
		}
		if (result.status === 'failed' && everyFindingPassed) {
			context.addIssue({
				code: 'custom',
				message: 'No-image results cannot report every check passing'
			});
		}
	});

export const EquipmentV2ArmourSourceReviewReceiptSchema = z
	.object({
		schemaVersion: z.literal('equipment-armour-source-review-receipt-v2'),
		receiptId: SlugSchema,
		runId: SlugSchema,
		runPlanCanonicalSha256: HashSchema,
		manifestCanonicalSha256: HashSchema,
		allocationCanonicalSha256: HashSchema,
		profileCanonicalSha256: HashSchema,
		profileAcceptanceCanonicalSha256: HashSchema,
		gateId: SlugSchema,
		sourceTargetId: SlugSchema,
		sourceResultCanonicalSha256: HashSchema,
		candidateSha256: HashSchema,
		decision: z.enum(['accepted', 'rejected']),
		reviewer: NonEmptyTextSchema.max(120),
		reviewedAt: IsoDateTimeSchema
	})
	.strict();

export const EquipmentV2ContractReadinessSchema = z
	.object({
		schemaVersion: z.literal('equipment-image-contract-readiness-v2'),
		productionId: z.literal('material-equipment-v2'),
		checkedAt: IsoDateTimeSchema,
		status: z.enum(['ready-for-run-contract', 'blocked']),
		writesPerformed: z.literal(0),
		summary: z
			.object({
				rootTargets: z.literal(77),
				rootAssignments: z.literal(77),
				gatedArmourPieces: z.literal(84),
				armourReviewGates: z.literal(21),
				maximumConcurrency: z.literal(16)
			})
			.strict(),
		activation: z
			.object({
				included: z.literal(false),
				imageGenerationAuthorized: z.literal(false),
				nextRequiredGate: z.literal('v2-run-specific-activation')
			})
			.strict(),
		blockers: z.array(
			z
				.object({
					code: SlugSchema,
					message: NonEmptyTextSchema,
					path: EquipmentV2RepositoryPathSchema.optional()
				})
				.strict()
		)
	})
	.strict()
	.superRefine((report, context) => {
		if ((report.status === 'ready-for-run-contract') !== (report.blockers.length === 0)) {
			context.addIssue({ code: 'custom', message: 'Ready reports cannot contain blockers' });
		}
	});

export type EquipmentV2ProfileAcceptance = z.infer<typeof EquipmentV2ProfileAcceptanceSchema>;
export type EquipmentV2ImageTarget = z.infer<typeof EquipmentV2ImageTargetSchema>;
export type EquipmentV2ImageAssignment = z.infer<typeof EquipmentV2ImageAssignmentSchema>;
export type EquipmentV2ImageResult = z.infer<typeof EquipmentV2ImageResultSchema>;
export type EquipmentV2ArmourSourceReviewReceipt = z.infer<
	typeof EquipmentV2ArmourSourceReviewReceiptSchema
>;
export type EquipmentV2ContractReadiness = z.infer<typeof EquipmentV2ContractReadinessSchema>;

export const EQUIPMENT_V2_PACKET_SCHEMA_DEFINITIONS = [
	['profile-acceptance.schema.json', EquipmentV2ProfileAcceptanceSchema],
	['target.schema.json', EquipmentV2ImageTargetSchema],
	['assignment.schema.json', EquipmentV2ImageAssignmentSchema],
	['result.schema.json', EquipmentV2ImageResultSchema],
	['armour-source-review-receipt.schema.json', EquipmentV2ArmourSourceReviewReceiptSchema],
	['contract-readiness.schema.json', EquipmentV2ContractReadinessSchema]
] as const;

export const EQUIPMENT_V2_TARGET_PATH_SCHEMA = TargetPathSchema;
export const EQUIPMENT_V2_ASSIGNMENT_PATH_SCHEMA = AssignmentPathSchema;
