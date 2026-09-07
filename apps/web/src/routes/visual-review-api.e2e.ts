import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

test('records reviews only for the retained enemy catalog', async ({ request }) => {
	const monsterCatalog = JSON.parse(
		await readFile(
			new URL('../../../../assets/enemies/review/pack-2/catalog.json', import.meta.url),
			'utf8'
		)
	) as {
		catalogVersion: string;
		plates: Array<{ assetKey: string; contentHash: string }>;
	};
	const plate = monsterCatalog.plates[0]!;
	const payload = {
		reviewId: randomUUID(),
		assetKey: plate.assetKey,
		catalogVersion: monsterCatalog.catalogVersion,
		assetContentHash: plate.contentHash,
		verdict: 'revise',
		note: 'Retained monster catalog routing proof.',
		reviewer: 'test:playwright-api'
	};

	const created = await request.post('/api/dev/visual-reviews', { data: payload });
	expect(created.status()).toBe(201);
	const retried = await request.post('/api/dev/visual-reviews', { data: payload });
	expect(retried.status()).toBe(200);
	const stale = await request.post('/api/dev/visual-reviews', {
		data: { ...payload, reviewId: randomUUID(), assetContentHash: '0'.repeat(64) }
	});
	expect(stale.status()).toBe(409);

	const listed = await request.get(
		`/api/dev/visual-reviews?catalogVersion=${monsterCatalog.catalogVersion}&includeAutomated=true`
	);
	expect(listed.status()).toBe(200);
	expect((await listed.json()).latestByAsset[plate.assetKey]).toBeDefined();

	const retired = await request.get(
		'/api/dev/visual-reviews?catalogVersion=character-visual-catalog-v1'
	);
	expect(retired.status()).toBe(404);
});
