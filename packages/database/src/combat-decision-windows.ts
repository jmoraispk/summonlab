import { randomUUID } from 'node:crypto';

import {
	ActorDecisionViewSchema,
	COMBAT_DECISION_JOB_VERSION,
	CombatActionIntentSchema,
	CombatChoiceBatchV1Schema,
	CombatDecisionJobRecordV3Schema,
	CombatDecisionJobResultBindingSchema,
	CombatWindowSnapshotSchema,
	DecisionJobFailureSchema,
	PolicyModeSchema,
	type ActorDecisionView,
	type CombatActionIntent,
	type CombatChoiceBatchV1,
	type CombatWindowSnapshot,
	type DecisionAttemptKind,
	type DecisionJobFailure,
	type PolicyMode
} from '@summonlab/contracts';
import { deterministicUuid, hashCanonical } from '@summonlab/engine';
import postgres from 'postgres';

type Queryable = postgres.Sql | postgres.TransactionSql;
type CombatDecisionJobStatus =
	| 'created'
	| 'queued'
	| 'in_progress'
	| 'retry_wait'
	| 'fallback'
	| 'completed'
	| 'stale'
	| 'failed';
export type CombatDecisionWindowStatus = 'collecting' | 'ready' | 'applied' | 'stale' | 'failed';

interface WindowRow {
	window_id: string;
	run_id: string;
	attempt_id: string;
	tick: number;
	snapshot_hash: string;
	expected_run_version: number;
	expected_event_cursor: number;
	status: CombatDecisionWindowStatus;
	snapshot: unknown;
	choice_batch: unknown | null;
	batch_hash: string | null;
	applied_event_cursor: number | null;
	ready_at: Date | string | null;
	applied_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
}

interface JobRow {
	decision_job_id: string;
	run_id: string;
	hero_id: string;
	status: CombatDecisionJobStatus;
	requested_policy: PolicyMode;
	next_attempt_kind: DecisionAttemptKind;
	active_policy: PolicyMode | null;
	resolution: 'requested' | 'fallback' | null;
	expected_run_version: number;
	expected_event_cursor: number;
	packet_hash: string;
	state_hash: string;
	legal_action_hash: string;
	packet: unknown;
	result: unknown | null;
	failure: unknown | null;
	attempt_count: number;
	provider_attempt_count: number;
	max_provider_attempts: number;
	lease_expires_at: Date | string | null;
	window_id: string;
	actor_view_hash: string;
	deterministic_fallback: unknown;
	created_at: Date | string;
	updated_at: Date | string;
}

interface RunRow {
	version: number;
	event_cursor: number;
	state_hash: string;
}

export interface CombatDecisionJob {
	readonly schemaVersion: typeof COMBAT_DECISION_JOB_VERSION;
	readonly decisionJobId: string;
	readonly runId: string;
	readonly heroId: string;
	readonly decisionKind: 'combat-action';
	readonly windowId: string;
	readonly actorViewHash: string;
	readonly expectedRunVersion: number;
	readonly expectedEventCursor: number;
	readonly snapshotHash: string;
	readonly legalActionHash: string;
	readonly status: CombatDecisionJobStatus;
	readonly requestedPolicy: PolicyMode;
	readonly nextAttemptKind: DecisionAttemptKind;
	readonly activePolicy: PolicyMode | null;
	readonly resolution: 'requested' | 'fallback' | null;
	readonly view: ActorDecisionView;
	readonly result: CombatActionIntent | null;
	readonly deterministicFallback: CombatActionIntent;
	readonly failure: DecisionJobFailure | null;
	readonly attemptCount: number;
	readonly providerAttemptCount: number;
	readonly maxProviderAttempts: number;
	readonly leaseExpiresAt: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
}

export interface CombatDecisionWindow {
	readonly windowId: string;
	readonly runId: string;
	readonly attemptId: string;
	readonly tick: number;
	readonly snapshotHash: string;
	readonly expectedRunVersion: number;
	readonly expectedEventCursor: number;
	readonly status: CombatDecisionWindowStatus;
	readonly snapshot: CombatWindowSnapshot;
	readonly batch: CombatChoiceBatchV1 | null;
	readonly batchHash: string | null;
	readonly appliedEventCursor: number | null;
	readonly readyAt: string | null;
	readonly appliedAt: string | null;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly jobs: readonly CombatDecisionJob[];
}

export interface CreateCombatDecisionWindowInput {
	readonly runId: string;
	readonly expectedRunVersion: number;
	readonly expectedEventCursor: number;
	readonly snapshot: CombatWindowSnapshot;
	readonly actors: readonly {
		readonly view: ActorDecisionView;
		readonly requestedPolicy: PolicyMode;
		readonly deterministicFallback: CombatActionIntent;
		readonly maxProviderAttempts?: number;
	}[];
}

export interface CombatDecisionJobClaim {
	readonly job: CombatDecisionJob;
	readonly attemptNumber: number;
	readonly attemptKind: DecisionAttemptKind;
	readonly policy: PolicyMode;
	readonly deterministicFallback: CombatActionIntent;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
	return value === null ? null : iso(value);
}

function unsignedHash<T extends object>(value: T, key: keyof T): string {
	const unsigned = { ...value };
	delete unsigned[key];
	return hashCanonical(unsigned);
}

function targetAllowed(view: ActorDecisionView, intent: CombatActionIntent): boolean {
	const action = view.legalActions.find((candidate) => candidate.actionId === intent.actionId);
	if (
		!action ||
		action.actionInstanceId !== intent.actionInstanceId ||
		action.actionKind !== intent.actionKind ||
		action.skillId !== intent.skillId
	) {
		return false;
	}
	if (
		intent.fallbackId !== null &&
		!action.fallbackOptions.some((fallback) => fallback.fallbackId === intent.fallbackId)
	) {
		return false;
	}
	const contract = action.targetContract;
	const target = intent.target;
	const fallbackMatches = action.fallbackOptions.some(
		(fallback) =>
			fallback.fallbackId === intent.fallbackId &&
			hashCanonical(fallback.target) === hashCanonical(target)
	);
	if (contract.kind !== target.kind) {
		return fallbackMatches;
	}
	if (contract.kind === 'self') return true;
	if (contract.kind === 'entity' && target.kind === 'entity') {
		return contract.allowedCombatantIds.includes(target.combatantId) || fallbackMatches;
	}
	if (contract.kind === 'tile' && target.kind === 'tile') {
		return (
			contract.allowedPositions.some(
				(position) => position.x === target.position.x && position.y === target.position.y
			) || fallbackMatches
		);
	}
	if (contract.kind === 'entity-relative-position' && target.kind === 'entity-relative-position') {
		return (
			(contract.allowedCombatantIds.includes(target.combatantId) &&
				contract.allowedRelations.includes(target.relation)) ||
			fallbackMatches
		);
	}
	return false;
}

function parseBoundIntent(row: JobRow, input: unknown): CombatActionIntent {
	const result = CombatActionIntentSchema.parse(input);
	CombatDecisionJobResultBindingSchema.parse({
		heroId: row.hero_id,
		windowId: row.window_id,
		actorViewHash: row.actor_view_hash,
		snapshotHash: row.state_hash,
		legalActionHash: row.legal_action_hash,
		result
	});
	const view = ActorDecisionViewSchema.parse(row.packet);
	if (!targetAllowed(view, result))
		throw new Error('Combat result is not one supplied legal action');
	return result;
}

function parseJob(row: JobRow): CombatDecisionJob {
	const view = ActorDecisionViewSchema.parse(row.packet);
	const fallback = parseBoundIntent(row, row.deterministic_fallback);
	const record: CombatDecisionJob = {
		schemaVersion: COMBAT_DECISION_JOB_VERSION,
		decisionJobId: row.decision_job_id,
		runId: row.run_id,
		heroId: row.hero_id,
		decisionKind: 'combat-action',
		windowId: row.window_id,
		actorViewHash: row.actor_view_hash,
		expectedRunVersion: row.expected_run_version,
		expectedEventCursor: row.expected_event_cursor,
		snapshotHash: row.state_hash,
		legalActionHash: row.legal_action_hash,
		status: row.status,
		requestedPolicy: row.requested_policy,
		nextAttemptKind: row.next_attempt_kind,
		activePolicy: row.active_policy,
		resolution: row.resolution,
		view,
		result: row.result === null ? null : parseBoundIntent(row, row.result),
		deterministicFallback: fallback,
		failure: row.failure === null ? null : DecisionJobFailureSchema.parse(row.failure),
		attemptCount: row.attempt_count,
		providerAttemptCount: row.provider_attempt_count,
		maxProviderAttempts: row.max_provider_attempts,
		leaseExpiresAt: nullableIso(row.lease_expires_at),
		createdAt: iso(row.created_at),
		updatedAt: iso(row.updated_at)
	};
	CombatDecisionJobRecordV3Schema.parse(record);
	return record;
}

async function jobsFor(sql: Queryable, windowId: string, forUpdate = false): Promise<JobRow[]> {
	return forUpdate
		? await sql<JobRow[]>`
				select * from summonlab_decision_jobs
				where window_id = ${windowId} order by hero_id for update
			`
		: await sql<JobRow[]>`
				select * from summonlab_decision_jobs
				where window_id = ${windowId} order by hero_id
			`;
}

async function windowRow(sql: Queryable, windowId: string, forUpdate = false) {
	const rows = forUpdate
		? await sql<WindowRow[]>`
				select * from summonlab_combat_decision_windows where window_id = ${windowId} for update
			`
		: await sql<WindowRow[]>`
				select * from summonlab_combat_decision_windows where window_id = ${windowId}
			`;
	return rows[0] ?? null;
}

async function readWindow(sql: Queryable, row: WindowRow): Promise<CombatDecisionWindow> {
	const jobs = await jobsFor(sql, row.window_id);
	return {
		windowId: row.window_id,
		runId: row.run_id,
		attemptId: row.attempt_id,
		tick: row.tick,
		snapshotHash: row.snapshot_hash,
		expectedRunVersion: row.expected_run_version,
		expectedEventCursor: row.expected_event_cursor,
		status: row.status,
		snapshot: CombatWindowSnapshotSchema.parse(row.snapshot),
		batch: row.choice_batch === null ? null : CombatChoiceBatchV1Schema.parse(row.choice_batch),
		batchHash: row.batch_hash,
		appliedEventCursor: row.applied_event_cursor,
		readyAt: nullableIso(row.ready_at),
		appliedAt: nullableIso(row.applied_at),
		createdAt: iso(row.created_at),
		updatedAt: iso(row.updated_at),
		jobs: jobs.map(parseJob)
	};
}

async function appendTransition(
	sql: Queryable,
	jobId: string,
	fromStatus: string | null,
	toStatus: string,
	reason: string
): Promise<void> {
	const sequence = await sql<{ next_sequence: number }[]>`
		select (coalesce(max(sequence), 0) + 1)::integer as next_sequence
		from summonlab_decision_job_transitions where decision_job_id = ${jobId}
	`;
	await sql`
		insert into summonlab_decision_job_transitions (
			decision_job_id, sequence, from_status, to_status, reason
		) values (${jobId}, ${sequence[0]?.next_sequence ?? 1}, ${fromStatus}, ${toStatus}, ${reason})
	`;
}

function staleWindowBinding(row: WindowRow, run: RunRow | undefined): boolean {
	const snapshot = CombatWindowSnapshotSchema.parse(row.snapshot);
	return (
		!run ||
		run.version !== row.expected_run_version ||
		run.event_cursor !== row.expected_event_cursor ||
		run.state_hash !== snapshot.stateHash
	);
}

async function markWindowStale(sql: Queryable, row: WindowRow): Promise<WindowRow> {
	const jobs = await jobsFor(sql, row.window_id, true);
	for (const job of jobs) {
		if (job.status === 'stale' || job.status === 'failed') continue;
		await sql`
			update summonlab_decision_jobs set status = 'stale', lease_expires_at = null,
				updated_at = now() where decision_job_id = ${job.decision_job_id}
		`;
		await appendTransition(sql, job.decision_job_id, job.status, 'stale', 'stale-window-binding');
	}
	const updated = await sql<WindowRow[]>`
		update summonlab_combat_decision_windows set status = 'stale', updated_at = now()
		where window_id = ${row.window_id} returning *
	`;
	return updated[0]!;
}

function validateCreateInput(input: CreateCombatDecisionWindowInput) {
	const snapshot = CombatWindowSnapshotSchema.parse(input.snapshot);
	if (unsignedHash(snapshot, 'snapshotHash') !== snapshot.snapshotHash) {
		throw new Error('Combat window snapshot hash is invalid');
	}
	if (input.actors.length !== snapshot.readyActorIds.length) {
		throw new Error('Combat window requires exactly one job per ready actor');
	}
	const actors = input.actors.map((candidate) => {
		const view = ActorDecisionViewSchema.parse(candidate.view);
		if (
			view.windowId !== snapshot.windowId ||
			view.snapshotHash !== snapshot.snapshotHash ||
			!snapshot.readyActorIds.includes(view.actorId) ||
			unsignedHash(view, 'actorViewHash') !== view.actorViewHash ||
			hashCanonical(view.legalActions) !== view.legalActionSetHash
		) {
			throw new Error('Actor decision view is not bound to the frozen window');
		}
		const requestedPolicy = PolicyModeSchema.parse(candidate.requestedPolicy);
		const maxProviderAttempts = candidate.maxProviderAttempts ?? 2;
		if (
			!Number.isSafeInteger(maxProviderAttempts) ||
			maxProviderAttempts < 1 ||
			maxProviderAttempts > 4
		) {
			throw new Error('Combat provider attempts must be from 1 to 4');
		}
		const fallback = CombatActionIntentSchema.parse(candidate.deterministicFallback);
		const syntheticRow = {
			hero_id: view.actorId,
			window_id: view.windowId,
			actor_view_hash: view.actorViewHash,
			state_hash: view.snapshotHash,
			legal_action_hash: view.legalActionSetHash,
			packet: view
		} as JobRow;
		parseBoundIntent(syntheticRow, fallback);
		return { view, requestedPolicy, maxProviderAttempts, fallback };
	});
	if (new Set(actors.map((actor) => actor.view.actorId)).size !== actors.length) {
		throw new Error('Combat decision actors must be unique');
	}
	return { snapshot, actors };
}

export async function createCombatDecisionWindow(
	databaseUrl: string,
	input: CreateCombatDecisionWindowInput
): Promise<CombatDecisionWindow> {
	const parsed = validateCreateInput(input);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const runs = await transaction<RunRow[]>`
				select version, event_cursor, state_hash from summonlab_engine_runs
				where run_id = ${input.runId} for update
			`;
			const run = runs[0];
			if (
				!run ||
				run.version !== input.expectedRunVersion ||
				run.event_cursor !== input.expectedEventCursor ||
				run.state_hash !== parsed.snapshot.stateHash
			) {
				throw new Error('Combat decision window run binding is stale');
			}
			const inserted = await transaction<WindowRow[]>`
				insert into summonlab_combat_decision_windows (
					window_id, run_id, attempt_id, tick, snapshot_hash, expected_run_version,
					expected_event_cursor, snapshot
				) values (
					${parsed.snapshot.windowId}, ${input.runId}, ${parsed.snapshot.attemptId},
					${parsed.snapshot.tick}, ${parsed.snapshot.snapshotHash}, ${input.expectedRunVersion},
					${input.expectedEventCursor}, ${transaction.json(parsed.snapshot as never)}
				) on conflict (window_id) do nothing returning *
			`;
			const existing =
				inserted[0] ?? (await windowRow(transaction, parsed.snapshot.windowId, true));
			if (
				!existing ||
				existing.run_id !== input.runId ||
				existing.snapshot_hash !== parsed.snapshot.snapshotHash ||
				existing.expected_run_version !== input.expectedRunVersion ||
				existing.expected_event_cursor !== input.expectedEventCursor
			) {
				throw new Error('Combat window id was already bound to different state');
			}
			for (const actor of parsed.actors) {
				const jobId = randomUUID();
				const rows = await transaction<{ decision_job_id: string }[]>`
					insert into summonlab_decision_jobs (
						decision_job_id, schema_version, root_job_id, run_id, hero_id, decision_kind,
						requested_policy, expected_run_version, expected_event_cursor, decision_game_time,
						packet_id, packet_hash, state_hash, legal_action_hash, prompt_version,
						context_policy_version, packet, max_provider_attempts, window_id,
						actor_view_hash, deterministic_fallback
					) values (
						${jobId}, ${COMBAT_DECISION_JOB_VERSION}, ${jobId}, ${input.runId},
						${actor.view.actorId}, 'combat-action', ${actor.requestedPolicy},
						${input.expectedRunVersion}, ${input.expectedEventCursor}, now(),
						${parsed.snapshot.windowId}, ${actor.view.actorViewHash},
						${parsed.snapshot.snapshotHash}, ${actor.view.legalActionSetHash},
						'combat-action-prompt-v1', ${actor.view.viewVersion},
						${transaction.json(actor.view as never)}, ${actor.maxProviderAttempts},
						${parsed.snapshot.windowId}, ${actor.view.actorViewHash},
						${transaction.json(actor.fallback as never)}
					) on conflict (window_id, hero_id) where window_id is not null do nothing
					returning decision_job_id
				`;
				if (rows[0])
					await appendTransition(
						transaction,
						rows[0].decision_job_id,
						null,
						'created',
						'job-created'
					);
			}
			const jobs = await jobsFor(transaction, parsed.snapshot.windowId);
			if (
				jobs.length !== parsed.actors.length ||
				jobs.some((job) => {
					const expected = parsed.actors.find((actor) => actor.view.actorId === job.hero_id);
					return (
						!expected ||
						expected.view.actorViewHash !== job.actor_view_hash ||
						expected.requestedPolicy !== job.requested_policy ||
						expected.maxProviderAttempts !== job.max_provider_attempts ||
						hashCanonical(expected.fallback) !== hashCanonical(job.deterministic_fallback)
					);
				})
			) {
				throw new Error('Persisted combat cohort does not match the engine-produced views');
			}
			return await readWindow(transaction, existing);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getCombatDecisionWindow(
	databaseUrl: string,
	windowId: string
): Promise<CombatDecisionWindow | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const row = await windowRow(sql, windowId);
		return row ? await readWindow(sql, row) : null;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function listDispatchableCombatDecisionJobIds(
	databaseUrl: string,
	limit = 32
): Promise<string[]> {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
		throw new Error('Combat decision dispatch limit must be from 1 to 256');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<{ decision_job_id: string }[]>`
			select decision_job_id from summonlab_decision_jobs
			where window_id is not null and schema_version = ${COMBAT_DECISION_JOB_VERSION}
				and status in ('created', 'retry_wait', 'fallback')
			order by updated_at, decision_job_id limit ${limit}
		`;
		return rows.map((row) => row.decision_job_id);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function queueCombatDecisionJob(databaseUrl: string, jobId: string): Promise<boolean> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const locators = await transaction<{ window_id: string }[]>`
				select window_id from summonlab_decision_jobs where decision_job_id = ${jobId}
					and schema_version = ${COMBAT_DECISION_JOB_VERSION}
			`;
			const locator = locators[0];
			if (!locator) return false;
			const window = await windowRow(transaction, locator.window_id, true);
			if (!window) return false;
			const run = (
				await transaction<RunRow[]>`
					select version, event_cursor, state_hash from summonlab_engine_runs
					where run_id = ${window.run_id} for update
				`
			)[0];
			if (staleWindowBinding(window, run)) {
				await markWindowStale(transaction, window);
				return false;
			}
			const rows = await transaction<JobRow[]>`
				select * from summonlab_decision_jobs where decision_job_id = ${jobId} for update
			`;
			const row = rows[0];
			if (!row || !['created', 'retry_wait', 'fallback'].includes(row.status)) return false;
			await transaction`update summonlab_decision_jobs set status = 'queued', updated_at = now()
				where decision_job_id = ${jobId}`;
			await appendTransition(transaction, jobId, row.status, 'queued', 'queue-dispatched');
			return true;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function claimCombatDecisionJob(
	databaseUrl: string,
	jobId: string,
	leaseSeconds = 45
): Promise<CombatDecisionJobClaim | null> {
	if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 300) {
		throw new Error('Decision lease must be from 10 to 300 seconds');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const locators = await transaction<{ window_id: string }[]>`
				select window_id from summonlab_decision_jobs where decision_job_id = ${jobId}
					and schema_version = ${COMBAT_DECISION_JOB_VERSION}
			`;
			const locator = locators[0];
			if (!locator) return null;
			const window = await windowRow(transaction, locator.window_id, true);
			if (!window) return null;
			const run = (
				await transaction<RunRow[]>`
					select version, event_cursor, state_hash from summonlab_engine_runs
					where run_id = ${window.run_id} for update
				`
			)[0];
			if (staleWindowBinding(window, run)) {
				await markWindowStale(transaction, window);
				return null;
			}
			const rows = await transaction<JobRow[]>`
				select * from summonlab_decision_jobs where decision_job_id = ${jobId} for update
			`;
			const row = rows[0];
			if (!row || row.status !== 'queued') return null;
			const attemptKind = row.next_attempt_kind;
			const policy = attemptKind === 'fallback' ? ('scripted' as const) : row.requested_policy;
			const attemptNumber = row.attempt_count + 1;
			const providerAttempts = row.provider_attempt_count + (policy === 'model' ? 1 : 0);
			const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1_000).toISOString();
			await transaction`
				update summonlab_decision_jobs set status = 'in_progress', active_policy = ${policy},
					attempt_count = ${attemptNumber}, provider_attempt_count = ${providerAttempts},
					lease_expires_at = ${leaseExpiresAt}, updated_at = now()
				where decision_job_id = ${jobId}
			`;
			await transaction`
				insert into summonlab_decision_job_attempts (
					decision_job_id, attempt_number, attempt_kind, policy, policy_id, status
				) values (${jobId}, ${attemptNumber}, ${attemptKind}, ${policy},
					${policy === 'model' ? 'model-policy-v1' : policy === 'random' ? 'random-policy-v1' : 'scripted-policy-v1'},
					'in_progress')
			`;
			await appendTransition(transaction, jobId, 'queued', 'in_progress', 'attempt-started');
			const updated = (
				await transaction<JobRow[]>`select * from summonlab_decision_jobs
				where decision_job_id = ${jobId}`
			)[0]!;
			const job = parseJob(updated);
			return {
				job,
				attemptNumber,
				attemptKind,
				policy,
				deterministicFallback: job.deterministicFallback
			};
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

function failureDestination(row: JobRow, retryable: boolean) {
	if (row.next_attempt_kind === 'fallback')
		return { status: 'failed' as const, next: 'fallback' as const };
	if (
		row.active_policy === 'model' &&
		retryable &&
		row.provider_attempt_count < row.max_provider_attempts
	) {
		return { status: 'retry_wait' as const, next: 'retry' as const };
	}
	return { status: 'fallback' as const, next: 'fallback' as const };
}

export async function completeCombatDecisionJobAttempt(
	databaseUrl: string,
	jobId: string,
	resultInput: CombatActionIntent,
	latencyMs: number
): Promise<CombatDecisionJob> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = (
				await transaction<JobRow[]>`select * from summonlab_decision_jobs
				where decision_job_id = ${jobId} and schema_version = ${COMBAT_DECISION_JOB_VERSION} for update`
			)[0];
			if (!row || row.status !== 'in_progress')
				throw new Error(`Combat decision job is not in progress: ${jobId}`);
			const result = parseBoundIntent(row, resultInput);
			if (
				row.next_attempt_kind === 'fallback' &&
				hashCanonical(result) !== hashCanonical(row.deterministic_fallback)
			) {
				throw new Error('Fallback attempt must use the precomputed deterministic fallback');
			}
			await transaction`update summonlab_decision_job_attempts set status = 'succeeded',
				completed_at = now(), latency_ms = ${latencyMs}, result_hash = ${hashCanonical(result)}
				where decision_job_id = ${jobId} and attempt_number = ${row.attempt_count} and status = 'in_progress'`;
			await transaction`update summonlab_decision_jobs set status = 'completed',
				result = ${transaction.json(result as never)},
				resolution = ${row.next_attempt_kind === 'fallback' ? 'fallback' : 'requested'},
				lease_expires_at = null, updated_at = now() where decision_job_id = ${jobId}`;
			await appendTransition(
				transaction,
				jobId,
				'in_progress',
				'completed',
				'policy-result-completed'
			);
			return parseJob(
				(
					await transaction<
						JobRow[]
					>`select * from summonlab_decision_jobs where decision_job_id = ${jobId}`
				)[0]!
			);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function failCombatDecisionJobAttempt(
	databaseUrl: string,
	jobId: string,
	failureInput: Omit<DecisionJobFailure, 'occurredAt'>,
	latencyMs: number
): Promise<CombatDecisionJob> {
	const failure = DecisionJobFailureSchema.parse({
		...failureInput,
		occurredAt: new Date().toISOString()
	});
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = (
				await transaction<JobRow[]>`select * from summonlab_decision_jobs
				where decision_job_id = ${jobId} and schema_version = ${COMBAT_DECISION_JOB_VERSION} for update`
			)[0];
			if (!row || row.status !== 'in_progress')
				throw new Error(`Combat decision job is not in progress: ${jobId}`);
			const next = failureDestination(row, failure.retryable);
			await transaction`update summonlab_decision_job_attempts set status = 'failed', completed_at = now(),
				latency_ms = ${latencyMs}, failure = ${transaction.json(failure as never)}
				where decision_job_id = ${jobId} and attempt_number = ${row.attempt_count} and status = 'in_progress'`;
			await transaction`update summonlab_decision_jobs set status = ${next.status},
				next_attempt_kind = ${next.next}, failure = ${transaction.json(failure as never)},
				lease_expires_at = null, updated_at = now() where decision_job_id = ${jobId}`;
			await appendTransition(
				transaction,
				jobId,
				'in_progress',
				next.status,
				next.status === 'fallback'
					? 'fallback-scheduled'
					: next.status === 'retry_wait'
						? 'retry-scheduled'
						: 'attempts-exhausted'
			);
			return parseJob(
				(
					await transaction<
						JobRow[]
					>`select * from summonlab_decision_jobs where decision_job_id = ${jobId}`
				)[0]!
			);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function recoverExpiredCombatDecisionJobs(
	databaseUrl: string,
	now = new Date().toISOString(),
	limit = 32
): Promise<number> {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
		throw new Error('Combat decision recovery limit must be from 1 to 256');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<JobRow[]>`
				select * from summonlab_decision_jobs where schema_version = ${COMBAT_DECISION_JOB_VERSION}
					and status = 'in_progress' and lease_expires_at <= ${now}
				order by updated_at, decision_job_id limit ${limit} for update skip locked
			`;
			for (const row of rows) {
				const failure = DecisionJobFailureSchema.parse({
					code: 'worker-lease-expired',
					message: 'The worker lease expired before the attempt completed.',
					retryable: true,
					occurredAt: now
				});
				const next = failureDestination(row, true);
				await transaction`update summonlab_decision_job_attempts set status = 'failed', completed_at = ${now},
					failure = ${transaction.json(failure as never)} where decision_job_id = ${row.decision_job_id}
					and attempt_number = ${row.attempt_count} and status = 'in_progress'`;
				await transaction`update summonlab_decision_jobs set status = ${next.status},
					next_attempt_kind = ${next.next}, failure = ${transaction.json(failure as never)},
					lease_expires_at = null, updated_at = now() where decision_job_id = ${row.decision_job_id}`;
				await appendTransition(
					transaction,
					row.decision_job_id,
					'in_progress',
					next.status,
					'worker-lease-expired'
				);
			}
			return rows.length;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function refreshCombatDecisionWindow(
	databaseUrl: string,
	windowId: string
): Promise<CombatDecisionWindow> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await windowRow(transaction, windowId, true);
			if (!row) throw new Error(`Combat decision window not found: ${windowId}`);
			if (['applied', 'stale', 'failed'].includes(row.status))
				return await readWindow(transaction, row);
			const run = (
				await transaction<RunRow[]>`select version, event_cursor, state_hash
				from summonlab_engine_runs where run_id = ${row.run_id} for update`
			)[0];
			if (staleWindowBinding(row, run)) {
				return await readWindow(transaction, await markWindowStale(transaction, row));
			}
			if (row.status === 'ready') return await readWindow(transaction, row);
			const jobs = await jobsFor(transaction, windowId, true);
			if (jobs.some((job) => job.status === 'failed')) {
				await transaction`update summonlab_combat_decision_windows set status = 'failed', updated_at = now()
					where window_id = ${windowId}`;
				return await readWindow(transaction, (await windowRow(transaction, windowId))!);
			}
			if (!jobs.every((job) => job.status === 'completed' && job.result !== null)) {
				return await readWindow(transaction, row);
			}
			const choices = jobs.map((job) => parseBoundIntent(job, job.result));
			const unsignedBatch = {
				batchVersion: 'combat-choice-batch-v1' as const,
				batchId: deterministicUuid(`combat-choice-batch:${windowId}`),
				windowId,
				attemptId: row.attempt_id,
				tick: row.tick,
				snapshotHash: row.snapshot_hash,
				choices
			};
			const batch = CombatChoiceBatchV1Schema.parse({
				...unsignedBatch,
				batchHash: hashCanonical(unsignedBatch)
			});
			await transaction`update summonlab_combat_decision_windows set status = 'ready',
				choice_batch = ${transaction.json(batch as never)}, batch_hash = ${batch.batchHash},
				ready_at = coalesce(ready_at, now()), updated_at = now() where window_id = ${windowId}`;
			return await readWindow(transaction, (await windowRow(transaction, windowId))!);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function applyCombatDecisionWindowBatch(
	databaseUrl: string,
	windowId: string,
	batchInput: CombatChoiceBatchV1,
	appliedEventCursor: number
): Promise<{
	readonly disposition: 'applied' | 'already-applied';
	readonly window: CombatDecisionWindow;
}> {
	const batch = CombatChoiceBatchV1Schema.parse(batchInput);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await windowRow(transaction, windowId, true);
			if (!row) throw new Error(`Combat decision window not found: ${windowId}`);
			if (row.status === 'applied') {
				if (row.batch_hash !== batch.batchHash || row.applied_event_cursor !== appliedEventCursor) {
					throw new Error('Combat decision batch was already applied with different bindings');
				}
				return {
					disposition: 'already-applied' as const,
					window: await readWindow(transaction, row)
				};
			}
			const run = (
				await transaction<RunRow[]>`
				select version, event_cursor, state_hash from summonlab_engine_runs
				where run_id = ${row.run_id} for update
			`
			)[0];
			if (
				row.status !== 'ready' ||
				row.batch_hash !== batch.batchHash ||
				hashCanonical(row.choice_batch) !== hashCanonical(batch) ||
				!run ||
				run.version !== row.expected_run_version ||
				run.event_cursor !== row.expected_event_cursor ||
				staleWindowBinding(row, run) ||
				appliedEventCursor <= row.expected_event_cursor
			) {
				throw new Error('Combat decision window is not ready for this exact batch application');
			}
			const updated = await transaction<WindowRow[]>`
				update summonlab_combat_decision_windows set status = 'applied',
					applied_event_cursor = ${appliedEventCursor}, applied_at = now(), updated_at = now()
				where window_id = ${windowId} and status = 'ready' and batch_hash = ${batch.batchHash}
				returning *
			`;
			if (!updated[0]) throw new Error('Combat decision batch compare-and-swap failed');
			return { disposition: 'applied' as const, window: await readWindow(transaction, updated[0]) };
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
