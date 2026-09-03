import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import type { OutputInfo } from 'sharp';

import {
	AnySkillIconAssignmentSchema,
	AnySkillIconExecutionSchema,
	AnySkillIconGeometrySchema,
	AnySkillIconResultSchema,
	AnySkillIconTargetSchema,
	SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SkillIconGeometrySchema,
	SkillIconGeometryV2Schema,
	SkillIconReprocessResultSchema,
	SkillIconRoleSchema,
	type AnySkillIconGeometry,
	type SkillIconRole
} from '../packages/contracts/src/index.js';
import {
	assertSkillIconSupersedingRevision,
	resolveLatestSkillIconTargets,
	skillIconScopeForRole
} from './skill-icon-revision-lib.js';
import {
	assertSkillIconReprocessExecutionBytes,
	isSkillIconReprocessTarget,
	SkillIconReferenceTargetSchema,
	type SkillIconReferenceTarget
} from './skill-icon-reprocess-consumer-lib.js';

export const SKILL_ICON_TRANSPARENT_ALPHA_MAX = 8;
export const SKILL_ICON_SUBJECT_SAFE_MINIMUM = 0.9;
export const SKILL_ICON_BACKING_APERTURE_COVERAGE_MINIMUM = 0.85;
export const SKILL_ICON_FRAME_INNER_APERTURE_SCALE = 0.78;
export const SKILL_ICON_FRAME_EDGE_BAND_PERCENT = 4;
// One percent of the subject-safe disk rejects dust/single-pixel artifacts while leaving
// deliberately narrow weapon and tool silhouettes viable.
export const SKILL_ICON_ART_MIN_VISIBLE_FRACTION_OF_SUBJECT_SAFE_AREA = 0.01;
// Three percent of the profile-applicable frame envelope and four percent of each
// geometry-scaled edge band require a continuous frame presence rather than six isolated
// registration pixels. The legacy export name remains stable for existing consumers.
export const SKILL_ICON_FRAME_MIN_VISIBLE_FRACTION_OF_APERTURE_AREA = 0.03;
export const SKILL_ICON_FRAME_EDGE_BAND_MINIMUM_COVERAGE = 0.04;

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
	geometry: AnySkillIconGeometry
): Promise<SkillIconAssetInspection> {
	role = SkillIconRoleSchema.parse(role);
	geometry = AnySkillIconGeometrySchema.parse(geometry);
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
	const frameEnvelope = scaledPolygon(
		geometry.schemaVersion === 'skill-icon-geometry-v2'
			? geometry.outerEnvelopePoints
			: geometry.aperturePoints,
		width,
		height
	);
	const exclusion = scaledPolygon(geometry.rarityMedallionExclusion, width, height);
	const center: Point = [
		(geometry.center.x / geometry.canvas.width) * width,
		(geometry.center.y / geometry.canvas.height) * height
	];
	const minimumDimension = Math.min(width, height);
	const effectRadius = (minimumDimension * geometry.effectSafePercent) / 200;
	const subjectRadius = (minimumDimension * geometry.subjectSafePercent) / 200;
	const innerAperture = insetPolygon(
		aperture,
		center,
		geometry.schemaVersion === 'skill-icon-geometry-v2'
			? geometry.innerApertureScale
			: SKILL_ICON_FRAME_INNER_APERTURE_SCALE
	);
	const edgeBandWidth = (minimumDimension * SKILL_ICON_FRAME_EDGE_BAND_PERCENT) / 100;
	const edgeHits = Array.from({ length: frameEnvelope.length }, () => false);
	const edgeBandPixels = Array.from({ length: frameEnvelope.length }, () => 0);
	const visibleEdgeBandPixels = Array.from({ length: frameEnvelope.length }, () => 0);
	let visiblePixels = 0;
	let subjectPixels = 0;
	let subjectSafeAreaPixels = 0;
	let aperturePixels = 0;
	let apertureVisiblePixels = 0;
	let frameEnvelopePixels = 0;
	let outsideEffect = false;
	let outsideAperture = false;
	let outsideFrameEnvelope = false;
	let insideExclusion = false;
	let insideFrameAperture = false;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			const inAperture = pointInPolygon(pixelX, pixelY, aperture);
			const inFrameEnvelope = pointInPolygon(pixelX, pixelY, frameEnvelope);
			const alpha = decoded.data[(y * width + x) * 4 + 3] ?? 0;
			const visible = alpha > SKILL_ICON_TRANSPARENT_ALPHA_MAX;
			const distance = Math.hypot(pixelX - center[0], pixelY - center[1]);
			if (distance <= subjectRadius) subjectSafeAreaPixels += 1;
			if (inAperture) {
				aperturePixels += 1;
				if (visible) apertureVisiblePixels += 1;
			}
			if (inFrameEnvelope) frameEnvelopePixels += 1;
			for (let edge = 0; edge < frameEnvelope.length; edge += 1) {
				if (
					inFrameEnvelope &&
					distanceToSegment(
						pixelX,
						pixelY,
						frameEnvelope[edge]!,
						frameEnvelope[(edge + 1) % frameEnvelope.length]!
					) <= edgeBandWidth
				) {
					edgeBandPixels[edge]! += 1;
					if (visible) visibleEdgeBandPixels[edge]! += 1;
				}
			}
			if (!visible) continue;
			visiblePixels += 1;
			if (distance <= subjectRadius) subjectPixels += 1;
			if (distance > effectRadius) outsideEffect = true;
			const inExclusion = pointInPolygon(pixelX, pixelY, exclusion);
			if (!inAperture) outsideAperture = true;
			if (!inFrameEnvelope && !inExclusion) outsideFrameEnvelope = true;
			if (inExclusion) insideExclusion = true;
			if (pointInPolygon(pixelX, pixelY, innerAperture) && !inExclusion) insideFrameAperture = true;
			for (let edge = 0; edge < frameEnvelope.length; edge += 1) {
				if (edgeHits[edge]) continue;
				if (
					distanceToSegment(
						pixelX,
						pixelY,
						frameEnvelope[edge]!,
						frameEnvelope[(edge + 1) % frameEnvelope.length]!
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
		if (
			visiblePixels / Math.max(1, subjectSafeAreaPixels) <
			SKILL_ICON_ART_MIN_VISIBLE_FRACTION_OF_SUBJECT_SAFE_AREA
		)
			violations.push('skill-art visible area is below the minimum emblem coverage');
		if (outsideEffect) violations.push('visible pixels escape the 72% effect-safe region');
		if (subjectSafeCoverage < SKILL_ICON_SUBJECT_SAFE_MINIMUM)
			violations.push(
				'at least 90% of visible pixels must remain inside the 64% subject-safe region'
			);
		if (insideExclusion) violations.push('visible pixels enter the rarity-medallion exclusion');
	}
	if (role === 'rarity-frame') {
		if (outsideFrameEnvelope)
			violations.push('rarity-frame pixels must remain inside the outer hex or medallion envelope');
		if (insideFrameAperture) violations.push('rarity-frame aperture must remain transparent');
		if (edgeHits.some((hit) => !hit))
			violations.push('rarity-frame material must intersect all six edge bands');
		if (
			visiblePixels / Math.max(1, frameEnvelopePixels) <
			SKILL_ICON_FRAME_MIN_VISIBLE_FRACTION_OF_APERTURE_AREA
		)
			violations.push('rarity-frame visible area is below the minimum frame coverage');
		if (
			edgeBandPixels.some(
				(count, edge) =>
					(visibleEdgeBandPixels[edge] ?? 0) / Math.max(1, count) <
					SKILL_ICON_FRAME_EDGE_BAND_MINIMUM_COVERAGE
			)
		)
			violations.push('rarity-frame edge bands require substantial continuous coverage');
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

interface InventoryFile {
	readonly key: string;
	readonly path: string;
}

async function inventoryFiles(
	directory: string,
	extension: '.json' | '.png',
	description: string,
	root = directory
): Promise<InventoryFile[]> {
	if (directory === root) {
		const rootMetadata = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (rootMetadata === null) return [];
		if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
			throw new Error(`${description} inventory root must be a real directory: ${directory}`);
	}
	const entries = await readdir(directory, { withFileTypes: true }).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [];
			throw error;
		}
	);
	const files: InventoryFile[] = [];
	for (const entry of entries) {
		const child = path.join(directory, entry.name);
		if (entry.isSymbolicLink())
			throw new Error(`${description} tree cannot contain a symbolic link: ${child}`);
		if (entry.isDirectory())
			files.push(...(await inventoryFiles(child, extension, description, root)));
		else if (entry.isFile() && entry.name.endsWith(extension)) {
			files.push({
				key: path.relative(root, child).slice(0, -extension.length).split(path.sep).join('/'),
				path: child
			});
		}
	}
	return files.sort((left, right) => left.key.localeCompare(right.key));
}

function inventoryMap(files: readonly InventoryFile[], description: string): Map<string, string> {
	const inventory = new Map<string, string>();
	for (const file of files) {
		if (inventory.has(file.key))
			throw new Error(`Duplicate ${description} inventory key ${file.key}`);
		inventory.set(file.key, file.path);
	}
	return inventory;
}

const REQUIRED_HISTORICAL_REFERENCE_KEYS = [
	'charcoal-forged-stone-v1',
	'rarity-frame-f-v1',
	'rarity-frame-e-v1',
	'rarity-frame-d-v1',
	'rarity-frame-c-v1',
	'rarity-frame-b-v1',
	'rarity-frame-a-v1',
	'rarity-frame-s-v1'
].map((jobId) => `references/${jobId}`);

function addFailure(failures: string[], message: string): void {
	if (!failures.includes(message)) failures.push(message);
}

function requireHistoricalReferenceInventory(
	failures: string[],
	targets: ReadonlyMap<string, string>,
	assignments: ReadonlyMap<string, string>,
	results: ReadonlyMap<string, string>
): void {
	for (const key of REQUIRED_HISTORICAL_REFERENCE_KEYS) {
		if (!targets.has(key))
			addFailure(failures, `${key}: missing required historical target inventory entry`);
		if (!assignments.has(key)) addFailure(failures, `${key}: missing assignment inventory entry`);
		if (!results.has(key)) addFailure(failures, `${key}: missing result inventory entry`);
	}
}

function compareInventory(
	failures: string[],
	authority: ReadonlyMap<string, string>,
	dependent: ReadonlyMap<string, string>,
	description: 'assignment' | 'result'
): void {
	for (const key of authority.keys()) {
		if (!dependent.has(key)) addFailure(failures, `${key}: missing ${description} inventory entry`);
	}
	for (const key of dependent.keys()) {
		if (!authority.has(key)) addFailure(failures, `${key}: orphan ${description} has no target`);
	}
}

export async function validateSkillIconAssets(root = process.cwd()): Promise<void> {
	const resolvedRoot = path.resolve(root);
	const legacyGeometryPath = path.join(
		resolvedRoot,
		'assets/wiki/skills/icon-production-v1/geometry.json'
	);
	const legacyGeometrySourceBytes = await readSafeRepositoryFile(
		resolvedRoot,
		legacyGeometryPath,
		'Geometry'
	);
	const legacyGeometryHash = createHash('sha256').update(legacyGeometrySourceBytes).digest('hex');
	const legacyGeometry = SkillIconGeometrySchema.parse(
		JSON.parse(legacyGeometrySourceBytes.toString('utf8'))
	);
	const productionRoot = path.join(resolvedRoot, 'assets/wiki/skills/icon-production-v1');
	const targetsRoot = path.join(productionRoot, 'targets');
	const assignmentsRoot = path.join(productionRoot, 'assignments');
	const resultsRoot = path.join(productionRoot, 'results');
	const candidatesRoot = path.join(productionRoot, 'candidates');
	const failures: string[] = [];
	const [targetInventory, assignmentInventory, resultInventory, candidateInventory] =
		await Promise.all([
			inventoryFiles(targetsRoot, '.json', 'Target').then((files) => inventoryMap(files, 'target')),
			inventoryFiles(assignmentsRoot, '.json', 'Assignment').then((files) =>
				inventoryMap(files, 'assignment')
			),
			inventoryFiles(resultsRoot, '.json', 'Result').then((files) => inventoryMap(files, 'result')),
			inventoryFiles(candidatesRoot, '.png', 'Candidate').then((files) =>
				inventoryMap(files, 'candidate')
			)
		]);
	compareInventory(failures, targetInventory, assignmentInventory, 'assignment');
	compareInventory(failures, targetInventory, resultInventory, 'result');
	requireHistoricalReferenceInventory(
		failures,
		targetInventory,
		assignmentInventory,
		resultInventory
	);
	for (const key of candidateInventory.keys()) {
		if (!targetInventory.has(key)) failures.push(`${key}: orphan candidate has no target`);
	}
	const allTargets: SkillIconReferenceTarget[] = [];
	const executions: {
		readonly target: SkillIconReferenceTarget;
		readonly result:
			| ReturnType<typeof AnySkillIconResultSchema.parse>
			| ReturnType<typeof SkillIconReprocessResultSchema.parse>;
	}[] = [];
	for (const [targetKey, targetPath] of targetInventory) {
		const targetBytes = await readSafeRepositoryFile(resolvedRoot, targetPath, 'Target');
		const target = SkillIconReferenceTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
		allTargets.push(target);
		let geometry: AnySkillIconGeometry = legacyGeometry;
		if (target.schemaVersion === 'skill-icon-target-v2' || isSkillIconReprocessTarget(target)) {
			try {
				const normalizationAuthority = isSkillIconReprocessTarget(target)
					? target.processingAuthority
					: target.normalization;
				const geometryPath = path.resolve(resolvedRoot, normalizationAuthority.geometry.path);
				const geometrySourceBytes =
					normalizationAuthority.geometry.path ===
					'assets/wiki/skills/icon-production-v1/geometry.json'
						? legacyGeometrySourceBytes
						: await readSafeRepositoryFile(resolvedRoot, geometryPath, 'Geometry');
				const geometryHash =
					normalizationAuthority.geometry.path ===
					'assets/wiki/skills/icon-production-v1/geometry.json'
						? legacyGeometryHash
						: createHash('sha256').update(geometrySourceBytes).digest('hex');
				if (normalizationAuthority.geometry.contentHash !== geometryHash)
					throw new Error('current raw geometry authority hash does not match target');
				geometry =
					normalizationAuthority.profile === 'skill-icon-green-key-role-mask-v3'
						? SkillIconGeometryV2Schema.parse(JSON.parse(geometrySourceBytes.toString('utf8')))
						: SkillIconGeometrySchema.parse(JSON.parse(geometrySourceBytes.toString('utf8')));
				{
					const expectedGuidePath =
						normalizationAuthority.profile === 'skill-icon-green-key-role-mask-v3'
							? SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH
							: SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH;
					const guide = isSkillIconReprocessTarget(target)
						? target.processingAuthority.guide
						: target.references.find((reference) => reference.path === expectedGuidePath);
					if (!guide) throw new Error('target lacks its profile geometry-guide authority');
					const guideBytes = await readSafeRepositoryFile(
						resolvedRoot,
						path.resolve(resolvedRoot, guide.path),
						'Geometry guide'
					);
					if (createHash('sha256').update(guideBytes).digest('hex') !== guide.contentHash)
						throw new Error('current raw geometry-guide authority hash does not match target');
				}
			} catch (error) {
				failures.push(`${target.jobId}: ${error instanceof Error ? error.message : String(error)}`);
				continue;
			}
		}
		const scope = skillIconScopeForRole(target.role);
		const canonicalTargetPath = path.join(
			resolvedRoot,
			`assets/wiki/skills/icon-production-v1/targets/${scope}/${target.jobId}.json`
		);
		if (targetPath !== canonicalTargetPath) {
			failures.push(`target path does not match packet identity ${target.jobId}`);
			continue;
		}
		if (!resultInventory.has(targetKey)) continue;
		const assignmentPath = path.join(
			resolvedRoot,
			`assets/wiki/skills/icon-production-v1/assignments/${scope}/${target.jobId}.json`
		);
		const resultPath = path.join(
			resolvedRoot,
			`assets/wiki/skills/icon-production-v1/results/${scope}/${target.jobId}.json`
		);
		let result:
			| ReturnType<typeof AnySkillIconResultSchema.parse>
			| ReturnType<typeof SkillIconReprocessResultSchema.parse>;
		try {
			const assignmentBytes = await readSafeRepositoryFile(
				resolvedRoot,
				assignmentPath,
				'Assignment'
			);
			const resultBytes = await readSafeRepositoryFile(resolvedRoot, resultPath, 'Result');
			if (isSkillIconReprocessTarget(target)) {
				const originTargetBytes = await readSafeRepositoryFile(
					resolvedRoot,
					path.resolve(resolvedRoot, target.originAuthority.target.path),
					'Reprocess origin target'
				);
				const originAssignmentBytes = await readSafeRepositoryFile(
					resolvedRoot,
					path.resolve(resolvedRoot, target.originAuthority.assignment.path),
					'Reprocess origin assignment'
				);
				const originResultBytes = await readSafeRepositoryFile(
					resolvedRoot,
					path.resolve(resolvedRoot, target.originAuthority.result.path),
					'Reprocess origin result'
				);
				const originTarget = AnySkillIconTargetSchema.parse(
					JSON.parse(originTargetBytes.toString('utf8'))
				);
				const originCandidatePresent = await lstat(
					path.resolve(resolvedRoot, originTarget.output.candidatePath)
				)
					.then(() => true)
					.catch((error: NodeJS.ErrnoException) => {
						if (error.code === 'ENOENT') return false;
						throw error;
					});
				result = assertSkillIconReprocessExecutionBytes({
					targetPath: path.relative(resolvedRoot, targetPath),
					targetBytes,
					assignmentPath: path.relative(resolvedRoot, assignmentPath),
					assignmentBytes,
					resultPath: path.relative(resolvedRoot, resultPath),
					resultBytes,
					originTargetBytes,
					originAssignmentBytes,
					originResultBytes,
					originCandidatePresent
				}).result;
			} else {
				const assignment = AnySkillIconAssignmentSchema.parse(
					JSON.parse(assignmentBytes.toString('utf8'))
				);
				result = AnySkillIconResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
				AnySkillIconExecutionSchema.parse({
					schemaVersion:
						target.schemaVersion === 'skill-icon-target-v2'
							? 'skill-icon-execution-v2'
							: 'skill-icon-execution-v1',
					target,
					assignment,
					result
				});
			}
		} catch (error) {
			failures.push(
				`${target.jobId}: invalid assignment/result evidence: ${
					error instanceof Error ? error.message : String(error)
				}`
			);
			continue;
		}
		const candidate = path.resolve(resolvedRoot, target.output.candidatePath);
		const metadata = await lstat(candidate).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (result.status === 'superseded') {
			if (isSkillIconReprocessTarget(target)) {
				failures.push(`${target.jobId}: reprocess results cannot be superseded`);
				continue;
			}
			if (metadata) failures.push(`${target.jobId}: superseded result cannot retain a candidate`);
			try {
				const authority = result.supersedingAuthority;
				const [higherTargetBytes, higherAssignmentBytes] = await Promise.all([
					readSafeRepositoryFile(
						resolvedRoot,
						path.resolve(resolvedRoot, authority.targetPath),
						'Superseding target'
					),
					readSafeRepositoryFile(
						resolvedRoot,
						path.resolve(resolvedRoot, authority.assignmentPath),
						'Superseding assignment'
					)
				]);
				if (
					createHash('sha256').update(higherTargetBytes).digest('hex') !==
						authority.targetContentHash ||
					createHash('sha256').update(higherAssignmentBytes).digest('hex') !==
						authority.assignmentContentHash
				)
					throw new Error('superseding packet content hashes changed');
				const higherTarget = AnySkillIconTargetSchema.parse(
					JSON.parse(higherTargetBytes.toString('utf8'))
				);
				const higherAssignment = AnySkillIconAssignmentSchema.parse(
					JSON.parse(higherAssignmentBytes.toString('utf8'))
				);
				if (
					higherTarget.schemaVersion !== 'skill-icon-target-v2' ||
					higherAssignment.schemaVersion !== 'skill-icon-assignment-v2' ||
					higherTarget.jobId !== authority.jobId ||
					higherTarget.logicalIdentity !== authority.logicalIdentity ||
					higherTarget.revision !== authority.revision ||
					higherTarget.role !== authority.role ||
					higherAssignment.jobId !== higherTarget.jobId ||
					higherAssignment.logicalIdentity !== higherTarget.logicalIdentity ||
					higherAssignment.revision !== higherTarget.revision ||
					higherAssignment.targetPath !== authority.targetPath ||
					higherAssignment.assignmentPath !== authority.assignmentPath ||
					higherAssignment.assignmentId !== `assignment-${higherTarget.jobId}` ||
					higherAssignment.normalization.profile !== higherTarget.normalization.profile ||
					higherAssignment.permittedOutputs.candidatePath !== higherTarget.output.candidatePath ||
					higherAssignment.permittedOutputs.resultPath !== higherTarget.output.resultPath
				)
					throw new Error(
						'superseding target and assignment do not bind the same identity at a higher revision'
					);
				assertSkillIconSupersedingRevision(target, higherTarget);
			} catch (error) {
				failures.push(
					`${target.jobId}: invalid superseding authority: ${
						error instanceof Error ? error.message : String(error)
					}`
				);
			}
			executions.push({ target, result });
			continue;
		}
		if (result.status === 'failed') {
			if (metadata) failures.push(`${target.jobId}: failed result cannot retain a candidate`);
			executions.push({ target, result });
			continue;
		}
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
		if (result.output === null) {
			failures.push(`${target.jobId}: non-failed result lacks candidate metadata`);
			continue;
		}
		const expectedOutput = {
			path: target.output.candidatePath,
			mediaType: inspection.mediaType,
			width: inspection.width,
			height: inspection.height,
			alphaMode: inspection.alphaMode,
			bytes: inspection.bytes,
			contentHash: inspection.contentHash
		};
		if (
			Object.entries(expectedOutput).some(
				([field, value]) => result.output?.[field as keyof typeof expectedOutput] !== value
			)
		)
			failures.push(`${target.jobId}: result metadata does not bind the retained candidate bytes`);
		const expectedWidth = isSkillIconReprocessTarget(target) ? 1024 : target.canvas.width;
		const expectedHeight = isSkillIconReprocessTarget(target) ? 1024 : target.canvas.height;
		if (inspection.width !== expectedWidth || inspection.height !== expectedHeight) {
			failures.push(`${target.output.candidatePath}: dimensions do not match target canvas`);
		}
		for (const violation of inspection.violations)
			failures.push(`${target.output.candidatePath}: ${violation}`);
		executions.push({ target, result });
	}
	try {
		const latest = resolveLatestSkillIconTargets(allTargets);
		const resultByJob = new Map(executions.map(({ target, result }) => [target.jobId, result]));
		for (const current of latest) {
			const result = resultByJob.get(current.target.jobId);
			if (!result) continue;
			if (result.status !== 'candidate') {
				const reason =
					result.status === 'failed'
						? `${result.failureReason?.kind ?? 'failed'}: ${result.failureReason?.message ?? 'terminal failure'}`
						: result.status === 'superseded'
							? result.supersessionReason
							: 'revision requested';
				failures.push(
					`${current.logicalKey} latest revision v${current.revision} is ${result.status} (${reason}); create a higher revision`
				);
			}
		}
	} catch (error) {
		failures.push(error instanceof Error ? error.message : String(error));
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
