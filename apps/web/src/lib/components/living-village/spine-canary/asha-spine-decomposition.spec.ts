import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
	ASHA_EXPLORATION_VISIBLE_HEIGHT,
	ASHA_SPINE_DECOMPOSITION_STATUS,
	decompositionAssets
} from './asha-spine-decomposition.js';

describe('Asha decomposition review configuration', () => {
	it('keeps the owner-selected scale configurable at 84 px', () => {
		expect(ASHA_EXPLORATION_VISIBLE_HEIGHT).toBe(84);
		expect(decompositionAssets(2).recomposed.endsWith('asha-setup-v2-r2.png')).toBe(true);
	});

	it('labels the technically validated art as candidate-only', () => {
		expect(ASHA_SPINE_DECOMPOSITION_STATUS).toBe('candidate');
		expect(decompositionAssets(2).bodyCore).toContain('/review/asha-spine-decomposition/');
		expect(decompositionAssets(2).reviewDescriptor).toContain('/review/asha-spine-decomposition/');
	});

	it('keeps every review-only copy byte-identical to its checked candidate artifact', async () => {
		const repositoryRoot = resolve(process.cwd(), '../..');
		const candidateRoot = resolve(
			repositoryRoot,
			'assets/heroes/visuals/spine-exploration-canary-v1/decomposition-v1'
		);
		const reviewRoot = resolve(
			repositoryRoot,
			'apps/web/static/review/asha-spine-decomposition/v2-r2'
		);
		const pairs = [
			['parts/v2-r2/body-core.png', 'body-core.png'],
			['parts/v2-r2/near-arm.png', 'near-arm.png'],
			['parts/v2-r2/braid.png', 'braid.png'],
			['masks/v2-r2/near-arm.png', 'near-arm-mask.png'],
			['masks/v2-r2/braid.png', 'braid-mask.png'],
			['recomposed/asha-setup-v2-r2.png', 'asha-setup-v2-r2.png'],
			['provider/body-repair-v2-rgba.png', 'body-repair-v2-rgba.png']
		] as const;
		for (const [candidate, review] of pairs) {
			const [candidateBytes, reviewBytes] = await Promise.all([
				readFile(resolve(candidateRoot, candidate)),
				readFile(resolve(reviewRoot, review))
			]);
			expect(createHash('sha256').update(reviewBytes).digest('hex')).toBe(
				createHash('sha256').update(candidateBytes).digest('hex')
			);
		}
		const [descriptorBytes, resultBytes] = await Promise.all([
			readFile(resolve(reviewRoot, 'review.json')),
			readFile(resolve(candidateRoot, 'results/result-v2-r2.json'))
		]);
		const descriptor = JSON.parse(descriptorBytes.toString('utf8')) as {
			disposition: unknown;
			resultSha256: unknown;
		};
		expect(descriptor.disposition).toBe('candidate');
		expect(descriptor.resultSha256).toBe(createHash('sha256').update(resultBytes).digest('hex'));
	});
});
