import { createHash } from 'node:crypto';
import path from 'node:path';

import { z } from 'zod';

import {
	AFFINITY_WAVE_ALLOCATION_V2_PATH,
	AFFINITY_WAVE_WORKLOAD_REQUIREMENTS_V2,
	AffinityWaveWorkloadIdV2Schema
} from './affinity-wave-allocation-v2.js';

export const AFFINITY_WAVE_EXPERIMENT_ROOT =
	'assets/enemies/experiments/affinity-workflow-v1' as const;

export const AffinityWaveStageV2Schema = z.enum([
	'canary',
	'pilot',
	'controlled',
	'breadth',
	'load',
	'scale'
]);

export const AFFINITY_WAVE_STAGE_CONCURRENCY_V2 = {
	canary: 2,
	pilot: 4,
	controlled: 6,
	breadth: 8,
	load: 12,
	scale: 16
} as const;

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
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

const ArtifactPointerSchema = z
	.object({
		artifactPath: RepositoryPathSchema,
		canonicalSha256: HashSchema
	})
	.strict();

const AffinityWavePlanV2JobSchema = z
	.object({
		allocationJobKey: SlugSchema,
		manifestState: z.enum(['gated-final-controlled', 'live-unexecuted-breadth', 'future-sentinel']),
		targetPath: RepositoryPathSchema,
		targetCanonicalSha256: HashSchema,
		assignmentPath: RepositoryPathSchema,
		assignmentCanonicalSha256: HashSchema
	})
	.strict();

export const AffinityWavePlanV2Schema = z
	.object({
		schemaVersion: z.literal('affinity-wave-plan-v2'),
		runId: SlugSchema,
		experimentId: z.literal('affinity-workflow-v1'),
		stage: AffinityWaveStageV2Schema,
		workloadId: AffinityWaveWorkloadIdV2Schema,
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
		allocation: z
			.object({
				artifactPath: z.literal(AFFINITY_WAVE_ALLOCATION_V2_PATH),
				canonicalSha256: HashSchema,
				allocationId: z.literal('exact-concurrency-final-and-breadth-v2')
			})
			.strict(),
		dispatchGate: ArtifactPointerSchema,
		concurrencySentinelActivationReceipt: ArtifactPointerSchema.nullable(),
		jobs: z.array(AffinityWavePlanV2JobSchema).min(1).max(16)
	})
	.strict()
	.superRefine((plan, context) => {
		const workload = AFFINITY_WAVE_WORKLOAD_REQUIREMENTS_V2[plan.workloadId];
		if (plan.stage !== workload.stage)
			context.addIssue({
				code: 'custom',
				path: ['stage'],
				message: `${plan.workloadId} requires stage ${workload.stage}`
			});
		const expectedConcurrency = workload.concurrency;
		if (plan.requestedConcurrency !== expectedConcurrency)
			context.addIssue({
				code: 'custom',
				path: ['requestedConcurrency'],
				message: `${plan.workloadId} requires requested concurrency ${expectedConcurrency}`
			});
		if (plan.jobs.length !== expectedConcurrency)
			context.addIssue({
				code: 'custom',
				path: ['jobs'],
				message: `${plan.workloadId} requires exactly ${expectedConcurrency} allocation jobs`
			});
		const expectedDirectory = `${AFFINITY_WAVE_EXPERIMENT_ROOT}/wave-runs/${plan.runId}`;
		if (plan.runDirectory !== expectedDirectory)
			context.addIssue({
				code: 'custom',
				path: ['runDirectory'],
				message: `Run directory must be ${expectedDirectory}`
			});
		for (const [label, values] of [
			['allocation job keys', plan.jobs.map((job) => job.allocationJobKey)],
			['target paths', plan.jobs.map((job) => job.targetPath)],
			['assignment paths', plan.jobs.map((job) => job.assignmentPath)]
		] as const)
			if (new Set(values).size !== values.length)
				context.addIssue({
					code: 'custom',
					path: ['jobs'],
					message: `Plan has duplicate ${label}`
				});
		const hasFutureSentinels = plan.jobs.some((job) => job.manifestState === 'future-sentinel');
		if (hasFutureSentinels !== (plan.concurrencySentinelActivationReceipt !== null))
			context.addIssue({
				code: 'custom',
				path: ['concurrencySentinelActivationReceipt'],
				message: hasFutureSentinels
					? 'Future-sentinel jobs require an activation receipt binding'
					: 'A sentinel activation receipt is only valid for a stage containing future sentinels'
			});
	});

export type AffinityWavePlanV2 = z.infer<typeof AffinityWavePlanV2Schema>;
export type AffinityWaveStageV2 = z.infer<typeof AffinityWaveStageV2Schema>;

export interface BoundAffinityWavePlanV2 {
	readonly path: string;
	readonly canonicalSha256: string;
	readonly plan: AffinityWavePlanV2;
}

export function canonicalJsonSha256V2(value: unknown): string {
	const canonicalize = (input: unknown): unknown => {
		if (Array.isArray(input)) return input.map(canonicalize);
		if (input !== null && typeof input === 'object')
			return Object.fromEntries(
				Object.entries(input as Record<string, unknown>)
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([key, child]) => [key, canonicalize(child)])
			);
		return input;
	};
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(value)))
		.digest('hex');
}
