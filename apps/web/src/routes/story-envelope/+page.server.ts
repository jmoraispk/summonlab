import { getConfig } from '@summonlab/config';
import { StoryEnvelopeReportSchema } from '@summonlab/evaluation';
import { error } from '@sveltejs/kit';

import reportSource from '../../../../../docs/evidence/phase-6-story-envelope.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Story envelope proof is disabled.');
	return { report: StoryEnvelopeReportSchema.parse(reportSource) };
};
