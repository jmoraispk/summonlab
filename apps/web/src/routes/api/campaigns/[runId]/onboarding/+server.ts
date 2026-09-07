import { getConfig } from '@summonlab/config';
import { CampaignOnboardingRequestSchema } from '@summonlab/contracts';
import { advanceCampaignOnboarding } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectCampaignRunForPublic } from '$lib/server/campaign';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = CampaignOnboardingRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ message: 'Onboarding step is invalid.' }, { status: 400 });
	try {
		return json(
			projectCampaignRunForPublic(
				await advanceCampaignOnboarding(getConfig().databaseUrl, params.runId, parsed.data.step)
			)
		);
	} catch (error) {
		console.error('Campaign onboarding failed', error);
		return json({ message: 'Onboarding could not advance.' }, { status: 409 });
	}
};
