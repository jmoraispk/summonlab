import { getConfig } from '@summonlab/config';
import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import { extractExplorationAttempt, getExplorationAttempt } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as {
		attemptId?: string;
		expectedVersion?: number;
	} | null;
	if (!body?.attemptId || !Number.isInteger(body.expectedVersion)) {
		return json({ message: 'The extraction request is incomplete.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const attempt = await getExplorationAttempt(config.databaseUrl, body.attemptId);
		if (!attempt || attempt.state.runId !== params.runId) {
			return json({ message: 'Exploration attempt not found.' }, { status: 404 });
		}
		if (
			attempt.state.status !== 'extracted' &&
			attempt.state.positionTileId !== TOWER_FLOOR_01_EXPLORATION.entryTileId
		) {
			return json({ message: 'Return to the Tower threshold before extracting.' }, { status: 409 });
		}
		const extracted = await extractExplorationAttempt(config.databaseUrl, {
			attemptId: body.attemptId,
			expectedVersion: body.expectedVersion!
		});
		return json(extracted, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The company could not extract.' },
			{ status: 409 }
		);
	}
};
