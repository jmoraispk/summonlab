import {
	lstat,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	rm,
	symlink,
	utimes,
	writeFile
} from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./affinity-wave-scheduler-lib.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./affinity-wave-scheduler-lib.js')>();
	return {
		...actual,
		verifyCurrentWavePreflight: async (_workspaceRoot: string, input: unknown) =>
			actual.AffinityWavePreflightV2Schema.parse(input)
	};
});

import { canonicalJsonSha256 } from './affinity-wave-scheduler-lib.js';
import {
	readAffinityWaveEventsV3,
	recordAffinityWaveEventV3
} from './affinity-wave-journal-v3-recorder.js';

const HASH = 'a'.repeat(64);
const RUN_ID = 'recorder-test-run';
const RUN_DIRECTORY = `runs/${RUN_ID}`;
const PREFLIGHT_PATH = `${RUN_DIRECTORY}/preflight.json`;
const EVENTS_DIRECTORY = `${RUN_DIRECTORY}/events-v3`;
const RECORDED_AT = '2026-08-30T01:00:00.000Z';
const roots: string[] = [];

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fixture(createdAt = '2026-08-30T00:00:00.000Z') {
	return {
		schemaVersion: 'affinity-wave-preflight-v2',
		runId: RUN_ID,
		experimentId: 'affinity-workflow-v1',
		stage: 'canary',
		workloadId: 'breadth-canary',
		createdAt,
		status: 'ready',
		requestedConcurrency: 2,
		availableAgentSlots: 3,
		reservedOrchestratorSlots: 1,
		admittedWorkerCapacity: 2,
		exactConcurrencyReady: true,
		runDirectory: RUN_DIRECTORY,
		stopRules: {
			capacityFailureLimit: 3,
			stopOnOutputCollision: true,
			retryCapacityFailuresInWave: false
		},
		sourcePlan: { path: `${RUN_DIRECTORY}/plan.json`, canonicalSha256: HASH },
		sourceAllocation: {
			path: 'review/allocation.json',
			canonicalSha256: 'b'.repeat(64),
			allocationId: 'test-allocation'
		},
		concurrencySentinelActivationReceipt: null,
		dispatchGateSatisfied: true,
		dispatchGateEvidence: {
			status: 'satisfied',
			artifactPath: 'review/gate.json',
			expectedCanonicalSha256: 'c'.repeat(64),
			observedCanonicalSha256: 'c'.repeat(64),
			gate: {
				schemaVersion: 'affinity-wave-dispatch-gate-v2',
				gateId: 'test-gate',
				experimentId: 'affinity-workflow-v1',
				status: 'authorized',
				authorizedStage: 'canary',
				qualityGateSatisfied: true,
				humanGateSatisfied: true,
				prerequisiteRunIds: [],
				derivation: { profile: 'breadth-canary' },
				promotionEvidence: null,
				evidenceBindings: [{ path: 'review/evidence.json', canonicalSha256: HASH }]
			},
			evidenceChecks: [
				{
					path: 'review/evidence.json',
					expectedCanonicalSha256: HASH,
					observedCanonicalSha256: HASH,
					status: 'verified'
				}
			]
		},
		collisionPaths: [],
		jobs: [1, 2].map((index) => ({
			targetId: `target-0${index}`,
			assignmentId: `assignment-0${index}`,
			speciesId: 'goblin',
			affinity: index === 1 ? 'normal' : 'fire',
			targetPath: `targets/target-0${index}.json`,
			assignmentPath: `assignments/assignment-0${index}.json`,
			targetCanonicalSha256: 'd'.repeat(64),
			assignmentCanonicalSha256: 'e'.repeat(64),
			allocationJobKey: `allocation-job-0${index}`,
			manifestState: 'live-unexecuted-breadth',
			candidatePath: `candidates/target-0${index}.png`,
			resultPath: `results/target-0${index}.json`
		}))
	};
}

function request(eventId: string, kind: string, extra: Record<string, unknown> = {}) {
	return {
		schemaVersion: 'affinity-wave-event-request-v3',
		eventId,
		runId: RUN_ID,
		kind,
		...extra
	};
}

async function workspace() {
	const root = await mkdtemp(path.join(tmpdir(), 'affinity-wave-v3-recorder-'));
	roots.push(root);
	await mkdir(path.join(root, RUN_DIRECTORY), { recursive: true });
	await writePreflight(root, fixture());
	return root;
}

async function writePreflight(root: string, preflight: ReturnType<typeof fixture>) {
	await writeFile(
		path.join(root, PREFLIGHT_PATH),
		`${JSON.stringify(preflight, null, '\t')}\n`,
		'utf8'
	);
}

const clock = { now: () => RECORDED_AT };

describe('affinity wave journal v3 recorder', () => {
	it('serializes simultaneous callers that initially compete for the same next sequence', async () => {
		const root = await workspace();
		await recordAffinityWaveEventV3(root, PREFLIGHT_PATH, request('wave-started', 'wave-started'), {
			clock
		});

		const paths = await Promise.all([
			recordAffinityWaveEventV3(
				root,
				PREFLIGHT_PATH,
				request('claim-one', 'job-claimed', { targetId: 'target-01' }),
				{ clock }
			),
			recordAffinityWaveEventV3(
				root,
				PREFLIGHT_PATH,
				request('claim-two', 'job-claimed', { targetId: 'target-02' }),
				{ clock }
			)
		]);

		expect(paths.map((entry) => path.basename(entry).slice(0, 6)).sort()).toEqual([
			'000001',
			'000002'
		]);
		const events = await readAffinityWaveEventsV3(root, PREFLIGHT_PATH);
		expect(events.map(({ sequence }) => sequence)).toEqual([0, 1, 2]);
		expect(new Set(events.map(({ eventId }) => eventId))).toEqual(
			new Set(['wave-started', 'claim-one', 'claim-two'])
		);
		expect(events.every(({ recordedAt }) => recordedAt === RECORDED_AT)).toBe(true);
	});

	it('releases its lock when request or journal validation fails', async () => {
		const root = await workspace();
		await expect(
			recordAffinityWaveEventV3(
				root,
				PREFLIGHT_PATH,
				request('claim-before-start', 'job-claimed', { targetId: 'target-01' }),
				{ clock }
			)
		).rejects.toThrow(/preceding wave-started/u);
		await expect(
			lstat(path.join(root, EVENTS_DIRECTORY, '.journal-v3.lock'))
		).rejects.toMatchObject({
			code: 'ENOENT'
		});
		expect(await readdir(path.join(root, EVENTS_DIRECTORY))).toEqual([]);
	});

	it('recovers an abandoned stale lock without leaving recovery artifacts', async () => {
		const root = await workspace();
		const eventDirectory = path.join(root, EVENTS_DIRECTORY);
		await mkdir(eventDirectory, { recursive: true });
		const lockPath = path.join(eventDirectory, '.journal-v3.lock');
		await writeFile(
			lockPath,
			`${JSON.stringify({
				schemaVersion: 'affinity-wave-journal-v3-lock-v1',
				ownerId: 'abandoned-owner',
				pid: 999_999_999,
				acquiredAt: '2020-01-01T00:00:00.000Z'
			})}\n`
		);
		await utimes(lockPath, new Date(0), new Date(0));

		await expect(
			recordAffinityWaveEventV3(root, PREFLIGHT_PATH, request('wave-started', 'wave-started'), {
				clock,
				staleLockTimeoutMs: 10,
				lockAcquireTimeoutMs: 1_000
			})
		).resolves.toBe(`${EVENTS_DIRECTORY}/000000-wave-started.json`);
		expect((await readdir(eventDirectory)).filter((entry) => entry.includes('lock'))).toEqual([]);
	});

	it('never overwrites a colliding sequence filename and preserves the foreign bytes', async () => {
		const root = await workspace();
		await recordAffinityWaveEventV3(root, PREFLIGHT_PATH, request('wave-started', 'wave-started'), {
			clock
		});
		const collisionPath = path.join(root, EVENTS_DIRECTORY, '000001-claim-one.json');
		const foreignBytes = 'foreign collision bytes\n';

		await expect(
			recordAffinityWaveEventV3(
				root,
				PREFLIGHT_PATH,
				request('claim-one', 'job-claimed', { targetId: 'target-01' }),
				{
					clock: {
						now: () => {
							writeFileSync(collisionPath, foreignBytes, { flag: 'wx' });
							return RECORDED_AT;
						}
					}
				}
			)
		).rejects.toMatchObject({ code: 'EEXIST' });
		expect(await readFile(collisionPath, 'utf8')).toBe(foreignBytes);
	});

	it('rejects attempts to forge recorder-owned sequence, time, or preflight hash fields', async () => {
		const root = await workspace();
		await expect(
			recordAffinityWaveEventV3(
				root,
				PREFLIGHT_PATH,
				{
					...request('forged-start', 'wave-started'),
					sequence: 99,
					recordedAt: '1999-01-01T00:00:00.000Z',
					preflightCanonicalSha256: 'f'.repeat(64)
				},
				{ clock }
			)
		).rejects.toThrow();
		expect(await readdir(path.join(root, EVENTS_DIRECTORY))).toEqual([]);
	});

	it('rolls back only its event when the current preflight drifts after the write', async () => {
		const root = await workspace();
		const original = fixture();
		await recordAffinityWaveEventV3(root, PREFLIGHT_PATH, request('wave-started', 'wave-started'), {
			clock,
			expectedPreflightCanonicalSha256: canonicalJsonSha256(original)
		});
		const changed = fixture('2026-08-30T00:00:01.000Z');

		await expect(
			recordAffinityWaveEventV3(
				root,
				PREFLIGHT_PATH,
				request('claim-one', 'job-claimed', { targetId: 'target-01' }),
				{
					clock: {
						now: () => {
							writeFileSync(
								path.join(root, PREFLIGHT_PATH),
								`${JSON.stringify(changed, null, '\t')}\n`
							);
							return RECORDED_AT;
						}
					}
				}
			)
		).rejects.toThrow(/canonical hash differs/u);
		expect(await readdir(path.join(root, EVENTS_DIRECTORY))).toEqual(['000000-wave-started.json']);
	});

	it('rejects symlinked journal directories without writing through them', async () => {
		const root = await workspace();
		const outside = await mkdtemp(path.join(tmpdir(), 'affinity-wave-v3-outside-'));
		roots.push(outside);
		await symlink(outside, path.join(root, EVENTS_DIRECTORY));

		await expect(
			recordAffinityWaveEventV3(root, PREFLIGHT_PATH, request('wave-started', 'wave-started'), {
				clock
			})
		).rejects.toThrow(/Symlink/u);
		expect(await readdir(outside)).toEqual([]);
	});

	it('requires a repository-contained canonical preflight path', async () => {
		const root = await workspace();
		await expect(
			recordAffinityWaveEventV3(root, '../preflight.json', request('wave-started', 'wave-started'))
		).rejects.toThrow(/Unsafe repository path/u);
		await writeFile(
			path.join(root, RUN_DIRECTORY, 'copy.json'),
			`${JSON.stringify(fixture(), null, '\t')}\n`
		);
		await expect(
			recordAffinityWaveEventV3(
				root,
				`${RUN_DIRECTORY}/copy.json`,
				request('wave-started', 'wave-started')
			)
		).rejects.toThrow(/canonical path/u);
	});
});
