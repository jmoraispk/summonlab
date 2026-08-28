import { getConfig } from '@summonlab/config';
import { error, redirect } from '@sveltejs/kit';

import { campaignExperienceView } from '$lib/server/campaign';
import { runtimePortraitFor } from '$lib/server/runtime-portraits';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const view = await campaignExperienceView(getConfig().databaseUrl, params.runId).catch(
		() => null
	);
	if (!view) error(404, 'This chronicle could not be found. Is the local database running?');
	if (view.campaign.lifecycle !== 'active') error(409, 'This chronicle has been superseded.');
	if (view.campaign.onboardingStep >= 3) redirect(307, `/play/${params.runId}`);
	return {
		view,
		heroPortraits: view.heroes.map((hero) => ({
			manifestHash: hero.draft.manifestHash,
			summon: runtimePortraitFor(hero.draft.manifestHash, hero.draft.manifest.artKey, 'summon'),
			roster: runtimePortraitFor(hero.draft.manifestHash, hero.draft.manifest.artKey, 'roster')
		}))
	};
};
