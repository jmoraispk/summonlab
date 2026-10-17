import { randomUUID } from 'node:crypto';

import { generateSummonableCompany } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { createProofRun, getEngineSnapshot } from '@summonlab/database';
import { supportsEquipmentApi } from '@summonlab/engine';
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
				? body.seed.trim().slice(0, 128)
				: `equipment-workshop-${runId}`;
		const [draft, second, third] = await generateSummonableCompany(seed, 3);
		if (!draft || !second || !third) throw new Error('The Equipment company was incomplete.');
		await createProofRun(config.databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation:
				'The forge ledger opens beside one measured Bronze lot and an already powered assay plate.',
			choice: null,
			clockSpeed: 8,
			additionalHeroes: [second, third].map((hero) => ({
				heroId: hero.manifest.characterId,
				manifestHash: hero.manifestHash,
				rarityStars: hero.manifest.rarityStars,
				mind: hero.mind
			})),
			developmentEquipmentScenario: {
				enabled: true,
				forgeReady: true,
				materialLots: { bronze: 1 }
			}
		});
		const snapshot = await getEngineSnapshot(config.databaseUrl, runId);
		if (!snapshot || !supportsEquipmentApi(snapshot.state)) {
			throw new Error('The Equipment workshop fixture did not create engine-v24 state.');
		}
		return json(
			{ runId, heroId: draft.manifest.characterId, simulatedAt: snapshot.state.simulatedAt },
			{ status: 201 }
		);
	} catch (error) {
		return json(
			{
				message:
					'The Equipment workshop fixture could not be created. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
