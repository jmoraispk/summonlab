import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ImageProductionResultSchema } from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	AffinityWaveAllocationSpecSchema,
	AffinityWaveDispatchGateSchema,
	AffinityWavePlanSchema,
	AffinityWavePreflightSchema,
	buildWaveReport,
	canonicalJsonSha256,
	nextDispatchDecision,
	preflightWave,
	recordEventExclusive,
	readWaveAllocationSpec,
	validateEventJournal,
	verifyCurrentWavePreflight,
	writePreflightExclusive,
	type AffinityWaveEvent,
	type AffinityWavePlan
} from './affinity-wave-scheduler-lib.js';

const roots: string[] = [];
const experimentRoot = 'assets/enemies/experiments/affinity-workflow-v1';
const requestedByStage = {
	canary: 2,
	pilot: 4,
	controlled: 6,
	breadth: 8,
	load: 12,
	scale: 16
} as const;
const gateEvidence = {
	schemaVersion: 'affinity-wave-test-evidence-v1',
	status: 'passed'
} as const;
const gateEvidencePath = `${experimentRoot}/review/evaluation.json`;
const normalDryRunPath =
	`${experimentRoot}/dry-runs/goblin-normal-envelope-preflight-v2.json` as const;
const normalDryRun = JSON.parse(await readFile(path.resolve(normalDryRunPath), 'utf8')) as {
	target: { path: string };
	assignment: { path: string };
};
const normalTarget = JSON.parse(await readFile(path.resolve(normalDryRun.target.path), 'utf8')) as {
	references: Array<{ path: string }>;
};
const normalEvidencePaths = [
	normalDryRunPath,
	normalDryRun.target.path,
	normalDryRun.assignment.path
];
const normalEvidenceBindings = await Promise.all(
	normalEvidencePaths.map(async (repositoryPath) => ({
		path: repositoryPath,
		canonicalSha256: canonicalJsonSha256(
			JSON.parse(await readFile(path.resolve(repositoryPath), 'utf8')) as unknown
		)
	}))
);

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function manifestJob(species: string, affinity: string): AffinityWavePlan['jobs'][number] {
	return {
		targetPath: `${experimentRoot}/targets/${species}/${affinity}.json`,
		assignmentPath: `${experimentRoot}/assignments/${species}/${affinity}.json`
	};
}

function plan(
	stage: keyof typeof requestedByStage,
	jobs: AffinityWavePlan['jobs'],
	runId = `${stage}-fixture`
): AffinityWavePlan {
	const dispatchGate = gate(stage);
	return AffinityWavePlanSchema.parse({
		schemaVersion: 'affinity-wave-plan-v1',
		runId,
		experimentId: 'affinity-workflow-v1',
		stage,
		requestedConcurrency: requestedByStage[stage],
		reservedOrchestratorSlots: 1,
		requireExactConcurrency: true,
		runDirectory: `${experimentRoot}/wave-runs/${runId}`,
		stopRules: {
			capacityFailureLimit: 3,
			stopOnOutputCollision: true,
			retryCapacityFailuresInWave: false
		},
		dispatchGate: {
			artifactPath: `${experimentRoot}/review/test-gates/${stage}.json`,
			canonicalSha256: canonicalJsonSha256(dispatchGate)
		},
		jobs
	});
}

function gate(stage: keyof typeof requestedByStage, humanGateSatisfied = stage !== 'canary') {
	const derivation =
		stage === 'canary'
			? { profile: humanGateSatisfied ? ('final-canary' as const) : ('normal-canary' as const) }
			: stage === 'breadth'
				? { profile: 'breadth' as const, prerequisiteRunId: 'eligible-preceding-run' }
				: {
						profile: 'load' as const,
						requestedConcurrency: requestedByStage[stage],
						prerequisiteRunId: 'eligible-preceding-run'
					};
	return {
		schemaVersion: 'affinity-wave-dispatch-gate-v2' as const,
		gateId:
			stage === 'canary'
				? humanGateSatisfied
					? 'final-controlled-canary-dispatch-v2'
					: 'normal-canary-dispatch-v2'
				: `${stage}-test-gate`,
		experimentId: 'affinity-workflow-v1' as const,
		status: 'authorized' as const,
		authorizedStage: stage,
		qualityGateSatisfied: true as const,
		humanGateSatisfied,
		prerequisiteRunIds: stage === 'canary' ? [] : ['eligible-preceding-run'],
		derivation,
		promotionEvidence:
			stage === 'canary'
				? null
				: {
						schemaVersion: 'affinity-wave-promotion-evidence-v1' as const,
						sourceRunId: 'eligible-preceding-run',
						sourceStage: {
							pilot: 'canary',
							controlled: 'pilot',
							breadth: 'controlled',
							load: 'breadth',
							scale: 'load'
						}[stage]!,
						sourceEffectiveConcurrency: {
							pilot: 2,
							controlled: 4,
							breadth: 6,
							load: 8,
							scale: 12
						}[stage]!,
						sourceReportPath: `${experimentRoot}/wave-runs/eligible-preceding-run/report.json`,
						sourceReportCanonicalSha256: 'f'.repeat(64),
						thresholds: {
							minimumCandidateRate: 0.8,
							maximumRetryRate: 0.2,
							minimumQualityPassRate: 0.8,
							maximumCriticalVisualFailureCount: 0
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
						breadthCanaries:
							stage === 'breadth'
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
					},
		evidenceBindings:
			stage === 'canary'
				? [...normalEvidenceBindings].sort((left, right) => left.path.localeCompare(right.path))
				: [
						{
							path: gateEvidencePath,
							canonicalSha256: canonicalJsonSha256(gateEvidence)
						}
					]
	};
}

async function writeGate(
	root: string,
	stage: keyof typeof requestedByStage,
	humanGateSatisfied = stage !== 'canary'
): Promise<void> {
	const gatePath = path.join(root, experimentRoot, 'review/test-gates', `${stage}.json`);
	const evidencePath = path.join(root, gateEvidencePath);
	await mkdir(path.dirname(gatePath), { recursive: true });
	if (stage === 'canary') {
		for (const repositoryPath of [
			...normalEvidencePaths,
			...normalTarget.references.map(({ path }) => path)
		])
			await copy(repositoryPath, root);
	} else {
		await mkdir(path.dirname(evidencePath), { recursive: true });
		await writeFile(evidencePath, `${JSON.stringify(gateEvidence, null, '\t')}\n`);
	}
	await writeFile(gatePath, `${JSON.stringify(gate(stage, humanGateSatisfied), null, '\t')}\n`);
}

function readyEventFixture(preflight: Awaited<ReturnType<typeof preflightWave>>) {
	const evidence = preflight.dispatchGateEvidence;
	if (!evidence?.gate || evidence.gate.schemaVersion !== 'affinity-wave-dispatch-gate-v2')
		throw new Error('Expected a structurally valid v2 test gate.');
	return AffinityWavePreflightSchema.parse({
		...preflight,
		status: 'ready',
		dispatchGateSatisfied: true,
		dispatchGateEvidence: { ...evidence, status: 'satisfied' }
	});
}

function event(
	runId: string,
	eventId: string,
	kind: AffinityWaveEvent['kind'],
	at: string,
	extra: Record<string, unknown> = {}
): AffinityWaveEvent {
	return {
		schemaVersion: 'affinity-wave-event-v1',
		eventId,
		runId,
		kind,
		at,
		...extra
	} as AffinityWaveEvent;
}

function v2PreflightFixture(preflight: ReturnType<typeof readyEventFixture>) {
	return AffinityWavePreflightSchema.parse({
		...preflight,
		schemaVersion: 'affinity-wave-preflight-v2',
		workloadId: 'final-pilot',
		sourcePlan: {
			path: `${preflight.runDirectory}/plan.json`,
			canonicalSha256: 'a'.repeat(64)
		},
		sourceAllocation: {
			path: `${experimentRoot}/review/wave-plans/allocation.json`,
			canonicalSha256: 'b'.repeat(64),
			allocationId: 'test-allocation'
		},
		concurrencySentinelActivationReceipt: null,
		jobs: preflight.jobs.map((job, index) => ({
			...job,
			allocationJobKey: `allocation-job-${index + 1}`,
			manifestState: 'live-unexecuted-breadth'
		}))
	});
}

function v2Event(
	preflight: ReturnType<typeof v2PreflightFixture>,
	sequence: number,
	eventId: string,
	kind: AffinityWaveEvent['kind'],
	at: string,
	extra: Record<string, unknown> = {}
): AffinityWaveEvent {
	return {
		schemaVersion: 'affinity-wave-event-v2',
		sequence,
		preflightCanonicalSha256: canonicalJsonSha256(preflight),
		recordedAt: `2026-08-29T20:00:${String(sequence).padStart(2, '0')}.000Z`,
		eventId,
		runId: preflight.runId,
		kind,
		at,
		...extra
	} as AffinityWaveEvent;
}

async function copy(relativePath: string, root: string): Promise<void> {
	const destination = path.join(root, relativePath);
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(path.join(process.cwd(), relativePath), destination);
}

async function copyAs(sourcePath: string, destinationPath: string, root: string): Promise<void> {
	const destination = path.join(root, destinationPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await copyFile(path.join(process.cwd(), sourcePath), destination);
}

async function copyResultAndRetainedImage(relativePath: string, root: string): Promise<void> {
	await copy(relativePath, root);
	const result = ImageProductionResultSchema.parse(
		JSON.parse(await readFile(path.join(process.cwd(), relativePath), 'utf8'))
	);
	const retained =
		result.status === 'candidate'
			? result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output
			: [...result.attempts].reverse().find((attempt) => attempt.output)?.output;
	if (retained) await copy(retained.path, root);
}

describe('affinity concurrency wave scheduler', () => {
	it('strictly validates the gated non-executable exact-concurrency allocation', async () => {
		const allocation = await readWaveAllocationSpec(
			process.cwd(),
			`${experimentRoot}/review/wave-plans/exact-concurrency-final-and-breadth-v1.json`
		);
		expect(allocation.executable).toBe(false);
		expect(allocation.stages.map(({ requestedConcurrency }) => requestedConcurrency)).toEqual([
			2, 4, 6, 8, 12, 16
		]);
		expect(
			allocation.stages
				.flatMap(({ jobs }) => jobs)
				.filter(({ manifestState }) => manifestState === 'future-sentinel')
		).toHaveLength(14);
		const scale = allocation.stages.find(({ stage }) => stage === 'scale')!;
		expect(scale.jobs).toHaveLength(16);
		expect(
			Object.fromEntries(
				['normal', 'wood', 'fire', 'metal', 'water', 'wind'].map((affinity) => [
					affinity,
					scale.jobs.filter((job) => job.affinity === affinity).length
				])
			)
		).toEqual({ normal: 3, wood: 3, fire: 3, metal: 3, water: 2, wind: 2 });
		expect(() =>
			AffinityWaveAllocationSpecSchema.parse({ ...allocation, executable: true })
		).toThrow();
	});

	it('blocks legacy plans without a hash-bound gate even when capacity is available', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-missing-gate-'));
		roots.push(root);
		const jobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		const legacyPlan = {
			...plan('canary', jobs)
		};
		delete (legacyPlan as Partial<AffinityWavePlan>).dispatchGate;
		const preflight = await preflightWave(root, legacyPlan, 3, '2026-08-29T20:00:00.000Z');
		expect(preflight).toMatchObject({ status: 'blocked-gate', dispatchGateSatisfied: false });
		expect(nextDispatchDecision(preflight, [])).toMatchObject({
			stop: true,
			reason: 'dispatch-gate-blocked'
		});
		expect(() =>
			validateEventJournal(preflight, [
				event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T20:00:01.000Z')
			])
		).toThrow(/require a ready preflight/u);
	});

	it('requires unique path-ordered v2 evidence bindings', () => {
		const binding = gate('canary').evidenceBindings[0]!;
		expect(
			AffinityWaveDispatchGateSchema.safeParse({
				...gate('canary'),
				evidenceBindings: [binding, binding]
			}).success
		).toBe(false);
		expect(
			AffinityWaveDispatchGateSchema.safeParse({
				...gate('canary'),
				evidenceBindings: [
					{ ...binding, path: `${experimentRoot}/review/z-last.json` },
					{ ...binding, path: `${experimentRoot}/review/a-first.json` }
				]
			}).success
		).toBe(false);
	});

	it('verifies every bound evidence hash before authorizing dispatch', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-evidence-gate-'));
		roots.push(root);
		const jobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs, 'verified-evidence-canary'),
			3,
			'2026-08-29T20:00:00.000Z'
		);
		expect(preflight).toMatchObject({
			status: 'ready',
			dispatchGateSatisfied: true,
			dispatchGateEvidence: {
				status: 'satisfied'
			}
		});
		expect(preflight.dispatchGateEvidence?.evidenceChecks).toHaveLength(3);
		expect(
			preflight.dispatchGateEvidence?.evidenceChecks?.every(({ status }) => status === 'verified')
		).toBe(true);
	});

	it('reports missing and stale bound evidence explicitly', async () => {
		const jobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const expectedStatus of ['missing-evidence', 'stale-evidence'] as const) {
			const root = await mkdtemp(path.join(tmpdir(), `affinity-wave-${expectedStatus}-`));
			roots.push(root);
			for (const job of jobs) {
				await copy(job.targetPath, root);
				await copy(job.assignmentPath, root);
			}
			const gatePath = path.join(root, experimentRoot, 'review/test-gates/canary.json');
			await mkdir(path.dirname(gatePath), { recursive: true });
			await writeFile(gatePath, `${JSON.stringify(gate('canary'), null, '\t')}\n`);
			if (expectedStatus === 'stale-evidence') {
				for (const repositoryPath of normalEvidencePaths) await copy(repositoryPath, root);
				const evidencePath = path.join(root, normalDryRunPath);
				await mkdir(path.dirname(evidencePath), { recursive: true });
				await writeFile(evidencePath, '{"status":"changed"}\n');
			}
			const preflight = await preflightWave(
				root,
				plan('canary', jobs, `${expectedStatus}-canary`),
				3,
				'2026-08-29T20:00:00.000Z'
			);
			expect(preflight).toMatchObject({
				status: 'blocked-gate',
				dispatchGateSatisfied: false,
				dispatchGateEvidence: {
					status: expectedStatus
				}
			});
			expect(
				preflight.dispatchGateEvidence?.evidenceChecks?.some(
					({ status }) => status === (expectedStatus === 'missing-evidence' ? 'missing' : 'stale')
				)
			).toBe(true);
		}
	});

	it('binds every admitted manifest hash and rejects post-preflight manifest drift', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-manifest-binding-'));
		roots.push(root);
		const jobs = [manifestJob('death-knight', 'normal'), manifestJob('death-knight', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs, 'canary-manifest-binding'),
			3,
			'2026-08-29T20:00:00.000Z'
		);
		expect(preflight.status).toBe('ready');
		expect(
			preflight.jobs.every(
				(job) =>
					job.targetCanonicalSha256?.length === 64 && job.assignmentCanonicalSha256?.length === 64
			)
		).toBe(true);
		await expect(verifyCurrentWavePreflight(root, preflight)).resolves.toEqual(preflight);
		const targetPath = path.join(root, jobs[0]!.targetPath);
		const target = JSON.parse(await readFile(targetPath, 'utf8')) as {
			presentation: { composition: string };
		};
		target.presentation.composition = `${target.presentation.composition} drift`;
		await writeFile(targetPath, `${JSON.stringify(target, null, '\t')}\n`);
		await expect(verifyCurrentWavePreflight(root, preflight)).rejects.toThrow(
			/Scheduled manifest changed after preflight/u
		);
		await expect(
			recordEventExclusive(
				root,
				preflight,
				event(
					preflight.runId,
					'wave-started-after-drift',
					'wave-started',
					'2026-08-29T20:00:01.000Z'
				)
			)
		).rejects.toThrow(/Scheduled manifest changed after preflight/u);
	});

	it.each([
		['canary', { profile: 'normal-canary' }, false, []],
		['canary', { profile: 'final-canary' }, true, []],
		[
			'breadth',
			{ profile: 'breadth', prerequisiteRunId: 'eligible-preceding-run' },
			true,
			['eligible-preceding-run']
		],
		[
			'pilot',
			{ profile: 'load', requestedConcurrency: 4, prerequisiteRunId: 'eligible-preceding-run' },
			true,
			['eligible-preceding-run']
		],
		[
			'load',
			{ profile: 'load', requestedConcurrency: 12, prerequisiteRunId: 'eligible-preceding-run' },
			true,
			['eligible-preceding-run']
		],
		[
			'scale',
			{ profile: 'load', requestedConcurrency: 16, prerequisiteRunId: 'eligible-preceding-run' },
			true,
			['eligible-preceding-run']
		]
	] as const)(
		'rejects arbitrary hash-valid JSON for the %s derived profile',
		async (stage, derivation, humanGateSatisfied, prerequisiteRunIds) => {
			const root = await mkdtemp(path.join(tmpdir(), `affinity-wave-adversarial-${stage}-`));
			roots.push(root);
			const jobs = [
				manifestJob('death-knight', 'normal'),
				manifestJob('death-knight', 'wood'),
				manifestJob('elemental', 'fire'),
				manifestJob('elemental', 'metal'),
				manifestJob('gray-wolf', 'water'),
				manifestJob('gray-wolf', 'wind'),
				manifestJob('cave-bear', 'normal'),
				manifestJob('cave-bear', 'fire'),
				manifestJob('goblin', 'wood'),
				manifestJob('goblin', 'metal'),
				manifestJob('tunnel-boar', 'water'),
				manifestJob('tunnel-boar', 'wind'),
				manifestJob('cave-drake', 'normal'),
				manifestJob('cave-drake', 'wood'),
				manifestJob('tower-basilisk', 'fire'),
				manifestJob('tower-basilisk', 'metal')
			].slice(0, requestedByStage[stage]);
			for (const job of jobs) {
				await copy(job.targetPath, root);
				await copy(job.assignmentPath, root);
			}
			await copy('package.json', root);
			const packageValue = JSON.parse(
				await readFile(path.resolve('package.json'), 'utf8')
			) as unknown;
			const canonicalGateId =
				derivation.profile === 'normal-canary'
					? 'normal-canary-dispatch-v2'
					: derivation.profile === 'final-canary'
						? 'final-controlled-canary-dispatch-v2'
						: `${derivation.profile === 'breadth' ? 'breadth' : `load-${derivation.requestedConcurrency}`}-after-${createHash(
								'sha256'
							)
								.update(derivation.prerequisiteRunId)
								.digest('hex')
								.slice(0, 12)}-dispatch-v2`;
			const adversarialGate = AffinityWaveDispatchGateSchema.parse({
				schemaVersion: 'affinity-wave-dispatch-gate-v2',
				gateId: canonicalGateId,
				experimentId: 'affinity-workflow-v1',
				status: 'authorized',
				authorizedStage: stage,
				qualityGateSatisfied: true,
				humanGateSatisfied,
				prerequisiteRunIds,
				derivation,
				promotionEvidence: gate(stage).promotionEvidence,
				evidenceBindings: [
					{ path: 'package.json', canonicalSha256: canonicalJsonSha256(packageValue) }
				]
			});
			const artifactPath = `${experimentRoot}/review/test-gates/${stage}-adversarial.json`;
			await mkdir(path.dirname(path.join(root, artifactPath)), { recursive: true });
			await writeFile(
				path.join(root, artifactPath),
				`${JSON.stringify(adversarialGate, null, '\t')}\n`
			);
			const adversarialPlan = AffinityWavePlanSchema.parse({
				...plan(stage, jobs, `${stage}-arbitrary-json`),
				dispatchGate: {
					artifactPath,
					canonicalSha256: canonicalJsonSha256(adversarialGate)
				}
			});
			const preflight = await preflightWave(
				root,
				adversarialPlan,
				requestedByStage[stage] + 1,
				'2026-08-29T20:00:00.000Z'
			);
			expect(preflight).toMatchObject({
				status: 'blocked-gate',
				dispatchGateSatisfied: false,
				dispatchGateEvidence: { status: 'semantic-evidence-invalid' }
			});
		}
	);

	it('reads a legacy v1 gate as blocked evidence but never authorizes it', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-legacy-gate-'));
		roots.push(root);
		const jobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		const legacyGate = {
			schemaVersion: 'affinity-wave-dispatch-gate-v1',
			gateId: 'legacy-canary-gate',
			experimentId: 'affinity-workflow-v1',
			status: 'authorized',
			authorizedStage: 'canary',
			qualityGateSatisfied: true,
			humanGateSatisfied: true,
			prerequisiteRunIds: [],
			evidencePaths: [gateEvidencePath]
		};
		const artifactPath = `${experimentRoot}/review/test-gates/legacy-canary.json`;
		const gatePath = path.join(root, artifactPath);
		await mkdir(path.dirname(gatePath), { recursive: true });
		await writeFile(gatePath, `${JSON.stringify(legacyGate, null, '\t')}\n`);
		const legacyPlan = AffinityWavePlanSchema.parse({
			...plan('canary', jobs, 'legacy-v1-canary'),
			dispatchGate: {
				artifactPath,
				canonicalSha256: canonicalJsonSha256(legacyGate)
			}
		});
		const preflight = await preflightWave(root, legacyPlan, 3, '2026-08-29T20:00:00.000Z');
		expect(preflight).toMatchObject({
			status: 'blocked-gate',
			dispatchGateSatisfied: false,
			dispatchGateEvidence: { status: 'legacy-gate-not-authorizing' }
		});
		expect(AffinityWavePreflightSchema.safeParse(preflight).success).toBe(true);
		const historicalBlocked = {
			...preflight,
			status: 'blocked-capacity' as const,
			dispatchGateSatisfied: true,
			dispatchGateEvidence: {
				status: 'satisfied' as const,
				artifactPath,
				expectedCanonicalSha256: canonicalJsonSha256(legacyGate),
				observedCanonicalSha256: canonicalJsonSha256(legacyGate),
				gate: legacyGate
			}
		};
		expect(AffinityWavePreflightSchema.safeParse(historicalBlocked).success).toBe(true);
		expect(
			AffinityWavePreflightSchema.safeParse({ ...historicalBlocked, status: 'ready' }).success
		).toBe(false);
	});

	it('requires a human gate for final-controlled targets while allowing generic pre-human canaries', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-human-gate-'));
		roots.push(root);
		const genericJobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const job of genericJobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary', false);
		const preHumanGate = gate('canary', false);
		const genericPlan = AffinityWavePlanSchema.parse({
			...plan('canary', genericJobs, 'generic-pre-human-canary'),
			dispatchGate: {
				artifactPath: `${experimentRoot}/review/test-gates/canary.json`,
				canonicalSha256: canonicalJsonSha256(preHumanGate)
			}
		});
		await expect(
			preflightWave(root, genericPlan, 3, '2026-08-29T20:00:00.000Z')
		).resolves.toMatchObject({ status: 'ready', dispatchGateSatisfied: true });

		const finalJobs = [
			{
				targetPath: `${experimentRoot}/targets/final-controlled/death-knight/normal-v4.json`,
				assignmentPath: `${experimentRoot}/assignments/final-controlled/death-knight/normal-v4.json`
			},
			{
				targetPath: `${experimentRoot}/targets/final-controlled/death-knight/fire-v4.json`,
				assignmentPath: `${experimentRoot}/assignments/final-controlled/death-knight/fire-v4.json`
			}
		];
		await copyAs(
			`${experimentRoot}/targets/death-knight/normal.json`,
			finalJobs[0]!.targetPath,
			root
		);
		await copyAs(
			`${experimentRoot}/assignments/death-knight/normal.json`,
			finalJobs[0]!.assignmentPath,
			root
		);
		await copyAs(
			`${experimentRoot}/targets/death-knight/fire.json`,
			finalJobs[1]!.targetPath,
			root
		);
		await copyAs(
			`${experimentRoot}/assignments/death-knight/fire.json`,
			finalJobs[1]!.assignmentPath,
			root
		);
		const finalPlan = AffinityWavePlanSchema.parse({
			...plan('canary', finalJobs, 'final-controlled-human-gated-canary'),
			dispatchGate: genericPlan.dispatchGate
		});
		const finalPreflight = await preflightWave(root, finalPlan, 3, '2026-08-29T20:00:00.000Z');
		expect(finalPreflight).toMatchObject({
			status: 'blocked-gate',
			dispatchGateSatisfied: false,
			dispatchGateEvidence: { status: 'human-gate-required' }
		});
	});
	it('records requested versus admitted capacity and blocks a degraded concurrency run', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-degraded-capacity-'));
		roots.push(root);
		const jobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs),
			2,
			'2026-08-29T20:00:00.000Z'
		);

		expect(preflight).toMatchObject({
			status: 'blocked-capacity',
			requestedConcurrency: 2,
			availableAgentSlots: 2,
			reservedOrchestratorSlots: 1,
			admittedWorkerCapacity: 1,
			exactConcurrencyReady: false,
			collisionPaths: []
		});
		expect(nextDispatchDecision(preflight, [])).toMatchObject({
			stop: true,
			reason: 'capacity-preflight-blocked',
			launchTargetIds: []
		});
	});

	it('blocks pre-existing target outputs instead of overwriting immutable evidence', async () => {
		const preflight = await preflightWave(
			process.cwd(),
			plan('canary', [manifestJob('death-knight', 'normal'), manifestJob('death-knight', 'fire')]),
			3,
			'2026-08-29T20:00:00.000Z'
		);

		expect(preflight.status).toBe('blocked-output-collision');
		expect(preflight.collisionPaths).toContain(
			`${experimentRoot}/results/death-knight-normal-v1.json`
		);
		expect(nextDispatchDecision(preflight, [])).toMatchObject({
			stop: true,
			reason: 'output-collision'
		});
	});

	it('enforces the representative scale mix of two targets per species and even affinities', async () => {
		const balancedJobs = [
			manifestJob('death-knight', 'normal'),
			manifestJob('death-knight', 'wood'),
			manifestJob('elemental', 'fire'),
			manifestJob('elemental', 'metal'),
			manifestJob('gray-wolf', 'water'),
			manifestJob('gray-wolf', 'wind'),
			manifestJob('cave-bear', 'normal'),
			manifestJob('cave-bear', 'fire'),
			manifestJob('goblin', 'wood'),
			manifestJob('goblin', 'metal'),
			manifestJob('tunnel-boar', 'water'),
			manifestJob('tunnel-boar', 'wind'),
			manifestJob('cave-drake', 'normal'),
			manifestJob('cave-drake', 'wood'),
			manifestJob('tower-basilisk', 'fire'),
			manifestJob('tower-basilisk', 'metal')
		];
		const preflight = await preflightWave(
			process.cwd(),
			plan('scale', balancedJobs),
			17,
			'2026-08-29T20:00:00.000Z'
		);

		expect(preflight.requestedConcurrency).toBe(16);
		expect(preflight.admittedWorkerCapacity).toBe(16);
		expect(preflight.jobs).toHaveLength(16);
		for (const speciesId of [
			'death-knight',
			'elemental',
			'gray-wolf',
			'cave-bear',
			'goblin',
			'tunnel-boar',
			'cave-drake',
			'tower-basilisk'
		]) {
			expect(preflight.jobs.filter((job) => job.speciesId === speciesId)).toHaveLength(2);
		}

		const skewedJobs = [
			'death-knight',
			'elemental',
			'gray-wolf',
			'cave-bear',
			'goblin',
			'tunnel-boar',
			'cave-drake',
			'tower-basilisk'
		].flatMap((species) => [manifestJob(species, 'normal'), manifestJob(species, 'wood')]);
		await expect(
			preflightWave(
				process.cwd(),
				plan('scale', skewedJobs, 'scale-skewed'),
				17,
				'2026-08-29T20:00:00.000Z'
			)
		).rejects.toThrow(/affinities must be distributed evenly/u);
	});

	it('admits only free workers and permanently stops the wave at three capacity failures', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-capacity-stop-rule-'));
		roots.push(root);
		const jobs = [
			manifestJob('goblin', 'normal'),
			manifestJob('goblin', 'wood'),
			manifestJob('goblin', 'fire'),
			manifestJob('goblin', 'metal')
		];
		for (const job of jobs) await copy(job.targetPath, root);
		for (const job of jobs) await copy(job.assignmentPath, root);
		await writeGate(root, 'pilot');
		const preflight = readyEventFixture(
			await preflightWave(root, plan('pilot', jobs), 5, '2026-08-29T20:00:00.000Z')
		);
		const started = event(
			preflight.runId,
			'wave-started',
			'wave-started',
			'2026-08-29T20:00:01.000Z'
		);
		expect(nextDispatchDecision(preflight, [started]).launchTargetIds).toHaveLength(4);
		const sameTimestampDispatch = event(
			preflight.runId,
			'dispatch-at-wave-start',
			'job-dispatched',
			started.at,
			{
				targetId: preflight.jobs[0]!.targetId,
				workerId: 'worker-at-wave-start'
			}
		);
		expect(
			validateEventJournal(preflight, [sameTimestampDispatch, started]).activeTargets.size
		).toBe(1);
		expect(() =>
			validateEventJournal(preflight, [
				started,
				sameTimestampDispatch,
				event(preflight.runId, 'duplicate-active-worker', 'job-dispatched', started.at, {
					targetId: preflight.jobs[1]!.targetId,
					workerId: 'worker-at-wave-start'
				})
			])
		).toThrow(/already active/u);

		const failures = preflight.jobs.slice(0, 3).map((job, index) =>
			event(
				preflight.runId,
				`capacity-failure-${index + 1}`,
				'worker-failure',
				`2026-08-29T20:00:0${index + 2}.000Z`,
				{
					targetId: job.targetId,
					workerId: null,
					failureKind: 'capacity',
					detail: 'Spawn capacity unavailable.'
				}
			)
		);
		expect(nextDispatchDecision(preflight, [started, ...failures])).toMatchObject({
			stop: true,
			reason: 'capacity-stop-rule',
			capacityFailureCount: 3,
			launchTargetIds: []
		});
		const illegalDispatch = event(
			preflight.runId,
			'illegal-dispatch',
			'job-dispatched',
			'2026-08-29T20:00:06.000Z',
			{
				targetId: preflight.jobs[3]!.targetId,
				workerId: 'worker-4'
			}
		);
		expect(() => validateEventJournal(preflight, [started, ...failures, illegalDispatch])).toThrow(
			/after the capacity stop rule/u
		);
	});

	it('uses recorder sequence to replay same-timestamp v2 worker reuse deterministically', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-v2-journal-order-'));
		roots.push(root);
		const jobs = [
			manifestJob('goblin', 'normal'),
			manifestJob('goblin', 'wood'),
			manifestJob('goblin', 'fire'),
			manifestJob('goblin', 'metal')
		];
		for (const job of jobs) await copy(job.targetPath, root);
		for (const job of jobs) await copy(job.assignmentPath, root);
		await writeGate(root, 'pilot');
		const preflight = v2PreflightFixture(
			readyEventFixture(
				await preflightWave(
					root,
					plan('pilot', jobs, 'pilot-v2-sequenced-events'),
					5,
					'2026-08-29T20:00:00.000Z'
				)
			)
		);
		const at = '2026-08-29T20:00:10.000Z';
		const [first, second] = preflight.jobs;
		const events = [
			v2Event(preflight, 0, 'wave-started', 'wave-started', at),
			v2Event(preflight, 1, 'dispatch-first', 'job-dispatched', at, {
				targetId: first!.targetId,
				workerId: 'reused-worker'
			}),
			v2Event(preflight, 2, 'finish-first', 'job-finished', at, {
				targetId: first!.targetId,
				workerId: 'reused-worker'
			}),
			v2Event(preflight, 3, 'dispatch-second', 'job-dispatched', at, {
				targetId: second!.targetId,
				workerId: 'reused-worker'
			})
		];
		const state = validateEventJournal(preflight, [...events].reverse());
		expect(state.activeTargets).toEqual(new Set([second!.targetId]));
		expect(state.maximumActiveWorkerCount).toBe(1);

		expect(() =>
			validateEventJournal(preflight, [
				events[0],
				events[1],
				v2Event(preflight, 2, 'dispatch-second-before-finish', 'job-dispatched', at, {
					targetId: second!.targetId,
					workerId: 'reused-worker'
				}),
				v2Event(preflight, 3, 'finish-first-after-reuse', 'job-finished', at, {
					targetId: first!.targetId,
					workerId: 'reused-worker'
				})
			])
		).toThrow(/already active/u);
		expect(() =>
			validateEventJournal(preflight, [{ ...events[0], preflightCanonicalSha256: 'c'.repeat(64) }])
		).toThrow(/preflight binding/u);
		expect(() =>
			validateEventJournal(preflight, [event(preflight.runId, 'legacy-start', 'wave-started', at)])
		).toThrow(/require a sequence-bound v2 event journal/u);
	});

	it('combines stop pressure while keeping agent capacity and provider throttles distinct', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-mixed-pressure-'));
		roots.push(root);
		const jobs = [
			manifestJob('goblin', 'normal'),
			manifestJob('goblin', 'wood'),
			manifestJob('goblin', 'fire'),
			manifestJob('goblin', 'metal')
		];
		for (const job of jobs) await copy(job.targetPath, root);
		for (const job of jobs) await copy(job.assignmentPath, root);
		await writeGate(root, 'pilot');
		const preflight = readyEventFixture(
			await preflightWave(
				root,
				plan('pilot', jobs, 'pilot-mixed-pressure'),
				5,
				'2026-08-29T20:00:00.000Z'
			)
		);
		const [throttled, capacityOne, capacityTwo] = preflight.jobs;
		const events = [
			event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T20:00:01.000Z'),
			event(preflight.runId, 'dispatch-throttled', 'job-dispatched', '2026-08-29T20:00:02.000Z', {
				targetId: throttled!.targetId,
				workerId: 'worker-throttled'
			}),
			event(preflight.runId, 'provider-throttle', 'worker-failure', '2026-08-29T20:00:03.000Z', {
				targetId: throttled!.targetId,
				workerId: 'worker-throttled',
				failureKind: 'provider-throttle',
				detail: 'Image provider throttled the admitted worker.'
			}),
			event(preflight.runId, 'capacity-failure-one', 'worker-failure', '2026-08-29T20:00:04.000Z', {
				targetId: capacityOne!.targetId,
				workerId: null,
				failureKind: 'capacity',
				detail: 'Agent admission failed.'
			}),
			event(preflight.runId, 'capacity-failure-two', 'worker-failure', '2026-08-29T20:00:05.000Z', {
				targetId: capacityTwo!.targetId,
				workerId: null,
				failureKind: 'capacity',
				detail: 'Agent admission failed.'
			})
		];
		expect(nextDispatchDecision(preflight, events)).toMatchObject({
			stop: true,
			reason: 'capacity-stop-rule',
			capacityFailureCount: 2,
			providerThrottleCount: 1,
			stopFailureCount: 3
		});
		const report = await buildWaveReport(
			root,
			preflight,
			[
				...events,
				event(preflight.runId, 'wave-finished', 'wave-finished', '2026-08-29T20:00:06.000Z')
			],
			'2026-08-29T20:00:07.000Z'
		);
		expect(report).toMatchObject({
			status: 'stopped-capacity',
			capacityFailureCount: 2,
			providerThrottleCount: 1,
			stageMetrics: null
		});
	});

	it('stops new launches after three timeout or malformed-output failures', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-quality-stop-rule-'));
		roots.push(root);
		const jobs = [
			manifestJob('goblin', 'normal'),
			manifestJob('goblin', 'wood'),
			manifestJob('goblin', 'fire'),
			manifestJob('goblin', 'metal')
		];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'pilot');
		const preflight = readyEventFixture(
			await preflightWave(
				root,
				plan('pilot', jobs, 'pilot-timeout-malformed-stop'),
				5,
				'2026-08-29T20:00:00.000Z'
			)
		);
		const events: AffinityWaveEvent[] = [
			event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T20:00:01.000Z')
		];
		for (const [index, failureKind] of ['timeout', 'malformed-output', 'timeout'].entries()) {
			const job = preflight.jobs[index]!;
			const workerId = `worker-${index}`;
			events.push(
				event(
					preflight.runId,
					`dispatch-${index}`,
					'job-dispatched',
					`2026-08-29T20:00:0${index * 2 + 2}.000Z`,
					{ targetId: job.targetId, workerId }
				),
				event(
					preflight.runId,
					`failure-${index}`,
					'worker-failure',
					`2026-08-29T20:00:0${index * 2 + 3}.000Z`,
					{
						targetId: job.targetId,
						workerId,
						failureKind,
						detail: `Worker ended with ${failureKind}.`
					}
				)
			);
		}
		expect(nextDispatchDecision(preflight, events)).toMatchObject({
			stop: true,
			reason: 'capacity-stop-rule',
			capacityFailureCount: 0,
			providerThrottleCount: 0,
			stopFailureCount: 3,
			launchTargetIds: []
		});
		expect(() =>
			validateEventJournal(preflight, [
				...events,
				event(
					preflight.runId,
					'illegal-after-quality-stop',
					'job-dispatched',
					'2026-08-29T20:00:09.000Z',
					{ targetId: preflight.jobs[3]!.targetId, workerId: 'worker-3' }
				)
			])
		).toThrow(/after the capacity stop rule/u);
	});

	it('derives candidate, retry, timing, speedup, efficiency, and worker metrics from results', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-report-'));
		roots.push(root);
		const jobs = [manifestJob('death-knight', 'normal'), manifestJob('death-knight', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs, 'canary-report'),
			3,
			'2026-08-29T17:05:00.000Z'
		);
		expect(preflight.status).toBe('ready');
		for (const resultPath of [
			`${experimentRoot}/results/death-knight-normal-v1.json`,
			`${experimentRoot}/results/death-knight-fire-v1.json`
		]) {
			await copyResultAndRetainedImage(resultPath, root);
		}
		const [normal, fire] = preflight.jobs;
		const events = [
			event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T17:05:28.910Z'),
			event(preflight.runId, 'dispatch-normal', 'job-dispatched', '2026-08-29T17:05:28.910Z', {
				targetId: normal!.targetId,
				workerId: 'worker-normal'
			}),
			event(preflight.runId, 'dispatch-fire', 'job-dispatched', '2026-08-29T17:06:03.838Z', {
				targetId: fire!.targetId,
				workerId: 'worker-fire'
			}),
			event(preflight.runId, 'finish-normal', 'job-finished', '2026-08-29T17:08:17.613Z', {
				targetId: normal!.targetId,
				workerId: 'worker-normal'
			}),
			event(preflight.runId, 'finish-fire', 'job-finished', '2026-08-29T17:09:26.522Z', {
				targetId: fire!.targetId,
				workerId: 'worker-fire'
			}),
			event(preflight.runId, 'wave-finished', 'wave-finished', '2026-08-29T17:09:26.522Z')
		];
		const report = await buildWaveReport(root, preflight, events, '2026-08-29T17:10:00.000Z');

		expect(report).toMatchObject({
			status: 'completed',
			requestedConcurrency: 2,
			admittedWorkerCapacity: 2,
			effectiveConcurrency: 2,
			workerCount: 2,
			candidateCount: 2,
			reviseCount: 0,
			failedCount: 0,
			retryCount: 2,
			retriedTargetCount: 2,
			retryRate: 1,
			generationMedianMs: 25_527.5,
			generationP90Ms: null,
			waveWallTimeMs: 237_612,
			summedJobTimeMs: 371_387,
			provenanceCompletenessRate: 1
		});
		expect(report.effectiveSpeedup).toBeCloseTo(1.563, 3);
		expect(report.parallelEfficiency).toBeCloseTo(0.7815, 4);
		expect(report.stageMetrics).toMatchObject({
			stage: 'canary',
			plannedParallelJobs: 2,
			effectiveParallelJobs: 2,
			candidateCount: 2,
			retryCount: 2
		});
	});

	it('counts dispatches before terminals at the same timestamp', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-tied-events-'));
		roots.push(root);
		const jobs = [manifestJob('death-knight', 'normal'), manifestJob('death-knight', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs, 'canary-tied-events'),
			3,
			'2026-08-29T17:00:00.000Z'
		);
		await copyResultAndRetainedImage(`${experimentRoot}/results/death-knight-normal-v1.json`, root);
		await copyResultAndRetainedImage(`${experimentRoot}/results/death-knight-fire-v1.json`, root);
		const tiedAt = '2026-08-29T18:00:00.000Z';
		const events: AffinityWaveEvent[] = [
			event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T17:59:59.000Z')
		];
		for (const [index, job] of preflight.jobs.entries()) {
			events.push(
				event(preflight.runId, `dispatch-${index}`, 'job-dispatched', tiedAt, {
					targetId: job.targetId,
					workerId: `worker-${index}`
				}),
				event(preflight.runId, `finish-${index}`, 'job-finished', tiedAt, {
					targetId: job.targetId,
					workerId: `worker-${index}`
				})
			);
		}
		events.push(event(preflight.runId, 'wave-finished', 'wave-finished', tiedAt));
		const report = await buildWaveReport(root, preflight, events, tiedAt);
		expect(report.effectiveConcurrency).toBe(2);
	});

	it('maps only image-provider refusal into concurrency-stage throttleCount', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-provider-throttle-'));
		roots.push(root);
		const jobs = [manifestJob('death-knight', 'normal'), manifestJob('death-knight', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs, 'canary-provider-throttle'),
			3,
			'2026-08-29T17:05:00.000Z'
		);
		await copyResultAndRetainedImage(`${experimentRoot}/results/death-knight-normal-v1.json`, root);
		const [normal, fire] = preflight.jobs;
		const events = [
			event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T17:05:28.910Z'),
			event(preflight.runId, 'dispatch-normal', 'job-dispatched', '2026-08-29T17:05:28.910Z', {
				targetId: normal!.targetId,
				workerId: 'worker-normal'
			}),
			event(preflight.runId, 'dispatch-fire', 'job-dispatched', '2026-08-29T17:06:03.838Z', {
				targetId: fire!.targetId,
				workerId: 'worker-fire'
			}),
			event(preflight.runId, 'finish-normal', 'job-finished', '2026-08-29T17:08:17.613Z', {
				targetId: normal!.targetId,
				workerId: 'worker-normal'
			}),
			event(
				preflight.runId,
				'provider-throttle-fire',
				'worker-failure',
				'2026-08-29T17:08:20.000Z',
				{
					targetId: fire!.targetId,
					workerId: 'worker-fire',
					failureKind: 'provider-throttle',
					detail: 'The image backend refused the admitted request.'
				}
			),
			event(preflight.runId, 'wave-finished', 'wave-finished', '2026-08-29T17:08:20.000Z')
		];
		const report = await buildWaveReport(root, preflight, events, '2026-08-29T17:09:00.000Z');

		expect(report).toMatchObject({
			status: 'completed',
			candidateCount: 1,
			failedCount: 1,
			capacityFailureCount: 0,
			providerThrottleCount: 1,
			stageMetrics: {
				throttleCount: 1,
				failedCount: 1,
				missingResultCount: 1,
				provenanceCompletenessRate: 0.5
			}
		});
	});

	it('records a capacity-stopped wave without fabricating image performance metrics', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-stop-'));
		roots.push(root);
		const jobs = [
			manifestJob('goblin', 'normal'),
			manifestJob('goblin', 'wood'),
			manifestJob('goblin', 'fire'),
			manifestJob('goblin', 'metal')
		];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'pilot');
		const preflight = readyEventFixture(
			await preflightWave(
				root,
				plan('pilot', jobs, 'pilot-capacity-stop'),
				5,
				'2026-08-29T20:00:00.000Z'
			)
		);
		const events = [
			event(preflight.runId, 'wave-started', 'wave-started', '2026-08-29T20:00:01.000Z'),
			...preflight.jobs.slice(0, 3).map((job, index) =>
				event(
					preflight.runId,
					`capacity-failure-${index + 1}`,
					'worker-failure',
					`2026-08-29T20:00:0${index + 2}.000Z`,
					{
						targetId: job.targetId,
						workerId: null,
						failureKind: 'capacity',
						detail: 'Spawn capacity unavailable.'
					}
				)
			),
			event(preflight.runId, 'wave-finished', 'wave-finished', '2026-08-29T20:00:06.000Z')
		];
		const report = await buildWaveReport(root, preflight, events, '2026-08-29T20:00:07.000Z');

		expect(report).toMatchObject({
			status: 'stopped-capacity',
			requestedConcurrency: 4,
			admittedWorkerCapacity: 4,
			effectiveConcurrency: 0,
			workerCount: 0,
			terminalCount: 3,
			unlaunchedCount: 1,
			failedCount: 3,
			capacityFailureCount: 3,
			generationMedianMs: null,
			summedJobTimeMs: null,
			effectiveSpeedup: null,
			parallelEfficiency: null,
			stageMetrics: null,
			stopRule: { triggered: true, triggeredAt: '2026-08-29T20:00:04.000Z' }
		});
	});

	it('exclusive-creates preflight and event evidence', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-exclusive-'));
		roots.push(root);
		const jobs = [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')];
		for (const job of jobs) {
			await copy(job.targetPath, root);
			await copy(job.assignmentPath, root);
		}
		await writeGate(root, 'canary');
		const preflight = await preflightWave(
			root,
			plan('canary', jobs, 'canary-exclusive'),
			3,
			'2026-08-29T20:00:00.000Z'
		);
		const preflightPath = await writePreflightExclusive(root, preflight);
		await expect(writePreflightExclusive(root, preflight)).rejects.toMatchObject({
			code: 'EEXIST'
		});
		const started = event(
			preflight.runId,
			'wave-started',
			'wave-started',
			'2026-08-29T20:00:01.000Z'
		);
		const eventPath = await recordEventExclusive(root, preflight, started);
		await expect(recordEventExclusive(root, preflight, started)).rejects.toThrow(
			/Wave event IDs must be unique/u
		);
		expect(JSON.parse(await readFile(path.join(root, preflightPath), 'utf8'))).toMatchObject({
			runId: preflight.runId,
			status: 'ready'
		});
		expect(eventPath).toBe(`${preflight.runDirectory}/events/wave-started.json`);
	});
});
