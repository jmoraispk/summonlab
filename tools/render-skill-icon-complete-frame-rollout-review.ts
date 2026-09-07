import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import {
	SkillIconCatalogSchema,
	SkillIconCleanupManifestSchema,
	SkillIconCleanupResultSchema
} from '../packages/contracts/src/index.js';
import { adoptCompleteRankFrameForReview } from './render-skill-icon-badge-tip-review.js';
import {
	clearCleanupExterior,
	composeCleanupIcon,
	extractLegacyInterior,
	inspectCleanupComposite
} from './skill-icon-quality-cleanup-lib.js';

type Mode = 'write' | 'check';
type Rank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

const ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const CLEANUP_ROOT = `${ROOT}/quality-cleanup-v1` as const;
const REVIEW_ROOT = `${CLEANUP_ROOT}/review/v9-complete-frame-rollout` as const;
const CATALOG_ROOT = `${REVIEW_ROOT}/catalog` as const;
const MANIFEST_PATH = `${CLEANUP_ROOT}/manifest.json` as const;
const CATALOG_PATH = `${ROOT}/catalog.json` as const;
const GEOMETRY_PATH = `${ROOT}/geometry-v2.json` as const;
const BACKING_PATH = `${ROOT}/candidates/references/charcoal-forged-stone-v6.png` as const;
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
const PAGE_SIZE = 24;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;
const PROVIDER_SOURCE_BY_RANK: Readonly<Record<Rank, string>> = {
	F: `${CLEANUP_ROOT}/provider-sources/rarity-frame-f-v10-complete-source.png`,
	E: `${CLEANUP_ROOT}/provider-sources/rarity-frame-e-v10-complete-source.png`,
	D: `${CLEANUP_ROOT}/provider-sources/rarity-frame-d-v10-complete-source.png`,
	C: `${CLEANUP_ROOT}/provider-sources/rarity-frame-c-v10-complete-source.png`,
	B: `${CLEANUP_ROOT}/provider-sources/rarity-frame-b-v10-complete-source.png`,
	A: `${CLEANUP_ROOT}/provider-sources/rarity-frame-a-v10-complete-source.png`,
	S: `${CLEANUP_ROOT}/provider-sources/rarity-frame-s-v10-badge-tip-source.png`
};

interface RenderedRecord {
	readonly targetId: string;
	readonly name: string;
	readonly rank: Rank;
	readonly currentPath: string;
	readonly currentHash: string;
	readonly interiorPath: string;
	readonly sourceInteriorHash: string;
	readonly interiorHash: string;
	readonly candidate: Buffer;
	readonly candidateHash: string;
	readonly inspection: {
		readonly layerHashesMatch: boolean;
		readonly exactComposite: boolean;
		readonly protectedBandMatches: boolean;
		readonly exteriorTransparent: boolean;
		readonly backingOnlyComponents: readonly unknown[];
	};
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function concise(value: string, limit = 31): string {
	return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

async function regularBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolutePath = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolutePath);
	if (relative.startsWith(`..${path.sep}`) || relative === '..')
		throw new Error(`Complete-frame input escapes the repository: ${repositoryPath}`);
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Complete-frame input is not a regular file: ${repositoryPath}`);
	return readFile(absolutePath);
}

async function writeAtomic(destination: string, bytes: Buffer): Promise<void> {
	await mkdir(path.dirname(destination), { recursive: true });
	const stage = `${destination}.stage-${process.pid}-${randomUUID()}`;
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(stage, 'wx');
		await handle.writeFile(bytes);
		await handle.sync();
		await handle.close();
		handle = null;
		await rename(stage, destination);
	} catch (error) {
		await handle?.close().catch(() => undefined);
		await unlink(stage).catch(() => undefined);
		throw error;
	}
}

async function syncCreateOnly(
	repositoryRoot: string,
	repositoryPath: string,
	bytes: Buffer,
	mode: Mode
): Promise<boolean> {
	const destination = path.resolve(repositoryRoot, repositoryPath);
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return false;
	if (current !== null) throw new Error(`Refusing complete-frame review drift: ${repositoryPath}`);
	if (mode === 'check')
		throw new Error(`Missing complete-frame review artifact: ${repositoryPath}`);
	await writeAtomic(destination, bytes);
	return true;
}

async function assertExactInventory(
	repositoryRoot: string,
	repositoryDirectory: string,
	expectedNames: readonly string[]
): Promise<void> {
	const directory = path.resolve(repositoryRoot, repositoryDirectory);
	const actual = await readdir(directory).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return [] as string[];
		throw error;
	});
	const expected = new Set(expectedNames);
	if (actual.length !== expected.size || actual.some((name) => !expected.has(name)))
		throw new Error(`Unexpected complete-frame review inventory: ${repositoryDirectory}`);
}

function textLayer(
	width: number,
	height: number,
	lines: readonly {
		readonly text: string;
		readonly x: number;
		readonly y: number;
		readonly size: number;
		readonly fill?: string;
		readonly anchor?: 'start' | 'middle';
		readonly weight?: number;
	}[]
): Buffer {
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines
			.map(
				(line) =>
					`<text x="${line.x}" y="${line.y}" text-anchor="${line.anchor ?? 'middle'}" font-family="sans-serif" font-size="${line.size}" font-weight="${line.weight ?? 400}" fill="${line.fill ?? '#f3ead8'}">${escapeXml(line.text)}</text>`
			)
			.join('')}</svg>`
	);
}

async function catalogPage(page: number, records: readonly RenderedRecord[]): Promise<Buffer> {
	const columns = 6;
	const cellWidth = 520;
	const cellHeight = 336;
	const header = 76;
	const width = columns * cellWidth;
	const height = header + 4 * cellHeight;
	const iconSize = 240;
	const overlays: OverlayOptions[] = [];
	const labels: {
		text: string;
		x: number;
		y: number;
		size: number;
		fill?: string;
		anchor?: 'start' | 'middle';
		weight?: number;
	}[] = [
		{
			text: `Complete Frame Rollout · All Skills · Page ${String(page).padStart(2, '0')}`,
			x: width / 2,
			y: 48,
			size: 30,
			weight: 700
		}
	];
	for (const [index, record] of records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cellWidth;
		const top = header + row * cellHeight;
		const [current, candidate] = await Promise.all([
			sharp(await readFile(record.currentPath))
				.resize(iconSize, iconSize)
				.png(PNG_OPTIONS)
				.toBuffer(),
			sharp(record.candidate).resize(iconSize, iconSize).png(PNG_OPTIONS).toBuffer()
		]);
		overlays.push(
			{ input: current, left: left + 10, top: top + 28 },
			{ input: candidate, left: left + 270, top: top + 28 }
		);
		labels.push(
			{ text: 'CURRENT', x: left + 130, y: top + 20, size: 12, fill: '#9aa3b1' },
			{ text: 'COMPLETE FRAME', x: left + 390, y: top + 20, size: 12, fill: '#79c49b' },
			{
				text: `${concise(record.name)} · ${record.rank}`,
				x: left + 12,
				y: top + 295,
				size: 17,
				anchor: 'start',
				weight: 700
			},
			{
				text: concise(record.targetId, 50),
				x: left + 12,
				y: top + 319,
				size: 12,
				anchor: 'start',
				fill: '#aeb8c7'
			}
		);
	}
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

async function frameSheet(input: {
	readonly currentFrames: Readonly<Record<Rank, Buffer>>;
	readonly completeFrames: Readonly<Record<Rank, Buffer>>;
}): Promise<Buffer> {
	const iconSize = 384;
	const gap = 24;
	const header = 64;
	const caption = 42;
	const width = iconSize * 2 + gap;
	const height = header + RANKS.length * (iconSize + caption);
	const overlays: OverlayOptions[] = [];
	const labels: {
		text: string;
		x: number;
		y: number;
		size: number;
		fill?: string;
		weight?: number;
	}[] = [
		{ text: 'CLIPPED · V9', x: iconSize / 2, y: 42, size: 20, fill: '#9aa3b1', weight: 700 },
		{
			text: 'COMPLETE FRAME · V11',
			x: iconSize + gap + iconSize / 2,
			y: 42,
			size: 20,
			fill: '#79c49b',
			weight: 700
		}
	];
	for (const [index, rank] of RANKS.entries()) {
		const top = header + index * (iconSize + caption);
		const [current, complete] = await Promise.all([
			sharp(input.currentFrames[rank]).resize(iconSize, iconSize).png(PNG_OPTIONS).toBuffer(),
			sharp(input.completeFrames[rank]).resize(iconSize, iconSize).png(PNG_OPTIONS).toBuffer()
		]);
		overlays.push({ input: current, left: 0, top }, { input: complete, left: iconSize + gap, top });
		labels.push({
			text: `${rank} rank`,
			x: width / 2,
			y: top + iconSize + 27,
			size: 18,
			weight: 700
		});
	}
	overlays.push({ input: textLayer(width, height, labels), left: 0, top: 0 });
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

function reviewIndex(pageCount: number): Buffer {
	const pageLinks = Array.from({ length: pageCount }, (_, index) => {
		const name = `page-${String(index + 1).padStart(2, '0')}.png`;
		return `<a href="catalog/${name}"><img loading="lazy" src="catalog/${name}" alt="Catalog ${index + 1}"></a>`;
	}).join('\n');
	return Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Complete frame rollout review</title><style>body{margin:0;background:#090d12;color:#f3ead8;font-family:sans-serif}main{max-width:1500px;margin:auto;padding:24px}h1,p{text-align:center}img{display:block;width:100%;height:auto;margin:24px 0;border:1px solid #343b47}a{color:#79c49b}</style></head>
<body><main><h1>Complete frame rollout · 456 skills</h1><p>Frame repair only. Internal legacy-frame traces are intentionally deferred.</p><img src="frames-all-ranks.png" alt="All seven repaired frames">${pageLinks}</main></body></html>\n`);
}

export async function renderSkillIconCompleteFrameRolloutReview(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<{ readonly written: readonly string[]; readonly reviewFiles: readonly string[] }> {
	const repositoryRoot = path.resolve(options.root ?? process.cwd());
	const [manifestBytes, catalogBytes, geometryBytes, backing] = await Promise.all([
		regularBytes(repositoryRoot, MANIFEST_PATH),
		regularBytes(repositoryRoot, CATALOG_PATH),
		regularBytes(repositoryRoot, GEOMETRY_PATH),
		regularBytes(repositoryRoot, BACKING_PATH)
	]);
	const manifest = SkillIconCleanupManifestSchema.parse(
		JSON.parse(manifestBytes.toString('utf8')) as unknown
	);
	const catalog = SkillIconCatalogSchema.parse(
		JSON.parse(catalogBytes.toString('utf8')) as unknown
	);
	if (manifest.records.length !== 456 || catalog.records.length !== 456)
		throw new Error('Complete-frame rollout requires the complete 456-skill catalog');
	const geometry = JSON.parse(geometryBytes.toString('utf8'));
	const catalogByTarget = new Map(catalog.records.map((record) => [record.targetId, record]));
	const backingHash = sha256(backing);
	const completeFrames = {} as Record<Rank, Buffer>;
	const currentFrames = {} as Record<Rank, Buffer>;
	const frameAudits = [];
	for (const rank of RANKS) {
		const providerPath = PROVIDER_SOURCE_BY_RANK[rank];
		const currentPath = `${ROOT}/candidates/references/rarity-frame-${rank.toLowerCase()}-v9.png`;
		const [providerSource, currentFrame] = await Promise.all([
			regularBytes(repositoryRoot, providerPath),
			regularBytes(repositoryRoot, currentPath)
		]);
		const adopted = await adoptCompleteRankFrameForReview({ rank, providerSource });
		if (
			adopted.audit.centerBadgePixelsBelowLegacyCutoff === 0 ||
			adopted.audit.lowestCenterBadgeRow === null
		)
			throw new Error(`Complete ${rank} frame still ends at the legacy badge cutoff`);
		completeFrames[rank] = adopted.bytes;
		currentFrames[rank] = currentFrame;
		frameAudits.push({
			rank,
			providerSource: { path: providerPath, contentHash: sha256(providerSource) },
			rejectedFrame: { path: currentPath, contentHash: sha256(currentFrame) },
			completeFrame: {
				path: `${REVIEW_ROOT}/frames/rarity-frame-${rank.toLowerCase()}-v11-review.png`,
				contentHash: sha256(adopted.bytes)
			},
			audit: adopted.audit
		});
	}

	const rendered: RenderedRecord[] = [];
	for (const manifestRecord of manifest.records) {
		const rank = manifestRecord.rank as Rank;
		if (!RANKS.includes(rank)) throw new Error(`Unexpected rank: ${manifestRecord.rank}`);
		const catalogRecord = catalogByTarget.get(manifestRecord.targetId);
		if (!catalogRecord || catalogRecord.rarity !== rank)
			throw new Error(`Catalog binding drift for ${manifestRecord.targetId}`);
		const result = SkillIconCleanupResultSchema.parse(
			JSON.parse(
				(await regularBytes(repositoryRoot, manifestRecord.resultPath)).toString('utf8')
			) as unknown
		);
		const [current, sourceInterior] = await Promise.all([
			regularBytes(repositoryRoot, manifestRecord.cleanupCompositePath),
			regularBytes(repositoryRoot, result.cleanupInterior.path)
		]);
		if (sha256(sourceInterior) !== result.cleanupInterior.contentHash)
			throw new Error(`Frozen cleanup interior hash mismatch for ${manifestRecord.targetId}`);
		const frame = completeFrames[rank];
		const frameHash = sha256(frame);
		const interior = await extractLegacyInterior(sourceInterior, geometry, {
			frame,
			artworkScale: 1
		});
		const candidate = await clearCleanupExterior(
			await composeCleanupIcon({
				backing,
				interior: interior.bytes,
				frame,
				compositionProfile: 'frame-opening-v3'
			}),
			geometry
		);
		const inspection = await inspectCleanupComposite({
			composite: candidate,
			backing,
			interior: interior.bytes,
			frame,
			geometry,
			compositionProfile: 'frame-opening-v3',
			boundLayerHashes: {
				backing: backingHash,
				interior: sha256(interior.bytes),
				frame: frameHash
			}
		});
		if (
			!inspection.layerHashesMatch ||
			!inspection.exactComposite ||
			!inspection.protectedBandMatches ||
			!inspection.exteriorTransparent ||
			inspection.backingOnlyComponents.length > 0
		)
			throw new Error(
				`Complete-frame inspection failed for ${manifestRecord.targetId}: ${JSON.stringify({
					layerHashesMatch: inspection.layerHashesMatch,
					exactComposite: inspection.exactComposite,
					protectedBandMatches: inspection.protectedBandMatches,
					exteriorTransparent: inspection.exteriorTransparent,
					backingOnlyComponents: inspection.backingOnlyComponents.length
				})}`
			);
		rendered.push({
			targetId: manifestRecord.targetId,
			name: catalogRecord.name,
			rank,
			currentPath: path.resolve(repositoryRoot, manifestRecord.cleanupCompositePath),
			currentHash: sha256(current),
			interiorPath: result.cleanupInterior.path,
			sourceInteriorHash: sha256(sourceInterior),
			interiorHash: sha256(interior.bytes),
			candidate,
			candidateHash: sha256(candidate),
			inspection
		});
	}
	if (new Set(rendered.map((record) => record.targetId)).size !== 456)
		throw new Error('Complete-frame rollout target inventory is incomplete');

	const outputs: { path: string; bytes: Buffer }[] = [];
	for (const rank of RANKS)
		outputs.push({
			path: `${REVIEW_ROOT}/frames/rarity-frame-${rank.toLowerCase()}-v11-review.png`,
			bytes: completeFrames[rank]
		});
	outputs.push({
		path: `${REVIEW_ROOT}/frames-all-ranks.png`,
		bytes: await frameSheet({ currentFrames, completeFrames })
	});
	for (let offset = 0, page = 1; offset < rendered.length; offset += PAGE_SIZE, page += 1)
		outputs.push({
			path: `${CATALOG_ROOT}/page-${String(page).padStart(2, '0')}.png`,
			bytes: await catalogPage(page, rendered.slice(offset, offset + PAGE_SIZE))
		});
	const pageCount = Math.ceil(rendered.length / PAGE_SIZE);
	outputs.push({ path: `${REVIEW_ROOT}/index.html`, bytes: reviewIndex(pageCount) });
	outputs.push({
		path: `${REVIEW_ROOT}/report.json`,
		bytes: jsonBytes({
			schemaVersion: 'skill-icon-complete-frame-rollout-review-v1',
			status: 'review-only-not-promoted',
			decision: 'replace-clipped-v9-frame-as-a-whole-for-every-rank',
			scope: { ranks: RANKS, skills: rendered.length, catalogPages: pageCount },
			assembly: {
				mode: 'canonical-backing-existing-cleanup-interior-complete-generated-frame',
				frameIsFinalLayer: true,
				v9PixelsMergedIntoFrame: false,
				compositionProfile: 'frame-opening-v3'
			},
			deferred: [
				{
					finding: 'traces-of-previous-frame-inside-accepted-frame',
					status: 'deferred-by-owner',
					note: 'Existing cleanup interiors are intentionally unchanged in this review.'
				}
			],
			backing: { path: BACKING_PATH, contentHash: backingHash },
			geometry: { path: GEOMETRY_PATH, contentHash: sha256(geometryBytes) },
			frameAudits,
			records: rendered.map(({ candidate: _candidate, currentPath, inspection, ...record }) => ({
				...record,
				currentPath: path.relative(repositoryRoot, currentPath),
				inspection: {
					layerHashesMatch: inspection.layerHashesMatch,
					exactComposite: inspection.exactComposite,
					protectedBandMatches: inspection.protectedBandMatches,
					exteriorTransparent: inspection.exteriorTransparent,
					backingOnlyComponents: inspection.backingOnlyComponents
				}
			}))
		})
	});

	const written: string[] = [];
	for (const output of outputs)
		if (await syncCreateOnly(repositoryRoot, output.path, output.bytes, options.mode))
			written.push(output.path);
	await assertExactInventory(
		repositoryRoot,
		CATALOG_ROOT,
		Array.from(
			{ length: pageCount },
			(_, index) => `page-${String(index + 1).padStart(2, '0')}.png`
		)
	);
	await assertExactInventory(repositoryRoot, `${REVIEW_ROOT}/frames`, [
		...RANKS.map((rank) => `rarity-frame-${rank.toLowerCase()}-v11-review.png`)
	]);
	return {
		written,
		reviewFiles: outputs.map((output) => output.path)
	};
}

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? ''))
		throw new Error(
			'Usage: tsx tools/render-skill-icon-complete-frame-rollout-review.ts --write|--check'
		);
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
	const mode = parseMode(process.argv.slice(2));
	const result = await renderSkillIconCompleteFrameRolloutReview({ mode });
	// eslint-disable-next-line no-console
	console.log(
		`${mode}: ${result.reviewFiles.length} review files; ${result.written.length} written`
	);
}
