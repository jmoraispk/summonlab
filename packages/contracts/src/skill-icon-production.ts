import { createHash } from 'node:crypto';

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
			Array.from(value).every((character) => {
				const codePoint = character.codePointAt(0);
				return codePoint !== undefined && codePoint > 31 && codePoint !== 127;
			}) &&
			!value.includes('://') &&
			!/^[A-Za-z]:/u.test(value),
		{ message: 'Expected a repository-relative POSIX path' }
	)
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths cannot contain empty, current, or parent-directory segments' }
	);

const JobFileSlug = '[a-z][a-z0-9]*(?:-[a-z0-9]+)*';
const ProductionScope = '(?:references|calibration|icons)';

function namespacedPath(pattern: RegExp, message: string) {
	return SkillIconRepositoryPathSchema.refine((value) => pattern.test(value), { message });
}

export const SkillIconCandidatePathSchema = namespacedPath(
	new RegExp(
		`^assets/wiki/skills/icon-production-v1/candidates/${ProductionScope}/${JobFileSlug}\\.png$`,
		'u'
	),
	'Expected a versioned skill-icon candidate PNG path'
);
export const SkillIconMasterPathSchema = namespacedPath(
	new RegExp(
		`^assets/wiki/skills/icon-production-v1/masters/(?:frames/[fedcbas]\\.png|backing/${JobFileSlug}\\.png|calibration/${JobFileSlug}\\.png|icons/${JobFileSlug}\\.png)$`,
		'u'
	),
	'Expected a versioned skill-icon master PNG path'
);
export const SkillIconRuntimePathSchema = namespacedPath(
	new RegExp(`^apps/web/static/skill-icons/v1/(?:512|256|128)/${JobFileSlug}\\.webp$`, 'u'),
	'Expected a versioned skill-icon runtime WebP path'
);
export const SkillIconRecognitionPathSchema = namespacedPath(
	new RegExp(
		`^assets/wiki/skills/icon-production-v1/review/recognition/${JobFileSlug}\\.png$`,
		'u'
	),
	'Expected a versioned skill-icon recognition PNG path'
);
export const SkillIconTargetPathSchema = namespacedPath(
	new RegExp(
		`^assets/wiki/skills/icon-production-v1/targets/${ProductionScope}/${JobFileSlug}\\.json$`,
		'u'
	),
	'Expected a versioned skill-icon target JSON path'
);
export const SkillIconAssignmentPathSchema = namespacedPath(
	new RegExp(
		`^assets/wiki/skills/icon-production-v1/assignments/${ProductionScope}/${JobFileSlug}\\.json$`,
		'u'
	),
	'Expected a versioned skill-icon assignment JSON path'
);
export const SkillIconResultPathSchema = namespacedPath(
	new RegExp(
		`^assets/wiki/skills/icon-production-v1/results/${ProductionScope}/${JobFileSlug}\\.json$`,
		'u'
	),
	'Expected a versioned skill-icon result JSON path'
);
export const SkillIconReferencePathSchema = SkillIconRepositoryPathSchema.refine((value) => {
	const allowedRoot = [
		'assets/wiki/skills/icon-production-v1/references/',
		'assets/wiki/skills/icon-production-v1/masters/',
		'assets/wiki/skills/rarity-frame-v1/references/',
		'assets/wiki/skills/rarity-frame-v1/sources/'
	].some((root) => value.startsWith(root));
	return allowedRoot && /\.(?:png|webp|svg)$/u.test(value);
}, 'References must be image assets beneath an allowlisted production authority root');

function pathBasenameWithoutExtension(value: string): string {
	const basename = value.slice(value.lastIndexOf('/') + 1);
	return basename.slice(0, basename.lastIndexOf('.'));
}

function skillTargetAssetSlug(targetId: string): string {
	return targetId.replaceAll(':', '-');
}

function productionScopeForRole(role: z.infer<typeof SkillIconRoleSchema>): string {
	if (role === 'calibration-plate') return 'calibration';
	if (role === 'skill-art') return 'icons';
	return 'references';
}

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
export const SkillIconProviderNormalizationProfileV1Schema = z.literal(
	'skill-icon-green-key-role-mask-v1'
);
export const SkillIconProviderNormalizationProfileV2Schema = z.literal(
	'skill-icon-green-key-role-mask-v2'
);
export const SkillIconProviderNormalizationProfileV3Schema = z.literal(
	'skill-icon-green-key-role-mask-v3'
);
export const SkillIconProviderNormalizationProfileSchema = z.union([
	SkillIconProviderNormalizationProfileV1Schema,
	SkillIconProviderNormalizationProfileV2Schema,
	SkillIconProviderNormalizationProfileV3Schema
]);
export const SkillIconProductionSkillVersionSchema = z.union([
	z.literal('summonlab-skill-icon-production-v2'),
	z.literal('summonlab-skill-icon-production-v3'),
	z.literal('summonlab-skill-icon-production-v4')
]);
export const SKILL_ICON_NORMALIZATION_GEOMETRY_HASH =
	'4a8645adb0f820011b2bf9383710e0161a36905b8e99f1e8d6797b4104d4f7d7' as const;
export const SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH =
	'assets/wiki/skills/icon-production-v1/references/geometry-guide.png' as const;
export const SKILL_ICON_NORMALIZATION_GUIDE_V1_PURPOSE =
	'Geometry guide for registration and safe zones.' as const;
export const SKILL_ICON_NORMALIZATION_GUIDE_V1_HASH =
	'8a7d80f9f3c6be40aab510bc9e1f01e2c3a402888f10c2903b9a730cb9e463f4' as const;
export const SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH =
	'assets/wiki/skills/icon-production-v1/geometry-v2.json' as const;
export const SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH =
	'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png' as const;
export const SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE =
	'Provider-space role-mask guide for rarity-frame and backing registration.' as const;
export const SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH =
	'6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab' as const;
export const SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH =
	'8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e' as const;

const ExactPromptSchema = z
	.string()
	.max(30_000)
	.refine((value) => value.trim().length > 0, 'Exact prompt cannot be blank');

const NormalizedPointSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const SkillIconGeometryV1Schema = z
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

export const SkillIconGeometrySchema = SkillIconGeometryV1Schema;

export const SkillIconGeometryV2Schema = z
	.object({
		schemaVersion: z.literal('skill-icon-geometry-v2'),
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
		outerEnvelopePoints: z.array(NormalizedPointSchema).length(6),
		innerApertureScale: z.literal(0.78),
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

export const AnySkillIconGeometrySchema = z.union([
	SkillIconGeometryV1Schema,
	SkillIconGeometryV2Schema
]);

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
		alphaMode: z.enum(['rgb', 'rgba']),
		contentHash: StateHashSchema
	})
	.strict();

const AssetEvidenceShape = {
	bytes: z.number().int().positive(),
	contentHash: StateHashSchema
};

export const SkillIconCandidateAssetSchema = z
	.object({
		path: SkillIconCandidatePathSchema,
		mediaType: z.literal('image/png'),
		width: z.number().int().min(1024).max(8_192),
		height: z.number().int().min(1024).max(8_192),
		alphaMode: z.enum(['rgb', 'rgba']),
		...AssetEvidenceShape
	})
	.strict();

export const SkillIconStandaloneCandidateAssetSchema = z
	.object({
		path: SkillIconCandidatePathSchema,
		mediaType: z.literal('image/png'),
		width: z.literal(1024),
		height: z.literal(1024),
		alphaMode: z.literal('rgba'),
		...AssetEvidenceShape
	})
	.strict();

export const SkillIconApprovedMasterAssetSchema = z
	.object({
		path: SkillIconMasterPathSchema,
		mediaType: z.literal('image/png'),
		width: z.literal(1024),
		height: z.literal(1024),
		alphaMode: z.literal('rgba'),
		...AssetEvidenceShape
	})
	.strict();

export const SkillIconCalibrationCandidateAssetSchema = SkillIconCandidateAssetSchema.refine(
	(asset) => asset.path.includes('/candidates/calibration/'),
	{ message: 'Expected a calibration candidate path' }
);

export const SkillIconCalibrationMasterAssetSchema = z
	.object({
		path: SkillIconMasterPathSchema.refine((path) => path.includes('/masters/calibration/')),
		mediaType: z.literal('image/png'),
		width: z.number().int().min(1024).max(8_192),
		height: z.number().int().min(1024).max(8_192),
		alphaMode: z.enum(['rgb', 'rgba']),
		...AssetEvidenceShape
	})
	.strict();

export const SkillIconRuntimeAssetSchema = z
	.object({
		path: SkillIconRuntimePathSchema,
		mediaType: z.literal('image/webp'),
		width: z.union([z.literal(512), z.literal(256), z.literal(128)]),
		height: z.union([z.literal(512), z.literal(256), z.literal(128)]),
		alphaMode: z.literal('rgba'),
		...AssetEvidenceShape
	})
	.strict()
	.superRefine((asset, context) => {
		const pathSize = Number(
			/^apps\/web\/static\/skill-icons\/v1\/(512|256|128)\//u.exec(asset.path)?.[1]
		);
		if (asset.width !== asset.height || asset.width !== pathSize) {
			context.addIssue({
				code: 'custom',
				path: ['width'],
				message: 'Runtime dimensions must match the size namespace in the path'
			});
		}
	});

export const SkillIconRecognitionAssetSchema = z
	.object({
		path: SkillIconRecognitionPathSchema,
		mediaType: z.literal('image/png'),
		width: z.literal(96),
		height: z.literal(96),
		alphaMode: z.literal('rgba'),
		...AssetEvidenceShape
	})
	.strict();

export const SkillIconCandidateAssetsSchema = z
	.object({ candidate: SkillIconStandaloneCandidateAssetSchema })
	.strict();

export const SkillIconApprovedAssetsSchema = z
	.object({
		candidate: SkillIconStandaloneCandidateAssetSchema,
		approvedMaster: SkillIconApprovedMasterAssetSchema,
		runtime512: SkillIconRuntimeAssetSchema.refine((asset) => asset.width === 512),
		runtime256: SkillIconRuntimeAssetSchema.refine((asset) => asset.width === 256),
		runtime128: SkillIconRuntimeAssetSchema.refine((asset) => asset.width === 128),
		recognition96: SkillIconRecognitionAssetSchema
	})
	.strict();

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

export const SkillIconResultFindingV2Schema = z
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
			'deterministic-normalization',
			'output-ownership',
			'other'
		]),
		evaluator: z.enum(['producer', 'automated']),
		outcome: z.enum(['pass', 'concern', 'fail', 'not-applicable']),
		observation: NonEmptyTextSchema.max(1_000)
	})
	.strict();

export const SkillIconProducerResultSchema = z
	.object({
		jobId: SlugSchema,
		status: z.literal('candidate'),
		path: SkillIconResultPathSchema,
		contentHash: StateHashSchema,
		findings: z.array(SkillIconResultFindingSchema).min(1).max(100)
	})
	.strict()
	.superRefine((producerResult, context) => {
		if (pathBasenameWithoutExtension(producerResult.path) !== producerResult.jobId) {
			context.addIssue({
				code: 'custom',
				path: ['path'],
				message: 'Producer result basename must match its job ID'
			});
		}
		if (producerResult.findings.some((finding) => finding.outcome === 'fail')) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Candidate producer results cannot contain failed findings'
			});
		}
		for (const evaluator of ['automated', 'producer'] as const) {
			if (
				!producerResult.findings.some(
					(finding) => finding.evaluator === evaluator && finding.outcome === 'pass'
				)
			) {
				context.addIssue({
					code: 'custom',
					path: ['findings'],
					message: `Candidate producer results require at least one ${evaluator} pass`
				});
			}
		}
	});

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
		candidatePath: SkillIconCandidatePathSchema,
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
		const expectedScope = productionScopeForRole(review.role);
		if (
			review.reviewId !== `review-${review.jobId}` ||
			pathBasenameWithoutExtension(review.candidatePath) !== review.jobId ||
			!review.candidatePath.includes(`/${expectedScope}/`)
		) {
			context.addIssue({
				code: 'custom',
				path: ['jobId'],
				message: 'Review identity and candidate basename must match its job ID'
			});
		}
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
		if (
			review.role === 'skill-art' &&
			review.decision === 'accepted' &&
			!review.findings.some(
				(finding) => finding.criterion === 'recognition' && finding.outcome === 'pass'
			)
		) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Accepted skill-art review requires an explicit recognition pass'
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
		producerResult: SkillIconProducerResultSchema,
		assets: SkillIconCandidateAssetsSchema,
		review: z.null()
	})
	.strict();
const ApprovedSkillIconRecordSchema = z
	.object({
		...SkillIconRecordCommonShape,
		status: z.literal('approved'),
		visualSpec: SkillIconVisualSpecSchema,
		producerResult: SkillIconProducerResultSchema,
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
			record.review.candidateHash !== record.assets.candidate.contentHash ||
			record.review.jobId !== record.producerResult.jobId
		) {
			context.addIssue({
				code: 'custom',
				path: ['review'],
				message: 'Approved review must bind the record target and exact candidate bytes'
			});
		}
		if (
			record.assets.approvedMaster.contentHash !== record.assets.candidate.contentHash ||
			record.assets.approvedMaster.bytes !== record.assets.candidate.bytes
		) {
			context.addIssue({
				code: 'custom',
				path: ['assets', 'approvedMaster'],
				message: 'Promotion must preserve the exact candidate bytes and SHA-256 hash'
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
		if (record.status === 'candidate' || record.status === 'approved') {
			const expectedSlug = skillTargetAssetSlug(record.targetId);
			const producerJobId = record.producerResult.jobId;
			if (
				pathBasenameWithoutExtension(record.assets.candidate.path) !== producerJobId ||
				pathBasenameWithoutExtension(record.producerResult.path) !== producerJobId ||
				!record.assets.candidate.path.includes('/candidates/icons/') ||
				!record.producerResult.path.includes('/results/icons/')
			) {
				context.addIssue({
					code: 'custom',
					path: ['producerResult'],
					message: 'Producer result and candidate basenames must match their job ID'
				});
			}
			if (record.status === 'approved') {
				const expectedMasterPath = `assets/wiki/skills/icon-production-v1/masters/icons/${expectedSlug}.png`;
				const expectedRuntimeStem = `apps/web/static/skill-icons/v1`;
				const expectedRecognitionPath = `assets/wiki/skills/icon-production-v1/review/recognition/${expectedSlug}.png`;
				if (
					record.assets.approvedMaster.path !== expectedMasterPath ||
					record.assets.runtime512.path !== `${expectedRuntimeStem}/512/${expectedSlug}.webp` ||
					record.assets.runtime256.path !== `${expectedRuntimeStem}/256/${expectedSlug}.webp` ||
					record.assets.runtime128.path !== `${expectedRuntimeStem}/128/${expectedSlug}.webp` ||
					record.assets.recognition96.path !== expectedRecognitionPath
				) {
					context.addIssue({
						code: 'custom',
						path: ['assets'],
						message: 'Approved asset paths must be derived from the canonical skill target ID'
					});
				}
			}
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
		path: SkillIconReferencePathSchema,
		purpose: NonEmptyTextSchema.max(500),
		contentHash: StateHashSchema
	})
	.strict();

const SkillIconTargetCommonShape = {
	jobId: SlugSchema,
	exactPrompt: ExactPromptSchema,
	references: z.array(SkillIconReferenceSchema).min(1).max(20),
	output: z
		.object({
			candidatePath: SkillIconCandidatePathSchema,
			resultPath: SkillIconResultPathSchema
		})
		.strict()
};

const SkillIconTargetV1CommonShape = {
	...SkillIconTargetCommonShape,
	schemaVersion: z.literal('skill-icon-target-v1')
};

const SkillIconProviderSourceContractSchema = z
	.object({
		mediaType: z.literal('image/png'),
		width: z.literal(1254),
		height: z.literal(1254),
		alphaMode: z.literal('rgb'),
		matteColor: z.literal('#00FF00')
	})
	.strict();

const SkillIconProviderOutputContractSchema = z
	.object({
		mediaType: z.literal('image/png'),
		width: z.literal(1024),
		height: z.literal(1024),
		alphaMode: z.literal('rgba')
	})
	.strict();

function skillIconTargetNormalizationVariant(
	profile:
		| typeof SkillIconProviderNormalizationProfileV1Schema
		| typeof SkillIconProviderNormalizationProfileV2Schema,
	geometryHash: typeof SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
) {
	return z
		.object({
			profile,
			sourceContract: SkillIconProviderSourceContractSchema,
			outputContract: SkillIconProviderOutputContractSchema,
			geometry: z
				.object({
					path: z.literal('assets/wiki/skills/icon-production-v1/geometry.json'),
					contentHash: z.literal(geometryHash)
				})
				.strict()
		})
		.strict();
}

export const SkillIconTargetNormalizationSchema = z.union([
	skillIconTargetNormalizationVariant(
		SkillIconProviderNormalizationProfileV1Schema,
		SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
	),
	skillIconTargetNormalizationVariant(
		SkillIconProviderNormalizationProfileV2Schema,
		SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
	),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV3Schema,
			sourceContract: SkillIconProviderSourceContractSchema,
			outputContract: SkillIconProviderOutputContractSchema,
			geometry: z
				.object({
					path: z.literal(SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH),
					contentHash: z.literal(SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH)
				})
				.strict()
		})
		.strict()
]);

const SkillIconTargetV2CommonShape = {
	...SkillIconTargetCommonShape,
	schemaVersion: z.literal('skill-icon-target-v2'),
	logicalIdentity: SlugSchema,
	revision: z.number().int().min(2),
	normalization: SkillIconTargetNormalizationSchema
};

export const SkillIconStandaloneCanvasSchema = z
	.object({
		width: z.literal(1024),
		height: z.literal(1024),
		mediaType: z.literal('image/png')
	})
	.strict();

export const SkillIconCalibrationCanvasSchema = z
	.object({
		width: z.number().int().min(1024).max(8_192),
		height: z.number().int().min(1024).max(8_192),
		mediaType: z.literal('image/png')
	})
	.strict();

function refineSkillIconTarget(
	target: {
		readonly role: z.infer<typeof SkillIconRoleSchema>;
		readonly jobId: string;
		readonly references: readonly { readonly path: string }[];
		readonly output: { readonly candidatePath: string; readonly resultPath: string };
	},
	context: z.RefinementCtx
): void {
	const referencePaths = target.references.map((reference) => reference.path);
	if (new Set(referencePaths).size !== referencePaths.length) {
		context.addIssue({
			code: 'custom',
			path: ['references'],
			message: 'Target reference paths must be unique'
		});
	}
	const expectedScope = productionScopeForRole(target.role);
	const ownedPaths = [target.output.candidatePath, target.output.resultPath];
	if (
		ownedPaths.some((path) => pathBasenameWithoutExtension(path) !== target.jobId) ||
		ownedPaths.some((path) => !path.includes(`/${expectedScope}/`))
	) {
		context.addIssue({
			code: 'custom',
			path: ['output'],
			message: 'Target output basenames and namespaces must match its role and job ID'
		});
	}
}

function targetVariant(
	common: typeof SkillIconTargetV1CommonShape | typeof SkillIconTargetV2CommonShape
) {
	return z.discriminatedUnion('role', [
		z
			.object({
				...common,
				role: z.literal('rarity-frame'),
				skillTargetId: z.null(),
				motifFamily: z.null(),
				rarity: SkillIconRaritySchema,
				canvas: SkillIconStandaloneCanvasSchema
			})
			.strict(),
		z
			.object({
				...common,
				role: z.literal('backing'),
				skillTargetId: z.null(),
				motifFamily: z.null(),
				rarity: z.null(),
				canvas: SkillIconStandaloneCanvasSchema
			})
			.strict(),
		z
			.object({
				...common,
				role: z.literal('calibration-plate'),
				skillTargetId: z.null(),
				motifFamily: MotifFamilySchema,
				rarity: z.null(),
				canvas: SkillIconCalibrationCanvasSchema
			})
			.strict(),
		z
			.object({
				...common,
				role: z.literal('skill-art'),
				skillTargetId: SkillTargetIdSchema,
				motifFamily: z.null(),
				rarity: z.null(),
				canvas: SkillIconStandaloneCanvasSchema
			})
			.strict()
	]);
}

export const SkillIconTargetV1Schema = targetVariant(SkillIconTargetV1CommonShape).superRefine(
	(target, context) => {
		refineSkillIconTarget(target, context);
		const expectedHistoricalJobId =
			target.role === 'rarity-frame'
				? `rarity-frame-${target.rarity.toLowerCase()}-v1`
				: target.role === 'backing'
					? 'charcoal-forged-stone-v1'
					: null;
		if (expectedHistoricalJobId !== null && target.jobId !== expectedHistoricalJobId) {
			context.addIssue({
				code: 'custom',
				path: ['jobId'],
				message: `V1 rarity-frame and backing targets are immutable historical identities; expected ${expectedHistoricalJobId}, and later reference revisions require the V2 protocol`
			});
		}
	}
);
export const SkillIconTargetSchema = SkillIconTargetV1Schema;
export const SkillIconTargetV2Schema = z
	.discriminatedUnion('role', [
		z
			.object({
				...SkillIconTargetV2CommonShape,
				role: z.literal('rarity-frame'),
				skillTargetId: z.null(),
				motifFamily: z.null(),
				rarity: SkillIconRaritySchema,
				canvas: SkillIconStandaloneCanvasSchema
			})
			.strict(),
		z
			.object({
				...SkillIconTargetV2CommonShape,
				role: z.literal('backing'),
				skillTargetId: z.null(),
				motifFamily: z.null(),
				rarity: z.null(),
				canvas: SkillIconStandaloneCanvasSchema
			})
			.strict()
	])
	.superRefine((target, context) => {
		refineSkillIconTarget(target, context);
		const expectedLogicalIdentity =
			target.role === 'rarity-frame'
				? `rarity-frame-${target.rarity.toLowerCase()}`
				: 'charcoal-forged-stone';
		if (
			target.logicalIdentity !== expectedLogicalIdentity ||
			target.jobId !== `${target.logicalIdentity}-v${target.revision}`
		) {
			context.addIssue({
				code: 'custom',
				path: ['logicalIdentity'],
				message: 'V2 job ID must be the explicit logical identity plus revision'
			});
		}
		if (
			!/opaque\s+#00ff00\s+matte/iu.test(target.exactPrompt) ||
			!/no\s+(?:baked\s+)?checkerboard/iu.test(target.exactPrompt)
		) {
			context.addIssue({
				code: 'custom',
				path: ['exactPrompt'],
				message: 'V2 prompts must require an opaque #00FF00 matte and no baked checkerboard'
			});
		}
		const canonicalGuide =
			target.normalization.profile === 'skill-icon-green-key-role-mask-v3'
				? {
						path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
						purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
						contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
					}
				: {
						path: SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH,
						purpose: SKILL_ICON_NORMALIZATION_GUIDE_V1_PURPOSE,
						contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V1_HASH
					};
		const geometryGuide = target.references.find(
			(reference) => reference.path === canonicalGuide.path
		);
		if (
			geometryGuide?.contentHash !== canonicalGuide.contentHash ||
			geometryGuide.purpose !== canonicalGuide.purpose
		) {
			context.addIssue({
				code: 'custom',
				path: ['references'],
				message:
					'Normalized targets require their profile canonical geometry guide path, purpose, and hash'
			});
		}
	});
export const AnySkillIconTargetSchema = z.union([SkillIconTargetSchema, SkillIconTargetV2Schema]);

const OwnedOutputPathsSchema = z
	.object({
		candidatePath: SkillIconCandidatePathSchema,
		resultPath: SkillIconResultPathSchema
	})
	.strict();

export const SkillIconAssignmentSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-assignment-v1'),
		assignmentId: SlugSchema,
		jobId: SlugSchema,
		targetPath: SkillIconTargetPathSchema,
		assignmentPath: SkillIconAssignmentPathSchema,
		skillVersion: z.literal('summonlab-skill-icon-production-v1'),
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
		const boundPaths = [
			assignment.targetPath,
			assignment.assignmentPath,
			assignment.permittedOutputs.candidatePath,
			assignment.permittedOutputs.resultPath
		];
		const scopes = boundPaths.map((path) => /\/(references|calibration|icons)\//u.exec(path)?.[1]);
		if (
			assignment.assignmentId !== `assignment-${assignment.jobId}` ||
			boundPaths.some((path) => pathBasenameWithoutExtension(path) !== assignment.jobId) ||
			new Set(scopes).size !== 1
		) {
			context.addIssue({
				code: 'custom',
				message: 'Assignment paths must share the job ID basename and production namespace'
			});
		}
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

export const SkillIconAssignmentV2Schema = z
	.object({
		schemaVersion: z.literal('skill-icon-assignment-v2'),
		assignmentId: SlugSchema,
		jobId: SlugSchema,
		logicalIdentity: SlugSchema,
		revision: z.number().int().min(2),
		targetPath: SkillIconTargetPathSchema,
		assignmentPath: SkillIconAssignmentPathSchema,
		skillVersion: SkillIconProductionSkillVersionSchema,
		normalization: z.object({ profile: SkillIconProviderNormalizationProfileSchema }).strict(),
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
		const expectedSkillVersion = {
			'skill-icon-green-key-role-mask-v1': 'summonlab-skill-icon-production-v2',
			'skill-icon-green-key-role-mask-v2': 'summonlab-skill-icon-production-v3',
			'skill-icon-green-key-role-mask-v3': 'summonlab-skill-icon-production-v4'
		}[assignment.normalization.profile];
		if (assignment.skillVersion !== expectedSkillVersion) {
			context.addIssue({
				code: 'custom',
				path: ['skillVersion'],
				message: `Normalization profile ${assignment.normalization.profile} requires ${expectedSkillVersion}`
			});
		}
		const boundPaths = [
			assignment.targetPath,
			assignment.assignmentPath,
			assignment.permittedOutputs.candidatePath,
			assignment.permittedOutputs.resultPath
		];
		const scopes = boundPaths.map((path) => /\/(references|calibration|icons)\//u.exec(path)?.[1]);
		if (
			assignment.jobId !== `${assignment.logicalIdentity}-v${assignment.revision}` ||
			assignment.assignmentId !== `assignment-${assignment.jobId}` ||
			boundPaths.some((path) => pathBasenameWithoutExtension(path) !== assignment.jobId) ||
			new Set(scopes).size !== 1
		) {
			context.addIssue({
				code: 'custom',
				message: 'V2 assignment identity, revision, and paths must bind one production namespace'
			});
		}
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
export const AnySkillIconAssignmentSchema = z.union([
	SkillIconAssignmentSchema,
	SkillIconAssignmentV2Schema
]);

export const SkillIconFailureReasonSchema = z
	.object({
		kind: z.enum([
			'provider-failure',
			'provider-throttle',
			'timeout',
			'malformed-output',
			'persistence',
			'validation',
			'other'
		]),
		message: z
			.string()
			.max(1_000)
			.refine((value) => value.trim().length > 0, 'Failure message cannot be blank')
	})
	.strict();

export const SkillIconResultSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-result-v1'),
		resultId: SlugSchema,
		jobId: SlugSchema,
		assignmentId: SlugSchema,
		status: z.enum(['candidate', 'revise', 'failed']),
		exactPrompt: ExactPromptSchema,
		promptHash: StateHashSchema,
		referenceInputs: z
			.array(
				z
					.object({
						path: SkillIconReferencePathSchema,
						contentHash: StateHashSchema
					})
					.strict()
			)
			.min(1)
			.max(20),
		output: SkillIconCandidateAssetSchema.nullable(),
		resultPath: SkillIconResultPathSchema,
		findings: z.array(SkillIconResultFindingSchema).min(1).max(100),
		failureReason: SkillIconFailureReasonSchema.optional(),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema,
		totalWallTimeMs: z.number().int().nonnegative(),
		writtenOutputPaths: z.union([
			z.tuple([SkillIconCandidatePathSchema, SkillIconResultPathSchema]),
			z.tuple([SkillIconResultPathSchema])
		]),
		noSharedFilesEdited: z.literal(true),
		selfPromoted: z.literal(false)
	})
	.strict()
	.superRefine((result, context) => {
		const candidateScope = result.output
			? /\/candidates\/(references|calibration|icons)\//u.exec(result.output.path)?.[1]
			: undefined;
		const resultScope = /\/results\/(references|calibration|icons)\//u.exec(result.resultPath)?.[1];
		const writtenCandidatePath =
			result.writtenOutputPaths.length === 2 ? result.writtenOutputPaths[0] : null;
		const writtenResultPath = result.writtenOutputPaths.at(-1);
		if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
			context.addIssue({ code: 'custom', message: 'Result timestamps must be chronological' });
		}
		if (
			result.resultId !== `result-${result.jobId}` ||
			pathBasenameWithoutExtension(result.resultPath) !== result.jobId ||
			result.resultPath !== writtenResultPath ||
			(result.output !== null &&
				(pathBasenameWithoutExtension(result.output.path) !== result.jobId ||
					candidateScope !== resultScope ||
					result.output.path !== writtenCandidatePath)) ||
			(result.output === null && writtenCandidatePath !== null)
		) {
			context.addIssue({
				code: 'custom',
				path: ['writtenOutputPaths'],
				message:
					'Written paths must be the one candidate and one structured result owned by the job'
			});
		}
		if (result.status !== 'failed' && result.output === null) {
			context.addIssue({
				code: 'custom',
				path: ['output'],
				message: 'Candidate and revise results require a retained candidate output'
			});
		}
		if (result.status !== 'failed' && result.failureReason !== undefined) {
			context.addIssue({
				code: 'custom',
				path: ['failureReason'],
				message: 'Only failed results may declare a structured failure reason'
			});
		}
		if (result.status === 'candidate') {
			if (result.findings.some((finding) => finding.outcome === 'fail')) {
				context.addIssue({
					code: 'custom',
					path: ['findings'],
					message: 'Candidate results cannot contain failed findings'
				});
			}
			for (const evaluator of ['automated', 'producer'] as const) {
				if (
					!result.findings.some(
						(finding) => finding.evaluator === evaluator && finding.outcome === 'pass'
					)
				) {
					context.addIssue({
						code: 'custom',
						path: ['findings'],
						message: `Candidate results require at least one ${evaluator} pass`
					});
				}
			}
		}
		if (
			result.status === 'revise' &&
			!result.findings.some(
				(finding) => finding.outcome === 'concern' || finding.outcome === 'fail'
			)
		) {
			context.addIssue({
				code: 'custom',
				path: ['findings'],
				message: 'Revise results require at least one concern or failed finding'
			});
		}
		if (result.status === 'failed') {
			if (result.output !== null) {
				context.addIssue({
					code: 'custom',
					path: ['output'],
					message: 'Failed results cannot retain a candidate output'
				});
			}
			if (
				result.failureReason === undefined &&
				!result.findings.some((finding) => finding.outcome === 'fail')
			) {
				context.addIssue({
					code: 'custom',
					path: ['failureReason'],
					message: 'Failed results require a failed finding or structured failure reason'
				});
			}
		}
		const expectedPromptHash = createHash('sha256').update(result.exactPrompt).digest('hex');
		if (result.promptHash !== expectedPromptHash) {
			context.addIssue({
				code: 'custom',
				path: ['promptHash'],
				message: 'Prompt hash must be the SHA-256 of the exact prompt'
			});
		}
	});

export const SkillIconProviderSourceEvidenceSchema = z
	.object({
		mediaType: z.literal('image/png'),
		width: z.literal(1254),
		height: z.literal(1254),
		bytes: z.number().int().positive(),
		alphaMode: z.literal('rgb'),
		contentHash: StateHashSchema
	})
	.strict();

export const SkillIconProviderSourceEvidenceV2Schema = z
	.object({
		mediaType: z.literal('image/png'),
		width: z.literal(1254),
		height: z.literal(1254),
		bytes: z
			.number()
			.int()
			.positive()
			.max(64 * 1024 * 1024),
		alphaMode: z.literal('rgb'),
		contentHash: StateHashSchema
	})
	.strict();

export const SkillIconObservedProviderSourceEvidenceSchema = z
	.object({
		mediaType: z.enum(['image/png', 'image/webp', 'application/octet-stream']),
		width: z.number().int().nonnegative().max(8_192).nullable(),
		height: z.number().int().nonnegative().max(8_192).nullable(),
		bytes: z.number().int().nonnegative(),
		alphaMode: z.enum(['rgb', 'rgba']).nullable(),
		contentHash: StateHashSchema
	})
	.strict();

const SkillIconNormalizationEvidenceV1Schema = z.discriminatedUnion('outcome', [
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV1Schema,
			outcome: z.literal('not-run'),
			geometryHash: StateHashSchema,
			providerSource: z.null(),
			sourceContentHash: z.null(),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV1Schema,
			outcome: z.literal('failed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconObservedProviderSourceEvidenceSchema,
			sourceContentHash: StateHashSchema,
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV1Schema,
			outcome: z.literal('completed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconProviderSourceEvidenceSchema,
			sourceContentHash: StateHashSchema,
			outputContentHash: StateHashSchema
		})
		.strict()
]);

export const SkillIconContainerBoxEvidenceSchema = z
	.object({
		chunkType: z.literal('caBX'),
		bytes: z.number().int().min(8).max(32_768),
		contentHash: StateHashSchema
	})
	.strict();

const SkillIconNormalizationEvidenceV2Schema = z.union([
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV2Schema,
			outcome: z.literal('not-run'),
			geometryHash: StateHashSchema,
			providerSource: z.null(),
			sourceContentHash: z.null(),
			decoderInputContentHash: z.null(),
			containerBox: z.null(),
			colorSpaceDisposition: z.null(),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV2Schema,
			outcome: z.literal('failed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconObservedProviderSourceEvidenceSchema,
			sourceContentHash: StateHashSchema,
			decoderInputContentHash: z.null(),
			containerBox: z.null(),
			colorSpaceDisposition: z.null(),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV2Schema,
			outcome: z.literal('failed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconObservedProviderSourceEvidenceSchema,
			sourceContentHash: StateHashSchema,
			decoderInputContentHash: StateHashSchema,
			containerBox: SkillIconContainerBoxEvidenceSchema,
			colorSpaceDisposition: z.literal('assigned-srgb'),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV2Schema,
			outcome: z.literal('completed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconProviderSourceEvidenceV2Schema,
			sourceContentHash: StateHashSchema,
			decoderInputContentHash: StateHashSchema,
			containerBox: SkillIconContainerBoxEvidenceSchema,
			colorSpaceDisposition: z.literal('assigned-srgb'),
			outputContentHash: StateHashSchema
		})
		.strict()
]);

export const SkillIconNormalizationEvidenceV3Schema = z.union([
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV3Schema,
			outcome: z.literal('not-run'),
			geometryHash: StateHashSchema,
			providerSource: z.null(),
			sourceContentHash: z.null(),
			decoderInputContentHash: z.null(),
			containerBox: z.null(),
			colorSpaceDisposition: z.null(),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV3Schema,
			outcome: z.literal('failed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconObservedProviderSourceEvidenceSchema,
			sourceContentHash: StateHashSchema,
			decoderInputContentHash: z.null(),
			containerBox: z.null(),
			colorSpaceDisposition: z.null(),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV3Schema,
			outcome: z.literal('failed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconObservedProviderSourceEvidenceSchema,
			sourceContentHash: StateHashSchema,
			decoderInputContentHash: StateHashSchema,
			containerBox: SkillIconContainerBoxEvidenceSchema,
			colorSpaceDisposition: z.literal('assigned-srgb'),
			outputContentHash: z.null()
		})
		.strict(),
	z
		.object({
			profile: SkillIconProviderNormalizationProfileV3Schema,
			outcome: z.literal('completed'),
			geometryHash: StateHashSchema,
			providerSource: SkillIconProviderSourceEvidenceV2Schema,
			sourceContentHash: StateHashSchema,
			decoderInputContentHash: StateHashSchema,
			containerBox: SkillIconContainerBoxEvidenceSchema,
			colorSpaceDisposition: z.literal('assigned-srgb'),
			outputContentHash: StateHashSchema
		})
		.strict()
]);

export const SkillIconNormalizationEvidenceSchema = z.union([
	SkillIconNormalizationEvidenceV1Schema,
	SkillIconNormalizationEvidenceV2Schema,
	SkillIconNormalizationEvidenceV3Schema
]);

export const SkillIconAttemptResultV2Schema = z
	.object({
		schemaVersion: z.literal('skill-icon-result-v2'),
		resultId: SlugSchema,
		jobId: SlugSchema,
		logicalIdentity: SlugSchema,
		revision: z.number().int().min(2),
		assignmentId: SlugSchema,
		status: z.enum(['candidate', 'revise', 'failed']),
		exactPrompt: ExactPromptSchema,
		promptHash: StateHashSchema,
		referenceInputs: z
			.array(
				z
					.object({
						path: SkillIconReferencePathSchema,
						contentHash: StateHashSchema
					})
					.strict()
			)
			.min(1)
			.max(20),
		normalization: SkillIconNormalizationEvidenceSchema,
		output: SkillIconCandidateAssetSchema.nullable(),
		resultPath: SkillIconResultPathSchema,
		findings: z.array(SkillIconResultFindingV2Schema).min(1).max(100),
		failureReason: SkillIconFailureReasonSchema.optional(),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema,
		totalWallTimeMs: z.number().int().nonnegative(),
		writtenOutputPaths: z.union([
			z.tuple([SkillIconCandidatePathSchema, SkillIconResultPathSchema]),
			z.tuple([SkillIconResultPathSchema])
		]),
		noSharedFilesEdited: z.literal(true),
		selfPromoted: z.literal(false)
	})
	.strict()
	.superRefine((result, context) => {
		const v1Equivalent = {
			...result,
			schemaVersion: 'skill-icon-result-v1' as const,
			findings: result.findings.map((finding) => ({
				...finding,
				category:
					finding.category === 'deterministic-normalization'
						? ('exact-source-persistence' as const)
						: finding.category
			}))
		};
		delete (v1Equivalent as Partial<typeof v1Equivalent>).logicalIdentity;
		delete (v1Equivalent as Partial<typeof v1Equivalent>).revision;
		delete (v1Equivalent as Partial<typeof v1Equivalent>).normalization;
		const v1 = SkillIconResultSchema.safeParse(v1Equivalent);
		if (!v1.success) {
			context.addIssue({
				code: 'custom',
				message: `V2 result violates shared result invariants: ${v1.error.issues
					.map((issue) => issue.message)
					.join('; ')}`
			});
		}
		if (result.jobId !== `${result.logicalIdentity}-v${result.revision}`) {
			context.addIssue({
				code: 'custom',
				path: ['logicalIdentity'],
				message: 'V2 result job ID must bind its explicit logical identity and revision'
			});
		}
		if (
			result.status !== 'failed' &&
			(result.normalization.outcome !== 'completed' || result.output === null)
		) {
			context.addIssue({
				code: 'custom',
				path: ['normalization'],
				message: 'Retained V2 outputs require provider-source and normalization evidence'
			});
		}
		if (
			result.normalization.providerSource !== null &&
			result.normalization.sourceContentHash !== result.normalization.providerSource.contentHash
		) {
			context.addIssue({
				code: 'custom',
				path: ['normalization', 'sourceContentHash'],
				message: 'Normalization source hash must bind the observed provider bytes'
			});
		}
		if (
			result.normalization.outcome === 'completed' &&
			result.output !== null &&
			result.normalization.outputContentHash !== result.output.contentHash
		) {
			context.addIssue({
				code: 'custom',
				path: ['normalization'],
				message: 'Normalization hashes must bind the provider source and retained output'
			});
		}
	});

export const SKILL_ICON_SUPERSESSION_REASON =
	'unattempted-packet-superseded-by-higher-revision' as const;

export const SkillIconSupersedingAuthoritySchema = z
	.object({
		targetPath: SkillIconTargetPathSchema,
		targetContentHash: StateHashSchema,
		assignmentPath: SkillIconAssignmentPathSchema,
		assignmentContentHash: StateHashSchema,
		jobId: SlugSchema,
		logicalIdentity: SlugSchema,
		revision: z.number().int().min(2),
		role: SkillIconRoleSchema
	})
	.strict()
	.superRefine((authority, context) => {
		const expectedScope = productionScopeForRole(authority.role);
		if (
			authority.jobId !== `${authority.logicalIdentity}-v${authority.revision}` ||
			authority.targetPath !==
				`assets/wiki/skills/icon-production-v1/targets/${expectedScope}/${authority.jobId}.json` ||
			authority.assignmentPath !==
				`assets/wiki/skills/icon-production-v1/assignments/${expectedScope}/${authority.jobId}.json`
		) {
			context.addIssue({
				code: 'custom',
				message: 'Superseding authority paths must canonically bind its job identity and role'
			});
		}
	});

export const SkillIconSupersededResultV2Schema = z
	.object({
		schemaVersion: z.literal('skill-icon-result-v2'),
		resultId: SlugSchema,
		jobId: SlugSchema,
		logicalIdentity: SlugSchema,
		revision: z.number().int().min(2),
		role: SkillIconRoleSchema,
		assignmentId: SlugSchema,
		status: z.literal('superseded'),
		attemptCount: z.literal(0),
		supersessionReason: z.literal(SKILL_ICON_SUPERSESSION_REASON),
		supersedingAuthority: SkillIconSupersedingAuthoritySchema,
		exactPrompt: ExactPromptSchema,
		promptHash: StateHashSchema,
		referenceInputs: z
			.array(
				z
					.object({
						path: SkillIconReferencePathSchema,
						contentHash: StateHashSchema
					})
					.strict()
			)
			.min(1)
			.max(20),
		normalization: SkillIconNormalizationEvidenceSchema,
		output: z.null(),
		resultPath: SkillIconResultPathSchema,
		findings: z.tuple([]),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema,
		totalWallTimeMs: z.literal(0),
		writtenOutputPaths: z.tuple([SkillIconResultPathSchema]),
		noSharedFilesEdited: z.literal(true),
		selfPromoted: z.literal(false)
	})
	.strict()
	.superRefine((result, context) => {
		if (
			result.resultId !== `result-${result.jobId}` ||
			result.assignmentId !== `assignment-${result.jobId}` ||
			result.jobId !== `${result.logicalIdentity}-v${result.revision}` ||
			pathBasenameWithoutExtension(result.resultPath) !== result.jobId ||
			result.writtenOutputPaths[0] !== result.resultPath
		) {
			context.addIssue({
				code: 'custom',
				message: 'Superseded result identity and result-only output must bind the retired job'
			});
		}
		if (
			result.supersedingAuthority.logicalIdentity !== result.logicalIdentity ||
			result.supersedingAuthority.role !== result.role ||
			result.supersedingAuthority.revision <= result.revision
		) {
			context.addIssue({
				code: 'custom',
				path: ['supersedingAuthority'],
				message:
					'Superseding authority must bind the same logical identity and role at a strictly higher revision'
			});
		}
		if (
			result.normalization.outcome !== 'not-run' ||
			result.normalization.providerSource !== null ||
			result.normalization.sourceContentHash !== null ||
			result.normalization.outputContentHash !== null
		) {
			context.addIssue({
				code: 'custom',
				path: ['normalization'],
				message: 'An unattempted superseded result requires exact not-run normalization evidence'
			});
		}
		if (
			result.promptHash !== createHash('sha256').update(result.exactPrompt).digest('hex') ||
			result.startedAt !== result.completedAt
		) {
			context.addIssue({
				code: 'custom',
				message:
					'Superseded result prompt hash must match and its zero-duration timestamps must agree'
			});
		}
	});

export const SkillIconResultV2Schema = z.union([
	SkillIconAttemptResultV2Schema,
	SkillIconSupersededResultV2Schema
]);
export const AnySkillIconResultSchema = z.union([SkillIconResultSchema, SkillIconResultV2Schema]);

export const SKILL_ICON_REPROCESS_TOOL_VERSION = 'summonlab-skill-icon-reprocess-v1' as const;
export const SKILL_ICON_REPROCESS_SOURCE_MODE = 'reuse-prior-provider-source' as const;

const SkillIconReprocessBoundFileSchema = <PathSchema extends z.ZodTypeAny>(
	pathSchema: PathSchema
) =>
	z
		.object({
			path: pathSchema,
			contentHash: StateHashSchema
		})
		.strict();

export const SkillIconReprocessOriginAuthoritySchema = z
	.object({
		target: SkillIconReprocessBoundFileSchema(SkillIconTargetPathSchema),
		assignment: SkillIconReprocessBoundFileSchema(SkillIconAssignmentPathSchema),
		result: SkillIconReprocessBoundFileSchema(SkillIconResultPathSchema),
		providerSourceHash: StateHashSchema
	})
	.strict();

export const SkillIconReprocessProcessingAuthoritySchema = z
	.object({
		profile: SkillIconProviderNormalizationProfileV3Schema,
		geometry: z
			.object({
				path: z.literal(SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH),
				contentHash: z.literal(SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH)
			})
			.strict(),
		guide: z
			.object({
				path: z.literal(SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH),
				contentHash: z.literal(SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH),
				purpose: z.literal(SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE)
			})
			.strict()
	})
	.strict();

function refineSkillIconReprocessOriginPaths(
	value: {
		readonly logicalIdentity: string;
		readonly revision: number;
		readonly originAuthority: z.infer<typeof SkillIconReprocessOriginAuthoritySchema>;
	},
	context: z.RefinementCtx
): void {
	const originJobIds = [
		value.originAuthority.target.path,
		value.originAuthority.assignment.path,
		value.originAuthority.result.path
	].map(pathBasenameWithoutExtension);
	const revisionMatch = new RegExp(`^${value.logicalIdentity}-v([0-9]+)$`, 'u').exec(
		originJobIds[0] ?? ''
	);
	if (
		new Set(originJobIds).size !== 1 ||
		revisionMatch === null ||
		Number(revisionMatch[1]) >= value.revision ||
		!value.originAuthority.target.path.includes('/targets/references/') ||
		!value.originAuthority.assignment.path.includes('/assignments/references/') ||
		!value.originAuthority.result.path.includes('/results/references/')
	) {
		context.addIssue({
			code: 'custom',
			path: ['originAuthority'],
			message: 'Reprocess origin paths must bind one strictly older ordinary reference-job identity'
		});
	}
}

const SkillIconReprocessTargetCommonShape = {
	schemaVersion: z.literal('skill-icon-reprocess-target-v1'),
	jobId: SlugSchema,
	logicalIdentity: SlugSchema,
	revision: z.number().int().min(2),
	sourceMode: z.literal(SKILL_ICON_REPROCESS_SOURCE_MODE),
	originAuthority: SkillIconReprocessOriginAuthoritySchema,
	processingAuthority: SkillIconReprocessProcessingAuthoritySchema,
	output: OwnedOutputPathsSchema
};

export const SkillIconReprocessTargetSchema = z
	.object({
		...SkillIconReprocessTargetCommonShape,
		role: z.literal('rarity-frame'),
		rarity: SkillIconRaritySchema
	})
	.strict()
	.superRefine((target, context) => {
		refineSkillIconReprocessOriginPaths(target, context);
		const expectedIdentity = `rarity-frame-${target.rarity.toLowerCase()}`;
		if (
			target.logicalIdentity !== expectedIdentity ||
			target.jobId !== `${target.logicalIdentity}-v${target.revision}` ||
			pathBasenameWithoutExtension(target.output.candidatePath) !== target.jobId ||
			pathBasenameWithoutExtension(target.output.resultPath) !== target.jobId ||
			!target.output.candidatePath.includes('/candidates/references/') ||
			!target.output.resultPath.includes('/results/references/')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Reprocess target identity, revision, and reference output paths must bind one job'
			});
		}
	});

export const SkillIconReprocessAssignmentSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-reprocess-assignment-v1'),
		assignmentId: SlugSchema,
		jobId: SlugSchema,
		logicalIdentity: SlugSchema,
		revision: z.number().int().min(2),
		role: z.literal('rarity-frame'),
		rarity: SkillIconRaritySchema,
		targetPath: SkillIconTargetPathSchema,
		targetContentHash: StateHashSchema,
		assignmentPath: SkillIconAssignmentPathSchema,
		toolVersion: z.literal(SKILL_ICON_REPROCESS_TOOL_VERSION),
		sourceMode: z.literal(SKILL_ICON_REPROCESS_SOURCE_MODE),
		generationAttemptLimit: z.literal(0),
		normalizationTransactionLimit: z.literal(1),
		permittedOutputs: OwnedOutputPathsSchema,
		completionContract: z
			.object({
				coordinatorOnly: z.literal(true),
				structuredResultRequired: z.literal(true),
				sharedFilesMustRemainUntouched: z.literal(true),
				selfPromotionForbidden: z.literal(true)
			})
			.strict()
	})
	.strict()
	.superRefine((assignment, context) => {
		const expectedJobId = `${assignment.logicalIdentity}-v${assignment.revision}`;
		const expectedIdentity = `rarity-frame-${assignment.rarity.toLowerCase()}`;
		const expectedTargetPath = `assets/wiki/skills/icon-production-v1/targets/references/${expectedJobId}.json`;
		const expectedAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${expectedJobId}.json`;
		if (
			assignment.logicalIdentity !== expectedIdentity ||
			assignment.jobId !== expectedJobId ||
			assignment.assignmentId !== `assignment-${assignment.jobId}` ||
			assignment.targetPath !== expectedTargetPath ||
			assignment.assignmentPath !== expectedAssignmentPath ||
			assignment.permittedOutputs.candidatePath !==
				`assets/wiki/skills/icon-production-v1/candidates/references/${expectedJobId}.png` ||
			assignment.permittedOutputs.resultPath !==
				`assets/wiki/skills/icon-production-v1/results/references/${expectedJobId}.json`
		) {
			context.addIssue({
				code: 'custom',
				message:
					'Reprocess assignment must canonically bind one reference job, role, and output grant'
			});
		}
	});

export const SkillIconReprocessInspectionSchema = z
	.object({
		inspection: z.enum(['full-size', 'recognition-96']),
		outcome: z.enum(['pass', 'fail', 'not-run']),
		observation: NonEmptyTextSchema.max(1_000)
	})
	.strict();

const SkillIconReprocessResultCommonShape = {
	schemaVersion: z.literal('skill-icon-reprocess-result-v1'),
	resultId: SlugSchema,
	jobId: SlugSchema,
	logicalIdentity: SlugSchema,
	revision: z.number().int().min(2),
	role: z.literal('rarity-frame'),
	rarity: SkillIconRaritySchema,
	assignmentId: SlugSchema,
	targetPath: SkillIconTargetPathSchema,
	targetContentHash: StateHashSchema,
	assignmentPath: SkillIconAssignmentPathSchema,
	assignmentContentHash: StateHashSchema,
	sourceMode: z.literal(SKILL_ICON_REPROCESS_SOURCE_MODE),
	originAuthority: SkillIconReprocessOriginAuthoritySchema,
	processingAuthority: SkillIconReprocessProcessingAuthoritySchema,
	generationAttemptCount: z.literal(0),
	normalizationTransactionCount: z.literal(1),
	normalization: SkillIconNormalizationEvidenceV3Schema,
	resultPath: SkillIconResultPathSchema,
	inspections: z.tuple([
		SkillIconReprocessInspectionSchema.refine(
			(inspection) => inspection.inspection === 'full-size',
			'First inspection must be full-size'
		),
		SkillIconReprocessInspectionSchema.refine(
			(inspection) => inspection.inspection === 'recognition-96',
			'Second inspection must be recognition-96'
		)
	]),
	startedAt: IsoDateTimeSchema,
	completedAt: IsoDateTimeSchema,
	totalWallTimeMs: z.number().int().nonnegative(),
	noSharedFilesEdited: z.literal(true),
	selfPromoted: z.literal(false)
};

const SkillIconReprocessCandidateResultSchema = z
	.object({
		...SkillIconReprocessResultCommonShape,
		status: z.literal('candidate'),
		output: SkillIconCandidateAssetSchema,
		failureReason: z.undefined().optional(),
		writtenOutputPaths: z.tuple([SkillIconCandidatePathSchema, SkillIconResultPathSchema])
	})
	.strict();

const SkillIconReprocessFailedResultSchema = z
	.object({
		...SkillIconReprocessResultCommonShape,
		status: z.literal('failed'),
		output: z.null(),
		failureReason: SkillIconFailureReasonSchema,
		writtenOutputPaths: z.tuple([SkillIconResultPathSchema])
	})
	.strict();

export const SkillIconReprocessResultSchema = z
	.discriminatedUnion('status', [
		SkillIconReprocessCandidateResultSchema,
		SkillIconReprocessFailedResultSchema
	])
	.superRefine((result, context) => {
		refineSkillIconReprocessOriginPaths(result, context);
		const expectedJobId = `${result.logicalIdentity}-v${result.revision}`;
		const expectedIdentity = `rarity-frame-${result.rarity.toLowerCase()}`;
		const expectedResultPath = `assets/wiki/skills/icon-production-v1/results/references/${expectedJobId}.json`;
		const expectedTargetPath = `assets/wiki/skills/icon-production-v1/targets/references/${expectedJobId}.json`;
		const expectedAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${expectedJobId}.json`;
		if (
			result.logicalIdentity !== expectedIdentity ||
			result.jobId !== expectedJobId ||
			result.resultId !== `result-${result.jobId}` ||
			result.assignmentId !== `assignment-${result.jobId}` ||
			result.targetPath !== expectedTargetPath ||
			result.assignmentPath !== expectedAssignmentPath ||
			result.resultPath !== expectedResultPath ||
			result.writtenOutputPaths.at(-1) !== expectedResultPath ||
			Date.parse(result.completedAt) - Date.parse(result.startedAt) !== result.totalWallTimeMs
		) {
			context.addIssue({
				code: 'custom',
				message: 'Reprocess result identity, role, timestamps, and result path must agree'
			});
		}
		if (result.status === 'failed' && result.normalization.outcome === 'not-run') {
			context.addIssue({
				code: 'custom',
				path: ['normalization'],
				message:
					'Preflight rejection produces no result; a failed reprocess transaction requires failed or completed normalization evidence'
			});
		}
		if (
			result.status === 'failed' &&
			result.normalization.providerSource !== null &&
			!SkillIconProviderSourceEvidenceV2Schema.safeParse(result.normalization.providerSource)
				.success
		) {
			context.addIssue({
				code: 'custom',
				path: ['normalization', 'providerSource'],
				message: 'A reprocess transaction can begin only after exact source preflight succeeds'
			});
		}
		if (
			result.normalization.geometryHash !== SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH ||
			(result.normalization.providerSource !== null &&
				result.normalization.providerSource.contentHash !==
					result.originAuthority.providerSourceHash) ||
			(result.normalization.sourceContentHash !== null &&
				result.normalization.sourceContentHash !== result.originAuthority.providerSourceHash)
		) {
			context.addIssue({
				code: 'custom',
				path: ['normalization'],
				message: 'Reprocess normalization must bind the source and processing authorities'
			});
		}
		if (result.status === 'candidate') {
			if (
				result.normalization.outcome !== 'completed' ||
				result.normalization.outputContentHash !== result.output.contentHash ||
				result.output.path !==
					`assets/wiki/skills/icon-production-v1/candidates/references/${expectedJobId}.png` ||
				result.output.width !== 1024 ||
				result.output.height !== 1024 ||
				result.output.mediaType !== 'image/png' ||
				result.output.alphaMode !== 'rgba' ||
				result.inspections.some((inspection) => inspection.outcome !== 'pass') ||
				result.writtenOutputPaths[0] !== result.output.path
			) {
				context.addIssue({
					code: 'custom',
					message:
						'Candidate reprocess results require completed normalization and both inspections passing'
				});
			}
		} else {
			const [fullSize, recognition] = result.inspections;
			const validationInspectionFailure =
				result.failureReason.kind === 'validation' &&
				((fullSize.outcome === 'fail' && recognition.outcome === 'not-run') ||
					(fullSize.outcome === 'pass' && recognition.outcome === 'fail'));
			const persistenceAfterInspection =
				result.failureReason.kind === 'persistence' &&
				fullSize.outcome === 'pass' &&
				recognition.outcome === 'pass';
			if (
				(result.normalization.outcome === 'failed' &&
					(result.failureReason.kind !== 'validation' ||
						fullSize.outcome !== 'not-run' ||
						recognition.outcome !== 'not-run')) ||
				(result.normalization.outcome === 'completed' &&
					!validationInspectionFailure &&
					!persistenceAfterInspection)
			) {
				context.addIssue({
					code: 'custom',
					path: ['failureReason'],
					message:
						'Reprocess failure kind and inspections must identify validation or post-inspection persistence exactly'
				});
			}
		}
	});

export const SkillIconReprocessOriginExecutionSchema = z
	.object({
		target: SkillIconTargetV2Schema,
		assignment: SkillIconAssignmentV2Schema,
		result: SkillIconAttemptResultV2Schema
	})
	.strict()
	.superRefine((origin, context) => {
		const ordinary = SkillIconExecutionV2Schema.safeParse({
			schemaVersion: 'skill-icon-execution-v2',
			...origin
		});
		if (!ordinary.success || origin.result.status !== 'failed' || origin.result.output !== null) {
			context.addIssue({
				code: 'custom',
				message: 'Reprocess origin must be one failed, output-free ordinary V2 execution'
			});
		}
		if (
			origin.result.normalization.providerSource === null ||
			origin.result.normalization.sourceContentHash !==
				origin.result.normalization.providerSource.contentHash
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'normalization'],
				message: 'Reprocess origin must bind observed provider-source bytes'
			});
		}
	});

export const SkillIconExecutionSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-execution-v1'),
		target: SkillIconTargetSchema,
		assignment: SkillIconAssignmentSchema,
		result: SkillIconResultSchema
	})
	.strict()
	.superRefine((execution, context) => {
		const { target, assignment, result } = execution;
		const expectedScope = productionScopeForRole(target.role);
		const expectedTargetPath = `assets/wiki/skills/icon-production-v1/targets/${expectedScope}/${target.jobId}.json`;
		const expectedAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${expectedScope}/${target.jobId}.json`;
		if (
			target.jobId !== assignment.jobId ||
			target.jobId !== result.jobId ||
			assignment.assignmentId !== result.assignmentId ||
			assignment.targetPath !== expectedTargetPath ||
			assignment.assignmentPath !== expectedAssignmentPath
		) {
			context.addIssue({
				code: 'custom',
				message: 'Target, assignment, and result must share one job identity and namespace'
			});
		}

		if (
			target.output.candidatePath !== assignment.permittedOutputs.candidatePath ||
			target.output.resultPath !== assignment.permittedOutputs.resultPath ||
			target.output.resultPath !== result.resultPath ||
			(result.output !== null &&
				(target.output.candidatePath !== result.output.path ||
					result.writtenOutputPaths.length !== 2 ||
					target.output.candidatePath !== result.writtenOutputPaths[0] ||
					target.output.resultPath !== result.writtenOutputPaths[1])) ||
			(result.output === null &&
				(result.writtenOutputPaths.length !== 1 ||
					target.output.resultPath !== result.writtenOutputPaths[0]))
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'writtenOutputPaths'],
				message: 'Execution output paths must exactly match the target and assignment grant'
			});
		}

		if (target.exactPrompt !== result.exactPrompt) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'exactPrompt'],
				message: 'Result exact prompt must match the immutable target prompt'
			});
		}

		const targetReferences = target.references.map(({ path, contentHash }) => ({
			path,
			contentHash
		}));
		if (JSON.stringify(targetReferences) !== JSON.stringify(result.referenceInputs)) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'referenceInputs'],
				message: 'Result references must exactly match the target path and hash bindings'
			});
		}

		if (
			result.output !== null &&
			(result.output.width !== target.canvas.width ||
				result.output.height !== target.canvas.height ||
				result.output.mediaType !== target.canvas.mediaType)
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'output'],
				message: 'Result output dimensions and media type must match the target canvas'
			});
		}
		if (
			result.output !== null &&
			target.role !== 'calibration-plate' &&
			result.output.alphaMode !== 'rgba'
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'output', 'alphaMode'],
				message: 'Standalone skill-icon outputs require RGBA'
			});
		}
	});

export const SkillIconExecutionV2Schema = z
	.object({
		schemaVersion: z.literal('skill-icon-execution-v2'),
		target: SkillIconTargetV2Schema,
		assignment: SkillIconAssignmentV2Schema,
		result: SkillIconResultV2Schema
	})
	.strict()
	.superRefine((execution, context) => {
		const { target, assignment, result } = execution;
		const expectedScope = productionScopeForRole(target.role);
		const expectedTargetPath = `assets/wiki/skills/icon-production-v1/targets/${expectedScope}/${target.jobId}.json`;
		const expectedAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${expectedScope}/${target.jobId}.json`;
		if (
			target.jobId !== assignment.jobId ||
			target.jobId !== result.jobId ||
			target.logicalIdentity !== assignment.logicalIdentity ||
			target.logicalIdentity !== result.logicalIdentity ||
			target.revision !== assignment.revision ||
			target.revision !== result.revision ||
			assignment.assignmentId !== result.assignmentId ||
			(result.status === 'superseded' && target.role !== result.role) ||
			assignment.targetPath !== expectedTargetPath ||
			assignment.assignmentPath !== expectedAssignmentPath
		) {
			context.addIssue({
				code: 'custom',
				message: 'V2 target, assignment, and result must share identity, revision, and namespace'
			});
		}
		if (
			target.output.candidatePath !== assignment.permittedOutputs.candidatePath ||
			target.output.resultPath !== assignment.permittedOutputs.resultPath ||
			target.output.resultPath !== result.resultPath ||
			(result.output !== null &&
				(target.output.candidatePath !== result.output.path ||
					result.writtenOutputPaths.length !== 2 ||
					target.output.candidatePath !== result.writtenOutputPaths[0] ||
					target.output.resultPath !== result.writtenOutputPaths[1])) ||
			(result.output === null &&
				(result.writtenOutputPaths.length !== 1 ||
					target.output.resultPath !== result.writtenOutputPaths[0]))
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'writtenOutputPaths'],
				message: 'V2 execution outputs must exactly match the assignment grant'
			});
		}
		if (target.exactPrompt !== result.exactPrompt) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'exactPrompt'],
				message: 'Result exact prompt must match the immutable target prompt'
			});
		}
		const targetReferences = target.references.map(({ path, contentHash }) => ({
			path,
			contentHash
		}));
		if (JSON.stringify(targetReferences) !== JSON.stringify(result.referenceInputs)) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'referenceInputs'],
				message: 'Result references must exactly match the target bindings'
			});
		}
		if (
			target.normalization.profile !== assignment.normalization.profile ||
			(result.normalization !== null &&
				(result.normalization.profile !== target.normalization.profile ||
					result.normalization.geometryHash !== target.normalization.geometry.contentHash))
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'normalization'],
				message: 'V2 normalization profile and geometry hash must match target authority'
			});
		}
		if (
			result.output !== null &&
			(result.output.width !== target.normalization.outputContract.width ||
				result.output.height !== target.normalization.outputContract.height ||
				result.output.mediaType !== target.normalization.outputContract.mediaType ||
				result.output.alphaMode !== target.normalization.outputContract.alphaMode)
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'output'],
				message: 'V2 result output must match the canonical normalization output contract'
			});
		}
	});

export const SkillIconReprocessExecutionSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-reprocess-execution-v1'),
		target: SkillIconReprocessTargetSchema,
		assignment: SkillIconReprocessAssignmentSchema,
		result: SkillIconReprocessResultSchema,
		origin: SkillIconReprocessOriginExecutionSchema
	})
	.strict()
	.superRefine((execution, context) => {
		const { target, assignment, result, origin } = execution;
		const expectedTargetPath = `assets/wiki/skills/icon-production-v1/targets/references/${target.jobId}.json`;
		const expectedAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${target.jobId}.json`;
		const originScope = productionScopeForRole(origin.target.role);
		const expectedOriginTargetPath = `assets/wiki/skills/icon-production-v1/targets/${originScope}/${origin.target.jobId}.json`;
		const expectedOriginAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${originScope}/${origin.target.jobId}.json`;
		const expectedOriginResultPath = `assets/wiki/skills/icon-production-v1/results/${originScope}/${origin.target.jobId}.json`;
		if (
			target.jobId !== assignment.jobId ||
			target.jobId !== result.jobId ||
			target.logicalIdentity !== assignment.logicalIdentity ||
			target.logicalIdentity !== result.logicalIdentity ||
			target.revision !== assignment.revision ||
			target.revision !== result.revision ||
			target.role !== assignment.role ||
			target.role !== result.role ||
			target.rarity !== assignment.rarity ||
			target.rarity !== result.rarity ||
			assignment.assignmentId !== result.assignmentId ||
			assignment.targetPath !== expectedTargetPath ||
			assignment.assignmentPath !== expectedAssignmentPath ||
			result.targetPath !== expectedTargetPath ||
			result.assignmentPath !== expectedAssignmentPath ||
			result.targetContentHash !== assignment.targetContentHash
		) {
			context.addIssue({
				code: 'custom',
				message: 'Reprocess target, assignment, and result authorities must bind one job'
			});
		}
		if (
			JSON.stringify(target.originAuthority) !== JSON.stringify(result.originAuthority) ||
			JSON.stringify(target.processingAuthority) !== JSON.stringify(result.processingAuthority)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Reprocess result must repeat the exact origin and processing authorities'
			});
		}
		if (
			target.output.candidatePath !== assignment.permittedOutputs.candidatePath ||
			target.output.resultPath !== assignment.permittedOutputs.resultPath ||
			target.output.resultPath !== result.resultPath ||
			(result.output !== null && target.output.candidatePath !== result.output.path)
		) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'writtenOutputPaths'],
				message: 'Reprocess execution may write only its granted candidate and result paths'
			});
		}
		if (
			origin.target.logicalIdentity !== target.logicalIdentity ||
			origin.target.role !== target.role ||
			origin.target.rarity !== target.rarity ||
			origin.target.revision >= target.revision ||
			target.originAuthority.target.path !== expectedOriginTargetPath ||
			target.originAuthority.assignment.path !== expectedOriginAssignmentPath ||
			target.originAuthority.result.path !== expectedOriginResultPath ||
			target.originAuthority.providerSourceHash !==
				origin.result.normalization.providerSource?.contentHash
		) {
			context.addIssue({
				code: 'custom',
				path: ['target', 'originAuthority'],
				message:
					'Reprocess origin must be a strictly older failed ordinary job with the same identity, role, rarity, and provider bytes'
			});
		}
	});

export const AnySkillIconReprocessExecutionSchema = SkillIconReprocessExecutionSchema;
export const AnySkillIconExecutionSchema = z.union([
	SkillIconExecutionSchema,
	SkillIconExecutionV2Schema
]);

export type SkillIconLifecycle = z.infer<typeof SkillIconLifecycleSchema>;
export type SkillIconRarity = z.infer<typeof SkillIconRaritySchema>;
export type SkillMastery = z.infer<typeof SkillMasterySchema>;
export type SkillIconMastery = SkillMastery;
export type SkillIconRole = z.infer<typeof SkillIconRoleSchema>;
export type SkillIconProviderNormalizationProfileV1 = z.infer<
	typeof SkillIconProviderNormalizationProfileV1Schema
>;
export type SkillIconProviderNormalizationProfileV2 = z.infer<
	typeof SkillIconProviderNormalizationProfileV2Schema
>;
export type SkillIconProviderNormalizationProfileV3 = z.infer<
	typeof SkillIconProviderNormalizationProfileV3Schema
>;
export type SkillIconProviderNormalizationProfile = z.infer<
	typeof SkillIconProviderNormalizationProfileSchema
>;
export type SkillIconProductionSkillVersion = z.infer<typeof SkillIconProductionSkillVersionSchema>;
export type SkillIconRepositoryPath = z.infer<typeof SkillIconRepositoryPathSchema>;
export type SkillIconCandidatePath = z.infer<typeof SkillIconCandidatePathSchema>;
export type SkillIconMasterPath = z.infer<typeof SkillIconMasterPathSchema>;
export type SkillIconRuntimePath = z.infer<typeof SkillIconRuntimePathSchema>;
export type SkillIconRecognitionPath = z.infer<typeof SkillIconRecognitionPathSchema>;
export type SkillIconTargetPath = z.infer<typeof SkillIconTargetPathSchema>;
export type SkillIconAssignmentPath = z.infer<typeof SkillIconAssignmentPathSchema>;
export type SkillIconResultPath = z.infer<typeof SkillIconResultPathSchema>;
export type SkillIconReferencePath = z.infer<typeof SkillIconReferencePathSchema>;
export type SkillIconGeometry = z.infer<typeof SkillIconGeometrySchema>;
export type SkillIconGeometryV1 = z.infer<typeof SkillIconGeometryV1Schema>;
export type SkillIconGeometryV2 = z.infer<typeof SkillIconGeometryV2Schema>;
export type AnySkillIconGeometry = z.infer<typeof AnySkillIconGeometrySchema>;
export type SkillIconVisualSpec = z.infer<typeof SkillIconVisualSpecSchema>;
export type SkillIconAsset = z.infer<typeof SkillIconAssetSchema>;
export type SkillIconCandidateAsset = z.infer<typeof SkillIconCandidateAssetSchema>;
export type SkillIconStandaloneCandidateAsset = z.infer<
	typeof SkillIconStandaloneCandidateAssetSchema
>;
export type SkillIconApprovedMasterAsset = z.infer<typeof SkillIconApprovedMasterAssetSchema>;
export type SkillIconCalibrationCandidateAsset = z.infer<
	typeof SkillIconCalibrationCandidateAssetSchema
>;
export type SkillIconCalibrationMasterAsset = z.infer<typeof SkillIconCalibrationMasterAssetSchema>;
export type SkillIconRuntimeAsset = z.infer<typeof SkillIconRuntimeAssetSchema>;
export type SkillIconRecognitionAsset = z.infer<typeof SkillIconRecognitionAssetSchema>;
export type SkillIconCandidateAssets = z.infer<typeof SkillIconCandidateAssetsSchema>;
export type SkillIconApprovedAssets = z.infer<typeof SkillIconApprovedAssetsSchema>;
export type SkillIconProducerResult = z.infer<typeof SkillIconProducerResultSchema>;
export type SkillIconReviewFinding = z.infer<typeof SkillIconReviewFindingSchema>;
export type SkillIconReview = z.infer<typeof SkillIconReviewSchema>;
export type SkillIconRecord = z.infer<typeof SkillIconRecordSchema>;
export type SkillIconCatalog = z.infer<typeof SkillIconCatalogSchema>;
export type SkillIconReference = z.infer<typeof SkillIconReferenceSchema>;
export type SkillIconStandaloneCanvas = z.infer<typeof SkillIconStandaloneCanvasSchema>;
export type SkillIconCalibrationCanvas = z.infer<typeof SkillIconCalibrationCanvasSchema>;
export type SkillIconTargetNormalization = z.infer<typeof SkillIconTargetNormalizationSchema>;
export type SkillIconTarget = z.infer<typeof SkillIconTargetSchema>;
export type SkillIconTargetV2 = z.infer<typeof SkillIconTargetV2Schema>;
export type AnySkillIconTarget = z.infer<typeof AnySkillIconTargetSchema>;
export type SkillIconAssignment = z.infer<typeof SkillIconAssignmentSchema>;
export type SkillIconAssignmentV2 = z.infer<typeof SkillIconAssignmentV2Schema>;
export type AnySkillIconAssignment = z.infer<typeof AnySkillIconAssignmentSchema>;
export type SkillIconFailureReason = z.infer<typeof SkillIconFailureReasonSchema>;
export type SkillIconResultFinding = z.infer<typeof SkillIconResultFindingSchema>;
export type SkillIconResult = z.infer<typeof SkillIconResultSchema>;
export type SkillIconContainerBoxEvidence = z.infer<typeof SkillIconContainerBoxEvidenceSchema>;
export type SkillIconProviderSourceEvidenceV2 = z.infer<
	typeof SkillIconProviderSourceEvidenceV2Schema
>;
export type SkillIconNormalizationEvidence = z.infer<typeof SkillIconNormalizationEvidenceSchema>;
export type SkillIconNormalizationEvidenceV3 = z.infer<
	typeof SkillIconNormalizationEvidenceV3Schema
>;
export type SkillIconAttemptResultV2 = z.infer<typeof SkillIconAttemptResultV2Schema>;
export type SkillIconSupersedingAuthority = z.infer<typeof SkillIconSupersedingAuthoritySchema>;
export type SkillIconSupersededResultV2 = z.infer<typeof SkillIconSupersededResultV2Schema>;
export type SkillIconResultV2 = z.infer<typeof SkillIconResultV2Schema>;
export type AnySkillIconResult = z.infer<typeof AnySkillIconResultSchema>;
export type SkillIconReprocessOriginAuthority = z.infer<
	typeof SkillIconReprocessOriginAuthoritySchema
>;
export type SkillIconReprocessProcessingAuthority = z.infer<
	typeof SkillIconReprocessProcessingAuthoritySchema
>;
export type SkillIconReprocessTarget = z.infer<typeof SkillIconReprocessTargetSchema>;
export type SkillIconReprocessAssignment = z.infer<typeof SkillIconReprocessAssignmentSchema>;
export type SkillIconReprocessInspection = z.infer<typeof SkillIconReprocessInspectionSchema>;
export type SkillIconReprocessResult = z.infer<typeof SkillIconReprocessResultSchema>;
export type SkillIconReprocessOriginExecution = z.infer<
	typeof SkillIconReprocessOriginExecutionSchema
>;
export type SkillIconExecution = z.infer<typeof SkillIconExecutionSchema>;
export type SkillIconExecutionV2 = z.infer<typeof SkillIconExecutionV2Schema>;
export type SkillIconReprocessExecution = z.infer<typeof SkillIconReprocessExecutionSchema>;
export type AnySkillIconReprocessExecution = z.infer<typeof AnySkillIconReprocessExecutionSchema>;
export type AnySkillIconExecution = z.infer<typeof AnySkillIconExecutionSchema>;
