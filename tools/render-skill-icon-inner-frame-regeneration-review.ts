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
const PRIOR_REVIEW_ROOT = `${CLEANUP_ROOT}/review/v11-inner-frame-regeneration` as const;
const PRIOR_REPORT_PATH = `${PRIOR_REVIEW_ROOT}/report.json` as const;
const FRAME_ROOT = `${CLEANUP_ROOT}/review/v9-complete-frame-rollout/frames` as const;
const REVIEW_ROOT = `${CLEANUP_ROOT}/review/v12-inner-frame-regeneration-scale` as const;
const CANDIDATE_ROOT = `${REVIEW_ROOT}/candidates` as const;
const COMPARISON_ROOT = `${REVIEW_ROOT}/comparison` as const;
const GEOMETRY_PATH = `${ROOT}/geometry-v2.json` as const;
const BACKING_PATH = `${ROOT}/candidates/references/charcoal-forged-stone-v6.png` as const;
const PAGE_SIZE = 6;
const ARTWORK_SCALE = 0.9;
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
	readonly comparisonBaselinePath: string;
	readonly comparisonBaselineHash: string;
	readonly sourceBinding: {
		readonly v11Path: string;
		readonly v11ContentHash: string;
		readonly matches: true;
	};
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
	readonly apertureCoverage: {
		readonly expectedPixels: number;
		readonly coveredPixels: number;
		readonly complete: boolean;
	};
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

async function countVisiblePixels(bytes: Buffer): Promise<number> {
	const { data, info } = await sharp(bytes)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	let visible = 0;
	for (let index = 0; index < info.width * info.height; index += 1)
		if ((data[index * 4 + 3] ?? 0) > 0) visible += 1;
	return visible;
}

async function prepareLessZoomedArtwork(
	source: Buffer,
	canvas: { readonly width: number; readonly height: number }
): Promise<{
	readonly bytes: Buffer;
	readonly width: number;
	readonly height: number;
	readonly left: number;
	readonly top: number;
}> {
	const width = Math.round(canvas.width * ARTWORK_SCALE);
	const height = Math.round(canvas.height * ARTWORK_SCALE);
	const left = Math.floor((canvas.width - width) / 2);
	const top = Math.floor((canvas.height - height) / 2);
	const scaled = await sharp(source)
		.resize(width, height, {
			fit: 'fill',
			kernel: sharp.kernel.lanczos3,
			fastShrinkOnLoad: false
		})
		.png(PNG_OPTIONS)
		.toBuffer();
	const bytes = await sharp({
		create: {
			width: canvas.width,
			height: canvas.height,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([{ input: scaled, left, top }])
		.png(PNG_OPTIONS)
		.toBuffer();
	return { bytes, width, height, left, top };
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
			text: `LESS-ZOOM REGENERATION · PAGE ${page}`,
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
			{ text: 'V11 · 100%', x: left + 168, y: top + 20, size: 13, fill: '#9aa3b1' },
			{ text: 'V12 · 90%', x: left + 552, y: top + 20, size: 13, fill: '#79c49b' },
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
<title>Less-zoom inner-frame regeneration review</title><style>body{margin:0;background:#090d12;color:#f3ead8;font-family:sans-serif}main{max-width:1500px;margin:auto;padding:24px}h1,p{text-align:center}strong{color:#79c49b}img{display:block;width:100%;height:auto;margin:24px 0;border:1px solid #343b47}</style></head>
<body><main><h1>Less-zoom regeneration · 23 skills</h1><p><strong>Review only:</strong> V11 at 100% is shown directly beside V12 with the same accepted frameless art centered at 90%. The five borderline cases remain untouched.</p><p>The complete frame is the final compositing layer in every candidate, and an automated gate proves the scaled art covers the entire aperture. No production icon is promoted by this review.</p>${pages}</main></body></html>\n`);
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
	const [geometryBytes, backing, priorReportBytes] = await Promise.all([
		regularBytes(repositoryRoot, GEOMETRY_PATH),
		regularBytes(repositoryRoot, BACKING_PATH),
		regularBytes(repositoryRoot, PRIOR_REPORT_PATH)
	]);
	const geometry = JSON.parse(geometryBytes.toString('utf8'));
	const priorReport = JSON.parse(priorReportBytes.toString('utf8')) as {
		readonly records: readonly {
			readonly targetId: string;
			readonly candidatePath: string;
			readonly candidateHash: string;
			readonly sourcePath: string;
			readonly source: { readonly contentHash: string };
			readonly generationAttempts: readonly {
				readonly path: string;
				readonly status: 'accepted' | 'rejected';
				readonly contentHash: string;
			}[];
		}[];
	};
	const priorByTarget = new Map(priorReport.records.map((record) => [record.targetId, record]));
	const backingHash = sha256(backing);
	const opaqueCanvas = await sharp({
		create: {
			width: geometry.canvas.width,
			height: geometry.canvas.height,
			channels: 4,
			background: { r: 255, g: 255, b: 255, alpha: 1 }
		}
	})
		.png(PNG_OPTIONS)
		.toBuffer();
	const frames = new Map<
		Rank,
		{
			readonly path: string;
			readonly bytes: Buffer;
			readonly hash: string;
			readonly openingPixels: number;
		}
	>();
	for (const rank of ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const) {
		const framePath = `${FRAME_ROOT}/rarity-frame-${rank.toLowerCase()}-v11-review.png`;
		const bytes = await regularBytes(repositoryRoot, framePath);
		const opening = await extractLegacyInterior(opaqueCanvas, geometry, {
			frame: bytes,
			artworkScale: 1
		});
		frames.set(rank, {
			path: framePath,
			bytes,
			hash: sha256(bytes),
			openingPixels: await countVisiblePixels(opening.bytes)
		});
	}

	const rendered: RenderedRecord[] = [];
	for (const job of jobs) {
		const frame = frames.get(job.rank);
		if (!frame) throw new Error(`Missing complete ${job.rank} frame`);
		const priorRecord = priorByTarget.get(job.targetId);
		if (!priorRecord) throw new Error(`Missing V11 comparison baseline for ${job.targetId}`);
		const [attemptBytes, productionCurrent, comparisonBaseline] = await Promise.all([
			Promise.all(
				job.sourceAttempts.map(async (attempt) => ({
					...attempt,
					bytes: await regularBytes(repositoryRoot, attempt.path)
				}))
			),
			regularBytes(repositoryRoot, job.currentPath),
			regularBytes(repositoryRoot, priorRecord.candidatePath)
		]);
		const selectedAttempt = attemptBytes.find((attempt) => attempt.status === 'accepted');
		if (!selectedAttempt || selectedAttempt.path !== job.outputPath)
			throw new Error(`Missing accepted regeneration source for ${job.targetId}`);
		const sourceBytes = selectedAttempt.bytes;
		const sourceHash = sha256(sourceBytes);
		const priorAcceptedAttempts = priorRecord.generationAttempts.filter(
			(attempt) => attempt.status === 'accepted'
		);
		const sourceBindingMatches =
			priorRecord.sourcePath === selectedAttempt.path &&
			priorRecord.source.contentHash === sourceHash &&
			priorAcceptedAttempts.length === 1 &&
			priorAcceptedAttempts[0]?.path === selectedAttempt.path &&
			priorAcceptedAttempts[0]?.contentHash === sourceHash;
		if (!sourceBindingMatches)
			throw new Error(`V11 accepted-source binding drift for ${job.targetId}`);
		if (sha256(productionCurrent) !== job.currentHash)
			throw new Error(`Current composite hash drift for ${job.targetId}`);
		if (sha256(comparisonBaseline) !== priorRecord.candidateHash)
			throw new Error(`V11 comparison baseline hash drift for ${job.targetId}`);
		for (const attempt of attemptBytes) {
			const sourceMetadata = await sharp(attempt.bytes).metadata();
			if (
				sourceMetadata.width !== 1254 ||
				sourceMetadata.height !== 1254 ||
				sourceMetadata.channels !== 3
			)
				throw new Error(`Unexpected generated source format for ${job.targetId}`);
		}
		const prepared = await prepareLessZoomedArtwork(sourceBytes, geometry.canvas);
		const interior = await extractLegacyInterior(prepared.bytes, geometry, {
			frame: frame.bytes,
			artworkScale: 1
		});
		const coveredPixels = await countVisiblePixels(interior.bytes);
		const apertureCoverage = {
			expectedPixels: frame.openingPixels,
			coveredPixels,
			complete: coveredPixels === frame.openingPixels
		};
		if (!apertureCoverage.complete)
			throw new Error(`Scaled artwork does not cover the aperture for ${job.targetId}`);
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
			comparisonBaselinePath: priorRecord.candidatePath,
			comparisonBaselineHash: priorRecord.candidateHash,
			sourceBinding: {
				v11Path: priorRecord.sourcePath,
				v11ContentHash: priorRecord.source.contentHash,
				matches: true
			},
			referencePath: job.referencePath,
			referenceHash: job.referenceHash,
			sourcePath: job.outputPath,
			source: {
				width: 1254,
				height: 1254,
				alphaMode: 'rgb',
				contentHash: sourceHash
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
			apertureCoverage,
			inspection,
			current: comparisonBaseline,
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
			schemaVersion: 'skill-icon-inner-frame-regeneration-review-v2',
			status: 'owner-approved-less-zoom-review-not-promoted',
			decision: 'center-accepted-frameless-art-at-90-percent-scale',
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
				artworkTreatment: 'generated-frameless-source-centered-before-aperture-mask',
				artworkScale: ARTWORK_SCALE,
				preparedSource: {
					width: Math.round(geometry.canvas.width * ARTWORK_SCALE),
					height: Math.round(geometry.canvas.height * ARTWORK_SCALE),
					left: Math.floor(
						(geometry.canvas.width - Math.round(geometry.canvas.width * ARTWORK_SCALE)) / 2
					),
					top: Math.floor(
						(geometry.canvas.height - Math.round(geometry.canvas.height * ARTWORK_SCALE)) / 2
					)
				},
				backing: { path: BACKING_PATH, contentHash: backingHash },
				frameIsFinalLayer: true,
				compositionProfile: 'frame-opening-v3'
			},
			inputs: {
				geometry: { path: GEOMETRY_PATH, contentHash: sha256(geometryBytes) },
				priorReview: { path: PRIOR_REPORT_PATH, contentHash: sha256(priorReportBytes) },
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
