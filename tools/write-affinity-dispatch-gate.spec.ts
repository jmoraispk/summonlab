import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ImageProductionTargetSchema } from '../packages/contracts/src/index.js';
import type { EligibleSchedulerRun } from './check-affinity-plan-completion.js';
import {
	AffinityWavePromotionEvidenceSchema,
	type AffinityWavePromotionEvidence
} from './affinity-wave-scheduler-lib.js';
import { AFFINITY_EXPERIMENT_ROOT } from './image-production-lib.js';
import {
	buildDerivedAffinityDispatchGate,
	writeAffinityDispatchGate,
	type AffinityDispatchGateRequest,
	type VerifiedDispatchEvidenceBinding
} from './write-affinity-dispatch-gate.js';

const roots: string[] = [];
const HASH = 'a'.repeat(64);
const normalRequest = { profile: 'normal-canary' } as const;
const finalRequest = { profile: 'final-canary' } as const;
const bindings: VerifiedDispatchEvidenceBinding[] = [
	{ path: 'evidence/z.json', canonicalSha256: HASH },
	{ path: 'evidence/a.json', canonicalSha256: 'b'.repeat(64) }
];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function schedulerRun(
	stage: EligibleSchedulerRun['stage'],
	effectiveConcurrency: number,
	runId = `${stage}-eligible-${effectiveConcurrency}`
): EligibleSchedulerRun {
	return {
		runId,
		stage,
		effectiveConcurrency,
		preflightPath: `wave-runs/${runId}/preflight.json`,
		preflightCanonicalSha256: 'c'.repeat(64),
		reportPath: `wave-runs/${runId}/report.json`,
		reportCanonicalSha256: 'd'.repeat(64)
	};
}

function promotionEvidence(
	run: EligibleSchedulerRun,
	breadthCanaries = false
): AffinityWavePromotionEvidence {
	return AffinityWavePromotionEvidenceSchema.parse({
		schemaVersion: 'affinity-wave-promotion-evidence-v1' as const,
		sourceRunId: run.runId,
		sourceStage: run.stage as 'canary' | 'pilot' | 'controlled' | 'breadth' | 'load',
		sourceEffectiveConcurrency: run.effectiveConcurrency as 2 | 4 | 6 | 8 | 12,
		sourceReportPath: run.reportPath,
		sourceReportCanonicalSha256: run.reportCanonicalSha256,
		thresholds: {
			minimumCandidateRate: 0.8 as const,
			maximumRetryRate: 0.2 as const,
			minimumQualityPassRate: 0.8 as const,
			maximumCriticalVisualFailureCount: 0 as const
		},
		observation: {
			targetCount: 5,
			candidateCount: 4,
			candidateRate: 0.8,
			retryCount: 1,
			retryRate: 0.2,
			qualityPassCount: 4,
			qualityPassRate: 0.8,
			criticalVisualFailureCount: 0
		},
		breadthCanaries: breadthCanaries
			? {
					targetIds: [
						'affinity-workflow-v1-goblin-normal',
						'affinity-workflow-v1-tunnel-boar-fire'
					],
					observation: {
						targetCount: 2,
						candidateCount: 2,
						candidateRate: 1,
						retryCount: 0,
						retryRate: 0,
						qualityPassCount: 2,
						qualityPassRate: 1,
						criticalVisualFailureCount: 0
					}
				}
			: null
	});
}

async function copyArtifact(workspaceRoot: string, repositoryPath: string): Promise<void> {
	const destination = path.resolve(workspaceRoot, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(path.resolve(repositoryPath), destination);
}

async function normalWorkspace(): Promise<string> {
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'affinity-dispatch-gate-'));
	roots.push(workspaceRoot);
	const dryRunPath = `${AFFINITY_EXPERIMENT_ROOT}/dry-runs/goblin-normal-envelope-preflight-v2.json`;
	const dryRun = JSON.parse(await readFile(path.resolve(dryRunPath), 'utf8')) as {
		target: { path: string };
		assignment: { path: string };
	};
	const target = ImageProductionTargetSchema.parse(
		JSON.parse(await readFile(path.resolve(dryRun.target.path), 'utf8'))
	);
	for (const repositoryPath of [
		dryRunPath,
		dryRun.target.path,
		dryRun.assignment.path,
		...target.references.map((reference) => reference.path)
	])
		await copyArtifact(workspaceRoot, repositoryPath);
	return workspaceRoot;
}

describe('derived affinity dispatch gates', () => {
	it('derives Normal and Final canary semantics without caller-supplied booleans', () => {
		const normal = buildDerivedAffinityDispatchGate(normalRequest, {
			bindings,
			prerequisiteRun: null,
			promotionEvidence: null
		});
		const final = buildDerivedAffinityDispatchGate(finalRequest, {
			bindings,
			prerequisiteRun: null,
			promotionEvidence: null
		});

		expect(normal).toMatchObject({
			schemaVersion: 'affinity-wave-dispatch-gate-v2',
			authorizedStage: 'canary',
			qualityGateSatisfied: true,
			humanGateSatisfied: false,
			prerequisiteRunIds: []
		});
		expect(final).toMatchObject({
			authorizedStage: 'canary',
			humanGateSatisfied: true,
			prerequisiteRunIds: []
		});
		expect(normal.evidenceBindings.map((item) => item.path)).toEqual([
			'evidence/a.json',
			'evidence/z.json'
		]);
	});

	it('requires an exact eligible Controlled-6 predecessor for Breadth', () => {
		const prerequisiteRun = schedulerRun('controlled', 6);
		const request = {
			profile: 'breadth',
			prerequisiteRunId: prerequisiteRun.runId
		} as const;
		const gate = buildDerivedAffinityDispatchGate(request, {
			bindings,
			prerequisiteRun,
			promotionEvidence: promotionEvidence(prerequisiteRun, true)
		});
		expect(gate).toMatchObject({
			authorizedStage: 'breadth',
			humanGateSatisfied: true,
			prerequisiteRunIds: [prerequisiteRun.runId]
		});
		expect(() =>
			buildDerivedAffinityDispatchGate(request, {
				bindings,
				prerequisiteRun: schedulerRun('pilot', 4, prerequisiteRun.runId),
				promotionEvidence: promotionEvidence(prerequisiteRun, true)
			})
		).toThrow(/eligible controlled-6 predecessor/u);
	});

	it.each([
		[4, 'pilot', 'canary', 2],
		[6, 'controlled', 'pilot', 4],
		[12, 'load', 'breadth', 8],
		[16, 'scale', 'load', 12]
	] as const)(
		'derives Load %i only from its exact predecessor',
		(concurrency, authorizedStage, predecessorStage, predecessorConcurrency) => {
			const prerequisiteRun = schedulerRun(predecessorStage, predecessorConcurrency);
			const request: AffinityDispatchGateRequest = {
				profile: 'load',
				requestedConcurrency: concurrency,
				prerequisiteRunId: prerequisiteRun.runId
			};
			const gate = buildDerivedAffinityDispatchGate(request, {
				bindings,
				prerequisiteRun,
				promotionEvidence: promotionEvidence(prerequisiteRun)
			});
			expect(gate.authorizedStage).toBe(authorizedStage);
			expect(gate.prerequisiteRunIds).toEqual([prerequisiteRun.runId]);
		}
	);

	it('never permits 16 after anything other than an eligible Load-12 run', () => {
		const request = {
			profile: 'load',
			requestedConcurrency: 16,
			prerequisiteRunId: 'breadth-eligible-8'
		} as const;
		expect(() =>
			buildDerivedAffinityDispatchGate(request, {
				bindings,
				prerequisiteRun: schedulerRun('breadth', 8, request.prerequisiteRunId),
				promotionEvidence: promotionEvidence(schedulerRun('breadth', 8, request.prerequisiteRunId))
			})
		).toThrow(/eligible load-12 predecessor/u);
	});

	it('rejects forged promotion counters and missing breadth canaries', () => {
		const canary = schedulerRun('canary', 2);
		const pilotRequest = {
			profile: 'load',
			requestedConcurrency: 4,
			prerequisiteRunId: canary.runId
		} as const;
		const weak = promotionEvidence(canary);
		expect(() =>
			buildDerivedAffinityDispatchGate(pilotRequest, {
				bindings,
				prerequisiteRun: canary,
				promotionEvidence: {
					...weak,
					observation: {
						...weak.observation,
						candidateCount: 3,
						candidateRate: 0.6,
						qualityPassCount: 3,
						qualityPassRate: 0.6
					}
				}
			})
		).toThrow(/Promotion threshold failed/u);

		const controlled = schedulerRun('controlled', 6);
		expect(() =>
			buildDerivedAffinityDispatchGate(
				{ profile: 'breadth', prerequisiteRunId: controlled.runId },
				{
					bindings,
					prerequisiteRun: controlled,
					promotionEvidence: promotionEvidence(controlled)
				}
			)
		).toThrow(/two exact breadth canaries/u);
	});

	it('derives Load-12 and Scale-16 from promoted predecessor runs without a breadth-round input', () => {
		for (const [requestedConcurrency, predecessor] of [
			[12, schedulerRun('breadth', 8)],
			[16, schedulerRun('load', 12)]
		] as const) {
			const gate = buildDerivedAffinityDispatchGate(
				{
					profile: 'load',
					requestedConcurrency,
					prerequisiteRunId: predecessor.runId
				},
				{
					bindings,
					prerequisiteRun: predecessor,
					promotionEvidence: promotionEvidence(predecessor)
				}
			);
			expect(gate.promotionEvidence?.sourceRunId).toBe(predecessor.runId);
			expect(gate.evidenceBindings.map((binding) => binding.path)).not.toContain(
				`${AFFINITY_EXPERIMENT_ROOT}/review/rounds/breadth-v1/final-evaluation.json`
			);
		}
	});

	it('check mode verifies current Normal evidence without writing', async () => {
		const workspaceRoot = await normalWorkspace();
		const report = await writeAffinityDispatchGate({
			workspaceRoot,
			request: normalRequest,
			mode: 'check'
		});
		expect(report).toMatchObject({
			eligible: true,
			mode: 'check',
			artifactPresent: false,
			inSync: false,
			written: false,
			idempotent: false,
			blockers: []
		});
		await expect(readFile(path.resolve(workspaceRoot, report.outputPath))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('publishes exclusively, accepts an exact repeat, and never overwrites', async () => {
		const workspaceRoot = await normalWorkspace();
		const first = await writeAffinityDispatchGate({
			workspaceRoot,
			request: normalRequest,
			mode: 'write'
		});
		expect(first).toMatchObject({ written: true, inSync: true, idempotent: false });
		const output = path.resolve(workspaceRoot, first.outputPath);
		const original = await readFile(output, 'utf8');

		const repeat = await writeAffinityDispatchGate({
			workspaceRoot,
			request: normalRequest,
			mode: 'write'
		});
		expect(repeat).toMatchObject({ written: false, inSync: true, idempotent: true });

		await writeFile(output, '{"different":true}\n');
		const conflict = await writeAffinityDispatchGate({
			workspaceRoot,
			request: normalRequest,
			mode: 'write'
		});
		expect(conflict).toMatchObject({ eligible: false, written: false, inSync: false });
		expect(conflict.blockers).toContain('Existing dispatch gate differs; refusing to overwrite.');
		expect(await readFile(output, 'utf8')).not.toBe(original);
		expect(await readFile(output, 'utf8')).toBe('{"different":true}\n');
	});

	it('rejects stale Normal dry-run bytes instead of emitting a gate', async () => {
		const workspaceRoot = await normalWorkspace();
		const assignmentPath = path.resolve(
			workspaceRoot,
			`${AFFINITY_EXPERIMENT_ROOT}/dry-runs/goblin-normal-assignment-v1.json`
		);
		const assignment = JSON.parse(await readFile(assignmentPath, 'utf8')) as Record<
			string,
			unknown
		>;
		await writeFile(
			assignmentPath,
			`${JSON.stringify({ ...assignment, assignedAt: '2026-08-30T00:00:00.000Z' })}\n`
		);
		const report = await writeAffinityDispatchGate({
			workspaceRoot,
			request: normalRequest,
			mode: 'write'
		});
		expect(report).toMatchObject({ eligible: false, written: false, artifactPresent: false });
		expect(report.blockers[0]).toMatch(/stale or inconsistent/u);
	});

	it('keeps unavailable Final, Breadth, and Load requests read-only and explicitly blocked', async () => {
		const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'affinity-dispatch-empty-'));
		roots.push(workspaceRoot);
		const requests: AffinityDispatchGateRequest[] = [
			finalRequest,
			{ profile: 'breadth', prerequisiteRunId: 'controlled-missing-6' },
			{ profile: 'load', requestedConcurrency: 16, prerequisiteRunId: 'load-missing-12' }
		];
		for (const request of requests) {
			const report = await writeAffinityDispatchGate({
				workspaceRoot,
				request,
				mode: 'check'
			});
			expect(report.eligible).toBe(false);
			expect(report.written).toBe(false);
			expect(report.artifactPresent).toBe(false);
			expect(report.blockers.length).toBeGreaterThan(0);
		}
	});
});
