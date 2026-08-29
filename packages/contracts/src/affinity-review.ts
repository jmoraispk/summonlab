import { z } from 'zod';

import { ImageProductionAffinitySchema, ImageProductionSpeciesSchema } from './image-production.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

const TargetIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);

export const AffinityWorkflowExperimentIdSchema = z.literal('affinity-workflow-v1');

export const AffinityWorkflowReviewScoresSchema = z
	.object({
		speciesIdentity: z.number().int().min(1).max(5),
		affinityReadability: z.number().int().min(1).max(5),
		silhouetteAndDuty: z.number().int().min(1).max(5),
		materialCredibility: z.number().int().min(1).max(5),
		anatomyAndGroundContact: z.number().int().min(1).max(5),
		affinityIntegration: z.number().int().min(1).max(5),
		styleCohesion: z.number().int().min(1).max(5)
	})
	.strict();

export const AffinityWorkflowReviewCreateRequestSchema = z
	.object({
		reviewId: EntityIdSchema,
		experimentId: AffinityWorkflowExperimentIdSchema,
		targetId: TargetIdSchema,
		candidateContentHash: StateHashSchema,
		reviewer: z.string().trim().min(1).max(80),
		identifiedSpeciesId: ImageProductionSpeciesSchema,
		identifiedAffinity: ImageProductionAffinitySchema,
		scores: AffinityWorkflowReviewScoresSchema,
		verdict: z.enum(['candidate', 'revise']),
		note: z.string().trim().min(1).max(1_000)
	})
	.strict();

export const AffinityWorkflowReviewRecordSchema = AffinityWorkflowReviewCreateRequestSchema.extend({
	reviewedAt: IsoDateTimeSchema
}).strict();

export const AffinityWorkflowReviewListSchema = z
	.object({
		experimentId: AffinityWorkflowExperimentIdSchema,
		reviews: z.array(AffinityWorkflowReviewRecordSchema),
		latestByTargetReviewer: z.array(AffinityWorkflowReviewRecordSchema)
	})
	.strict()
	.superRefine((value, context) => {
		const listedReviewIds = new Set(value.reviews.map((review) => review.reviewId));
		const latestKeys = new Set<string>();
		const expectedLatest = new Map<string, AffinityWorkflowReviewRecord>();
		for (const review of value.reviews) {
			const key = `${review.targetId}\u0000${review.reviewer}`;
			const current = expectedLatest.get(key);
			if (
				!current ||
				Date.parse(review.reviewedAt) > Date.parse(current.reviewedAt) ||
				(review.reviewedAt === current.reviewedAt && review.reviewId > current.reviewId)
			) {
				expectedLatest.set(key, review);
			}
		}
		for (const review of value.latestByTargetReviewer) {
			const key = `${review.targetId}\u0000${review.reviewer}`;
			if (
				review.experimentId !== value.experimentId ||
				!listedReviewIds.has(review.reviewId) ||
				expectedLatest.get(key)?.reviewId !== review.reviewId
			) {
				context.addIssue({
					code: 'custom',
					message: `Latest affinity review must reference the newest listed review for ${review.targetId}`
				});
			}
			if (latestKeys.has(key)) {
				context.addIssue({
					code: 'custom',
					message: `Latest affinity reviews must be unique by target and reviewer: ${review.targetId}`
				});
			}
			latestKeys.add(key);
		}
		for (const key of expectedLatest.keys()) {
			if (!latestKeys.has(key)) {
				context.addIssue({
					code: 'custom',
					message: 'Every target/reviewer pair must have a latest affinity review'
				});
			}
		}
	});

export type AffinityWorkflowReviewCreateRequest = z.infer<
	typeof AffinityWorkflowReviewCreateRequestSchema
>;
export type AffinityWorkflowReviewList = z.infer<typeof AffinityWorkflowReviewListSchema>;
export type AffinityWorkflowReviewRecord = z.infer<typeof AffinityWorkflowReviewRecordSchema>;
export type AffinityWorkflowReviewScores = z.infer<typeof AffinityWorkflowReviewScoresSchema>;
