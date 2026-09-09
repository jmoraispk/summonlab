import { getConfig } from '@summonlab/config';
import { getEngineSnapshot, getProofRun } from '@summonlab/database';
import { assembleHeroDecisionPacket } from '@summonlab/engine';
import { createHeroDecisionPreview } from '@summonlab/policies';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const databaseUrl = getConfig().databaseUrl;
	const [proof, snapshot] = await Promise.all([
		getProofRun(databaseUrl, params.runId).catch(() => null),
		getEngineSnapshot(databaseUrl, params.runId).catch(() => null)
	]);
	if (!proof || !snapshot) return json({ message: 'Run not found.' }, { status: 404 });
	const heroId = url.searchParams.get('heroId') ?? proof.manifest.characterId;
	if (heroId !== proof.manifest.characterId) {
		return json(
			{ message: 'That hero identity is not available to this run view.' },
			{ status: 404 }
		);
	}
	try {
		const packet = assembleHeroDecisionPacket({
			snapshot,
			manifest: proof.manifest,
			heroId,
			decisionKind: 'settlement-action'
		});
		return json(await createHeroDecisionPreview(packet, `${params.runId}:policy-preview-v1`));
	} catch (error) {
		return json(
			{
				message:
					error instanceof Error ? error.message : 'No current hero decision preview is available.'
			},
			{ status: 409 }
		);
	}
};
