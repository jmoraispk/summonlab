import { readFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { SkillIconGeometrySchema } from '../packages/contracts/src/index.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

const geometry = SkillIconGeometrySchema.parse(
	JSON.parse(
		await readFile(path.resolve('assets/wiki/skills/icon-production-v1/geometry.json'), 'utf8')
	)
);

async function svgPng(svg: string): Promise<Buffer> {
	return sharp(Buffer.from(svg)).png().toBuffer();
}

describe('inspectSkillIconAsset', () => {
	it('accepts centered transparent skill artwork', async () => {
		const validArt = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="560" r="220" fill="red"/></svg>'
		);
		expect((await inspectSkillIconAsset(validArt, 'skill-art', geometry)).violations).toEqual([]);
	});

	it('rejects RGB-only, effect overflow, and medallion collisions', async () => {
		const rgbOnly = await sharp({
			create: { width: 1024, height: 1024, channels: 3, background: '#334455' }
		})
			.png()
			.toBuffer();
		expect((await inspectSkillIconAsset(rgbOnly, 'skill-art', geometry)).violations).toContain(
			'skill-art requires a real alpha channel'
		);

		const oversizedEffect = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="512" r="370" fill="red"/></svg>'
		);
		expect(
			(await inspectSkillIconAsset(oversizedEffect, 'skill-art', geometry)).violations
		).toContain('visible pixels escape the 72% effect-safe region');

		const medallionCollision = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><circle cx="512" cy="120" r="20" fill="red"/></svg>'
		);
		expect(
			(await inspectSkillIconAsset(medallionCollision, 'skill-art', geometry)).violations
		).toContain('visible pixels enter the rarity-medallion exclusion');
	});

	it('requires a transparent frame aperture and all six edge bands', async () => {
		const filledFrameAperture = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><polygon points="512,80 904,304 904,720 512,944 120,720 120,304" fill="blue"/></svg>'
		);
		expect(
			(await inspectSkillIconAsset(filledFrameAperture, 'rarity-frame', geometry)).violations
		).toContain('rarity-frame aperture must remain transparent');

		const oneEdge = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><line x1="512" y1="80" x2="904" y2="304" stroke="blue" stroke-width="20"/></svg>'
		);
		expect((await inspectSkillIconAsset(oneEdge, 'rarity-frame', geometry)).violations).toContain(
			'rarity-frame material must intersect all six edge bands'
		);
	});

	it('checks backing aperture coverage but leaves calibration dimensions to its target', async () => {
		const backing = await svgPng(
			'<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg"><polygon points="512,80 904,304 904,720 512,944 120,720 120,304" fill="#333"/></svg>'
		);
		expect((await inspectSkillIconAsset(backing, 'backing', geometry)).violations).toEqual([]);

		const calibration = await sharp({
			create: { width: 2048, height: 1024, channels: 3, background: '#334455' }
		})
			.png()
			.toBuffer();
		expect(
			(await inspectSkillIconAsset(calibration, 'calibration-plate', geometry)).violations
		).toEqual([]);
	});
});
