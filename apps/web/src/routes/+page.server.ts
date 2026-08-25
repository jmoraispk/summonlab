import { getConfig } from '@summonlab/config';
import { getLatestActiveCampaignRun } from '@summonlab/database';
import { requestIdFromHeaders } from '@summonlab/observability';

import { campaignResumePath } from '$lib/server/campaign';
import { getWebHealth } from '$lib/server/health';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	const health = await getWebHealth(requestIdFromHeaders(request.headers));
	const campaign = await getLatestActiveCampaignRun(getConfig().databaseUrl).catch(() => null);
	return {
		health,
		campaign,
		resumePath: campaign ? campaignResumePath(campaign) : null
	};
};
