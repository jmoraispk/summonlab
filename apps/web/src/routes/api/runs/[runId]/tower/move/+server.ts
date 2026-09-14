import { createHash, randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import {
	beginExplorationEncounter,
	commitExplorationMove,
	getExplorationAttempt
} from '@summonlab/database';
import { stepExploration } from '@summonlab/engine/exploration';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as {
		attemptId?: string;
		expectedVersion?: number;
		destinationTileId?: string;
	} | null;
	if (!body?.attemptId || !Number.isInteger(body.expectedVersion) || !body.destinationTileId) {
		return json({ message: 'Choose a legal adjacent Tower tile.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const current = await getExplorationAttempt(config.databaseUrl, body.attemptId);
		if (!current || current.state.runId !== params.runId) {
			return json({ message: 'Exploration attempt not found.' }, { status: 404 });
		}
		const next = stepExploration(TOWER_FLOOR_01_EXPLORATION, current.state, body.destinationTileId);
		let persisted = await commitExplorationMove(config.databaseUrl, {
			attemptId: body.attemptId,
			expectedVersion: body.expectedVersion!,
			nextState: next
		});
		const tile = TOWER_FLOOR_01_EXPLORATION.tiles.find(
			(candidate) => candidate.tileId === persisted.state.positionTileId
		);
		if (
			tile?.interaction?.kind === 'encounter' &&
			!persisted.state.resolvedInteractionTileIds.includes(tile.tileId)
		) {
			const requestId = randomUUID();
			const requestHash = createHash('sha256')
				.update(
					`${persisted.state.attemptId}:${persisted.state.positionTileId}:${tile.interaction.dutySlotId}`
				)
				.digest('hex');
			persisted = await beginExplorationEncounter(config.databaseUrl, {
				attemptId: body.attemptId,
				expectedVersion: persisted.state.version,
				request: { requestId, requestHash }
			});
		}
		return json(persisted, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The company could not move.' },
			{ status: 409 }
		);
	}
};
