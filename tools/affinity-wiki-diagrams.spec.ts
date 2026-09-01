import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

const matrixPath = fileURLToPath(
	new URL('../assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg', import.meta.url)
);

describe('affinity wiki diagrams', () => {
	it('preserves affinity-specific fills when the pairing matrix is rendered', async () => {
		const { data, info } = await sharp(matrixPath).raw().toBuffer({ resolveWithObject: true });
		const pixel = (x: number, y: number) => {
			const offset = (y * info.width + x) * info.channels;
			return [...data.subarray(offset, offset + 3)];
		};

		expect(pixel(280, 160)).toEqual([60, 44, 29]);
		expect(pixel(430, 250)).toEqual([18, 56, 89]);
		expect(pixel(280, 250)).toEqual([21, 28, 40]);
	});
});
