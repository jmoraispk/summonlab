import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { describe, it } from 'node:test';
import path from 'node:path';
import process from 'node:process';

const repositoryRoot = process.cwd();
const validator = path.join(repositoryRoot, 'tools/validate-realtime-combat-motion-pack.mjs');
const tomaV2Manifest = path.join(
	repositoryRoot,
	'apps/web/static/runtime/combat/realtime-study-v1/animation-canary-v1/iron-guardian/iron-guardian-motion-manifest-v2.json'
);

const validSupport = ['left', 'left', 'none', 'right', 'right'];
const validCellSha256 = [
	'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
	'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
	'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
	'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
	'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
];

function validateWithEvidence(evidence) {
	const evidenceDirectory = mkdtempSync(path.join(os.tmpdir(), 'motion-support-evidence-'));
	const evidencePath = path.join(evidenceDirectory, 'evidence.json');
	writeFileSync(evidencePath, JSON.stringify(evidence));
	try {
		return spawnSync(
			process.execPath,
			[validator, tomaV2Manifest, '--advance-support-evidence', evidencePath],
			{
				encoding: 'utf8'
			}
		);
	} finally {
		rmSync(evidenceDirectory, { recursive: true, force: true });
	}
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
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: ['left', 'left', 'left', 'left', 'right'],
			cellSha256: validCellSha256,
			status: 'candidate'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /support sequence/i);
	});

	it('rejects a five-frame run with repeated cell hashes', () => {
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: validSupport,
			cellSha256: [
				validCellSha256[0],
				validCellSha256[1],
				validCellSha256[1],
				validCellSha256[3],
				validCellSha256[4]
			],
			status: 'candidate'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /unique.*cell.*hash/i);
	});

	it('rejects array-valued cell hashes that coerce to SHA-256 strings', () => {
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: validSupport,
			cellSha256: validCellSha256.map((hash) => [hash]),
			status: 'candidate'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /SHA-256/i);
	});

	it('rejects array-valued support labels that coerce to the required sequence', () => {
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: validSupport.map((label) => [label]),
			cellSha256: validCellSha256,
			status: 'candidate'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /support sequence/i);
	});

	it('rejects evidence from a different action authority', () => {
		const result = validateWithEvidence({
			actionAuthority: 'creature-run-5',
			support: validSupport,
			cellSha256: validCellSha256,
			status: 'candidate'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /action authority/i);
	});

	it('rejects non-SHA-256 cell evidence', () => {
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: validSupport,
			cellSha256: [
				'a',
				validCellSha256[1],
				validCellSha256[2],
				validCellSha256[3],
				validCellSha256[4]
			],
			status: 'candidate'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /SHA-256/i);
	});

	it('rejects evidence that is not a candidate', () => {
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: validSupport,
			cellSha256: validCellSha256,
			status: 'approved'
		});

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /candidate/i);
	});

	it('accepts classical five-frame run support evidence with unique SHA-256 values', () => {
		const result = validateWithEvidence({
			actionAuthority: 'classical-human-run-5',
			support: validSupport,
			cellSha256: validCellSha256,
			status: 'candidate'
		});

		assert.equal(result.status, 0, result.stderr);
	});
});
