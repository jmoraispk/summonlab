import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { EngineCommandSchema, SynthesisRequestSchema } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError, supportsSynthesisApi } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { synthesisView } from '$lib/server/synthesis';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId).catch(() => null);
	if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
	if (!supportsSynthesisApi(snapshot.state)) {
		return json({ message: 'This run has no synthesis state.' }, { status: 409 });
	}
	return json(synthesisView(snapshot.state, snapshot.stateHash));
};

export const POST: RequestHandler = async ({ params, request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = SynthesisRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'The synthesis request is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (!supportsSynthesisApi(snapshot.state)) {
			return json({ message: 'This run cannot accept synthesis actions.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const common = {
			commandId,
			runId: params.runId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source:
				parsed.data.action === 'synthesize'
					? {
							source: 'manual' as const,
							timing: null,
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						}
					: {
							source: 'scripted' as const,
							timing: null,
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						}
		};
		const command =
			parsed.data.action === 'synthesize'
				? EngineCommandSchema.parse({
						...common,
						actorId: snapshot.state.master.masterId,
						commandType: 'settlement.synthesize.hero',
						sourceHeroId: parsed.data.sourceHeroId,
						recipientHeroId: parsed.data.recipientHeroId,
						visibility: parsed.data.visibility,
						warningVersion: parsed.data.warningVersion,
						confirmedIrreversible: parsed.data.confirmedIrreversible,
						rationale: parsed.data.rationale
					})
				: EngineCommandSchema.parse({
						...common,
						actorId: parsed.data.speakerHeroId,
						commandType: 'hero.share.synthesis.rumor',
						receiptId: parsed.data.receiptId,
						targetHeroId: parsed.data.targetHeroId
					});
		const committed = await commitEngineCommand(config.databaseUrl, command);
		if (
			committed.snapshot.state.schemaVersion !== 22 &&
			committed.snapshot.state.schemaVersion !== 27
		) {
			throw new Error('Synthesis commit changed the engine schema.');
		}
		return json({
			view: synthesisView(committed.snapshot.state, committed.snapshot.stateHash),
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
			{ message: error instanceof Error ? error.message : 'The synthesis action failed.' },
			{ status: 500 }
		);
	}
};
