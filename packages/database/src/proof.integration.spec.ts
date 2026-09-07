import { randomBytes, randomUUID } from 'node:crypto';

import {
	FIRST_OBSERVATION,
	chooseFirstDestination,
	derivePrivateEngineSeed,
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
	it('rejects new v2 rows without private entropy before opening a database connection', async () => {
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-missing-private-entropy-${randomUUID()}`),
			{ capabilityEntropy: 'e'.repeat(64) }
		);
		await expect(
			createProofRun('postgres://unused', {
				runId: randomUUID(),
				draft,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			})
		).rejects.toThrow(/private capability entropy/u);
	});

	run('stores v2 capability data internally and round-trips it by schema version', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const capabilityEntropy = randomBytes(32).toString('hex');
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-capability-${randomUUID()}`),
			{ capabilityEntropy }
		);
		const runId = randomUUID();
		const choice = chooseFirstDestination(draft, 'wait', 'Please train and prepare for the tower.');
		const created = await createProofRun(databaseUrl, {
			runId,
			draft,
			capabilityEntropy,
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
		const privateSql = postgres(databaseUrl, { max: 1 });
		try {
			const rows = await privateSql<{ capability_entropy: string | null }[]>`
				select capability_entropy from summonlab_proof_runs where run_id = ${runId}
			`;
			expect(rows[0]?.capability_entropy).toBe(capabilityEntropy);
			expect(JSON.stringify(created)).not.toContain(capabilityEntropy);
		} finally {
			await privateSql.end({ timeout: 5 });
		}
		const engine = await getEngineSnapshot(databaseUrl, runId);
		if (engine?.state.schemaVersion !== 25) throw new Error('Expected engine-v25 state');
		expect(engine.state.seed).toBe(derivePrivateEngineSeed(draft.recipe, capabilityEntropy));
		expect(engine.state.seed).not.toBe(draft.recipe.seed);
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

	run('rejects a v2 capability profile that does not match its private entropy', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const capabilityEntropy = randomBytes(32).toString('hex');
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-private-audit-${randomUUID()}`),
			{ capabilityEntropy }
		);
		const might = draft.capabilityProfile.attributes.might;
		const mismatched = {
			...draft,
			capabilityProfile: {
				...draft.capabilityProfile,
				attributes: {
					...draft.capabilityProfile.attributes,
					might: might === 100 ? 99 : might + 1
				}
			}
		};

		await expect(
			createProofRun(databaseUrl, {
				runId: randomUUID(),
				draft: mismatched,
				capabilityEntropy,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			})
		).rejects.toThrow(/does not match its private derivation inputs/u);
	});

	run('rejects non-canonical private entropy at the database boundary', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-private-entropy-shape-${randomUUID()}`),
			{ capabilityEntropy: 'd'.repeat(64) }
		);
		await expect(
			createProofRun(databaseUrl, {
				runId: randomUUID(),
				draft,
				capabilityEntropy: 'A'.repeat(64),
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			})
		).rejects.toThrow(/32 lowercase hexadecimal bytes/u);
	});

	run(
		'keeps legacy v2 rows with null capability entropy readable from persisted profiles',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const capabilityEntropy = randomBytes(32).toString('hex');
			const draft = await generateSummonableCharacterDraft(
				recipeFromSeed(`proof-legacy-null-entropy-${randomUUID()}`),
				{ capabilityEntropy }
			);
			const runId = randomUUID();
			await createProofRun(databaseUrl, {
				runId,
				draft,
				capabilityEntropy,
				controlMode: 'wait',
				directive: '',
				firstObservation: FIRST_OBSERVATION,
				choice: null
			});
			const sql = postgres(databaseUrl, { max: 1 });
			try {
				await sql`
					update summonlab_proof_runs set capability_entropy = null where run_id = ${runId}
				`;
				const rows = await sql<{ capability_entropy: string | null }[]>`
				select capability_entropy from summonlab_proof_runs where run_id = ${runId}
			`;
				expect(rows[0]?.capability_entropy).toBeNull();
			} finally {
				await sql.end({ timeout: 5 });
			}
			const loaded = await getProofRun(databaseUrl, runId);
			expect(loaded).toMatchObject({ runId, capabilityProfile: draft.capabilityProfile });
		}
	);

	run('rejects mismatched character schema versions and capability profiles', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const capabilityEntropy = randomBytes(32).toString('hex');
		const [legacyDraft, v2Draft] = await Promise.all([
			generateCharacterDraft(recipeFromSeed(`proof-legacy-mismatch-${randomUUID()}`)),
			generateSummonableCharacterDraft(recipeFromSeed(`proof-v2-mismatch-${randomUUID()}`), {
				capabilityEntropy
			})
		]);
		const legacyRunId = randomUUID();
		const v2RunId = randomUUID();
		await createProofRun(databaseUrl, {
			runId: legacyRunId,
			draft: legacyDraft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		await createProofRun(databaseUrl, {
			runId: v2RunId,
			draft: v2Draft,
			capabilityEntropy,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
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
		const capabilityEntropy = randomBytes(32).toString('hex');
		const draft = await generateSummonableCharacterDraft(
			recipeFromSeed(`proof-malformed-${randomUUID()}`),
			{ capabilityEntropy }
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
				capabilityEntropy,
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
