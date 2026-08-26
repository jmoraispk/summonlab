import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	StoryWorkshopSourceSchema,
	createStoryWorkshopReport
} from '../packages/evaluation/src/index.js';
import { OpenAIStoryWorkshop } from '../packages/policies/src/openai.js';
import { format } from 'prettier';

if (!process.argv.includes('--acknowledge-paid-provider-run')) {
	throw new Error(
		'Recording a model workshop requires --acknowledge-paid-provider-run because it may incur provider cost.'
	);
}

const apiKey = process.env.OPENAI_API_KEY?.trim();
const model = process.env.STORY_WORKSHOP_MODEL?.trim();
if (!apiKey) throw new Error('OPENAI_API_KEY is required for a recorded story workshop run.');
if (!model) throw new Error('STORY_WORKSHOP_MODEL is required for a recorded story workshop run.');

const root = process.cwd();
const sourcePath = path.join(root, 'packages/evaluation/fixtures/story-workshop-band-02-v1.json');
const current = StoryWorkshopSourceSchema.parse(JSON.parse(await readFile(sourcePath, 'utf8')));
const workshop = new OpenAIStoryWorkshop({ apiKey, model, reasoningEffort: 'high' });
const result = await workshop.generate(current.brief);
const next = StoryWorkshopSourceSchema.parse({
	...current,
	generatedAt: new Date().toISOString(),
	generation: {
		mode: 'model',
		promptVersion: result.promptVersion,
		generatorId: 'openai-responses-story-workshop-v1',
		requestedModel: result.requestedModel,
		resolvedModel: result.resolvedModel,
		providerResponseId: result.responseId,
		requestHash: result.requestHash,
		outputHash: result.outputHash,
		usage: result.usage ?? {
			inputTokens: 0,
			cachedInputTokens: 0,
			outputTokens: 0,
			reasoningTokens: 0,
			totalTokens: 0
		}
	},
	proposals: result.output.candidates,
	reviews: []
});
const report = createStoryWorkshopReport(next);
if (report.summary.validForReviewCount !== report.summary.proposalCount) {
	throw new Error('The provider output crossed a story workshop catalog or production boundary.');
}

await writeFile(
	sourcePath,
	await format(JSON.stringify(next), {
		filepath: sourcePath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	}),
	'utf8'
);

process.stdout.write(
	`Recorded ${report.summary.proposalCount} reviewable proposals from ${result.resolvedModel}.\nRun pnpm export:story-workshop to refresh the checked report.\n`
);
