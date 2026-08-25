import { getConfig } from '@summonlab/config';
import { FoundryStrategyReportSchema } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import reportSource from '../../../../../docs/evidence/phase-6-foundry-strategies.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Foundry trials are disabled.');
	return { report: FoundryStrategyReportSchema.parse(reportSource) };
};
