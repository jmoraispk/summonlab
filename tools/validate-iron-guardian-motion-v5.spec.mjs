import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import sharp from 'sharp';

const repositoryRoot = process.cwd();
const validator = path.join(repositoryRoot, 'tools/validate-iron-guardian-motion-v5.mjs');
const writer = path.join(repositoryRoot, 'tools/write-realtime-combat-motion-support-evidence.mjs');
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'iron-guardian-v5-validator-'));
const sourceSheetPath = path.join(temporaryRoot, 'iron-guardian-motion-sheet-source-v5.png');
const v4AtlasPath = path.join(temporaryRoot, 'iron-guardian-motion-v4.png');
const v4AtlasJsonPath = path.join(temporaryRoot, 'iron-guardian-motion-v4.json');
const v4ManifestPath = path.join(temporaryRoot, 'iron-guardian-motion-manifest-v4.json');
const v5AtlasPath = path.join(temporaryRoot, 'iron-guardian-motion-v5.png');
const v5AtlasJsonPath = path.join(temporaryRoot, 'iron-guardian-motion-v5.json');
const v5ManifestPath = path.join(temporaryRoot, 'iron-guardian-motion-manifest-v5.json');

const frameSize = 256;
const columns = 5;
const rows = 4;
const clipRows = {
	idle: { row: 0, count: 5 },
	advance: { row: 1, count: 5 },
	attack: { row: 2, count: 5 },
	hit: { row: 3, start: 0, count: 2 },
	down: { row: 3, start: 2, count: 3 }
};
const validSupport = ['left', 'left', 'none', 'right', 'right'];
const validMeasurements = [
	{
		frame: 1,
		support: 'left',
		crownY: 17,
		lowestOpaqueY: 245,
		shieldDiameter: 76,
		strideWidth: 91,
		torsoTop: 38
	},
	{
		frame: 2,
		support: 'left',
		crownY: 21,
		lowestOpaqueY: 245,
		shieldDiameter: 75,
		strideWidth: 83,
		torsoTop: 42
	},
	{
		frame: 3,
		support: 'none',
		crownY: 13,
		lowestOpaqueY: 239,
		shieldDiameter: 77,
		strideWidth: 78,
		torsoTop: 36
	},
	{
		frame: 4,
		support: 'right',
		crownY: 18,
		lowestOpaqueY: 245,
		shieldDiameter: 75,
		strideWidth: 88,
		torsoTop: 39
	},
	{
		frame: 5,
		support: 'right',
		crownY: 20,
		lowestOpaqueY: 245,
		shieldDiameter: 76,
		strideWidth: 82,
		torsoTop: 41
	}
];

let validCellSha256;
let validV5AtlasPixels;

function manifest(version) {
	return {
		version,
		actorId: 'iron-guardian',
		atlas: `iron-guardian-motion-v${version}.json`,
		canvas: { width: frameSize, height: frameSize },
		feetAnchor: { x: 0.5, y: 246 / frameSize },
		clips: Object.fromEntries(
			Object.entries(clipRows).map(([clip, config]) => [
				clip,
				{
					frames: Array.from(
						{ length: config.count },
						(_, index) => `iron-guardian-${clip}-${String(index + 1).padStart(2, '0')}.png`
					),
					fps: 10,
					loop: clip === 'idle' || clip === 'advance'
				}
			])
		)
	};
}

function atlas(version) {
	const frames = {};
	for (const [clip, config] of Object.entries(clipRows)) {
		for (let index = 0; index < config.count; index += 1) {
			const column = (config.start ?? 0) + index;
			frames[`iron-guardian-${clip}-${String(index + 1).padStart(2, '0')}.png`] = {
				frame: { x: column * frameSize, y: config.row * frameSize, w: frameSize, h: frameSize }
			};
		}
	}
	return {
		frames,
		meta: {
			image: `iron-guardian-motion-v${version}.png`,
			size: { w: columns * frameSize, h: rows * frameSize }
		}
	};
}

function fillRectangle(pixels, sheetWidth, left, top, right, bottom, rgba) {
	for (let y = top; y <= bottom; y += 1) {
		for (let x = left; x <= right; x += 1) {
			const offset = (y * sheetWidth + x) * 4;
			pixels[offset] = rgba[0];
			pixels[offset + 1] = rgba[1];
			pixels[offset + 2] = rgba[2];
			pixels[offset + 3] = rgba[3];
		}
	}
}

async function writeAtlas(outputPath, pixels) {
	await sharp(pixels, {
		raw: { width: columns * frameSize, height: rows * frameSize, channels: 4 }
	})
		.png()
		.toFile(outputPath);
}

async function sourceCellHashes() {
	const hashes = [];
	for (let column = 0; column < columns; column += 1) {
		const pixels = await sharp(sourceSheetPath)
			.removeAlpha()
			.extract({
				left: column * frameSize,
				top: frameSize,
				width: frameSize,
				height: frameSize
			})
			.raw()
			.toBuffer();
		hashes.push(createHash('sha256').update(pixels).digest('hex'));
	}
	return hashes;
}

function validEvidence(overrides = {}) {
	return {
		version: 5,
		actorId: 'iron-guardian',
		clip: 'advance',
		actionAuthority: 'classical-human-run-5',
		support: validSupport,
		cellSha256: validCellSha256,
		measurements: validMeasurements,
		status: 'candidate',
		sourceSheetPath,
		sourceGrid: { columns: 5, rows: 4, row: 1 },
		...overrides
	};
}

function withFrame(frame, changes) {
	return validMeasurements.map((measurement) =>
		measurement.frame === frame ? { ...measurement, ...changes } : measurement
	);
}

function validate(evidence, options = {}) {
	const fixtureRoot = mkdtempSync(path.join(temporaryRoot, 'case-'));
	const evidencePath = path.join(fixtureRoot, 'evidence.json');
	writeFileSync(evidencePath, JSON.stringify(evidence));
	let manifestPath = v5ManifestPath;
	if (options.atlasPixels) {
		const alteredAtlasPath = path.join(fixtureRoot, 'altered-v5.png');
		const alteredAtlasJsonPath = path.join(fixtureRoot, 'altered-v5.json');
		const alteredManifestPath = path.join(fixtureRoot, 'altered-manifest-v5.json');
		return writeAtlas(alteredAtlasPath, options.atlasPixels).then(() => {
			const alteredAtlas = atlas(5);
			alteredAtlas.meta.image = 'altered-v5.png';
			writeFileSync(alteredAtlasJsonPath, JSON.stringify(alteredAtlas));
			const alteredManifest = manifest(5);
			alteredManifest.atlas = 'altered-v5.json';
			writeFileSync(alteredManifestPath, JSON.stringify(alteredManifest));
			return spawnSync(
				process.execPath,
				[
					validator,
					'--manifest',
					alteredManifestPath,
					'--evidence',
					evidencePath,
					'--preserve-from-manifest',
					v4ManifestPath
				],
				{ encoding: 'utf8' }
			);
		});
	}
	return spawnSync(
		process.execPath,
		[
			validator,
			'--manifest',
			manifestPath,
			'--evidence',
			evidencePath,
			'--preserve-from-manifest',
			v4ManifestPath
		],
		{ encoding: 'utf8' }
	);
}

function assertRejects(overrides, expected) {
	const result = validate(validEvidence(overrides));
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, expected);
}

before(async () => {
	const width = columns * frameSize;
	const height = rows * frameSize;
	const sourcePixels = Buffer.alloc(width * height * 3, 255);
	for (let frame = 0; frame < columns; frame += 1) {
		for (let y = frameSize + 32; y < frameSize + 224; y += 1) {
			for (let x = frame * frameSize + 72; x < frame * frameSize + 184; x += 1) {
				const offset = (y * width + x) * 3;
				sourcePixels[offset] = 20 + frame * 31;
				sourcePixels[offset + 1] = 80 + frame * 19;
				sourcePixels[offset + 2] = 140 + frame * 13;
			}
		}
	}
	await sharp(sourcePixels, { raw: { width, height, channels: 3 } })
		.png()
		.toFile(sourceSheetPath);
	validCellSha256 = await sourceCellHashes();

	const basePixels = Buffer.alloc(width * height * 4);
	for (const config of Object.values(clipRows)) {
		if (config.row === 1) continue;
		for (let index = 0; index < config.count; index += 1) {
			const column = (config.start ?? 0) + index;
			fillRectangle(
				basePixels,
				width,
				column * frameSize + 74,
				config.row * frameSize + 24,
				column * frameSize + 181,
				config.row * frameSize + 245,
				[40 + config.row * 30, 90 + index * 17, 130 + column * 11, 255]
			);
		}
	}
	await writeAtlas(v4AtlasPath, basePixels);
	writeFileSync(v4AtlasJsonPath, JSON.stringify(atlas(4)));
	writeFileSync(v4ManifestPath, JSON.stringify(manifest(4)));

	validV5AtlasPixels = Buffer.from(basePixels);
	for (let index = 0; index < validMeasurements.length; index += 1) {
		const measurement = validMeasurements[index];
		fillRectangle(
			validV5AtlasPixels,
			width,
			index * frameSize + 70 + index,
			frameSize + measurement.crownY,
			index * frameSize + 180 - index,
			frameSize + measurement.lowestOpaqueY,
			[35 + index * 37, 95 + index * 23, 155 + index * 17, 255]
		);
	}
	await writeAtlas(v5AtlasPath, validV5AtlasPixels);
	writeFileSync(v5AtlasJsonPath, JSON.stringify(atlas(5)));
	writeFileSync(v5ManifestPath, JSON.stringify(manifest(5)));
});

after(() => rmSync(temporaryRoot, { recursive: true, force: true }));

describe('Toma v5 motion validator', () => {
	it('accepts source-bound geometry and decoded v4 preservation', () => {
		const result = validate(validEvidence());

		assert.equal(result.status, 0, result.stderr);
		assert.equal(JSON.parse(result.stdout).valid, true);
	});

	it('rejects the wrong support sequence', () => {
		assertRejects({ support: ['left', 'left', 'left', 'right', 'right'] }, /support sequence/i);
	});

	it('rejects an airborne gap below four pixels', () => {
		assertRejects({ measurements: withFrame(3, { lowestOpaqueY: 245 }) }, /airborne gap/i);
	});

	it('rejects an airborne gap above ten pixels', () => {
		assertRejects({ measurements: withFrame(3, { lowestOpaqueY: 230 }) }, /airborne gap/i);
	});

	it('rejects crown-height spread above sixteen pixels', () => {
		assertRejects({ measurements: withFrame(3, { crownY: 0 }) }, /crown-height spread/i);
	});

	it('rejects shield-diameter variance above five percent', () => {
		assertRejects({ measurements: withFrame(4, { shieldDiameter: 84 }) }, /shield.*5%/i);
	});

	it('accepts shield-diameter variance at the five-percent boundary', () => {
		const measurements = validMeasurements.map((measurement, index) => ({
			...measurement,
			shieldDiameter: [95, 97, 98, 100, 96][index]
		}));
		const result = validate(validEvidence({ measurements }));

		assert.equal(result.status, 0, result.stderr);
	});

	it('rejects dissimilar opposite-contact stride widths', () => {
		assertRejects(
			{ measurements: withFrame(4, { strideWidth: 68 }) },
			/opposite contacts.*stride/i
		);
	});

	it('rejects dissimilar opposite-contact torso heights', () => {
		assertRejects({ measurements: withFrame(4, { torsoTop: 51 }) }, /opposite contacts.*torso/i);
	});

	it('rejects a recorded crown that does not match direct alpha bounds', () => {
		assertRejects({ measurements: withFrame(2, { crownY: 20 }) }, /crownY.*alpha bounds/i);
	});

	it('rejects a recorded lowest opaque row that does not match direct alpha bounds', () => {
		assertRejects(
			{ measurements: withFrame(1, { lowestOpaqueY: 244 }) },
			/lowestOpaqueY.*alpha bounds/i
		);
	});

	it('rejects evidence hashes that are not bound to the source cells', () => {
		const hashes = [...validCellSha256];
		hashes[2] = 'a'.repeat(64);
		assertRejects({ cellSha256: hashes }, /source.*cell.*hash/i);
	});

	it('rejects a changed decoded v5 idle pixel', async () => {
		const pixels = Buffer.from(validV5AtlasPixels);
		pixels[(24 * columns * frameSize + 74) * 4] ^= 1;
		const result = await validate(validEvidence(), { atlasPixels: pixels });

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /non-advance preservation.*idle/i);
	});

	it('rejects a changed decoded v5 attack pixel', async () => {
		const pixels = Buffer.from(validV5AtlasPixels);
		const offset = ((2 * frameSize + 24) * columns * frameSize + 74) * 4;
		pixels[offset] ^= 1;
		const result = await validate(validEvidence(), { atlasPixels: pixels });

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /non-advance preservation.*attack/i);
	});
});

describe('motion support evidence writer', () => {
	it('preserves ordered repeated measurements and their numeric fields', () => {
		const outputPath = path.join(temporaryRoot, 'writer-measurements.json');
		const result = spawnSync(
			process.execPath,
			[
				writer,
				'--source-sheet',
				sourceSheetPath,
				'--source-sheet-path',
				path.basename(sourceSheetPath),
				'--out',
				outputPath,
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
				...validMeasurements.flatMap((measurement) => [
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
			],
			{ encoding: 'utf8' }
		);

		assert.equal(result.status, 0, result.stderr);
		assert.deepEqual(JSON.parse(readFileSync(outputPath, 'utf8')).measurements, validMeasurements);
	});

	it('rejects duplicate or missing measurement frames', () => {
		const outputPath = path.join(temporaryRoot, 'writer-duplicate.json');
		const duplicateMeasurements = withFrame(5, { frame: 4 });
		const result = spawnSync(
			process.execPath,
			[
				writer,
				'--source-sheet',
				sourceSheetPath,
				'--out',
				outputPath,
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
				...duplicateMeasurements.flatMap((measurement) => [
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
			],
			{ encoding: 'utf8' }
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /measurement frames.*1.*2.*3.*4.*5/i);
	});

	it('rejects measurement support that differs from the declared sequence', () => {
		const outputPath = path.join(temporaryRoot, 'writer-support-mismatch.json');
		const measurements = withFrame(3, { support: 'left' });
		const result = spawnSync(
			process.execPath,
			[
				writer,
				'--source-sheet',
				sourceSheetPath,
				'--out',
				outputPath,
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
				...measurements.flatMap((measurement) => [
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
			],
			{ encoding: 'utf8' }
		);

		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /measurement support.*declared support/i);
	});
});
