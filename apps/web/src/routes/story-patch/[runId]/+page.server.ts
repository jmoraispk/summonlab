import { getConfig } from '@summonlab/config';
import { getEngineSnapshot } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import { runtimeStoryPatchView } from '$lib/server/story-patch';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Runtime story proof is disabled.');
	const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId).catch(() => null);
	if (!snapshot) error(404, 'This company could not be loaded.');
	if (snapshot.state.schemaVersion !== 21) error(409, 'This run has no runtime story-patch state.');
	return { view: runtimeStoryPatchView(snapshot.state, snapshot.stateHash) };
};
