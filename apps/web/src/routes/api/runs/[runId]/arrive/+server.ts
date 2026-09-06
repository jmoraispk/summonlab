import { getConfig } from '@summonlab/config';
import { ProofArrivalRequestSchema } from '@summonlab/contracts';
import { markProofArrival } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectProofRunForPublic } from '$lib/server/proof-presentation';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = ProofArrivalRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ message: 'Invalid arrival request.' }, { status: 400 });
	try {
		const snapshot = await markProofArrival(getConfig().databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Summon run not found.' }, { status: 404 });
		return json(projectProofRunForPublic(snapshot));
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Arrival could not be recorded.' },
			{ status: 500 }
		);
	}
};
