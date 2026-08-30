import { lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import { z } from 'zod';

import {
	CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH,
	verifyConcurrencySentinelActivationReceipt
} from './activate-concurrency-sentinels.js';
import { AffinityWaveDispatchGateSchema } from './affinity-wave-scheduler-lib.js';
import {
	AFFINITY_WAVE_ALLOCATION_V2_PATH,
	EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256,
	AffinityWaveAllocationV2Schema,
	AffinityWaveWorkloadIdV2Schema,
	canonicalJsonSha256V2,
	type AffinityWaveAllocationJobV2,
	type AffinityWaveWorkloadIdV2
} from './affinity-wave-allocation-v2.js';
import {
	AFFINITY_WAVE_EXPERIMENT_ROOT,
	AffinityWavePlanV2Schema,
	type AffinityWavePlanV2
} from './affinity-wave-plan-v2.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const GATE_ROOT = `${AFFINITY_WAVE_EXPERIMENT_ROOT}/review/gates/`;
const MATERIALIZED_PLAN_ROOT = `${AFFINITY_WAVE_EXPERIMENT_ROOT}/review/wave-plans/materialized`;

interface LoadedJson {
	readonly value: unknown;
	readonly canonicalSha256: string;
}

export interface MaterializeAffinityWavePlanOptions {
	readonly workspaceRoot?: string;
	readonly allocationPath: string;
	readonly allocationCanonicalSha256: string;
	readonly workloadId: string;
	readonly gatePath: string;
	readonly gateCanonicalSha256: string;
	readonly runId: string;
	readonly readJson?: (workspaceRoot: string, repositoryPath: string) => Promise<LoadedJson>;
	readonly verifySentinelReceipt?: typeof verifyConcurrencySentinelActivationReceipt;
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
	)
		throw new Error(`Unsafe repository path: ${repositoryPath}`);
	const root = path.resolve(workspaceRoot);
	const resolved = path.resolve(root, repositoryPath);
	if (!resolved.startsWith(`${root}${path.sep}`))
		throw new Error(`Repository path escapes workspace: ${repositoryPath}`);
	return resolved;
}

async function assertNoSymlinkAncestor(workspaceRoot: string, repositoryPath: string) {
	const root = path.resolve(workspaceRoot);
	let cursor = root;
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink())
				throw new Error(`Unsafe symlink path: ${path.relative(root, cursor)}`);
			if (
				cursor !== resolveRepositoryPath(workspaceRoot, repositoryPath) &&
				!metadata.isDirectory()
			)
				throw new Error(`Unsafe non-directory ancestor: ${path.relative(root, cursor)}`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
	}
}

async function exists(absolutePath: string): Promise<boolean> {
	try {
		await lstat(absolutePath);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function defaultReadJson(workspaceRoot: string, repositoryPath: string): Promise<LoadedJson> {
	await assertNoSymlinkAncestor(workspaceRoot, repositoryPath);
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() || metadata.isSymbolicLink())
		throw new Error(`Expected regular JSON file: ${repositoryPath}`);
	const value: unknown = JSON.parse(await readFile(absolute, 'utf8'));
	return { value, canonicalSha256: canonicalJsonSha256V2(value) };
}

function assertExpectedHash(label: string, expected: string, observed: string) {
	HashSchema.parse(expected);
	if (expected !== observed) throw new Error(`${label} canonical hash mismatch.`);
}

function assertTargetMatchesAllocation(
	target: z.infer<typeof ImageProductionTargetSchema>,
	job: AffinityWaveAllocationJobV2
) {
	for (const [label, actual, expected] of [
		['species', target.speciesId, job.speciesId],
		['affinity', target.affinity, job.affinity],
		['cohort', target.cohort, job.cohort],
		['candidate output', target.output.candidatePath, job.candidatePath],
		['result output', target.output.resultPath, job.resultPath]
	] as const)
		if (actual !== expected)
			throw new Error(`${job.key} ${label} differs from the reviewed allocation.`);
}

function assertAssignmentMatchesTarget(
	assignment: z.infer<typeof ImageProductionAssignmentSchema>,
	target: z.infer<typeof ImageProductionTargetSchema>,
	jobKey: string
) {
	if (assignment.targetId !== target.targetId)
		throw new Error(`${jobKey} assignment targets a different target ID.`);
	if (assignment.dryRun)
		throw new Error(`${jobKey} assignment is a dry run and is not executable.`);
	if (
		assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
		assignment.permittedOutputs.resultPath !== target.output.resultPath
	)
		throw new Error(`${jobKey} assignment outputs differ from its target.`);
}

async function verifyCurrentGate(
	workspaceRoot: string,
	gatePath: string,
	expectedHash: string,
	workloadId: AffinityWaveWorkloadIdV2,
	stage: AffinityWavePlanV2['stage'],
	readJson: NonNullable<MaterializeAffinityWavePlanOptions['readJson']>
) {
	if (!gatePath.startsWith(GATE_ROOT) || !gatePath.endsWith('.json'))
		throw new Error(`Dispatch gate must be a JSON artifact under ${GATE_ROOT}`);
	const loaded = await readJson(workspaceRoot, gatePath);
	assertExpectedHash('Dispatch gate', expectedHash, loaded.canonicalSha256);
	const gate = AffinityWaveDispatchGateSchema.parse(loaded.value);
	if (gate.authorizedStage !== stage)
		throw new Error(`Dispatch gate authorizes ${gate.authorizedStage}, not ${stage}.`);
	const derivation = gate.derivation;
	const profileMatches =
		workloadId === 'final-canary'
			? derivation.profile === 'final-canary'
			: workloadId === 'breadth-canary'
				? derivation.profile === 'breadth-canary'
				: workloadId === 'breadth'
					? derivation.profile === 'breadth'
					: derivation.profile === 'load' &&
						derivation.requestedConcurrency ===
							(
								{
									'final-pilot': 4,
									'final-controlled-a': 6,
									'final-controlled-b': 6,
									'final-controlled-c': 6,
									load: 12,
									scale: 16
								} as const
							)[workloadId];
	if (!profileMatches)
		throw new Error(`Dispatch gate derivation does not authorize workload ${workloadId}.`);
	for (const binding of gate.evidenceBindings) {
		const evidence = await readJson(workspaceRoot, binding.path);
		assertExpectedHash(
			`Dispatch gate evidence ${binding.path}`,
			binding.canonicalSha256,
			evidence.canonicalSha256
		);
	}
	return gate;
}

async function verifyCurrentSentinelReceipt(
	workspaceRoot: string,
	allocationHash: string,
	jobs: readonly AffinityWaveAllocationJobV2[],
	manifestHashes: ReadonlyMap<string, string>,
	verifyReceipt: typeof verifyConcurrencySentinelActivationReceipt,
	readJson: NonNullable<MaterializeAffinityWavePlanOptions['readJson']>
) {
	const verification = await verifyReceipt(workspaceRoot);
	if (!verification.valid || !verification.receipt)
		throw new Error(
			`Future-sentinel jobs require a valid current activation receipt: ${verification.issues.join('; ')}`
		);
	const receipt = verification.receipt;
	if (receipt.bindings.allocationCanonicalSha256 !== allocationHash)
		throw new Error('Concurrency-sentinel receipt is stale against the reviewed allocation.');
	const artifacts = new Map(
		receipt.artifacts.map((artifact) => [artifact.livePath, artifact.canonicalSha256])
	);
	for (const job of jobs.filter(({ manifestState }) => manifestState === 'future-sentinel'))
		for (const repositoryPath of [job.targetPath, job.assignmentPath])
			if (artifacts.get(repositoryPath) !== manifestHashes.get(repositoryPath))
				throw new Error(
					`Concurrency-sentinel receipt does not bind current manifest ${repositoryPath}.`
				);
	const loadedReceipt = await readJson(workspaceRoot, CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH);
	return {
		artifactPath: CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH,
		canonicalSha256: loadedReceipt.canonicalSha256
	};
}

export async function buildCurrentAffinityWavePlan(
	options: MaterializeAffinityWavePlanOptions
): Promise<AffinityWavePlanV2> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	if (options.allocationPath !== AFFINITY_WAVE_ALLOCATION_V2_PATH)
		throw new Error(`Allocation must be the reviewed artifact ${AFFINITY_WAVE_ALLOCATION_V2_PATH}`);
	if (options.allocationCanonicalSha256 !== EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256)
		throw new Error('Allocation input hash must equal the reviewed allocation v2 hash.');
	const workloadId = AffinityWaveWorkloadIdV2Schema.parse(options.workloadId);
	const runId = SlugSchema.parse(options.runId);
	const readJson = options.readJson ?? defaultReadJson;
	const loadedAllocation = await readJson(workspaceRoot, options.allocationPath);
	assertExpectedHash(
		'Allocation',
		options.allocationCanonicalSha256,
		loadedAllocation.canonicalSha256
	);
	const allocation = AffinityWaveAllocationV2Schema.parse(loadedAllocation.value);
	const workload = allocation.workloads.find((entry) => entry.workloadId === workloadId);
	if (!workload) throw new Error(`Reviewed allocation has no ${workloadId} workload.`);
	await verifyCurrentGate(
		workspaceRoot,
		options.gatePath,
		options.gateCanonicalSha256,
		workloadId,
		workload.stage,
		readJson
	);

	const manifestHashes = new Map<string, string>();
	const jobs = [];
	for (const allocationJob of workload.jobs) {
		const [targetLoad, assignmentLoad] = await Promise.all([
			readJson(workspaceRoot, allocationJob.targetPath),
			readJson(workspaceRoot, allocationJob.assignmentPath)
		]);
		const target = ImageProductionTargetSchema.parse(targetLoad.value);
		const assignment = ImageProductionAssignmentSchema.parse(assignmentLoad.value);
		assertTargetMatchesAllocation(target, allocationJob);
		assertAssignmentMatchesTarget(assignment, target, allocationJob.key);
		manifestHashes.set(allocationJob.targetPath, targetLoad.canonicalSha256);
		manifestHashes.set(allocationJob.assignmentPath, assignmentLoad.canonicalSha256);
		jobs.push({
			allocationJobKey: allocationJob.key,
			manifestState: allocationJob.manifestState,
			targetPath: allocationJob.targetPath,
			targetCanonicalSha256: targetLoad.canonicalSha256,
			assignmentPath: allocationJob.assignmentPath,
			assignmentCanonicalSha256: assignmentLoad.canonicalSha256
		});
	}

	const hasFutureSentinels = workload.jobs.some((job) => job.manifestState === 'future-sentinel');
	const concurrencySentinelActivationReceipt = hasFutureSentinels
		? await verifyCurrentSentinelReceipt(
				workspaceRoot,
				allocation.sourceAllocationV1.canonicalSha256,
				workload.jobs,
				manifestHashes,
				options.verifySentinelReceipt ?? verifyConcurrencySentinelActivationReceipt,
				readJson
			)
		: null;

	return AffinityWavePlanV2Schema.parse({
		schemaVersion: 'affinity-wave-plan-v2',
		runId,
		experimentId: 'affinity-workflow-v1',
		workloadId,
		stage: workload.stage,
		requestedConcurrency: workload.requestedConcurrency,
		reservedOrchestratorSlots: 1,
		requireExactConcurrency: true,
		runDirectory: `${AFFINITY_WAVE_EXPERIMENT_ROOT}/wave-runs/${runId}`,
		stopRules: {
			capacityFailureLimit: 3,
			stopOnOutputCollision: true,
			retryCapacityFailuresInWave: false
		},
		allocation: {
			artifactPath: options.allocationPath,
			canonicalSha256: loadedAllocation.canonicalSha256,
			allocationId: allocation.allocationId
		},
		dispatchGate: {
			artifactPath: options.gatePath,
			canonicalSha256: options.gateCanonicalSha256
		},
		concurrencySentinelActivationReceipt,
		jobs
	});
}

export async function materializeAffinityWavePlan(options: MaterializeAffinityWavePlanOptions) {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const plan = await buildCurrentAffinityWavePlan({ ...options, workspaceRoot });
	const outputPath = `${MATERIALIZED_PLAN_ROOT}/${plan.runId}.json`;
	const runDirectory = resolveRepositoryPath(workspaceRoot, plan.runDirectory);
	if (await exists(runDirectory)) throw new Error(`Run ID is not fresh: ${plan.runDirectory}`);
	await assertNoSymlinkAncestor(workspaceRoot, outputPath);
	const absoluteOutput = resolveRepositoryPath(workspaceRoot, outputPath);
	await mkdir(path.dirname(absoluteOutput), { recursive: true });
	const serialized = await format(JSON.stringify(plan), {
		filepath: outputPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
	let handle;
	try {
		handle = await open(absoluteOutput, 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST')
			throw new Error(`Wave plan already exists: ${outputPath}`);
		throw error;
	}
	try {
		await handle.writeFile(serialized);
		await handle.sync();
	} finally {
		await handle.close();
	}
	return { outputPath, canonicalSha256: canonicalJsonSha256V2(plan), plan };
}

export function parseMaterializeAffinityWavePlanArgs(args: readonly string[]) {
	const values = new Map<string, string>();
	let separatorSeen = false;
	const names = new Set([
		'--allocation',
		'--allocation-sha256',
		'--workload',
		'--gate',
		'--gate-sha256',
		'--run-id'
	]);
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === '--') {
			if (separatorSeen) throw new Error('Specify at most one -- argument separator.');
			separatorSeen = true;
			continue;
		}
		if (!names.has(argument)) throw new Error(`Unknown argument: ${argument}`);
		if (values.has(argument)) throw new Error(`Specify ${argument} exactly once.`);
		const value = args[index + 1];
		if (!value || value.startsWith('--')) throw new Error(`Specify ${argument} <value>.`);
		values.set(argument, value);
		index += 1;
	}
	for (const name of names)
		if (!values.has(name)) throw new Error(`Missing required option ${name}`);
	return {
		allocationPath: values.get('--allocation')!,
		allocationCanonicalSha256: values.get('--allocation-sha256')!,
		workloadId: values.get('--workload')!,
		gatePath: values.get('--gate')!,
		gateCanonicalSha256: values.get('--gate-sha256')!,
		runId: values.get('--run-id')!
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const summary = await materializeAffinityWavePlan({
			...parseMaterializeAffinityWavePlanArgs(process.argv.slice(2))
		});
		process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
