import { randomUUID } from 'node:crypto';

import type {
	ActorDecisionView,
	CombatActionIntent,
	CombatWindowSnapshot
} from '@summonlab/contracts';
import { hashCanonical } from '@summonlab/engine';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	applyCombatDecisionWindowBatch,
	claimCombatDecisionJob,
	completeCombatDecisionJobAttempt,
	createCombatDecisionWindow,
	failCombatDecisionJobAttempt,
	getCombatDecisionWindow,
	queueCombatDecisionJob,
	recoverExpiredCombatDecisionJobs,
	refreshCombatDecisionWindow
} from './combat-decision-windows.js';
import { listDispatchableDecisionJobIds } from './decision-jobs.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;
const HASH = { state: 'a'.repeat(64), content: 'b'.repeat(64) } as const;

function combatant(combatantId: string, x: number) {
	return {
		combatantId,
		combatantKind: 'hero' as const,
		teamId: 'party',
		position: { x, y: 1 },
		facing: 'east' as const,
		resources: {
			health: { current: 100, maximum: 100 },
			mana: { current: 20, maximum: 20 }
		},
		lastDamagedAtTick: null,
		attributes: { might: 10, vitality: 10, agility: 10, spirit: 10 },
		armour: 0,
		resistances: {},
		readiness: { value: 10_000, exactNumerator: 10_000, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function action(actorId: string) {
	return {
		actionId: 'guard-self',
		actionInstanceId: actorId,
		actionKind: 'guard' as const,
		skillId: null,
		publicLabel: 'Guard',
		targetContract: { kind: 'self' as const },
		reactionPriority: 0,
		recoveryTicks: 2,
		manaCost: 0,
		conflictPolicy: {
			invalidTarget: 'cancel' as const,
			occupiedDestination: 'cancel' as const,
			cancellationRefund: { mana: 'full' as const, readiness: 'full' as const }
		},
		fallbackOptions: [
			{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' as const } }
		]
	};
}

function fixture(runId: string) {
	const attemptId = randomUUID();
	const windowId = randomUUID();
	const actorIds = [randomUUID(), randomUUID()].sort();
	const terrain = { width: 8, height: 8, blockedTiles: [], features: [] };
	const combatants = Object.fromEntries(
		actorIds.map((id, index) => [id, combatant(id, index + 1)])
	);
	const unsignedSnapshot = {
		snapshotVersion: 'combat-window-v1' as const,
		windowId,
		attemptId,
		tick: 7,
		readyActorIds: actorIds,
		combatants,
		terrain,
		visibleTelegraphs: [],
		rulesVersion: 'combat-rules-v1' as const,
		contentHash: HASH.content,
		stateHash: HASH.state
	};
	const snapshot: CombatWindowSnapshot = {
		...unsignedSnapshot,
		snapshotHash: hashCanonical(unsignedSnapshot)
	};
	const views = actorIds.map((actorId) => {
		const legalActions = [action(actorId)];
		const unsignedView = {
			viewVersion: 'actor-decision-view-v1' as const,
			windowId,
			actorId,
			snapshotHash: snapshot.snapshotHash,
			legalActionSetHash: hashCanonical(legalActions),
			self: {
				combatantId: actorId,
				combatantKind: 'hero' as const,
				teamId: 'party',
				position: combatants[actorId]!.position,
				resources: combatants[actorId]!.resources,
				conditions: [],
				readiness: { ready: true, recoveryTicksRemaining: 0 },
				downed: false,
				active: true
			},
			visibleCombatants: [],
			visibleTerrain: terrain,
			visibleTelegraphs: [],
			rememberedContext: [],
			doctrine: [],
			relationships: [],
			masterDirections: [],
			legalActions
		};
		return {
			...unsignedView,
			actorViewHash: hashCanonical(unsignedView)
		} satisfies ActorDecisionView;
	});
	const result = (view: ActorDecisionView): CombatActionIntent => ({
		windowId,
		attemptId,
		tick: snapshot.tick,
		actorId: view.actorId,
		snapshotHash: snapshot.snapshotHash,
		actorViewHash: view.actorViewHash,
		legalActionSetHash: view.legalActionSetHash,
		actionId: 'guard-self',
		actionInstanceId: view.actorId,
		actionKind: 'guard',
		skillId: null,
		target: { kind: 'self' },
		fallbackId: 'brace'
	});
	return { runId, snapshot, views, result };
}

async function insertRun(runId: string): Promise<void> {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql`
			insert into summonlab_proof_runs (
				run_id, control_mode, recipe, manifest, mind, manifest_hash, first_observation
			) values (${runId}, 'wait', ${sql.json({})}, ${sql.json({})}, ${sql.json({})},
				${HASH.state}, 'fixture')
		`;
		await sql`
			insert into summonlab_engine_runs (
				run_id, seed, content_version, status, version, event_cursor, entropy_cursor,
				simulated_at, state_hash
			) values (${runId}, 'seed', 'engine-v26', 'active', 3, 4, 0, now(), ${HASH.state})
		`;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

describe.sequential('durable combat decision cohorts', () => {
	let runId: string;

	beforeEach(async () => {
		runId = randomUUID();
		await insertRun(runId);
	});

	afterEach(async () => {
		if (!databaseUrl) return;
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`delete from summonlab_proof_runs where run_id = ${runId}`;
		} finally {
			await sql.end({ timeout: 5 });
		}
	});

	run(
		'atomically enqueues every actor, retries idempotently, and aggregates out of order',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const f = fixture(runId);
			const input = {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: f.snapshot,
				actors: f.views.map((view) => ({
					view,
					requestedPolicy: 'scripted' as const,
					deterministicFallback: f.result(view),
					maxProviderAttempts: 2
				}))
			};
			const created = await createCombatDecisionWindow(databaseUrl, input);
			const retried = await createCombatDecisionWindow(databaseUrl, input);
			expect(created.jobs).toHaveLength(2);
			expect(retried).toEqual(created);
			expect(await listDispatchableDecisionJobIds(databaseUrl)).not.toEqual(
				expect.arrayContaining(created.jobs.map((job) => job.decisionJobId))
			);
			await expect(
				createCombatDecisionWindow(databaseUrl, {
					...input,
					actors: input.actors.map((actor, index) =>
						index === 0 ? { ...actor, requestedPolicy: 'model' as const } : actor
					)
				})
			).rejects.toThrow(/does not match/u);

			for (const [index, job] of [...created.jobs].reverse().entries()) {
				expect(await queueCombatDecisionJob(databaseUrl, job.decisionJobId)).toBe(true);
				expect(await queueCombatDecisionJob(databaseUrl, job.decisionJobId)).toBe(false);
				const claim = await claimCombatDecisionJob(databaseUrl, job.decisionJobId, 30);
				expect(claim?.job.windowId).toBe(f.snapshot.windowId);
				const view = f.views.find((candidate) => candidate.actorId === job.heroId)!;
				await completeCombatDecisionJobAttempt(databaseUrl, job.decisionJobId, f.result(view), 5);
				if (index === 0) {
					expect((await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId)).status).toBe(
						'collecting'
					);
				}
			}
			const ready = await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
			expect(ready.status).toBe('ready');
			expect(ready.batch?.choices.map((choice) => choice.actorId)).toEqual(
				f.views.map((view) => view.actorId).sort()
			);
			expect(await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId)).toEqual(ready);

			const applied = await Promise.all([
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!, 5),
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!, 5)
			]);
			expect(applied.map((entry) => entry.disposition).sort()).toEqual([
				'already-applied',
				'applied'
			]);
		}
	);

	run('rolls back a partial cohort and rejects cross-window replay', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const f = fixture(runId);
		const crash = new Error('simulated crash after window insert');
		const crashSql = postgres(databaseUrl, { max: 1 });
		try {
			await expect(
				crashSql.begin(async (transaction) => {
					await transaction`
						insert into summonlab_combat_decision_windows (
							window_id, run_id, attempt_id, tick, snapshot_hash, expected_run_version,
							expected_event_cursor, snapshot
						) values (${f.snapshot.windowId}, ${runId}, ${f.snapshot.attemptId},
							${f.snapshot.tick}, ${f.snapshot.snapshotHash}, 3, 4,
							${transaction.json(f.snapshot as never)})
					`;
					throw crash;
				})
			).rejects.toBe(crash);
		} finally {
			await crashSql.end({ timeout: 5 });
		}
		expect(await getCombatDecisionWindow(databaseUrl, f.snapshot.windowId)).toBeNull();
		await expect(
			createCombatDecisionWindow(databaseUrl, {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: f.snapshot,
				actors: [
					{
						view: f.views[0]!,
						requestedPolicy: 'scripted',
						deterministicFallback: f.result(f.views[0]!)
					},
					{
						view: { ...f.views[1]!, windowId: randomUUID() },
						requestedPolicy: 'scripted',
						deterministicFallback: f.result(f.views[1]!)
					}
				]
			})
		).rejects.toThrow();
		expect(await getCombatDecisionWindow(databaseUrl, f.snapshot.windowId)).toBeNull();

		const created = await createCombatDecisionWindow(databaseUrl, {
			runId,
			expectedRunVersion: 3,
			expectedEventCursor: 4,
			snapshot: f.snapshot,
			actors: f.views.map((view) => ({
				view,
				requestedPolicy: 'scripted' as const,
				deterministicFallback: f.result(view)
			}))
		});
		const job = created.jobs[0]!;
		await queueCombatDecisionJob(databaseUrl, job.decisionJobId);
		await claimCombatDecisionJob(databaseUrl, job.decisionJobId);
		const wrong = { ...f.result(f.views[0]!), windowId: randomUUID() };
		await expect(
			completeCombatDecisionJobAttempt(databaseUrl, job.decisionJobId, wrong, 1)
		).rejects.toThrow(/another window|binding/u);
	});

	run(
		'recovers leases, exhausts a provider into deterministic fallback, and marks stale windows',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const f = fixture(runId);
			const created = await createCombatDecisionWindow(databaseUrl, {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: f.snapshot,
				actors: f.views.map((view) => ({
					view,
					requestedPolicy: 'model' as const,
					deterministicFallback: f.result(view),
					maxProviderAttempts: 1
				}))
			});
			const first = created.jobs[0]!;
			await queueCombatDecisionJob(databaseUrl, first.decisionJobId);
			await claimCombatDecisionJob(databaseUrl, first.decisionJobId, 10);
			const sql = postgres(databaseUrl, { max: 1 });
			try {
				await sql`update summonlab_decision_jobs set lease_expires_at = now() - interval '1 second'
				where decision_job_id = ${first.decisionJobId}`;
			} finally {
				await sql.end({ timeout: 5 });
			}
			expect(await recoverExpiredCombatDecisionJobs(databaseUrl)).toBe(1);
			await queueCombatDecisionJob(databaseUrl, first.decisionJobId);
			const fallback = await claimCombatDecisionJob(databaseUrl, first.decisionJobId);
			expect(fallback?.attemptKind).toBe('fallback');
			await completeCombatDecisionJobAttempt(
				databaseUrl,
				first.decisionJobId,
				first.deterministicFallback,
				0
			);

			const second = created.jobs[1]!;
			await queueCombatDecisionJob(databaseUrl, second.decisionJobId);
			await claimCombatDecisionJob(databaseUrl, second.decisionJobId);
			const failed = await failCombatDecisionJobAttempt(
				databaseUrl,
				second.decisionJobId,
				{ code: 'provider-failed', message: 'provider unavailable', retryable: false },
				2
			);
			expect(failed.status).toBe('fallback');
			await queueCombatDecisionJob(databaseUrl, second.decisionJobId);
			await claimCombatDecisionJob(databaseUrl, second.decisionJobId);
			await completeCombatDecisionJobAttempt(
				databaseUrl,
				second.decisionJobId,
				second.deterministicFallback,
				0
			);
			expect((await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId)).status).toBe(
				'ready'
			);

			const stale = fixture(runId);
			const staleCreated = await createCombatDecisionWindow(databaseUrl, {
				runId,
				expectedRunVersion: 3,
				expectedEventCursor: 4,
				snapshot: stale.snapshot,
				actors: stale.views.map((view) => ({
					view,
					requestedPolicy: 'scripted' as const,
					deterministicFallback: stale.result(view)
				}))
			});
			await queueCombatDecisionJob(databaseUrl, staleCreated.jobs[0]!.decisionJobId);
			const staleSql = postgres(databaseUrl, { max: 1 });
			try {
				await staleSql`update summonlab_engine_runs set version = 4, event_cursor = 5 where run_id = ${runId}`;
			} finally {
				await staleSql.end({ timeout: 5 });
			}
			expect(
				await claimCombatDecisionJob(databaseUrl, staleCreated.jobs[0]!.decisionJobId)
			).toBeNull();
			expect((await getCombatDecisionWindow(databaseUrl, stale.snapshot.windowId))?.status).toBe(
				'stale'
			);
		}
	);
});
