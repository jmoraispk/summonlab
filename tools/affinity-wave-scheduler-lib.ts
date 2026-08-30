import { createHash } from 'node:crypto';
import { access, mkdir, open, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
	ImageProductionAssignmentSchema,
	ImageProductionAffinitySchema,
	ImageProductionConcurrencyStageSchema,
	ImageProductionResultSchema,
	ImageProductionSpeciesSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionResult
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	FinalControlledActivationReceiptSchema,
	verifyFinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';

import {
	AffinityRoundIntegrationReceiptSchema,
	affinityRoundAggregatePaths,
	affinityRoundRoot
} from './affinity-review-round-lib.js';
import {
	AffinityRoundBlindReviewCollectionSchema,
	loadVerifiedAffinityReviewRound,
	roundBlindReviewPath
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityRoundFinalEvaluationReceiptSchema,
	AffinityRoundFinalEvaluationSchema,
	deriveAffinityRoundFinalEvaluation
} from './finalize-affinity-round-evaluation.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle
} from './prepare-final-controlled-rerun.js';
import {
	AffinityWavePlanV2Schema,
	type AffinityWavePlanV2,
	type BoundAffinityWavePlanV2
} from './affinity-wave-plan-v2.js';
import sharp from 'sharp';

const EXPERIMENT_ROOT = 'assets/enemies/experiments/affinity-workflow-v1';
const STAGE_CONCURRENCY = {
	canary: 2,
	pilot: 4,
	controlled: 6,
	breadth: 8,
	load: 12,
	scale: 16
} as const;
const SPECIES_IDS = ImageProductionSpeciesSchema.options;
const AFFINITY_IDS = ImageProductionAffinitySchema.options;
const StageSchema = z.enum(['canary', 'pilot', 'controlled', 'breadth', 'load', 'scale']);
const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const RepositoryPathSchema = z
	.string()
	.min(1)
	.refine((value) => !path.posix.isAbsolute(value) && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths cannot contain empty, current, or parent segments' }
	);

export function canonicalJsonSha256(value: unknown): string {
	const canonicalize = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(canonicalize);
		if (input !== null && typeof input === 'object') {
			return Object.fromEntries(
				Object.entries(input as Record<string, unknown>)
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([key, child]) => [key, canonicalize(child)])
			);
		}
		return input;
	};
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(value)))
		.digest('hex');
}

const EvidenceBindingSchema = z
	.object({
		path: RepositoryPathSchema,
		canonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u)
	})
	.strict();

export const AFFINITY_WAVE_PROMOTION_THRESHOLDS = {
	minimumCandidateRate: 0.8,
	maximumRetryRate: 0.2,
	minimumQualityPassRate: 0.8,
	maximumCriticalVisualFailureCount: 0
} as const;

const PromotionObservationSchema = z
	.object({
		targetCount: z.number().int().positive(),
		candidateCount: z.number().int().nonnegative(),
		candidateRate: z.number().min(0).max(1),
		retryCount: z.number().int().nonnegative(),
		retryRate: z.number().min(0).max(1),
		qualityPassCount: z.number().int().nonnegative(),
		qualityPassRate: z.number().min(0).max(1),
		criticalVisualFailureCount: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((observation, context) => {
		if (observation.candidateCount > observation.targetCount)
			context.addIssue({ code: 'custom', message: 'Candidate count cannot exceed target count' });
		if (observation.qualityPassCount > observation.targetCount)
			context.addIssue({
				code: 'custom',
				message: 'Quality-pass count cannot exceed target count'
			});
		if (observation.candidateRate !== observation.candidateCount / observation.targetCount)
			context.addIssue({ code: 'custom', message: 'Candidate rate must be derived from counts' });
		if (observation.qualityPassRate !== observation.qualityPassCount / observation.targetCount)
			context.addIssue({
				code: 'custom',
				message: 'Quality-pass rate must be derived from counts'
			});
		if (observation.retryRate !== observation.retryCount / observation.targetCount)
			context.addIssue({ code: 'custom', message: 'Retry rate must be derived from counts' });
	});

const PromotionThresholdSchema = z
	.object({
		minimumCandidateRate: z.literal(AFFINITY_WAVE_PROMOTION_THRESHOLDS.minimumCandidateRate),
		maximumRetryRate: z.literal(AFFINITY_WAVE_PROMOTION_THRESHOLDS.maximumRetryRate),
		minimumQualityPassRate: z.literal(AFFINITY_WAVE_PROMOTION_THRESHOLDS.minimumQualityPassRate),
		maximumCriticalVisualFailureCount: z.literal(
			AFFINITY_WAVE_PROMOTION_THRESHOLDS.maximumCriticalVisualFailureCount
		)
	})
	.strict();

const BreadthCanaryPromotionSchema = z
	.object({
		targetIds: z.tuple([
			z.literal('affinity-workflow-v1-goblin-normal'),
			z.literal('affinity-workflow-v1-tunnel-boar-fire')
		]),
		observation: PromotionObservationSchema
	})
	.strict();

export const AffinityWavePromotionEvidenceSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-promotion-evidence-v1'),
		sourceRunId: SlugSchema,
		sourceStage: StageSchema,
		sourceEffectiveConcurrency: z.union([
			z.literal(2),
			z.literal(4),
			z.literal(6),
			z.literal(8),
			z.literal(12)
		]),
		sourceReportPath: RepositoryPathSchema,
		sourceReportCanonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u),
		thresholds: PromotionThresholdSchema,
		observation: PromotionObservationSchema,
		breadthCanaries: BreadthCanaryPromotionSchema.nullable()
	})
	.strict()
	.superRefine((evidence, context) => {
		const expected = STAGE_CONCURRENCY[evidence.sourceStage];
		if (evidence.sourceStage === 'scale' || evidence.sourceEffectiveConcurrency !== expected)
			context.addIssue({
				code: 'custom',
				path: ['sourceEffectiveConcurrency'],
				message: 'Promotion source stage must match its exact effective concurrency'
			});
		for (const [field, passes] of [
			[
				'candidateRate',
				evidence.observation.candidateRate >= evidence.thresholds.minimumCandidateRate
			],
			['retryRate', evidence.observation.retryRate <= evidence.thresholds.maximumRetryRate],
			[
				'qualityPassRate',
				evidence.observation.qualityPassRate >= evidence.thresholds.minimumQualityPassRate
			],
			[
				'criticalVisualFailureCount',
				evidence.observation.criticalVisualFailureCount <=
					evidence.thresholds.maximumCriticalVisualFailureCount
			]
		] as const)
			if (!passes)
				context.addIssue({
					code: 'custom',
					path: ['observation', field],
					message: `Promotion threshold failed: ${field}`
				});
		if (evidence.breadthCanaries)
			for (const [field, passes] of [
				['candidateRate', evidence.breadthCanaries.observation.candidateRate === 1],
				[
					'retryRate',
					evidence.breadthCanaries.observation.retryRate <= evidence.thresholds.maximumRetryRate
				],
				['qualityPassRate', evidence.breadthCanaries.observation.qualityPassRate === 1],
				[
					'criticalVisualFailureCount',
					evidence.breadthCanaries.observation.criticalVisualFailureCount === 0
				]
			] as const)
				if (!passes)
					context.addIssue({
						code: 'custom',
						path: ['breadthCanaries', 'observation', field],
						message: `Breadth canary threshold failed: ${field}`
					});
	});

export type AffinityWavePromotionEvidence = z.infer<typeof AffinityWavePromotionEvidenceSchema>;

export const AffinityWaveDispatchGateDerivationSchema = z.discriminatedUnion('profile', [
	z.object({ profile: z.literal('normal-canary') }).strict(),
	z.object({ profile: z.literal('final-canary') }).strict(),
	z.object({ profile: z.literal('breadth'), prerequisiteRunId: SlugSchema }).strict(),
	z
		.object({
			profile: z.literal('load'),
			requestedConcurrency: z.union([z.literal(4), z.literal(6), z.literal(12), z.literal(16)]),
			prerequisiteRunId: SlugSchema
		})
		.strict()
]);

export const AffinityWaveDispatchGateSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-dispatch-gate-v2'),
		gateId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('authorized'),
		authorizedStage: StageSchema,
		qualityGateSatisfied: z.literal(true),
		humanGateSatisfied: z.boolean(),
		prerequisiteRunIds: z.array(SlugSchema),
		derivation: AffinityWaveDispatchGateDerivationSchema,
		promotionEvidence: AffinityWavePromotionEvidenceSchema.nullable().optional(),
		evidenceBindings: z.array(EvidenceBindingSchema).min(1)
	})
	.strict()
	.superRefine((gate, context) => {
		if (gate.authorizedStage !== 'canary' && gate.prerequisiteRunIds.length === 0) {
			context.addIssue({
				code: 'custom',
				path: ['prerequisiteRunIds'],
				message: 'Non-canary dispatch gates require a preceding eligible scheduler run'
			});
		}
		if (['breadth', 'load', 'scale'].includes(gate.authorizedStage) && !gate.humanGateSatisfied) {
			context.addIssue({
				code: 'custom',
				path: ['humanGateSatisfied'],
				message: 'Breadth, Load, and Scale require explicit human-gate satisfaction'
			});
		}
		const evidencePaths = gate.evidenceBindings.map((binding) => binding.path);
		if (new Set(evidencePaths).size !== evidencePaths.length) {
			context.addIssue({
				code: 'custom',
				path: ['evidenceBindings'],
				message: 'Evidence binding paths must be unique'
			});
		}
		if (JSON.stringify(evidencePaths) !== JSON.stringify([...evidencePaths].sort())) {
			context.addIssue({
				code: 'custom',
				path: ['evidenceBindings'],
				message: 'Evidence bindings must be ordered by repository path'
			});
		}
		const derivation = gate.derivation;
		const expected =
			derivation.profile === 'normal-canary'
				? { stage: 'canary', human: false, prerequisites: [] as string[] }
				: derivation.profile === 'final-canary'
					? { stage: 'canary', human: true, prerequisites: [] as string[] }
					: derivation.profile === 'breadth'
						? {
								stage: 'breadth',
								human: true,
								prerequisites: [derivation.prerequisiteRunId]
							}
						: {
								stage: { 4: 'pilot', 6: 'controlled', 12: 'load', 16: 'scale' }[
									derivation.requestedConcurrency
								],
								human: true,
								prerequisites: [derivation.prerequisiteRunId]
							};
		if (
			gate.authorizedStage !== expected.stage ||
			gate.humanGateSatisfied !== expected.human ||
			JSON.stringify(gate.prerequisiteRunIds) !== JSON.stringify(expected.prerequisites)
		)
			context.addIssue({
				code: 'custom',
				path: ['derivation'],
				message: 'Derived profile does not match stage, human gate, and prerequisites'
			});
		if (derivation.profile === 'normal-canary' || derivation.profile === 'final-canary') {
			if (gate.promotionEvidence !== null && gate.promotionEvidence !== undefined)
				context.addIssue({
					code: 'custom',
					path: ['promotionEvidence'],
					message: 'Initial canary authorization cannot claim prior-wave promotion evidence'
				});
		} else {
			const promotion = gate.promotionEvidence;
			const expectedPromotionSource =
				derivation.profile === 'breadth'
					? { stage: 'controlled', concurrency: 6 }
					: {
							stage: { 4: 'canary', 6: 'pilot', 12: 'breadth', 16: 'load' }[
								derivation.requestedConcurrency
							],
							concurrency: { 4: 2, 6: 4, 12: 8, 16: 12 }[derivation.requestedConcurrency]
						};
			if (
				!promotion ||
				promotion.sourceRunId !== derivation.prerequisiteRunId ||
				promotion.sourceStage !== expectedPromotionSource.stage ||
				promotion.sourceEffectiveConcurrency !== expectedPromotionSource.concurrency ||
				(derivation.profile === 'breadth' && promotion.breadthCanaries === null) ||
				(derivation.profile === 'load' && promotion.breadthCanaries !== null)
			)
				context.addIssue({
					code: 'custom',
					path: ['promotionEvidence'],
					message: 'Non-canary gates require exact predecessor promotion evidence'
				});
		}
	});

export type AffinityWaveDispatchGate = z.infer<typeof AffinityWaveDispatchGateSchema>;

const LegacyAffinityWaveDispatchGateSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-dispatch-gate-v1'),
		gateId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('authorized'),
		authorizedStage: StageSchema,
		qualityGateSatisfied: z.literal(true),
		humanGateSatisfied: z.boolean(),
		prerequisiteRunIds: z.array(SlugSchema),
		evidencePaths: z.array(RepositoryPathSchema).min(1)
	})
	.strict();

const ReadableAffinityWaveDispatchGateSchema = z.union([
	AffinityWaveDispatchGateSchema,
	LegacyAffinityWaveDispatchGateSchema
]);

const DispatchGatePointerSchema = z
	.object({
		artifactPath: RepositoryPathSchema,
		canonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u)
	})
	.strict();

export const AffinityWavePlanSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-plan-v1'),
		runId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		stage: StageSchema,
		requestedConcurrency: z.union([
			z.literal(2),
			z.literal(4),
			z.literal(6),
			z.literal(8),
			z.literal(12),
			z.literal(16)
		]),
		reservedOrchestratorSlots: z.literal(1),
		requireExactConcurrency: z.literal(true),
		runDirectory: RepositoryPathSchema,
		stopRules: z
			.object({
				capacityFailureLimit: z.literal(3),
				stopOnOutputCollision: z.literal(true),
				retryCapacityFailuresInWave: z.literal(false)
			})
			.strict(),
		dispatchGate: DispatchGatePointerSchema.optional(),
		jobs: z
			.array(
				z
					.object({
						targetPath: RepositoryPathSchema,
						assignmentPath: RepositoryPathSchema
					})
					.strict()
			)
			.min(1)
			.max(100)
	})
	.strict()
	.superRefine((plan, context) => {
		if (plan.requestedConcurrency !== STAGE_CONCURRENCY[plan.stage]) {
			context.addIssue({
				code: 'custom',
				path: ['requestedConcurrency'],
				message: `${plan.stage} requires requested concurrency ${STAGE_CONCURRENCY[plan.stage]}`
			});
		}
		if (plan.jobs.length < plan.requestedConcurrency) {
			context.addIssue({
				code: 'custom',
				path: ['jobs'],
				message: 'A concurrency measurement needs at least one job per requested worker'
			});
		}
		const expectedDirectory = `${EXPERIMENT_ROOT}/wave-runs/${plan.runId}`;
		if (plan.runDirectory !== expectedDirectory) {
			context.addIssue({
				code: 'custom',
				path: ['runDirectory'],
				message: `Run directory must be ${expectedDirectory}`
			});
		}
	});

export type AffinityWavePlan = z.infer<typeof AffinityWavePlanSchema>;

const AllocationJobSchema = z
	.object({
		key: SlugSchema,
		speciesId: ImageProductionSpeciesSchema,
		affinity: ImageProductionAffinitySchema,
		version: z.string().regex(/^v[1-9][0-9]*$/u),
		cohort: z.enum(['controlled', 'breadth', 'regression']),
		manifestState: z.enum(['gated-final-controlled', 'live-unexecuted-breadth', 'future-sentinel']),
		targetPath: RepositoryPathSchema,
		assignmentPath: RepositoryPathSchema,
		candidatePath: RepositoryPathSchema,
		resultPath: RepositoryPathSchema
	})
	.strict();

const AllocationGateSchema = z
	.object({
		gateId: SlugSchema,
		status: z.enum(['pending', 'blocked']),
		description: z.string().trim().min(1),
		evidencePaths: z.array(RepositoryPathSchema).min(1)
	})
	.strict();

export const AffinityWaveAllocationSpecSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-allocation-v1'),
		allocationId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('gated'),
		executable: z.literal(false),
		purpose: z.string().trim().min(1),
		futureSentinelCount: z.literal(14),
		gates: z.array(AllocationGateSchema).min(1),
		stages: z
			.array(
				z
					.object({
						stage: StageSchema,
						requestedConcurrency: z.union([
							z.literal(2),
							z.literal(4),
							z.literal(6),
							z.literal(8),
							z.literal(12),
							z.literal(16)
						]),
						executable: z.literal(false),
						prerequisiteGateIds: z.array(SlugSchema).min(1),
						jobs: z.array(AllocationJobSchema).min(1)
					})
					.strict()
			)
			.length(6)
	})
	.strict()
	.superRefine((allocation, context) => {
		const gateIds = allocation.gates.map((gate) => gate.gateId);
		if (new Set(gateIds).size !== gateIds.length) {
			context.addIssue({ code: 'custom', path: ['gates'], message: 'Gate IDs must be unique' });
		}
		const stages = new Map(allocation.stages.map((stage) => [stage.stage, stage]));
		for (const [stageName, requestedConcurrency] of Object.entries(STAGE_CONCURRENCY)) {
			const stage = stages.get(stageName as keyof typeof STAGE_CONCURRENCY);
			if (!stage) {
				context.addIssue({
					code: 'custom',
					path: ['stages'],
					message: `Allocation must include exactly one ${stageName} stage`
				});
				continue;
			}
			if (
				stage.requestedConcurrency !== requestedConcurrency ||
				stage.jobs.length !== requestedConcurrency
			) {
				context.addIssue({
					code: 'custom',
					path: ['stages'],
					message: `${stageName} must allocate exactly ${requestedConcurrency} jobs`
				});
			}
			for (const gateId of stage.prerequisiteGateIds) {
				if (!gateIds.includes(gateId)) {
					context.addIssue({
						code: 'custom',
						path: ['stages'],
						message: `${stageName} references unknown prerequisite gate ${gateId}`
					});
				}
			}
		}
		const jobs = allocation.stages.flatMap((stage) => stage.jobs);
		for (const [stageIndex, stage] of allocation.stages.entries()) {
			for (const [jobIndex, job] of stage.jobs.entries()) {
				const prefix = `${EXPERIMENT_ROOT}`;
				const expected =
					job.manifestState === 'gated-final-controlled'
						? {
								targetPath: `${prefix}/targets/final-controlled/${job.speciesId}/${job.affinity}-${job.version}.json`,
								assignmentPath: `${prefix}/assignments/final-controlled/${job.speciesId}/${job.affinity}-${job.version}.json`,
								candidatePath: `${prefix}/candidates/final-controlled/${job.speciesId}/${job.affinity}-${job.version}.png`,
								resultPath: `${prefix}/results/final-controlled/${job.speciesId}-${job.affinity}-${job.version}.json`,
								cohort: 'controlled' as const
							}
						: job.manifestState === 'live-unexecuted-breadth'
							? {
									targetPath: `${prefix}/targets/${job.speciesId}/${job.affinity}.json`,
									assignmentPath: `${prefix}/assignments/${job.speciesId}/${job.affinity}.json`,
									candidatePath: `${prefix}/candidates/${job.speciesId}/${job.affinity}-v1.png`,
									resultPath: `${prefix}/results/${job.speciesId}-${job.affinity}-v1.json`,
									cohort: 'breadth' as const
								}
							: {
									targetPath: `${prefix}/targets/concurrency-sentinels/${job.speciesId}/${job.affinity}-${job.version}.json`,
									assignmentPath: `${prefix}/assignments/concurrency-sentinels/${job.speciesId}/${job.affinity}-${job.version}.json`,
									candidatePath: `${prefix}/candidates/concurrency-sentinels/${job.speciesId}/${job.affinity}-${job.version}.png`,
									resultPath: `${prefix}/results/concurrency-sentinels/${job.speciesId}-${job.affinity}-${job.version}.json`,
									cohort: 'regression' as const
								};
				for (const field of [
					'targetPath',
					'assignmentPath',
					'candidatePath',
					'resultPath',
					'cohort'
				] as const) {
					if (job[field] !== expected[field]) {
						context.addIssue({
							code: 'custom',
							path: ['stages', stageIndex, 'jobs', jobIndex, field],
							message: `${field} does not match the coordinate-owned ${job.manifestState} path`
						});
					}
				}
				if (job.manifestState === 'live-unexecuted-breadth' && job.version !== 'v1') {
					context.addIssue({
						code: 'custom',
						path: ['stages', stageIndex, 'jobs', jobIndex, 'version'],
						message: 'Base breadth allocations must retain version v1'
					});
				}
				if (
					job.manifestState === 'future-sentinel' &&
					!['death-knight', 'elemental', 'grey-wolf', 'cave-bear'].includes(job.speciesId)
				) {
					context.addIssue({
						code: 'custom',
						path: ['stages', stageIndex, 'jobs', jobIndex, 'speciesId'],
						message: 'Future sentinels are versioned reruns of the four controlled species'
					});
				}
				if (
					job.manifestState === 'future-sentinel' &&
					((['death-knight', 'elemental'] as string[]).includes(job.speciesId)
						? job.version !== 'v5'
						: job.version !== 'v4')
				) {
					context.addIssue({
						code: 'custom',
						path: ['stages', stageIndex, 'jobs', jobIndex, 'version'],
						message: 'Future sentinels must use v5 for Death Knight/Elemental and v4 for beasts'
					});
				}
			}
		}
		for (const [label, values] of [
			['job keys', jobs.map((job) => job.key)],
			['target paths', jobs.map((job) => job.targetPath)],
			['assignment paths', jobs.map((job) => job.assignmentPath)],
			['candidate paths', jobs.map((job) => job.candidatePath)],
			['result paths', jobs.map((job) => job.resultPath)]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({
					code: 'custom',
					path: ['stages'],
					message: `Allocation has duplicate ${label}`
				});
			}
		}
		const sentinels = jobs.filter((job) => job.manifestState === 'future-sentinel');
		if (sentinels.length !== allocation.futureSentinelCount) {
			context.addIssue({
				code: 'custom',
				path: ['futureSentinelCount'],
				message: `Allocation requires exactly ${allocation.futureSentinelCount} future sentinels; found ${sentinels.length}`
			});
		}
		const scaleJobs = stages.get('scale')?.jobs ?? [];
		for (const speciesId of SPECIES_IDS) {
			const count = scaleJobs.filter((job) => job.speciesId === speciesId).length;
			if (count !== 2) {
				context.addIssue({
					code: 'custom',
					path: ['stages'],
					message: `Scale allocation requires exactly two ${speciesId} jobs; found ${count}`
				});
			}
		}
		const scaleAffinityCounts = AFFINITY_IDS.map(
			(affinity) => scaleJobs.filter((job) => job.affinity === affinity).length
		);
		if (
			scaleAffinityCounts.length > 0 &&
			Math.max(...scaleAffinityCounts) - Math.min(...scaleAffinityCounts) > 1
		) {
			context.addIssue({
				code: 'custom',
				path: ['stages'],
				message: 'Scale allocation affinities must be distributed evenly'
			});
		}
	});

export type AffinityWaveAllocationSpec = z.infer<typeof AffinityWaveAllocationSpecSchema>;

const ResolvedJobSchema = z
	.object({
		targetId: SlugSchema,
		assignmentId: SlugSchema,
		speciesId: ImageProductionSpeciesSchema,
		affinity: ImageProductionAffinitySchema,
		targetPath: RepositoryPathSchema,
		assignmentPath: RepositoryPathSchema,
		targetCanonicalSha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.optional(),
		assignmentCanonicalSha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.optional(),
		candidatePath: RepositoryPathSchema,
		resultPath: RepositoryPathSchema
	})
	.strict();

const ResolvedJobV2Schema = ResolvedJobSchema.required({
	targetCanonicalSha256: true,
	assignmentCanonicalSha256: true
}).safeExtend({
	allocationJobKey: SlugSchema,
	manifestState: z.enum(['gated-final-controlled', 'live-unexecuted-breadth', 'future-sentinel'])
});

const DispatchGateEvidenceCheckSchema = z
	.object({
		path: RepositoryPathSchema,
		expectedCanonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u),
		observedCanonicalSha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.nullable(),
		status: z.enum(['verified', 'missing', 'invalid', 'stale'])
	})
	.strict();

const DispatchGateEvidenceSchema = z
	.object({
		status: z.enum([
			'satisfied',
			'missing-plan-pointer',
			'missing-artifact',
			'hash-mismatch',
			'invalid-artifact',
			'legacy-gate-not-authorizing',
			'missing-evidence',
			'invalid-evidence',
			'stale-evidence',
			'semantic-evidence-invalid',
			'stage-not-authorized',
			'human-gate-required'
		]),
		artifactPath: RepositoryPathSchema.nullable(),
		expectedCanonicalSha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.nullable(),
		observedCanonicalSha256: z
			.string()
			.regex(/^[a-f0-9]{64}$/u)
			.nullable(),
		gate: ReadableAffinityWaveDispatchGateSchema.nullable(),
		evidenceChecks: z.array(DispatchGateEvidenceCheckSchema).optional()
	})
	.strict()
	.superRefine((evidence, context) => {
		if (evidence.status !== 'satisfied') return;
		if (evidence.gate?.schemaVersion === 'affinity-wave-dispatch-gate-v1') return;
		const gate = AffinityWaveDispatchGateSchema.safeParse(evidence.gate);
		if (!gate.success) {
			context.addIssue({
				code: 'custom',
				path: ['gate'],
				message: 'Only a v2 dispatch gate can satisfy a preflight'
			});
			return;
		}
		if (
			evidence.expectedCanonicalSha256 === null ||
			evidence.expectedCanonicalSha256 !== evidence.observedCanonicalSha256
		) {
			context.addIssue({
				code: 'custom',
				path: ['observedCanonicalSha256'],
				message: 'A satisfied gate must match its pointer hash'
			});
		}
		if (evidence.evidenceChecks?.length !== gate.data.evidenceBindings.length) {
			context.addIssue({
				code: 'custom',
				path: ['evidenceChecks'],
				message: 'A satisfied gate must verify every evidence binding'
			});
			return;
		}
		for (const [index, binding] of gate.data.evidenceBindings.entries()) {
			const check = evidence.evidenceChecks[index];
			if (
				check?.path !== binding.path ||
				check.expectedCanonicalSha256 !== binding.canonicalSha256 ||
				check.observedCanonicalSha256 !== binding.canonicalSha256 ||
				check.status !== 'verified'
			) {
				context.addIssue({
					code: 'custom',
					path: ['evidenceChecks', index],
					message: 'Satisfied evidence checks must exactly verify their ordered bindings'
				});
			}
		}
	});

const LegacyAffinityWavePreflightSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-preflight-v1'),
		runId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		stage: StageSchema,
		createdAt: z.string().datetime({ offset: true }),
		status: z.enum(['ready', 'blocked-capacity', 'blocked-output-collision', 'blocked-gate']),
		requestedConcurrency: z.number().int().positive().max(16),
		availableAgentSlots: z.number().int().nonnegative(),
		reservedOrchestratorSlots: z.literal(1),
		admittedWorkerCapacity: z.number().int().nonnegative().max(16),
		exactConcurrencyReady: z.boolean(),
		runDirectory: RepositoryPathSchema,
		stopRules: AffinityWavePlanSchema.shape.stopRules,
		dispatchGateSatisfied: z.boolean().optional(),
		dispatchGateEvidence: DispatchGateEvidenceSchema.optional(),
		collisionPaths: z.array(RepositoryPathSchema),
		jobs: z.array(ResolvedJobSchema).min(1).max(100)
	})
	.strict()
	.superRefine((preflight, context) => {
		if (
			preflight.status === 'ready' &&
			(preflight.dispatchGateSatisfied !== true ||
				!dispatchGateEvidenceAuthorizes(preflight.dispatchGateEvidence))
		) {
			context.addIssue({
				code: 'custom',
				path: ['dispatchGateEvidence'],
				message: 'A ready preflight requires a fully satisfied v2 dispatch gate'
			});
		}
		if (
			preflight.status === 'ready' &&
			preflight.jobs.some((job) => !job.targetCanonicalSha256 || !job.assignmentCanonicalSha256)
		) {
			context.addIssue({
				code: 'custom',
				path: ['jobs'],
				message: 'A ready preflight requires canonical target and assignment hashes'
			});
		}
	});

export const AffinityWavePreflightV2Schema = z
	.object({
		schemaVersion: z.literal('affinity-wave-preflight-v2'),
		runId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		stage: StageSchema,
		createdAt: z.string().datetime({ offset: true }),
		status: z.enum(['ready', 'blocked-capacity', 'blocked-output-collision', 'blocked-gate']),
		requestedConcurrency: z.number().int().positive().max(16),
		availableAgentSlots: z.number().int().nonnegative(),
		reservedOrchestratorSlots: z.literal(1),
		admittedWorkerCapacity: z.number().int().nonnegative().max(16),
		exactConcurrencyReady: z.boolean(),
		runDirectory: RepositoryPathSchema,
		stopRules: AffinityWavePlanSchema.shape.stopRules,
		sourcePlan: z
			.object({
				path: RepositoryPathSchema,
				canonicalSha256: EvidenceBindingSchema.shape.canonicalSha256
			})
			.strict(),
		sourceAllocation: z
			.object({
				path: RepositoryPathSchema,
				canonicalSha256: EvidenceBindingSchema.shape.canonicalSha256,
				allocationId: SlugSchema
			})
			.strict(),
		concurrencySentinelActivationReceipt: EvidenceBindingSchema.nullable(),
		dispatchGateSatisfied: z.boolean(),
		dispatchGateEvidence: DispatchGateEvidenceSchema,
		collisionPaths: z.array(RepositoryPathSchema),
		jobs: z.array(ResolvedJobV2Schema).min(1).max(16)
	})
	.strict()
	.superRefine((preflight, context) => {
		if (
			preflight.status === 'ready' &&
			(preflight.dispatchGateSatisfied !== true ||
				!dispatchGateEvidenceAuthorizes(preflight.dispatchGateEvidence))
		)
			context.addIssue({
				code: 'custom',
				path: ['dispatchGateEvidence'],
				message: 'A ready preflight requires a fully satisfied v2 dispatch gate'
			});
		if (preflight.requestedConcurrency !== STAGE_CONCURRENCY[preflight.stage])
			context.addIssue({
				code: 'custom',
				path: ['requestedConcurrency'],
				message: 'Preflight concurrency must match its stage'
			});
		if (preflight.jobs.length !== preflight.requestedConcurrency)
			context.addIssue({
				code: 'custom',
				path: ['jobs'],
				message: 'V2 preflight requires the exact allocation stage job count'
			});
	});

export const AffinityWavePreflightSchema = z.union([
	AffinityWavePreflightV2Schema,
	LegacyAffinityWavePreflightSchema
]);

export type AffinityWavePreflight = z.infer<typeof AffinityWavePreflightSchema>;

export function dispatchGateEvidenceAuthorizes(
	evidence: AffinityWavePreflight['dispatchGateEvidence']
): boolean {
	return (
		evidence !== undefined &&
		DispatchGateEvidenceSchema.safeParse(evidence).success &&
		evidence.status === 'satisfied' &&
		AffinityWaveDispatchGateSchema.safeParse(evidence.gate).success
	);
}

const BaseEventFields = {
	eventId: SlugSchema,
	runId: SlugSchema,
	at: z.string().datetime({ offset: true })
} as const;

const LegacyBaseEventSchema = z.object({
	schemaVersion: z.literal('affinity-wave-event-v1'),
	...BaseEventFields
});

export const AffinityWaveEventRequestSchema = z.discriminatedUnion('kind', [
	LegacyBaseEventSchema.extend({ kind: z.literal('wave-started') }).strict(),
	LegacyBaseEventSchema.extend({
		kind: z.literal('job-dispatched'),
		targetId: SlugSchema,
		workerId: SlugSchema
	}).strict(),
	LegacyBaseEventSchema.extend({
		kind: z.literal('job-finished'),
		targetId: SlugSchema,
		workerId: SlugSchema
	}).strict(),
	LegacyBaseEventSchema.extend({
		kind: z.literal('worker-failure'),
		targetId: SlugSchema,
		workerId: SlugSchema.nullable(),
		failureKind: z.enum(['capacity', 'provider-throttle', 'timeout', 'malformed-output', 'other']),
		detail: z.string().trim().min(1).max(1_000)
	}).strict(),
	LegacyBaseEventSchema.extend({ kind: z.literal('wave-finished') }).strict()
]);

const V2EventBindingFields = {
	schemaVersion: z.literal('affinity-wave-event-v2'),
	sequence: z.number().int().nonnegative(),
	preflightCanonicalSha256: EvidenceBindingSchema.shape.canonicalSha256,
	recordedAt: z.string().datetime({ offset: true })
} as const;

const AffinityWaveEventV2Schema = z.discriminatedUnion('kind', [
	LegacyBaseEventSchema.extend({ kind: z.literal('wave-started') })
		.omit({ schemaVersion: true })
		.extend(V2EventBindingFields)
		.strict(),
	LegacyBaseEventSchema.extend({
		kind: z.literal('job-dispatched'),
		targetId: SlugSchema,
		workerId: SlugSchema
	})
		.omit({ schemaVersion: true })
		.extend(V2EventBindingFields)
		.strict(),
	LegacyBaseEventSchema.extend({
		kind: z.literal('job-finished'),
		targetId: SlugSchema,
		workerId: SlugSchema
	})
		.omit({ schemaVersion: true })
		.extend(V2EventBindingFields)
		.strict(),
	LegacyBaseEventSchema.extend({
		kind: z.literal('worker-failure'),
		targetId: SlugSchema,
		workerId: SlugSchema.nullable(),
		failureKind: z.enum(['capacity', 'provider-throttle', 'timeout', 'malformed-output', 'other']),
		detail: z.string().trim().min(1).max(1_000)
	})
		.omit({ schemaVersion: true })
		.extend(V2EventBindingFields)
		.strict(),
	LegacyBaseEventSchema.extend({ kind: z.literal('wave-finished') })
		.omit({ schemaVersion: true })
		.extend(V2EventBindingFields)
		.strict()
]);

export const AffinityWaveEventSchema = z.union([
	AffinityWaveEventV2Schema,
	AffinityWaveEventRequestSchema
]);

export type AffinityWaveEvent = z.infer<typeof AffinityWaveEventSchema>;

export const AffinityWaveDispatchDecisionSchema = z
	.object({
		runId: SlugSchema,
		stop: z.boolean(),
		reason: z.enum([
			'launch-ready',
			'capacity-preflight-blocked',
			'output-collision',
			'dispatch-gate-blocked',
			'capacity-stop-rule',
			'all-targets-terminal',
			'wave-not-started',
			'wave-finished',
			'workers-busy'
		]),
		requestedConcurrency: z.number().int().positive().max(16),
		admittedWorkerCapacity: z.number().int().nonnegative().max(16),
		activeWorkerCount: z.number().int().nonnegative().max(16),
		capacityFailureCount: z.number().int().nonnegative(),
		providerThrottleCount: z.number().int().nonnegative(),
		stopFailureCount: z.number().int().nonnegative(),
		launchTargetIds: z.array(SlugSchema),
		launchJobs: z.array(
			z
				.object({
					targetId: SlugSchema,
					targetPath: RepositoryPathSchema,
					targetCanonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u),
					assignmentId: SlugSchema,
					assignmentPath: RepositoryPathSchema,
					assignmentCanonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u),
					candidatePath: RepositoryPathSchema,
					resultPath: RepositoryPathSchema
				})
				.strict()
		)
	})
	.strict()
	.superRefine((decision, context) => {
		if (
			decision.launchTargetIds.length !== decision.launchJobs.length ||
			decision.launchJobs.some((job, index) => job.targetId !== decision.launchTargetIds[index])
		)
			context.addIssue({
				code: 'custom',
				path: ['launchJobs'],
				message: 'Launch jobs must exactly bind the ordered launch target IDs'
			});
	});

export type AffinityWaveDispatchDecision = z.infer<typeof AffinityWaveDispatchDecisionSchema>;

const WaveReportSourceBindingSchema = z
	.object({
		path: RepositoryPathSchema,
		canonicalSha256: z.string().regex(/^[a-f0-9]{64}$/u)
	})
	.strict();

const WaveReportResultBindingSchema = WaveReportSourceBindingSchema.safeExtend({
	targetId: SlugSchema,
	candidatePath: RepositoryPathSchema.nullable(),
	candidateByteSha256: z
		.string()
		.regex(/^[a-f0-9]{64}$/u)
		.nullable()
}).superRefine((binding, context) => {
	if ((binding.candidatePath === null) !== (binding.candidateByteSha256 === null))
		context.addIssue({
			code: 'custom',
			message: 'Candidate path and byte hash must appear together'
		});
});

const WaveReportManifestBindingSchema = z
	.object({
		targetId: SlugSchema,
		target: WaveReportSourceBindingSchema,
		assignment: WaveReportSourceBindingSchema
	})
	.strict();

export const AffinityWaveReportSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-report-v3'),
		runId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		stage: StageSchema,
		generatedAt: z.string().datetime({ offset: true }),
		status: z.enum(['not-started', 'in-progress', 'completed', 'stopped-capacity']),
		requestedConcurrency: z.number().int().positive().max(16),
		admittedWorkerCapacity: z.number().int().nonnegative().max(16),
		effectiveConcurrency: z.number().int().nonnegative().max(16),
		workerCount: z.number().int().nonnegative(),
		startedAt: z.string().datetime({ offset: true }).nullable(),
		completedAt: z.string().datetime({ offset: true }).nullable(),
		waveWallTimeMs: z.number().int().nonnegative().nullable(),
		targetCount: z.number().int().positive(),
		dispatchedCount: z.number().int().nonnegative(),
		terminalCount: z.number().int().nonnegative(),
		unlaunchedCount: z.number().int().nonnegative(),
		candidateCount: z.number().int().nonnegative(),
		reviseCount: z.number().int().nonnegative(),
		failedCount: z.number().int().nonnegative(),
		capacityFailureCount: z.number().int().nonnegative(),
		providerThrottleCount: z.number().int().nonnegative(),
		timeoutCount: z.number().int().nonnegative(),
		malformedOutputCount: z.number().int().nonnegative(),
		retryCount: z.number().int().nonnegative(),
		retriedTargetCount: z.number().int().nonnegative(),
		retryRate: z.number().min(0).max(1),
		generationMedianMs: z.number().nonnegative().nullable(),
		generationP90Ms: z.number().nonnegative().nullable(),
		generationP95Ms: z.number().nonnegative().nullable(),
		slowestCompletionMs: z.number().nonnegative().nullable(),
		summedJobTimeMs: z.number().nonnegative().nullable(),
		effectiveSpeedup: z.number().positive().nullable(),
		parallelEfficiency: z.number().positive().nullable(),
		provenanceCompletenessRate: z.number().min(0).max(1),
		stopRule: z
			.object({
				capacityFailureLimit: z.literal(3),
				triggered: z.boolean(),
				triggeredAt: z.string().datetime({ offset: true }).nullable()
			})
			.strict(),
		sourceEvidence: z
			.object({
				preflight: WaveReportSourceBindingSchema,
				manifests: z.array(WaveReportManifestBindingSchema),
				events: z.array(WaveReportSourceBindingSchema),
				results: z.array(WaveReportResultBindingSchema)
			})
			.strict()
			.superRefine((source, context) => {
				for (const [field, values] of [
					['manifest target IDs', source.manifests.map((item) => item.targetId)],
					['manifest target paths', source.manifests.map((item) => item.target.path)],
					['manifest assignment paths', source.manifests.map((item) => item.assignment.path)],
					['event paths', source.events.map((item) => item.path)],
					['result paths', source.results.map((item) => item.path)],
					['result target IDs', source.results.map((item) => item.targetId)]
				] as const)
					if (new Set(values).size !== values.length)
						context.addIssue({
							code: 'custom',
							message: `Source ${field} must be unique`
						});
			}),
		stageMetrics: ImageProductionConcurrencyStageSchema.nullable()
	})
	.strict();

export type AffinityWaveReport = z.infer<typeof AffinityWaveReportSchema>;

function workspacePath(workspaceRoot: string, relativePath: string): string {
	RepositoryPathSchema.parse(relativePath);
	const absoluteRoot = path.resolve(workspaceRoot);
	const resolved = path.resolve(absoluteRoot, relativePath);
	if (resolved !== absoluteRoot && !resolved.startsWith(`${absoluteRoot}${path.sep}`)) {
		throw new Error(`Path escapes workspace: ${relativePath}`);
	}
	return resolved;
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function exists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

export interface SchedulerPromotionSource {
	readonly runId: string;
	readonly stage: 'canary' | 'pilot' | 'controlled' | 'breadth' | 'load';
	readonly effectiveConcurrency: 2 | 4 | 6 | 8 | 12;
	readonly reportPath: string;
	readonly reportCanonicalSha256: string;
}

export interface DerivedWavePromotionEvidence {
	readonly evidence: AffinityWavePromotionEvidence;
	readonly bindings: readonly z.infer<typeof EvidenceBindingSchema>[];
}

const CRITICAL_VISUAL_CATEGORIES = new Set([
	'anatomy',
	'canvas-completion',
	'framing',
	'silhouette'
]);

function promotionObservation(
	results: readonly ImageProductionResult[]
): z.infer<typeof PromotionObservationSchema> {
	const targetCount = results.length;
	if (targetCount === 0) throw new Error('Promotion evidence requires at least one result.');
	const candidateResults = results.filter((result) => result.status === 'candidate');
	const retryCount = results.reduce(
		(total, result) => total + Math.max(0, result.attempts.length - 1),
		0
	);
	const selectedAttempts = candidateResults.flatMap((result) => {
		const selected = result.attempts.find(
			(attempt) => attempt.attemptId === result.selectedAttemptId
		);
		return selected ? [{ result, attempt: selected }] : [];
	});
	const qualityPassCount = selectedAttempts.filter(
		({ result, attempt }) =>
			result.failedCriteria.length === 0 &&
			!attempt.findings.some((finding) => finding.outcome === 'fail')
	).length;
	const criticalVisualFailureCount = selectedAttempts.filter(({ attempt }) =>
		attempt.findings.some(
			(finding) => finding.outcome === 'fail' && CRITICAL_VISUAL_CATEGORIES.has(finding.category)
		)
	).length;
	return PromotionObservationSchema.parse({
		targetCount,
		candidateCount: candidateResults.length,
		candidateRate: candidateResults.length / targetCount,
		retryCount,
		retryRate: retryCount / targetCount,
		qualityPassCount,
		qualityPassRate: qualityPassCount / targetCount,
		criticalVisualFailureCount
	});
}

async function verifiedPromotionResult(
	workspaceRoot: string,
	repositoryPath: string,
	expectedCanonicalSha256?: string
): Promise<ImageProductionResult> {
	const value = ImageProductionResultSchema.parse(
		await readJson(workspacePath(workspaceRoot, repositoryPath))
	);
	if (
		expectedCanonicalSha256 !== undefined &&
		canonicalJsonSha256(value) !== expectedCanonicalSha256
	)
		throw new Error(`Promotion result is stale: ${repositoryPath}`);
	return value;
}

export async function deriveSchedulerWavePromotionEvidence(
	workspaceRoot: string,
	source: SchedulerPromotionSource
): Promise<DerivedWavePromotionEvidence> {
	const report = AffinityWaveReportSchema.parse(
		await readJson(workspacePath(workspaceRoot, source.reportPath))
	);
	if (
		report.runId !== source.runId ||
		report.stage !== source.stage ||
		report.effectiveConcurrency !== source.effectiveConcurrency ||
		report.status !== 'completed' ||
		canonicalJsonSha256(report) !== source.reportCanonicalSha256
	)
		throw new Error(`Promotion source report is stale or ineligible: ${source.runId}`);
	const results = await Promise.all(
		report.sourceEvidence.results.map((binding) =>
			verifiedPromotionResult(workspaceRoot, binding.path, binding.canonicalSha256)
		)
	);
	if (results.length !== report.targetCount)
		throw new Error(`Promotion source run is missing results: ${source.runId}`);
	const observation = promotionObservation(results);
	if (
		observation.candidateCount !== report.candidateCount ||
		observation.retryCount !== report.retryCount ||
		observation.retryRate !== report.retryRate
	)
		throw new Error(`Promotion source report counters are inconsistent: ${source.runId}`);
	const evidence = AffinityWavePromotionEvidenceSchema.parse({
		schemaVersion: 'affinity-wave-promotion-evidence-v1',
		sourceRunId: source.runId,
		sourceStage: source.stage,
		sourceEffectiveConcurrency: source.effectiveConcurrency,
		sourceReportPath: source.reportPath,
		sourceReportCanonicalSha256: source.reportCanonicalSha256,
		thresholds: AFFINITY_WAVE_PROMOTION_THRESHOLDS,
		observation,
		breadthCanaries: null
	});
	return {
		evidence,
		bindings: report.sourceEvidence.results.map((binding) => ({
			path: binding.path,
			canonicalSha256: binding.canonicalSha256
		}))
	};
}

const BREADTH_CANARY_COORDINATES = [
	{ speciesId: 'goblin', affinity: 'normal' },
	{ speciesId: 'tunnel-boar', affinity: 'fire' }
] as const;

async function verifyRetainedCandidateBytes(
	workspaceRoot: string,
	result: ImageProductionResult
): Promise<void> {
	if (result.status !== 'candidate') return;
	const retained = result.attempts.find(
		(attempt) => attempt.attemptId === result.selectedAttemptId
	)?.output;
	if (!retained) throw new Error(`Candidate result has no retained output: ${result.resultId}`);
	const bytes = await readFile(workspacePath(workspaceRoot, retained.path));
	const metadata = await sharp(bytes).metadata();
	const mediaType =
		metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
	if (
		bytes.byteLength !== retained.bytes ||
		createHash('sha256').update(bytes).digest('hex') !== retained.contentHash ||
		metadata.width !== retained.width ||
		metadata.height !== retained.height ||
		mediaType !== retained.mediaType
	)
		throw new Error(`Breadth canary retained bytes are stale: ${retained.path}`);
}

export async function deriveBreadthCanaryPromotionEvidence(workspaceRoot: string): Promise<{
	readonly evidence: NonNullable<AffinityWavePromotionEvidence['breadthCanaries']>;
	readonly bindings: readonly z.infer<typeof EvidenceBindingSchema>[];
}> {
	const results: ImageProductionResult[] = [];
	const bindings: z.infer<typeof EvidenceBindingSchema>[] = [];
	for (const coordinate of BREADTH_CANARY_COORDINATES) {
		const prefix = `${EXPERIMENT_ROOT}`;
		const targetPath = `${prefix}/targets/${coordinate.speciesId}/${coordinate.affinity}.json`;
		const assignmentPath = `${prefix}/assignments/${coordinate.speciesId}/${coordinate.affinity}.json`;
		const resultPath = `${prefix}/results/${coordinate.speciesId}-${coordinate.affinity}-v1.json`;
		const [targetInput, assignmentInput, resultInput] = await Promise.all([
			readJson(workspacePath(workspaceRoot, targetPath)),
			readJson(workspacePath(workspaceRoot, assignmentPath)),
			readJson(workspacePath(workspaceRoot, resultPath))
		]);
		const target = ImageProductionTargetSchema.parse(targetInput);
		const assignment = ImageProductionAssignmentSchema.parse(assignmentInput);
		const result = ImageProductionResultSchema.parse(resultInput);
		if (
			target.targetId !==
				`${EXPERIMENT_ROOT.split('/').at(-1)}-${coordinate.speciesId}-${coordinate.affinity}` ||
			target.cohort !== 'breadth' ||
			target.speciesId !== coordinate.speciesId ||
			target.affinity !== coordinate.affinity ||
			target.output.resultPath !== resultPath
		)
			throw new Error(`Breadth canary target is not the reserved coordinate: ${targetPath}`);
		validateImageProductionExecution({ target, assignment, result });
		await verifyRetainedCandidateBytes(workspaceRoot, result);
		results.push(result);
		bindings.push(
			{ path: targetPath, canonicalSha256: canonicalJsonSha256(target) },
			{ path: assignmentPath, canonicalSha256: canonicalJsonSha256(assignment) },
			{ path: resultPath, canonicalSha256: canonicalJsonSha256(result) }
		);
	}
	const observation = promotionObservation(results);
	const evidence = BreadthCanaryPromotionSchema.parse({
		targetIds: ['affinity-workflow-v1-goblin-normal', 'affinity-workflow-v1-tunnel-boar-fire'],
		observation
	});
	// Breadth canaries are stricter than a general wave: both must be first-attempt quality candidates.
	if (
		observation.candidateRate !== 1 ||
		observation.retryRate > AFFINITY_WAVE_PROMOTION_THRESHOLDS.maximumRetryRate ||
		observation.qualityPassRate !== 1 ||
		observation.criticalVisualFailureCount !== 0
	)
		throw new Error('The two exact breadth canaries did not pass promotion thresholds.');
	return { evidence, bindings };
}

export async function readWavePlan(
	workspaceRoot: string,
	planPath: string
): Promise<BoundAffinityWavePlanV2> {
	const repositoryPath = RepositoryPathSchema.parse(planPath);
	const input = await readJson(workspacePath(workspaceRoot, repositoryPath));
	const plan = AffinityWavePlanV2Schema.parse(input);
	const expectedPath = `${EXPERIMENT_ROOT}/review/wave-plans/materialized/${plan.runId}.json`;
	if (repositoryPath !== expectedPath)
		throw new Error(`Executable wave plan must be read from ${expectedPath}`);
	return { path: repositoryPath, canonicalSha256: canonicalJsonSha256(plan), plan };
}

export async function readWaveAllocationSpec(
	workspaceRoot: string,
	allocationPath: string
): Promise<AffinityWaveAllocationSpec> {
	return AffinityWaveAllocationSpecSchema.parse(
		await readJson(workspacePath(workspaceRoot, allocationPath))
	);
}

type DispatchGateEvidence = NonNullable<
	z.infer<typeof AffinityWavePreflightSchema>['dispatchGateEvidence']
>;

type DispatchGateEvidenceCheck = z.infer<typeof DispatchGateEvidenceCheckSchema>;

interface ResolvedDispatchGateBinding {
	readonly check: DispatchGateEvidenceCheck;
	readonly value: unknown | null;
}

const NORMAL_DRY_RUN_PATH =
	`${EXPERIMENT_ROOT}/dry-runs/goblin-normal-envelope-preflight-v2.json` as const;
const FINAL_CONTROLLED_PLAN_PATH =
	`${EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json` as const;

const NormalDryRunSemanticSchema = z
	.object({
		schemaVersion: z.literal('image-production-dry-run-evidence-v1'),
		dryRunId: z.literal('affinity-workflow-v1-goblin-normal-envelope-preflight-v2'),
		experimentId: z.literal('affinity-workflow-v1'),
		workflow: z.literal('summonlab-image-production'),
		target: z
			.object({
				path: RepositoryPathSchema,
				targetId: z.literal('affinity-workflow-v1-goblin-normal'),
				contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
			})
			.passthrough(),
		assignment: z
			.object({
				path: RepositoryPathSchema,
				assignmentId: z.literal('dry-run-assignment-affinity-workflow-v1-goblin-normal'),
				contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
				dryRun: z.literal(true),
				retryCeiling: z.literal(0)
			})
			.passthrough(),
		preflight: z
			.object({
				status: z.literal('pass'),
				referencesPresentAndHashMatched: z.literal(true),
				pathsContainedAndNormalized: z.literal(true),
				targetAssignmentIdsMatch: z.literal(true),
				outputsAbsent: z.literal(true)
			})
			.passthrough(),
		completion: z
			.object({
				generationCallCount: z.literal(0),
				persistenceCallCount: z.literal(0),
				sharedFilesEdited: z.literal(false),
				selfPromoted: z.literal(false),
				status: z.literal('pass')
			})
			.passthrough()
	})
	.passthrough();

function exactBindingPaths(
	gate: AffinityWaveDispatchGate,
	expectedPaths: readonly string[]
): boolean {
	const actual = gate.evidenceBindings.map((binding) => binding.path);
	const expected = [...new Set(expectedPaths)].sort((left, right) => left.localeCompare(right));
	return JSON.stringify(actual) === JSON.stringify(expected);
}

function evidenceValue(values: ReadonlyMap<string, unknown>, repositoryPath: string): unknown {
	if (!values.has(repositoryPath)) throw new Error(`Missing semantic evidence: ${repositoryPath}`);
	return values.get(repositoryPath);
}

async function verifyNormalSemanticEvidence(
	workspaceRoot: string,
	values: ReadonlyMap<string, unknown>
): Promise<string[]> {
	const dryRun = NormalDryRunSemanticSchema.parse(evidenceValue(values, NORMAL_DRY_RUN_PATH));
	const target = ImageProductionTargetSchema.parse(evidenceValue(values, dryRun.target.path));
	const assignment = ImageProductionAssignmentSchema.parse(
		evidenceValue(values, dryRun.assignment.path)
	);
	const [targetBytes, assignmentBytes] = await Promise.all([
		readFile(workspacePath(workspaceRoot, dryRun.target.path)),
		readFile(workspacePath(workspaceRoot, dryRun.assignment.path))
	]);
	for (const reference of target.references) {
		const bytes = await readFile(workspacePath(workspaceRoot, reference.path));
		if (createHash('sha256').update(bytes).digest('hex') !== reference.contentHash)
			throw new Error(`Normal canary reference is stale: ${reference.path}`);
	}
	if (
		createHash('sha256').update(targetBytes).digest('hex') !== dryRun.target.contentHash ||
		createHash('sha256').update(assignmentBytes).digest('hex') !== dryRun.assignment.contentHash ||
		target.targetId !== dryRun.target.targetId ||
		assignment.assignmentId !== dryRun.assignment.assignmentId ||
		assignment.targetId !== target.targetId ||
		assignment.dryRun !== true ||
		assignment.retryCeiling !== 0
	)
		throw new Error('Normal canary dry-run semantics are inconsistent.');
	return [NORMAL_DRY_RUN_PATH, dryRun.target.path, dryRun.assignment.path];
}

async function verifyFinalCanarySemanticEvidence(
	workspaceRoot: string,
	values: ReadonlyMap<string, unknown>
): Promise<string[]> {
	const plan = FinalControlledRerunPlanSchema.parse(
		evidenceValue(values, FINAL_CONTROLLED_PLAN_PATH)
	);
	const receipt = FinalControlledActivationReceiptSchema.parse(
		evidenceValue(values, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH)
	);
	const bundle = buildFinalControlledRerunBundle(plan);
	const activation = await verifyFinalControlledActivationReceipt(
		workspaceRoot,
		canonicalJsonSha256(plan)
	);
	if (!activation.valid || !activation.receipt)
		throw new Error(
			`Final-controlled activation receipt is invalid: ${activation.issues.join('; ')}`
		);
	const expectedArtifacts = new Map(
		bundle.artifacts.map((artifact) => [artifact.livePath, artifact] as const)
	);
	if (
		receipt.bindings.planCanonicalSha256 !== canonicalJsonSha256(plan) ||
		canonicalJsonSha256(receipt.artifacts) !== receipt.artifactSetSha256 ||
		receipt.artifacts.length !== expectedArtifacts.size
	)
		throw new Error('Final-controlled activation receipt is not bound to the current plan.');
	for (const artifact of receipt.artifacts) {
		const expected = expectedArtifacts.get(artifact.livePath);
		if (!expected || expected.kind !== artifact.kind)
			throw new Error(`Unexpected final-controlled activation artifact: ${artifact.livePath}`);
		const value = evidenceValue(values, artifact.livePath);
		const parsed =
			artifact.kind === 'target'
				? ImageProductionTargetSchema.parse(value)
				: ImageProductionAssignmentSchema.parse(value);
		if (
			canonicalJsonSha256(parsed) !== artifact.canonicalSha256 ||
			canonicalJsonSha256(expected.value) !== artifact.canonicalSha256
		)
			throw new Error(`Stale final-controlled activation artifact: ${artifact.livePath}`);
	}
	return [
		FINAL_CONTROLLED_PLAN_PATH,
		FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
		...receipt.artifacts.map((artifact) => artifact.livePath)
	];
}

async function verifyRoundSemanticEvidence(
	workspaceRoot: string,
	values: ReadonlyMap<string, unknown>,
	roundId: 'final-controlled-v1' | 'breadth-v1'
): Promise<string[]> {
	const paths = affinityRoundAggregatePaths(roundId);
	const root = affinityRoundRoot(roundId);
	const blindPath = roundBlindReviewPath(roundId);
	const evaluationPath = `${root}/final-evaluation.json`;
	const finalReceiptPath = `${root}/final-evaluation-receipt.json`;
	const integration = AffinityRoundIntegrationReceiptSchema.parse(
		evidenceValue(values, paths.receipt)
	);
	const blind = AffinityRoundBlindReviewCollectionSchema.parse(evidenceValue(values, blindPath));
	const evaluation = AffinityRoundFinalEvaluationSchema.parse(
		evidenceValue(values, evaluationPath)
	);
	const finalReceipt = AffinityRoundFinalEvaluationReceiptSchema.parse(
		evidenceValue(values, finalReceiptPath)
	);
	const verifiedRound = await loadVerifiedAffinityReviewRound(workspaceRoot, roundId);
	const derived = await deriveAffinityRoundFinalEvaluation(workspaceRoot, roundId);
	const evaluationBytes = await readFile(workspacePath(workspaceRoot, evaluationPath));
	if (
		verifiedRound.integrationReceiptCanonicalSha256 !== canonicalJsonSha256(integration) ||
		!derived.eligible ||
		derived.evaluation === null ||
		canonicalJsonSha256(derived.evaluation) !== canonicalJsonSha256(evaluation) ||
		integration.roundId !== roundId ||
		blind.roundId !== roundId ||
		blind.integrationReceiptCanonicalSha256 !== canonicalJsonSha256(integration) ||
		evaluation.roundId !== roundId ||
		evaluation.integrationReceiptCanonicalSha256 !== canonicalJsonSha256(integration) ||
		evaluation.blindReviewCanonicalSha256 !== canonicalJsonSha256(blind) ||
		finalReceipt.roundId !== roundId ||
		finalReceipt.integrationReceiptCanonicalSha256 !== canonicalJsonSha256(integration) ||
		finalReceipt.blindReviewCanonicalSha256 !== canonicalJsonSha256(blind) ||
		finalReceipt.evaluationPath !== evaluationPath ||
		finalReceipt.evaluationCanonicalSha256 !== canonicalJsonSha256(evaluation) ||
		finalReceipt.evaluationByteSha256 !== createHash('sha256').update(evaluationBytes).digest('hex')
	)
		throw new Error(`${roundId} final evaluation bindings are inconsistent.`);
	for (const artifact of integration.aggregates) {
		if (canonicalJsonSha256(evidenceValue(values, artifact.path)) !== artifact.canonicalSha256)
			throw new Error(`Stale ${roundId} aggregate: ${artifact.path}`);
	}
	for (const entry of integration.evidence) {
		const target = ImageProductionTargetSchema.parse(evidenceValue(values, entry.targetPath));
		const assignment = ImageProductionAssignmentSchema.parse(
			evidenceValue(values, entry.assignmentPath)
		);
		const result = ImageProductionResultSchema.parse(evidenceValue(values, entry.resultPath));
		if (
			target.targetId !== entry.targetId ||
			assignment.assignmentId !== entry.assignmentId ||
			assignment.targetId !== target.targetId ||
			result.resultId !== entry.resultId ||
			result.targetId !== target.targetId ||
			canonicalJsonSha256(target) !== entry.targetCanonicalSha256 ||
			canonicalJsonSha256(assignment) !== entry.assignmentCanonicalSha256 ||
			canonicalJsonSha256(result) !== entry.resultCanonicalSha256
		)
			throw new Error(`Stale or inconsistent ${roundId} execution: ${entry.targetId}`);
	}
	return [
		paths.receipt,
		blindPath,
		evaluationPath,
		finalReceiptPath,
		...integration.aggregates.map((artifact) => artifact.path),
		...integration.evidence.flatMap((entry) => [
			entry.targetPath,
			entry.assignmentPath,
			entry.resultPath
		])
	];
}

async function resolveBoundEvidence(
	workspaceRoot: string,
	binding: z.infer<typeof EvidenceBindingSchema>
): Promise<ResolvedDispatchGateBinding> {
	let input: unknown;
	try {
		input = await readJson(workspacePath(workspaceRoot, binding.path));
	} catch (error) {
		return {
			value: null,
			check: {
				path: binding.path,
				expectedCanonicalSha256: binding.canonicalSha256,
				observedCanonicalSha256: null,
				status: (error as NodeJS.ErrnoException).code === 'ENOENT' ? 'missing' : 'invalid'
			}
		};
	}
	const observedCanonicalSha256 = canonicalJsonSha256(input);
	return {
		value: input,
		check: {
			path: binding.path,
			expectedCanonicalSha256: binding.canonicalSha256,
			observedCanonicalSha256,
			status: observedCanonicalSha256 === binding.canonicalSha256 ? 'verified' : 'stale'
		}
	};
}

function expectedPredecessorForGate(gate: AffinityWaveDispatchGate): {
	readonly stage: AffinityWavePreflight['stage'];
	readonly concurrency: number;
	readonly runId: string;
} | null {
	const derivation = gate.derivation;
	if (derivation.profile === 'normal-canary' || derivation.profile === 'final-canary') return null;
	if (derivation.profile === 'breadth')
		return { stage: 'controlled', concurrency: 6, runId: derivation.prerequisiteRunId };
	return {
		stage: { 4: 'canary', 6: 'pilot', 12: 'breadth', 16: 'load' }[
			derivation.requestedConcurrency
		] as AffinityWavePreflight['stage'],
		concurrency: { 4: 2, 6: 4, 12: 8, 16: 12 }[derivation.requestedConcurrency],
		runId: derivation.prerequisiteRunId
	};
}

function schedulerRunPaths(runId: string): [string, string] {
	return [
		`${EXPERIMENT_ROOT}/wave-runs/${runId}/preflight.json`,
		`${EXPERIMENT_ROOT}/wave-runs/${runId}/report.json`
	];
}

async function resolveGateBindingSet(
	workspaceRoot: string,
	gate: AffinityWaveDispatchGate
): Promise<{
	readonly resolved: readonly ResolvedDispatchGateBinding[];
	readonly values: ReadonlyMap<string, unknown>;
}> {
	const resolved = await Promise.all(
		gate.evidenceBindings.map((binding) => resolveBoundEvidence(workspaceRoot, binding))
	);
	const values = new Map<string, unknown>();
	for (const item of resolved)
		if (item.check.status === 'verified' && item.value !== null)
			values.set(item.check.path, item.value);
	return { resolved, values };
}

async function verifyStoredGateEvidence(
	workspaceRoot: string,
	evidence: DispatchGateEvidence,
	visitedGateIds: ReadonlySet<string>
): Promise<void> {
	if (!dispatchGateEvidenceAuthorizes(evidence))
		throw new Error('Prerequisite preflight gate evidence is not authorizing.');
	const gate = AffinityWaveDispatchGateSchema.parse(evidence.gate);
	if (
		evidence.artifactPath === null ||
		evidence.expectedCanonicalSha256 !== canonicalJsonSha256(gate) ||
		evidence.observedCanonicalSha256 !== canonicalJsonSha256(gate)
	)
		throw new Error('Prerequisite gate artifact binding is inconsistent.');
	const stored = await readJson(workspacePath(workspaceRoot, evidence.artifactPath));
	if (canonicalJsonSha256(stored) !== canonicalJsonSha256(gate))
		throw new Error('Prerequisite gate artifact changed after preflight.');
	const { resolved, values } = await resolveGateBindingSet(workspaceRoot, gate);
	if (resolved.some((item) => item.check.status !== 'verified'))
		throw new Error('Prerequisite gate evidence is missing or stale.');
	await verifyDerivedGateSemantics(workspaceRoot, gate, values, visitedGateIds);
}

async function verifyPredecessorSemanticEvidence(
	workspaceRoot: string,
	gate: AffinityWaveDispatchGate,
	values: ReadonlyMap<string, unknown>,
	visitedGateIds: ReadonlySet<string>
): Promise<string[]> {
	const expected = expectedPredecessorForGate(gate);
	if (!expected) return [];
	const [preflightPath, reportPath] = schedulerRunPaths(expected.runId);
	const preflight = AffinityWavePreflightSchema.parse(evidenceValue(values, preflightPath));
	const report = AffinityWaveReportSchema.parse(evidenceValue(values, reportPath));
	if (
		preflight.runId !== expected.runId ||
		preflight.runDirectory !== `${EXPERIMENT_ROOT}/wave-runs/${expected.runId}` ||
		preflight.stage !== expected.stage ||
		preflight.requestedConcurrency !== expected.concurrency ||
		preflight.status !== 'ready' ||
		preflight.exactConcurrencyReady !== true ||
		preflight.collisionPaths.length !== 0 ||
		report.runId !== expected.runId ||
		report.stage !== expected.stage ||
		report.requestedConcurrency !== expected.concurrency ||
		report.effectiveConcurrency !== expected.concurrency ||
		report.status !== 'completed' ||
		report.terminalCount !== report.targetCount ||
		report.failedCount !== 0 ||
		report.providerThrottleCount !== 0 ||
		report.timeoutCount !== 0 ||
		report.provenanceCompletenessRate !== 1 ||
		report.stageMetrics === null ||
		report.stageMetrics.missingResultCount !== 0 ||
		report.stageMetrics.duplicateIdCount !== 0 ||
		report.stageMetrics.pathConflictCount !== 0 ||
		report.stageMetrics.integrationErrorCount !== 0
	)
		throw new Error(`Prerequisite scheduler run ${expected.runId} is not eligible.`);
	if (
		report.sourceEvidence.preflight.path !== preflightPath ||
		report.sourceEvidence.preflight.canonicalSha256 !== canonicalJsonSha256(preflight)
	)
		throw new Error(`Prerequisite report ${expected.runId} is not bound to its preflight.`);
	await verifyStoredGateEvidence(workspaceRoot, preflight.dispatchGateEvidence!, visitedGateIds);
	const events = await readWaveEvents(workspaceRoot, preflight);
	const rebuilt = await buildWaveReport(workspaceRoot, preflight, events, report.generatedAt);
	if (canonicalJsonSha256(rebuilt) !== canonicalJsonSha256(report))
		throw new Error(`Prerequisite scheduler report ${expected.runId} is not reproducible.`);
	return [preflightPath, reportPath];
}

async function verifyDerivedGateSemantics(
	workspaceRoot: string,
	gate: AffinityWaveDispatchGate,
	values: ReadonlyMap<string, unknown>,
	visitedGateIds: ReadonlySet<string>
): Promise<void> {
	if (visitedGateIds.has(gate.gateId))
		throw new Error('Dispatch gate prerequisite cycle detected.');
	const expectedGateId =
		gate.derivation.profile === 'normal-canary'
			? 'normal-canary-dispatch-v2'
			: gate.derivation.profile === 'final-canary'
				? 'final-controlled-canary-dispatch-v2'
				: `${gate.derivation.profile === 'breadth' ? 'breadth' : `load-${gate.derivation.requestedConcurrency}`}-after-${createHash(
						'sha256'
					)
						.update(gate.derivation.prerequisiteRunId)
						.digest('hex')
						.slice(0, 12)}-dispatch-v2`;
	if (gate.gateId !== expectedGateId)
		throw new Error('Dispatch gate ID is not the canonical derivation output.');
	const nextVisited = new Set(visitedGateIds).add(gate.gateId);
	let expectedPaths: string[];
	if (gate.derivation.profile === 'normal-canary') {
		expectedPaths = await verifyNormalSemanticEvidence(workspaceRoot, values);
	} else if (gate.derivation.profile === 'final-canary') {
		expectedPaths = await verifyFinalCanarySemanticEvidence(workspaceRoot, values);
	} else {
		expectedPaths = await verifyPredecessorSemanticEvidence(
			workspaceRoot,
			gate,
			values,
			nextVisited
		);
		const predecessor = expectedPredecessorForGate(gate);
		if (!predecessor || !gate.promotionEvidence)
			throw new Error('Non-canary gate is missing predecessor promotion evidence.');
		if (predecessor.stage === 'scale')
			throw new Error('Scale cannot be used as a predecessor promotion source.');
		const [, reportPath] = schedulerRunPaths(predecessor.runId);
		const promotion = await deriveSchedulerWavePromotionEvidence(workspaceRoot, {
			runId: predecessor.runId,
			stage: predecessor.stage,
			effectiveConcurrency: predecessor.concurrency as 2 | 4 | 6 | 8 | 12,
			reportPath,
			reportCanonicalSha256: canonicalJsonSha256(evidenceValue(values, reportPath))
		});
		let derivedPromotionEvidence = promotion.evidence;
		if (gate.derivation.profile === 'breadth') {
			const canaries = await deriveBreadthCanaryPromotionEvidence(workspaceRoot);
			derivedPromotionEvidence = {
				...derivedPromotionEvidence,
				breadthCanaries: canaries.evidence
			};
			expectedPaths.push(...canaries.bindings.map((binding) => binding.path));
		}
		if (
			canonicalJsonSha256(derivedPromotionEvidence) !== canonicalJsonSha256(gate.promotionEvidence)
		)
			throw new Error('Gate promotion evidence is stale or not derived from its predecessor.');
		expectedPaths.push(...promotion.bindings.map((binding) => binding.path));
		if (gate.derivation.profile === 'breadth') {
			expectedPaths.push(
				...(await verifyRoundSemanticEvidence(workspaceRoot, values, 'final-controlled-v1'))
			);
		} else if ([4, 6].includes(gate.derivation.requestedConcurrency)) {
			expectedPaths.push(...(await verifyFinalCanarySemanticEvidence(workspaceRoot, values)));
		}
	}
	if (!exactBindingPaths(gate, expectedPaths))
		throw new Error(
			`${gate.derivation.profile} gate does not bind its exact semantic evidence graph.`
		);
}

async function resolveDispatchGate(
	workspaceRoot: string,
	plan: AffinityWavePlan,
	requiresHumanGate: boolean
): Promise<DispatchGateEvidence> {
	const pointer = plan.dispatchGate;
	if (!pointer) {
		return {
			status: 'missing-plan-pointer',
			artifactPath: null,
			expectedCanonicalSha256: null,
			observedCanonicalSha256: null,
			gate: null,
			evidenceChecks: []
		};
	}
	const gatePath = workspacePath(workspaceRoot, pointer.artifactPath);
	let input: unknown;
	try {
		input = await readJson(gatePath);
	} catch (error) {
		const missing = (error as NodeJS.ErrnoException).code === 'ENOENT';
		return {
			status: missing ? 'missing-artifact' : 'invalid-artifact',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256: null,
			gate: null,
			evidenceChecks: []
		};
	}
	const observedCanonicalSha256 = canonicalJsonSha256(input);
	const parsed = ReadableAffinityWaveDispatchGateSchema.safeParse(input);
	if (!parsed.success) {
		return {
			status: 'invalid-artifact',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: null,
			evidenceChecks: []
		};
	}
	if (observedCanonicalSha256 !== pointer.canonicalSha256) {
		return {
			status: 'hash-mismatch',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data,
			evidenceChecks: []
		};
	}
	if (parsed.data.schemaVersion === 'affinity-wave-dispatch-gate-v1') {
		return {
			status: 'legacy-gate-not-authorizing',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data,
			evidenceChecks: []
		};
	}
	const resolvedBindings = await Promise.all(
		parsed.data.evidenceBindings.map((binding) => resolveBoundEvidence(workspaceRoot, binding))
	);
	const evidenceChecks = resolvedBindings.map((item) => item.check);
	const firstEvidenceFailure = evidenceChecks.find((check) => check.status !== 'verified');
	if (firstEvidenceFailure) {
		const status = {
			missing: 'missing-evidence',
			invalid: 'invalid-evidence',
			stale: 'stale-evidence'
		} as const;
		return {
			status: status[firstEvidenceFailure.status as keyof typeof status],
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data,
			evidenceChecks
		};
	}
	if (parsed.data.authorizedStage !== plan.stage) {
		return {
			status: 'stage-not-authorized',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data,
			evidenceChecks
		};
	}
	if (requiresHumanGate && !parsed.data.humanGateSatisfied) {
		return {
			status: 'human-gate-required',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data,
			evidenceChecks
		};
	}
	try {
		await verifyDerivedGateSemantics(
			workspaceRoot,
			parsed.data,
			new Map(
				resolvedBindings.flatMap((item) =>
					item.check.status === 'verified' && item.value !== null
						? [[item.check.path, item.value] as const]
						: []
				)
			),
			new Set()
		);
	} catch {
		return {
			status: 'semantic-evidence-invalid',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data,
			evidenceChecks
		};
	}
	return {
		status: 'satisfied',
		artifactPath: pointer.artifactPath,
		expectedCanonicalSha256: pointer.canonicalSha256,
		observedCanonicalSha256,
		gate: parsed.data,
		evidenceChecks
	};
}

export async function preflightWave(
	workspaceRoot: string,
	planInput: unknown,
	availableAgentSlots: number,
	createdAt: string
): Promise<AffinityWavePreflight> {
	const boundPlan = (() => {
		if (!planInput || typeof planInput !== 'object' || !('plan' in planInput)) return null;
		const input = planInput as Partial<BoundAffinityWavePlanV2>;
		const plan = AffinityWavePlanV2Schema.parse(input.plan);
		const sourcePath = RepositoryPathSchema.parse(input.path);
		const canonicalSha256 = EvidenceBindingSchema.shape.canonicalSha256.parse(
			input.canonicalSha256
		);
		return { path: sourcePath, canonicalSha256, plan } satisfies BoundAffinityWavePlanV2;
	})();
	let v2Allocation: AffinityWaveAllocationSpec | null = null;
	if (boundPlan) {
		const expectedPlanPath = `${EXPERIMENT_ROOT}/review/wave-plans/materialized/${boundPlan.plan.runId}.json`;
		if (boundPlan.path !== expectedPlanPath)
			throw new Error(`Materialized plan path must be ${expectedPlanPath}`);
		const currentPlan = AffinityWavePlanV2Schema.parse(
			await readJson(workspacePath(workspaceRoot, boundPlan.path))
		);
		if (
			canonicalJsonSha256(currentPlan) !== boundPlan.canonicalSha256 ||
			canonicalJsonSha256(currentPlan) !== canonicalJsonSha256(boundPlan.plan)
		)
			throw new Error('Materialized wave plan changed before preflight.');
		const allocationInput = await readJson(
			workspacePath(workspaceRoot, boundPlan.plan.allocation.artifactPath)
		);
		v2Allocation = AffinityWaveAllocationSpecSchema.parse(allocationInput);
		if (
			canonicalJsonSha256(v2Allocation) !== boundPlan.plan.allocation.canonicalSha256 ||
			v2Allocation.allocationId !== boundPlan.plan.allocation.allocationId
		)
			throw new Error('Reviewed allocation changed before preflight.');
		const allocationStage = v2Allocation.stages.find(
			(stage) => stage.stage === boundPlan.plan.stage
		);
		if (!allocationStage || allocationStage.jobs.length !== boundPlan.plan.jobs.length)
			throw new Error('Materialized plan no longer matches its allocation stage.');
		for (const [index, planJob] of boundPlan.plan.jobs.entries()) {
			const allocationJob = allocationStage.jobs[index];
			if (
				!allocationJob ||
				planJob.allocationJobKey !== allocationJob.key ||
				planJob.manifestState !== allocationJob.manifestState ||
				planJob.targetPath !== allocationJob.targetPath ||
				planJob.assignmentPath !== allocationJob.assignmentPath
			)
				throw new Error(`Materialized allocation job differs at index ${index}.`);
		}
		if (boundPlan.plan.concurrencySentinelActivationReceipt) {
			const pointer = boundPlan.plan.concurrencySentinelActivationReceipt;
			const receiptInput = await readJson(workspacePath(workspaceRoot, pointer.artifactPath));
			if (canonicalJsonSha256(receiptInput) !== pointer.canonicalSha256)
				throw new Error('Concurrency-sentinel activation receipt changed before preflight.');
			const receipt = z
				.object({
					schemaVersion: z.literal('affinity-concurrency-sentinel-activation-receipt-v1'),
					status: z.literal('complete'),
					bindings: z
						.object({ allocationCanonicalSha256: EvidenceBindingSchema.shape.canonicalSha256 })
						.passthrough(),
					artifacts: z.array(
						z
							.object({
								livePath: RepositoryPathSchema,
								canonicalSha256: EvidenceBindingSchema.shape.canonicalSha256
							})
							.passthrough()
					)
				})
				.passthrough()
				.parse(receiptInput);
			if (receipt.bindings.allocationCanonicalSha256 !== boundPlan.plan.allocation.canonicalSha256)
				throw new Error('Concurrency-sentinel receipt is bound to another allocation.');
			const artifactHashes = new Map(
				receipt.artifacts.map((artifact) => [artifact.livePath, artifact.canonicalSha256])
			);
			for (const job of boundPlan.plan.jobs.filter(
				(job) => job.manifestState === 'future-sentinel'
			)) {
				if (
					artifactHashes.get(job.targetPath) !== job.targetCanonicalSha256 ||
					artifactHashes.get(job.assignmentPath) !== job.assignmentCanonicalSha256
				)
					throw new Error(`Concurrency-sentinel receipt does not bind ${job.allocationJobKey}.`);
			}
		}
	}
	const plan = boundPlan
		? AffinityWavePlanSchema.parse({
				schemaVersion: 'affinity-wave-plan-v1',
				runId: boundPlan.plan.runId,
				experimentId: boundPlan.plan.experimentId,
				stage: boundPlan.plan.stage,
				requestedConcurrency: boundPlan.plan.requestedConcurrency,
				reservedOrchestratorSlots: boundPlan.plan.reservedOrchestratorSlots,
				requireExactConcurrency: boundPlan.plan.requireExactConcurrency,
				runDirectory: boundPlan.plan.runDirectory,
				stopRules: boundPlan.plan.stopRules,
				dispatchGate: boundPlan.plan.dispatchGate,
				jobs: boundPlan.plan.jobs.map((job) => ({
					targetPath: job.targetPath,
					assignmentPath: job.assignmentPath
				}))
			})
		: AffinityWavePlanSchema.parse(planInput);
	if (!Number.isInteger(availableAgentSlots) || availableAgentSlots < 0) {
		throw new Error('availableAgentSlots must be a nonnegative integer including the orchestrator');
	}
	const resolvedJobs: z.infer<typeof ResolvedJobSchema>[] = [];
	for (const [jobIndex, job] of plan.jobs.entries()) {
		const target = ImageProductionTargetSchema.parse(
			await readJson(workspacePath(workspaceRoot, job.targetPath))
		);
		const assignment = ImageProductionAssignmentSchema.parse(
			await readJson(workspacePath(workspaceRoot, job.assignmentPath))
		);
		if (assignment.targetId !== target.targetId) {
			throw new Error(`Assignment does not match target ${target.targetId}`);
		}
		if (
			assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
			assignment.permittedOutputs.resultPath !== target.output.resultPath
		) {
			throw new Error(`Assignment outputs do not match target ${target.targetId}`);
		}
		const planV2Job = boundPlan?.plan.jobs[jobIndex];
		if (
			planV2Job &&
			(canonicalJsonSha256(target) !== planV2Job.targetCanonicalSha256 ||
				canonicalJsonSha256(assignment) !== planV2Job.assignmentCanonicalSha256)
		)
			throw new Error(`Manifest changed after materialization: ${target.targetId}`);
		resolvedJobs.push(
			(boundPlan ? ResolvedJobV2Schema : ResolvedJobSchema).parse({
				targetId: target.targetId,
				assignmentId: assignment.assignmentId,
				speciesId: target.speciesId,
				affinity: target.affinity,
				targetPath: job.targetPath,
				assignmentPath: job.assignmentPath,
				targetCanonicalSha256: canonicalJsonSha256(target),
				assignmentCanonicalSha256: canonicalJsonSha256(assignment),
				...(planV2Job
					? {
							allocationJobKey: planV2Job.allocationJobKey,
							manifestState: planV2Job.manifestState
						}
					: {}),
				candidatePath: target.output.candidatePath,
				resultPath: target.output.resultPath
			})
		);
	}
	for (const [label, values] of [
		['target IDs', resolvedJobs.map((job) => job.targetId)],
		['assignment IDs', resolvedJobs.map((job) => job.assignmentId)],
		['target paths', resolvedJobs.map((job) => job.targetPath)],
		['assignment paths', resolvedJobs.map((job) => job.assignmentPath)],
		['owned output paths', resolvedJobs.flatMap((job) => [job.candidatePath, job.resultPath])]
	] as const) {
		if (new Set(values).size !== values.length) throw new Error(`Wave has duplicate ${label}`);
	}
	if (plan.stage === 'scale') {
		if (resolvedJobs.length !== 16) {
			throw new Error('Scale wave requires exactly 16 targets');
		}
		for (const speciesId of SPECIES_IDS) {
			const count = resolvedJobs.filter((job) => job.speciesId === speciesId).length;
			if (count !== 2) {
				throw new Error(`Scale wave requires exactly two ${speciesId} targets; found ${count}`);
			}
		}
		const affinityCounts = AFFINITY_IDS.map(
			(affinity) => resolvedJobs.filter((job) => job.affinity === affinity).length
		);
		if (Math.max(...affinityCounts) - Math.min(...affinityCounts) > 1) {
			throw new Error(
				`Scale wave affinities must be distributed evenly; found ${AFFINITY_IDS.map((affinity, index) => `${affinity}=${affinityCounts[index]}`).join(', ')}`
			);
		}
	}
	const collisionPaths: string[] = [];
	for (const outputPath of resolvedJobs.flatMap((job) => [job.candidatePath, job.resultPath])) {
		if (await exists(workspacePath(workspaceRoot, outputPath))) collisionPaths.push(outputPath);
	}
	const admittedWorkerCapacity = Math.min(
		plan.requestedConcurrency,
		Math.max(0, availableAgentSlots - plan.reservedOrchestratorSlots)
	);
	const exactConcurrencyReady = admittedWorkerCapacity === plan.requestedConcurrency;
	const requiresHumanGate = resolvedJobs.some((job) =>
		job.targetPath.startsWith(`${EXPERIMENT_ROOT}/targets/final-controlled/`)
	);
	const dispatchGateEvidence = await resolveDispatchGate(workspaceRoot, plan, requiresHumanGate);
	const dispatchGateSatisfied = dispatchGateEvidence.status === 'satisfied';
	const status =
		collisionPaths.length > 0
			? 'blocked-output-collision'
			: !exactConcurrencyReady
				? 'blocked-capacity'
				: dispatchGateSatisfied
					? 'ready'
					: 'blocked-gate';
	return AffinityWavePreflightSchema.parse({
		schemaVersion: boundPlan ? 'affinity-wave-preflight-v2' : 'affinity-wave-preflight-v1',
		runId: plan.runId,
		experimentId: plan.experimentId,
		stage: plan.stage,
		createdAt,
		status,
		requestedConcurrency: plan.requestedConcurrency,
		availableAgentSlots,
		reservedOrchestratorSlots: plan.reservedOrchestratorSlots,
		admittedWorkerCapacity,
		exactConcurrencyReady,
		runDirectory: plan.runDirectory,
		stopRules: plan.stopRules,
		...(boundPlan && v2Allocation
			? {
					sourcePlan: { path: boundPlan.path, canonicalSha256: boundPlan.canonicalSha256 },
					sourceAllocation: {
						path: boundPlan.plan.allocation.artifactPath,
						canonicalSha256: boundPlan.plan.allocation.canonicalSha256,
						allocationId: v2Allocation.allocationId
					},
					concurrencySentinelActivationReceipt:
						boundPlan.plan.concurrencySentinelActivationReceipt === null
							? null
							: {
									path: boundPlan.plan.concurrencySentinelActivationReceipt.artifactPath,
									canonicalSha256:
										boundPlan.plan.concurrencySentinelActivationReceipt.canonicalSha256
								}
				}
			: {}),
		dispatchGateSatisfied,
		dispatchGateEvidence,
		collisionPaths,
		jobs: resolvedJobs
	});
}

export async function verifyCurrentWaveManifestBindings(
	workspaceRoot: string,
	preflightInput: unknown
): Promise<AffinityWavePreflight> {
	const preflight = AffinityWavePreflightSchema.parse(preflightInput);
	if (preflight.schemaVersion === 'affinity-wave-preflight-v2') {
		const planInput = await readJson(workspacePath(workspaceRoot, preflight.sourcePlan.path));
		const plan = AffinityWavePlanV2Schema.parse(planInput);
		if (
			canonicalJsonSha256(plan) !== preflight.sourcePlan.canonicalSha256 ||
			plan.runId !== preflight.runId ||
			plan.stage !== preflight.stage ||
			plan.requestedConcurrency !== preflight.requestedConcurrency ||
			plan.runDirectory !== preflight.runDirectory ||
			plan.allocation.artifactPath !== preflight.sourceAllocation.path ||
			plan.allocation.canonicalSha256 !== preflight.sourceAllocation.canonicalSha256 ||
			plan.allocation.allocationId !== preflight.sourceAllocation.allocationId ||
			plan.dispatchGate.artifactPath !== preflight.dispatchGateEvidence.artifactPath ||
			plan.dispatchGate.canonicalSha256 !==
				preflight.dispatchGateEvidence.expectedCanonicalSha256 ||
			canonicalJsonSha256(plan.concurrencySentinelActivationReceipt) !==
				canonicalJsonSha256(
					preflight.concurrencySentinelActivationReceipt
						? {
								artifactPath: preflight.concurrencySentinelActivationReceipt.path,
								canonicalSha256: preflight.concurrencySentinelActivationReceipt.canonicalSha256
							}
						: null
				)
		)
			throw new Error('V2 preflight source-plan binding is stale or inconsistent.');
		const allocationInput = await readJson(
			workspacePath(workspaceRoot, preflight.sourceAllocation.path)
		);
		const allocation = AffinityWaveAllocationSpecSchema.parse(allocationInput);
		if (
			canonicalJsonSha256(allocation) !== preflight.sourceAllocation.canonicalSha256 ||
			allocation.allocationId !== preflight.sourceAllocation.allocationId
		)
			throw new Error('V2 preflight source-allocation binding is stale or inconsistent.');
		const stage = allocation.stages.find((entry) => entry.stage === preflight.stage);
		if (
			!stage ||
			stage.jobs.length !== preflight.jobs.length ||
			plan.jobs.length !== stage.jobs.length
		)
			throw new Error('V2 preflight job set differs from the reviewed allocation.');
		for (const [index, job] of preflight.jobs.entries()) {
			const planJob = plan.jobs[index];
			const allocationJob = stage.jobs[index];
			if (
				!planJob ||
				!allocationJob ||
				job.allocationJobKey !== planJob.allocationJobKey ||
				job.allocationJobKey !== allocationJob.key ||
				job.manifestState !== planJob.manifestState ||
				job.manifestState !== allocationJob.manifestState ||
				job.targetPath !== planJob.targetPath ||
				job.targetPath !== allocationJob.targetPath ||
				job.assignmentPath !== planJob.assignmentPath ||
				job.assignmentPath !== allocationJob.assignmentPath ||
				job.targetCanonicalSha256 !== planJob.targetCanonicalSha256 ||
				job.assignmentCanonicalSha256 !== planJob.assignmentCanonicalSha256
			)
				throw new Error(`V2 preflight allocation binding differs at job ${index}.`);
		}
		if (preflight.concurrencySentinelActivationReceipt) {
			const receipt = await readJson(
				workspacePath(workspaceRoot, preflight.concurrencySentinelActivationReceipt.path)
			);
			if (
				canonicalJsonSha256(receipt) !==
				preflight.concurrencySentinelActivationReceipt.canonicalSha256
			)
				throw new Error('V2 preflight sentinel-activation receipt changed.');
		}
	}
	for (const job of preflight.jobs) {
		if (!job.targetCanonicalSha256 || !job.assignmentCanonicalSha256)
			throw new Error(`Preflight lacks manifest hashes for ${job.targetId}`);
		const [targetInput, assignmentInput] = await Promise.all([
			readJson(workspacePath(workspaceRoot, job.targetPath)),
			readJson(workspacePath(workspaceRoot, job.assignmentPath))
		]);
		const target = ImageProductionTargetSchema.parse(targetInput);
		const assignment = ImageProductionAssignmentSchema.parse(assignmentInput);
		if (
			canonicalJsonSha256(target) !== job.targetCanonicalSha256 ||
			canonicalJsonSha256(assignment) !== job.assignmentCanonicalSha256
		)
			throw new Error(`Scheduled manifest changed after preflight: ${job.targetId}`);
		if (
			target.targetId !== job.targetId ||
			assignment.assignmentId !== job.assignmentId ||
			assignment.targetId !== job.targetId ||
			target.speciesId !== job.speciesId ||
			target.affinity !== job.affinity ||
			target.output.candidatePath !== job.candidatePath ||
			target.output.resultPath !== job.resultPath ||
			assignment.permittedOutputs.candidatePath !== job.candidatePath ||
			assignment.permittedOutputs.resultPath !== job.resultPath
		)
			throw new Error(`Scheduled manifest ownership changed after preflight: ${job.targetId}`);
	}
	return preflight;
}

export async function verifyCurrentWaveSnapshot(
	workspaceRoot: string,
	preflightInput: unknown
): Promise<AffinityWavePreflight> {
	const preflight = await verifyCurrentWaveManifestBindings(workspaceRoot, preflightInput);
	if (!preflight.dispatchGateEvidence)
		throw new Error('Ready preflight is missing dispatch-gate evidence.');
	const gate = AffinityWaveDispatchGateSchema.safeParse(preflight.dispatchGateEvidence.gate);
	const requiresHumanGate =
		['breadth', 'load', 'scale'].includes(preflight.stage) ||
		preflight.jobs.some((job) =>
			job.targetPath.startsWith(`${EXPERIMENT_ROOT}/targets/final-controlled/`)
		);
	if (
		!gate.success ||
		gate.data.authorizedStage !== preflight.stage ||
		gate.data.qualityGateSatisfied !== true ||
		(requiresHumanGate && gate.data.humanGateSatisfied !== true)
	)
		throw new Error('Stored dispatch gate does not authorize the current preflight stage.');
	await verifyStoredGateEvidence(workspaceRoot, preflight.dispatchGateEvidence, new Set());
	return preflight;
}

/** Revalidates the exact manifest and gate snapshot before any live scheduler action. */
export async function verifyCurrentWavePreflight(
	workspaceRoot: string,
	preflightInput: unknown
): Promise<AffinityWavePreflight> {
	const preflight = AffinityWavePreflightSchema.parse(preflightInput);
	if (preflight.status !== 'ready')
		throw new Error(`Live scheduler actions require a ready preflight; found ${preflight.status}`);
	return verifyCurrentWaveSnapshot(workspaceRoot, preflight);
}

function orderEvents(events: readonly AffinityWaveEvent[]): AffinityWaveEvent[] {
	const v2Events = events.filter((event) => event.schemaVersion === 'affinity-wave-event-v2');
	if (v2Events.length > 0) {
		if (v2Events.length !== events.length)
			throw new Error('Wave event journals may not mix v1 and v2 events');
		return [...v2Events].sort((left, right) => left.sequence - right.sequence);
	}
	const eventPriority: Record<AffinityWaveEvent['kind'], number> = {
		'wave-started': 0,
		'job-dispatched': 1,
		'job-finished': 2,
		'worker-failure': 2,
		'wave-finished': 3
	};
	return [...events].sort(
		(left, right) =>
			Date.parse(left.at) - Date.parse(right.at) ||
			eventPriority[left.kind] - eventPriority[right.kind] ||
			left.eventId.localeCompare(right.eventId)
	);
}

interface JournalState {
	readonly ordered: readonly AffinityWaveEvent[];
	readonly started: AffinityWaveEvent | undefined;
	readonly finished: AffinityWaveEvent | undefined;
	readonly dispatched: ReadonlyMap<string, Extract<AffinityWaveEvent, { kind: 'job-dispatched' }>>;
	readonly terminal: ReadonlyMap<
		string,
		Extract<AffinityWaveEvent, { kind: 'job-finished' | 'worker-failure' }>
	>;
	readonly activeTargets: ReadonlySet<string>;
	readonly capacityFailures: readonly Extract<AffinityWaveEvent, { kind: 'worker-failure' }>[];
	readonly providerThrottles: readonly Extract<AffinityWaveEvent, { kind: 'worker-failure' }>[];
	readonly stopFailures: readonly Extract<AffinityWaveEvent, { kind: 'worker-failure' }>[];
	readonly maximumActiveWorkerCount: number;
}

export function validateEventJournal(
	preflightInput: unknown,
	eventInputs: readonly unknown[]
): JournalState {
	const preflight = AffinityWavePreflightSchema.parse(preflightInput);
	const parsed = eventInputs.map((event) => AffinityWaveEventSchema.parse(event));
	if (parsed.length > 0 && preflight.status !== 'ready') {
		throw new Error(`Wave events require a ready preflight; found ${preflight.status}`);
	}
	const eventIds = parsed.map((event) => event.eventId);
	if (new Set(eventIds).size !== eventIds.length) throw new Error('Wave event IDs must be unique');
	if (parsed.some((event) => event.runId !== preflight.runId)) {
		throw new Error('Every event must belong to the preflight run');
	}
	const v2Events = parsed.filter((event) => event.schemaVersion === 'affinity-wave-event-v2');
	if (
		preflight.schemaVersion === 'affinity-wave-preflight-v2' &&
		v2Events.length !== parsed.length
	) {
		throw new Error('V2 preflights require a sequence-bound v2 event journal');
	}
	if (v2Events.length > 0) {
		const expectedPreflightHash = canonicalJsonSha256(preflight);
		for (const event of v2Events) {
			if (event.preflightCanonicalSha256 !== expectedPreflightHash)
				throw new Error('Wave event preflight binding does not match the current preflight');
		}
	}
	const jobIds = new Set(preflight.jobs.map((job) => job.targetId));
	const ordered = orderEvents(parsed);
	if (ordered[0]?.schemaVersion === 'affinity-wave-event-v2') {
		for (const [index, event] of ordered.entries()) {
			if (event.schemaVersion !== 'affinity-wave-event-v2' || event.sequence !== index)
				throw new Error('V2 wave event sequences must be contiguous and start at zero');
			if (index > 0) {
				const previous = ordered[index - 1];
				if (
					previous?.schemaVersion !== 'affinity-wave-event-v2' ||
					Date.parse(event.recordedAt) < Date.parse(previous.recordedAt)
				)
					throw new Error('V2 wave event recording times must be nondecreasing');
				if (Date.parse(event.at) < Date.parse(previous.at))
					throw new Error('V2 wave event occurrence times must be nondecreasing');
			}
		}
	}
	const startedEvents = ordered.filter((event) => event.kind === 'wave-started');
	const finishedEvents = ordered.filter((event) => event.kind === 'wave-finished');
	if (startedEvents.length > 1 || finishedEvents.length > 1) {
		throw new Error('Wave may have only one start and one finish event');
	}
	const started = startedEvents[0];
	const finished = finishedEvents[0];
	if (finished && !started) throw new Error('Wave cannot finish before it starts');
	const dispatched = new Map<string, Extract<AffinityWaveEvent, { kind: 'job-dispatched' }>>();
	const terminal = new Map<
		string,
		Extract<AffinityWaveEvent, { kind: 'job-finished' | 'worker-failure' }>
	>();
	const activeTargets = new Set<string>();
	const capacityFailures: Extract<AffinityWaveEvent, { kind: 'worker-failure' }>[] = [];
	const providerThrottles: Extract<AffinityWaveEvent, { kind: 'worker-failure' }>[] = [];
	const stopFailures: Extract<AffinityWaveEvent, { kind: 'worker-failure' }>[] = [];
	let capacityStopTriggered = false;
	let waveStarted = false;
	let waveFinished = false;
	let maximumActiveWorkerCount = 0;
	for (const event of ordered) {
		if (waveFinished) throw new Error('No event may occur after wave-finished');
		if (event.kind !== 'wave-started' && !waveStarted) {
			throw new Error('Wave events require a preceding wave-started event');
		}
		if (event.kind === 'wave-started') waveStarted = true;
		if (event.kind === 'wave-finished') waveFinished = true;
		if ('targetId' in event && !jobIds.has(event.targetId)) {
			throw new Error(`Event target is not in the wave: ${event.targetId}`);
		}
		if (event.kind === 'job-dispatched') {
			if (capacityStopTriggered) {
				throw new Error('Dispatch recorded after the capacity stop rule triggered');
			}
			if (dispatched.has(event.targetId) || terminal.has(event.targetId)) {
				throw new Error(`Target dispatched more than once: ${event.targetId}`);
			}
			if (
				[...activeTargets].some((targetId) => dispatched.get(targetId)?.workerId === event.workerId)
			) {
				throw new Error(`Worker is already active on another target: ${event.workerId}`);
			}
			dispatched.set(event.targetId, event);
			activeTargets.add(event.targetId);
			if (activeTargets.size > preflight.admittedWorkerCapacity) {
				throw new Error('Recorded active workers exceed admitted worker capacity');
			}
			maximumActiveWorkerCount = Math.max(maximumActiveWorkerCount, activeTargets.size);
		}
		if (event.kind === 'job-finished') {
			const launch = dispatched.get(event.targetId);
			if (!launch || !activeTargets.has(event.targetId)) {
				throw new Error(`Finished target was not active: ${event.targetId}`);
			}
			if (launch.workerId !== event.workerId) {
				throw new Error(`Finished target changed worker identity: ${event.targetId}`);
			}
			terminal.set(event.targetId, event);
			activeTargets.delete(event.targetId);
		}
		if (event.kind === 'worker-failure') {
			if (terminal.has(event.targetId))
				throw new Error(`Target has multiple outcomes: ${event.targetId}`);
			const launch = dispatched.get(event.targetId);
			if (event.failureKind !== 'capacity' && !launch) {
				throw new Error(`Non-capacity failure requires a dispatched worker: ${event.targetId}`);
			}
			if (launch && event.workerId !== launch.workerId) {
				throw new Error(`Failed target changed worker identity: ${event.targetId}`);
			}
			terminal.set(event.targetId, event);
			activeTargets.delete(event.targetId);
			if (event.failureKind === 'capacity') {
				capacityFailures.push(event);
			}
			if (event.failureKind === 'provider-throttle') providerThrottles.push(event);
			if (
				['capacity', 'provider-throttle', 'timeout', 'malformed-output'].includes(event.failureKind)
			) {
				stopFailures.push(event);
				if (stopFailures.length === preflight.stopRules.capacityFailureLimit)
					capacityStopTriggered = true;
			}
		}
	}
	if (finished && activeTargets.size > 0)
		throw new Error('Wave finished while workers were active');
	return {
		ordered,
		started,
		finished,
		dispatched,
		terminal,
		activeTargets,
		capacityFailures,
		providerThrottles,
		stopFailures,
		maximumActiveWorkerCount
	};
}

export function nextDispatchDecision(
	preflightInput: unknown,
	eventInputs: readonly unknown[]
): AffinityWaveDispatchDecision {
	const preflight = AffinityWavePreflightSchema.parse(preflightInput);
	const state = validateEventJournal(preflight, eventInputs);
	const common = {
		runId: preflight.runId,
		requestedConcurrency: preflight.requestedConcurrency,
		admittedWorkerCapacity: preflight.admittedWorkerCapacity,
		activeWorkerCount: state.activeTargets.size,
		capacityFailureCount: state.capacityFailures.length,
		providerThrottleCount: state.providerThrottles.length,
		stopFailureCount: state.stopFailures.length
	};
	const decision = (
		stop: boolean,
		reason: AffinityWaveDispatchDecision['reason'],
		launchTargetIds: readonly string[] = []
	): AffinityWaveDispatchDecision => {
		const launchJobs = launchTargetIds.map((targetId) => {
			const job = preflight.jobs.find((candidate) => candidate.targetId === targetId);
			if (!job?.targetCanonicalSha256 || !job.assignmentCanonicalSha256)
				throw new Error(`Dispatch target lacks manifest bindings: ${targetId}`);
			return {
				targetId: job.targetId,
				targetPath: job.targetPath,
				targetCanonicalSha256: job.targetCanonicalSha256,
				assignmentId: job.assignmentId,
				assignmentPath: job.assignmentPath,
				assignmentCanonicalSha256: job.assignmentCanonicalSha256,
				candidatePath: job.candidatePath,
				resultPath: job.resultPath
			};
		});
		return AffinityWaveDispatchDecisionSchema.parse({
			...common,
			stop,
			reason,
			launchTargetIds,
			launchJobs
		});
	};
	if (preflight.status === 'blocked-output-collision') return decision(true, 'output-collision');
	if (preflight.status === 'blocked-capacity') return decision(true, 'capacity-preflight-blocked');
	if (preflight.status === 'blocked-gate') return decision(true, 'dispatch-gate-blocked');
	if (!state.started) return decision(true, 'wave-not-started');
	if (state.finished) return decision(true, 'wave-finished');
	if (state.stopFailures.length >= preflight.stopRules.capacityFailureLimit) {
		return decision(true, 'capacity-stop-rule');
	}
	const unavailable = new Set([...state.dispatched.keys(), ...state.terminal.keys()]);
	const pending = preflight.jobs
		.map((job) => job.targetId)
		.filter((targetId) => !unavailable.has(targetId));
	if (pending.length === 0 && state.activeTargets.size === 0) {
		return decision(true, 'all-targets-terminal');
	}
	const freeWorkers = preflight.admittedWorkerCapacity - state.activeTargets.size;
	if (freeWorkers <= 0 || pending.length === 0) return decision(false, 'workers-busy');
	return decision(false, 'launch-ready', pending.slice(0, freeWorkers));
}

function percentile(values: readonly number[], fraction: number): number | null {
	if (values.length < 10) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const rank = Math.ceil(fraction * sorted.length) - 1;
	return sorted[Math.max(0, rank)] ?? null;
}

function median(values: readonly number[]): number | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const midpoint = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0
		? ((sorted[midpoint - 1] ?? 0) + (sorted[midpoint] ?? 0)) / 2
		: (sorted[midpoint] ?? null);
}

async function readFinishedResults(
	workspaceRoot: string,
	preflight: AffinityWavePreflight,
	state: JournalState
): Promise<ReadonlyMap<string, ImageProductionResult>> {
	const results = new Map<string, ImageProductionResult>();
	for (const [targetId, terminal] of state.terminal) {
		if (terminal.kind !== 'job-finished') continue;
		const job = preflight.jobs.find((candidate) => candidate.targetId === targetId)!;
		const target = ImageProductionTargetSchema.parse(
			await readJson(workspacePath(workspaceRoot, job.targetPath))
		);
		const assignment = ImageProductionAssignmentSchema.parse(
			await readJson(workspacePath(workspaceRoot, job.assignmentPath))
		);
		const result = ImageProductionResultSchema.parse(
			await readJson(workspacePath(workspaceRoot, job.resultPath))
		);
		if (result.targetId !== job.targetId || result.assignmentId !== job.assignmentId) {
			throw new Error(`Result binding does not match scheduled job ${job.targetId}`);
		}
		if (
			target.targetId !== job.targetId ||
			assignment.assignmentId !== job.assignmentId ||
			assignment.targetId !== target.targetId ||
			target.output.resultPath !== job.resultPath ||
			assignment.permittedOutputs.resultPath !== job.resultPath ||
			assignment.permittedOutputs.candidatePath !== target.output.candidatePath
		)
			throw new Error(`Manifest ownership differs for scheduled job ${job.targetId}`);
		validateImageProductionExecution({ target, assignment, result });
		const retained =
			result.status === 'candidate'
				? result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output
				: [...result.attempts].reverse().find((attempt) => attempt.output)?.output;
		if (retained) {
			if (retained.path !== target.output.candidatePath)
				throw new Error(`Retained output path differs for ${job.targetId}`);
			const bytes = await readFile(workspacePath(workspaceRoot, retained.path));
			const metadata = await sharp(bytes).metadata();
			const mediaType =
				metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
			if (
				bytes.byteLength !== retained.bytes ||
				createHash('sha256').update(bytes).digest('hex') !== retained.contentHash ||
				metadata.width !== retained.width ||
				metadata.height !== retained.height ||
				mediaType !== retained.mediaType
			)
				throw new Error(`Retained image provenance differs for ${job.targetId}`);
		}
		if (Date.parse(result.completedAt) > Date.parse(terminal.at)) {
			throw new Error(`Job-finished predates result completion for ${job.targetId}`);
		}
		results.set(targetId, result);
	}
	return results;
}

export async function buildWaveReport(
	workspaceRoot: string,
	preflightInput: unknown,
	eventInputs: readonly unknown[],
	generatedAt: string
): Promise<AffinityWaveReport> {
	const parsedPreflight = AffinityWavePreflightSchema.parse(preflightInput);
	const preflight =
		parsedPreflight.status === 'ready'
			? await verifyCurrentWaveManifestBindings(workspaceRoot, parsedPreflight)
			: parsedPreflight;
	const events = eventInputs.map((event) => AffinityWaveEventSchema.parse(event));
	const state = validateEventJournal(preflight, events);
	const results = await readFinishedResults(workspaceRoot, preflight, state);
	const capacityStopTriggered =
		state.stopFailures.length >= preflight.stopRules.capacityFailureLimit;
	const status = !state.started
		? 'not-started'
		: capacityStopTriggered
			? 'stopped-capacity'
			: state.finished
				? 'completed'
				: 'in-progress';
	if (status === 'completed' && state.terminal.size !== preflight.jobs.length) {
		throw new Error('A completed wave requires one terminal outcome per target');
	}
	const outcomeCounts = { candidate: 0, revise: 0, failed: 0 };
	for (const terminal of state.terminal.values()) {
		if (terminal.kind === 'worker-failure') outcomeCounts.failed += 1;
		else outcomeCounts[results.get(terminal.targetId)!.status] += 1;
	}
	const generationDurations = [...results.values()].flatMap((result) =>
		result.attempts.map((attempt) => attempt.generationDurationMs)
	);
	const retryCount = [...results.values()].reduce(
		(total, result) => total + Math.max(0, result.attempts.length - 1),
		0
	);
	const retriedTargetCount = [...results.values()].filter(
		(result) => result.attempts.length > 1
	).length;
	const jobTimes = [...results.values()].map((result) => result.totalWallTimeMs);
	for (const [targetId, terminal] of state.terminal) {
		if (terminal.kind !== 'worker-failure') continue;
		const dispatched = state.dispatched.get(targetId);
		if (dispatched) jobTimes.push(Date.parse(terminal.at) - Date.parse(dispatched.at));
	}
	const waveWallTimeMs =
		state.started && state.finished
			? Date.parse(state.finished.at) - Date.parse(state.started.at)
			: null;
	const summedJobTimeMs =
		jobTimes.length > 0 ? jobTimes.reduce((sum, value) => sum + value, 0) : null;
	const effectiveConcurrency = state.maximumActiveWorkerCount;
	const effectiveSpeedup =
		waveWallTimeMs && summedJobTimeMs ? summedJobTimeMs / waveWallTimeMs : null;
	const parallelEfficiency =
		effectiveSpeedup && effectiveConcurrency > 0 ? effectiveSpeedup / effectiveConcurrency : null;
	const terminalCount = state.terminal.size;
	const missingResultCount = [...state.terminal.values()].filter(
		(event) => event.kind === 'worker-failure'
	).length;
	const stageMetrics =
		status === 'completed' &&
		terminalCount === preflight.jobs.length &&
		generationDurations.length > 0 &&
		waveWallTimeMs !== null &&
		waveWallTimeMs > 0 &&
		summedJobTimeMs !== null &&
		summedJobTimeMs > 0 &&
		effectiveSpeedup !== null &&
		parallelEfficiency !== null &&
		effectiveConcurrency > 0
			? ImageProductionConcurrencyStageSchema.parse({
					stage: preflight.stage,
					plannedParallelJobs: preflight.requestedConcurrency,
					effectiveParallelJobs: effectiveConcurrency,
					targetCount: preflight.jobs.length,
					candidateCount: outcomeCounts.candidate,
					reviseCount: outcomeCounts.revise,
					failedCount: outcomeCounts.failed,
					throttleCount: state.providerThrottles.length,
					timeoutCount: [...state.terminal.values()].filter(
						(event) => event.kind === 'worker-failure' && event.failureKind === 'timeout'
					).length,
					retryCount,
					generationMedianMs: median(generationDurations) ?? 0,
					generationP90Ms: percentile(generationDurations, 0.9),
					generationP95Ms: percentile(generationDurations, 0.95),
					slowestCompletionMs: Math.max(...jobTimes),
					waveWallTimeMs,
					summedJobTimeMs,
					effectiveSpeedup,
					parallelEfficiency,
					queueDelayMs: null,
					visualCandidateRate: outcomeCounts.candidate / terminalCount,
					provenanceCompletenessRate: results.size / terminalCount,
					missingResultCount,
					duplicateIdCount: 0,
					pathConflictCount: 0,
					integrationErrorCount: 0
				})
			: null;
	const report = {
		schemaVersion: 'affinity-wave-report-v3' as const,
		runId: preflight.runId,
		experimentId: preflight.experimentId,
		stage: preflight.stage,
		generatedAt,
		status,
		requestedConcurrency: preflight.requestedConcurrency,
		admittedWorkerCapacity: preflight.admittedWorkerCapacity,
		effectiveConcurrency,
		workerCount: new Set([...state.dispatched.values()].map((event) => event.workerId)).size,
		startedAt: state.started?.at ?? null,
		completedAt: state.finished?.at ?? null,
		waveWallTimeMs,
		targetCount: preflight.jobs.length,
		dispatchedCount: state.dispatched.size,
		terminalCount,
		unlaunchedCount:
			preflight.jobs.length -
			state.dispatched.size -
			state.capacityFailures.filter((event) => !state.dispatched.has(event.targetId)).length,
		candidateCount: outcomeCounts.candidate,
		reviseCount: outcomeCounts.revise,
		failedCount: outcomeCounts.failed,
		capacityFailureCount: state.capacityFailures.length,
		providerThrottleCount: state.providerThrottles.length,
		timeoutCount: [...state.terminal.values()].filter(
			(event) => event.kind === 'worker-failure' && event.failureKind === 'timeout'
		).length,
		malformedOutputCount: [...state.terminal.values()].filter(
			(event) => event.kind === 'worker-failure' && event.failureKind === 'malformed-output'
		).length,
		retryCount,
		retriedTargetCount,
		retryRate: results.size === 0 ? 0 : retriedTargetCount / results.size,
		generationMedianMs: median(generationDurations),
		generationP90Ms: percentile(generationDurations, 0.9),
		generationP95Ms: percentile(generationDurations, 0.95),
		slowestCompletionMs: jobTimes.length > 0 ? Math.max(...jobTimes) : null,
		summedJobTimeMs,
		effectiveSpeedup,
		parallelEfficiency,
		provenanceCompletenessRate: terminalCount === 0 ? 0 : results.size / terminalCount,
		stopRule: {
			capacityFailureLimit: preflight.stopRules.capacityFailureLimit,
			triggered: capacityStopTriggered,
			triggeredAt: state.stopFailures[preflight.stopRules.capacityFailureLimit - 1]?.at ?? null
		},
		sourceEvidence: {
			preflight: {
				path: `${preflight.runDirectory}/preflight.json`,
				canonicalSha256: canonicalJsonSha256(preflight)
			},
			manifests: preflight.jobs
				.map((job) => {
					if (!job.targetCanonicalSha256 || !job.assignmentCanonicalSha256)
						throw new Error(`Report manifest binding is absent for ${job.targetId}`);
					return {
						targetId: job.targetId,
						target: {
							path: job.targetPath,
							canonicalSha256: job.targetCanonicalSha256
						},
						assignment: {
							path: job.assignmentPath,
							canonicalSha256: job.assignmentCanonicalSha256
						}
					};
				})
				.sort((left, right) => left.targetId.localeCompare(right.targetId)),
			events: events
				.map((event) => ({
					path: `${preflight.runDirectory}/events/${event.eventId}.json`,
					canonicalSha256: canonicalJsonSha256(event)
				}))
				.sort((left, right) => left.path.localeCompare(right.path)),
			results: [...results.entries()]
				.map(([targetId, result]) => {
					const job = preflight.jobs.find((candidate) => candidate.targetId === targetId)!;
					const retained =
						result.status === 'candidate'
							? result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)
									?.output
							: [...result.attempts].reverse().find((attempt) => attempt.output)?.output;
					return {
						targetId,
						path: job.resultPath,
						canonicalSha256: canonicalJsonSha256(result),
						candidatePath: retained?.path ?? null,
						candidateByteSha256: retained?.contentHash ?? null
					};
				})
				.sort((left, right) => left.targetId.localeCompare(right.targetId))
		},
		stageMetrics
	};
	return AffinityWaveReportSchema.parse(report);
}

export async function readPreflight(
	workspaceRoot: string,
	preflightPath: string
): Promise<AffinityWavePreflight> {
	const repositoryPath = RepositoryPathSchema.parse(preflightPath);
	const preflight = AffinityWavePreflightSchema.parse(
		await readJson(workspacePath(workspaceRoot, repositoryPath))
	);
	const expectedPath = `${preflight.runDirectory}/preflight.json`;
	if (repositoryPath !== expectedPath)
		throw new Error(`Preflight must be read from its canonical path ${expectedPath}`);
	return preflight;
}

export async function readWaveEvents(
	workspaceRoot: string,
	preflight: AffinityWavePreflight
): Promise<AffinityWaveEvent[]> {
	const directory = workspacePath(workspaceRoot, `${preflight.runDirectory}/events`);
	if (!(await exists(directory))) return [];
	const entries = (await readdir(directory)).filter((entry) => entry.endsWith('.json')).sort();
	return Promise.all(
		entries.map(async (entry) =>
			AffinityWaveEventSchema.parse(await readJson(path.join(directory, entry)))
		)
	);
}

async function writeJsonExclusive(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, '\t')}\n`, {
		encoding: 'utf8',
		flag: 'wx'
	});
}

export async function writePreflightExclusive(
	workspaceRoot: string,
	preflight: AffinityWavePreflight
): Promise<string> {
	if (preflight.status === 'ready') await verifyCurrentWavePreflight(workspaceRoot, preflight);
	const relativePath = `${preflight.runDirectory}/preflight.json`;
	const runDirectory = workspacePath(workspaceRoot, preflight.runDirectory);
	await mkdir(path.dirname(runDirectory), { recursive: true });
	await mkdir(runDirectory);
	await writeJsonExclusive(workspacePath(workspaceRoot, relativePath), preflight);
	return relativePath;
}

export async function recordEventExclusive(
	workspaceRoot: string,
	preflightInput: unknown,
	eventInput: unknown
): Promise<string> {
	const parsedPreflight = AffinityWavePreflightSchema.parse(preflightInput);
	const eventRequest = AffinityWaveEventRequestSchema.parse(eventInput);
	const eventsDirectory = workspacePath(workspaceRoot, `${parsedPreflight.runDirectory}/events`);
	await mkdir(eventsDirectory, { recursive: true });
	const lockPath = path.join(eventsDirectory, '.journal.lock');
	let lock: Awaited<ReturnType<typeof open>> | undefined;
	try {
		lock = await open(lockPath, 'wx');
		const preflight = await verifyCurrentWavePreflight(workspaceRoot, parsedPreflight);
		const current = await readWaveEvents(workspaceRoot, preflight);
		const event: AffinityWaveEvent =
			preflight.schemaVersion === 'affinity-wave-preflight-v2'
				? AffinityWaveEventSchema.parse({
						...eventRequest,
						schemaVersion: 'affinity-wave-event-v2',
						sequence: current.length,
						preflightCanonicalSha256: canonicalJsonSha256(preflight),
						recordedAt: new Date().toISOString()
					})
				: eventRequest;
		const nextState = validateEventJournal(preflight, [...current, event]);
		if (event.kind === 'job-finished') {
			await readFinishedResults(workspaceRoot, preflight, nextState);
		}
		const relativePath = `${preflight.runDirectory}/events/${event.eventId}.json`;
		await writeJsonExclusive(workspacePath(workspaceRoot, relativePath), event);
		return relativePath;
	} finally {
		await lock?.close();
		if (lock) await unlink(lockPath);
	}
}

export async function writeReportExclusive(
	workspaceRoot: string,
	preflight: AffinityWavePreflight,
	report: AffinityWaveReport
): Promise<string> {
	if (preflight.status === 'ready') await verifyCurrentWavePreflight(workspaceRoot, preflight);
	if (
		report.runId !== preflight.runId ||
		report.experimentId !== preflight.experimentId ||
		report.stage !== preflight.stage
	) {
		throw new Error('Wave report does not match its preflight');
	}
	const events = await readWaveEvents(workspaceRoot, preflight);
	const rebuilt = await buildWaveReport(workspaceRoot, preflight, events, report.generatedAt);
	if (canonicalJsonSha256(rebuilt) !== canonicalJsonSha256(report))
		throw new Error('Wave report is not the canonical reproduction of current evidence.');
	const relativePath = `${preflight.runDirectory}/report.json`;
	await writeJsonExclusive(workspacePath(workspaceRoot, relativePath), report);
	return relativePath;
}
