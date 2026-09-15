import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import { getCampaignRun, startExplorationAttempt } from '@summonlab/database';
import { createExplorationAttempt } from '@summonlab/engine/exploration';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as { floorId?: string } | null;
	if (body?.floorId !== TOWER_FLOOR_01_EXPLORATION.floorId) {
		return json({ message: 'Only the first Tower floor is currently available.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const campaign = await getCampaignRun(config.databaseUrl, params.runId);
		if (!campaign) return json({ message: 'Campaign not found.' }, { status: 404 });
		const partyHeroIds = campaign.heroes
			.slice(0, campaign.summonedHeroCount)
			.map((hero) => hero.draft.manifest.characterId);
		if (partyHeroIds.length === 0) {
			return json(
				{ message: 'Summon at least one resident before entering the Tower.' },
				{ status: 409 }
			);
		}
		const state = createExplorationAttempt(TOWER_FLOOR_01_EXPLORATION, {
			attemptId: randomUUID(),
			runId: params.runId,
			partyHeroIds,
			leaderHeroId: partyHeroIds[0]!
		});
		const attempt = await startExplorationAttempt(config.databaseUrl, state);
		return json(attempt, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The expedition could not begin.' },
			{ status: 409 }
		);
	}
};
