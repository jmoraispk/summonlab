import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	RecognitionReviewIdempotencyConflictError,
	createRecognitionReview,
	listRecognitionReviews
} from './recognition-review.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('recognition review persistence', () => {
	run('keeps audit-bound case evidence append-only and idempotent', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const suffix = randomUUID().slice(0, 8);
		const auditHash = suffix.padEnd(64, 'a');
		const base = {
			reviewId: randomUUID(),
			auditHash,
			catalogVersion: `visual-test-${suffix}`,
			characterId: randomUUID(),
			caseId: 'settlement-night-walk',
			outcomes: [
				{ cue: 'hair' as const, verdict: 'pass' as const },
				{ cue: 'silhouette' as const, verdict: 'pass' as const },
				{ cue: 'palette' as const, verdict: 'fail' as const },
				{ cue: 'signature-traits' as const, verdict: 'pass' as const }
			],
			verdict: 'revise' as const,
			note: 'The palette loses identity at settlement scale.',
			reviewer: 'test:integration'
		};

		const created = await createRecognitionReview(databaseUrl, base);
		expect(created.created).toBe(true);
		const retried = await createRecognitionReview(databaseUrl, base);
		expect(retried.created).toBe(false);
		expect(retried.review).toEqual(created.review);

		const passed = await createRecognitionReview(databaseUrl, {
			...base,
			reviewId: randomUUID(),
			outcomes: base.outcomes.map((outcome) => ({ ...outcome, verdict: 'pass' as const })),
			verdict: 'pass',
			note: 'The adjusted palette now reads at settlement scale.'
		});
		await createRecognitionReview(databaseUrl, {
			...base,
			reviewId: randomUUID(),
			caseId: 'mission-exertion',
			note: 'A separate case remains under revision.'
		});

		const listed = await listRecognitionReviews(databaseUrl, auditHash, {
			includeAutomated: true
		});
		expect(listed.reviews).toHaveLength(3);
		expect(listed.latestByCase['settlement-night-walk']).toEqual(passed.review);
		expect(listed.latestByCase['mission-exertion']?.verdict).toBe('revise');

		await expect(
			createRecognitionReview(databaseUrl, { ...base, note: 'Conflicting retry.' })
		).rejects.toBeInstanceOf(RecognitionReviewIdempotencyConflictError);
	});
});
