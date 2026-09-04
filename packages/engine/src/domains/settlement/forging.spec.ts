import {
	EngineGameStateV24Schema,
	type EngineCommand,
	type EngineGameStateV24
} from '@summonlab/contracts';
import { EQUIPMENT_DEFINITION_CATALOG } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical, sha256Hex } from '../../hash.js';
import { applyCatchUpPolicy, nextCatchUpCommand } from '../../catch-up.js';
import { supportsCatchUp } from '../../core/versions.js';
import { applyCommand } from '../../orchestration/apply-command.js';
import { createBootstrapEngine } from '../../orchestration/bootstrap.js';
import { legalActions } from '../../orchestration/legal-actions.js';
import { settlementEventReducer } from './reducer.js';
import { assertMissionPartyReady } from '../mission/lifecycle.js';

const HERO_ID = deterministicUuid('forging-v24-hero');

function forgingState(materialLots: Record<string, number> = { bronze: 2 }): EngineGameStateV24 {
	return EngineGameStateV24Schema.parse(
		createBootstrapEngine({
			runId: deterministicUuid('forging-v24-run'),
			seed: 'forging-v24-seed',
			heroId: HERO_ID,
			manifestHash: sha256Hex('forging-v24-manifest'),
			developmentEquipmentScenario: {
				enabled: true,
				forgeReady: true,
				materialLots
			}
		}).snapshot.state
	);
}

function source(source: 'manual' | 'system' = 'manual') {
	return {
		source,
		timing: source === 'manual' ? ('step' as const) : null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function startCommand(
	state: EngineGameStateV24,
	overrides: Partial<Extract<EngineCommand, { commandType: 'hero.start.forging' }>> = {}
): Extract<EngineCommand, { commandType: 'hero.start.forging' }> {
	return {
		commandId: deterministicUuid('forging-v24-start-command'),
		runId: state.runId,
		actorId: HERO_ID,
		expectedVersion: state.version,
		correlationId: deterministicUuid('forging-v24-start-correlation'),
		source: source(),
		commandType: 'hero.start.forging',
		definitionId: 'equipment-bronze-sword',
		materialId: 'bronze',
		craftsmanship: { label: 'standard', bonus: 0 },
		...overrides
	};
}

describe('Standard Forging', () => {
	it('reserves exactly one matching lot and resolves one deterministic catalog-bound item', () => {
		const state = forgingState();
		expect(state.heroes[HERO_ID]!.locationNodeId).toBe('workshop-forge');
		expect(state.heroes[HERO_ID]!.assignment).toMatchObject({
			buildingId: 'workshop',
			role: 'artisan'
		});
		expect(state.settlement.buildings.workshop).toMatchObject({
			systemId: 'forge-system'
		});
		expect(state.settlement.forgeSystemPower).toBe('powered');
		expect(legalActions(state, HERO_ID).map((candidate) => candidate.actionId)).toContain(
			'hero.forge.equipment-bronze-sword'
		);

		const command = startCommand(state);
		const started = applyCommand(state, command);
		expect(started.events.map((event) => event.eventType)).toEqual(['hero.forging.started']);
		expect(started.scheduled).toHaveLength(1);
		expect(started.state.schemaVersion).toBe(24);
		if (started.state.schemaVersion !== 24) throw new Error('Expected v24 start result');
		expect(started.state.settlement.materialLots.bronze).toBe(1);
		const job = started.state.heroes[HERO_ID]!.currentForging!;
		expect(job).toMatchObject({
			definitionId: 'equipment-bronze-sword',
			materialId: 'bronze',
			catalogContentVersion: EQUIPMENT_DEFINITION_CATALOG.contentVersion,
			catalogContentHash: EQUIPMENT_DEFINITION_CATALOG.contentHash,
			recipe: { craftsmanship: { label: 'standard', bonus: 0 } }
		});
		expect(job.itemId).toBe(deterministicUuid(`${started.events[0]!.eventId}:forged-item`));
		expect(started.scheduled[0]).toMatchObject({
			scheduledEventId: job.scheduledEventId,
			eventKind: 'hero.forging.complete',
			dueGameTime: job.completesAt
		});
		expect(
			EngineGameStateV24Schema.safeParse({
				...started.state,
				heroes: {
					...started.state.heroes,
					[HERO_ID]: {
						...started.state.heroes[HERO_ID]!,
						currentActivity: {
							activityId: deterministicUuid('forging-v24-illegal-activity'),
							scheduledEventId: deterministicUuid('forging-v24-illegal-schedule'),
							kind: 'rest',
							startedAt: started.state.simulatedAt,
							completesAt: job.completesAt
						}
					}
				}
			}).success
		).toBe(false);

		const itemCountBefore = Object.keys(started.state.items).length;
		const completed = applyCommand(started.state, {
			commandId: deterministicUuid('forging-v24-advance-command'),
			runId: started.state.runId,
			actorId: started.state.master.masterId,
			expectedVersion: started.state.version,
			correlationId: deterministicUuid('forging-v24-advance-correlation'),
			source: source('system'),
			commandType: 'simulation.advance',
			targetGameTime: job.completesAt
		});
		expect(completed.resolvedScheduledEventIds).toEqual([job.scheduledEventId]);
		expect(completed.state.schemaVersion).toBe(24);
		if (completed.state.schemaVersion !== 24) throw new Error('Expected v24 completion result');
		expect(completed.state.heroes[HERO_ID]!.currentForging).toBeNull();
		expect(Object.keys(completed.state.items)).toHaveLength(itemCountBefore + 1);
		expect(completed.state.items[job.itemId]).toMatchObject({
			itemId: job.itemId,
			definitionId: 'equipment-bronze-sword',
			ownerId: HERO_ID,
			craftsmanship: { label: 'standard', bonus: 0 },
			finalRank: 'F',
			origin: {
				kind: 'forged',
				forgeEventId: started.events[0]!.eventId,
				crafterId: HERO_ID
			}
		});
		const outcome = (completed.events[0]!.payload as { forgingOutcomes: unknown[] })
			.forgingOutcomes[0] as Record<string, unknown>;
		expect(outcome).toMatchObject({
			item: { itemId: job.itemId },
			definitionId: job.definitionId,
			catalogContentVersion: job.catalogContentVersion,
			catalogContentHash: job.catalogContentHash
		});
	});

	it('surfaces and resolves the scheduled completion through v24 catch-up', () => {
		const state = forgingState({ bronze: 1 });
		const started = applyCommand(state, startCommand(state));
		if (started.state.schemaVersion !== 24) throw new Error('Expected v24 start result');
		const job = started.state.heroes[HERO_ID]!.currentForging!;

		expect(supportsCatchUp(started.state)).toBe(true);
		expect(nextCatchUpCommand(started.state, job.completesAt)).toMatchObject({
			commandType: 'simulation.advance',
			targetGameTime: job.completesAt
		});

		const caughtUp = applyCatchUpPolicy(started.state, job.completesAt);
		expect(caughtUp.resolvedScheduledEventIds).toEqual([job.scheduledEventId]);
		expect(caughtUp.commands.map((command) => command.commandType)).toEqual(['simulation.advance']);
		expect(caughtUp.events.map((event) => event.eventType)).toEqual(['simulation.advanced']);
		expect(caughtUp.truncated).toBe(false);
		expect(caughtUp.state.schemaVersion).toBe(24);
		if (caughtUp.state.schemaVersion !== 24) throw new Error('Expected v24 catch-up result');
		expect(caughtUp.state.heroes[HERO_ID]!.currentForging).toBeNull();
		expect(caughtUp.state.heroes[HERO_ID]!.dailyPlan).toBeNull();
		expect(caughtUp.state.heroes[HERO_ID]!.currentRoutine).toBeNull();
		expect(caughtUp.state.items[job.itemId]).toMatchObject({
			itemId: job.itemId,
			definitionId: job.definitionId,
			ownerId: HERO_ID
		});
	});

	it.each([
		[
			'wrong location',
			(state: EngineGameStateV24) => ({
				state: EngineGameStateV24Schema.parse({
					...state,
					heroes: {
						...state.heroes,
						[HERO_ID]: {
							...state.heroes[HERO_ID]!,
							location: 'training-ground',
							locationNodeId: 'training-ring'
						}
					}
				})
			})
		],
		[
			'dormant forge',
			(state: EngineGameStateV24) => ({
				state: EngineGameStateV24Schema.parse({
					...state,
					settlement: {
						...state.settlement,
						forgeSystemPower: 'dormant'
					}
				})
			})
		],
		[
			'missing assignment permission',
			(state: EngineGameStateV24) => ({
				state: EngineGameStateV24Schema.parse({
					...state,
					heroes: {
						...state.heroes,
						[HERO_ID]: { ...state.heroes[HERO_ID]!, assignment: null }
					},
					settlement: {
						...state.settlement,
						buildings: {
							...state.settlement.buildings,
							workshop: {
								...state.settlement.buildings.workshop!,
								assignedHeroIds: []
							}
						}
					}
				})
			})
		],
		[
			'missing lot',
			(state: EngineGameStateV24) => ({
				state: EngineGameStateV24Schema.parse({
					...state,
					settlement: {
						...state.settlement,
						materialLots: { ...state.settlement.materialLots, bronze: 0 }
					}
				})
			})
		],
		[
			'mismatched lot',
			(state: EngineGameStateV24) => ({
				state,
				command: { materialId: 'ash' as const }
			})
		],
		[
			'unknown definition',
			(state: EngineGameStateV24) => ({
				state,
				command: { definitionId: 'equipment-bronze-unknown' }
			})
		],
		[
			'Fine craftsmanship',
			(state: EngineGameStateV24) => ({
				state,
				command: { craftsmanship: { label: 'fine' as const, bonus: 1 as const } }
			})
		],
		[
			'Masterwork craftsmanship',
			(state: EngineGameStateV24) => ({
				state,
				command: { craftsmanship: { label: 'masterwork' as const, bonus: 2 as const } }
			})
		]
	])('rejects %s without consuming or creating anything', (_label, arrange) => {
		const original = forgingState({ bronze: 2, ash: 1 });
		const arranged = arrange(original) as {
			state: EngineGameStateV24;
			command?: Partial<Extract<EngineCommand, { commandType: 'hero.start.forging' }>>;
		};
		const before = hashCanonical(arranged.state);
		expect(() =>
			applyCommand(arranged.state, startCommand(arranged.state, arranged.command))
		).toThrow();
		expect(hashCanonical(arranged.state)).toBe(before);
		expect(arranged.state.settlement.materialLots).toEqual(
			structuredClone(arranged.state.settlement.materialLots)
		);
	});

	it('rejects a duplicate start and a mismatched completion replay without further mutation', () => {
		const base = forgingState();
		const command = startCommand(base);
		const started = applyCommand(base, command);
		if (started.state.schemaVersion !== 24) throw new Error('Expected v24 start result');
		const afterStart = hashCanonical(started.state);
		expect(() => applyCommand(started.state, command)).toThrow();
		expect(hashCanonical(started.state)).toBe(afterStart);
		expect(started.state.settlement.materialLots.bronze).toBe(1);

		const job = started.state.heroes[HERO_ID]!.currentForging!;
		const completion = applyCommand(started.state, {
			commandId: deterministicUuid('forging-v24-replay-advance'),
			runId: started.state.runId,
			actorId: started.state.master.masterId,
			expectedVersion: started.state.version,
			correlationId: deterministicUuid('forging-v24-replay-correlation'),
			source: source('system'),
			commandType: 'simulation.advance',
			targetGameTime: job.completesAt
		});
		const event = completion.events[0]!;
		const payload = structuredClone(event.payload) as {
			forgingOutcomes: Array<{ item: { durability: number } }>;
		};
		payload.forgingOutcomes[0]!.item.durability -= 1;
		expect(() => settlementEventReducer.reduce(started.state, { ...event, payload })).toThrow(
			ReplayIntegrityError
		);
		expect(hashCanonical(started.state)).toBe(afterStart);
	});

	it('keeps a hero with a reserved forging job out of mission readiness', () => {
		const started = applyCommand(forgingState(), startCommand(forgingState()));
		if (started.state.schemaVersion !== 24) throw new Error('Expected v24 start result');
		const hero = started.state.heroes[HERO_ID]!;
		const waitingAtGate = EngineGameStateV24Schema.parse({
			...started.state,
			heroes: {
				...started.state.heroes,
				[HERO_ID]: {
					...hero,
					location: 'summoning-gate',
					locationNodeId: 'gate-dais',
					assignment: null
				}
			},
			settlement: {
				...started.state.settlement,
				buildings: {
					...started.state.settlement.buildings,
					workshop: {
						...started.state.settlement.buildings.workshop!,
						assignedHeroIds: []
					}
				}
			}
		});
		expect(() => assertMissionPartyReady(waitingAtGate, [HERO_ID])).toThrow('mission.party');
	});

	it('cancels a forging schedule and clears the job when its hero dies', () => {
		const started = applyCommand(forgingState(), startCommand(forgingState()));
		if (started.state.schemaVersion !== 24) throw new Error('Expected v24 start result');
		const job = started.state.heroes[HERO_ID]!.currentForging!;
		const died = applyCommand(started.state, {
			commandId: deterministicUuid('forging-v24-fatal-command'),
			runId: started.state.runId,
			actorId: started.state.master.masterId,
			expectedVersion: started.state.version,
			correlationId: deterministicUuid('forging-v24-fatal-correlation'),
			source: source(),
			commandType: 'simulation.apply.damage',
			targetId: HERO_ID,
			amount: 100,
			damageKind: 'hazard'
		});
		expect(died.canceledScheduledEventIds).toContain(job.scheduledEventId);
		expect(died.state.schemaVersion).toBe(24);
		if (died.state.schemaVersion !== 24) throw new Error('Expected v24 damage result');
		expect(died.state.heroes[HERO_ID]!.currentForging).toBeNull();
	});
});
