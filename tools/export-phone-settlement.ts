import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

import { loadHearth01Scene } from '../packages/content/src/index.js';

const scene = await loadHearth01Scene();
const encoder = {
	quality: 40,
	effort: 6
};
const bytes = await sharp(resolve(scene.source.file)).avif(encoder).toBuffer();
const contentHash = createHash('sha256').update(bytes).digest('hex');
const publicPath = `/runtime/settlements/hearth-01/environment-phone.${contentHash.slice(0, 12)}.avif`;
const file = `apps/web/static${publicPath}`;
await writeFile(resolve(file), bytes);
const navigationEncoder = { quality: 85, effort: 6 };
const navigation = await Promise.all(
	['tower', 'missions', 'village', 'residents', 'inventory'].map(async (mode) => {
		const sourceFile = `apps/web/static/ui/village-nav/${mode}.png`;
		const source = await readFile(resolve(sourceFile));
		const bytes = await sharp(source).webp(navigationEncoder).toBuffer();
		const publicPath = `/ui/village-nav/${mode}.webp`;
		const file = `apps/web/static${publicPath}`;
		await writeFile(resolve(file), bytes);
		return {
			sourceFile,
			sourceContentHash: createHash('sha256').update(source).digest('hex'),
			file,
			publicPath,
			contentHash: createHash('sha256').update(bytes).digest('hex'),
			bytes: bytes.length
		};
	})
);
await writeFile(
	resolve('apps/web/static/runtime/settlements/hearth-01/environment-phone.json'),
	`${JSON.stringify(
		{
			sourceFile: scene.source.file,
			sourceContentHash: scene.source.contentHash,
			file,
			publicPath,
			contentHash,
			width: scene.source.width,
			height: scene.source.height,
			bytes: bytes.length,
			encoder,
			navigationEncoder,
			navigation
		},
		null,
		'\t'
	)}\n`
);
