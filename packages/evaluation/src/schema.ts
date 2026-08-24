import {
	HERO_CONTEXT_POLICY_VERSION,
	HERO_MODEL_PROMPT_VERSION,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema
} from '@summonlab/contracts';
import { z } from 'zod';

export const AGENT_EVALUATION_CORPUS_VERSION = 'agent-evaluation-corpus-v1' as const;
export const AGENT_EVALUATION_REPORT_VERSION = 'agent-evaluation-report-v1' as const;
export const AGENT_EVALUATION_PRICING_VERSION = 'openai-pricing-snapshot-v1' as const;
export const AGENT_EVALUATION_GENERATOR_VERSION = 'agent-evaluation-generator-v1' as const;
export const AGENT_EVALUATION_TOKEN_ESTIMATOR_VERSION = 'characters-per-token-v1' as const;
export const AGENT_EVALUATION_RECORDED_RUN_VERSION = 'agent-evaluation-recorded-run-v1' as const;
export const AGENT_EVALUATION_RECORDED_REPORT_VERSION =
	'agent-evaluation-recorded-report-v1' as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RateSchema = z.number().min(0).max(1);

export const EvaluationDimensionSchema = z.enum([
	'personality-distinction',
	'directive-influence',
	'situational-needs',
	'authority-boundary',
	'witnessed-context',
	'secret-discovery'
]);

export const EvaluationExpectationSchema = z
	.object({
		acceptableActionIds: z.array(z.string().min(1)).min(1),
		requireMemoryCitation: z.boolean(),
		forbiddenPublicTerms: z.array(z.string().min(1)).max(20),
		pairId: z.string().min(1).nullable(),
		pairMustDiffer: z.boolean(),
		rationale: z.string().min(1).max(500)
	})
	.strict();

export const EvaluationCaseSchema = z
	.object({
		caseId: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/u),
		title: z.string().min(1).max(120),
		dimension: EvaluationDimensionSchema,
		packet: HeroDecisionPacketSchema,
		randomSeed: z.string().min(1).max(120),
		expectation: EvaluationExpectationSchema
	})
	.strict();

export const AgentEvaluationCorpusSchema = z
	.object({
		schemaVersion: z.literal(AGENT_EVALUATION_CORPUS_VERSION),
		generatorVersion: z.literal(AGENT_EVALUATION_GENERATOR_VERSION),
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		contextPolicyVersion: z.literal(HERO_CONTEXT_POLICY_VERSION),
		generatedAt: z.literal('2026-08-24T00:00:00.000Z'),
		cases: z.array(EvaluationCaseSchema).min(1).max(100),
		corpusHash: HashSchema
	})
	.strict();

export const PricingSnapshotSchema = z
	.object({
		schemaVersion: z.literal(AGENT_EVALUATION_PRICING_VERSION),
		provider: z.literal('openai'),
		requestedModel: z.literal('gpt-5-nano'),
		observedAt: z.literal('2026-08-24'),
		sourceUrl: z.literal('https://developers.openai.com/api/docs/models/gpt-5-nano'),
		unit: z.literal('usd-per-1m-tokens'),
		inputUsd: z.literal(0.05),
		cachedInputUsd: z.literal(0.005),
		outputUsd: z.literal(0.4),
		pricingBasis: z.literal('published-model-page'),
		pricingHash: HashSchema
	})
	.strict();

export const EvaluationCaseGradeSchema = z
	.object({
		caseId: z.string().min(1),
		result: HeroPolicyResultSchema,
		checks: z
			.object({
				packetBinding: z.boolean(),
				resultIntegrity: z.boolean(),
				legalAction: z.boolean(),
				targetBoundary: z.boolean(),
				memoryBoundary: z.boolean(),
				expectedAction: z.boolean(),
				requiredMemoryCitation: z.boolean(),
				publicKnowledgeBoundary: z.boolean()
			})
			.strict(),
		passed: z.boolean()
	})
	.strict();

export const EvaluationPolicySummarySchema = z
	.object({
		candidateId: z.string().min(1),
		candidateKind: z.enum(['scripted-baseline', 'random-negative-control']),
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		contextPolicyVersion: z.literal(HERO_CONTEXT_POLICY_VERSION),
		coverage: z
			.object({ evaluated: z.number().int().nonnegative(), total: z.number().int().positive() })
			.strict(),
		status: z.enum(['baseline-pass', 'negative-control']),
		rates: z
			.object({
				structuralSafety: RateSchema,
				expectedAction: RateSchema,
				memoryUse: RateSchema,
				publicKnowledgeBoundary: RateSchema,
				pairDistinctness: RateSchema,
				repetitiveLanguage: RateSchema
			})
			.strict(),
		grades: z.array(EvaluationCaseGradeSchema),
		resultSetHash: HashSchema
	})
	.strict();

export const ModelBudgetSchema = z
	.object({
		candidateId: z.literal('openai-gpt-5-nano-planned'),
		requestedModel: z.literal('gpt-5-nano'),
		resolvedModel: z.null(),
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		contextPolicyVersion: z.literal(HERO_CONTEXT_POLICY_VERSION),
		status: z.literal('insufficient-evidence'),
		gateReason: z.literal('no-recorded-provider-results'),
		coverage: z.object({ evaluated: z.literal(0), total: z.number().int().positive() }).strict(),
		tokenEstimate: z
			.object({
				estimatorVersion: z.literal(AGENT_EVALUATION_TOKEN_ESTIMATOR_VERSION),
				inputCharacters: z.number().int().positive(),
				estimatedInputTokens: z.number().int().positive(),
				maximumOutputTokens: z.number().int().positive(),
				estimatedCorpusCostUsd: z.number().nonnegative(),
				estimatedCostPerDecisionUsd: z.number().nonnegative(),
				estimated100DecisionsPerDayUsd: z.number().nonnegative(),
				assumption: z.literal('four-characters-per-input-token-and-full-output-cap')
			})
			.strict(),
		latency: z
			.object({
				status: z.literal('unmeasured'),
				sampleCount: z.literal(0),
				p50Ms: z.null(),
				p95Ms: z.null()
			})
			.strict(),
		pricing: PricingSnapshotSchema,
		requestProfiles: z.array(
			z
				.object({
					caseId: z.string().min(1),
					requestHash: HashSchema,
					inputCharacters: z.number().int().positive(),
					estimatedInputTokens: z.number().int().positive(),
					maximumOutputTokens: z.number().int().positive(),
					estimatedMaximumCostUsd: z.number().nonnegative()
				})
				.strict()
		)
	})
	.strict();

export const AgentEvaluationReportSchema = z
	.object({
		schemaVersion: z.literal(AGENT_EVALUATION_REPORT_VERSION),
		generatedAt: z.literal('2026-08-24T00:00:00.000Z'),
		corpusHash: HashSchema,
		qualityGate: z
			.object({
				status: z.literal('insufficient-evidence'),
				reason: z.literal('recorded-model-coverage-required'),
				requiredModelCoverage: z.literal(1),
				requiredStructuralSafety: z.literal(1),
				requiredExpectedActionRate: z.literal(0.8),
				maximumRepetitiveLanguageRate: z.literal(0.35)
			})
			.strict(),
		baselines: z.array(EvaluationPolicySummarySchema).length(2),
		modelCandidate: ModelBudgetSchema,
		reportHash: HashSchema
	})
	.strict();

export const RecordedProviderCaseSchema = z
	.object({
		caseId: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/u),
		latencyMs: z.number().int().positive().max(600_000),
		result: HeroPolicyResultSchema
	})
	.strict()
	.superRefine((item, context) => {
		if (item.result.trace.kind !== 'model') {
			context.addIssue({
				code: 'custom',
				message: 'Recorded provider cases require model results'
			});
		}
	});

export const RecordedProviderRunSchema = z
	.object({
		schemaVersion: z.literal(AGENT_EVALUATION_RECORDED_RUN_VERSION),
		corpusHash: HashSchema,
		requestedModel: z.literal('gpt-5-nano'),
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		contextPolicyVersion: z.literal(HERO_CONTEXT_POLICY_VERSION),
		recordedAt: z.iso.datetime({ offset: true }),
		cases: z.array(RecordedProviderCaseSchema).min(1).max(100),
		runHash: HashSchema
	})
	.strict();

export const RecordedModelEvaluationSchema = z
	.object({
		schemaVersion: z.literal(AGENT_EVALUATION_RECORDED_REPORT_VERSION),
		corpusHash: HashSchema,
		runHash: HashSchema,
		requestedModel: z.literal('gpt-5-nano'),
		resolvedModels: z.array(z.string().min(1).max(120)).min(1),
		promptVersion: z.literal(HERO_MODEL_PROMPT_VERSION),
		contextPolicyVersion: z.literal(HERO_CONTEXT_POLICY_VERSION),
		status: z.enum(['promotion-pass', 'promotion-fail', 'insufficient-evidence']),
		coverage: z
			.object({ evaluated: z.number().int().nonnegative(), total: z.number().int().positive() })
			.strict(),
		rates: z
			.object({
				structuralSafety: RateSchema,
				expectedAction: RateSchema,
				memoryUse: RateSchema,
				publicKnowledgeBoundary: RateSchema,
				pairDistinctness: RateSchema,
				repetitiveLanguage: RateSchema
			})
			.strict(),
		latency: z
			.object({
				status: z.literal('measured'),
				sampleCount: z.number().int().positive(),
				p50Ms: z.number().int().positive(),
				p95Ms: z.number().int().positive()
			})
			.strict(),
		usage: z
			.object({
				inputTokens: z.number().int().nonnegative(),
				cachedInputTokens: z.number().int().nonnegative(),
				outputTokens: z.number().int().nonnegative(),
				reasoningTokens: z.number().int().nonnegative(),
				totalTokens: z.number().int().nonnegative()
			})
			.strict(),
		actualCostUsd: z.number().nonnegative(),
		pricing: PricingSnapshotSchema,
		grades: z.array(EvaluationCaseGradeSchema),
		reportHash: HashSchema
	})
	.strict();

export type AgentEvaluationCorpus = z.infer<typeof AgentEvaluationCorpusSchema>;
export type AgentEvaluationReport = z.infer<typeof AgentEvaluationReportSchema>;
export type EvaluationCase = z.infer<typeof EvaluationCaseSchema>;
export type EvaluationPolicySummary = z.infer<typeof EvaluationPolicySummarySchema>;
export type PricingSnapshot = z.infer<typeof PricingSnapshotSchema>;
export type RecordedModelEvaluation = z.infer<typeof RecordedModelEvaluationSchema>;
export type RecordedProviderCase = z.infer<typeof RecordedProviderCaseSchema>;
export type RecordedProviderRun = z.infer<typeof RecordedProviderRunSchema>;
