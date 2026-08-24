import { getConfig } from '@summonlab/config';
import { getProofRun } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const snapshot = await getProofRun(getConfig().databaseUrl, params.runId).catch(() => null);
	if (!snapshot) error(404, 'This proof run could not be found. Is the local database running?');
	if (!snapshot.destination) error(409, 'This hero has not made a first choice yet.');
	return { snapshot };
};
