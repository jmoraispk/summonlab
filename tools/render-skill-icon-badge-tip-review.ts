import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

import sharp, { type OverlayOptions } from 'sharp';

import {
	skillIconBlackMatteAlpha,
	skillIconBlackMatteUnmatteChannel
} from './normalize-skill-icon-provider-source.js';

type Mode = 'write' | 'check';
type Point = readonly [number, number];

const ROOT = 'assets/wiki/skills/icon-production-v1' as const;
const CLEANUP_ROOT = `${ROOT}/quality-cleanup-v1` as const;
const PRIOR_REVIEW_ROOT = `${CLEANUP_ROOT}/review/v5-frame-cut-fix` as const;
const REVIEW_ROOT = `${CLEANUP_ROOT}/review/v6-badge-tip-fix` as const;
const SOURCE_PATH =
	`${CLEANUP_ROOT}/provider-sources/rarity-frame-s-v10-badge-tip-source.png` as const;
const FRAME_PATH = `${ROOT}/candidates/references/rarity-frame-s-v9.png` as const;
const CURRENT_PATH =
	`${PRIOR_REVIEW_ROOT}/candidates/magical-elemental-where-all-rivers-end.png` as const;
const PATCH_POLYGON = [
	[449, 184],
	[575, 184],
	[512, 272]
] as const satisfies readonly Point[];
const IMAGEGEN_EXACT_PROMPT =
	'Use case: precise-object-edit\nAsset type: existing game UI rarity-frame repair\nInput images: Image 1 is the edit target and sole visual authority.\nPrimary request: Make one surgical edit only. The top-center S badge is clipped flat along its lower edge. Continue the existing lower dark-bronze badge face and its existing antique-gold beveled diagonal edges downward until they converge into a complete centered hexagonal point. The new point should be approximately 45 source pixels tall and approximately 105 pixels wide at its top, aligned to the current flat cut.\nScene/backdrop: preserve Image 1\'s transparent exterior and transparent central aperture if possible; otherwise use one perfectly uniform flat #00ff00 matte with no variation.\nText (verbatim): "S"\nConstraints: preserve the existing canvas, exact frame position, exact scale, exact S letter, all pixels and visual features outside the missing lower badge triangle, upper badge, crown thorns, shoulder ornament, six outer rails, side decorations, bottom decorations, colors, highlights, texture, and line weights. Do not redraw, rescale, recenter, simplify, sharpen, or restyle any existing element. Add only the missing lower badge triangle.\nAvoid: any change outside the missing triangle; new ornament; changed S; moved frame; crop; glow; shadow; artwork; checkerboard; watermark.' as const;
const PNG_OPTIONS = { compressionLevel: 9, adaptiveFiltering: false, palette: false } as const;

interface Bounds {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export interface BadgeTipRepairAudit {
	readonly changedPixels: number;
	readonly changedOutsidePatch: number;
	readonly addedVisiblePixels: number;
	readonly addedBounds: Bounds | null;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function pointInPolygon(x: number, y: number, polygon: readonly Point[]): boolean {
	let inside = false;
	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const [xi, yi] = polygon[index]!;
		const [xj, yj] = polygon[previous]!;
		if (yi !== yj && yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
			inside = !inside;
	}
	return inside;
}

function over(source: readonly number[], destination: readonly number[]): readonly number[] {
	const sourceAlpha = source[3]! / 255;
	const destinationAlpha = destination[3]! / 255;
	const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha);
	if (outputAlpha === 0) return [0, 0, 0, 0];
	return [
		Math.round(
			(source[0]! * sourceAlpha + destination[0]! * destinationAlpha * (1 - sourceAlpha)) /
				outputAlpha
		),
		Math.round(
			(source[1]! * sourceAlpha + destination[1]! * destinationAlpha * (1 - sourceAlpha)) /
				outputAlpha
		),
		Math.round(
			(source[2]! * sourceAlpha + destination[2]! * destinationAlpha * (1 - sourceAlpha)) /
				outputAlpha
		),
		Math.round(outputAlpha * 255)
	];
}

function boundsOf(indices: readonly number[], width: number): Bounds | null {
	if (indices.length === 0) return null;
	let left = width;
	let right = 0;
	let top = width;
	let bottom = 0;
	for (const index of indices) {
		const x = index % width;
		const y = Math.floor(index / width);
		left = Math.min(left, x);
		right = Math.max(right, x);
		top = Math.min(top, y);
		bottom = Math.max(bottom, y);
	}
	return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

export async function repairSFrameBadgeTipForReview(input: {
	readonly frame: Buffer;
	readonly providerSource: Buffer;
}): Promise<{
	readonly bytes: Buffer;
	readonly patchBytes: Buffer;
	readonly audit: BadgeTipRepairAudit;
}> {
	const [frameDecoded, providerMetadata] = await Promise.all([
		sharp(input.frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
		sharp(input.providerSource).metadata()
	]);
	if (
		frameDecoded.info.width !== 1024 ||
		frameDecoded.info.height !== 1024 ||
		frameDecoded.info.channels !== 4
	)
		throw new Error('Badge-tip repair requires the canonical 1024×1024 RGBA S frame');
	if (
		providerMetadata.width !== 1254 ||
		providerMetadata.height !== 1254 ||
		providerMetadata.hasAlpha ||
		providerMetadata.channels !== 3
	)
		throw new Error('Badge-tip repair source must be the frozen 1254×1254 RGB imagegen output');
	const providerDecoded = await sharp(input.providerSource)
		.resize(1024, 1024, { fit: 'fill', kernel: 'lanczos3', fastShrinkOnLoad: false })
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const output = Buffer.from(frameDecoded.data);
	const patch = Buffer.alloc(output.length);
	const addedIndices: number[] = [];
	let changedPixels = 0;
	let changedOutsidePatch = 0;
	for (let y = 0; y < 1024; y += 1) {
		for (let x = 0; x < 1024; x += 1) {
			const pixelIndex = y * 1024 + x;
			const targetOffset = pixelIndex * 4;
			const insidePatch = pointInPolygon(x + 0.5, y + 0.5, PATCH_POLYGON);
			if (insidePatch && frameDecoded.data[targetOffset + 3] === 0) {
				const sourceOffset = pixelIndex * 3;
				const red = providerDecoded.data[sourceOffset]!;
				const green = providerDecoded.data[sourceOffset + 1]!;
				const blue = providerDecoded.data[sourceOffset + 2]!;
				const alpha = skillIconBlackMatteAlpha(red, green, blue);
				if (alpha > 0) {
					const destination = [...output.subarray(targetOffset, targetOffset + 4)];
					const composited = over(
						[
							skillIconBlackMatteUnmatteChannel(red, alpha),
							skillIconBlackMatteUnmatteChannel(green, alpha),
							skillIconBlackMatteUnmatteChannel(blue, alpha),
							alpha
						],
						destination
					);
					for (let channel = 0; channel < 4; channel += 1)
						output[targetOffset + channel] = composited[channel]!;
					for (let channel = 0; channel < 4; channel += 1)
						patch[targetOffset + channel] = composited[channel]!;
				}
			}
			const changed = !output
				.subarray(targetOffset, targetOffset + 4)
				.equals(frameDecoded.data.subarray(targetOffset, targetOffset + 4));
			if (!changed) continue;
			changedPixels += 1;
			if (!insidePatch) changedOutsidePatch += 1;
			if (frameDecoded.data[targetOffset + 3] === 0 && output[targetOffset + 3]! > 0)
				addedIndices.push(pixelIndex);
		}
	}
	return {
		bytes: await sharp(output, { raw: { width: 1024, height: 1024, channels: 4 } })
			.png(PNG_OPTIONS)
			.toBuffer(),
		patchBytes: await sharp(patch, { raw: { width: 1024, height: 1024, channels: 4 } })
			.png(PNG_OPTIONS)
			.toBuffer(),
		audit: {
			changedPixels,
			changedOutsidePatch,
			addedVisiblePixels: addedIndices.length,
			addedBounds: boundsOf(addedIndices, 1024)
		}
	};
}

async function regularBytes(repositoryRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolutePath = path.resolve(repositoryRoot, repositoryPath);
	const relative = path.relative(repositoryRoot, absolutePath);
	if (relative.startsWith(`..${path.sep}`) || relative === '..')
		throw new Error(`Badge-tip input escapes the repository: ${repositoryPath}`);
	const metadata = await lstat(absolutePath);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Badge-tip input is not a regular file: ${repositoryPath}`);
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
	if (current !== null) throw new Error(`Refusing badge-tip review drift: ${repositoryPath}`);
	if (mode === 'check') throw new Error(`Missing badge-tip review artifact: ${repositoryPath}`);
	await writeAtomic(destination, bytes);
	return true;
}

function textLayer(
	width: number,
	height: number,
	labels: readonly string[],
	fontSize: number
): Buffer {
	return Buffer.from(
		`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${labels
			.map(
				(label, index) =>
					`<text x="${width * ((index + 0.5) / labels.length)}" y="${height - (fontSize === 20 ? 16 : 11)}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" font-weight="700" fill="${index === 0 ? '#9ca6b5' : '#79c49b'}">${label}</text>`
			)
			.join('')}</svg>`
	);
}

async function comparisonSheet(input: {
	readonly current: Buffer;
	readonly candidate: Buffer;
	readonly size: 96 | 384;
}): Promise<Buffer> {
	const gap = input.size === 384 ? 24 : 12;
	const header = input.size === 384 ? 64 : 42;
	const caption = input.size === 384 ? 44 : 28;
	const width = input.size * 2 + gap;
	const height = header + input.size + caption;
	const [current, candidate] = await Promise.all(
		[input.current, input.candidate].map((bytes) =>
			sharp(bytes).resize(input.size, input.size).png(PNG_OPTIONS).toBuffer()
		)
	);
	const overlays: OverlayOptions[] = [
		{
			input: textLayer(
				width,
				header,
				input.size === 384 ? ['BEFORE · V5', 'BADGE TIP · V6'] : ['V5', 'V6'],
				input.size === 384 ? 20 : 12
			),
			left: 0,
			top: 0
		},
		{ input: current, left: 0, top: header },
		{ input: candidate, left: input.size + gap, top: header },
		{
			input: Buffer.from(
				`<svg width="${width}" height="${caption}" xmlns="http://www.w3.org/2000/svg"><text x="${width / 2}" y="${input.size === 384 ? 29 : 18}" text-anchor="middle" font-family="sans-serif" font-size="${input.size === 384 ? 18 : 11}" font-weight="700" fill="#f2eadc">Where All Rivers End · S</text></svg>`
			),
			left: 0,
			top: header + input.size
		}
	];
	return sharp({
		create: { width, height, channels: 4, background: { r: 9, g: 13, b: 18, alpha: 1 } }
	})
		.composite(overlays)
		.png(PNG_OPTIONS)
		.toBuffer();
}

async function boundaryAudit(frame: Buffer): Promise<{
	readonly lastAuthorizedRow: number;
	readonly visiblePixelsOnLastRow: number;
	readonly visiblePixelsOnNextRow: number;
	readonly status: 'boundary-contact' | 'clear';
}> {
	const { data, info } = await sharp(frame).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const count = (y: number): number => {
		let total = 0;
		// The shoulder ornaments also cross y=220 on B/S. This centered corridor
		// isolates the crest bottom that the rectangular medallion mask clips.
		for (let x = 448; x < 576; x += 1) if (data[(y * info.width + x) * 4 + 3]! > 0) total += 1;
		return total;
	};
	const last = count(219);
	const next = count(220);
	return {
		lastAuthorizedRow: 219,
		visiblePixelsOnLastRow: last,
		visiblePixelsOnNextRow: next,
		status: last > 0 && next === 0 ? 'boundary-contact' : 'clear'
	};
}

export async function renderSkillIconBadgeTipReview(options: {
	readonly root?: string;
	readonly mode: Mode;
}): Promise<{ readonly written: readonly string[]; readonly reviewFiles: readonly string[] }> {
	const repositoryRoot = path.resolve(options.root ?? process.cwd());
	const [frame, providerSource, current] = await Promise.all([
		regularBytes(repositoryRoot, FRAME_PATH),
		regularBytes(repositoryRoot, SOURCE_PATH),
		regularBytes(repositoryRoot, CURRENT_PATH)
	]);
	const repaired = await repairSFrameBadgeTipForReview({ frame, providerSource });
	if (repaired.audit.changedOutsidePatch !== 0 || repaired.audit.addedVisiblePixels === 0)
		throw new Error('Badge-tip bounded-pixel audit failed');
	const candidate = await sharp(current)
		.composite([{ input: repaired.patchBytes, blend: 'over' }])
		.png(PNG_OPTIONS)
		.toBuffer();
	const rankAudit = await Promise.all(
		(['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const).map(async (rank) => ({
			rank,
			...(await boundaryAudit(
				await regularBytes(
					repositoryRoot,
					`${ROOT}/candidates/references/rarity-frame-${rank.toLowerCase()}-v9.png`
				)
			))
		}))
	);
	const comparison384 = await comparisonSheet({ current, candidate, size: 384 });
	const comparison96 = await comparisonSheet({ current, candidate, size: 96 });
	const frameOutputPath = `${REVIEW_ROOT}/frames/rarity-frame-s-v10-review.png`;
	const candidateOutputPath = `${REVIEW_ROOT}/candidates/magical-elemental-where-all-rivers-end.png`;
	const reportPath = `${REVIEW_ROOT}/report.json`;
	const reviewFiles = [
		`${REVIEW_ROOT}/comparison-384.png`,
		`${REVIEW_ROOT}/comparison-96.png`,
		frameOutputPath,
		reportPath
	];
	const report = Buffer.from(
		`${JSON.stringify(
			{
				schemaVersion: 'skill-icon-badge-tip-fix-review-v1',
				status: 'review-only-not-promoted',
				decision: 'preserve-all-v9-frame-pixels-outside-bounded-s-badge-tip-patch',
				deferred: ['traces-of-previous-frame-inside-accepted-frame'],
				source: { path: SOURCE_PATH, contentHash: sha256(providerSource) },
				sourceProvenance: {
					kind: 'imagegen-review-source',
					generationAttemptCount: 2,
					retainedAttempt: 2,
					firstAttemptDisposition: 'rejected-broad-redraw',
					exactPrompt: IMAGEGEN_EXACT_PROMPT,
					productionEligibility: 'review-only; not an ordinary v2 production packet'
				},
				baseFrame: { path: FRAME_PATH, contentHash: sha256(frame) },
				patchPolygon: PATCH_POLYGON,
				repairAudit: repaired.audit,
				repairedFrame: { path: frameOutputPath, contentHash: sha256(repaired.bytes) },
				candidate: { path: candidateOutputPath, contentHash: sha256(candidate) },
				inspection: {
					baseCompositePreservedOutsidePatch: repaired.audit.changedOutsidePatch === 0,
					baseFrameVisiblePixelsPreserved: repaired.audit.changedPixels === repaired.audit.addedVisiblePixels,
					addedBadgeTipPixels: repaired.audit.addedVisiblePixels
				},
				allRankV9BoundaryAudit: rankAudit,
				reviewFiles
			},
			null,
			'\t'
		)}\n`
	);
	const outputs = [
		{ path: frameOutputPath, bytes: repaired.bytes },
		{ path: candidateOutputPath, bytes: candidate },
		{ path: `${REVIEW_ROOT}/comparison-384.png`, bytes: comparison384 },
		{ path: `${REVIEW_ROOT}/comparison-96.png`, bytes: comparison96 },
		{ path: reportPath, bytes: report }
	];
	const written: string[] = [];
	for (const output of outputs)
		if (await syncCreateOnly(repositoryRoot, output.path, output.bytes, options.mode))
			written.push(output.path);
	return { written, reviewFiles };
}

function parseArgs(args: readonly string[]): Mode {
	const normalized = args[0] === '--' ? args.slice(1) : args;
	if (normalized.length !== 1 || !['--write', '--check'].includes(normalized[0]!))
		throw new Error('Usage: tsx tools/render-skill-icon-badge-tip-review.ts --write|--check');
	return normalized[0] === '--write' ? 'write' : 'check';
}

if (
	process.argv[1] !== undefined &&
	path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
	const mode = parseArgs(process.argv.slice(2));
	const result = await renderSkillIconBadgeTipReview({ mode });
	console.log(`${mode}: ${result.reviewFiles.length} review files; ${result.written.length} written`);
}
