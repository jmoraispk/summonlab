import {
	cp,
	lstat,
	mkdtemp,
	mkdir,
	readFile,
	readdir,
	rm,
	symlink,
	writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	type EquipmentRunEventRequest
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';
import { runEquipmentImageProductionCli } from './equipment-image-production.js';
import { claimNextEquipmentJobs, recordEquipmentRunEvent } from './equipment-image-run-recorder.js';
import { DEFAULT_EQUIPMENT_RUN_ID, activateEquipmentRun } from './equipment-image-run-readiness.js';

const SOURCE_WORKSPACE_ROOT = process.cwd();
const PROFILE_REFERENCE_PATH =
	'assets/heroes/visuals/forge-v2/benchmarks/remy-esen-equipped-v1.png';
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
	const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'equipment-run-recorder-'));
	fixtureRoots.push(workspaceRoot);
	await cp(
		absolute(SOURCE_WORKSPACE_ROOT, EQUIPMENT_PRODUCTION_ROOT),
		absolute(workspaceRoot, EQUIPMENT_PRODUCTION_ROOT),
		{ recursive: true }
	);
	await mkdir(path.dirname(absolute(workspaceRoot, PROFILE_REFERENCE_PATH)), { recursive: true });
	await cp(
		absolute(SOURCE_WORKSPACE_ROOT, PROFILE_REFERENCE_PATH),
		absolute(workspaceRoot, PROFILE_REFERENCE_PATH)
	);
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

		const terminal = await runEquipmentImageProductionCli({
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
		});
		expect(terminal.event).toMatchObject({ request: { kind: 'job-terminal' } });

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
