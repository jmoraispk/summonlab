import { getConfig } from '@summonlab/config';
import { getEngineSnapshot } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import { synthesisView } from '$lib/server/synthesis';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId);
	if (!snapshot) error(404, 'Engine run not found.');
	if (snapshot.state.schemaVersion !== 22) error(409, 'This run has no synthesis state.');
	return { view: synthesisView(snapshot.state, snapshot.stateHash) };
};
