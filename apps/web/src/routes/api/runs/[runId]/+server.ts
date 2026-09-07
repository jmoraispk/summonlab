import { getConfig } from '@summonlab/config';
import { getProofRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectProofRunForPublic } from '$lib/server/proof-presentation';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const snapshot = await getProofRun(getConfig().databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Summon run not found.' }, { status: 404 });
		return json(projectProofRunForPublic(snapshot), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		console.error('Proof run load failed', error);
		return json({ message: 'The proof run could not be loaded.' }, { status: 500 });
	}
};
