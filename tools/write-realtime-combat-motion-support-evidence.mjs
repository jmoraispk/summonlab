import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const valuesFor = (flag) => {
	const values = [];
	for (let index = 2; index < process.argv.length; index += 1) {
		if (process.argv[index] === flag) values.push(process.argv[index + 1]);
	}
	return values;
};
const valueFor = (flag) => valuesFor(flag)[0];

const sourceSheet = valueFor('--source-sheet');
const outputPath = valueFor('--out');
const version = Number.parseInt(valueFor('--version') ?? '', 10);
const actorId = valueFor('--actor');
const clip = valueFor('--clip');
const actionAuthority = valueFor('--action-authority');
const support = valueFor('--support')?.split(',');
const gridMatch = valueFor('--grid')?.match(/^(\d+)x(\d+)@(\d+)$/);
if (
	!sourceSheet ||
	!outputPath ||
	!Number.isInteger(version) ||
	version < 1 ||
	!actorId ||
	!clip ||
	!actionAuthority ||
	!support ||
	!gridMatch
) {
	throw new Error(
		'Usage: --source-sheet <sheet.png> --out <evidence.json> --version <number> --actor <id> --clip <clip> --grid <columns>x<rows>@<zero-based-row> --action-authority <id> --support <comma-separated-labels> [--source-sheet-path <path-relative-to-evidence>] [--measurement <frame:support:crownY:lowestOpaqueY:shieldDiameter:strideWidth:torsoTop>]'
	);
}

const measurementPattern = /^(\d+):(left|none|right):(\d+):(\d+):(\d+):(\d+):(\d+)$/;
const measurements = valuesFor('--measurement').map((value) => {
	const match = value?.match(measurementPattern);
	if (!match) {
		throw new Error(
			'Measurement must use frame:support:crownY:lowestOpaqueY:shieldDiameter:strideWidth:torsoTop syntax.'
		);
	}
	return {
		frame: Number.parseInt(match[1], 10),
		support: match[2],
		crownY: Number.parseInt(match[3], 10),
		lowestOpaqueY: Number.parseInt(match[4], 10),
		shieldDiameter: Number.parseInt(match[5], 10),
		strideWidth: Number.parseInt(match[6], 10),
		torsoTop: Number.parseInt(match[7], 10)
	};
});
if (measurements.length > 0) {
	assert.deepEqual(
		measurements.map(({ frame }) => frame),
		[1, 2, 3, 4, 5],
		'Measurement frames must appear exactly once in order 1,2,3,4,5.'
	);
	assert.deepEqual(
		measurements.map(({ support: measurementSupport }) => measurementSupport),
		support,
		'Measurement support labels must match the declared support sequence.'
	);
}

const sourceGrid = {
	columns: Number.parseInt(gridMatch[1], 10),
	rows: Number.parseInt(gridMatch[2], 10),
	row: Number.parseInt(gridMatch[3], 10)
};
if (
	sourceGrid.columns < 1 ||
	sourceGrid.rows < 1 ||
	sourceGrid.row < 0 ||
	sourceGrid.row >= sourceGrid.rows ||
	support.length !== sourceGrid.columns
) {
	throw new Error('Source grid and support labels are inconsistent.');
}

const recordedSourcePath =
	valueFor('--source-sheet-path') ?? path.relative(path.dirname(outputPath), sourceSheet);
if (path.resolve(path.dirname(outputPath), recordedSourcePath) !== path.resolve(sourceSheet)) {
	throw new Error('Recorded source-sheet path must resolve to the hashed source sheet.');
}

const metadata = await sharp(sourceSheet).metadata();
if (!metadata.width || !metadata.height) throw new Error('Source sheet has no dimensions.');
const top = Math.floor((sourceGrid.row * metadata.height) / sourceGrid.rows);
const bottom = Math.floor(((sourceGrid.row + 1) * metadata.height) / sourceGrid.rows);
const cellSha256 = [];
for (let column = 0; column < sourceGrid.columns; column += 1) {
	const left = Math.floor((column * metadata.width) / sourceGrid.columns);
	const right = Math.floor(((column + 1) * metadata.width) / sourceGrid.columns);
	const pixels = await sharp(sourceSheet)
		.removeAlpha()
		.extract({ left, top, width: right - left, height: bottom - top })
		.raw()
		.toBuffer();
	cellSha256.push(createHash('sha256').update(pixels).digest('hex'));
}
if (new Set(cellSha256).size !== cellSha256.length) {
	throw new Error('Source cells must have unique decoded RGB SHA-256 values.');
}

const evidence = {
	version,
	actorId,
	clip,
	actionAuthority,
	support,
	cellSha256,
	...(measurements.length > 0 ? { measurements } : {}),
	status: 'candidate',
	sourceSheetPath: recordedSourcePath,
	sourceGrid
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(evidence));
process.stdout.write(`${JSON.stringify({ outputPath, sourceSheet, cellSha256 }, null, 2)}\n`);
