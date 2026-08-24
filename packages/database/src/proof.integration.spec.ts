import { randomUUID } from 'node:crypto';

import {
	FIRST_OBSERVATION,
	chooseFirstDestination,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';
import { describe, expect, it } from 'vitest';

import { getEngineReplay } from './engine.js';
import { createProofRun, getProofRun, markProofArrival, resolveProofDecision } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('summon proof persistence', () => {
	run(
		'persists identity, observation, branch choice, and arrival as an append-only log',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const draft = await generateCharacterDraft(recipeFromSeed(`proof-${randomUUID()}`));
			const runId = randomUUID();
			const created = await createProofRun(databaseUrl, {
				runId,
				draft,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			});

			expect(created.destination).toBeNull();
			expect(created.events.map((event) => event.eventType)).toEqual([
				'hero.summoned',
				'hero.observed'
			]);

			const choice = chooseFirstDestination(
				draft,
				'wait',
				'Please train and prepare for the tower.'
			);
			const decided = await resolveProofDecision(
				databaseUrl,
				runId,
				'Please train and prepare for the tower.',
				choice
			);
			expect(decided?.destination).toBe('training-ground');
			expect(decided?.events).toHaveLength(4);

			const arrived = await markProofArrival(databaseUrl, runId);
			expect(arrived?.arrived).toBe(true);
			expect(arrived?.events.at(-1)?.eventType).toBe('hero.arrived');
			expect((await getProofRun(databaseUrl, runId))?.manifestHash).toBe(draft.manifestHash);

			const replay = await getEngineReplay(databaseUrl, runId);
			expect(replay?.verified).toBe(true);
			expect(replay?.hashMatchesPersistedSnapshot).toBe(true);
			expect(replay?.checks.map((check) => check.eventType)).toEqual([
				'run.initialized',
				'hero.destination.selected',
				'hero.arrived'
			]);
			expect(replay?.snapshot.state.heroes[draft.manifest.characterId]?.location).toBe(
				'training-ground'
			);
		}
	);
});
