import path from 'node:path';

import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import {
	loadSkillIconGeometry,
	renderSkillIconGeometryGuide
} from './export-skill-icon-geometry.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');

describe('skill-icon geometry exporter', () => {
	it('loads the shared registration, safe-zone, and runtime geometry contract', async () => {
		const geometry = await loadSkillIconGeometry(workspaceRoot);

		expect(geometry).toMatchObject({
			schemaVersion: 'skill-icon-geometry-v1',
			canvas: { width: 1024, height: 1024 },
			center: { x: 512, y: 512 },
			subjectSafePercent: 64,
			effectSafePercent: 72,
			runtimeSizes: [512, 256, 128],
			recognitionSize: 96
		});
	});

	it('defines a point-up six-point aperture and top-center medallion exclusion', async () => {
		const geometry = await loadSkillIconGeometry(workspaceRoot);
		const [top, upperRight, lowerRight, bottom, lowerLeft, upperLeft] = geometry.aperturePoints;

		expect(geometry.aperturePoints).toHaveLength(6);
		expect(new Set(geometry.aperturePoints.map((point) => point.join(','))).size).toBe(6);
		expect(top).toEqual([0.5, Math.min(...geometry.aperturePoints.map(([, y]) => y))]);
		expect(bottom).toEqual([0.5, Math.max(...geometry.aperturePoints.map(([, y]) => y))]);
		expect(upperRight![0]).toBeGreaterThan(0.5);
		expect(lowerRight![0]).toBeGreaterThan(0.5);
		expect(lowerLeft![0]).toBeLessThan(0.5);
		expect(upperLeft![0]).toBeLessThan(0.5);

		expect(geometry.rarityMedallionExclusion).toEqual([
			[0.41015625, 0],
			[0.58984375, 0],
			[0.58984375, 0.21484375],
			[0.41015625, 0.21484375]
		]);

		for (const point of [...geometry.aperturePoints, ...geometry.rarityMedallionExclusion]) {
			const [normalizedX, normalizedY] = point;
			const x = normalizedX * geometry.canvas.width;
			const y = normalizedY * geometry.canvas.height;
			expect(x).toBeGreaterThanOrEqual(0);
			expect(x).toBeLessThanOrEqual(geometry.canvas.width);
			expect(y).toBeGreaterThanOrEqual(0);
			expect(y).toBeLessThanOrEqual(geometry.canvas.height);
		}
	});

	it('renders a deterministic full-canvas PNG guide', async () => {
		const geometry = await loadSkillIconGeometry(workspaceRoot);
		const first = await renderSkillIconGeometryGuide(geometry);
		const second = await renderSkillIconGeometryGuide(geometry);

		expect(first.equals(second)).toBe(true);
		expect(await sharp(first).metadata()).toMatchObject({
			format: 'png',
			width: 1024,
			height: 1024,
			channels: 4,
			hasAlpha: true
		});
	});
});
