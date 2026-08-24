import { describe, expect, it } from 'vitest';
import { ScriptedPolicy } from '@summonlab/policies';
import { OpenAIModelPolicy } from '@summonlab/policies/openai';

import {
	AgentEvaluationCorpusSchema,
	AgentEvaluationReportSchema,
	createAgentEvaluationCorpus,
	createAgentEvaluationReport,
	createRecordedProviderRun,
	evaluateRecordedProviderRun,
	verifyAgentEvaluationCorpus,
	verifyAgentEvaluationReport,
	verifyRecordedProviderRun
} from './index.js';

describe('fixed agent evaluation', () => {
	it('builds ten deterministic, credential-free, hash-bound packets', async () => {
		const left = await createAgentEvaluationCorpus();
		const right = await createAgentEvaluationCorpus();

		expect(left).toEqual(right);
		expect(AgentEvaluationCorpusSchema.parse(left)).toEqual(left);
		expect(verifyAgentEvaluationCorpus(left)).toBe(true);
		expect(left.cases).toHaveLength(10);
		expect(new Set(left.cases.map((item) => item.dimension))).toEqual(
			new Set([
				'personality-distinction',
				'directive-influence',
				'situational-needs',
				'authority-boundary',
				'witnessed-context',
				'secret-discovery'
			])
		);
		expect(JSON.stringify(left)).not.toContain('agent-evaluation-state:');
		expect(JSON.stringify(left)).not.toContain('OPENAI_API_KEY');
	});

	it('grades deterministic baselines and refuses to approve an unmeasured model', async () => {
		const corpus = await createAgentEvaluationCorpus();
		const report = await createAgentEvaluationReport(corpus);

		expect(AgentEvaluationReportSchema.parse(report)).toEqual(report);
		expect(verifyAgentEvaluationReport(report)).toBe(true);
		expect(report.baselines[0]).toMatchObject({
			candidateKind: 'scripted-baseline',
			status: 'baseline-pass',
			rates: {
				structuralSafety: 1,
				expectedAction: 1,
				memoryUse: 1,
				publicKnowledgeBoundary: 1,
				pairDistinctness: 1
			}
		});
		expect(report.baselines[1]?.rates.structuralSafety).toBe(1);
		expect(report.modelCandidate).toMatchObject({
			requestedModel: 'gpt-5-nano',
			resolvedModel: null,
			status: 'insufficient-evidence',
			gateReason: 'no-recorded-provider-results',
			latency: { status: 'unmeasured', sampleCount: 0 }
		});
		expect(report.modelCandidate.tokenEstimate.estimatedCorpusCostUsd).toBeGreaterThan(0);
	});

	it('replays recorded provider evidence into measured quality, usage, cost, and latency', async () => {
		const corpus = await createAgentEvaluationCorpus();
		const cases = await Promise.all(
			corpus.cases.map(async (caseDefinition, index) => {
				const scripted = await new ScriptedPolicy().decide(caseDefinition.packet);
				const policy = new OpenAIModelPolicy({
					model: 'gpt-5-nano',
					transport: {
						create: async () => ({
							id: `resp_test_${index}`,
							model: 'gpt-5-nano-test-snapshot',
							status: 'completed',
							outputText: JSON.stringify(scripted.decision),
							refusal: null,
							error: null,
							incompleteReason: null,
							serviceTier: 'default',
							usage: {
								inputTokens: 100 + index,
								cachedInputTokens: 10,
								outputTokens: 40,
								reasoningTokens: 5,
								totalTokens: 140 + index
							}
						})
					}
				});
				return {
					caseId: caseDefinition.caseId,
					latencyMs: (index + 1) * 100,
					result: await policy.decide(caseDefinition.packet)
				};
			})
		);
		const run = createRecordedProviderRun(corpus, cases, '2026-08-24T15:00:00.000Z');
		const report = evaluateRecordedProviderRun(corpus, run);

		expect(verifyRecordedProviderRun(run)).toBe(true);
		expect(report).toMatchObject({
			status: 'promotion-pass',
			coverage: { evaluated: 10, total: 10 },
			rates: { structuralSafety: 1, expectedAction: 1, pairDistinctness: 1 },
			latency: { status: 'measured', sampleCount: 10, p50Ms: 500, p95Ms: 1000 },
			resolvedModels: ['gpt-5-nano-test-snapshot']
		});
		expect(report.usage).toEqual({
			inputTokens: 1045,
			cachedInputTokens: 100,
			outputTokens: 400,
			reasoningTokens: 50,
			totalTokens: 1445
		});
		expect(report.actualCostUsd).toBeGreaterThan(0);
	});
});
