import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { CommunicationRequestSchema, type EngineCommand } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError, projectHeroConversationPresentation } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const heroId = url.searchParams.get('heroId');
	if (!heroId) return json({ message: 'heroId is required.' }, { status: 400 });
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId).catch(() => null);
	if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
	try {
		return json(projectHeroConversationPresentation(snapshot, heroId), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Conversation could not be loaded.' },
			{ status: 400 }
		);
	}
};

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = CommunicationRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: 'Choose a valid communication act.' }, { status: 400 });
	}
	const compatible =
		(parsed.data.kind === 'ask' && parsed.data.topic === 'hero-memory') ||
		(parsed.data.kind !== 'ask' && parsed.data.topic !== 'hero-memory');
	if (!compatible) {
		return json(
			{ message: 'Questions use hero memory; explanations use a known topic.' },
			{ status: 400 }
		);
	}
	try {
		const config = getConfig();
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 8) {
			return json({ message: 'This history predates witnessed communication.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const command: EngineCommand = {
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
			commandType: 'master.communicate',
			...parsed.data
		};
		const committed = await commitEngineCommand(config.databaseUrl, command);
		return json(projectHeroConversationPresentation(committed.snapshot, parsed.data.targetHeroId));
	} catch (error) {
		if (error instanceof StaleRunVersionError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: error.message, legalActionIds: error.legalActionIds },
				{ status: 409 }
			);
		}
		if (error instanceof IdempotencyConflictError) {
			return json({ code: error.code, message: error.message }, { status: 409 });
		}
		return json(
			{ message: error instanceof Error ? error.message : 'The words could not be recorded.' },
			{ status: 500 }
		);
	}
};
