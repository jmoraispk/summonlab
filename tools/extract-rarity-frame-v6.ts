import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';

import sharp from 'sharp';

const repository = resolve(import.meta.dirname, '..');
const sourceSheet = join(
	repository,
	'assets/wiki/skills/rarity-frame-v6/calibration/seven-rarity-frames-4x3-tight-v2.png'
);
const iconSource = join(
	repository,
	'assets/wiki/skills/skill-art-v1/sources/measured-cut-provider-v1.png'
);
const outputRoot = join(repository, 'assets/wiki/skills/rarity-frame-v6/candidates');
const frameRoot = join(outputRoot, 'individuals');
const compositeRoot = join(outputRoot, 'measured-cut');
const iconOutput = join(repository, 'assets/wiki/skills/skill-art-v1/candidates/measured-cut.png');
const reviewRoot = join(repository, 'assets/wiki/skills/rarity-frame-v6/review');
const manifestPath = join(outputRoot, 'manifest.json');

const canvasSize = 1024;
const ranks = ['f', 'e', 'd', 'c', 'b', 'a', 's'] as const;
type Rank = (typeof ranks)[number];

type Region = { left: number; top: number; width: number; height: number };
type Raster = { data: Buffer; width: number; height: number };
type Extracted = Raster & { bounds: [number, number, number, number] };

const regions: Record<Rank, Region> = {
	f: { left: 40, top: 65, width: 385, height: 465 },
	e: { left: 400, top: 65, width: 380, height: 465 },
	d: { left: 760, top: 65, width: 380, height: 465 },
	c: { left: 1115, top: 65, width: 390, height: 465 },
	b: { left: 180, top: 495, width: 410, height: 480 },
	a: { left: 560, top: 495, width: 415, height: 480 },
	s: { left: 950, top: 490, width: 430, height: 485 }
};

const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

function isCheckerMatte(data: Buffer, offset: number): boolean {
	const red = data[offset];
	const green = data[offset + 1];
	const blue = data[offset + 2];
	const minimum = Math.min(red, green, blue);
	const maximum = Math.max(red, green, blue);
	return minimum >= 236 && maximum - minimum <= 14;
}

function exteriorBackground(raster: Raster): Uint8Array {
	const { data, width, height } = raster;
	const background = new Uint8Array(width * height);
	const queue = new Int32Array(width * height);
	let head = 0;
	let tail = 0;
	const enqueue = (x: number, y: number): void => {
		const index = y * width + x;
		if (background[index] || !isCheckerMatte(data, index * 3)) return;
		background[index] = 1;
		queue[tail++] = index;
	};
	for (let x = 0; x < width; x += 1) {
		enqueue(x, 0);
		enqueue(x, height - 1);
	}
	for (let y = 0; y < height; y += 1) {
		enqueue(0, y);
		enqueue(width - 1, y);
	}
	while (head < tail) {
		const index = queue[head++];
		const x = index % width;
		const y = Math.floor(index / width);
		if (x > 0) enqueue(x - 1, y);
		if (x + 1 < width) enqueue(x + 1, y);
		if (y > 0) enqueue(x, y - 1);
		if (y + 1 < height) enqueue(x, y + 1);
	}
	return background;
}

function componentMask(
	raster: Raster,
	background: Uint8Array,
	mode: 'center' | 'all-material'
): Uint8Array {
	const { data, width, height } = raster;
	const visited = new Uint8Array(width * height);
	const retained = new Uint8Array(width * height);
	const queue = new Int32Array(width * height);
	const components: number[][] = [];
	for (let seed = 0; seed < width * height; seed += 1) {
		if (background[seed] || visited[seed]) continue;
		let head = 0;
		let tail = 0;
		const component: number[] = [];
		visited[seed] = 1;
		queue[tail++] = seed;
		while (head < tail) {
			const index = queue[head++];
			component.push(index);
			const x = index % width;
			const y = Math.floor(index / width);
			for (const adjacent of [
				x > 0 ? index - 1 : -1,
				x + 1 < width ? index + 1 : -1,
				y > 0 ? index - width : -1,
				y + 1 < height ? index + width : -1
			]) {
				if (adjacent < 0 || background[adjacent] || visited[adjacent]) continue;
				visited[adjacent] = 1;
				queue[tail++] = adjacent;
			}
		}
		components.push(component);
	}

	if (mode === 'center') {
		const center = Math.floor(height / 2) * width + Math.floor(width / 2);
		const selected =
			components.find((component) => component.includes(center)) ??
			components.toSorted((left, right) => right.length - left.length)[0];
		for (const index of selected ?? []) retained[index] = 255;
		return retained;
	}

	for (const component of components) {
		if (component.length < 6) continue;
		const colorful = component.some((index) => {
			const offset = index * 3;
			const channels = [data[offset], data[offset + 1], data[offset + 2]];
			return Math.max(...channels) - Math.min(...channels) > 18;
		});
		if (component.length < 24 && !colorful) continue;
		for (const index of component) retained[index] = 255;
	}
	return retained;
}

function extract(raster: Raster, mode: 'center' | 'all-material'): Extracted {
	const background = exteriorBackground(raster);
	const alpha = componentMask(raster, background, mode);
	let left = raster.width;
	let top = raster.height;
	let right = -1;
	let bottom = -1;
	for (let y = 0; y < raster.height; y += 1) {
		for (let x = 0; x < raster.width; x += 1) {
			if (!alpha[y * raster.width + x]) continue;
			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = Math.max(bottom, y);
		}
	}
	if (right < left || bottom < top) throw new Error('No foreground survived checker extraction');
	left = Math.max(0, left - 2);
	top = Math.max(0, top - 2);
	right = Math.min(raster.width - 1, right + 2);
	bottom = Math.min(raster.height - 1, bottom + 2);
	const width = right - left + 1;
	const height = bottom - top + 1;
	const rgba = Buffer.alloc(width * height * 4);
	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const sourceIndex = (top + y) * raster.width + left + x;
			const sourceOffset = sourceIndex * 3;
			const targetOffset = (y * width + x) * 4;
			const opacity = alpha[sourceIndex];
			rgba[targetOffset] = opacity ? raster.data[sourceOffset] : 0;
			rgba[targetOffset + 1] = opacity ? raster.data[sourceOffset + 1] : 0;
			rgba[targetOffset + 2] = opacity ? raster.data[sourceOffset + 2] : 0;
			rgba[targetOffset + 3] = opacity;
		}
	}
	return { data: rgba, width, height, bounds: [left, top, right + 1, bottom + 1] };
}

async function cropRgb(source: string, region?: Region): Promise<Raster> {
	let pipeline = sharp(source).removeAlpha();
	if (region) pipeline = pipeline.extract(region);
	const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
	if (info.channels !== 3)
		throw new Error(`Expected RGB source, received ${info.channels} channels`);
	return { data, width: info.width, height: info.height };
}

async function placeOnCanvas(
	extracted: Extracted,
	maxWidth: number,
	maxHeight: number,
	scale?: number
): Promise<Buffer> {
	const commonScale = scale ?? Math.min(maxWidth / extracted.width, maxHeight / extracted.height);
	const width = Math.max(1, Math.round(extracted.width * commonScale));
	const height = Math.max(1, Math.round(extracted.height * commonScale));
	const resized = await sharp(extracted.data, {
		raw: { width: extracted.width, height: extracted.height, channels: 4 }
	})
		.resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.png()
		.toBuffer();
	return sharp({
		create: { width: canvasSize, height: canvasSize, channels: 4, background: '#00000000' }
	})
		.composite([
			{
				input: resized,
				left: Math.floor((canvasSize - width) / 2),
				top: Math.floor((canvasSize - height) / 2)
			}
		])
		.png({ compressionLevel: 9 })
		.toBuffer();
}

async function contactSheet(images: Buffer[], destination: string): Promise<void> {
	const cell = 340;
	const width = cell * 4;
	const height = cell * 2;
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
	await sharp({ create: { width, height, channels: 4, background: '#070707ff' } })
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
		mkdir(frameRoot, { recursive: true }),
		mkdir(compositeRoot, { recursive: true }),
		mkdir(dirname(iconOutput), { recursive: true }),
		mkdir(reviewRoot, { recursive: true })
	]);

	const extractedFrames = new Map<Rank, Extracted>();
	for (const rank of ranks) {
		extractedFrames.set(rank, extract(await cropRgb(sourceSheet, regions[rank]), 'center'));
	}
	const maximumWidth = Math.max(...[...extractedFrames.values()].map((frame) => frame.width));
	const maximumHeight = Math.max(...[...extractedFrames.values()].map((frame) => frame.height));
	const sharedScale = Math.min(880 / maximumWidth, 910 / maximumHeight);
	const frameBuffers: Buffer[] = [];
	for (const rank of ranks) {
		const frame = await placeOnCanvas(extractedFrames.get(rank)!, 880, 910, sharedScale);
		frameBuffers.push(frame);
		await writeFile(join(frameRoot, `${rank}.png`), frame);
	}

	const extractedIcon = extract(await cropRgb(iconSource), 'all-material');
	const icon = await placeOnCanvas(extractedIcon, 560, 560);
	await writeFile(iconOutput, icon);

	const compositeBuffers: Buffer[] = [];
	for (let index = 0; index < ranks.length; index += 1) {
		const composite = await sharp(frameBuffers[index])
			.composite([{ input: icon, blend: 'over' }])
			.png({ compressionLevel: 9 })
			.toBuffer();
		compositeBuffers.push(composite);
		await writeFile(join(compositeRoot, `${ranks[index]}.png`), composite);
	}

	await Promise.all([
		contactSheet(frameBuffers, join(reviewRoot, 'individual-frames.png')),
		contactSheet(compositeBuffers, join(reviewRoot, 'measured-cut-all-rarities.png')),
		recognitionSheet(compositeBuffers, join(reviewRoot, 'measured-cut-recognition-96.png'))
	]);

	const sourceSheetBytes = await readFile(sourceSheet);
	const iconSourceBytes = await readFile(iconSource);
	const records = await Promise.all(
		ranks.map(async (rank, index) => {
			const framePath = join(frameRoot, `${rank}.png`);
			const compositePath = join(compositeRoot, `${rank}.png`);
			return {
				rank: rank.toUpperCase(),
				sourceRegion: regions[rank],
				extractedBoundsWithinRegion: extractedFrames.get(rank)!.bounds,
				frame: relative(repository, framePath),
				frameContentHash: sha256(frameBuffers[index]),
				composite: relative(repository, compositePath),
				compositeContentHash: sha256(compositeBuffers[index])
			};
		})
	);
	const manifest = {
		schemaVersion: 'rarity-frame-v6-extraction-v1',
		status: 'review-candidate',
		sourceSheet: relative(repository, sourceSheet),
		sourceSheetContentHash: sha256(sourceSheetBytes),
		iconSource: relative(repository, iconSource),
		iconSourceContentHash: sha256(iconSourceBytes),
		icon: relative(repository, iconOutput),
		iconContentHash: sha256(icon),
		canvas: { width: canvasSize, height: canvasSize, format: 'png', channels: 4 },
		sharedFrameScale: sharedScale,
		review: {
			individualFrames: {
				path: relative(repository, join(reviewRoot, 'individual-frames.png')),
				contentHash: sha256(await readFile(join(reviewRoot, 'individual-frames.png')))
			},
			measuredCutAllRarities: {
				path: relative(repository, join(reviewRoot, 'measured-cut-all-rarities.png')),
				contentHash: sha256(await readFile(join(reviewRoot, 'measured-cut-all-rarities.png')))
			},
			measuredCutRecognition96: {
				path: relative(repository, join(reviewRoot, 'measured-cut-recognition-96.png')),
				contentHash: sha256(await readFile(join(reviewRoot, 'measured-cut-recognition-96.png')))
			}
		},
		records
	};
	await writeFile(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`);
}

async function check(): Promise<void> {
	const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
		sourceSheetContentHash: string;
		iconSourceContentHash: string;
		iconContentHash: string;
		review: Record<string, { path: string; contentHash: string }>;
		records: Array<{
			rank: string;
			frame: string;
			frameContentHash: string;
			composite: string;
			compositeContentHash: string;
		}>;
	};
	const verify = async (path: string, expected: string): Promise<void> => {
		const bytes = await readFile(path);
		if (sha256(bytes) !== expected)
			throw new Error(`Content hash mismatch: ${relative(repository, path)}`);
		const metadata = await sharp(bytes).metadata();
		if (
			metadata.width !== canvasSize ||
			metadata.height !== canvasSize ||
			metadata.channels !== 4
		) {
			throw new Error(`Invalid RGBA canvas: ${relative(repository, path)}`);
		}
		const pixels = await sharp(bytes).ensureAlpha().raw().toBuffer();
		const cornerIndexes = [
			3,
			(canvasSize - 1) * 4 + 3,
			canvasSize * (canvasSize - 1) * 4 + 3,
			(canvasSize * canvasSize - 1) * 4 + 3
		];
		if (cornerIndexes.some((index) => pixels[index] !== 0)) {
			throw new Error(`Canvas corners are not transparent: ${relative(repository, path)}`);
		}
	};
	if (sha256(await readFile(sourceSheet)) !== manifest.sourceSheetContentHash) {
		throw new Error('Canonical source-sheet hash changed');
	}
	if (sha256(await readFile(iconSource)) !== manifest.iconSourceContentHash) {
		throw new Error('Measured Cut provider-source hash changed');
	}
	await verify(iconOutput, manifest.iconContentHash);
	for (const record of manifest.records) {
		await verify(join(repository, record.frame), record.frameContentHash);
		await verify(join(repository, record.composite), record.compositeContentHash);
	}
	for (const review of Object.values(manifest.review)) {
		if (sha256(await readFile(join(repository, review.path))) !== review.contentHash) {
			throw new Error(`Review content hash mismatch: ${review.path}`);
		}
	}
	console.log('seven RGBA rarity-frame crops, one skill emblem, and seven composites pass');
}

const mode = process.argv[2];
if (mode === '--write') await build();
else if (mode === '--check') await check();
else throw new Error('Usage: tsx tools/extract-rarity-frame-v6.ts --write|--check');
