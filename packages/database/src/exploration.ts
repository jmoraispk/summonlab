import {
	ExplorationAttemptStateSchema,
	type ExplorationAttemptState
} from '@summonlab/contracts/exploration';
import {
	resumeExplorationAfterEncounter,
	suspendExplorationForEncounter
} from '@summonlab/engine/exploration';
import postgres from 'postgres';

export type ExplorationEncounterBinding = Readonly<{
	requestId: string;
	requestHash: string;
}>;

export type ExplorationReceiptBinding = Readonly<{
	receiptId: string;
	requestId: string;
	receiptHash: string;
	outcome: 'victory' | 'defeat';
}>;

export type PersistedExplorationAttempt = Readonly<{
	state: ExplorationAttemptState;
	activeEncounter: ExplorationEncounterBinding | null;
	receipts: readonly ExplorationReceiptBinding[];
}>;

type AttemptRow = {
	attempt_id: string;
	run_id: string;
	floor_id: string;
	content_version: string;
	content_hash: string;
	status: ExplorationAttemptState['status'];
	version: number;
	state: unknown;
	active_request_id: string | null;
	active_request_hash: string | null;
};

type ReceiptRow = {
	receipt_id: string;
	request_id: string;
	receipt_hash: string;
	outcome: ExplorationReceiptBinding['outcome'];
};

function parseAttempt(
	row: AttemptRow,
	receipts: readonly ReceiptRow[]
): PersistedExplorationAttempt {
	const state = ExplorationAttemptStateSchema.parse(row.state);
	if (
		state.attemptId !== row.attempt_id ||
		state.runId !== row.run_id ||
		state.floorId !== row.floor_id ||
		state.contentVersion !== row.content_version ||
		state.contentHash !== row.content_hash ||
		state.status !== row.status ||
		state.version !== row.version
	) {
		throw new Error(`Exploration attempt projection drifted: ${row.attempt_id}`);
	}
	return {
		state,
		activeEncounter:
			row.active_request_id && row.active_request_hash
				? { requestId: row.active_request_id, requestHash: row.active_request_hash }
				: null,
		receipts: receipts.map((receipt) => ({
			receiptId: receipt.receipt_id,
			requestId: receipt.request_id,
			receiptHash: receipt.receipt_hash,
			outcome: receipt.outcome
		}))
	};
}

async function loadAttempt(
	sql: postgres.Sql | postgres.TransactionSql,
	attemptId: string
): Promise<PersistedExplorationAttempt | null> {
	const rows = await sql<AttemptRow[]>`
		select * from summonlab_exploration_attempts where attempt_id = ${attemptId}
	`;
	const row = rows[0];
	if (!row) return null;
	const receipts = await sql<ReceiptRow[]>`
		select receipt_id, request_id, receipt_hash, outcome
		from summonlab_exploration_receipts
		where attempt_id = ${attemptId}
		order by created_at, receipt_id
	`;
	return parseAttempt(row, receipts);
}

function assertSameBinding(current: ExplorationAttemptState, next: ExplorationAttemptState): void {
	for (const [label, left, right] of [
		['attempt', current.attemptId, next.attemptId],
		['run', current.runId, next.runId],
		['floor', current.floorId, next.floorId],
		['content version', current.contentVersion, next.contentVersion],
		['content hash', current.contentHash, next.contentHash],
		['leader', current.leaderHeroId, next.leaderHeroId]
	] as const) {
		if (left !== right) throw new Error(`Exploration ${label} binding cannot change`);
	}
	if (JSON.stringify(current.partyHeroIds) !== JSON.stringify(next.partyHeroIds)) {
		throw new Error('Exploration party binding cannot change');
	}
}

function assertVersion(current: ExplorationAttemptState, expectedVersion: number): void {
	if (current.version !== expectedVersion) {
		throw new Error(
			`Exploration attempt expected version ${expectedVersion}, but latest is ${current.version}`
		);
	}
}

export async function getExplorationAttempt(
	databaseUrl: string,
	attemptId: string
): Promise<PersistedExplorationAttempt | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await loadAttempt(sql, attemptId);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function getLatestExplorationAttemptForRun(
	databaseUrl: string,
	runId: string
): Promise<PersistedExplorationAttempt | null> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = await sql<AttemptRow[]>`
			select * from summonlab_exploration_attempts
			where run_id = ${runId}
			order by updated_at desc, attempt_id desc
			limit 1
		`;
		const row = rows[0];
		if (!row) return null;
		return await loadAttempt(sql, row.attempt_id);
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function startExplorationAttempt(
	databaseUrl: string,
	input: ExplorationAttemptState
): Promise<PersistedExplorationAttempt> {
	const state = ExplorationAttemptStateSchema.parse(input);
	if (state.status !== 'exploring' || state.version !== 0) {
		throw new Error('A new exploration attempt must begin exploring at version 0');
	}
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			await transaction`
				insert into summonlab_exploration_attempts (
					attempt_id, run_id, floor_id, content_version, content_hash, status, version, state
				) values (
					${state.attemptId}, ${state.runId}, ${state.floorId}, ${state.contentVersion},
					${state.contentHash}, ${state.status}, ${state.version}, ${transaction.json(state as never)}
				)
				on conflict do nothing
			`;
			const persisted = await loadAttempt(transaction, state.attemptId);
			if (!persisted) throw new Error('Created exploration attempt could not be loaded');
			if (JSON.stringify(persisted.state) !== JSON.stringify(state)) {
				throw new Error(`Exploration attempt idempotency conflict: ${state.attemptId}`);
			}
			return persisted;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function commitExplorationMove(
	databaseUrl: string,
	input: {
		readonly attemptId: string;
		readonly expectedVersion: number;
		readonly nextState: ExplorationAttemptState;
	}
): Promise<PersistedExplorationAttempt> {
	const next = ExplorationAttemptStateSchema.parse(input.nextState);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<AttemptRow[]>`
				select * from summonlab_exploration_attempts
				where attempt_id = ${input.attemptId} for update
			`;
			const row = rows[0];
			if (!row) throw new Error(`Exploration attempt not found: ${input.attemptId}`);
			const current = ExplorationAttemptStateSchema.parse(row.state);
			assertVersion(current, input.expectedVersion);
			assertSameBinding(current, next);
			if (current.status !== 'exploring' || next.status !== 'exploring') {
				throw new Error('Exploration movement requires an exploring attempt');
			}
			if (next.version !== current.version + 1) {
				throw new Error('Exploration movement must advance exactly one version');
			}
			await transaction`
				update summonlab_exploration_attempts
				set status = ${next.status}, version = ${next.version}, state = ${transaction.json(next as never)},
					updated_at = now()
				where attempt_id = ${input.attemptId}
			`;
			return (await loadAttempt(transaction, input.attemptId))!;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function beginExplorationEncounter(
	databaseUrl: string,
	input: {
		readonly attemptId: string;
		readonly expectedVersion: number;
		readonly request: ExplorationEncounterBinding;
	}
): Promise<PersistedExplorationAttempt> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<AttemptRow[]>`
				select * from summonlab_exploration_attempts
				where attempt_id = ${input.attemptId} for update
			`;
			const row = rows[0];
			if (!row) throw new Error(`Exploration attempt not found: ${input.attemptId}`);
			if (row.active_request_id) {
				if (
					row.active_request_id === input.request.requestId &&
					row.active_request_hash === input.request.requestHash
				) {
					return (await loadAttempt(transaction, input.attemptId))!;
				}
				throw new Error('Exploration attempt already has an active encounter');
			}
			const current = ExplorationAttemptStateSchema.parse(row.state);
			assertVersion(current, input.expectedVersion);
			const next = suspendExplorationForEncounter(current);
			await transaction`
				update summonlab_exploration_attempts
				set status = ${next.status}, version = ${next.version}, state = ${transaction.json(next as never)},
					active_request_id = ${input.request.requestId},
					active_request_hash = ${input.request.requestHash}, updated_at = now()
				where attempt_id = ${input.attemptId}
			`;
			return (await loadAttempt(transaction, input.attemptId))!;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function settleExplorationEncounter(
	databaseUrl: string,
	input: {
		readonly attemptId: string;
		readonly expectedVersion: number;
		readonly receipt: ExplorationReceiptBinding;
	}
): Promise<PersistedExplorationAttempt> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const prior = await transaction<ReceiptRow[]>`
				select receipt_id, request_id, receipt_hash, outcome
				from summonlab_exploration_receipts
				where attempt_id = ${input.attemptId} and request_id = ${input.receipt.requestId}
			`;
			if (prior[0]) {
				const previous = prior[0];
				if (
					previous.receipt_id !== input.receipt.receiptId ||
					previous.receipt_hash !== input.receipt.receiptHash ||
					previous.outcome !== input.receipt.outcome
				) {
					throw new Error('Exploration encounter receipt idempotency conflict');
				}
				return (await loadAttempt(transaction, input.attemptId))!;
			}
			const rows = await transaction<AttemptRow[]>`
				select * from summonlab_exploration_attempts
				where attempt_id = ${input.attemptId} for update
			`;
			const row = rows[0];
			if (!row) throw new Error(`Exploration attempt not found: ${input.attemptId}`);
			if (row.active_request_id !== input.receipt.requestId) {
				throw new Error('Exploration receipt does not match the active encounter');
			}
			const current = ExplorationAttemptStateSchema.parse(row.state);
			assertVersion(current, input.expectedVersion);
			const next = resumeExplorationAfterEncounter(current, input.receipt.outcome);
			await transaction`
				insert into summonlab_exploration_receipts (
					receipt_id, attempt_id, request_id, receipt_hash, outcome
				) values (
					${input.receipt.receiptId}, ${input.attemptId}, ${input.receipt.requestId},
					${input.receipt.receiptHash}, ${input.receipt.outcome}
				)
			`;
			await transaction`
				update summonlab_exploration_attempts
				set status = ${next.status}, version = ${next.version}, state = ${transaction.json(next as never)},
					active_request_id = null, active_request_hash = null, updated_at = now()
				where attempt_id = ${input.attemptId}
			`;
			return (await loadAttempt(transaction, input.attemptId))!;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function extractExplorationAttempt(
	databaseUrl: string,
	input: { readonly attemptId: string; readonly expectedVersion: number }
): Promise<PersistedExplorationAttempt> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		return await sql.begin(async (transaction) => {
			const rows = await transaction<AttemptRow[]>`
				select * from summonlab_exploration_attempts
				where attempt_id = ${input.attemptId} for update
			`;
			const row = rows[0];
			if (!row) throw new Error(`Exploration attempt not found: ${input.attemptId}`);
			const current = ExplorationAttemptStateSchema.parse(row.state);
			if (current.status === 'extracted') return (await loadAttempt(transaction, input.attemptId))!;
			assertVersion(current, input.expectedVersion);
			if (!current.objectiveComplete) {
				throw new Error('Complete the floor objective before extracting');
			}
			if (current.status !== 'exploring' && current.status !== 'returning') {
				throw new Error('Only an active exploration attempt can extract');
			}
			const next = ExplorationAttemptStateSchema.parse({
				...current,
				status: 'extracted',
				version: current.version + 1
			});
			await transaction`
				update summonlab_exploration_attempts
				set status = ${next.status}, version = ${next.version}, state = ${transaction.json(next as never)},
					updated_at = now()
				where attempt_id = ${input.attemptId}
			`;
			return (await loadAttempt(transaction, input.attemptId))!;
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
