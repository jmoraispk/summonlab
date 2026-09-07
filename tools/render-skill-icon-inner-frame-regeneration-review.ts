import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import { buildSkillIconInnerFrameRegenerationJobs } from './skill-icon-inner-frame-regeneration.js';
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
const FRAME_ROOT = `${CLEANUP_ROOT}/review/v9-complete-frame-rollout/frames` as const;
const REVIEW_ROOT = `${CLEANUP_ROOT}/review/v11-inner-frame-regeneration` as const;
const CANDIDATE_ROOT = `${REVIEW_ROOT}/candidates` as const;
const COMPARISON_ROOT = `${REVIEW_ROOT}/comparison` as const;
const GEOMETRY_PATH = `${ROOT}/geometry-v2.json` as const;
const BACKING_PATH = `${ROOT}/candidates/references/charcoal-forged-stone-v6.png` as const;
const PAGE_SIZE = 6;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;

interface InspectionSummary {
	readonly layerHashesMatch: boolean;
	readonly exactComposite: boolean;
	readonly protectedBandMatches: boolean;
	readonly exteriorTransparent: boolean;
	readonly backingOnlyComponents: readonly unknown[];
}

interface RenderedRecord {
	readonly targetId: string;
	readonly slug: string;
	readonly name: string;
	readonly rank: Rank;
	readonly currentPath: string;
	readonly currentHash: string;
	readonly referencePath: string;
	readonly referenceHash: string;
	readonly sourcePath: string;
	readonly source: {
		readonly width: number;
		readonly height: number;
		readonly alphaMode: 'rgb';
		readonly contentHash: string;
	};
	readonly exactPrompt: string;
	readonly generationAttempts: readonly {
		readonly path: string;
		readonly prompt: string;
		readonly status: 'accepted' | 'rejected';
		readonly reason?: 'faux-text-or-ui-artifact';
		readonly contentHash: string;
	}[];
	readonly interiorHash: string;
	readonly framePath: string;
	readonly frameHash: string;
	readonly candidatePath: string;
	readonly candidateHash: string;
	readonly inspection: InspectionSummary;
	readonly current: Buffer;
	readonly candidate: Buffer;
}

interface TextLine {
	readonly text: string;
	readonly x: number;
	readonly y: number;
	readonly size: number;
	readonly fill?: string;
	readonly anchor?: 'start' | 'middle';
	readonly weight?: number;
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
	const absolute = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolute);
	if (relative === '..' || relative.startsWith(`..${path.sep}`))
		throw new Error(`Inner-frame regeneration input escapes repository: ${repositoryPath}`);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Inner-frame regeneration input is not a regular file: ${repositoryPath}`);
	return readFile(absolute);
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
	if (current !== null) throw new Error(`Refusing regeneration-review drift: ${repositoryPath}`);
	if (mode === 'check') throw new Error(`Missing regeneration-review artifact: ${repositoryPath}`);
	await writeAtomic(destination, bytes);
	return true;
}

function textLayer(width: number, height: number, lines: readonly TextLine[]): Buffer {
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines
			.map(
				(line) =>
					`<text x="${line.x}" y="${line.y}" text-anchor="${line.anchor ?? 'middle'}" font-family="sans-serif" font-size="${line.size}" font-weight="${line.weight ?? 400}" fill="${line.fill ?? '#f3ead8'}">${escapeXml(line.text)}</text>`
			)
			.join('')}</svg>`
	);
}

async function comparisonPage(page: number, records: readonly RenderedRecord[]): Promise<Buffer> {
	const columns = 2;
	const cellWidth = 720;
	const cellHeight = 410;
	const header = 68;
	const iconSize = 300;
	const width = columns * cellWidth;
	const height = header + Math.ceil(records.length / columns) * cellHeight;
	const overlays: OverlayOptions[] = [];
	const labels: TextLine[] = [
		{
			text: `FRAMELESS REGENERATION · PAGE ${page}`,
			x: width / 2,
			y: 43,
			size: 27,
			weight: 700
		}
	];
	for (const [index, record] of records.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		const left = column * cellWidth;
		const top = header + row * cellHeight;
		const [current, candidate] = await Promise.all([
			sharp(record.current)
				.flatten({ background: '#090d12' })
				.resize(iconSize, iconSize)
				.png(PNG_OPTIONS)
				.toBuffer(),
			sharp(record.candidate)
				.flatten({ background: '#090d12' })
				.resize(iconSize, iconSize)
				.png(PNG_OPTIONS)
				.toBuffer()
		]);
		overlays.push(
			{ input: current, left: left + 18, top: top + 28 },
			{ input: candidate, left: left + 402, top: top + 28 }
		);
		labels.push(
			{ text: 'CURRENT', x: left + 168, y: top + 20, size: 13, fill: '#9aa3b1' },
			{ text: 'REGENERATED', x: left + 552, y: top + 20, size: 13, fill: '#79c49b' },
			{
				text: `${concise(record.name)} · ${record.rank}`,
				x: left + 18,
				y: top + 358,
				size: 19,
				anchor: 'start',
				weight: 700
			},
			{
				text: concise(record.targetId, 54),
				x: left + 18,
				y: top + 385,
				size: 12,
				anchor: 'start',
				fill: '#8f9bad'
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

function reviewIndex(pageCount: number): Buffer {
	const pages = Array.from({ length: pageCount }, (_, index) => {
		const name = `page-${String(index + 1).padStart(2, '0')}.png`;
		return `<a href="comparison/${name}"><img loading="lazy" src="comparison/${name}" alt="Regeneration comparison ${index + 1}"></a>`;
	}).join('\n');
	return Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Inner-frame regeneration review</title><style>body{margin:0;background:#090d12;color:#f3ead8;font-family:sans-serif}main{max-width:1500px;margin:auto;padding:24px}h1,p{text-align:center}strong{color:#79c49b}img{display:block;width:100%;height:auto;margin:24px 0;border:1px solid #343b47}</style></head>
<body><main><h1>Inner-frame regeneration · 23 skills</h1><p><strong>Review only:</strong> regenerated frameless art beneath the canonical backing and complete rank frame. The five borderline cases remain untouched.</p><p>The complete frame is the final compositing layer in every candidate. No production icon is promoted by this review.</p>${pages}</main></body></html>\n`);
}

async function assertExactInventory(
	repositoryRoot: string,
	repositoryDirectory: string,
	expectedNames: readonly string[]
): Promise<void> {
	const actual = await readdir(path.resolve(repositoryRoot, repositoryDirectory)).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return [] as string[];
			throw error;
		}
	);
	const expected = new Set(expectedNames);
	if (actual.length !== expected.size || actual.some((name) => !expected.has(name)))
		throw new Error(`Unexpected regeneration-review inventory: ${repositoryDirectory}`);
}

async function assertExactSourceAttemptInventory(
	repositoryRoot: string,
	slugs: readonly string[],
	expectedPaths: readonly string[]
): Promise<void> {
	const providerRoot = `${CLEANUP_ROOT}/provider-sources`;
	const actualNames = await readdir(path.resolve(repositoryRoot, providerRoot));
	const expectedNames = new Set(expectedPaths.map((entry) => path.basename(entry)));
	const relevantNames = actualNames.filter((name) =>
		slugs.some((slug) => new RegExp(`^${slug}-v\\d+-frameless-source\\.png$`, 'u').test(name))
	);
	if (
		relevantNames.length !== expectedNames.size ||
		relevantNames.some((name) => !expectedNames.has(name))
	)
		throw new Error('Unexpected inner-frame regeneration source-attempt inventory');
}

export async function renderSkillIconInnerFrameRegenerationReview(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<{ readonly written: readonly string[]; readonly reviewFiles: readonly string[] }> {
	const repositoryRoot = path.resolve(options.root ?? process.cwd());
	const jobs = await buildSkillIconInnerFrameRegenerationJobs(repositoryRoot);
	const [geometryBytes, backing] = await Promise.all([
		regularBytes(repositoryRoot, GEOMETRY_PATH),
		regularBytes(repositoryRoot, BACKING_PATH)
	]);
	const geometry = JSON.parse(geometryBytes.toString('utf8'));
	const backingHash = sha256(backing);
	const frames = new Map<
		Rank,
		{ readonly path: string; readonly bytes: Buffer; readonly hash: string }
	>();
	for (const rank of ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const) {
		const framePath = `${FRAME_ROOT}/rarity-frame-${rank.toLowerCase()}-v11-review.png`;
		const bytes = await regularBytes(repositoryRoot, framePath);
		frames.set(rank, { path: framePath, bytes, hash: sha256(bytes) });
	}

	const rendered: RenderedRecord[] = [];
	for (const job of jobs) {
		const frame = frames.get(job.rank);
		if (!frame) throw new Error(`Missing complete ${job.rank} frame`);
		const [attemptBytes, current] = await Promise.all([
			Promise.all(
				job.sourceAttempts.map(async (attempt) => ({
					...attempt,
					bytes: await regularBytes(repositoryRoot, attempt.path)
				}))
			),
			regularBytes(repositoryRoot, job.currentPath)
		]);
		const selectedAttempt = attemptBytes.find((attempt) => attempt.status === 'accepted');
		if (!selectedAttempt || selectedAttempt.path !== job.outputPath)
			throw new Error(`Missing accepted regeneration source for ${job.targetId}`);
		const sourceBytes = selectedAttempt.bytes;
		if (sha256(current) !== job.currentHash)
			throw new Error(`Current composite hash drift for ${job.targetId}`);
		for (const attempt of attemptBytes) {
			const sourceMetadata = await sharp(attempt.bytes).metadata();
			if (
				sourceMetadata.width !== 1254 ||
				sourceMetadata.height !== 1254 ||
				sourceMetadata.channels !== 3
			)
				throw new Error(`Unexpected generated source format for ${job.targetId}`);
		}
		const prepared = await sharp(sourceBytes)
			.resize(1024, 1024, { fit: 'fill', kernel: sharp.kernel.lanczos3, fastShrinkOnLoad: false })
			.png(PNG_OPTIONS)
			.toBuffer();
		const interior = await extractLegacyInterior(prepared, geometry, {
			frame: frame.bytes,
			artworkScale: 1
		});
		const candidate = await clearCleanupExterior(
			await composeCleanupIcon({
				backing,
				interior: interior.bytes,
				frame: frame.bytes,
				compositionProfile: 'frame-opening-v3'
			}),
			geometry
		);
		const rawInspection = await inspectCleanupComposite({
			composite: candidate,
			backing,
			interior: interior.bytes,
			frame: frame.bytes,
			geometry,
			compositionProfile: 'frame-opening-v3',
			boundLayerHashes: {
				backing: backingHash,
				interior: sha256(interior.bytes),
				frame: frame.hash
			}
		});
		const inspection: InspectionSummary = {
			layerHashesMatch: rawInspection.layerHashesMatch,
			exactComposite: rawInspection.exactComposite,
			protectedBandMatches: rawInspection.protectedBandMatches,
			exteriorTransparent: rawInspection.exteriorTransparent,
			backingOnlyComponents: rawInspection.backingOnlyComponents
		};
		if (
			!inspection.layerHashesMatch ||
			!inspection.exactComposite ||
			!inspection.protectedBandMatches ||
			!inspection.exteriorTransparent ||
			inspection.backingOnlyComponents.length > 0
		)
			throw new Error(`Regeneration composite inspection failed for ${job.targetId}`);
		const candidatePath = `${CANDIDATE_ROOT}/${job.slug}.png`;
		rendered.push({
			targetId: job.targetId,
			slug: job.slug,
			name: job.name,
			rank: job.rank,
			currentPath: job.currentPath,
			currentHash: job.currentHash,
			referencePath: job.referencePath,
			referenceHash: job.referenceHash,
			sourcePath: job.outputPath,
			source: {
				width: 1254,
				height: 1254,
				alphaMode: 'rgb',
				contentHash: sha256(sourceBytes)
			},
			exactPrompt: job.exactPrompt,
			generationAttempts: attemptBytes.map(({ bytes, ...attempt }) => ({
				...attempt,
				contentHash: sha256(bytes)
			})),
			interiorHash: sha256(interior.bytes),
			framePath: frame.path,
			frameHash: frame.hash,
			candidatePath,
			candidateHash: sha256(candidate),
			inspection,
			current,
			candidate
		});
	}
	if (rendered.length !== 23 || new Set(rendered.map((record) => record.targetId)).size !== 23)
		throw new Error('Regeneration-review inventory must contain 23 unique skills');

	const outputs: { readonly path: string; readonly bytes: Buffer }[] = rendered.map((record) => ({
		path: record.candidatePath,
		bytes: record.candidate
	}));
	for (let offset = 0, page = 1; offset < rendered.length; offset += PAGE_SIZE, page += 1)
		outputs.push({
			path: `${COMPARISON_ROOT}/page-${String(page).padStart(2, '0')}.png`,
			bytes: await comparisonPage(page, rendered.slice(offset, offset + PAGE_SIZE))
		});
	const pageCount = Math.ceil(rendered.length / PAGE_SIZE);
	outputs.push({ path: `${REVIEW_ROOT}/index.html`, bytes: reviewIndex(pageCount) });
	outputs.push({
		path: `${REVIEW_ROOT}/report.json`,
		bytes: jsonBytes({
			schemaVersion: 'skill-icon-inner-frame-regeneration-review-v1',
			status: 'owner-approved-regeneration-review-not-promoted',
			decision: 'regenerate-all-23-clear-inner-frame-failures-sequentially',
			scope: { regenerated: 23, borderlineUntouched: 5 },
			sequence: {
				mode: 'sequential',
				executionOrder: rendered.map((record, index) => ({
					step: index + 1,
					targetId: record.targetId,
					attempts: record.generationAttempts.length
				}))
			},
			assembly: {
				artworkTreatment: 'generated-frameless-source-masked-to-canonical-aperture',
				backing: { path: BACKING_PATH, contentHash: backingHash },
				frameIsFinalLayer: true,
				compositionProfile: 'frame-opening-v3'
			},
			inputs: {
				geometry: { path: GEOMETRY_PATH, contentHash: sha256(geometryBytes) },
				generationTool: 'built-in imagegen'
			},
			records: rendered.map(({ current: _current, candidate: _candidate, ...record }) => record)
		})
	});

	const written: string[] = [];
	for (const output of outputs)
		if (await syncCreateOnly(repositoryRoot, output.path, output.bytes, options.mode))
			written.push(output.path);
	await assertExactInventory(
		repositoryRoot,
		CANDIDATE_ROOT,
		rendered.map((record) => `${record.slug}.png`)
	);
	await assertExactSourceAttemptInventory(
		repositoryRoot,
		jobs.map((job) => job.slug),
		jobs.flatMap((job) => job.sourceAttempts.map((attempt) => attempt.path))
	);
	await assertExactInventory(
		repositoryRoot,
		COMPARISON_ROOT,
		Array.from(
			{ length: pageCount },
			(_, index) => `page-${String(index + 1).padStart(2, '0')}.png`
		)
	);
	return { written, reviewFiles: outputs.map((output) => output.path) };
}

function parseMode(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0] ?? ''))
		throw new Error(
			'Usage: tsx tools/render-skill-icon-inner-frame-regeneration-review.ts --write|--check'
		);
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
	const mode = parseMode(process.argv.slice(2));
	const result = await renderSkillIconInnerFrameRegenerationReview({ mode });
	// eslint-disable-next-line no-console
	console.log(
		`${mode}: ${result.reviewFiles.length} review files; ${result.written.length} written`
	);
}
