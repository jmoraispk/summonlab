import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	SummonableHeroCatalogSchema,
	SummonableHeroRuntimeManifestSchema
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';

import { buildSummonableHeroRuntime } from './summonable-hero-runtime-lib.js';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const staticRoot = resolve(workspaceRoot, 'apps/web/static');
const outputRoot = resolve(staticRoot, 'runtime/summonable-heroes-v1');
const manifestPath = resolve(outputRoot, 'manifest.json');
const catalog = SummonableHeroCatalogSchema.parse(
	JSON.parse(
		await readFile(
			resolve(workspaceRoot, 'assets/heroes/approved/summonable-roster-v1/catalog.json'),
			'utf8'
		)
	)
);
const webPackage = JSON.parse(
	await readFile(resolve(workspaceRoot, 'apps/web/package.json'), 'utf8')
) as { dependencies?: Record<string, string> };
const pixiVersion = webPackage.dependencies?.['pixi.js'] ?? '';
const { manifest, generated } = await buildSummonableHeroRuntime(
	workspaceRoot,
	catalog,
	pixiVersion
);

async function listFiles(root: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
		const path = resolve(root, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(path)));
		else files.push(path);
	}
	return files;
}

async function check() {
	const stored = SummonableHeroRuntimeManifestSchema.parse(
		JSON.parse(await readFile(manifestPath, 'utf8'))
	);
	if (JSON.stringify(stored) !== JSON.stringify(manifest)) {
		throw new Error('Summonable hero runtime manifest is stale; run exporter without --check');
	}
	const expected = new Set([manifestPath]);
	for (const output of generated) {
		const path = resolve(staticRoot, output.record.file);
		expected.add(path);
		if (!(await readFile(path)).equals(output.buffer)) {
			throw new Error(`Summonable hero runtime bytes are stale: ${output.record.file}`);
		}
	}
	const extra = (await listFiles(outputRoot)).find((file) => !expected.has(file));
	if (extra)
		throw new Error(`Unexpected summonable runtime output: ${relative(workspaceRoot, extra)}`);
}

async function write() {
	const requiredPrefix = `${resolve(staticRoot, 'runtime')}${sep}`;
	if (!outputRoot.startsWith(requiredPrefix) || outputRoot === resolve(staticRoot, 'runtime')) {
		throw new Error('Refusing to replace an unsafe summonable runtime output directory');
	}
	await rm(outputRoot, { recursive: true, force: true });
	for (const output of generated) {
		const path = resolve(staticRoot, output.record.file);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, output.buffer);
	}
	await mkdir(outputRoot, { recursive: true });
	await writeFile(
		manifestPath,
		await format(JSON.stringify(manifest), { parser: 'json', useTabs: true, printWidth: 100 })
	);
}

const mode = process.argv.includes('--check') ? 'check' : 'write';
if (mode === 'check') await check();
else await write();

process.stdout.write(
	`${JSON.stringify({ mode, heroes: manifest.entries.length, assets: generated.length, bytes: manifest.totalBytes })}\n`
);
