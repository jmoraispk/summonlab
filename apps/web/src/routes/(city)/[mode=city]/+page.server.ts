import { getConfig } from '@summonlab/config';
import { getLatestActiveCampaignRun } from '@summonlab/database';
import { redirect } from '@sveltejs/kit';

import { parseCityMode } from '$lib/city';
import { loadSingletonVillagePage } from '$lib/server/singleton-village-page';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const campaign = await getLatestActiveCampaignRun(config.databaseUrl).catch(() => null);
	if (!campaign) redirect(303, '/');

	const mode = parseCityMode(params.mode);
	const page = await loadSingletonVillagePage({
		databaseUrl: config.databaseUrl,
		campaign,
		mode
	});
	if (page.stage !== 'city' && mode !== 'village') redirect(307, '/village');
	return page;
};
