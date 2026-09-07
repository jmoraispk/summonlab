import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

describe('fauna family approval and runtime promotion', () => {
	it('retains all 200 approved sources without duplicate candidate rasters', async () => {
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
			runtimeCount: 200,
			approvedBytes: 560_162_021,
			retiredCandidateCount: 200
		});
		expect(
			existsSync(
				`${repositoryRoot}/assets/enemies/approved/fauna-family-v1/receipts/promotion-v1.json`
			)
		).toBe(true);
		expect(
			existsSync(`${repositoryRoot}/assets/enemies/runtime/fauna-family-v1/catalog.json`)
		).toBe(true);
		const manifest = JSON.parse(
			await readFile(
				`${repositoryRoot}/assets/enemies/approved/fauna-family-v1/manifest.json`,
				'utf8'
			)
		) as { records: Array<{ candidate: { path: string } }> };
		expect(manifest.records).toHaveLength(200);
		expect(
			manifest.records.every(({ candidate }) => !existsSync(`${repositoryRoot}/${candidate.path}`))
		).toBe(true);
	}, 60_000);
});
