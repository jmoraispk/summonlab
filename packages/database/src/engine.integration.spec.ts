import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { type EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineReplay
} from './engine.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

function inspectionCommand(
	runId: string,
	masterId: string,
	expectedVersion: number,
	commandId = randomUUID()
): EngineCommand {
	return {
		commandId,
		runId,
		actorId: masterId,
		expectedVersion,
		correlationId: commandId,
		source: {
			source: 'manual',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		commandType: 'master.inspect.gate'
	};
}

describe('engine event store', () => {
	run('accepts one concurrent command, rejects stale input, and retries idempotently', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`engine-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const initial = await getEngineReplay(databaseUrl, runId);
		if (!initial) throw new Error('Expected initialized engine replay');
		const masterId = initial.snapshot.state.master.masterId;
		const left = inspectionCommand(runId, masterId, 0);
		const right = inspectionCommand(runId, masterId, 0);
		const results = await Promise.allSettled([
			commitEngineCommand(databaseUrl, left),
			commitEngineCommand(databaseUrl, right)
		]);
		const fulfilled = results.filter((result) => result.status === 'fulfilled');
		const rejected = results.filter((result) => result.status === 'rejected');
		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(StaleRunVersionError);

		const accepted = (
			fulfilled[0] as PromiseFulfilledResult<Awaited<ReturnType<typeof commitEngineCommand>>>
		).value;
		const retryCommand = accepted.events[0]?.commandId === left.commandId ? left : right;
		const retried = await commitEngineCommand(databaseUrl, retryCommand);
		expect(retried.idempotentReplay).toBe(true);
		expect(retried.events[0]?.eventId).toBe(accepted.events[0]?.eventId);
		await expect(
			commitEngineCommand(databaseUrl, { ...retryCommand, expectedVersion: 1 })
		).rejects.toBeInstanceOf(IdempotencyConflictError);

		const replay = await getEngineReplay(databaseUrl, runId);
		expect(replay?.verified).toBe(true);
		expect(replay?.eventCount).toBe(2);
		expect(replay?.snapshot.state.version).toBe(1);
		expect(replay?.snapshot.state.entropyCursor).toBe(1);
	});

	run('coalesces concurrent duplicate delivery without consuming entropy twice', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const draft = await generateCharacterDraft(recipeFromSeed(`duplicate-${randomUUID()}`));
		const runId = randomUUID();
		await createProofRun(databaseUrl, {
			runId,
			draft,
			controlMode: 'wait',
			directive: '',
			firstObservation: FIRST_OBSERVATION,
			choice: null
		});
		const initial = await getEngineReplay(databaseUrl, runId);
		if (!initial) throw new Error('Expected initialized engine replay');
		const command = inspectionCommand(runId, initial.snapshot.state.master.masterId, 0);
		const [left, right] = await Promise.all([
			commitEngineCommand(databaseUrl, command),
			commitEngineCommand(databaseUrl, command)
		]);
		expect([left.idempotentReplay, right.idempotentReplay].sort()).toEqual([false, true]);
		expect(left.events[0]?.eventId).toBe(right.events[0]?.eventId);

		const replay = await getEngineReplay(databaseUrl, runId);
		expect(replay?.eventCount).toBe(2);
		expect(replay?.snapshot.state.entropyCursor).toBe(1);
	});
});
