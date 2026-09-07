import { getConfig } from '@summonlab/config';
import { getEngineReplay } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectPlayerJournalForPublic } from '$lib/server/public-engine-presentation';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const replay = await getEngineReplay(getConfig().databaseUrl, params.runId);
		if (!replay) return json({ message: 'Engine run not found.' }, { status: 404 });
		return json(projectPlayerJournalForPublic(replay.playerJournal), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		console.error('Player journal projection failed', error);
		return json({ message: 'The player journal could not be built.' }, { status: 500 });
	}
};
