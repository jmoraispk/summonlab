import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { build } from 'tsup';

const repositoryRoot = process.cwd();
const entrypoint = resolve(repositoryRoot, 'tools/check-family-affinity-production-dispatch.ts');
const committed = resolve(
	repositoryRoot,
	'skills/summonlab-image-production/scripts/family_dispatch_gate.mjs'
);

async function render(outputDirectory: string): Promise<Buffer> {
	await build({
		entry: { family_dispatch_gate: entrypoint },
		format: ['esm'],
		platform: 'node',
		target: 'node24',
		outDir: outputDirectory,
		outExtension: () => ({ js: '.mjs' }),
		bundle: true,
		splitting: false,
		sourcemap: false,
		dts: false,
		clean: false,
		minify: true,
		treeshake: true,
		noExternal: ['zod'],
		silent: true
	});
	const bytes = await readFile(join(outputDirectory, 'family_dispatch_gate.mjs'));
	return Buffer.from(bytes.toString('utf8').replace(/[\t ]+$/gmu, ''));
}

async function main() {
	const mode = process.argv[2];
	if (mode !== '--write' && mode !== '--check') {
		throw new Error('usage: build-family-affinity-dispatch-bundle.ts --write|--check');
	}
	const temporary = await mkdtemp(join(tmpdir(), 'family-dispatch-bundle-'));
	try {
		const bytes = await render(temporary);
		if (mode === '--write') {
			await writeFile(committed, bytes, { flag: 'w' });
			console.log(`Wrote sealed family dispatch bundle (${bytes.length} bytes).`);
			return;
		}
		const existing = await readFile(committed);
		if (!existing.equals(bytes)) {
			throw new Error('Committed family dispatch bundle is stale or nondeterministic');
		}
		console.log(`Verified sealed family dispatch bundle (${bytes.length} bytes).`);
	} finally {
		await rm(temporary, { recursive: true, force: true });
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
