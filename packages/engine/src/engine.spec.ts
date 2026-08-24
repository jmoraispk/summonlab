import {
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameStateV1
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	ENGINE_INVARIANTS,
	EMPTY_STATE_HASH,
	IllegalActionError,
	StaleStateVersionError,
	applyCommand,
	createBootstrapEngine,
	createEntropyCursor,
	deterministicUuid,
	drawInteger,
	hashGameState,
	legalActions,
	replayEvents,
	replayEventsStrict,
	sha256Hex
} from './index.js';

function source() {
	return {
		source: 'scripted' as const,
		timing: 'continuous' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function fixture() {
	const runId = deterministicUuid('engine-test-run');
	const heroId = deterministicUuid('engine-test-hero');
	return createBootstrapEngine({
		runId,
		seed: 'engine-test-seed',
		heroId,
		manifestHash: sha256Hex('engine-test-manifest')
	});
}

function commandBase(
	state: ReturnType<typeof fixture>['snapshot']['state'],
	actorId: string,
	key: string
) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: source()
	};
}

function arriveAtTraining() {
	const bootstrap = fixture();
	const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
	const chosen = applyCommand(bootstrap.snapshot.state, {
		...commandBase(bootstrap.snapshot.state, heroId, 'choose-training'),
		commandType: 'hero.choose.destination',
		destination: 'training-ground',
		firstLine: 'Let me test what this body remembers.',
		storyBranch: 'steel-before-trust'
	});
	const traveling = applyCommand(chosen.state, {
		...commandBase(chosen.state, heroId, 'travel-training'),
		commandType: 'hero.start.travel',
		targetNodeId: 'training-ring'
	});
	const arrived = applyCommand(traveling.state, {
		...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-training'),
		commandType: 'simulation.advance',
		targetGameTime: traveling.scheduled[0]!.dueGameTime
	});
	return { bootstrap, chosen, traveling, arrived, heroId };
}

describe('deterministic engine', () => {
	it('keeps external mutation sources outside the engine contract', () => {
		expect(ENGINE_INVARIANTS).toContain('no-model-sdk');
		expect(ENGINE_INVARIANTS).toContain('no-wall-clock');
	});

	it('produces a stable named entropy fixture and advances exactly once', () => {
		const first = drawInteger(createEntropyCursor('fixture-seed'), 'gate.resonance', 0, 99);
		const repeated = drawInteger(createEntropyCursor('fixture-seed'), 'gate.resonance', 0, 99);

		expect(first).toEqual(repeated);
		expect(first.draw).toEqual({
			purpose: 'gate.resonance',
			cursor: 0,
			minimum: 0,
			maximum: 99,
			value: 7
		});
		expect(first.next.cursor).toBe(1);
	});

	it('applies and replays choice, arrival, and entropy-bearing commands byte-for-byte', () => {
		const bootstrap = fixture();
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const runId = bootstrap.snapshot.state.runId;
		const choose: EngineCommand = {
			commandId: deterministicUuid(`${runId}:choose`),
			runId,
			actorId: heroId,
			expectedVersion: 0,
			correlationId: deterministicUuid(`${runId}:choose:correlation`),
			source: source(),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Let me test what this body remembers.',
			storyBranch: 'steel-before-trust'
		};
		const chosen = applyCommand(bootstrap.snapshot.state, choose);
		const traveling = applyCommand(chosen.state, {
			commandId: deterministicUuid(`${runId}:travel`),
			runId,
			actorId: heroId,
			expectedVersion: 1,
			correlationId: deterministicUuid(`${runId}:travel:correlation`),
			source: source(),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		const arrived = applyCommand(traveling.state, {
			commandId: deterministicUuid(`${runId}:arrive`),
			runId,
			actorId: traveling.state.master.masterId,
			expectedVersion: 2,
			correlationId: deterministicUuid(`${runId}:arrive:correlation`),
			source: { ...source(), source: 'system', timing: null },
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		const inspected = applyCommand(arrived.state, {
			commandId: deterministicUuid(`${runId}:inspect`),
			runId,
			actorId: arrived.state.master.masterId,
			expectedVersion: 3,
			correlationId: deterministicUuid(`${runId}:inspect:correlation`),
			source: { ...source(), source: 'manual', timing: 'step' },
			commandType: 'master.inspect.gate'
		});
		const events = [
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...inspected.events
		];
		const replay = replayEventsStrict(events);

		expect(replay.snapshot.state).toEqual(inspected.state);
		expect(replay.snapshot.stateHash).toBe(inspected.stateHash);
		expect(replay.checks.every((check) => check.verified)).toBe(true);
		expect(replay.checks.at(-1)?.entropyDraws).toHaveLength(1);
	});

	it('rejects illegal and stale commands without mutating input state', () => {
		const bootstrap = fixture();
		const before = structuredClone(bootstrap.snapshot.state);
		const heroId = Object.keys(before.heroes)[0]!;
		const base = {
			commandId: deterministicUuid('illegal-command'),
			runId: before.runId,
			actorId: heroId,
			correlationId: deterministicUuid('illegal-correlation'),
			source: source()
		};

		expect(() =>
			applyCommand(before, { ...base, expectedVersion: 1, commandType: 'hero.arrive' })
		).toThrow(StaleStateVersionError);
		expect(() =>
			applyCommand(before, { ...base, expectedVersion: 0, commandType: 'hero.arrive' })
		).toThrow(IllegalActionError);
		expect(before).toEqual(bootstrap.snapshot.state);
	});

	it('schedules a content-bound route and commits location only at authoritative arrival', () => {
		const bootstrap = fixture();
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const chosen = applyCommand(bootstrap.snapshot.state, {
			...commandBase(bootstrap.snapshot.state, heroId, 'choose-kitchen-route'),
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Names first.',
			storyBranch: 'names-before-orders'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, heroId, 'travel-kitchen'),
			commandType: 'hero.start.travel',
			targetNodeId: 'kitchen-table'
		});
		if (traveling.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		const inTransit = traveling.state.heroes[heroId]!;
		expect(inTransit.location).toBe('summoning-gate');
		expect(inTransit.locationNodeId).toBe('gate-dais');
		expect(inTransit.currentTravel).toMatchObject({
			fromNodeId: 'gate-dais',
			toNodeId: 'kitchen-table',
			settlementContentVersion: 'hearth-01-v1',
			settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			route: {
				nodeIds: ['gate-dais', 'gate-court', 'courtyard-heart', 'kitchen-entry', 'kitchen-table'],
				totalTravelGameSeconds: 124
			}
		});
		expect(traveling.scheduled[0]).toMatchObject({
			eventKind: 'hero.travel.arrive',
			dueGameTime: '2000-01-01T00:02:04.000Z'
		});

		expect(() =>
			applyCommand(traveling.state, {
				...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-early'),
				commandType: 'simulation.advance',
				targetGameTime: '2000-01-01T00:02:03.000Z'
			})
		).toThrow(IllegalActionError);

		const arrived = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-on-time'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		if (arrived.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(arrived.state.heroes[heroId]).toMatchObject({
			location: 'kitchen',
			locationNodeId: 'kitchen-table',
			currentTravel: null
		});
		expect(arrived.resolvedScheduledEventIds).toEqual([traveling.scheduled[0]!.scheduledEventId]);
		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events
		]);
		expect(replay.snapshot.stateHash).toBe(arrived.stateHash);

		expect(() =>
			applyCommand(chosen.state, {
				...commandBase(chosen.state, heroId, 'ignore-first-destination'),
				commandType: 'hero.start.travel',
				targetNodeId: 'training-ring'
			})
		).toThrow(IllegalActionError);

		expect(() =>
			applyCommand(arrived.state, {
				...commandBase(arrived.state, heroId, 'travel-locked-forge'),
				commandType: 'hero.start.travel',
				targetNodeId: 'workshop-forge'
			})
		).toThrow(IllegalActionError);

		const died = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'die-in-transit'),
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 100,
			damageKind: 'hazard'
		});
		if (died.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(died.state.heroes[heroId]?.currentTravel).toBeNull();
		expect(died.canceledScheduledEventIds).toEqual([traveling.scheduled[0]!.scheduledEventId]);
	});

	it('detects a tampered replay hash at the exact event', () => {
		const bootstrap = fixture();
		const tampered = { ...bootstrap.event, afterStateHash: sha256Hex('tampered') };
		const replay = replayEvents([tampered]);

		expect(replay.verified).toBe(false);
		expect(replay.checks[0]?.sequence).toBe(1);
	});

	it('keeps immutable engine-v1 streams replayable under their original hash schema', () => {
		const runId = deterministicUuid('legacy-v1-run');
		const heroId = deterministicUuid('legacy-v1-hero');
		const masterId = deterministicUuid(`${runId}:master`);
		const commandId = deterministicUuid(`${runId}:bootstrap`);
		const state: EngineGameStateV1 = {
			schemaVersion: 1,
			runId,
			seed: 'legacy-seed',
			contentVersion: 'engine-v1',
			status: 'active',
			version: 0,
			eventCursor: 1,
			entropyCursor: 0,
			simulatedAt: '2000-01-01T00:00:00.000Z',
			master: {
				masterId,
				lifeState: 'alive',
				location: 'summoning-gate',
				health: 100,
				maxHealth: 100,
				gateInspectionCount: 0,
				lastGateResonance: null
			},
			heroes: {
				[heroId]: {
					heroId,
					lifeState: 'active',
					location: 'summoning-gate',
					destination: null,
					health: 100,
					maxHealth: 100,
					manifestHash: sha256Hex('legacy-manifest')
				}
			},
			story: { envelopeId: 'first-ember-v1', branch: null }
		};
		const bootstrapEvent: AuthoritativeEvent = {
			eventId: deterministicUuid(`${commandId}:1:run.initialized`),
			runId,
			sequence: 1,
			schemaVersion: 1,
			gameTime: state.simulatedAt,
			eventType: 'run.initialized',
			actorId: null,
			commandId,
			causationId: null,
			correlationId: commandId,
			source: { ...source(), source: 'system', timing: null },
			seedCursor: 0,
			beforeStateHash: EMPTY_STATE_HASH,
			afterStateHash: hashGameState(state),
			contentVersion: 'engine-v1',
			payload: { initialState: state, entropyDraws: [] }
		};
		const inspected = applyCommand(state, {
			...commandBase(state, masterId, 'legacy-inspect'),
			commandType: 'master.inspect.gate'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...inspected.events]);

		expect(replay.snapshot.state).toEqual(inspected.state);
		expect(replay.snapshot.state.schemaVersion).toBe(1);
	});

	it('keeps immutable engine-v2 commands and reducer bytes on their original schema', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 4) throw new Error('Expected engine-v4 fixture');
		const modernHero = Object.values(modern.snapshot.state.heroes)[0]!;
		const hero = { ...modernHero } as Record<string, unknown>;
		delete hero.locationNodeId;
		delete hero.firstArrivalCompleted;
		delete hero.currentTravel;
		delete hero.assignment;
		const settlement = { ...modern.snapshot.state.settlement } as Record<string, unknown>;
		delete settlement.navigation;
		delete settlement.poweredBuildingId;
		delete settlement.buildings;
		const state = EngineGameStateV2Schema.parse({
			...modern.snapshot.state,
			schemaVersion: 2,
			contentVersion: 'engine-v2',
			heroes: { [modernHero.heroId]: hero },
			settlement
		});
		const stateHash = hashGameState(state);
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 2,
			contentVersion: 'engine-v2',
			afterStateHash: stateHash,
			payload: { ...modern.event.payload, initialState: state }
		};
		const chosen = applyCommand(state, {
			...commandBase(state, modernHero.heroId, 'v2-choose'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Old steel, old trust.',
			storyBranch: 'steel-before-trust'
		});
		const arrived = applyCommand(chosen.state, {
			...commandBase(chosen.state, modernHero.heroId, 'v2-arrive'),
			commandType: 'hero.arrive'
		});
		const replay = replayEventsStrict([bootstrapEvent, ...chosen.events, ...arrived.events]);
		expect(replay.snapshot.state).toEqual(arrived.state);
		expect(replay.snapshot.state.schemaVersion).toBe(2);
	});

	it('keeps immutable engine-v3 travel streams replayable under their original schema', () => {
		const modern = fixture();
		if (modern.snapshot.state.schemaVersion !== 4) throw new Error('Expected engine-v4 fixture');
		const modernHero = Object.values(modern.snapshot.state.heroes)[0]!;
		const hero = { ...modernHero } as Record<string, unknown>;
		delete hero.assignment;
		const settlement = { ...modern.snapshot.state.settlement } as Record<string, unknown>;
		delete settlement.poweredBuildingId;
		delete settlement.buildings;
		const state = EngineGameStateV3Schema.parse({
			...modern.snapshot.state,
			schemaVersion: 3,
			contentVersion: 'engine-v3',
			heroes: { [modernHero.heroId]: hero },
			settlement
		});
		const bootstrapEvent: AuthoritativeEvent = {
			...modern.event,
			schemaVersion: 3,
			contentVersion: 'engine-v3',
			afterStateHash: hashGameState(state),
			payload: { ...modern.event.payload, initialState: state }
		};
		const chosen = applyCommand(state, {
			...commandBase(state, modernHero.heroId, 'v3-choose'),
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Old routes remain true.',
			storyBranch: 'names-before-orders'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, modernHero.heroId, 'v3-travel'),
			commandType: 'hero.start.travel',
			targetNodeId: 'kitchen-table'
		});
		const arrived = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'v3-arrive'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		const replay = replayEventsStrict([
			bootstrapEvent,
			...chosen.events,
			...traveling.events,
			...arrived.events
		]);
		expect(replay.snapshot.state).toEqual(arrived.state);
		expect(replay.snapshot.state.schemaVersion).toBe(3);
	});

	it('commits facility assignments and reallocates one authoritative power slot', () => {
		const { bootstrap, chosen, traveling, arrived, heroId } = arriveAtTraining();
		const assigned = applyCommand(arrived.state, {
			...commandBase(arrived.state, arrived.state.master.masterId, 'assign-workshop'),
			commandType: 'settlement.assign.hero',
			heroId,
			buildingId: 'workshop',
			role: 'artisan'
		});
		if (assigned.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(assigned.state.heroes[heroId]?.assignment).toMatchObject({
			buildingId: 'workshop',
			nodeId: 'workshop-bench',
			role: 'artisan'
		});
		expect(assigned.state.settlement.buildings.workshop?.assignedHeroIds).toEqual([heroId]);
		const secondHeroId = deterministicUuid('engine-test-second-hero');
		const saturated = EngineGameStateV4Schema.parse({
			...assigned.state,
			heroes: {
				...assigned.state.heroes,
				[secondHeroId]: {
					...assigned.state.heroes[heroId]!,
					heroId: secondHeroId,
					equipment: { mainHand: null },
					assignment: null
				}
			},
			settlement: {
				...assigned.state.settlement,
				buildings: {
					...assigned.state.settlement.buildings,
					workshop: {
						...assigned.state.settlement.buildings.workshop!,
						assignmentCapacity: 1
					}
				}
			}
		});
		expect(
			legalActions(saturated, saturated.master.masterId).some(
				(candidate) => candidate.actionId === `settlement.assign.${secondHeroId}.workshop`
			)
		).toBe(false);
		expect(() =>
			applyCommand(saturated, {
				...commandBase(saturated, saturated.master.masterId, 'overfill-workshop'),
				commandType: 'settlement.assign.hero',
				heroId: secondHeroId,
				buildingId: 'workshop',
				role: 'artisan'
			})
		).toThrow(IllegalActionError);

		const powered = applyCommand(assigned.state, {
			...commandBase(assigned.state, assigned.state.master.masterId, 'power-workshop'),
			commandType: 'settlement.allocate.power',
			buildingId: 'workshop'
		});
		if (powered.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(powered.state.settlement.poweredBuildingId).toBe('workshop');
		expect(powered.state.settlement.buildings.workshop?.powerState).toBe('powered');
		expect(powered.state.settlement.navigation.activeSystemIds).toContain('forge-system');

		const forgeTravel = applyCommand(powered.state, {
			...commandBase(powered.state, heroId, 'travel-powered-forge'),
			commandType: 'hero.start.travel',
			targetNodeId: 'workshop-forge'
		});
		expect(forgeTravel.scheduled[0]).toMatchObject({ eventKind: 'hero.travel.arrive' });
		const reallocated = applyCommand(forgeTravel.state, {
			...commandBase(forgeTravel.state, forgeTravel.state.master.masterId, 'power-kitchen'),
			commandType: 'settlement.allocate.power',
			buildingId: 'kitchen'
		});
		if (reallocated.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(reallocated.state.settlement.buildings.kitchen?.powerState).toBe('powered');
		expect(reallocated.state.settlement.buildings.workshop?.powerState).toBe('unpowered');
		expect(reallocated.state.settlement.navigation.activeSystemIds).not.toContain('forge-system');

		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...assigned.events,
			...powered.events,
			...forgeTravel.events,
			...reallocated.events
		]);
		expect(replay.snapshot.stateHash).toBe(reallocated.stateHash);
	});

	it('schedules training, advances an injected clock, and projects progression exactly', () => {
		const { bootstrap, chosen, traveling, arrived, heroId } = arriveAtTraining();
		const started = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'start-training'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		expect(started.scheduled).toHaveLength(1);
		expect(started.scheduled[0]?.dueGameTime).toBe('2000-01-01T00:32:06.000Z');
		if (started.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(started.state.heroes[heroId]?.currentActivity?.kind).toBe('train');

		const advanced = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'advance-training'),
			commandType: 'simulation.advance',
			targetGameTime: started.scheduled[0]!.dueGameTime
		});
		if (advanced.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		const hero = advanced.state.heroes[heroId]!;
		const blade = advanced.state.items[hero.equipment.mainHand!]!;
		expect(hero.currentActivity).toBeNull();
		expect(hero.progression).toMatchObject({
			level: 1,
			experience: 8,
			skills: { swordFighting: { rank: 1, experience: 6 } }
		});
		expect(blade.durability).toBe(5);
		expect(advanced.resolvedScheduledEventIds).toEqual([started.scheduled[0]!.scheduledEventId]);
		expect(advanced.events[0]?.payload.rewardDeltas).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ kind: 'experience', delta: 8 }),
				expect.objectContaining({ kind: 'skill', delta: 6 }),
				expect.objectContaining({ kind: 'durability', delta: -1 })
			])
		);

		const replay = replayEventsStrict([
			bootstrap.event,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...started.events,
			...advanced.events
		]);
		expect(replay.snapshot.state).toEqual(advanced.state);
		expect(replay.checks.at(-1)?.deltas).toHaveLength(
			(advanced.events[0]?.payload.rewardDeltas as unknown[]).length
		);
	});

	it('uses a nonnegative resource ledger to reserve and complete repairs', () => {
		const { arrived, heroId } = arriveAtTraining();
		const trained = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'start-training-for-repair'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		const afterTraining = applyCommand(trained.state, {
			...commandBase(trained.state, trained.state.master.masterId, 'finish-training-for-repair'),
			commandType: 'simulation.advance',
			targetGameTime: trained.scheduled[0]!.dueGameTime
		});
		const repair = applyCommand(afterTraining.state, {
			...commandBase(afterTraining.state, heroId, 'start-repair'),
			commandType: 'hero.start.activity',
			activity: 'repair'
		});
		if (repair.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(repair.state.settlement.resources['iron-ore']).toBe(1);
		expect(repair.state.settlement.resourceLedger.at(-1)).toMatchObject({
			resource: 'iron-ore',
			before: 2,
			after: 1,
			delta: -1
		});
		const repaired = applyCommand(repair.state, {
			...commandBase(repair.state, repair.state.master.masterId, 'finish-repair'),
			commandType: 'simulation.advance',
			targetGameTime: repair.scheduled[0]!.dueGameTime
		});
		if (repaired.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		const itemId = repaired.state.heroes[heroId]!.equipment.mainHand!;
		expect(repaired.state.items[itemId]?.durability).toBe(6);
	});

	it('makes hero death permanent and Master death atomically ends the run', () => {
		const { arrived, heroId } = arriveAtTraining();
		const assigned = applyCommand(arrived.state, {
			...commandBase(arrived.state, arrived.state.master.masterId, 'assign-before-death'),
			commandType: 'settlement.assign.hero',
			heroId,
			buildingId: 'training-ground',
			role: 'trainee'
		});
		const started = applyCommand(assigned.state, {
			...commandBase(assigned.state, heroId, 'start-before-death'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		const heroDied = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'kill-hero'),
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 100,
			damageKind: 'hazard'
		});
		if (heroDied.state.schemaVersion !== 4) throw new Error('Expected engine-v4 state');
		expect(heroDied.state.heroes[heroId]).toMatchObject({
			lifeState: 'dead',
			health: 0,
			currentActivity: null,
			assignment: null
		});
		expect(heroDied.state.settlement.buildings['training-ground']?.assignedHeroIds).toEqual([]);
		expect(heroDied.canceledScheduledEventIds).toEqual([started.scheduled[0]!.scheduledEventId]);
		expect(() =>
			applyCommand(heroDied.state, {
				...commandBase(heroDied.state, heroId, 'dead-hero-acts'),
				commandType: 'hero.start.activity',
				activity: 'rest'
			})
		).toThrow(IllegalActionError);

		const masterDied = applyCommand(heroDied.state, {
			...commandBase(heroDied.state, heroDied.state.master.masterId, 'kill-master'),
			commandType: 'simulation.apply.damage',
			targetId: heroDied.state.master.masterId,
			amount: 100,
			damageKind: 'hazard'
		});
		expect(masterDied.state.status).toBe('game_over');
		expect(masterDied.state.master).toMatchObject({ lifeState: 'dead', health: 0 });
		expect(legalActions(masterDied.state, masterDied.state.master.masterId)).toEqual([]);
	});
});
