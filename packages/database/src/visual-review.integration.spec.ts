import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	VisualReviewIdempotencyConflictError,
	createVisualAssetReview,
	listVisualAssetReviews
} from './visual-review.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('visual review persistence', () => {
	run('keeps hash-bound decisions append-only and idempotent', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const suffix = randomUUID().slice(0, 8);
		const catalogVersion = `visual-test-${suffix}`;
		const base = {
			reviewId: randomUUID(),
			assetKey: `test-anchor-${suffix}`,
			catalogVersion,
			assetContentHash: 'a'.repeat(64),
			verdict: 'revise' as const,
			note: 'Keep the silhouette; revise the face landmarks.',
			reviewer: 'test:integration'
		};

		const created = await createVisualAssetReview(databaseUrl, base);
		expect(created.created).toBe(true);
		const retried = await createVisualAssetReview(databaseUrl, base);
		expect(retried.created).toBe(false);
		expect(retried.review).toEqual(created.review);

		const approved = await createVisualAssetReview(databaseUrl, {
			...base,
			reviewId: randomUUID(),
			verdict: 'approved',
			note: 'Revision accepted.'
		});
		const listed = await listVisualAssetReviews(databaseUrl, catalogVersion, {
			includeAutomated: true
		});
		expect(listed.reviews).toHaveLength(2);
		expect(listed.latestByAsset[base.assetKey]).toEqual(approved.review);

		await expect(
			createVisualAssetReview(databaseUrl, { ...base, note: 'Conflicting retry.' })
		).rejects.toBeInstanceOf(VisualReviewIdempotencyConflictError);
	});
});
