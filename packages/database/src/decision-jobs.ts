import { randomUUID } from 'node:crypto';

import {
	DECISION_JOB_VERSION,
	DecisionAttemptKindSchema,
	DecisionJobFailureSchema,
	DecisionJobRecordSchema,
	DecisionJobStatusSchema,
	DecisionProviderRequestProfileSchema,
	HERO_MODEL_PROMPT_VERSION,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	MODEL_POLICY_VERSION,
	PolicyModeSchema,
	RANDOM_POLICY_VERSION,
	SCRIPTED_POLICY_VERSION,
	type DecisionAttemptKind,
	type DecisionJobFailure,
	type DecisionJobRecord,
	type DecisionJobStatus,
	type DecisionProviderRequestProfile,
	type HeroDecisionPacket,
	type HeroPolicyResult,
	type PolicyMode
} from '@summonlab/contracts';
import {
	commandFromHeroPolicyResult,
	decisionLegalActions,
	hashCanonical
} from '@summonlab/engine';
import postgres from 'postgres';

import { commitEngineCommandInTransaction, getEngineSnapshotInTransaction } from './engine.js';
import { projectProofChoiceInTransaction } from './proof.js';

type Queryable = postgres.Sql | postgres.TransactionSql;

interface DecisionJobRow {
	decision_job_id: string;
	schema_version: string;
	root_job_id: string;
	parent_job_id: string | null;
	replacement_job_id: string | null;
	run_id: string;
	hero_id: string;
	decision_kind: DecisionJobRecord['decisionKind'];
	status: DecisionJobStatus;
	requested_policy: PolicyMode;
	next_attempt_kind: DecisionAttemptKind;
	active_policy: PolicyMode | null;
	resolution: DecisionJobRecord['resolution'];
	expected_run_version: number;
	expected_event_cursor: number;
	decision_game_time: Date | string;
	packet_id: string;
	packet_hash: string;
	state_hash: string;
	legal_action_hash: string;
	prompt_version: string;
	context_policy_version: string;
	provider_request: unknown | null;
	packet: unknown;
	result: unknown | null;
	failure: unknown | null;
	attempt_count: number;
	provider_attempt_count: number;
	max_provider_attempts: number;
	replan_count: number;
	max_replans: number;
	lease_expires_at: Date | string | null;
	applied_command_id: string | null;
	applied_event_cursor: number | null;
	applied_run_version: number | null;
	applied_state_hash: string | null;
	applied_at: Date | string | null;
	created_at: Date | string;
	updated_at: Date | string;
}

interface DecisionAttemptRow {
	attempt_number: number;
	attempt_kind: DecisionAttemptKind;
	policy: PolicyMode;
	policy_id: HeroPolicyResult['policyId'];
	status: 'in_progress' | 'succeeded' | 'failed';
	started_at: Date | string;
	completed_at: Date | string | null;
	latency_ms: number | null;
	result_hash: string | null;
	failure: unknown | null;
}

interface DecisionTransitionRow {
	sequence: number;
	from_status: DecisionJobStatus | null;
	to_status: DecisionJobStatus;
	reason: string;
	detail: string | null;
	occurred_at: Date | string;
}

interface EngineRunBindingRow {
	version: number;
	event_cursor: number;
	state_hash: string;
}

export interface CreateDecisionJobInput {
	readonly packet: HeroDecisionPacket;
	readonly requestedPolicy: PolicyMode;
	readonly providerRequest: DecisionProviderRequestProfile | null;
	readonly maxProviderAttempts?: number;
	readonly maxReplans?: number;
}

export interface DecisionJobClaim {
	readonly job: DecisionJobRecord;
	readonly attemptNumber: number;
	readonly attemptKind: DecisionAttemptKind;
	readonly policy: PolicyMode;
	readonly policyId: HeroPolicyResult['policyId'];
}

export type DecisionJobApplicationResult =
	| { readonly disposition: 'applied'; readonly job: DecisionJobRecord }
	| { readonly disposition: 'stale'; readonly job: DecisionJobRecord };

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
	return value === null ? null : iso(value);
}

function policyIdFor(policy: PolicyMode): HeroPolicyResult['policyId'] {
	if (policy === 'random') return RANDOM_POLICY_VERSION;
	if (policy === 'scripted') return SCRIPTED_POLICY_VERSION;
	return MODEL_POLICY_VERSION;
}

function packetIsIntact(packet: HeroDecisionPacket): boolean {
	const unsigned = { ...packet } as Partial<HeroDecisionPacket>;
	delete unsigned.packetHash;
	return hashCanonical(unsigned) === packet.packetHash;
}

async function attemptsFor(sql: Queryable, decisionJobId: string) {
	const rows = await sql<DecisionAttemptRow[]>`
		select * from summonlab_decision_job_attempts
		where decision_job_id = ${decisionJobId}
		order by attempt_number
	`;
	return rows.map((row) => ({
		attemptNumber: row.attempt_number,
		kind: row.attempt_kind,
		policy: row.policy,
		policyId: row.policy_id,
		status: row.status,
		startedAt: iso(row.started_at),
		completedAt: nullableIso(row.completed_at),
		latencyMs: row.latency_ms,
		resultHash: row.result_hash,
		failure: row.failure
	}));
}

async function transitionsFor(sql: Queryable, decisionJobId: string) {
	const rows = await sql<DecisionTransitionRow[]>`
		select * from summonlab_decision_job_transitions
		where decision_job_id = ${decisionJobId}
		order by sequence
	`;
	return rows.map((row) => ({
		sequence: row.sequence,
		fromStatus: row.from_status,
		toStatus: row.to_status,
		reason: row.reason,
		detail: row.detail,
		occurredAt: iso(row.occurred_at)
	}));
}

async function parseJob(sql: Queryable, row: DecisionJobRow): Promise<DecisionJobRecord> {
	const [attempts, transitions] = await Promise.all([
		attemptsFor(sql, row.decision_job_id),
		transitionsFor(sql, row.decision_job_id)
	]);
	const record = {
		schemaVersion: row.schema_version,
		decisionJobId: row.decision_job_id,
		rootJobId: row.root_job_id,
		parentJobId: row.parent_job_id,
		replacementJobId: row.replacement_job_id,
		runId: row.run_id,
		heroId: row.hero_id,
		decisionKind: row.decision_kind,
		status: row.status,
		requestedPolicy: row.requested_policy,
		nextAttemptKind: row.next_attempt_kind,
		activePolicy: row.active_policy,
		resolution: row.resolution,
		expectedRunVersion: row.expected_run_version,
		expectedEventCursor: row.expected_event_cursor,
		decisionGameTime: iso(row.decision_game_time),
		packetId: row.packet_id,
		packetHash: row.packet_hash,
		stateHash: row.state_hash,
		legalActionHash: row.legal_action_hash,
		promptVersion: row.prompt_version,
		contextPolicyVersion: row.context_policy_version,
		packet: row.packet,
		result: row.result,
		failure: row.failure,
		attemptCount: row.attempt_count,
		providerAttemptCount: row.provider_attempt_count,
		maxProviderAttempts: row.max_provider_attempts,
		replanCount: row.replan_count,
		maxReplans: row.max_replans,
		leaseExpiresAt: nullableIso(row.lease_expires_at),
		application:
			row.applied_command_id &&
			row.applied_event_cursor &&
			row.applied_run_version &&
			row.applied_state_hash &&
			row.applied_at
				? {
						commandId: row.applied_command_id,
						eventCursor: row.applied_event_cursor,
						runVersion: row.applied_run_version,
						stateHash: row.applied_state_hash,
						appliedAt: iso(row.applied_at)
					}
				: null,
		attempts,
		transitions,
		createdAt: iso(row.created_at),
		updatedAt: iso(row.updated_at)
	};
	return DecisionJobRecordSchema.parse(
		row.schema_version === DECISION_JOB_VERSION
			? {
					...record,
					providerRequest: row.provider_request
				}
			: record
	);
}

async function jobRow(sql: Queryable, decisionJobId: string, forUpdate = false) {
	const rows = forUpdate
		? await sql<DecisionJobRow[]>`
				select * from summonlab_decision_jobs
				where decision_job_id = ${decisionJobId} for update
			`
		: await sql<DecisionJobRow[]>`
				select * from summonlab_decision_jobs where decision_job_id = ${decisionJobId}
			`;
	return rows[0] ?? null;
}

async function appendTransition(
	sql: Queryable,
	decisionJobId: string,
	fromStatus: DecisionJobStatus | null,
	toStatus: DecisionJobStatus,
	reason: string,
	detail: string | null = null
): Promise<void> {
	DecisionJobStatusSchema.parse(toStatus);
	if (fromStatus !== null) DecisionJobStatusSchema.parse(fromStatus);
	const rows = await sql<{ next_sequence: number }[]>`
		select (coalesce(max(sequence), 0) + 1)::integer as next_sequence
		from summonlab_decision_job_transitions where decision_job_id = ${decisionJobId}
	`;
	const sequence = rows[0]?.next_sequence ?? 1;
	await sql`
		insert into summonlab_decision_job_transitions (
			decision_job_id, sequence, from_status, to_status, reason, detail
		) values (${decisionJobId}, ${sequence}, ${fromStatus}, ${toStatus}, ${reason}, ${detail})
	`;
}

async function insertDecisionJob(
	sql: Queryable,
	input: CreateDecisionJobInput & {
		readonly decisionJobId: string;
		readonly rootJobId: string;
		readonly parentJobId: string | null;
		readonly replanCount: number;
	}
): Promise<{ readonly row: DecisionJobRow; readonly created: boolean }> {
	const packet = HeroDecisionPacketSchema.parse(input.packet);
	if (!packetIsIntact(packet) || hashCanonical(packet.legalActions) !== packet.legalActionHash) {
		throw new Error('Cannot persist a decision job with a tampered packet');
	}
	const requestedPolicy = PolicyModeSchema.parse(input.requestedPolicy);
	const providerRequest =
		input.providerRequest === null
			? null
			: DecisionProviderRequestProfileSchema.parse(input.providerRequest);
	if ((requestedPolicy === 'model') !== (providerRequest !== null)) {
		throw new Error('Model decision jobs require one exact provider request profile');
	}
	if (providerRequest && providerRequest.packetHash !== packet.packetHash) {
		throw new Error('Decision provider request profile is bound to another packet');
	}
	const maxProviderAttempts = input.maxProviderAttempts ?? 2;
	const maxReplans = input.maxReplans ?? 3;
	const inserted = await sql<DecisionJobRow[]>`
		insert into summonlab_decision_jobs (
			decision_job_id, schema_version, root_job_id, parent_job_id, run_id, hero_id,
			decision_kind, requested_policy, expected_run_version, expected_event_cursor,
			decision_game_time, packet_id, packet_hash, state_hash, legal_action_hash,
			prompt_version, context_policy_version, provider_request, packet, max_provider_attempts,
			replan_count, max_replans
		) values (
			${input.decisionJobId}, ${DECISION_JOB_VERSION}, ${input.rootJobId},
			${input.parentJobId}, ${packet.runId}, ${packet.heroId}, ${packet.decisionKind},
			${requestedPolicy}, ${packet.world.stateVersion}, ${packet.world.eventCursor},
			${packet.assembledAtGameTime}, ${packet.packetId}, ${packet.packetHash},
			${packet.world.stateHash}, ${packet.legalActionHash}, ${HERO_MODEL_PROMPT_VERSION},
			${packet.contextPolicyVersion}, ${providerRequest ? sql.json(providerRequest as never) : null},
			${sql.json(packet as never)}, ${maxProviderAttempts},
			${input.replanCount}, ${maxReplans}
		)
		on conflict (run_id, hero_id, packet_hash, requested_policy) do nothing
		returning *
	`;
	const created = Boolean(inserted[0]);
	const row =
		inserted[0] ??
		(
			await sql<DecisionJobRow[]>`
				select * from summonlab_decision_jobs
				where run_id = ${packet.runId} and hero_id = ${packet.heroId}
					and packet_hash = ${packet.packetHash} and requested_policy = ${requestedPolicy}
			`
		)[0];
	if (!row) throw new Error('Decision job insert did not resolve an authoritative row');
	if (created) {
		await appendTransition(sql, row.decision_job_id, null, 'created', 'job-created');
	}
	return { row, created };
}

export async function createDecisionJob(
	databaseUrl: string,
	input: CreateDecisionJobInput
): Promise<DecisionJobRecord> {
	const decisionJobId = randomUUID();
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const inserted = await insertDecisionJob(transaction, {
				...input,
				decisionJobId,
				rootJobId: decisionJobId,
				parentJobId: null,
				replanCount: 0
			});
			return await parseJob(transaction, inserted.row);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function createReplannedDecisionJob(
	databaseUrl: string,
	parentJobId: string,
	packetInput: HeroDecisionPacket,
	providerRequestInput: DecisionProviderRequestProfile | null
): Promise<DecisionJobRecord | null> {
	const packet = HeroDecisionPacketSchema.parse(packetInput);
	const decisionJobId = randomUUID();
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const parent = await jobRow(transaction, parentJobId, true);
			if (!parent) throw new Error(`Decision job not found: ${parentJobId}`);
			if (parent.status === 'replanned' && parent.replacement_job_id) {
				const replacement = await jobRow(transaction, parent.replacement_job_id);
				return replacement ? await parseJob(transaction, replacement) : null;
			}
			if (parent.status !== 'stale' || parent.replan_count >= parent.max_replans) return null;
			if (packet.runId !== parent.run_id || packet.heroId !== parent.hero_id) {
				throw new Error('Replanned packet changed the decision actor');
			}
			const inserted = await insertDecisionJob(transaction, {
				packet,
				requestedPolicy: parent.requested_policy,
				providerRequest: providerRequestInput,
				maxProviderAttempts: parent.max_provider_attempts,
				maxReplans: parent.max_replans,
				decisionJobId,
				rootJobId: parent.root_job_id,
				parentJobId: parent.decision_job_id,
				replanCount: parent.replan_count + 1
			});
			await transaction`
				update summonlab_decision_jobs
				set status = 'replanned', replacement_job_id = ${inserted.row.decision_job_id},
					lease_expires_at = null, updated_at = now()
				where decision_job_id = ${parent.decision_job_id}
			`;
			await appendTransition(
				transaction,
				parent.decision_job_id,
				'stale',
				'replanned',
				'stale-context-replanned',
				`Replacement ${inserted.row.decision_job_id} is bound to run version ${packet.world.stateVersion}.`
			);
			return await parseJob(transaction, inserted.row);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getDecisionJob(
	databaseUrl: string,
	decisionJobId: string
): Promise<DecisionJobRecord | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const row = await jobRow(sql, decisionJobId);
		return row ? await parseJob(sql, row) : null;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function listDispatchableDecisionJobIds(
	databaseUrl: string,
	limit = 32
): Promise<string[]> {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
		throw new Error('Decision dispatch limit must be from 1 to 256');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<{ decision_job_id: string }[]>`
			select decision_job_id from summonlab_decision_jobs
			where status in ('created', 'retry_wait', 'fallback')
			order by updated_at, decision_job_id
			limit ${limit}
		`;
		return rows.map((row) => row.decision_job_id);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function listCompletedDecisionJobIds(
	databaseUrl: string,
	limit = 32
): Promise<string[]> {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 256) {
		throw new Error('Completed decision limit must be from 1 to 256');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<{ decision_job_id: string }[]>`
			select decision_job_id from summonlab_decision_jobs
			where status = 'completed'
			order by updated_at, decision_job_id
			limit ${limit}
		`;
		return rows.map((row) => row.decision_job_id);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function markDecisionJobQueued(
	databaseUrl: string,
	decisionJobId: string
): Promise<boolean> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || !['created', 'retry_wait', 'fallback'].includes(row.status)) return false;
			await transaction`
				update summonlab_decision_jobs
				set status = 'queued', lease_expires_at = null, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(transaction, decisionJobId, row.status, 'queued', 'queue-dispatched');
			return true;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function releaseDecisionJobQueueReservation(
	databaseUrl: string,
	decisionJobId: string
): Promise<boolean> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || row.status !== 'queued') return false;
			const status =
				row.next_attempt_kind === 'fallback'
					? ('fallback' as const)
					: row.next_attempt_kind === 'retry'
						? ('retry_wait' as const)
						: ('created' as const);
			await transaction`
				update summonlab_decision_jobs
				set status = ${status}, lease_expires_at = null, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'queued',
				status,
				'queue-dispatch-released',
				'The transport did not accept the reserved queue dispatch.'
			);
			return true;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function claimDecisionJob(
	databaseUrl: string,
	decisionJobId: string,
	leaseSeconds = 45
): Promise<DecisionJobClaim | null> {
	if (!Number.isSafeInteger(leaseSeconds) || leaseSeconds < 10 || leaseSeconds > 300) {
		throw new Error('Decision lease must be from 10 to 300 seconds');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || row.status !== 'queued') return null;
			const attemptKind = DecisionAttemptKindSchema.parse(row.next_attempt_kind);
			const policy = attemptKind === 'fallback' ? ('scripted' as const) : row.requested_policy;
			const policyId = policyIdFor(policy);
			const attemptNumber = row.attempt_count + 1;
			const providerAttemptCount =
				policy === 'model' ? row.provider_attempt_count + 1 : row.provider_attempt_count;
			const leaseExpiresAt = new Date(Date.now() + leaseSeconds * 1_000).toISOString();
			await transaction`
				update summonlab_decision_jobs
				set status = 'in_progress', active_policy = ${policy},
					attempt_count = ${attemptNumber}, provider_attempt_count = ${providerAttemptCount},
					lease_expires_at = ${leaseExpiresAt}, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await transaction`
				insert into summonlab_decision_job_attempts (
					decision_job_id, attempt_number, attempt_kind, policy, policy_id, status
				) values (
					${decisionJobId}, ${attemptNumber}, ${attemptKind}, ${policy}, ${policyId},
					'in_progress'
				)
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'queued',
				'in_progress',
				'attempt-started',
				`${attemptKind} attempt ${attemptNumber} started with ${policyId}.`
			);
			const updated = await jobRow(transaction, decisionJobId);
			if (!updated) throw new Error(`Claimed decision job disappeared: ${decisionJobId}`);
			return {
				job: await parseJob(transaction, updated),
				attemptNumber,
				attemptKind,
				policy,
				policyId
			};
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function completeDecisionJobAttempt(
	databaseUrl: string,
	decisionJobId: string,
	resultInput: HeroPolicyResult,
	latencyMs: number
): Promise<DecisionJobRecord> {
	const result = HeroPolicyResultSchema.parse(resultInput);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || row.status !== 'in_progress' || !row.active_policy) {
				throw new Error(`Decision job is not in progress: ${decisionJobId}`);
			}
			if (result.policyId !== policyIdFor(row.active_policy)) {
				throw new Error('Decision result policy does not match the active attempt');
			}
			await transaction`
				update summonlab_decision_job_attempts
				set status = 'succeeded', completed_at = now(), latency_ms = ${latencyMs},
					result_hash = ${result.resultHash}
				where decision_job_id = ${decisionJobId} and attempt_number = ${row.attempt_count}
					and status = 'in_progress'
			`;
			await transaction`
				update summonlab_decision_jobs
				set status = 'completed', result = ${transaction.json(result as never)},
					resolution = ${row.next_attempt_kind === 'fallback' ? 'fallback' : 'requested'},
					lease_expires_at = null, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'in_progress',
				'completed',
				'policy-result-completed',
				`Result ${result.resultHash.slice(0, 12)} completed in ${latencyMs} ms.`
			);
			const updated = await jobRow(transaction, decisionJobId);
			if (!updated) throw new Error(`Completed decision job disappeared: ${decisionJobId}`);
			return await parseJob(transaction, updated);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

function nextStatusAfterFailure(
	row: DecisionJobRow,
	retryable: boolean
): {
	readonly status: 'retry_wait' | 'fallback' | 'failed';
	readonly nextAttemptKind: DecisionAttemptKind;
} {
	if (row.next_attempt_kind === 'fallback' || row.requested_policy === 'scripted') {
		return { status: 'failed', nextAttemptKind: row.next_attempt_kind };
	}
	if (
		row.active_policy === 'model' &&
		retryable &&
		row.provider_attempt_count < row.max_provider_attempts
	) {
		return { status: 'retry_wait', nextAttemptKind: 'retry' };
	}
	return { status: 'fallback', nextAttemptKind: 'fallback' };
}

export async function failDecisionJobAttempt(
	databaseUrl: string,
	decisionJobId: string,
	failureInput: Omit<DecisionJobFailure, 'occurredAt'>,
	latencyMs: number
): Promise<DecisionJobRecord> {
	const failure = DecisionJobFailureSchema.parse({
		...failureInput,
		occurredAt: new Date().toISOString()
	});
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || row.status !== 'in_progress') {
				throw new Error(`Decision job is not in progress: ${decisionJobId}`);
			}
			const next = nextStatusAfterFailure(row, failure.retryable);
			await transaction`
				update summonlab_decision_job_attempts
				set status = 'failed', completed_at = now(), latency_ms = ${latencyMs},
					failure = ${transaction.json(failure as never)}
				where decision_job_id = ${decisionJobId} and attempt_number = ${row.attempt_count}
					and status = 'in_progress'
			`;
			await transaction`
				update summonlab_decision_jobs
				set status = ${next.status}, next_attempt_kind = ${next.nextAttemptKind},
					failure = ${transaction.json(failure as never)}, lease_expires_at = null,
					updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'in_progress',
				next.status,
				next.status === 'retry_wait'
					? 'retry-scheduled'
					: next.status === 'fallback'
						? 'fallback-scheduled'
						: 'attempts-exhausted',
				failure.message
			);
			const updated = await jobRow(transaction, decisionJobId);
			if (!updated) throw new Error(`Failed decision job disappeared: ${decisionJobId}`);
			return await parseJob(transaction, updated);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

function staleBinding(row: DecisionJobRow, run: EngineRunBindingRow, packet: HeroDecisionPacket) {
	return (
		run.version !== row.expected_run_version ||
		run.event_cursor !== row.expected_event_cursor ||
		run.state_hash !== row.state_hash ||
		packet.world.stateVersion !== run.version ||
		packet.world.eventCursor !== run.event_cursor ||
		packet.world.stateHash !== run.state_hash
	);
}

function legalActionHashForJob(
	state: Parameters<typeof decisionLegalActions>[0],
	heroId: string
): string {
	return hashCanonical(
		[...decisionLegalActions(state, heroId)].sort((left, right) =>
			left.actionId.localeCompare(right.actionId)
		)
	);
}

export async function rejectStaleDecisionJobBeforePolicy(
	databaseUrl: string,
	decisionJobId: string
): Promise<DecisionJobRecord | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || row.status !== 'in_progress') return null;
			const packet = HeroDecisionPacketSchema.parse(row.packet);
			const runRows = await transaction<EngineRunBindingRow[]>`
				select version, event_cursor, state_hash from summonlab_engine_runs
				where run_id = ${row.run_id}
			`;
			const run = runRows[0];
			const snapshot = await getEngineSnapshotInTransaction(transaction, row.run_id);
			if (!run || !snapshot) throw new Error(`Engine run not found: ${row.run_id}`);
			if (
				!staleBinding(row, run, packet) &&
				legalActionHashForJob(snapshot.state, row.hero_id) === row.legal_action_hash
			) {
				return null;
			}
			const failure = DecisionJobFailureSchema.parse({
				code: 'stale-before-policy',
				message: `Run advanced from version ${row.expected_run_version} to ${run.version} before policy execution.`,
				retryable: false,
				occurredAt: new Date().toISOString()
			});
			await transaction`
				update summonlab_decision_job_attempts
				set status = 'failed', completed_at = now(), latency_ms = 0,
					failure = ${transaction.json(failure as never)}
				where decision_job_id = ${decisionJobId} and attempt_number = ${row.attempt_count}
					and status = 'in_progress'
			`;
			await transaction`
				update summonlab_decision_jobs
				set status = 'stale', failure = ${transaction.json(failure as never)},
					lease_expires_at = null, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'in_progress',
				'stale',
				'stale-before-policy',
				failure.message
			);
			const stale = await jobRow(transaction, decisionJobId);
			if (!stale) throw new Error(`Stale decision job disappeared: ${decisionJobId}`);
			return await parseJob(transaction, stale);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function applyDecisionJobResult(
	databaseUrl: string,
	decisionJobId: string
): Promise<DecisionJobApplicationResult> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row) throw new Error(`Decision job not found: ${decisionJobId}`);
			if (row.status === 'applied') {
				return { disposition: 'applied' as const, job: await parseJob(transaction, row) };
			}
			if (row.status !== 'completed' || !row.result) {
				throw new Error(`Decision job is not ready to apply: ${decisionJobId}`);
			}
			const packet = HeroDecisionPacketSchema.parse(row.packet);
			const result = HeroPolicyResultSchema.parse(row.result);
			await transaction`
				select run_id from summonlab_proof_runs where run_id = ${row.run_id} for update
			`;
			const runRows = await transaction<EngineRunBindingRow[]>`
				select version, event_cursor, state_hash from summonlab_engine_runs
				where run_id = ${row.run_id} for update
			`;
			const run = runRows[0];
			const snapshot = await getEngineSnapshotInTransaction(transaction, row.run_id);
			if (!run || !snapshot) throw new Error(`Engine run not found: ${row.run_id}`);
			const currentLegalActionHash = legalActionHashForJob(snapshot.state, row.hero_id);
			if (staleBinding(row, run, packet) || currentLegalActionHash !== row.legal_action_hash) {
				await transaction`
					update summonlab_decision_jobs
					set status = 'stale', lease_expires_at = null, updated_at = now()
					where decision_job_id = ${decisionJobId}
				`;
				await appendTransition(
					transaction,
					decisionJobId,
					'completed',
					'stale',
					'stale-result-rejected',
					`Expected run version ${row.expected_run_version}; current version is ${run.version}.`
				);
				const stale = await jobRow(transaction, decisionJobId);
				if (!stale) throw new Error(`Stale decision job disappeared: ${decisionJobId}`);
				return { disposition: 'stale' as const, job: await parseJob(transaction, stale) };
			}
			await transaction`
				update summonlab_decision_jobs set status = 'validated', updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'completed',
				'validated',
				'result-boundary-validated'
			);
			const command = commandFromHeroPolicyResult({
				state: snapshot.state,
				packet,
				result,
				decisionJobId
			});
			const commit = await commitEngineCommandInTransaction(transaction, command);
			if (command.commandType === 'hero.choose.destination') {
				const score =
					result.trace.kind === 'scripted'
						? Object.fromEntries(
								result.trace.actionScores.map((entry) => [entry.actionId, entry.total])
							)
						: {};
				await projectProofChoiceInTransaction(
					transaction,
					row.run_id,
					{
						destination: command.destination,
						source: result.trace.kind,
						firstLine: command.firstLine,
						storyBranch: command.storyBranch,
						score: {
							kitchen: Number(score['hero.choose.kitchen'] ?? 0),
							trainingGround: Number(score['hero.choose.training-ground'] ?? 0)
						}
					},
					packet.activeDirectives.map((directive) => directive.text).join('\n')
				);
			}
			await transaction`
				update summonlab_decision_jobs
				set status = 'applied', applied_command_id = ${command.commandId},
					applied_event_cursor = ${commit.snapshot.state.eventCursor},
					applied_run_version = ${commit.snapshot.state.version},
					applied_state_hash = ${commit.snapshot.stateHash}, applied_at = now(),
					lease_expires_at = null, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'validated',
				'applied',
				'engine-command-applied',
				`Command ${command.commandId} committed at cursor ${commit.snapshot.state.eventCursor}.`
			);
			const applied = await jobRow(transaction, decisionJobId);
			if (!applied) throw new Error(`Applied decision job disappeared: ${decisionJobId}`);
			return { disposition: 'applied' as const, job: await parseJob(transaction, applied) };
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function failDecisionJobApplication(
	databaseUrl: string,
	decisionJobId: string,
	message: string
): Promise<DecisionJobRecord> {
	const failure = DecisionJobFailureSchema.parse({
		code: 'application-failed',
		message: message.slice(0, 500),
		retryable: false,
		occurredAt: new Date().toISOString()
	});
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const row = await jobRow(transaction, decisionJobId, true);
			if (!row || row.status !== 'completed') {
				throw new Error(`Decision job is not completed: ${decisionJobId}`);
			}
			await transaction`
				update summonlab_decision_jobs
				set status = 'failed', failure = ${transaction.json(failure as never)},
					lease_expires_at = null, updated_at = now()
				where decision_job_id = ${decisionJobId}
			`;
			await appendTransition(
				transaction,
				decisionJobId,
				'completed',
				'failed',
				'application-failed',
				failure.message
			);
			const failed = await jobRow(transaction, decisionJobId);
			if (!failed) throw new Error(`Failed decision job disappeared: ${decisionJobId}`);
			return await parseJob(transaction, failed);
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function recoverExpiredDecisionJobs(
	databaseUrl: string,
	now = new Date().toISOString(),
	limit = 32
): Promise<number> {
	const queuedBefore = new Date(Date.parse(now) - 30_000).toISOString();
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<DecisionJobRow[]>`
				select * from summonlab_decision_jobs
				where (status = 'in_progress' and lease_expires_at <= ${now})
					or (status = 'queued' and updated_at <= ${queuedBefore})
				order by updated_at, decision_job_id
				limit ${limit}
				for update skip locked
			`;
			for (const row of rows) {
				if (row.status === 'queued') {
					const status =
						row.next_attempt_kind === 'fallback'
							? ('fallback' as const)
							: row.next_attempt_kind === 'retry'
								? ('retry_wait' as const)
								: ('created' as const);
					await transaction`
						update summonlab_decision_jobs
						set status = ${status}, updated_at = now()
						where decision_job_id = ${row.decision_job_id}
					`;
					await appendTransition(
						transaction,
						row.decision_job_id,
						'queued',
						status,
						'queue-reservation-expired',
						'No worker claimed the queue reservation within 30 seconds.'
					);
					continue;
				}
				const failure = DecisionJobFailureSchema.parse({
					code: 'worker-lease-expired',
					message: 'The worker lease expired before the attempt completed.',
					retryable: true,
					occurredAt: now
				});
				const next = nextStatusAfterFailure(row, true);
				await transaction`
					update summonlab_decision_job_attempts
					set status = 'failed', completed_at = ${now}, failure = ${transaction.json(failure as never)}
					where decision_job_id = ${row.decision_job_id}
						and attempt_number = ${row.attempt_count} and status = 'in_progress'
				`;
				await transaction`
					update summonlab_decision_jobs
					set status = ${next.status}, next_attempt_kind = ${next.nextAttemptKind},
						failure = ${transaction.json(failure as never)}, lease_expires_at = null,
						updated_at = now()
					where decision_job_id = ${row.decision_job_id}
				`;
				await appendTransition(
					transaction,
					row.decision_job_id,
					'in_progress',
					next.status,
					'worker-lease-expired',
					failure.message
				);
			}
			return rows.length;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
