import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ImageProductionTargetSchema } from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH,
	type ConcurrencySentinelActivationReceipt
} from './activate-concurrency-sentinels.js';

import {
	canonicalJsonSha256,
	preflightWave,
	readWavePlan,
	type AffinityWaveDispatchGate
} from './affinity-wave-scheduler-lib.js';
import {
	AFFINITY_WAVE_ALLOCATION_V2_PATH,
	canonicalJsonSha256V2,
	type AffinityWaveAllocationV2,
	type AffinityWaveWorkloadIdV2
} from './affinity-wave-allocation-v2.js';
import {
	buildCurrentAffinityWavePlan,
	materializeAffinityWavePlan,
	parseMaterializeAffinityWavePlanArgs
} from './materialize-affinity-wave-plan.js';
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
		await readFile(path.resolve(AFFINITY_WAVE_ALLOCATION_V2_PATH), 'utf8')
	) as AffinityWaveAllocationV2;
	await writeJson(root, AFFINITY_WAVE_ALLOCATION_V2_PATH, allocation);
	return { root, allocation, allocationHash: canonicalJsonSha256V2(allocation) };
}

function sourceTarget(speciesId: string, affinity: string) {
	const target = createAffinityWorkflowExportBundle().targets.find(
		(entry) => entry.speciesId === speciesId && entry.affinity === affinity
	);
	if (!target) throw new Error(`Missing fixture target ${speciesId}/${affinity}`);
	return target;
}

async function writeWorkloadManifests(
	root: string,
	allocation: AffinityWaveAllocationV2,
	workloadId: AffinityWaveWorkloadIdV2
) {
	const workload = allocation.workloads.find((entry) => entry.workloadId === workloadId)!;
	for (const job of workload.jobs) {
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

async function writeCanaryGate(
	root: string,
	profile: 'final-canary' | 'breadth-canary' = 'final-canary'
) {
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
		derivation: { profile },
		promotionEvidence: null,
		evidenceBindings: [{ path: evidencePath, canonicalSha256: canonicalJsonSha256(evidence) }]
	};
	await writeJson(root, gatePath, gate);
	return gate;
}

function options(
	root: string,
	allocationHash: string,
	gate: AffinityWaveDispatchGate,
	runId = 'materialized-canary-01',
	workloadId: AffinityWaveWorkloadIdV2 = 'final-canary'
) {
	return {
		workspaceRoot: root,
		allocationPath: AFFINITY_WAVE_ALLOCATION_V2_PATH,
		allocationCanonicalSha256: allocationHash,
		workloadId,
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
			AFFINITY_WAVE_ALLOCATION_V2_PATH,
			'--allocation-sha256',
			'a'.repeat(64),
			'--workload',
			'final-canary',
			'--gate',
			gatePath,
			'--gate-sha256',
			'a'.repeat(64),
			'--run-id',
			'materialized-canary-01'
		]);
		expect(parsed.workloadId).toBe('final-canary');
		expect(() => parseMaterializeAffinityWavePlanArgs(['--stage', 'canary'])).toThrow(
			'Unknown argument'
		);
		expect(() => parseMaterializeAffinityWavePlanArgs(['--wat'])).toThrow('Unknown argument');
		expect(() =>
			parseMaterializeAffinityWavePlanArgs([
				'--allocation',
				AFFINITY_WAVE_ALLOCATION_V2_PATH,
				'--allocation',
				AFFINITY_WAVE_ALLOCATION_V2_PATH
			])
		).toThrow('exactly once');
	});

	it('materializes the exact reviewed workload with immutable allocation, gate, and manifest hashes', async () => {
		const { root, allocation, allocationHash } = await freshWorkspace();
		await writeWorkloadManifests(root, allocation, 'final-canary');
		const gate = await writeCanaryGate(root);
		const result = await materializeAffinityWavePlan(options(root, allocationHash, gate));
		expect(result.outputPath).toBe(
			'assets/enemies/experiments/affinity-workflow-v1/review/wave-plans/materialized/materialized-canary-01.json'
		);
		expect(result.plan.jobs.map((job) => job.allocationJobKey)).toEqual(
			allocation.workloads
				.find(({ workloadId }) => workloadId === 'final-canary')!
				.jobs.map(({ key }) => key)
		);
		expect(result.plan.workloadId).toBe('final-canary');
		expect(result.plan.jobs.every((job) => /^[a-f0-9]{64}$/u.test(job.targetCanonicalSha256))).toBe(
			true
		);
		expect(result.plan.concurrencySentinelActivationReceipt).toBeNull();
		await expect(materializeAffinityWavePlan(options(root, allocationHash, gate))).rejects.toThrow(
			'Wave plan already exists'
		);
	});

	it('selects a workload identity rather than an ambiguous canary stage and preserves job order', async () => {
		const { root, allocation, allocationHash } = await freshWorkspace();
		await writeWorkloadManifests(root, allocation, 'breadth-canary');
		const finalGate = await writeCanaryGate(root, 'final-canary');
		await expect(
			buildCurrentAffinityWavePlan(
				options(
					root,
					allocationHash,
					finalGate,
					'materialized-breadth-canary-wrong-gate',
					'breadth-canary'
				)
			)
		).rejects.toThrow('does not authorize workload breadth-canary');

		const breadthGate = await writeCanaryGate(root, 'breadth-canary');
		const plan = await buildCurrentAffinityWavePlan(
			options(root, allocationHash, breadthGate, 'materialized-breadth-canary-01', 'breadth-canary')
		);
		const workload = allocation.workloads.find(
			(candidate) => candidate.workloadId === 'breadth-canary'
		)!;
		expect(plan).toMatchObject({ workloadId: 'breadth-canary', stage: 'canary' });
		expect(plan.jobs.map((job) => job.allocationJobKey)).toEqual(
			workload.jobs.map((job) => job.key)
		);
	});

	it('feeds the scheduler a native allocation-bound v2 preflight and rejects plan drift', async () => {
		const { root, allocation, allocationHash } = await freshWorkspace();
		await writeWorkloadManifests(root, allocation, 'final-canary');
		const gate = await writeCanaryGate(root);
		const materialized = await materializeAffinityWavePlan(
			options(root, allocationHash, gate, 'materialized-canary-native-v2')
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
				path: AFFINITY_WAVE_ALLOCATION_V2_PATH,
				canonicalSha256: allocationHash
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
		const { root, allocation, allocationHash } = await freshWorkspace();
		await writeWorkloadManifests(root, allocation, 'final-canary');
		const gate = await writeCanaryGate(root);
		await expect(
			buildCurrentAffinityWavePlan({
				...options(root, allocationHash, gate),
				allocationCanonicalSha256: 'a'.repeat(64)
			})
		).rejects.toThrow('reviewed allocation v2 hash');
		await expect(
			buildCurrentAffinityWavePlan({
				...options(root, allocationHash, gate),
				gateCanonicalSha256: 'b'.repeat(64)
			})
		).rejects.toThrow('Dispatch gate canonical hash mismatch');
		await writeJson(root, evidencePath, { reviewed: false });
		await expect(buildCurrentAffinityWavePlan(options(root, allocationHash, gate))).rejects.toThrow(
			'Dispatch gate evidence'
		);
		await writeJson(root, evidencePath, { reviewed: true });
		const firstJob = allocation.workloads.find(({ workloadId }) => workloadId === 'final-canary')!
			.jobs[0]!;
		const assignment = JSON.parse(
			await readFile(path.resolve(root, firstJob.assignmentPath), 'utf8')
		) as { dryRun: boolean };
		assignment.dryRun = true;
		await writeJson(root, firstJob.assignmentPath, assignment);
		await expect(buildCurrentAffinityWavePlan(options(root, allocationHash, gate))).rejects.toThrow(
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
		await expect(
			materializeAffinityWavePlan(options(root, allocationHash, gate, collisionRunId))
		).rejects.toThrow('Run ID is not fresh');
	});

	it('refuses a future-sentinel workload without a valid current activation receipt', async () => {
		const { root, allocation, allocationHash } = await freshWorkspace();
		await writeWorkloadManifests(root, allocation, 'scale');
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
				...options(root, allocationHash, gate, 'materialized-scale-01', 'scale'),
				verifySentinelReceipt: async () => ({ valid: false, issues: ['missing receipt'] })
			})
		).rejects.toThrow('valid current activation receipt');

		const sentinelJobs = allocation.workloads
			.find((workload) => workload.workloadId === 'scale')!
			.jobs.filter((job) => job.manifestState === 'future-sentinel');
		const artifacts = await Promise.all(
			sentinelJobs.flatMap((job) =>
				([job.targetPath, job.assignmentPath] as const).map(async (repositoryPath, index) => ({
					kind: index === 0 ? ('target' as const) : ('assignment' as const),
					livePath: repositoryPath,
					canonicalSha256: canonicalJsonSha256V2(
						JSON.parse(await readFile(path.resolve(root, repositoryPath), 'utf8'))
					),
					byteSha256: 'd'.repeat(64)
				}))
			)
		);
		const receipt = {
			schemaVersion: 'affinity-concurrency-sentinel-activation-receipt-v1',
			experimentId: 'affinity-workflow-v1',
			activationId: 'concurrency-sentinels-0123456789abcdef',
			status: 'complete',
			completedAt: '2026-08-29T20:00:00.000Z',
			actor: 'materializer-test',
			bindings: {
				allocationCanonicalSha256: allocationHash,
				finalControlledIntegrationReceiptCanonicalSha256: 'a'.repeat(64),
				finalControlledEvaluationReceiptCanonicalSha256: 'b'.repeat(64),
				acceptedRulesCanonicalSha256: 'c'.repeat(64),
				repositorySkillTreeSha256: 'd'.repeat(64),
				installedSkillTreeSha256: 'd'.repeat(64),
				sourceSetCanonicalSha256: 'e'.repeat(64),
				sentinelBundleCanonicalSha256: 'f'.repeat(64),
				assignedAt: '2026-08-29T20:00:00.000Z'
			},
			targetCount: 14,
			assignmentCount: 14,
			artifactCount: 28,
			artifactSetSha256: '0'.repeat(64),
			artifacts
		} satisfies ConcurrencySentinelActivationReceipt;
		await expect(
			buildCurrentAffinityWavePlan({
				...options(root, allocationHash, gate, 'materialized-scale-stale-receipt', 'scale'),
				verifySentinelReceipt: async () => ({ valid: true, receipt, issues: [] })
			})
		).rejects.toThrow('receipt is stale against the reviewed allocation');

		const sourceV1Hash = allocation.sourceAllocationV1.canonicalSha256;
		expect(sourceV1Hash).not.toBe(allocationHash);
		const currentReceipt = {
			...receipt,
			bindings: { ...receipt.bindings, allocationCanonicalSha256: sourceV1Hash }
		};
		await writeJson(root, CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH, currentReceipt);
		const plan = await buildCurrentAffinityWavePlan({
			...options(root, allocationHash, gate, 'materialized-scale-current-receipt', 'scale'),
			verifySentinelReceipt: async () => ({ valid: true, receipt: currentReceipt, issues: [] })
		});
		expect(plan.allocation).toMatchObject({
			artifactPath: AFFINITY_WAVE_ALLOCATION_V2_PATH,
			canonicalSha256: allocationHash
		});
		expect(plan.concurrencySentinelActivationReceipt?.artifactPath).toBe(
			CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH
		);
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
