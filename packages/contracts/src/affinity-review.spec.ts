import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	AffinityWorkflowReviewCreateRequestSchema,
	AffinityWorkflowReviewListSchema
} from './affinity-review.js';

const candidateHash = 'a'.repeat(64);
const request = {
	reviewId: randomUUID(),
	experimentId: 'affinity-workflow-v1' as const,
	targetId: 'affinity-workflow-v1-death-knight-fire',
	candidateContentHash: candidateHash,
	reviewer: 'visual-director',
	identifiedSpeciesId: 'death-knight' as const,
	identifiedAffinity: 'fire' as const,
	scores: {
		speciesIdentity: 5,
		affinityReadability: 4,
		silhouetteAndDuty: 5,
		materialCredibility: 4,
		anatomyAndGroundContact: 5,
		affinityIntegration: 4,
		styleCohesion: 5
	},
	verdict: 'candidate' as const,
	note: 'Reads as a fire-affinity death knight without revealing the answer.'
};

describe('affinity workflow review contracts', () => {
	it('accepts an exact-hash blind review with seven bounded scores', () => {
		expect(AffinityWorkflowReviewCreateRequestSchema.parse(request)).toEqual(request);
	});

	it('rejects a stale experiment, invalid hash, and out-of-range score', () => {
		expect(
			AffinityWorkflowReviewCreateRequestSchema.safeParse({
				...request,
				experimentId: 'affinity-workflow-v2',
				candidateContentHash: 'stale',
				scores: { ...request.scores, affinityReadability: 6 }
			}).success
		).toBe(false);
	});

	it('keeps latest projections bound to listed reviews and unique target/reviewer pairs', () => {
		const first = { ...request, reviewedAt: '2026-08-29T19:00:00.000Z' };
		const second = {
			...request,
			reviewId: randomUUID(),
			reviewer: 'second-reviewer',
			reviewedAt: '2026-08-29T19:01:00.000Z'
		};
		expect(
			AffinityWorkflowReviewListSchema.parse({
				experimentId: request.experimentId,
				reviews: [first, second],
				latestByTargetReviewer: [first, second]
			}).latestByTargetReviewer
		).toHaveLength(2);

		expect(
			AffinityWorkflowReviewListSchema.safeParse({
				experimentId: request.experimentId,
				reviews: [first],
				latestByTargetReviewer: [first, { ...first, reviewId: randomUUID() }]
			}).success
		).toBe(false);
	});
});
