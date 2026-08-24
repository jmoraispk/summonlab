import { randomUUID } from 'node:crypto';

import {
	CatchUpReportSchema,
	ClockSpeedSchema,
	type CatchUpReport,
	type ClockSpeed,
	type EngineGameStateV5,
	type EngineGameStateV6,
	type EngineGameStateV7
} from '@summonlab/contracts';
import {
	ENGINE_CONTENT_VERSION,
	addGameMinutes,
	compareGameTime,
	eventSummary,
	gameMinutesBetween,
	nextCatchUpCommand,
	realTimeForGameTime
} from '@summonlab/engine';
import postgres from 'postgres';

import { type ClockRow, getSimulationClock, projectSimulationClock } from './clock.js';
import { commitEngineCommandInTransaction, getEngineSnapshotInTransaction } from './engine.js';

export interface CatchUpOptions {
	readonly wallTime?: string;
	readonly owner?: string;
	readonly leaseSeconds?: number;
	readonly maxCommands?: number;
	readonly maxGameMinutes?: number;
	readonly afterLeaseAcquired?: () => Promise<void>;
}

function iso(value: Date | string): string {
	return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function requirePositiveInteger(value: number, label: string, maximum: number): number {
	if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
		throw new Error(`${label} must be an integer from 1 to ${maximum}`);
	}
	return value;
}

function cappedTarget(currentGameTime: string, projectedGameTime: string, maxGameMinutes: number) {
	const elapsedWholeGameMinutes = Math.max(
		0,
		Math.floor(gameMinutesBetween(currentGameTime, projectedGameTime))
	);
	const quantizedTarget = addGameMinutes(currentGameTime, elapsedWholeGameMinutes);
	const maximum = addGameMinutes(currentGameTime, maxGameMinutes);
	return compareGameTime(quantizedTarget, maximum) > 0 ? maximum : quantizedTarget;
}

async function loadState(
	sql: postgres.Sql,
	runId: string
): Promise<EngineGameStateV5 | EngineGameStateV6 | EngineGameStateV7> {
	const snapshot = await sql.begin((transaction) =>
		getEngineSnapshotInTransaction(transaction, runId)
	);
	if (!snapshot) throw new Error(`Engine snapshot not found: ${runId}`);
	if (
		snapshot.state.schemaVersion !== 5 &&
		snapshot.state.schemaVersion !== 6 &&
		snapshot.state.schemaVersion !== 7
	) {
		throw new Error(`Catch-up requires engine-v5, engine-v6, or engine-v7 state: ${runId}`);
	}
	return snapshot.state;
}

async function busyReport(
	databaseUrl: string,
	runId: string,
	wallTime: string
): Promise<CatchUpReport> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const state = await loadState(sql, runId);
		const clock = await getSimulationClock(databaseUrl, runId, wallTime);
		if (!clock) throw new Error(`Simulation clock not found: ${runId}`);
		return CatchUpReportSchema.parse({
			runId,
			result: 'lease_busy',
			fromGameTime: state.simulatedAt,
			toGameTime: state.simulatedAt,
			targetGameTime: clock.projectedGameTime,
			wallTime,
			speed: clock.speed,
			commandsApplied: 0,
			schedulesResolved: 0,
			plansCreated: 0,
			routinesStarted: 0,
			truncated: false,
			events: [],
			clock
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function catchUpRun(
	databaseUrl: string,
	runId: string,
	options: CatchUpOptions = {}
): Promise<CatchUpReport> {
	const wallTime = new Date(options.wallTime ?? Date.now()).toISOString();
	const owner = options.owner ?? 'catch-up';
	const leaseSeconds = requirePositiveInteger(options.leaseSeconds ?? 30, 'Lease duration', 300);
	const maxCommands = requirePositiveInteger(options.maxCommands ?? 128, 'Command limit', 512);
	const maxGameMinutes = requirePositiveInteger(
		options.maxGameMinutes ?? 24 * 60,
		'Game-time limit',
		7 * 24 * 60
	);
	const leaseId = randomUUID();
	const leaseExpiresAt = new Date(Date.parse(wallTime) + leaseSeconds * 1_000).toISOString();
	const sql = postgres(databaseUrl, { max: 1 });
	let leaseAcquired = false;
	try {
		const claimed = await sql<ClockRow[]>`
			update summonlab_engine_clocks
			set lease_id = ${leaseId}, lease_owner = ${owner},
				lease_expires_at = ${leaseExpiresAt}, updated_at = now()
			where run_id = ${runId}
				and (lease_id is null or lease_expires_at <= ${wallTime})
			returning *
		`;
		const clockRow = claimed[0];
		if (!clockRow) return await busyReport(databaseUrl, runId, wallTime);
		leaseAcquired = true;
		await options.afterLeaseAcquired?.();

		const initialState = await loadState(sql, runId);
		const initialClock = projectSimulationClock(clockRow, initialState.simulatedAt, wallTime, null);
		const targetGameTime = cappedTarget(
			initialState.simulatedAt,
			initialClock.projectedGameTime,
			maxGameMinutes
		);
		const durationTruncated =
			gameMinutesBetween(initialState.simulatedAt, initialClock.projectedGameTime) > maxGameMinutes;
		const events: CatchUpReport['events'][number][] = [];
		let schedulesResolved = 0;
		let plansCreated = 0;
		let routinesStarted = 0;

		if (initialState.status === 'active' && initialClock.speed > 0) {
			for (let index = 0; index < maxCommands; index += 1) {
				const renewedUntil = new Date(
					Math.max(Date.now(), Date.parse(wallTime)) + leaseSeconds * 1_000
				).toISOString();
				const renewed = await sql`
					update summonlab_engine_clocks
					set lease_expires_at = ${renewedUntil}, updated_at = now()
					where run_id = ${runId} and lease_id = ${leaseId}
					returning run_id
				`;
				if (renewed.length !== 1) throw new Error(`Catch-up lease was lost: ${runId}`);
				const state = await loadState(sql, runId);
				const command = nextCatchUpCommand(state, targetGameTime);
				if (!command) break;
				const commit = await sql.begin((transaction) =>
					commitEngineCommandInTransaction(transaction, command, {
						preserveClockAnchor: true,
						wallTime
					})
				);
				for (const event of commit.events) {
					events.push({
						sequence: event.sequence,
						gameTime: event.gameTime,
						eventType: event.eventType,
						summary: eventSummary(event)
					});
					if (event.eventType === 'hero.daily.plan.created') plansCreated += 1;
					if (event.eventType === 'hero.routine.started') routinesStarted += 1;
				}
				schedulesResolved += commit.resolvedScheduledEventIds.length;
			}
		}

		const finalState = await loadState(sql, runId);
		const commandsTruncated =
			initialState.status === 'active' &&
			initialClock.speed > 0 &&
			nextCatchUpCommand(finalState, targetGameTime) !== null;
		const truncated = durationTruncated || commandsTruncated;
		const correspondingRealTime =
			realTimeForGameTime(
				initialClock.anchorGameTime,
				initialClock.anchorRealTime,
				finalState.simulatedAt,
				initialClock.speed
			) ?? wallTime;
		await sql`
			update summonlab_engine_clocks
			set anchor_game_time = ${finalState.simulatedAt}, anchor_real_time = ${correspondingRealTime},
				last_caught_up_at = ${wallTime}, lease_id = null, lease_owner = null,
				lease_expires_at = null, updated_at = now()
			where run_id = ${runId} and lease_id = ${leaseId}
		`;
		leaseAcquired = false;
		const clock = await getSimulationClock(databaseUrl, runId, wallTime);
		if (!clock) throw new Error(`Simulation clock not found after catch-up: ${runId}`);
		return CatchUpReportSchema.parse({
			runId,
			result:
				initialState.status !== 'active'
					? 'terminal'
					: truncated
						? 'safety_limit'
						: events.length === 0
							? 'noop'
							: 'caught_up',
			fromGameTime: initialState.simulatedAt,
			toGameTime: finalState.simulatedAt,
			targetGameTime,
			wallTime,
			speed: initialClock.speed,
			commandsApplied: events.length,
			schedulesResolved,
			plansCreated,
			routinesStarted,
			truncated,
			events,
			clock
		});
	} finally {
		if (leaseAcquired) {
			await sql`
				update summonlab_engine_clocks
				set lease_id = null, lease_owner = null, lease_expires_at = null, updated_at = now()
				where run_id = ${runId} and lease_id = ${leaseId}
			`.catch(() => undefined);
		}
		await sql.end({ timeout: 5 });
	}
}

export async function configureSimulationClock(
	databaseUrl: string,
	runId: string,
	speedInput: ClockSpeed,
	wallTime = new Date().toISOString()
) {
	const speed = ClockSpeedSchema.parse(speedInput);
	const caughtUp = await catchUpRun(databaseUrl, runId, { wallTime, owner: 'clock-config' });
	if (caughtUp.result === 'lease_busy' || caughtUp.result === 'safety_limit') {
		return caughtUp.clock;
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql`
			update summonlab_engine_clocks
			set speed = ${speed}, anchor_game_time = ${caughtUp.toGameTime},
				anchor_real_time = ${wallTime}, updated_at = now()
			where run_id = ${runId}
		`;
		return await getSimulationClock(databaseUrl, runId, wallTime);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

interface DueClockRow extends ClockRow {
	current_game_time: Date | string;
	next_due_game_time: Date | string;
}

export async function listDueCatchUpRunIds(
	databaseUrl: string,
	wallTime = new Date().toISOString(),
	limit = 32
): Promise<string[]> {
	requirePositiveInteger(limit, 'Due-run limit', 256);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<DueClockRow[]>`
			select clock.*, run.simulated_at as current_game_time, due.next_due_game_time
			from summonlab_engine_clocks clock
			join summonlab_engine_runs run on run.run_id = clock.run_id
			join lateral (
				select min(schedule.due_game_time) as next_due_game_time
				from summonlab_engine_scheduled_events schedule
				where schedule.run_id = clock.run_id and schedule.status = 'pending'
			) due on due.next_due_game_time is not null
			where run.status = 'active' and run.content_version = ${ENGINE_CONTENT_VERSION}
				and clock.speed > 0
				and (clock.lease_id is null or clock.lease_expires_at <= ${wallTime})
			order by due.next_due_game_time, clock.run_id
			limit ${Math.min(256, limit * 4)}
		`;
		return rows
			.filter((row) => {
				const clock = projectSimulationClock(
					row,
					iso(row.current_game_time),
					wallTime,
					iso(row.next_due_game_time)
				);
				return compareGameTime(clock.nextDueGameTime!, clock.projectedGameTime) <= 0;
			})
			.slice(0, limit)
			.map((row) => row.run_id);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function catchUpDueRuns(
	databaseUrl: string,
	wallTime = new Date().toISOString(),
	limit = 32
): Promise<CatchUpReport[]> {
	const runIds = await listDueCatchUpRunIds(databaseUrl, wallTime, limit);
	const reports: CatchUpReport[] = [];
	for (const runId of runIds) {
		reports.push(await catchUpRun(databaseUrl, runId, { wallTime, owner: 'worker' }));
	}
	return reports;
}
