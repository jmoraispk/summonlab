import { getConfig } from '@summonlab/config';
import { AttemptAftermathReportSchema } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import reportSource from '../../../../../docs/evidence/phase-6-attempt-aftermath.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Attempt aftermath proof is disabled.');
	return { report: AttemptAftermathReportSchema.parse(reportSource) };
};
