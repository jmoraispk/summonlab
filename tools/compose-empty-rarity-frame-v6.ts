import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import sharp from 'sharp';

const repository = resolve(import.meta.dirname, '..');
const canvasSize = 1024;
const ranks = ['f', 'e', 'd', 'c', 'b', 'a', 's'] as const;

const geometryPath = join(repository, 'assets/wiki/skills/icon-production-v1/geometry-v2.json');
const sourceFrameRoot = join(
	repository,
	'assets/wiki/skills/rarity-frame-v6/candidates/individuals'
);
const sourceIcon = join(repository, 'assets/wiki/skills/skill-art-v1/candidates/measured-cut.png');
const outputRoot = join(repository, 'assets/wiki/skills/rarity-frame-v6/candidates');
const emptyFrameRoot = join(outputRoot, 'empty-individuals');
const compositeRoot = join(outputRoot, 'layered-measured-cut');
const backingOutput = join(outputRoot, 'charcoal-forged-stone-backing.png');
const safeIconOutput = join(
	repository,
	'assets/wiki/skills/skill-art-v1/candidates/measured-cut-safe-v2.png'
);
const reviewRoot = join(repository, 'assets/wiki/skills/rarity-frame-v6/review');
const manifestPath = join(outputRoot, 'empty-layer-manifest.json');

type Geometry = {
	center: { x: number; y: number };
	aperturePoints: Array<[number, number]>;
	innerApertureScale: number;
	subjectSafePercent: number;
	effectSafePercent: number;
};

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

function scaledPoints(points: Array<[number, number]>): Array<[number, number]> {
	return points.map(([x, y]) => [x * canvasSize, y * canvasSize]);
}

function insetPoints(
	points: Array<[number, number]>,
	center: [number, number],
	scale: number
): Array<[number, number]> {
	return points.map(([x, y]) => [
		center[0] + (x - center[0]) * scale,
		center[1] + (y - center[1]) * scale
	]);
}

async function polygonMask(points: Array<[number, number]>): Promise<Buffer> {
	const serialized = points.map(([x, y]) => `${x},${y}`).join(' ');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}"><polygon points="${serialized}" fill="#fff"/></svg>`;
	const { data, info } = await sharp(Buffer.from(svg))
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (info.channels !== 1) throw new Error('Polygon mask did not render as one channel');
	return data;
}

async function circleMask(radius: number): Promise<Buffer> {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasSize}" height="${canvasSize}" viewBox="0 0 ${canvasSize} ${canvasSize}"><circle cx="512" cy="512" r="${radius}" fill="#fff"/></svg>`;
	const { data, info } = await sharp(Buffer.from(svg))
		.greyscale()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (info.channels !== 1) throw new Error('Circle mask did not render as one channel');
	return data;
}

async function applyMask(
	image: Buffer,
	mask: Buffer,
	operation: 'keep' | 'remove'
): Promise<Buffer> {
	const { data, info } = await sharp(image)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	if (info.width !== canvasSize || info.height !== canvasSize || info.channels !== 4) {
		throw new Error('Mask input must be a 1024×1024 RGBA image');
	}
	for (let index = 0; index < canvasSize * canvasSize; index += 1) {
		const offset = index * 4;
		const maskAlpha = operation === 'keep' ? mask[index] : 255 - mask[index];
		data[offset + 3] = Math.round((data[offset + 3] * maskAlpha) / 255);
		if (data[offset + 3] === 0) {
			data[offset] = 0;
			data[offset + 1] = 0;
			data[offset + 2] = 0;
		}
	}
	return sharp(data, { raw: { width: canvasSize, height: canvasSize, channels: 4 } })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function safeIcon(source: Buffer, mask: Buffer): Promise<Buffer> {
	const trimmed = await sharp(source).trim({ background: '#00000000' }).png().toBuffer();
	const resized = await sharp(trimmed)
		.resize(460, 460, { fit: 'inside', kernel: sharp.kernel.lanczos3 })
		.png()
		.toBuffer();
	const metadata = await sharp(resized).metadata();
	const centered = await sharp({
		create: { width: canvasSize, height: canvasSize, channels: 4, background: '#00000000' }
	})
		.composite([
			{
				input: resized,
				left: Math.floor((canvasSize - metadata.width!) / 2),
				top: Math.floor((canvasSize - metadata.height!) / 2)
			}
		])
		.png({ compressionLevel: 9 })
		.toBuffer();
	return applyMask(centered, mask, 'keep');
}

async function universalBacking(frame: Buffer, apertureMask: Buffer): Promise<Buffer> {
	const texture = await sharp(frame)
		.extract({ left: 352, top: 352, width: 320, height: 320 })
		.resize(canvasSize, canvasSize, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.removeAlpha()
		.raw()
		.toBuffer();
	const rgba = Buffer.alloc(canvasSize * canvasSize * 4);
	for (let index = 0; index < canvasSize * canvasSize; index += 1) {
		const sourceOffset = index * 3;
		const targetOffset = index * 4;
		rgba[targetOffset] = texture[sourceOffset];
		rgba[targetOffset + 1] = texture[sourceOffset + 1];
		rgba[targetOffset + 2] = texture[sourceOffset + 2];
		rgba[targetOffset + 3] = apertureMask[index];
	}
	return sharp(rgba, { raw: { width: canvasSize, height: canvasSize, channels: 4 } })
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function contactSheet(
	images: Buffer[],
	destination: string,
	background: string
): Promise<void> {
	const cell = 340;
	const composites = await Promise.all(
		images.map(async (image, index) => {
			const resized = await sharp(image)
				.resize(312, 312, { fit: 'contain', kernel: sharp.kernel.lanczos3 })
				.png()
				.toBuffer();
			const row = index < 4 ? 0 : 1;
			const column = index < 4 ? index : index - 3.5;
			return { input: resized, left: Math.round(column * cell + 14), top: row * cell + 14 };
		})
	);
	await sharp({
		create: { width: cell * 4, height: cell * 2, channels: 4, background }
	})
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toFile(destination);
}

async function recognitionSheet(images: Buffer[], destination: string): Promise<void> {
	const cell = 128;
	const composites = await Promise.all(
		images.map(async (image, index) => ({
			input: await sharp(image)
				.resize(96, 96, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
				.png()
				.toBuffer(),
			left: index * cell + 16,
			top: 16
		}))
	);
	await sharp({
		create: { width: cell * images.length, height: cell, channels: 4, background: '#070707ff' }
	})
		.composite(composites)
		.png({ compressionLevel: 9 })
		.toFile(destination);
}

async function build(): Promise<void> {
	await Promise.all([
		mkdir(emptyFrameRoot, { recursive: true }),
		mkdir(compositeRoot, { recursive: true }),
		mkdir(reviewRoot, { recursive: true })
	]);
	const geometryBytes = await readFile(geometryPath);
	const geometry = JSON.parse(geometryBytes.toString('utf8')) as Geometry;
	const aperturePoints = scaledPoints(geometry.aperturePoints);
	const innerAperturePoints = insetPoints(
		aperturePoints,
		[geometry.center.x, geometry.center.y],
		geometry.innerApertureScale
	);
	const innerApertureMask = await polygonMask(innerAperturePoints);
	const backingPoints = insetPoints(
		innerAperturePoints,
		[geometry.center.x, geometry.center.y],
		1.08
	);
	const backingMask = await polygonMask(backingPoints);
	const subjectMask = await circleMask((canvasSize * geometry.subjectSafePercent) / 200);
	const iconSafeMask = Buffer.alloc(canvasSize * canvasSize);
	for (let index = 0; index < iconSafeMask.length; index += 1) {
		iconSafeMask[index] = Math.min(innerApertureMask[index], subjectMask[index]);
	}

	const sourceIconBytes = await readFile(sourceIcon);
	const icon = await safeIcon(sourceIconBytes, iconSafeMask);
	await writeFile(safeIconOutput, icon);

	const sourceFrameBuffers = await Promise.all(
		ranks.map((rank) => readFile(join(sourceFrameRoot, `${rank}.png`)))
	);
	const emptyFrameBuffers = await Promise.all(
		sourceFrameBuffers.map((frame) => applyMask(frame, innerApertureMask, 'remove'))
	);
	for (let index = 0; index < ranks.length; index += 1) {
		await writeFile(join(emptyFrameRoot, `${ranks[index]}.png`), emptyFrameBuffers[index]);
	}

	const backing = await universalBacking(sourceFrameBuffers[3], backingMask);
	await writeFile(backingOutput, backing);

	const compositeBuffers = await Promise.all(
		emptyFrameBuffers.map((frame) =>
			sharp({
				create: {
					width: canvasSize,
					height: canvasSize,
					channels: 4,
					background: '#00000000'
				}
			})
				.composite([
					{ input: backing, blend: 'over' },
					{ input: icon, blend: 'over' },
					{ input: frame, blend: 'over' }
				])
				.png({ compressionLevel: 9 })
				.toBuffer()
		)
	);
	for (let index = 0; index < ranks.length; index += 1) {
		await writeFile(join(compositeRoot, `${ranks[index]}.png`), compositeBuffers[index]);
	}

	const emptyReviewPath = join(reviewRoot, 'empty-individual-frames.png');
	const compositeReviewPath = join(reviewRoot, 'layered-measured-cut-all-rarities.png');
	const recognitionPath = join(reviewRoot, 'layered-measured-cut-recognition-96.png');
	await Promise.all([
		contactSheet(emptyFrameBuffers, emptyReviewPath, '#4a5260ff'),
		contactSheet(compositeBuffers, compositeReviewPath, '#070707ff'),
		recognitionSheet(compositeBuffers, recognitionPath)
	]);

	const records = ranks.map((rank, index) => ({
		rank: rank.toUpperCase(),
		sourceFrame: relative(repository, join(sourceFrameRoot, `${rank}.png`)),
		sourceFrameContentHash: sha256(sourceFrameBuffers[index]),
		emptyFrame: relative(repository, join(emptyFrameRoot, `${rank}.png`)),
		emptyFrameContentHash: sha256(emptyFrameBuffers[index]),
		composite: relative(repository, join(compositeRoot, `${rank}.png`)),
		compositeContentHash: sha256(compositeBuffers[index])
	}));
	const manifest = {
		schemaVersion: 'rarity-frame-v6-empty-layer-v1',
		status: 'review-candidate',
		geometry: relative(repository, geometryPath),
		geometryContentHash: sha256(geometryBytes),
		canvas: { width: canvasSize, height: canvasSize, format: 'png', channels: 4 },
		layerOrder: ['backing', 'skill-art', 'rarity-frame'],
		subjectSafePercent: geometry.subjectSafePercent,
		effectSafePercent: geometry.effectSafePercent,
		backing: relative(repository, backingOutput),
		backingContentHash: sha256(backing),
		safeIcon: relative(repository, safeIconOutput),
		safeIconContentHash: sha256(icon),
		review: {
			emptyFrames: {
				path: relative(repository, emptyReviewPath),
				contentHash: sha256(await readFile(emptyReviewPath))
			},
			composites: {
				path: relative(repository, compositeReviewPath),
				contentHash: sha256(await readFile(compositeReviewPath))
			},
			recognition96: {
				path: relative(repository, recognitionPath),
				contentHash: sha256(await readFile(recognitionPath))
			}
		},
		records
	};
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
}

async function check(): Promise<void> {
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
		geometryContentHash: string;
		backing: string;
		backingContentHash: string;
		safeIcon: string;
		safeIconContentHash: string;
		review: Record<string, { path: string; contentHash: string }>;
		records: Array<{
			sourceFrame: string;
			sourceFrameContentHash: string;
			emptyFrame: string;
			emptyFrameContentHash: string;
			composite: string;
			compositeContentHash: string;
		}>;
	};
	if (sha256(await readFile(geometryPath)) !== manifest.geometryContentHash) {
		throw new Error('Geometry authority hash changed');
	}
	const verifyHash = async (path: string, expected: string): Promise<Buffer> => {
		const bytes = await readFile(join(repository, path));
		if (sha256(bytes) !== expected) throw new Error(`Content hash mismatch: ${path}`);
		return bytes;
	};
	const verifyCanvas = async (
		path: string,
		expected: string,
		center: 'transparent' | 'opaque' | 'either'
	): Promise<void> => {
		const bytes = await verifyHash(path, expected);
		const { data, info } = await sharp(bytes)
			.ensureAlpha()
			.raw()
			.toBuffer({ resolveWithObject: true });
		if (info.width !== canvasSize || info.height !== canvasSize || info.channels !== 4) {
			throw new Error(`Invalid RGBA canvas: ${path}`);
		}
		for (const index of [0, canvasSize - 1, canvasSize * (canvasSize - 1), canvasSize ** 2 - 1]) {
			if (data[index * 4 + 3] !== 0) throw new Error(`Canvas corner is opaque: ${path}`);
		}
		const centerAlpha = data[geometryCenterIndex() * 4 + 3];
		if (center === 'transparent' && centerAlpha !== 0) {
			throw new Error(`Frame center is not transparent: ${path}`);
		}
		if (center === 'opaque' && centerAlpha !== 255) {
			throw new Error(`Layer center is not opaque: ${path}`);
		}
	};
	await verifyCanvas(manifest.backing, manifest.backingContentHash, 'opaque');
	await verifyCanvas(manifest.safeIcon, manifest.safeIconContentHash, 'either');
	for (const record of manifest.records) {
		await verifyHash(record.sourceFrame, record.sourceFrameContentHash);
		await verifyCanvas(record.emptyFrame, record.emptyFrameContentHash, 'transparent');
		await verifyCanvas(record.composite, record.compositeContentHash, 'opaque');
	}
	for (const review of Object.values(manifest.review)) {
		await verifyHash(review.path, review.contentHash);
	}
	console.log('seven empty frames, one backing, one safe icon, and seven layered composites pass');
}

function geometryCenterIndex(): number {
	return Math.floor(canvasSize / 2) * canvasSize + Math.floor(canvasSize / 2);
}

const mode = process.argv[2];
if (mode === '--write') await build();
else if (mode === '--check') await check();
else throw new Error('Usage: tsx tools/compose-empty-rarity-frame-v6.ts --write|--check');
