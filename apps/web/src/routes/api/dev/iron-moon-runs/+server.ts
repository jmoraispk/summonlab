import { randomUUID } from 'node:crypto';

import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { createProofRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const runId = randomUUID();
		const draft = await generateCharacterDraft(recipeFromSeed(`iron-moon-${runId}`));
		await createProofRun(config.databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation:
				'A silver portal hangs over the settlement gate. Beyond it, an iron moon is already closing.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'iron-moon',
				availableMissionIds: ['iron-moon']
			}
		});
		return json({ runId }, { status: 201 });
	} catch (error) {
		return json(
			{
				message: 'The local Iron Moon run could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
