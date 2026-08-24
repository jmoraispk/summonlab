import { getConfig } from '@summonlab/config';
import { getEngineSnapshot, getProofRun } from '@summonlab/database';
import { projectHeroConversationPresentation } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const databaseUrl = getConfig().databaseUrl;
	const [snapshot, engineSnapshot] = await Promise.all([
		getProofRun(databaseUrl, params.runId).catch(() => null),
		getEngineSnapshot(databaseUrl, params.runId).catch(() => null)
	]);
	if (!snapshot) error(404, 'This summon could not be found. Is the local database running?');
	const conversation = engineSnapshot
		? projectHeroConversationPresentation(engineSnapshot, snapshot.manifest.characterId)
		: null;
	return { snapshot, conversation };
};
