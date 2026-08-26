import { readFileSync } from 'node:fs';

import {
	STORY_WORKSHOP_MODEL_OUTPUT_VERSION,
	StoryWorkshopBriefSchema,
	StoryWorkshopModelOutputSchema
} from '@summonlab/contracts';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { describe, expect, it } from 'vitest';

import {
	ModelPolicyError,
	OPENAI_STORY_WORKSHOP_INSTRUCTIONS,
	OPENAI_STORY_WORKSHOP_SCHEMA_NAME,
	OpenAIStoryWorkshop,
	buildOpenAIStoryWorkshopRequest,
	type OpenAIModelResponse,
	type OpenAIResponsesTransport
} from './openai.js';

const source = JSON.parse(
	readFileSync(
		new URL('../../evaluation/fixtures/story-workshop-band-02-v1.json', import.meta.url),
		'utf8'
	)
) as { brief: unknown; proposals: unknown[] };
const brief = StoryWorkshopBriefSchema.parse(source.brief);
const output = StoryWorkshopModelOutputSchema.parse({
	schemaVersion: STORY_WORKSHOP_MODEL_OUTPUT_VERSION,
	candidates: source.proposals
});

class CapturingTransport implements OpenAIResponsesTransport {
	readonly requests: ResponseCreateParamsNonStreaming[] = [];

	constructor(private readonly outputText: string) {}

	async create(request: ResponseCreateParamsNonStreaming): Promise<OpenAIModelResponse> {
		this.requests.push(request);
		return {
			id: 'resp_story_workshop_fixture',
			model: 'gpt-5.6-2026-08-01',
			status: 'completed',
			outputText: this.outputText,
			refusal: null,
			error: null,
			incompleteReason: null,
			serviceTier: 'default',
			usage: {
				inputTokens: 2_400,
				cachedInputTokens: 0,
				outputTokens: 3_200,
				reasoningTokens: 500,
				totalTokens: 5_600
			}
		};
	}
}

describe('OpenAI development story workshop', () => {
	it('builds a server-only structured-output request from the exact brief', () => {
		const request = buildOpenAIStoryWorkshopRequest(brief, {
			model: 'gpt-5.6-2026-08-01',
			maxOutputTokens: 12_000,
			reasoningEffort: 'high'
		});

		expect(request.store).toBe(false);
		expect(request.background).toBe(false);
		expect(request.instructions).toBe(OPENAI_STORY_WORKSHOP_INSTRUCTIONS);
		expect(request.text?.format).toMatchObject({
			type: 'json_schema',
			name: OPENAI_STORY_WORKSHOP_SCHEMA_NAME
		});
		expect(JSON.parse(request.input as string)).toEqual({ brief });
	});

	it('returns typed proposal candidates with provider provenance', async () => {
		const transport = new CapturingTransport(JSON.stringify(output));
		const workshop = new OpenAIStoryWorkshop({
			model: 'gpt-5.6-2026-08-01',
			transport
		});
		const result = await workshop.generate(brief);

		expect(result.output.candidates).toHaveLength(2);
		expect(result.responseId).toBe('resp_story_workshop_fixture');
		expect(result.resolvedModel).toBe('gpt-5.6-2026-08-01');
		expect(result.requestHash).toMatch(/^[a-f0-9]{64}$/u);
		expect(transport.requests).toHaveLength(1);
	});

	it('rejects malformed model output before it reaches editorial review', async () => {
		const transport = new CapturingTransport(
			JSON.stringify({ schemaVersion: STORY_WORKSHOP_MODEL_OUTPUT_VERSION, candidates: [] })
		);
		const workshop = new OpenAIStoryWorkshop({ model: 'gpt-5.6-2026-08-01', transport });

		await expect(workshop.generate(brief)).rejects.toMatchObject({
			code: 'output-invalid'
		} satisfies Partial<ModelPolicyError>);
	});
});
