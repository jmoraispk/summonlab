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
				: `synthesis-${runId}`;
		const drafts = await Promise.all(
			['source', 'recipient', 'witness', 'listener'].map((role) =>
				generateCharacterDraft(recipeFromSeed(`${seed}:${role}`))
			)
		);
		const [source, recipient, witness, listener] = drafts;
		if (!source || !recipient || !witness || !listener) {
			throw new Error('The synthesis cast could not be generated.');
		}
		await createProofRun(config.databaseUrl, {
			runId,
			draft: source,
			controlMode: 'wait',
			directive: 'Treat every summon as a person. Preserve witness-bounded knowledge.',
			firstObservation:
				'Four adult summons stand beneath the sealed synthesis lens at the summoning gate.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-01',
				availableMissionIds: ['tower-floor-01'],
				enableSynthesis: true,
				additionalHeroes: [recipient, witness, listener].map((draft) => ({
					heroId: draft.manifest.characterId,
					manifestHash: draft.manifestHash,
					rarityStars: draft.manifest.rarityStars,
					mind: draft.mind
				}))
			}
		});
		return json({ runId }, { status: 201 });
	} catch (error) {
		return json(
			{
				message: 'The synthesis checkpoint could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
