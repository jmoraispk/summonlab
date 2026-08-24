import { getConfig } from '@summonlab/config';
import { getDecisionJob } from '@summonlab/database';
import { buildDecisionInspectorReport } from '@summonlab/observability';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) error(404, 'Decision traces are disabled.');
	const job = await getDecisionJob(config.databaseUrl, params.jobId).catch(() => null);
	if (!job) error(404, 'Decision job not found.');
	return { report: buildDecisionInspectorReport(job) };
};
