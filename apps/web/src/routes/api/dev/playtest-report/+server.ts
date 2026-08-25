import { getConfig } from '@summonlab/config';
import { getPlaytestAnalyticsReport } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		return json(await getPlaytestAnalyticsReport(config.databaseUrl), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{
				message: 'The aggregate playtest report is unavailable.',
				detail: error instanceof Error ? error.message : 'unknown report failure'
			},
			{ status: 503 }
		);
	}
};
