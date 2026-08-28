import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	OwnerPlaytestSourceSchema,
	createOwnerPlaytestReport
} from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const root = process.cwd();
const sourcePath = path.join(
	root,
	'packages/evaluation/fixtures/moderated-playtest-cohort-v1.json'
);
const outputPath = path.join(root, 'docs/evidence/phase-7-fin007-moderated-playtest.json');
const source = OwnerPlaytestSourceSchema.parse(JSON.parse(await readFile(sourcePath, 'utf8')));
const expected = await format(JSON.stringify(createOwnerPlaytestReport(source)), {
	filepath: outputPath,
	parser: 'json',
	useTabs: true,
	printWidth: 100,
	trailingComma: 'none'
});

if (process.argv.includes('--check')) {
	const current = await readFile(outputPath, 'utf8').catch(() => '');
	if (current !== expected) {
		throw new Error(`Owner playtest artifact is stale: ${path.relative(root, outputPath)}`);
	}
} else {
	await writeFile(outputPath, expected, 'utf8');
}

const report = createOwnerPlaytestReport(source);
process.stdout.write(
	`${report.playtestStatus}\n${report.qualityGate.conductedSessionCount}/${report.qualityGate.requiredSessionCount} owner playthrough\n${report.releaseRecommendation}\n`
);
