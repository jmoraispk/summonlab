import { getConfig } from '@summonlab/config';
import { PlaytestReleaseReportSchema } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import reportSource from '../../../../../docs/evidence/phase-7-fin008-playtest-release.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Playtest release is disabled.');
	return { report: PlaytestReleaseReportSchema.parse(reportSource) };
};
