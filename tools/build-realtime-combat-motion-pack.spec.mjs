import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import sharp from 'sharp';

const repositoryRoot = process.cwd();
const builderPath = path.join(repositoryRoot, 'tools/build-realtime-combat-motion-pack.mjs');

async function subjectHeight(manifestPath) {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const atlasJsonPath = path.resolve(path.dirname(manifestPath), manifest.atlas);
	const atlas = JSON.parse(readFileSync(atlasJsonPath, 'utf8'));
	const atlasPath = path.resolve(path.dirname(atlasJsonPath), atlas.meta.image);
	const frame = atlas.frames[manifest.clips.idle.frames[0]].frame;
	const { data, info } = await sharp(atlasPath)
		.extract({ left: frame.x, top: frame.y, width: frame.w, height: frame.h })
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	let top = info.height;
	let bottom = -1;
	for (let pixel = 0; pixel < info.width * info.height; pixel += 1) {
		if (data[pixel * info.channels + 3] <= 18) continue;
		const y = Math.floor(pixel / info.width);
		top = Math.min(top, y);
		bottom = Math.max(bottom, y);
	}
	return bottom - top + 1;
}

test('--fit-clip isolates replacement scale from unrelated motion rows', async () => {
	const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'motion-pack-fit-clip-'));
	try {
		const sourcePath = path.join(temporaryRoot, 'source.png');
		const composites = [];
		for (let row = 0; row < 4; row += 1) {
			for (let column = 0; column < 5; column += 1) {
				const width = row === 0 ? 80 : 250;
				const height = row === 0 ? 230 : 80;
				composites.push({
					input: {
						create: { width, height, channels: 3, background: '#111111' }
					},
					left: column * 256 + Math.round((256 - width) / 2),
					top: row * 256 + Math.round((256 - height) / 2)
				});
			}
		}
		await sharp({
			create: { width: 1280, height: 1024, channels: 3, background: '#ffffff' }
		})
			.composite(composites)
			.png()
			.toFile(sourcePath);

		const run = (version, extraArguments = []) => {
			const outputDirectory = path.join(temporaryRoot, `v${version}`);
			const result = spawnSync(
				process.execPath,
				[
					builderPath,
					'--actor',
					'moss-archer',
					'--input',
					sourcePath,
					'--out-dir',
					outputDirectory,
					'--version',
					String(version),
					...extraArguments
				],
				{ cwd: repositoryRoot, encoding: 'utf8' }
			);
			assert.equal(result.status, 0, result.stderr);
			return path.join(outputDirectory, `moss-archer-motion-manifest-v${version}.json`);
		};

		const defaultHeight = await subjectHeight(run(1));
		const idleFitHeight = await subjectHeight(run(2, ['--fit-clip', 'idle']));
		assert.equal(idleFitHeight, 238);
		assert.ok(defaultHeight < idleFitHeight, `${defaultHeight} should be below ${idleFitHeight}`);
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
});
