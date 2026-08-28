import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	OwnerPlaytestReportSchema,
	createPlaytestReleaseReport
} from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const root = process.cwd();
const sourcePath = path.join(root, 'docs/evidence/phase-7-fin007-moderated-playtest.json');
const outputPath = path.join(root, 'docs/evidence/phase-7-fin008-playtest-release.json');
const source = OwnerPlaytestReportSchema.parse(JSON.parse(await readFile(sourcePath, 'utf8')));
const report = createPlaytestReleaseReport(source);
const expected = await format(JSON.stringify(report), {
	filepath: outputPath,
	parser: 'json',
	useTabs: true,
	printWidth: 100,
	trailingComma: 'none'
});

if (process.argv.includes('--check')) {
	const current = await readFile(outputPath, 'utf8').catch(() => '');
	if (current !== expected) {
		throw new Error(`Playtest release artifact is stale: ${path.relative(root, outputPath)}`);
	}
} else {
	await writeFile(outputPath, expected, 'utf8');
}

process.stdout.write(
	`${report.status}\n${report.blockers.length} blockers\n${report.reportHash}\n`
);
