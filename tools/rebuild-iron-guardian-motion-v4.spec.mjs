import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';

import sharp from 'sharp';

const repositoryRoot = process.cwd();
const actorDirectory = path.join(
	repositoryRoot,
	'assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian'
);
const runtimeDirectory = path.join(
	repositoryRoot,
	'apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian'
);
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'iron-guardian-v4-rebuild-'));
const rebuiltSource = path.join(temporaryRoot, 'iron-guardian-motion-sheet-source-v4.png');
const rebuiltRuntimeDirectory = path.join(temporaryRoot, 'runtime');
const rebuiltEvidence = path.join(temporaryRoot, 'iron-guardian-motion-support-v4.json');

const committedSource = path.join(actorDirectory, 'iron-guardian-motion-sheet-source-v4.png');
const committedAtlas = path.join(runtimeDirectory, 'iron-guardian-motion-v4.png');
const committedAtlasJson = path.join(runtimeDirectory, 'iron-guardian-motion-v4.json');
const committedManifest = path.join(runtimeDirectory, 'iron-guardian-motion-manifest-v4.json');
const v3Atlas = path.join(runtimeDirectory, 'iron-guardian-motion-v3.png');
const v3AtlasJson = path.join(runtimeDirectory, 'iron-guardian-motion-v3.json');

function run(command, args) {
	return spawnSync(process.execPath, [path.join(repositoryRoot, 'tools', command), ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8'
	});
}

async function framePixels(atlasPath, atlasJsonPath, frameName) {
	const atlas = JSON.parse(readFileSync(atlasJsonPath, 'utf8'));
	const { x, y, w, h } = atlas.frames[frameName].frame;
	return sharp(atlasPath)
		.extract({ left: x, top: y, width: w, height: h })
		.ensureAlpha()
		.raw()
		.toBuffer();
}

before(() => {
	const compose = run('compose-realtime-combat-motion-rows.mjs', [
		'--base',
		path.join(actorDirectory, 'iron-guardian-motion-sheet-source-v3.png'),
		'--out',
		rebuiltSource,
		'--replace',
		`1:${path.join(actorDirectory, 'iron-guardian-run-strip-source-v4.png')}`,
		'--scale-mode',
		'shared',
		'--cell-y-offset',
		'1:2:-18'
	]);
	assert.equal(compose.status, 0, compose.stderr);

	const build = run('build-realtime-combat-motion-pack.mjs', [
		'--actor',
		'iron-guardian',
		'--input',
		rebuiltSource,
		'--out-dir',
		rebuiltRuntimeDirectory,
		'--version',
		'4',
		'--preserve-from-manifest',
		path.join(runtimeDirectory, 'iron-guardian-motion-manifest-v3.json'),
		'--replace-clip',
		'advance',
		'--frame-y-offset',
		'advance:3:-18'
	]);
	assert.equal(build.status, 0, build.stderr);
});

after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

test('documented options exactly reproduce the committed v4 source and runtime pack', () => {
	for (const [actual, expected] of [
		[rebuiltSource, committedSource],
		[path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.png'), committedAtlas],
		[path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.json'), committedAtlasJson],
		[path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-manifest-v4.json'), committedManifest]
	]) {
		assert.equal(
			readFileSync(actual).equals(readFileSync(expected)),
			true,
			`${actual} differs from ${expected}`
		);
	}
});

test('documented evidence command hashes the assembled source cells in playback order', () => {
	const result = run('write-realtime-combat-motion-support-evidence.mjs', [
		'--source-sheet',
		rebuiltSource,
		'--source-sheet-path',
		'iron-guardian-motion-sheet-source-v4.png',
		'--out',
		rebuiltEvidence,
		'--version',
		'4',
		'--actor',
		'iron-guardian',
		'--clip',
		'advance',
		'--grid',
		'5x4@1',
		'--action-authority',
		'classical-human-run-5',
		'--support',
		'left,left,none,right,right'
	]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(
		readFileSync(rebuiltEvidence).equals(
			readFileSync(path.join(actorDirectory, 'iron-guardian-motion-support-v4.json'))
		),
		true
	);
});

test('v4 preserves every decoded non-advance runtime frame from v3, including attack-03', async () => {
	const v4AtlasJson = path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.json');
	const manifest = JSON.parse(readFileSync(committedManifest, 'utf8'));
	for (const clip of ['idle', 'attack', 'hit', 'down']) {
		for (const frameName of manifest.clips[clip].frames) {
			assert.equal(
				(
					await framePixels(
						path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.png'),
						v4AtlasJson,
						frameName
					)
				).equals(await framePixels(v3Atlas, v3AtlasJson, frameName)),
				true,
				`${frameName} changed from v3`
			);
		}
	}

	assert.equal(
		(
			await framePixels(
				path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.png'),
				v4AtlasJson,
				'iron-guardian-attack-03.png'
			)
		).equals(await framePixels(v3Atlas, v3AtlasJson, 'iron-guardian-attack-03.png')),
		true
	);
});

test('v4 keeps the accepted advance frames and 18px airborne registration', async () => {
	const rebuiltAtlas = path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.png');
	const rebuiltAtlasJson = path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v4.json');
	for (let frame = 1; frame <= 5; frame += 1) {
		const frameName = `iron-guardian-advance-${String(frame).padStart(2, '0')}.png`;
		assert.equal(
			(await framePixels(rebuiltAtlas, rebuiltAtlasJson, frameName)).equals(
				await framePixels(committedAtlas, committedAtlasJson, frameName)
			),
			true,
			`${frameName} differs from the accepted v4 frame`
		);
	}

	const airborne = await framePixels(
		rebuiltAtlas,
		rebuiltAtlasJson,
		'iron-guardian-advance-03.png'
	);
	let bottom = -1;
	for (let pixel = 0; pixel < airborne.length / 4; pixel += 1) {
		if (airborne[pixel * 4 + 3] > 18) bottom = Math.max(bottom, Math.floor(pixel / 256));
	}
	assert.equal(bottom, 227);
});
