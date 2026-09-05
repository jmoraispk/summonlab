import { createHash } from 'node:crypto';
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
	SKILL_ICON_GEOMETRY_V2_PATH,
	SKILL_ICON_GEOMETRY_V2_PNG_PATH,
	SKILL_ICON_GEOMETRY_V2_PROVIDER_SIZE,
	exportSkillIconGeometry,
	loadSkillIconGeometry,
	loadSkillIconGeometryV2,
	renderSkillIconGeometryGuide,
	renderSkillIconGeometryGuideSvg,
	renderSkillIconGeometryGuideV2,
	renderSkillIconGeometryGuideV2Svg
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
	await copyFile(
		path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_V2_PATH),
		path.resolve(root, SKILL_ICON_GEOMETRY_V2_PATH)
	);
	return root;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
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

	it('adds only the exact v2 outer envelope and inner-aperture scale to v1 geometry', async () => {
		const [geometry, geometryV2] = await Promise.all([
			loadSkillIconGeometry(workspaceRoot),
			loadSkillIconGeometryV2(workspaceRoot)
		]);
		const { schemaVersion: _schemaVersionV1, ...v1Fields } = geometry;
		const {
			schemaVersion: _schemaVersionV2,
			outerEnvelopePoints,
			innerApertureScale,
			...v2Fields
		} = geometryV2;

		expect(v2Fields).toEqual(v1Fields);
		expect(outerEnvelopePoints).toEqual([
			[0.5, 0.046875],
			[0.88671875, 0.28125],
			[0.88671875, 0.71875],
			[0.5, 0.953125],
			[0.11328125, 0.71875],
			[0.11328125, 0.28125]
		]);
		expect(innerApertureScale).toBe(0.78);
	});

	it('preserves every v1 geometry authority byte-for-byte', async () => {
		const authorities = [
			[
				SKILL_ICON_GEOMETRY_PATH,
				'4a8645adb0f820011b2bf9383710e0161a36905b8e99f1e8d6797b4104d4f7d7'
			],
			[
				SKILL_ICON_GEOMETRY_SVG_PATH,
				'685655edd346c626581df1a97b5cf70f7eb1e5838da5f8f2297999fc2ab49284'
			],
			[
				SKILL_ICON_GEOMETRY_PNG_PATH,
				'8a7d80f9f3c6be40aab510bc9e1f01e2c3a402888f10c2903b9a730cb9e463f4'
			]
		] as const;

		for (const [sourcePath, expectedHash] of authorities) {
			expect(sha256(await readFile(path.resolve(workspaceRoot, sourcePath)))).toBe(expectedHash);
		}
	});

	it('pins the v2 geometry and provider guide raw-byte hashes', async () => {
		expect(sha256(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_V2_PATH)))).toBe(
			'6ffaaa99a2e19c7589bcb2f7975268117db199abd45752fd164567cb5042fcab'
		);
		expect(
			sha256(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_V2_PNG_PATH)))
		).toBe('8f1c01435f3e32de07560b154d9e3becba3ca2a38773ca74c3115d66ba28094e');
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

	it('renders a deterministic 1254-square v2 provider guide with six visible outer edges', async () => {
		const geometry = await loadSkillIconGeometryV2(workspaceRoot);
		const first = await renderSkillIconGeometryGuideV2(geometry);
		const second = await renderSkillIconGeometryGuideV2(geometry);

		expect(first.equals(second)).toBe(true);
		expect(await sharp(first).metadata()).toMatchObject({
			format: 'png',
			width: SKILL_ICON_GEOMETRY_V2_PROVIDER_SIZE,
			height: SKILL_ICON_GEOMETRY_V2_PROVIDER_SIZE,
			channels: 4,
			hasAlpha: true
		});

		const svg = renderSkillIconGeometryGuideV2Svg(geometry).toString('utf8');
		expect(svg).not.toMatch(/<text\b/u);
		expect(svg).not.toMatch(/<circle\b/u);
		expect([...svg.matchAll(/data-guide="([^"]+)"/gu)].map((match) => match[1])).toEqual([
			'canvas',
			'outer-envelope',
			'inner-aperture',
			'backing-aperture',
			'rarity-medallion'
		]);

		const decoded = await sharp(first).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
		const points = geometry.outerEnvelopePoints.map(
			([x, y]) =>
				[
					x * SKILL_ICON_GEOMETRY_V2_PROVIDER_SIZE,
					y * SKILL_ICON_GEOMETRY_V2_PROVIDER_SIZE
				] as const
		);
		for (let edge = 0; edge < points.length; edge += 1) {
			const start = points[edge]!;
			const end = points[(edge + 1) % points.length]!;
			const midpointX = Math.round((start[0] + end[0]) / 2);
			const midpointY = Math.round((start[1] + end[1]) / 2);
			let foundOuterStroke = false;
			for (let y = midpointY - 3; y <= midpointY + 3; y += 1) {
				for (let x = midpointX - 3; x <= midpointX + 3; x += 1) {
					const offset = (y * decoded.info.width + x) * decoded.info.channels;
					const red = decoded.data[offset] ?? 0;
					const green = decoded.data[offset + 1] ?? 0;
					const blue = decoded.data[offset + 2] ?? 0;
					if (red > 220 && green > 220 && blue > 220) foundOuterStroke = true;
				}
			}
			expect(foundOuterStroke, `outer envelope edge ${edge + 1} is visibly rendered`).toBe(true);
		}
	});

	it('writes all versioned guides and recognizes a clean subsequent check', async () => {
		const root = await temporaryWorkspace();
		const geometry = await loadSkillIconGeometry(root);
		const written = await exportSkillIconGeometry({ root, mode: 'write' });

		expect(written).toMatchObject({
			mode: 'write',
			inSync: true,
			written: true,
			guides: [{ current: true }, { current: true }, { current: true }]
		});
		expect(await readFile(path.resolve(root, SKILL_ICON_GEOMETRY_SVG_PATH))).toEqual(
			renderSkillIconGeometryGuideSvg(geometry)
		);
		expect(await readFile(path.resolve(root, SKILL_ICON_GEOMETRY_PNG_PATH))).toEqual(
			await renderSkillIconGeometryGuide(geometry)
		);
		expect(await readFile(path.resolve(root, SKILL_ICON_GEOMETRY_V2_PNG_PATH))).toEqual(
			await renderSkillIconGeometryGuideV2(await loadSkillIconGeometryV2(root))
		);

		await expect(exportSkillIconGeometry({ root, mode: 'check' })).resolves.toMatchObject({
			mode: 'check',
			inSync: true,
			written: false,
			guides: [{ current: true }, { current: true }, { current: true }]
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
			guides: [{ current: false }, { current: true }, { current: true }]
		});

		await exportSkillIconGeometry({ root, mode: 'write' });
		await writeFile(pngPath, Buffer.from('stale PNG'));
		await expect(exportSkillIconGeometry({ root, mode: 'check' })).resolves.toMatchObject({
			inSync: false,
			guides: [{ current: true }, { current: false }, { current: true }]
		});

		await exportSkillIconGeometry({ root, mode: 'write' });
		await writeFile(
			path.resolve(root, SKILL_ICON_GEOMETRY_V2_PNG_PATH),
			Buffer.from('stale v2 PNG')
		);
		await expect(exportSkillIconGeometry({ root, mode: 'check' })).resolves.toMatchObject({
			inSync: false,
			guides: [{ current: true }, { current: true }, { current: false }]
		});
	});

	it('keeps the committed guides byte-identical to the pure renderers', async () => {
		const geometry = await loadSkillIconGeometry(workspaceRoot);
		const geometryV2 = await loadSkillIconGeometryV2(workspaceRoot);
		const report = await exportSkillIconGeometry({ root: workspaceRoot, mode: 'check' });

		expect(report.inSync).toBe(true);
		expect(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_SVG_PATH))).toEqual(
			renderSkillIconGeometryGuideSvg(geometry)
		);
		expect(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_PNG_PATH))).toEqual(
			await renderSkillIconGeometryGuide(geometry)
		);
		expect(await readFile(path.resolve(workspaceRoot, SKILL_ICON_GEOMETRY_V2_PNG_PATH))).toEqual(
			await renderSkillIconGeometryGuideV2(geometryV2)
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
