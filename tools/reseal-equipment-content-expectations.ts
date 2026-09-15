import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { EQUIPMENT_DEFINITION_CATALOG } from '../packages/content/src/equipment.js';

const CATALOG_PATH = 'packages/content/src/equipment.ts';
const CONTENT_HASH_PATTERN = /contentHash: '[0-9a-f]{64}'/gu;

export function resealEquipmentCatalogSource(
	source: string,
	definitions: readonly unknown[]
): string {
	const matches = [...source.matchAll(CONTENT_HASH_PATTERN)];
	if (matches.length !== 1) {
		throw new Error('Equipment catalog source must contain exactly one self-bound content hash');
	}
	const contentHash = createHash('sha256').update(JSON.stringify(definitions)).digest('hex');
	return source.replace(CONTENT_HASH_PATTERN, `contentHash: '${contentHash}'`);
}

async function main(): Promise<void> {
	const repositoryRoot = process.cwd();
	const sourcePath = path.join(repositoryRoot, ...CATALOG_PATH.split('/'));
	const source = await readFile(sourcePath, 'utf8');
	const resealed = resealEquipmentCatalogSource(source, EQUIPMENT_DEFINITION_CATALOG.definitions);
	await writeFile(sourcePath, resealed);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
