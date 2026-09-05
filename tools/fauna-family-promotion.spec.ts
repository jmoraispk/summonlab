import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

describe('fauna family approval and runtime promotion', () => {
	it('publishes all 200 approved sources and runtime derivatives with hash-bound evidence', async () => {
		const modulePath = './fauna-family-promotion.js';
		let promotion: typeof import('./fauna-family-promotion.js') | undefined;
		try {
			promotion = await import(modulePath);
		} catch {
			expect.fail('fauna family promotion implementation is missing');
		}
		if (!promotion) throw new Error('fauna family promotion implementation is missing');

		const summary = await promotion.validateFaunaFamilyPromotion(repositoryRoot);
		expect(summary).toEqual({
			familyCount: 8,
			formCount: 40,
			coordinateCount: 200,
			approvedCount: 200,
			runtimeCount: 200
		});
		expect(
			existsSync(
				`${repositoryRoot}/assets/enemies/approved/fauna-family-v1/receipts/promotion-v1.json`
			)
		).toBe(true);
		expect(
			existsSync(`${repositoryRoot}/assets/enemies/runtime/fauna-family-v1/catalog.json`)
		).toBe(true);
	}, 60_000);
});
