import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	StoryWorkshopSourceSchema,
	createStoryWorkshopReport
} from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const root = process.cwd();
const sourcePath = path.join(root, 'packages/evaluation/fixtures/story-workshop-band-02-v1.json');
const outputPath = path.join(root, 'docs/evidence/phase-7-fin009-story-workshop.json');
const source = StoryWorkshopSourceSchema.parse(JSON.parse(await readFile(sourcePath, 'utf8')));
const report = createStoryWorkshopReport(source);
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
		throw new Error(`Story workshop artifact is stale: ${path.relative(root, outputPath)}`);
	}
} else {
	await writeFile(outputPath, expected, 'utf8');
}

process.stdout.write(
	`${report.status}\n${report.summary.validForReviewCount}/${report.summary.proposalCount} reviewable proposals\n${report.summary.readyForCompilationCount} ready for compilation\n`
);
