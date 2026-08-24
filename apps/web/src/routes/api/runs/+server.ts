import { randomUUID } from 'node:crypto';

import {
	FIRST_OBSERVATION,
	chooseFirstDestination,
	generateCharacterDraft
} from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { ProofRunCreateRequestSchema } from '@summonlab/contracts';
import { createProofRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const parsed = ProofRunCreateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'The summoning contract is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}

	try {
		const draft = await generateCharacterDraft(parsed.data.recipe);
		const shouldResolve = ['autonomous', 'random'].includes(parsed.data.controlMode);
		const choice = shouldResolve
			? chooseFirstDestination(draft, parsed.data.controlMode, parsed.data.directive)
			: null;
		const snapshot = await createProofRun(getConfig().databaseUrl, {
			runId: randomUUID(),
			draft,
			controlMode: parsed.data.controlMode,
			directive: parsed.data.directive,
			firstObservation: FIRST_OBSERVATION,
			choice
		});
		return json({ runId: snapshot.runId, manifestHash: snapshot.manifestHash }, { status: 201 });
	} catch (error) {
		return json(
			{
				message: 'The local gate could not persist this summon. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
