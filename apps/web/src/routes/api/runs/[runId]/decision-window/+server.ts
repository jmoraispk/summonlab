import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import {
	MasterDecisionWindowRequestSchema,
	type ActionSource,
	type EngineCommand
} from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { projectEngineCommitReceipt } from '$lib/server/public-engine-presentation';

import type { RequestHandler } from './$types';

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = MasterDecisionWindowRequestSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parsed.success)
		return json({ message: 'Decision window request must be empty.' }, { status: 400 });
	const config = getConfig();
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 19 && snapshot.state.schemaVersion !== 20) {
			return json({ message: 'This run predates authoritative Master timing.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const command = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: manualSource,
			commandType: 'master.open.decision',
			observedAt: new Date().toISOString()
		} satisfies EngineCommand;
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (
			committed.snapshot.state.schemaVersion !== 19 &&
			committed.snapshot.state.schemaVersion !== 20
		) {
			throw new Error('Decision opening changed the engine schema.');
		}
		return json(projectEngineCommitReceipt(committed));
	} catch (error) {
		if (error instanceof StaleRunVersionError || error instanceof IdempotencyConflictError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		if (error instanceof IllegalActionError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		return json(
			{ message: error instanceof Error ? error.message : 'Decision window could not open.' },
			{ status: 500 }
		);
	}
};
