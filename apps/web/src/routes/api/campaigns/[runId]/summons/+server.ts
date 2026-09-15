import { getConfig } from '@summonlab/config';
import { CampaignSummonRequestSchema } from '@summonlab/contracts';
import { summonNextCampaignHero } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = CampaignSummonRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'Choose the next hero from the current Village state.' },
			{ status: 400 }
		);
	}

	try {
		const campaign = await summonNextCampaignHero(
			getConfig().databaseUrl,
			params.runId,
			parsed.data
		);
		return json({ campaign }, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		const message = error instanceof Error ? error.message : 'The summon could not be recorded.';
		return json({ message }, { status: message.includes('not found') ? 404 : 409 });
	}
};
