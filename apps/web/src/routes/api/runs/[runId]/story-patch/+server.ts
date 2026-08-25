import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { StoryPatchCandidateSchema } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError, validateStoryPatchForState } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { runtimeStoryPatchView } from '$lib/server/story-patch';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId).catch(() => null);
	if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
	if (snapshot.state.schemaVersion !== 21) {
		return json({ message: 'This run has no runtime story-patch state.' }, { status: 409 });
	}
	return json(runtimeStoryPatchView(snapshot.state, snapshot.stateHash));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = StoryPatchCandidateSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{
				message: 'The StoryDirector candidate violates the strict patch schema.',
				issues: parsed.error.issues
			},
			{ status: 400 }
		);
	}
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (
			snapshot.state.schemaVersion !== 21 ||
			parsed.data.envelopeId !== snapshot.state.bandStory.envelopeId
		) {
			return json({ message: 'This run cannot accept that story patch.' }, { status: 409 });
		}
		const validation = validateStoryPatchForState(snapshot.state, parsed.data);
		if (!validation.accepted) {
			return json(
				{ message: 'The StoryDirector candidate was rejected.', validation },
				{ status: 409 }
			);
		}
		const commandId = randomUUID();
		const committed = await commitEngineCommand(config.databaseUrl, {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: {
				source: 'scripted',
				timing: null,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'story.apply.patch',
			candidate: parsed.data
		});
		if (committed.snapshot.state.schemaVersion !== 21) {
			throw new Error('Story patch commit changed the engine schema.');
		}
		return json({
			view: runtimeStoryPatchView(committed.snapshot.state, committed.snapshot.stateHash),
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
			{
				message: error instanceof Error ? error.message : 'The story patch could not be committed.'
			},
			{ status: 500 }
		);
	}
};
