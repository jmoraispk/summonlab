import { getConfig } from '@summonlab/config';
import { ModeratedPlaytestReportSchema } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import reportSource from '../../../../../docs/evidence/phase-7-fin007-moderated-playtest.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Playtest moderation is disabled.');
	return { report: ModeratedPlaytestReportSchema.parse(reportSource) };
};
