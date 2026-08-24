import { getConfig } from '@summonlab/config';
import { EngineCommandSchema } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand
} from '@summonlab/database';
import { IllegalActionError } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = EngineCommandSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success || parsed.data.runId !== params.runId) {
		return json(
			{ message: 'The engine command is invalid.', issues: parsed.error?.issues ?? [] },
			{ status: 400 }
		);
	}
	try {
		return json(await commitEngineCommand(getConfig().databaseUrl, parsed.data));
	} catch (error) {
		if (error instanceof StaleRunVersionError) {
			return json(
				{
					code: error.code,
					message: error.message,
					latestVersion: error.latestVersion,
					eventCursor: error.eventCursor,
					stateHash: error.stateHash
				},
				{ status: 409 }
			);
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
			{ message: error instanceof Error ? error.message : 'The command could not be committed.' },
			{ status: 500 }
		);
	}
};
