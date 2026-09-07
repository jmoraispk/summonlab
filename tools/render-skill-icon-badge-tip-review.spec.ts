import { readFile } from 'node:fs/promises';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
	adoptCompleteRankFrameForReview,
	adoptCompleteSFrameForReview,
	repairSFrameBadgeTipForReview
} from './render-skill-icon-badge-tip-review.js';

const FRAME_PATH =
	'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-s-v9.png';
const SOURCE_PATH =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-s-v10-badge-tip-source.png';
const COMPLETE_SOURCE_BY_RANK = {
	F: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-f-v10-complete-source.png',
	E: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-e-v10-complete-source.png',
	D: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-d-v10-complete-source.png',
	C: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-c-v10-complete-source.png',
	B: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-b-v10-complete-source.png',
	A: 'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/provider-sources/rarity-frame-a-v10-complete-source.png',
	S: SOURCE_PATH
} as const;

describe('S rarity-frame badge-tip review repair', () => {
	it('adopts complete generated frames for every rank without the v9 badge cutoff', async () => {
		for (const [rank, sourcePath] of Object.entries(COMPLETE_SOURCE_BY_RANK)) {
			const adopted = await adoptCompleteRankFrameForReview({
				rank,
				providerSource: await readFile(sourcePath)
			});
			const { data, info } = await sharp(adopted.bytes)
				.ensureAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });
			const alphaAt = (x: number, y: number): number => data[(y * info.width + x) * 4 + 3]!;

			expect(info).toMatchObject({ width: 1024, height: 1024, channels: 4 });
			expect(alphaAt(0, 0), `${rank} exterior`).toBe(0);
			expect(alphaAt(512, 512), `${rank} aperture`).toBe(0);
			expect(alphaAt(150, 512), `${rank} side rail`).toBeGreaterThan(0);
			expect(adopted.audit.matteBorderMaximum).toBeLessThanOrEqual(4);
			expect(
				adopted.audit.centerBadgePixelsBelowLegacyCutoff,
				`${rank} complete badge point`
			).toBeGreaterThan(0);
			expect(adopted.audit.lowestCenterBadgeRow).toBeGreaterThan(219);
		}
	});

	it('adopts the complete generated S frame without mixing in the clipped v9 frame', async () => {
		const adopted = await adoptCompleteSFrameForReview({
			providerSource: await readFile(SOURCE_PATH)
		});
		const { data, info } = await sharp(adopted.bytes)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		const alphaAt = (x: number, y: number): number => data[(y * info.width + x) * 4 + 3]!;

		expect(info).toMatchObject({ width: 1024, height: 1024, channels: 4 });
		expect(alphaAt(0, 0)).toBe(0);
		expect(alphaAt(512, 512)).toBe(0);
		expect(alphaAt(512, 250)).toBeGreaterThan(0);
		expect(alphaAt(150, 512)).toBeGreaterThan(0);
	});

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

	it('records canonical layer recomposition instead of patching an already framed composite', async () => {
		const report = JSON.parse(
			await readFile(
				'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v7-frame-recomposition/report.json',
				'utf8'
			)
		) as {
			readonly assembly?: {
				readonly mode?: string;
				readonly frameIsFinalLayer?: boolean;
			};
			readonly inspection?: {
				readonly exactComposite?: boolean;
				readonly protectedBandMatches?: boolean;
			};
		};

		expect(report.assembly).toEqual({
			mode: 'canonical-backing-masked-interior-repaired-frame',
			frameIsFinalLayer: true
		});
		expect(report.inspection).toMatchObject({
			exactComposite: true,
			protectedBandMatches: true
		});
	});

	it('records complete generated-frame adoption without mixing v9 pixels into the frame', async () => {
		const report = JSON.parse(
			await readFile(
				'assets/wiki/skills/icon-production-v1/quality-cleanup-v1/review/v8-complete-s-frame/report.json',
				'utf8'
			)
		) as {
			readonly decision?: string;
			readonly assembly?: {
				readonly mode?: string;
				readonly frameIsFinalLayer?: boolean;
				readonly v9PixelsMergedIntoFrame?: boolean;
			};
			readonly inspection?: {
				readonly exactComposite?: boolean;
				readonly protectedBandMatches?: boolean;
			};
		};

		expect(report.decision).toBe('adopt-complete-generated-s-frame-as-final-layer');
		expect(report.assembly).toEqual({
			mode: 'canonical-backing-masked-interior-complete-generated-frame',
			frameIsFinalLayer: true,
			v9PixelsMergedIntoFrame: false
		});
		expect(report.inspection).toMatchObject({
			exactComposite: true,
			protectedBandMatches: true
		});
	});
});
