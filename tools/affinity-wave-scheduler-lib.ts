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
	type ImageProductionResult
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

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

export const AffinityWaveDispatchGateSchema = z
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
	});

export type AffinityWaveDispatchGate = z.infer<typeof AffinityWaveDispatchGateSchema>;

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
		candidatePath: RepositoryPathSchema,
		resultPath: RepositoryPathSchema
	})
	.strict();

export const AffinityWavePreflightSchema = z
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
		dispatchGateEvidence: z
			.object({
				status: z.enum([
					'satisfied',
					'missing-plan-pointer',
					'missing-artifact',
					'hash-mismatch',
					'invalid-artifact',
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
				gate: AffinityWaveDispatchGateSchema.nullable()
			})
			.strict()
			.optional(),
		collisionPaths: z.array(RepositoryPathSchema),
		jobs: z.array(ResolvedJobSchema).min(1).max(100)
	})
	.strict();

export type AffinityWavePreflight = z.infer<typeof AffinityWavePreflightSchema>;

const BaseEventSchema = z.object({
	schemaVersion: z.literal('affinity-wave-event-v1'),
	eventId: SlugSchema,
	runId: SlugSchema,
	at: z.string().datetime({ offset: true })
});

export const AffinityWaveEventSchema = z.discriminatedUnion('kind', [
	BaseEventSchema.extend({ kind: z.literal('wave-started') }).strict(),
	BaseEventSchema.extend({
		kind: z.literal('job-dispatched'),
		targetId: SlugSchema,
		workerId: SlugSchema
	}).strict(),
	BaseEventSchema.extend({
		kind: z.literal('job-finished'),
		targetId: SlugSchema,
		workerId: SlugSchema
	}).strict(),
	BaseEventSchema.extend({
		kind: z.literal('worker-failure'),
		targetId: SlugSchema,
		workerId: SlugSchema.nullable(),
		failureKind: z.enum(['capacity', 'provider-throttle', 'timeout', 'malformed-output', 'other']),
		detail: z.string().trim().min(1).max(1_000)
	}).strict(),
	BaseEventSchema.extend({ kind: z.literal('wave-finished') }).strict()
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
		launchTargetIds: z.array(SlugSchema)
	})
	.strict();

export type AffinityWaveDispatchDecision = z.infer<typeof AffinityWaveDispatchDecisionSchema>;

export const AffinityWaveReportSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-report-v1'),
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

export async function readWavePlan(
	workspaceRoot: string,
	planPath: string
): Promise<AffinityWavePlan> {
	return AffinityWavePlanSchema.parse(await readJson(workspacePath(workspaceRoot, planPath)));
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
			gate: null
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
			gate: null
		};
	}
	const observedCanonicalSha256 = canonicalJsonSha256(input);
	const parsed = AffinityWaveDispatchGateSchema.safeParse(input);
	if (!parsed.success) {
		return {
			status: 'invalid-artifact',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: null
		};
	}
	if (observedCanonicalSha256 !== pointer.canonicalSha256) {
		return {
			status: 'hash-mismatch',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data
		};
	}
	if (parsed.data.authorizedStage !== plan.stage) {
		return {
			status: 'stage-not-authorized',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data
		};
	}
	if (requiresHumanGate && !parsed.data.humanGateSatisfied) {
		return {
			status: 'human-gate-required',
			artifactPath: pointer.artifactPath,
			expectedCanonicalSha256: pointer.canonicalSha256,
			observedCanonicalSha256,
			gate: parsed.data
		};
	}
	return {
		status: 'satisfied',
		artifactPath: pointer.artifactPath,
		expectedCanonicalSha256: pointer.canonicalSha256,
		observedCanonicalSha256,
		gate: parsed.data
	};
}

export async function preflightWave(
	workspaceRoot: string,
	planInput: unknown,
	availableAgentSlots: number,
	createdAt: string
): Promise<AffinityWavePreflight> {
	const plan = AffinityWavePlanSchema.parse(planInput);
	if (!Number.isInteger(availableAgentSlots) || availableAgentSlots < 0) {
		throw new Error('availableAgentSlots must be a nonnegative integer including the orchestrator');
	}
	const resolvedJobs: z.infer<typeof ResolvedJobSchema>[] = [];
	for (const job of plan.jobs) {
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
		resolvedJobs.push(
			ResolvedJobSchema.parse({
				targetId: target.targetId,
				assignmentId: assignment.assignmentId,
				speciesId: target.speciesId,
				affinity: target.affinity,
				targetPath: job.targetPath,
				assignmentPath: job.assignmentPath,
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
		schemaVersion: 'affinity-wave-preflight-v1',
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
		dispatchGateSatisfied,
		dispatchGateEvidence,
		collisionPaths,
		jobs: resolvedJobs
	});
}

function orderEvents(events: readonly AffinityWaveEvent[]): AffinityWaveEvent[] {
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
	const jobIds = new Set(preflight.jobs.map((job) => job.targetId));
	const ordered = orderEvents(parsed);
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
	let capacityStopAt: number | null = null;
	for (const event of ordered) {
		const at = Date.parse(event.at);
		if (event.kind !== 'wave-started' && (!started || at < Date.parse(started.at))) {
			throw new Error('Wave events require a preceding wave-started event');
		}
		if (finished && event.kind !== 'wave-finished' && at > Date.parse(finished.at)) {
			throw new Error('No event may occur after wave-finished');
		}
		if ('targetId' in event && !jobIds.has(event.targetId)) {
			throw new Error(`Event target is not in the wave: ${event.targetId}`);
		}
		if (event.kind === 'job-dispatched') {
			if (capacityStopAt !== null && at >= capacityStopAt) {
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
			if (event.failureKind === 'capacity' || event.failureKind === 'provider-throttle') {
				stopFailures.push(event);
				if (stopFailures.length === preflight.stopRules.capacityFailureLimit) capacityStopAt = at;
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
		stopFailures
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
	): AffinityWaveDispatchDecision =>
		AffinityWaveDispatchDecisionSchema.parse({ ...common, stop, reason, launchTargetIds });
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

function maximumConcurrentWorkers(state: JournalState, generatedAt: string): number {
	const points: Array<{ at: number; delta: number; priority: number }> = [];
	for (const [targetId, dispatch] of state.dispatched) {
		points.push({ at: Date.parse(dispatch.at), delta: 1, priority: 0 });
		const terminal = state.terminal.get(targetId);
		points.push({ at: Date.parse(terminal?.at ?? generatedAt), delta: -1, priority: 1 });
	}
	points.sort((left, right) => left.at - right.at || left.priority - right.priority);
	let active = 0;
	let maximum = 0;
	for (const point of points) {
		active += point.delta;
		maximum = Math.max(maximum, active);
	}
	return maximum;
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
		const result = ImageProductionResultSchema.parse(
			await readJson(workspacePath(workspaceRoot, job.resultPath))
		);
		if (result.targetId !== job.targetId || result.assignmentId !== job.assignmentId) {
			throw new Error(`Result binding does not match scheduled job ${job.targetId}`);
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
	const preflight = AffinityWavePreflightSchema.parse(preflightInput);
	const state = validateEventJournal(preflight, eventInputs);
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
	const effectiveConcurrency = maximumConcurrentWorkers(state, generatedAt);
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
		schemaVersion: 'affinity-wave-report-v1' as const,
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
		stageMetrics
	};
	return AffinityWaveReportSchema.parse(report);
}

export async function readPreflight(
	workspaceRoot: string,
	preflightPath: string
): Promise<AffinityWavePreflight> {
	return AffinityWavePreflightSchema.parse(
		await readJson(workspacePath(workspaceRoot, preflightPath))
	);
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
	const preflight = AffinityWavePreflightSchema.parse(preflightInput);
	const event = AffinityWaveEventSchema.parse(eventInput);
	const eventsDirectory = workspacePath(workspaceRoot, `${preflight.runDirectory}/events`);
	await mkdir(eventsDirectory, { recursive: true });
	const lockPath = path.join(eventsDirectory, '.journal.lock');
	let lock: Awaited<ReturnType<typeof open>> | undefined;
	try {
		lock = await open(lockPath, 'wx');
		const current = await readWaveEvents(workspaceRoot, preflight);
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
	if (
		report.runId !== preflight.runId ||
		report.experimentId !== preflight.experimentId ||
		report.stage !== preflight.stage
	) {
		throw new Error('Wave report does not match its preflight');
	}
	const relativePath = `${preflight.runDirectory}/report.json`;
	await writeJsonExclusive(workspacePath(workspaceRoot, relativePath), report);
	return relativePath;
}
