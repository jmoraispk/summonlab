import {
	lstat,
	mkdtemp,
	readFile,
	readdir,
	rename,
	rm,
	stat,
	symlink,
	unlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentRunActivationSchema,
	EquipmentRunEventSchema,
	EquipmentRunPlanSchema,
	type EquipmentRunEventRequest
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';
import { replayEquipmentRunJournal } from './equipment-image-run-journal.js';
import {
	buildEquipmentRunJournalContext,
	claimNextEquipmentJobs,
	recordEquipmentRunEvent
} from './equipment-image-run-recorder.js';
import { DEFAULT_EQUIPMENT_RUN_ID, activateEquipmentRun } from './equipment-image-run-readiness.js';
import { makeCleanEquipmentTestWorkspace } from './equipment-test-workspace.js';

const SOURCE_WORKSPACE_ROOT = process.cwd();
const RUN_DIRECTORY = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${DEFAULT_EQUIPMENT_RUN_ID}`;
const EVENTS_DIRECTORY = `${RUN_DIRECTORY}/events`;
const LOCK_PATH = `${RUN_DIRECTORY}/.journal.lock`;
const PLAN_PATH = `${RUN_DIRECTORY}/plan.json`;
const ACTIVATION_PATH = `${RUN_DIRECTORY}/activation.json`;
const CREATED_AT = '2026-09-01T23:15:00.000Z';
const ACTIVATED_AT = '2026-09-01T23:16:00.000Z';
const fixtureRoots: string[] = [];

function absolute(workspaceRoot: string, repositoryPath: string): string {
	return path.join(workspaceRoot, ...repositoryPath.split('/'));
}

async function makeActivatedFixture(): Promise<string> {
	const workspaceRoot = await makeCleanEquipmentTestWorkspace(
		SOURCE_WORKSPACE_ROOT,
		'equipment-run-recorder-'
	);
	fixtureRoots.push(workspaceRoot);
	await activateEquipmentRun({
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		createdAt: CREATED_AT,
		activatedAt: ACTIVATED_AT,
		activatedBy: 'owner'
	});
	return workspaceRoot;
}

function claimOptions(workspaceRoot: string, availableWorkerSlots: number) {
	return {
		workspaceRoot,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		availableWorkerSlots,
		epochId: 'epoch-one',
		actor: 'root-orchestrator',
		requestedAt: '2026-09-02T00:00:00.000Z',
		recordedAt: '2026-09-02T00:00:01.000Z',
		lockOwnerId: 'root-orchestrator-controller'
	} as const;
}

function lifecycleRequest(
	kind: EquipmentRunEventRequest['kind'],
	eventId: string,
	fields: Record<string, unknown>
): EquipmentRunEventRequest {
	return {
		schemaVersion: 'equipment-production-event-request-v1',
		eventId,
		runId: DEFAULT_EQUIPMENT_RUN_ID,
		requestedAt: '2026-09-02T00:01:00.000Z',
		actor: 'root-orchestrator',
		kind,
		...fields
	} as EquipmentRunEventRequest;
}

async function eventFiles(workspaceRoot: string): Promise<string[]> {
	return (await readdir(absolute(workspaceRoot, EVENTS_DIRECTORY))).sort();
}

async function replayFixture(workspaceRoot: string) {
	const plan = EquipmentRunPlanSchema.parse(
		JSON.parse(await readFile(absolute(workspaceRoot, PLAN_PATH), 'utf8'))
	);
	const activation = EquipmentRunActivationSchema.parse(
		JSON.parse(await readFile(absolute(workspaceRoot, ACTIVATION_PATH), 'utf8'))
	);
	const events = await Promise.all(
		(await eventFiles(workspaceRoot)).map(async (name) =>
			EquipmentRunEventSchema.parse(
				JSON.parse(
					await readFile(path.join(absolute(workspaceRoot, EVENTS_DIRECTORY), name), 'utf8')
				)
			)
		)
	);
	return replayEquipmentRunJournal(buildEquipmentRunJournalContext(plan, activation), events);
}

afterEach(async () => {
	await Promise.all(
		fixtureRoots.splice(0).map((fixtureRoot) => rm(fixtureRoot, { recursive: true, force: true }))
	);
});

describe('Equipment run recorder and admission', () => {
	it('fills all 16 Equipment slots and ignores unrelated-task metadata', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const claims = await claimNextEquipmentJobs({
			...claimOptions(workspaceRoot, 20),
			unrelatedTaskMetadata: {
				activeTasks: 400,
				reservedOrchestratorSlots: 15,
				voluntaryThrottle: true
			}
		});

		expect(claims).toHaveLength(16);
		expect(claims.map(({ targetId }) => targetId)).toEqual([
			'material-equipment-v1-copper-sword-v1',
			'material-equipment-v1-copper-dagger-v1',
			'material-equipment-v1-copper-spear-v1',
			'material-equipment-v1-copper-axe-v1',
			'material-equipment-v1-copper-mace-v1',
			'material-equipment-v1-copper-shield-v1',
			'material-equipment-v1-copper-heavy-armour-full-set-v1',
			'material-equipment-v1-ash-bow-v1',
			'material-equipment-v1-ash-staff-v1',
			'material-equipment-v1-coarse-hide-light-armour-full-set-v1',
			'material-equipment-v1-hemp-weave-robes-full-set-v1',
			'material-equipment-v1-iron-sword-v1',
			'material-equipment-v1-iron-dagger-v1',
			'material-equipment-v1-iron-spear-v1',
			'material-equipment-v1-iron-axe-v1',
			'material-equipment-v1-iron-mace-v1'
		]);
		for (const claim of claims) {
			const target = JSON.parse(
				await readFile(absolute(workspaceRoot, claim.targetPath), 'utf8')
			) as unknown;
			const assignment = JSON.parse(
				await readFile(absolute(workspaceRoot, claim.assignmentPath), 'utf8')
			) as unknown;
			expect(claim.targetCanonicalSha256).toBe(canonicalJsonSha256(target));
			expect(claim.assignmentCanonicalSha256).toBe(canonicalJsonSha256(assignment));
		}
	});

	it('admits only four jobs with twelve active Equipment workers', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const firstClaims = await claimNextEquipmentJobs(claimOptions(workspaceRoot, 12));
		for (const [index, claim] of firstClaims.entries()) {
			await recordEquipmentRunEvent({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				request: lifecycleRequest('worker-started', `start-event-${index + 1}`, {
					claimId: claim.claimId,
					targetId: claim.targetId,
					workerId: claim.workerId
				}),
				recordedAt: `2026-09-02T00:${String(index + 2).padStart(2, '0')}:00.000Z`,
				lockOwnerId: 'root-orchestrator-controller'
			});
		}

		expect(
			await claimNextEquipmentJobs({
				...claimOptions(workspaceRoot, 20),
				recordedAt: '2026-09-02T00:20:00.000Z'
			})
		).toHaveLength(4);
	});

	it('honors three and zero available worker slots exactly', async () => {
		const threeSlotFixture = await makeActivatedFixture();
		const zeroSlotFixture = await makeActivatedFixture();
		expect(await claimNextEquipmentJobs(claimOptions(threeSlotFixture, 3))).toHaveLength(3);
		expect(await claimNextEquipmentJobs(claimOptions(zeroSlotFixture, 0))).toHaveLength(0);
	});

	it('rejects caller-supplied arbitrary terminal evidence through the generic recorder', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const [claim] = await claimNextEquipmentJobs(claimOptions(workspaceRoot, 1));
		if (claim === undefined) throw new Error('Expected one claim');
		await recordEquipmentRunEvent({
			workspaceRoot,
			runId: DEFAULT_EQUIPMENT_RUN_ID,
			request: lifecycleRequest('worker-started', 'arbitrary-terminal-start', {
				claimId: claim.claimId,
				targetId: claim.targetId,
				workerId: claim.workerId
			}),
			recordedAt: '2026-09-02T00:02:00.000Z',
			lockOwnerId: 'arbitrary-terminal-start-controller'
		});
		const beforeEvents = await eventFiles(workspaceRoot);

		await expect(
			recordEquipmentRunEvent({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				request: lifecycleRequest('job-terminal', 'arbitrary-terminal-event', {
					targetId: claim.targetId,
					workerId: claim.workerId,
					status: 'candidate',
					resultCanonicalSha256: 'a'.repeat(64),
					failureKind: null
				}),
				recordedAt: '2026-09-02T00:03:00.000Z',
				lockOwnerId: 'arbitrary-terminal-controller'
			})
		).rejects.toThrow(/verified terminal|terminal evidence/iu);
		expect(await eventFiles(workspaceRoot)).toEqual(beforeEvents);
	});

	it('serializes concurrent claims into unique contiguous exclusive event files', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const [left, right] = await Promise.all([
			claimNextEquipmentJobs({ ...claimOptions(workspaceRoot, 1), lockOwnerId: 'controller-left' }),
			claimNextEquipmentJobs({ ...claimOptions(workspaceRoot, 1), lockOwnerId: 'controller-right' })
		]);

		expect(new Set([...left, ...right].map(({ targetId }) => targetId)).size).toBe(2);
		const files = await eventFiles(workspaceRoot);
		expect(files).toHaveLength(3);
		expect(files.map((name) => Number(name.split('-')[0]))).toEqual([1, 2, 3]);
		for (const name of files) {
			expect(
				(await lstat(path.join(absolute(workspaceRoot, EVENTS_DIRECTORY), name))).isFile()
			).toBe(true);
		}
	});

	it('retries ordinary lock disappearance and remains stable under repeated contention', async () => {
		const workspaceRoot = await makeActivatedFixture();
		await writeFile(
			absolute(workspaceRoot, LOCK_PATH),
			JSON.stringify({
				ownerId: 'departing-controller',
				processId: process.pid,
				acquiredAt: '2026-09-02T00:00:00.000Z'
			})
		);
		const firstAttempt = claimNextEquipmentJobs({
			...claimOptions(workspaceRoot, 0),
			lockWaitTimeoutMs: 1_000
		});
		await unlink(absolute(workspaceRoot, LOCK_PATH));
		await expect(firstAttempt).resolves.toEqual([]);

		for (let iteration = 0; iteration < 10; iteration += 1) {
			await expect(
				Promise.all(
					Array.from({ length: 8 }, (_, contender) =>
						claimNextEquipmentJobs({
							...claimOptions(workspaceRoot, 0),
							lockOwnerId: `repeat-${iteration}-${contender}`
						})
					)
				)
			).resolves.toEqual(Array.from({ length: 8 }, () => []));
		}
	}, 30_000);

	it('refuses a symlinked run directory before any external lock write', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const outsideParent = await mkdtemp(path.join(tmpdir(), 'equipment-symlinked-run-'));
		fixtureRoots.push(outsideParent);
		const outsideRun = path.join(outsideParent, 'run');
		await rename(absolute(workspaceRoot, RUN_DIRECTORY), outsideRun);
		await symlink(outsideRun, absolute(workspaceRoot, RUN_DIRECTORY), 'dir');
		const before = await stat(outsideRun, { bigint: true });

		await expect(claimNextEquipmentJobs(claimOptions(workspaceRoot, 1))).rejects.toThrow(
			/symbolic|symlink/iu
		);
		const after = await stat(outsideRun, { bigint: true });
		expect(after.mtimeNs).toBe(before.mtimeNs);
		await expect(lstat(path.join(outsideRun, '.journal.lock'))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('recovers a stale dead-owner lock and refuses a live-owner lock', async () => {
		const staleFixture = await makeActivatedFixture();
		await writeFile(
			absolute(staleFixture, LOCK_PATH),
			JSON.stringify({
				ownerId: 'dead-controller',
				processId: 2_147_483_647,
				acquiredAt: '2026-09-01T00:00:00.000Z'
			})
		);
		expect(
			await claimNextEquipmentJobs({
				...claimOptions(staleFixture, 1),
				now: () => new Date('2026-09-02T00:00:00.000Z'),
				staleLockAfterMs: 60_000
			})
		).toHaveLength(1);

		const liveFixture = await makeActivatedFixture();
		await writeFile(
			absolute(liveFixture, LOCK_PATH),
			JSON.stringify({
				ownerId: 'live-controller',
				processId: process.pid,
				acquiredAt: '2026-09-02T00:00:00.000Z'
			})
		);
		await expect(
			claimNextEquipmentJobs({
				...claimOptions(liveFixture, 1),
				now: () => new Date('2026-09-02T00:00:01.000Z'),
				lockWaitTimeoutMs: 20
			})
		).rejects.toThrow(/live.*lock|lock.*live/iu);
	});

	it('serializes stale recovery and never deletes a fresh replacement lock', async () => {
		const workspaceRoot = await makeActivatedFixture();
		await writeFile(
			absolute(workspaceRoot, LOCK_PATH),
			JSON.stringify({
				ownerId: 'dead-controller',
				processId: 2_147_483_647,
				acquiredAt: '2026-09-01T00:00:00.000Z'
			})
		);
		let releaseRecovery!: () => void;
		let markRecoveryReached!: () => void;
		const recoveryReached = new Promise<void>((resolve) => {
			markRecoveryReached = resolve;
		});
		const recoveryRelease = new Promise<void>((resolve) => {
			releaseRecovery = resolve;
		});
		const first = claimNextEquipmentJobs({
			...claimOptions(workspaceRoot, 1),
			lockOwnerId: 'stale-contender-one',
			now: () => new Date('2026-09-02T00:00:00.000Z'),
			staleLockAfterMs: 60_000,
			testHooks: {
				afterStaleMainLockRemoved: async () => {
					markRecoveryReached();
					await recoveryRelease;
				}
			}
		});
		await expect(
			Promise.race([
				recoveryReached,
				new Promise<void>((_resolve, reject) =>
					setTimeout(() => reject(new Error('stale recovery hook was not reached')), 250)
				)
			])
		).resolves.toBeUndefined();
		const second = claimNextEquipmentJobs({
			...claimOptions(workspaceRoot, 1),
			lockOwnerId: 'stale-contender-two',
			now: () => new Date('2026-09-02T00:00:00.000Z'),
			staleLockAfterMs: 60_000
		});
		const freshBytes = `${JSON.stringify({
			ownerId: 'fresh-controller',
			processId: process.pid,
			acquiredAt: '2026-09-02T00:00:00.000Z'
		})}\n`;
		await writeFile(absolute(workspaceRoot, LOCK_PATH), freshBytes, { flag: 'wx' });
		releaseRecovery();
		await new Promise<void>((resolve) => setTimeout(resolve, 25));
		expect(await readFile(absolute(workspaceRoot, LOCK_PATH), 'utf8')).toBe(freshBytes);
		await unlink(absolute(workspaceRoot, LOCK_PATH));

		const claims = [...(await first), ...(await second)];
		expect(new Set(claims.map(({ targetId }) => targetId)).size).toBe(2);
		expect((await replayFixture(workspaceRoot)).orderedEvents).toHaveLength(3);
	});

	it('blocks safely on an abandoned stale-recovery guard', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const guardPath = `${RUN_DIRECTORY}/.journal-lock-recovery.guard`;
		const guardBytes = `${JSON.stringify({
			ownerId: 'crashed-recovery',
			processId: 2_147_483_647,
			acquiredAt: '2026-09-01T00:00:00.000Z'
		})}\n`;
		await writeFile(absolute(workspaceRoot, guardPath), guardBytes);
		await expect(
			claimNextEquipmentJobs({ ...claimOptions(workspaceRoot, 1), lockWaitTimeoutMs: 20 })
		).rejects.toThrow(/recovery guard/iu);
		expect(await readFile(absolute(workspaceRoot, guardPath), 'utf8')).toBe(guardBytes);
		await expect(lstat(absolute(workspaceRoot, EVENTS_DIRECTORY))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('pre-resolves the entire claim batch before writing any event', async () => {
		const workspaceRoot = await makeActivatedFixture();
		await expect(
			claimNextEquipmentJobs({
				...claimOptions(workspaceRoot, 5),
				testHooks: {
					beforePacketResolution: ({ index }: { index: number }) => {
						if (index === 3) throw new Error('injected later packet resolution failure');
					}
				}
			})
		).rejects.toThrow(/injected later packet resolution failure/iu);
		await expect(lstat(absolute(workspaceRoot, EVENTS_DIRECTORY))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});

	it('returns the exact durable prefix when a later claim append fails', async () => {
		const workspaceRoot = await makeActivatedFixture();
		let claimedEventCreates = 0;
		const claims = await claimNextEquipmentJobs({
			...claimOptions(workspaceRoot, 5),
			testHooks: {
				afterEventFileCreated: ({ event }: { event: { request: { kind: string } } }) => {
					if (event.request.kind !== 'job-claimed') return;
					claimedEventCreates += 1;
					if (claimedEventCreates === 3) throw new Error('injected later append failure');
				}
			}
		});
		const state = await replayFixture(workspaceRoot);
		const journalClaims = state.orderedEvents.filter(
			({ request }) => request.kind === 'job-claimed'
		);
		expect(claims).toHaveLength(2);
		expect(journalClaims).toHaveLength(2);
		expect(claims.map(({ event }) => event)).toEqual(journalClaims);
		expect(
			claims.map(({ claimId, targetId, workerId }) => ({ claimId, targetId, workerId }))
		).toEqual(
			journalClaims.map(({ request }) => {
				if (request.kind !== 'job-claimed') throw new Error('Expected durable job claim');
				return {
					claimId: request.claimId,
					targetId: request.targetId,
					workerId: request.workerId
				};
			})
		);
		expect(await eventFiles(workspaceRoot)).toHaveLength(3);
	});

	it('refuses symlinked journal paths and corrupt history before appending', async () => {
		const symlinkFixture = await makeActivatedFixture();
		const outside = await mkdtemp(path.join(tmpdir(), 'equipment-events-outside-'));
		fixtureRoots.push(outside);
		await symlink(outside, absolute(symlinkFixture, EVENTS_DIRECTORY));
		await expect(claimNextEquipmentJobs(claimOptions(symlinkFixture, 1))).rejects.toThrow(
			/symbolic|symlink/iu
		);

		const corruptFixture = await makeActivatedFixture();
		await claimNextEquipmentJobs(claimOptions(corruptFixture, 1));
		const files = await eventFiles(corruptFixture);
		const eventPath = path.join(absolute(corruptFixture, EVENTS_DIRECTORY), files[0]!);
		const event = JSON.parse(await readFile(eventPath, 'utf8')) as Record<string, unknown>;
		await writeFile(eventPath, `${JSON.stringify({ ...event, sequence: 9 }, null, '\t')}\n`);
		await expect(claimNextEquipmentJobs(claimOptions(corruptFixture, 1))).rejects.toThrow(
			/contiguous|sequence|filename/iu
		);
		expect(await eventFiles(corruptFixture)).toHaveLength(2);
	});

	it('reverifies the immutable plan and activation before any append', async () => {
		const stalePlanFixture = await makeActivatedFixture();
		const plan = JSON.parse(
			await readFile(absolute(stalePlanFixture, PLAN_PATH), 'utf8')
		) as Record<string, unknown>;
		await writeFile(
			absolute(stalePlanFixture, PLAN_PATH),
			`${JSON.stringify({ ...plan, productionId: 'changed-production' }, null, '\t')}\n`
		);
		await expect(claimNextEquipmentJobs(claimOptions(stalePlanFixture, 1))).rejects.toThrow(
			/immutable.*plan|plan.*stale/iu
		);

		const staleActivationFixture = await makeActivatedFixture();
		const activation = JSON.parse(
			await readFile(absolute(staleActivationFixture, ACTIVATION_PATH), 'utf8')
		) as Record<string, unknown>;
		await writeFile(
			absolute(staleActivationFixture, ACTIVATION_PATH),
			`${JSON.stringify({ ...activation, runPlanCanonicalSha256: '0'.repeat(64) }, null, '\t')}\n`
		);
		await expect(claimNextEquipmentJobs(claimOptions(staleActivationFixture, 1))).rejects.toThrow(
			/activation.*hash-bind/iu
		);
	});

	it('never overwrites an existing event identity', async () => {
		const workspaceRoot = await makeActivatedFixture();
		await claimNextEquipmentJobs(claimOptions(workspaceRoot, 1));
		const firstEventPath = path.join(
			absolute(workspaceRoot, EVENTS_DIRECTORY),
			(await eventFiles(workspaceRoot))[0]!
		);
		const before = await readFile(firstEventPath);
		await expect(
			recordEquipmentRunEvent({
				workspaceRoot,
				runId: DEFAULT_EQUIPMENT_RUN_ID,
				request: lifecycleRequest('run-started', 'run-started-epoch-one', {
					epochId: 'epoch-two'
				}),
				recordedAt: '2026-09-02T00:05:00.000Z',
				lockOwnerId: 'duplicate-event-controller'
			})
		).rejects.toThrow(/event IDs.*unique|start only once/iu);
		expect(await readFile(firstEventPath)).toEqual(before);
		expect(await eventFiles(workspaceRoot)).toHaveLength(2);
	});

	it('exposes claim, start, terminal, release, pause, and resume CLI commands', async () => {
		const workspaceRoot = await makeActivatedFixture();
		const claimResult = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: [
				'claim-next',
				'--available-worker-slots',
				'2',
				'--epoch-id',
				'epoch-one',
				'--actor',
				'root-orchestrator',
				'--requested-at',
				'2026-09-02T00:00:00.000Z',
				'--recorded-at',
				'2026-09-02T00:00:01.000Z'
			]
		});
		const claims = claimResult.claims as Array<{
			claimId: string;
			targetId: string;
			workerId: string;
		}>;
		expect(claims).toHaveLength(2);

		const start = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: [
				'record-start',
				'--event-id',
				'cli-start-one',
				'--claim-id',
				claims[0]!.claimId,
				'--target-id',
				claims[0]!.targetId,
				'--worker-id',
				claims[0]!.workerId,
				'--actor',
				'root-orchestrator',
				'--requested-at',
				'2026-09-02T00:02:00.000Z',
				'--recorded-at',
				'2026-09-02T00:02:01.000Z'
			]
		});
		expect(start.event).toMatchObject({ request: { kind: 'worker-started' } });

		const terminalCommon = [
			'--event-id',
			'cli-terminal-invalid',
			'--target-id',
			claims[0]!.targetId,
			'--worker-id',
			claims[0]!.workerId,
			'--actor',
			'root-orchestrator',
			'--requested-at',
			'2026-09-02T00:03:00.000Z',
			'--recorded-at',
			'2026-09-02T00:03:01.000Z'
		];
		for (const status of ['candidate', 'revise']) {
			await expect(
				runEquipmentImageProductionCli({
					workspaceRoot,
					args: [
						'record-terminal',
						...terminalCommon,
						'--status',
						status,
						'--result-canonical-sha256',
						'a'.repeat(64),
						'--failure-kind',
						'timeout'
					]
				})
			).rejects.toThrow(/Unknown argument: --status/iu);
		}
		await expect(
			runEquipmentImageProductionCli({
				workspaceRoot,
				args: [
					'record-terminal',
					...terminalCommon,
					'--status',
					'failed',
					'--result-canonical-sha256',
					'a'.repeat(64),
					'--failure-kind',
					'timeout'
				]
			})
		).rejects.toThrow(/Unknown argument: --status/iu);

		await expect(
			runEquipmentImageProductionCli({
				workspaceRoot,
				args: [
					'record-terminal',
					'--event-id',
					'cli-terminal-one',
					'--target-id',
					claims[0]!.targetId,
					'--worker-id',
					claims[0]!.workerId,
					'--status',
					'candidate',
					'--result-canonical-sha256',
					'a'.repeat(64),
					'--actor',
					'root-orchestrator',
					'--requested-at',
					'2026-09-02T00:03:00.000Z',
					'--recorded-at',
					'2026-09-02T00:03:01.000Z'
				]
			})
		).rejects.toThrow(/Unknown argument: --status/iu);

		const release = await runEquipmentImageProductionCli({
			workspaceRoot,
			args: [
				'release-claim',
				'--event-id',
				'cli-release-two',
				'--claim-id',
				claims[1]!.claimId,
				'--target-id',
				claims[1]!.targetId,
				'--worker-id',
				claims[1]!.workerId,
				'--reason',
				'admission refused',
				'--actor',
				'root-orchestrator',
				'--requested-at',
				'2026-09-02T00:04:00.000Z',
				'--recorded-at',
				'2026-09-02T00:04:01.000Z'
			]
		});
		expect(release.event).toMatchObject({ request: { kind: 'claim-released' } });

		for (const command of ['pause-epoch', 'resume-epoch']) {
			await expect(
				runEquipmentImageProductionCli({ workspaceRoot, args: [command] })
			).rejects.not.toThrow(/Unknown Equipment image-production command/iu);
		}
	});
});
