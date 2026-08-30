import { describe, expect, it } from 'vitest';

import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from '../errors.js';
import * as engine from '../index.js';
import {
	ENGINE_EVENT_TYPES,
	LEGACY_EVENT_TYPES,
	MODERN_EVENT_TYPES,
	RUN_INITIALIZATION_EVENT_TYPES
} from './event-discriminators.js';
import { ENGINE_PUBLIC_RUNTIME_EXPORTS } from './public-api.snapshot.js';

describe('engine public API compatibility', () => {
	it('matches the checked-in runtime export inventory', () => {
		expect(Object.keys(engine).sort()).toEqual(ENGINE_PUBLIC_RUNTIME_EXPORTS);
	});

	it('preserves public error constructor identity and fields', () => {
		expect(engine.IllegalActionError).toBe(IllegalActionError);
		expect(engine.StaleStateVersionError).toBe(StaleStateVersionError);
		expect(engine.ReplayIntegrityError).toBe(ReplayIntegrityError);

		expect(new engine.IllegalActionError('hero.wait', ['hero.train'])).toMatchObject({
			code: 'ILLEGAL_ACTION',
			legalActionIds: ['hero.train']
		});
		expect(new engine.StaleStateVersionError(3, 4)).toMatchObject({
			code: 'STALE_RUN_VERSION',
			expectedVersion: 3,
			latestVersion: 4
		});
		const replayIntegrity = new engine.ReplayIntegrityError('Replay diverged', 7);
		expect(replayIntegrity).toMatchObject({ sequence: 7 });
		expect(replayIntegrity).not.toHaveProperty('code');
	});

	it('keeps the manually audited event discriminator inventory unique', () => {
		expect(new Set(RUN_INITIALIZATION_EVENT_TYPES).size).toBe(
			RUN_INITIALIZATION_EVENT_TYPES.length
		);
		expect(new Set(LEGACY_EVENT_TYPES).size).toBe(LEGACY_EVENT_TYPES.length);
		expect(new Set(MODERN_EVENT_TYPES).size).toBe(MODERN_EVENT_TYPES.length);
		expect(ENGINE_EVENT_TYPES).toContain('run.initialized');
	});

	it('contains the event types emitted by the bootstrap fixture and builders', () => {
		const bootstrap = engine.createBootstrapEngine({
			runId: engine.deterministicUuid('compatibility-run'),
			seed: 'compatibility-seed',
			heroId: engine.deterministicUuid('compatibility-hero'),
			manifestHash: engine.sha256Hex('compatibility-manifest')
		});
		const heroId = Object.keys(bootstrap.snapshot.state.heroes)[0]!;
		const chosen = engine.applyCommand(bootstrap.snapshot.state, {
			commandId: engine.deterministicUuid('compatibility-choose'),
			runId: bootstrap.snapshot.state.runId,
			actorId: heroId,
			expectedVersion: bootstrap.snapshot.state.version,
			correlationId: engine.deterministicUuid('compatibility-choose'),
			source: {
				source: 'scripted',
				timing: 'continuous',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will train.',
			storyBranch: 'steel-before-trust'
		});
		const emitted = [bootstrap.event, ...chosen.events].map((event) => event.eventType);
		const inventory = new Set<string>(ENGINE_EVENT_TYPES);
		expect(emitted.every((eventType) => inventory.has(eventType))).toBe(true);
	});

	it('contains every event emitted by representative existing builder scenarios', () => {
		const bootstrap = engine.createBootstrapEngine({
			runId: engine.deterministicUuid('compatibility-builder-run'),
			seed: 'compatibility-builder-seed',
			heroId: engine.deterministicUuid('compatibility-builder-hero'),
			manifestHash: engine.sha256Hex('compatibility-builder-manifest')
		});
		const initial = bootstrap.snapshot.state;
		const heroId = Object.keys(initial.heroes)[0]!;
		const masterId = initial.master.masterId;
		const source = {
			source: 'manual' as const,
			timing: 'step' as const,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		};
		const command = (state: typeof initial, actorId: string, key: string) => ({
			commandId: engine.deterministicUuid(`compatibility-builder-${key}`),
			runId: state.runId,
			actorId,
			expectedVersion: state.version,
			correlationId: engine.deterministicUuid(`compatibility-builder-${key}`),
			source
		});
		const inspected = engine.applyCommand(initial, {
			...command(initial, masterId, 'inspect'),
			commandType: 'master.inspect.gate'
		});
		const chosen = engine.applyCommand(initial, {
			...command(initial, heroId, 'choose'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'I will train.',
			storyBranch: 'steel-before-trust'
		});
		const traveling = engine.applyCommand(chosen.state, {
			...command(chosen.state, heroId, 'travel'),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		const arrived = engine.applyCommand(traveling.state, {
			...command(traveling.state, masterId, 'arrive'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		const communication = engine.applyCommand(initial, {
			...command(initial, masterId, 'communication'),
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'master-role',
			exactText: 'I will protect the company.',
			tone: 'neutral',
			delivery: 'private'
		});
		const conversation = engine.applyCommand(initial, {
			...command(initial, masterId, 'conversation'),
			commandType: 'master.converse',
			targetHeroId: heroId,
			kind: 'ask',
			exactText: 'Are you ready?',
			tone: 'neutral',
			delivery: 'private',
			orderIntent: null
		});
		const directive = engine.applyCommand(initial, {
			...command(initial, masterId, 'directive'),
			commandType: 'master.issue.directive',
			text: 'Choose training before the tower.',
			scope: 'decision',
			recipientIds: [heroId],
			priorities: ['training'],
			tone: 'firm',
			delivery: 'private'
		});
		const prepared = engine.applyCommand(initial, {
			...command(initial, masterId, 'prepare'),
			commandType: 'mission.prepare',
			heroIds: [heroId]
		});
		const deployed = engine.applyCommand(prepared.state, {
			...command(prepared.state, masterId, 'deploy'),
			commandType: 'mission.deploy'
		});
		const damaged = engine.applyCommand(initial, {
			...command(initial, masterId, 'damage'),
			commandType: 'simulation.apply.damage',
			targetId: heroId,
			amount: 1,
			damageKind: 'hazard'
		});
		const emitted = [
			bootstrap.event,
			...inspected.events,
			...chosen.events,
			...traveling.events,
			...arrived.events,
			...communication.events,
			...conversation.events,
			...directive.events,
			...prepared.events,
			...deployed.events,
			...damaged.events
		].map((event) => event.eventType);
		const inventory = new Set<string>(ENGINE_EVENT_TYPES);
		expect(emitted.every((eventType) => inventory.has(eventType))).toBe(true);
	});
});
