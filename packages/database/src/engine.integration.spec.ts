import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { EngineCommandSchema, type EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getEngineReplay
} from './engine.js';
import { createProofRun, markProofArrival } from './proof.js';

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

function engineCommand(
	runId: string,
	actorId: string,
	expectedVersion: number,
	fields: Record<string, unknown>
): EngineCommand {
	const commandId = randomUUID();
	return EngineCommandSchema.parse({
		commandId,
		runId,
		actorId,
		expectedVersion,
		correlationId: commandId,
		source: {
			source: 'manual',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		...fields
	});
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

	run(
		'persists scheduled survival work, progression deltas, cancellation, and game over',
		async () => {
			if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
			const draft = await generateCharacterDraft(recipeFromSeed(`survival-${randomUUID()}`));
			const runId = randomUUID();
			await createProofRun(databaseUrl, {
				runId,
				draft,
				controlMode: 'autonomous',
				directive: 'Train and preserve useful equipment.',
				firstObservation: FIRST_OBSERVATION,
				choice: {
					destination: 'training-ground',
					source: 'scripted',
					firstLine: 'I will learn what this body can do.',
					storyBranch: 'steel-before-trust',
					score: { kitchen: 0, trainingGround: 1 }
				}
			});
			await markProofArrival(databaseUrl, runId);
			let replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 4) {
				throw new Error('Expected a version-four engine replay');
			}
			const heroId = draft.manifest.characterId;
			const masterId = replay.snapshot.state.master.masterId;
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, replay.snapshot.state.version, {
					commandType: 'settlement.assign.hero',
					heroId,
					buildingId: 'training-ground',
					role: 'trainee'
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 4) throw new Error('Expected replay');
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, replay.snapshot.state.version, {
					commandType: 'settlement.allocate.power',
					buildingId: 'workshop'
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 4) throw new Error('Expected replay');
			expect(
				replay.snapshot.state.settlement.buildings['training-ground']?.assignedHeroIds
			).toEqual([heroId]);
			expect(replay.snapshot.state.settlement.navigation.activeSystemIds).toContain('forge-system');

			const training = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.start.activity',
					activity: 'train'
				})
			);
			expect(training.scheduled).toHaveLength(1);
			replay = await getEngineReplay(databaseUrl, runId);
			expect(
				replay?.scheduledEvents.find(
					(scheduled) => scheduled.eventKind === 'hero.activity.complete'
				)?.status
			).toBe('pending');
			const trainingDue = training.scheduled[0]?.dueGameTime;
			if (!trainingDue) throw new Error('Expected a scheduled training outcome');

			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, training.snapshot.state.version, {
					commandType: 'simulation.advance',
					targetGameTime: trainingDue
				})
			);
			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 4) throw new Error('Expected replay');
			expect(
				replay.scheduledEvents.find(
					(scheduled) => scheduled.scheduledEventId === training.scheduled[0]?.scheduledEventId
				)?.status
			).toBe('resolved');
			expect(replay.snapshot.state.heroes[heroId]?.progression.experience).toBe(8);
			expect(
				replay.journalEntries.some((entry) =>
					entry.deltas.some(
						(delta) => delta.kind === 'experience' && delta.key === 'hero' && delta.delta === 8
					)
				)
			).toBe(true);

			const repair = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.start.activity',
					activity: 'repair'
				})
			);
			expect(repair.snapshot.state.schemaVersion).toBe(4);
			if (repair.snapshot.state.schemaVersion !== 4) throw new Error('Expected survival state');
			expect(repair.snapshot.state.settlement.resources['iron-ore']).toBe(1);
			const repairDue = repair.scheduled[0]?.dueGameTime;
			if (!repairDue) throw new Error('Expected a scheduled repair outcome');
			await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, repair.snapshot.state.version, {
					commandType: 'simulation.advance',
					targetGameTime: repairDue
				})
			);

			replay = await getEngineReplay(databaseUrl, runId);
			if (!replay || replay.snapshot.state.schemaVersion !== 4) throw new Error('Expected replay');
			const rest = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, heroId, replay.snapshot.state.version, {
					commandType: 'hero.start.activity',
					activity: 'rest'
				})
			);
			const killed = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, rest.snapshot.state.version, {
					commandType: 'simulation.apply.damage',
					targetId: heroId,
					amount: 100,
					damageKind: 'hazard'
				})
			);
			expect(killed.canceledScheduledEventIds).toEqual([rest.scheduled[0]?.scheduledEventId]);
			replay = await getEngineReplay(databaseUrl, runId);
			expect(replay?.scheduledEvents.at(-1)?.status).toBe('canceled');
			expect(replay?.legalActionsByActor[heroId]).toEqual([]);

			const ended = await commitEngineCommand(
				databaseUrl,
				engineCommand(runId, masterId, killed.snapshot.state.version, {
					commandType: 'simulation.apply.damage',
					targetId: masterId,
					amount: 100,
					damageKind: 'hazard'
				})
			);
			expect(ended.snapshot.state.status).toBe('game_over');
			replay = await getEngineReplay(databaseUrl, runId);
			expect(replay?.verified).toBe(true);
			expect(replay?.legalActions).toEqual([]);
		}
	);
});
