import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

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
const v4Source = path.join(actorDirectory, 'iron-guardian-motion-sheet-source-v4.png');
const v4Manifest = path.join(runtimeDirectory, 'iron-guardian-motion-manifest-v4.json');
const v5Strip = path.join(actorDirectory, 'iron-guardian-run-strip-source-v5.png');
const committedV5Source = path.join(actorDirectory, 'iron-guardian-motion-sheet-source-v5.png');
const committedV5Evidence = path.join(actorDirectory, 'iron-guardian-motion-support-v5.json');
const committedV5Atlas = path.join(runtimeDirectory, 'iron-guardian-motion-v5.png');
const committedV5AtlasJson = path.join(runtimeDirectory, 'iron-guardian-motion-v5.json');
const committedV5Manifest = path.join(runtimeDirectory, 'iron-guardian-motion-manifest-v5.json');
const requiredV5Artifacts = [
	v5Strip,
	committedV5Source,
	committedV5Evidence,
	committedV5Atlas,
	committedV5AtlasJson,
	committedV5Manifest
];
const missingV5Artifacts = requiredV5Artifacts.filter((artifactPath) => !existsSync(artifactPath));
const committedArtifactSkipReason =
	missingV5Artifacts.length > 0
		? `Task 4 artifacts absent: ${missingV5Artifacts
				.map((artifactPath) => path.relative(repositoryRoot, artifactPath))
				.join(', ')}`
		: false;

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

test(
	'documented options exactly reproduce every committed v5 motion artifact',
	{ skip: committedArtifactSkipReason },
	() => {
		const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'iron-guardian-v5-rebuild-'));
		try {
			const rebuiltSource = path.join(temporaryRoot, 'iron-guardian-motion-sheet-source-v5.png');
			const rebuiltRuntimeDirectory = path.join(temporaryRoot, 'runtime');
			const rebuiltEvidence = path.join(temporaryRoot, 'iron-guardian-motion-support-v5.json');
			const compose = run('compose-realtime-combat-motion-rows.mjs', [
				'--base',
				v4Source,
				'--out',
				rebuiltSource,
				'--replace',
				`1:${v5Strip}`,
				'--scale-mode',
				'shared',
				'--cell-y-offset',
				'1:2:-7'
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
				'5',
				'--preserve-from-manifest',
				v4Manifest,
				'--replace-clip',
				'advance',
				'--frame-y-offset',
				'advance:3:-7'
			]);
			assert.equal(build.status, 0, build.stderr);

			const committedEvidence = JSON.parse(readFileSync(committedV5Evidence, 'utf8'));
			const writeEvidence = run('write-realtime-combat-motion-support-evidence.mjs', [
				'--source-sheet',
				rebuiltSource,
				'--source-sheet-path',
				'iron-guardian-motion-sheet-source-v5.png',
				'--out',
				rebuiltEvidence,
				'--version',
				'5',
				'--actor',
				'iron-guardian',
				'--clip',
				'advance',
				'--grid',
				'5x4@1',
				'--action-authority',
				'classical-human-run-5',
				'--support',
				'left,left,none,right,right',
				...committedEvidence.measurements.flatMap((measurement) => [
					'--measurement',
					[
						measurement.frame,
						measurement.support,
						measurement.crownY,
						measurement.lowestOpaqueY,
						measurement.shieldDiameter,
						measurement.strideWidth,
						measurement.torsoTop
					].join(':')
				])
			]);
			assert.equal(writeEvidence.status, 0, writeEvidence.stderr);

			for (const [actual, expected] of [
				[rebuiltSource, committedV5Source],
				[path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v5.png'), committedV5Atlas],
				[path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-v5.json'), committedV5AtlasJson],
				[
					path.join(rebuiltRuntimeDirectory, 'iron-guardian-motion-manifest-v5.json'),
					committedV5Manifest
				],
				[rebuiltEvidence, committedV5Evidence]
			]) {
				assert.equal(
					readFileSync(actual).equals(readFileSync(expected)),
					true,
					`${actual} differs from ${expected}`
				);
			}
		} finally {
			rmSync(temporaryRoot, { recursive: true, force: true });
		}
	}
);

test('v5 preservation mode retains all 15 decoded non-advance v4 frames', async () => {
	const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'iron-guardian-v5-preservation-'));
	try {
		let comparedManifest = committedV5Manifest;
		if (!existsSync(committedV5Manifest)) {
			const result = run('build-realtime-combat-motion-pack.mjs', [
				'--actor',
				'iron-guardian',
				'--input',
				v4Source,
				'--out-dir',
				temporaryRoot,
				'--version',
				'5',
				'--preserve-from-manifest',
				v4Manifest,
				'--replace-clip',
				'advance'
			]);
			assert.equal(result.status, 0, result.stderr);
			comparedManifest = path.join(temporaryRoot, 'iron-guardian-motion-manifest-v5.json');
		}

		let comparedFrames = 0;
		for (const clip of ['idle', 'attack', 'hit', 'down']) {
			const frames = JSON.parse(readFileSync(v4Manifest, 'utf8')).clips[clip].frames;
			for (let index = 0; index < frames.length; index += 1) {
				assert.equal(
					(await framePixels(comparedManifest, clip, index)).equals(
						await framePixels(v4Manifest, clip, index)
					),
					true,
					`${clip} frame ${index + 1} changed from v4`
				);
				comparedFrames += 1;
			}
		}
		assert.equal(comparedFrames, 15);
	} finally {
		rmSync(temporaryRoot, { recursive: true, force: true });
	}
});
