import { z } from 'zod';

import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from './shared.js';

export const CharacterExpressionSchema = z.enum([
	'neutral',
	'alert',
	'skeptical',
	'amused',
	'exertion',
	'injured'
]);

export const CharacterVisualRoleSchema = z.enum([
	'anchor',
	'continuity-sheet',
	'roster-group',
	'settlement-scale',
	'dialogue-closeup',
	'summon-card'
]);

export const RigAttachmentAnchorSchema = z
	.object({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
		rotationDegrees: z.number().min(-180).max(180),
		depth: z.enum(['behind', 'body', 'front'])
	})
	.strict();

export const CharacterVisualProfileSchema = z
	.object({
		profileVersion: ContentVersionSchema,
		characterId: EntityIdSchema,
		manifestHash: StateHashSchema,
		identityLocks: z.array(z.string().min(1).max(120)).min(5).max(20),
		expressions: z.array(CharacterExpressionSchema).min(3),
		anchors: z
			.object({
				mainHand: RigAttachmentAnchorSchema,
				offHand: RigAttachmentAnchorSchema,
				back: RigAttachmentAnchorSchema,
				waist: RigAttachmentAnchorSchema,
				faceInjury: RigAttachmentAnchorSchema
			})
			.strict(),
		paletteSwaps: z
			.object({
				base: z.array(z.string().regex(/^#[a-f0-9]{6}$/iu)).length(4),
				night: z.array(z.string().regex(/^#[a-f0-9]{6}$/iu)).length(4),
				injured: z.array(z.string().regex(/^#[a-f0-9]{6}$/iu)).length(4)
			})
			.strict(),
		approvedAssetKeys: z.array(z.string().min(1).max(100)).max(20)
	})
	.strict();

export const VisualIdentityCheckSchema = z
	.object({
		characterId: EntityIdSchema,
		face: z.boolean(),
		hair: z.boolean(),
		silhouette: z.boolean(),
		palette: z.boolean(),
		signatureTraits: z.boolean(),
		score: z.number().int().min(0).max(5)
	})
	.strict()
	.refine(
		(value) =>
			[value.face, value.hair, value.silhouette, value.palette, value.signatureTraits].filter(
				Boolean
			).length === value.score,
		{ message: 'Identity score must equal the passed recognition checks' }
	);

export const CharacterVisualAssetSchema = z
	.object({
		assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		role: CharacterVisualRoleSchema,
		status: z.enum(['draft', 'approval-candidate', 'approved', 'rejected']),
		characterIds: z.array(EntityIdSchema).min(1).max(12),
		manifestHashes: z.array(StateHashSchema).min(1).max(12),
		file: z
			.string()
			.regex(/^assets\/heroes\/[a-z0-9./-]+\.(?:png|webp)$/u)
			.refine((value) => !value.includes('..'), {
				message: 'Asset path cannot traverse directories'
			}),
		width: z.number().int().positive().max(8_192),
		height: z.number().int().positive().max(8_192),
		bytes: z.number().int().positive(),
		contentHash: StateHashSchema,
		generationMode: z.enum(['existing-original', 'built-in-imagegen']),
		createdAt: IsoDateTimeSchema,
		prompt: z.string().min(1).max(20_000),
		referenceAssetKeys: z.array(z.string().min(1).max(100)).max(12),
		identityChecks: z.array(VisualIdentityCheckSchema).min(1).max(12),
		productionNote: z.string().min(1).max(1_000)
	})
	.strict()
	.superRefine((value, context) => {
		if (value.characterIds.length !== value.manifestHashes.length) {
			context.addIssue({
				code: 'custom',
				message: 'Every visual character id requires a corresponding manifest hash'
			});
		}
		const expected = new Set(value.characterIds);
		const checked = new Set(value.identityChecks.map((check) => check.characterId));
		if (expected.size !== checked.size || [...expected].some((id) => !checked.has(id))) {
			context.addIssue({
				code: 'custom',
				message: 'Every visual character requires identity checks'
			});
		}
	});

export const CharacterVisualCatalogSchema = z
	.object({
		catalogVersion: ContentVersionSchema,
		status: z.enum(['approval-candidate', 'approved']),
		profiles: z.array(CharacterVisualProfileSchema).min(1),
		assets: z.array(CharacterVisualAssetSchema).min(1)
	})
	.strict()
	.superRefine((catalog, context) => {
		const profileIds = new Set(catalog.profiles.map((profile) => profile.characterId));
		if (profileIds.size !== catalog.profiles.length) {
			context.addIssue({ code: 'custom', message: 'Visual profiles must have unique characters' });
		}
		const assetKeys = new Set(catalog.assets.map((asset) => asset.assetKey));
		if (assetKeys.size !== catalog.assets.length) {
			context.addIssue({ code: 'custom', message: 'Visual assets must have unique keys' });
		}
		for (const profile of catalog.profiles) {
			for (const assetKey of profile.approvedAssetKeys) {
				if (!assetKeys.has(assetKey)) {
					context.addIssue({ code: 'custom', message: `Unknown approved asset: ${assetKey}` });
				}
			}
		}
	});

export const VisualReviewVerdictSchema = z.enum(['approved', 'revise']);

export const VisualReviewCreateRequestSchema = z
	.object({
		reviewId: EntityIdSchema,
		assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		catalogVersion: ContentVersionSchema,
		assetContentHash: StateHashSchema,
		verdict: VisualReviewVerdictSchema,
		note: z.string().trim().min(1).max(1_000),
		reviewer: z.string().trim().min(1).max(80)
	})
	.strict();

export const VisualReviewRecordSchema = VisualReviewCreateRequestSchema.extend({
	createdAt: IsoDateTimeSchema
}).strict();

export const VisualReviewListSchema = z
	.object({
		reviews: z.array(VisualReviewRecordSchema),
		latestByAsset: z.record(z.string(), VisualReviewRecordSchema)
	})
	.strict()
	.superRefine((value, context) => {
		const knownReviewIds = new Set(value.reviews.map((review) => review.reviewId));
		for (const [assetKey, review] of Object.entries(value.latestByAsset)) {
			if (review.assetKey !== assetKey || !knownReviewIds.has(review.reviewId)) {
				context.addIssue({
					code: 'custom',
					message: `Latest visual review must reference a listed review for ${assetKey}`
				});
			}
		}
	});

export const SummonCardPreviewRequestSchema = z
	.object({
		assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		catalogVersion: ContentVersionSchema,
		assetContentHash: StateHashSchema,
		manifestHash: StateHashSchema,
		direction: z.string().trim().max(500).default('')
	})
	.strict();

export const SummonCardGenerateRequestSchema = SummonCardPreviewRequestSchema.extend({
	requestId: EntityIdSchema,
	costAcknowledged: z.literal(true)
}).strict();

export const SummonCardGenerationSpecSchema = z
	.object({
		schemaVersion: z.literal('summon-card-request-v1'),
		assetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		catalogVersion: ContentVersionSchema,
		assetContentHash: StateHashSchema,
		manifestHash: StateHashSchema,
		endpoint: z.literal('/v1/images/edits'),
		model: z.string().min(1).max(120),
		quality: z.enum(['low', 'medium', 'high']),
		size: z.enum(['1024x1024', '1024x1536', '1536x1024']),
		outputFormat: z.literal('png'),
		moderation: z.literal('auto'),
		candidateCount: z.literal(1),
		prompt: z.string().min(1).max(20_000),
		promptHash: StateHashSchema,
		estimatedOutputCostUsd: z.number().nonnegative(),
		costEstimateDate: z.literal('2026-08-23'),
		costExclusions: z.array(z.string().min(1).max(160)).min(1).max(8),
		canonical: z.literal(false),
		persistence: z.literal('ephemeral-response-only'),
		retryPolicy: z.literal('none')
	})
	.strict();

export const SummonCardGenerationResultSchema = z
	.object({
		requestId: EntityIdSchema,
		providerRequestId: z.string().min(1).max(200).nullable(),
		spec: SummonCardGenerationSpecSchema,
		image: z
			.object({
				mimeType: z.literal('image/png'),
				b64Json: z
					.string()
					.regex(/^[a-z0-9+/]+=*$/iu)
					.max(40_000_000),
				contentHash: StateHashSchema
			})
			.strict(),
		generatedAt: IsoDateTimeSchema
	})
	.strict();

export const RuntimeVisualUsageSchema = z.enum([
	'summon',
	'dialogue',
	'roster',
	'roster-group',
	'settlement-preview',
	'summon-card'
]);

export const RuntimeVisualAssetSchema = z
	.object({
		alias: z.string().regex(/^hero\.[a-z0-9.-]{3,180}$/u),
		usage: RuntimeVisualUsageSchema,
		sourceAssetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		sourceStatus: z.literal('approved'),
		sourceContentHash: StateHashSchema,
		manifestHashes: z.array(StateHashSchema).min(1).max(12),
		file: z
			.string()
			.regex(/^runtime\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9.-]+\.webp$/u)
			.refine((value) => !value.includes('..'), { message: 'Runtime asset path cannot traverse' }),
		publicPath: z.string().regex(/^\/runtime\/[a-z0-9/-]+\/[a-z0-9.-]+\.webp$/u),
		width: z.number().int().positive().max(4_096),
		height: z.number().int().positive().max(4_096),
		bytes: z.number().int().positive(),
		contentHash: StateHashSchema,
		budgetBytes: z.number().int().positive(),
		budgetStatus: z.literal('within-budget'),
		encoder: z
			.object({
				format: z.literal('webp'),
				quality: z.number().int().min(1).max(100),
				effort: z.number().int().min(0).max(6),
				preset: z.literal('drawing'),
				smartSubsample: z.literal(true),
				metadata: z.literal('stripped')
			})
			.strict()
	})
	.strict()
	.refine((asset) => asset.bytes <= asset.budgetBytes, {
		message: 'Runtime visual asset exceeds its declared budget'
	});

export const RuntimeVisualBundleSchema = z
	.object({
		name: z.string().regex(/^hero-[a-z0-9-]{3,120}$/u),
		budgetBytes: z.number().int().positive(),
		bytes: z.number().int().positive(),
		budgetStatus: z.literal('within-budget'),
		assets: z.array(RuntimeVisualAssetSchema).min(1).max(20)
	})
	.strict()
	.superRefine((bundle, context) => {
		const bytes = bundle.assets.reduce((total, asset) => total + asset.bytes, 0);
		if (bytes !== bundle.bytes) {
			context.addIssue({ code: 'custom', message: `Bundle ${bundle.name} byte total is stale` });
		}
		if (bundle.bytes > bundle.budgetBytes) {
			context.addIssue({ code: 'custom', message: `Bundle ${bundle.name} exceeds its budget` });
		}
	});

export const PixiAssetManifestSchema = z
	.object({
		bundles: z.array(
			z
				.object({
					name: z.string().min(1).max(140),
					assets: z
						.array(
							z
								.object({
									alias: z.string().min(1).max(200),
									src: z.string().min(1).max(500)
								})
								.strict()
						)
						.min(1)
				})
				.strict()
		)
	})
	.strict();

export const DeferredRuntimeVisualSchema = z
	.object({
		sourceAssetKey: z.string().regex(/^[a-z][a-z0-9-]{2,99}$/u),
		sourceContentHash: StateHashSchema,
		sourceStatus: z.enum(['approval-candidate', 'approved', 'rejected']),
		reason: z.enum([
			'awaiting-human-approval',
			'rejected-source',
			'development-reference-only',
			'no-export-profile'
		])
	})
	.strict();

export const RuntimeVisualManifestSchema = z
	.object({
		schemaVersion: z.literal('runtime-visual-manifest-v1'),
		catalogVersion: ContentVersionSchema,
		catalogContentHash: StateHashSchema,
		exporterVersion: z.literal('runtime-visual-exporter-v1'),
		initialPayloadBudgetBytes: z.literal(8_000_000),
		initialPayloadBytes: z.number().int().nonnegative(),
		initialPayloadStatus: z.literal('within-budget'),
		toolchain: z
			.object({
				pixi: z.string().min(1).max(40),
				sharp: z.string().min(1).max(40),
				vips: z.string().min(1).max(80),
				webp: z.string().min(1).max(80)
			})
			.strict(),
		bundles: z.array(RuntimeVisualBundleSchema),
		deferred: z.array(DeferredRuntimeVisualSchema),
		pixiManifest: PixiAssetManifestSchema,
		manifestHash: StateHashSchema
	})
	.strict()
	.superRefine((manifest, context) => {
		const bytes = manifest.bundles.reduce((total, bundle) => total + bundle.bytes, 0);
		if (bytes !== manifest.initialPayloadBytes) {
			context.addIssue({ code: 'custom', message: 'Initial runtime payload byte total is stale' });
		}
		if (bytes > manifest.initialPayloadBudgetBytes) {
			context.addIssue({ code: 'custom', message: 'Initial runtime visual payload exceeds 8 MB' });
		}
		const aliases = new Set<string>();
		for (const bundle of manifest.bundles) {
			const pixiBundle = manifest.pixiManifest.bundles.find(
				(candidate) => candidate.name === bundle.name
			);
			if (!pixiBundle || pixiBundle.assets.length !== bundle.assets.length) {
				context.addIssue({
					code: 'custom',
					message: `Pixi bundle projection is stale: ${bundle.name}`
				});
				continue;
			}
			for (const asset of bundle.assets) {
				if (aliases.has(asset.alias)) {
					context.addIssue({ code: 'custom', message: `Duplicate runtime alias: ${asset.alias}` });
				}
				aliases.add(asset.alias);
				if (
					!pixiBundle.assets.some(
						(candidate) => candidate.alias === asset.alias && candidate.src === asset.publicPath
					)
				) {
					context.addIssue({
						code: 'custom',
						message: `Pixi asset projection is stale: ${asset.alias}`
					});
				}
			}
		}
	});

export const WebBuildBudgetReportSchema = z
	.object({
		schemaVersion: z.literal('web-build-budget-v1'),
		budgets: z
			.object({
				initialJavaScriptGzipBytes: z.number().int().positive(),
				runtimeInspectorLoadedJavaScriptGzipBytes: z.number().int().positive(),
				runtimeVisualPayloadBytes: z.number().int().positive()
			})
			.strict(),
		measurements: z
			.object({
				initialJavaScriptGzipBytes: z.number().int().nonnegative(),
				runtimeInspectorLoadedJavaScriptGzipBytes: z.number().int().nonnegative(),
				largestRuntimeLazyChunkGzipBytes: z.number().int().nonnegative(),
				runtimeVisualPayloadBytes: z.number().int().nonnegative()
			})
			.strict(),
		status: z
			.object({
				initialJavaScript: z.literal('within-budget'),
				runtimeInspectorLoadedJavaScript: z.literal('within-budget'),
				runtimeVisualPayload: z.literal('within-budget')
			})
			.strict()
	})
	.strict()
	.superRefine((report, context) => {
		for (const key of [
			'initialJavaScriptGzipBytes',
			'runtimeInspectorLoadedJavaScriptGzipBytes',
			'runtimeVisualPayloadBytes'
		] as const) {
			if (report.measurements[key] > report.budgets[key]) {
				context.addIssue({ code: 'custom', message: `Web build budget exceeded: ${key}` });
			}
		}
	});

export type CharacterExpression = z.infer<typeof CharacterExpressionSchema>;
export type CharacterVisualAsset = z.infer<typeof CharacterVisualAssetSchema>;
export type CharacterVisualCatalog = z.infer<typeof CharacterVisualCatalogSchema>;
export type CharacterVisualProfile = z.infer<typeof CharacterVisualProfileSchema>;
export type DeferredRuntimeVisual = z.infer<typeof DeferredRuntimeVisualSchema>;
export type PixiAssetManifest = z.infer<typeof PixiAssetManifestSchema>;
export type RuntimeVisualAsset = z.infer<typeof RuntimeVisualAssetSchema>;
export type RuntimeVisualBundle = z.infer<typeof RuntimeVisualBundleSchema>;
export type RuntimeVisualManifest = z.infer<typeof RuntimeVisualManifestSchema>;
export type RuntimeVisualUsage = z.infer<typeof RuntimeVisualUsageSchema>;
export type WebBuildBudgetReport = z.infer<typeof WebBuildBudgetReportSchema>;
export type SummonCardGenerateRequest = z.infer<typeof SummonCardGenerateRequestSchema>;
export type SummonCardGenerationResult = z.infer<typeof SummonCardGenerationResultSchema>;
export type SummonCardGenerationSpec = z.infer<typeof SummonCardGenerationSpecSchema>;
export type SummonCardPreviewRequest = z.infer<typeof SummonCardPreviewRequestSchema>;
export type VisualReviewCreateRequest = z.infer<typeof VisualReviewCreateRequestSchema>;
export type VisualReviewList = z.infer<typeof VisualReviewListSchema>;
export type VisualReviewRecord = z.infer<typeof VisualReviewRecordSchema>;
export type VisualReviewVerdict = z.infer<typeof VisualReviewVerdictSchema>;
