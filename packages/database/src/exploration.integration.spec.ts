import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { ExplorationEncounterRequestSchema } from '@summonlab/contracts';
import { ExplorationFloorDefinitionSchema } from '@summonlab/contracts/exploration';
import {
	applyExplorationTravel,
	createExplorationAttempt,
	stepExploration
} from '@summonlab/engine/exploration';
import { describe, expect, it } from 'vitest';

import {
	beginExplorationEncounter,
	commitExplorationMove,
	commitExplorationTravel,
	extractExplorationAttempt,
	getExplorationAttempt,
	settleExplorationEncounter,
	startExplorationAttempt
} from './exploration.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;
const hash = 'a'.repeat(64);
const alternateHash = 'b'.repeat(64);

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

function encounterRequest(input: { runId: string; attemptId: string; requestId?: string }) {
	return ExplorationEncounterRequestSchema.parse({
		schemaVersion: 'exploration-encounter-request-v1',
		requestId: input.requestId ?? randomUUID(),
		idempotencyKey: 'tower-floor-encounter',
		runId: input.runId,
		correlationId: randomUUID(),
		encounterId: 'tower-floor-encounter',
		explorationAttemptId: input.attemptId,
		observedGameTime: '2026-09-14T12:00:00.000Z',
		expectedExplorationStateHash: hash,
		rulesetVersion: 'combat-rules-v1',
		contentBindings: [
			{ kind: 'ruleset', contentId: 'combat-rules', version: 'v1', contentHash: hash },
			{ kind: 'enemy', contentId: 'tower-goblin', version: 'v1', contentHash: alternateHash },
			{ kind: 'claim-policy', contentId: 'tower-claims', version: 'v1', contentHash: hash }
		],
		seed: 'tower-floor-seed',
		entropyCursor: 0,
		visualStatus: 'production',
		party: [
			{
				heroRef: {
					heroId: 'hero-one',
					characterManifestHash: hash,
					lifeState: 'combat-capable',
					availabilityRevision: 0,
					rulesetVersion: 'combat-rules-v1'
				},
				displayName: 'Hero One',
				resources: { health: 100, maximumHealth: 100, mana: 10, maximumMana: 10 },
				capability: {
					capabilitySnapshotHash: hash,
					loadoutHash: alternateHash,
					actionDefinitionRefs: ['hero-strike'],
					combatRole: 'brawler'
				},
				combatProfile: {
					movementUnitsPerSecond: 2,
					attackRange: 1,
					attackPower: 12,
					armor: 2,
					attackIntervalTicks: 30
				},
				deployment: { x: 0.2, y: 0.7 },
				presentation: {
					combatAssetBinding: {
						assetKey: 'hero-one-combat',
						source: '/runtime/heroes/hero-one.webp',
						contentHash: hash,
						approvalStatus: 'approved',
						approvalId: 'hero-one-approved'
					},
					motionPackBinding: null,
					visualTuning: {
						bodyOffsetY: 0,
						shadowRadiusX: 24,
						shadowRadiusY: 10,
						displaySize: 96
					}
				}
			}
		],
		enemies: [
			{
				enemyInstanceId: 'enemy-one',
				displayName: 'Tower Goblin',
				definitionRef: {
					enemyDefinitionId: 'tower-goblin',
					definitionVersion: 'v1',
					contentHash: alternateHash
				},
				resources: { health: 30, maximumHealth: 30, mana: 0, maximumMana: 0 },
				combatRole: 'swarm',
				actionDefinitionRefs: ['goblin-strike'],
				combatProfile: {
					movementUnitsPerSecond: 2,
					attackRange: 1,
					attackPower: 4,
					armor: 0,
					attackIntervalTicks: 45
				},
				deployment: { x: 0.8, y: 0.3 },
				requiredForVictory: true,
				presentation: {
					combatAssetBinding: {
						assetKey: 'enemy-one-combat',
						source: '/runtime/enemies/enemy-one.webp',
						contentHash: alternateHash,
						approvalStatus: 'approved',
						approvalId: 'enemy-one-approved'
					},
					motionPackBinding: null,
					visualTuning: {
						bodyOffsetY: 0,
						shadowRadiusX: 20,
						shadowRadiusY: 8,
						displaySize: 84
					}
				}
			}
		],
		battlefieldBinding: {
			battlefieldId: 'ruined-threshold',
			version: 'v1',
			contentHash: hash,
			environmentAssetBinding: {
				assetKey: 'ruined-threshold',
				source: '/runtime/combat/ruined-threshold.webp',
				contentHash: hash,
				approvalStatus: 'approved',
				approvalId: 'ruined-threshold-approved'
			},
			occluderAssetBindings: []
		},
		bounds: { maximumCombatants: 2, maximumSimulationTicks: 3600, maximumTraceEvents: 500 },
		requestHash: alternateHash
	});
}

describe('exploration persistence', () => {
	run('commits a multi-step route atomically', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const parent = await createParentRun(databaseUrl);
		const initial = createExplorationAttempt(floor, {
			attemptId: randomUUID(),
			runId: parent.runId,
			partyHeroIds: [parent.heroId],
			leaderHeroId: parent.heroId
		});
		await startExplorationAttempt(databaseUrl, initial);
		const pathTileIds = ['f001-r001-c000', 'f001-r000-c000'];
		const next = applyExplorationTravel(floor, initial, pathTileIds);

		const persisted = await commitExplorationTravel(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 0,
			nextState: next,
			pathTileIds
		});

		expect(persisted.state).toEqual(next);
		expect(persisted.state.version).toBe(2);
	});

	run('reloads the exact full active encounter request', async () => {
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
		const request = encounterRequest({ runId: parent.runId, attemptId: initial.attemptId });

		await beginExplorationEncounter(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 0,
			request
		});

		expect((await getExplorationAttempt(databaseUrl, initial.attemptId))?.activeEncounter).toEqual({
			requestId: request.requestId,
			requestHash: request.requestHash,
			request
		});
	});
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
		const request = encounterRequest({ runId: parent.runId, attemptId: initial.attemptId });
		const active = await beginExplorationEncounter(databaseUrl, {
			attemptId: initial.attemptId,
			expectedVersion: 0,
			request
		});
		expect(active).toMatchObject({
			state: { status: 'encounter', positionTileId: initial.positionTileId, version: 1 },
			activeEncounter: {
				requestId: request.requestId,
				requestHash: request.requestHash,
				request
			}
		});
		await expect(
			beginExplorationEncounter(databaseUrl, {
				attemptId: initial.attemptId,
				expectedVersion: 1,
				request: encounterRequest({ runId: parent.runId, attemptId: initial.attemptId })
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
		const request = encounterRequest({ runId: parent.runId, attemptId: second.attemptId });
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
