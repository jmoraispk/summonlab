import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const COLUMNS = 5;
const ROWS = 4;
const CELL_PADDING = 4;

const valuesFor = (flag) => {
	const values = [];
	for (let index = 2; index < process.argv.length; index += 1) {
		if (process.argv[index] === flag) values.push(process.argv[index + 1]);
	}
	return values;
};

const valueFor = (flag) => valuesFor(flag)[0];
const basePath = valueFor('--base');
const outputPath = valueFor('--out');
const replacements = valuesFor('--replace');
const scaleMode = valueFor('--scale-mode') ?? 'per-cell';
const cellYOffsets = new Map();

if (!['per-cell', 'shared'].includes(scaleMode)) {
	throw new Error('Scale mode must be per-cell or shared.');
}
for (const offset of valuesFor('--cell-y-offset')) {
	const match = offset?.match(/^([0-3]):([0-4]):(-?\d+)$/);
	if (!match) {
		throw new Error('Cell Y offset must use zero-based row:column:pixels syntax.');
	}
	cellYOffsets.set(`${match[1]}:${match[2]}`, Number.parseInt(match[3], 10));
}

if (!basePath || !outputPath || replacements.length === 0) {
	throw new Error(
		'Usage: --base <sheet.png> --out <sheet.png> --replace <target-row:path[@source-row][#cell-order]> [--replace ...] [--scale-mode per-cell|shared] [--cell-y-offset <zero-based-row:column:pixels>]'
	);
}

const base = sharp(basePath).removeAlpha();
const metadata = await base.metadata();
if (!metadata.width || !metadata.height) throw new Error('Base sheet has no dimensions.');

const rowTop = (row) => Math.floor((row * metadata.height) / ROWS);
const rowBottom = (row) => Math.floor(((row + 1) * metadata.height) / ROWS);
const cellLeft = (column) => Math.floor((column * metadata.width) / COLUMNS);
const cellRight = (column) => Math.floor(((column + 1) * metadata.width) / COLUMNS);

const composites = [];
for (const replacement of replacements) {
	const separator = replacement.indexOf(':');
	if (separator < 1) throw new Error(`Invalid replacement: ${replacement}`);
	const targetRow = Number.parseInt(replacement.slice(0, separator), 10);
	const replacementSpec = replacement.slice(separator + 1);
	const orderMatch = replacementSpec.match(/^(.*)#([0-4](?:,[0-4]){4})$/);
	const sourceSpec = orderMatch?.[1] ?? replacementSpec;
	const sourceColumns = orderMatch?.[2].split(',').map(Number);
	const sourceRowMatch = sourceSpec.match(/^(.*)@(\d+)$/);
	const sourcePath = sourceRowMatch?.[1] ?? sourceSpec;
	const sourceRow = sourceRowMatch ? Number.parseInt(sourceRowMatch[2], 10) : undefined;
	if (!Number.isInteger(targetRow) || targetRow < 0 || targetRow >= ROWS) {
		throw new Error(`Target row must be between 0 and ${ROWS - 1}: ${replacement}`);
	}

	const targetTop = rowTop(targetRow);
	const targetHeight = rowBottom(targetRow) - targetTop;
	let rowBuffer;
	if (sourceRow !== undefined) {
		if (sourceRow < 0 || sourceRow >= ROWS) {
			throw new Error(`Source row must be between 0 and ${ROWS - 1}: ${replacement}`);
		}
		const resizedSheet = await sharp(sourcePath)
			.removeAlpha()
			.resize(metadata.width, metadata.height, { fit: 'fill' })
			.png()
			.toBuffer();
		rowBuffer = await sharp(resizedSheet)
			.extract({
				left: 0,
				top: rowTop(sourceRow),
				width: metadata.width,
				height: rowBottom(sourceRow) - rowTop(sourceRow)
			})
			.resize(metadata.width, targetHeight, { fit: 'fill' })
			.png()
			.toBuffer();
	} else {
		const stripMetadata = await sharp(sourcePath).metadata();
		if (!stripMetadata.width || !stripMetadata.height) {
			throw new Error(`Replacement strip has no dimensions: ${sourcePath}`);
		}
		const preparedCells = [];
		for (let column = 0; column < COLUMNS; column += 1) {
			const sourceColumn = sourceColumns?.[column] ?? column;
			const sourceLeft = Math.floor((sourceColumn * stripMetadata.width) / COLUMNS);
			const sourceRight = Math.floor(((sourceColumn + 1) * stripMetadata.width) / COLUMNS);
			const targetWidth = cellRight(column) - cellLeft(column);
			const extracted = await sharp(sourcePath)
				.removeAlpha()
				.extract({
					left: sourceLeft,
					top: 0,
					width: sourceRight - sourceLeft,
					height: stripMetadata.height
				})
				.png()
				.toBuffer();
			const { data: trimmed, info: trimmedMetadata } = await sharp(extracted)
				.trim({ background: '#ffffff', threshold: 18 })
				.png()
				.toBuffer({ resolveWithObject: true });
			if (!trimmedMetadata.width || !trimmedMetadata.height) {
				throw new Error(`No subject found in strip cell ${column}.`);
			}
			preparedCells.push({
				column,
				targetWidth,
				trimmed,
				width: trimmedMetadata.width,
				height: trimmedMetadata.height
			});
		}
		const sharedScale = Math.min(
			...preparedCells.flatMap((cell) => [
				(cell.targetWidth - CELL_PADDING * 2) / cell.width,
				(targetHeight - CELL_PADDING * 2) / cell.height
			])
		);
		const cells = [];
		for (const cell of preparedCells) {
			const scale =
				scaleMode === 'shared'
					? sharedScale
					: Math.min(
							(cell.targetWidth - CELL_PADDING * 2) / cell.width,
							(targetHeight - CELL_PADDING * 2) / cell.height
						);
			const { column, targetWidth, trimmed } = cell;
			const width = Math.max(1, Math.round(cell.width * scale));
			const height = Math.max(1, Math.round(cell.height * scale));
			const subject = await sharp(trimmed).resize(width, height, { fit: 'fill' }).png().toBuffer();
			const top =
				targetHeight - height - CELL_PADDING + (cellYOffsets.get(`${targetRow}:${column}`) ?? 0);
			if (top < 0 || top + height > targetHeight) {
				throw new Error(`Cell Y offset clips target row ${targetRow}, column ${column}.`);
			}
			cells.push(
				await sharp({
					create: {
						width: targetWidth,
						height: targetHeight,
						channels: 3,
						background: '#ffffff'
					}
				})
					.composite([
						{
							input: subject,
							left: Math.round((targetWidth - width) / 2),
							top
						}
					])
					.png()
					.toBuffer()
			);
		}
		rowBuffer = await sharp({
			create: {
				width: metadata.width,
				height: targetHeight,
				channels: 3,
				background: '#ffffff'
			}
		})
			.composite(cells.map((input, column) => ({ input, left: cellLeft(column), top: 0 })))
			.png()
			.toBuffer();
	}
	composites.push({ input: rowBuffer, left: 0, top: targetTop });
}

await mkdir(path.dirname(outputPath), { recursive: true });
await base.composite(composites).png().toFile(outputPath);
process.stdout.write(`${JSON.stringify({ basePath, outputPath, replacements }, null, 2)}\n`);
