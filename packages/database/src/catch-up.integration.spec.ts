import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { addGameMinutes } from '@summonlab/engine';
import postgres from 'postgres';
import { describe, expect, it } from 'vitest';

import { catchUpRun, listDueCatchUpRunIds } from './catch-up.js';
import { getEngineReplay } from './engine.js';
import { createProofRun, markProofArrival } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('accelerated settlement catch-up', () => {
	run('resolves one offline day, coalesces leases, and recovers an expired lease', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`catch-up-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'autonomous',
			directive: 'Build a sustainable routine.',
			firstObservation: FIRST_OBSERVATION,
			choice: {
				destination: 'training-ground',
				source: 'scripted',
				firstLine: 'I will learn the rhythm of this place.',
				storyBranch: 'steel-before-trust',
				score: { kitchen: 0, trainingGround: 1 }
			}
		});
		await markProofArrival(databaseUrl, runId);
		const before = await getEngineReplay(databaseUrl, runId);
		if (!before || before.snapshot.state.schemaVersion !== 5) {
			throw new Error('Expected engine-v5 replay');
		}
		expect(before.clock.speed).toBe(4);
		const wallTime = new Date(
			Date.parse(before.clock.anchorRealTime) + 6 * 60 * 60 * 1_000
		).toISOString();
		const sql = postgres(databaseUrl, { max: 1 });
		try {
			await sql`
				update summonlab_engine_runs set content_version = 'engine-v4' where run_id = ${runId}
			`;
			expect(await listDueCatchUpRunIds(databaseUrl, wallTime)).not.toContain(runId);
			await sql`
				update summonlab_engine_runs set content_version = 'engine-v5' where run_id = ${runId}
			`;
		} finally {
			await sql.end({ timeout: 5 });
		}
		const expectedGameTime = addGameMinutes(before.snapshot.state.simulatedAt, 24 * 60);
		const caughtUp = await catchUpRun(databaseUrl, runId, { wallTime, owner: 'integration' });

		expect(caughtUp).toMatchObject({
			result: 'caught_up',
			toGameTime: expectedGameTime,
			speed: 4,
			schedulesResolved: 4,
			plansCreated: 2,
			routinesStarted: 5,
			truncated: false
		});
		expect(caughtUp.events.some((event) => event.eventType === 'simulation.clock.synced')).toBe(
			true
		);
		const replay = await getEngineReplay(databaseUrl, runId);
		if (!replay || replay.snapshot.state.schemaVersion !== 5) throw new Error('Expected replay');
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state.simulatedAt).toBe(expectedGameTime);
		expect(replay.snapshot.state.heroes[draft.manifest.characterId]?.currentRoutine).not.toBeNull();
		expect(replay.clock).toMatchObject({
			currentGameTime: expectedGameTime,
			leaseStatus: 'idle'
		});

		const repeated = await catchUpRun(databaseUrl, runId, { wallTime, owner: 'repeat' });
		expect(repeated).toMatchObject({ result: 'noop', commandsApplied: 0 });

		let signalAcquired!: () => void;
		let releaseLease!: () => void;
		const acquired = new Promise<void>((resolve) => {
			signalAcquired = resolve;
		});
		const held = new Promise<void>((resolve) => {
			releaseLease = resolve;
		});
		const laterWallTime = new Date(Date.parse(wallTime) + 60_000).toISOString();
		const first = catchUpRun(databaseUrl, runId, {
			wallTime: laterWallTime,
			owner: 'lease-holder',
			afterLeaseAcquired: async () => {
				signalAcquired();
				await held;
			}
		});
		await acquired;
		const concurrent = await catchUpRun(databaseUrl, runId, {
			wallTime: laterWallTime,
			owner: 'lease-contender'
		});
		expect(concurrent.result).toBe('lease_busy');
		releaseLease();
		await first;

		const leaseSql = postgres(databaseUrl, { max: 1 });
		try {
			await leaseSql`
				update summonlab_engine_clocks
				set lease_id = ${randomUUID()}, lease_owner = 'crashed-worker',
					lease_expires_at = ${new Date(Date.parse(laterWallTime) - 1_000).toISOString()}
				where run_id = ${runId}
			`;
		} finally {
			await leaseSql.end({ timeout: 5 });
		}
		const recovered = await catchUpRun(databaseUrl, runId, {
			wallTime: new Date(Date.parse(laterWallTime) + 1_000).toISOString(),
			owner: 'replacement-worker'
		});
		expect(recovered.result).not.toBe('lease_busy');
		expect(recovered.clock.leaseStatus).toBe('idle');
	});
});
