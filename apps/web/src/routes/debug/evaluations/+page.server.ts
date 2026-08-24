import { getConfig } from '@summonlab/config';
import { createAgentEvaluationCorpus, createAgentEvaluationReport } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Evaluation bench is disabled.');
	const corpus = await createAgentEvaluationCorpus();
	return { corpus, report: await createAgentEvaluationReport(corpus) };
};
