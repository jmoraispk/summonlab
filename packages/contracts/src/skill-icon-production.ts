import { z } from 'zod';

import { IsoDateTimeSchema, StateHashSchema } from './shared.js';

const NonEmptyTextSchema = z.string().trim().min(1);
const SlugSchema = z
	.string()
	.regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u, 'Expected a lowercase slug')
	.max(120);
const SkillTargetIdSchema = z
	.string()
	.regex(
		/^(?:martial|magical|craft):[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
		'Expected a canonical skill target ID'
	)
	.max(200);
const MotifFamilySchema = z
	.string()
	.regex(/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/u, 'Expected a dotted motif-family ID')
	.max(160);

export const SkillIconRepositoryPathSchema = z
	.string()
	.min(1)
	.max(500)
	.refine(
		(value) =>
			!value.startsWith('/') &&
			!value.includes('\\') &&
			!value.includes('\0') &&
			!value.includes('://') &&
			!/^[A-Za-z]:/u.test(value),
		{ message: 'Expected a repository-relative POSIX path' }
	)
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths cannot contain empty, current, or parent-directory segments' }
	);

const CandidatePathSchema = SkillIconRepositoryPathSchema.regex(/\.png$/u).refine(
	(value) => value.startsWith('assets/wiki/skills/icon-production-v1/candidates/'),
	{ message: 'Candidate paths must remain in the versioned skill-icon candidates directory' }
);
const ResultPathSchema = SkillIconRepositoryPathSchema.regex(/\.json$/u).refine(
	(value) => value.startsWith('assets/wiki/skills/icon-production-v1/results/'),
	{ message: 'Result paths must remain in the versioned skill-icon results directory' }
);

export const SkillIconLifecycleSchema = z.enum(['mapped', 'authored', 'candidate', 'approved']);
export const SkillIconRaritySchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
export const SkillMasterySchema = z.enum(['Novice', 'Intermediate', 'Expert', 'Master']);
export const SkillIconMasterySchema = SkillMasterySchema;
export const SkillIconRoleSchema = z.enum([
	'rarity-frame',
	'backing',
	'calibration-plate',
	'skill-art'
]);

const NormalizedPointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const SkillIconGeometrySchema = z
	.object({
		schemaVersion: z.literal('skill-icon-geometry-v1'),
		canvas: z
			.object({
				width: z.number().int().positive(),
				height: z.number().int().positive()
			})
			.strict(),
		center: z
			.object({
				x: z.number().int().nonnegative(),
				y: z.number().int().nonnegative()
			})
			.strict(),
		aperturePoints: z.array(NormalizedPointSchema).length(6),
		subjectSafePercent: z.number().positive().max(100),
		effectSafePercent: z.number().positive().max(100),
		rarityMedallionExclusion: z.array(NormalizedPointSchema).min(3).max(20),
		runtimeSizes: z.tuple([z.literal(512), z.literal(256), z.literal(128)]),
		recognitionSize: z.literal(96)
	})
	.strict()
	.superRefine((geometry, context) => {
		if (geometry.center.x >= geometry.canvas.width || geometry.center.y >= geometry.canvas.height) {
			context.addIssue({
				code: 'custom',
				path: ['center'],
				message: 'Geometry center must lie inside the canvas'
			});
		}
		if (geometry.subjectSafePercent >= geometry.effectSafePercent) {
			context.addIssue({
				code: 'custom',
				path: ['subjectSafePercent'],
				message: 'The subject-safe region must be smaller than the effect-safe region'
			});
		}
	});

export const SkillIconVisualSpecSchema = z
	.object({
		dominantSubject: z.string().trim().min(3).max(300),
		supportingCue: z.string().trim().min(3).max(200).nullable(),
		semanticPalette: z.array(z.string().trim().min(2).max(80)).min(1).max(5),
		composition: z.string().trim().min(3).max(500),
		exclusions: z.array(z.string().trim().min(3).max(200)).min(1).max(12)
	})
	.strict();

export const SkillIconAssetSchema = z
	.object({
		path: SkillIconRepositoryPathSchema,
		mediaType: z.enum(['image/png', 'image/webp']),
		width: z.number().int().positive().max(8_192),
		height: z.number().int().positive().max(8_192),
		bytes: z.number().int().positive(),
		alphaMode: z.enum(['rgba', 'grayscale-alpha']),
		contentHash: StateHashSchema
	})
	.strict();

const CandidateAssetSchema = SkillIconAssetSchema.refine(
	(asset) => asset.mediaType === 'image/png' && asset.width === 1024 && asset.height === 1024,
	{ message: 'Skill-icon candidates must be 1024×1024 PNG files' }
);
const ApprovedMasterAssetSchema = SkillIconAssetSchema.refine(
	(asset) => asset.mediaType === 'image/png' && asset.width === 1024 && asset.height === 1024,
	{ message: 'Approved skill-icon masters must be 1024×1024 PNG files' }
);

function derivativeAssetSchema(
	size: 512 | 256 | 128,
	mediaType: 'image/webp'
): z.ZodType<z.infer<typeof SkillIconAssetSchema>>;
function derivativeAssetSchema(
	size: 96,
	mediaType: 'image/png'
): z.ZodType<z.infer<typeof SkillIconAssetSchema>>;
function derivativeAssetSchema(size: 512 | 256 | 128 | 96, mediaType: 'image/png' | 'image/webp') {
	return SkillIconAssetSchema.refine(
		(asset) => asset.mediaType === mediaType && asset.width === size && asset.height === size,
		{ message: `Expected a ${size}×${size} ${mediaType} derivative` }
	);
}

export const SkillIconCandidateAssetsSchema = z
	.object({ candidate: CandidateAssetSchema })
	.strict();

export const SkillIconApprovedAssetsSchema = z
	.object({
		candidate: CandidateAssetSchema,
		approvedMaster: ApprovedMasterAssetSchema,
		runtime512: derivativeAssetSchema(512, 'image/webp'),
		runtime256: derivativeAssetSchema(256, 'image/webp'),
		runtime128: derivativeAssetSchema(128, 'image/webp'),
		recognition96: derivativeAssetSchema(96, 'image/png')
	})
	.strict();

export const SkillIconReviewFindingSchema = z
	.object({
		criterion: SlugSchema,
		outcome: z.enum(['pass', 'concern', 'fail', 'not-applicable']),
		observation: NonEmptyTextSchema.max(1_000)
	})
	.strict();

export const SkillIconReviewSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-review-v1'),
		reviewId: SlugSchema,
		jobId: SlugSchema,
		role: SkillIconRoleSchema,
		skillTargetId: SkillTargetIdSchema.nullable(),
		candidatePath: CandidatePathSchema,
		candidateHash: StateHashSchema,
		reviewer: NonEmptyTextSchema.max(160),
		reviewerRole: z.literal('owner'),
		decision: z.enum(['accepted', 'revise', 'rejected']),
		rationale: NonEmptyTextSchema.max(2_000),
		findings: z.array(SkillIconReviewFindingSchema).min(1).max(40),
		reviewedAt: IsoDateTimeSchema
	})
	.strict()
	.superRefine((review, context) => {
		if ((review.role === 'skill-art') !== (review.skillTargetId !== null)) {
			context.addIssue({
				code: 'custom',
				path: ['skillTargetId'],
				message: 'Only skill-art reviews identify a canonical skill target'
			});
		}
		if (
			review.decision === 'accepted' &&
			review.findings.some((finding) => finding.outcome === 'fail')
		) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'An accepted owner review cannot contain a failed finding'
			});
		}
	});

const SkillIconLabelSchema = z
	.object({
		namespace: z.enum(['Equipment', 'Element']),
		value: NonEmptyTextSchema.max(80)
	})
	.strict();

const SkillIconRecordCommonShape = {
	targetId: SkillTargetIdSchema,
	domain: z.enum(['Martial', 'Magical', 'Craft']),
	family: NonEmptyTextSchema.max(80),
	name: NonEmptyTextSchema.max(160),
	labels: z.array(SkillIconLabelSchema).max(20),
	rarity: SkillIconRaritySchema,
	type: NonEmptyTextSchema.max(80),
	requires: z.string().trim().max(2_000),
	effect: NonEmptyTextSchema.max(4_000),
	mapEntryId: MotifFamilySchema,
	motifFamily: MotifFamilySchema.nullable(),
	primaryVisualParent: SkillTargetIdSchema.nullable()
};

const MappedSkillIconRecordSchema = z
	.object({
		...SkillIconRecordCommonShape,
		status: z.literal('mapped'),
		visualSpec: z.null(),
		assets: z.null(),
		review: z.null()
	})
	.strict();
const AuthoredSkillIconRecordSchema = z
	.object({
		...SkillIconRecordCommonShape,
		status: z.literal('authored'),
		visualSpec: SkillIconVisualSpecSchema,
		assets: z.null(),
		review: z.null()
	})
	.strict();
const CandidateSkillIconRecordSchema = z
	.object({
		...SkillIconRecordCommonShape,
		status: z.literal('candidate'),
		visualSpec: SkillIconVisualSpecSchema,
		assets: SkillIconCandidateAssetsSchema,
		review: z.null()
	})
	.strict();
const ApprovedSkillIconRecordSchema = z
	.object({
		...SkillIconRecordCommonShape,
		status: z.literal('approved'),
		visualSpec: SkillIconVisualSpecSchema,
		assets: SkillIconApprovedAssetsSchema,
		review: SkillIconReviewSchema
	})
	.strict()
	.superRefine((record, context) => {
		if (record.review.decision !== 'accepted') {
			context.addIssue({
				code: 'custom',
				path: ['review', 'decision'],
				message: 'Approved records require an accepted owner decision'
			});
		}
		if (
			record.review.skillTargetId !== record.targetId ||
			record.review.candidatePath !== record.assets.candidate.path ||
			record.review.candidateHash !== record.assets.candidate.contentHash
		) {
			context.addIssue({
				code: 'custom',
				path: ['review'],
				message: 'Approved review must bind the record target and exact candidate bytes'
			});
		}
	});

export const SkillIconRecordSchema = z
	.discriminatedUnion('status', [
		MappedSkillIconRecordSchema,
		AuthoredSkillIconRecordSchema,
		CandidateSkillIconRecordSchema,
		ApprovedSkillIconRecordSchema
	])
	.superRefine((record, context) => {
		if (record.motifFamily === null && record.primaryVisualParent !== null) {
			context.addIssue({
				code: 'custom',
				path: ['primaryVisualParent'],
				message: 'Standalone records cannot declare a primary visual parent'
			});
		}
		if (record.primaryVisualParent === record.targetId) {
			context.addIssue({
				code: 'custom',
				path: ['primaryVisualParent'],
				message: 'A skill cannot be its own primary visual parent'
			});
		}
	});

export const SkillIconCatalogSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-catalog-v1'),
		records: z.array(SkillIconRecordSchema)
	})
	.strict()
	.superRefine((catalog, context) => {
		const targetIds = new Set<string>();
		const ownedPaths = new Set<string>();
		for (const [index, record] of catalog.records.entries()) {
			if (targetIds.has(record.targetId)) {
				context.addIssue({
					code: 'custom',
					path: ['records', index, 'targetId'],
					message: `Duplicate skill-icon target ID: ${record.targetId}`
				});
			}
			targetIds.add(record.targetId);
			if (record.assets === null) continue;
			for (const asset of Object.values(record.assets)) {
				if (ownedPaths.has(asset.path)) {
					context.addIssue({
						code: 'custom',
						path: ['records', index, 'assets'],
						message: `Duplicate skill-icon asset path: ${asset.path}`
					});
				}
				ownedPaths.add(asset.path);
			}
		}
	});

export const SkillIconReferenceSchema = z
	.object({
		path: SkillIconRepositoryPathSchema,
		purpose: NonEmptyTextSchema.max(500),
		contentHash: StateHashSchema
	})
	.strict();

const SkillIconTargetCommonShape = {
	schemaVersion: z.literal('skill-icon-target-v1'),
	jobId: SlugSchema,
	exactPrompt: z.string().trim().min(1).max(30_000),
	references: z.array(SkillIconReferenceSchema).min(1).max(20),
	canvas: z
		.object({
			width: z.number().int().positive().max(8_192),
			height: z.number().int().positive().max(8_192),
			mediaType: z.literal('image/png')
		})
		.strict(),
	output: z
		.object({
			candidatePath: CandidatePathSchema,
			resultPath: ResultPathSchema
		})
		.strict()
};

export const SkillIconTargetSchema = z.discriminatedUnion('role', [
	z
		.object({
			...SkillIconTargetCommonShape,
			role: z.literal('rarity-frame'),
			skillTargetId: z.null(),
			motifFamily: z.null(),
			rarity: SkillIconRaritySchema
		})
		.strict(),
	z
		.object({
			...SkillIconTargetCommonShape,
			role: z.literal('backing'),
			skillTargetId: z.null(),
			motifFamily: z.null(),
			rarity: z.null()
		})
		.strict(),
	z
		.object({
			...SkillIconTargetCommonShape,
			role: z.literal('calibration-plate'),
			skillTargetId: z.null(),
			motifFamily: MotifFamilySchema,
			rarity: z.null()
		})
		.strict(),
	z
		.object({
			...SkillIconTargetCommonShape,
			role: z.literal('skill-art'),
			skillTargetId: SkillTargetIdSchema,
			motifFamily: z.null(),
			rarity: z.null()
		})
		.strict()
]);

const OwnedOutputPathsSchema = z
	.object({
		candidatePath: CandidatePathSchema,
		resultPath: ResultPathSchema
	})
	.strict();

export const SkillIconAssignmentSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-assignment-v1'),
		assignmentId: SlugSchema,
		jobId: SlugSchema,
		targetPath: SkillIconRepositoryPathSchema.regex(/\.json$/u),
		skillVersion: z.string().regex(/-v1$/u).min(4).max(120),
		assignedAt: IsoDateTimeSchema,
		retryCeiling: z.number().int().min(0).max(1),
		permittedOutputs: OwnedOutputPathsSchema,
		forbiddenSharedPaths: z.array(SkillIconRepositoryPathSchema).min(1).max(100),
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
		const owned = new Set(Object.values(assignment.permittedOutputs));
		for (const forbiddenPath of assignment.forbiddenSharedPaths) {
			if (owned.has(forbiddenPath)) {
				context.addIssue({
					code: 'custom',
					path: ['forbiddenSharedPaths'],
					message: `Owned output cannot also be forbidden: ${forbiddenPath}`
				});
			}
		}
	});

export const SkillIconResultFindingSchema = z
	.object({
		category: z.enum([
			'geometry',
			'alpha',
			'safe-zone',
			'registration',
			'recognition',
			'manifest-fidelity',
			'prompt-provenance',
			'exact-source-persistence',
			'output-ownership',
			'other'
		]),
		evaluator: z.enum(['producer', 'automated']),
		outcome: z.enum(['pass', 'concern', 'fail', 'not-applicable']),
		observation: NonEmptyTextSchema.max(1_000)
	})
	.strict();

export const SkillIconResultSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-result-v1'),
		resultId: SlugSchema,
		jobId: SlugSchema,
		assignmentId: SlugSchema,
		status: z.literal('candidate'),
		exactPrompt: z.string().trim().min(1).max(30_000),
		promptHash: StateHashSchema,
		referenceInputs: z
			.array(
				z
					.object({
						path: SkillIconRepositoryPathSchema,
						contentHash: StateHashSchema
					})
					.strict()
			)
			.min(1)
			.max(20),
		output: CandidateAssetSchema,
		resultPath: ResultPathSchema,
		findings: z.array(SkillIconResultFindingSchema).min(1).max(100),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema,
		totalWallTimeMs: z.number().int().nonnegative(),
		writtenOutputPaths: z.tuple([CandidatePathSchema, ResultPathSchema]),
		noSharedFilesEdited: z.literal(true),
		selfPromoted: z.literal(false)
	})
	.strict()
	.superRefine((result, context) => {
		if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
			context.addIssue({ code: 'custom', message: 'Result timestamps must be chronological' });
		}
		if (
			result.output.path !== result.writtenOutputPaths[0] ||
			result.resultPath !== result.writtenOutputPaths[1]
		) {
			context.addIssue({
				code: 'custom',
				path: ['writtenOutputPaths'],
				message:
					'Written paths must be the one candidate and one structured result owned by the job'
			});
		}
	});

export type SkillIconLifecycle = z.infer<typeof SkillIconLifecycleSchema>;
export type SkillIconRarity = z.infer<typeof SkillIconRaritySchema>;
export type SkillMastery = z.infer<typeof SkillMasterySchema>;
export type SkillIconMastery = SkillMastery;
export type SkillIconRole = z.infer<typeof SkillIconRoleSchema>;
export type SkillIconRepositoryPath = z.infer<typeof SkillIconRepositoryPathSchema>;
export type SkillIconGeometry = z.infer<typeof SkillIconGeometrySchema>;
export type SkillIconVisualSpec = z.infer<typeof SkillIconVisualSpecSchema>;
export type SkillIconAsset = z.infer<typeof SkillIconAssetSchema>;
export type SkillIconCandidateAssets = z.infer<typeof SkillIconCandidateAssetsSchema>;
export type SkillIconApprovedAssets = z.infer<typeof SkillIconApprovedAssetsSchema>;
export type SkillIconReviewFinding = z.infer<typeof SkillIconReviewFindingSchema>;
export type SkillIconReview = z.infer<typeof SkillIconReviewSchema>;
export type SkillIconRecord = z.infer<typeof SkillIconRecordSchema>;
export type SkillIconCatalog = z.infer<typeof SkillIconCatalogSchema>;
export type SkillIconReference = z.infer<typeof SkillIconReferenceSchema>;
export type SkillIconTarget = z.infer<typeof SkillIconTargetSchema>;
export type SkillIconAssignment = z.infer<typeof SkillIconAssignmentSchema>;
export type SkillIconResultFinding = z.infer<typeof SkillIconResultFindingSchema>;
export type SkillIconResult = z.infer<typeof SkillIconResultSchema>;
