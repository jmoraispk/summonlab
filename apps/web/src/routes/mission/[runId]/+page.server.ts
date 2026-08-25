import { getConfig } from '@summonlab/config';
import { getEngineReplay, getProofRun } from '@summonlab/database';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const [report, proof] = await Promise.all([
		getEngineReplay(config.databaseUrl, params.runId).catch(() => null),
		getProofRun(config.databaseUrl, params.runId).catch(() => null)
	]);
	if (!report || !proof) error(404, 'This summoned company could not be loaded.');
	if (report.snapshot.state.schemaVersion !== 11) {
		error(409, 'This run predates authoritative mission preparation.');
	}
	return { report, proof, objectiveProofEnabled: config.devRoutesEnabled };
};
