import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	AFFINITY_WAVE_ALLOCATION_V1_PATH,
	AFFINITY_WAVE_ALLOCATION_V2_PATH,
	AffinityWaveAllocationV2Schema,
	EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256,
	FINAL_CONTROLLED_RERUN_PLAN_PATH,
	assertFinalWorkloadsMatchPlan,
	buildAffinityWaveAllocationV2,
	canonicalJsonSha256V2,
	type AffinityWaveAllocationV2
} from './affinity-wave-allocation-v2.js';
import { exportAffinityWaveAllocationV2 } from './export-affinity-wave-allocation-v2.js';

const repositoryRoot = process.cwd();
const temporaryRoots: string[] = [];

async function json(repositoryPath: string): Promise<unknown> {
	return JSON.parse(
		await readFile(path.resolve(repositoryRoot, repositoryPath), 'utf8')
	) as unknown;
}

async function fixture(): Promise<{
	readonly allocation: AffinityWaveAllocationV2;
	readonly finalPlan: Record<string, unknown> & { targets: Array<Record<string, string>> };
	readonly legacy: Record<string, unknown> & {
		stages: Array<{ stage: string; jobs: unknown[] }>;
	};
}> {
	const finalPlan = (await json(FINAL_CONTROLLED_RERUN_PLAN_PATH)) as Record<string, unknown> & {
		targets: Array<Record<string, string>>;
	};
	const legacy = (await json(AFFINITY_WAVE_ALLOCATION_V1_PATH)) as Record<string, unknown> & {
		stages: Array<{ stage: string; jobs: unknown[] }>;
	};
	return {
		finalPlan,
		legacy,
		allocation: buildAffinityWaveAllocationV2({
			finalPlan,
			finalPlanCanonicalSha256: canonicalJsonSha256V2(finalPlan),
			legacyAllocation: legacy,
			legacyAllocationCanonicalSha256: canonicalJsonSha256V2(legacy)
		})
	};
}

type DeepMutable<T> = T extends readonly (infer Item)[]
	? DeepMutable<Item>[]
	: T extends object
		? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
		: T;

function clone(allocation: AffinityWaveAllocationV2): DeepMutable<AffinityWaveAllocationV2> {
	return structuredClone(allocation) as DeepMutable<AffinityWaveAllocationV2>;
}

function requiredWorkload(
	allocation: DeepMutable<AffinityWaveAllocationV2>,
	workloadId: AffinityWaveAllocationV2['workloads'][number]['workloadId']
) {
	const workload = allocation.workloads.find((candidate) => candidate.workloadId === workloadId);
	if (!workload) throw new Error(`Missing test workload ${workloadId}.`);
	return workload;
}

function issues(input: unknown): string[] {
	const parsed = AffinityWaveAllocationV2Schema.safeParse(input);
	if (parsed.success) return [];
	return parsed.error.issues.map((issue) => issue.message);
}

async function copySource(root: string, repositoryPath: string): Promise<void> {
	const destination = path.resolve(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(path.resolve(repositoryRoot, repositoryPath), destination);
}

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe('affinity wave allocation v2', () => {
	it('partitions all 24 final coordinates into five named workloads and preserves v1 breadth/load/scale jobs', async () => {
		const { allocation, finalPlan, legacy } = await fixture();
		expect(AffinityWaveAllocationV2Schema.parse(allocation)).toEqual(allocation);
		expect(allocation.workloads.map((workload) => workload.workloadId)).toEqual([
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
		assertFinalWorkloadsMatchPlan(allocation, finalPlan);
		expect(canonicalJsonSha256V2(allocation)).toBe(EXPECTED_AFFINITY_WAVE_ALLOCATION_V2_SHA256);
		for (const stage of ['breadth', 'load', 'scale'])
			expect(allocation.workloads.find((workload) => workload.workloadId === stage)?.jobs).toEqual(
				legacy.stages.find((candidate) => candidate.stage === stage)?.jobs
			);
		expect(
			allocation.workloads.find((workload) => workload.workloadId === 'breadth-canary')
		).toMatchObject({
			stage: 'canary',
			requestedConcurrency: 2,
			prerequisiteGateIds: ['final-controlled-human-pass'],
			jobs: [{ key: 'breadth-goblin-normal-v1' }, { key: 'breadth-tunnel-boar-fire-v1' }]
		});
	});

	it('rejects duplicate or missing workload identities', async () => {
		const { allocation } = await fixture();
		const duplicate = clone(allocation);
		requiredWorkload(duplicate, 'final-pilot').workloadId = 'final-canary';
		expect(issues(duplicate)).toContain('Allocation must contain each workloadId exactly once');

		const missing = clone(allocation);
		missing.workloads.pop();
		expect(AffinityWaveAllocationV2Schema.safeParse(missing).success).toBe(false);
	});

	it('rejects a coherent path set that silently changes one final version', async () => {
		const { allocation } = await fixture();
		const changed = clone(allocation);
		const job = requiredWorkload(changed, 'final-controlled-c').jobs[0]!;
		job.key = 'final-elemental-water-v3';
		job.version = 'v3';
		job.targetPath = job.targetPath.replaceAll('v4', 'v3');
		job.assignmentPath = job.assignmentPath.replaceAll('v4', 'v3');
		job.candidatePath = job.candidatePath.replaceAll('v4', 'v3');
		job.resultPath = job.resultPath.replaceAll('v4', 'v3');
		expect(issues(changed)).toContain(
			'The five final workloads must partition the exact 24-coordinate final matrix'
		);
	});

	it('rejects duplicate global ownership paths and keys across workloads', async () => {
		const { allocation } = await fixture();
		const changed = clone(allocation);
		const first = requiredWorkload(changed, 'final-canary').jobs[0]!;
		const second = requiredWorkload(changed, 'final-pilot').jobs[0]!;
		second.key = first.key;
		second.candidatePath = first.candidatePath;
		const messages = issues(changed);
		expect(messages).toContain('Allocation has duplicate job keys');
		expect(messages).toContain('Allocation has duplicate candidate paths');
	});

	it('rejects sentinel loss, invalid gates, wrong concurrency, and executable allocations', async () => {
		const { allocation } = await fixture();
		const missingSentinel = clone(allocation);
		const sentinel = requiredWorkload(missingSentinel, 'load').jobs.find(
			(job) => job.manifestState === 'future-sentinel'
		);
		if (!sentinel) throw new Error('Missing test sentinel.');
		sentinel.manifestState = 'live-unexecuted-breadth';
		expect(issues(missingSentinel)).toContain(
			'Allocation requires exactly 14 future sentinels; found 13'
		);

		const invalidGate = clone(allocation);
		requiredWorkload(invalidGate, 'final-controlled-a').prerequisiteGateIds = [
			'breadth-eight-pass'
		];
		expect(issues(invalidGate)).toContain(
			'final-controlled-a has an invalid prerequisite gate set'
		);

		const wrongConcurrency = clone(allocation);
		requiredWorkload(wrongConcurrency, 'final-controlled-a').requestedConcurrency = 4;
		expect(issues(wrongConcurrency)).toContain(
			'final-controlled-a must be controlled-6 with exactly 6 jobs'
		);

		const executable = clone(allocation);
		(executable as unknown as { executable: boolean }).executable = true;
		expect(AffinityWaveAllocationV2Schema.safeParse(executable).success).toBe(false);
	});

	it('rejects final-plan drift rather than accepting a plausible 24-job matrix', async () => {
		const { allocation, finalPlan } = await fixture();
		const drifted = structuredClone(finalPlan);
		drifted.targets[0] = {
			...drifted.targets[0],
			key: 'death-knight-normal-v3',
			version: 'v3'
		};
		expect(() => assertFinalWorkloadsMatchPlan(allocation, drifted)).toThrow();
	});

	it('writes deterministically, checks exact bytes, and detects artifact or source drift', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-allocation-v2-'));
		temporaryRoots.push(root);
		await Promise.all([
			copySource(root, FINAL_CONTROLLED_RERUN_PLAN_PATH),
			copySource(root, AFFINITY_WAVE_ALLOCATION_V1_PATH)
		]);

		const absent = await exportAffinityWaveAllocationV2({ workspaceRoot: root, mode: 'check' });
		expect(absent).toMatchObject({ inSync: false, written: false });
		const first = await exportAffinityWaveAllocationV2({ workspaceRoot: root, mode: 'write' });
		expect(first).toMatchObject({
			inSync: true,
			written: true,
			workloadCount: 9,
			finalControlledJobCount: 24,
			futureSentinelCount: 14
		});
		const artifactPath = path.resolve(root, AFFINITY_WAVE_ALLOCATION_V2_PATH);
		const firstBytes = await readFile(artifactPath);
		const repeated = await exportAffinityWaveAllocationV2({ workspaceRoot: root, mode: 'write' });
		expect(repeated).toMatchObject({ inSync: true, written: false });
		expect(await readFile(artifactPath)).toEqual(firstBytes);

		await writeFile(artifactPath, Buffer.concat([firstBytes, Buffer.from('\n')]));
		expect(
			await exportAffinityWaveAllocationV2({ workspaceRoot: root, mode: 'check' })
		).toMatchObject({ inSync: false, written: false });

		await writeFile(artifactPath, firstBytes);
		const planPath = path.resolve(root, FINAL_CONTROLLED_RERUN_PLAN_PATH);
		const currentPlan = JSON.parse(await readFile(planPath, 'utf8')) as Record<string, unknown>;
		await writeFile(
			planPath,
			`${JSON.stringify({ ...currentPlan, purpose: 'A changed but still valid source plan.' }, null, 2)}\n`
		);
		expect(
			await exportAffinityWaveAllocationV2({ workspaceRoot: root, mode: 'check' })
		).toMatchObject({ inSync: false, written: false });
	});
});
