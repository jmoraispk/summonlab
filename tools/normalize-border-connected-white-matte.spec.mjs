import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import sharp from 'sharp';

const repositoryRoot = process.cwd();
const toolPath = path.join(repositoryRoot, 'tools/normalize-border-connected-white-matte.mjs');

test('normalizes only border-connected near-neutral matte pixels', async () => {
	const { normalizeBorderConnectedWhiteMatte } =
		await import('./normalize-border-connected-white-matte.mjs');
	const width = 5;
	const height = 5;
	const pixels = Buffer.alloc(width * height * 4, 255);
	const writePixel = (x, y, rgba) => {
		pixels.set(rgba, (y * width + x) * 4);
	};

	// A dark subject ring encloses a neutral highlight that must not be treated as matte.
	for (const [x, y] of [
		[1, 1],
		[2, 1],
		[3, 1],
		[1, 2],
		[3, 2],
		[1, 3],
		[2, 3],
		[3, 3]
	]) {
		writePixel(x, y, [25, 55, 75, 255]);
	}
	writePixel(2, 2, [246, 247, 245, 255]);

	// Border pixels outside the declared neutral/opaque gate must stay byte-identical.
	writePixel(0, 2, [239, 239, 239, 255]);
	writePixel(4, 2, [247, 238, 247, 255]);
	writePixel(2, 0, [246, 247, 245, 180]);
	writePixel(0, 0, [246, 247, 245, 255]);

	const result = normalizeBorderConnectedWhiteMatte(pixels, width, height, {
		minimumChannel: 240,
		maximumChroma: 8
	});

	assert.equal(result.changedPixels, 1);
	assert.equal(result.connectedPixels, 13);
	for (let pixel = 0; pixel < width * height; pixel += 1) {
		const offset = pixel * 4;
		const before = pixels.subarray(offset, offset + 4);
		const after = result.data.subarray(offset, offset + 4);
		const changed = !before.equals(after);
		if (changed) {
			assert.deepEqual([...after], [255, 255, 255, 255]);
			assert.equal(before[3], 255);
			assert.ok(Math.min(before[0], before[1], before[2]) >= 240);
			assert.ok(Math.max(before[0], before[1], before[2]) - Math.min(...before) <= 8);
		} else {
			assert.equal(after.equals(before), true, `pixel ${pixel} changed outside the matte`);
		}
	}
	assert.deepEqual(
		[...result.data.subarray((2 * width + 2) * 4, (2 * width + 2) * 4 + 4)],
		[246, 247, 245, 255]
	);
});

test('CLI preserves RGB channels and every non-matte byte', async () => {
	const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'white-matte-normalizer-'));
	try {
		const inputPath = path.join(temporaryRoot, 'raw.png');
		const firstOutput = path.join(temporaryRoot, 'first.png');
		const secondOutput = path.join(temporaryRoot, 'second.png');
		const pixels = Buffer.from([
			254, 254, 254, 20, 40, 60, 252, 253, 252, 253, 253, 254, 25, 45, 65, 251, 252, 251, 254, 253,
			254, 30, 50, 70, 253, 252, 253
		]);
		await sharp(pixels, { raw: { width: 3, height: 3, channels: 3 } })
			.png()
			.toFile(inputPath);
		const rawBytes = readFileSync(inputPath);
		const args = [
			toolPath,
			'--input',
			inputPath,
			'--minimum-channel',
			'240',
			'--maximum-chroma',
			'8'
		];
		for (const outputPath of [firstOutput, secondOutput]) {
			const run = spawnSync(process.execPath, [...args, '--output', outputPath], {
				cwd: repositoryRoot,
				encoding: 'utf8'
			});
			assert.equal(run.status, 0, run.stderr);
		}

		assert.equal(readFileSync(inputPath).equals(rawBytes), true);
		assert.equal(readFileSync(firstOutput).equals(readFileSync(secondOutput)), true);
		const { data, info } = await sharp(firstOutput).raw().toBuffer({ resolveWithObject: true });
		assert.equal(info.channels, 3);
		assert.deepEqual(
			[...data],
			[
				255, 255, 255, 20, 40, 60, 255, 255, 255, 255, 255, 255, 25, 45, 65, 255, 255, 255, 255,
				255, 255, 30, 50, 70, 255, 255, 255
			]
		);
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
});
