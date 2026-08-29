import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	AffinityWavePlanSchema,
	AffinityWaveAllocationSpecSchema,
	buildWaveReport,
	canonicalJsonSha256,
	nextDispatchDecision,
	preflightWave,
	recordEventExclusive,
	readWaveAllocationSpec,
	validateEventJournal,
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

function gate(stage: keyof typeof requestedByStage, humanGateSatisfied = true) {
	return {
		schemaVersion: 'affinity-wave-dispatch-gate-v1' as const,
		gateId: `${stage}-test-gate`,
		experimentId: 'affinity-workflow-v1' as const,
		status: 'authorized' as const,
		authorizedStage: stage,
		qualityGateSatisfied: true as const,
		humanGateSatisfied,
		prerequisiteRunIds: stage === 'canary' ? [] : ['eligible-preceding-run'],
		evidencePaths: [`${experimentRoot}/review/evaluation.json`]
	};
}

async function writeGate(
	root: string,
	stage: keyof typeof requestedByStage,
	humanGateSatisfied = true
): Promise<void> {
	const gatePath = path.join(root, experimentRoot, 'review/test-gates', `${stage}.json`);
	await mkdir(path.dirname(gatePath), { recursive: true });
	await writeFile(gatePath, `${JSON.stringify(gate(stage, humanGateSatisfied), null, '\t')}\n`);
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
		const legacyPlan = {
			...plan('canary', [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')])
		};
		delete (legacyPlan as Partial<AffinityWavePlan>).dispatchGate;
		const preflight = await preflightWave(process.cwd(), legacyPlan, 3, '2026-08-29T20:00:00.000Z');
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
		const preflight = await preflightWave(
			process.cwd(),
			plan('canary', [manifestJob('goblin', 'normal'), manifestJob('goblin', 'fire')]),
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
			manifestJob('grey-wolf', 'water'),
			manifestJob('grey-wolf', 'wind'),
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
			'grey-wolf',
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
			'grey-wolf',
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
		const preflight = await preflightWave(root, plan('pilot', jobs), 5, '2026-08-29T20:00:00.000Z');
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
		const preflight = await preflightWave(
			root,
			plan('pilot', jobs, 'pilot-mixed-pressure'),
			5,
			'2026-08-29T20:00:00.000Z'
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
			await copy(resultPath, root);
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
		await copy(`${experimentRoot}/results/death-knight-normal-v1.json`, root);
		await copy(`${experimentRoot}/results/death-knight-fire-v1.json`, root);
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
		await copy(`${experimentRoot}/results/death-knight-normal-v1.json`, root);
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
		const preflight = await preflightWave(
			root,
			plan('pilot', jobs, 'pilot-capacity-stop'),
			5,
			'2026-08-29T20:00:00.000Z'
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
