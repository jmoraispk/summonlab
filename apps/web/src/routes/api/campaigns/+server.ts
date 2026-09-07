import { getConfig } from '@summonlab/config';
import { CampaignRunCreateRequestSchema } from '@summonlab/contracts';
import { getLatestActiveCampaignRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import {
	campaignResumePath,
	createPlayerCampaign,
	projectCampaignRunForPublic
} from '$lib/server/campaign';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const campaign = await getLatestActiveCampaignRun(getConfig().databaseUrl);
		return json(
			campaign
				? {
						campaign: projectCampaignRunForPublic(campaign),
						resumePath: campaignResumePath(campaign)
					}
				: { campaign: null },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		console.error('Campaign list failed', error);
		return json({ message: 'Campaign could not be loaded.' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request }) => {
	const parsed = CampaignRunCreateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json({ message: 'Choose a valid campaign seed and control mode.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const campaign = await createPlayerCampaign({
			databaseUrl: config.databaseUrl,
			campaignSeed: parsed.data.seed,
			controlMode: parsed.data.controlMode,
			clockSpeed: config.simulationSpeed
		});
		return json(
			{
				campaign: projectCampaignRunForPublic(campaign),
				resumePath: campaignResumePath(campaign)
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Campaign creation failed', error);
		return json(
			{
				message: 'The gate could not begin this campaign. Start PostgreSQL with pnpm dev.'
			},
			{ status: 503 }
		);
	}
};
