import {
	EngineCommandSchema,
	EngineGameStateSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState
} from '@summonlab/contracts';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ENGINE_COMPATIBILITY_STATE_FIXTURES } from '../../../contracts/src/engine-compatibility-states.snapshot.js';
import { ReplayIntegrityError } from '../errors.js';
import { missionContentForState, settlementForState } from './content-bindings.js';
import { hashGameState, parseGameState } from './state.js';
import type { EngineCommandHandler, EngineEventReducer } from './types.js';
import {
	CATCH_UP_SUPPORTED_VERSIONS,
	COMMUNICATION_API_SUPPORTED_VERSIONS,
	CONVERSATION_API_SUPPORTED_VERSIONS,
	DIRECTIVES_API_SUPPORTED_VERSIONS,
	EQUIPMENT_API_SUPPORTED_VERSIONS,
	FIRST_BAND_ARCHIVE_API_SUPPORTED_VERSIONS,
	MISSION_API_SUPPORTED_VERSIONS,
	STORY_PATCH_API_SUPPORTED_VERSIONS,
	SYNTHESIS_API_SUPPORTED_VERSIONS,
	hasCommunicationState,
	hasConversationState,
	hasDirectiveState,
	hasFacilityState,
	hasFirstEmberState,
	hasMissionState,
	hasMissionTurnState,
	hasNavigationState,
	hasRoutineState,
	hasSocietyState,
	supportsCatchUp,
	supportsCommunicationApi,
	supportsConversationApi,
	supportsDirectivesApi,
	supportsEquipmentApi,
	supportsFirstBandArchiveApi,
	supportsMissionApi,
	supportsStoryPatchApi,
	supportsSynthesisApi
} from './versions.js';

const STATES = ENGINE_COMPATIBILITY_STATE_FIXTURES.map((state) =>
	EngineGameStateSchema.parse(state)
);

const acceptedVersions = (predicate: (state: EngineGameState) => boolean): number[] =>
	STATES.filter(predicate).map((state) => state.schemaVersion);

describe('deterministic engine core', () => {
	it('keeps every structural state guard exhaustive across v1-v24', () => {
		const structuralMemberships = [
			[
				hasNavigationState,
				[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
			],
			[
				hasFacilityState,
				[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
			],
			[
				hasRoutineState,
				[5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
			],
			[
				hasFirstEmberState,
				[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]
			],
			[hasSocietyState, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]],
			[hasCommunicationState, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]],
			[hasConversationState, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]],
			[hasDirectiveState, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]],
			[hasMissionState, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24]],
			[hasMissionTurnState, [12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24]]
		] as const;

		for (const [predicate, expected] of structuralMemberships) {
			expect(acceptedVersions(predicate)).toEqual(expected);
		}
	});

	it('keeps service availability distinct from structural compatibility', () => {
		const serviceMemberships = [
			[supportsCatchUp, CATCH_UP_SUPPORTED_VERSIONS, [5, 6, 7, 8, 9, 10, 11, 12, 13, 24]],
			[supportsCommunicationApi, COMMUNICATION_API_SUPPORTED_VERSIONS, [8, 9, 10, 11, 12, 13]],
			[supportsConversationApi, CONVERSATION_API_SUPPORTED_VERSIONS, [9, 10, 11, 12, 13]],
			[supportsDirectivesApi, DIRECTIVES_API_SUPPORTED_VERSIONS, [10, 11, 12, 13, 16, 17, 18]],
			[supportsStoryPatchApi, STORY_PATCH_API_SUPPORTED_VERSIONS, [21]],
			[supportsFirstBandArchiveApi, FIRST_BAND_ARCHIVE_API_SUPPORTED_VERSIONS, [23]],
			[supportsEquipmentApi, EQUIPMENT_API_SUPPORTED_VERSIONS, [24]]
		] as const;

		for (const [predicate, declared, expected] of serviceMemberships) {
			expect(declared).toEqual(expected);
			expect(Object.isFrozen(declared)).toBe(true);
			expect(acceptedVersions(predicate)).toEqual(expected);
		}
		expect(SYNTHESIS_API_SUPPORTED_VERSIONS).toEqual([22, 27]);
		expect(Object.isFrozen(SYNTHESIS_API_SUPPORTED_VERSIONS)).toBe(true);
		expect(acceptedVersions(supportsSynthesisApi)).toEqual([22]);
		expect(MISSION_API_SUPPORTED_VERSIONS).toEqual([13, 15, 16, 17, 18, 19, 20, 25, 26, 27]);
		expect(Object.isFrozen(MISSION_API_SUPPORTED_VERSIONS)).toBe(true);
		// The compatibility fixture inventory is intentionally frozen at v24; V25 is exercised by
		// the capability and legacy-automatic mission suites.
		expect(acceptedVersions(supportsMissionApi)).toEqual([13, 15, 16, 17, 18, 19, 20]);
	});

	it('parses with the public schema and preserves representative state hashes', () => {
		const v1 = parseGameState(ENGINE_COMPATIBILITY_STATE_FIXTURES[0]);
		const v23 = parseGameState(ENGINE_COMPATIBILITY_STATE_FIXTURES[22]);

		expect(hashGameState(v1)).toBe(
			'6a836a97acba64ce75a48adeabf83ce1eca89c348d7e3942cfdcee46d3033738'
		);
		expect(hashGameState(v23)).toBe(
			'dbb0200104f52ea38b781cc05e263a336fd8fa122c5dd166cc868300d3bf609e'
		);
	});

	it('rejects a mismatched immutable settlement content binding with the legacy error', () => {
		const state = parseGameState(ENGINE_COMPATIBILITY_STATE_FIXTURES[22]);
		if (state.schemaVersion !== 23) throw new Error('Expected v23 fixture');
		const mismatched = {
			...state,
			settlement: {
				...state.settlement,
				navigation: { ...state.settlement.navigation, contentVersion: 'hearth-01-v999' }
			}
		};

		try {
			settlementForState(mismatched);
			throw new Error('Expected settlement binding rejection');
		} catch (error) {
			expect(error).toBeInstanceOf(ReplayIntegrityError);
			expect((error as Error).constructor).toBe(ReplayIntegrityError);
			expect(error).toMatchObject({
				name: 'ReplayIntegrityError',
				message: 'Settlement content binding is unavailable',
				sequence: 1
			});
		}
	});

	it.each([
		['content version', { contentVersion: 'tower-floor-01-v999' }],
		['content hash', { contentHash: '0'.repeat(64) }]
	] as const)('rejects a mission binding %s mismatch with the legacy error', (_label, binding) => {
		const state = parseGameState(ENGINE_COMPATIBILITY_STATE_FIXTURES[22]);
		if (state.schemaVersion !== 23) throw new Error('Expected v23 fixture');
		const mismatched = {
			...state,
			mission: {
				...state.mission,
				binding: { ...state.mission.binding, ...binding }
			}
		};

		try {
			missionContentForState(mismatched);
			throw new Error('Expected mission binding rejection');
		} catch (error) {
			expect(error).toBeInstanceOf(ReplayIntegrityError);
			expect((error as Error).constructor).toBe(ReplayIntegrityError);
			expect(error).toMatchObject({
				name: 'ReplayIntegrityError',
				message: 'Mission content binding is unavailable',
				sequence: 1
			});
		}
	});

	it('defines exact stable owner ports without orchestration ownership', () => {
		type InspectCommand = Extract<EngineCommand, { commandType: 'master.inspect.gate' }>;
		interface ExpectedCommandHandlerPort {
			readonly ownerId: string;
			readonly commandTypes: readonly InspectCommand['commandType'][];
			assertLegal(state: EngineGameState, command: InspectCommand): void;
			buildEvent(state: EngineGameState, command: InspectCommand): AuthoritativeEvent;
		}
		interface ExpectedEventReducerPort {
			readonly ownerId: string;
			readonly eventTypes: readonly string[];
			reduce(state: EngineGameState, event: AuthoritativeEvent): EngineGameState;
		}
		const state = STATES[0]!;
		const command = EngineCommandSchema.parse({
			commandId: '1141b6b4-92c7-4a7e-b32d-7043e2c75491',
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: 'e439a130-3c31-4cf8-b53d-d9c9c9f04f3b',
			source: {
				source: 'manual',
				timing: 'step',
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'master.inspect.gate'
		});
		if (command.commandType !== 'master.inspect.gate') throw new Error('Expected inspect command');
		const event = { eventType: 'core.test.event' } as AuthoritativeEvent;
		let asserted: readonly [EngineGameState, InspectCommand] | undefined;
		let built: readonly [EngineGameState, InspectCommand] | undefined;
		let reduced: readonly [EngineGameState, AuthoritativeEvent] | undefined;

		const commandHandler = {
			ownerId: 'core.test.command-owner',
			commandTypes: ['master.inspect.gate'],
			assertLegal(handlerState: EngineGameState, handlerCommand: InspectCommand): void {
				asserted = [handlerState, handlerCommand];
			},
			buildEvent(
				handlerState: EngineGameState,
				handlerCommand: InspectCommand
			): AuthoritativeEvent {
				built = [handlerState, handlerCommand];
				return event;
			}
		} as const satisfies EngineCommandHandler<InspectCommand>;
		const eventReducer = {
			ownerId: 'core.test.event-owner',
			eventTypes: ['core.test.event'],
			reduce(reducerState: EngineGameState, reducerEvent: AuthoritativeEvent): EngineGameState {
				reduced = [reducerState, reducerEvent];
				return reducerState;
			}
		} as const satisfies EngineEventReducer;

		expectTypeOf<
			EngineCommandHandler<InspectCommand>
		>().toEqualTypeOf<ExpectedCommandHandlerPort>();
		expectTypeOf<EngineEventReducer>().toEqualTypeOf<ExpectedEventReducerPort>();
		expectTypeOf(commandHandler).toMatchTypeOf<EngineCommandHandler<InspectCommand>>();
		expectTypeOf(eventReducer).toMatchTypeOf<EngineEventReducer>();
		expectTypeOf(commandHandler.ownerId).toEqualTypeOf<'core.test.command-owner'>();
		expectTypeOf(commandHandler.commandTypes).toEqualTypeOf<readonly ['master.inspect.gate']>();
		expectTypeOf(commandHandler.assertLegal).toEqualTypeOf<
			(state: EngineGameState, command: InspectCommand) => void
		>();
		expectTypeOf(commandHandler.buildEvent).toEqualTypeOf<
			(state: EngineGameState, command: InspectCommand) => AuthoritativeEvent
		>();
		expectTypeOf(eventReducer.ownerId).toEqualTypeOf<'core.test.event-owner'>();
		expectTypeOf(eventReducer.eventTypes).toEqualTypeOf<readonly ['core.test.event']>();
		expectTypeOf(eventReducer.reduce).toEqualTypeOf<
			(state: EngineGameState, event: AuthoritativeEvent) => EngineGameState
		>();
		commandHandler.assertLegal(state, command);
		expect(commandHandler.buildEvent(state, command)).toBe(event);
		expect(eventReducer.reduce(state, event)).toBe(state);
		expect(commandHandler.ownerId).toBe('core.test.command-owner');
		expect(commandHandler.commandTypes).toEqual(['master.inspect.gate']);
		expect(eventReducer.ownerId).toBe('core.test.event-owner');
		expect(eventReducer.eventTypes).toEqual(['core.test.event']);
		expect(asserted).toEqual([state, command]);
		expect(built).toEqual([state, command]);
		expect(reduced).toEqual([state, event]);
	});
});
