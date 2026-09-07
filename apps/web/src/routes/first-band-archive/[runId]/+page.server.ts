import { getConfig } from '@summonlab/config';
import { getEngineSnapshot } from '@summonlab/database';
import { supportsFirstBandArchiveApi } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import { firstBandArchiveView } from '$lib/server/first-band-archive';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Not found.');
	const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
	if (!snapshot) error(404, 'Engine run not found.');
	if (!supportsFirstBandArchiveApi(snapshot.state))
		error(409, 'This run has no first-band archive.');
	return { view: firstBandArchiveView(snapshot.state, snapshot.stateHash) };
};
