import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import sharp from 'sharp';

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
	throw new Error('Usage: node extract-realtime-combat-occluders.mjs <environment> <output>');
}

const source = sharp(inputPath).ensureAlpha();
const metadata = await source.metadata();
if (!metadata.width || !metadata.height) throw new Error('Environment has no dimensions.');

const mask = Buffer.from(`
<svg width="${metadata.width}" height="${metadata.height}" xmlns="http://www.w3.org/2000/svg">
  <path d="M615 482 L638 418 L755 438 L770 511 L750 536 L625 530 Z" fill="white"/>
  <ellipse cx="690" cy="528" rx="86" ry="74" fill="white"/>
</svg>`);

await mkdir(path.dirname(outputPath), { recursive: true });
await source
	.composite([{ input: mask, blend: 'dest-in' }])
	.png({ compressionLevel: 9, adaptiveFiltering: true })
	.toFile(outputPath);

console.log(
	JSON.stringify({ inputPath, outputPath, width: metadata.width, height: metadata.height })
);
