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

import { getEngineReplay, getEngineSnapshot } from './engine.js';
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
		const choice = chooseFirstDestination(draft, 'wait', 'Please train and prepare for the tower.');
		const created = await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice
		});

		if (!('characterSchemaVersion' in created)) throw new Error('Expected a v2 proof snapshot');
		expect(created.characterSchemaVersion).toBe('character-v2');
		expect(created.mind).not.toHaveProperty('aptitudes');
		expect(created.capabilityProfile).toEqual(draft.capabilityProfile);
		expect(await getProofRun(databaseUrl, runId)).toEqual(created);
		const engine = await getEngineSnapshot(databaseUrl, runId);
		if (engine?.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(engine.state).toMatchObject({
			schemaVersion: 25,
			contentVersion: 'engine-v25',
			heroes: {
				[draft.manifest.characterId]: {
					mind: draft.mind,
					capabilityProfile: draft.capabilityProfile
				}
			}
		});
		expect(engine.state.heroes[draft.manifest.characterId]?.mind).not.toHaveProperty('aptitudes');
		await markProofArrival(databaseUrl, runId);
		const arrived = await getEngineSnapshot(databaseUrl, runId);
		if (arrived?.state.schemaVersion !== 25) throw new Error('Expected arrived engine-v25 state');
		expect(arrived.state.heroes[draft.manifest.characterId]).toMatchObject({
			location: choice.destination,
			capabilityProfile: draft.capabilityProfile
		});
	});

	run('rejects mismatched character schema versions and capability profiles', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const [legacyDraft, v2Draft] = await Promise.all([
			generateCharacterDraft(recipeFromSeed(`proof-legacy-mismatch-${randomUUID()}`)),
			generateSummonableCharacterDraft(recipeFromSeed(`proof-v2-mismatch-${randomUUID()}`))
		]);
		const legacyRunId = randomUUID();
		const v2RunId = randomUUID();
		for (const [runId, draft] of [
			[legacyRunId, legacyDraft],
			[v2RunId, v2Draft]
		] as const) {
			await createProofRun(databaseUrl, {
				runId,
				draft,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			});
		}
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`
				update summonlab_proof_runs
				set capability_profile = ${sql.json(v2Draft.capabilityProfile)}
				where run_id = ${legacyRunId}
			`;
			await sql`
				update summonlab_proof_runs
				set capability_profile = null
				where run_id = ${v2RunId}
			`;
		} finally {
			await sql.end({ timeout: 5 });
		}

		const results = await Promise.allSettled([
			getProofRun(databaseUrl, legacyRunId),
			getProofRun(databaseUrl, v2RunId)
		]);
		expect(results.map((result) => result.status)).toEqual(['rejected', 'rejected']);
	});

	run('rejects malformed v2 drafts before writing proof or engine rows', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-malformed-${randomUUID()}`)
		);
		const runId = randomUUID();
		const malformedDraft = {
			...draft,
			capabilityProfile: { ...draft.capabilityProfile, unexpected: true }
		};

		await expect(
			createProofRun(databaseUrl, {
				runId,
				draft: malformedDraft as typeof draft,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			})
		).rejects.toThrow();

		const sql = postgres(databaseUrl, { max: 1 });
		try {
			const [proofRows, engineRows] = await Promise.all([
				sql`select run_id from summonlab_proof_runs where run_id = ${runId}`,
				sql`select run_id from summonlab_engine_runs where run_id = ${runId}`
			]);
			expect(proofRows).toHaveLength(0);
			expect(engineRows).toHaveLength(0);
		} finally {
			await sql.end({ timeout: 5 });
		}
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
