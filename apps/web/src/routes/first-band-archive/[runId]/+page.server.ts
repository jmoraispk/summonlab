import { getConfig } from '@summonlab/config';
import { getEngineSnapshot } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import { firstBandArchiveView } from '$lib/server/first-band-archive';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const snapshot = await getEngineSnapshot(getConfig().databaseUrl, params.runId);
	if (!snapshot) error(404, 'Engine run not found.');
	if (snapshot.state.schemaVersion !== 23) error(409, 'This run has no first-band archive.');
	return { view: firstBandArchiveView(snapshot.state, snapshot.stateHash) };
};
