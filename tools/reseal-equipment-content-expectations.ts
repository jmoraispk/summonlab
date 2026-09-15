import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	calculateCombatEquipmentProfileContentHash,
	COMBAT_EQUIPMENT_PROFILE_CATALOG,
	EQUIPMENT_DEFINITION_CATALOG
} from '../packages/content/src/equipment.js';

const CATALOG_PATH = 'packages/content/src/equipment.ts';
const CONTENT_HASH_PATTERN = /contentHash: '[0-9a-f]{64}'/gu;

function catalogHashRange(source: string, catalogName: string): readonly [number, number] | null {
	const declaration = `export const ${catalogName}`;
	const start = source.indexOf(declaration);
	if (start === -1) return null;
	const nextDeclaration = source.indexOf('\nexport const ', start + declaration.length);
	return [start, nextDeclaration === -1 ? source.length : nextDeclaration];
}

function replaceCatalogHash(
	source: string,
	catalogName: string,
	contentHash: string
): string | null {
	const range = catalogHashRange(source, catalogName);
	if (range === null) return null;
	const [start, end] = range;
	const catalogSource = source.slice(start, end);
	if ([...catalogSource.matchAll(CONTENT_HASH_PATTERN)].length !== 1) return null;
	return `${source.slice(0, start)}${catalogSource.replace(
		CONTENT_HASH_PATTERN,
		`contentHash: '${contentHash}'`
	)}${source.slice(end)}`;
}

export function resealEquipmentCatalogSource(
	source: string,
	combatProfileContentHash: string,
	definitions: readonly unknown[]
): string {
	const definitionContentHash = createHash('sha256')
		.update(JSON.stringify(definitions))
		.digest('hex');
	const combatResealed = replaceCatalogHash(
		source,
		'COMBAT_EQUIPMENT_PROFILE_CATALOG',
		combatProfileContentHash
	);
	const resealed =
		combatResealed === null
			? null
			: replaceCatalogHash(combatResealed, 'EQUIPMENT_DEFINITION_CATALOG', definitionContentHash);
	if (resealed === null) {
		throw new Error('Equipment catalog source must contain both named self-bound content hashes');
	}
	return resealed;
}

async function main(): Promise<void> {
	const repositoryRoot = process.cwd();
	const sourcePath = path.join(repositoryRoot, ...CATALOG_PATH.split('/'));
	const source = await readFile(sourcePath, 'utf8');
	const combatProfileContentHash = await calculateCombatEquipmentProfileContentHash(
		COMBAT_EQUIPMENT_PROFILE_CATALOG
	);
	const resealed = resealEquipmentCatalogSource(
		source,
		combatProfileContentHash,
		EQUIPMENT_DEFINITION_CATALOG.definitions
	);
	await writeFile(sourcePath, resealed);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
