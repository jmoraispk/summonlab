import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('records an idempotent review only against the current asset hash', async ({ request }) => {
	const visualCatalog = JSON.parse(
		await readFile(
			new URL('../../../../assets/heroes/visuals/catalog.json', import.meta.url),
			'utf8'
		)
	) as {
		catalogVersion: string;
		assets: Array<{ assetKey: string; status: string; contentHash: string }>;
	};
	const asset = visualCatalog.assets.find(
		(candidate) => candidate.status === 'approval-candidate'
	)!;
	const payload = {
		reviewId: randomUUID(),
		assetKey: asset.assetKey,
		catalogVersion: visualCatalog.catalogVersion,
		assetContentHash: asset.contentHash,
		verdict: 'revise',
		note: 'Automated API contract proof.',
		reviewer: 'test:playwright-api'
	};

	const created = await request.post('/api/dev/visual-reviews', { data: payload });
	expect(created.status()).toBe(201);
	expect((await created.json()).reviewId).toBe(payload.reviewId);
	const retried = await request.post('/api/dev/visual-reviews', { data: payload });
	expect(retried.status()).toBe(200);
	const conflicted = await request.post('/api/dev/visual-reviews', {
		data: { ...payload, note: 'A conflicting retry.' }
	});
	expect(conflicted.status()).toBe(409);
	const stale = await request.post('/api/dev/visual-reviews', {
		data: { ...payload, reviewId: randomUUID(), assetContentHash: '0'.repeat(64) }
	});
	expect(stale.status()).toBe(409);

	const listed = await request.get('/api/dev/visual-reviews?includeAutomated=true');
	expect(listed.status()).toBe(200);
	const body = (await listed.json()) as {
		reviews: Array<{ reviewId: string }>;
		latestByAsset: Record<string, { reviewId: string }>;
	};
	expect(body.reviews.some((review) => review.reviewId === payload.reviewId)).toBe(true);
	expect(body.latestByAsset[asset.assetKey]).toBeDefined();
});
