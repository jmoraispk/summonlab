import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { ExplorationFloorDefinitionSchema } from '@summonlab/contracts/exploration';
import { createExplorationAttempt, stepExploration } from '@summonlab/engine/exploration';
import { describe, expect, it } from 'vitest';

import {
	beginExplorationEncounter,
	commitExplorationMove,
	extractExplorationAttempt,
	getExplorationAttempt,
	settleExplorationEncounter,
	startExplorationAttempt
} from './exploration.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

const floor = ExplorationFloorDefinitionSchema.parse({
	schemaVersion: 'exploration-floor-v1',
	floorId: 'tower-floor-01',
	floorNumber: 1,
	displayName: 'The Unlit Muster',
	contentVersion: 'tower-floor-01-exploration-v1',
	contentHash: 'f'.repeat(64),
	columns: 1,
	rows: 3,
	chunkSize: 16,
	entryTileId: 'f001-r002-c000',
	objectiveTileId: 'f001-r000-c000',
	tiles: [
		{
			tileId: 'f001-r000-c000',
			chunkId: 'f001-k-r000-c000',
			row: 0,
			column: 0,
			zoneId: 'chain-court',
			zoneLabel: 'Chain Court',
			terrain: 'court',
			walkable: true,
			interaction: { kind: 'encounter', dutySlotId: 'goblin-chain-watch' }
		},
		{
			tileId: 'f001-r001-c000',
			chunkId: 'f001-k-r000-c000',
			row: 1,
			column: 0,
			zoneId: 'oath-hall',
			zoneLabel: 'Oath Hall',
			terrain: 'hall',
			walkable: true,
			interaction: null
		},
		{
			tileId: 'f001-r002-c000',
			chunkId: 'f001-k-r000-c000',
			row: 2,
			column: 0,
			zoneId: 'tower-threshold',
			zoneLabel: 'Tower Threshold',
			terrain: 'threshold',
			walkable: true,
			interaction: { kind: 'entry-extraction' }
		}
	],
	encounterWeights: [{ dutySlotId: 'goblin-chain-watch', weight: 1 }]
});

async function createParentRun(testDatabaseUrl: string) {
	const draft = await generateCharacterDraft(recipeFromSeed(`exploration-${randomUUID()}`));
	const runId = randomUUID();
	await createProofRun(testDatabaseUrl, {
		runId,
		draft,
		controlMode: 'wait',
		directive: 'Enter the first floor.',
		firstObservation: FIRST_OBSERVATION,
		choice: null
	});
	return { runId, heroId: draft.manifest.characterId };
}

describe('exploration persistence', () => {
	run('persists one optimistic attempt and reloads exact movement state', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const parent = await createParentRun(databaseUrl);
		const initial = {
			...createExplorationAttempt(floor, {
				attemptId: randomUUID(),
				runId: parent.runId,
				partyHeroIds: [parent.heroId],
				leaderHeroId: parent.heroId
			}),
			objectiveComplete: true
		};

		const [first, retry] = await Promise.all([
			startExplorationAttempt(databaseUrl, initial),
			startExplorationAttempt(databaseUrl, initial)
		]);
		expect(first.state).toEqual(retry.state);

		const moved = stepExploration(floor, initial, 'f001-r001-c000');
		await expect(
			commitExplorationMove(databaseUrl, {
				attemptId: initial.attemptId,
				expectedVersion: 9,
				nextState: moved
			})
		).rejects.toThrow(/version/i);
		const committed = await commitExplorationMove(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 0,
			nextState: moved
		});
		expect(committed.state).toEqual(moved);
		expect((await getExplorationAttempt(databaseUrl, initial.attemptId))?.state).toEqual(moved);
	});

	run('binds one encounter, settles idempotently, and preserves the exact tile', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const parent = await createParentRun(databaseUrl);
		const initial = {
			...createExplorationAttempt(floor, {
				attemptId: randomUUID(),
				runId: parent.runId,
				partyHeroIds: [parent.heroId],
				leaderHeroId: parent.heroId
			}),
			positionTileId: 'f001-r000-c000'
		};
		await startExplorationAttempt(databaseUrl, initial);
		const request = { requestId: randomUUID(), requestHash: 'a'.repeat(64) };
		const active = await beginExplorationEncounter(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 0,
			request
		});
		expect(active).toMatchObject({
			state: { status: 'encounter', positionTileId: initial.positionTileId, version: 1 },
			activeEncounter: request
		});
		await expect(
			beginExplorationEncounter(databaseUrl, {
				attemptId: initial.attemptId,
				expectedVersion: 1,
				request: { requestId: randomUUID(), requestHash: 'b'.repeat(64) }
			})
		).rejects.toThrow(/active encounter/i);

		const receipt = {
			receiptId: randomUUID(),
			requestId: request.requestId,
			receiptHash: 'c'.repeat(64),
			outcome: 'victory' as const
		};
		const settled = await settleExplorationEncounter(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 1,
			receipt
		});
		expect(settled).toMatchObject({
			state: { status: 'exploring', positionTileId: initial.positionTileId, version: 2 },
			activeEncounter: null,
			receipts: [receipt]
		});
		expect(
			await settleExplorationEncounter(databaseUrl, {
				attemptId: initial.attemptId,
				expectedVersion: 1,
				receipt
			})
		).toEqual(settled);
	});

	run('records defeat or extraction as terminal attempt states', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const parent = await createParentRun(databaseUrl);
		const initial = {
			...createExplorationAttempt(floor, {
				attemptId: randomUUID(),
				runId: parent.runId,
				partyHeroIds: [parent.heroId],
				leaderHeroId: parent.heroId
			}),
			objectiveComplete: true
		};
		await startExplorationAttempt(databaseUrl, initial);
		const extracted = await extractExplorationAttempt(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 0
		});
		expect(extracted.state).toMatchObject({ status: 'extracted', version: 1 });

		const second = { ...initial, attemptId: randomUUID() };
		await startExplorationAttempt(databaseUrl, second);
		const request = { requestId: randomUUID(), requestHash: 'd'.repeat(64) };
		await beginExplorationEncounter(databaseUrl, {
			attemptId: second.attemptId,
			expectedVersion: 0,
			request
		});
		const defeated = await settleExplorationEncounter(databaseUrl, {
			attemptId: second.attemptId,
			expectedVersion: 1,
			receipt: {
				receiptId: randomUUID(),
				requestId: request.requestId,
				receiptHash: 'e'.repeat(64),
				outcome: 'defeat'
			}
		});
		expect(defeated.state.status).toBe('defeated');
	});
});
