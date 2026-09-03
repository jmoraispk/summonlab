import process from 'node:process';

import sharp from 'sharp';

const inputPaths = process.argv.slice(2);

if (inputPaths.length === 0) {
	console.error('Usage: node tools/key-checkerboard-background.mjs <png> [...]');
	process.exitCode = 1;
}

for (const inputPath of inputPaths) {
	const { data, info } = await sharp(inputPath)
		.removeAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const pixelCount = info.width * info.height;
	const background = new Uint8Array(pixelCount);

	const canKey = (pixelIndex) => {
		const offset = pixelIndex * info.channels;
		const red = data[offset];
		const green = data[offset + 1];
		const blue = data[offset + 2];
		const minimum = Math.min(red, green, blue);
		const maximum = Math.max(red, green, blue);
		return minimum >= 225 && maximum - minimum <= 32;
	};

	for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
		background[pixelIndex] = canKey(pixelIndex) ? 1 : 0;
	}

	const rgba = Buffer.alloc(pixelCount * 4);
	for (let pixelIndex = 0; pixelIndex < pixelCount; pixelIndex += 1) {
		const source = pixelIndex * info.channels;
		const target = pixelIndex * 4;
		rgba[target] = data[source];
		rgba[target + 1] = data[source + 1];
		rgba[target + 2] = data[source + 2];
		rgba[target + 3] = background[pixelIndex] ? 0 : 255;
	}

	const processed = await sharp(rgba, {
		raw: { width: info.width, height: info.height, channels: 4 }
	})
		.trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
		.resize({
			width: 768,
			height: 768,
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
			withoutEnlargement: true
		})
		.png({ compressionLevel: 9, adaptiveFiltering: true })
		.toBuffer();

	await sharp(processed).toFile(`${inputPath}.keyed.png`);
	console.log(`${inputPath}.keyed.png`);
}
