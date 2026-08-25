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
				: `story-patch-${runId}`;
		const [routeHolder, countervoice] = await Promise.all([
			generateCharacterDraft(recipeFromSeed(`${seed}:route-holder`)),
			generateCharacterDraft(recipeFromSeed(`${seed}:countervoice`))
		]);
		await createProofRun(config.databaseUrl, {
			runId,
			draft: routeHolder,
			controlMode: 'wait',
			directive: 'Preserve authored truth. Let living summons decide how it is expressed.',
			firstObservation:
				'The Needle Bridge separates two relays. A scorched route schematic survives in one summon’s memory.',
			choice: null,
			clockSpeed: config.simulationSpeed,
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-04',
				availableMissionIds: ['tower-floor-04'],
				enableStoryPatch: true,
				foundryRouteMemoryHeroId: routeHolder.manifest.characterId,
				additionalHeroes: [
					{
						heroId: countervoice.manifest.characterId,
						manifestHash: countervoice.manifestHash,
						rarityStars: 1,
						mind: countervoice.mind
					}
				]
			}
		});
		return json(
			{
				runId,
				heroes: [
					{
						heroId: routeHolder.manifest.characterId,
						displayName: routeHolder.manifest.displayName
					},
					{
						heroId: countervoice.manifest.characterId,
						displayName: countervoice.manifest.displayName
					}
				]
			},
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				message:
					'The runtime story checkpoint could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
