import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { EngineCommandSchema, FirstBandArchiveRequestSchema } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError, supportsFirstBandArchiveApi } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { firstBandArchiveView } from '$lib/server/first-band-archive';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId).catch(() => null);
	if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
	if (!supportsFirstBandArchiveApi(snapshot.state)) {
		return json({ message: 'This run has no first-band archive.' }, { status: 409 });
	}
	return json(firstBandArchiveView(snapshot.state, snapshot.stateHash));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = FirstBandArchiveRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'The archive request is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!supportsFirstBandArchiveApi(snapshot.state)) {
			return json({ message: 'This run cannot reveal the first-band archive.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const command = EngineCommandSchema.parse({
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: {
				source: 'manual',
				timing: 'step',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'story.reveal.first.archive',
			readerHeroId: parsed.data.readerHeroId
		});
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (committed.snapshot.state.schemaVersion !== 23) {
			throw new Error('Archive reveal changed the engine schema');
		}
		return json({
			view: firstBandArchiveView(committed.snapshot.state, committed.snapshot.stateHash),
			event: committed.events[0]
		});
	} catch (error) {
		if (
			error instanceof StaleRunVersionError ||
			error instanceof IdempotencyConflictError ||
			error instanceof IllegalActionError
		) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		return json(
			{ message: error instanceof Error ? error.message : 'The archive reveal failed.' },
			{ status: 500 }
		);
	}
};
