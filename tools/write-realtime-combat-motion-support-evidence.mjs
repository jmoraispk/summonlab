import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const values = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
	values.set(process.argv[index], process.argv[index + 1]);
}

const sourceSheet = values.get('--source-sheet');
const outputPath = values.get('--out');
const version = Number.parseInt(values.get('--version') ?? '', 10);
const actorId = values.get('--actor');
const clip = values.get('--clip');
const actionAuthority = values.get('--action-authority');
const support = values.get('--support')?.split(',');
const gridMatch = values.get('--grid')?.match(/^(\d+)x(\d+)@(\d+)$/);
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
		'Usage: --source-sheet <sheet.png> --out <evidence.json> --version <number> --actor <id> --clip <clip> --grid <columns>x<rows>@<zero-based-row> --action-authority <id> --support <comma-separated-labels> [--source-sheet-path <path-relative-to-evidence>]'
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
	values.get('--source-sheet-path') ?? path.relative(path.dirname(outputPath), sourceSheet);
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
	status: 'candidate',
	sourceSheetPath: recordedSourcePath,
	sourceGrid
};
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(evidence));
process.stdout.write(`${JSON.stringify({ outputPath, sourceSheet, cellSha256 }, null, 2)}\n`);
