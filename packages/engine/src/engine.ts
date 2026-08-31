import {
	AuthoritativeEventSchema,
	CharacterMindSchema,
	EngineCommandSchema,
	EngineGameStateSchema,
	EngineGameStateV1Schema,
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV18Schema,
	EngineGameStateV19Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	EngineGameStateV23Schema,
	EngineSnapshotSchema,
	EntropyDrawSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	FirstBandArchiveStateSchema,
	InjurySchema,
	MissionRunStateSchema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV5Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
	MissionHarmRecordSchema,
	MissionMasterHarmRecordSchema,
	MissionConsequenceRecordV2Schema,
	MissionConsequenceRecordV3Schema,
	MissionRoundSchema,
	MissionRoundV2Schema,
	MissionRoundV3Schema,
	MissionMonsterIntentSchema,
	MissionResolvedEffectSchema,
	MissionTurnChoiceSchema,
	MasterControlStateSchema,
	MasterControlStateV2Schema,
	MasterDecisionResolutionSchema,
	MasterDecisionResolutionV2Schema,
	MasterFallbackConfigurationSchema,
	ResourceKeySchema,
	RuntimeBandStoryStateSchema,
	SocietyStateV4Schema,
	SocietyStateV5Schema,
	DirectiveRecordSchema,
	DirectiveInfluenceRecordSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV1,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV14,
	type EngineGameStateV15,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type EngineGameStateV23,
	type EntropyDraw,
	type HeroDecisionPacket,
	type HeroPolicyResult,
	type LegalAction,
	type MissionPackage,
	type MissionRunStateV2,
	type MissionRunStateV3,
	type MissionRunStateV4,
	type MissionRunStateV5,
	type MissionRunStateV6,
	type MissionRunStateV7,
	type MissionRunStateV8,
	type MissionHarmRecord,
	type MissionMasterHarmRecord,
	type MissionConsequenceRecordV3,
	type MissionRound,
	type MissionRoundV2,
	type MissionRoundV3,
	type MissionMonsterIntent,
	type MissionMonsterState,
	type MissionResolvedEffect,
	type MissionTurnChoice,
	type RewardDelta,
	type SocietyStateV4,
	type SocietyStateV5,
	type DirectiveRecord,
	type ScheduledEvent
} from '@summonlab/contracts';
import {
	IRON_MOON_PACKAGE,
	MONSTER_POLICY_CATALOG,
	TOWER_FLOOR_01_PACKAGE,
	applyMissionDiscoveryAffordance,
	listLegalMissionDiscoveryAffordances,
	monsterPolicy,
	visitMissionNode
} from '@summonlab/content';
import { z } from 'zod';

import { createEntropyCursor, drawInteger } from './entropy.js';
import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from './errors.js';
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from './hash.js';
import { eventDeltas, eventSummary } from './journal.js';
import {
	missionContentForState,
	settlementForState,
	verifiedMissionBinding,
	verifiedSettlementContent
} from './core/content-bindings.js';
import {
	EmptyMetadataSchema,
	RewardDeltasSchema,
	emptyMetadata,
	entropyDrawsFromEvent,
	eventBase,
	metadataIds,
	systemSource
} from './core/event-metadata.js';
import { hashParsedGameState, parseModernState } from './core/state.js';
import type {
	BootstrapEngineInput,
	BootstrapEngineResult,
	EngineApplyResult,
	EngineGameStateModern,
	ReplayCheck,
	ReplayResult
} from './core/types.js';
import {
	ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION,
	DEFAULT_ACTIVE_SYSTEM_IDS,
	ENGINE_CONTENT_VERSION,
	ENGINE_EPOCH,
	FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION,
	MASTER_FALLBACK_ENGINE_CONTENT_VERSION,
	MASTER_PERMADEATH_ENGINE_CONTENT_VERSION,
	MASTER_TIMING_ENGINE_CONTENT_VERSION,
	MISSION_AFTERMATH_ENGINE_CONTENT_VERSION,
	MISSION_EVIDENCE_ENGINE_CONTENT_VERSION,
	PORTAL_ENGINE_CONTENT_VERSION,
	STORY_PATCH_ENGINE_CONTENT_VERSION,
	SYNTHESIS_ENGINE_CONTENT_VERSION,
	hasNavigationState,
	isModernState
} from './core/versions.js';
import {
	completeFirstBandStory,
	createFirstBandArchiveStoryCheckpoint,
	createSealedFirstBandArchive,
	recoverFirstBandArchive
} from './domains/story/archive.js';
import { storyCommandHandler } from './domains/story/commands.js';
import { reduceFirstBandMissionConsequences, storyEventReducer } from './domains/story/reducer.js';
import { createStoryPatchCheckpoint } from './domains/story/runtime.js';
import { synthesisCommandHandler } from './domains/synthesis/commands.js';
import { synthesisEventReducer } from './domains/synthesis/reducer.js';
import {
	SETTLEMENT_COMMAND_TYPES,
	assertSettlementCommandLegalWithActionIds,
	requiredSettlementAction,
	settlementCommandHandler,
	type SettlementCommand
} from './domains/settlement/commands.js';
import {
	action,
	settlementLegalActions,
	settlementTravelActions
} from './domains/settlement/actions.js';
import { createBuildingStates, destinationNodeId } from './domains/settlement/navigation.js';
import { clamp, skipUnfinishedPlan } from './domains/settlement/routines.js';
import {
	clampSocial,
	createBootstrapCompanySociety,
	createBootstrapCompanySocietyV5,
	heroCanHearCommunication
} from './domains/settlement/society.js';
import {
	ActivityStartedPayloadSchema,
	DirectiveChangedPayloadSchema,
	ResourceChangeSchema,
	RoutineStartedPayloadSchema,
	SETTLEMENT_EVENT_TYPES,
	TravelStartedPayloadSchema,
	applyResourceChanges,
	settlementEventReducer
} from './domains/settlement/reducer.js';
import {
	missionLegalActions,
	missionTurnLegalActions,
	missionToolTagsForActor,
	normalizedMissionTurnChoices,
	supportsMissionActions,
	type MissionTurnEngineState
} from './domains/mission/actions.js';
import {
	allPartyAtNode,
	cancelMissionPreparation,
	completeMissionExtraction,
	deployMissionAttempt,
	missionPartyIsReserved,
	normalizedMissionHeroIds,
	openMissionExtraction,
	prepareMissionAttempt,
	retreatMissionAttempt,
	reviseMissionParty,
	type MissionEngineRunState
} from './domains/mission/lifecycle.js';
import {
	applyMasterSafetyStop,
	configureMasterFallback,
	configureMasterTiming,
	configureMasterTimingV2,
	endMasterDecision,
	endMasterDecisionV2,
	isIrreversibleMasterAction,
	masterDecisionWindow,
	masterDecisionWindowV2,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	resolveMasterDecision,
	resolveMasterDecisionV2,
	selectMasterFallback
} from './domains/mission/master-control.js';

export { storyPatchCastForState, validateStoryPatchForState } from './domains/story/runtime.js';
export { resolveDailyRoutine } from './domains/settlement/routines.js';
export {
	isIrreversibleMasterAction,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	missionTurnLegalActions,
	selectMasterFallback
};

export {
	ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION,
	COMMUNICATION_ENGINE_CONTENT_VERSION,
	CONVERSATION_ENGINE_CONTENT_VERSION,
	DIRECTIVE_ENGINE_CONTENT_VERSION,
	ENGINE_CONTENT_VERSION,
	ENGINE_EPOCH,
	ENGINE_INVARIANTS,
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
	TRAVEL_ENGINE_CONTENT_VERSION
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

const DEFAULT_CHARACTER_MIND = CharacterMindSchema.parse({
	personality: {
		openness: 55,
		conscientiousness: 60,
		extraversion: 45,
		agreeableness: 50,
		emotionalVolatility: 40
	},
	primaryValue: 'duty',
	primaryDrive: 'survive',
	socialStyle: 'reserved',
	stressResponse: 'prepare',
	dailyHabit: 'checks-exits',
	aptitudes: { might: 5, finesse: 5, insight: 5, resolve: 5 }
});

const InitializedPayloadSchema = z
	.object({
		initialState: EngineGameStateSchema,
		entropyDraws: z.array(EntropyDrawSchema),
		summary: z.string().optional(),
		rewardDeltas: RewardDeltasSchema.optional(),
		resolvedScheduledEventIds: z.array(z.string().uuid()).optional(),
		canceledScheduledEventIds: z.array(z.string().uuid()).optional()
	})
	.strict();

const LegacyChoosePayloadSchema = z
	.object({
		heroId: z.string().uuid(),
		destination: z.enum(['kitchen', 'training-ground']),
		firstLine: z.string(),
		storyBranch: z.string(),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();
const LegacyArrivePayloadSchema = z
	.object({
		heroId: z.string().uuid(),
		destination: z.enum(['kitchen', 'training-ground']),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema)
	})
	.strict();
const LegacyInspectPayloadSchema = z
	.object({
		masterId: z.string().uuid(),
		resonance: z.number().int().min(0).max(99),
		nextVersion: z.number().int().nonnegative(),
		entropyDraws: z.array(EntropyDrawSchema).length(1)
	})
	.strict();

const MissionTransitionPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.enum([
		'prepare',
		'revise-party',
		'cancel',
		'deploy',
		'open-extraction',
		'extract',
		'retreat'
	]),
	mission: MissionRunStateSchema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV2Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV2Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV2Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundSchema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV3Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV3Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionCombatTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV3Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV4Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV4Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionCombatTurnResolvedPayloadV4Schema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV4Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV5Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV5Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	resourceChanges: z.array(ResourceChangeSchema).max(3),
	nextVersion: z.number().int().positive()
}).strict();

const MissionPortalTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV5Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV3Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionAftermathTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV6Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionHarmRecordSchema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MissionMasterTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV7Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionConsequenceRecordV2Schema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MissionAttemptAftermathTurnResolvedPayloadSchema = EmptyMetadataSchema.extend({
	transition: z.literal('resolve-turn'),
	mission: MissionRunStateV8Schema,
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8),
	round: MissionRoundV2Schema,
	consequences: z.array(MissionConsequenceRecordV3Schema).max(40),
	nextVersion: z.number().int().positive()
}).strict();

const MasterTimingChangedPayloadSchema = EmptyMetadataSchema.extend({
	timing: z.enum(['wait', 'countdown', 'step', 'continuous']),
	countdownSeconds: z.number().int().min(1).max(60),
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateSchema,
	pausedResolution: MasterDecisionResolutionSchema.nullable(),
	nextVersion: z.number().int().positive()
}).strict();

const MasterDecisionOpenedPayloadSchema = EmptyMetadataSchema.extend({
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateSchema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionMasterTimingTurnResolvedPayloadSchema =
	MissionAttemptAftermathTurnResolvedPayloadSchema.safeExtend({
		masterControl: MasterControlStateSchema,
		decisionResolution: MasterDecisionResolutionSchema
	}).strict();

const MasterTimingChangedPayloadV2Schema = EmptyMetadataSchema.extend({
	timing: z.enum(['wait', 'countdown', 'step', 'continuous']),
	countdownSeconds: z.number().int().min(1).max(60),
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	pausedResolution: MasterDecisionResolutionV2Schema.nullable(),
	nextVersion: z.number().int().positive()
}).strict();

const MasterFallbackChangedPayloadSchema = EmptyMetadataSchema.extend({
	policy: MasterFallbackConfigurationSchema.shape.policy,
	directionText: MasterFallbackConfigurationSchema.shape.directionText,
	priorities: MasterFallbackConfigurationSchema.shape.priorities,
	protectedHeroId: MasterFallbackConfigurationSchema.shape.protectedHeroId,
	safetyStops: MasterFallbackConfigurationSchema.shape.safetyStops,
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	pausedResolution: MasterDecisionResolutionV2Schema.nullable(),
	nextVersion: z.number().int().positive()
}).strict();

const MasterDecisionOpenedPayloadV2Schema = EmptyMetadataSchema.extend({
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MasterSafetyStoppedPayloadSchema = EmptyMetadataSchema.extend({
	observedAt: z.string().datetime({ offset: true }),
	masterControl: MasterControlStateV2Schema,
	decisionResolution: MasterDecisionResolutionV2Schema,
	nextVersion: z.number().int().positive()
}).strict();

const MissionMasterFallbackTurnResolvedPayloadSchema =
	MissionAttemptAftermathTurnResolvedPayloadSchema.safeExtend({
		masterControl: MasterControlStateV2Schema,
		decisionResolution: MasterDecisionResolutionV2Schema
	}).strict();

const MissionTransitionPayloadV6Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV6Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV7Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV7Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV8Schema = EmptyMetadataSchema.extend({
	transition: z.enum(['prepare', 'revise-party', 'cancel', 'deploy', 'extract', 'retreat']),
	mission: MissionRunStateV8Schema,
	heroIds: z.array(z.string().uuid()).max(7),
	completedObjectiveIds: z.array(z.string()).max(20),
	nextVersion: z.number().int().positive()
}).strict();

const MissionTransitionPayloadV9Schema = MissionTransitionPayloadV8Schema.safeExtend({
	masterControl: MasterControlStateSchema,
	decisionResolution: MasterDecisionResolutionSchema.nullable()
}).strict();

const MissionTransitionPayloadV10Schema = MissionTransitionPayloadV8Schema.safeExtend({
	masterControl: MasterControlStateV2Schema,
	decisionResolution: MasterDecisionResolutionV2Schema.nullable()
}).strict();

const MissionTransitionPayloadV11Schema = MissionTransitionPayloadV8Schema.safeExtend({
	bandStory: RuntimeBandStoryStateSchema,
	firstBandArchive: FirstBandArchiveStateSchema
}).strict();

export function createBootstrapEngine(input: BootstrapEngineInput): BootstrapEngineResult {
	const masterId = deterministicUuid(`${input.runId}:master`);
	const commandId = deterministicUuid(`${input.runId}:bootstrap`);
	const eventId = deterministicUuid(`${commandId}:1:run.initialized`);
	const simulatedAt = input.simulatedAt ?? ENGINE_EPOCH;
	const initialResources = { food: 3, 'iron-ore': 2, 'ember-shard': 0 } as const;
	const resourceLedger = ResourceKeySchema.options.map((resource) => ({
		entryId: deterministicUuid(`${eventId}:resource:${resource}`),
		eventId,
		resource,
		before: 0,
		after: initialResources[resource],
		delta: initialResources[resource],
		reason: 'run bootstrap stock'
	}));
	const settlementContent = verifiedSettlementContent();
	const buildingStates = createBuildingStates(settlementContent);
	const developmentMissionScenario = input.developmentMissionScenario;
	if (input.additionalHeroes && developmentMissionScenario?.additionalHeroes) {
		throw new Error('Additional heroes must use one bootstrap boundary');
	}
	const bootstrapHeroInputs = [
		{
			heroId: input.heroId,
			manifestHash: input.manifestHash,
			rarityStars: input.rarityStars,
			mind: input.mind
		},
		...(input.additionalHeroes ?? developmentMissionScenario?.additionalHeroes ?? [])
	];
	if (
		bootstrapHeroInputs.length > 4 ||
		new Set(bootstrapHeroInputs.map((hero) => hero.heroId)).size !== bootstrapHeroInputs.length
	) {
		throw new Error('A development bootstrap supports one to four unique summoned heroes');
	}
	const bootstrapHeroes = bootstrapHeroInputs.map((hero) => {
		const mind = CharacterMindSchema.parse(hero.mind ?? DEFAULT_CHARACTER_MIND);
		return {
			...hero,
			mind,
			bladeId: deterministicUuid(`${input.runId}:${hero.heroId}:practice-blade`),
			bowId: deterministicUuid(`${input.runId}:${hero.heroId}:short-bow`)
		};
	});
	const foundryRouteMemoryHeroId = developmentMissionScenario?.foundryRouteMemoryHeroId;
	if (
		foundryRouteMemoryHeroId &&
		!bootstrapHeroes.some((hero) => hero.heroId === foundryRouteMemoryHeroId)
	) {
		throw new Error('Development route memory must belong to a bootstrapped hero');
	}
	const routeMemoryEvidenceId = foundryRouteMemoryHeroId
		? deterministicUuid(`${input.runId}:${foundryRouteMemoryHeroId}:foundry-route-memory`)
		: null;
	const availableMissionIds = developmentMissionScenario
		? [...developmentMissionScenario.availableMissionIds]
		: [TOWER_FLOOR_01_PACKAGE.missionId];
	const initialMissionId =
		developmentMissionScenario?.initialMissionId ?? TOWER_FLOOR_01_PACKAGE.missionId;
	if (!availableMissionIds.includes(initialMissionId)) {
		throw new Error('The initial development mission must be available');
	}
	const missionBinding = verifiedMissionBinding(initialMissionId);
	const portalDevelopmentScenario = initialMissionId === IRON_MOON_PACKAGE.missionId;
	const aftermathDevelopmentScenario = developmentMissionScenario?.enableMissionAftermath === true;
	const masterPermadeathDevelopmentScenario =
		developmentMissionScenario?.enableMasterPermadeath === true;
	const attemptAftermathDevelopmentScenario =
		developmentMissionScenario?.enableAttemptAftermath === true;
	const masterTimingDevelopmentScenario = developmentMissionScenario?.enableMasterTiming === true;
	const masterFallbackDevelopmentScenario =
		developmentMissionScenario?.enableMasterFallback === true;
	const storyPatchDevelopmentScenario = developmentMissionScenario?.enableStoryPatch === true;
	const synthesisDevelopmentScenario = developmentMissionScenario?.enableSynthesis === true;
	const firstBandArchiveDevelopmentScenario =
		developmentMissionScenario?.enableFirstBandArchive === true;
	const stateSchema = firstBandArchiveDevelopmentScenario
		? EngineGameStateV23Schema
		: synthesisDevelopmentScenario
			? EngineGameStateV22Schema
			: storyPatchDevelopmentScenario
				? EngineGameStateV21Schema
				: masterFallbackDevelopmentScenario
					? EngineGameStateV20Schema
					: masterTimingDevelopmentScenario
						? EngineGameStateV19Schema
						: attemptAftermathDevelopmentScenario
							? EngineGameStateV18Schema
							: masterPermadeathDevelopmentScenario
								? EngineGameStateV17Schema
								: aftermathDevelopmentScenario
									? EngineGameStateV16Schema
									: portalDevelopmentScenario
										? EngineGameStateV15Schema
										: developmentMissionScenario
											? EngineGameStateV14Schema
											: EngineGameStateV13Schema;
	const state = stateSchema.parse({
		schemaVersion: firstBandArchiveDevelopmentScenario
			? 23
			: synthesisDevelopmentScenario
				? 22
				: storyPatchDevelopmentScenario
					? 21
					: masterFallbackDevelopmentScenario
						? 20
						: masterTimingDevelopmentScenario
							? 19
							: attemptAftermathDevelopmentScenario
								? 18
								: masterPermadeathDevelopmentScenario
									? 17
									: aftermathDevelopmentScenario
										? 16
										: portalDevelopmentScenario
											? 15
											: developmentMissionScenario
												? 14
												: 13,
		runId: input.runId,
		seed: input.seed,
		contentVersion: firstBandArchiveDevelopmentScenario
			? FIRST_BAND_ARCHIVE_ENGINE_CONTENT_VERSION
			: synthesisDevelopmentScenario
				? SYNTHESIS_ENGINE_CONTENT_VERSION
				: storyPatchDevelopmentScenario
					? STORY_PATCH_ENGINE_CONTENT_VERSION
					: masterFallbackDevelopmentScenario
						? MASTER_FALLBACK_ENGINE_CONTENT_VERSION
						: masterTimingDevelopmentScenario
							? MASTER_TIMING_ENGINE_CONTENT_VERSION
							: attemptAftermathDevelopmentScenario
								? ATTEMPT_AFTERMATH_ENGINE_CONTENT_VERSION
								: masterPermadeathDevelopmentScenario
									? MASTER_PERMADEATH_ENGINE_CONTENT_VERSION
									: aftermathDevelopmentScenario
										? MISSION_AFTERMATH_ENGINE_CONTENT_VERSION
										: portalDevelopmentScenario
											? PORTAL_ENGINE_CONTENT_VERSION
											: developmentMissionScenario
												? MISSION_EVIDENCE_ENGINE_CONTENT_VERSION
												: ENGINE_CONTENT_VERSION,
		status: 'active',
		version: 0,
		eventCursor: 1,
		entropyCursor: 0,
		simulatedAt,
		master: {
			masterId,
			lifeState: 'alive',
			location: 'summoning-gate',
			health: 100,
			maxHealth: 100,
			injuries: [],
			gateInspectionCount: 0,
			lastGateResonance: null
		},
		heroes: Object.fromEntries(
			bootstrapHeroes.map((hero) => [
				hero.heroId,
				{
					heroId: hero.heroId,
					lifeState: 'active',
					location: 'summoning-gate',
					locationNodeId: settlementContent.spawnNodeId,
					firstArrivalCompleted: false,
					destination: null,
					health: 100,
					maxHealth: 100,
					manifestHash: hero.manifestHash,
					needs: { hunger: 20, fatigue: 15 },
					injuries: [],
					progression: {
						stars: hero.rarityStars ?? 1,
						level: 1,
						experience: 0,
						skills: { swordFighting: { rank: 0, experience: 0 } }
					},
					equipment: { mainHand: hero.bladeId },
					currentActivity: null,
					currentTravel: null,
					assignment: null,
					mind: hero.mind,
					habit: {
						habit: hero.mind.dailyHabit,
						strength: clamp(Math.round(35 + hero.mind.personality.conscientiousness * 0.55)),
						repetitions: 0,
						satisfaction: 50,
						lastTriggeredAt: null
					},
					dailyPlan: null,
					currentRoutine: null
				}
			])
		),
		settlement: {
			resources: initialResources,
			resourceLedger,
			navigation: {
				settlementId: settlementContent.settlementId,
				contentVersion: settlementContent.contentVersion,
				contentHash: settlementContent.contentHash,
				activeSystemIds: [...DEFAULT_ACTIVE_SYSTEM_IDS]
			},
			poweredBuildingId: null,
			buildings: buildingStates,
			firstEmber: {
				coreId: 'first-ember-core',
				status: 'unrecovered',
				recoveredFrom: null,
				recoveredAt: null,
				committedAt: null,
				buildingId: null,
				rationale: null,
				modifiers: [],
				reactions: []
			}
		},
		items: Object.assign(
			{},
			...bootstrapHeroes.map((hero) => ({
				[hero.bladeId]: {
					itemId: hero.bladeId,
					templateId: 'practice-blade',
					displayName: 'Gatehouse Practice Blade',
					ownerId: hero.heroId,
					slot: 'main-hand',
					equippedById: hero.heroId,
					durability: 6,
					maxDurability: 6
				},
				[hero.bowId]: {
					itemId: hero.bowId,
					templateId: 'short-bow',
					displayName: 'Ash Short Bow',
					ownerId: hero.heroId,
					slot: 'main-hand',
					equippedById: null,
					durability: 4,
					maxDurability: 4
				}
			}))
		),
		society:
			synthesisDevelopmentScenario || firstBandArchiveDevelopmentScenario
				? createBootstrapCompanySocietyV5(
						bootstrapHeroes.map((hero) => hero.heroId),
						masterId,
						eventId,
						simulatedAt
					)
				: createBootstrapCompanySociety(
						bootstrapHeroes.map((hero) => hero.heroId),
						masterId,
						eventId,
						simulatedAt
					),
		mission: {
			binding: missionBinding,
			...(developmentMissionScenario
				? {
						availableMissionIds,
						evidence:
							foundryRouteMemoryHeroId && routeMemoryEvidenceId
								? {
										[routeMemoryEvidenceId]: {
											evidenceId: routeMemoryEvidenceId,
											evidenceKey: 'foundry-maintenance-route',
											holderActorId: foundryRouteMemoryHeroId,
											sourceBinding: verifiedMissionBinding('tower-floor-04'),
											sourceAttemptId: deterministicUuid(`${input.runId}:floor-04-memory-source`),
											discoveredOnRound: 5
										}
									}
								: {}
					}
				: {}),
			...(firstBandArchiveDevelopmentScenario ||
			synthesisDevelopmentScenario ||
			storyPatchDevelopmentScenario ||
			masterFallbackDevelopmentScenario ||
			masterTimingDevelopmentScenario ||
			attemptAftermathDevelopmentScenario
				? {
						aftermath: {
							aftermathVersion: 'mission-aftermath-v3',
							activeAttemptId: null,
							consequences: [],
							archives: []
						}
					}
				: masterPermadeathDevelopmentScenario
					? {
							aftermath: {
								aftermathVersion: 'mission-aftermath-v2',
								consequences: []
							}
						}
					: aftermathDevelopmentScenario
						? {
								aftermath: {
									aftermathVersion: 'mission-aftermath-v1',
									consequences: []
								}
							}
						: {}),
			attemptCount: 0,
			attempt: null
		},
		...(firstBandArchiveDevelopmentScenario ||
		synthesisDevelopmentScenario ||
		storyPatchDevelopmentScenario ||
		masterFallbackDevelopmentScenario
			? {
					masterControl: {
						timing: 'wait',
						countdownSeconds: 5,
						revision: 0,
						decisionOrdinal: 0,
						activeDecision: null,
						lastResolution: null,
						fallback: {
							configurationVersion: 'master-fallback-v1',
							policy: 'directed',
							directionId: deterministicUuid(`${input.runId}:master-fallback-direction:0`),
							directionText: 'Advance the objective while protecting the company.',
							priorities: ['focus-objective', 'protect-self', 'protect-party'],
							protectedHeroId: null,
							safetyStops: {
								beforeIrreversibleAction: true,
								masterHealthThreshold: 35,
								whenUnclassified: true,
								maximumConsecutiveFallbacks: 8
							},
							configuredAt: simulatedAt
						},
						consecutiveFallbacks: 0
					}
				}
			: masterTimingDevelopmentScenario
				? {
						masterControl: {
							timing: 'wait',
							countdownSeconds: 5,
							revision: 0,
							decisionOrdinal: 0,
							activeDecision: null,
							lastResolution: null
						}
					}
				: {}),
		story: { envelopeId: 'first-ember-v1', branch: null },
		...(firstBandArchiveDevelopmentScenario ||
		synthesisDevelopmentScenario ||
		storyPatchDevelopmentScenario
			? {
					bandStory: firstBandArchiveDevelopmentScenario
						? createFirstBandArchiveStoryCheckpoint()
						: createStoryPatchCheckpoint()
				}
			: {}),
		...(synthesisDevelopmentScenario || firstBandArchiveDevelopmentScenario
			? { synthesis: { contentVersion: 'synthesis-v1', receipts: {}, rumors: {} } }
			: {}),
		...(firstBandArchiveDevelopmentScenario
			? { firstBandArchive: createSealedFirstBandArchive() }
			: {})
	});
	const stateHash = hashParsedGameState(state);
	const rewardDeltas = resourceLedger.map((entry): RewardDelta => ({
		ownerId: masterId,
		kind: 'resource',
		key: entry.resource,
		before: entry.before,
		after: entry.after,
		delta: entry.delta
	}));
	const event = AuthoritativeEventSchema.parse({
		eventId,
		runId: input.runId,
		sequence: 1,
		schemaVersion: state.schemaVersion,
		gameTime: state.simulatedAt,
		eventType: 'run.initialized',
		actorId: null,
		commandId,
		causationId: null,
		correlationId: commandId,
		source: systemSource(),
		seedCursor: 0,
		beforeStateHash: EMPTY_STATE_HASH,
		afterStateHash: stateHash,
		contentVersion: state.contentVersion,
		payload: {
			initialState: state,
			...emptyMetadata(
				bootstrapHeroes.length === 1
					? 'The Master awakened beside a stocked gate and one new summon.'
					: `The Master awakened beside a stocked gate and ${bootstrapHeroes.length} new summons.`,
				rewardDeltas
			)
		}
	});
	return { snapshot: EngineSnapshotSchema.parse({ state, stateHash }), event };
}

const MISSION_MOVE_PREFIX = 'mission.move.';
const MISSION_INSPECT_PREFIX = 'mission.inspect.';
const MISSION_RECOVER_PREFIX = 'mission.recover.';
const MISSION_ATTACK_PREFIX = 'mission.attack.';
const MISSION_MINE_PREFIX = 'mission.mine.';
const MISSION_COOLING_CONTROL_ACTION_ID = 'mission.control.cooling-wheel';

type MissionCombatAttempt = NonNullable<EngineGameStateV14['mission']['attempt']>;
type MissionCombatArena = MissionCombatAttempt['turnState']['arena'];

function verifiedMonsterPolicyBinding(attempt: MissionCombatAttempt): void {
	if (
		attempt.turnState.policyBinding.contentVersion !== MONSTER_POLICY_CATALOG.contentVersion ||
		attempt.turnState.policyBinding.contentHash !== MONSTER_POLICY_CATALOG.contentHash
	) {
		throw new ReplayIntegrityError(
			'Monster policy binding is unavailable',
			attempt.turnState.roundNumber
		);
	}
}

function openDutyStep(
	mission: MissionPackage,
	fromNodeId: string,
	toNodeId: string
): string | null {
	if (fromNodeId === toNodeId) return fromNodeId;
	const pending: Array<{ nodeId: string; firstStep: string | null }> = [
		{ nodeId: fromNodeId, firstStep: null }
	];
	const visited = new Set<string>();
	while (pending.length > 0) {
		const current = pending.shift()!;
		if (visited.has(current.nodeId)) continue;
		visited.add(current.nodeId);
		const neighbors = mission.arena.edges
			.filter((edge) => edge.access.kind === 'open')
			.flatMap((edge) => {
				if (edge.fromNodeId === current.nodeId) return [edge.toNodeId];
				if (edge.bidirectional && edge.toNodeId === current.nodeId) return [edge.fromNodeId];
				return [];
			})
			.sort((left, right) => left.localeCompare(right));
		for (const neighbor of neighbors) {
			const firstStep = current.firstStep ?? neighbor;
			if (neighbor === toNodeId) return firstStep;
			if (!visited.has(neighbor)) pending.push({ nodeId: neighbor, firstStep });
		}
	}
	return null;
}

function prioritizedPartyAtNode(
	party: MissionCombatAttempt['party'],
	positions: Readonly<Record<string, string>>,
	nodeId: string,
	carrierId: string | null
): string | null {
	return (
		party.memberIds
			.filter((actorId) => positions[actorId] === nodeId)
			.sort((left, right) => {
				const leftPriority = left === carrierId ? 0 : left === party.masterId ? 1 : 2;
				const rightPriority = right === carrierId ? 0 : right === party.masterId ? 1 : 2;
				return leftPriority - rightPriority || left.localeCompare(right);
			})[0] ?? null
	);
}

export type MonsterIntentScenario = {
	readonly mission: MissionPackage | null;
	readonly monster: MissionMonsterState;
	readonly dutyNodeId: string;
	readonly objectiveNodeId: string;
	readonly objectiveStatus: MissionCombatAttempt['turnState']['objective']['status'];
	readonly objectiveCarrierId: string | null;
	readonly party: MissionCombatAttempt['party'];
	readonly partyPositions: Readonly<Record<string, string>>;
	readonly arena: MissionCombatArena;
};

function holdIntent(scenario: MonsterIntentScenario, telegraph: string): MissionMonsterIntent {
	return MissionMonsterIntentSchema.parse({
		monsterId: scenario.monster.monsterId,
		policyId: scenario.monster.policyId,
		actionId: `monster.hold.${scenario.monster.monsterId}`,
		kind: 'hold',
		fromNodeId: scenario.monster.nodeId,
		toNodeId: scenario.monster.nodeId,
		targetId: null,
		telegraph,
		anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
	});
}

function strikeIntent(
	scenario: MonsterIntentScenario,
	targetId: string,
	kind: 'strike' | 'furnace-surge' | 'defend-control',
	telegraph: string,
	toNodeId = scenario.monster.nodeId
): MissionMonsterIntent {
	const power = monsterPolicy(scenario.monster.policyId).strikePower;
	return MissionMonsterIntentSchema.parse({
		monsterId: scenario.monster.monsterId,
		policyId: scenario.monster.policyId,
		actionId: `monster.${kind}.${scenario.monster.monsterId}.${targetId}`,
		kind,
		fromNodeId: scenario.monster.nodeId,
		toNodeId,
		targetId,
		telegraph,
		anticipatedEffect: `Threatens ${power} mission guard before defense reduction.`
	});
}

function moveIntent(
	scenario: MonsterIntentScenario,
	toNodeId: string,
	telegraph: string
): MissionMonsterIntent {
	return MissionMonsterIntentSchema.parse({
		monsterId: scenario.monster.monsterId,
		policyId: scenario.monster.policyId,
		actionId: `monster.move.${scenario.monster.monsterId}`,
		kind: 'move',
		fromNodeId: scenario.monster.nodeId,
		toNodeId,
		targetId: null,
		telegraph,
		anticipatedEffect: 'Moves one open authored edge; concealed party routes remain unknown.'
	});
}

export function resolveMonsterPolicyIntent(scenario: MonsterIntentScenario): MissionMonsterIntent {
	const definition = monsterPolicy(scenario.monster.policyId);
	const localTarget = prioritizedPartyAtNode(
		scenario.party,
		scenario.partyPositions,
		scenario.monster.nodeId,
		scenario.objectiveCarrierId
	);

	if (definition.behavior === 'guard-duty-node') {
		if (localTarget) {
			return strikeIntent(
				scenario,
				localTarget,
				'strike',
				`${scenario.monster.label} lowers a hooked blade toward the intruder in its court.`
			);
		}
		if (scenario.monster.nodeId !== scenario.dutyNodeId && scenario.mission) {
			const step = openDutyStep(scenario.mission, scenario.monster.nodeId, scenario.dutyNodeId);
			if (step) return moveIntent(scenario, step, `${scenario.monster.label} returns to its post.`);
		}
		return holdIntent(scenario, `${scenario.monster.label} watches the Chain Court lanes.`);
	}

	if (definition.behavior === 'protect-objective') {
		if (localTarget) {
			if (scenario.monster.alertState === 'duty' && scenario.objectiveStatus === 'available') {
				return MissionMonsterIntentSchema.parse({
					monsterId: scenario.monster.monsterId,
					policyId: scenario.monster.policyId,
					actionId: `monster.alarm.${scenario.monster.monsterId}`,
					kind: 'alarm',
					fromNodeId: scenario.monster.nodeId,
					toNodeId: scenario.monster.nodeId,
					targetId: localTarget,
					telegraph: `${scenario.monster.label} reaches for the cradle alarm chain.`,
					anticipatedEffect: 'Becomes alarmed and makes its next defense explicit.'
				});
			}
			return strikeIntent(
				scenario,
				localTarget,
				'strike',
				`${scenario.monster.label} squares itself between the company and the ember cradle.`
			);
		}
		if (scenario.objectiveCarrierId && scenario.mission) {
			const carrierNode = scenario.partyPositions[scenario.objectiveCarrierId];
			const step = carrierNode
				? openDutyStep(scenario.mission, scenario.monster.nodeId, carrierNode)
				: null;
			if (step && step !== scenario.monster.nodeId) {
				return moveIntent(
					scenario,
					step,
					`${scenario.monster.label} pursues the visible ember carrier.`
				);
			}
		}
		return holdIntent(scenario, `${scenario.monster.label} keeps both hands on the ember cradle.`);
	}

	const coolingTarget =
		scenario.arena.coolingControlExposed && scenario.arena.coolingControlNodeId
			? prioritizedPartyAtNode(
					scenario.party,
					scenario.partyPositions,
					scenario.arena.coolingControlNodeId,
					null
				)
			: null;
	if (coolingTarget) {
		return strikeIntent(
			scenario,
			coolingTarget,
			'defend-control',
			`${scenario.monster.label} turns from the front line to defend the exposed cooling control.`,
			scenario.arena.coolingControlNodeId!
		);
	}
	if (localTarget) {
		return strikeIntent(
			scenario,
			localTarget,
			scenario.arena.furnaceState === 'lit' ? 'furnace-surge' : 'strike',
			scenario.arena.furnaceState === 'lit'
				? `${scenario.monster.label} vents furnace pressure before bringing its hammer down.`
				: `${scenario.monster.label} raises its hammer without the furnace shielding it.`
		);
	}
	return holdIntent(scenario, `${scenario.monster.label} guards the living foundry.`);
}

export function monsterArmorReduction(
	policyId: string,
	furnaceState: MissionCombatArena['furnaceState']
): number {
	const armor = monsterPolicy(policyId).armor;
	if (armor.kind === 'none') return armor.reduction;
	return furnaceState === 'lit'
		? armor.litReduction
		: furnaceState === 'cooling'
			? armor.coolingReduction
			: armor.quenchedReduction;
}

function deriveMonsterIntents(
	mission: MissionPackage,
	attempt: MissionCombatAttempt,
	monsters: Readonly<Record<string, MissionMonsterState>>,
	positions: Readonly<Record<string, string>>,
	objective = attempt.turnState.objective,
	arena = attempt.turnState.arena
): MissionMonsterIntent[] {
	verifiedMonsterPolicyBinding(attempt);
	const objectiveNodeId = mission.objectives.find(
		(candidate) => candidate.objectiveId === objective.objectiveId
	)!.targetNodeIds[0]!;
	return Object.values(monsters)
		.filter((monster) => monster.status === 'active')
		.sort((left, right) => left.monsterId.localeCompare(right.monsterId))
		.map((monster) => {
			const duty = mission.monsterDuties.find(
				(candidate) => candidate.dutySlotId === monster.dutySlotId
			);
			if (!duty)
				throw new ReplayIntegrityError(
					'Monster duty is unavailable',
					attempt.turnState.roundNumber
				);
			return resolveMonsterPolicyIntent({
				mission,
				monster,
				dutyNodeId: duty.spawnNodeId,
				objectiveNodeId,
				objectiveStatus: objective.status,
				objectiveCarrierId: objective.carrierId,
				party: attempt.party,
				partyPositions: positions,
				arena
			});
		});
}

function spawnMissionCombatants(
	state:
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV23,
	attempt: MissionCombatAttempt,
	positions: Readonly<Record<string, string>>,
	entropyInput: ReturnType<typeof createEntropyCursor>,
	entropyDraws: EntropyDraw[]
): {
	readonly monsters: Record<string, MissionMonsterState>;
	readonly threatIntents: MissionMonsterIntent[];
	readonly entropy: ReturnType<typeof createEntropyCursor>;
} {
	verifiedMonsterPolicyBinding(attempt);
	const mission = missionContentForState(state);
	let entropy = entropyInput;
	const monsters: Record<string, MissionMonsterState> = {};
	for (const duty of mission.monsterDuties) {
		if (duty.activation.kind !== 'on-deployment') continue;
		const purpose = `${duty.dutySlotId}-count`;
		if (!mission.encounterSeedRules.namedPurposes.includes(purpose)) {
			throw new ReplayIntegrityError(
				`Monster count entropy is undeclared: ${purpose}`,
				state.eventCursor
			);
		}
		const count = drawInteger(entropy, purpose, duty.count.min, duty.count.max);
		entropy = count.next;
		entropyDraws.push(count.draw);
		const policy = monsterPolicy(duty.policyId);
		for (let ordinal = 1; ordinal <= count.draw.value; ordinal += 1) {
			const monsterId = deterministicUuid(
				`${attempt.attemptId}:${duty.dutySlotId}:${ordinal}:monster`
			);
			monsters[monsterId] = {
				monsterId,
				dutySlotId: duty.dutySlotId,
				policyId: duty.policyId,
				label: `${policy.entityLabel} ${String(ordinal).padStart(2, '0')}`,
				ordinal,
				nodeId: duty.spawnNodeId,
				status: 'active',
				vitality: policy.maximumVitality,
				maximumVitality: policy.maximumVitality,
				alertState: 'duty',
				defeatedOnRound: null,
				lastActionId: null
			};
		}
	}
	return {
		monsters,
		threatIntents: deriveMonsterIntents(mission, attempt, monsters, positions),
		entropy
	};
}

function missionInitiativeBase(state: MissionTurnEngineState, actorId: string): number {
	if (actorId === state.master.masterId) return 50;
	const hero = state.heroes[actorId]!;
	return (
		20 + hero.mind.aptitudes.finesse * 5 + hero.mind.aptitudes.resolve * 3 + hero.progression.level
	);
}

function activeMissionEnvironmentEvents(
	state: MissionTurnEngineState,
	roundNumber: number
): string[] {
	const mission = missionContentForState(state);
	const priorRounds = state.mission.attempt?.turnState.rounds ?? [];
	return mission.environmentalEvents
		.filter((event) => {
			if (event.trigger.kind !== 'turn-interval') return false;
			const occurrenceCount = priorRounds.filter((round) =>
				round.environmentEventIds.includes(event.eventId)
			).length;
			return (
				occurrenceCount < event.maximumOccurrences &&
				roundNumber >= event.trigger.firstTurn &&
				(roundNumber - event.trigger.firstTurn) % event.trigger.everyTurns === 0
			);
		})
		.map((event) => event.eventId)
		.sort();
}

type MissionTurnResolution = {
	readonly mission: MissionRunStateV2;
	readonly round: MissionRound;
	readonly choices: MissionTurnChoice[];
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
};

function resolveMissionTurn(
	state: EngineGameStateV12,
	choicesInput: readonly MissionTurnChoice[]
): MissionTurnResolution {
	const choices = normalizedMissionTurnChoices(state, choicesInput);
	const currentAttempt = state.mission.attempt!;
	const roundNumber = currentAttempt.turnState.roundNumber + 1;
	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const ranked = choices
		.map((choice) => {
			const tieBreak = drawInteger(entropy, 'initiative-tie-break', 0, 99);
			entropy = tieBreak.next;
			entropyDraws.push(tieBreak.draw);
			const initiativeBase = missionInitiativeBase(state, choice.actorId);
			return {
				choice,
				initiativeBase,
				initiativeTieBreak: tieBreak.draw.value,
				initiative: initiativeBase + tieBreak.draw.value
			};
		})
		.sort(
			(left, right) =>
				right.initiative - left.initiative ||
				left.choice.actorId.localeCompare(right.choice.actorId)
		);
	const missionContent = missionContentForState(state);
	let positions = { ...currentAttempt.positions };
	let knowledge = { ...currentAttempt.knowledge };
	let objective = { ...currentAttempt.turnState.objective };
	const resolvedActions: MissionRound['actions'] = [];

	for (const entry of ranked) {
		const { choice } = entry;
		const fromNodeId = positions[choice.actorId]!;
		let toNodeId = fromNodeId;
		let discoveryIds: string[] = [];
		let objectiveTransition: 'recovered' | 'delivered' | null = null;
		let outcome: 'applied' | 'superseded' = 'applied';
		let summary: string;

		if (choice.actionId.startsWith(MISSION_MOVE_PREFIX)) {
			const edgeId = choice.actionId.slice(MISSION_MOVE_PREFIX.length);
			const edge = missionContent.arena.edges.find((candidate) => candidate.edgeId === edgeId)!;
			toNodeId =
				edge.fromNodeId === fromNodeId
					? edge.toNodeId
					: edge.bidirectional && edge.toNodeId === fromNodeId
						? edge.fromNodeId
						: fromNodeId;
			positions = { ...positions, [choice.actorId]: toNodeId };
			knowledge = visitMissionNode(missionContent, toNodeId, knowledge);
			summary = `Moved from ${fromNodeId} to ${toNodeId}.`;
		} else if (choice.actionId.startsWith(MISSION_INSPECT_PREFIX)) {
			const affordanceId = choice.actionId.slice(MISSION_INSPECT_PREFIX.length);
			const legal = listLegalMissionDiscoveryAffordances(
				missionContent,
				fromNodeId,
				knowledge
			).some((candidate) => candidate.affordanceId === affordanceId);
			if (legal) {
				const before = new Set(knowledge.discoveryIds);
				knowledge = applyMissionDiscoveryAffordance(missionContent, affordanceId, knowledge);
				discoveryIds = knowledge.discoveryIds.filter((id) => !before.has(id));
				summary = `Resolved ${affordanceId} and revealed ${discoveryIds.join(', ')}.`;
			} else {
				outcome = 'superseded';
				summary = `${affordanceId} had already been resolved earlier in initiative.`;
			}
		} else if (choice.actionId.startsWith(MISSION_RECOVER_PREFIX)) {
			if (objective.status === 'available') {
				objective = {
					...objective,
					status: 'carried',
					carrierId: choice.actorId,
					recoveredOnRound: roundNumber
				};
				objectiveTransition = 'recovered';
				summary = 'Lifted the First Ember from its cradle and became its carrier.';
			} else {
				outcome = 'superseded';
				summary = 'The First Ember was already carried when this action resolved.';
			}
		} else {
			summary = 'Held position and preserved the current formation.';
		}

		if (
			objective.status === 'carried' &&
			objective.carrierId === choice.actorId &&
			positions[choice.actorId] === currentAttempt.extractionNodeId
		) {
			objective = {
				...objective,
				status: 'delivered',
				carrierId: null,
				deliveredOnRound: roundNumber
			};
			objectiveTransition = 'delivered';
			summary += ' The carrier returned the objective to the Tower Threshold.';
		}

		resolvedActions.push({
			actorId: choice.actorId,
			actorKind: choice.actorId === currentAttempt.party.masterId ? 'master' : 'hero',
			actionId: choice.actionId,
			choiceSource: choice.source,
			policyId: choice.policyId,
			packetHash: choice.packetHash,
			legalActionHash: choice.legalActionHash,
			policyResultHash: choice.policyResultHash,
			publicIntent: choice.publicIntent,
			initiativeBase: entry.initiativeBase,
			initiativeTieBreak: entry.initiativeTieBreak,
			initiative: entry.initiative,
			outcome,
			fromNodeId,
			toNodeId,
			discoveryIds,
			objectiveTransition,
			summary
		});
	}

	const allAtThreshold = currentAttempt.party.memberIds.every(
		(actorId) => positions[actorId] === currentAttempt.extractionNodeId
	);
	const extractionReady = objective.status === 'delivered' && allAtThreshold;
	const exhausted = roundNumber >= currentAttempt.turnState.maximumRounds && !extractionReady;
	const statusAfter = extractionReady ? 'extraction' : exhausted ? 'failure' : 'resolving';
	const round = MissionRoundSchema.parse({
		roundNumber,
		stateVersion: state.version,
		environmentEventIds: activeMissionEnvironmentEvents(state, roundNumber),
		monsterActionIds: [],
		initiativeOrder: resolvedActions.map((resolved) => resolved.actorId),
		actions: resolvedActions,
		statusAfter
	});
	const completedObjectiveIds = objective.status === 'delivered' ? [objective.objectiveId] : [];
	const mission = MissionRunStateV2Schema.parse({
		...state.mission,
		attempt: {
			...currentAttempt,
			status: statusAfter,
			positions,
			knowledge,
			completedObjectiveIds,
			extractionOpenedAt: extractionReady ? state.simulatedAt : null,
			endedAt: exhausted ? state.simulatedAt : null,
			outcome: exhausted ? 'failure' : null,
			turnState: {
				...currentAttempt.turnState,
				roundNumber,
				objective,
				rounds: [...currentAttempt.turnState.rounds, round]
			}
		}
	});
	return {
		mission,
		round,
		choices,
		entropyCursor: entropy.cursor,
		entropyDraws
	};
}

type MissionCombatTurnResolution = {
	readonly mission:
		| MissionRunStateV3
		| MissionRunStateV4
		| MissionRunStateV6
		| MissionRunStateV7
		| MissionRunStateV8;
	readonly round: MissionRoundV2;
	readonly choices: MissionTurnChoice[];
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
	readonly consequences: (
		MissionHarmRecord | MissionMasterHarmRecord | MissionConsequenceRecordV3
	)[];
	readonly heroes: EngineGameStateV18['heroes'];
	readonly items: EngineGameStateV18['items'];
	readonly society: SocietyStateV4 | SocietyStateV5;
	readonly master: EngineGameStateV18['master'];
	readonly status: EngineGameStateV18['status'];
};

function missionAttackPower(
	state:
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV23,
	actorId: string
): number {
	if (actorId === state.master.masterId) return 1;
	const hero = state.heroes[actorId]!;
	return (
		1 +
		Math.floor(hero.mind.aptitudes.might / 8) +
		Math.floor(hero.progression.skills.swordFighting.rank / 5)
	);
}

function resolveMissionCombatTurn(
	state:
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV23,
	choicesInput: readonly MissionTurnChoice[],
	sourceEventId: string | null = null
): MissionCombatTurnResolution {
	const choices = normalizedMissionTurnChoices(state, choicesInput);
	const currentAttempt = state.mission.attempt!;
	verifiedMonsterPolicyBinding(currentAttempt);
	const missionContent = missionContentForState(state);
	const roundNumber = currentAttempt.turnState.roundNumber + 1;
	const expectedThreatIntents = deriveMonsterIntents(
		missionContent,
		currentAttempt,
		currentAttempt.turnState.monsters,
		currentAttempt.positions
	);
	if (
		hashCanonical(expectedThreatIntents) !==
		hashCanonical(currentAttempt.turnState.currentThreatIntents)
	) {
		throw new ReplayIntegrityError('Monster threat telegraph diverged', state.eventCursor);
	}

	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const ranked = [
		...choices.map((choice) => ({
			actorKind: 'party' as const,
			actorId: choice.actorId,
			choice,
			intent: null
		})),
		...currentAttempt.turnState.currentThreatIntents.map((intent) => ({
			actorKind: 'monster' as const,
			actorId: intent.monsterId,
			choice: null,
			intent
		}))
	]
		.map((entry) => {
			const tieBreak = drawInteger(entropy, 'initiative-tie-break', 0, 99);
			entropy = tieBreak.next;
			entropyDraws.push(tieBreak.draw);
			const initiativeBase =
				entry.actorKind === 'party'
					? missionInitiativeBase(state, entry.actorId)
					: monsterPolicy(entry.intent!.policyId).initiativeBase;
			return {
				...entry,
				initiativeBase,
				initiativeTieBreak: tieBreak.draw.value,
				initiative: initiativeBase + tieBreak.draw.value
			};
		})
		.sort(
			(left, right) =>
				right.initiative - left.initiative || left.actorId.localeCompare(right.actorId)
		);

	let positions = { ...currentAttempt.positions };
	let knowledge = { ...currentAttempt.knowledge };
	let objective = { ...currentAttempt.turnState.objective };
	let arena = { ...currentAttempt.turnState.arena };
	const missionEvidence =
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? { ...state.mission.evidence }
			: null;
	const monsters = structuredClone(currentAttempt.turnState.monsters);
	const partyGuard = structuredClone(currentAttempt.turnState.partyGuard);
	const heroes = structuredClone(state.heroes) as EngineGameStateV18['heroes'];
	const items = structuredClone(state.items) as EngineGameStateV18['items'];
	let master = structuredClone(state.master) as EngineGameStateV18['master'];
	const parseMissionSociety = (value: unknown): SocietyStateV4 | SocietyStateV5 =>
		state.schemaVersion === 23
			? SocietyStateV5Schema.parse(value)
			: SocietyStateV4Schema.parse(value);
	let society = parseMissionSociety(structuredClone(state.society));
	const consequences: (MissionHarmRecord | MissionMasterHarmRecord | MissionConsequenceRecordV3)[] =
		[];
	const environmentEventIds = activeMissionEnvironmentEvents(state, roundNumber);
	const effects: MissionResolvedEffect[] = [];
	const resolvedPartyActions: MissionRoundV2['actions'] = [];
	const resolvedMonsterActions: MissionRoundV2['monsterActions'] = [];
	const defending = new Set<string>();
	const effect = (input: Omit<MissionResolvedEffect, 'effectId'>): MissionResolvedEffect =>
		MissionResolvedEffectSchema.parse({
			...input,
			effectId: deterministicUuid(
				`${currentAttempt.attemptId}:round:${roundNumber}:effect:${effects.length}`
			)
		});
	const applyMissionHarm = (
		sourceKind: 'monster' | 'environment',
		sourceId: string,
		targetId: string,
		amount: number
	): void => {
		if (
			(state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				state.schemaVersion !== 23) ||
			amount <= 0
		)
			return;
		if (!sourceEventId) {
			throw new ReplayIntegrityError('Mission aftermath lacks a source event', state.eventCursor);
		}
		if (
			(state.schemaVersion === 17 ||
				state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23) &&
			targetId === master.masterId
		) {
			if (master.lifeState !== 'alive') return;
			const nodeId = positions[targetId]!;
			const healthBefore = master.health;
			const damage = Math.min(healthBefore, amount * (sourceKind === 'environment' ? 100 : 25));
			if (damage <= 0) return;
			const healthAfter = healthBefore - damage;
			const fatal = healthAfter === 0;
			const consequenceId = deterministicUuid(
				`${sourceEventId}:mission-master-harm:${roundNumber}:${consequences.length}`
			);
			const injury = fatal
				? null
				: InjurySchema.parse({
						injuryId: deterministicUuid(`${consequenceId}:injury`),
						kind: damage >= 50 ? 'critical' : damage >= 20 ? 'strain' : 'bruise',
						severity: damage,
						inflictedAt: state.simulatedAt
					});
			master = {
				...master,
				health: healthAfter,
				lifeState: fatal ? 'dead' : 'alive',
				injuries: injury ? [...master.injuries, injury] : master.injuries
			};
			if (fatal) {
				for (const [heroId, hero] of Object.entries(heroes)) {
					heroes[heroId] = {
						...hero,
						currentActivity: null,
						currentTravel: null,
						currentRoutine: null,
						dailyPlan: skipUnfinishedPlan(hero, state.simulatedAt)
					};
				}
			}
			const witnessHeroIds = currentAttempt.party.heroIds
				.filter((heroId) => positions[heroId] === nodeId && heroes[heroId]?.lifeState === 'active')
				.sort((left, right) => left.localeCompare(right));
			const witnesses = witnessHeroIds.map((heroId) => {
				const observationId = deterministicUuid(`${consequenceId}:${heroId}:observation`);
				const relationshipId = deterministicUuid(`${heroId}:${master.masterId}:relationship`);
				const summary = fatal
					? 'I saw the Master die after their mission guard failed. The run ended with them.'
					: 'I saw the Master wounded after their mission guard failed.';
				const deltas = fatal
					? { trust: -15, respect: -10, fear: 20, affection: 0, resentment: 5, debt: 0 }
					: { trust: 1, respect: 4, fear: 2, affection: 0, resentment: 0, debt: 0 };
				const existing = society.relationships[relationshipId];
				const dimensions = existing?.dimensions ?? {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				};
				society = parseMissionSociety({
					...society,
					observations: {
						...society.observations,
						[observationId]: {
							observationId,
							sourceEventId,
							observerHeroId: heroId,
							observedAt: state.simulatedAt,
							kind: fatal ? 'mission-death' : 'mission-injury',
							summary,
							subjectIds: [master.masterId]
						}
					},
					relationships: {
						...society.relationships,
						[relationshipId]: {
							relationshipId,
							fromHeroId: heroId,
							toEntityId: master.masterId,
							dimensions: {
								trust: clampSocial(dimensions.trust + deltas.trust),
								respect: clampSocial(dimensions.respect + deltas.respect),
								fear: clampSocial(dimensions.fear + deltas.fear),
								affection: clampSocial(dimensions.affection + deltas.affection),
								resentment: clampSocial(dimensions.resentment + deltas.resentment),
								debt: clampSocial(dimensions.debt + deltas.debt)
							},
							updatedAt: state.simulatedAt,
							lastSourceEventId: sourceEventId,
							evidence: [
								...(existing?.evidence ?? []),
								{ sourceEventId, observationId, summary, deltas }
							].slice(-64)
						}
					}
				});
				return { heroId, observationId, relationshipId };
			});
			consequences.push(
				(state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23
					? MissionConsequenceRecordV3Schema
					: MissionMasterHarmRecordSchema
				).parse({
					consequenceKind: 'master-harm',
					consequenceId,
					sourceEventId,
					...(state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20 ||
					state.schemaVersion === 23
						? { sourceAttemptId: currentAttempt.attemptId }
						: {}),
					sourceKind,
					sourceId,
					targetMasterId: master.masterId,
					nodeId,
					roundNumber,
					guardAfterImpact: 0,
					healthBefore,
					healthAfter,
					damage,
					injury,
					fatal,
					witnesses,
					summary: fatal
						? `The Master died at ${nodeId}; the run ended atomically.`
						: `The Master suffered ${damage} persistent damage at ${nodeId}.`
				})
			);
			return;
		}
		const hero = heroes[targetId];
		if (!hero || hero.lifeState !== 'active') return;
		const nodeId = positions[targetId]!;
		const damage = Math.min(hero.health, amount * (sourceKind === 'environment' ? 100 : 25));
		if (damage <= 0) return;
		const healthAfter = hero.health - damage;
		const fatal = healthAfter === 0;
		const consequenceId = deterministicUuid(
			`${sourceEventId}:mission-harm:${roundNumber}:${consequences.length}`
		);
		const injury = fatal
			? null
			: InjurySchema.parse({
					injuryId: deterministicUuid(`${consequenceId}:injury`),
					kind: damage >= 50 ? 'critical' : damage >= 20 ? 'strain' : 'bruise',
					severity: damage,
					inflictedAt: state.simulatedAt
				});
		const equippedItemId = hero.equipment.mainHand;
		const equippedItem = equippedItemId ? items[equippedItemId] : null;
		const itemWear =
			equippedItem && equippedItem.durability > 0
				? {
						itemId: equippedItem.itemId,
						durabilityBefore: equippedItem.durability,
						durabilityAfter: equippedItem.durability - 1
					}
				: null;
		if (itemWear && equippedItem) {
			items[equippedItem.itemId] = {
				...equippedItem,
				durability: itemWear.durabilityAfter
			};
		}
		heroes[targetId] = {
			...hero,
			health: healthAfter,
			lifeState: fatal ? 'dead' : 'active',
			injuries: injury ? [...hero.injuries, injury] : hero.injuries,
			currentActivity: fatal ? null : hero.currentActivity,
			currentTravel: fatal ? null : hero.currentTravel,
			assignment: fatal ? null : hero.assignment,
			currentRoutine: fatal ? null : hero.currentRoutine,
			dailyPlan: fatal ? skipUnfinishedPlan(hero, state.simulatedAt) : hero.dailyPlan
		};

		const witnessHeroIds = currentAttempt.party.heroIds
			.filter(
				(heroId) =>
					positions[heroId] === nodeId &&
					heroes[heroId]?.lifeState === 'active' &&
					(!fatal || heroId !== targetId)
			)
			.sort((left, right) => left.localeCompare(right));
		const witnesses = witnessHeroIds.map((heroId) => {
			const observationId = deterministicUuid(`${consequenceId}:${heroId}:observation`);
			const relationshipId = deterministicUuid(`${heroId}:${state.master.masterId}:relationship`);
			const selfWitness = heroId === targetId;
			const summary = fatal
				? 'I saw a summoned companion die after the mission guard failed.'
				: selfWitness
					? "My mission guard failed and I was wounded under the Master's command."
					: 'I saw a summoned companion wounded after the mission guard failed.';
			const deltas = fatal
				? { trust: -12, respect: -8, fear: 8, affection: 0, resentment: 16, debt: 0 }
				: selfWitness
					? { trust: -3, respect: -1, fear: 2, affection: 0, resentment: 2, debt: 0 }
					: { trust: -1, respect: -1, fear: 1, affection: 0, resentment: 1, debt: 0 };
			const existing = society.relationships[relationshipId];
			const dimensions = existing?.dimensions ?? {
				trust: 0,
				respect: 0,
				fear: 0,
				affection: 0,
				resentment: 0,
				debt: 0
			};
			society = parseMissionSociety({
				...society,
				observations: {
					...society.observations,
					[observationId]: {
						observationId,
						sourceEventId,
						observerHeroId: heroId,
						observedAt: state.simulatedAt,
						kind: fatal ? 'mission-death' : 'mission-injury',
						summary,
						subjectIds: [targetId, state.master.masterId]
					}
				},
				relationships: {
					...society.relationships,
					[relationshipId]: {
						relationshipId,
						fromHeroId: heroId,
						toEntityId: state.master.masterId,
						dimensions: {
							trust: clampSocial(dimensions.trust + deltas.trust),
							respect: clampSocial(dimensions.respect + deltas.respect),
							fear: clampSocial(dimensions.fear + deltas.fear),
							affection: clampSocial(dimensions.affection + deltas.affection),
							resentment: clampSocial(dimensions.resentment + deltas.resentment),
							debt: clampSocial(dimensions.debt + deltas.debt)
						},
						updatedAt: state.simulatedAt,
						lastSourceEventId: sourceEventId,
						evidence: [
							...(existing?.evidence ?? []),
							{ sourceEventId, observationId, summary, deltas }
						].slice(-64)
					}
				}
			});
			return { heroId, observationId, relationshipId };
		});
		consequences.push(
			(state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23
				? MissionConsequenceRecordV3Schema
				: MissionHarmRecordSchema
			).parse({
				consequenceId,
				sourceEventId,
				...(state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23
					? { sourceAttemptId: currentAttempt.attemptId }
					: {}),
				sourceKind,
				sourceId,
				targetHeroId: targetId,
				nodeId,
				roundNumber,
				guardAfterImpact: 0,
				healthBefore: hero.health,
				healthAfter,
				damage,
				injury,
				itemWear,
				fatal,
				witnesses,
				summary: fatal
					? `A hero died permanently at ${nodeId} after exposed ${sourceKind} harm.`
					: `A hero suffered ${damage} persistent damage at ${nodeId}; equipment wear and witnessed memory were recorded.`
			})
		);
	};
	const damageGuard = (
		sourceKind: 'monster' | 'environment',
		sourceId: string,
		targetId: string,
		amount: number,
		summary: string
	): MissionResolvedEffect => {
		const beforeState = partyGuard[targetId]!;
		const after = Math.max(0, beforeState.guard - amount);
		partyGuard[targetId] = {
			...beforeState,
			guard: after,
			status: after > 0 ? 'ready' : 'exposed',
			lastChangedOnRound: roundNumber
		};
		if (after === 0) applyMissionHarm(sourceKind, sourceId, targetId, amount);
		return effect({
			sourceKind,
			sourceId,
			targetKind: 'party',
			targetId,
			kind: 'guard-damage',
			amount,
			before: beforeState.guard,
			after,
			summary
		});
	};

	for (const eventId of environmentEventIds) {
		const hazardNodeId = eventId === 'first-ember-pulse' ? 'ember-vault' : null;
		if (!hazardNodeId) continue;
		for (const actorId of currentAttempt.party.memberIds) {
			if (positions[actorId] !== hazardNodeId) continue;
			const applied = damageGuard(
				'environment',
				eventId,
				actorId,
				1,
				eventId === 'red-slag-fall'
					? 'The Red Gallery slag fall stripped 1 mission guard beneath the vents.'
					: 'The First Ember pulse stripped 1 mission guard in the Ember Vault.'
			);
			effects.push(applied);
		}
	}

	for (const entry of ranked) {
		if (entry.actorKind === 'party') {
			const choice = entry.choice!;
			const fromNodeId = positions[choice.actorId]!;
			let toNodeId = fromNodeId;
			let targetId: string | null = null;
			let discoveryIds: string[] = [];
			let objectiveTransition: 'recovered' | 'delivered' | null = null;
			let outcome: 'applied' | 'superseded' = 'applied';
			let summary: string;
			const effectIds: string[] = [];
			const fallenActor =
				(choice.actorId === master.masterId && master.lifeState === 'dead') ||
				heroes[choice.actorId]?.lifeState === 'dead';

			if (fallenActor) {
				outcome = 'superseded';
				summary =
					choice.actorId === master.masterId
						? 'The Master died before their declared action reached initiative.'
						: 'The hero fell before their declared action reached initiative.';
			} else if (choice.actionId.startsWith(MISSION_MOVE_PREFIX)) {
				const edgeId = choice.actionId.slice(MISSION_MOVE_PREFIX.length);
				const edge = missionContent.arena.edges.find((candidate) => candidate.edgeId === edgeId)!;
				toNodeId =
					edge.fromNodeId === fromNodeId
						? edge.toNodeId
						: edge.bidirectional && edge.toNodeId === fromNodeId
							? edge.fromNodeId
							: fromNodeId;
				positions = { ...positions, [choice.actorId]: toNodeId };
				knowledge = visitMissionNode(missionContent, toNodeId, knowledge);
				summary = `Moved from ${fromNodeId} to ${toNodeId}.`;
			} else if (choice.actionId.startsWith(MISSION_INSPECT_PREFIX)) {
				const affordanceId = choice.actionId.slice(MISSION_INSPECT_PREFIX.length);
				const toolTags = missionToolTagsForActor(state, choice.actorId);
				const legal = listLegalMissionDiscoveryAffordances(
					missionContent,
					fromNodeId,
					knowledge,
					toolTags
				).some((candidate) => candidate.affordanceId === affordanceId);
				if (legal) {
					const before = new Set(knowledge.discoveryIds);
					knowledge = applyMissionDiscoveryAffordance(
						missionContent,
						affordanceId,
						knowledge,
						toolTags
					);
					discoveryIds = knowledge.discoveryIds.filter((id) => !before.has(id));
					if (
						(state.schemaVersion === 14 ||
							state.schemaVersion === 16 ||
							state.schemaVersion === 17 ||
							state.schemaVersion === 18 ||
							state.schemaVersion === 19 ||
							state.schemaVersion === 20 ||
							state.schemaVersion === 23) &&
						missionContent.missionId === 'tower-floor-04' &&
						discoveryIds.includes('foundry-maintenance-route')
					) {
						const evidenceId = deterministicUuid(
							`${currentAttempt.attemptId}:${choice.actorId}:foundry-maintenance-route`
						);
						missionEvidence![evidenceId] = {
							evidenceId,
							evidenceKey: 'foundry-maintenance-route',
							holderActorId: choice.actorId,
							sourceBinding: state.mission.binding,
							sourceAttemptId: currentAttempt.attemptId,
							discoveredOnRound: roundNumber
						};
					}
					if (
						(state.schemaVersion === 14 ||
							state.schemaVersion === 16 ||
							state.schemaVersion === 17 ||
							state.schemaVersion === 18 ||
							state.schemaVersion === 19 ||
							state.schemaVersion === 20 ||
							state.schemaVersion === 23) &&
						missionContent.missionId === 'tower-floor-05' &&
						discoveryIds.includes('foundry-maintenance-route')
					) {
						arena = { ...arena, coolingControlExposed: true };
					}
					summary = `Resolved ${affordanceId} and revealed ${discoveryIds.join(', ')}.`;
				} else {
					outcome = 'superseded';
					summary = `${affordanceId} had already been resolved earlier in initiative.`;
				}
			} else if (choice.actionId.startsWith(MISSION_RECOVER_PREFIX)) {
				if (objective.status === 'available') {
					objective = {
						...objective,
						status: 'carried',
						carrierId: choice.actorId,
						recoveredOnRound: roundNumber
					};
					objectiveTransition = 'recovered';
					summary = 'Lifted the First Ember from its cradle and became its carrier.';
				} else {
					outcome = 'superseded';
					summary = 'The First Ember was already carried when this action resolved.';
				}
			} else if (choice.actionId === MISSION_COOLING_CONTROL_ACTION_ID) {
				const before = arena.furnaceState;
				const after = before === 'lit' ? 'cooling' : before === 'cooling' ? 'quenched' : before;
				if (
					(state.schemaVersion !== 14 &&
						state.schemaVersion !== 16 &&
						state.schemaVersion !== 17 &&
						state.schemaVersion !== 18 &&
						state.schemaVersion !== 19 &&
						state.schemaVersion !== 20 &&
						state.schemaVersion !== 23) ||
					fromNodeId !== arena.coolingControlNodeId ||
					!knowledge.discoveryIds.includes('cooling-control-weakness') ||
					after === before
				) {
					outcome = 'superseded';
					summary = 'The cooling wheel could not change the furnace in this state.';
				} else {
					arena = { ...arena, furnaceState: after };
					const applied = effect({
						sourceKind: 'party',
						sourceId: choice.actorId,
						targetKind: 'arena',
						targetId: 'foundry-furnace',
						kind: 'furnace-change',
						amount: 1,
						before: null,
						after: null,
						summary: `The cooling wheel changed the furnace from ${before} to ${after}.`
					});
					effects.push(applied);
					effectIds.push(applied.effectId);
					summary = applied.summary;
				}
			} else if (choice.actionId.startsWith(MISSION_ATTACK_PREFIX)) {
				targetId = choice.actionId.slice(MISSION_ATTACK_PREFIX.length);
				const monster = monsters[targetId];
				if (!monster || monster.status !== 'active' || monster.nodeId !== fromNodeId) {
					outcome = 'superseded';
					summary = 'The selected threat was no longer a legal co-located target.';
				} else {
					const before = monster.vitality;
					const raw = missionAttackPower(state, choice.actorId);
					const reduction = monsterArmorReduction(monster.policyId, arena.furnaceState);
					const amount = Math.min(before, Math.max(0, raw - reduction));
					const after = before - amount;
					monsters[targetId] = {
						...monster,
						vitality: after,
						status: after === 0 ? 'defeated' : 'active',
						alertState: after === 0 ? monster.alertState : 'engaged',
						defeatedOnRound: after === 0 ? roundNumber : null
					};
					const applied = effect({
						sourceKind: 'party',
						sourceId: choice.actorId,
						targetKind: 'monster',
						targetId,
						kind: 'vitality-damage',
						amount,
						before,
						after,
						summary:
							amount > 0
								? `${monster.label} lost ${amount} vitality after ${reduction} armor reduction.`
								: `${monster.label}'s armor absorbed the ${raw}-power strike.`
					});
					effects.push(applied);
					effectIds.push(applied.effectId);
					summary =
						after === 0
							? `${monster.label} was defeated by an engine-resolved strike.`
							: `${monster.label} remains active at ${after}/${monster.maximumVitality} vitality.`;
				}
			} else {
				defending.add(choice.actorId);
				summary =
					'Held position; earlier initiative reduces incoming guard damage by 1 this round.';
			}

			if (
				objective.status === 'carried' &&
				objective.carrierId === choice.actorId &&
				positions[choice.actorId] === currentAttempt.extractionNodeId
			) {
				objective = {
					...objective,
					status: 'delivered',
					carrierId: null,
					deliveredOnRound: roundNumber
				};
				objectiveTransition = 'delivered';
				summary += ' The carrier returned the objective to the Tower Threshold.';
			}

			resolvedPartyActions.push({
				actorId: choice.actorId,
				actorKind: choice.actorId === currentAttempt.party.masterId ? 'master' : 'hero',
				actionId: choice.actionId,
				choiceSource: choice.source,
				policyId: choice.policyId,
				packetHash: choice.packetHash,
				legalActionHash: choice.legalActionHash,
				policyResultHash: choice.policyResultHash,
				publicIntent: choice.publicIntent,
				initiativeBase: entry.initiativeBase,
				initiativeTieBreak: entry.initiativeTieBreak,
				initiative: entry.initiative,
				outcome,
				fromNodeId,
				toNodeId,
				targetId,
				discoveryIds,
				objectiveTransition,
				effectIds,
				summary
			});
			continue;
		}

		const intent = entry.intent!;
		const monster = monsters[intent.monsterId]!;
		const fromNodeId = monster.nodeId;
		let toNodeId = fromNodeId;
		let outcome: 'applied' | 'superseded' = 'applied';
		let summary: string;
		const effectIds: string[] = [];
		if (monster.status !== 'active') {
			outcome = 'superseded';
			summary = `${monster.label} was defeated before its telegraphed action resolved.`;
		} else if (intent.kind === 'move') {
			const legalMove = missionContent.arena.edges.some(
				(edge) =>
					edge.access.kind === 'open' &&
					((edge.fromNodeId === fromNodeId && edge.toNodeId === intent.toNodeId) ||
						(edge.bidirectional &&
							edge.toNodeId === fromNodeId &&
							edge.fromNodeId === intent.toNodeId))
			);
			if (!legalMove) {
				outcome = 'superseded';
				summary = `${monster.label} could not follow its authored duty edge.`;
			} else {
				toNodeId = intent.toNodeId;
				monsters[intent.monsterId] = {
					...monster,
					nodeId: toNodeId,
					lastActionId: intent.actionId
				};
				summary = `${monster.label} moved from ${fromNodeId} to ${toNodeId}.`;
			}
		} else if (intent.kind === 'alarm') {
			monsters[intent.monsterId] = {
				...monster,
				alertState: 'alarmed',
				lastActionId: intent.actionId
			};
			const applied = effect({
				sourceKind: 'monster',
				sourceId: intent.monsterId,
				targetKind: 'arena',
				targetId: monster.dutySlotId,
				kind: 'alarm',
				amount: 0,
				before: null,
				after: null,
				summary: `${monster.label} raised the cradle alarm and entered an alarmed duty state.`
			});
			effects.push(applied);
			effectIds.push(applied.effectId);
			summary = applied.summary;
		} else if (
			intent.kind === 'strike' ||
			intent.kind === 'furnace-surge' ||
			intent.kind === 'defend-control'
		) {
			const targetId = intent.targetId!;
			const impactNodeId = intent.kind === 'defend-control' ? intent.toNodeId : monster.nodeId;
			const interceptIsAuthored =
				intent.kind !== 'defend-control' ||
				missionContent.arena.edges.some(
					(edge) =>
						(edge.fromNodeId === monster.nodeId && edge.toNodeId === impactNodeId) ||
						(edge.bidirectional &&
							edge.toNodeId === monster.nodeId &&
							edge.fromNodeId === impactNodeId)
				);
			if (
				positions[targetId] !== impactNodeId ||
				!interceptIsAuthored ||
				((state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20 ||
					state.schemaVersion === 23) &&
					((targetId === master.masterId && master.lifeState === 'dead') ||
						heroes[targetId]?.lifeState === 'dead'))
			) {
				outcome = 'superseded';
				summary =
					(state.schemaVersion === 16 ||
						state.schemaVersion === 17 ||
						state.schemaVersion === 18 ||
						state.schemaVersion === 19 ||
						state.schemaVersion === 20 ||
						state.schemaVersion === 23) &&
					((targetId === master.masterId && master.lifeState === 'dead') ||
						heroes[targetId]?.lifeState === 'dead')
						? `${monster.label}'s target had already fallen before impact.`
						: `${monster.label}'s target left the threatened node before impact.`;
			} else {
				toNodeId = impactNodeId;
				const basePower = monsterPolicy(monster.policyId).strikePower;
				const surge = intent.kind === 'furnace-surge' && arena.furnaceState === 'lit' ? 1 : 0;
				const amount = Math.max(0, basePower + surge - (defending.has(targetId) ? 1 : 0));
				const applied = damageGuard(
					'monster',
					intent.monsterId,
					targetId,
					amount,
					`${monster.label} dealt ${amount} mission-guard damage${defending.has(targetId) ? ' after defense' : ''}.`
				);
				effects.push(applied);
				effectIds.push(applied.effectId);
				monsters[intent.monsterId] = {
					...monster,
					nodeId: toNodeId,
					alertState: 'engaged',
					lastActionId: intent.actionId
				};
				summary = applied.summary;
			}
		} else {
			monsters[intent.monsterId] = { ...monster, lastActionId: intent.actionId };
			summary = `${monster.label} held its authored duty position.`;
		}

		resolvedMonsterActions.push({
			monsterId: intent.monsterId,
			policyId: intent.policyId,
			actionId: intent.actionId,
			kind: intent.kind,
			initiativeBase: entry.initiativeBase,
			initiativeTieBreak: entry.initiativeTieBreak,
			initiative: entry.initiative,
			outcome,
			fromNodeId,
			toNodeId,
			targetId: intent.targetId,
			effectIds,
			summary
		});
	}

	if (
		(state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
		environmentEventIds.includes('red-slag-fall')
	) {
		for (const actorId of currentAttempt.party.memberIds) {
			if (positions[actorId] !== 'red-gallery') continue;
			const applied = damageGuard(
				'environment',
				'red-slag-fall',
				actorId,
				1,
				'The Red Gallery slag fall stripped 1 mission guard beneath the vents.'
			);
			effects.push(applied);
		}
	}

	const objectiveDefinition = missionContent.objectives.find(
		(candidate) => candidate.objectiveId === objective.objectiveId
	)!;
	const completionRule = objectiveDefinition.completionRule;
	if (objective.status === 'available' && completionRule.kind === 'defeat-duty') {
		const dutyMonsters = Object.values(monsters).filter(
			(monster) => monster.dutySlotId === completionRule.dutySlotId
		);
		if (dutyMonsters.length > 0 && dutyMonsters.every((monster) => monster.status === 'defeated')) {
			objective = {
				...objective,
				status: 'delivered',
				carrierId: null,
				recoveredOnRound: roundNumber,
				deliveredOnRound: roundNumber
			};
		}
	}

	const allAtThreshold = currentAttempt.party.memberIds.every(
		(actorId) => positions[actorId] === currentAttempt.extractionNodeId
	);
	const extractionReady = objective.status === 'delivered' && allAtThreshold;
	const exhausted = roundNumber >= currentAttempt.turnState.maximumRounds && !extractionReady;
	const fatal = consequences.some((consequence) => consequence.fatal);
	const masterFatal = consequences.some(
		(consequence) => 'consequenceKind' in consequence && consequence.fatal
	);
	const statusAfter = fatal
		? 'death'
		: extractionReady
			? 'extraction'
			: exhausted
				? 'failure'
				: 'resolving';
	const round = MissionRoundV2Schema.parse({
		roundVersion: 'mission-round-v2',
		roundNumber,
		stateVersion: state.version,
		environmentEventIds,
		threatIntents: currentAttempt.turnState.currentThreatIntents,
		monsterActionIds: resolvedMonsterActions.map((action) => action.actionId),
		initiativeOrder: ranked.map((entry) => entry.actorId),
		actions: resolvedPartyActions,
		monsterActions: resolvedMonsterActions,
		effects,
		statusAfter
	});
	const completedObjectiveIds = objective.status === 'delivered' ? [objective.objectiveId] : [];
	const nextThreatIntents =
		statusAfter === 'resolving'
			? deriveMonsterIntents(missionContent, currentAttempt, monsters, positions, objective, arena)
			: [];
	const missionSchema =
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? MissionRunStateV8Schema
			: state.schemaVersion === 17
				? MissionRunStateV7Schema
				: state.schemaVersion === 16
					? MissionRunStateV6Schema
					: state.schemaVersion === 14
						? MissionRunStateV4Schema
						: MissionRunStateV3Schema;
	const mission = missionSchema.parse({
		...state.mission,
		...(state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? { evidence: missionEvidence }
			: {}),
		...(state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? {
					aftermath: {
						...state.mission.aftermath,
						consequences: [...state.mission.aftermath.consequences, ...consequences]
					}
				}
			: {}),
		attempt: {
			...currentAttempt,
			status: statusAfter,
			positions,
			knowledge,
			completedObjectiveIds,
			extractionOpenedAt: extractionReady ? state.simulatedAt : null,
			endedAt: fatal || exhausted ? state.simulatedAt : null,
			outcome: fatal ? 'death' : exhausted ? 'failure' : null,
			turnState: {
				...currentAttempt.turnState,
				roundNumber,
				objective,
				monsters,
				partyGuard,
				arena,
				currentThreatIntents: nextThreatIntents,
				rounds: [...currentAttempt.turnState.rounds, round]
			}
		}
	});
	return {
		mission,
		round,
		choices,
		entropyCursor: entropy.cursor,
		entropyDraws,
		consequences,
		heroes,
		items,
		society,
		master,
		status: masterFatal ? 'game_over' : state.status
	};
}

function portalPressureStage(
	roundsRemaining: number,
	warningAtRemainingRounds: number,
	criticalAtRemainingRounds: number
): 'stable' | 'warning' | 'critical' | 'collapsed' {
	if (roundsRemaining === 0) return 'collapsed';
	if (roundsRemaining <= criticalAtRemainingRounds) return 'critical';
	if (roundsRemaining <= warningAtRemainingRounds) return 'warning';
	return 'stable';
}

type PortalAttempt = NonNullable<EngineGameStateV15['mission']['attempt']>;
type PortalRuntime = PortalAttempt['turnState']['portal'];
type PortalOreEntry = PortalRuntime['oreLedger'][number];

function appendPortalCargoLosses(
	attempt: PortalAttempt,
	portalInput: PortalRuntime,
	roundNumber: number,
	positions: Readonly<Record<string, string>> = attempt.positions
): PortalRuntime {
	let portal = structuredClone(portalInput);
	for (const actorId of attempt.party.memberIds) {
		const cargo = portal.cargo[actorId]!;
		if (cargo.amount === 0) continue;
		const entry: PortalOreEntry = {
			entryId: deterministicUuid(
				`${attempt.attemptId}:round:${roundNumber}:ore:${portal.oreLedger.length + 1}:lost`
			),
			sequence: portal.oreLedger.length + 1,
			roundNumber,
			kind: 'lost',
			actorId,
			depositId: null,
			nodeId: positions[actorId] ?? attempt.extractionNodeId,
			amount: cargo.amount,
			cargoBefore: cargo.amount,
			cargoAfter: 0,
			depositBefore: null,
			depositAfter: null,
			settlementBefore: null,
			settlementAfter: null
		};
		portal = {
			...portal,
			cargo: { ...portal.cargo, [actorId]: { ...cargo, amount: 0 } },
			oreLedger: [...portal.oreLedger, entry]
		};
	}
	return portal;
}

type PortalTurnResolution = {
	readonly mission: MissionRunStateV5;
	readonly round: MissionRoundV3;
	readonly choices: MissionTurnChoice[];
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
};

function resolvePortalMissionTurn(
	state: EngineGameStateV15,
	choicesInput: readonly MissionTurnChoice[]
): PortalTurnResolution {
	const choices = normalizedMissionTurnChoices(state, choicesInput);
	const currentAttempt = state.mission.attempt!;
	const missionContent = missionContentForState(state);
	const roundNumber = currentAttempt.turnState.roundNumber + 1;
	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const ranked = choices
		.map((choice) => {
			const tieBreak = drawInteger(entropy, 'initiative-tie-break', 0, 99);
			entropy = tieBreak.next;
			entropyDraws.push(tieBreak.draw);
			const initiativeBase = missionInitiativeBase(state, choice.actorId);
			return {
				choice,
				initiativeBase,
				initiativeTieBreak: tieBreak.draw.value,
				initiative: initiativeBase + tieBreak.draw.value
			};
		})
		.sort(
			(left, right) =>
				right.initiative - left.initiative ||
				left.choice.actorId.localeCompare(right.choice.actorId)
		);

	let positions = { ...currentAttempt.positions };
	let knowledge = { ...currentAttempt.knowledge };
	let objective = { ...currentAttempt.turnState.objective };
	let portal = structuredClone(currentAttempt.turnState.portal);
	const oreLedgerStart = portal.oreLedger.length;
	const resolvedActions: MissionRoundV3['actions'] = [];

	for (const entry of ranked) {
		const { choice } = entry;
		const fromNodeId = positions[choice.actorId]!;
		let toNodeId = fromNodeId;
		let discoveryIds: string[] = [];
		let objectiveTransition: 'recovered' | 'delivered' | null = null;
		let outcome: 'applied' | 'superseded' = 'applied';
		let summary: string;

		if (choice.actionId.startsWith(MISSION_MOVE_PREFIX)) {
			const edgeId = choice.actionId.slice(MISSION_MOVE_PREFIX.length);
			const edge = missionContent.arena.edges.find((candidate) => candidate.edgeId === edgeId)!;
			toNodeId =
				edge.fromNodeId === fromNodeId
					? edge.toNodeId
					: edge.bidirectional && edge.toNodeId === fromNodeId
						? edge.fromNodeId
						: fromNodeId;
			positions = { ...positions, [choice.actorId]: toNodeId };
			knowledge = visitMissionNode(missionContent, toNodeId, knowledge);
			summary = `Moved from ${fromNodeId} to ${toNodeId} with ${portal.cargo[choice.actorId]!.amount} ore in cargo.`;
		} else if (choice.actionId.startsWith(MISSION_INSPECT_PREFIX)) {
			const affordanceId = choice.actionId.slice(MISSION_INSPECT_PREFIX.length);
			const legal = listLegalMissionDiscoveryAffordances(
				missionContent,
				fromNodeId,
				knowledge
			).some((candidate) => candidate.affordanceId === affordanceId);
			if (legal) {
				const before = new Set(knowledge.discoveryIds);
				knowledge = applyMissionDiscoveryAffordance(missionContent, affordanceId, knowledge);
				discoveryIds = knowledge.discoveryIds.filter((id) => !before.has(id));
				summary = `Resolved ${affordanceId} and revealed ${discoveryIds.join(', ')}.`;
			} else {
				outcome = 'superseded';
				summary = `${affordanceId} had already resolved earlier in initiative.`;
			}
		} else if (choice.actionId.startsWith(MISSION_MINE_PREFIX)) {
			const depositId = choice.actionId.slice(MISSION_MINE_PREFIX.length);
			const deposit = portal.deposits[depositId];
			const cargo = portal.cargo[choice.actorId]!;
			const amount = deposit
				? Math.min(
						deposit.mineAmountPerAction,
						deposit.remainingAmount,
						cargo.capacity - cargo.amount
					)
				: 0;
			if (!deposit || deposit.nodeId !== fromNodeId || amount <= 0) {
				outcome = 'superseded';
				summary = 'The selected ore was depleted or cargo had filled earlier in initiative.';
			} else {
				const ledgerEntry: PortalOreEntry = {
					entryId: deterministicUuid(
						`${currentAttempt.attemptId}:round:${roundNumber}:ore:${portal.oreLedger.length + 1}:mined`
					),
					sequence: portal.oreLedger.length + 1,
					roundNumber,
					kind: 'mined',
					actorId: choice.actorId,
					depositId,
					nodeId: fromNodeId,
					amount,
					cargoBefore: cargo.amount,
					cargoAfter: cargo.amount + amount,
					depositBefore: deposit.remainingAmount,
					depositAfter: deposit.remainingAmount - amount,
					settlementBefore: null,
					settlementAfter: null
				};
				portal = {
					...portal,
					deposits: {
						...portal.deposits,
						[depositId]: { ...deposit, remainingAmount: deposit.remainingAmount - amount }
					},
					cargo: {
						...portal.cargo,
						[choice.actorId]: { ...cargo, amount: cargo.amount + amount }
					},
					oreLedger: [...portal.oreLedger, ledgerEntry]
				};
				const minedAmount = objective.minedAmount + amount;
				if (objective.status === 'available' && minedAmount >= objective.quota) {
					objective = {
						...objective,
						status: 'quota-met',
						minedAmount,
						quotaReachedOnRound: roundNumber
					};
					objectiveTransition = 'recovered';
				} else {
					objective = { ...objective, minedAmount };
				}
				summary = `Mined ${amount} iron ore from ${depositId}; cargo is ${cargo.amount + amount}/${cargo.capacity}.`;
			}
		} else {
			summary = 'Held position against the Iron Moon wind.';
		}

		resolvedActions.push({
			actorId: choice.actorId,
			actorKind: choice.actorId === currentAttempt.party.masterId ? 'master' : 'hero',
			actionId: choice.actionId,
			choiceSource: choice.source,
			policyId: choice.policyId,
			packetHash: choice.packetHash,
			legalActionHash: choice.legalActionHash,
			policyResultHash: choice.policyResultHash,
			publicIntent: choice.publicIntent,
			initiativeBase: entry.initiativeBase,
			initiativeTieBreak: entry.initiativeTieBreak,
			initiative: entry.initiative,
			outcome,
			fromNodeId,
			toNodeId,
			targetId: null,
			discoveryIds,
			objectiveTransition,
			effectIds: [],
			summary
		});
	}

	const allAtPortal = currentAttempt.party.memberIds.every(
		(actorId) => positions[actorId] === currentAttempt.extractionNodeId
	);
	const carriedAmount = Object.values(portal.cargo).reduce((sum, cargo) => sum + cargo.amount, 0);
	const extractionReady =
		objective.status === 'quota-met' &&
		allAtPortal &&
		carriedAmount >= objective.quota &&
		portal.roundsRemaining > 1;
	if (extractionReady) {
		objective = { ...objective, status: 'delivered', deliveredOnRound: roundNumber };
	}
	const roundsRemainingBefore = portal.roundsRemaining;
	const roundsRemainingAfter = roundsRemainingBefore - 1;
	const pressureAfter = portalPressureStage(
		roundsRemainingAfter,
		portal.warningAtRemainingRounds,
		portal.criticalAtRemainingRounds
	);
	portal = { ...portal, roundsRemaining: roundsRemainingAfter, pressureStage: pressureAfter };
	const collapsed = roundsRemainingAfter === 0 && !extractionReady;
	if (collapsed) portal = appendPortalCargoLosses(currentAttempt, portal, roundNumber, positions);
	const statusAfter = extractionReady ? 'extraction' : collapsed ? 'failure' : 'resolving';
	const oreLedgerEntryIds = portal.oreLedger
		.slice(oreLedgerStart)
		.map((ledgerEntry) => ledgerEntry.entryId);
	const round = MissionRoundV3Schema.parse({
		roundVersion: 'mission-round-v3',
		roundNumber,
		stateVersion: state.version,
		environmentEventIds: activeMissionEnvironmentEvents(state, roundNumber),
		threatIntents: [],
		monsterActionIds: [],
		initiativeOrder: ranked.map((entry) => entry.choice.actorId),
		actions: resolvedActions,
		monsterActions: [],
		effects: [],
		statusAfter,
		portalWindow: {
			roundsRemainingBefore,
			roundsRemainingAfter,
			pressureBefore: currentAttempt.turnState.portal.pressureStage,
			pressureAfter
		},
		oreLedgerEntryIds
	});
	const completedObjectiveIds = extractionReady ? [objective.objectiveId] : [];
	const mission = MissionRunStateV5Schema.parse({
		...state.mission,
		attempt: {
			...currentAttempt,
			status: statusAfter,
			positions,
			knowledge,
			completedObjectiveIds,
			extractionOpenedAt: extractionReady ? state.simulatedAt : null,
			endedAt: collapsed ? state.simulatedAt : null,
			outcome: collapsed ? 'failure' : null,
			turnState: {
				...currentAttempt.turnState,
				roundNumber,
				objective,
				portal,
				rounds: [...currentAttempt.turnState.rounds, round]
			}
		}
	});
	return { mission, round, choices, entropyCursor: entropy.cursor, entropyDraws };
}

function completePortalMissionExtraction(state: EngineGameStateV15): {
	readonly mission: MissionRunStateV5;
	readonly resourceChanges: readonly z.infer<typeof ResourceChangeSchema>[];
} {
	const attempt = state.mission.attempt;
	if (
		attempt?.status !== 'extraction' ||
		attempt.turnState.objective.status !== 'delivered' ||
		!allPartyAtNode(state, [attempt.extractionNodeId])
	) {
		throw new IllegalActionError('mission.extract');
	}
	let portal = structuredClone(attempt.turnState.portal);
	let settlementAmount = state.settlement.resources['iron-ore'];
	for (const actorId of attempt.party.memberIds) {
		const cargo = portal.cargo[actorId]!;
		if (cargo.amount === 0) continue;
		const entry: PortalOreEntry = {
			entryId: deterministicUuid(
				`${attempt.attemptId}:round:${attempt.turnState.roundNumber}:ore:${portal.oreLedger.length + 1}:extracted`
			),
			sequence: portal.oreLedger.length + 1,
			roundNumber: attempt.turnState.roundNumber,
			kind: 'extracted',
			actorId,
			depositId: null,
			nodeId: attempt.extractionNodeId,
			amount: cargo.amount,
			cargoBefore: cargo.amount,
			cargoAfter: 0,
			depositBefore: null,
			depositAfter: null,
			settlementBefore: settlementAmount,
			settlementAfter: settlementAmount + cargo.amount
		};
		settlementAmount += cargo.amount;
		portal = {
			...portal,
			cargo: { ...portal.cargo, [actorId]: { ...cargo, amount: 0 } },
			oreLedger: [...portal.oreLedger, entry],
			extractedAmount: portal.extractedAmount + cargo.amount,
			extractionCredited: true
		};
	}
	if (portal.extractedAmount < portal.extractionQuota) {
		throw new IllegalActionError('mission.extract');
	}
	const resourceChanges = [
		ResourceChangeSchema.parse({
			resource: 'iron-ore',
			before: state.settlement.resources['iron-ore'],
			after: settlementAmount,
			delta: settlementAmount - state.settlement.resources['iron-ore'],
			reason: 'Iron Moon portal extraction'
		})
	];
	return {
		mission: MissionRunStateV5Schema.parse({
			...state.mission,
			attempt: {
				...attempt,
				status: 'success',
				endedAt: state.simulatedAt,
				outcome: 'success',
				turnState: { ...attempt.turnState, portal }
			}
		}),
		resourceChanges
	};
}

function masterActionsV2(state: EngineGameStateModern): LegalAction[] {
	const actorId = state.master.masterId;
	const controlActions: LegalAction[] =
		state.schemaVersion === 19 || state.schemaVersion === 20
			? [
					action({
						actionId: 'master.control.configure',
						actorId,
						kind: 'interact',
						label: 'Change Master decision timing',
						description:
							'Persist Wait, Countdown, Step, or Continuous independently from action selection.',
						targetIds: [],
						resourceCosts: {},
						tags: ['master', 'control', 'timing', 'replay']
					}),
					...(state.schemaVersion === 20
						? [
								action({
									actionId: 'master.fallback.configure',
									actorId,
									kind: 'interact',
									label: 'Configure unattended selection',
									description:
										'Persist directed or seeded-random fallback intent and safety stops.',
									targetIds: [],
									resourceCosts: {},
									tags: ['master', 'control', 'fallback', 'safety', 'replay']
								}),
								...(state.masterControl.activeDecision !== null &&
								state.masterControl.activeDecision.timing !== 'wait' &&
								selectMasterFallback(state).safetyStopReason
									? [
											action({
												actionId: 'master.safety-stop.apply',
												actorId,
												kind: 'wait',
												label: 'Apply fallback safety stop',
												description:
													'Force Wait at this legal boundary and retain the blocked selection evidence.',
												targetIds: [],
												resourceCosts: {},
												tags: ['master', 'control', 'fallback', 'safety-stop', 'replay']
											})
										]
									: [])
							]
						: []),
					...(state.masterControl.activeDecision === null &&
					state.mission.attempt !== null &&
					['deployed', 'resolving'].includes(state.mission.attempt.status)
						? [
								action({
									actionId: 'master.decision.open',
									actorId,
									kind: 'interact',
									label: 'Open the next Master decision',
									description:
										'Bind one authoritative decision window to the current mission state.',
									targetIds: [],
									resourceCosts: {},
									tags: ['master', 'control', 'decision-window', 'replay']
								})
							]
						: [])
				]
			: [];
	const missionActions = missionLegalActions(state, actorId);
	if (
		supportsMissionActions(state) &&
		state.mission.attempt &&
		['preparing', 'deployed', 'resolving', 'extraction'].includes(state.mission.attempt.status)
	) {
		return [...controlActions, ...missionActions];
	}
	const [inspectGate, ...settlementTail] = settlementLegalActions(state, actorId);
	const actions: LegalAction[] = [...controlActions, ...(inspectGate ? [inspectGate] : [])];
	if (state.schemaVersion === 22 || state.schemaVersion === 23) {
		const eligible = Object.values(state.heroes).filter(
			(hero) =>
				hero.lifeState === 'active' &&
				hero.location === 'summoning-gate' &&
				!hero.currentActivity &&
				!hero.currentTravel &&
				!hero.currentRoutine &&
				!hero.assignment
		);
		if (eligible.length >= 2 && !state.mission.attempt) {
			actions.push(
				action({
					actionId: 'settlement.synthesis.commit',
					actorId,
					kind: 'interact',
					label: 'Confirm a synthesis pair',
					description:
						'Permanently consume one ready summon, grant bounded essence to another, and record witness-bounded fallout.',
					targetIds: eligible.map((hero) => hero.heroId),
					resourceCosts: {},
					tags: ['settlement', 'synthesis', 'irreversible', 'social', 'replay']
				})
			);
		}
	}
	if (state.schemaVersion === 23 && state.firstBandArchive.status === 'recovered') {
		actions.push(
			action({
				actionId: 'story.first.archive.reveal',
				actorId,
				kind: 'interact',
				label: 'Open the recovered archive fragment',
				description:
					'Choose one surviving reader; their personality shapes the delivery while the authored fact remains fixed.',
				targetIds: state.firstBandArchive.recovery?.survivingHeroIds ?? [],
				resourceCosts: {},
				tags: ['story', 'archive', 'knowledge', 'replay']
			})
		);
	}
	if (state.schemaVersion === 21 && state.bandStory.appliedPatches.length === 0) {
		actions.push(
			action({
				actionId: 'story.patch.apply',
				actorId,
				kind: 'interact',
				label: 'Commit an engine-validated story patch',
				description:
					'Activate one catalogued optional beat at the open Floor 04 checkpoint without changing fixed story authority.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story', 'patch', 'catalog-bound', 'replay']
			})
		);
	}
	actions.push(...missionActions);
	actions.push(...settlementTail);
	return actions;
}

function heroActionsV2(state: EngineGameStateModern, actorId: string): LegalAction[] {
	if (state.schemaVersion === 22) {
		const speaker = state.heroes[actorId];
		if (speaker?.lifeState === 'active' && heroCanHearCommunication(speaker)) {
			const rumorActions = Object.values(state.synthesis.receipts).flatMap((receipt) => {
				const directlyKnows = receipt.socialConsequences.some(
					(consequence) => consequence.heroId === actorId && consequence.knowledge !== 'absence'
				);
				const learnedRumor = Object.values(state.synthesis.rumors).some(
					(rumor) => rumor.receiptId === receipt.receiptId && rumor.listenerHeroId === actorId
				);
				if (!directlyKnows && !learnedRumor) return [];
				return Object.values(state.heroes)
					.filter((target) => {
						if (
							target.heroId === actorId ||
							target.lifeState !== 'active' ||
							target.location !== speaker.location ||
							target.locationNodeId !== speaker.locationNodeId ||
							!heroCanHearCommunication(target)
						)
							return false;
						return !Object.values(state.society.observations).some(
							(observation) =>
								'synthesisReceiptId' in observation &&
								observation.synthesisReceiptId === receipt.receiptId &&
								observation.observerHeroId === target.heroId &&
								observation.kind !== 'synthesis-absence'
						);
					})
					.sort((left, right) => left.heroId.localeCompare(right.heroId))
					.map((target) =>
						action({
							actionId: `synthesis.rumor.share.${receipt.receiptId.slice(-8)}.${target.heroId.slice(-8)}`,
							actorId,
							kind: 'interact',
							label: `Tell ${target.heroId.slice(0, 8)} what happened`,
							description:
								'Share a sourced synthesis claim; confidence falls as the explicit rumor chain grows.',
							targetIds: [target.heroId],
							resourceCosts: {},
							tags: ['social', 'synthesis', 'rumor', 'provenance']
						})
					);
			});
			if (rumorActions.length > 0) return rumorActions;
		}
	}
	const missionActions = missionLegalActions(state, actorId);
	if (
		missionActions.length > 0 ||
		(supportsMissionActions(state) && missionPartyIsReserved(state, actorId))
	) {
		return [...missionActions];
	}
	return settlementLegalActions(state, actorId);
}

function legalActionsForParsedState(
	state: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	if (state.status !== 'active') return [];
	if (actorId === state.master.masterId && state.master.lifeState === 'alive') {
		if (isModernState(state)) return masterActionsV2(state);
		return [
			action({
				actionId: 'master.inspect.gate',
				actorId,
				kind: 'interact',
				label: 'Inspect the gate resonance',
				description: 'Draw one named deterministic resonance value without advancing time.',
				targetIds: [],
				resourceCosts: {},
				tags: ['deterministic', 'development-proof']
			})
		];
	}
	return isModernState(state)
		? heroActionsV2(state, actorId)
		: settlementLegalActions(state, actorId);
}

export function legalActions(stateInput: EngineGameState, actorId: string): readonly LegalAction[] {
	return legalActionsForParsedState(EngineGameStateSchema.parse(stateInput), actorId);
}

export function decisionLegalActions(
	stateInput: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	const actions = legalActionsForParsedState(state, actorId);
	if (
		!actions.some((candidate) => candidate.actionId === 'hero.travel') ||
		!hasNavigationState(state)
	) {
		return actions;
	}
	const hero = state.heroes[actorId];
	const targets =
		hero && !hero.firstArrivalCompleted && hero.destination
			? [destinationNodeId(settlementForState(state), hero.destination)]
			: undefined;
	const expandedTravel = settlementTravelActions(state, actorId, targets);
	return actions.flatMap((candidate) =>
		candidate.actionId === 'hero.travel' ? expandedTravel : [candidate]
	);
}

function boundedDecisionText(result: HeroPolicyResult): string {
	const text = result.decision.spokenText ?? result.decision.publicIntent;
	return text.length <= 500 ? text : text.slice(0, 500).trimEnd();
}

export function commandFromHeroPolicyResult(input: {
	readonly state: EngineGameState;
	readonly packet: HeroDecisionPacket;
	readonly result: HeroPolicyResult;
	readonly decisionJobId: string;
}): EngineCommand {
	const state = EngineGameStateSchema.parse(input.state);
	const packet = HeroDecisionPacketSchema.parse(input.packet);
	const result = HeroPolicyResultSchema.parse(input.result);
	const unsignedPacket = { ...packet } as Partial<HeroDecisionPacket>;
	delete unsignedPacket.packetHash;
	const unsignedResult = { ...result } as Partial<HeroPolicyResult>;
	delete unsignedResult.resultHash;
	if (
		hashCanonical(unsignedPacket) !== packet.packetHash ||
		hashCanonical(unsignedResult) !== result.resultHash ||
		packet.runId !== state.runId ||
		packet.heroId !== packet.identity.profile.characterId ||
		packet.world.stateVersion !== state.version ||
		packet.world.eventCursor !== state.eventCursor ||
		packet.world.stateHash !== hashParsedGameState(state) ||
		result.packetId !== packet.packetId ||
		result.packetHash !== packet.packetHash ||
		result.legalActionHash !== packet.legalActionHash ||
		result.world.stateVersion !== packet.world.stateVersion ||
		result.world.eventCursor !== packet.world.eventCursor ||
		result.world.stateHash !== packet.world.stateHash
	) {
		throw new Error('Decision result is not bound to the current engine state');
	}
	const currentActions = [...decisionLegalActions(state, packet.heroId)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	if (hashCanonical(currentActions) !== packet.legalActionHash) {
		throw new Error('Decision legal actions are stale');
	}
	const selectedAction = currentActions.find(
		(candidate) => candidate.actionId === result.decision.actionId
	);
	if (
		!selectedAction ||
		result.decision.targetIds.some((targetId) => !selectedAction.targetIds.includes(targetId))
	) {
		throw new IllegalActionError(
			result.decision.actionId,
			currentActions.map((action) => action.actionId)
		);
	}
	const commandId = deterministicUuid(
		`${input.decisionJobId}:apply:${packet.packetHash}:${result.resultHash}`
	);
	const base = {
		commandId,
		runId: state.runId,
		actorId: packet.heroId,
		expectedVersion: state.version,
		correlationId: deterministicUuid(`${input.decisionJobId}:correlation`),
		source: {
			source: result.trace.kind,
			timing: null,
			fallbackPolicy: null,
			directiveIds: packet.activeDirectives.map((directive) => directive.directiveId),
			decisionJobId: input.decisionJobId
		}
	};
	const actionId = result.decision.actionId;
	if (actionId === 'hero.choose.kitchen' || actionId === 'hero.choose.training-ground') {
		const destination = actionId === 'hero.choose.kitchen' ? 'kitchen' : 'training-ground';
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.choose.destination',
			destination,
			firstLine: boundedDecisionText(result),
			storyBranch: destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust'
		});
	}
	if (actionId === 'hero.arrive.destination') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.arrive' });
	}
	if (actionId.startsWith('hero.travel.')) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.start.travel',
			targetNodeId: actionId.slice('hero.travel.'.length)
		});
	}
	if (actionId === 'hero.plan.day') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.plan.day' });
	}
	if (actionId === 'hero.follow.plan') {
		return EngineCommandSchema.parse({ ...base, commandType: 'hero.start.routine' });
	}
	if (
		actionId === 'hero.activity.train' ||
		actionId === 'hero.activity.eat' ||
		actionId === 'hero.activity.rest' ||
		actionId === 'hero.activity.repair'
	) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.start.activity',
			activity: actionId.slice('hero.activity.'.length)
		});
	}
	if (actionId.startsWith('hero.equip.')) {
		return EngineCommandSchema.parse({
			...base,
			commandType: 'hero.equip.item',
			itemId: actionId.slice('hero.equip.'.length)
		});
	}
	throw new IllegalActionError(
		actionId,
		currentActions.map((action) => action.actionId)
	);
}

function requiredAction(command: EngineCommand): string {
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		return requiredSettlementAction(command as SettlementCommand);
	}
	if (command.commandType === 'master.configure.timing') return 'master.control.configure';
	if (command.commandType === 'master.configure.fallback') return 'master.fallback.configure';
	if (command.commandType === 'master.apply.safety-stop') return 'master.safety-stop.apply';
	if (command.commandType === 'master.open.decision') return 'master.decision.open';
	if (command.commandType === 'mission.prepare') return 'mission.prepare';
	if (command.commandType === 'mission.revise.party') return 'mission.revise.party';
	if (command.commandType === 'mission.cancel') return 'mission.cancel';
	if (command.commandType === 'mission.deploy') return 'mission.deploy';
	if (command.commandType === 'mission.resolve.turn') return 'mission.resolve.turn';
	if (command.commandType === 'mission.open.extraction') return 'mission.open.extraction';
	if (command.commandType === 'mission.extract') return 'mission.extract';
	if (command.commandType === 'mission.retreat') return 'mission.retreat';
	if (command.commandType === 'story.apply.patch') return 'story.patch.apply';
	if (command.commandType === 'story.reveal.first.archive') return 'story.first.archive.reveal';
	if (command.commandType === 'settlement.synthesize.hero') return 'settlement.synthesis.commit';
	if (command.commandType === 'hero.share.synthesis.rumor')
		return `synthesis.rumor.share.${command.receiptId.slice(-8)}.${command.targetHeroId.slice(-8)}`;
	throw new Error('Unreachable engine command discriminator');
}

function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	if (
		command.commandType === 'settlement.synthesize.hero' ||
		command.commandType === 'hero.share.synthesis.rumor'
	) {
		synthesisCommandHandler.assertLegal(state, command);
		return;
	}
	if (command.commandType === 'story.reveal.first.archive') {
		storyCommandHandler.assertLegal(state, command);
		if (
			!legalActionsForParsedState(state, command.actorId).some(
				(candidate) => candidate.actionId === requiredAction(command)
			)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (
		command.commandType === 'master.configure.timing' ||
		command.commandType === 'master.open.decision' ||
		command.commandType === 'master.configure.fallback' ||
		command.commandType === 'master.apply.safety-stop'
	) {
		if (
			(state.schemaVersion !== 19 && state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			!legalActions(state, command.actorId).some(
				(candidate) => candidate.actionId === requiredAction(command)
			)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		if (
			command.commandType === 'master.configure.timing' ||
			command.commandType === 'master.configure.fallback' ||
			command.commandType === 'master.open.decision'
		) {
			if (command.source.source !== 'manual' || command.source.timing !== 'step') {
				throw new IllegalActionError(command.commandType, []);
			}
			if (
				state.masterControl.activeDecision &&
				Date.parse(command.observedAt) < Date.parse(state.masterControl.activeDecision.openedAt)
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			if (command.commandType === 'master.configure.timing') {
				if (state.schemaVersion === 20) {
					configureMasterTimingV2(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					);
				} else {
					configureMasterTiming(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					);
				}
			} else if (command.commandType === 'master.configure.fallback') {
				if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType, []);
				configureMasterFallback(state.masterControl, command);
			} else if (state.schemaVersion === 20) {
				masterDecisionWindowV2(state.masterControl, command.commandId, command.observedAt);
			} else {
				masterDecisionWindow(state.masterControl, command.commandId, command.observedAt);
			}
		} else {
			if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType, []);
			const active = state.masterControl.activeDecision;
			if (
				!active ||
				command.decisionId !== active.decisionId ||
				command.source.source !== 'system' ||
				command.source.timing !== active.timing ||
				command.source.fallbackPolicy !== active.fallback.policy
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			applyMasterSafetyStop(
				state,
				command.commandId,
				command.decisionId,
				command.observedAt,
				command.source
			);
		}
		return;
	}
	if (command.commandType.startsWith('mission.')) {
		if (
			(state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 15 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				state.schemaVersion !== 23) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		if (command.commandType === 'mission.open.extraction') {
			if (
				state.schemaVersion !== 11 ||
				command.source.source !== 'system' ||
				command.source.timing !== null
			) {
				throw new IllegalActionError(command.commandType, []);
			}
			openMissionExtraction(state, command.completedObjectiveIds);
			return;
		}
		if (command.commandType === 'mission.resolve.turn') {
			if (
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 15 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				state.schemaVersion !== 23
			)
				throw new IllegalActionError(command.commandType, []);
			const choices = normalizedMissionTurnChoices(state, command.choices);
			if (state.schemaVersion === 19 || state.schemaVersion === 20) {
				const masterChoice = choices.find((choice) => choice.actorId === state.master.masterId);
				if (!masterChoice || !command.decisionId || !command.resolvedAt) {
					throw new IllegalActionError(command.commandType, []);
				}
				if ((command.source.source === 'manual') !== (masterChoice.source === 'manual')) {
					throw new IllegalActionError(command.commandType, []);
				}
				if (state.schemaVersion === 20) {
					const expected =
						command.source.source === 'manual' ? null : masterFallbackMissionChoice(state);
					if (expected && hashCanonical(expected) !== hashCanonical(masterChoice)) {
						throw new IllegalActionError(command.commandType, []);
					}
					resolveMasterDecisionV2(
						state,
						command.commandId,
						command.decisionId,
						command.resolvedAt,
						masterChoice.actionId,
						command.source,
						false
					);
				} else {
					resolveMasterDecision(
						state.masterControl,
						command.commandId,
						command.decisionId,
						command.resolvedAt,
						masterChoice.actionId,
						command.source,
						false
					);
				}
			} else if (command.source.source !== 'manual' || command.source.timing !== 'step') {
				throw new IllegalActionError(command.commandType, []);
			}
			return;
		}
		if (command.source.source !== 'manual' || command.source.timing !== 'step') {
			throw new IllegalActionError(command.commandType, []);
		}
	}
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		assertSettlementCommandLegalWithActionIds(
			state,
			command as SettlementCommand,
			legalActions(state, command.actorId).map((candidate) => candidate.actionId)
		);
		return;
	}
	if (command.commandType === 'story.apply.patch') {
		storyCommandHandler.assertLegal(state, command);
	}
	const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
	const required = requiredAction(command);
	if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
	if (
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		if (command.commandType === 'mission.prepare')
			prepareMissionAttempt(state, command.commandId, command.heroIds, command.missionId);
		if (command.commandType === 'mission.revise.party') reviseMissionParty(state, command.heroIds);
		if (command.commandType === 'mission.cancel') cancelMissionPreparation(state);
		if (command.commandType === 'mission.deploy')
			deployMissionAttempt(state, spawnMissionCombatants);
		if (command.commandType === 'mission.resolve.turn') {
			if (
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 15 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20
			)
				throw new IllegalActionError(command.commandType);
			if (state.schemaVersion === 15) resolvePortalMissionTurn(state, command.choices);
			else if (
				state.schemaVersion === 13 ||
				state.schemaVersion === 14 ||
				state.schemaVersion === 16 ||
				state.schemaVersion === 17 ||
				state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20
			)
				resolveMissionCombatTurn(
					state,
					command.choices,
					state.schemaVersion === 16 ||
						state.schemaVersion === 17 ||
						state.schemaVersion === 18 ||
						state.schemaVersion === 19 ||
						state.schemaVersion === 20
						? eventBase(state, command, 'mission.round.resolved').eventId
						: null
				);
			else resolveMissionTurn(state, command.choices);
		}
		if (command.commandType === 'mission.extract') {
			if (state.schemaVersion === 15) completePortalMissionExtraction(state);
			else completeMissionExtraction(state);
		}
		if (command.commandType === 'mission.retreat')
			retreatMissionAttempt(state, appendPortalCargoLosses);
	}
}

function buildLegacyEvent(state: EngineGameStateV1, command: EngineCommand): AuthoritativeEvent {
	return settlementCommandHandler.buildEvent(state, command as SettlementCommand);
}

function buildV2Event(state: EngineGameStateModern, command: EngineCommand): AuthoritativeEvent {
	if (
		command.commandType === 'settlement.synthesize.hero' ||
		command.commandType === 'hero.share.synthesis.rumor'
	) {
		return synthesisCommandHandler.buildEvent(state, command);
	}
	if (
		command.commandType === 'story.apply.patch' ||
		command.commandType === 'story.reveal.first.archive'
	) {
		return storyCommandHandler.buildEvent(state, command);
	}
	if (SETTLEMENT_COMMAND_TYPES.some((commandType) => commandType === command.commandType)) {
		return settlementCommandHandler.buildEvent(state, command as SettlementCommand);
	}
	if (command.commandType === 'master.configure.timing') {
		if (state.schemaVersion !== 19 && state.schemaVersion !== 20)
			throw new IllegalActionError(command.commandType);
		const configured =
			state.schemaVersion === 20
				? configureMasterTimingV2(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					)
				: configureMasterTiming(
						state.masterControl,
						command.commandId,
						command.timing,
						command.countdownSeconds,
						command.observedAt,
						command.source
					);
		const base = eventBase(state, command, 'master.timing.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				timing: command.timing,
				countdownSeconds: command.countdownSeconds,
				observedAt: command.observedAt,
				masterControl: configured.control,
				pausedResolution: configured.paused,
				nextVersion: state.version + 1,
				...emptyMetadata(
					configured.paused
						? `The Master paused decision ${configured.paused.ordinal} and changed timing to ${command.timing}.`
						: `Master decision timing changed to ${command.timing}.`
				)
			}
		});
	}
	if (command.commandType === 'master.configure.fallback') {
		if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType);
		const configured = configureMasterFallback(state.masterControl, command);
		const base = eventBase(state, command, 'master.fallback.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				policy: command.policy,
				directionText: command.directionText,
				priorities: command.priorities,
				protectedHeroId: command.protectedHeroId,
				safetyStops: command.safetyStops,
				observedAt: command.observedAt,
				masterControl: configured.control,
				pausedResolution: configured.paused,
				nextVersion: state.version + 1,
				...emptyMetadata(
					configured.paused
						? `Decision ${configured.paused.ordinal} paused; ${command.policy} fallback now owns the next window.`
						: `Master fallback changed to ${command.policy} with explicit safety stops.`
				)
			}
		});
	}
	if (command.commandType === 'master.apply.safety-stop') {
		if (state.schemaVersion !== 20) throw new IllegalActionError(command.commandType);
		const stopped = applyMasterSafetyStop(
			state,
			command.commandId,
			command.decisionId,
			command.observedAt,
			command.source
		);
		const reason = stopped.resolution.fallbackSelection!.safetyStopReason!;
		const base = eventBase(state, command, 'master.safety.stopped');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				observedAt: command.observedAt,
				masterControl: stopped.control,
				decisionResolution: stopped.resolution,
				nextVersion: state.version + 1,
				...emptyMetadata(`Safety forced Wait at decision ${stopped.resolution.ordinal}: ${reason}.`)
			}
		});
	}
	if (command.commandType === 'master.open.decision') {
		if (state.schemaVersion !== 19 && state.schemaVersion !== 20)
			throw new IllegalActionError(command.commandType);
		const masterControl =
			state.schemaVersion === 20
				? masterDecisionWindowV2(state.masterControl, command.commandId, command.observedAt)
				: masterDecisionWindow(state.masterControl, command.commandId, command.observedAt);
		const base = eventBase(state, command, 'master.decision.opened');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				observedAt: command.observedAt,
				masterControl,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`Decision ${masterControl.decisionOrdinal} opened in ${masterControl.timing} timing.`
				)
			}
		});
	}
	if (command.commandType.startsWith('mission.')) {
		if (
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 15 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20 &&
			state.schemaVersion !== 23
		)
			throw new IllegalActionError(command.commandType);
		if (command.commandType === 'mission.resolve.turn') {
			if (
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 15 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				state.schemaVersion !== 23
			)
				throw new IllegalActionError(command.commandType);
			const base = eventBase(state, command, 'mission.round.resolved');
			const resolution =
				state.schemaVersion === 15
					? resolvePortalMissionTurn(state, command.choices)
					: state.schemaVersion === 13 ||
						  state.schemaVersion === 14 ||
						  state.schemaVersion === 16 ||
						  state.schemaVersion === 17 ||
						  state.schemaVersion === 18 ||
						  state.schemaVersion === 19 ||
						  state.schemaVersion === 20 ||
						  state.schemaVersion === 23
						? resolveMissionCombatTurn(
								state,
								command.choices,
								state.schemaVersion === 16 ||
									state.schemaVersion === 17 ||
									state.schemaVersion === 18 ||
									state.schemaVersion === 19 ||
									state.schemaVersion === 20 ||
									state.schemaVersion === 23
									? base.eventId
									: null
							)
						: resolveMissionTurn(state, command.choices);
			const monsterCount =
				'monsterActions' in resolution.round ? resolution.round.monsterActions.length : 0;
			const timingResolution =
				state.schemaVersion === 19 || state.schemaVersion === 20
					? (() => {
							const masterChoice = resolution.choices.find(
								(choice) => choice.actorId === state.master.masterId
							);
							if (!masterChoice || !command.decisionId || !command.resolvedAt) {
								throw new IllegalActionError(command.commandType);
							}
							const missionContinues =
								'status' in resolution &&
								resolution.status === 'active' &&
								resolution.mission.attempt !== null &&
								['deployed', 'resolving'].includes(resolution.mission.attempt.status);
							return state.schemaVersion === 20
								? resolveMasterDecisionV2(
										state,
										command.commandId,
										command.decisionId,
										command.resolvedAt,
										masterChoice.actionId,
										command.source,
										missionContinues
									)
								: resolveMasterDecision(
										state.masterControl,
										command.commandId,
										command.decisionId,
										command.resolvedAt,
										masterChoice.actionId,
										command.source,
										missionContinues
									);
						})()
					: null;
			return AuthoritativeEventSchema.parse({
				...base,
				seedCursor: resolution.entropyCursor,
				payload: {
					transition: 'resolve-turn',
					mission: resolution.mission,
					choices: resolution.choices,
					round: resolution.round,
					nextVersion: state.version + 1,
					...emptyMetadata(
						'status' in resolution && resolution.status === 'game_over'
							? `The Master died on Floor 03 during round ${resolution.round.roundNumber}; the run was atomically sealed.`
							: `Round ${resolution.round.roundNumber} resolved ${resolution.round.actions.length} party choices and ${monsterCount} monster duties in seeded initiative order.`
					),
					entropyDraws: resolution.entropyDraws,
					...((state.schemaVersion === 16 ||
						state.schemaVersion === 17 ||
						state.schemaVersion === 18 ||
						state.schemaVersion === 19 ||
						state.schemaVersion === 20 ||
						state.schemaVersion === 23) &&
					'consequences' in resolution
						? { consequences: resolution.consequences }
						: {}),
					...(timingResolution
						? {
								masterControl: timingResolution.control,
								decisionResolution: timingResolution.resolution
							}
						: {})
				}
			});
		}
		let mission: MissionEngineRunState;
		let transition: z.infer<typeof MissionTransitionPayloadSchema>['transition'];
		let eventType: string;
		let summary: string;
		let heroIds: string[] = [];
		let completedObjectiveIds: string[] = [];
		let seedCursor = state.entropyCursor;
		let entropyDraws: EntropyDraw[] = [];
		let resourceChanges: z.infer<typeof ResourceChangeSchema>[] = [];
		if (command.commandType === 'mission.prepare') {
			transition = 'prepare';
			eventType = 'mission.preparation.started';
			heroIds = normalizedMissionHeroIds(command.heroIds);
			mission = prepareMissionAttempt(state, command.commandId, heroIds, command.missionId);
			summary = `The Master reserved a ${heroIds.length + 1}-member party for ${mission.binding.missionId}.`;
		} else if (command.commandType === 'mission.revise.party') {
			transition = 'revise-party';
			eventType = 'mission.party.revised';
			heroIds = normalizedMissionHeroIds(command.heroIds);
			mission = reviseMissionParty(state, heroIds);
			summary = `The Master revised the threshold party to ${heroIds.length + 1} members.`;
		} else if (command.commandType === 'mission.cancel') {
			transition = 'cancel';
			eventType = 'mission.preparation.canceled';
			mission = cancelMissionPreparation(state);
			summary = 'The Master stood the party down before deployment.';
		} else if (command.commandType === 'mission.deploy') {
			transition = 'deploy';
			eventType = 'mission.deployed';
			const deployment = deployMissionAttempt(state, spawnMissionCombatants);
			mission = deployment.mission;
			seedCursor = deployment.entropyCursor;
			entropyDraws = deployment.entropyDraws;
			summary =
				state.schemaVersion === 15
					? `The prepared party crossed the Iron Moon scar with ${state.mission.attempt!.turnState.portal.durationRounds} authoritative rounds remaining.`
					: state.schemaVersion === 13 ||
						  state.schemaVersion === 14 ||
						  state.schemaVersion === 16 ||
						  state.schemaVersion === 17 ||
						  state.schemaVersion === 18 ||
						  state.schemaVersion === 19 ||
						  state.schemaVersion === 20 ||
						  state.schemaVersion === 23
						? `The prepared party crossed the Tower Threshold; ${Object.keys((deployment.mission as MissionRunStateV3 | MissionRunStateV4 | MissionRunStateV6 | MissionRunStateV7 | MissionRunStateV8).attempt!.turnState.monsters).length} deterministic monster duties activated.`
						: 'The prepared party crossed the Tower Threshold as one authoritative deployment.';
		} else if (command.commandType === 'mission.open.extraction') {
			if (state.schemaVersion !== 11) throw new IllegalActionError(command.commandType);
			transition = 'open-extraction';
			eventType = 'mission.extraction.opened';
			completedObjectiveIds = [...command.completedObjectiveIds].sort((left, right) =>
				left.localeCompare(right)
			);
			mission = openMissionExtraction(state, completedObjectiveIds);
			summary = 'The mission resolver proved the primary objective and opened extraction.';
		} else if (command.commandType === 'mission.extract') {
			transition = 'extract';
			eventType = 'mission.extracted';
			if (state.schemaVersion === 15) {
				const extraction = completePortalMissionExtraction(state);
				mission = extraction.mission;
				resourceChanges = [...extraction.resourceChanges];
				summary = `The complete party crossed the portal scar with ${resourceChanges[0]!.delta} iron ore.`;
			} else {
				mission = completeMissionExtraction(state);
				summary = 'The complete party crossed the extraction boundary with the First Ember.';
			}
		} else if (command.commandType === 'mission.retreat') {
			transition = 'retreat';
			eventType = 'mission.retreated';
			mission = retreatMissionAttempt(state, appendPortalCargoLosses);
			summary =
				state.schemaVersion === 15
					? 'The complete party retreated through the portal scar; carried ore was abandoned.'
					: 'The complete party retreated through an authored boundary; the attempt ended.';
		} else {
			throw new IllegalActionError(command.commandType);
		}
		const base = eventBase(state, command, eventType);
		const bandStory =
			state.schemaVersion === 23 && transition === 'extract'
				? completeFirstBandStory(state)
				: state.schemaVersion === 23
					? state.bandStory
					: null;
		const firstBandArchive =
			state.schemaVersion === 23 && bandStory
				? recoverFirstBandArchive(
						state,
						base.eventId,
						MissionRunStateV8Schema.parse(mission),
						bandStory
					)
				: null;
		const endedDecision =
			(state.schemaVersion === 19 || state.schemaVersion === 20) &&
			mission.attempt !== null &&
			!['deployed', 'resolving'].includes(mission.attempt.status)
				? state.schemaVersion === 20
					? endMasterDecisionV2(state.masterControl, command.source)
					: endMasterDecision(state.masterControl, command.source)
				: state.schemaVersion === 19 || state.schemaVersion === 20
					? { control: state.masterControl, resolution: null }
					: null;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor,
			payload: {
				transition,
				mission,
				heroIds,
				completedObjectiveIds,
				nextVersion: state.version + 1,
				...emptyMetadata(
					summary,
					resourceChanges.map((change) => ({
						ownerId: state.master.masterId,
						kind: 'resource' as const,
						key: change.resource,
						before: change.before,
						after: change.after,
						delta: change.delta
					}))
				),
				...(state.schemaVersion === 15 ? { resourceChanges } : {}),
				...(state.schemaVersion === 23 && bandStory && firstBandArchive
					? { bandStory, firstBandArchive }
					: {}),
				...(endedDecision
					? {
							masterControl: endedDecision.control,
							decisionResolution: endedDecision.resolution
						}
					: {}),
				entropyDraws
			}
		});
	}
	throw new IllegalActionError(command.commandType);
}

function reduceLegacyEvent(state: EngineGameStateV1, event: AuthoritativeEvent): EngineGameStateV1 {
	if (event.eventType === 'hero.destination.selected') {
		const payload = LegacyChoosePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError(
				'Destination event references an unknown hero',
				event.sequence
			);
		return EngineGameStateV1Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, destination: payload.destination } },
			story: { ...state.story, branch: payload.storyBranch }
		});
	}
	if (event.eventType === 'hero.arrived') {
		const payload = LegacyArrivePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError('Arrival event references an unknown hero', event.sequence);
		return EngineGameStateV1Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, location: payload.destination } }
		});
	}
	if (event.eventType === 'master.gate.inspected') {
		const payload = LegacyInspectPayloadSchema.parse(event.payload);
		return EngineGameStateV1Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			master: {
				...state.master,
				gateInspectionCount: state.master.gateInspectionCount + 1,
				lastGateResonance: payload.resonance
			}
		});
	}
	throw new ReplayIntegrityError(
		`Unsupported legacy event type: ${event.eventType}`,
		event.sequence
	);
}

function reduceV2Event(
	state: EngineGameStateModern,
	event: AuthoritativeEvent
): EngineGameStateModern {
	if (storyEventReducer.eventTypes.some((eventType) => eventType === event.eventType)) {
		return storyEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (synthesisEventReducer.eventTypes.some((eventType) => eventType === event.eventType)) {
		return synthesisEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (SETTLEMENT_EVENT_TYPES.some((eventType) => eventType === event.eventType)) {
		return settlementEventReducer.reduce(state, event) as EngineGameStateModern;
	}
	if (event.eventType === 'master.timing.changed') {
		if (state.schemaVersion === 20) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.seedCursor !== state.entropyCursor ||
				event.source.source !== 'manual' ||
				event.source.timing !== 'step'
			) {
				throw new ReplayIntegrityError(
					'Master fallback timing precondition failed',
					event.sequence
				);
			}
			const payload = MasterTimingChangedPayloadV2Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Master fallback timing version diverged', event.sequence);
			}
			const expected = configureMasterTimingV2(
				state.masterControl,
				event.commandId,
				payload.timing,
				payload.countdownSeconds,
				payload.observedAt,
				event.source
			);
			if (
				hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expected.paused) !== hashCanonical(payload.pausedResolution)
			) {
				throw new ReplayIntegrityError('Master fallback timing payload diverged', event.sequence);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				masterControl: payload.masterControl
			});
		}
		if (
			state.schemaVersion !== 19 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor
		) {
			throw new ReplayIntegrityError('Master timing change precondition failed', event.sequence);
		}
		const payload = MasterTimingChangedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master timing change version diverged', event.sequence);
		}
		const expected = configureMasterTiming(
			state.masterControl,
			event.commandId,
			payload.timing,
			payload.countdownSeconds,
			payload.observedAt,
			event.source
		);
		if (
			hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
			hashCanonical(expected.paused) !== hashCanonical(payload.pausedResolution)
		) {
			throw new ReplayIntegrityError('Master timing change payload diverged', event.sequence);
		}
		return EngineGameStateV19Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'master.fallback.changed') {
		if (
			state.schemaVersion !== 20 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			event.source.source !== 'manual' ||
			event.source.timing !== 'step'
		) {
			throw new ReplayIntegrityError('Master fallback change precondition failed', event.sequence);
		}
		const payload = MasterFallbackChangedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master fallback change version diverged', event.sequence);
		}
		const expected = configureMasterFallback(state.masterControl, {
			commandId: event.commandId,
			observedAt: payload.observedAt,
			source: event.source,
			policy: payload.policy,
			directionText: payload.directionText,
			priorities: payload.priorities,
			protectedHeroId: payload.protectedHeroId,
			safetyStops: payload.safetyStops
		});
		if (
			hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
			hashCanonical(expected.paused) !== hashCanonical(payload.pausedResolution)
		) {
			throw new ReplayIntegrityError('Master fallback change payload diverged', event.sequence);
		}
		return EngineGameStateV20Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'master.safety.stopped') {
		if (
			state.schemaVersion !== 20 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor
		) {
			throw new ReplayIntegrityError('Master safety stop precondition failed', event.sequence);
		}
		const payload = MasterSafetyStoppedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master safety stop version diverged', event.sequence);
		}
		let expected;
		try {
			expected = applyMasterSafetyStop(
				state,
				event.commandId,
				payload.decisionResolution.decisionId,
				payload.observedAt,
				event.source
			);
		} catch {
			throw new ReplayIntegrityError('Master safety stop could not be reproduced', event.sequence);
		}
		if (
			hashCanonical(expected.control) !== hashCanonical(payload.masterControl) ||
			hashCanonical(expected.resolution) !== hashCanonical(payload.decisionResolution)
		) {
			throw new ReplayIntegrityError('Master safety stop payload diverged', event.sequence);
		}
		return EngineGameStateV20Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'master.decision.opened') {
		if (state.schemaVersion === 20) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.seedCursor !== state.entropyCursor ||
				event.source.source !== 'manual' ||
				event.source.timing !== 'step'
			) {
				throw new ReplayIntegrityError(
					'Master fallback decision precondition failed',
					event.sequence
				);
			}
			const payload = MasterDecisionOpenedPayloadV2Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Master fallback decision version diverged', event.sequence);
			}
			const expected = masterDecisionWindowV2(
				state.masterControl,
				event.commandId,
				payload.observedAt
			);
			if (hashCanonical(expected) !== hashCanonical(payload.masterControl)) {
				throw new ReplayIntegrityError('Master fallback decision payload diverged', event.sequence);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				masterControl: payload.masterControl
			});
		}
		if (
			state.schemaVersion !== 19 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor
		) {
			throw new ReplayIntegrityError('Master decision opening precondition failed', event.sequence);
		}
		const payload = MasterDecisionOpenedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Master decision opening version diverged', event.sequence);
		}
		const expected = masterDecisionWindow(state.masterControl, event.commandId, payload.observedAt);
		if (hashCanonical(expected) !== hashCanonical(payload.masterControl)) {
			throw new ReplayIntegrityError('Master decision opening payload diverged', event.sequence);
		}
		return EngineGameStateV19Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			masterControl: payload.masterControl
		});
	}
	if (event.eventType === 'mission.round.resolved') {
		if (state.schemaVersion === 23) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'First-band mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionAttemptAftermathTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('First-band mission round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('First-band mission round payload diverged', event.sequence);
			}
			return EngineGameStateV23Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status
			});
		}
		if (state.schemaVersion === 20) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Master fallback mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionMasterFallbackTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Master fallback round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			const masterChoice = expected.choices.find(
				(choice) => choice.actorId === state.master.masterId
			);
			if (!masterChoice) {
				throw new ReplayIntegrityError('Master fallback round omitted the Master', event.sequence);
			}
			const fallback = event.source.source !== 'manual';
			if ((event.source.source === 'manual') !== (masterChoice.source === 'manual')) {
				throw new ReplayIntegrityError(
					'Master fallback source and action evidence diverged',
					event.sequence
				);
			}
			if (fallback) {
				let expectedChoice: MissionTurnChoice;
				try {
					expectedChoice = masterFallbackMissionChoice(state);
				} catch {
					throw new ReplayIntegrityError(
						'Master fallback choice could not be reproduced',
						event.sequence
					);
				}
				if (
					hashCanonical(event.source) !== hashCanonical(masterFallbackActionSource(state)) ||
					hashCanonical(masterChoice) !== hashCanonical(expectedChoice)
				) {
					throw new ReplayIntegrityError(
						'Master fallback policy evidence diverged',
						event.sequence
					);
				}
			}
			const missionContinues =
				expected.status === 'active' &&
				expected.mission.attempt !== null &&
				['deployed', 'resolving'].includes(expected.mission.attempt.status);
			let expectedControl;
			try {
				expectedControl = resolveMasterDecisionV2(
					state,
					event.commandId,
					payload.decisionResolution.decisionId,
					payload.decisionResolution.resolvedAt,
					masterChoice.actionId,
					event.source,
					missionContinues
				);
			} catch {
				throw new ReplayIntegrityError(
					'Master fallback decision could not be reproduced',
					event.sequence
				);
			}
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedControl.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedControl.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError('Master fallback round payload diverged', event.sequence);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 19) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Master timing mission round precondition failed',
					event.sequence
				);
			}
			const payload = MissionMasterTimingTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Master timing round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			const masterChoice = expected.choices.find(
				(choice) => choice.actorId === state.master.masterId
			);
			if (!masterChoice) {
				throw new ReplayIntegrityError('Master timing round omitted the Master', event.sequence);
			}
			if ((event.source.source === 'manual') !== (masterChoice.source === 'manual')) {
				throw new ReplayIntegrityError(
					'Master timing source and action evidence diverged',
					event.sequence
				);
			}
			const missionContinues =
				expected.status === 'active' &&
				expected.mission.attempt !== null &&
				['deployed', 'resolving'].includes(expected.mission.attempt.status);
			const expectedTiming = resolveMasterDecision(
				state.masterControl,
				event.commandId,
				payload.decisionResolution.decisionId,
				payload.decisionResolution.resolvedAt,
				masterChoice.actionId,
				event.source,
				missionContinues
			);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedTiming.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedTiming.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError('Master timing round payload diverged', event.sequence);
			}
			return EngineGameStateV19Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 16 || state.schemaVersion === 17 || state.schemaVersion === 18) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Mission aftermath round precondition failed',
					event.sequence
				);
			}
			const payload =
				state.schemaVersion === 18
					? MissionAttemptAftermathTurnResolvedPayloadSchema.parse(event.payload)
					: state.schemaVersion === 17
						? MissionMasterTurnResolvedPayloadSchema.parse(event.payload)
						: MissionAftermathTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission aftermath round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices, event.eventId);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.consequences) !== hashCanonical(payload.consequences) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Mission aftermath round payload diverged', event.sequence);
			}
			const candidate = {
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				heroes: expected.heroes,
				items: expected.items,
				society: expected.society,
				master: expected.master,
				status: expected.status
			};
			return state.schemaVersion === 18
				? EngineGameStateV18Schema.parse(candidate)
				: state.schemaVersion === 17
					? EngineGameStateV17Schema.parse(candidate)
					: EngineGameStateV16Schema.parse(candidate);
		}
		if (state.schemaVersion === 15) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError('Portal mission round precondition failed', event.sequence);
			}
			const payload = MissionPortalTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Portal mission round version diverged', event.sequence);
			}
			const expected = resolvePortalMissionTurn(state, payload.choices);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Portal mission round payload diverged', event.sequence);
			}
			return EngineGameStateV15Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 14) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError(
					'Mission evidence round precondition failed',
					event.sequence
				);
			}
			const payload = MissionCombatTurnResolvedPayloadV4Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission evidence round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Mission evidence round payload diverged', event.sequence);
			}
			return EngineGameStateV14Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 13) {
			if (event.actorId !== state.master.masterId || event.gameTime !== state.simulatedAt) {
				throw new ReplayIntegrityError('Mission combat round precondition failed', event.sequence);
			}
			const payload = MissionCombatTurnResolvedPayloadSchema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission combat round version diverged', event.sequence);
			}
			const expected = resolveMissionCombatTurn(state, payload.choices);
			if (
				expected.entropyCursor !== event.seedCursor ||
				hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
				hashCanonical(expected.round) !== hashCanonical(payload.round) ||
				hashCanonical(expected.mission) !== hashCanonical(payload.mission)
			) {
				throw new ReplayIntegrityError('Mission combat round payload diverged', event.sequence);
			}
			return EngineGameStateV13Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (
			state.schemaVersion !== 12 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt
		) {
			throw new ReplayIntegrityError('Mission round precondition failed', event.sequence);
		}
		const payload = MissionTurnResolvedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Mission round version diverged', event.sequence);
		}
		const expected = resolveMissionTurn(state, payload.choices);
		if (
			expected.entropyCursor !== event.seedCursor ||
			hashCanonical(expected.entropyDraws) !== hashCanonical(payload.entropyDraws) ||
			hashCanonical(expected.round) !== hashCanonical(payload.round) ||
			hashCanonical(expected.mission) !== hashCanonical(payload.mission)
		) {
			throw new ReplayIntegrityError('Mission round payload diverged', event.sequence);
		}
		return EngineGameStateV12Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			mission: payload.mission
		});
	}
	if (
		[
			'mission.preparation.started',
			'mission.party.revised',
			'mission.preparation.canceled',
			'mission.deployed',
			'mission.extraction.opened',
			'mission.extracted',
			'mission.retreated'
		].includes(event.eventType)
	) {
		if (state.schemaVersion === 23) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'First-band mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV11Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'First-band mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('First-band mission event type diverged', event.sequence);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const storyState = reduceFirstBandMissionConsequences(state, {
				eventId: event.eventId,
				sequence: event.sequence,
				transition: payload.transition,
				mission: payload.mission,
				bandStory: payload.bandStory,
				firstBandArchive: payload.firstBandArchive
			});
			if (hashCanonical(expectedMission) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'First-band mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError('First-band deployment entropy diverged', event.sequence);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('First-band transition entropy diverged', event.sequence);
			}
			return EngineGameStateV23Schema.parse({
				...storyState,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				bandStory: payload.bandStory,
				firstBandArchive: payload.firstBandArchive
			});
		}
		if (state.schemaVersion === 20) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Master fallback mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV10Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Master fallback mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError(
					'Master fallback mission event type diverged',
					event.sequence
				);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const expectedControl =
				expectedMission.attempt !== null &&
				!['deployed', 'resolving'].includes(expectedMission.attempt.status)
					? endMasterDecisionV2(state.masterControl, event.source)
					: { control: state.masterControl, resolution: null };
			if (
				hashCanonical(expectedMission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedControl.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedControl.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError(
					'Master fallback mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Master fallback deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Master fallback transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV20Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 19) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Master timing mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV9Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Master timing mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Master timing mission event type diverged', event.sequence);
			}
			const expectedMission =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			const expectedControl =
				expectedMission.attempt !== null &&
				!['deployed', 'resolving'].includes(expectedMission.attempt.status)
					? endMasterDecision(state.masterControl, event.source)
					: { control: state.masterControl, resolution: null };
			if (
				hashCanonical(expectedMission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedControl.control) !== hashCanonical(payload.masterControl) ||
				hashCanonical(expectedControl.resolution) !== hashCanonical(payload.decisionResolution)
			) {
				throw new ReplayIntegrityError(
					'Master timing mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Master timing deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Master timing transition entropy diverged', event.sequence);
			}
			return EngineGameStateV19Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				masterControl: payload.masterControl
			});
		}
		if (state.schemaVersion === 16 || state.schemaVersion === 17 || state.schemaVersion === 18) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition precondition failed',
					event.sequence
				);
			}
			const payload =
				state.schemaVersion === 18
					? MissionTransitionPayloadV8Schema.parse(event.payload)
					: state.schemaVersion === 17
						? MissionTransitionPayloadV7Schema.parse(event.payload)
						: MissionTransitionPayloadV6Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission aftermath event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Mission aftermath deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition entropy diverged',
					event.sequence
				);
			}
			const candidate = {
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			};
			return state.schemaVersion === 18
				? EngineGameStateV18Schema.parse(candidate)
				: state.schemaVersion === 17
					? EngineGameStateV17Schema.parse(candidate)
					: EngineGameStateV16Schema.parse(candidate);
		}
		if (state.schemaVersion === 15) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Portal mission transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV5Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Portal mission transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Portal mission event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? {
							mission: prepareMissionAttempt(
								state,
								event.commandId,
								payload.heroIds,
								payload.mission.binding.missionId
							),
							resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
						}
					: payload.transition === 'revise-party'
						? {
								mission: reviseMissionParty(state, payload.heroIds),
								resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
							}
						: payload.transition === 'cancel'
							? {
									mission: cancelMissionPreparation(state),
									resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
								}
							: payload.transition === 'deploy'
								? {
										mission: deployMissionAttempt(state, spawnMissionCombatants).mission,
										resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
									}
								: payload.transition === 'extract'
									? completePortalMissionExtraction(state)
									: {
											mission: retreatMissionAttempt(state, appendPortalCargoLosses),
											resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
										};
			if (
				hashCanonical(expected.mission) !== hashCanonical(payload.mission) ||
				hashCanonical(expected.resourceChanges) !== hashCanonical(payload.resourceChanges)
			) {
				throw new ReplayIntegrityError(
					'Portal mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError('Portal deployment entropy diverged', event.sequence);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError('Portal transition entropy diverged', event.sequence);
			}
			return EngineGameStateV15Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission,
				settlement: applyResourceChanges(state, event, payload.resourceChanges)
			});
		}
		if (state.schemaVersion === 14) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Mission evidence transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV4Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Mission evidence transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission evidence event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(
							state,
							event.commandId,
							payload.heroIds,
							payload.mission.binding.missionId
						)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission evidence transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Mission evidence deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Mission evidence transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV14Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 13) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError(
					'Mission combat transition precondition failed',
					event.sequence
				);
			}
			const payload = MissionTransitionPayloadV3Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError(
					'Mission combat transition version diverged',
					event.sequence
				);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission combat event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(state, event.commandId, payload.heroIds)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission combat transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state, spawnMissionCombatants);
				if (
					deployment.entropyCursor !== event.seedCursor ||
					hashCanonical(deployment.entropyDraws) !== hashCanonical(payload.entropyDraws)
				) {
					throw new ReplayIntegrityError(
						'Mission combat deployment entropy diverged',
						event.sequence
					);
				}
			} else if (event.seedCursor !== state.entropyCursor || payload.entropyDraws.length !== 0) {
				throw new ReplayIntegrityError(
					'Mission combat transition entropy diverged',
					event.sequence
				);
			}
			return EngineGameStateV13Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (state.schemaVersion === 12) {
			if (
				event.actorId !== state.master.masterId ||
				event.gameTime !== state.simulatedAt ||
				event.eventType === 'mission.extraction.opened'
			) {
				throw new ReplayIntegrityError('Mission transition precondition failed', event.sequence);
			}
			const payload = MissionTransitionPayloadV2Schema.parse(event.payload);
			if (payload.nextVersion !== state.version + 1) {
				throw new ReplayIntegrityError('Mission transition version diverged', event.sequence);
			}
			const eventTypes = {
				prepare: 'mission.preparation.started',
				'revise-party': 'mission.party.revised',
				cancel: 'mission.preparation.canceled',
				deploy: 'mission.deployed',
				extract: 'mission.extracted',
				retreat: 'mission.retreated'
			} as const;
			if (eventTypes[payload.transition] !== event.eventType) {
				throw new ReplayIntegrityError('Mission event type diverged', event.sequence);
			}
			const expected =
				payload.transition === 'prepare'
					? prepareMissionAttempt(state, event.commandId, payload.heroIds)
					: payload.transition === 'revise-party'
						? reviseMissionParty(state, payload.heroIds)
						: payload.transition === 'cancel'
							? cancelMissionPreparation(state)
							: payload.transition === 'deploy'
								? deployMissionAttempt(state, spawnMissionCombatants).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError('Mission transition payload diverged', event.sequence);
			}
			return EngineGameStateV12Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				mission: payload.mission
			});
		}
		if (
			state.schemaVersion !== 11 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt
		) {
			throw new ReplayIntegrityError('Mission transition precondition failed', event.sequence);
		}
		const payload = MissionTransitionPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Mission transition version diverged', event.sequence);
		}
		const eventTypes = {
			prepare: 'mission.preparation.started',
			'revise-party': 'mission.party.revised',
			cancel: 'mission.preparation.canceled',
			deploy: 'mission.deployed',
			'open-extraction': 'mission.extraction.opened',
			extract: 'mission.extracted',
			retreat: 'mission.retreated'
		} as const;
		if (eventTypes[payload.transition] !== event.eventType) {
			throw new ReplayIntegrityError('Mission event type diverged', event.sequence);
		}
		const expected =
			payload.transition === 'prepare'
				? prepareMissionAttempt(state, event.commandId, payload.heroIds)
				: payload.transition === 'revise-party'
					? reviseMissionParty(state, payload.heroIds)
					: payload.transition === 'cancel'
						? cancelMissionPreparation(state)
						: payload.transition === 'deploy'
							? deployMissionAttempt(state, spawnMissionCombatants).mission
							: payload.transition === 'open-extraction'
								? openMissionExtraction(state, payload.completedObjectiveIds)
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state, appendPortalCargoLosses);
		if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
			throw new ReplayIntegrityError('Mission transition payload diverged', event.sequence);
		}
		return EngineGameStateV11Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			mission: payload.mission
		});
	}
	throw new ReplayIntegrityError(`Unsupported event type: ${event.eventType}`, event.sequence);
}

function reduceParsedEvent(state: EngineGameState, event: AuthoritativeEvent): EngineGameState {
	if (event.runId !== state.runId)
		throw new ReplayIntegrityError('Event run does not match state', event.sequence);
	if (event.sequence !== state.eventCursor + 1)
		throw new ReplayIntegrityError('Event sequence is not contiguous', event.sequence);
	const reduced =
		state.schemaVersion === 1 ? reduceLegacyEvent(state, event) : reduceV2Event(state, event);
	if (
		state.schemaVersion !== 10 &&
		state.schemaVersion !== 11 &&
		state.schemaVersion !== 12 &&
		state.schemaVersion !== 13 &&
		state.schemaVersion !== 16
	)
		return reduced;
	const influences = z
		.array(DirectiveInfluenceRecordSchema)
		.max(16)
		.parse((event.payload as Record<string, unknown>).directiveInfluences ?? []);
	if (influences.length === 0) return reduced;
	if (
		reduced.schemaVersion !== 10 &&
		reduced.schemaVersion !== 11 &&
		reduced.schemaVersion !== 12 &&
		reduced.schemaVersion !== 13 &&
		reduced.schemaVersion !== 16
	) {
		throw new ReplayIntegrityError('Directive influence changed schema version', event.sequence);
	}
	const directives = { ...reduced.society.directives };
	const directiveInfluences = { ...reduced.society.directiveInfluences };
	for (const influence of influences) {
		const directive = state.society.directives[influence.directiveId];
		if (
			!directive ||
			directive.status !== 'active' ||
			influence.heroId !== event.actorId ||
			influence.sourceEventId !== event.eventId ||
			influence.evaluatedAt !== state.simulatedAt ||
			!event.source.directiveIds.includes(influence.directiveId) ||
			influence.decisionJobId !== event.source.decisionJobId
		) {
			throw new ReplayIntegrityError('Directive influence provenance diverged', event.sequence);
		}
		directiveInfluences[influence.influenceId] = influence;
		if (directive.scope === 'decision') {
			directives[directive.directiveId] = DirectiveRecordSchema.parse({
				...directive,
				status: 'consumed',
				terminalAt: event.gameTime,
				terminalEventId: event.eventId
			});
		}
	}
	const next = {
		...reduced,
		society: {
			...reduced.society,
			directives,
			directiveInfluences
		}
	};
	return parseModernState(reduced, next);
}

export function reduceEvent(
	stateInput: EngineGameState,
	eventInput: AuthoritativeEvent
): EngineGameState {
	return reduceParsedEvent(
		EngineGameStateSchema.parse(stateInput),
		AuthoritativeEventSchema.parse(eventInput)
	);
}

export function scheduledEventsFromEvent(event: AuthoritativeEvent): readonly ScheduledEvent[] {
	if (event.eventType === 'hero.activity.started')
		return [ActivityStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.travel.started')
		return [TravelStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.routine.started')
		return [RoutineStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (
		event.eventType === 'social.directive.issued' ||
		event.eventType === 'social.directive.replaced'
	) {
		const scheduledEvent = DirectiveChangedPayloadSchema.parse(event.payload).scheduledEvent;
		return scheduledEvent ? [scheduledEvent] : [];
	}
	return [];
}

export function resolvedScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'resolvedScheduledEventIds');
}

export function canceledScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'canceledScheduledEventIds');
}

const DIRECTIVE_STOP_WORDS = new Set([
	'and',
	'are',
	'before',
	'choose',
	'for',
	'from',
	'that',
	'the',
	'then',
	'this',
	'with',
	'you',
	'your'
]);

function directiveTerms(directive: DirectiveRecord): string[] {
	return [...directive.text.toLowerCase().split(/[^a-z0-9]+/u), ...directive.priorities]
		.map((term) => term.toLowerCase().trim())
		.filter((term) => term.length >= 3 && !DIRECTIVE_STOP_WORDS.has(term));
}

function actionMatchesDirective(action: LegalAction, directive: DirectiveRecord): boolean {
	const searchable = [action.actionId, action.label, action.description, ...action.tags]
		.join(' ')
		.toLowerCase();
	return directiveTerms(directive).some((term) => searchable.includes(term));
}

function attachDirectiveInfluences(
	state: EngineGameState,
	command: EngineCommand,
	event: AuthoritativeEvent
): AuthoritativeEvent {
	if (
		(state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20) ||
		!state.heroes[command.actorId] ||
		command.source.directiveIds.length === 0
	) {
		return event;
	}
	const legal = legalActionsForParsedState(state, command.actorId);
	const actionId = requiredAction(command);
	const selected = legal.find((action) => action.actionId === actionId);
	if (!selected) return event;
	const influences = command.source.directiveIds
		.map((directiveId) => state.society.directives[directiveId])
		.filter((directive): directive is DirectiveRecord =>
			Boolean(
				directive &&
				directive.status === 'active' &&
				directive.recipientIds.includes(command.actorId)
			)
		)
		.map((directive) => {
			const selectedMatches = actionMatchesDirective(selected, directive);
			const alternativeMatches = legal.some(
				(action) => action.actionId !== actionId && actionMatchesDirective(action, directive)
			);
			const outcome = selectedMatches
				? ('advanced' as const)
				: alternativeMatches
					? ('conflicted' as const)
					: ('unavailable' as const);
			return DirectiveInfluenceRecordSchema.parse({
				influenceId: deterministicUuid(`${event.eventId}:${directive.directiveId}:influence`),
				directiveId: directive.directiveId,
				heroId: command.actorId,
				sourceEventId: event.eventId,
				decisionJobId: command.source.decisionJobId,
				actionId,
				outcome,
				rationale:
					outcome === 'advanced'
						? 'The chosen legal action matched the direction text or its structured priorities.'
						: outcome === 'conflicted'
							? 'Another legal action matched the direction more closely than the chosen action.'
							: 'No legal action matched the direction; the direction could not expand the legal set.',
				evaluatedAt: state.simulatedAt
			});
		});
	if (influences.length === 0) return event;
	return AuthoritativeEventSchema.parse({
		...event,
		payload: { ...event.payload, directiveInfluences: influences }
	});
}

export function applyCommand(
	stateInput: EngineGameState,
	commandInput: EngineCommand
): EngineApplyResult {
	const state = EngineGameStateSchema.parse(stateInput);
	const command = EngineCommandSchema.parse(commandInput);
	assertCommandIsLegal(state, command);
	const builtEvent =
		state.schemaVersion === 1 ? buildLegacyEvent(state, command) : buildV2Event(state, command);
	const eventDraft = attachDirectiveInfluences(state, command, builtEvent);
	const nextState = reduceParsedEvent(state, eventDraft);
	const stateHash = hashParsedGameState(nextState);
	const event = AuthoritativeEventSchema.parse({ ...eventDraft, afterStateHash: stateHash });
	return {
		state: nextState,
		stateHash,
		events: [event],
		scheduled: scheduledEventsFromEvent(event),
		resolvedScheduledEventIds: resolvedScheduledEventIdsFromEvent(event),
		canceledScheduledEventIds: canceledScheduledEventIdsFromEvent(event),
		decisionRequests: [],
		legalActions: legalActionsForParsedState(nextState, command.actorId)
	};
}

function replayCheck(
	event: AuthoritativeEvent,
	computedStateHash: string,
	verified: boolean
): ReplayCheck {
	return {
		sequence: event.sequence,
		gameTime: event.gameTime,
		eventType: event.eventType,
		actorId: event.actorId,
		source: event.source,
		summary: eventSummary(event),
		beforeStateHash: event.beforeStateHash,
		afterStateHash: event.afterStateHash,
		computedStateHash,
		verified,
		entropyDraws: entropyDrawsFromEvent(event),
		deltas: eventDeltas(event)
	};
}

export function replayEvents(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	if (eventInputs.length === 0) throw new ReplayIntegrityError('Replay has no bootstrap event', 0);
	const events = eventInputs.map((event) => AuthoritativeEventSchema.parse(event));
	const first = events[0];
	if (!first || first.sequence !== 1 || first.eventType !== 'run.initialized') {
		throw new ReplayIntegrityError(
			'Replay must begin with run.initialized at sequence 1',
			first?.sequence ?? 0
		);
	}
	const initialized = InitializedPayloadSchema.parse(first.payload);
	let state = initialized.initialState;
	let computedHash = hashParsedGameState(state);
	const checks: ReplayCheck[] = [
		replayCheck(
			first,
			computedHash,
			first.beforeStateHash === EMPTY_STATE_HASH && first.afterStateHash === computedHash
		)
	];
	for (const event of events.slice(1)) {
		const beforeHash = hashParsedGameState(state);
		state = reduceParsedEvent(state, event);
		computedHash = hashParsedGameState(state);
		checks.push(
			replayCheck(
				event,
				computedHash,
				event.beforeStateHash === beforeHash && event.afterStateHash === computedHash
			)
		);
	}
	return {
		snapshot: EngineSnapshotSchema.parse({ state, stateHash: computedHash }),
		checks,
		verified: checks.every((check) => check.verified)
	};
}

export function replayEventsStrict(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	const replay = replayEvents(eventInputs);
	const failed = replay.checks.find((check) => !check.verified);
	if (failed) throw new ReplayIntegrityError('Replay state hash mismatch', failed.sequence);
	return replay;
}
