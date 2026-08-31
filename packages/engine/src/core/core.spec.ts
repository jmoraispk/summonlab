import { EngineGameStateSchema, type EngineGameState } from '@summonlab/contracts';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { ENGINE_COMPATIBILITY_STATE_FIXTURES } from '../../../contracts/src/engine-compatibility-states.snapshot.js';
import { ReplayIntegrityError } from '../errors.js';
import { settlementForState } from './content-bindings.js';
import { hashGameState, parseGameState } from './state.js';
import type { EngineCommandHandler, EngineEventReducer } from './types.js';
import {
	CATCH_UP_SUPPORTED_VERSIONS,
	COMMUNICATION_API_SUPPORTED_VERSIONS,
	CONVERSATION_API_SUPPORTED_VERSIONS,
	DIRECTIVES_API_SUPPORTED_VERSIONS,
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
	it('keeps every structural state guard exhaustive across v1-v23', () => {
		const structuralMemberships = [
			[
				hasNavigationState,
				[3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
			],
			[
				hasFacilityState,
				[4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]
			],
			[hasRoutineState, [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasFirstEmberState, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasSocietyState, [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasCommunicationState, [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasConversationState, [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasDirectiveState, [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasMissionState, [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]],
			[hasMissionTurnState, [12, 13, 14, 15, 16, 17, 18, 19, 20, 23]]
		] as const;

		for (const [predicate, expected] of structuralMemberships) {
			expect(acceptedVersions(predicate)).toEqual(expected);
		}
	});

	it('keeps service availability distinct from structural compatibility', () => {
		const serviceMemberships = [
			[supportsCatchUp, CATCH_UP_SUPPORTED_VERSIONS, [5, 6, 7, 8, 9, 10, 11, 12, 13]],
			[supportsCommunicationApi, COMMUNICATION_API_SUPPORTED_VERSIONS, [8, 9, 10, 11, 12, 13]],
			[supportsConversationApi, CONVERSATION_API_SUPPORTED_VERSIONS, [9, 10, 11, 12, 13]],
			[supportsDirectivesApi, DIRECTIVES_API_SUPPORTED_VERSIONS, [10, 11, 12, 13, 16, 17, 18]],
			[supportsMissionApi, MISSION_API_SUPPORTED_VERSIONS, [13, 15, 16, 17, 18, 19, 20]],
			[supportsStoryPatchApi, STORY_PATCH_API_SUPPORTED_VERSIONS, [21]],
			[supportsSynthesisApi, SYNTHESIS_API_SUPPORTED_VERSIONS, [22]],
			[supportsFirstBandArchiveApi, FIRST_BAND_ARCHIVE_API_SUPPORTED_VERSIONS, [23]]
		] as const;

		for (const [predicate, declared, expected] of serviceMemberships) {
			expect(declared).toEqual(expected);
			expect(Object.isFrozen(declared)).toBe(true);
			expect(acceptedVersions(predicate)).toEqual(expected);
		}
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

		expect(() => settlementForState(mismatched)).toThrowError(
			new ReplayIntegrityError('Settlement content binding is unavailable', 1)
		);
	});

	it('defines stable owner ports without orchestration ownership', () => {
		expectTypeOf<EngineCommandHandler>().toHaveProperty('ownerId');
		expectTypeOf<EngineCommandHandler>().toHaveProperty('commandTypes');
		expectTypeOf<EngineCommandHandler>().toHaveProperty('assertLegal');
		expectTypeOf<EngineCommandHandler>().toHaveProperty('buildEvent');
		expectTypeOf<EngineEventReducer>().toHaveProperty('ownerId');
		expectTypeOf<EngineEventReducer>().toHaveProperty('eventTypes');
		expectTypeOf<EngineEventReducer>().toHaveProperty('reduce');
	});
});
