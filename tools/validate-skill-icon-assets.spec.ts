import { readFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { SkillIconGeometrySchema } from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_ART_MIN_VISIBLE_FRACTION_OF_SUBJECT_SAFE_AREA,
	SKILL_ICON_FRAME_EDGE_BAND_MINIMUM_COVERAGE,
	SKILL_ICON_FRAME_INNER_APERTURE_SCALE,
	SKILL_ICON_FRAME_MIN_VISIBLE_FRACTION_OF_APERTURE_AREA,
	inspectSkillIconAsset
} from './validate-skill-icon-assets.js';

const geometry = SkillIconGeometrySchema.parse(
	JSON.parse(
		await readFile(path.resolve('assets/wiki/skills/icon-production-v1/geometry.json'), 'utf8')
	)
);

async function svgPng(svg: string): Promise<Buffer> {
	return sharp(Buffer.from(svg)).png().toBuffer();
}

async function rgbaPng(visible: (x: number, y: number) => number): Promise<Buffer> {
	const pixels = Buffer.alloc(1024 * 1024 * 4);
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const offset = (y * 1024 + x) * 4;
			pixels[offset] = 80;
			pixels[offset + 1] = 100;
			pixels[offset + 2] = 120;
			pixels[offset + 3] = visible(x + 0.5, y + 0.5);
		}
	}
	return sharp(pixels, { raw: { width: 1024, height: 1024, channels: 4 } })
		.png()
		.toBuffer();
}

function inPolygon(x: number, y: number, points: readonly (readonly [number, number])[]) {
	let inside = false;
	for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
		const [xi, yi] = points[index]!;
		const [xj, yj] = points[previous]!;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
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

	it('treats every alpha value above 8 outside the aperture as a violation', async () => {
		const strictBacking = await rgbaPng((x, y) => {
			const aperture = geometry.aperturePoints.map(([px, py]) => [px * 1024, py * 1024] as const);
			if (x === 511.5 && y === 78.5) return 9;
			return inPolygon(x, y, aperture) ? 255 : 0;
		});
		expect((await inspectSkillIconAsset(strictBacking, 'backing', geometry)).violations).toContain(
			'backing pixels must remain inside the aperture'
		);
	});

	it('rejects one-pixel art and token frame marks using geometry-scaled thresholds', async () => {
		expect(SKILL_ICON_ART_MIN_VISIBLE_FRACTION_OF_SUBJECT_SAFE_AREA).toBeGreaterThan(0);
		expect(SKILL_ICON_FRAME_MIN_VISIBLE_FRACTION_OF_APERTURE_AREA).toBeGreaterThan(0);
		expect(SKILL_ICON_FRAME_EDGE_BAND_MINIMUM_COVERAGE).toBeGreaterThan(0);
		const speck = await rgbaPng((x, y) => (x === 511.5 && y === 511.5 ? 255 : 0));
		expect((await inspectSkillIconAsset(speck, 'skill-art', geometry)).violations).toContain(
			'skill-art visible area is below the minimum emblem coverage'
		);

		const edgeMidpoints = geometry.aperturePoints.map(([x, y], index, points) => {
			const [nextX, nextY] = points[(index + 1) % points.length]!;
			return [Math.floor(((x + nextX) * 1024) / 2), Math.floor(((y + nextY) * 1024) / 2)];
		});
		const tokenFrame = await rgbaPng((x, y) =>
			edgeMidpoints.some(([px, py]) => Math.floor(x) === px && Math.floor(y) === py) ? 255 : 0
		);
		const frameViolations = (await inspectSkillIconAsset(tokenFrame, 'rarity-frame', geometry))
			.violations;
		expect(frameViolations).toContain(
			'rarity-frame visible area is below the minimum frame coverage'
		);
		expect(frameViolations).toContain(
			'rarity-frame edge bands require substantial continuous coverage'
		);
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

		const outer = geometry.aperturePoints.map(([x, y]) => [x * 1024, y * 1024] as const);
		const inner = outer.map(
			([x, y]) =>
				[
					512 + (x - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE,
					512 + (y - 512) * SKILL_ICON_FRAME_INNER_APERTURE_SCALE
				] as const
		);
		const completeFrame = await rgbaPng((x, y) =>
			inPolygon(x, y, outer) && !inPolygon(x, y, inner) ? 255 : 0
		);
		expect(
			(await inspectSkillIconAsset(completeFrame, 'rarity-frame', geometry)).violations
		).toEqual([]);
	});

	it('checks backing aperture coverage but leaves calibration dimensions to its target', async () => {
		const aperture = geometry.aperturePoints.map(([x, y]) => [x * 1024, y * 1024] as const);
		const backing = await rgbaPng((x, y) => (inPolygon(x, y, aperture) ? 255 : 0));
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
