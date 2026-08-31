import { EngineCommandSchema, type EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { LEGACY_EVENT_TYPES, MODERN_EVENT_TYPES } from '../compatibility/event-discriminators.js';
import type { EngineCommandHandler, EngineEventReducer } from '../core/types.js';
import { settlementCommandHandler } from '../domains/settlement/commands.js';
import { settlementEventReducer } from '../domains/settlement/reducer.js';
import { storyCommandHandler } from '../domains/story/commands.js';
import { storyEventReducer } from '../domains/story/reducer.js';
import { synthesisCommandHandler } from '../domains/synthesis/commands.js';
import { synthesisEventReducer } from '../domains/synthesis/reducer.js';
import { createCommandRegistry } from './command-registry.js';
import { createEventRegistry } from './event-registry.js';
import {
	firstBandMissionCommandHandler,
	firstBandMissionEventReducer
} from './first-band-mission-reducer.js';
import { missionEventReducer } from '../domains/mission/reducer.js';

function fakeHandler(
	ownerId: string,
	commandTypes: readonly EngineCommand['commandType'][]
): EngineCommandHandler {
	return {
		ownerId,
		commandTypes,
		assertLegal() {},
		buildEvent() {
			throw new Error('Unused fake handler');
		}
	};
}

function fakeReducer(ownerId: string, eventTypes: readonly string[]): EngineEventReducer {
	return {
		ownerId,
		eventTypes,
		reduce() {
			throw new Error('Unused fake reducer');
		}
	};
}

describe('command registry construction', () => {
	it('exposes frozen source-order inventories and only lookup access to handlers', () => {
		const firstTypes: EngineCommand['commandType'][] = ['hero.choose.destination'];
		const first = fakeHandler('first', firstTypes);
		const second = fakeHandler('second', ['mission.prepare']);

		const registry = createCommandRegistry([first, second]);
		firstTypes.push('hero.arrive');

		expect(registry.ownerIds).toStrictEqual(['first', 'second']);
		expect(registry.commandTypes).toStrictEqual(['hero.choose.destination', 'mission.prepare']);
		expect(Object.isFrozen(registry.ownerIds)).toBe(true);
		expect(Object.isFrozen(registry.commandTypes)).toBe(true);
		expect(registry.handlerFor('hero.choose.destination')).toBe(first);
		expect(registry.handlerFor('mission.prepare')).toBe(second);
		expect(registry).not.toHaveProperty('handlers');
	});

	it('rejects an owner with no command discriminators', () => {
		expect(() => createCommandRegistry([fakeHandler('empty', [])])).toThrow(
			'Command owner empty must declare at least one discriminator'
		);
	});

	it('rejects duplicate command ownership with both owners named', () => {
		expect(() =>
			createCommandRegistry([
				fakeHandler('alpha', ['mission.deploy']),
				fakeHandler('beta', ['mission.deploy'])
			])
		).toThrow('Command discriminator mission.deploy is owned by both alpha and beta');
	});
});

describe('event registry construction', () => {
	it('exposes frozen source-order inventories and lookup without exposing its map', () => {
		const firstTypes = ['hero.arrived'];
		const first = fakeReducer('first', firstTypes);
		const second = fakeReducer('second', ['mission.deployed']);

		const registry = createEventRegistry([first, second]);
		firstTypes.push('unowned.after.construction');

		expect(registry.ownerIds).toStrictEqual(['first', 'second']);
		expect(registry.eventTypes).toStrictEqual(['hero.arrived', 'mission.deployed']);
		expect(Object.isFrozen(registry.ownerIds)).toBe(true);
		expect(Object.isFrozen(registry.eventTypes)).toBe(true);
		expect(registry.reducerFor('hero.arrived')).toBe(first);
		expect(registry.reducerFor('mission.deployed')).toBe(second);
		expect(registry.reducerFor('not.registered')).toBeUndefined();
		expect(registry).not.toHaveProperty('reducers');
	});

	it('rejects an owner with no event discriminators', () => {
		expect(() => createEventRegistry([fakeReducer('empty', [])])).toThrow(
			'Event owner empty must declare at least one discriminator'
		);
	});

	it('rejects duplicate event ownership with both owners named', () => {
		expect(() =>
			createEventRegistry([
				fakeReducer('alpha', ['mission.deployed']),
				fakeReducer('beta', ['mission.deployed'])
			])
		).toThrow('Event discriminator mission.deployed is owned by both alpha and beta');
	});
});

describe('modern engine ownership', () => {
	it('owns every schema-valid command exactly once in explicit domain order', () => {
		const registry = createCommandRegistry([
			settlementCommandHandler,
			firstBandMissionCommandHandler,
			storyCommandHandler,
			synthesisCommandHandler
		]);
		const schemaCommandTypes = EngineCommandSchema.options.map(
			(option) => option.shape.commandType.value
		);

		expect(registry.ownerIds).toStrictEqual(['settlement', 'mission', 'story', 'synthesis']);
		expect(new Set(registry.commandTypes).size).toBe(registry.commandTypes.length);
		expect([...registry.commandTypes].sort()).toStrictEqual([...schemaCommandTypes].sort());
		expect(registry.commandTypes).toHaveLength(schemaCommandTypes.length);
	});

	it('owns every modern event exactly once in explicit reducer order', () => {
		const registry = createEventRegistry([
			settlementEventReducer,
			missionEventReducer,
			firstBandMissionEventReducer,
			storyEventReducer,
			synthesisEventReducer
		]);

		expect(registry.ownerIds).toStrictEqual([
			'settlement',
			'mission',
			'first-band-mission',
			'story',
			'synthesis'
		]);
		expect(new Set(registry.eventTypes).size).toBe(registry.eventTypes.length);
		expect([...registry.eventTypes].sort()).toStrictEqual([...MODERN_EVENT_TYPES].sort());
		expect(registry.eventTypes).toHaveLength(MODERN_EVENT_TYPES.length);
		expect(registry.eventTypes).not.toContain('run.initialized');
		for (const legacyEventType of LEGACY_EVENT_TYPES) {
			expect(registry.reducerFor(legacyEventType)?.ownerId).toBe('settlement');
		}
	});
});
