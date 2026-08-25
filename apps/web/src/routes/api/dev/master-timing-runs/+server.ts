import { randomUUID } from 'node:crypto';

import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { createProofRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const body = (await request.json().catch(() => ({}))) as { seed?: unknown };
		const runId = randomUUID();
		const seed =
			typeof body.seed === 'string' && body.seed.trim()
				? body.seed.trim().slice(0, 256)
				: `master-timing-${runId}`;
		const draft = await generateCharacterDraft(recipeFromSeed(seed));
		await createProofRun(config.databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation:
				'The Tower Threshold waits in absolute silence while four command sigils pulse beneath the Master’s hand.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-01',
				availableMissionIds: ['tower-floor-01'],
				enableMasterTiming: true
			}
		});
		return json({ runId }, { status: 201 });
	} catch (error) {
		return json(
			{
				message:
					'The local Master timing run could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
