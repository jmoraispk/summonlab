import { getConfig } from '@summonlab/config';
import { getLatestActiveCampaignRun } from '@summonlab/database';
import { campaignResumePath } from '$lib/server/campaign';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const campaign = await getLatestActiveCampaignRun(getConfig().databaseUrl).catch(() => null);
	return {
		campaign,
		resumePath: campaign ? campaignResumePath(campaign) : null
	};
};
