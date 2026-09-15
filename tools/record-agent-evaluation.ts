import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { OpenAIModelPolicy } from '../packages/policies/src/openai.js';
import {
	createAgentEvaluationCorpus,
	createRecordedProviderRun,
	evaluateRecordedProviderRun
} from '../packages/evaluation/src/index.js';
import { format } from 'prettier';

const acknowledgment = '--acknowledge-paid-provider-run';
if (!process.argv.includes(acknowledgment)) {
	throw new Error(`A paid corpus run requires ${acknowledgment}`);
}
if (process.env.CI) throw new Error('Paid provider evaluation is disabled in CI');
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for a recorded provider run');

const corpus = await createAgentEvaluationCorpus();
const policy = new OpenAIModelPolicy({
	model: 'gpt-5-nano',
	apiKey,
	maxOutputTokens: 800,
	reasoningEffort: 'minimal',
	timeoutMs: 30_000
});
const cases = [];
for (const caseDefinition of corpus.cases) {
	const startedAt = process.hrtime.bigint();
	const result = await policy.decide(caseDefinition.packet);
	const elapsedNanoseconds = process.hrtime.bigint() - startedAt;
	cases.push({
		caseId: caseDefinition.caseId,
		latencyMs: Math.max(1, Math.round(Number(elapsedNanoseconds) / 1_000_000)),
		result
	});
}

const recordedAt = new Date().toISOString();
const run = createRecordedProviderRun(corpus, cases, recordedAt);
const report = evaluateRecordedProviderRun(corpus, run);
const outputRoot = path.join(
	process.cwd(),
	'artifacts',
	'local-provider-runs',
	recordedAt.replaceAll(/[:.]/gu, '-')
);
await mkdir(outputRoot, { recursive: true });

for (const [fileName, value] of [
	['recorded-run.json', run],
	['recorded-report.json', report]
] as const) {
	const outputPath = path.join(outputRoot, fileName);
	const text = await format(JSON.stringify(value), {
		filepath: outputPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	await writeFile(outputPath, text, 'utf8');
}

process.stdout.write(`${outputRoot}\n${report.status}\n${report.reportHash}\n`);
