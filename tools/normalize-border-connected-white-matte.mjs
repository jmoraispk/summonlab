import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const USAGE =
	'Usage: node tools/normalize-border-connected-white-matte.mjs --input <raw.png> --output <derived.png> --minimum-channel <0-255> --maximum-chroma <0-255>';

export function normalizeBorderConnectedWhiteMatte(
	pixels,
	width,
	height,
	{ minimumChannel, maximumChroma, channels = 4 }
) {
	if (channels !== 3 && channels !== 4) {
		throw new Error('Expected RGB or RGBA input channels.');
	}
	if (!Buffer.isBuffer(pixels) || pixels.length !== width * height * channels) {
		throw new Error('Expected one RGB/RGBA byte buffer matching the declared dimensions.');
	}
	if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
		throw new Error('Image dimensions must be positive integers.');
	}
	for (const [name, value] of [
		['minimumChannel', minimumChannel],
		['maximumChroma', maximumChroma]
	]) {
		if (!Number.isInteger(value) || value < 0 || value > 255) {
			throw new Error(`${name} must be an integer from 0 through 255.`);
		}
	}

	const pixelCount = width * height;
	const qualifies = new Uint8Array(pixelCount);
	for (let pixel = 0; pixel < pixelCount; pixel += 1) {
		const offset = pixel * channels;
		const red = pixels[offset];
		const green = pixels[offset + 1];
		const blue = pixels[offset + 2];
		const minimum = Math.min(red, green, blue);
		const maximum = Math.max(red, green, blue);
		if (
			(channels === 3 || pixels[offset + 3] === 255) &&
			minimum >= minimumChannel &&
			maximum - minimum <= maximumChroma
		) {
			qualifies[pixel] = 1;
		}
	}

	const connected = new Uint8Array(pixelCount);
	const queue = new Uint32Array(pixelCount);
	let queueHead = 0;
	let queueTail = 0;
	const enqueue = (pixel) => {
		if (!qualifies[pixel] || connected[pixel]) return;
		connected[pixel] = 1;
		queue[queueTail] = pixel;
		queueTail += 1;
	};
	for (let x = 0; x < width; x += 1) {
		enqueue(x);
		enqueue((height - 1) * width + x);
	}
	for (let y = 1; y < height - 1; y += 1) {
		enqueue(y * width);
		enqueue(y * width + width - 1);
	}
	while (queueHead < queueTail) {
		const pixel = queue[queueHead];
		queueHead += 1;
		const x = pixel % width;
		if (x > 0) enqueue(pixel - 1);
		if (x + 1 < width) enqueue(pixel + 1);
		if (pixel >= width) enqueue(pixel - width);
		if (pixel + width < pixelCount) enqueue(pixel + width);
	}

	const data = Buffer.from(pixels);
	let changedPixels = 0;
	for (let pixel = 0; pixel < pixelCount; pixel += 1) {
		if (!connected[pixel]) continue;
		const offset = pixel * channels;
		if (data[offset] !== 255 || data[offset + 1] !== 255 || data[offset + 2] !== 255) {
			changedPixels += 1;
			data[offset] = 255;
			data[offset + 1] = 255;
			data[offset + 2] = 255;
		}
	}
	return {
		data,
		connectedPixels: queueTail,
		changedPixels,
		unchangedPixels: pixelCount - changedPixels
	};
}

function parseArguments(argv) {
	if (argv.length !== 8) throw new Error(USAGE);
	const allowed = new Set(['--input', '--output', '--minimum-channel', '--maximum-chroma']);
	const values = new Map();
	for (let index = 0; index < argv.length; index += 2) {
		const flag = argv[index];
		const value = argv[index + 1];
		if (!allowed.has(flag) || values.has(flag) || !value || value.startsWith('--')) {
			throw new Error(USAGE);
		}
		values.set(flag, value);
	}
	if (values.size !== allowed.size) throw new Error(USAGE);
	const minimumChannel = Number(values.get('--minimum-channel'));
	const maximumChroma = Number(values.get('--maximum-chroma'));
	for (const [name, value] of [
		['minimum channel', minimumChannel],
		['maximum chroma', maximumChroma]
	]) {
		if (!Number.isInteger(value) || value < 0 || value > 255) {
			throw new Error(`${name} must be an integer from 0 through 255.`);
		}
	}
	return {
		inputPath: path.resolve(values.get('--input')),
		outputPath: path.resolve(values.get('--output')),
		minimumChannel,
		maximumChroma
	};
}

async function main() {
	const options = parseArguments(process.argv.slice(2));
	if (options.inputPath === options.outputPath) {
		throw new Error('Raw input and derived output paths must differ.');
	}
	const inputBytes = await readFile(options.inputPath);
	const input = sharp(inputBytes, { failOn: 'warning' });
	const metadata = await input.metadata();
	if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
		throw new Error('Input must be a readable PNG with positive dimensions.');
	}
	const { data, info } = await input.raw().toBuffer({ resolveWithObject: true });
	const normalized = normalizeBorderConnectedWhiteMatte(data, info.width, info.height, {
		...options,
		channels: info.channels
	});
	await mkdir(path.dirname(options.outputPath), { recursive: true });
	const outputBytes = await sharp(normalized.data, {
		raw: { width: info.width, height: info.height, channels: info.channels }
	})
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();
	await writeFile(options.outputPath, outputBytes);
	process.stdout.write(
		`${JSON.stringify({
			inputPath: options.inputPath,
			outputPath: options.outputPath,
			width: info.width,
			height: info.height,
			minimumChannel: options.minimumChannel,
			maximumChroma: options.maximumChroma,
			connectedPixels: normalized.connectedPixels,
			changedPixels: normalized.changedPixels,
			unchangedPixels: normalized.unchangedPixels,
			inputSha256: createHash('sha256').update(inputBytes).digest('hex'),
			outputSha256: createHash('sha256').update(outputBytes).digest('hex')
		})}\n`
	);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
