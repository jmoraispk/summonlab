import {
	ClockSpeedSchema,
	SimulationClockSchema,
	type SimulationClock
} from '@summonlab/contracts';
import {
	compareGameTime,
	gameMinutesBetween,
	projectGameTime,
	realTimeForGameTime
} from '@summonlab/engine';
import postgres from 'postgres';

export interface ClockRow {
	run_id: string;
	speed: number;
	anchor_game_time: Date | string;
	anchor_real_time: Date | string;
	last_caught_up_at: Date | string | null;
	lease_id: string | null;
	lease_owner: string | null;
	lease_expires_at: Date | string | null;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function projectSimulationClock(
	row: ClockRow,
	currentGameTime: string,
	wallTime: string,
	nextDueGameTime: string | null
): SimulationClock {
	const speed = ClockSpeedSchema.parse(row.speed);
	const anchorGameTime = iso(row.anchor_game_time);
	const anchorRealTime = iso(row.anchor_real_time);
	const projected = projectGameTime(anchorGameTime, anchorRealTime, wallTime, speed);
	const projectedGameTime =
		compareGameTime(projected, currentGameTime) < 0 ? currentGameTime : projected;
	const leaseExpiresAt = row.lease_expires_at ? iso(row.lease_expires_at) : null;
	return SimulationClockSchema.parse({
		runId: row.run_id,
		speed,
		anchorGameTime,
		anchorRealTime,
		currentGameTime,
		projectedGameTime,
		lastCatchUpAt: row.last_caught_up_at ? iso(row.last_caught_up_at) : null,
		nextDueGameTime,
		nextDueRealTime: nextDueGameTime
			? realTimeForGameTime(anchorGameTime, anchorRealTime, nextDueGameTime, speed)
			: null,
		backlogGameMinutes: Math.max(0, gameMinutesBetween(currentGameTime, projectedGameTime)),
		leaseStatus:
			row.lease_id && leaseExpiresAt && Date.parse(leaseExpiresAt) > Date.parse(wallTime)
				? 'leased'
				: 'idle'
	});
}

export async function getSimulationClockInTransaction(
	sql: postgres.TransactionSql,
	runId: string,
	wallTime: string
): Promise<SimulationClock | null> {
	const rows = await sql<
		(ClockRow & { current_game_time: Date | string; next_due_game_time: Date | string | null })[]
	>`
		select clock.*, run.simulated_at as current_game_time,
			(
				select min(schedule.due_game_time)
				from summonlab_engine_scheduled_events schedule
				where schedule.run_id = clock.run_id and schedule.status = 'pending'
			) as next_due_game_time
		from summonlab_engine_clocks clock
		join summonlab_engine_runs run on run.run_id = clock.run_id
		where clock.run_id = ${runId}
	`;
	const row = rows[0];
	return row
		? projectSimulationClock(
				row,
				iso(row.current_game_time),
				wallTime,
				row.next_due_game_time ? iso(row.next_due_game_time) : null
			)
		: null;
}

export async function getSimulationClock(
	databaseUrl: string,
	runId: string,
	wallTime = new Date().toISOString()
): Promise<SimulationClock | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin((transaction) =>
			getSimulationClockInTransaction(transaction, runId, wallTime)
		);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function reanchorSimulationClockInTransaction(
	sql: postgres.TransactionSql,
	runId: string,
	gameTime: string,
	realTime?: string
): Promise<void> {
	await sql`
		update summonlab_engine_clocks
		set anchor_game_time = ${gameTime},
			anchor_real_time = ${realTime ?? sql`now()`},
			updated_at = now()
		where run_id = ${runId}
	`;
}
