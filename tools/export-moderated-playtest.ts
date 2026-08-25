import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	ModeratedPlaytestSourceSchema,
	createModeratedPlaytestReport
} from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const root = process.cwd();
const sourcePath = path.join(
	root,
	'packages/evaluation/fixtures/moderated-playtest-cohort-v1.json'
);
const outputPath = path.join(root, 'docs/evidence/phase-7-fin007-moderated-playtest.json');
const source = ModeratedPlaytestSourceSchema.parse(JSON.parse(await readFile(sourcePath, 'utf8')));
const expected = await format(JSON.stringify(createModeratedPlaytestReport(source)), {
	filepath: outputPath,
	parser: 'json',
	useTabs: true,
	printWidth: 100,
	trailingComma: 'none'
});

if (process.argv.includes('--check')) {
	const current = await readFile(outputPath, 'utf8').catch(() => '');
	if (current !== expected) {
		throw new Error(`Moderated playtest artifact is stale: ${path.relative(root, outputPath)}`);
	}
} else {
	await writeFile(outputPath, expected, 'utf8');
}

const report = createModeratedPlaytestReport(source);
process.stdout.write(
	`${report.moderationStatus}\n${report.qualityGate.conductedSessionCount}/${report.qualityGate.requiredSessionCount} sessions\n${report.releaseRecommendation}\n`
);
