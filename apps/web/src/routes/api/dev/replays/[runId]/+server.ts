import { getConfig } from '@summonlab/config';
import { getEngineReplay } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const report = await getEngineReplay(getConfig().databaseUrl, params.runId);
		if (!report) return json({ message: 'Engine run not found.' }, { status: 404 });
		return json(report, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The replay could not be rebuilt.' },
			{ status: 500 }
		);
	}
};
