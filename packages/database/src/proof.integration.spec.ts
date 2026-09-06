import { randomUUID } from 'node:crypto';

import {
	FIRST_OBSERVATION,
	chooseFirstDestination,
	generateCharacterDraft,
	generateSummonableCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { getEngineReplay } from './engine.js';
import { createProofRun, getProofRun, markProofArrival, resolveProofDecision } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('summon proof persistence', () => {
	run('stores v2 capability data internally and round-trips it by schema version', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-capability-${randomUUID()}`)
		);
		const runId = randomUUID();
		const created = await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});

		if (!('characterSchemaVersion' in created)) throw new Error('Expected a v2 proof snapshot');
		expect(created.characterSchemaVersion).toBe('character-v2');
		expect(created.mind).not.toHaveProperty('aptitudes');
		expect(created.capabilityProfile).toEqual(draft.capabilityProfile);
		expect(await getProofRun(databaseUrl, runId)).toEqual(created);
	});

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

			expect(created).not.toHaveProperty('characterSchemaVersion');
			expect(created).not.toHaveProperty('capabilityProfile');
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
			const sql = postgres(databaseUrl, { max: 1 });
			try {
				const rows = await sql<
					{ capability_profile: unknown | null; character_schema_version: string }[]
				>`
					select capability_profile, character_schema_version
					from summonlab_proof_runs
					where run_id = ${runId}
				`;
				expect(rows[0]).toEqual({
					capability_profile: null,
					character_schema_version: 'character-v1'
				});
			} finally {
				await sql.end({ timeout: 5 });
			}

			const replay = await getEngineReplay(databaseUrl, runId);
			expect(replay?.verified).toBe(true);
			expect(replay?.hashMatchesPersistedSnapshot).toBe(true);
			expect(replay?.checks.map((check) => check.eventType)).toEqual([
				'run.initialized',
				'hero.destination.selected',
				'hero.travel.started',
				'simulation.advanced'
			]);
			expect(replay?.scheduledEvents).toEqual([
				expect.objectContaining({ eventKind: 'hero.travel.arrive', status: 'resolved' })
			]);
			expect(replay?.snapshot.state.schemaVersion).toBe(13);
			expect(replay?.snapshot.state.heroes[draft.manifest.characterId]?.location).toBe(
				'training-ground'
			);
			if (replay?.snapshot.state.schemaVersion !== 13) throw new Error('Expected engine-v13');
			expect(replay.snapshot.state.heroes[draft.manifest.characterId]).toMatchObject({
				locationNodeId: 'training-ring',
				currentTravel: null
			});
		}
	);
});
