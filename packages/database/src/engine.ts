import {
	AuthoritativeEventSchema,
	EngineCommandSchema,
	EngineCommitSchema,
	EngineReplayReportSchema,
	EngineScheduleRecordSchema,
	EngineSnapshotSchema,
	ScheduledEventSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineCommit,
	type EngineReplayReport,
	type EngineScheduleRecord,
	type EngineSnapshot
} from '@summonlab/contracts';
import {
	applyCommand,
	canceledScheduledEventIdsFromEvent,
	createBootstrapEngine,
	hashCanonical,
	legalActions,
	projectJournal,
	replayEvents,
	resolvedScheduledEventIdsFromEvent,
	scheduledEventsFromEvent,
	type BootstrapEngineInput
} from '@summonlab/engine';
import postgres from 'postgres';

interface EventRow {
	event_id: string;
	run_id: string;
	sequence: number;
	schema_version: number;
	event_type: string;
	simulated_at: Date | string;
	actor_id: string | null;
	command_id: string;
	causation_id: string | null;
	correlation_id: string;
	source: unknown;
	seed_cursor: number;
	before_state_hash: string;
	after_state_hash: string;
	content_version: string;
	payload: unknown;
}

interface SnapshotRow {
	state: unknown;
	state_hash: string;
}

interface EngineRunRow {
	version: number;
	event_cursor: number;
	state_hash: string;
}

interface ScheduleRow {
	scheduled_event_id: string;
	run_id: string;
	actor_id: string;
	due_game_time: Date | string;
	event_kind: string;
	payload: unknown;
	status: 'pending' | 'resolved' | 'canceled';
	created_event_id: string;
	terminal_event_id: string | null;
}

export class StaleRunVersionError extends Error {
	public readonly code = 'STALE_RUN_VERSION';

	public constructor(
		expectedVersion: number,
		public readonly latestVersion: number,
		public readonly eventCursor: number,
		public readonly stateHash: string
	) {
		super(`Command expected run version ${expectedVersion}, but latest is ${latestVersion}`);
		this.name = 'StaleRunVersionError';
	}
}

export class IdempotencyConflictError extends Error {
	public readonly code = 'IDEMPOTENCY_CONFLICT';

	public constructor(commandId: string) {
		super(`Command id ${commandId} was already used for a different command`);
		this.name = 'IdempotencyConflictError';
	}
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseEvent(row: EventRow): AuthoritativeEvent {
	return AuthoritativeEventSchema.parse({
		eventId: row.event_id,
		runId: row.run_id,
		sequence: row.sequence,
		schemaVersion: row.schema_version,
		gameTime: iso(row.simulated_at),
		eventType: row.event_type,
		actorId: row.actor_id,
		commandId: row.command_id,
		causationId: row.causation_id,
		correlationId: row.correlation_id,
		source: row.source,
		seedCursor: row.seed_cursor,
		beforeStateHash: row.before_state_hash,
		afterStateHash: row.after_state_hash,
		contentVersion: row.content_version,
		payload: row.payload
	});
}

function parseSchedule(row: ScheduleRow): EngineScheduleRecord {
	return EngineScheduleRecordSchema.parse({
		scheduledEventId: row.scheduled_event_id,
		runId: row.run_id,
		actorId: row.actor_id,
		dueGameTime: iso(row.due_game_time),
		eventKind: row.event_kind,
		payload: row.payload,
		status: row.status,
		createdEventId: row.created_event_id,
		terminalEventId: row.terminal_event_id
	});
}

function parseScheduledEvent(row: ScheduleRow) {
	const record = parseSchedule(row);
	return ScheduledEventSchema.parse({
		scheduledEventId: record.scheduledEventId,
		runId: record.runId,
		actorId: record.actorId,
		dueGameTime: record.dueGameTime,
		eventKind: record.eventKind,
		payload: record.payload
	});
}

async function insertEvent(sql: postgres.TransactionSql, event: AuthoritativeEvent): Promise<void> {
	await sql`
		insert into summonlab_engine_events (
			event_id, run_id, sequence, schema_version, event_type, simulated_at, actor_id,
			command_id, causation_id, correlation_id, source, seed_cursor, before_state_hash,
			after_state_hash, content_version, payload
		) values (
			${event.eventId}, ${event.runId}, ${event.sequence}, ${event.schemaVersion},
			${event.eventType}, ${event.gameTime}, ${event.actorId}, ${event.commandId},
			${event.causationId}, ${event.correlationId}, ${sql.json(event.source as never)},
			${event.seedCursor}, ${event.beforeStateHash}, ${event.afterStateHash},
			${event.contentVersion}, ${sql.json(event.payload as never)}
		)
	`;
}

async function insertSnapshot(
	sql: postgres.TransactionSql,
	snapshot: EngineSnapshot
): Promise<void> {
	await sql`
		insert into summonlab_engine_snapshots (run_id, event_cursor, version, state, state_hash)
		values (
			${snapshot.state.runId}, ${snapshot.state.eventCursor}, ${snapshot.state.version},
			${sql.json(snapshot.state as never)}, ${snapshot.stateHash}
		)
	`;
}

async function applyScheduleChanges(
	sql: postgres.TransactionSql,
	event: AuthoritativeEvent
): Promise<void> {
	for (const scheduled of scheduledEventsFromEvent(event)) {
		await sql`
			insert into summonlab_engine_scheduled_events (
				scheduled_event_id, run_id, actor_id, due_game_time, event_kind, payload,
				created_event_id
			) values (
				${scheduled.scheduledEventId}, ${scheduled.runId}, ${scheduled.actorId},
				${scheduled.dueGameTime}, ${scheduled.eventKind},
				${sql.json(scheduled.payload as never)}, ${event.eventId}
			)
		`;
	}
	for (const [status, identifiers] of [
		['resolved', resolvedScheduledEventIdsFromEvent(event)],
		['canceled', canceledScheduledEventIdsFromEvent(event)]
	] as const) {
		if (identifiers.length === 0) continue;
		const updated = await sql`
			update summonlab_engine_scheduled_events
			set status = ${status}, terminal_event_id = ${event.eventId}, updated_at = now()
			where run_id = ${event.runId}
				and scheduled_event_id in ${sql(identifiers)}
				and status = 'pending'
			returning scheduled_event_id
		`;
		if (updated.length !== identifiers.length) {
			throw new Error(`Scheduled-event ${status} set did not match pending state`);
		}
	}
}

export async function initializeEngineRun(
	sql: postgres.TransactionSql,
	input: BootstrapEngineInput
): Promise<EngineSnapshot> {
	const bootstrap = createBootstrapEngine(input);
	await sql`
		insert into summonlab_engine_runs (
			run_id, seed, content_version, status, version, event_cursor, entropy_cursor,
			simulated_at, state_hash
		) values (
			${bootstrap.snapshot.state.runId}, ${bootstrap.snapshot.state.seed},
			${bootstrap.snapshot.state.contentVersion}, ${bootstrap.snapshot.state.status},
			${bootstrap.snapshot.state.version}, ${bootstrap.snapshot.state.eventCursor},
			${bootstrap.snapshot.state.entropyCursor}, ${bootstrap.snapshot.state.simulatedAt},
			${bootstrap.snapshot.stateHash}
		)
	`;
	await sql`
		insert into summonlab_engine_commands (
			command_id, run_id, expected_version, command_type, command, correlation_id,
			accepted_sequence
		) values (
			${bootstrap.event.commandId}, ${bootstrap.snapshot.state.runId}, 0, 'run.initialize',
			${sql.json({
				commandType: 'run.initialize',
				runId: bootstrap.snapshot.state.runId,
				seed: bootstrap.snapshot.state.seed
			} as never)},
			${bootstrap.event.correlationId}, ${bootstrap.event.sequence}
		)
	`;
	await insertEvent(sql, bootstrap.event);
	await insertSnapshot(sql, bootstrap.snapshot);
	return bootstrap.snapshot;
}

async function findIdempotentCommit(
	sql: postgres.TransactionSql,
	command: EngineCommand
): Promise<EngineCommit | null> {
	const rows = await sql<
		(EventRow & { state: unknown; state_hash: string; stored_command: unknown })[]
	>`
		select e.*, s.state, s.state_hash, c.command as stored_command
		from summonlab_engine_commands c
		join summonlab_engine_events e
			on e.run_id = c.run_id and e.sequence = c.accepted_sequence
		join summonlab_engine_snapshots s
			on s.run_id = c.run_id and s.event_cursor = c.accepted_sequence
		where c.command_id = ${command.commandId}
	`;
	const row = rows[0];
	if (!row) return null;
	const storedCommand = EngineCommandSchema.safeParse(row.stored_command);
	if (
		!storedCommand.success ||
		storedCommand.data.runId !== command.runId ||
		hashCanonical(storedCommand.data) !== hashCanonical(command)
	) {
		throw new IdempotencyConflictError(command.commandId);
	}
	const snapshot = EngineSnapshotSchema.parse({ state: row.state, stateHash: row.state_hash });
	const event = parseEvent(row);
	const scheduleRows = await sql<ScheduleRow[]>`
		select * from summonlab_engine_scheduled_events where created_event_id = ${event.eventId}
	`;
	return EngineCommitSchema.parse({
		snapshot,
		events: [event],
		scheduled: scheduleRows.map(parseScheduledEvent),
		resolvedScheduledEventIds: resolvedScheduledEventIdsFromEvent(event),
		canceledScheduledEventIds: canceledScheduledEventIdsFromEvent(event),
		legalActions: legalActions(snapshot.state, event.actorId ?? snapshot.state.master.masterId),
		idempotentReplay: true
	});
}

export async function commitEngineCommandInTransaction(
	sql: postgres.TransactionSql,
	commandInput: EngineCommand
): Promise<EngineCommit> {
	const command = EngineCommandSchema.parse(commandInput);
	const idempotent = await findIdempotentCommit(sql, command);
	if (idempotent) return idempotent;

	const runRows = await sql<EngineRunRow[]>`
		select version, event_cursor, state_hash
		from summonlab_engine_runs
		where run_id = ${command.runId}
		for update
	`;
	const run = runRows[0];
	if (!run) throw new Error(`Engine run not found: ${command.runId}`);
	const concurrentIdempotent = await findIdempotentCommit(sql, command);
	if (concurrentIdempotent) return concurrentIdempotent;
	if (command.expectedVersion !== run.version) {
		throw new StaleRunVersionError(
			command.expectedVersion,
			run.version,
			run.event_cursor,
			run.state_hash
		);
	}
	const snapshotRows = await sql<SnapshotRow[]>`
		select state, state_hash
		from summonlab_engine_snapshots
		where run_id = ${command.runId} and event_cursor = ${run.event_cursor}
	`;
	const persisted = snapshotRows[0];
	if (!persisted) throw new Error(`Engine snapshot not found: ${command.runId}`);
	const snapshot = EngineSnapshotSchema.parse({
		state: persisted.state,
		stateHash: persisted.state_hash
	});
	if (snapshot.stateHash !== run.state_hash) {
		throw new Error(`Engine run hash does not match its latest snapshot: ${command.runId}`);
	}

	const applied = applyCommand(snapshot.state, command);
	const event = applied.events[0];
	if (!event) throw new Error('Engine command produced no event');
	await sql`
		insert into summonlab_engine_commands (
			command_id, run_id, expected_version, command_type, command, correlation_id,
			accepted_sequence
		) values (
			${command.commandId}, ${command.runId}, ${command.expectedVersion},
			${command.commandType}, ${sql.json(command as never)}, ${command.correlationId},
			${event.sequence}
		)
	`;
	await insertEvent(sql, event);
	await applyScheduleChanges(sql, event);
	const nextSnapshot = EngineSnapshotSchema.parse({
		state: applied.state,
		stateHash: applied.stateHash
	});
	await insertSnapshot(sql, nextSnapshot);
	const updated = await sql`
		update summonlab_engine_runs
		set status = ${applied.state.status}, version = ${applied.state.version},
			event_cursor = ${applied.state.eventCursor}, entropy_cursor = ${applied.state.entropyCursor},
			simulated_at = ${applied.state.simulatedAt}, state_hash = ${applied.stateHash}, updated_at = now()
		where run_id = ${command.runId} and version = ${command.expectedVersion}
		returning run_id
	`;
	if (updated.length !== 1) {
		throw new StaleRunVersionError(
			command.expectedVersion,
			run.version,
			run.event_cursor,
			run.state_hash
		);
	}
	return EngineCommitSchema.parse({
		snapshot: nextSnapshot,
		events: applied.events,
		scheduled: applied.scheduled,
		resolvedScheduledEventIds: applied.resolvedScheduledEventIds,
		canceledScheduledEventIds: applied.canceledScheduledEventIds,
		legalActions: applied.legalActions,
		idempotentReplay: false
	});
}

export async function commitEngineCommand(
	databaseUrl: string,
	command: EngineCommand
): Promise<EngineCommit> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin((transaction) => commitEngineCommandInTransaction(transaction, command));
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getEngineSnapshotInTransaction(
	sql: postgres.TransactionSql,
	runId: string
): Promise<EngineSnapshot | null> {
	const rows = await sql<SnapshotRow[]>`
		select state, state_hash
		from summonlab_engine_snapshots
		where run_id = ${runId}
		order by event_cursor desc
		limit 1
	`;
	const row = rows[0];
	return row ? EngineSnapshotSchema.parse({ state: row.state, stateHash: row.state_hash }) : null;
}

export async function getEngineReplay(
	databaseUrl: string,
	runId: string
): Promise<EngineReplayReport | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const snapshotRows = await sql<SnapshotRow[]>`
			select state, state_hash
			from summonlab_engine_snapshots
			where run_id = ${runId}
			order by event_cursor desc
			limit 1
		`;
		const persistedRow = snapshotRows[0];
		if (!persistedRow) throw new Error(`Engine snapshot not found: ${runId}`);
		const persisted = EngineSnapshotSchema.parse({
			state: persistedRow.state,
			stateHash: persistedRow.state_hash
		});
		const eventRows = await sql<EventRow[]>`
			select * from summonlab_engine_events
			where run_id = ${runId} and sequence <= ${persisted.state.eventCursor}
			order by sequence asc
		`;
		if (eventRows.length === 0) return null;
		const events = eventRows.map(parseEvent);
		const scheduleRows = await sql<ScheduleRow[]>`
			select scheduled.*
			from summonlab_engine_scheduled_events scheduled
			join summonlab_engine_events created on created.event_id = scheduled.created_event_id
			where scheduled.run_id = ${runId} and created.sequence <= ${persisted.state.eventCursor}
			order by scheduled.due_game_time, scheduled.scheduled_event_id
		`;
		const replay = replayEvents(events);
		const actors = [
			replay.snapshot.state.master.masterId,
			...Object.keys(replay.snapshot.state.heroes)
		];
		const legalActionsByActor = Object.fromEntries(
			actors.map((actorId) => [actorId, legalActions(replay.snapshot.state, actorId)])
		);
		return EngineReplayReportSchema.parse({
			runId,
			verified: replay.verified && replay.snapshot.stateHash === persisted.stateHash,
			eventCount: eventRows.length,
			checks: replay.checks,
			journalEntries: projectJournal(events),
			scheduledEvents: scheduleRows.map(parseSchedule),
			snapshot: replay.snapshot,
			persistedStateHash: persisted.stateHash,
			hashMatchesPersistedSnapshot: replay.snapshot.stateHash === persisted.stateHash,
			legalActions: legalActions(replay.snapshot.state, replay.snapshot.state.master.masterId),
			legalActionsByActor
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
