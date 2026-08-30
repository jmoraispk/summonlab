import { createHash } from 'node:crypto';
import path from 'node:path';

import {
	ImageProductionAffinitySchema,
	ImageProductionSpeciesSchema
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

export const AFFINITY_WAVE_ALLOCATION_V1_PATH =
	'assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/exact-concurrency-final-and-breadth-v1.json' as const;
export const AFFINITY_WAVE_ALLOCATION_V2_PATH =
	'assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/exact-concurrency-final-and-breadth-v2.json' as const;
export const EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256 =
	'88e2525fb10c1cc6f7c8749d461cf3730e0c5d904b2514d500b5c4d3638222f1' as const;
export const FINAL_CONTROLLED_RERUN_PLAN_PATH =
	'assets/enemies/experiments/affinity-workflow-v1/review/final-controlled-rerun-plan.json' as const;

const EXPERIMENT_ROOT = 'assets/enemies/experiments/affinity-workflow-v1' as const;
const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
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
		{ message: 'Repository paths must be contained' }
	);

const StageSchema = z.enum(['canary', 'pilot', 'controlled', 'breadth', 'load', 'scale']);
const ManifestStateSchema = z.enum([
	'gated-final-controlled',
	'live-unexecuted-breadth',
	'future-sentinel'
]);

export const AffinityWaveWorkloadIdV2Schema = z.enum([
	'final-canary',
	'final-pilot',
	'final-controlled-a',
	'final-controlled-b',
	'final-controlled-c',
	'breadth-canary',
	'breadth',
	'load',
	'scale'
]);

export type AffinityWaveWorkloadIdV2 = z.infer<typeof AffinityWaveWorkloadIdV2Schema>;

export const AFFINITY_WAVE_WORKLOAD_REQUIREMENTS_V2 = {
	'final-canary': { stage: 'canary', concurrency: 2 },
	'final-pilot': { stage: 'pilot', concurrency: 4 },
	'final-controlled-a': { stage: 'controlled', concurrency: 6 },
	'final-controlled-b': { stage: 'controlled', concurrency: 6 },
	'final-controlled-c': { stage: 'controlled', concurrency: 6 },
	'breadth-canary': { stage: 'canary', concurrency: 2 },
	breadth: { stage: 'breadth', concurrency: 8 },
	load: { stage: 'load', concurrency: 12 },
	scale: { stage: 'scale', concurrency: 16 }
} as const satisfies Record<
	AffinityWaveWorkloadIdV2,
	{ readonly stage: z.infer<typeof StageSchema>; readonly concurrency: number }
>;

const EXPECTED_PREREQUISITE_GATES = {
	'final-canary': ['final-controlled-activation'],
	'final-pilot': ['final-controlled-canary-pass'],
	'final-controlled-a': ['final-controlled-pilot-pass'],
	'final-controlled-b': ['final-controlled-wave-a-pass'],
	'final-controlled-c': ['final-controlled-wave-b-pass'],
	'breadth-canary': ['final-controlled-human-pass'],
	breadth: ['final-controlled-human-pass', 'breadth-canary-pass'],
	load: ['breadth-eight-pass'],
	scale: ['load-twelve-pass', 'scale-capacity-preflight']
} as const satisfies Record<AffinityWaveWorkloadIdV2, readonly string[]>;

const EXPECTED_GATE_IDS = [
	'final-controlled-activation',
	'final-controlled-canary-pass',
	'final-controlled-pilot-pass',
	'final-controlled-wave-a-pass',
	'final-controlled-wave-b-pass',
	'final-controlled-human-pass',
	'breadth-canary-pass',
	'breadth-eight-pass',
	'load-twelve-pass',
	'scale-capacity-preflight'
] as const;

const EXPECTED_GATE_EVIDENCE = {
	'final-controlled-activation': {
		status: 'blocked',
		paths: [
			`${EXPERIMENT_ROOT}/review/blind-review.json`,
			`${EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`
		]
	},
	'final-controlled-canary-pass': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/final-controlled-canary-v1/report.json`]
	},
	'final-controlled-pilot-pass': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/final-controlled-pilot-v1/report.json`]
	},
	'final-controlled-wave-a-pass': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/final-controlled-wave-a-v1/report.json`]
	},
	'final-controlled-wave-b-pass': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/final-controlled-wave-b-v1/report.json`]
	},
	'final-controlled-human-pass': {
		status: 'pending',
		paths: [
			`${EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`,
			`${EXPERIMENT_ROOT}/review/blind-review.json`
		]
	},
	'breadth-canary-pass': {
		status: 'pending',
		paths: [
			`${EXPERIMENT_ROOT}/results/goblin-normal-v1.json`,
			`${EXPERIMENT_ROOT}/results/tunnel-boar-fire-v1.json`
		]
	},
	'breadth-eight-pass': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/breadth-exact-eight-v1/report.json`]
	},
	'load-twelve-pass': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/load-exact-twelve-v1/report.json`]
	},
	'scale-capacity-preflight': {
		status: 'pending',
		paths: [`${EXPERIMENT_ROOT}/wave-runs/scale-exact-sixteen-v1/preflight.json`]
	}
} as const satisfies Record<
	(typeof EXPECTED_GATE_IDS)[number],
	{ readonly status: 'blocked' | 'pending'; readonly paths: readonly string[] }
>;

const AllocationJobSchema = z
	.object({
		key: SlugSchema,
		speciesId: ImageProductionSpeciesSchema,
		affinity: ImageProductionAffinitySchema,
		version: z.string().regex(/^v[1-9][0-9]*$/u),
		cohort: z.enum(['controlled', 'breadth', 'regression']),
		manifestState: ManifestStateSchema,
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

const LegacyStageSchema = z
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
	.strict();

export const AffinityWaveAllocationV1SourceSchema = z
	.object({
		schemaVersion: z.literal('affinity-wave-allocation-v1'),
		allocationId: z.literal('exact-concurrency-final-and-breadth-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('gated'),
		executable: z.literal(false),
		purpose: z.string().trim().min(1),
		futureSentinelCount: z.literal(14),
		gates: z.array(AllocationGateSchema).min(1),
		stages: z.array(LegacyStageSchema).length(6)
	})
	.strict();

const FinalControlledPlanTargetSchema = z
	.object({
		key: SlugSchema,
		speciesId: z.enum(['death-knight', 'elemental', 'grey-wolf', 'cave-bear']),
		affinity: z.enum(['normal', 'wood', 'fire', 'metal', 'water', 'wind']),
		version: z.enum(['v3', 'v4'])
	})
	.strict();

export const FinalControlledPlanAllocationSourceSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-rerun-plan-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		targetCount: z.literal(24),
		targets: z.array(FinalControlledPlanTargetSchema).length(24)
	})
	.passthrough()
	.superRefine((plan, context) => {
		const keys = plan.targets.map((target) => target.key);
		if (new Set(keys).size !== keys.length)
			context.addIssue({
				code: 'custom',
				path: ['targets'],
				message: 'Final-controlled plan target keys must be unique'
			});
		for (const [index, target] of plan.targets.entries()) {
			if (target.key !== `${target.speciesId}-${target.affinity}-${target.version}`)
				context.addIssue({
					code: 'custom',
					path: ['targets', index, 'key'],
					message: 'Final-controlled target key must equal its coordinate and version'
				});
			const expectedVersion = ['death-knight', 'elemental'].includes(target.speciesId)
				? 'v4'
				: 'v3';
			if (target.version !== expectedVersion)
				context.addIssue({
					code: 'custom',
					path: ['targets', index, 'version'],
					message: `${target.speciesId} final-controlled targets must use ${expectedVersion}`
				});
		}
	});

const WorkloadSchema = z
	.object({
		workloadId: AffinityWaveWorkloadIdV2Schema,
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
		jobs: z.array(AllocationJobSchema).min(1).max(16)
	})
	.strict();

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (value !== null && typeof value === 'object')
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([key, child]) => [key, canonicalize(child)])
		);
	return value;
}

export function canonicalJsonSha256V2(value: unknown): string {
	return createHash('sha256')
		.update(JSON.stringify(canonicalize(value)))
		.digest('hex');
}

function coordinate(job: z.infer<typeof AllocationJobSchema>): string {
	return `${job.speciesId}-${job.affinity}-${job.version}`;
}

function expectedJobShape(job: z.infer<typeof AllocationJobSchema>) {
	if (job.manifestState === 'gated-final-controlled')
		return {
			cohort: 'controlled',
			targetPath: `${EXPERIMENT_ROOT}/targets/final-controlled/${job.speciesId}/${job.affinity}-${job.version}.json`,
			assignmentPath: `${EXPERIMENT_ROOT}/assignments/final-controlled/${job.speciesId}/${job.affinity}-${job.version}.json`,
			candidatePath: `${EXPERIMENT_ROOT}/candidates/final-controlled/${job.speciesId}/${job.affinity}-${job.version}.png`,
			resultPath: `${EXPERIMENT_ROOT}/results/final-controlled/${job.speciesId}-${job.affinity}-${job.version}.json`
		} as const;
	if (job.manifestState === 'live-unexecuted-breadth')
		return {
			cohort: 'breadth',
			targetPath: `${EXPERIMENT_ROOT}/targets/${job.speciesId}/${job.affinity}.json`,
			assignmentPath: `${EXPERIMENT_ROOT}/assignments/${job.speciesId}/${job.affinity}.json`,
			candidatePath: `${EXPERIMENT_ROOT}/candidates/${job.speciesId}/${job.affinity}-v1.png`,
			resultPath: `${EXPERIMENT_ROOT}/results/${job.speciesId}-${job.affinity}-v1.json`
		} as const;
	return {
		cohort: 'regression',
		targetPath: `${EXPERIMENT_ROOT}/targets/concurrency-sentinels/${job.speciesId}/${job.affinity}-${job.version}.json`,
		assignmentPath: `${EXPERIMENT_ROOT}/assignments/concurrency-sentinels/${job.speciesId}/${job.affinity}-${job.version}.json`,
		candidatePath: `${EXPERIMENT_ROOT}/candidates/concurrency-sentinels/${job.speciesId}/${job.affinity}-${job.version}.png`,
		resultPath: `${EXPERIMENT_ROOT}/results/concurrency-sentinels/${job.speciesId}-${job.affinity}-${job.version}.json`
	} as const;
}

function sorted(values: readonly string[]): string[] {
	return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
	return JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
}

const EXPECTED_FINAL_COORDINATES = (
	[
		['death-knight', 'v4'],
		['elemental', 'v4'],
		['grey-wolf', 'v3'],
		['cave-bear', 'v3']
	] as const
).flatMap(([speciesId, version]) =>
	(['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const).map(
		(affinity) => `${speciesId}-${affinity}-${version}`
	)
);

export const AffinityWaveAllocationV2Schema = z
	.object({
		schemaVersion: z.literal('affinity-wave-allocation-v2'),
		allocationId: z.literal('exact-concurrency-final-and-breadth-v2'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('gated'),
		executable: z.literal(false),
		purpose: z.string().trim().min(1),
		sourceFinalControlledPlan: z
			.object({
				path: z.literal(FINAL_CONTROLLED_RERUN_PLAN_PATH),
				canonicalSha256: HashSchema
			})
			.strict(),
		sourceAllocationV1: z
			.object({
				path: z.literal(AFFINITY_WAVE_ALLOCATION_V1_PATH),
				canonicalSha256: HashSchema
			})
			.strict(),
		futureSentinelCount: z.literal(14),
		gates: z.array(AllocationGateSchema).length(EXPECTED_GATE_IDS.length),
		workloads: z.array(WorkloadSchema).length(9)
	})
	.strict()
	.superRefine((allocation, context) => {
		const gateIds = allocation.gates.map((gate) => gate.gateId);
		if (!sameStrings(gateIds, EXPECTED_GATE_IDS))
			context.addIssue({
				code: 'custom',
				path: ['gates'],
				message: 'Allocation must contain the exact v2 gate set'
			});
		for (const [index, gate] of allocation.gates.entries()) {
			const expected = EXPECTED_GATE_EVIDENCE[gate.gateId as keyof typeof EXPECTED_GATE_EVIDENCE];
			if (
				!expected ||
				gate.status !== expected.status ||
				!sameStrings(gate.evidencePaths, expected.paths)
			)
				context.addIssue({
					code: 'custom',
					path: ['gates', index],
					message: `${gate.gateId} has invalid status or evidence paths`
				});
		}

		const workloadIds = allocation.workloads.map((workload) => workload.workloadId);
		if (!sameStrings(workloadIds, AffinityWaveWorkloadIdV2Schema.options))
			context.addIssue({
				code: 'custom',
				path: ['workloads'],
				message: 'Allocation must contain each workloadId exactly once'
			});

		for (const [index, workload] of allocation.workloads.entries()) {
			const expected = AFFINITY_WAVE_WORKLOAD_REQUIREMENTS_V2[workload.workloadId];
			if (
				workload.stage !== expected.stage ||
				workload.requestedConcurrency !== expected.concurrency ||
				workload.jobs.length !== expected.concurrency
			)
				context.addIssue({
					code: 'custom',
					path: ['workloads', index],
					message: `${workload.workloadId} must be ${expected.stage}-${expected.concurrency} with exactly ${expected.concurrency} jobs`
				});
			if (
				!sameStrings(workload.prerequisiteGateIds, EXPECTED_PREREQUISITE_GATES[workload.workloadId])
			)
				context.addIssue({
					code: 'custom',
					path: ['workloads', index, 'prerequisiteGateIds'],
					message: `${workload.workloadId} has an invalid prerequisite gate set`
				});
			for (const [jobIndex, job] of workload.jobs.entries()) {
				const expectedShape = expectedJobShape(job);
				for (const field of [
					'cohort',
					'targetPath',
					'assignmentPath',
					'candidatePath',
					'resultPath'
				] as const)
					if (job[field] !== expectedShape[field])
						context.addIssue({
							code: 'custom',
							path: ['workloads', index, 'jobs', jobIndex, field],
							message: `${field} does not match the coordinate-owned ${job.manifestState} path`
						});
				if (job.manifestState === 'live-unexecuted-breadth' && job.version !== 'v1')
					context.addIssue({
						code: 'custom',
						path: ['workloads', index, 'jobs', jobIndex, 'version'],
						message: 'Live breadth jobs must use v1'
					});
			}
		}

		const finalWorkloadIds = new Set<AffinityWaveWorkloadIdV2>([
			'final-canary',
			'final-pilot',
			'final-controlled-a',
			'final-controlled-b',
			'final-controlled-c'
		]);
		const finalJobs = allocation.workloads
			.filter((workload) => finalWorkloadIds.has(workload.workloadId))
			.flatMap((workload) => workload.jobs);
		if (
			finalJobs.some(
				(job) => job.manifestState !== 'gated-final-controlled' || job.cohort !== 'controlled'
			) ||
			!sameStrings(finalJobs.map(coordinate), EXPECTED_FINAL_COORDINATES)
		)
			context.addIssue({
				code: 'custom',
				path: ['workloads'],
				message: 'The five final workloads must partition the exact 24-coordinate final matrix'
			});

		const breadthCanary = allocation.workloads.find(
			(workload) => workload.workloadId === 'breadth-canary'
		);
		if (
			!breadthCanary ||
			!sameStrings(breadthCanary.jobs.map(coordinate), [
				'goblin-normal-v1',
				'tunnel-boar-fire-v1'
			]) ||
			breadthCanary.jobs.some((job) => job.manifestState !== 'live-unexecuted-breadth')
		)
			context.addIssue({
				code: 'custom',
				path: ['workloads'],
				message: 'Breadth canary must be exactly Goblin Normal and Tunnel Boar Fire'
			});
		for (const [workloadId, expectedBreadthCount, expectedSentinelCount] of [
			['breadth', 8, 0],
			['load', 6, 6],
			['scale', 8, 8]
		] as const) {
			const jobs =
				allocation.workloads.find((workload) => workload.workloadId === workloadId)?.jobs ?? [];
			const breadthCount = jobs.filter(
				(job) => job.manifestState === 'live-unexecuted-breadth'
			).length;
			const sentinelCount = jobs.filter((job) => job.manifestState === 'future-sentinel').length;
			if (breadthCount !== expectedBreadthCount || sentinelCount !== expectedSentinelCount)
				context.addIssue({
					code: 'custom',
					path: ['workloads'],
					message: `${workloadId} must contain exactly ${expectedBreadthCount} breadth and ${expectedSentinelCount} sentinel jobs`
				});
		}

		const jobs = allocation.workloads.flatMap((workload) => workload.jobs);
		for (const [label, values] of [
			['job keys', jobs.map((job) => job.key)],
			['target paths', jobs.map((job) => job.targetPath)],
			['assignment paths', jobs.map((job) => job.assignmentPath)],
			['candidate paths', jobs.map((job) => job.candidatePath)],
			['result paths', jobs.map((job) => job.resultPath)]
		] as const)
			if (new Set(values).size !== values.length)
				context.addIssue({
					code: 'custom',
					path: ['workloads'],
					message: `Allocation has duplicate ${label}`
				});

		const sentinels = jobs.filter((job) => job.manifestState === 'future-sentinel');
		if (sentinels.length !== allocation.futureSentinelCount)
			context.addIssue({
				code: 'custom',
				path: ['futureSentinelCount'],
				message: `Allocation requires exactly 14 future sentinels; found ${sentinels.length}`
			});
		if (new Set(sentinels.map(coordinate)).size !== sentinels.length)
			context.addIssue({
				code: 'custom',
				path: ['workloads'],
				message: 'Future sentinel coordinates must be unique'
			});

		const scaleJobs =
			allocation.workloads.find((workload) => workload.workloadId === 'scale')?.jobs ?? [];
		for (const speciesId of ImageProductionSpeciesSchema.options) {
			const count = scaleJobs.filter((job) => job.speciesId === speciesId).length;
			if (count !== 2)
				context.addIssue({
					code: 'custom',
					path: ['workloads'],
					message: `Scale workload requires exactly two ${speciesId} jobs; found ${count}`
				});
		}
		const affinityCounts = ImageProductionAffinitySchema.options.map(
			(affinity) => scaleJobs.filter((job) => job.affinity === affinity).length
		);
		if (Math.max(...affinityCounts) - Math.min(...affinityCounts) > 1)
			context.addIssue({
				code: 'custom',
				path: ['workloads'],
				message: 'Scale workload affinities must be distributed evenly'
			});
	});

export type AffinityWaveAllocationV2 = z.infer<typeof AffinityWaveAllocationV2Schema>;
export type AffinityWaveAllocationJobV2 = z.infer<typeof AllocationJobSchema>;

function finalJob(
	target: z.infer<typeof FinalControlledPlanTargetSchema>
): AffinityWaveAllocationJobV2 {
	return AllocationJobSchema.parse({
		key: `final-${target.key}`,
		speciesId: target.speciesId,
		affinity: target.affinity,
		version: target.version,
		cohort: 'controlled',
		manifestState: 'gated-final-controlled',
		targetPath: `${EXPERIMENT_ROOT}/targets/final-controlled/${target.speciesId}/${target.affinity}-${target.version}.json`,
		assignmentPath: `${EXPERIMENT_ROOT}/assignments/final-controlled/${target.speciesId}/${target.affinity}-${target.version}.json`,
		candidatePath: `${EXPERIMENT_ROOT}/candidates/final-controlled/${target.speciesId}/${target.affinity}-${target.version}.png`,
		resultPath: `${EXPERIMENT_ROOT}/results/final-controlled/${target.speciesId}-${target.affinity}-${target.version}.json`
	});
}

function breadthCanaryJob(
	speciesId: 'goblin' | 'tunnel-boar',
	affinity: 'normal' | 'fire'
): AffinityWaveAllocationJobV2 {
	return AllocationJobSchema.parse({
		key: `breadth-${speciesId}-${affinity}-v1`,
		speciesId,
		affinity,
		version: 'v1',
		cohort: 'breadth',
		manifestState: 'live-unexecuted-breadth',
		targetPath: `${EXPERIMENT_ROOT}/targets/${speciesId}/${affinity}.json`,
		assignmentPath: `${EXPERIMENT_ROOT}/assignments/${speciesId}/${affinity}.json`,
		candidatePath: `${EXPERIMENT_ROOT}/candidates/${speciesId}/${affinity}-v1.png`,
		resultPath: `${EXPERIMENT_ROOT}/results/${speciesId}-${affinity}-v1.json`
	});
}

const FINAL_WORKLOAD_COORDINATES = {
	'final-canary': ['death-knight-normal-v4', 'death-knight-fire-v4'],
	'final-pilot': [
		'death-knight-wood-v4',
		'death-knight-metal-v4',
		'death-knight-water-v4',
		'death-knight-wind-v4'
	],
	'final-controlled-a': [
		'elemental-normal-v4',
		'elemental-wood-v4',
		'grey-wolf-fire-v3',
		'grey-wolf-metal-v3',
		'cave-bear-water-v3',
		'cave-bear-wind-v3'
	],
	'final-controlled-b': [
		'elemental-fire-v4',
		'elemental-metal-v4',
		'grey-wolf-water-v3',
		'grey-wolf-wind-v3',
		'cave-bear-normal-v3',
		'cave-bear-wood-v3'
	],
	'final-controlled-c': [
		'elemental-water-v4',
		'elemental-wind-v4',
		'grey-wolf-normal-v3',
		'grey-wolf-wood-v3',
		'cave-bear-fire-v3',
		'cave-bear-metal-v3'
	]
} as const;

function legacyStage(
	legacy: z.infer<typeof AffinityWaveAllocationV1SourceSchema>,
	stage: 'breadth' | 'load' | 'scale'
) {
	const found = legacy.stages.find((candidate) => candidate.stage === stage);
	if (!found) throw new Error(`The v1 source allocation is missing its ${stage} stage.`);
	return found;
}

function legacyGate(legacy: z.infer<typeof AffinityWaveAllocationV1SourceSchema>, gateId: string) {
	const found = legacy.gates.find((candidate) => candidate.gateId === gateId);
	if (!found) throw new Error(`The v1 source allocation is missing gate ${gateId}.`);
	return found;
}

export function assertFinalWorkloadsMatchPlan(
	allocation: AffinityWaveAllocationV2,
	planInput: unknown
): void {
	const plan = FinalControlledPlanAllocationSourceSchema.parse(planInput);
	const expected = plan.targets.map((target) => target.key);
	const finalIds = new Set<AffinityWaveWorkloadIdV2>([
		'final-canary',
		'final-pilot',
		'final-controlled-a',
		'final-controlled-b',
		'final-controlled-c'
	]);
	const actual = allocation.workloads
		.filter((workload) => finalIds.has(workload.workloadId))
		.flatMap((workload) => workload.jobs)
		.map(coordinate);
	if (!sameStrings(actual, expected))
		throw new Error('The v2 final workloads do not equal the current final-controlled rerun plan.');
}

export function buildAffinityWaveAllocationV2(input: {
	readonly finalPlan: unknown;
	readonly finalPlanCanonicalSha256: string;
	readonly legacyAllocation: unknown;
	readonly legacyAllocationCanonicalSha256: string;
}): AffinityWaveAllocationV2 {
	HashSchema.parse(input.finalPlanCanonicalSha256);
	HashSchema.parse(input.legacyAllocationCanonicalSha256);
	const plan = FinalControlledPlanAllocationSourceSchema.parse(input.finalPlan);
	const legacy = AffinityWaveAllocationV1SourceSchema.parse(input.legacyAllocation);
	const targets = new Map(plan.targets.map((target) => [target.key, target] as const));
	const finalWorkload = (workloadId: keyof typeof FINAL_WORKLOAD_COORDINATES) => ({
		workloadId,
		stage: AFFINITY_WAVE_WORKLOAD_REQUIREMENTS_V2[workloadId].stage,
		requestedConcurrency: AFFINITY_WAVE_WORKLOAD_REQUIREMENTS_V2[workloadId].concurrency,
		executable: false as const,
		prerequisiteGateIds: [...EXPECTED_PREREQUISITE_GATES[workloadId]],
		jobs: FINAL_WORKLOAD_COORDINATES[workloadId].map((key) => {
			const target = targets.get(key);
			if (!target) throw new Error(`The final-controlled plan is missing ${key}.`);
			return finalJob(target);
		})
	});
	const breadth = legacyStage(legacy, 'breadth');
	const load = legacyStage(legacy, 'load');
	const scale = legacyStage(legacy, 'scale');
	const allocation = AffinityWaveAllocationV2Schema.parse({
		schemaVersion: 'affinity-wave-allocation-v2',
		allocationId: 'exact-concurrency-final-and-breadth-v2',
		experimentId: 'affinity-workflow-v1',
		status: 'gated',
		executable: false,
		purpose:
			'Reserve collision-free named workloads for all 24 final-controlled targets, breadth canaries, and exact 8/12/16 evidence without authorizing manifests, preflights, dispatch, image generation, or human-gate bypass.',
		sourceFinalControlledPlan: {
			path: FINAL_CONTROLLED_RERUN_PLAN_PATH,
			canonicalSha256: input.finalPlanCanonicalSha256
		},
		sourceAllocationV1: {
			path: AFFINITY_WAVE_ALLOCATION_V1_PATH,
			canonicalSha256: input.legacyAllocationCanonicalSha256
		},
		futureSentinelCount: 14,
		gates: [
			legacyGate(legacy, 'final-controlled-activation'),
			legacyGate(legacy, 'final-controlled-canary-pass'),
			legacyGate(legacy, 'final-controlled-pilot-pass'),
			{
				gateId: 'final-controlled-wave-a-pass',
				status: 'pending',
				description:
					'The exact first controlled six-worker workload must complete with eligible scheduler evidence before workload B.',
				evidencePaths: [`${EXPERIMENT_ROOT}/wave-runs/final-controlled-wave-a-v1/report.json`]
			},
			{
				gateId: 'final-controlled-wave-b-pass',
				status: 'pending',
				description:
					'The exact second controlled six-worker workload must complete with eligible scheduler evidence before workload C.',
				evidencePaths: [`${EXPERIMENT_ROOT}/wave-runs/final-controlled-wave-b-v1/report.json`]
			},
			legacyGate(legacy, 'final-controlled-human-pass'),
			legacyGate(legacy, 'breadth-canary-pass'),
			legacyGate(legacy, 'breadth-eight-pass'),
			legacyGate(legacy, 'load-twelve-pass'),
			legacyGate(legacy, 'scale-capacity-preflight')
		],
		workloads: [
			finalWorkload('final-canary'),
			finalWorkload('final-pilot'),
			finalWorkload('final-controlled-a'),
			finalWorkload('final-controlled-b'),
			finalWorkload('final-controlled-c'),
			{
				workloadId: 'breadth-canary',
				stage: 'canary',
				requestedConcurrency: 2,
				executable: false,
				prerequisiteGateIds: [...EXPECTED_PREREQUISITE_GATES['breadth-canary']],
				jobs: [breadthCanaryJob('goblin', 'normal'), breadthCanaryJob('tunnel-boar', 'fire')]
			},
			{
				workloadId: 'breadth',
				stage: breadth.stage,
				requestedConcurrency: breadth.requestedConcurrency,
				executable: false,
				prerequisiteGateIds: [...EXPECTED_PREREQUISITE_GATES.breadth],
				jobs: breadth.jobs
			},
			{
				workloadId: 'load',
				stage: load.stage,
				requestedConcurrency: load.requestedConcurrency,
				executable: false,
				prerequisiteGateIds: [...EXPECTED_PREREQUISITE_GATES.load],
				jobs: load.jobs
			},
			{
				workloadId: 'scale',
				stage: scale.stage,
				requestedConcurrency: scale.requestedConcurrency,
				executable: false,
				prerequisiteGateIds: [...EXPECTED_PREREQUISITE_GATES.scale],
				jobs: scale.jobs
			}
		]
	});
	assertFinalWorkloadsMatchPlan(allocation, plan);
	return allocation;
}
