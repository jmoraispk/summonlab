import { getConfig } from '@summonlab/config';
import { PlayerJournalReportSchema } from '@summonlab/contracts';
import { getEngineReplay } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const replay = await getEngineReplay(getConfig().databaseUrl, params.runId);
		if (!replay) return json({ message: 'Engine run not found.' }, { status: 404 });
		return json(PlayerJournalReportSchema.parse(replay.playerJournal), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{
				message: error instanceof Error ? error.message : 'The player journal could not be built.'
			},
			{ status: 500 }
		);
	}
};
