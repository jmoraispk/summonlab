import { getConfig } from '@summonlab/config';
import { CampaignRestartRequestSchema } from '@summonlab/contracts';
import { getCampaignRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { campaignResumePath, createPlayerCampaign } from '$lib/server/campaign';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = CampaignRestartRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ message: 'Restart request is invalid.' }, { status: 400 });
	try {
		const config = getConfig();
		const previous = await getCampaignRun(config.databaseUrl, params.runId);
		if (!previous) return json({ message: 'Campaign run not found.' }, { status: 404 });
		const campaignSeed =
			parsed.data.seedMode === 'same' ? previous.campaignSeed : parsed.data.seed!;
		const campaign = await createPlayerCampaign({
			databaseUrl: config.databaseUrl,
			campaignSeed,
			controlMode: parsed.data.controlMode,
			clockSpeed: config.simulationSpeed,
			restartedFromRunId: previous.runId
		});
		return json(
			{ campaign, resumePath: campaignResumePath(campaign), preservedReplayRunId: previous.runId },
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Campaign restart failed.' },
			{ status: 409 }
		);
	}
};
