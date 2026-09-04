import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { AnySkillIconGeometrySchema } from '../packages/contracts/src/index.js';
import { materializeApprovedReversalCutFrame } from './materialize-reversal-cut-approved-frame.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

const SOURCE_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/owner-selected/rarity-frame-a-source.png';
const GEOMETRY_PATH = 'assets/wiki/skills/icon-production-v1/geometry-v2.json';

describe('approved Reversal Cut A-rank frame materialization', () => {
	it('preserves the accepted source while registering it as a deterministic role-valid layer', async () => {
		const [source, geometryBytes] = await Promise.all([
			readFile(SOURCE_PATH),
			readFile(GEOMETRY_PATH)
		]);
		const geometry = AnySkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));

		const first = await materializeApprovedReversalCutFrame(source, geometry);
		const second = await materializeApprovedReversalCutFrame(source, geometry);
		const inspection = await inspectSkillIconAsset(first, 'rarity-frame', geometry);

		expect(first.equals(second)).toBe(true);
		expect(inspection).toMatchObject({
			mediaType: 'image/png',
			width: 1024,
			height: 1024,
			alphaMode: 'rgba',
			violations: []
		});
		expect(inspection.visiblePixels).toBeGreaterThan(80_000);
		const decoded = await sharp(first).raw().toBuffer({ resolveWithObject: true });
		let greenFringePixels = 0;
		for (let pixel = 0; pixel < decoded.info.width * decoded.info.height; pixel += 1) {
			const offset = pixel * 4;
			const red = decoded.data[offset] ?? 0;
			const green = decoded.data[offset + 1] ?? 0;
			const blue = decoded.data[offset + 2] ?? 0;
			const alpha = decoded.data[offset + 3] ?? 0;
			if (alpha > 8 && green > 40 && green - Math.max(red, blue) > 18) {
				greenFringePixels += 1;
			}
		}
		expect(greenFringePixels).toBe(0);
	});
});
