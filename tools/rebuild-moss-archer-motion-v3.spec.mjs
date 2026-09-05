import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import sharp from 'sharp';

const repositoryRoot = process.cwd();
const actorDirectory = path.join(
	repositoryRoot,
	'assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/moss-archer'
);
const runtimeDirectory = path.join(
	repositoryRoot,
	'apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/moss-archer'
);
const v2Source = path.join(actorDirectory, 'moss-archer-motion-sheet-source-v2.png');
const v1Manifest = path.join(runtimeDirectory, 'moss-archer-motion-manifest-v1.json');
const v2Manifest = path.join(runtimeDirectory, 'moss-archer-motion-manifest-v2.json');
const v3Manifest = path.join(runtimeDirectory, 'moss-archer-motion-manifest-v3.json');

function runBuilder(outputDirectory) {
	return spawnSync(
		process.execPath,
		[
			path.join(repositoryRoot, 'tools/build-realtime-combat-motion-pack.mjs'),
			'--actor',
			'moss-archer',
			'--input',
			v2Source,
			'--out-dir',
			outputDirectory,
			'--version',
			'3',
			'--preserve-from-manifest',
			v1Manifest,
			'--replace-clip',
			'advance',
			'--replace-clip',
			'attack',
			'--replace-clip',
			'hit',
			'--replace-clip',
			'down'
		],
		{ cwd: repositoryRoot, encoding: 'utf8' }
	);
}

async function framePixels(manifestPath, clip, index) {
	const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const atlasJsonPath = path.resolve(path.dirname(manifestPath), manifest.atlas);
	const atlas = JSON.parse(readFileSync(atlasJsonPath, 'utf8'));
	const atlasPath = path.resolve(path.dirname(atlasJsonPath), atlas.meta.image);
	const frameName = manifest.clips[clip].frames[index];
	const { x, y, w, h } = atlas.frames[frameName].frame;
	return sharp(atlasPath)
		.extract({ left: x, top: y, width: w, height: h })
		.ensureAlpha()
		.raw()
		.toBuffer();
}

test('documented options exactly reproduce Nessa v3', () => {
	const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'moss-archer-v3-rebuild-'));
	try {
		const result = runBuilder(temporaryDirectory);
		assert.equal(result.status, 0, result.stderr);
		for (const fileName of [
			'moss-archer-motion-v3.png',
			'moss-archer-motion-v3.json',
			'moss-archer-motion-manifest-v3.json'
		]) {
			assert.equal(
				readFileSync(path.join(temporaryDirectory, fileName)).equals(
					readFileSync(path.join(runtimeDirectory, fileName))
				),
				true,
				`${fileName} is not reproducible`
			);
		}
	} finally {
		rmSync(temporaryDirectory, { recursive: true, force: true });
	}
});

test('Nessa v3 restores v1 idle pixels and preserves every corrected v2 action frame', async () => {
	let comparedFrames = 0;
	for (let index = 0; index < 5; index += 1) {
		assert.equal(
			(await framePixels(v3Manifest, 'idle', index)).equals(
				await framePixels(v1Manifest, 'idle', index)
			),
			true,
			`idle frame ${index + 1} changed from v1`
		);
		comparedFrames += 1;
	}
	for (const clip of ['advance', 'attack', 'hit', 'down']) {
		const frameCount = JSON.parse(readFileSync(v2Manifest, 'utf8')).clips[clip].frames.length;
		for (let index = 0; index < frameCount; index += 1) {
			assert.equal(
				(await framePixels(v3Manifest, clip, index)).equals(
					await framePixels(v2Manifest, clip, index)
				),
				true,
				`${clip} frame ${index + 1} changed from v2`
			);
			comparedFrames += 1;
		}
	}
	assert.equal(comparedFrames, 20);
});
