import { createHash, randomUUID } from 'node:crypto';
import {
	link,
	lstat,
	mkdtemp,
	mkdir,
	open,
	readFile,
	realpath,
	rm,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

import {
	SkillIconCatalogSchema,
	SkillIconCleanupAuthoritySchema,
	SkillIconCleanupFindingSchema,
	SkillIconCleanupManifestSchema,
	SkillIconCleanupResultSchema,
	SkillIconGeometryV2Schema,
	type SkillIconCatalog,
	type SkillIconCleanupFinding,
	type SkillIconCleanupManifest,
	type SkillIconGeometryV2
} from '../packages/contracts/src/index.js';
import type { MassProductionManifest } from './skill-icon-mass-production-lib.js';
import type { SkillIconMotifMap, SkillIconVisualSpecs } from './skill-icon-production-lib.js';

export const QUALITY_CLEANUP_ROOT =
	'assets/wiki/skills/icon-production-v1/quality-cleanup-v1' as const;

const MASS_PRODUCTION_ROOT = 'assets/wiki/skills/icon-production-v1/mass-production-v1' as const;
const FINDINGS_SOURCE_PATH = `${QUALITY_CLEANUP_ROOT}/findings.source.json` as const;
const MANIFEST_PATH = `${QUALITY_CLEANUP_ROOT}/manifest.json` as const;
const FINDINGS_PATH = `${QUALITY_CLEANUP_ROOT}/findings.json` as const;

const AUTHORITY_PATHS = {
	massProductionManifest: `${MASS_PRODUCTION_ROOT}/manifest.json`,
	catalog: 'assets/wiki/skills/icon-production-v1/catalog.json',
	motifMap: 'assets/wiki/skills/icon-production-v1/motif-map.json',
	visualSpecifications: 'assets/wiki/skills/icon-production-v1/visual-specs.json',
	selectedFrameSheet: `${MASS_PRODUCTION_ROOT}/references/approved-seven-frame-sheet.png`,
	optionCMaterial: 'assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png',
	geometry: 'assets/wiki/skills/icon-production-v1/geometry-v2.json',
	providerSpaceGuide: 'assets/wiki/skills/icon-production-v1/references/geometry-guide-v2.png'
} as const;

type CleanupAuthority = SkillIconCleanupManifest['authority'];

export interface CleanupManifestInput {
	readonly authority: CleanupAuthority;
	readonly catalog: SkillIconCatalog;
	readonly massProductionManifest: MassProductionManifest;
	readonly motifMap: SkillIconMotifMap;
	readonly visualSpecifications: SkillIconVisualSpecs;
	readonly geometry: SkillIconGeometryV2;
	readonly findings: readonly SkillIconCleanupFinding[];
	readonly sourceHashesByTargetId: ReadonlyMap<string, string>;
}

export interface CleanupExportReport {
	readonly mode: 'write' | 'check';
	readonly counts: Readonly<{ total: number; Martial: number; Magical: number; Craft: number }>;
	readonly written: readonly string[];
	readonly drifted: readonly string[];
}

export interface PixelBounds {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface InteriorResult {
	readonly bytes: Buffer;
	readonly removedPixels: number;
	readonly removedPixelBounds: PixelBounds | null;
}

export interface CleanupInspectionInput {
	readonly composite: Buffer;
	readonly backing: Buffer;
	readonly interior: Buffer;
	readonly frame: Buffer;
	readonly geometry: SkillIconGeometryV2;
	readonly boundLayerHashes?: Readonly<{
		backing: string;
		interior: string;
		frame: string;
	}>;
}

export interface CleanupInspection {
	readonly layerHashesMatch: boolean;
	readonly exactComposite: boolean;
	readonly protectedBandMatches: boolean;
	readonly exteriorTransparent: boolean;
	readonly nearWhiteComponents: readonly {
		readonly pixels: number;
		readonly bounds: PixelBounds;
	}[];
	readonly warnings: readonly string[];
}

export interface CleanupFinalizeReport {
	readonly mode: 'write' | 'check';
	readonly ready: boolean;
	readonly total: number;
	readonly finalized: number;
	readonly pendingLayerJobIds: readonly string[];
	readonly written: readonly string[];
	readonly drifted: readonly string[];
	readonly warnings: readonly string[];
}

export function cleanupSlug(targetId: string): string {
	return targetId.replaceAll(':', '-');
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function isInside(root: string, candidate: string): boolean {
	const relative = path.relative(root, candidate);
	return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
}

async function regularBytes(root: string, repositoryPath: string): Promise<Buffer> {
	const rootRealPath = await realpath(root);
	const absolutePath = path.resolve(root, repositoryPath);
	if (!isInside(rootRealPath, absolutePath)) {
		throw new Error(`Authority path resolves outside the repository root: ${repositoryPath}`);
	}
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing symbolic-link or non-regular authority file: ${repositoryPath}`);
	}
	const resolvedPath = await realpath(absolutePath);
	if (!isInside(rootRealPath, resolvedPath)) {
		throw new Error(`Authority path resolves outside the repository root: ${repositoryPath}`);
	}
	return readFile(absolutePath);
}

async function loadAuthority(root: string): Promise<{
	readonly authority: CleanupAuthority;
	readonly bytes: Readonly<Record<keyof typeof AUTHORITY_PATHS, Buffer>>;
}> {
	const entries = await Promise.all(
		Object.entries(AUTHORITY_PATHS).map(async ([key, repositoryPath]) => [
			key,
			await regularBytes(root, repositoryPath)
		])
	);
	const bytes = Object.fromEntries(entries) as Readonly<
		Record<keyof typeof AUTHORITY_PATHS, Buffer>
	>;
	const authority = SkillIconCleanupAuthoritySchema.parse(
		Object.fromEntries(
			Object.entries(AUTHORITY_PATHS).map(([key, repositoryPath]) => [
				key,
				{ path: repositoryPath, contentHash: sha256(bytes[key as keyof typeof AUTHORITY_PATHS]) }
			])
		)
	);
	return { authority, bytes };
}

function parseFindings(bytes: Buffer): readonly SkillIconCleanupFinding[] {
	const parsed = JSON.parse(bytes.toString('utf8')) as unknown;
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		(parsed as { schemaVersion?: unknown }).schemaVersion !==
			'skill-icon-quality-cleanup-findings-source-v1' ||
		!Array.isArray((parsed as { findings?: unknown }).findings)
	) {
		throw new Error('Invalid cleanup findings source');
	}
	return (parsed as { findings: unknown[] }).findings.map((finding) =>
		SkillIconCleanupFindingSchema.parse(finding)
	);
}

function assertExactTargetCoverage(
	expected: readonly string[],
	actual: readonly string[],
	label: string
): void {
	if (
		expected.length !== actual.length ||
		new Set(actual).size !== actual.length ||
		expected.some((targetId) => !actual.includes(targetId))
	) {
		throw new Error(`${label} does not have exact canonical target coverage`);
	}
}

export async function loadCleanupManifestInput(
	root = process.cwd()
): Promise<CleanupManifestInput> {
	const repositoryRoot = path.resolve(root);
	const [{ authority, bytes }, findingsBytes] = await Promise.all([
		loadAuthority(repositoryRoot),
		regularBytes(repositoryRoot, FINDINGS_SOURCE_PATH)
	]);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse(bytes.catalog.toString('utf8')) as unknown
	);
	const massProductionManifest = JSON.parse(
		bytes.massProductionManifest.toString('utf8')
	) as MassProductionManifest;
	const motifMap = JSON.parse(bytes.motifMap.toString('utf8')) as SkillIconMotifMap;
	const visualSpecifications = JSON.parse(
		bytes.visualSpecifications.toString('utf8')
	) as SkillIconVisualSpecs;
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(bytes.geometry.toString('utf8')) as unknown
	);
	const findings = parseFindings(findingsBytes);
	const sourceHashesByTargetId = new Map<string, string>();

	for (const skill of massProductionManifest.skills) {
		const sourcePath = `${MASS_PRODUCTION_ROOT}/icons/${cleanupSlug(skill.targetId)}.png`;
		if (skill.finalImagePath !== sourcePath) {
			throw new Error(`Mass-production source path is not canonical: ${skill.targetId}`);
		}
		if (!skill.finalImageHash) throw new Error(`Missing frozen source hash: ${skill.targetId}`);
		const contentHash = sha256(await regularBytes(repositoryRoot, sourcePath));
		if (contentHash !== skill.finalImageHash) {
			throw new Error(`Frozen mass-production source hash drift: ${skill.targetId}`);
		}
		sourceHashesByTargetId.set(skill.targetId, contentHash);
	}

	return {
		authority,
		catalog,
		massProductionManifest,
		motifMap,
		visualSpecifications,
		geometry,
		findings,
		sourceHashesByTargetId
	};
}

function dispositionFor(
	findings: readonly SkillIconCleanupFinding[]
): SkillIconCleanupManifest['records'][number]['disposition'] {
	if (findings.some((finding) => finding.requiredAction === 'recompose')) return 'recompose';
	if (findings.some((finding) => finding.requiredAction === 'revise-art')) return 'revise-art';
	if (findings.some((finding) => finding.requiredAction === 'owner-review')) return 'owner-review';
	return 'accepted-unchanged';
}

export function buildSkillIconCleanupManifest(
	input: CleanupManifestInput
): SkillIconCleanupManifest {
	const catalog = SkillIconCatalogSchema.parse(input.catalog);
	const geometry = SkillIconGeometryV2Schema.parse(input.geometry);
	void geometry;
	const authority = SkillIconCleanupAuthoritySchema.parse(input.authority);
	const catalogTargetIds = catalog.records.map((record) => record.targetId);
	const massTargetIds = input.massProductionManifest.skills.map((record) => record.targetId);
	assertExactTargetCoverage(catalogTargetIds, massTargetIds, 'Mass-production manifest');
	assertExactTargetCoverage(
		catalogTargetIds,
		input.motifMap.records.map((record) => record.targetId),
		'Motif map'
	);
	assertExactTargetCoverage(
		catalogTargetIds,
		input.visualSpecifications.records.map((record) => record.targetId),
		'Visual specifications'
	);
	if (
		input.massProductionManifest.expected.skills !== 456 ||
		input.massProductionManifest.expected.domains.Martial !== 258 ||
		input.massProductionManifest.expected.domains.Magical !== 124 ||
		input.massProductionManifest.expected.domains.Craft !== 74
	) {
		throw new Error('Mass-production manifest does not declare the frozen 456-skill inventory');
	}
	const catalogByTargetId = new Map(catalog.records.map((record) => [record.targetId, record]));
	const massByTargetId = new Map(
		input.massProductionManifest.skills.map((record) => [record.targetId, record])
	);
	const findingsByTargetId = new Map<string, SkillIconCleanupFinding[]>();
	for (const finding of input.findings) {
		const parsedFinding = SkillIconCleanupFindingSchema.parse(finding);
		if (!catalogByTargetId.has(parsedFinding.targetId)) {
			throw new Error(`Cleanup finding references an unknown target: ${parsedFinding.targetId}`);
		}
		const attached = findingsByTargetId.get(parsedFinding.targetId) ?? [];
		attached.push(parsedFinding);
		findingsByTargetId.set(parsedFinding.targetId, attached);
	}

	const records = catalog.records.map((catalogRecord) => {
		const massRecord = massByTargetId.get(catalogRecord.targetId);
		if (!massRecord || massRecord.rarity !== catalogRecord.rarity) {
			throw new Error(`Mass-production rank drift: ${catalogRecord.targetId}`);
		}
		const sourcePath = `${MASS_PRODUCTION_ROOT}/icons/${cleanupSlug(catalogRecord.targetId)}.png`;
		if (massRecord.finalImagePath !== sourcePath || !massRecord.finalImageHash) {
			throw new Error(`Mass-production source is not frozen: ${catalogRecord.targetId}`);
		}
		const sourceHash = input.sourceHashesByTargetId.get(catalogRecord.targetId);
		if (!sourceHash || sourceHash !== massRecord.finalImageHash) {
			throw new Error(
				`Cleanup source hash does not match mass production: ${catalogRecord.targetId}`
			);
		}
		const findings = findingsByTargetId.get(catalogRecord.targetId) ?? [];
		const slug = cleanupSlug(catalogRecord.targetId);
		return {
			targetId: catalogRecord.targetId,
			sourceCandidate: { path: sourcePath, contentHash: sourceHash },
			rank: catalogRecord.rarity,
			disposition: dispositionFor(findings),
			findings,
			cleanupCompositePath: `${QUALITY_CLEANUP_ROOT}/composites/${slug}.png`,
			resultPath: `${QUALITY_CLEANUP_ROOT}/results/${slug}.json`
		};
	});
	const counts = records.reduce(
		(counts, record) => {
			const domain = record.targetId.split(':', 1)[0];
			if (domain === 'martial') counts.Martial += 1;
			else if (domain === 'magical') counts.Magical += 1;
			else if (domain === 'craft') counts.Craft += 1;
			return counts;
		},
		{ total: records.length, Martial: 0, Magical: 0, Craft: 0 }
	);
	if (
		counts.total !== 456 ||
		counts.Martial !== 258 ||
		counts.Magical !== 124 ||
		counts.Craft !== 74
	) {
		throw new Error('Cleanup manifest actual domain counts do not match the frozen inventory');
	}
	return SkillIconCleanupManifestSchema.parse({
		schemaVersion: 'skill-icon-quality-cleanup-manifest-v1',
		authority,
		records
	});
}

async function currentBytes(root: string, repositoryPath: string): Promise<Buffer | null> {
	const absolutePath = path.resolve(root, repositoryPath);
	const metadata = await lstat(absolutePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (!metadata) return null;
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Refusing symbolic-link or non-regular cleanup artifact: ${repositoryPath}`);
	}
	return readFile(absolutePath);
}

async function writeMissingAtomic(
	root: string,
	repositoryPath: string,
	bytes: Buffer,
	beforePublish?: (repositoryPath: string) => void | Promise<void>
): Promise<boolean> {
	const destination = path.resolve(root, repositoryPath);
	const rootRealPath = await realpath(root);
	if (!isInside(rootRealPath, destination)) {
		throw new Error(
			`Cleanup artifact path resolves outside the repository root: ${repositoryPath}`
		);
	}
	const current = await currentBytes(root, repositoryPath);
	if (current?.equals(bytes)) return false;
	if (current) throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`);
	await mkdir(path.dirname(destination), { recursive: true });
	const resolvedDirectory = await realpath(path.dirname(destination));
	if (!isInside(rootRealPath, resolvedDirectory)) {
		throw new Error(
			`Cleanup artifact parent resolves outside the repository root: ${repositoryPath}`
		);
	}
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await beforePublish?.(repositoryPath);
		let published = false;
		try {
			await link(stage, destination);
			published = true;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const concurrent = await currentBytes(root, repositoryPath);
			if (!concurrent?.equals(bytes)) {
				throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`, {
					cause: error
				});
			}
		}
		const current = await currentBytes(root, repositoryPath);
		if (!current?.equals(bytes)) {
			throw new Error(`Refusing to replace drifted cleanup artifact: ${repositoryPath}`);
		}
		await unlink(stage);
		return published;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

export async function exportSkillIconQualityCleanup(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
	/** @internal Test-only synchronization immediately before create-only publication. */
	readonly testHooks?: {
		readonly beforePublish?: (repositoryPath: string) => void | Promise<void>;
	};
}): Promise<CleanupExportReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const input = await loadCleanupManifestInput(root);
	const manifest = buildSkillIconCleanupManifest(input);
	const outputs = [
		{ path: MANIFEST_PATH, bytes: jsonBytes(manifest) },
		{
			path: FINDINGS_PATH,
			bytes: jsonBytes({
				schemaVersion: 'skill-icon-quality-cleanup-findings-source-v1',
				findings: input.findings
			})
		}
	];
	const drifted: string[] = [];
	const written: string[] = [];
	for (const output of outputs) {
		const current = await currentBytes(root, output.path);
		if (current?.equals(output.bytes)) continue;
		if (options.mode === 'check') {
			drifted.push(output.path);
			continue;
		}
		if (
			await writeMissingAtomic(root, output.path, output.bytes, options.testHooks?.beforePublish)
		) {
			written.push(output.path);
		}
	}
	const counts = manifest.records.reduce(
		(counts, record) => {
			const domain = record.targetId.split(':', 1)[0];
			if (domain === 'martial') counts.Martial += 1;
			else if (domain === 'magical') counts.Magical += 1;
			else if (domain === 'craft') counts.Craft += 1;
			return counts;
		},
		{ total: manifest.records.length, Martial: 0, Magical: 0, Craft: 0 }
	);
	return { mode: options.mode, counts, written, drifted };
}

type Point = readonly [number, number];

const DETERMINISTIC_PNG_OPTIONS = {
	compressionLevel: 9,
	adaptiveFiltering: false,
	palette: false
} as const;

const CLEANUP_LAYER_JOBS = [
	{ jobId: 'charcoal-forged-stone-v6', role: 'backing', rarity: null },
	{ jobId: 'rarity-frame-f-v5', role: 'rarity-frame', rarity: 'F' },
	{ jobId: 'rarity-frame-e-v7', role: 'rarity-frame', rarity: 'E' },
	{ jobId: 'rarity-frame-d-v7', role: 'rarity-frame', rarity: 'D' },
	{ jobId: 'rarity-frame-c-v7', role: 'rarity-frame', rarity: 'C' },
	{ jobId: 'rarity-frame-b-v7', role: 'rarity-frame', rarity: 'B' },
	{ jobId: 'rarity-frame-a-v7', role: 'rarity-frame', rarity: 'A' },
	{ jobId: 'rarity-frame-s-v7', role: 'rarity-frame', rarity: 'S' }
] as const;

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [currentX, currentY] = polygon[index]!;
		const [previousX, previousY] = polygon[previous]!;
		if (
			currentY !== previousY &&
			currentY > y !== previousY > y &&
			x < ((previousX - currentX) * (y - currentY)) / (previousY - currentY) + currentX
		) {
			inside = !inside;
		}
	}
	return inside;
}

function scaledPolygon(points: readonly Point[], width: number, height: number): readonly Point[] {
	return points.map(([x, y]) => [x * width, y * height] as const);
}

function cleanupPolygons(
	geometry: SkillIconGeometryV2,
	width: number,
	height: number
): {
	readonly outer: readonly Point[];
	readonly inner: readonly Point[];
	readonly medallion: readonly Point[];
} {
	const outer = scaledPolygon(geometry.outerEnvelopePoints, width, height);
	const center = {
		x: (geometry.center.x * width) / geometry.canvas.width,
		y: (geometry.center.y * height) / geometry.canvas.height
	};
	const inner = geometry.outerEnvelopePoints.map(
		([x, y]) =>
			[
				center.x + (x * width - center.x) * geometry.innerApertureScale,
				center.y + (y * height - center.y) * geometry.innerApertureScale
			] as const
	);
	return {
		outer,
		inner,
		medallion: scaledPolygon(geometry.rarityMedallionExclusion, width, height)
	};
}

async function rgbaBytes(bytes: Buffer): Promise<{
	readonly data: Buffer;
	readonly width: number;
	readonly height: number;
}> {
	const decoded = await sharp(bytes, { failOn: 'error' })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	return { data: decoded.data, width: decoded.info.width, height: decoded.info.height };
}

function assertCanvas(
	label: string,
	actual: { readonly width: number; readonly height: number },
	expected: { readonly width: number; readonly height: number }
): void {
	if (actual.width !== expected.width || actual.height !== expected.height) {
		throw new Error(
			`${label} dimensions must be ${expected.width}x${expected.height}; received ${actual.width}x${actual.height}`
		);
	}
}

async function encodeRgba(data: Buffer, width: number, height: number): Promise<Buffer> {
	return sharp(data, { raw: { width, height, channels: 4 } })
		.png(DETERMINISTIC_PNG_OPTIONS)
		.toBuffer();
}

export async function extractLegacyInterior(
	source: Buffer,
	geometryInput: SkillIconGeometryV2
): Promise<InteriorResult> {
	const geometry = SkillIconGeometryV2Schema.parse(geometryInput);
	const decoded = await rgbaBytes(source);
	assertCanvas('Legacy source', decoded, geometry.canvas);
	const { inner, medallion } = cleanupPolygons(geometry, decoded.width, decoded.height);
	const output = Buffer.from(decoded.data);
	let removedPixels = 0;
	let left = decoded.width;
	let top = decoded.height;
	let right = -1;
	let bottom = -1;
	for (let y = 0; y < decoded.height; y += 1) {
		for (let x = 0; x < decoded.width; x += 1) {
			const offset = (y * decoded.width + x) * 4;
			const allowed =
				pointInPolygon(x + 0.5, y + 0.5, inner) && !pointInPolygon(x + 0.5, y + 0.5, medallion);
			if (!allowed) {
				if ((output[offset + 3] ?? 0) > 0) {
					removedPixels += 1;
					left = Math.min(left, x);
					top = Math.min(top, y);
					right = Math.max(right, x);
					bottom = Math.max(bottom, y);
				}
				output.fill(0, offset, offset + 4);
			} else if ((output[offset + 3] ?? 0) === 0) {
				output.fill(0, offset, offset + 4);
			}
		}
	}
	return {
		bytes: await encodeRgba(output, decoded.width, decoded.height),
		removedPixels,
		removedPixelBounds:
			removedPixels === 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 }
	};
}

export async function composeCleanupIcon(input: {
	readonly backing: Buffer;
	readonly interior: Buffer;
	readonly frame: Buffer;
}): Promise<Buffer> {
	const [backing, interior, frame] = await Promise.all([
		rgbaBytes(input.backing),
		rgbaBytes(input.interior),
		rgbaBytes(input.frame)
	]);
	assertCanvas('Interior', interior, backing);
	assertCanvas('Frame', frame, backing);
	return sharp(backing.data, {
		raw: { width: backing.width, height: backing.height, channels: 4 }
	})
		.composite([
			{
				input: interior.data,
				raw: { width: backing.width, height: backing.height, channels: 4 },
				blend: 'over'
			},
			{
				input: frame.data,
				raw: { width: backing.width, height: backing.height, channels: 4 },
				blend: 'over'
			}
		])
		.png(DETERMINISTIC_PNG_OPTIONS)
		.toBuffer();
}

async function clearCleanupExterior(bytes: Buffer, geometry: SkillIconGeometryV2): Promise<Buffer> {
	const decoded = await rgbaBytes(bytes);
	assertCanvas('Cleanup composite', decoded, geometry.canvas);
	const { outer, medallion } = cleanupPolygons(geometry, decoded.width, decoded.height);
	const output = Buffer.from(decoded.data);
	for (let y = 0; y < decoded.height; y += 1) {
		for (let x = 0; x < decoded.width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			if (pointInPolygon(pixelX, pixelY, outer) || pointInPolygon(pixelX, pixelY, medallion)) {
				continue;
			}
			const offset = (y * decoded.width + x) * 4;
			output.fill(0, offset, offset + 4);
		}
	}
	return encodeRgba(output, decoded.width, decoded.height);
}

function nearWhiteComponents(
	data: Buffer,
	width: number,
	height: number
): CleanupInspection['nearWhiteComponents'] {
	const white = new Uint8Array(width * height);
	for (let index = 0; index < width * height; index += 1) {
		const offset = index * 4;
		if (
			(data[offset + 3] ?? 0) === 255 &&
			(data[offset] ?? 0) >= 245 &&
			(data[offset + 1] ?? 0) >= 245 &&
			(data[offset + 2] ?? 0) >= 245
		) {
			white[index] = 1;
		}
	}
	const components: { pixels: number; bounds: PixelBounds }[] = [];
	for (let start = 0; start < white.length; start += 1) {
		if (white[start] !== 1) continue;
		const queue = [start];
		white[start] = 2;
		let pixels = 0;
		let left = width;
		let top = height;
		let right = -1;
		let bottom = -1;
		for (let cursor = 0; cursor < queue.length; cursor += 1) {
			const current = queue[cursor]!;
			const x = current % width;
			const y = Math.floor(current / width);
			pixels += 1;
			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = Math.max(bottom, y);
			for (const [nextX, nextY] of [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1]
			] as const) {
				if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
				const next = nextY * width + nextX;
				if (white[next] !== 1) continue;
				white[next] = 2;
				queue.push(next);
			}
		}
		components.push({
			pixels,
			bounds: { left, top, width: right - left + 1, height: bottom - top + 1 }
		});
	}
	return components;
}

export async function inspectCleanupComposite(
	input: CleanupInspectionInput
): Promise<CleanupInspection> {
	const geometry = SkillIconGeometryV2Schema.parse(input.geometry);
	const expected = await clearCleanupExterior(await composeCleanupIcon(input), geometry);
	const emptyInterior = await encodeRgba(
		Buffer.alloc(geometry.canvas.width * geometry.canvas.height * 4),
		geometry.canvas.width,
		geometry.canvas.height
	);
	const protectedComposite = await clearCleanupExterior(
		await composeCleanupIcon({
			backing: input.backing,
			interior: emptyInterior,
			frame: input.frame
		}),
		geometry
	);
	const [actualRgba, protectedRgba] = await Promise.all([
		rgbaBytes(input.composite),
		rgbaBytes(protectedComposite)
	]);
	assertCanvas('Cleanup composite', actualRgba, geometry.canvas);
	assertCanvas('Protected composite', protectedRgba, geometry.canvas);
	const { outer, inner, medallion } = cleanupPolygons(
		geometry,
		geometry.canvas.width,
		geometry.canvas.height
	);
	let protectedBandMatches = true;
	let exteriorTransparent = true;
	for (let y = 0; y < geometry.canvas.height && protectedBandMatches; y += 1) {
		for (let x = 0; x < geometry.canvas.width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			const protectedPixel =
				(pointInPolygon(pixelX, pixelY, outer) && !pointInPolygon(pixelX, pixelY, inner)) ||
				pointInPolygon(pixelX, pixelY, medallion);
			if (!protectedPixel) continue;
			const offset = (y * geometry.canvas.width + x) * 4;
			if (
				!actualRgba.data
					.subarray(offset, offset + 4)
					.equals(protectedRgba.data.subarray(offset, offset + 4))
			) {
				protectedBandMatches = false;
				break;
			}
		}
	}
	for (let y = 0; y < geometry.canvas.height && exteriorTransparent; y += 1) {
		for (let x = 0; x < geometry.canvas.width; x += 1) {
			const pixelX = x + 0.5;
			const pixelY = y + 0.5;
			if (pointInPolygon(pixelX, pixelY, outer) || pointInPolygon(pixelX, pixelY, medallion)) {
				continue;
			}
			if ((actualRgba.data[(y * geometry.canvas.width + x) * 4 + 3] ?? 0) !== 0) {
				exteriorTransparent = false;
				break;
			}
		}
	}
	const components = nearWhiteComponents(
		actualRgba.data,
		geometry.canvas.width,
		geometry.canvas.height
	);
	return {
		layerHashesMatch:
			input.boundLayerHashes === undefined ||
			(input.boundLayerHashes.backing === sha256(input.backing) &&
				input.boundLayerHashes.interior === sha256(input.interior) &&
				input.boundLayerHashes.frame === sha256(input.frame)),
		exactComposite: input.composite.equals(expected),
		protectedBandMatches,
		exteriorTransparent,
		nearWhiteComponents: components,
		warnings: components.map(
			(component) =>
				`Opaque near-white component: ${component.pixels} pixels at ${component.bounds.left},${component.bounds.top} ${component.bounds.width}x${component.bounds.height}`
		)
	};
}

function cleanupLayerPaths(jobId: string): {
	readonly candidate: string;
	readonly result: string;
} {
	return {
		candidate: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
		result: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
	};
}

async function existingCleanupLayer(
	root: string,
	job: (typeof CLEANUP_LAYER_JOBS)[number]
): Promise<null | {
	readonly path: string;
	readonly bytes: Buffer;
	readonly contentHash: string;
}> {
	const paths = cleanupLayerPaths(job.jobId);
	const [candidate, resultBytes] = await Promise.all([
		currentBytes(root, paths.candidate),
		currentBytes(root, paths.result)
	]);
	if (!candidate || !resultBytes) return null;
	const result = JSON.parse(resultBytes.toString('utf8')) as {
		readonly jobId?: unknown;
		readonly role?: unknown;
		readonly rarity?: unknown;
		readonly status?: unknown;
		readonly output?: { readonly path?: unknown; readonly contentHash?: unknown };
	};
	const contentHash = sha256(candidate);
	if (
		result.jobId !== job.jobId ||
		result.role !== job.role ||
		result.rarity !== job.rarity ||
		result.status !== 'candidate' ||
		result.output?.path !== paths.candidate ||
		result.output.contentHash !== contentHash
	) {
		throw new Error(`Cleanup shared-layer result does not bind candidate bytes: ${job.jobId}`);
	}
	return { path: paths.candidate, bytes: candidate, contentHash };
}

function cleanupInteriorPath(targetId: string): string {
	return `${QUALITY_CLEANUP_ROOT}/interiors/${cleanupSlug(targetId)}.png`;
}

async function assertCleanupAuthorities(root: string, authority: CleanupAuthority): Promise<void> {
	for (const [key, binding] of Object.entries(authority)) {
		const bytes = await regularBytes(root, binding.path);
		if (sha256(bytes) !== binding.contentHash) {
			throw new Error(`Cleanup authority hash drift: ${key}`);
		}
	}
}

function assertFinalizePathCoverage(manifest: SkillIconCleanupManifest): readonly string[] {
	const owners = new Map<string, string>();
	for (const record of manifest.records) {
		for (const [kind, repositoryPath] of [
			['interior', cleanupInteriorPath(record.targetId)],
			['composite', record.cleanupCompositePath],
			['result', record.resultPath]
		] as const) {
			const prior = owners.get(repositoryPath);
			if (prior) {
				throw new Error(
					`Cleanup finalize output collision: ${repositoryPath} (${prior}, ${record.targetId}:${kind})`
				);
			}
			owners.set(repositoryPath, `${record.targetId}:${kind}`);
		}
	}
	for (const record of manifest.records) {
		if (owners.has(record.sourceCandidate.path)) {
			throw new Error(`Cleanup finalize output collides with frozen source: ${record.targetId}`);
		}
	}
	return Array.from(owners.keys());
}

async function assertSafeFinalizeDestinations(
	root: string,
	repositoryPaths: readonly string[]
): Promise<void> {
	const rootRealPath = await realpath(root);
	const parentPaths = new Set<string>();
	for (const repositoryPath of repositoryPaths) {
		const absolutePath = path.resolve(root, repositoryPath);
		if (!isInside(rootRealPath, absolutePath)) {
			throw new Error(
				`Cleanup artifact path resolves outside the repository root: ${repositoryPath}`
			);
		}
		parentPaths.add(path.dirname(absolutePath));
		const leaf = await lstat(absolutePath).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (leaf && (!leaf.isFile() || leaf.isSymbolicLink())) {
			throw new Error(`Refusing symbolic-link or non-regular cleanup artifact: ${repositoryPath}`);
		}
	}
	for (const parentPath of parentPaths) {
		let current = parentPath;
		while (current !== rootRealPath) {
			if (!isInside(rootRealPath, current)) {
				throw new Error('Cleanup artifact parent resolves outside the repository root');
			}
			const metadata = await lstat(current).catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			});
			if (metadata?.isSymbolicLink()) {
				throw new Error(`Cleanup artifact parent contains symbolic link: ${current}`);
			}
			if (metadata && !metadata.isDirectory()) {
				throw new Error(`Cleanup artifact parent is not a directory: ${current}`);
			}
			if (metadata && !isInside(rootRealPath, await realpath(current))) {
				throw new Error(`Cleanup artifact parent resolves outside the repository root: ${current}`);
			}
			const next = path.dirname(current);
			if (next === current) {
				throw new Error('Cleanup artifact parent traversal escaped the repository root');
			}
			current = next;
		}
	}
}

export async function finalizeSkillIconQualityCleanup(options: {
	readonly root?: string;
	readonly mode: 'write' | 'check';
}): Promise<CleanupFinalizeReport> {
	const root = path.resolve(options.root ?? process.cwd());
	const manifestBytes = await regularBytes(root, MANIFEST_PATH);
	const manifest = SkillIconCleanupManifestSchema.parse(
		JSON.parse(manifestBytes.toString('utf8')) as unknown
	);
	const layers = await Promise.all(
		CLEANUP_LAYER_JOBS.map(async (job) => ({ job, layer: await existingCleanupLayer(root, job) }))
	);
	const pendingLayerJobIds = layers
		.filter((entry) => entry.layer === null)
		.map((entry) => entry.job.jobId);
	if (pendingLayerJobIds.length > 0) {
		return {
			mode: options.mode,
			ready: false,
			total: manifest.records.length,
			finalized: 0,
			pendingLayerJobIds,
			written: [],
			drifted: [],
			warnings: []
		};
	}
	await assertCleanupAuthorities(root, manifest.authority);
	const geometryBytes = await regularBytes(root, manifest.authority.geometry.path);
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(geometryBytes.toString('utf8')) as unknown
	);
	const backing = layers.find(({ job }) => job.role === 'backing')!.layer!;
	const frames = new Map(
		layers
			.filter(({ job }) => job.role === 'rarity-frame')
			.map(({ job, layer }) => [job.rarity, layer!] as const)
	);
	const finalizePaths = assertFinalizePathCoverage(manifest);
	await assertSafeFinalizeDestinations(root, finalizePaths);
	for (const record of manifest.records) {
		const source = await regularBytes(root, record.sourceCandidate.path);
		if (sha256(source) !== record.sourceCandidate.contentHash) {
			throw new Error(`Frozen cleanup source hash drift: ${record.targetId}`);
		}
	}
	const written: string[] = [];
	const drifted: string[] = [];
	const warnings: string[] = [];
	let finalized = 0;
	const stageRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-cleanup-finalize-'));
	const staged: { readonly repositoryPath: string; readonly absolutePath: string }[] = [];
	const visualCache = new Map<
		string,
		{
			readonly interior: InteriorResult;
			readonly composite: Buffer;
			readonly inspection: CleanupInspection;
		}
	>();
	const visualUseCounts = new Map<string, number>();
	for (const record of manifest.records) {
		const key = `${record.sourceCandidate.contentHash}:${record.rank}`;
		visualUseCounts.set(key, (visualUseCounts.get(key) ?? 0) + 1);
	}
	try {
		for (const record of manifest.records) {
			const frame = frames.get(record.rank);
			if (!frame) throw new Error(`Missing cleanup frame for rank ${record.rank}`);
			const cacheKey = `${record.sourceCandidate.contentHash}:${record.rank}`;
			let visual = visualCache.get(cacheKey);
			if (!visual) {
				const source = await regularBytes(root, record.sourceCandidate.path);
				if (sha256(source) !== record.sourceCandidate.contentHash) {
					throw new Error(`Frozen cleanup source hash drift: ${record.targetId}`);
				}
				const interior = await extractLegacyInterior(source, geometry);
				const composite = await clearCleanupExterior(
					await composeCleanupIcon({
						backing: backing.bytes,
						interior: interior.bytes,
						frame: frame.bytes
					}),
					geometry
				);
				const inspection = await inspectCleanupComposite({
					composite,
					backing: backing.bytes,
					interior: interior.bytes,
					frame: frame.bytes,
					geometry,
					boundLayerHashes: {
						backing: backing.contentHash,
						interior: sha256(interior.bytes),
						frame: frame.contentHash
					}
				});
				visual = { interior, composite, inspection };
				if ((visualUseCounts.get(cacheKey) ?? 0) > 1) visualCache.set(cacheKey, visual);
			}
			if (
				!visual.inspection.layerHashesMatch ||
				!visual.inspection.exactComposite ||
				!visual.inspection.protectedBandMatches ||
				!visual.inspection.exteriorTransparent
			) {
				throw new Error(`Cleanup composite inspection failed: ${record.targetId}`);
			}
			warnings.push(
				...visual.inspection.warnings.map((warning) => `${record.targetId}: ${warning}`)
			);
			const interiorPath = cleanupInteriorPath(record.targetId);
			const interiorHash = sha256(visual.interior.bytes);
			const binding = {
				source: record.sourceCandidate.contentHash,
				geometry: manifest.authority.geometry.contentHash,
				backing: backing.contentHash,
				interior: interiorHash,
				frame: frame.contentHash,
				removedPixels: visual.interior.removedPixels,
				removedPixelBounds: visual.interior.removedPixelBounds
			};
			const result = SkillIconCleanupResultSchema.parse({
				schemaVersion: 'skill-icon-quality-cleanup-result-v1',
				...record,
				cleanupInterior: {
					path: interiorPath,
					contentHash: interiorHash,
					removedPixels: visual.interior.removedPixels,
					removedPixelBounds: visual.interior.removedPixelBounds
				},
				compositionAuthority: {
					geometry: manifest.authority.geometry,
					backing: { path: backing.path, contentHash: backing.contentHash },
					frame: { path: frame.path, contentHash: frame.contentHash }
				},
				cleanupCompositeContentHash: sha256(visual.composite),
				resultContentHash: sha256(jsonBytes(binding))
			});
			for (const output of [
				{ path: interiorPath, bytes: visual.interior.bytes },
				{ path: record.cleanupCompositePath, bytes: visual.composite },
				{ path: record.resultPath, bytes: jsonBytes(result) }
			]) {
				const current = await currentBytes(root, output.path);
				if (current?.equals(output.bytes)) continue;
				if (current) {
					drifted.push(output.path);
					continue;
				}
				if (options.mode === 'check') {
					drifted.push(output.path);
					continue;
				}
				const absolutePath = path.join(stageRoot, `${staged.length}.artifact`);
				await writeFile(absolutePath, output.bytes);
				staged.push({ repositoryPath: output.path, absolutePath });
			}
			finalized += 1;
		}
		if (options.mode === 'write' && drifted.length > 0) {
			throw new Error(`Refusing to replace drifted cleanup artifact: ${drifted[0]}`);
		}
		if (options.mode === 'write') {
			for (const output of staged) {
				if (
					await writeMissingAtomic(root, output.repositoryPath, await readFile(output.absolutePath))
				) {
					written.push(output.repositoryPath);
				}
			}
		}
		return {
			mode: options.mode,
			ready: true,
			total: manifest.records.length,
			finalized,
			pendingLayerJobIds: [],
			written,
			drifted,
			warnings
		};
	} finally {
		await rm(stageRoot, { recursive: true, force: true });
	}
}
