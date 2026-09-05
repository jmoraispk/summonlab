import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from '../packages/characters/src/index.js';
import { format } from 'prettier';

import { buildSummonableHeroCatalog } from './summonable-hero-roster-lib.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = resolve(
	workspaceRoot,
	'assets/heroes/approved/summonable-roster-v1/catalog.json'
);
const catalog = await buildSummonableHeroCatalog(workspaceRoot);
const mode = process.argv.includes('--check') ? 'check' : 'write';

if (mode === 'check') {
	const stored = JSON.parse(await readFile(outputPath, 'utf8'));
	if (canonicalJson(stored) !== canonicalJson(catalog)) {
		throw new Error('Approved summonable hero catalog is stale; run with --write');
	}
} else {
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(
		outputPath,
		await format(JSON.stringify(catalog), { parser: 'json', useTabs: true, printWidth: 100 })
	);
}

process.stdout.write(
	`${JSON.stringify({ mode, catalogVersion: catalog.catalogVersion, heroes: catalog.entries.length })}\n`
);
