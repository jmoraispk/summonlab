import type { AuthoritativeEvent, EngineCommand, EngineGameStateV1 } from '@summonlab/contracts';
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
	const arrived = applyCommand(chosen.state, {
		...commandBase(chosen.state, heroId, 'arrive-training'),
		commandType: 'hero.arrive'
	});
	return { bootstrap, chosen, arrived, heroId };
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
		const arrived = applyCommand(chosen.state, {
			commandId: deterministicUuid(`${runId}:arrive`),
			runId,
			actorId: heroId,
			expectedVersion: 1,
			correlationId: deterministicUuid(`${runId}:arrive:correlation`),
			source: source(),
			commandType: 'hero.arrive'
		});
		const inspected = applyCommand(arrived.state, {
			commandId: deterministicUuid(`${runId}:inspect`),
			runId,
			actorId: arrived.state.master.masterId,
			expectedVersion: 2,
			correlationId: deterministicUuid(`${runId}:inspect:correlation`),
			source: { ...source(), source: 'manual', timing: 'step' },
			commandType: 'master.inspect.gate'
		});
		const events = [bootstrap.event, ...chosen.events, ...arrived.events, ...inspected.events];
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

	it('schedules training, advances an injected clock, and projects progression exactly', () => {
		const { bootstrap, chosen, arrived, heroId } = arriveAtTraining();
		const started = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'start-training'),
			commandType: 'hero.start.activity',
			activity: 'train'
		});
		expect(started.scheduled).toHaveLength(1);
		expect(started.scheduled[0]?.dueGameTime).toBe('2000-01-01T00:30:00.000Z');
		if (started.state.schemaVersion !== 2) throw new Error('Expected engine-v2 state');
		expect(started.state.heroes[heroId]?.currentActivity?.kind).toBe('train');

		const advanced = applyCommand(started.state, {
			...commandBase(started.state, started.state.master.masterId, 'advance-training'),
			commandType: 'simulation.advance',
			targetGameTime: started.scheduled[0]!.dueGameTime
		});
		if (advanced.state.schemaVersion !== 2) throw new Error('Expected engine-v2 state');
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
		if (repair.state.schemaVersion !== 2) throw new Error('Expected engine-v2 state');
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
		if (repaired.state.schemaVersion !== 2) throw new Error('Expected engine-v2 state');
		const itemId = repaired.state.heroes[heroId]!.equipment.mainHand!;
		expect(repaired.state.items[itemId]?.durability).toBe(6);
	});

	it('makes hero death permanent and Master death atomically ends the run', () => {
		const { arrived, heroId } = arriveAtTraining();
		const started = applyCommand(arrived.state, {
			...commandBase(arrived.state, heroId, 'start-before-death'),
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
		if (heroDied.state.schemaVersion !== 2) throw new Error('Expected engine-v2 state');
		expect(heroDied.state.heroes[heroId]).toMatchObject({
			lifeState: 'dead',
			health: 0,
			currentActivity: null
		});
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
