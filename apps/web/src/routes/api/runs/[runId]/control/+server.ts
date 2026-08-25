import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { MasterControlRequestSchema, type ActionSource } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const parsed = MasterControlRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'Choose Wait, Countdown, Step, or Continuous timing.' },
			{ status: 400 }
		);
	}
	const config = getConfig();
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 19) {
			return json({ message: 'This run predates authoritative Master timing.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const committed = await commitEngineCommand(config.databaseUrl, {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: manualSource,
			commandType: 'master.configure.timing',
			timing: parsed.data.timing,
			countdownSeconds: parsed.data.countdownSeconds,
			observedAt: new Date().toISOString()
		});
		if (committed.snapshot.state.schemaVersion !== 19) {
			throw new Error('Master timing commit changed the engine schema.');
		}
		return json({
			runId: committed.snapshot.state.runId,
			version: committed.snapshot.state.version,
			eventCursor: committed.snapshot.state.eventCursor,
			stateHash: committed.snapshot.stateHash,
			masterControl: committed.snapshot.state.masterControl,
			eventType: committed.events[0]?.eventType ?? null
		});
	} catch (error) {
		if (error instanceof StaleRunVersionError || error instanceof IdempotencyConflictError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: error.message, legalActionIds: error.legalActionIds },
				{ status: 409 }
			);
		}
		return json(
			{ message: error instanceof Error ? error.message : 'Master timing could not change.' },
			{ status: 500 }
		);
	}
};
