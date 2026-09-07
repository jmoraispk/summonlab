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
	refreshCombatDecisionWindow,
	type CombatDecisionBatchCommit
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

function persistBatchEvent(failAfterWrite = false): CombatDecisionBatchCommit {
	return async (transaction, command) => {
		const eventId = randomUUID();
		const afterStateHash = 'c'.repeat(64);
		await transaction`
			insert into summonlab_engine_commands (
				command_id, run_id, expected_version, command_type, command, correlation_id,
				accepted_sequence
			) values (${command.commandId}, ${command.runId}, ${command.expectedVersion},
				${command.commandType}, ${transaction.json(command as never)}, ${command.correlationId}, 5)
		`;
		await transaction`
			insert into summonlab_engine_events (
				event_id, run_id, sequence, schema_version, event_type, simulated_at, actor_id,
				command_id, causation_id, correlation_id, source, seed_cursor, before_state_hash,
				after_state_hash, content_version, payload
			) values (${eventId}, ${command.runId}, 5, 26, 'mission.combat.choice-batch.applied',
				now(), ${command.actorId}, ${command.commandId}, null, ${command.correlationId},
				${transaction.json(command.source as never)}, 0, ${HASH.state}, ${afterStateHash},
				'engine-v26', ${transaction.json({ batch: command.batch, resolvedEvents: [] })})
		`;
		await transaction`
			update summonlab_engine_runs set version = 4, event_cursor = 5, state_hash = ${afterStateHash}
			where run_id = ${command.runId} and version = 3 and event_cursor = 4
		`;
		if (failAfterWrite) throw new Error('simulated crash after engine event');
	};
}

async function within<T>(promise: Promise<T>, milliseconds = 2_000): Promise<T> {
	let timeout: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_resolve, reject) => {
				timeout = setTimeout(
					() => reject(new Error('concurrent database operations timed out')),
					milliseconds
				);
			})
		]);
	} finally {
		if (timeout) clearTimeout(timeout);
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
			const legacyJobId = randomUUID();
			const legacySql = postgres(databaseUrl, { max: 1 });
			try {
				await legacySql`
					insert into summonlab_decision_jobs (
						decision_job_id, schema_version, root_job_id, run_id, hero_id, decision_kind,
						requested_policy, expected_run_version, expected_event_cursor,
						decision_game_time, packet_id, packet_hash, state_hash, legal_action_hash,
						prompt_version, context_policy_version, packet
					) values (${legacyJobId}, 'decision-job-v2', ${legacyJobId}, ${runId},
						${randomUUID()}, 'settlement-action', 'scripted', 3, 4, now(), ${randomUUID()},
						${HASH.state}, ${HASH.state}, ${HASH.state}, 'legacy-prompt-v1',
						'legacy-context-v1', ${legacySql.json({})})
				`;
			} finally {
				await legacySql.end({ timeout: 5 });
			}
			const legacyDispatch = await listDispatchableDecisionJobIds(databaseUrl);
			expect(legacyDispatch).toContain(legacyJobId);
			expect(legacyDispatch).not.toEqual(
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

			await expect(
				applyCombatDecisionWindowBatch(
					databaseUrl,
					f.snapshot.windowId,
					ready.batch!,
					f.views[0]!.actorId,
					persistBatchEvent(true)
				)
			).rejects.toThrow(/simulated crash/u);
			expect((await getCombatDecisionWindow(databaseUrl, f.snapshot.windowId))?.status).toBe(
				'ready'
			);
			const crashSql = postgres(databaseUrl, { max: 1 });
			try {
				expect(
					await crashSql<{ version: number; event_cursor: number }[]>`
						select version, event_cursor from summonlab_engine_runs where run_id = ${runId}
					`
				).toEqual([{ version: 3, event_cursor: 4 }]);
				expect(
					await crashSql<{ count: number }[]>`
						select count(*)::integer as count from summonlab_engine_events
						where run_id = ${runId} and event_type = 'mission.combat.choice-batch.applied'
					`
				).toEqual([{ count: 0 }]);
			} finally {
				await crashSql.end({ timeout: 5 });
			}
			let successfulCommits = 0;
			const commit = persistBatchEvent();
			const countedCommit: CombatDecisionBatchCommit = async (transaction, command) => {
				successfulCommits += 1;
				await commit(transaction, command);
			};
			const applied = await Promise.all([
				applyCombatDecisionWindowBatch(
					databaseUrl,
					f.snapshot.windowId,
					ready.batch!,
					f.views[0]!.actorId,
					countedCommit
				),
				applyCombatDecisionWindowBatch(
					databaseUrl,
					f.snapshot.windowId,
					ready.batch!,
					f.views[0]!.actorId,
					countedCommit
				)
			]);
			expect(applied.map((entry) => entry.disposition).sort()).toEqual([
				'already-applied',
				'applied'
			]);
			expect(successfulCommits).toBe(1);
			expect(applied.every((entry) => entry.window.appliedEventCursor === 5)).toBe(true);
			expect(applied[0]!.receipt).toEqual(applied[1]!.receipt);
			expect(applied[0]!.receipt).toMatchObject({
				windowId: f.snapshot.windowId,
				batchHash: ready.batch!.batchHash,
				eventCursor: 5,
				runVersion: 4,
				stateHash: 'c'.repeat(64)
			});
			const appliedSql = postgres(databaseUrl, { max: 1 });
			try {
				const events = await appliedSql<
					{ event_id: string; command_id: string; sequence: number; payload: unknown }[]
				>`
					select event_id, command_id, sequence, payload from summonlab_engine_events
					where run_id = ${runId} and event_type = 'mission.combat.choice-batch.applied'
				`;
				expect(events).toHaveLength(1);
				expect(events[0]).toMatchObject({
					event_id: applied[0]!.receipt.eventId,
					command_id: applied[0]!.receipt.commandId,
					sequence: applied[0]!.receipt.eventCursor,
					payload: { batch: ready.batch!, resolvedEvents: [] }
				});
			} finally {
				await appliedSql.end({ timeout: 5 });
			}
			const laterSql = postgres(databaseUrl, { max: 1 });
			try {
				await laterSql`
					update summonlab_engine_runs set version = 5, event_cursor = 6,
						state_hash = ${'f'.repeat(64)} where run_id = ${runId}
				`;
			} finally {
				await laterSql.end({ timeout: 5 });
			}
			const lateDuplicate = await applyCombatDecisionWindowBatch(
				databaseUrl,
				f.snapshot.windowId,
				ready.batch!,
				f.views[0]!.actorId,
				async () => {
					throw new Error('duplicate application must not call the engine commit');
				}
			);
			expect(lateDuplicate.disposition).toBe('already-applied');
			expect(lateDuplicate.receipt).toEqual(applied[0]!.receipt);
			await expect(
				applyCombatDecisionWindowBatch(
					databaseUrl,
					f.snapshot.windowId,
					{ ...ready.batch!, batchHash: 'd'.repeat(64) },
					f.views[0]!.actorId,
					persistBatchEvent()
				)
			).rejects.toThrow(/different bindings/u);
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

	run('recovers an abandoned queued reservation exactly once after ten minutes', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const f = fixture(runId);
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
		expect(await queueCombatDecisionJob(databaseUrl, job.decisionJobId)).toBe(true);
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`
				update summonlab_decision_jobs
				set updated_at = now() - interval '10 minutes'
				where decision_job_id = ${job.decisionJobId}
			`;
		} finally {
			await sql.end({ timeout: 5 });
		}

		const recovered = await Promise.all([
			recoverExpiredCombatDecisionJobs(databaseUrl),
			recoverExpiredCombatDecisionJobs(databaseUrl)
		]);
		expect(recovered.sort()).toEqual([0, 1]);
		const window = await getCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
		expect(
			window?.jobs.find((candidate) => candidate.decisionJobId === job.decisionJobId)?.status
		).toBe('created');
		expect(await queueCombatDecisionJob(databaseUrl, job.decisionJobId)).toBe(true);
	});

	run('serializes create retries with refresh and atomic apply without deadlock', async () => {
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
				deterministicFallback: f.result(view)
			}))
		};
		const created = await createCombatDecisionWindow(databaseUrl, input);
		const [retried, refreshed] = await within(
			Promise.all([
				createCombatDecisionWindow(databaseUrl, input),
				refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId)
			])
		);
		expect(retried.windowId).toBe(created.windowId);
		expect(refreshed.windowId).toBe(created.windowId);

		for (const job of created.jobs) {
			await queueCombatDecisionJob(databaseUrl, job.decisionJobId);
			await claimCombatDecisionJob(databaseUrl, job.decisionJobId);
			const view = f.views.find((candidate) => candidate.actorId === job.heroId)!;
			await completeCombatDecisionJobAttempt(databaseUrl, job.decisionJobId, f.result(view), 0);
		}
		const ready = await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
		let enteredCommit!: () => void;
		const commitEntered = new Promise<void>((resolve) => {
			enteredCommit = resolve;
		});
		let releaseCommit!: () => void;
		const commitReleased = new Promise<void>((resolve) => {
			releaseCommit = resolve;
		});
		const persist = persistBatchEvent();
		const blockingCommit: CombatDecisionBatchCommit = async (transaction, command) => {
			await persist(transaction, command);
			enteredCommit();
			await commitReleased;
		};
		const applying = applyCombatDecisionWindowBatch(
			databaseUrl,
			f.snapshot.windowId,
			ready.batch!,
			f.views[0]!.actorId,
			blockingCommit
		);
		await within(commitEntered);
		const retrying = createCombatDecisionWindow(databaseUrl, input);
		releaseCommit();
		const settled = await within(Promise.allSettled([applying, retrying]));
		expect(settled[0]).toMatchObject({ status: 'fulfilled' });
		expect(settled[1]).toMatchObject({
			status: 'rejected',
			reason: expect.objectContaining({ message: expect.stringMatching(/stale/u) })
		});
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
			const ready = await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
			expect(ready.status).toBe('ready');

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
			let staleCommitCalls = 0;
			await expect(
				applyCombatDecisionWindowBatch(
					databaseUrl,
					f.snapshot.windowId,
					ready.batch!,
					f.views[0]!.actorId,
					async () => {
						staleCommitCalls += 1;
					}
				)
			).rejects.toThrow(/not ready/u);
			expect(staleCommitCalls).toBe(0);
			expect(
				await claimCombatDecisionJob(databaseUrl, staleCreated.jobs[0]!.decisionJobId)
			).toBeNull();
			expect((await getCombatDecisionWindow(databaseUrl, stale.snapshot.windowId))?.status).toBe(
				'stale'
			);
		}
	);
});
