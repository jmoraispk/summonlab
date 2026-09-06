import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import {
	clearCleanupExterior,
	composeCleanupIcon,
	extractLegacyInterior,
	inspectCleanupComposite
} from './skill-icon-quality-cleanup-lib.js';

type Mode = 'write' | 'check';

const ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const CLEANUP_ROOT = `${ROOT}/quality-cleanup-v1` as const;
const REVIEW_ROOT = `${CLEANUP_ROOT}/review/v4-outline-fix` as const;
const SOURCE_ROOT = `${ROOT}/mass-production-v1/icons` as const;
const BACKING_PATH = `${ROOT}/candidates/references/charcoal-forged-stone-v6.png` as const;
const GEOMETRY_PATH = `${ROOT}/geometry-v2.json` as const;
const MANIFEST_PATH = `${ROOT}/mass-production-v1/manifest.json` as const;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;

const RECORDS = [
	{
		targetId: 'craft:forging:fuel-craft',
		slug: 'craft-forging-fuel-craft',
		name: 'Fuel Craft',
		rank: 'E',
		artworkScale: 1,
		sourceMode: 'revision-provider',
		sourcePath: `${CLEANUP_ROOT}/provider-sources/craft-forging-fuel-craft-v3.png`,
		sourceHash: 'e9268cab018f0cc0c056ca939d208aeb65a62c55ecffecc7cf8d5b94a2b614ec',
		currentPath: `${CLEANUP_ROOT}/composites/craft-forging-fuel-craft-v3.png`
	},
	{
		targetId: 'craft:alchemy:concentration',
		slug: 'craft-alchemy-concentration',
		name: 'Concentration',
		rank: 'D',
		artworkScale: 1.08,
		sourceMode: 'mass-production',
		currentPath: `${CLEANUP_ROOT}/composites/craft-alchemy-concentration.png`
	},
	{
		targetId: 'craft:alchemy:antidotes',
		slug: 'craft-alchemy-antidotes',
		name: 'Antidotes',
		rank: 'E',
		artworkScale: 1.08,
		sourceMode: 'mass-production',
		currentPath: `${CLEANUP_ROOT}/composites/craft-alchemy-antidotes.png`
	},
	{
		targetId: 'magical:elemental:spike-field',
		slug: 'magical-elemental-spike-field',
		name: 'Spike Field',
		rank: 'E',
		artworkScale: 1.08,
		sourceMode: 'mass-production',
		currentPath: `${CLEANUP_ROOT}/composites/magical-elemental-spike-field.png`
	},
	{
		targetId: 'magical:elemental:where-all-rivers-end',
		slug: 'magical-elemental-where-all-rivers-end',
		name: 'Where All Rivers End',
		rank: 'S',
		artworkScale: 1.15,
		sourceMode: 'mass-production',
		currentPath: `${CLEANUP_ROOT}/composites/magical-elemental-where-all-rivers-end.png`
	},
	{
		targetId: 'magical:elemental:the-deep',
		slug: 'magical-elemental-the-deep',
		name: 'The Deep',
		rank: 'A',
		artworkScale: 1.08,
		sourceMode: 'mass-production',
		currentPath: `${CLEANUP_ROOT}/composites/magical-elemental-the-deep.png`
	}
] as const;

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
		.replaceAll('"', '&quot;');
}

function textLayer(
	width: number,
	height: number,
	lines: readonly {
		readonly text: string;
		readonly x: number;
		readonly y: number;
		readonly size: number;
		readonly fill: string;
		readonly weight?: number;
	}[]
): Buffer {
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${lines
			.map(
				(line) =>
					`<text x="${line.x}" y="${line.y}" text-anchor="middle" font-family="sans-serif" font-size="${line.size}" font-weight="${line.weight ?? 400}" fill="${line.fill}">${escapeXml(line.text)}</text>`
			)
			.join('')}</svg>`
	);
}

async function regularBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolutePath = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolutePath);
	if (relative.startsWith(`..${path.sep}`) || relative === '..') {
		throw new Error(`Outline-fix input escapes the repository: ${repositoryPath}`);
	}
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink()) {
		throw new Error(`Outline-fix input is not a regular file: ${repositoryPath}`);
	}
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
	if (current !== null) throw new Error(`Refusing outline-fix review drift: ${repositoryPath}`);
	if (mode === 'check') throw new Error(`Missing outline-fix review artifact: ${repositoryPath}`);
	await writeAtomic(destination, bytes);
	return true;
}

async function comparisonSheet(input: {
	readonly repositoryRoot: string;
	readonly size: 96 | 384;
	readonly records: readonly {
		readonly name: string;
		readonly rank: string;
		readonly currentPath: string;
		readonly candidate: Buffer;
	}[];
}): Promise<Buffer> {
	const gap = input.size === 384 ? 24 : 12;
	const header = input.size === 384 ? 64 : 42;
	const caption = input.size === 384 ? 44 : 28;
	const width = input.size * 2 + gap;
	const height = header + input.records.length * (input.size + caption);
	const overlays: OverlayOptions[] = [
		{
			input: textLayer(width, header, [
				{
					text: 'CURRENT',
					x: input.size / 2,
					y: header - 20,
					size: input.size === 384 ? 20 : 12,
					fill: '#9ca6b5',
					weight: 700
				},
				{
					text: 'OUTLINE FIX',
					x: input.size + gap + input.size / 2,
					y: header - 20,
					size: input.size === 384 ? 20 : 12,
					fill: '#79c49b',
					weight: 700
				}
			]),
			left: 0,
			top: 0
		}
	];
	for (const [index, record] of input.records.entries()) {
		const top = header + index * (input.size + caption);
		const current = await sharp(await regularBytes(input.repositoryRoot, record.currentPath))
			.resize(input.size, input.size, { fit: 'fill' })
			.png(PNG_OPTIONS)
			.toBuffer();
		const candidate = await sharp(record.candidate)
			.resize(input.size, input.size, { fit: 'fill' })
			.png(PNG_OPTIONS)
			.toBuffer();
		overlays.push(
			{ input: current, left: 0, top },
			{ input: candidate, left: input.size + gap, top },
			{
				input: textLayer(width, caption, [
					{
						text: `${record.name} · ${record.rank}`,
						x: width / 2,
						y: input.size === 384 ? 29 : 18,
						size: input.size === 384 ? 18 : 11,
						fill: '#f2eadc',
						weight: 700
					}
				]),
				left: 0,
				top: top + input.size
			}
		);
	}
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

export async function renderSkillIconOutlineFixReview(options: {
	readonly root?: string;
	readonly sourceRoot?: string;
	readonly mode: Mode;
}): Promise<{ readonly written: readonly string[]; readonly reviewFiles: readonly string[] }> {
	const repositoryRoot = path.resolve(options.root ?? process.cwd());
	const sourceRoot = path.resolve(options.sourceRoot ?? path.join(repositoryRoot, SOURCE_ROOT));
	const [geometryBytes, backing, manifestBytes] = await Promise.all([
		regularBytes(repositoryRoot, GEOMETRY_PATH),
		regularBytes(repositoryRoot, BACKING_PATH),
		regularBytes(repositoryRoot, MANIFEST_PATH)
	]);
	const geometry = JSON.parse(geometryBytes.toString('utf8'));
	const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
		readonly skills: readonly {
			readonly targetId: string;
			readonly finalImageHash: string | null;
		}[];
	};
	const sourceHashes = new Map(
		manifest.skills.map((record) => [record.targetId, record.finalImageHash])
	);
	const backingHash = sha256(backing);
	const rendered = [];
	for (const record of RECORDS) {
		const source =
			record.sourceMode === 'revision-provider'
				? await regularBytes(repositoryRoot, record.sourcePath)
				: await readFile(path.join(sourceRoot, `${record.slug}.png`));
		const expectedSourceHash =
			record.sourceMode === 'revision-provider'
				? record.sourceHash
				: sourceHashes.get(record.targetId);
		if (
			expectedSourceHash === null ||
			expectedSourceHash === undefined ||
			sha256(source) !== expectedSourceHash
		) {
			throw new Error(`Frozen source hash mismatch for ${record.targetId}`);
		}
		const preparedSource =
			record.sourceMode === 'revision-provider'
				? await sharp({
						create: {
							width: 1024,
							height: 1024,
							channels: 4,
							background: { r: 0, g: 0, b: 0, alpha: 1 }
						}
					})
						.composite([
							{
								input: await sharp(source)
									.resize(696, 696, {
										fit: 'fill',
										kernel: 'lanczos3',
										fastShrinkOnLoad: false
									})
									.png(PNG_OPTIONS)
									.toBuffer(),
								left: 164,
								top: 192
							}
						])
						.png(PNG_OPTIONS)
						.toBuffer()
				: source;
		const framePath = `${ROOT}/candidates/references/rarity-frame-${record.rank.toLowerCase()}-v9.png`;
		const frame = await regularBytes(repositoryRoot, framePath);
		const interior = await extractLegacyInterior(preparedSource, geometry, {
			frame,
			artworkScale: record.artworkScale
		});
		const candidate = await clearCleanupExterior(
			await composeCleanupIcon({
				backing,
				interior: interior.bytes,
				frame,
				compositionProfile: 'frame-opening-v2'
			}),
			geometry
		);
		const inspection = await inspectCleanupComposite({
			composite: candidate,
			backing,
			interior: interior.bytes,
			frame,
			geometry,
			compositionProfile: 'frame-opening-v2',
			boundLayerHashes: {
				backing: backingHash,
				interior: sha256(interior.bytes),
				frame: sha256(frame)
			}
		});
		if (
			!inspection.layerHashesMatch ||
			!inspection.exactComposite ||
			!inspection.protectedBandMatches ||
			!inspection.exteriorTransparent ||
			inspection.backingOnlyComponents.length > 0
		) {
			throw new Error(`Outline-fix inspection failed for ${record.targetId}`);
		}
		rendered.push({
			...record,
			sourceHash: expectedSourceHash,
			framePath,
			frameHash: sha256(frame),
			candidatePath: `${REVIEW_ROOT}/candidates/${record.slug}.png`,
			candidate,
			candidateHash: sha256(candidate),
			removedPixels: interior.removedPixels,
			inspection
		});
	}
	const comparison384 = await comparisonSheet({ repositoryRoot, size: 384, records: rendered });
	const comparison96 = await comparisonSheet({ repositoryRoot, size: 96, records: rendered });
	const reportPath = `${REVIEW_ROOT}/report.json`;
	const outputs = [
		...rendered.map((record) => ({ path: record.candidatePath, bytes: record.candidate })),
		{ path: `${REVIEW_ROOT}/comparison-384.png`, bytes: comparison384 },
		{ path: `${REVIEW_ROOT}/comparison-96.png`, bytes: comparison96 },
		{
			path: reportPath,
			bytes: jsonBytes({
				schemaVersion: 'skill-icon-outline-fix-review-v1',
				strategy: {
					aperture: 'center-connected-transparent-opening-of-accepted-v9-frame',
					backing: 'retained-only-beneath-nontransparent-artwork-or-frame-pixels',
					legacyArtworkScale: 1.08,
					sRankArtworkScale: 1.15,
					revisionProviderBackground: 'opaque-black-preserved-through-the-frame-opening'
				},
				records: rendered.map(({ candidate: _candidate, inspection, ...record }) => ({
					...record,
					inspection: {
						layerHashesMatch: inspection.layerHashesMatch,
						exactComposite: inspection.exactComposite,
						protectedBandMatches: inspection.protectedBandMatches,
						exteriorTransparent: inspection.exteriorTransparent,
						backingOnlyComponents: inspection.backingOnlyComponents,
						nearWhiteComponentCount: inspection.nearWhiteComponents.length,
						largestNearWhiteComponent:
							inspection.nearWhiteComponents.toSorted(
								(left, right) => right.pixels - left.pixels
							)[0] ?? null
					}
				})),
				reviewFiles: [`${REVIEW_ROOT}/comparison-384.png`, `${REVIEW_ROOT}/comparison-96.png`]
			})
		}
	];
	const written: string[] = [];
	for (const output of outputs) {
		if (await syncCreateOnly(repositoryRoot, output.path, output.bytes, options.mode))
			written.push(output.path);
	}
	return {
		written,
		reviewFiles: [
			`${REVIEW_ROOT}/comparison-384.png`,
			`${REVIEW_ROOT}/comparison-96.png`,
			reportPath
		]
	};
}

function parseArgs(args: readonly string[]): { readonly mode: Mode; readonly sourceRoot?: string } {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	const modeArg = normalized.find((argument) => argument === '--write' || argument === '--check');
	if (modeArg === undefined) {
		throw new Error(
			'Usage: tsx tools/render-skill-icon-outline-fix-review.ts --write|--check [--source-root path]'
		);
	}
	const sourceIndex = normalized.indexOf('--source-root');
	if (sourceIndex >= 0 && normalized[sourceIndex + 1] === undefined) {
		throw new Error('--source-root requires a path');
	}
	return {
		mode: modeArg === '--write' ? 'write' : 'check',
		...(sourceIndex >= 0 ? { sourceRoot: normalized[sourceIndex + 1] } : {})
	};
}

if (
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
	const request = parseArgs(process.argv.slice(2));
	const report = await renderSkillIconOutlineFixReview(request);
	console.log(
		`${request.mode}: ${report.reviewFiles.length} review files; ${report.written.length} written`
	);
}
