export {
	ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION,
	CAPABILITY_ENGINE_CONTENT_VERSION,
	COMMUNICATION_ENGINE_CONTENT_VERSION,
	CONVERSATION_ENGINE_CONTENT_VERSION,
	DIRECTIVE_ENGINE_CONTENT_VERSION,
	ENGINE_CONTENT_VERSION,
	ENGINE_EPOCH,
	ENGINE_INVARIANTS,
	EQUIPMENT_API_SUPPORTED_VERSIONS,
	EQUIPMENT_ENGINE_CONTENT_VERSION,
	FACILITY_ENGINE_CONTENT_VERSION,
	FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION,
	FIRST_EMBER_ENGINE_CONTENT_VERSION,
	LEGACY_ENGINE_CONTENT_VERSION,
	MASTER_FALLBACK_ENGINE_CONTENT_VERSION,
	MASTER_PERMADEATH_ENGINE_CONTENT_VERSION,
	MASTER_TIMING_ENGINE_CONTENT_VERSION,
	MISSION_AFTERMATH_ENGINE_CONTENT_VERSION,
	MISSION_COMBAT_ENGINE_CONTENT_VERSION,
	MISSION_ENGINE_CONTENT_VERSION,
	MISSION_EVIDENCE_ENGINE_CONTENT_VERSION,
	MISSION_TURN_ENGINE_CONTENT_VERSION,
	PORTAL_ENGINE_CONTENT_VERSION,
	PREVIOUS_ENGINE_CONTENT_VERSION,
	ROUTINE_ENGINE_CONTENT_VERSION,
	SOCIAL_ENGINE_CONTENT_VERSION,
	STORY_PATCH_ENGINE_CONTENT_VERSION,
	SYNTHESIS_ENGINE_CONTENT_VERSION,
	TRAVEL_ENGINE_CONTENT_VERSION,
	supportsCatchUp,
	supportsCommunicationApi,
	supportsConversationApi,
	supportsDirectivesApi,
	supportsEquipmentApi,
	supportsFirstBandArchiveApi,
	supportsMissionApi,
	supportsStoryPatchApi,
	supportsSynthesisApi
} from './core/versions.js';
export { hashGameState } from './core/state.js';
export type {
	BootstrapAdditionalHeroInput,
	BootstrapEngineInput,
	BootstrapEngineResult,
	EngineApplyResult,
	ReplayCheck,
	ReplayResult
} from './core/types.js';
export { storyPatchCastForState, validateStoryPatchForState } from './domains/story/runtime.js';
export { resolveDailyRoutine } from './domains/settlement/routines.js';
export {
	LEGACY_EQUIPMENT_TEMPLATE_BINDINGS,
	adaptLegacyEquipmentItem,
	createEquipmentItem,
	equipEquipmentItem,
	equipmentItemDisplayName,
	validateEquipmentStateContent,
	type CreateEquipmentItemInput,
	type EquipEquipmentItemInput
} from './domains/settlement/equipment.js';
export { missionTurnLegalActions } from './domains/mission/actions.js';
export {
	isIrreversibleMasterAction,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	selectMasterFallback
} from './domains/mission/master-control.js';
export {
	monsterArmorReduction,
	resolveMonsterPolicyIntent,
	type MonsterIntentScenario
} from './domains/mission/monster-policy.js';
export { legalActions, decisionLegalActions } from './orchestration/legal-actions.js';
export { commandFromHeroPolicyResult } from './orchestration/policy-commands.js';
export {
	capabilityProfileFromLegacyMind,
	createBootstrapEngine
} from './orchestration/bootstrap.js';
export { applyCommand } from './orchestration/apply-command.js';
export { reduceEvent } from './orchestration/reduction.js';
export {
	scheduledEventsFromEvent,
	resolvedScheduledEventIdsFromEvent,
	canceledScheduledEventIdsFromEvent
} from './orchestration/event-outputs.js';
export { replayEvents, replayEventsStrict } from './orchestration/replay.js';
