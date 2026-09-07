import { getConfig } from '@summonlab/config';
import { json } from '@sveltejs/kit';

import { campaignExperienceView } from '$lib/server/campaign';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const view = await campaignExperienceView(getConfig().databaseUrl, params.runId);
		return view
			? json(view, { headers: { 'cache-control': 'no-store' } })
			: json({ message: 'Campaign run not found.' }, { status: 404 });
	} catch (error) {
		console.error('Campaign view failed', error);
		return json({ message: 'Campaign could not be loaded.' }, { status: 500 });
	}
};
