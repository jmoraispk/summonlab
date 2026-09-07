import { randomUUID } from 'node:crypto';

import { generateSummonableCharacterDraft } from '@summonlab/characters';
import type {
	ActorDecisionView,
	CombatActionIntent,
	CombatWindowSnapshot,
	EngineGameStateV25
} from '@summonlab/contracts';
import { EngineGameStateV25Schema, EngineGameStateV26Schema } from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import {
	advanceUntilDecision,
	applyCommand,
	createBootstrapEngine,
	createCombatModeBinding,
	deterministicUuid,
	hashCanonical,
	hashGameState
} from '@summonlab/engine';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	applyCombatDecisionWindowBatch,
	claimCombatDecisionJob,
	completeCombatDecisionJobAttempt,
	createCombatDecisionWindow,
	failCombatDecisionJobAttempt,
	getCombatDecisionWindow,
	listActionableCombatDecisionWindowIds,
	queueCombatDecisionJob,
	recoverExpiredCombatDecisionJobs,
	refreshCombatDecisionWindow
} from './combat-decision-windows.js';
import { listDispatchableDecisionJobIds } from './decision-jobs.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;
const HASH = { state: 'a'.repeat(64) } as const;
const fixtures = new Map<string, ReturnType<typeof buildFixture>>();
let draftPromise: ReturnType<typeof generateSummonableCharacterDraft> | undefined;

function combatant(
	combatantId: string,
	x: number,
	kind: 'master' | 'hero' | 'monster',
	readiness: number
) {
	return {
		combatantId,
		combatantKind: kind,
		teamId: kind === 'monster' ? 'enemy' : 'party',
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
		readiness: { value: readiness, exactNumerator: readiness, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	};
}

function actionTemplate() {
	return {
		actionId: 'guard-self',
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
		],
		resolutionProfile: {
			profileKind: 'non-damaging' as const,
			rulesVersion: 'combat-rules-v1' as const,
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		}
	};
}

function engineCommandBase(state: EngineGameStateV25, key: string) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: {
			source: 'manual' as const,
			timing: 'step' as const,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		}
	};
}

function buildFixture(deployed: EngineGameStateV25) {
	const attempt = deployed.mission.attempt;
	if (!attempt) throw new Error('Expected deployed attempt');
	const attemptId = attempt.attemptId;
	const actorIds = [attempt.party.masterId, attempt.party.heroIds[0]!].sort();
	const monsterId = deterministicUuid(`${attemptId}:database-monster`);
	const terrain = { width: 8, height: 8, blockedTiles: [], features: [] };
	const combatants = {
		...Object.fromEntries(
			actorIds.map((id, index) => [
				id,
				combatant(id, index + 1, id === attempt.party.masterId ? 'master' : 'hero', 10_000)
			])
		),
		[monsterId]: combatant(monsterId, 5, 'monster', 0)
	};
	const actorContexts = Object.fromEntries(
		Object.keys(combatants).map((actorId) => [
			actorId,
			{
				actorId,
				visibleCombatantIds: Object.keys(combatants).filter((id) => id !== actorId),
				visibleTelegraphIds: [],
				observableReadinessActorIds: [],
				targetablePositions: [{ ...combatants[actorId]!.position }],
				visibleTerrainFeatureIds: [],
				rememberedContext: [],
				doctrine: [],
				relationships: [],
				masterDirections: [],
				legalActionTemplates: [actionTemplate()]
			}
		])
	);
	const partyHeroes = Object.fromEntries(
		actorIds
			.filter((id) => id !== attempt.party.masterId)
			.map((id) => [
				id,
				{
					startingHealth: 100,
					startingMana: 20,
					currentHealth: 100,
					currentMana: 20,
					damageTaken: 0,
					downed: false
				}
			])
	);
	const readinessState = {
		stateVersion: 'readiness-combat-state-v1' as const,
		seed: hashCanonical({ runId: deployed.runId, attemptId }),
		attemptId,
		tick: 7,
		combatants,
		actorContexts,
		terrain,
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 7, eventsEmitted: 0, noProgressCycles: 0 },
		outcomeEvidence: {
			evidenceVersion: 'readiness-outcome-evidence-v1' as const,
			attemptId,
			partyHeroes,
			resolvedEvents: [],
			emittedEventIds: [],
			eventsEmitted: 0,
			engineRecoveredCombatantIds: [],
			securedLoot: [],
			objectiveStates: [],
			terminalDirective: null,
			authoredDeadline: null
		},
		status: 'active' as const,
		result: null
	};
	const state = EngineGameStateV26Schema.parse({
		...deployed,
		schemaVersion: 26,
		contentVersion: 'engine-v26',
		version: 3,
		eventCursor: 4,
		mission: {
			...deployed.mission,
			attempt: {
				...Object.fromEntries(
					Object.entries(attempt).filter(
						([key]) => key !== 'turnState' && key !== 'combatModeBinding'
					)
				),
				combatModeBinding: createCombatModeBinding('agent-readiness-v1', attempt.preparedAt),
				combatState: { modeId: 'agent-readiness-v1', readinessState }
			}
		}
	});
	const decision = advanceUntilDecision(readinessState, COMBAT_RULES_V1);
	if (decision.kind !== 'decision-window') throw new Error('Expected database readiness window');
	const snapshot: CombatWindowSnapshot = decision.snapshot;
	const views: ActorDecisionView[] = [...decision.views];
	const result = (view: ActorDecisionView): CombatActionIntent => ({
		windowId: snapshot.windowId,
		attemptId,
		tick: snapshot.tick,
		actorId: view.actorId,
		snapshotHash: snapshot.snapshotHash,
		actorViewHash: view.actorViewHash,
		legalActionSetHash: view.legalActionSetHash,
		actionId: view.legalActions[0]!.actionId,
		actionInstanceId: view.legalActions[0]!.actionInstanceId,
		actionKind: 'guard',
		skillId: null,
		target: { kind: 'self' },
		fallbackId: 'brace'
	});
	return { runId: deployed.runId, state, snapshot, views, result };
}

async function insertRun(runId: string): Promise<void> {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	draftPromise ??= generateSummonableCharacterDraft(
		{
			seed: 'database-readiness-character',
			generationVersion: 'human-v6',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		},
		{ capabilityEntropy: '8'.repeat(64) }
	);
	const draft = await draftPromise;
	const initial = EngineGameStateV25Schema.parse(
		createBootstrapEngine({ runId, seed: `database-readiness-${runId}`, draft }).snapshot.state
	);
	const heroId = Object.keys(initial.heroes)[0]!;
	const prepared = applyCommand(initial, {
		...engineCommandBase(initial, 'prepare'),
		commandType: 'mission.prepare',
		heroIds: [heroId],
		combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
	}).state;
	if (prepared.schemaVersion !== 25) throw new Error('Expected v25 prepared state');
	const deployed = applyCommand(prepared, {
		...engineCommandBase(prepared, 'deploy'),
		commandType: 'mission.deploy'
	}).state;
	if (deployed.schemaVersion !== 25) throw new Error('Expected v25 deployed state');
	const fixture = buildFixture(deployed);
	fixtures.set(runId, fixture);
	const stateHash = hashGameState(fixture.state);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql`
			insert into summonlab_proof_runs (
				run_id, control_mode, recipe, manifest, mind, manifest_hash, first_observation
			) values (${runId}, 'wait', ${sql.json({})}, ${sql.json({})}, ${sql.json({})},
				${stateHash}, 'fixture')
		`;
		await sql`
			insert into summonlab_engine_runs (
				run_id, seed, content_version, status, version, event_cursor, entropy_cursor,
				simulated_at, state_hash
			) values (${runId}, ${fixture.state.seed}, 'engine-v26', 'active', 3, 4,
				${fixture.state.entropyCursor}, ${fixture.state.simulatedAt}, ${stateHash})
		`;
		await sql`
			insert into summonlab_engine_snapshots (run_id, event_cursor, version, state, state_hash)
			values (${runId}, 4, 3, ${sql.json(fixture.state as never)}, ${stateHash})
		`;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

function fixture(runId: string) {
	const value = fixtures.get(runId);
	if (!value) throw new Error(`Missing readiness fixture for ${runId}`);
	return value;
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

async function installAppliedWindowFailureTrigger(): Promise<() => Promise<void>> {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.unsafe(`
			create or replace function summonlab_test_fail_applied_window() returns trigger
			language plpgsql as $$
			begin
				raise exception 'simulated crash after engine commit';
			end
			$$;
			drop trigger if exists summonlab_test_fail_applied_window on summonlab_combat_decision_windows;
			create trigger summonlab_test_fail_applied_window
			before update on summonlab_combat_decision_windows
			for each row when (new.status = 'applied' and old.status <> 'applied')
			execute function summonlab_test_fail_applied_window();
		`);
	} finally {
		await sql.end({ timeout: 5 });
	}
	return async () => {
		const cleanup = postgres(databaseUrl, { max: 1 });
		try {
			await cleanup.unsafe(`
				drop trigger if exists summonlab_test_fail_applied_window
				on summonlab_combat_decision_windows;
				drop function if exists summonlab_test_fail_applied_window();
			`);
		} finally {
			await cleanup.end({ timeout: 5 });
		}
	};
}

type ReceiptCorruption =
	'event-actor' | 'event-source' | 'event-correlation' | 'event-state-hash' | 'snapshot-state-hash';

async function installReceiptCorruptionTrigger(
	corruption: ReceiptCorruption
): Promise<() => Promise<void>> {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const eventMutation = {
		'event-actor': `new.actor_id := '90000000-0000-4000-8000-000000000001';`,
		'event-source': `new.source := '{"source":"manual","timing":null,"fallbackPolicy":null,"directiveIds":[],"decisionJobId":null}'::jsonb;`,
		'event-correlation': `new.correlation_id := '90000000-0000-4000-8000-000000000002';`,
		'event-state-hash': `new.after_state_hash := repeat('e', 64);`,
		'snapshot-state-hash': `new.state_hash := repeat('f', 64);`
	}[corruption];
	const table =
		corruption === 'snapshot-state-hash' ? 'summonlab_engine_snapshots' : 'summonlab_engine_events';
	const condition =
		corruption === 'snapshot-state-hash'
			? 'new.event_cursor = 5'
			: "new.event_type = 'mission.combat.choice-batch.applied'";
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.unsafe(`
			create or replace function summonlab_test_corrupt_combat_receipt() returns trigger
			language plpgsql as $$
			begin
				${eventMutation}
				return new;
			end
			$$;
			drop trigger if exists summonlab_test_corrupt_combat_receipt on ${table};
			create trigger summonlab_test_corrupt_combat_receipt
			before insert on ${table}
			for each row when (${condition})
			execute function summonlab_test_corrupt_combat_receipt();
		`);
	} finally {
		await sql.end({ timeout: 5 });
	}
	return async () => {
		const cleanup = postgres(databaseUrl, { max: 1 });
		try {
			await cleanup.unsafe(`
				drop trigger if exists summonlab_test_corrupt_combat_receipt on ${table};
				drop function if exists summonlab_test_corrupt_combat_receipt();
			`);
		} finally {
			await cleanup.end({ timeout: 5 });
		}
	};
}

const COMBAT_COMMIT_BARRIER = 7_210_621;

async function installCombatCommitBarrierTrigger(): Promise<() => Promise<void>> {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql.unsafe(`
			create or replace function summonlab_test_block_combat_commit() returns trigger
			language plpgsql as $$
			begin
				perform pg_advisory_xact_lock(${COMBAT_COMMIT_BARRIER});
				return new;
			end
			$$;
			drop trigger if exists summonlab_test_block_combat_commit on summonlab_engine_commands;
			create trigger summonlab_test_block_combat_commit
			before insert on summonlab_engine_commands
			for each row when (new.command_type = 'mission.apply.combat-choice-batch')
			execute function summonlab_test_block_combat_commit();
		`);
	} finally {
		await sql.end({ timeout: 5 });
	}
	return async () => {
		const cleanup = postgres(databaseUrl, { max: 1 });
		try {
			await cleanup.unsafe(`
				drop trigger if exists summonlab_test_block_combat_commit on summonlab_engine_commands;
				drop function if exists summonlab_test_block_combat_commit();
			`);
		} finally {
			await cleanup.end({ timeout: 5 });
		}
	};
}

async function waitForCombatCommitBarrier(): Promise<void> {
	if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await within(
			new Promise<void>((resolve, reject) => {
				const poll = async () => {
					try {
						const rows = await sql<{ blocked: boolean }[]>`
							select exists (
								select 1 from pg_locks where locktype = 'advisory' and not granted
							) as blocked
						`;
						if (rows[0]?.blocked) resolve();
						else setTimeout(() => void poll(), 10);
					} catch (error) {
						reject(error);
					}
				};
				void poll();
			})
		);
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
		'discovers terminal unapplied windows after a coordinator restart',
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
					requestedPolicy: 'scripted' as const,
					deterministicFallback: f.result(view)
				}))
			});
			expect(await listActionableCombatDecisionWindowIds(databaseUrl)).not.toContain(
				f.snapshot.windowId
			);
			for (const job of created.jobs) {
				await queueCombatDecisionJob(databaseUrl, job.decisionJobId);
				await claimCombatDecisionJob(databaseUrl, job.decisionJobId);
				const view = f.views.find((candidate) => candidate.actorId === job.heroId)!;
				await completeCombatDecisionJobAttempt(databaseUrl, job.decisionJobId, f.result(view), 0);
			}
			expect(await listActionableCombatDecisionWindowIds(databaseUrl)).toContain(
				f.snapshot.windowId
			);
			await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
			expect(await listActionableCombatDecisionWindowIds(databaseUrl)).toContain(
				f.snapshot.windowId
			);
		},
		10_000
	);

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

			const removeFailureTrigger = await installAppliedWindowFailureTrigger();
			try {
				await expect(
					applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!)
				).rejects.toThrow(/simulated crash/u);
			} finally {
				await removeFailureTrigger();
			}
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
				expect(
					await crashSql<{ count: number }[]>`
						select count(*)::integer as count from summonlab_engine_commands
						where run_id = ${runId} and command_type = 'mission.apply.combat-choice-batch'
					`
				).toEqual([{ count: 0 }]);
				expect(
					await crashSql<{ count: number }[]>`
						select count(*)::integer as count from summonlab_engine_snapshots
						where run_id = ${runId} and event_cursor = 5
					`
				).toEqual([{ count: 0 }]);
			} finally {
				await crashSql.end({ timeout: 5 });
			}
			const applied = await Promise.all([
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!),
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!)
			]);
			expect(applied.map((entry) => entry.disposition).sort()).toEqual([
				'already-applied',
				'applied'
			]);
			expect(applied.every((entry) => entry.window.appliedEventCursor === 5)).toBe(true);
			expect(applied[0]!.receipt).toEqual(applied[1]!.receipt);
			expect(applied[0]!.receipt).toMatchObject({
				windowId: f.snapshot.windowId,
				batchHash: ready.batch!.batchHash,
				eventCursor: 5,
				runVersion: 4,
				stateHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
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
					payload: { batch: ready.batch!, resolvedEvents: expect.any(Array) }
				});
				expect(
					await appliedSql<{ count: number }[]>`
						select count(*)::integer as count from summonlab_engine_commands
						where run_id = ${runId} and command_type = 'mission.apply.combat-choice-batch'
					`
				).toEqual([{ count: 1 }]);
				const snapshots = await appliedSql<
					{ state: unknown; state_hash: string; version: number; event_cursor: number }[]
				>`
					select state, state_hash, version, event_cursor from summonlab_engine_snapshots
					where run_id = ${runId} and event_cursor = 5
				`;
				expect(snapshots).toHaveLength(1);
				expect(snapshots[0]).toMatchObject({
					version: 4,
					event_cursor: 5,
					state_hash: applied[0]!.receipt.stateHash
				});
				expect(hashCanonical(snapshots[0]!.state)).toBe(snapshots[0]!.state_hash);
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
				ready.batch!
			);
			expect(lateDuplicate.disposition).toBe('already-applied');
			expect(lateDuplicate.receipt).toEqual(applied[0]!.receipt);
			await expect(
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, {
					...ready.batch!,
					batchHash: 'd'.repeat(64)
				})
			).rejects.toThrow(/different bindings/u);
		}
	);

	run.each([
		'missing-snapshot',
		'wrong-snapshot-hash',
		'event-actor',
		'event-source',
		'event-correlation',
		'event-state-hash',
		'snapshot-state-hash'
	] as const)('rejects and rolls back a corrupted %s receipt', async (corruption) => {
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
		for (const job of created.jobs) {
			await queueCombatDecisionJob(databaseUrl, job.decisionJobId);
			await claimCombatDecisionJob(databaseUrl, job.decisionJobId);
			const view = f.views.find((candidate) => candidate.actorId === job.heroId)!;
			await completeCombatDecisionJobAttempt(databaseUrl, job.decisionJobId, f.result(view), 0);
		}
		const ready = await refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
		let removeTrigger: (() => Promise<void>) | undefined;
		const setup = postgres(databaseUrl, { max: 1 });
		try {
			if (corruption === 'missing-snapshot') {
				await setup`
					delete from summonlab_engine_snapshots where run_id = ${runId} and event_cursor = 4
				`;
			} else if (corruption === 'wrong-snapshot-hash') {
				await setup`
					update summonlab_engine_snapshots set state_hash = ${'f'.repeat(64)}
					where run_id = ${runId} and event_cursor = 4
				`;
			} else {
				removeTrigger = await installReceiptCorruptionTrigger(corruption);
			}
		} finally {
			await setup.end({ timeout: 5 });
		}
		try {
			await expect(
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!)
			).rejects.toThrow(/snapshot|receipt|exact window batch/u);
		} finally {
			await removeTrigger?.();
		}
		expect((await getCombatDecisionWindow(databaseUrl, f.snapshot.windowId))?.status).toBe('ready');
		const verify = postgres(databaseUrl, { max: 1 });
		try {
			expect(
				await verify<{ version: number; event_cursor: number }[]>`
					select version, event_cursor from summonlab_engine_runs where run_id = ${runId}
				`
			).toEqual([{ version: 3, event_cursor: 4 }]);
			expect(
				await verify<{ count: number }[]>`
					select count(*)::integer as count from summonlab_engine_commands
					where run_id = ${runId} and command_type = 'mission.apply.combat-choice-batch'
				`
			).toEqual([{ count: 0 }]);
			expect(
				await verify<{ count: number }[]>`
					select count(*)::integer as count from summonlab_engine_events
					where run_id = ${runId} and event_type = 'mission.combat.choice-batch.applied'
				`
			).toEqual([{ count: 0 }]);
			expect(
				await verify<{ count: number }[]>`
					select count(*)::integer as count from summonlab_engine_snapshots
					where run_id = ${runId} and event_cursor = 5
				`
			).toEqual([{ count: 0 }]);
		} finally {
			await verify.end({ timeout: 5 });
		}
	});

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
		const removeBarrierTrigger = await installCombatCommitBarrierTrigger();
		const blocker = postgres(databaseUrl, { max: 1 });
		try {
			await blocker`select pg_advisory_lock(${COMBAT_COMMIT_BARRIER})`;
			const applying = applyCombatDecisionWindowBatch(
				databaseUrl,
				f.snapshot.windowId,
				ready.batch!
			);
			await waitForCombatCommitBarrier();
			const retrying = createCombatDecisionWindow(databaseUrl, input);
			const refreshing = refreshCombatDecisionWindow(databaseUrl, f.snapshot.windowId);
			await blocker`select pg_advisory_unlock(${COMBAT_COMMIT_BARRIER})`;
			const settled = await within(Promise.allSettled([applying, retrying, refreshing]), 5_000);
			expect(settled[0]).toMatchObject({
				status: 'fulfilled',
				value: expect.objectContaining({ disposition: 'applied' })
			});
			expect(settled[1]).toMatchObject({
				status: 'rejected',
				reason: expect.objectContaining({ message: expect.stringMatching(/stale/u) })
			});
			expect(settled[2]).toMatchObject({
				status: 'fulfilled',
				value: expect.objectContaining({ status: 'applied' })
			});
		} finally {
			await blocker`select pg_advisory_unlock(${COMBAT_COMMIT_BARRIER})`;
			await blocker.end({ timeout: 5 });
			await removeBarrierTrigger();
		}
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

			const staleSql = postgres(databaseUrl, { max: 1 });
			try {
				await staleSql`update summonlab_engine_runs set version = 4, event_cursor = 5 where run_id = ${runId}`;
			} finally {
				await staleSql.end({ timeout: 5 });
			}
			await expect(
				applyCombatDecisionWindowBatch(databaseUrl, f.snapshot.windowId, ready.batch!)
			).rejects.toThrow(/not ready/u);
			expect(await claimCombatDecisionJob(databaseUrl, created.jobs[0]!.decisionJobId)).toBeNull();
			expect((await getCombatDecisionWindow(databaseUrl, f.snapshot.windowId))?.status).toBe(
				'stale'
			);
		}
	);
});
