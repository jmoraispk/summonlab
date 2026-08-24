import {
	HERO_CONTEXT_POLICY_VERSION,
	HERO_MODEL_PROMPT_VERSION,
	type HeroDecisionPacket,
	type HeroPolicyResult
} from '@summonlab/contracts';
import { hashCanonical } from '@summonlab/engine';
import {
	RandomPolicy,
	ScriptedPolicy,
	verifyHeroPolicyResult,
	type HeroPolicy
} from '@summonlab/policies';
import { buildOpenAIHeroDecisionRequestProfile } from '@summonlab/policies/openai';

import {
	AGENT_EVALUATION_PRICING_VERSION,
	AGENT_EVALUATION_RECORDED_REPORT_VERSION,
	AGENT_EVALUATION_RECORDED_RUN_VERSION,
	AGENT_EVALUATION_REPORT_VERSION,
	AGENT_EVALUATION_TOKEN_ESTIMATOR_VERSION,
	AgentEvaluationReportSchema,
	PricingSnapshotSchema,
	RecordedModelEvaluationSchema,
	RecordedProviderRunSchema,
	type AgentEvaluationCorpus,
	type AgentEvaluationReport,
	type EvaluationCase,
	type EvaluationPolicySummary,
	type PricingSnapshot,
	type RecordedModelEvaluation,
	type RecordedProviderCase,
	type RecordedProviderRun
} from './schema.js';

const FIXED_AT = '2026-08-24T00:00:00.000Z' as const;

function unsignedHash<T extends Record<string, unknown>>(value: T, key: keyof T): string {
	const unsigned = { ...value };
	delete unsigned[key];
	return hashCanonical(unsigned);
}

export function createOpenAIPricingSnapshot(): PricingSnapshot {
	const unsigned = {
		schemaVersion: AGENT_EVALUATION_PRICING_VERSION,
		provider: 'openai' as const,
		requestedModel: 'gpt-5-nano' as const,
		observedAt: '2026-08-24' as const,
		sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5-nano' as const,
		unit: 'usd-per-1m-tokens' as const,
		inputUsd: 0.05 as const,
		cachedInputUsd: 0.005 as const,
		outputUsd: 0.4 as const,
		pricingBasis: 'published-model-page' as const
	};
	return PricingSnapshotSchema.parse({ ...unsigned, pricingHash: hashCanonical(unsigned) });
}

function publicOutput(result: HeroPolicyResult): string {
	return [result.decision.publicIntent, result.decision.spokenText ?? ''].join(' ').toLowerCase();
}

function gradeResult(caseDefinition: EvaluationCase, result: HeroPolicyResult) {
	const packet = caseDefinition.packet;
	const selectedAction = packet.legalActions.find(
		(action) => action.actionId === result.decision.actionId
	);
	const availableMemoryIds = new Set(
		packet.knowledge.memoryRetrieval.memories.map((memory) => memory.memoryId)
	);
	const publicText = publicOutput(result);
	const checks = {
		packetBinding:
			result.packetId === packet.packetId &&
			result.packetHash === packet.packetHash &&
			result.legalActionHash === packet.legalActionHash &&
			result.decisionKind === packet.decisionKind &&
			result.world.stateHash === packet.world.stateHash &&
			result.world.eventCursor === packet.world.eventCursor &&
			result.world.stateVersion === packet.world.stateVersion,
		resultIntegrity: verifyHeroPolicyResult(result),
		legalAction: selectedAction !== undefined,
		targetBoundary:
			selectedAction !== undefined &&
			new Set(result.decision.targetIds).size === result.decision.targetIds.length &&
			result.decision.targetIds.every((targetId) => selectedAction.targetIds.includes(targetId)),
		memoryBoundary:
			new Set(result.decision.memoryCandidateIds).size ===
				result.decision.memoryCandidateIds.length &&
			result.decision.memoryCandidateIds.every((memoryId) => availableMemoryIds.has(memoryId)),
		expectedAction: caseDefinition.expectation.acceptableActionIds.includes(
			result.decision.actionId
		),
		requiredMemoryCitation:
			!caseDefinition.expectation.requireMemoryCitation ||
			result.decision.memoryCandidateIds.length > 0,
		publicKnowledgeBoundary: caseDefinition.expectation.forbiddenPublicTerms.every(
			(term) => !publicText.includes(term.toLowerCase())
		)
	};
	return {
		caseId: caseDefinition.caseId,
		result,
		checks,
		passed: Object.values(checks).every(Boolean)
	};
}

function ratio(numerator: number, denominator: number): number {
	return denominator === 0 ? 1 : Number((numerator / denominator).toFixed(4));
}

function pairDistinctness(
	corpus: AgentEvaluationCorpus,
	results: Array<HeroPolicyResult | undefined>
): number {
	const pairIds = [
		...new Set(
			corpus.cases
				.filter((item) => item.expectation.pairMustDiffer)
				.map((item) => item.expectation.pairId)
				.filter((pairId): pairId is string => pairId !== null)
		)
	];
	const passed = pairIds.filter((pairId) => {
		const indexes = corpus.cases
			.map((item, index) => ({ item, index }))
			.filter(({ item }) => item.expectation.pairId === pairId)
			.map(({ index }) => index);
		const selected = indexes.map((index) => results[index]?.decision.actionId);
		return selected.every(Boolean) && new Set(selected).size === selected.length;
	}).length;
	return ratio(passed, pairIds.length);
}

function repetitiveLanguageRate(results: HeroPolicyResult[]): number {
	const normalized = results
		.flatMap((result) => [result.decision.publicIntent, result.decision.spokenText])
		.filter((text): text is string => text !== null)
		.map((text) =>
			text
				.toLowerCase()
				.replaceAll(/[^a-z0-9]+/gu, ' ')
				.trim()
		);
	const duplicates = normalized.length - new Set(normalized).size;
	return ratio(duplicates, normalized.length);
}

async function evaluatePolicy(
	corpus: AgentEvaluationCorpus,
	candidateKind: EvaluationPolicySummary['candidateKind'],
	policyFor: (caseDefinition: EvaluationCase) => HeroPolicy
): Promise<EvaluationPolicySummary> {
	const results = await Promise.all(
		corpus.cases.map((caseDefinition) => policyFor(caseDefinition).decide(caseDefinition.packet))
	);
	const grades = corpus.cases.map((caseDefinition, index) => {
		const result = results[index];
		if (!result) throw new Error(`Missing policy result for ${caseDefinition.caseId}`);
		return gradeResult(caseDefinition, result);
	});
	const structuralPasses = grades.filter((grade) =>
		[
			grade.checks.packetBinding,
			grade.checks.resultIntegrity,
			grade.checks.legalAction,
			grade.checks.targetBoundary,
			grade.checks.memoryBoundary
		].every(Boolean)
	).length;
	const memoryCases = corpus.cases.filter((item) => item.expectation.requireMemoryCitation);
	const memoryPasses = grades.filter(
		(grade) =>
			corpus.cases.find((item) => item.caseId === grade.caseId)?.expectation
				.requireMemoryCitation && grade.checks.requiredMemoryCitation
	).length;
	const unsigned = {
		candidateId: candidateKind === 'scripted-baseline' ? 'scripted-policy-v1' : 'random-policy-v1',
		candidateKind,
		promptVersion: HERO_MODEL_PROMPT_VERSION as 'hero-model-prompt-v1',
		contextPolicyVersion: HERO_CONTEXT_POLICY_VERSION as 'hero-context-v1',
		coverage: { evaluated: grades.length, total: corpus.cases.length },
		status:
			candidateKind === 'scripted-baseline'
				? ('baseline-pass' as const)
				: ('negative-control' as const),
		rates: {
			structuralSafety: ratio(structuralPasses, grades.length),
			expectedAction: ratio(
				grades.filter((grade) => grade.checks.expectedAction).length,
				grades.length
			),
			memoryUse: ratio(memoryPasses, memoryCases.length),
			publicKnowledgeBoundary: ratio(
				grades.filter((grade) => grade.checks.publicKnowledgeBoundary).length,
				grades.length
			),
			pairDistinctness: pairDistinctness(corpus, results),
			repetitiveLanguage: repetitiveLanguageRate(results)
		},
		grades
	};
	return {
		...unsigned,
		resultSetHash: hashCanonical(results)
	};
}

function estimateTokens(inputCharacters: number): number {
	return Math.ceil(inputCharacters / 4);
}

function estimatedCost(
	inputTokens: number,
	maximumOutputTokens: number,
	pricing: PricingSnapshot
): number {
	return Number(
		(
			(inputTokens * pricing.inputUsd + maximumOutputTokens * pricing.outputUsd) /
			1_000_000
		).toFixed(8)
	);
}

function modelBudget(corpus: AgentEvaluationCorpus) {
	const pricing = createOpenAIPricingSnapshot();
	const requestProfiles = corpus.cases.map((caseDefinition) => {
		const profile = buildOpenAIHeroDecisionRequestProfile(caseDefinition.packet, {
			model: 'gpt-5-nano',
			maxOutputTokens: 800,
			reasoningEffort: 'minimal'
		});
		const estimatedInputTokens = estimateTokens(profile.inputCharacters);
		return {
			caseId: caseDefinition.caseId,
			requestHash: profile.requestHash,
			inputCharacters: profile.inputCharacters,
			estimatedInputTokens,
			maximumOutputTokens: profile.maxOutputTokens,
			estimatedMaximumCostUsd: estimatedCost(estimatedInputTokens, profile.maxOutputTokens, pricing)
		};
	});
	const inputCharacters = requestProfiles.reduce(
		(total, profile) => total + profile.inputCharacters,
		0
	);
	const estimatedInputTokens = requestProfiles.reduce(
		(total, profile) => total + profile.estimatedInputTokens,
		0
	);
	const maximumOutputTokens = requestProfiles.reduce(
		(total, profile) => total + profile.maximumOutputTokens,
		0
	);
	const estimatedCorpusCostUsd = Number(
		requestProfiles
			.reduce((total, profile) => total + profile.estimatedMaximumCostUsd, 0)
			.toFixed(8)
	);
	const estimatedCostPerDecisionUsd = Number(
		(estimatedCorpusCostUsd / requestProfiles.length).toFixed(8)
	);
	return {
		candidateId: 'openai-gpt-5-nano-planned' as const,
		requestedModel: 'gpt-5-nano' as const,
		resolvedModel: null,
		promptVersion: HERO_MODEL_PROMPT_VERSION,
		contextPolicyVersion: HERO_CONTEXT_POLICY_VERSION,
		status: 'insufficient-evidence' as const,
		gateReason: 'no-recorded-provider-results' as const,
		coverage: { evaluated: 0 as const, total: corpus.cases.length },
		tokenEstimate: {
			estimatorVersion: AGENT_EVALUATION_TOKEN_ESTIMATOR_VERSION,
			inputCharacters,
			estimatedInputTokens,
			maximumOutputTokens,
			estimatedCorpusCostUsd,
			estimatedCostPerDecisionUsd,
			estimated100DecisionsPerDayUsd: Number((estimatedCostPerDecisionUsd * 100).toFixed(8)),
			assumption: 'four-characters-per-input-token-and-full-output-cap' as const
		},
		latency: { status: 'unmeasured' as const, sampleCount: 0 as const, p50Ms: null, p95Ms: null },
		pricing,
		requestProfiles
	};
}

export async function createAgentEvaluationReport(
	corpus: AgentEvaluationCorpus
): Promise<AgentEvaluationReport> {
	const baselines = await Promise.all([
		evaluatePolicy(corpus, 'scripted-baseline', () => new ScriptedPolicy()),
		evaluatePolicy(
			corpus,
			'random-negative-control',
			(caseDefinition) => new RandomPolicy(caseDefinition.randomSeed)
		)
	]);
	const unsigned = {
		schemaVersion: AGENT_EVALUATION_REPORT_VERSION,
		generatedAt: FIXED_AT,
		corpusHash: corpus.corpusHash,
		qualityGate: {
			status: 'insufficient-evidence' as const,
			reason: 'recorded-model-coverage-required' as const,
			requiredModelCoverage: 1 as const,
			requiredStructuralSafety: 1 as const,
			requiredExpectedActionRate: 0.8 as const,
			maximumRepetitiveLanguageRate: 0.35 as const
		},
		baselines,
		modelCandidate: modelBudget(corpus)
	};
	return AgentEvaluationReportSchema.parse({ ...unsigned, reportHash: hashCanonical(unsigned) });
}

export function verifyAgentEvaluationReport(report: AgentEvaluationReport): boolean {
	return unsignedHash(report, 'reportHash') === report.reportHash;
}

export function verifyAgentEvaluationCorpus(corpus: AgentEvaluationCorpus): boolean {
	return unsignedHash(corpus, 'corpusHash') === corpus.corpusHash;
}

export function evaluationPacketBytes(packet: HeroDecisionPacket): number {
	return new TextEncoder().encode(JSON.stringify(packet)).byteLength;
}

export function createRecordedProviderRun(
	corpus: AgentEvaluationCorpus,
	cases: RecordedProviderCase[],
	recordedAt: string
): RecordedProviderRun {
	if (new Set(cases.map((item) => item.caseId)).size !== cases.length) {
		throw new Error('Recorded provider case IDs must be unique');
	}
	const corpusCases = new Map(corpus.cases.map((item) => [item.caseId, item]));
	for (const item of cases) {
		const caseDefinition = corpusCases.get(item.caseId);
		if (!caseDefinition)
			throw new Error(`Recorded provider case is outside the corpus: ${item.caseId}`);
		if (
			item.result.packetId !== caseDefinition.packet.packetId ||
			item.result.packetHash !== caseDefinition.packet.packetHash
		) {
			throw new Error(`Recorded provider result does not bind ${item.caseId}`);
		}
	}
	const unsigned = {
		schemaVersion: AGENT_EVALUATION_RECORDED_RUN_VERSION,
		corpusHash: corpus.corpusHash,
		requestedModel: 'gpt-5-nano' as const,
		promptVersion: HERO_MODEL_PROMPT_VERSION as 'hero-model-prompt-v1',
		contextPolicyVersion: HERO_CONTEXT_POLICY_VERSION as 'hero-context-v1',
		recordedAt,
		cases
	};
	return RecordedProviderRunSchema.parse({ ...unsigned, runHash: hashCanonical(unsigned) });
}

export function verifyRecordedProviderRun(run: RecordedProviderRun): boolean {
	return unsignedHash(run, 'runHash') === run.runHash;
}

function percentile(values: number[], quantile: number): number {
	const sorted = [...values].sort((left, right) => left - right);
	const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);
	const value = sorted[index];
	if (value === undefined) throw new Error('Cannot calculate a percentile without samples');
	return value;
}

export function evaluateRecordedProviderRun(
	corpus: AgentEvaluationCorpus,
	runInput: RecordedProviderRun
): RecordedModelEvaluation {
	const run = RecordedProviderRunSchema.parse(runInput);
	if (!verifyRecordedProviderRun(run))
		throw new Error('Recorded provider run integrity check failed');
	if (run.corpusHash !== corpus.corpusHash)
		throw new Error('Recorded provider run targets another corpus');
	const records = new Map(run.cases.map((item) => [item.caseId, item]));
	const aligned = corpus.cases.map((caseDefinition) => records.get(caseDefinition.caseId));
	const grades = corpus.cases.flatMap((caseDefinition, index) => {
		const record = aligned[index];
		return record ? [gradeResult(caseDefinition, record.result)] : [];
	});
	const results = aligned.map((record) => record?.result);
	const structuralPasses = grades.filter((grade) =>
		[
			grade.checks.packetBinding,
			grade.checks.resultIntegrity,
			grade.checks.legalAction,
			grade.checks.targetBoundary,
			grade.checks.memoryBoundary
		].every(Boolean)
	).length;
	const evaluatedMemoryCases = corpus.cases.filter(
		(item) => item.expectation.requireMemoryCitation && records.has(item.caseId)
	);
	const memoryPasses = grades.filter(
		(grade) =>
			evaluatedMemoryCases.some((item) => item.caseId === grade.caseId) &&
			grade.checks.requiredMemoryCitation
	).length;
	const evaluatedResults = results.filter(
		(result): result is HeroPolicyResult => result !== undefined
	);
	const rates = {
		structuralSafety: ratio(structuralPasses, grades.length),
		expectedAction: ratio(
			grades.filter((grade) => grade.checks.expectedAction).length,
			grades.length
		),
		memoryUse: ratio(memoryPasses, evaluatedMemoryCases.length),
		publicKnowledgeBoundary: ratio(
			grades.filter((grade) => grade.checks.publicKnowledgeBoundary).length,
			grades.length
		),
		pairDistinctness: pairDistinctness(corpus, results),
		repetitiveLanguage: repetitiveLanguageRate(evaluatedResults)
	};
	const usage = run.cases.reduce(
		(total, item) => {
			if (item.result.trace.kind !== 'model')
				throw new Error('Recorded run contains a non-model trace');
			return {
				inputTokens: total.inputTokens + item.result.trace.usage.inputTokens,
				cachedInputTokens: total.cachedInputTokens + item.result.trace.usage.cachedInputTokens,
				outputTokens: total.outputTokens + item.result.trace.usage.outputTokens,
				reasoningTokens: total.reasoningTokens + item.result.trace.usage.reasoningTokens,
				totalTokens: total.totalTokens + item.result.trace.usage.totalTokens
			};
		},
		{ inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0 }
	);
	const pricing = createOpenAIPricingSnapshot();
	const uncachedInputTokens = usage.inputTokens - usage.cachedInputTokens;
	const actualCostUsd = Number(
		(
			(uncachedInputTokens * pricing.inputUsd +
				usage.cachedInputTokens * pricing.cachedInputUsd +
				usage.outputTokens * pricing.outputUsd) /
			1_000_000
		).toFixed(8)
	);
	const complete = run.cases.length === corpus.cases.length;
	const passed =
		complete &&
		rates.structuralSafety === 1 &&
		rates.expectedAction >= 0.8 &&
		rates.publicKnowledgeBoundary === 1 &&
		rates.repetitiveLanguage <= 0.35;
	const unsigned = {
		schemaVersion: AGENT_EVALUATION_RECORDED_REPORT_VERSION,
		corpusHash: corpus.corpusHash,
		runHash: run.runHash,
		requestedModel: 'gpt-5-nano' as const,
		resolvedModels: [
			...new Set(
				run.cases.map((item) => {
					if (item.result.trace.kind !== 'model') throw new Error('Expected model trace');
					return item.result.trace.resolvedModel;
				})
			)
		].sort(),
		promptVersion: HERO_MODEL_PROMPT_VERSION as 'hero-model-prompt-v1',
		contextPolicyVersion: HERO_CONTEXT_POLICY_VERSION as 'hero-context-v1',
		status: !complete
			? ('insufficient-evidence' as const)
			: passed
				? ('promotion-pass' as const)
				: ('promotion-fail' as const),
		coverage: { evaluated: run.cases.length, total: corpus.cases.length },
		rates,
		latency: {
			status: 'measured' as const,
			sampleCount: run.cases.length,
			p50Ms: percentile(
				run.cases.map((item) => item.latencyMs),
				0.5
			),
			p95Ms: percentile(
				run.cases.map((item) => item.latencyMs),
				0.95
			)
		},
		usage,
		actualCostUsd,
		pricing,
		grades
	};
	return RecordedModelEvaluationSchema.parse({
		...unsigned,
		reportHash: hashCanonical(unsigned)
	});
}
