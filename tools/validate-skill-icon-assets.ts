import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import type { OutputInfo } from 'sharp';

import {
	SkillIconGeometrySchema,
	SkillIconRoleSchema,
	SkillIconTargetSchema,
	type SkillIconGeometry,
	type SkillIconRole
} from '../packages/contracts/src/index.js';

export const SKILL_ICON_TRANSPARENT_ALPHA_MAX = 8;
export const SKILL_ICON_SUBJECT_SAFE_MINIMUM = 0.9;
export const SKILL_ICON_BACKING_APERTURE_COVERAGE_MINIMUM = 0.85;
export const SKILL_ICON_FRAME_INNER_APERTURE_SCALE = 0.78;
export const SKILL_ICON_FRAME_EDGE_BAND_PERCENT = 4;
export const SKILL_ICON_APERTURE_ANTIALIAS_TOLERANCE_PX = 1;

export interface SkillIconAssetInspection {
	readonly mediaType: string;
	readonly width: number;
	readonly height: number;
	readonly bytes: number;
	readonly alphaMode: 'rgb' | 'rgba';
	readonly contentHash: string;
	readonly visiblePixels: number;
	readonly subjectSafeCoverage: number | null;
	readonly apertureCoverage: number | null;
	readonly violations: readonly string[];
}

type Point = readonly [number, number];

function isPng(buffer: Buffer): boolean {
	return (
		buffer.length >= 8 &&
		buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
	);
}

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [xi, yi] = polygon[index]!;
		const [xj, yj] = polygon[previous]!;
		if (yi === yj) continue;
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

function distanceToSegment(x: number, y: number, a: Point, b: Point): number {
	const dx = b[0] - a[0];
	const dy = b[1] - a[1];
	const lengthSquared = dx * dx + dy * dy;
	const amount =
		lengthSquared === 0
			? 0
			: Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / lengthSquared));
	return Math.hypot(x - (a[0] + amount * dx), y - (a[1] + amount * dy));
}

function scaledPolygon(points: readonly Point[], width: number, height: number): Point[] {
	return points.map(([x, y]) => [x * width, y * height]);
}

function insetPolygon(points: readonly Point[], center: Point, scale: number): Point[] {
	return points.map(([x, y]) => [
		center[0] + (x - center[0]) * scale,
		center[1] + (y - center[1]) * scale
	]);
}

export async function inspectSkillIconAsset(
	buffer: Buffer,
	role: SkillIconRole,
	geometry: SkillIconGeometry
): Promise<SkillIconAssetInspection> {
	role = SkillIconRoleSchema.parse(role);
	geometry = SkillIconGeometrySchema.parse(geometry);
	const violations: string[] = [];
	const png = isPng(buffer);
	if (!png) violations.push(`${role} must be a PNG`);

	let decoded: { data: Buffer; info: OutputInfo };
	try {
		decoded = await sharp(buffer, { failOn: 'error' })
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
	} catch {
		return {
			mediaType: png ? 'image/png' : 'application/octet-stream',
			width: 0,
			height: 0,
			bytes: buffer.byteLength,
			alphaMode: 'rgb',
			contentHash: createHash('sha256').update(buffer).digest('hex'),
			visiblePixels: 0,
			subjectSafeCoverage: null,
			apertureCoverage: null,
			violations: [...violations, `${role} could not be decoded as an image`]
		};
	}
	const { width, height } = decoded.info;
	const inputMetadata = await sharp(buffer).metadata();
	const alphaMode = inputMetadata.hasAlpha ? 'rgba' : 'rgb';
	if (
		role !== 'calibration-plate' &&
		(width !== geometry.canvas.width || height !== geometry.canvas.height)
	) {
		violations.push(
			`${role} dimensions must be ${geometry.canvas.width}×${geometry.canvas.height}`
		);
	}
	if (role !== 'calibration-plate' && alphaMode !== 'rgba') {
		violations.push(`${role} requires a real alpha channel`);
	}

	const aperture = scaledPolygon(geometry.aperturePoints, width, height);
	const exclusion = scaledPolygon(geometry.rarityMedallionExclusion, width, height);
	const center: Point = [
		(geometry.center.x / geometry.canvas.width) * width,
		(geometry.center.y / geometry.canvas.height) * height
	];
	const minimumDimension = Math.min(width, height);
	const effectRadius = (minimumDimension * geometry.effectSafePercent) / 200;
	const subjectRadius = (minimumDimension * geometry.subjectSafePercent) / 200;
	const innerAperture = insetPolygon(aperture, center, SKILL_ICON_FRAME_INNER_APERTURE_SCALE);
	const edgeBandWidth = (minimumDimension * SKILL_ICON_FRAME_EDGE_BAND_PERCENT) / 100;
	const edgeHits = Array.from({ length: aperture.length }, () => false);
	let visiblePixels = 0;
	let subjectPixels = 0;
	let aperturePixels = 0;
	let apertureVisiblePixels = 0;
	let outsideEffect = false;
	let outsideAperture = false;
	let insideExclusion = false;
	let insideFrameAperture = false;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			const inAperture = pointInPolygon(pixelX, pixelY, aperture);
			const alpha = decoded.data[(y * width + x) * 4 + 3] ?? 0;
			const visible = alpha > SKILL_ICON_TRANSPARENT_ALPHA_MAX;
			if (inAperture) {
				aperturePixels += 1;
				if (visible) apertureVisiblePixels += 1;
			}
			if (!visible) continue;
			visiblePixels += 1;
			const distance = Math.hypot(pixelX - center[0], pixelY - center[1]);
			if (distance <= subjectRadius) subjectPixels += 1;
			if (distance > effectRadius) outsideEffect = true;
			if (
				!inAperture &&
				aperture.every(
					(point, edge) =>
						distanceToSegment(pixelX, pixelY, point, aperture[(edge + 1) % aperture.length]!) >
						SKILL_ICON_APERTURE_ANTIALIAS_TOLERANCE_PX
				)
			)
				outsideAperture = true;
			if (pointInPolygon(pixelX, pixelY, exclusion)) insideExclusion = true;
			if (pointInPolygon(pixelX, pixelY, innerAperture)) insideFrameAperture = true;
			for (let edge = 0; edge < aperture.length; edge += 1) {
				if (edgeHits[edge]) continue;
				if (
					distanceToSegment(
						pixelX,
						pixelY,
						aperture[edge]!,
						aperture[(edge + 1) % aperture.length]!
					) <= edgeBandWidth
				)
					edgeHits[edge] = true;
			}
		}
	}

	const subjectSafeCoverage = visiblePixels === 0 ? 0 : subjectPixels / visiblePixels;
	const apertureCoverage = aperturePixels === 0 ? 0 : apertureVisiblePixels / aperturePixels;
	if (role === 'skill-art') {
		if (visiblePixels === 0) violations.push('skill-art requires visible pixels');
		if (outsideEffect) violations.push('visible pixels escape the 72% effect-safe region');
		if (subjectSafeCoverage < SKILL_ICON_SUBJECT_SAFE_MINIMUM)
			violations.push(
				'at least 90% of visible pixels must remain inside the 64% subject-safe region'
			);
		if (insideExclusion) violations.push('visible pixels enter the rarity-medallion exclusion');
	}
	if (role === 'rarity-frame') {
		if (outsideAperture)
			violations.push('rarity-frame pixels must remain inside the aperture envelope');
		if (insideFrameAperture) violations.push('rarity-frame aperture must remain transparent');
		if (edgeHits.some((hit) => !hit))
			violations.push('rarity-frame material must intersect all six edge bands');
	}
	if (role === 'backing') {
		if (outsideAperture) violations.push('backing pixels must remain inside the aperture');
		if (apertureCoverage < SKILL_ICON_BACKING_APERTURE_COVERAGE_MINIMUM)
			violations.push('backing must cover at least 85% of the aperture');
	}

	return {
		mediaType: png ? 'image/png' : `image/${inputMetadata.format ?? 'unknown'}`,
		width,
		height,
		bytes: buffer.byteLength,
		alphaMode,
		contentHash: createHash('sha256').update(buffer).digest('hex'),
		visiblePixels,
		subjectSafeCoverage: role === 'skill-art' ? subjectSafeCoverage : null,
		apertureCoverage: role === 'backing' ? apertureCoverage : null,
		violations
	};
}

function inside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return (
		relative === '' ||
		(!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
	);
}

async function readSafeRepositoryFile(
	root: string,
	filePath: string,
	description: string
): Promise<Buffer> {
	if (!inside(root, filePath) || filePath === root)
		throw new Error(`${description} escaped workspace root`);
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	const realRoot = await realpath(root);
	let cursor = root;
	const segments = path.relative(root, filePath).split(path.sep);
	for (const [index, segment] of segments.entries()) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`${description} path cannot contain a symbolic link: ${cursor}`);
		if (index < segments.length - 1 && !metadata.isDirectory())
			throw new Error(`${description} ancestor is not a directory: ${cursor}`);
	}
	if (!inside(realRoot, await realpath(path.dirname(filePath))))
		throw new Error(`${description} parent escaped real workspace root`);
	const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		if (!(await handle.stat()).isFile()) throw new Error(`${description} must be a regular file`);
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

async function targetFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true }).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		}
	);
	const files: string[] = [];
	for (const entry of entries) {
		const child = path.join(directory, entry.name);
		if (entry.isSymbolicLink())
			throw new Error(`Target tree cannot contain a symbolic link: ${child}`);
		if (entry.isDirectory()) files.push(...(await targetFiles(child)));
		else if (entry.isFile() && entry.name.endsWith('.json')) files.push(child);
	}
	return files.sort();
}

export async function validateSkillIconAssets(root = process.cwd()): Promise<void> {
	const resolvedRoot = path.resolve(root);
	const geometryPath = path.join(
		resolvedRoot,
		'assets/wiki/skills/icon-production-v1/geometry.json'
	);
	const geometry = SkillIconGeometrySchema.parse(
		JSON.parse(
			(await readSafeRepositoryFile(resolvedRoot, geometryPath, 'Geometry')).toString('utf8')
		)
	);
	const targetsRoot = path.join(resolvedRoot, 'assets/wiki/skills/icon-production-v1/targets');
	const failures: string[] = [];
	for (const targetPath of await targetFiles(targetsRoot)) {
		const target = SkillIconTargetSchema.parse(
			JSON.parse(
				(await readSafeRepositoryFile(resolvedRoot, targetPath, 'Target')).toString('utf8')
			)
		);
		const candidate = path.resolve(resolvedRoot, target.output.candidatePath);
		const metadata = await lstat(candidate).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (!metadata) {
			failures.push(`missing candidate ${target.output.candidatePath}`);
			continue;
		}
		if (!metadata.isFile() || metadata.isSymbolicLink()) {
			failures.push(`candidate is not a regular file ${target.output.candidatePath}`);
			continue;
		}
		const inspection = await inspectSkillIconAsset(
			await readSafeRepositoryFile(resolvedRoot, candidate, 'Candidate'),
			target.role,
			geometry
		);
		if (inspection.width !== target.canvas.width || inspection.height !== target.canvas.height) {
			failures.push(`${target.output.candidatePath}: dimensions do not match target canvas`);
		}
		for (const violation of inspection.violations)
			failures.push(`${target.output.candidatePath}: ${violation}`);
	}
	if (failures.length > 0) throw new Error(failures.join('\n'));
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	validateSkillIconAssets()
		.then(() => process.stdout.write('Skill icon assets valid.\n'))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
