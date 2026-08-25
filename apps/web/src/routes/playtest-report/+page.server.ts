import { getConfig } from '@summonlab/config';
import { getPlaytestAnalyticsReport } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Playtest report is disabled.');
	return { report: await getPlaytestAnalyticsReport(config.databaseUrl) };
};
