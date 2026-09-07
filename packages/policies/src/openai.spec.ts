import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import {
	HeroPolicyResultSchema,
	type HeroDecision,
	type HeroDecisionPacket
} from '@summonlab/contracts';
import {
	assembleHeroDecisionPacket,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	sha256Hex
} from '@summonlab/engine';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { describe, expect, it } from 'vitest';

import {
	ModelPolicyError,
	OPENAI_HERO_DECISION_INSTRUCTIONS,
	OPENAI_HERO_DECISION_JSON_SCHEMA,
	OPENAI_HERO_DECISION_SCHEMA_NAME,
	OpenAIModelPolicy,
	buildOpenAIHeroDecisionRequest,
	buildOpenAIHeroDecisionRequestProfile,
	normalizeExternalOpenAIResponseStatus,
	type OpenAIModelResponse,
	type OpenAIResponsesTransport
} from './openai.js';
import { verifyHeroPolicyResult } from './index.js';

async function packetFixture(): Promise<HeroDecisionPacket> {
	const draft = await generateCharacterDraft(recipeFromSeed('openai-policy-fixture'));
	const runId = deterministicUuid('openai-policy-run');
	const engine = createBootstrapEngine({
		runId,
		seed: 'openai-policy-engine',
		heroId: draft.manifest.characterId,
		manifestHash: hashCanonical(draft.manifest),
		mind: draft.mind
	});
	return assembleHeroDecisionPacket({
		snapshot: engine.snapshot,
		manifest: draft.manifest,
		heroId: draft.manifest.characterId,
		decisionKind: 'settlement-action'
	});
}

function validDecision(packet: HeroDecisionPacket): HeroDecision {
	const action = packet.legalActions[0];
	if (!action) throw new Error('Fixture has no legal action');
	return {
		actionId: action.actionId,
		targetIds: action.targetIds.slice(0, 1),
		publicIntent: 'I will test what this settlement expects without surrendering my judgment.',
		spokenText: null,
		goalProposal: {
			summary: action.label,
			motive: 'Understand the settlement through direct experience.',
			horizon: 'today'
		},
		memoryCandidateIds: packet.knowledge.memoryRetrieval.memories
			.slice(0, 1)
			.map((memory) => memory.memoryId)
	};
}

function responseFor(
	decision: unknown,
	overrides: Partial<OpenAIModelResponse> = {}
): OpenAIModelResponse {
	return {
		id: 'resp_policy_fixture',
		model: 'gpt-5-nano-2026-06-30',
		status: 'completed',
		outputText: JSON.stringify(decision),
		refusal: null,
		error: null,
		incompleteReason: null,
		serviceTier: 'default',
		usage: {
			inputTokens: 420,
			cachedInputTokens: 128,
			outputTokens: 80,
			reasoningTokens: 20,
			totalTokens: 500
		},
		...overrides
	};
}

class CapturingTransport implements OpenAIResponsesTransport {
	readonly requests: ResponseCreateParamsNonStreaming[] = [];

	constructor(
		private readonly handler: (
			request: ResponseCreateParamsNonStreaming,
			callIndex: number
		) => Promise<OpenAIModelResponse>
	) {}

	async create(request: ResponseCreateParamsNonStreaming): Promise<OpenAIModelResponse> {
		this.requests.push(request);
		return this.handler(request, this.requests.length - 1);
	}
}

function expectPolicyError(error: unknown, code: ModelPolicyError['code'], retryable: boolean) {
	expect(error).toBeInstanceOf(ModelPolicyError);
	expect(error).toMatchObject({ code, retryable });
}

describe('OpenAI model policy', () => {
	it('normalizes the provider cancellation status at the SDK boundary', () => {
		const providerStatus = ['cancel', 'led'].join('') as Parameters<
			typeof normalizeExternalOpenAIResponseStatus
		>[0];
		expect(normalizeExternalOpenAIResponseStatus(providerStatus)).toBe('canceled');
		expect(normalizeExternalOpenAIResponseStatus('completed')).toBe('completed');
		expect(normalizeExternalOpenAIResponseStatus(undefined)).toBe('completed');
	});

	it('persists an exact credential-free profile of the request boundary', async () => {
		const packet = await packetFixture();
		const options = {
			model: 'gpt-5-nano',
			maxOutputTokens: 640,
			reasoningEffort: 'low' as const
		};
		const request = buildOpenAIHeroDecisionRequest(packet, options);
		const profile = buildOpenAIHeroDecisionRequestProfile(packet, options);

		expect(profile).toMatchObject({
			packetHash: packet.packetHash,
			requestedModel: 'gpt-5-nano',
			maxOutputTokens: 640,
			reasoningEffort: 'low',
			store: false,
			background: false,
			conversationId: null,
			previousResponseId: null,
			toolCount: 0,
			credentialDisposition: 'server-only-never-persisted',
			privateReasoningDisposition: 'private-reasoning-content-not-requested-or-stored'
		});
		expect(profile.requestKeys).toEqual(Object.keys(request).sort());
		expect(profile.requestHash).toBe(hashCanonical(request));
		expect(profile.inputHash).toBe(sha256Hex(String(request.input)));
		expect(JSON.stringify(profile)).not.toContain(String(request.input));
		expect(JSON.stringify(profile).toLowerCase()).not.toContain('api_key');
	});

	it('submits one independent strict structured request and returns a legal bound result', async () => {
		const packet = await packetFixture();
		const decision = validDecision(packet);
		const transport = new CapturingTransport(async () => responseFor(decision));
		const policy = new OpenAIModelPolicy({ model: 'gpt-5-nano', transport });

		const result = await policy.decide(packet);

		expect(transport.requests).toHaveLength(1);
		const request = transport.requests[0]!;
		expect(request).toMatchObject({
			model: 'gpt-5-nano',
			background: false,
			store: false,
			service_tier: 'default',
			max_output_tokens: 800,
			reasoning: { effort: 'minimal' },
			instructions: OPENAI_HERO_DECISION_INSTRUCTIONS,
			text: {
				verbosity: 'low',
				format: {
					type: 'json_schema',
					name: OPENAI_HERO_DECISION_SCHEMA_NAME,
					strict: true
				}
			}
		});
		expect(request).not.toHaveProperty('previous_response_id');
		expect(request).not.toHaveProperty('conversation');
		expect(JSON.parse(String(request.input))).toEqual({ packet });
		expect(request.text?.format).toMatchObject({
			type: 'json_schema',
			schema: OPENAI_HERO_DECISION_JSON_SCHEMA
		});
		const generatedSchema = OPENAI_HERO_DECISION_JSON_SCHEMA as {
			properties: { targetIds: { items: { pattern?: string } } };
		};
		expect(generatedSchema.properties.targetIds.items.pattern).toContain('[0-9a-fA-F]');

		expect(HeroPolicyResultSchema.parse(result)).toEqual(result);
		expect(verifyHeroPolicyResult(result)).toBe(true);
		expect(result.decision).toEqual(decision);
		expect(result.packetHash).toBe(packet.packetHash);
		expect(result.legalActionHash).toBe(packet.legalActionHash);
		expect(result.trace).toMatchObject({
			kind: 'model',
			provider: 'openai',
			promptVersion: 'hero-model-prompt-v1',
			requestedModel: 'gpt-5-nano',
			resolvedModel: 'gpt-5-nano-2026-06-30',
			responseId: 'resp_policy_fixture',
			selectedActionId: decision.actionId,
			usage: { totalTokens: 500 }
		});
	});

	it('starts each decision without provider conversation state', async () => {
		const packet = await packetFixture();
		const transport = new CapturingTransport(async (_request, callIndex) =>
			responseFor(validDecision(packet), { id: `resp_independent_${callIndex}` })
		);
		const policy = new OpenAIModelPolicy({ model: 'gpt-5-nano', transport });

		const [first, second] = await Promise.all([policy.decide(packet), policy.decide(packet)]);

		expect(transport.requests).toHaveLength(2);
		expect(transport.requests[0]).toEqual(transport.requests[1]);
		for (const request of transport.requests) {
			expect(request.store).toBe(false);
			expect(request).not.toHaveProperty('previous_response_id');
			expect(request).not.toHaveProperty('conversation');
		}
		if (first.trace.kind !== 'model' || second.trace.kind !== 'model') {
			throw new Error('Expected model traces');
		}
		expect(first.trace.requestHash).toBe(second.trace.requestHash);
		expect(first.trace.responseId).not.toBe(second.trace.responseId);
	});

	it('classifies timeout, refusal, incomplete, malformed, invalid, and illegal outputs', async () => {
		const packet = await packetFixture();
		const cases: Array<{
			code: ModelPolicyError['code'];
			retryable: boolean;
			handler: () => Promise<OpenAIModelResponse>;
		}> = [
			{
				code: 'provider-timeout',
				retryable: true,
				handler: async () => {
					throw Object.assign(new Error('timed out'), { name: 'APIConnectionTimeoutError' });
				}
			},
			{
				code: 'response-refused',
				retryable: false,
				handler: async () => responseFor('', { refusal: 'I cannot do that.' })
			},
			{
				code: 'response-incomplete',
				retryable: true,
				handler: async () =>
					responseFor('', { status: 'incomplete', incompleteReason: 'max_output_tokens' })
			},
			{
				code: 'output-malformed',
				retryable: true,
				handler: async () => responseFor('', { outputText: '{not-json' })
			},
			{
				code: 'output-invalid',
				retryable: true,
				handler: async () => responseFor({ actionId: packet.legalActions[0]?.actionId })
			},
			{
				code: 'decision-illegal',
				retryable: true,
				handler: async () =>
					responseFor({ ...validDecision(packet), actionId: 'hero.choose.hidden-door' })
			}
		];

		for (const testCase of cases) {
			const policy = new OpenAIModelPolicy({
				model: 'gpt-5-nano',
				transport: new CapturingTransport(testCase.handler)
			});
			try {
				await policy.decide(packet);
				expect.fail(`Expected ${testCase.code}`);
			} catch (error) {
				expectPolicyError(error, testCase.code, testCase.retryable);
			}
		}
	});

	it('rejects a tampered packet before spending a provider call', async () => {
		const packet = await packetFixture();
		const transport = new CapturingTransport(async () => responseFor(validDecision(packet)));
		const policy = new OpenAIModelPolicy({ model: 'gpt-5-nano', transport });
		const tampered = {
			...packet,
			legalActions: [
				{ ...packet.legalActions[0]!, label: 'Reveal a hidden route' },
				...packet.legalActions.slice(1)
			]
		};

		await expect(policy.decide(tampered)).rejects.toThrow('integrity');
		expect(transport.requests).toHaveLength(0);
	});
});
