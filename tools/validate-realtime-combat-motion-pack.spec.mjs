import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { describe, it } from 'node:test';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const repositoryRoot = process.cwd();
const validator = path.join(repositoryRoot, 'tools/validate-realtime-combat-motion-pack.mjs');
const tomaV2Manifest = path.join(
	repositoryRoot,
	'apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v2.json'
);
const tomaV4Manifest = path.join(
	repositoryRoot,
	'apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v4.json'
);
const tomaV4Source = path.join(
	repositoryRoot,
	'assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-sheet-source-v4.png'
);
const tomaV4Evidence = path.join(
	repositoryRoot,
	'assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-support-v4.json'
);

const validSupport = ['left', 'left', 'none', 'right', 'right'];
const validCellSha256 = [
	'9c518b0b821f3d2f5de096f59e4f0f76305b15853e117b01ed332a74b50fde50',
	'1a1fb1eedbf9e15933dd89b5cd8d6104c99fec923834112f9ec3fc9d761fd0ec',
	'4a71c6fa33e3e5a631e1dff6d8ef38769ae7e51e6f41fc4a127aef955453d035',
	'8f54a90897b54240f6b02a630dbb356aeee21d46af1b76901a73e83a1229c1bf',
	'ae9e7e083a61aba3048da246d8cd9d38a3c6c3d8b43f8dddca18bc75b63597cb'
];

function validEvidence(overrides = {}) {
	return {
		version: 4,
		actorId: 'iron-guardian',
		clip: 'advance',
		actionAuthority: 'classical-human-run-5',
		support: validSupport,
		cellSha256: validCellSha256,
		status: 'candidate',
		sourceSheetPath: tomaV4Source,
		sourceGrid: { columns: 5, rows: 4, row: 1 },
		...overrides
	};
}

function validateWithEvidence(evidence, manifest = tomaV4Manifest) {
	const evidenceDirectory = mkdtempSync(path.join(os.tmpdir(), 'motion-support-evidence-'));
	const evidencePath = path.join(evidenceDirectory, 'evidence.json');
	writeFileSync(evidencePath, JSON.stringify(evidence));
	try {
		return spawnSync(
			process.execPath,
			[validator, manifest, '--advance-support-evidence', evidencePath],
			{
				encoding: 'utf8'
			}
		);
	} finally {
		rmSync(evidenceDirectory, { recursive: true, force: true });
	}
}

async function sourceCellHashes(columns) {
	const metadata = await sharp(tomaV4Source).metadata();
	const top = Math.floor(metadata.height / 4);
	const bottom = Math.floor((2 * metadata.height) / 4);
	const hashes = [];
	for (let column = 0; column < columns; column += 1) {
		const left = Math.floor((column * metadata.width) / columns);
		const right = Math.floor(((column + 1) * metadata.width) / columns);
		const pixels = await sharp(tomaV4Source)
			.removeAlpha()
			.extract({ left, top, width: right - left, height: bottom - top })
			.raw()
			.toBuffer();
		hashes.push(createHash('sha256').update(pixels).digest('hex'));
	}
	return hashes;
}

function fourFrameManifestFixture() {
	const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), 'motion-four-frame-manifest-'));
	const manifestPath = path.join(fixtureDirectory, 'iron-guardian-motion-manifest-v4.json');
	const manifest = JSON.parse(readFileSync(tomaV4Manifest, 'utf8'));
	manifest.atlas = path.relative(
		fixtureDirectory,
		path.join(path.dirname(tomaV4Manifest), 'iron-guardian-motion-v4.json')
	);
	manifest.clips.advance.frames = manifest.clips.advance.frames.slice(0, 4);
	writeFileSync(manifestPath, JSON.stringify(manifest));
	return { fixtureDirectory, manifestPath };
}

describe('realtime combat motion pack validator', () => {
	it('rejects Toma v2 because its advance frames contain a baked ground ellipse', () => {
		const result = spawnSync(
			process.execPath,
			[validator, tomaV2Manifest, '--max-advance-ground-artifact-pixels', '500'],
			{ encoding: 'utf8' }
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /advance frame .* ground artifact/i);
	});

	it('rejects a five-frame run without alternating support', () => {
		const result = validateWithEvidence(
			validEvidence({ support: ['left', 'left', 'left', 'left', 'right'] })
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /support sequence/i);
	});

	it('rejects a five-frame run with repeated cell hashes', () => {
		const result = validateWithEvidence(
			validEvidence({
				cellSha256: [
					validCellSha256[0],
					validCellSha256[1],
					validCellSha256[1],
					validCellSha256[3],
					validCellSha256[4]
				]
			})
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /unique.*cell.*hash/i);
	});

	it('rejects array-valued cell hashes that coerce to SHA-256 strings', () => {
		const result = validateWithEvidence(
			validEvidence({ cellSha256: validCellSha256.map((hash) => [hash]) })
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /SHA-256/i);
	});

	it('rejects array-valued support labels that coerce to the required sequence', () => {
		const result = validateWithEvidence(
			validEvidence({ support: validSupport.map((label) => [label]) })
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /support sequence/i);
	});

	it('rejects evidence from a different action authority', () => {
		const result = validateWithEvidence(validEvidence({ actionAuthority: 'creature-run-5' }));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /action authority/i);
	});

	it('rejects non-SHA-256 cell evidence', () => {
		const result = validateWithEvidence(
			validEvidence({
				cellSha256: [
					'a',
					validCellSha256[1],
					validCellSha256[2],
					validCellSha256[3],
					validCellSha256[4]
				]
			})
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /SHA-256/i);
	});

	it('rejects evidence that is not a candidate', () => {
		const result = validateWithEvidence(validEvidence({ status: 'approved' }));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /candidate/i);
	});

	it('rejects support evidence for the wrong manifest version', () => {
		const result = validateWithEvidence(validEvidence({ version: 3 }));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /version.*manifest/i);
	});

	it('rejects support evidence for the wrong manifest actor', () => {
		const result = validateWithEvidence(validEvidence({ actorId: 'moss-archer' }));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /actor.*manifest/i);
	});

	it('rejects support evidence for a different clip', () => {
		const result = validateWithEvidence(validEvidence({ clip: 'attack' }));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /clip.*advance/i);
	});

	it('rejects arbitrary unique hashes that are not from the source cells', () => {
		const result = validateWithEvidence(
			validEvidence({
				cellSha256: ['a', 'b', 'c', 'd', 'e'].map((value) => value.repeat(64))
			})
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /source.*cell.*hash/i);
	});

	it('rejects source cell hashes in a different order', () => {
		const reordered = [...validCellSha256];
		[reordered[0], reordered[1]] = [reordered[1], reordered[0]];
		const result = validateWithEvidence(validEvidence({ cellSha256: reordered }));

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /source.*cell.*hash/i);
	});

	it('rejects evidence when a bound source cell is corrupt', async () => {
		const fixtureDirectory = mkdtempSync(path.join(os.tmpdir(), 'motion-support-source-'));
		const corruptSource = path.join(fixtureDirectory, 'corrupt-source.png');
		try {
			const { data, info } = await sharp(tomaV4Source)
				.removeAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });
			data[(Math.floor(info.height / 4) * info.width + 1) * info.channels] ^= 1;
			await sharp(data, { raw: info }).png().toFile(corruptSource);
			const result = validateWithEvidence(validEvidence({ sourceSheetPath: corruptSource }));

			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /source.*cell.*hash/i);
		} finally {
			rmSync(fixtureDirectory, { recursive: true, force: true });
		}
	});

	it('rejects a four-frame runtime advance even when a fifth evidence hash is left unused', async () => {
		const { fixtureDirectory, manifestPath } = fourFrameManifestFixture();
		try {
			const fourRealHashes = await sourceCellHashes(4);
			const result = validateWithEvidence(
				validEvidence({
					cellSha256: [...fourRealHashes, 'f'.repeat(64)],
					sourceGrid: { columns: 4, rows: 4, row: 1 }
				}),
				manifestPath
			);

			assert.notEqual(result.status, 0);
			assert.match(result.stderr, /exactly five.*advance.*frames/i);
		} finally {
			rmSync(fixtureDirectory, { recursive: true, force: true });
		}
	});

	it('accepts evidence bound to the actual ordered v4 source cells', () => {
		const result = spawnSync(
			process.execPath,
			[validator, tomaV4Manifest, '--advance-support-evidence', tomaV4Evidence],
			{ encoding: 'utf8' }
		);

		assert.equal(result.status, 0, result.stderr);
	});

	it('keeps manifest-only validation backward compatible', () => {
		const result = spawnSync(process.execPath, [validator, tomaV2Manifest], { encoding: 'utf8' });

		assert.equal(result.status, 0, result.stderr);
		assert.equal(JSON.parse(result.stdout).actorId, 'iron-guardian');
	});

	it('does not impose the evidence-only five-frame contract on manifest-only validation', () => {
		const { fixtureDirectory, manifestPath } = fourFrameManifestFixture();
		try {
			const result = spawnSync(process.execPath, [validator, manifestPath], { encoding: 'utf8' });

			assert.equal(result.status, 0, result.stderr);
		} finally {
			rmSync(fixtureDirectory, { recursive: true, force: true });
		}
	});
});
