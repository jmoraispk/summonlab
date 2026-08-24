import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	createAgentEvaluationCorpus,
	createAgentEvaluationReport
} from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const root = process.cwd();
const outputs = [
	{
		path: path.join(root, 'packages/evaluation/fixtures/agent-corpus-v1.json'),
		value: await createAgentEvaluationCorpus()
	},
	{
		path: path.join(root, 'docs/evidence/phase-5-agent-evaluation.json'),
		value: await createAgentEvaluationReport(await createAgentEvaluationCorpus())
	}
] as const;
const check = process.argv.includes('--check');

for (const output of outputs) {
	const expected = await format(JSON.stringify(output.value), {
		filepath: output.path,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	if (check) {
		const current = await readFile(output.path, 'utf8').catch(() => '');
		if (current !== expected) {
			throw new Error(`Agent evaluation artifact is stale: ${path.relative(root, output.path)}`);
		}
	} else {
		await mkdir(path.dirname(output.path), { recursive: true });
		await writeFile(output.path, expected, 'utf8');
	}
}
