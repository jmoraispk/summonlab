import { getConfig } from '@summonlab/config';
import { getSimulationClock } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const clock = await getSimulationClock(getConfig().databaseUrl, params.runId);
		return clock
			? json(clock, { headers: { 'cache-control': 'no-store' } })
			: json({ message: 'Simulation clock not found.' }, { status: 404 });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Simulation clock could not be read.' },
			{ status: 500 }
		);
	}
};
