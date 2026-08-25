import { getConfig } from '@summonlab/config';
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	if (!getConfig().devRoutesEnabled) error(404, 'Not found.');
	return {};
};
