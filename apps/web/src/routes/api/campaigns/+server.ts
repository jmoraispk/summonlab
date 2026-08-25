import { getConfig } from '@summonlab/config';
import { CampaignRunCreateRequestSchema } from '@summonlab/contracts';
import { getLatestActiveCampaignRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { campaignResumePath, createPlayerCampaign } from '$lib/server/campaign';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
	try {
		const campaign = await getLatestActiveCampaignRun(getConfig().databaseUrl);
		return json(
			campaign ? { campaign, resumePath: campaignResumePath(campaign) } : { campaign: null },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Campaign could not be loaded.' },
			{ status: 500 }
		);
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
		return json({ campaign, resumePath: campaignResumePath(campaign) }, { status: 201 });
	} catch (error) {
		return json(
			{
				message: 'The gate could not begin this campaign. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown campaign persistence failure'
			},
			{ status: 503 }
		);
	}
};
