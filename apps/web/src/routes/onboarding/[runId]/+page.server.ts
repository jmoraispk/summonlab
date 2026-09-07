import { getConfig } from '@summonlab/config';
import { getCampaignRun } from '@summonlab/database';
import { error, redirect } from '@sveltejs/kit';

import { campaignExperienceView } from '$lib/server/campaign';
import { runtimePortraitFor } from '$lib/server/runtime-portraits';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const databaseUrl = getConfig().databaseUrl;
	const [view, internalCampaign] = await Promise.all([
		campaignExperienceView(databaseUrl, params.runId).catch(() => null),
		getCampaignRun(databaseUrl, params.runId).catch(() => null)
	]);
	if (!view || !internalCampaign)
		error(404, 'This chronicle could not be found. Is the local database running?');
	if (view.campaign.lifecycle !== 'active') error(409, 'This chronicle has been superseded.');
	if (view.campaign.onboardingStep >= 3) redirect(307, `/play/${params.runId}`);
	return {
		view,
		heroPortraits: view.heroes.map((hero) => {
			const internalHero = internalCampaign.heroes.find(
				(candidate) => candidate.draft.manifest.characterId === hero.manifest.characterId
			);
			if (!internalHero) error(500, 'Campaign portrait identity is inconsistent.');
			return {
				publicManifestHash: hero.publicManifestHash,
				summon: runtimePortraitFor(internalHero.draft.manifestHash, hero.manifest.artKey, 'summon'),
				roster: runtimePortraitFor(internalHero.draft.manifestHash, hero.manifest.artKey, 'roster')
			};
		})
	};
};
