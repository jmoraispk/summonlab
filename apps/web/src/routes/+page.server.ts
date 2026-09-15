import { getConfig } from '@summonlab/config';
import { getLatestActiveCampaignRun } from '@summonlab/database';
import { fail, redirect } from '@sveltejs/kit';

import { getOrCreateSingletonVillage } from '$lib/server/singleton-village';

import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const campaign = await getLatestActiveCampaignRun(getConfig().databaseUrl).catch(() => null);
	return {
		hasVillage: campaign !== null
	};
};

export const actions = {
	default: async () => {
		const config = getConfig();
		try {
			await getOrCreateSingletonVillage(config.databaseUrl, config.simulationSpeed);
		} catch (cause) {
			return fail(503, {
				entryError:
					cause instanceof Error ? cause.message : 'The Village gate did not answer. Please retry.'
			});
		}
		redirect(303, '/village');
	}
} satisfies Actions;
