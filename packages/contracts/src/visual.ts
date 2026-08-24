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

export type CharacterExpression = z.infer<typeof CharacterExpressionSchema>;
export type CharacterVisualAsset = z.infer<typeof CharacterVisualAssetSchema>;
export type CharacterVisualCatalog = z.infer<typeof CharacterVisualCatalogSchema>;
export type CharacterVisualProfile = z.infer<typeof CharacterVisualProfileSchema>;
export type SummonCardGenerateRequest = z.infer<typeof SummonCardGenerateRequestSchema>;
export type SummonCardGenerationResult = z.infer<typeof SummonCardGenerationResultSchema>;
export type SummonCardGenerationSpec = z.infer<typeof SummonCardGenerationSpecSchema>;
export type SummonCardPreviewRequest = z.infer<typeof SummonCardPreviewRequestSchema>;
export type VisualReviewCreateRequest = z.infer<typeof VisualReviewCreateRequestSchema>;
export type VisualReviewList = z.infer<typeof VisualReviewListSchema>;
export type VisualReviewRecord = z.infer<typeof VisualReviewRecordSchema>;
export type VisualReviewVerdict = z.infer<typeof VisualReviewVerdictSchema>;
