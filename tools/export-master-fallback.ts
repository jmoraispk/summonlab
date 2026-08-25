import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { generateMasterFallbackReport } from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const root = process.cwd();
const outputPath = path.join(root, 'docs/evidence/phase-6-master-fallback.json');
const check = process.argv.includes('--check');
const expected = await format(JSON.stringify(generateMasterFallbackReport()), {
	filepath: outputPath,
	parser: 'json',
	useTabs: true,
	printWidth: 100,
	trailingComma: 'none'
});

if (check) {
	const current = await readFile(outputPath, 'utf8').catch(() => '');
	if (current !== expected) {
		throw new Error(`Master fallback artifact is stale: ${path.relative(root, outputPath)}`);
	}
} else {
	await mkdir(path.dirname(outputPath), { recursive: true });
	await writeFile(outputPath, expected, 'utf8');
}
