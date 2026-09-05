import type { EngineGameState } from '@summonlab/contracts';

export const ENGINE_CONTENT_VERSION = 'engine-v13';
export const MISSION_EVIDENCE_ENGINE_CONTENT_VERSION = 'engine-v14';
export const PORTAL_ENGINE_CONTENT_VERSION = 'engine-v15';
export const MISSION_AFTERMATH_ENGINE_CONTENT_VERSION = 'engine-v16';
export const MASTER_PERMADEATH_ENGINE_CONTENT_VERSION = 'engine-v17';
export const ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION = 'engine-v18';
export const MASTER_TIMING_ENGINE_CONTENT_VERSION = 'engine-v19';
export const MASTER_FALLBACK_ENGINE_CONTENT_VERSION = 'engine-v20';
export const STORY_PATCH_ENGINE_CONTENT_VERSION = 'engine-v21';
export const SYNTHESIS_ENGINE_CONTENT_VERSION = 'engine-v22';
export const FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION = 'engine-v23';
export const EQUIPMENT_ENGINE_CONTENT_VERSION = 'engine-v24';
export const MISSION_COMBAT_ENGINE_CONTENT_VERSION = 'engine-v13';
export const MISSION_TURN_ENGINE_CONTENT_VERSION = 'engine-v12';
export const MISSION_ENGINE_CONTENT_VERSION = 'engine-v11';
export const DIRECTIVE_ENGINE_CONTENT_VERSION = 'engine-v10';
export const CONVERSATION_ENGINE_CONTENT_VERSION = 'engine-v9';
export const COMMUNICATION_ENGINE_CONTENT_VERSION = 'engine-v8';
export const SOCIAL_ENGINE_CONTENT_VERSION = 'engine-v7';
export const FIRST_EMBER_ENGINE_CONTENT_VERSION = 'engine-v6';
export const ROUTINE_ENGINE_CONTENT_VERSION = 'engine-v5';
export const FACILITY_ENGINE_CONTENT_VERSION = 'engine-v4';
export const TRAVEL_ENGINE_CONTENT_VERSION = 'engine-v3';
export const PREVIOUS_ENGINE_CONTENT_VERSION = 'engine-v2';
export const LEGACY_ENGINE_CONTENT_VERSION = 'engine-v1';
export const ENGINE_EPOCH = '2000-01-01T00:00:00.000Z';
export const ENGINE_INVARIANTS = Object.freeze([
	'pure-transition',
	'engine-owned-legality',
	'seeded-entropy',
	'append-only-events',
	'nonnegative-resource-ledger',
	'terminal-actors-cannot-act',
	'atomic-master-game-over',
	'fake-clock-only',
	'no-network',
	'no-database',
	'no-wall-clock',
	'no-model-sdk'
] as const);

export const DEFAULT_ACTIVE_SYSTEM_IDS = Object.freeze([
	'dormitory-system',
	'gate-system',
	'hearth-system',
	'training-system'
] as const);

const NAVIGATION_VERSIONS = Object.freeze([
	3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const FACILITY_VERSIONS = Object.freeze([
	4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const ROUTINE_VERSIONS = Object.freeze([
	5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const FIRST_EMBER_VERSIONS = Object.freeze([
	6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const SOCIETY_VERSIONS = Object.freeze([
	7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const COMMUNICATION_VERSIONS = Object.freeze([
	8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const CONVERSATION_VERSIONS = Object.freeze([
	9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const DIRECTIVE_VERSIONS = Object.freeze([
	10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const MISSION_VERSIONS = Object.freeze([
	11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24
] as const);
const MISSION_TURN_VERSIONS = Object.freeze([12, 13, 14, 15, 16, 17, 18, 19, 20, 23, 24] as const);

export const CATCH_UP_SUPPORTED_VERSIONS = Object.freeze([
	5, 6, 7, 8, 9, 10, 11, 12, 13, 24
] as const);
export const COMMUNICATION_API_SUPPORTED_VERSIONS = Object.freeze([8, 9, 10, 11, 12, 13] as const);
export const CONVERSATION_API_SUPPORTED_VERSIONS = Object.freeze([9, 10, 11, 12, 13] as const);
export const DIRECTIVES_API_SUPPORTED_VERSIONS = Object.freeze([
	10, 11, 12, 13, 16, 17, 18
] as const);
export const MISSION_API_SUPPORTED_VERSIONS = Object.freeze([13, 15, 16, 17, 18, 19, 20] as const);
export const STORY_PATCH_API_SUPPORTED_VERSIONS = Object.freeze([21] as const);
export const SYNTHESIS_API_SUPPORTED_VERSIONS = Object.freeze([22] as const);
export const FIRST_BAND_ARCHIVE_API_SUPPORTED_VERSIONS = Object.freeze([23] as const);
export const EQUIPMENT_API_SUPPORTED_VERSIONS = Object.freeze([24] as const);

function includesVersion(versions: readonly number[], state: EngineGameState): boolean {
	return versions.includes(state.schemaVersion);
}

export function hasNavigationState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof NAVIGATION_VERSIONS)[number] }> {
	return includesVersion(NAVIGATION_VERSIONS, state);
}

export function hasFacilityState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof FACILITY_VERSIONS)[number] }> {
	return includesVersion(FACILITY_VERSIONS, state);
}

export function hasRoutineState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof ROUTINE_VERSIONS)[number] }> {
	return includesVersion(ROUTINE_VERSIONS, state);
}

export function hasFirstEmberState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof FIRST_EMBER_VERSIONS)[number] }> {
	return includesVersion(FIRST_EMBER_VERSIONS, state);
}

export function hasSocietyState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof SOCIETY_VERSIONS)[number] }> {
	return includesVersion(SOCIETY_VERSIONS, state);
}

export function hasCommunicationState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof COMMUNICATION_VERSIONS)[number] }> {
	return includesVersion(COMMUNICATION_VERSIONS, state);
}

export function hasConversationState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof CONVERSATION_VERSIONS)[number] }> {
	return includesVersion(CONVERSATION_VERSIONS, state);
}

export function hasDirectiveState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof DIRECTIVE_VERSIONS)[number] }> {
	return includesVersion(DIRECTIVE_VERSIONS, state);
}

export function hasMissionState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof MISSION_VERSIONS)[number] }> {
	return includesVersion(MISSION_VERSIONS, state);
}

export function hasMissionTurnState(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: (typeof MISSION_TURN_VERSIONS)[number] }> {
	return includesVersion(MISSION_TURN_VERSIONS, state);
}

export function isModernState(
	state: EngineGameState
): state is Exclude<EngineGameState, { schemaVersion: 1 }> {
	return state.schemaVersion !== 1;
}

export function supportsCatchUp(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof CATCH_UP_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(CATCH_UP_SUPPORTED_VERSIONS, state);
}

export function supportsCommunicationApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof COMMUNICATION_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(COMMUNICATION_API_SUPPORTED_VERSIONS, state);
}

export function supportsConversationApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof CONVERSATION_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(CONVERSATION_API_SUPPORTED_VERSIONS, state);
}

export function supportsDirectivesApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof DIRECTIVES_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(DIRECTIVES_API_SUPPORTED_VERSIONS, state);
}

export function supportsMissionApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof MISSION_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(MISSION_API_SUPPORTED_VERSIONS, state);
}

export function supportsStoryPatchApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof STORY_PATCH_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(STORY_PATCH_API_SUPPORTED_VERSIONS, state);
}

export function supportsSynthesisApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof SYNTHESIS_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(SYNTHESIS_API_SUPPORTED_VERSIONS, state);
}

export function supportsFirstBandArchiveApi(
	state: EngineGameState
): state is Extract<
	EngineGameState,
	{ schemaVersion: (typeof FIRST_BAND_ARCHIVE_API_SUPPORTED_VERSIONS)[number] }
> {
	return includesVersion(FIRST_BAND_ARCHIVE_API_SUPPORTED_VERSIONS, state);
}

export function supportsEquipmentApi(
	state: EngineGameState
): state is Extract<EngineGameState, { schemaVersion: 24 }> {
	return includesVersion(EQUIPMENT_API_SUPPORTED_VERSIONS, state);
}
