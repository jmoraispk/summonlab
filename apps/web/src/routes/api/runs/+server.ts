import { randomBytes, randomUUID } from 'node:crypto';

import {
	FIRST_OBSERVATION,
	chooseFirstDestination,
	generateSummonableCharacterDraft,
	parseCapabilityEntropy
} from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { ProofRunCreateRequestSchema } from '@summonlab/contracts';
import { createProofRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectProofManifestForPublic } from '$lib/server/proof-presentation';

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
		const capabilityEntropy = parseCapabilityEntropy(randomBytes(32).toString('hex'));
		const draft = await generateSummonableCharacterDraft(parsed.data.recipe, {
			capabilityEntropy
		});
		const shouldResolve = ['autonomous', 'random'].includes(parsed.data.controlMode);
		const choice = shouldResolve
			? chooseFirstDestination(draft, parsed.data.controlMode, parsed.data.directive)
			: null;
		const config = getConfig();
		const snapshot = await createProofRun(config.databaseUrl, {
			runId: randomUUID(),
			draft,
			controlMode: parsed.data.controlMode,
			capabilityEntropy,
			directive: parsed.data.directive,
			firstObservation: FIRST_OBSERVATION,
			choice,
			clockSpeed: config.simulationSpeed,
			combatMode: config.combatMode
		});
		return json(
			{
				runId: snapshot.runId,
				publicManifestHash: projectProofManifestForPublic(draft.manifest).publicManifestHash
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error('Summon creation failed', error);
		return json(
			{ message: 'The local gate could not persist this summon. Start PostgreSQL with pnpm dev.' },
			{ status: 503 }
		);
	}
};
