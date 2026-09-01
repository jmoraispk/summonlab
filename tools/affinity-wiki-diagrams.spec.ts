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

		expect(pixel(530, 345)).toEqual([58, 37, 16]);
		expect(pixel(150, 90)).toEqual([14, 46, 79]);
		expect(pixel(275, 260)).toEqual([15, 15, 18]);
	});
});
