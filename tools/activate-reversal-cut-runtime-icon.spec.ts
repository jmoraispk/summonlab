import { describe, expect, it } from 'vitest';
import sharp from 'sharp';

import { AnySkillIconGeometrySchema } from '../packages/contracts/src/index.js';

import {
	assertAcceptedProviderSource,
	normalizeAcceptedCheckerboardSkillArt,
	renderReversalCutRuntimeIcon
} from './activate-reversal-cut-runtime-icon.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';
import geometry from '../assets/wiki/skills/icon-production-v1/geometry.json' with { type: 'json' };

const parsedGeometry = AnySkillIconGeometrySchema.parse(geometry);

async function syntheticProviderSource(): Promise<Buffer> {
	const checker = Buffer.from(
		`<svg width="1254" height="1254" xmlns="http://www.w3.org/2000/svg">
			<defs><pattern id="c" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#f7f7f7"/><rect width="32" height="32" fill="#e9e9e9"/><rect x="32" y="32" width="32" height="32" fill="#e9e9e9"/></pattern></defs>
			<rect width="1254" height="1254" fill="url(#c)"/>
			<path d="M370 900 L690 280 L760 320 L470 930 Z" fill="#263241" stroke="#dce7ef" stroke-width="18"/>
			<path d="M680 500 L1010 390" stroke="#303843" stroke-width="58"/>
			<path d="M760 550 Q1010 700 720 900" fill="none" stroke="#72b9e8" stroke-width="42"/>
			<circle cx="708" cy="500" r="34" fill="#ff9a32"/>
		</svg>`
	);
	return sharp(checker).png().removeAlpha().toBuffer();
}

describe('Reversal Cut accepted-source activation', () => {
	it('rejects provider bytes that do not match the owner-accepted source hash', async () => {
		await expect(
			assertAcceptedProviderSource(await syntheticProviderSource(), 'a'.repeat(64))
		).rejects.toThrow(/owner-accepted provider source hash/u);
	});

	it('removes the connected checkerboard and returns role-valid isolated skill art', async () => {
		const art = await normalizeAcceptedCheckerboardSkillArt(await syntheticProviderSource());
		const metadata = await sharp(art).metadata();
		const inspection = await inspectSkillIconAsset(art, 'skill-art', parsedGeometry);
		const corner = await sharp(art)
			.extract({ left: 0, top: 0, width: 32, height: 32 })
			.ensureAlpha()
			.raw()
			.toBuffer();

		expect(metadata).toMatchObject({ width: 1024, height: 1024, format: 'png', hasAlpha: true });
		expect(inspection.violations).toEqual([]);
		expect([...corner].filter((_, index) => index % 4 === 3).every((alpha) => alpha === 0)).toBe(
			true
		);
	});

	it('renders a transparent complete A-rank icon at the requested size', async () => {
		const icon = await renderReversalCutRuntimeIcon(
			await normalizeAcceptedCheckerboardSkillArt(await syntheticProviderSource()),
			256
		);
		const metadata = await sharp(icon).metadata();
		const corner = await sharp(icon)
			.extract({ left: 0, top: 0, width: 8, height: 8 })
			.ensureAlpha()
			.raw()
			.toBuffer();

		expect(metadata).toMatchObject({ width: 256, height: 256, format: 'webp', hasAlpha: true });
		expect([...corner].filter((_, index) => index % 4 === 3).every((alpha) => alpha === 0)).toBe(
			true
		);
	});
});
