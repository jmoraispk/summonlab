import { readFile } from 'node:fs/promises';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { repairSFrameBadgeTipForReview } from './render-skill-icon-badge-tip-review.js';

const FRAME_PATH =
	'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-s-v9.png';
const SOURCE_PATH =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-s-v10-badge-tip-source.png';

describe('S rarity-frame badge-tip review repair', () => {
	it('adds the missing point without changing a pixel outside the bounded patch', async () => {
		const [frame, providerSource] = await Promise.all([
			readFile(FRAME_PATH),
			readFile(SOURCE_PATH)
		]);
		const repaired = await repairSFrameBadgeTipForReview({ frame, providerSource });

		expect(repaired.audit.changedPixels).toBeGreaterThan(0);
		expect(repaired.audit.addedVisiblePixels).toBeGreaterThan(500);
		expect(repaired.audit.changedOutsidePatch).toBe(0);
		expect(repaired.audit.addedBounds).toEqual({
			left: expect.any(Number),
			top: expect.any(Number),
			width: expect.any(Number),
			height: expect.any(Number)
		});
		expect(repaired.audit.addedBounds?.top).toBeGreaterThanOrEqual(184);
		expect(
			(repaired.audit.addedBounds?.top ?? 0) + (repaired.audit.addedBounds?.height ?? 0)
		).toBeGreaterThan(240);

		const { data, info } = await sharp(repaired.bytes)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		expect(info.width).toBe(1024);
		expect(info.height).toBe(1024);
		expect(data[(250 * 1024 + 512) * 4 + 3]).toBeGreaterThan(0);
	});
});
