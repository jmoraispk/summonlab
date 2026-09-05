import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
const v3Manifest = path.join(runtimeDirectory, 'moss-archer-motion-manifest-v3.json');
const v4RawStrip = path.join(actorDirectory, 'moss-archer-idle-strip-raw-v4.png');
const v4Strip = path.join(actorDirectory, 'moss-archer-idle-strip-source-v4.png');
const v4Source = path.join(actorDirectory, 'moss-archer-motion-sheet-source-v4.png');
const v4Manifest = path.join(runtimeDirectory, 'moss-archer-motion-manifest-v4.json');

function run(command, args) {
	return spawnSync(process.execPath, [path.join(repositoryRoot, 'tools', command), ...args], {
		cwd: repositoryRoot,
		encoding: 'utf8'
	});
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

test('documented options exactly reproduce every committed Nessa v4 artifact', () => {
	const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'moss-archer-v4-rebuild-'));
	try {
		assert.equal(
			createHash('sha256').update(readFileSync(v4RawStrip)).digest('hex'),
			'4ed227dd1ebfb949763b403e412a4d0abee84db410cbfbe9922afbb17333d2f2',
			'The immutable selected idle-strip generation changed'
		);
		const rebuiltStrip = path.join(temporaryRoot, 'moss-archer-idle-strip-source-v4.png');
		const normalize = run('normalize-border-connected-white-matte.mjs', [
			'--input',
			v4RawStrip,
			'--output',
			rebuiltStrip,
			'--minimum-channel',
			'240',
			'--maximum-chroma',
			'8'
		]);
		assert.equal(normalize.status, 0, normalize.stderr);
		assert.equal(readFileSync(rebuiltStrip).equals(readFileSync(v4Strip)), true);

		const rebuiltSource = path.join(temporaryRoot, 'moss-archer-motion-sheet-source-v4.png');
		const compose = run('compose-realtime-combat-motion-rows.mjs', [
			'--base',
			v2Source,
			'--out',
			rebuiltSource,
			'--replace',
			`0:${rebuiltStrip}`,
			'--scale-mode',
			'shared'
		]);
		assert.equal(compose.status, 0, compose.stderr);
		assert.equal(readFileSync(rebuiltSource).equals(readFileSync(v4Source)), true);

		const rebuiltRuntime = path.join(temporaryRoot, 'runtime');
		const build = run('build-realtime-combat-motion-pack.mjs', [
			'--actor',
			'moss-archer',
			'--input',
			rebuiltSource,
			'--out-dir',
			rebuiltRuntime,
			'--version',
			'4',
			'--preserve-from-manifest',
			v3Manifest,
			'--replace-clip',
			'idle',
			'--fit-clip',
			'idle'
		]);
		assert.equal(build.status, 0, build.stderr);

		for (const fileName of [
			'moss-archer-motion-v4.png',
			'moss-archer-motion-v4.json',
			'moss-archer-motion-manifest-v4.json'
		]) {
			assert.equal(
				readFileSync(path.join(rebuiltRuntime, fileName)).equals(
					readFileSync(path.join(runtimeDirectory, fileName))
				),
				true,
				`${fileName} is not reproducible`
			);
		}
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
});

test('Nessa v4 replaces only idle and keeps the lifted boot above the contact band', async () => {
	let comparedFrames = 0;
	for (const clip of ['advance', 'attack', 'hit', 'down']) {
		const frameCount = JSON.parse(readFileSync(v3Manifest, 'utf8')).clips[clip].frames.length;
		for (let index = 0; index < frameCount; index += 1) {
			assert.equal(
				(await framePixels(v4Manifest, clip, index)).equals(
					await framePixels(v3Manifest, clip, index)
				),
				true,
				`${clip} frame ${index + 1} changed from v3`
			);
			comparedFrames += 1;
		}
	}
	assert.equal(comparedFrames, 15);

	const validation = run('validate-realtime-combat-motion-pack.mjs', [
		v4Manifest,
		'--min-idle-subject-height',
		'230',
		'--max-idle-right-half-bottom-pixels',
		'0'
	]);
	assert.equal(validation.status, 0, validation.stderr);
	assert.match(validation.stdout, /"valid":true/);
});
