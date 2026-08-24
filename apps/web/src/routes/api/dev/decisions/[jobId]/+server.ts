import { getConfig } from '@summonlab/config';
import { getDecisionJob } from '@summonlab/database';
import { buildDecisionInspectorReport } from '@summonlab/observability';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const job = await getDecisionJob(config.databaseUrl, params.jobId).catch(() => null);
	if (!job) return json({ message: 'Decision job not found.' }, { status: 404 });
	return json(buildDecisionInspectorReport(job));
};
