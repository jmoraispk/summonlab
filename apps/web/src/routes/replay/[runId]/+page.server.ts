import { getConfig } from '@summonlab/config';
import { getEngineReplay } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Replay inspector is disabled.');
	const report = await getEngineReplay(config.databaseUrl, params.runId).catch(() => null);
	if (!report) error(404, 'This engine run could not be rebuilt. Is the local database running?');
	return { report };
};
