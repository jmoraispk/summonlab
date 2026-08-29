import { randomUUID } from 'node:crypto';

import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	AffinityWorkflowReviewIdempotencyConflictError,
	createAffinityWorkflowReview,
	listAffinityWorkflowReviews
} from './affinity-review.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

async function removeIntegrationReviews(): Promise<void> {
	if (!databaseUrl) return;
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql`
			delete from summonlab_affinity_workflow_reviews
			where reviewer like 'test:integration-%'
		`;
	} finally {
		await sql.end();
	}
}

describe('affinity workflow review persistence', () => {
	beforeEach(removeIntegrationReviews);
	afterEach(removeIntegrationReviews);

	run('is append-only, hash-bound, idempotent, and latest by target/reviewer', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const targetId = `affinity-workflow-v1-death-knight-${randomUUID().slice(0, 8)}`;
		const base = {
			reviewId: randomUUID(),
			experimentId: 'affinity-workflow-v1' as const,
			targetId,
			candidateContentHash: 'a'.repeat(64),
			reviewer: 'test:integration-primary',
			reviewMode: 'blind' as const,
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
			note: 'The affinity and species are both legible.'
		};

		const created = await createAffinityWorkflowReview(databaseUrl, base);
		expect(created.created).toBe(true);
		const retried = await createAffinityWorkflowReview(databaseUrl, base);
		expect(retried).toEqual({ review: created.review, created: false });

		const revised = await createAffinityWorkflowReview(databaseUrl, {
			...base,
			reviewId: randomUUID(),
			candidateContentHash: 'b'.repeat(64),
			verdict: 'revise',
			note: 'The newer candidate needs a clearer fire telegraph.'
		});
		const secondReviewer = await createAffinityWorkflowReview(databaseUrl, {
			...base,
			reviewId: randomUUID(),
			reviewer: 'test:integration-secondary'
		});

		const listed = await listAffinityWorkflowReviews(databaseUrl, base.experimentId, {
			includeAutomated: true
		});
		const targetReviews = listed.reviews.filter((review) => review.targetId === targetId);
		const targetLatest = listed.latestByTargetReviewer.filter(
			(review) => review.targetId === targetId
		);
		expect(targetReviews).toHaveLength(3);
		expect(targetLatest).toEqual(expect.arrayContaining([revised.review, secondReviewer.review]));
		expect(targetLatest).toHaveLength(2);

		await expect(
			createAffinityWorkflowReview(databaseUrl, { ...base, note: 'Conflicting retry.' })
		).rejects.toBeInstanceOf(AffinityWorkflowReviewIdempotencyConflictError);
	});
});
