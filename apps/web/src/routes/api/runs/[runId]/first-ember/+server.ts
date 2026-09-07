import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { FirstEmberRequestSchema, type EngineCommand } from '@summonlab/contracts';
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

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = FirstEmberRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: 'Choose a valid First Ember action.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (
			snapshot.state.schemaVersion !== 6 &&
			snapshot.state.schemaVersion !== 7 &&
			snapshot.state.schemaVersion !== 8 &&
			snapshot.state.schemaVersion !== 9 &&
			snapshot.state.schemaVersion !== 10 &&
			snapshot.state.schemaVersion !== 11 &&
			snapshot.state.schemaVersion !== 12 &&
			snapshot.state.schemaVersion !== 13
		) {
			return json({ message: 'This history predates the First Ember choice.' }, { status: 409 });
		}
		const commandId = randomUUID();
		const base = {
			commandId,
			runId: params.runId,
			actorId: snapshot.state.master.masterId,
			expectedVersion: snapshot.state.version,
			correlationId: commandId
		};
		const command: EngineCommand =
			parsed.data.action === 'recover'
				? {
						...base,
						source: {
							source: 'system',
							timing: null,
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						},
						commandType: 'story.recover.first.ember'
					}
				: {
						...base,
						source: {
							source: 'manual',
							timing: 'step',
							fallbackPolicy: null,
							directiveIds: [],
							decisionJobId: null
						},
						commandType: 'settlement.commit.first.ember',
						buildingId: parsed.data.buildingId,
						rationale: parsed.data.rationale
					};
		const committed = await commitEngineCommand(config.databaseUrl, command);
		return json(projectEngineCommitReceipt(committed));
	} catch (error) {
		if (error instanceof StaleRunVersionError) {
			return json(
				{ code: error.code, message: 'The run changed before the Ember was bound.' },
				{ status: 409 }
			);
		}
		if (error instanceof IllegalActionError) {
			return json(
				{ code: error.code, message: 'That First Ember action is not currently available.' },
				{ status: 409 }
			);
		}
		if (error instanceof IdempotencyConflictError) {
			return json(
				{ code: error.code, message: 'That Ember action was already submitted differently.' },
				{ status: 409 }
			);
		}
		console.error('First Ember commit failed', error);
		return json({ message: 'The First Ember could not be bound.' }, { status: 500 });
	}
};
