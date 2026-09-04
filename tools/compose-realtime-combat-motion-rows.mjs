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

if (!basePath || !outputPath || replacements.length === 0) {
	throw new Error(
		'Usage: --base <sheet.png> --out <sheet.png> --replace <target-row:path[@source-row][#cell-order]> [--replace ...]'
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
		const cells = [];
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
			const scale = Math.min(
				(targetWidth - CELL_PADDING * 2) / trimmedMetadata.width,
				(targetHeight - CELL_PADDING * 2) / trimmedMetadata.height
			);
			const width = Math.max(1, Math.round(trimmedMetadata.width * scale));
			const height = Math.max(1, Math.round(trimmedMetadata.height * scale));
			const subject = await sharp(trimmed).resize(width, height, { fit: 'fill' }).png().toBuffer();
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
							top: targetHeight - height - CELL_PADDING
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
console.log(JSON.stringify({ basePath, outputPath, replacements }, null, 2));
