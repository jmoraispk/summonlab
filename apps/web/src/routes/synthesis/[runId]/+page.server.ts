import { getConfig } from '@summonlab/config';
import { getEngineSnapshot } from '@summonlab/database';
import { supportsSynthesisApi } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import { synthesisView } from '$lib/server/synthesis';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Not found.');
	const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
	if (!snapshot) error(404, 'Engine run not found.');
	if (!supportsSynthesisApi(snapshot.state)) error(409, 'This run has no synthesis state.');
	return { view: synthesisView(snapshot.state, snapshot.stateHash) };
};
