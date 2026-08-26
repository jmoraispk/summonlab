import { getConfig } from '@summonlab/config';
import { StoryWorkshopReportSchema } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import reportSource from '../../../../../docs/evidence/phase-7-fin009-story-workshop.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Story workshop is disabled.');
	return { report: StoryWorkshopReportSchema.parse(reportSource) };
};
