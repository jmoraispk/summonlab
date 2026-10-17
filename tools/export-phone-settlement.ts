import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

import { loadHearth01Scene } from '../packages/content/src/index.js';

const scene = await loadHearth01Scene();
const encoder = {
	quality: 72,
	effort: 6,
	preset: 'picture' as const,
	smartSubsample: true
};
const bytes = await sharp(resolve(scene.source.file)).webp(encoder).toBuffer();
const contentHash = createHash('sha256').update(bytes).digest('hex');
const publicPath = `/runtime/settlements/hearth-01/environment-phone.${contentHash.slice(0, 12)}.webp`;
const file = `apps/web/static${publicPath}`;
await writeFile(resolve(file), bytes);
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
			encoder
		},
		null,
		'\t'
	)}\n`
);
