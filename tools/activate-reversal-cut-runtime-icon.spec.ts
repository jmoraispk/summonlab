import { readFile } from 'node:fs/promises';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { AnySkillIconGeometrySchema } from '../packages/contracts/src/index.js';

import {
	assertAcceptedProviderSource,
	normalizeAcceptedCheckerboardSkillArt,
	renderReversalCutRuntimeIcon
} from './activate-reversal-cut-runtime-icon.js';
import * as activationModule from './activate-reversal-cut-runtime-icon.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';
import geometry from '../assets/wiki/skills/icon-production-v1/geometry.json' with { type: 'json' };
import geometryV2 from '../assets/wiki/skills/icon-production-v1/geometry-v2.json' with { type: 'json' };

const parsedGeometry = AnySkillIconGeometrySchema.parse(geometry);
const parsedGeometryV2 = AnySkillIconGeometrySchema.parse(geometryV2);

async function pixelAt(image: Buffer, x: number, y: number): Promise<number[]> {
	return [
		...(await sharp(image)
			.extract({ left: x, top: y, width: 1, height: 1 })
			.ensureAlpha()
			.raw()
			.toBuffer())
	];
}

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

	it('composites the supplied A-rank frame last without redrawing it', async () => {
		const renderFromLayers = (
			activationModule as unknown as {
				renderReversalCutRuntimeIconFromLayers?: (
					backing: Buffer,
					art: Buffer,
					frame: Buffer,
					size: 1024
				) => Promise<Buffer>;
			}
		).renderReversalCutRuntimeIconFromLayers;
		expect(renderFromLayers).toBeTypeOf('function');

		const backing = await sharp(
			Buffer.from(
				'<svg width="1024" height="1024"><rect x="100" y="100" width="824" height="824" fill="#f00"/></svg>'
			)
		)
			.png()
			.toBuffer();
		const art = await sharp(
			Buffer.from(
				'<svg width="1024" height="1024"><circle cx="512" cy="512" r="120" fill="#0f0"/></svg>'
			)
		)
			.png()
			.toBuffer();
		const frame = await sharp(
			Buffer.from(
				'<svg width="1024" height="1024"><path d="M80 80H944V944H80ZM120 120V904H904V120Z" fill="#00f" fill-rule="evenodd"/></svg>'
			)
		)
			.png()
			.toBuffer();
		const icon = await renderFromLayers!(backing, art, frame, 1024);

		expect(await pixelAt(icon, 100, 512)).toEqual([0, 0, 255, 255]);
		expect(await pixelAt(icon, 512, 512)).toEqual([0, 255, 0, 255]);
		expect(await pixelAt(icon, 0, 0)).toEqual([0, 0, 0, 0]);
	});

	it('isolates the authoritative frame while removing its embedded skill interior', async () => {
		const extractFrame = (
			activationModule as unknown as {
				extractReversalCutFrameLayer?: (
					source: Buffer,
					geometry: typeof parsedGeometry
				) => Promise<Buffer>;
			}
		).extractReversalCutFrameLayer;
		expect(extractFrame).toBeTypeOf('function');

		const source = await readFile(
			'assets/wiki/skills/icon-production-v1/mass-production-v1/icons/martial-blade-void-cut.png'
		);
		const frame = await extractFrame!(source, parsedGeometryV2);

		expect(await pixelAt(frame, 512, 45)).toEqual(await pixelAt(source, 512, 45));
		expect(await pixelAt(frame, 512, 200)).toEqual(await pixelAt(source, 512, 200));
		expect((await pixelAt(frame, 330, 760))[3]).toBe(0);
		expect((await pixelAt(frame, 512, 512))[3]).toBe(0);
		expect((await pixelAt(frame, 0, 0))[3]).toBe(0);
	});
});
