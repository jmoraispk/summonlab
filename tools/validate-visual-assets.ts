import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CharacterVisualCatalogSchema } from '../packages/contracts/src/index.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalogPath = resolve(workspaceRoot, 'assets/heroes/visuals/catalog.json');

function pngDimensions(buffer: Buffer): { width: number; height: number } {
	const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
	if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
		throw new Error('Visual catalog currently accepts only verifiable PNG source assets');
	}
	return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const catalog = CharacterVisualCatalogSchema.parse(JSON.parse(await readFile(catalogPath, 'utf8')));

for (const asset of catalog.assets) {
	const absolutePath = resolve(workspaceRoot, asset.file);
	if (!absolutePath.startsWith(resolve(workspaceRoot, 'assets/heroes'))) {
		throw new Error(`Visual asset escaped the hero asset root: ${asset.file}`);
	}
	const [buffer, file] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
	const dimensions = pngDimensions(buffer);
	const hash = createHash('sha256').update(buffer).digest('hex');
	if (file.size !== asset.bytes) throw new Error(`${asset.assetKey} byte count changed`);
	if (dimensions.width !== asset.width || dimensions.height !== asset.height) {
		throw new Error(`${asset.assetKey} dimensions changed`);
	}
	if (hash !== asset.contentHash) throw new Error(`${asset.assetKey} content hash changed`);
}

const candidateCount = catalog.assets.filter(
	(asset) => asset.status === 'approval-candidate'
).length;
const recognitionScores = catalog.assets.flatMap((asset) =>
	asset.identityChecks.map((check) => check.score)
);

console.log(
	JSON.stringify(
		{
			catalogVersion: catalog.catalogVersion,
			assetCount: catalog.assets.length,
			candidateCount,
			characterCount: catalog.profiles.length,
			minimumRecognitionScore: Math.min(...recognitionScores),
			verifiedBytes: catalog.assets.reduce((total, asset) => total + asset.bytes, 0)
		},
		null,
		2
	)
);
