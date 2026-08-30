import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { format } from 'prettier';

import { createEnemyAffinityExpansionBundle } from './enemy-affinity-expansion-lib.js';

const workspaceRoot = process.cwd();
const check = process.argv.includes('--check');
const bundle = createEnemyAffinityExpansionBundle();

for (const artifact of bundle.artifacts) {
	const outputPath = path.resolve(workspaceRoot, artifact.path);
	const expected = await format(JSON.stringify(artifact.value), {
		filepath: outputPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	const current = await readFile(outputPath, 'utf8').catch(() => null);
	if (check) {
		if (current !== expected) {
			throw new Error(
				`Expansion artifact is missing or stale: ${artifact.path}; run pnpm export:enemy-affinity-expansion`
			);
		}
	} else {
		await mkdir(path.dirname(outputPath), { recursive: true });
		await writeFile(outputPath, expected, 'utf8');
	}
}

process.stdout.write(
	`${JSON.stringify(
		{
			mode: check ? 'check' : 'write',
			targets: bundle.targets.length,
			assignments: bundle.assignments.length,
			artifacts: bundle.artifacts.length
		},
		null,
		2
	)}\n`
);
