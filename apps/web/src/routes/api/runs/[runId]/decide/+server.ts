import { chooseFirstDestination } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import {
	CharacterDraftSchema,
	CharacterDraftV2Schema,
	ProofDecisionRequestSchema
} from '@summonlab/contracts';
import { getProofRun, resolveProofDecision } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectProofRunForPublic } from '$lib/server/proof-presentation';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = ProofDecisionRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return json({ message: 'Invalid decision request.' }, { status: 400 });

	try {
		const snapshot = await getProofRun(getConfig().databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Summon run not found.' }, { status: 404 });
		if (snapshot.destination) return json(projectProofRunForPublic(snapshot));
		if (!['wait', 'countdown'].includes(snapshot.controlMode)) {
			return json({ message: 'This run does not have a pending decision.' }, { status: 409 });
		}
		const directive = parsed.data.directive || snapshot.directive;
		const draft =
			'characterSchemaVersion' in snapshot
				? CharacterDraftV2Schema.parse({
						recipe: snapshot.recipe,
						manifest: snapshot.manifest,
						mind: snapshot.mind,
						capabilityProfile: snapshot.capabilityProfile,
						manifestHash: snapshot.manifestHash
					})
				: CharacterDraftSchema.parse({
						recipe: snapshot.recipe,
						manifest: snapshot.manifest,
						mind: snapshot.mind,
						manifestHash: snapshot.manifestHash
					});
		const choice = chooseFirstDestination(draft, snapshot.controlMode, directive);
		const updated = await resolveProofDecision(
			getConfig().databaseUrl,
			snapshot.runId,
			directive,
			choice
		);
		if (!updated) return json({ message: 'Summon run not found.' }, { status: 404 });
		return json(projectProofRunForPublic(updated));
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The pending decision failed.' },
			{ status: 500 }
		);
	}
};
