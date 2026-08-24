import {
	AuthoritativeEventSchema,
	EngineEventHeadSchema,
	EngineEventPageSchema,
	type AuthoritativeEvent,
	type EngineEventHead,
	type EngineEventPage,
	type ReturnRecap,
	type ReturnRecapCounts,
	type ReturnRecapDelta
} from '@summonlab/contracts';
import { projectReturnRecap } from '@summonlab/engine';
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

interface HeadRow {
	run_id: string;
	version: number;
	event_cursor: number;
	state_hash: string;
	simulated_at: Date | string;
}

interface RecapAggregateRow {
	event_count: number;
	plans_created: number;
	routines_completed: number;
	activities_completed: number;
	travel_arrivals: number;
	failures: number;
	clock_syncs: number;
}

interface RecapDeltaRow {
	owner_id: string;
	kind: ReturnRecapDelta['kind'];
	key: string;
	delta: number;
}

const RUN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

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

function parseHead(row: HeadRow): EngineEventHead {
	return EngineEventHeadSchema.parse({
		runId: row.run_id,
		version: row.version,
		eventCursor: row.event_cursor,
		stateHash: row.state_hash,
		gameTime: iso(row.simulated_at)
	});
}

function requireCursor(value: number, label: string): number {
	if (!Number.isSafeInteger(value) || value < 0)
		throw new Error(`${label} must be a nonnegative integer`);
	return value;
}

function requirePageLimit(value: number): number {
	if (!Number.isSafeInteger(value) || value < 1 || value > 256) {
		throw new Error('Event page limit must be an integer from 1 to 256');
	}
	return value;
}

export class EngineCursorGapError extends Error {
	public readonly code = 'ENGINE_CURSOR_GAP';

	public constructor(
		public readonly runId: string,
		public readonly requestedAfter: number,
		public readonly latestCursor: number,
		public readonly reason: 'cursor_ahead' | 'missing_events'
	) {
		super(`Event cursor ${requestedAfter} cannot continue at ${latestCursor}`);
		this.name = 'EngineCursorGapError';
	}
}

export function engineEventChannel(runId: string): string {
	if (!RUN_ID.test(runId)) throw new Error(`Invalid engine run id: ${runId}`);
	return `summonlab_engine_${runId.replaceAll('-', '_')}`;
}

export async function notifyEngineEventCursorInTransaction(
	sql: postgres.TransactionSql,
	runId: string,
	eventCursor: number
): Promise<void> {
	requireCursor(eventCursor, 'Event cursor');
	await sql`select pg_notify(${engineEventChannel(runId)}, ${String(eventCursor)})`;
}

export async function getEngineEventHead(
	databaseUrl: string,
	runId: string
): Promise<EngineEventHead | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<HeadRow[]>`
			select run_id, version, event_cursor, state_hash, simulated_at
			from summonlab_engine_runs where run_id = ${runId}
		`;
		return rows[0] ? parseHead(rows[0]) : null;
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getEngineEventPage(
	databaseUrl: string,
	runId: string,
	afterCursor: number,
	limit = 128
): Promise<EngineEventPage | null> {
	requireCursor(afterCursor, 'After cursor');
	requirePageLimit(limit);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const headRows = await sql<HeadRow[]>`
			select run_id, version, event_cursor, state_hash, simulated_at
			from summonlab_engine_runs where run_id = ${runId}
		`;
		const headRow = headRows[0];
		if (!headRow) return null;
		const head = parseHead(headRow);
		if (afterCursor > head.eventCursor) {
			return EngineEventPageSchema.parse({
				runId,
				requestedAfter: afterCursor,
				nextCursor: head.eventCursor,
				latestCursor: head.eventCursor,
				hasMore: false,
				gap: 'cursor_ahead',
				events: []
			});
		}
		const rows = await sql<EventRow[]>`
			select * from summonlab_engine_events
			where run_id = ${runId} and sequence > ${afterCursor}
				and sequence <= ${head.eventCursor}
			order by sequence asc
			limit ${limit}
		`;
		const events = rows.map(parseEvent);
		const missing =
			afterCursor < head.eventCursor &&
			(events.length === 0 || events[0]!.sequence !== afterCursor + 1);
		const nextCursor = events.at(-1)?.sequence ?? afterCursor;
		return EngineEventPageSchema.parse({
			runId,
			requestedAfter: afterCursor,
			nextCursor,
			latestCursor: head.eventCursor,
			hasMore: !missing && nextCursor < head.eventCursor,
			gap: missing ? 'missing_events' : null,
			events: missing ? [] : events
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export interface EngineEventSubscription {
	close(): Promise<void>;
}

export async function subscribeToEngineEventCursor(
	databaseUrl: string,
	runId: string,
	onCursor: (eventCursor: number) => void
): Promise<EngineEventSubscription> {
	const sql = postgres(databaseUrl, { max: 1 });
	let closed = false;
	try {
		const listener = await sql.listen(engineEventChannel(runId), (payload) => {
			const cursor = Number(payload);
			if (Number.isSafeInteger(cursor) && cursor > 0) onCursor(cursor);
		});
		return {
			async close() {
				if (closed) return;
				closed = true;
				await listener.unlisten().catch(() => undefined);
				await sql.end({ timeout: 5 });
			}
		};
	} catch (error) {
		await sql.end({ timeout: 5 }).catch(() => undefined);
		throw error;
	}
}

export async function getReturnRecap(
	databaseUrl: string,
	runId: string,
	afterCursor: number
): Promise<ReturnRecap | null> {
	requireCursor(afterCursor, 'After cursor');
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const headRows = await sql<HeadRow[]>`
			select run_id, version, event_cursor, state_hash, simulated_at
			from summonlab_engine_runs where run_id = ${runId}
		`;
		const headRow = headRows[0];
		if (!headRow) return null;
		const head = parseHead(headRow);
		if (afterCursor > head.eventCursor) {
			throw new EngineCursorGapError(runId, afterCursor, head.eventCursor, 'cursor_ahead');
		}
		const [aggregateRows, deltaRows, candidateRows, fromRows] = await Promise.all([
			sql<RecapAggregateRow[]>`
				select
					count(*)::int as event_count,
					count(*) filter (where event_type = 'hero.daily.plan.created')::int as plans_created,
					coalesce(sum(case when jsonb_typeof(payload->'routineOutcomes') = 'array'
						then jsonb_array_length(payload->'routineOutcomes') else 0 end), 0)::int as routines_completed,
					coalesce(sum(case when jsonb_typeof(payload->'activityOutcomes') = 'array'
						then jsonb_array_length(payload->'activityOutcomes') else 0 end), 0)::int as activities_completed,
					coalesce(sum(case when jsonb_typeof(payload->'travelOutcomes') = 'array'
						then jsonb_array_length(payload->'travelOutcomes') else 0 end), 0)::int as travel_arrivals,
					count(*) filter (where event_type like '%.damaged' or event_type like '%.died')::int as failures,
					count(*) filter (where event_type = 'simulation.clock.synced')::int as clock_syncs
				from summonlab_engine_events
				where run_id = ${runId} and sequence > ${afterCursor}
					and sequence <= ${head.eventCursor}
			`,
			sql<RecapDeltaRow[]>`
				select reward->>'ownerId' as owner_id, reward->>'kind' as kind,
					reward->>'key' as key,
					sum((reward->>'delta')::double precision)::double precision as delta
				from summonlab_engine_events event
				cross join lateral jsonb_array_elements(
					case when jsonb_typeof(event.payload->'rewardDeltas') = 'array'
						then event.payload->'rewardDeltas' else '[]'::jsonb end
				) reward
				where event.run_id = ${runId} and event.sequence > ${afterCursor}
					and event.sequence <= ${head.eventCursor}
				group by reward->>'ownerId', reward->>'kind', reward->>'key'
				having sum((reward->>'delta')::double precision) <> 0
				order by abs(sum((reward->>'delta')::double precision)) desc,
					reward->>'kind', reward->>'key'
				limit 24
			`,
			sql<EventRow[]>`
				select * from summonlab_engine_events
				where run_id = ${runId} and sequence > ${afterCursor}
					and sequence <= ${head.eventCursor}
				order by sequence desc
				limit 128
			`,
			sql<{ simulated_at: Date | string }[]>`
				select simulated_at from summonlab_engine_events
				where run_id = ${runId} and sequence = ${Math.max(1, afterCursor)}
			`
		]);
		if (fromRows.length === 0) {
			throw new EngineCursorGapError(runId, afterCursor, head.eventCursor, 'missing_events');
		}
		const aggregateRow = aggregateRows[0]!;
		const counts: ReturnRecapCounts = {
			plansCreated: aggregateRow.plans_created,
			routinesCompleted: aggregateRow.routines_completed,
			activitiesCompleted: aggregateRow.activities_completed,
			travelArrivals: aggregateRow.travel_arrivals,
			failures: aggregateRow.failures,
			clockSyncs: aggregateRow.clock_syncs
		};
		return projectReturnRecap({
			runId,
			fromCursor: afterCursor,
			toCursor: head.eventCursor,
			fromGameTime: fromRows[0] ? iso(fromRows[0].simulated_at) : null,
			toGameTime: head.gameTime,
			candidateEvents: candidateRows.reverse().map(parseEvent),
			aggregate: {
				eventCount: aggregateRow.event_count,
				counts,
				deltas: deltaRows.map((row) => ({
					ownerId: row.owner_id,
					kind: row.kind,
					key: row.key,
					delta: row.delta
				}))
			}
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
