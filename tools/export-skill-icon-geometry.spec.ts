import {
	copyFile,
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import sharp from 'sharp';
import { afterEach, describe, expect, it } from 'vitest';

import {
	SKILL_ICON_GEOMETRY_PATH,
	SKILL_ICON_GEOMETRY_PNG_PATH,
	SKILL_ICON_GEOMETRY_SVG_PATH,
	exportSkillIconGeometry,
	loadSkillIconGeometry,
	renderSkillIconGeometryGuide,
	renderSkillIconGeometryGuideSvg
} from './export-skill-icon-geometry.js';

const workspaceRoot = path.resolve(import.meta.dirname, '..');
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

async function temporaryWorkspace(): Promise<string> {
	const root = await mkdtemp(path.join(os.tmpdir(), 'summonlab-skill-icon-geometry-'));
	temporaryRoots.push(root);
	const geometryDestination = path.resolve(root, SKILL_ICON_GEOMETRY_PATH);
	await mkdir(path.dirname(geometryDestination), { recursive: true });
	await copyFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_PATH), geometryDestination);
	return root;
}

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

	it('writes both guides and recognizes a clean subsequent check', async () => {
		const root = await temporaryWorkspace();
		const geometry = await loadSkillIconGeometry(root);
		const written = await exportSkillIconGeometry({ root, mode: 'write' });

		expect(written).toMatchObject({
			mode: 'write',
			inSync: true,
			written: true,
			guides: [{ current: true }, { current: true }]
		});
		expect(await readFile(path.resolve(root, SKILL_ICON_GEOMETRY_SVG_PATH))).toEqual(
			renderSkillIconGeometryGuideSvg(geometry)
		);
		expect(await readFile(path.resolve(root, SKILL_ICON_GEOMETRY_PNG_PATH))).toEqual(
			await renderSkillIconGeometryGuide(geometry)
		);

		await expect(exportSkillIconGeometry({ root, mode: 'check' })).resolves.toMatchObject({
			mode: 'check',
			inSync: true,
			written: false,
			guides: [{ current: true }, { current: true }]
		});
	});

	it('detects independently stale SVG and PNG guides', async () => {
		const root = await temporaryWorkspace();
		await exportSkillIconGeometry({ root, mode: 'write' });
		const svgPath = path.resolve(root, SKILL_ICON_GEOMETRY_SVG_PATH);
		const pngPath = path.resolve(root, SKILL_ICON_GEOMETRY_PNG_PATH);

		await writeFile(svgPath, '<svg/>\n');
		await expect(exportSkillIconGeometry({ root, mode: 'check' })).resolves.toMatchObject({
			inSync: false,
			guides: [{ current: false }, { current: true }]
		});

		await exportSkillIconGeometry({ root, mode: 'write' });
		await writeFile(pngPath, Buffer.from('stale PNG'));
		await expect(exportSkillIconGeometry({ root, mode: 'check' })).resolves.toMatchObject({
			inSync: false,
			guides: [{ current: true }, { current: false }]
		});
	});

	it('keeps the committed guides byte-identical to the pure renderers', async () => {
		const geometry = await loadSkillIconGeometry(workspaceRoot);
		const report = await exportSkillIconGeometry({ root: workspaceRoot, mode: 'check' });

		expect(report.inSync).toBe(true);
		expect(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_SVG_PATH))).toEqual(
			renderSkillIconGeometryGuideSvg(geometry)
		);
		expect(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_PNG_PATH))).toEqual(
			await renderSkillIconGeometryGuide(geometry)
		);
	});

	it('refuses a symlink destination without modifying its external target', async () => {
		const root = await temporaryWorkspace();
		const outsideRoot = await mkdtemp(path.join(os.tmpdir(), 'summonlab-geometry-outside-'));
		temporaryRoots.push(outsideRoot);
		const externalTarget = path.join(outsideRoot, 'external.svg');
		const originalExternalBytes = Buffer.from('must remain unchanged');
		const references = path.dirname(path.resolve(root, SKILL_ICON_GEOMETRY_SVG_PATH));
		const svgDestination = path.resolve(root, SKILL_ICON_GEOMETRY_SVG_PATH);
		await mkdir(references, { recursive: true });
		await writeFile(externalTarget, originalExternalBytes);
		await symlink(externalTarget, svgDestination);

		await expect(exportSkillIconGeometry({ root, mode: 'write' })).rejects.toThrow('symbolic link');
		expect(await readFile(externalTarget)).toEqual(originalExternalBytes);
		expect((await lstat(svgDestination)).isSymbolicLink()).toBe(true);
		expect((await readdir(references)).filter((entry) => entry.endsWith('.tmp'))).toEqual([]);
	});
});
