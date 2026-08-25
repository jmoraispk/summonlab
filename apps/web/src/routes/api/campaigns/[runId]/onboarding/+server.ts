import { getConfig } from '@summonlab/config';
import { CampaignOnboardingRequestSchema } from '@summonlab/contracts';
import { advanceCampaignOnboarding } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = CampaignOnboardingRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ message: 'Onboarding step is invalid.' }, { status: 400 });
	try {
		return json(
			await advanceCampaignOnboarding(getConfig().databaseUrl, params.runId, parsed.data.step)
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Onboarding could not advance.' },
			{ status: 409 }
		);
	}
};
