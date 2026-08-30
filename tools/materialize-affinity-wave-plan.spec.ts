import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ImageProductionTargetSchema } from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	canonicalJsonSha256,
	preflightWave,
	readWavePlan,
	type AffinityWaveAllocationSpec,
	type AffinityWaveDispatchGate
} from './affinity-wave-scheduler-lib.js';
import {
	buildCurrentAffinityWavePlan,
	materializeAffinityWavePlan,
	parseMaterializeAffinityWavePlanArgs
} from './materialize-affinity-wave-plan.js';
import {
	CONCURRENCY_SENTINEL_ALLOCATION_PATH,
	EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256
} from './concurrency-sentinel-readiness.js';
import { createAffinityWorkflowExportBundle } from './image-production-lib.js';

const roots: string[] = [];
const gatePath =
	'assets/enemies/experiments/affinity-workflow-v1/review/gates/materializer-test.json';
const evidencePath =
	'assets/enemies/experiments/affinity-workflow-v1/review/materializer-test-evidence.json';

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function writeJson(root: string, repositoryPath: string, value: unknown) {
	const absolute = path.resolve(root, repositoryPath);
	await mkdir(path.dirname(absolute), { recursive: true });
	await writeFile(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

async function freshWorkspace() {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-wave-plan-materializer-'));
	roots.push(root);
	const allocation = JSON.parse(
		await readFile(path.resolve(CONCURRENCY_SENTINEL_ALLOCATION_PATH), 'utf8')
	) as AffinityWaveAllocationSpec;
	await writeJson(root, CONCURRENCY_SENTINEL_ALLOCATION_PATH, allocation);
	return { root, allocation };
}

function sourceTarget(speciesId: string, affinity: string) {
	const target = createAffinityWorkflowExportBundle().targets.find(
		(entry) => entry.speciesId === speciesId && entry.affinity === affinity
	);
	if (!target) throw new Error(`Missing fixture target ${speciesId}/${affinity}`);
	return target;
}

async function writeStageManifests(
	root: string,
	allocation: AffinityWaveAllocationSpec,
	stage: AffinityWaveAllocationSpec['stages'][number]['stage']
) {
	const stageAllocation = allocation.stages.find((entry) => entry.stage === stage)!;
	for (const job of stageAllocation.jobs) {
		const source = sourceTarget(job.speciesId, job.affinity);
		const target = ImageProductionTargetSchema.parse({
			...source,
			targetId: job.key,
			assetId: job.key,
			cohort: job.cohort,
			promptProtocol: 'safe-frame-v4',
			authoringProtocol: 'semantic-v2',
			output: { candidatePath: job.candidatePath, resultPath: job.resultPath }
		});
		const assignment = {
			schemaVersion: 'image-production-assignment-v1',
			assignmentId: `${job.key}-assignment`,
			targetId: target.targetId,
			skillVersion: 'summonlab-image-production-v1',
			assignedAt: '2026-08-29T20:00:00.000Z',
			dryRun: false,
			retryCeiling: 1,
			permittedOutputs: target.output,
			forbiddenSharedPaths: [
				'assets/enemies/experiments/affinity-workflow-v1/review/evaluation.json'
			],
			completionContract: {
				oneTargetOneImage: true,
				structuredResultRequired: true,
				sharedFilesMustRemainUntouched: true,
				selfPromotionForbidden: true
			}
		};
		await writeJson(root, job.targetPath, target);
		await writeJson(root, job.assignmentPath, assignment);
	}
}

async function writeCanaryGate(root: string) {
	const evidence = { reviewed: true };
	await writeJson(root, evidencePath, evidence);
	const gate: AffinityWaveDispatchGate = {
		schemaVersion: 'affinity-wave-dispatch-gate-v2',
		gateId: 'materializer-test-gate',
		experimentId: 'affinity-workflow-v1',
		status: 'authorized',
		authorizedStage: 'canary',
		qualityGateSatisfied: true,
		humanGateSatisfied: true,
		prerequisiteRunIds: [],
		derivation: { profile: 'final-canary' },
		promotionEvidence: null,
		evidenceBindings: [{ path: evidencePath, canonicalSha256: canonicalJsonSha256(evidence) }]
	};
	await writeJson(root, gatePath, gate);
	return gate;
}

function options(root: string, gate: AffinityWaveDispatchGate, runId = 'materialized-canary-01') {
	return {
		workspaceRoot: root,
		allocationPath: CONCURRENCY_SENTINEL_ALLOCATION_PATH,
		allocationCanonicalSha256: EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
		stage: 'canary',
		gatePath,
		gateCanonicalSha256: canonicalJsonSha256(gate),
		runId
	};
}

describe('allocation-bound affinity wave-plan materialization', () => {
	it('strictly parses the complete CLI contract', () => {
		const parsed = parseMaterializeAffinityWavePlanArgs([
			'--',
			'--allocation',
			CONCURRENCY_SENTINEL_ALLOCATION_PATH,
			'--allocation-sha256',
			EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256,
			'--stage',
			'canary',
			'--gate',
			gatePath,
			'--gate-sha256',
			'a'.repeat(64),
			'--run-id',
			'materialized-canary-01'
		]);
		expect(parsed.stage).toBe('canary');
		expect(() => parseMaterializeAffinityWavePlanArgs(['--wat'])).toThrow('Unknown argument');
		expect(() =>
			parseMaterializeAffinityWavePlanArgs([
				'--allocation',
				CONCURRENCY_SENTINEL_ALLOCATION_PATH,
				'--allocation',
				CONCURRENCY_SENTINEL_ALLOCATION_PATH
			])
		).toThrow('exactly once');
	});

	it('materializes the exact reviewed stage with immutable allocation, gate, and manifest hashes', async () => {
		const { root, allocation } = await freshWorkspace();
		await writeStageManifests(root, allocation, 'canary');
		const gate = await writeCanaryGate(root);
		const result = await materializeAffinityWavePlan(options(root, gate));
		expect(result.outputPath).toBe(
			'assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/materialized/materialized-canary-01.json'
		);
		expect(result.plan.jobs.map((job) => job.allocationJobKey)).toEqual(
			allocation.stages.find(({ stage }) => stage === 'canary')!.jobs.map(({ key }) => key)
		);
		expect(result.plan.jobs.every((job) => /^[a-f0-9]{64}$/u.test(job.targetCanonicalSha256))).toBe(
			true
		);
		expect(result.plan.concurrencySentinelActivationReceipt).toBeNull();
		await expect(materializeAffinityWavePlan(options(root, gate))).rejects.toThrow(
			'Wave plan already exists'
		);
	});

	it('feeds the scheduler a native allocation-bound v2 preflight and rejects plan drift', async () => {
		const { root, allocation } = await freshWorkspace();
		await writeStageManifests(root, allocation, 'canary');
		const gate = await writeCanaryGate(root);
		const materialized = await materializeAffinityWavePlan(
			options(root, gate, 'materialized-canary-native-v2')
		);
		const boundPlan = await readWavePlan(root, materialized.outputPath);
		const preflight = await preflightWave(root, boundPlan, 3, '2026-08-29T20:05:00.000Z');
		expect(preflight).toMatchObject({
			schemaVersion: 'affinity-wave-preflight-v2',
			runId: 'materialized-canary-native-v2',
			sourcePlan: {
				path: materialized.outputPath,
				canonicalSha256: materialized.canonicalSha256
			},
			sourceAllocation: {
				path: CONCURRENCY_SENTINEL_ALLOCATION_PATH,
				canonicalSha256: EXPECTED_CONCURRENCY_SENTINEL_ALLOCATION_SHA256
			}
		});
		expect(preflight.jobs.map((job) => job.targetCanonicalSha256)).toEqual(
			materialized.plan.jobs.map((job) => job.targetCanonicalSha256)
		);
		await writeJson(root, materialized.outputPath, {
			...materialized.plan,
			dispatchGate: {
				...materialized.plan.dispatchGate,
				canonicalSha256: 'a'.repeat(64)
			}
		});
		await expect(preflightWave(root, boundPlan, 3, '2026-08-29T20:06:00.000Z')).rejects.toThrow(
			'Materialized wave plan changed before preflight'
		);
	});

	it('fails closed on allocation, gate, evidence, manifest, and run-directory drift', async () => {
		const { root, allocation } = await freshWorkspace();
		await writeStageManifests(root, allocation, 'canary');
		const gate = await writeCanaryGate(root);
		await expect(
			buildCurrentAffinityWavePlan({
				...options(root, gate),
				allocationCanonicalSha256: 'a'.repeat(64)
			})
		).rejects.toThrow('reviewed allocation hash');
		await expect(
			buildCurrentAffinityWavePlan({
				...options(root, gate),
				gateCanonicalSha256: 'b'.repeat(64)
			})
		).rejects.toThrow('Dispatch gate canonical hash mismatch');
		await writeJson(root, evidencePath, { reviewed: false });
		await expect(buildCurrentAffinityWavePlan(options(root, gate))).rejects.toThrow(
			'Dispatch gate evidence'
		);
		await writeJson(root, evidencePath, { reviewed: true });
		const firstJob = allocation.stages.find(({ stage }) => stage === 'canary')!.jobs[0]!;
		const assignment = JSON.parse(
			await readFile(path.resolve(root, firstJob.assignmentPath), 'utf8')
		) as { dryRun: boolean };
		assignment.dryRun = true;
		await writeJson(root, firstJob.assignmentPath, assignment);
		await expect(buildCurrentAffinityWavePlan(options(root, gate))).rejects.toThrow(
			'not executable'
		);
		assignment.dryRun = false;
		await writeJson(root, firstJob.assignmentPath, assignment);
		const collisionRunId = 'materialized-canary-02';
		await mkdir(
			path.resolve(
				root,
				`assets/enemies/experiments/affinity-workflow-v1/wave-runs/${collisionRunId}`
			),
			{ recursive: true }
		);
		await expect(materializeAffinityWavePlan(options(root, gate, collisionRunId))).rejects.toThrow(
			'Run ID is not fresh'
		);
	});

	it('refuses a future-sentinel stage without a valid current activation receipt', async () => {
		const { root, allocation } = await freshWorkspace();
		await writeStageManifests(root, allocation, 'scale');
		const evidence = { reviewed: true };
		await writeJson(root, evidencePath, evidence);
		const gate: AffinityWaveDispatchGate = {
			schemaVersion: 'affinity-wave-dispatch-gate-v2',
			gateId: 'materializer-scale-gate',
			experimentId: 'affinity-workflow-v1',
			status: 'authorized',
			authorizedStage: 'scale',
			qualityGateSatisfied: true,
			humanGateSatisfied: true,
			prerequisiteRunIds: ['load-exact-twelve-01'],
			derivation: {
				profile: 'load',
				requestedConcurrency: 16,
				prerequisiteRunId: 'load-exact-twelve-01'
			},
			promotionEvidence: {
				schemaVersion: 'affinity-wave-promotion-evidence-v1',
				sourceRunId: 'load-exact-twelve-01',
				sourceStage: 'load',
				sourceEffectiveConcurrency: 12,
				sourceReportPath:
					'assets/enemies/experiments/affinity-workflow-v1/wave-runs/load-exact-twelve-01/report.json',
				sourceReportCanonicalSha256: 'c'.repeat(64),
				thresholds: {
					minimumCandidateRate: 0.8,
					maximumRetryRate: 0.2,
					minimumQualityPassRate: 0.8,
					maximumCriticalVisualFailureCount: 0
				},
				observation: {
					targetCount: 12,
					candidateCount: 12,
					candidateRate: 1,
					retryCount: 0,
					retryRate: 0,
					qualityPassCount: 12,
					qualityPassRate: 1,
					criticalVisualFailureCount: 0
				},
				breadthCanaries: null
			},
			evidenceBindings: [{ path: evidencePath, canonicalSha256: canonicalJsonSha256(evidence) }]
		};
		await writeJson(root, gatePath, gate);
		await expect(
			buildCurrentAffinityWavePlan({
				...options(root, gate, 'materialized-scale-01'),
				stage: 'scale',
				verifySentinelReceipt: async () => ({ valid: false, issues: ['missing receipt'] })
			})
		).rejects.toThrow('valid current activation receipt');
		expect(
			await stat(
				path.resolve(
					root,
					'assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/materialized'
				)
			).catch(() => null)
		).toBeNull();
	});
});
