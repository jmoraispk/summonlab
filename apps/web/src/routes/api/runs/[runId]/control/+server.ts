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

import { projectEngineCommitReceipt } from '$lib/server/public-engine-presentation';

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
		return json({ message: 'Choose a valid timing or fallback configuration.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (snapshot.state.schemaVersion !== 19 && snapshot.state.schemaVersion !== 20) {
			return json({ message: 'This run predates authoritative Master timing.' }, { status: 409 });
		}
		if (parsed.data.action === 'fallback' && snapshot.state.schemaVersion !== 20) {
			return json({ message: 'This run predates authoritative fallback policy.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const base = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId,
			source: manualSource,
			observedAt: new Date().toISOString()
		};
		const committed = await commitEngineCommand(
			config.databaseUrl,
			parsed.data.action === 'timing'
				? {
						...base,
						commandType: 'master.configure.timing',
						timing: parsed.data.timing,
						countdownSeconds: parsed.data.countdownSeconds
					}
				: {
						...base,
						commandType: 'master.configure.fallback',
						policy: parsed.data.policy,
						directionText: parsed.data.directionText,
						priorities: parsed.data.priorities,
						protectedHeroId: parsed.data.protectedHeroId,
						safetyStops: parsed.data.safetyStops
					}
		);
		if (
			committed.snapshot.state.schemaVersion !== 19 &&
			committed.snapshot.state.schemaVersion !== 20
		) {
			throw new Error('Master timing commit changed the engine schema.');
		}
		return json(projectEngineCommitReceipt(committed));
	} catch (error) {
		if (error instanceof StaleRunVersionError || error instanceof IdempotencyConflictError) {
			return json(
				{ code: error.code, message: 'The run changed before timing was updated.' },
				{ status: 409 }
			);
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: 'That timing action is not currently available.' },
				{ status: 409 }
			);
		}
		console.error('Master timing update failed', error);
		return json({ message: 'Master timing could not change.' }, { status: 500 });
	}
};
