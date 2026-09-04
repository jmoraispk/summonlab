import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

const PROVIDER_SIZE = 1254;
const WORKING_SIZE = 1024;
const SUBJECT_BOX = 560;
const RUN_ROOT = 'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3';
const REVIEW_PATH = `${RUN_ROOT}/owner-review.json`;
const SOURCE_PATH = `${RUN_ROOT}/provider-sources/martial-blade-reversal-cut-accepted-v2.png`;
const ACTIVATION_PATH = `${RUN_ROOT}/activation.json`;
const CANDIDATE_PATH = `${RUN_ROOT}/candidates/martial-blade-reversal-cut-activation-v2.png`;
const ART_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-reversal-cut.png';
const COMPOSITE_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/masters/composites/martial-blade-reversal-cut.png';
const RECOGNITION_PATH =
	'assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-reversal-cut.png';
const RUNTIME_PATHS = {
	512: 'apps/web/static/skill-icons/v1/512/martial-blade-reversal-cut.webp',
	256: 'apps/web/static/skill-icons/v1/256/martial-blade-reversal-cut.webp',
	128: 'apps/web/static/skill-icons/v1/128/martial-blade-reversal-cut.webp'
} as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const BoundFileSchema = z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict();
const ReviewSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-accepted-source-review-v1'),
		reviewId: z.literal('reversal-cut-corrected-source-review-v1'),
		targetId: z.literal('martial:blade:reversal-cut'),
		reviewer: z.string().trim().min(1),
		reviewerRole: z.literal('owner'),
		decision: z.literal('accepted'),
		reviewedAt: z.string().datetime(),
		rationale: z.string().trim().min(1),
		acceptedProviderSource: z
			.object({
				mediaType: z.literal('image/png'),
				width: z.literal(1254),
				height: z.literal(1254),
				alphaMode: z.literal('rgb'),
				bytes: z.number().int().positive(),
				contentHash: Sha256Schema
			})
			.strict(),
		failedProducerResult: BoundFileSchema,
		attemptEvidence: BoundFileSchema,
		catalog: BoundFileSchema,
		lineageAuthority: BoundFileSchema
	})
	.strict();

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

export async function assertAcceptedProviderSource(
	source: Buffer,
	expectedHash: string
): Promise<void> {
	if (sha256(source) !== expectedHash)
		throw new Error('Provider bytes do not match the owner-accepted provider source hash');
	const metadata = await sharp(source).metadata();
	if (
		metadata.format !== 'png' ||
		metadata.width !== PROVIDER_SIZE ||
		metadata.height !== PROVIDER_SIZE ||
		metadata.hasAlpha ||
		metadata.channels !== 3
	) {
		throw new Error(
			'Owner-accepted provider source must retain its exact 1254-square RGB PNG envelope'
		);
	}
}

function lightNeutral(red: number, green: number, blue: number): boolean {
	return (
		Math.min(red, green, blue) >= 210 &&
		Math.max(red, green, blue) - Math.min(red, green, blue) <= 24
	);
}

async function removeConnectedCheckerboard(source: Buffer): Promise<Buffer> {
	const { data, info } = await sharp(source)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (info.width !== PROVIDER_SIZE || info.height !== PROVIDER_SIZE || info.channels !== 4) {
		throw new Error('Accepted Reversal Cut source must decode to a 1254-square raster');
	}
	const pixelCount = info.width * info.height;
	const background = new Uint8Array(pixelCount);
	const queue = new Int32Array(pixelCount);
	let read = 0;
	let write = 0;
	const enqueue = (pixel: number): void => {
		if (background[pixel] === 1) return;
		const offset = pixel * 4;
		if (!lightNeutral(data[offset] ?? 0, data[offset + 1] ?? 0, data[offset + 2] ?? 0)) return;
		background[pixel] = 1;
		queue[write++] = pixel;
	};
	for (let x = 0; x < info.width; x += 1) {
		enqueue(x);
		enqueue((info.height - 1) * info.width + x);
	}
	for (let y = 1; y < info.height - 1; y += 1) {
		enqueue(y * info.width);
		enqueue(y * info.width + info.width - 1);
	}
	while (read < write) {
		const pixel = queue[read++] ?? 0;
		const x = pixel % info.width;
		if (pixel >= info.width) enqueue(pixel - info.width);
		if (pixel < pixelCount - info.width) enqueue(pixel + info.width);
		if (x > 0) enqueue(pixel - 1);
		if (x < info.width - 1) enqueue(pixel + 1);
	}
	for (let pixel = 0; pixel < pixelCount; pixel += 1) {
		if (background[pixel] === 1) data[pixel * 4 + 3] = 0;
	}
	return sharp(data, { raw: info })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

export async function normalizeAcceptedCheckerboardSkillArt(source: Buffer): Promise<Buffer> {
	const isolated = await removeConnectedCheckerboard(source);
	const trimmed = await sharp(isolated)
		.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
		.toBuffer();
	const fitted = await sharp(trimmed)
		.resize({
			width: SUBJECT_BOX,
			height: SUBJECT_BOX,
			fit: 'inside',
			kernel: sharp.kernel.lanczos3
		})
		.ensureAlpha()
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	const metadata = await sharp(fitted).metadata();
	if (!metadata.width || !metadata.height)
		throw new Error('Accepted Reversal Cut art has no fitted dimensions');
	const left = Math.round((WORKING_SIZE - metadata.width) / 2);
	const top = Math.round((WORKING_SIZE - metadata.height) / 2);
	const centered = await sharp({
		create: {
			width: WORKING_SIZE,
			height: WORKING_SIZE,
			channels: 4,
			background: { r: 0, g: 0, b: 0, alpha: 0 }
		}
	})
		.composite([{ input: fitted, left, top }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	const { data, info } = await sharp(centered)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	for (let y = 0; y < WORKING_SIZE; y += 1) {
		for (let x = 0; x < WORKING_SIZE; x += 1) {
			const insideCircle = Math.hypot(x - 512, y - 512) <= 360;
			const insideExclusion = x >= 420 && x < 604 && y < 220;
			if (!insideCircle || insideExclusion) data[(y * WORKING_SIZE + x) * 4 + 3] = 0;
		}
	}
	return sharp(data, { raw: info })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

function presentationSvg(): Buffer {
	return Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<radialGradient id="stone"><stop stop-color="#20242b"/><stop offset="0.7" stop-color="#101317"/><stop offset="1" stop-color="#07090c"/></radialGradient>
			<linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1c9"/><stop offset="0.35" stop-color="#c8a66b"/><stop offset="0.7" stop-color="#76552c"/><stop offset="1" stop-color="#ead8ae"/></linearGradient>
		</defs>
		<path d="M512 72 908 300 908 724 512 952 116 724 116 300Z" fill="url(#stone)" stroke="#17130e" stroke-width="58" stroke-linejoin="round"/>
		<path d="M512 72 908 300 908 724 512 952 116 724 116 300Z" fill="none" stroke="url(#gold)" stroke-width="42" stroke-linejoin="round"/>
		<path d="M512 98 884 312 884 712 512 926 140 712 140 312Z" fill="none" stroke="#f5e7c7" stroke-opacity=".72" stroke-width="8" stroke-linejoin="round"/>
		<path d="M512 121 864 324 864 700 512 903 160 700 160 324Z" fill="none" stroke="#84683c" stroke-width="7" stroke-linejoin="round"/>
		<g fill="url(#gold)" stroke="#2c2011" stroke-width="5">
			<path d="M512 20 594 66 594 158 512 205 430 158 430 66Z"/>
			<path d="M105 276 141 296 123 333 87 312Z"/><path d="M919 276 883 296 901 333 937 312Z"/>
			<path d="M105 748 141 728 123 691 87 712Z"/><path d="M919 748 883 728 901 691 937 712Z"/>
			<path d="M482 943 512 916 542 943 512 990Z"/>
		</g>
		<path d="M512 39 573 74 573 145 512 180 451 145 451 74Z" fill="#151515" stroke="#fff0c8" stroke-width="7"/>
		<text x="512" y="147" text-anchor="middle" font-family="Georgia,serif" font-size="104" fill="url(#gold)" stroke="#3d2d18" stroke-width="3">A</text>
	</svg>`);
}

export async function renderReversalCutRuntimeIcon(
	art: Buffer,
	size: 1024 | 512 | 256 | 128 | 96
): Promise<Buffer> {
	const composite = await sharp(presentationSvg())
		.composite([{ input: art, blend: 'over' }])
		.ensureAlpha()
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	const resized = sharp(composite)
		.resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.ensureAlpha();
	return size === 1024 || size === 96
		? resized.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false }).toBuffer()
		: resized.webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 6 }).toBuffer();
}

async function readBound(root: string, binding: z.infer<typeof BoundFileSchema>): Promise<Buffer> {
	if (path.isAbsolute(binding.path) || binding.path.split('/').includes('..')) {
		throw new Error(`Unsafe activation authority path ${binding.path}`);
	}
	const bytes = await readFile(path.join(root, binding.path));
	if (sha256(bytes) !== binding.contentHash)
		throw new Error(`Activation authority changed: ${binding.path}`);
	return bytes;
}

async function writeExact(destination: string, bytes: Buffer): Promise<boolean> {
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(bytes)) return false;
	if (current) throw new Error(`Refusing to replace differing activation output ${destination}`);
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, bytes, { flag: 'wx' });
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
	return true;
}

function asset(
	pathname: string,
	bytes: Buffer,
	mediaType: 'image/png' | 'image/webp',
	size: number
) {
	return {
		path: pathname,
		mediaType,
		width: size,
		height: size,
		alphaMode: 'rgba' as const,
		bytes: bytes.byteLength,
		contentHash: sha256(bytes)
	};
}

export async function activateReversalCutRuntimeIcon(options: {
	readonly root?: string;
	readonly mode: 'check' | 'write';
	readonly sourcePath?: string;
}): Promise<{
	readonly current: boolean;
	readonly written: readonly string[];
	readonly activationHash: string;
}> {
	const root = path.resolve(options.root ?? process.cwd());
	const reviewBytes = await readFile(path.join(root, REVIEW_PATH));
	const review = ReviewSchema.parse(JSON.parse(reviewBytes.toString('utf8')));
	await Promise.all([
		readBound(root, review.failedProducerResult),
		readBound(root, review.attemptEvidence),
		readBound(root, review.catalog),
		readBound(root, review.lineageAuthority)
	]);
	let source: Buffer;
	if (options.mode === 'write') {
		if (!options.sourcePath)
			throw new Error('--write requires --source with the accepted provider raster');
		const sourceMetadata = await lstat(path.resolve(options.sourcePath));
		if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink())
			throw new Error('Accepted provider source must be a regular file');
		source = await readFile(path.resolve(options.sourcePath));
	} else {
		source = await readFile(path.join(root, SOURCE_PATH));
	}
	await assertAcceptedProviderSource(source, review.acceptedProviderSource.contentHash);
	if (source.byteLength !== review.acceptedProviderSource.bytes)
		throw new Error('Owner review source byte count changed');

	const art = await normalizeAcceptedCheckerboardSkillArt(source);
	const geometry = JSON.parse(
		await readFile(path.join(root, 'assets/wiki/skills/icon-production-v1/geometry.json'), 'utf8')
	);
	const inspection = await inspectSkillIconAsset(art, 'skill-art', geometry);
	if (inspection.violations.length > 0) {
		throw new Error(`Normalized Reversal Cut art failed: ${inspection.violations.join('; ')}`);
	}
	const [composite, runtime512, runtime256, runtime128, recognition96] = await Promise.all([
		renderReversalCutRuntimeIcon(art, 1024),
		renderReversalCutRuntimeIcon(art, 512),
		renderReversalCutRuntimeIcon(art, 256),
		renderReversalCutRuntimeIcon(art, 128),
		renderReversalCutRuntimeIcon(art, 96)
	]);
	const outputs = [
		{ path: SOURCE_PATH, bytes: source },
		{ path: CANDIDATE_PATH, bytes: art },
		{ path: ART_MASTER_PATH, bytes: art },
		{ path: COMPOSITE_MASTER_PATH, bytes: composite },
		{ path: RUNTIME_PATHS[512], bytes: runtime512 },
		{ path: RUNTIME_PATHS[256], bytes: runtime256 },
		{ path: RUNTIME_PATHS[128], bytes: runtime128 },
		{ path: RECOGNITION_PATH, bytes: recognition96 }
	];
	const activation = {
		schemaVersion: 'skill-icon-accepted-source-activation-v1',
		activationId: 'martial-blade-reversal-cut-activation-v2',
		targetId: review.targetId,
		status: 'approved-runtime',
		normalizationProfile: 'skill-art-connected-checkerboard-safe-fit-v1',
		review: { path: REVIEW_PATH, contentHash: sha256(reviewBytes) },
		providerSource: {
			path: SOURCE_PATH,
			...review.acceptedProviderSource
		},
		candidate: asset(CANDIDATE_PATH, art, 'image/png', 1024),
		approvedArtMaster: asset(ART_MASTER_PATH, art, 'image/png', 1024),
		compositeMaster: asset(COMPOSITE_MASTER_PATH, composite, 'image/png', 1024),
		runtime: [
			asset(RUNTIME_PATHS[512], runtime512, 'image/webp', 512),
			asset(RUNTIME_PATHS[256], runtime256, 'image/webp', 256),
			asset(RUNTIME_PATHS[128], runtime128, 'image/webp', 128)
		],
		recognition: asset(RECOGNITION_PATH, recognition96, 'image/png', 96),
		inspection: {
			fullSize: 'pass',
			recognition96: 'accepted-by-owner-before-deterministic-normalization',
			subjectSafeCoverage: inspection.subjectSafeCoverage
		},
		selfPromoted: false
	};
	const activationBytes = jsonBytes(activation);
	outputs.push({ path: ACTIVATION_PATH, bytes: activationBytes });
	const written: string[] = [];
	for (const output of outputs) {
		const destination = path.join(root, output.path);
		if (options.mode === 'write') {
			if (await writeExact(destination, output.bytes)) written.push(output.path);
		} else {
			const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			});
			if (!current?.equals(output.bytes)) {
				return { current: false, written, activationHash: sha256(activationBytes) };
			}
		}
	}
	return { current: true, written, activationHash: sha256(activationBytes) };
}

function parseCli(args: readonly string[]): { mode: 'check' | 'write'; sourcePath?: string } {
	const normalizedArgs = args.filter((arg) => arg !== '--');
	if (normalizedArgs[0] === '--check' && normalizedArgs.length === 1) return { mode: 'check' };
	if (
		normalizedArgs[0] === '--write' &&
		normalizedArgs[1] === '--source' &&
		normalizedArgs[2] &&
		normalizedArgs.length === 3
	) {
		return { mode: 'write', sourcePath: normalizedArgs[2] };
	}
	throw new Error(
		'Usage: tsx tools/activate-reversal-cut-runtime-icon.ts --check | --write --source ABSOLUTE_PNG'
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	activateReversalCutRuntimeIcon(parseCli(process.argv.slice(2)))
		.then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
