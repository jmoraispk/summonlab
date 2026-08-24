import { getConfig } from '@summonlab/config';
import { catchUpRun, getProofRun, getSimulationClock } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const snapshot = await getProofRun(config.databaseUrl, params.runId).catch(() => null);
	if (!snapshot) error(404, 'This proof run could not be found. Is the local database running?');
	if (!snapshot.destination) error(409, 'This hero has not made a first choice yet.');
	let clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => null);
	if (snapshot.arrived) {
		if (clock && clock.backlogGameMinutes >= 1) {
			await catchUpRun(config.databaseUrl, params.runId, { owner: 'play-reconnect' }).catch(
				() => null
			);
			clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => clock);
		}
	}
	return { snapshot, clock };
};
