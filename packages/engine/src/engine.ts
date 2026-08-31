import {
	AuthoritativeEventSchema,
	CharacterMindSchema,
	CommunicativeActSchema,
	HeroConversationTurnSchema,
	CurrentRoutineSchema,
	DailyPlanSchema,
	EngineCommandSchema,
	EngineGameStateSchema,
	EngineGameStateV1Schema,
	EngineGameStateV2Schema,
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV8Schema,
	EngineGameStateV9Schema,
	EngineGameStateV10Schema,
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
	HeroBuildingAssignmentSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	HeroProgressionSchema,
	HabitStateSchema,
	FirstEmberStateSchema,
	FirstBandArchiveStateSchema,
	FirstBandExtractionReceiptSchema,
	FirstBandArchiveRevealSchema,
	InjurySchema,
	LegalActionSchema,
	NeedStateSchema,
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
	MasterFallbackSelectionSchema,
	ResourceKeySchema,
	RuntimeBandStoryStateSchema,
	RoutineResolutionSchema,
	ScheduledEventSchema,
	StoryPatchCandidateSchema,
	StoryPatchValidationReportSchema,
	AppliedStoryPatchSchema,
	SettlementRoutePlanSchema,
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	SocietyStateV4Schema,
	SocietyStateV5Schema,
	SynthesisReceiptSchema,
	SynthesisRumorRecordSchema,
	SynthesisStateSchema,
	DirectiveRecordSchema,
	DirectiveInfluenceRecordSchema,
	type ActivityKind,
	type ActionSource,
	type AuthoritativeEvent,
	type BuildingAssignmentRole,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV1,
	type EngineGameStateV3,
	type EngineGameStateV4,
	type EngineGameStateV5,
	type EngineGameStateV6,
	type EngineGameStateV7,
	type EngineGameStateV8,
	type EngineGameStateV9,
	type EngineGameStateV10,
	type EngineGameStateV11,
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
	type EngineGameStateV22,
	type EngineGameStateV23,
	type EntropyDraw,
	type FirstEmberFacility,
	type FirstEmberRationale,
	type ConversationOrderIntent,
	type ConversationOrderOutcome,
	type HeroDecisionPacket,
	type HeroPolicyResult,
	type LegalAction,
	type MasterControlState,
	type MasterControlStateV2,
	type MasterDecisionResolution,
	type MasterDecisionResolutionV2,
	type MasterFallbackConfiguration,
	type MasterFallbackSelection,
	type MissionPackage,
	type MissionRunState,
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
	type RoutineKind,
	type SettlementDefinition,
	type SocietyState,
	type SocietyStateV2,
	type SocietyStateV3,
	type SocietyStateV4,
	type SocietyStateV5,
	type SynthesisReceipt,
	type SynthesisRumorRecord,
	type DirectiveRecord,
	type ScheduledEvent,
	type StoryPatchCastMember
} from '@summonlab/contracts';
import {
	IRON_MOON_PACKAGE,
	MONSTER_POLICY_CATALOG,
	TOWER_FLOOR_01_PACKAGE,
	resolveStoryExpression,
	applyMissionDiscoveryAffordance,
	listLegalMissionDiscoveryAffordances,
	planMissionRoute,
	projectMissionArenaKnowledge,
	monsterPolicy,
	visitMissionNode,
	planSettlementRoute
} from '@summonlab/content';
import { z } from 'zod';

import { createEntropyCursor, drawInteger } from './entropy.js';
import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from './errors.js';
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from './hash.js';
import { eventDeltas, eventSummary } from './journal.js';
import { applyValidatedStoryPatch, validateStoryPatch } from './story.js';
import { addGameMinutes, addGameSeconds, compareGameTime, gameMinutesBetween } from './time.js';
import {
	missionContentForState,
	settlementForState,
	verifiedMissionBinding,
	verifiedMissionContent,
	verifiedSettlementContent,
	verifiedStoryEnvelope
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
	EngineRoutineState,
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
	hasFacilityState,
	hasFirstEmberState,
	hasNavigationState,
	hasRoutineState,
	isModernState
} from './core/versions.js';

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

const BUILDING_OPERATIONS = Object.freeze({
	'summoning-gate': {
		nodeId: 'gate-rail',
		role: 'gate-attendant',
		baselinePowerState: 'reserve'
	},
	kitchen: { nodeId: 'kitchen-hearth', role: 'cook', baselinePowerState: 'reserve' },
	dormitory: { nodeId: 'dormitory-bunks', role: 'resident', baselinePowerState: 'reserve' },
	'training-ground': {
		nodeId: 'training-ring',
		role: 'trainee',
		baselinePowerState: 'reserve'
	},
	workshop: { nodeId: 'workshop-bench', role: 'artisan', baselinePowerState: 'unpowered' }
} as const satisfies Record<
	string,
	{
		readonly nodeId: string;
		readonly role: BuildingAssignmentRole;
		readonly baselinePowerState: 'reserve' | 'unpowered';
	}
>);

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

const ChoosePayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	destination: z.enum(['kitchen', 'training-ground']),
	firstLine: z.string(),
	storyBranch: z.string(),
	nextVersion: z.number().int().nonnegative()
}).strict();
const ArrivePayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	destination: z.enum(['kitchen', 'training-ground']),
	nextVersion: z.number().int().nonnegative()
}).strict();
const InspectPayloadSchema = EmptyMetadataSchema.extend({
	masterId: z.string().uuid(),
	resonance: z.number().int().min(0).max(99),
	nextVersion: z.number().int().nonnegative()
}).strict();

const ResourceChangeSchema = z
	.object({
		resource: ResourceKeySchema,
		before: z.number().int().nonnegative(),
		after: z.number().int().nonnegative(),
		delta: z.number().int(),
		reason: z.string().min(1).max(120)
	})
	.strict()
	.refine((value) => value.after - value.before === value.delta, {
		message: 'Resource change delta is invalid'
	});

const ActivityStartedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	activity: z.enum(['train', 'eat', 'rest', 'repair']),
	activityId: z.string().uuid(),
	scheduledEvent: ScheduledEventSchema,
	resourceChanges: z.array(ResourceChangeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

const TravelStartedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	travelId: z.string().uuid(),
	fromNodeId: z.string(),
	toNodeId: z.string(),
	destinationZone: z.enum([
		'summoning-gate',
		'kitchen',
		'training-ground',
		'dormitory',
		'workshop',
		'settlement-exterior'
	]),
	route: SettlementRoutePlanSchema,
	settlementContentVersion: z.string(),
	settlementContentHash: z.string().length(64),
	scheduledEvent: ScheduledEventSchema,
	nextVersion: z.number().int().nonnegative()
}).strict();

const AssignmentChangedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	previousAssignment: HeroBuildingAssignmentSchema.nullable(),
	assignment: HeroBuildingAssignmentSchema.nullable(),
	nextVersion: z.number().int().nonnegative()
}).strict();

const PowerStateChangeSchema = z
	.object({
		buildingId: z.string(),
		before: z.enum(['unpowered', 'reserve', 'powered']),
		after: z.enum(['unpowered', 'reserve', 'powered'])
	})
	.strict();

const PowerAllocatedPayloadSchema = EmptyMetadataSchema.extend({
	buildingId: z.string(),
	previousPoweredBuildingId: z.string().nullable(),
	powerStateChanges: z.array(PowerStateChangeSchema).min(1),
	activeSystemIdsAfter: z.array(z.string()),
	nextVersion: z.number().int().nonnegative()
}).strict();

const FirstEmberRecoveredPayloadSchema = EmptyMetadataSchema.extend({
	firstEmber: FirstEmberStateSchema,
	nextVersion: z.number().int().nonnegative()
}).strict();

const FirstEmberCommittedPayloadSchema = EmptyMetadataSchema.extend({
	firstEmber: FirstEmberStateSchema,
	society: z
		.union([SocietyStateSchema, SocietyStateV2Schema, SocietyStateV3Schema, SocietyStateV4Schema])
		.optional(),
	previousPoweredBuildingId: z.string().nullable(),
	powerStateChanges: z.array(PowerStateChangeSchema).min(1),
	activeSystemIdsAfter: z.array(z.string()),
	nextVersion: z.number().int().nonnegative()
}).strict();

const CommunicativeActRecordedPayloadSchema = EmptyMetadataSchema.extend({
	communicativeAct: CommunicativeActSchema,
	society: z.union([SocietyStateV2Schema, SocietyStateV3Schema, SocietyStateV4Schema]),
	nextVersion: z.number().int().nonnegative()
}).strict();

const ConversationTurnRecordedPayloadSchema = EmptyMetadataSchema.extend({
	conversationTurn: HeroConversationTurnSchema,
	society: z.union([SocietyStateV3Schema, SocietyStateV4Schema]),
	nextVersion: z.number().int().nonnegative()
}).strict();

const DirectiveChangedPayloadSchema = EmptyMetadataSchema.extend({
	directive: DirectiveRecordSchema,
	previousDirective: DirectiveRecordSchema.nullable(),
	communicativeAct: CommunicativeActSchema.nullable(),
	society: SocietyStateV4Schema,
	scheduledEvent: ScheduledEventSchema.nullable(),
	nextVersion: z.number().int().nonnegative()
}).strict();

const DailyPlanCreatedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	dailyPlan: DailyPlanSchema,
	nextVersion: z.number().int().nonnegative()
}).strict();

const RoutineStartedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	currentRoutine: CurrentRoutineSchema,
	scheduledEvent: ScheduledEventSchema,
	resourceChanges: z.array(ResourceChangeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

const ItemEquippedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	itemId: z.string().uuid(),
	previousItemId: z.string().uuid().nullable(),
	nextVersion: z.number().int().nonnegative()
}).strict();

const ItemUpdateSchema = z
	.object({
		itemId: z.string().uuid(),
		durabilityAfter: z.number().int().nonnegative()
	})
	.strict();

const ActivityOutcomeSchema = z
	.object({
		scheduledEventId: z.string().uuid(),
		heroId: z.string().uuid(),
		activity: z.enum(['train', 'eat', 'rest', 'repair']),
		healthAfter: z.number().int().min(0).max(100),
		lifeStateAfter: z.enum(['active', 'dead', 'synthesized']),
		needsAfter: NeedStateSchema,
		injuriesAfter: z.array(InjurySchema),
		progressionAfter: HeroProgressionSchema,
		itemUpdate: ItemUpdateSchema.nullable(),
		rewardDeltas: RewardDeltasSchema
	})
	.strict();

const SimulationAdvancedPayloadSchema = EmptyMetadataSchema.extend({
	targetGameTime: z.string().datetime(),
	outcomes: z.array(ActivityOutcomeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

const TravelOutcomeSchema = z
	.object({
		scheduledEventId: z.string().uuid(),
		heroId: z.string().uuid(),
		travelId: z.string().uuid(),
		fromNodeId: z.string(),
		toNodeId: z.string(),
		locationAfter: z.enum([
			'summoning-gate',
			'kitchen',
			'training-ground',
			'dormitory',
			'workshop',
			'settlement-exterior'
		])
	})
	.strict();

const SimulationAdvancedPayloadV3Schema = EmptyMetadataSchema.extend({
	targetGameTime: z.string().datetime(),
	activityOutcomes: z.array(ActivityOutcomeSchema),
	travelOutcomes: z.array(TravelOutcomeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

const RoutineOutcomeSchema = z
	.object({
		scheduledEventId: z.string().uuid(),
		heroId: z.string().uuid(),
		planId: z.string().uuid(),
		planEntryId: z.string().uuid(),
		kind: z.enum([
			'checks-exits',
			'stretches-at-dawn',
			'shares-breakfast',
			'catalogues-tools',
			'walks-the-walls',
			'practises-knots',
			'assigned-duty',
			'self-directed',
			'meal',
			'sleep'
		]),
		needsAfter: NeedStateSchema,
		healthAfter: z.number().int().min(0).max(100),
		habitAfter: HabitStateSchema,
		rewardDeltas: RewardDeltasSchema
	})
	.strict();

const SimulationAdvancedPayloadV5Schema = EmptyMetadataSchema.extend({
	targetGameTime: z.string().datetime(),
	activityOutcomes: z.array(ActivityOutcomeSchema),
	travelOutcomes: z.array(TravelOutcomeSchema),
	routineOutcomes: z.array(RoutineOutcomeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

const SimulationClockSyncedPayloadSchema = EmptyMetadataSchema.extend({
	targetGameTime: z.string().datetime(),
	nextVersion: z.number().int().nonnegative()
}).strict();

const DamagePayloadSchema = EmptyMetadataSchema.extend({
	targetId: z.string().uuid(),
	targetKind: z.enum(['master', 'hero']),
	damageKind: z.enum(['hazard', 'training', 'combat']),
	amount: z.number().int().min(1).max(100),
	healthBefore: z.number().int().min(0).max(100),
	healthAfter: z.number().int().min(0).max(100),
	injury: InjurySchema.nullable(),
	nextVersion: z.number().int().nonnegative()
}).strict();

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

const StoryPatchAppliedPayloadSchema = EmptyMetadataSchema.extend({
	candidate: StoryPatchCandidateSchema,
	validation: StoryPatchValidationReportSchema,
	patch: AppliedStoryPatchSchema,
	bandStory: RuntimeBandStoryStateSchema,
	nextVersion: z.number().int().positive()
}).strict();

const SynthesisCommittedPayloadSchema = EmptyMetadataSchema.extend({
	receipt: SynthesisReceiptSchema,
	nextVersion: z.number().int().positive()
}).strict();

const SynthesisRumorSharedPayloadSchema = EmptyMetadataSchema.extend({
	rumor: SynthesisRumorRecordSchema,
	nextVersion: z.number().int().positive()
}).strict();

const FirstBandArchiveRevealedPayloadSchema = EmptyMetadataSchema.extend({
	reveal: FirstBandArchiveRevealSchema,
	firstBandArchive: FirstBandArchiveStateSchema,
	nextVersion: z.number().int().positive()
}).strict();

function masterDecisionWindow(
	control: MasterControlState,
	commandId: string,
	openedAt: string
): MasterControlState {
	if (control.activeDecision) throw new IllegalActionError('master.decision.open');
	const ordinal = control.decisionOrdinal + 1;
	return MasterControlStateSchema.parse({
		...control,
		decisionOrdinal: ordinal,
		activeDecision: {
			decisionId: deterministicUuid(`${commandId}:master-decision:${ordinal}`),
			ordinal,
			timing: control.timing,
			openedAt,
			expiresAt:
				control.timing === 'countdown' ? addGameSeconds(openedAt, control.countdownSeconds) : null
		}
	});
}

function pausedMasterDecision(
	control: MasterControlState,
	resolvedAt: string,
	source: ActionSource
): MasterDecisionResolution | null {
	const active = control.activeDecision;
	if (!active) return null;
	return MasterDecisionResolutionSchema.parse({
		...active,
		resolvedAt,
		outcome: 'paused',
		expiryOutcome: 'paused',
		resolvedActionId: null,
		source: { ...source, timing: active.timing }
	});
}

function configureMasterTiming(
	control: MasterControlState,
	commandId: string,
	timing: MasterControlState['timing'],
	countdownSeconds: number,
	observedAt: string,
	source: ActionSource
): { readonly control: MasterControlState; readonly paused: MasterDecisionResolution | null } {
	const paused = pausedMasterDecision(control, observedAt, source);
	const configured = MasterControlStateSchema.parse({
		...control,
		timing,
		countdownSeconds,
		revision: control.revision + 1,
		activeDecision: null,
		lastResolution: paused ?? control.lastResolution
	});
	return {
		paused,
		control: paused ? masterDecisionWindow(configured, commandId, observedAt) : configured
	};
}

function resolveMasterDecision(
	control: MasterControlState,
	commandId: string,
	decisionId: string,
	resolvedAt: string,
	actionId: string,
	source: ActionSource,
	missionContinues: boolean
): { readonly control: MasterControlState; readonly resolution: MasterDecisionResolution } {
	const active = control.activeDecision;
	if (!active || active.decisionId !== decisionId || source.timing !== active.timing) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const resolvedMillis = Date.parse(resolvedAt);
	const openedMillis = Date.parse(active.openedAt);
	const expiresMillis = active.expiresAt ? Date.parse(active.expiresAt) : null;
	if (resolvedMillis < openedMillis) throw new IllegalActionError('mission.resolve.turn');
	const manual = source.source === 'manual';
	const fallback =
		active.timing !== 'wait' &&
		(source.source === 'countdown' || source.source === 'step' || source.source === 'continuous') &&
		source.source === active.timing;
	if (!manual && !fallback) throw new IllegalActionError('mission.resolve.turn');
	if (manual && active.timing !== 'wait' && active.timing !== 'countdown') {
		throw new IllegalActionError('mission.resolve.turn');
	}
	if (active.timing === 'countdown') {
		if (expiresMillis === null) throw new IllegalActionError('mission.resolve.turn');
		if (
			(manual && resolvedMillis >= expiresMillis) ||
			(fallback && resolvedMillis < expiresMillis)
		) {
			throw new IllegalActionError('mission.resolve.turn');
		}
	}
	const outcome = manual ? 'manual' : 'fallback';
	const expiryOutcome =
		active.timing === 'countdown'
			? manual
				? 'manual-before-expiry'
				: 'expired-to-fallback'
			: fallback
				? 'immediate-fallback'
				: 'not-applicable';
	const resolution = MasterDecisionResolutionSchema.parse({
		...active,
		resolvedAt,
		outcome,
		expiryOutcome,
		resolvedActionId: actionId,
		source
	});
	let next = MasterControlStateSchema.parse({
		...control,
		timing: active.timing === 'step' ? 'wait' : control.timing,
		revision: control.revision + (active.timing === 'step' ? 1 : 0),
		activeDecision: null,
		lastResolution: resolution
	});
	if (missionContinues) next = masterDecisionWindow(next, commandId, resolvedAt);
	return { control: next, resolution };
}

function endMasterDecision(
	control: MasterControlState,
	source: ActionSource
): { readonly control: MasterControlState; readonly resolution: MasterDecisionResolution | null } {
	const active = control.activeDecision;
	if (!active) return { control, resolution: null };
	const resolution = MasterDecisionResolutionSchema.parse({
		...active,
		resolvedAt: active.openedAt,
		outcome: 'mission-ended',
		expiryOutcome: 'mission-ended',
		resolvedActionId: null,
		source: { ...source, source: 'system', timing: null, fallbackPolicy: null }
	});
	return {
		resolution,
		control: MasterControlStateSchema.parse({
			...control,
			activeDecision: null,
			lastResolution: resolution
		})
	};
}

function masterDecisionWindowV2(
	control: MasterControlStateV2,
	commandId: string,
	openedAt: string
): MasterControlStateV2 {
	if (control.activeDecision) throw new IllegalActionError('master.decision.open');
	const ordinal = control.decisionOrdinal + 1;
	return MasterControlStateV2Schema.parse({
		...control,
		decisionOrdinal: ordinal,
		activeDecision: {
			decisionId: deterministicUuid(`${commandId}:master-decision:${ordinal}`),
			ordinal,
			timing: control.timing,
			openedAt,
			expiresAt:
				control.timing === 'countdown' ? addGameSeconds(openedAt, control.countdownSeconds) : null,
			fallback: control.fallback
		}
	});
}

function pausedMasterDecisionV2(
	control: MasterControlStateV2,
	resolvedAt: string,
	source: ActionSource
): MasterDecisionResolutionV2 | null {
	const active = control.activeDecision;
	if (!active) return null;
	return MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt,
		outcome: 'paused',
		expiryOutcome: 'paused',
		resolvedActionId: null,
		source: { ...source, timing: active.timing },
		fallbackSelection: null
	});
}

function configureMasterTimingV2(
	control: MasterControlStateV2,
	commandId: string,
	timing: MasterControlStateV2['timing'],
	countdownSeconds: number,
	observedAt: string,
	source: ActionSource
): { readonly control: MasterControlStateV2; readonly paused: MasterDecisionResolutionV2 | null } {
	const paused = pausedMasterDecisionV2(control, observedAt, source);
	const configured = MasterControlStateV2Schema.parse({
		...control,
		timing,
		countdownSeconds,
		revision: control.revision + 1,
		activeDecision: null,
		lastResolution: paused ?? control.lastResolution,
		consecutiveFallbacks: timing === 'wait' ? 0 : control.consecutiveFallbacks
	});
	return {
		paused,
		control: paused ? masterDecisionWindowV2(configured, commandId, observedAt) : configured
	};
}

type MasterFallbackConfigurationInput = Pick<
	Extract<EngineCommand, { commandType: 'master.configure.fallback' }>,
	| 'commandId'
	| 'observedAt'
	| 'source'
	| 'policy'
	| 'directionText'
	| 'priorities'
	| 'protectedHeroId'
	| 'safetyStops'
>;

function configureMasterFallback(
	control: MasterControlStateV2,
	command: MasterFallbackConfigurationInput
): { readonly control: MasterControlStateV2; readonly paused: MasterDecisionResolutionV2 | null } {
	const paused = pausedMasterDecisionV2(control, command.observedAt, command.source);
	const fallback = MasterFallbackConfigurationSchema.parse({
		configurationVersion: 'master-fallback-v1',
		policy: command.policy,
		directionId: deterministicUuid(`${command.commandId}:master-fallback-direction`),
		directionText: command.directionText,
		priorities: command.priorities,
		protectedHeroId: command.protectedHeroId,
		safetyStops: command.safetyStops,
		configuredAt: command.observedAt
	});
	const configured = MasterControlStateV2Schema.parse({
		...control,
		fallback,
		revision: control.revision + 1,
		activeDecision: null,
		lastResolution: paused ?? control.lastResolution,
		consecutiveFallbacks: 0
	});
	return {
		paused,
		control: paused
			? masterDecisionWindowV2(configured, command.commandId, command.observedAt)
			: configured
	};
}

type MasterFallbackEngineState = EngineGameStateV20 | EngineGameStateV21;

function parseMasterFallbackState(state: MasterFallbackEngineState): MasterFallbackEngineState {
	return state.schemaVersion === 21
		? EngineGameStateV21Schema.parse(state)
		: EngineGameStateV20Schema.parse(state);
}

function masterFallbackPacket(state: MasterFallbackEngineState, legal: readonly LegalAction[]) {
	const active = state.masterControl.activeDecision!;
	const attempt = state.mission.attempt!;
	return {
		runId: state.runId,
		stateVersion: state.version,
		missionId: state.mission.binding.missionId,
		attemptId: attempt.attemptId,
		roundNumber: attempt.turnState.roundNumber,
		decision: active,
		master: {
			health: state.master.health,
			maxHealth: state.master.maxHealth,
			location: state.master.location
		},
		legalActionIds: legal.map((candidate) => candidate.actionId),
		threatIntentHashes: attempt.turnState.currentThreatIntents.map((intent) =>
			hashCanonical(intent)
		)
	};
}

function directionRecognized(direction: MasterFallbackConfiguration): boolean {
	return (
		direction.priorities.length > 0 ||
		/\b(hold|defend|guard|attack|fight|inspect|search|secret|recover|ember|objective|move|advance|protect|conserve)\b/iu.test(
			direction.directionText
		)
	);
}

function scoreDirectedAction(action: LegalAction, direction: MasterFallbackConfiguration): number {
	let score = 0;
	const id = action.actionId;
	const tags = new Set(action.tags);
	for (const [index, priority] of direction.priorities.entries()) {
		const weight = 100 - index * 10;
		if (priority === 'protect-self') {
			if (action.kind === 'defend' || id === 'mission.hold') score += weight;
			else if (action.kind === 'move') score += Math.round(weight * 0.3);
			else if (action.kind === 'attack') score += Math.round(weight * 0.15);
		}
		if (priority === 'protect-party') {
			if (action.kind === 'defend' || tags.has('protect')) score += Math.round(weight * 0.8);
			else if (action.kind === 'attack') score += Math.round(weight * 0.7);
			else if (action.kind === 'move') score += Math.round(weight * 0.25);
		}
		if (priority === 'focus-objective') {
			if (id.startsWith('mission.recover.')) score += Math.round(weight * 1.2);
			else if (action.kind === 'interact') score += Math.round(weight * 0.75);
			else if (action.kind === 'move') score += Math.round(weight * 0.4);
			else if (action.kind === 'attack') score += Math.round(weight * 0.25);
		}
		if (priority === 'seek-secrets') {
			if (id.startsWith('mission.inspect.')) score += Math.round(weight * 1.2);
			else if (tags.has('discovery') || tags.has('secret')) score += weight;
			else if (action.kind === 'interact') score += Math.round(weight * 0.6);
			else if (action.kind === 'move') score += Math.round(weight * 0.3);
		}
		if (priority === 'conserve-resources') {
			if (Object.keys(action.resourceCosts).length === 0) score += Math.round(weight * 0.55);
			if (action.kind === 'defend') score += Math.round(weight * 0.25);
			if (action.kind === 'attack') score -= Math.round(weight * 0.1);
		}
	}
	const text = direction.directionText.toLowerCase();
	if (/\b(hold|defend|guard)\b/u.test(text) && action.kind === 'defend') score += 60;
	if (/\b(attack|fight)\b/u.test(text) && action.kind === 'attack') score += 60;
	if (/\b(inspect|search|secret)\b/u.test(text) && id.startsWith('mission.inspect.')) score += 60;
	if (/\b(recover|ember|objective)\b/u.test(text) && id.startsWith('mission.recover.')) score += 60;
	if (/\b(move|advance)\b/u.test(text) && action.kind === 'move') score += 40;
	if (/\bprotect\b/u.test(text) && (action.kind === 'defend' || tags.has('protect'))) score += 40;
	if (direction.protectedHeroId && (action.kind === 'defend' || tags.has('protect'))) score += 35;
	return score;
}

export function isIrreversibleMasterAction(action: LegalAction): boolean {
	return (
		action.tags.some(
			(tag) => tag.startsWith('irreversible') || ['permanent', 'consume-hero'].includes(tag)
		) ||
		action.actionId.startsWith('mission.synthesize.') ||
		action.actionId.startsWith('mission.evolve.')
	);
}

export function selectMasterFallback(
	stateInput: MasterFallbackEngineState
): MasterFallbackSelection {
	const state = parseMasterFallbackState(stateInput);
	const active = state.masterControl.activeDecision;
	if (!active || active.timing === 'wait') throw new IllegalActionError('mission.resolve.turn');
	const legal = [...missionTurnLegalActions(state, state.master.masterId)].sort((left, right) =>
		left.actionId.localeCompare(right.actionId)
	);
	if (legal.length === 0) throw new IllegalActionError('mission.resolve.turn');
	const packetHash = hashCanonical(masterFallbackPacket(state, legal));
	const legalActionHash = hashCanonical(legal);
	const tieBreakHash = hashCanonical({
		seed: state.seed,
		decisionId: active.decisionId,
		policy: active.fallback.policy,
		legalActionHash
	});
	const classified = active.fallback.policy === 'random' || directionRecognized(active.fallback);
	let selected: LegalAction;
	let selectedScore: number;
	if (active.fallback.policy === 'random') {
		const index = Number.parseInt(tieBreakHash.slice(0, 8), 16) % legal.length;
		selected = legal[index]!;
		selectedScore = 0;
	} else {
		const ranked = legal
			.map((candidate) => ({
				candidate,
				score: scoreDirectedAction(candidate, active.fallback),
				tie: hashCanonical({
					seed: state.seed,
					decisionId: active.decisionId,
					actionId: candidate.actionId
				})
			}))
			.sort((left, right) => right.score - left.score || left.tie.localeCompare(right.tie));
		selected = ranked[0]!.candidate;
		selectedScore = ranked[0]!.score;
	}
	const stops = active.fallback.safetyStops;
	const retreatAvailable =
		state.mission.attempt !== null &&
		['deployed', 'resolving', 'extraction'].includes(state.mission.attempt.status) &&
		allPartyAtNode(state, missionContentForState(state).retreat.nodeIds);
	const safetyStopReason =
		stops.maximumConsecutiveFallbacks !== null &&
		state.masterControl.consecutiveFallbacks >= stops.maximumConsecutiveFallbacks
			? 'fallback-limit'
			: stops.masterHealthThreshold !== null &&
				  state.master.health <= stops.masterHealthThreshold &&
				  retreatAvailable
				? 'master-health'
				: stops.whenUnclassified && !classified
					? 'unclassified-state'
					: stops.beforeIrreversibleAction && isIrreversibleMasterAction(selected)
						? 'irreversible-action'
						: null;
	const policyId =
		active.fallback.policy === 'directed' ? 'master-directed-v1' : 'master-random-v1';
	const explanation = safetyStopReason
		? `Safety changed ${active.timing} to Wait before ${selected.label.toLowerCase()} (${safetyStopReason}).`
		: active.fallback.policy === 'random'
			? `Seeded random selected ${selected.label.toLowerCase()} from ${legal.length} legal actions.`
			: classified
				? `Directed scoring selected ${selected.label.toLowerCase()} at ${selectedScore} points.`
				: `No direction term matched; the disabled classification stop allowed the seeded tie-breaker.`;
	const resultCore = {
		selectionVersion: 'master-fallback-selection-v1' as const,
		policyId,
		policy: active.fallback.policy,
		decisionId: active.decisionId,
		directionId: active.fallback.directionId,
		classification: classified ? ('classified' as const) : ('unclassified' as const),
		selectedActionId: selected.actionId,
		selectedScore,
		consideredActionIds: legal.map((candidate) => candidate.actionId),
		packetHash,
		legalActionHash,
		tieBreakHash,
		safetyStopReason,
		explanation
	};
	return MasterFallbackSelectionSchema.parse({
		...resultCore,
		policyResultHash: hashCanonical(resultCore)
	});
}

export function masterFallbackActionSource(stateInput: MasterFallbackEngineState): ActionSource {
	const state = parseMasterFallbackState(stateInput);
	const active = state.masterControl.activeDecision;
	if (!active || active.timing === 'wait') throw new IllegalActionError('mission.resolve.turn');
	return {
		source: active.timing,
		timing: active.timing,
		fallbackPolicy: active.fallback.policy,
		directiveIds: active.fallback.policy === 'directed' ? [active.fallback.directionId] : [],
		decisionJobId: null
	};
}

export function masterFallbackSafetySource(stateInput: MasterFallbackEngineState): ActionSource {
	return { ...masterFallbackActionSource(stateInput), source: 'system' };
}

export function masterFallbackMissionChoice(
	stateInput: MasterFallbackEngineState
): MissionTurnChoice {
	const state = parseMasterFallbackState(stateInput);
	const selection = selectMasterFallback(state);
	if (selection.safetyStopReason) throw new IllegalActionError('master.apply.safety-stop');
	return MissionTurnChoiceSchema.parse({
		actorId: state.master.masterId,
		actionId: selection.selectedActionId,
		source: selection.policy === 'random' ? 'random' : 'scripted',
		policyId: selection.policyId,
		packetHash: selection.packetHash,
		legalActionHash: selection.legalActionHash,
		policyResultHash: selection.policyResultHash,
		publicIntent: selection.explanation
	});
}

function resolveMasterDecisionV2(
	state: MasterFallbackEngineState,
	commandId: string,
	decisionId: string,
	resolvedAt: string,
	actionId: string,
	source: ActionSource,
	missionContinues: boolean
): { readonly control: MasterControlStateV2; readonly resolution: MasterDecisionResolutionV2 } {
	const control = state.masterControl;
	const active = control.activeDecision;
	if (!active || active.decisionId !== decisionId || source.timing !== active.timing) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const resolvedMillis = Date.parse(resolvedAt);
	const openedMillis = Date.parse(active.openedAt);
	const expiresMillis = active.expiresAt ? Date.parse(active.expiresAt) : null;
	if (resolvedMillis < openedMillis) throw new IllegalActionError('mission.resolve.turn');
	const manual = source.source === 'manual';
	const fallback =
		active.timing !== 'wait' &&
		(source.source === 'countdown' || source.source === 'step' || source.source === 'continuous') &&
		source.source === active.timing;
	if (!manual && !fallback) throw new IllegalActionError('mission.resolve.turn');
	if (manual && active.timing !== 'wait' && active.timing !== 'countdown') {
		throw new IllegalActionError('mission.resolve.turn');
	}
	if (active.timing === 'countdown') {
		if (
			expiresMillis === null ||
			(manual && resolvedMillis >= expiresMillis) ||
			(fallback && resolvedMillis < expiresMillis)
		) {
			throw new IllegalActionError('mission.resolve.turn');
		}
	}
	const selection = fallback ? selectMasterFallback(state) : null;
	if (selection?.safetyStopReason || (selection && selection.selectedActionId !== actionId)) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const outcome = manual ? 'manual' : 'fallback';
	const expiryOutcome =
		active.timing === 'countdown'
			? manual
				? 'manual-before-expiry'
				: 'expired-to-fallback'
			: fallback
				? 'immediate-fallback'
				: 'not-applicable';
	const resolution = MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt,
		outcome,
		expiryOutcome,
		resolvedActionId: actionId,
		source,
		fallbackSelection: selection
	});
	let next = MasterControlStateV2Schema.parse({
		...control,
		timing: active.timing === 'step' ? 'wait' : control.timing,
		revision: control.revision + (active.timing === 'step' ? 1 : 0),
		activeDecision: null,
		lastResolution: resolution,
		consecutiveFallbacks: fallback ? control.consecutiveFallbacks + 1 : 0
	});
	if (missionContinues) next = masterDecisionWindowV2(next, commandId, resolvedAt);
	return { control: next, resolution };
}

function assertFallbackReady(control: MasterControlStateV2, observedAt: string): void {
	const active = control.activeDecision;
	if (!active || active.timing === 'wait' || Date.parse(observedAt) < Date.parse(active.openedAt)) {
		throw new IllegalActionError('master.apply.safety-stop');
	}
	if (
		active.timing === 'countdown' &&
		(active.expiresAt === null || Date.parse(observedAt) < Date.parse(active.expiresAt))
	) {
		throw new IllegalActionError('master.apply.safety-stop');
	}
}

function applyMasterSafetyStop(
	state: MasterFallbackEngineState,
	commandId: string,
	decisionId: string,
	observedAt: string,
	source: ActionSource
): { readonly control: MasterControlStateV2; readonly resolution: MasterDecisionResolutionV2 } {
	assertFallbackReady(state.masterControl, observedAt);
	const active = state.masterControl.activeDecision!;
	if (
		active.decisionId !== decisionId ||
		hashCanonical(source) !== hashCanonical(masterFallbackSafetySource(state))
	) {
		throw new IllegalActionError('master.apply.safety-stop');
	}
	const selection = selectMasterFallback(state);
	if (!selection.safetyStopReason) throw new IllegalActionError('master.apply.safety-stop');
	const resolution = MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt: observedAt,
		outcome: 'safety-stopped',
		expiryOutcome: 'safety-stopped',
		resolvedActionId: null,
		source,
		fallbackSelection: selection
	});
	const waiting = MasterControlStateV2Schema.parse({
		...state.masterControl,
		timing: 'wait',
		revision: state.masterControl.revision + 1,
		activeDecision: null,
		lastResolution: resolution,
		consecutiveFallbacks: 0
	});
	return {
		resolution,
		control: masterDecisionWindowV2(waiting, commandId, observedAt)
	};
}

function endMasterDecisionV2(
	control: MasterControlStateV2,
	source: ActionSource
): {
	readonly control: MasterControlStateV2;
	readonly resolution: MasterDecisionResolutionV2 | null;
} {
	const active = control.activeDecision;
	if (!active) return { control, resolution: null };
	const resolution = MasterDecisionResolutionV2Schema.parse({
		...active,
		resolvedAt: active.openedAt,
		outcome: 'mission-ended',
		expiryOutcome: 'mission-ended',
		resolvedActionId: null,
		source: { ...source, source: 'system', timing: null, fallbackPolicy: null },
		fallbackSelection: null
	});
	return {
		resolution,
		control: MasterControlStateV2Schema.parse({
			...control,
			activeDecision: null,
			lastResolution: resolution,
			consecutiveFallbacks: 0
		})
	};
}

function clamp(value: number, minimum = 0, maximum = 100): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function clampSocial(value: number): number {
	return clamp(value, -100, 100);
}

function createBootstrapSociety(
	heroId: string,
	masterId: string,
	eventId: string,
	observedAt: string
): SocietyStateV4 {
	const observationId = deterministicUuid(`${eventId}:${heroId}:awakening-observation`);
	const selfBeliefId = deterministicUuid(`${observationId}:self-awakened`);
	const presenceBeliefId = deterministicUuid(`${observationId}:master-present`);
	const relationshipId = deterministicUuid(`${heroId}:${masterId}:relationship`);
	const authorityId = deterministicUuid(`${heroId}:${masterId}:authority`);
	return SocietyStateV4Schema.parse({
		contentVersion: 'society-v4',
		observations: {
			[observationId]: {
				observationId,
				sourceEventId: eventId,
				observerHeroId: heroId,
				observedAt,
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: [heroId, masterId]
			}
		},
		beliefs: {
			[selfBeliefId]: {
				beliefId: selfBeliefId,
				holderHeroId: heroId,
				subjectId: heroId,
				predicate: 'awakened-at',
				object: { kind: 'location', locationId: 'summoning-gate' },
				confidence: 100,
				status: 'held',
				learnedAt: observedAt,
				provenance: {
					kind: 'experienced',
					sourceEventId: eventId,
					observationId,
					learnedFromId: null,
					chainDepth: 0
				}
			},
			[presenceBeliefId]: {
				beliefId: presenceBeliefId,
				holderHeroId: heroId,
				subjectId: masterId,
				predicate: 'present-at-awakening',
				object: { kind: 'location', locationId: 'summoning-gate' },
				confidence: 100,
				status: 'held',
				learnedAt: observedAt,
				provenance: {
					kind: 'observed',
					sourceEventId: eventId,
					observationId,
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			[relationshipId]: {
				relationshipId,
				fromHeroId: heroId,
				toEntityId: masterId,
				dimensions: { trust: 0, respect: 0, fear: 0, affection: 0, resentment: 0, debt: 0 },
				updatedAt: observedAt,
				lastSourceEventId: eventId,
				evidence: []
			}
		},
		promises: {},
		authority: {
			[authorityId]: {
				authorityId,
				observerHeroId: heroId,
				subjectId: masterId,
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: observedAt,
				lastSourceEventId: eventId,
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	});
}

function createBootstrapCompanySociety(
	heroIds: readonly string[],
	masterId: string,
	eventId: string,
	observedAt: string
): SocietyStateV4 {
	const states = heroIds.map((heroId) =>
		createBootstrapSociety(heroId, masterId, eventId, observedAt)
	);
	return SocietyStateV4Schema.parse({
		contentVersion: 'society-v4',
		observations: Object.assign({}, ...states.map((state) => state.observations)),
		beliefs: Object.assign({}, ...states.map((state) => state.beliefs)),
		relationships: Object.assign({}, ...states.map((state) => state.relationships)),
		promises: {},
		authority: Object.assign({}, ...states.map((state) => state.authority)),
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	});
}

function createBootstrapCompanySocietyV5(
	heroIds: readonly string[],
	masterId: string,
	eventId: string,
	observedAt: string
): SocietyStateV5 {
	const society = createBootstrapCompanySociety(heroIds, masterId, eventId, observedAt);
	return SocietyStateV5Schema.parse({ ...society, contentVersion: 'society-v5' });
}

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

function createStoryPatchCheckpoint() {
	const envelope = verifiedStoryEnvelope();
	const pressure = envelope.beats.find(
		(beat) => beat.floor === 4 && beat.kind === 'pressure' && beat.required
	);
	if (!pressure) throw new Error('Floor 04 story pressure checkpoint is unavailable');
	const pressureIndex = envelope.defaultBeatOrder.indexOf(pressure.beatId);
	if (pressureIndex < 0) throw new Error('Floor 04 story checkpoint left the default route');
	return RuntimeBandStoryStateSchema.parse({
		storyVersion: 'runtime-band-story-v1',
		envelopeId: envelope.envelopeId,
		envelopeContentVersion: envelope.contentVersion,
		envelopeContentHash: envelope.contentHash,
		history: {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 4,
			completedBeatIds: envelope.defaultBeatOrder.slice(0, pressureIndex + 1),
			activatedProposalIds: []
		},
		appliedPatches: []
	});
}

const FIRST_BAND_ARCHIVE_MESSAGE = 'Hearth 01 was not the first.' as const;

function createFirstBandArchiveStoryCheckpoint() {
	const envelope = verifiedStoryEnvelope();
	const floorFourExtraction = envelope.beats.find(
		(beat) => beat.floor === 4 && beat.kind === 'extraction' && beat.required
	);
	if (!floorFourExtraction) throw new Error('Floor 04 extraction story checkpoint is unavailable');
	const extractionIndex = envelope.defaultBeatOrder.indexOf(floorFourExtraction.beatId);
	if (extractionIndex < 0) throw new Error('Floor 04 extraction left the default story route');
	return RuntimeBandStoryStateSchema.parse({
		storyVersion: 'runtime-band-story-v1',
		envelopeId: envelope.envelopeId,
		envelopeContentVersion: envelope.contentVersion,
		envelopeContentHash: envelope.contentHash,
		history: {
			historyVersion: 'story-beat-history-v1',
			unlockedFloor: 5,
			completedBeatIds: envelope.defaultBeatOrder.slice(0, extractionIndex + 1),
			activatedProposalIds: []
		},
		appliedPatches: []
	});
}

function createSealedFirstBandArchive() {
	const envelope = verifiedStoryEnvelope();
	return FirstBandArchiveStateSchema.parse({
		archiveVersion: 'first-band-archive-v1',
		status: 'sealed',
		envelopeId: envelope.envelopeId,
		envelopeContentHash: envelope.contentHash,
		canonicalMessageHash: hashCanonical(FIRST_BAND_ARCHIVE_MESSAGE),
		recovery: null,
		reveal: null
	});
}

function completeFirstBandStory(state: EngineGameStateV23) {
	const envelope = verifiedStoryEnvelope();
	if (
		state.bandStory.envelopeId !== envelope.envelopeId ||
		state.bandStory.envelopeContentHash !== envelope.contentHash
	) {
		throw new IllegalActionError('mission.extract');
	}
	return RuntimeBandStoryStateSchema.parse({
		...state.bandStory,
		history: {
			...state.bandStory.history,
			unlockedFloor: 5,
			completedBeatIds: [...envelope.defaultBeatOrder]
		}
	});
}

function recoverFirstBandArchive(
	state: EngineGameStateV23,
	sourceEventId: string,
	mission: MissionRunStateV8,
	bandStory: EngineGameStateV23['bandStory']
) {
	const attempt = mission.attempt;
	if (
		state.firstBandArchive.status !== 'sealed' ||
		mission.binding.missionId !== 'tower-floor-05' ||
		attempt?.status !== 'success' ||
		attempt.outcome !== 'success'
	) {
		return state.firstBandArchive;
	}
	const survivingHeroIds = attempt.party.heroIds
		.filter((heroId) => state.heroes[heroId]?.lifeState === 'active')
		.sort((left, right) => left.localeCompare(right));
	const receipt = FirstBandExtractionReceiptSchema.parse({
		receiptVersion: 'first-band-extraction-receipt-v1',
		receiptId: deterministicUuid(`${sourceEventId}:first-band-extraction-receipt`),
		sourceEventId,
		missionAttemptId: attempt.attemptId,
		missionBinding: mission.binding,
		recoveredAt: state.simulatedAt,
		survivingHeroIds,
		rewardGrantIds: ['hearth-relight-core', 'first-hearth-archive-fragment'],
		completedStoryHistoryHash: hashCanonical(bandStory.history)
	});
	return FirstBandArchiveStateSchema.parse({
		...state.firstBandArchive,
		status: 'recovered',
		recovery: receipt
	});
}

function revealFirstBandArchive(
	state: EngineGameStateV23,
	readerHeroId: string,
	sourceEventId: string
) {
	const reader = state.heroes[readerHeroId];
	const recovery = state.firstBandArchive.recovery;
	if (
		state.firstBandArchive.status !== 'recovered' ||
		!recovery ||
		!reader ||
		reader.lifeState !== 'active' ||
		!recovery.survivingHeroIds.includes(readerHeroId)
	) {
		throw new IllegalActionError('story.reveal.first.archive');
	}
	const expression = resolveStoryExpression(
		verifiedStoryEnvelope(),
		'floor-five-outcome-anchor-expression',
		[
			{
				characterId: readerHeroId,
				displayName: `Summon ${readerHeroId.slice(0, 6).toUpperCase()}`,
				lifeState: 'active',
				mind: reader.mind,
				knownAnchorIds: ['floor-five-outcome-anchor']
			}
		]
	);
	if (!expression) throw new IllegalActionError('story.reveal.first.archive');
	const witnessHeroIds = Object.values(state.heroes)
		.filter(
			(hero) =>
				hero.lifeState === 'active' &&
				hero.location === state.master.location &&
				hero.heroId !== readerHeroId
		)
		.map((hero) => hero.heroId)
		.sort((left, right) => left.localeCompare(right));
	const reveal = FirstBandArchiveRevealSchema.parse({
		revealVersion: 'first-band-archive-reveal-v1',
		revealId: deterministicUuid(`${sourceEventId}:first-band-archive-reveal`),
		sourceEventId,
		readerHeroId,
		revealedAt: state.simulatedAt,
		canonicalMessage: FIRST_BAND_ARCHIVE_MESSAGE,
		expression,
		knowledge: [readerHeroId, ...witnessHeroIds].map((heroId) => ({
			heroId,
			role: heroId === readerHeroId ? ('reader' as const) : ('witness' as const),
			learnedAt: state.simulatedAt,
			sourceEventId
		}))
	});
	return {
		reveal,
		archive: FirstBandArchiveStateSchema.parse({
			...state.firstBandArchive,
			status: 'revealed',
			reveal
		})
	};
}

export function storyPatchCastForState(
	stateInput: EngineGameStateV21
): readonly StoryPatchCastMember[] {
	const state = EngineGameStateV21Schema.parse(stateInput);
	const envelope = verifiedStoryEnvelope();
	const completed = new Set(state.bandStory.history.completedBeatIds);
	const anchors = new Map(envelope.anchors.map((anchor) => [anchor.anchorId, anchor]));
	const openProposalIds = new Set(
		envelope.patchSlots
			.filter((slot) => {
				const after = anchors.get(slot.afterAnchorId);
				const before = anchors.get(slot.beforeAnchorId);
				return Boolean(
					slot.floor <= state.bandStory.history.unlockedFloor &&
					after &&
					completed.has(after.beatId) &&
					before &&
					!completed.has(before.beatId)
				);
			})
			.flatMap((slot) => slot.allowedProposalIds)
	);
	return Object.values(state.heroes)
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((hero) => {
			const heldEvidenceKeys = new Set(
				Object.values(state.mission.evidence)
					.filter((evidence) => evidence.holderActorId === hero.heroId)
					.map((evidence) => evidence.evidenceKey)
			);
			const availableProposalIds = envelope.proposals
				.filter(
					(proposal) =>
						openProposalIds.has(proposal.proposalId) &&
						proposal.kind === 'role-expression' &&
						(proposal.floor !== 4 || heldEvidenceKeys.has('foundry-maintenance-route'))
				)
				.map((proposal) => proposal.proposalId);
			return {
				heroId: hero.heroId,
				lifeState: hero.lifeState,
				availableProposalIds
			};
		});
}

export function validateStoryPatchForState(
	stateInput: EngineGameStateV21,
	candidateInput: z.input<typeof StoryPatchCandidateSchema>
) {
	const state = EngineGameStateV21Schema.parse(stateInput);
	const candidate = StoryPatchCandidateSchema.parse(candidateInput);
	if (
		state.bandStory.envelopeId !== verifiedStoryEnvelope().envelopeId ||
		state.bandStory.envelopeContentHash !== verifiedStoryEnvelope().contentHash
	) {
		throw new ReplayIntegrityError(
			'Runtime story envelope binding is unavailable',
			state.eventCursor
		);
	}
	return validateStoryPatch(
		verifiedStoryEnvelope(),
		state.bandStory.history,
		storyPatchCastForState(state),
		candidate
	);
}

function createBuildingStates(definition: SettlementDefinition) {
	return Object.fromEntries(
		definition.buildings.map((building) => {
			const operation =
				BUILDING_OPERATIONS[building.buildingId as keyof typeof BUILDING_OPERATIONS];
			if (!operation) throw new Error(`Missing building operation: ${building.buildingId}`);
			const node = definition.nodes.find((candidate) => candidate.nodeId === operation.nodeId);
			if (!node || node.buildingId !== building.buildingId) {
				throw new Error(`Invalid assignment node for ${building.buildingId}`);
			}
			return [
				building.buildingId,
				{
					buildingId: building.buildingId,
					systemId: building.systemId,
					assignmentNodeId: operation.nodeId,
					assignmentRole: operation.role,
					assignmentCapacity: node.capacity,
					assignedHeroIds: [],
					baselinePowerState: operation.baselinePowerState,
					powerState: operation.baselinePowerState
				}
			];
		})
	);
}

const FIRST_EMBER_MODIFIERS = Object.freeze({
	kitchen: [{ key: 'hunger-recovery', amount: 15 }],
	dormitory: [
		{ key: 'fatigue-recovery', amount: 20 },
		{ key: 'health-recovery', amount: 5 }
	],
	'training-ground': [
		{ key: 'hero-experience', amount: 4 },
		{ key: 'sword-experience', amount: 3 },
		{ key: 'training-injury-threshold', amount: -7 }
	]
} as const);

const FACILITY_RATIONALE = Object.freeze({
	kitchen: 'feed-everyone',
	dormitory: 'protect-recovery',
	'training-ground': 'prepare-tower'
} as const satisfies Record<FirstEmberFacility, FirstEmberRationale>);

function reactionStance(score: number) {
	if (score >= 30) return 'support' as const;
	if (score >= 10) return 'accept' as const;
	if (score >= -10) return 'question' as const;
	return 'oppose' as const;
}

function buildFirstEmberReaction(
	hero: EngineGameStateV6['heroes'][string],
	buildingId: FirstEmberFacility,
	rationale: FirstEmberRationale
) {
	let score = 0;
	const factors: string[] = [];
	if (buildingId === 'kitchen') {
		const need = Math.round(hero.needs.hunger / 2);
		score += need;
		factors.push(`hunger ${hero.needs.hunger} contributes ${need}`);
		if (['belonging', 'mercy'].includes(hero.mind.primaryValue)) {
			score += 18;
			factors.push(`value ${hero.mind.primaryValue} supports shared food`);
		}
		if (['connect', 'protect', 'survive'].includes(hero.mind.primaryDrive)) {
			score += 12;
			factors.push(`drive ${hero.mind.primaryDrive} supports the hearth`);
		}
	}
	if (buildingId === 'dormitory') {
		const need = Math.round(hero.needs.fatigue / 2 + (hero.maxHealth - hero.health) / 2);
		score += need;
		factors.push(`fatigue and injury pressure contribute ${need}`);
		if (['freedom', 'belonging', 'mercy'].includes(hero.mind.primaryValue)) {
			score += 18;
			factors.push(`value ${hero.mind.primaryValue} supports recovery and privacy`);
		}
		if (['protect', 'survive'].includes(hero.mind.primaryDrive)) {
			score += 12;
			factors.push(`drive ${hero.mind.primaryDrive} supports shelter`);
		}
	}
	if (buildingId === 'training-ground') {
		const readiness = Math.round((100 - hero.needs.fatigue) / 5);
		score += readiness;
		factors.push(`physical readiness contributes ${readiness}`);
		if (['duty', 'mastery'].includes(hero.mind.primaryValue)) {
			score += 18;
			factors.push(`value ${hero.mind.primaryValue} supports preparation`);
		}
		if (['prove', 'survive'].includes(hero.mind.primaryDrive)) {
			score += 12;
			factors.push(`drive ${hero.mind.primaryDrive} supports tower readiness`);
		}
		if (hero.needs.fatigue >= 70) {
			score -= 18;
			factors.push('high fatigue argues against more training');
		}
	}
	if (FACILITY_RATIONALE[buildingId] === rationale) {
		score += 12;
		factors.push('the explanation matches the chosen facility');
	} else {
		score -= 12;
		factors.push('the explanation conflicts with the chosen facility');
	}
	score += Math.round((hero.mind.personality.agreeableness - 50) / 10);
	factors.push(`agreeableness ${hero.mind.personality.agreeableness} shapes willingness to accept`);
	const clampedScore = Math.max(-100, Math.min(100, score));
	const stance = reactionStance(clampedScore);
	const summary = {
		support: 'The hero openly supports the commitment and its stated purpose.',
		accept: 'The hero accepts the commitment, reserving judgment for its results.',
		question: 'The hero asks whether the irreversible choice truly answers the settlement’s needs.',
		oppose: 'The hero objects to spending the only core on this priority.'
	}[stance];
	return { heroId: hero.heroId, stance, score: clampedScore, summary, factors };
}

const FIRST_EMBER_PROMISE_TERMS = Object.freeze({
	'feed-everyone': 'I will make feeding this company our founding priority.',
	'protect-recovery': 'I will protect this company’s recovery as our founding priority.',
	'prepare-tower': 'I will prepare this company for the tower as our founding priority.'
} as const satisfies Record<FirstEmberRationale, string>);

function buildFirstEmberSociety(
	state:
		| EngineGameStateV7
		| EngineGameStateV8
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV22,
	eventId: string,
	buildingId: FirstEmberFacility,
	rationale: FirstEmberRationale,
	reactions: readonly ReturnType<typeof buildFirstEmberReaction>[]
): SocietyState | SocietyStateV2 | SocietyStateV3 | SocietyStateV4 {
	const observations = { ...state.society.observations };
	const beliefs = { ...state.society.beliefs };
	const relationships = { ...state.society.relationships };
	const authority = { ...state.society.authority };
	const promiseId = deterministicUuid(`${eventId}:founding-promise`);
	const witnessObservationIds: string[] = [];

	for (const reaction of reactions) {
		const observationId = deterministicUuid(
			`${eventId}:${reaction.heroId}:first-ember-observation`
		);
		witnessObservationIds.push(observationId);
		observations[observationId] = {
			observationId,
			sourceEventId: eventId,
			observerHeroId: reaction.heroId,
			observedAt: state.simulatedAt,
			kind: 'first-ember-commitment',
			summary: `I witnessed the Master bind the First Ember to ${buildingId} for ${rationale}.`,
			subjectIds: [state.master.masterId, reaction.heroId]
		};

		const commitmentBeliefId = deterministicUuid(`${observationId}:commitment-belief`);
		beliefs[commitmentBeliefId] = {
			beliefId: commitmentBeliefId,
			holderHeroId: reaction.heroId,
			subjectId: state.master.masterId,
			predicate: 'first-ember-bound-to',
			object: { kind: 'commitment', facilityId: buildingId, rationale },
			confidence: 100,
			status: 'held',
			learnedAt: state.simulatedAt,
			provenance: {
				kind: 'observed',
				sourceEventId: eventId,
				observationId,
				learnedFromId: null,
				chainDepth: 0
			}
		};
		const promiseBeliefId = deterministicUuid(`${observationId}:promise-belief`);
		beliefs[promiseBeliefId] = {
			beliefId: promiseBeliefId,
			holderHeroId: reaction.heroId,
			subjectId: state.master.masterId,
			predicate: 'made-founding-promise',
			object: { kind: 'promise', promiseId },
			confidence: 100,
			status: 'held',
			learnedAt: state.simulatedAt,
			provenance: {
				kind: 'observed',
				sourceEventId: eventId,
				observationId,
				learnedFromId: null,
				chainDepth: 0
			}
		};

		const relationshipId = deterministicUuid(
			`${reaction.heroId}:${state.master.masterId}:relationship`
		);
		const previousRelationship = relationships[relationshipId];
		if (!previousRelationship)
			throw new ReplayIntegrityError('Missing Master relationship', state.eventCursor);
		const relationshipDeltas = {
			trust: { support: 8, accept: 3, question: -2, oppose: -8 }[reaction.stance],
			respect: { support: 10, accept: 4, question: -1, oppose: -6 }[reaction.stance],
			fear: 0,
			affection: 0,
			resentment: reaction.stance === 'oppose' ? 8 : 0,
			debt: 0
		};
		relationships[relationshipId] = {
			...previousRelationship,
			dimensions: Object.fromEntries(
				Object.entries(previousRelationship.dimensions).map(([key, value]) => [
					key,
					clampSocial(value + relationshipDeltas[key as keyof typeof relationshipDeltas])
				])
			) as typeof previousRelationship.dimensions,
			updatedAt: state.simulatedAt,
			lastSourceEventId: eventId,
			evidence: [
				...previousRelationship.evidence,
				{
					sourceEventId: eventId,
					observationId,
					summary: reaction.summary,
					deltas: relationshipDeltas
				}
			]
		};

		const authorityId = deterministicUuid(`${reaction.heroId}:${state.master.masterId}:authority`);
		const previousAuthority = authority[authorityId];
		if (!previousAuthority)
			throw new ReplayIntegrityError('Missing Master authority view', state.eventCursor);
		const matched = FACILITY_RATIONALE[buildingId] === rationale;
		const authorityDeltas = {
			competence: buildingId === 'training-ground' ? 5 : buildingId === 'dormitory' ? 4 : 3,
			provision: buildingId === 'kitchen' ? 10 : buildingId === 'dormitory' ? 8 : 2,
			trust: relationshipDeltas.trust,
			legitimacy: { support: 8, accept: 4, question: -2, oppose: -8 }[reaction.stance],
			fear: 0,
			strength: buildingId === 'training-ground' ? 8 : 2,
			consistency: matched ? 6 : -8
		};
		authority[authorityId] = {
			...previousAuthority,
			dimensions: Object.fromEntries(
				Object.entries(previousAuthority.dimensions).map(([key, value]) => [
					key,
					clampSocial(value + authorityDeltas[key as keyof typeof authorityDeltas])
				])
			) as typeof previousAuthority.dimensions,
			updatedAt: state.simulatedAt,
			lastSourceEventId: eventId,
			evidence: [
				...previousAuthority.evidence,
				{
					sourceEventId: eventId,
					observationId,
					summary: matched
						? 'The stated priority matched the chosen facility.'
						: 'The stated priority conflicted with the chosen facility.',
					deltas: authorityDeltas
				}
			]
		};
	}

	const candidate = {
		...state.society,
		observations,
		beliefs,
		relationships,
		authority,
		promises: {
			...state.society.promises,
			[promiseId]: {
				promiseId,
				promisorId: state.master.masterId,
				promiseeHeroIds: reactions.map((reaction) => reaction.heroId),
				kind: 'founding-priority',
				terms: FIRST_EMBER_PROMISE_TERMS[rationale],
				status: 'active',
				sourceEventId: eventId,
				createdAt: state.simulatedAt,
				witnessObservationIds,
				resolvedAt: null,
				resolutionEventId: null
			}
		}
	};
	if (
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21
	)
		return SocietyStateV4Schema.parse(candidate);
	if (state.schemaVersion === 9) return SocietyStateV3Schema.parse(candidate);
	return state.schemaVersion === 8
		? SocietyStateV2Schema.parse(candidate)
		: SocietyStateSchema.parse(candidate);
}

type MasterConverseCommand = Extract<EngineCommand, { commandType: 'master.converse' }>;
type CommunicationInput = Pick<
	z.infer<typeof CommunicativeActSchema>,
	'kind' | 'topic' | 'exactText' | 'tone' | 'delivery'
> & { readonly targetHeroId: string };
type EngineCommunicationState =
	| EngineGameStateV8
	| EngineGameStateV9
	| EngineGameStateV10
	| EngineGameStateV11
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV22
	| EngineGameStateV23;

function heroCanHearCommunication(hero: EngineCommunicationState['heroes'][string]): boolean {
	return (
		hero.lifeState === 'active' &&
		hero.currentTravel === null &&
		hero.currentActivity === null &&
		hero.currentRoutine === null
	);
}

function communicationWitnessHeroes(
	state: EngineCommunicationState,
	command: CommunicationInput
): EngineCommunicationState['heroes'][string][] {
	const target = state.heroes[command.targetHeroId];
	if (!target || target.location !== state.master.location || !heroCanHearCommunication(target)) {
		return [];
	}
	const witnesses = [target];
	if (command.delivery === 'open') {
		witnesses.push(
			...Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.heroId !== target.heroId &&
						hero.location === state.master.location &&
						heroCanHearCommunication(hero)
				)
				.sort((left, right) => left.heroId.localeCompare(right.heroId))
		);
	}
	return witnesses;
}

function communicationClaim(state: EngineCommunicationState, command: CommunicationInput) {
	if (['hero-memory', 'open-conversation', 'daily-order'].includes(command.topic)) return null;
	if (command.topic === 'master-role') {
		return {
			subjectId: state.master.masterId,
			predicate: 'claims-master-role' as const,
			object: { kind: 'text' as const, text: 'Master of Hearth 01' }
		};
	}
	if (command.topic === 'summoning-situation') {
		return {
			subjectId: command.targetHeroId,
			predicate: 'was-summoned-into' as const,
			object: { kind: 'location' as const, locationId: 'summoning-gate' }
		};
	}
	return {
		subjectId: state.master.masterId,
		predicate: 'described-tower-mission' as const,
		object: {
			kind: 'text' as const,
			text: 'Hearth 01 shelters a summoned company preparing to climb the one-hundred-floor tower.'
		}
	};
}

function buildCommunicativeSociety(
	state: EngineCommunicationState,
	eventId: string,
	command: CommunicationInput
): {
	society: SocietyStateV2 | SocietyStateV3 | SocietyStateV4;
	communicativeAct: z.infer<typeof CommunicativeActSchema>;
} {
	const claim = communicationClaim(state, command);
	const actId = deterministicUuid(`${eventId}:communicative-act`);
	const observations = { ...state.society.observations };
	const beliefs = { ...state.society.beliefs };
	const witnesses = communicationWitnessHeroes(state, command).map((hero) => {
		const intended = hero.heroId === command.targetHeroId;
		const observationId = deterministicUuid(`${actId}:${hero.heroId}:observation`);
		const beliefId = claim ? deterministicUuid(`${observationId}:belief`) : null;
		observations[observationId] = {
			observationId,
			sourceEventId: eventId,
			observerHeroId: hero.heroId,
			observedAt: state.simulatedAt,
			kind: 'communication',
			communicationActId: actId,
			summary: intended
				? command.kind === 'ask'
					? `The Master directly asked me about ${command.topic}.`
					: command.kind === 'order'
						? `The Master directly ordered me regarding ${command.topic}.`
						: `The Master directly ${command.kind === 'tell' ? 'told' : 'explained to'} me about ${command.topic}.`
				: `I overheard the Master ${command.kind} ${command.topic} to another hero.`,
			subjectIds: [state.master.masterId, command.targetHeroId]
		};
		if (claim && beliefId) {
			beliefs[beliefId] = {
				beliefId,
				holderHeroId: hero.heroId,
				subjectId: claim.subjectId,
				predicate: claim.predicate,
				object: claim.object,
				confidence: claim.predicate === 'was-summoned-into' ? (intended ? 85 : 70) : 100,
				status: 'held',
				learnedAt: state.simulatedAt,
				provenance: {
					kind: 'told',
					sourceEventId: eventId,
					observationId,
					learnedFromId: state.master.masterId,
					chainDepth: 1
				}
			};
		}
		return {
			heroId: hero.heroId,
			role: intended ? ('intended' as const) : ('bystander' as const),
			perception: intended ? ('addressed' as const) : ('overheard' as const),
			observationId,
			beliefId
		};
	});
	const communicativeAct = CommunicativeActSchema.parse({
		actId,
		sourceEventId: eventId,
		speakerId: state.master.masterId,
		intendedAudienceIds: [command.targetHeroId],
		kind: command.kind,
		topic: command.topic,
		exactText: command.exactText,
		tone: command.tone,
		delivery: command.delivery,
		location: state.master.location,
		occurredAt: state.simulatedAt,
		claim,
		witnesses
	});
	const candidate = {
		...state.society,
		observations,
		beliefs,
		communicativeActs: {
			...state.society.communicativeActs,
			[actId]: communicativeAct
		}
	};
	return {
		communicativeAct,
		society:
			state.schemaVersion === 10 ||
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
				? SocietyStateV4Schema.parse(candidate)
				: state.schemaVersion === 9
					? SocietyStateV3Schema.parse(candidate)
					: SocietyStateV2Schema.parse(candidate)
	};
}

type DirectiveIssueCommand = Extract<
	EngineCommand,
	{ commandType: 'master.issue.directive' | 'master.replace.directive' }
>;

function nextGameDayStart(gameTime: string): string {
	const milliseconds = Date.parse(ENGINE_EPOCH) + (gameDayIndex(gameTime) + 1) * 86_400_000;
	return new Date(milliseconds).toISOString();
}

function buildDirectiveChange(
	state:
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	eventId: string,
	command: DirectiveIssueCommand
): {
	directive: DirectiveRecord;
	previousDirective: DirectiveRecord | null;
	communicativeAct: z.infer<typeof CommunicativeActSchema>;
	society: SocietyStateV4;
	scheduledEvent: ScheduledEvent | null;
} {
	const previousDirective =
		command.commandType === 'master.replace.directive'
			? (state.society.directives[command.directiveId] ?? null)
			: null;
	const directiveId = deterministicUuid(`${command.commandId}:directive`);
	const actId = deterministicUuid(`${eventId}:directive-communicative-act`);
	const recipientSet = new Set(command.recipientIds);
	const witnessHeroes = Object.values(state.heroes)
		.filter(
			(hero) =>
				hero.location === state.master.location &&
				heroCanHearCommunication(hero) &&
				(recipientSet.has(hero.heroId) || command.delivery === 'open')
		)
		.sort((left, right) => left.heroId.localeCompare(right.heroId));
	const observations = { ...state.society.observations };
	const witnesses = witnessHeroes.map((hero) => {
		const intended = recipientSet.has(hero.heroId);
		const observationId = deterministicUuid(`${actId}:${hero.heroId}:observation`);
		observations[observationId] = {
			observationId,
			sourceEventId: eventId,
			observerHeroId: hero.heroId,
			observedAt: state.simulatedAt,
			kind: 'communication',
			communicationActId: actId,
			summary: intended
				? `The Master directed me: “${command.text}”`
				: `I overheard the Master direct others: “${command.text}”`,
			subjectIds: [state.master.masterId, ...command.recipientIds]
		};
		return {
			heroId: hero.heroId,
			role: intended ? ('intended' as const) : ('bystander' as const),
			perception: intended ? ('addressed' as const) : ('overheard' as const),
			observationId,
			beliefId: null
		};
	});
	const communicativeAct = CommunicativeActSchema.parse({
		actId,
		sourceEventId: eventId,
		speakerId: state.master.masterId,
		intendedAudienceIds: [...command.recipientIds],
		kind: 'order',
		topic: 'daily-order',
		exactText: command.text,
		tone: command.tone,
		delivery: command.delivery,
		location: state.master.location,
		occurredAt: state.simulatedAt,
		claim: null,
		witnesses
	});
	const expiresAt = command.scope === 'day' ? nextGameDayStart(state.simulatedAt) : null;
	const expiryScheduledEventId =
		command.scope === 'day' ? deterministicUuid(`${command.commandId}:directive-expiry`) : null;
	const directive = DirectiveRecordSchema.parse({
		directiveId,
		runId: state.runId,
		authorId: state.master.masterId,
		text: command.text,
		scope: command.scope,
		recipientIds: [...command.recipientIds],
		witnessEventId: eventId,
		priorities: [...command.priorities],
		createdAt: state.simulatedAt,
		expiresAt,
		revokedAt: null,
		delivery: command.delivery,
		status: 'active',
		witnessObservationIds: witnesses.map((witness) => witness.observationId),
		expiryScheduledEventId,
		replacesDirectiveId: previousDirective?.directiveId ?? null,
		replacedByDirectiveId: null,
		terminalAt: null,
		terminalEventId: null
	});
	const directives = { ...state.society.directives };
	if (previousDirective) {
		directives[previousDirective.directiveId] = DirectiveRecordSchema.parse({
			...previousDirective,
			status: 'replaced',
			revokedAt: state.simulatedAt,
			replacedByDirectiveId: directiveId,
			terminalAt: state.simulatedAt,
			terminalEventId: eventId
		});
	}
	directives[directiveId] = directive;
	const society = SocietyStateV4Schema.parse({
		...state.society,
		observations,
		communicativeActs: {
			...state.society.communicativeActs,
			[actId]: communicativeAct
		},
		directives
	});
	const scheduledEvent =
		expiresAt && expiryScheduledEventId
			? ScheduledEventSchema.parse({
					scheduledEventId: expiryScheduledEventId,
					runId: state.runId,
					actorId: state.master.masterId,
					dueGameTime: expiresAt,
					eventKind: 'directive.expire',
					payload: { directiveId }
				})
			: null;
	return { directive, previousDirective, communicativeAct, society, scheduledEvent };
}

function revokeDirective(
	state:
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	eventId: string,
	directiveId: string
): { directive: DirectiveRecord; society: SocietyStateV4 } {
	const previous = state.society.directives[directiveId];
	if (!previous) throw new IllegalActionError('master.revoke.directive');
	const directive = DirectiveRecordSchema.parse({
		...previous,
		status: 'revoked',
		revokedAt: state.simulatedAt,
		terminalAt: state.simulatedAt,
		terminalEventId: eventId
	});
	return {
		directive,
		society: SocietyStateV4Schema.parse({
			...state.society,
			directives: { ...state.society.directives, [directiveId]: directive }
		})
	};
}

const ORDER_INTENT_LABELS = Object.freeze({
	train: 'train at the practice ring',
	rest: 'rest and recover',
	eat: 'eat a proper meal',
	work: 'take a settlement duty',
	'prepare-tower': 'prepare for the tower'
} as const satisfies Record<ConversationOrderIntent, string>);

function conversationOrderScore(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	hero: (
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
	)['heroes'][string],
	intent: ConversationOrderIntent,
	tone: MasterConverseCommand['tone']
) {
	const relationship = Object.values(state.society.relationships).find(
		(candidate) =>
			candidate.fromHeroId === hero.heroId && candidate.toEntityId === state.master.masterId
	);
	const authority = Object.values(state.society.authority).find(
		(candidate) =>
			candidate.observerHeroId === hero.heroId && candidate.subjectId === state.master.masterId
	);
	if (!relationship || !authority) {
		throw new ReplayIntegrityError('Conversation social view is missing', state.eventCursor);
	}
	const authorityScore = Math.round(
		(authority.dimensions.legitimacy +
			authority.dimensions.trust +
			authority.dimensions.competence +
			authority.dimensions.consistency) /
			20
	);
	const relationshipScore = Math.round(
		(relationship.dimensions.trust +
			relationship.dimensions.respect +
			relationship.dimensions.affection -
			relationship.dimensions.resentment) /
			20
	);
	const personality = Math.round(
		(hero.mind.personality.agreeableness +
			hero.mind.personality.conscientiousness -
			hero.mind.personality.emotionalVolatility -
			50) /
			10
	);
	const alignedValues: Record<ConversationOrderIntent, readonly string[]> = {
		train: ['mastery', 'duty'],
		rest: ['freedom', 'belonging'],
		eat: ['belonging', 'freedom'],
		work: ['duty', 'belonging'],
		'prepare-tower': ['duty', 'mastery']
	};
	const alignedDrives: Record<ConversationOrderIntent, readonly string[]> = {
		train: ['prove', 'survive'],
		rest: ['survive', 'belong'],
		eat: ['survive', 'belong'],
		work: ['protect', 'belong'],
		'prepare-tower': ['protect', 'prove', 'survive']
	};
	let alignment = alignedValues[intent].includes(hero.mind.primaryValue) ? 12 : 0;
	alignment += alignedDrives[intent].includes(hero.mind.primaryDrive) ? 8 : 0;
	if (hero.mind.primaryValue === 'freedom' && ['work', 'prepare-tower'].includes(intent)) {
		alignment -= 10;
	}
	const needs = {
		train: Math.round((50 - hero.needs.fatigue) / 5),
		rest: Math.round((hero.needs.fatigue - 30) / 3),
		eat: Math.round((hero.needs.hunger - 25) / 3),
		work: Math.round((45 - hero.needs.fatigue) / 5),
		'prepare-tower': Math.round((50 - hero.needs.fatigue) / 6)
	}[intent];
	const toneScore = { neutral: 0, reassuring: 6, firm: -3, urgent: -1, apologetic: 3 }[
		tone ?? 'neutral'
	];
	return {
		authority: authorityScore,
		relationship: relationshipScore,
		personality,
		alignment,
		needs,
		tone: toneScore,
		total: authorityScore + relationshipScore + personality + alignment + needs + toneScore
	};
}

function conversationVoice(
	hero: (
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
	)['heroes'][string]
): {
	prefix: string;
	question: string;
} {
	return {
		reserved: { prefix: 'Understood.', question: 'I will answer plainly.' },
		warm: { prefix: 'I hear you.', question: 'You can ask me directly.' },
		direct: { prefix: 'Be clear.', question: 'Ask what you need.' },
		formal: { prefix: 'Your words are noted.', question: 'I will give you a precise answer.' },
		wry: {
			prefix: 'That makes things interesting.',
			question: 'Go on—what do you really want to know?'
		},
		inquisitive: {
			prefix: 'I am listening.',
			question: 'I will answer—and I may have questions too.'
		}
	}[hero.mind.socialStyle];
}

function buildConversationResponse(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	command: MasterConverseCommand
): z.infer<typeof HeroConversationTurnSchema>['response'] {
	const hero = state.heroes[command.targetHeroId];
	if (!hero) throw new IllegalActionError(command.commandType);
	const voice = conversationVoice(hero);
	if (command.kind === 'say') {
		return {
			exactText: `${voice.prefix} What matters to me here is ${hero.mind.primaryValue}, and I am trying to ${hero.mind.primaryDrive}.`,
			publicReason: `The reply reflects a ${hero.mind.socialStyle} style, ${hero.mind.primaryValue}, and the drive to ${hero.mind.primaryDrive}.`,
			orderOutcome: null,
			orderScore: null,
			preferenceWeight: 0
		};
	}
	if (command.kind === 'ask') {
		const instinct =
			hero.mind.primaryValue === 'mastery'
				? 'train'
				: hero.mind.primaryValue === 'duty'
					? 'work'
					: 'rest';
		return {
			exactText: `${voice.question} I remember waking at this gate; for now, my next instinct is to ${ORDER_INTENT_LABELS[instinct]}.`,
			publicReason: `The answer is limited to witnessed memory and the hero's current ${hero.mind.primaryValue} value.`,
			orderOutcome: null,
			orderScore: null,
			preferenceWeight: 0
		};
	}
	const intent = command.orderIntent!;
	const orderScore = conversationOrderScore(state, hero, intent, command.tone);
	const orderOutcome: ConversationOrderOutcome =
		orderScore.total >= 24
			? 'accepted'
			: orderScore.total >= 10
				? 'negotiated'
				: orderScore.total >= 0
					? 'deferred'
					: 'refused';
	const exactText = {
		accepted: `${voice.prefix} I will ${ORDER_INTENT_LABELS[intent]}.`,
		negotiated: `${voice.prefix} I will try to ${ORDER_INTENT_LABELS[intent]}, but I will reassess if conditions change.`,
		deferred: `${voice.prefix} Not yet. I need the situation to improve before I ${ORDER_INTENT_LABELS[intent]}.`,
		refused: `${voice.prefix} No. I will not ${ORDER_INTENT_LABELS[intent]} under these conditions.`
	}[orderOutcome];
	return {
		exactText,
		publicReason: `The ${orderOutcome} outcome totals ${orderScore.total} from authority, relationship, personality, alignment, needs, and tone.`,
		orderOutcome,
		orderScore,
		preferenceWeight: orderOutcome === 'accepted' ? 24 : orderOutcome === 'negotiated' ? 12 : 0
	};
}

function buildConversationSociety(
	state:
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21,
	eventId: string,
	command: MasterConverseCommand
): {
	society: SocietyStateV3 | SocietyStateV4;
	conversationTurn: z.infer<typeof HeroConversationTurnSchema>;
} {
	const communication = buildCommunicativeSociety(state, eventId, {
		targetHeroId: command.targetHeroId,
		kind: command.kind === 'say' ? 'tell' : command.kind,
		topic: command.kind === 'order' ? 'daily-order' : 'open-conversation',
		exactText: command.exactText,
		tone: command.tone,
		delivery: command.delivery
	});
	const baseSociety =
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21
			? SocietyStateV4Schema.parse(communication.society)
			: SocietyStateV3Schema.parse(communication.society);
	const response = buildConversationResponse(state, command);
	const turnId = deterministicUuid(`${eventId}:conversation-turn`);
	const conversationTurn = HeroConversationTurnSchema.parse({
		turnId,
		sourceEventId: eventId,
		communicationActId: communication.communicativeAct.actId,
		masterId: state.master.masterId,
		heroId: command.targetHeroId,
		kind: command.kind,
		orderIntent: command.orderIntent,
		response,
		occurredAt: state.simulatedAt
	});
	const targetWitness = communication.communicativeAct.witnesses.find(
		(witness) => witness.heroId === command.targetHeroId
	);
	if (!targetWitness) {
		throw new ReplayIntegrityError('Conversation target did not witness speech', state.eventCursor);
	}
	const relationshipId = deterministicUuid(
		`${command.targetHeroId}:${state.master.masterId}:relationship`
	);
	const authorityId = deterministicUuid(
		`${command.targetHeroId}:${state.master.masterId}:authority`
	);
	const previousRelationship = baseSociety.relationships[relationshipId];
	const previousAuthority = baseSociety.authority[authorityId];
	if (!previousRelationship || !previousAuthority) {
		throw new ReplayIntegrityError('Conversation social view is missing', state.eventCursor);
	}
	const relationshipDeltas = {
		trust: command.tone === 'reassuring' ? 1 : 0,
		respect: response.orderOutcome === 'accepted' || response.orderOutcome === 'negotiated' ? 1 : 0,
		fear: command.tone === 'urgent' ? 1 : 0,
		affection: command.tone === 'apologetic' ? 1 : 0,
		resentment: response.orderOutcome === 'refused' && command.tone === 'firm' ? 1 : 0,
		debt: 0
	};
	const authorityDeltas = {
		competence: 0,
		provision: 0,
		trust: relationshipDeltas.trust,
		legitimacy: response.orderOutcome === 'accepted' ? 1 : 0,
		fear: relationshipDeltas.fear,
		strength: 0,
		consistency: response.orderOutcome === 'negotiated' ? 1 : 0
	};
	const evidenceSummary = response.publicReason;
	const societyCandidate = {
		...baseSociety,
		relationships: {
			...baseSociety.relationships,
			[relationshipId]: {
				...previousRelationship,
				dimensions: Object.fromEntries(
					Object.entries(previousRelationship.dimensions).map(([key, value]) => [
						key,
						clampSocial(value + relationshipDeltas[key as keyof typeof relationshipDeltas])
					])
				),
				updatedAt: state.simulatedAt,
				lastSourceEventId: eventId,
				evidence: [
					...previousRelationship.evidence.slice(-63),
					{
						sourceEventId: eventId,
						observationId: targetWitness.observationId,
						summary: evidenceSummary,
						deltas: relationshipDeltas
					}
				]
			}
		},
		authority: {
			...baseSociety.authority,
			[authorityId]: {
				...previousAuthority,
				dimensions: Object.fromEntries(
					Object.entries(previousAuthority.dimensions).map(([key, value]) => [
						key,
						clampSocial(value + authorityDeltas[key as keyof typeof authorityDeltas])
					])
				),
				updatedAt: state.simulatedAt,
				lastSourceEventId: eventId,
				evidence: [
					...previousAuthority.evidence.slice(-63),
					{
						sourceEventId: eventId,
						observationId: targetWitness.observationId,
						summary: evidenceSummary,
						deltas: authorityDeltas
					}
				]
			}
		},
		conversationTurns: {
			...baseSociety.conversationTurns,
			[turnId]: conversationTurn
		}
	};
	const society =
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21
			? SocietyStateV4Schema.parse(societyCandidate)
			: SocietyStateV3Schema.parse(societyCandidate);
	return { society, conversationTurn };
}

function firstEmberModifier(
	state: EngineGameStateModern,
	key:
		| 'hunger-recovery'
		| 'fatigue-recovery'
		| 'health-recovery'
		| 'hero-experience'
		| 'sword-experience'
		| 'training-injury-threshold'
): number {
	if (!hasFirstEmberState(state) || state.settlement.firstEmber.status !== 'committed') return 0;
	return (
		state.settlement.firstEmber.modifiers.find((modifier) => modifier.key === key)?.amount ?? 0
	);
}

function zoneForNode(definition: SettlementDefinition, nodeId: string) {
	const node = definition.nodes.find((candidate) => candidate.nodeId === nodeId);
	if (!node) return null;
	if (!node.buildingId) return 'settlement-exterior' as const;
	return (
		definition.buildings.find((building) => building.buildingId === node.buildingId)?.kind ?? null
	);
}

function destinationNodeId(
	definition: SettlementDefinition,
	destination: 'kitchen' | 'training-ground'
): string {
	const building = definition.buildings.find((candidate) => candidate.kind === destination);
	if (!building) throw new Error(`Settlement is missing ${destination}`);
	return building.interior.focusNodeId;
}

function action(input: Parameters<typeof LegalActionSchema.parse>[0]): LegalAction {
	return LegalActionSchema.parse(input);
}

function routeHasCapacity(
	state:
		| EngineGameStateV3
		| EngineGameStateV4
		| EngineGameStateV5
		| EngineGameStateV6
		| EngineGameStateV7
		| EngineGameStateV8
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV22
		| EngineGameStateV23,
	definition: SettlementDefinition,
	heroId: string,
	targetNodeId: string,
	route: ReturnType<typeof planSettlementRoute>
): boolean {
	if (!route) return false;
	if (!hasFacilityState(state)) return true;
	const targetNode = definition.nodes.find((candidate) => candidate.nodeId === targetNodeId);
	const nodeReservations = Object.values(state.heroes).filter(
		(candidate) =>
			candidate.heroId !== heroId &&
			(candidate.locationNodeId === targetNodeId ||
				candidate.currentTravel?.toNodeId === targetNodeId)
	).length;
	if (!targetNode || nodeReservations >= targetNode.capacity) return false;
	return route.steps.every((step) => {
		const edge = definition.edges.find((candidate) => candidate.edgeId === step.edgeId);
		const reservations = Object.values(state.heroes).filter((candidate) =>
			candidate.currentTravel?.route.steps.some(
				(candidateStep) => candidateStep.edgeId === step.edgeId
			)
		).length;
		return Boolean(edge && reservations < edge.capacity);
	});
}

function travelActions(
	state:
		| EngineGameStateV3
		| EngineGameStateV4
		| EngineGameStateV5
		| EngineGameStateV6
		| EngineGameStateV7
		| EngineGameStateV8
		| EngineGameStateV9
		| EngineGameStateV10
		| EngineGameStateV11
		| EngineGameStateV12
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV15
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV22
		| EngineGameStateV23,
	actorId: string,
	targetNodeIds?: readonly string[]
): LegalAction[] {
	const hero = state.heroes[actorId];
	if (!hero) return [];
	const definition = settlementForState(state);
	const allowedTargets = targetNodeIds ? new Set(targetNodeIds) : null;
	return definition.nodes
		.filter(
			(node) =>
				node.nodeId !== hero.locationNodeId &&
				zoneForNode(definition, node.nodeId) !== null &&
				(!allowedTargets || allowedTargets.has(node.nodeId))
		)
		.map((node) => ({
			node,
			route: planSettlementRoute(
				definition,
				hero.locationNodeId,
				node.nodeId,
				new Set(state.settlement.navigation.activeSystemIds)
			)
		}))
		.filter(
			(candidate) =>
				candidate.route !== null &&
				candidate.route.totalTravelGameSeconds > 0 &&
				routeHasCapacity(state, definition, actorId, candidate.node.nodeId, candidate.route)
		)
		.sort((left, right) => left.node.nodeId.localeCompare(right.node.nodeId))
		.map(({ node, route }) =>
			action({
				actionId: `hero.travel.${node.nodeId}`,
				actorId,
				kind: 'move',
				label: `Travel to ${node.label}`,
				description: `Schedule the verified ${route!.totalTravelGameSeconds}-second route to ${node.label}.`,
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'scheduled-event', 'content-bound', node.nodeId]
			})
		);
}

function currentTravelFor(state: EngineGameState, heroId: string) {
	return state.schemaVersion === 3 ||
		state.schemaVersion === 4 ||
		state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21 ||
		state.schemaVersion === 22 ||
		state.schemaVersion === 23
		? (state.heroes[heroId]?.currentTravel ?? null)
		: null;
}

function currentRoutineFor(state: EngineGameState, heroId: string) {
	return state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 21 ||
		state.schemaVersion === 22 ||
		state.schemaVersion === 23
		? (state.heroes[heroId]?.currentRoutine ?? null)
		: null;
}

const ACTIVE_MISSION_STATUSES = new Set(['preparing', 'deployed', 'resolving', 'extraction']);

type MissionEngineState =
	| EngineGameStateV11
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV22
	| EngineGameStateV23;
type MissionEngineRunState =
	| MissionRunState
	| MissionRunStateV2
	| MissionRunStateV3
	| MissionRunStateV4
	| MissionRunStateV5
	| MissionRunStateV6
	| MissionRunStateV7
	| MissionRunStateV8;

function parseMissionRunState(state: MissionEngineState, value: unknown): MissionEngineRunState {
	return state.schemaVersion === 23 ||
		state.schemaVersion === 22 ||
		state.schemaVersion === 21 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 18
		? MissionRunStateV8Schema.parse(value)
		: state.schemaVersion === 17
			? MissionRunStateV7Schema.parse(value)
			: state.schemaVersion === 16
				? MissionRunStateV6Schema.parse(value)
				: state.schemaVersion === 15
					? MissionRunStateV5Schema.parse(value)
					: state.schemaVersion === 14
						? MissionRunStateV4Schema.parse(value)
						: state.schemaVersion === 13
							? MissionRunStateV3Schema.parse(value)
							: state.schemaVersion === 12
								? MissionRunStateV2Schema.parse(value)
								: MissionRunStateSchema.parse(value);
}

function missionPartyIsReserved(state: MissionEngineState, actorId: string): boolean {
	const attempt = state.mission.attempt;
	return Boolean(
		attempt &&
		ACTIVE_MISSION_STATUSES.has(attempt.status) &&
		attempt.party.memberIds.includes(actorId)
	);
}

function normalizedMissionHeroIds(heroIds: readonly string[]): string[] {
	return [...heroIds].sort((left, right) => left.localeCompare(right));
}

function assertMissionPartyReady(
	state: MissionEngineState,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId
): void {
	if (
		state.schemaVersion !== 14 &&
		state.schemaVersion !== 15 &&
		state.schemaVersion !== 16 &&
		state.schemaVersion !== 17 &&
		state.schemaVersion !== 18 &&
		state.schemaVersion !== 19 &&
		state.schemaVersion !== 20 &&
		state.schemaVersion !== 23 &&
		missionId !== state.mission.binding.missionId
	) {
		throw new IllegalActionError('mission.party');
	}
	if (
		(state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
		!state.mission.availableMissionIds.includes(missionId)
	) {
		throw new IllegalActionError('mission.party');
	}
	const mission = verifiedMissionContent(missionId);
	const normalized = normalizedMissionHeroIds(heroIds);
	const partySize = normalized.length + 1;
	if (
		new Set(normalized).size !== normalized.length ||
		partySize < mission.deployment.minimumPartyMembers ||
		partySize > mission.deployment.maximumPartyMembers ||
		state.master.lifeState !== 'alive' ||
		state.master.location !== 'summoning-gate'
	) {
		throw new IllegalActionError('mission.party');
	}
	for (const heroId of normalized) {
		const hero = state.heroes[heroId];
		if (
			!hero ||
			hero.lifeState !== 'active' ||
			hero.location !== 'summoning-gate' ||
			hero.currentActivity !== null ||
			hero.currentTravel !== null ||
			hero.currentRoutine !== null ||
			hero.assignment !== null
		) {
			throw new IllegalActionError('mission.party');
		}
	}
}

function prepareMissionAttempt(
	state: MissionEngineState,
	commandId: string,
	heroIds: readonly string[],
	missionId = state.mission.binding.missionId
): MissionEngineRunState {
	assertMissionPartyReady(state, heroIds, missionId);
	const prior = state.mission.attempt;
	if (
		prior &&
		!['canceled', 'retreat', 'failure', 'death'].includes(prior.status) &&
		!(
			(state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23) &&
			prior.status === 'success'
		)
	) {
		throw new IllegalActionError('mission.prepare');
	}
	const mission = verifiedMissionContent(missionId);
	const normalized = normalizedMissionHeroIds(heroIds);
	const ordinal = state.mission.attemptCount + 1;
	const attemptId = deterministicUuid(`${commandId}:mission-attempt:${ordinal}`);
	return parseMissionRunState(state, {
		...state.mission,
		binding: verifiedMissionBinding(missionId),
		...(state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? {
					aftermath: {
						...state.mission.aftermath,
						activeAttemptId: attemptId,
						consequences: [],
						archives: prior
							? [
									...state.mission.aftermath.archives,
									{
										attemptId: prior.attemptId,
										ordinal: prior.ordinal,
										binding: state.mission.binding,
										outcome: prior.outcome!,
										preparedAt: prior.preparedAt,
										deployedAt: prior.deployedAt,
										endedAt: prior.endedAt!,
										finalRoundNumber: state.mission.attempt!.turnState.roundNumber,
										consequences: state.mission.aftermath.consequences
									}
								]
							: state.mission.aftermath.archives
					}
				}
			: {}),
		attemptCount: ordinal,
		attempt: {
			attemptId,
			ordinal,
			status: 'preparing',
			party: {
				masterId: state.master.masterId,
				heroIds: normalized,
				memberIds: [state.master.masterId, ...normalized]
			},
			entryNodeId: mission.deployment.entryNodeIds[0]!,
			extractionNodeId: mission.deployment.extractionNodeIds[0]!,
			positions: {},
			knowledge: { discoveryIds: [], visitedNodeIds: [] },
			completedObjectiveIds: [],
			preparedAt: state.simulatedAt,
			deployedAt: null,
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			...(state.schemaVersion === 15
				? {
						turnState: {
							turnVersion: 'mission-turn-v3',
							maximumRounds: IRON_MOON_PACKAGE.portal.durationRounds,
							roundNumber: 0,
							objective: {
								objectiveId: mission.objectives.find((objective) => objective.primary)!.objectiveId,
								status: 'available',
								quota: IRON_MOON_PACKAGE.portal.extractionQuota,
								minedAmount: 0,
								quotaReachedOnRound: null,
								deliveredOnRound: null
							},
							policyBinding: {
								contentVersion: MONSTER_POLICY_CATALOG.contentVersion,
								contentHash: MONSTER_POLICY_CATALOG.contentHash
							},
							monsters: {},
							partyGuard: Object.fromEntries(
								[state.master.masterId, ...normalized].map((actorId) => [
									actorId,
									{
										actorId,
										guard: 3,
										maximumGuard: 3,
										status: 'ready',
										lastChangedOnRound: 0
									}
								])
							),
							arena: {
								furnaceState: 'absent',
								coolingControlNodeId: null,
								coolingControlExposed: false
							},
							currentThreatIntents: [],
							portal: {
								portalVersion: 'portal-runtime-v1',
								portalId: IRON_MOON_PACKAGE.portal.portalId,
								durationRounds: IRON_MOON_PACKAGE.portal.durationRounds,
								roundsRemaining: IRON_MOON_PACKAGE.portal.durationRounds,
								warningAtRemainingRounds: IRON_MOON_PACKAGE.portal.warningAtRemainingRounds,
								criticalAtRemainingRounds: IRON_MOON_PACKAGE.portal.criticalAtRemainingRounds,
								pressureStage: 'stable',
								extractionQuota: IRON_MOON_PACKAGE.portal.extractionQuota,
								cargoCapacityPerActor: IRON_MOON_PACKAGE.portal.cargoCapacityPerActor,
								deposits: Object.fromEntries(
									IRON_MOON_PACKAGE.portal.deposits.map((deposit) => [
										deposit.depositId,
										{
											...deposit,
											remainingAmount: deposit.initialAmount
										}
									])
								),
								cargo: Object.fromEntries(
									[state.master.masterId, ...normalized].map((actorId) => [
										actorId,
										{
											actorId,
											resource: 'iron-ore',
											amount: 0,
											capacity: IRON_MOON_PACKAGE.portal.cargoCapacityPerActor
										}
									])
								),
								oreLedger: [],
								extractedAmount: 0,
								extractionCredited: false
							},
							rounds: []
						}
					}
				: state.schemaVersion === 12
					? {
							turnState: {
								turnVersion: 'mission-turn-v1',
								maximumRounds: 48,
								roundNumber: 0,
								objective: {
									objectiveId: mission.objectives.find((objective) => objective.primary)!
										.objectiveId,
									status: 'available',
									carrierId: null,
									recoveredOnRound: null,
									deliveredOnRound: null
								},
								rounds: []
							}
						}
					: state.schemaVersion === 13 ||
						  state.schemaVersion === 14 ||
						  state.schemaVersion === 16 ||
						  state.schemaVersion === 17 ||
						  state.schemaVersion === 18 ||
						  state.schemaVersion === 19 ||
						  state.schemaVersion === 20 ||
						  state.schemaVersion === 23
						? {
								turnState: {
									turnVersion: 'mission-turn-v2',
									maximumRounds: 48,
									roundNumber: 0,
									objective: {
										objectiveId: mission.objectives.find((objective) => objective.primary)!
											.objectiveId,
										status: 'available',
										carrierId: null,
										recoveredOnRound: null,
										deliveredOnRound: null
									},
									policyBinding: {
										contentVersion: MONSTER_POLICY_CATALOG.contentVersion,
										contentHash: MONSTER_POLICY_CATALOG.contentHash
									},
									monsters: {},
									partyGuard: Object.fromEntries(
										[state.master.masterId, ...normalized].map((actorId) => [
											actorId,
											{
												actorId,
												guard: 3,
												maximumGuard: 3,
												status: 'ready',
												lastChangedOnRound: 0
											}
										])
									),
									arena: {
										furnaceState: mission.missionId === 'tower-floor-05' ? 'lit' : 'absent',
										coolingControlNodeId:
											mission.missionId === 'tower-floor-05' ? 'cooling-control' : null,
										coolingControlExposed: false
									},
									currentThreatIntents: [],
									rounds: []
								}
							}
						: {})
		}
	});
}

function reviseMissionParty(
	state: MissionEngineState,
	heroIds: readonly string[]
): MissionEngineRunState {
	const attempt = state.mission.attempt;
	if (attempt?.status !== 'preparing') throw new IllegalActionError('mission.revise.party');
	assertMissionPartyReady(state, heroIds);
	const normalized = normalizedMissionHeroIds(heroIds);
	return parseMissionRunState(state, {
		...state.mission,
		attempt: {
			...attempt,
			party: {
				masterId: state.master.masterId,
				heroIds: normalized,
				memberIds: [state.master.masterId, ...normalized]
			},
			...(state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20
				? {
						turnState: {
							...state.mission.attempt!.turnState,
							partyGuard: Object.fromEntries(
								[state.master.masterId, ...normalized].map((actorId) => [
									actorId,
									state.mission.attempt!.turnState.partyGuard[actorId] ?? {
										actorId,
										guard: 3,
										maximumGuard: 3,
										status: 'ready',
										lastChangedOnRound: 0
									}
								])
							),
							...(state.schemaVersion === 15
								? {
										portal: {
											...state.mission.attempt!.turnState.portal,
											cargo: Object.fromEntries(
												[state.master.masterId, ...normalized].map((actorId) => [
													actorId,
													state.mission.attempt!.turnState.portal.cargo[actorId] ?? {
														actorId,
														resource: 'iron-ore',
														amount: 0,
														capacity: state.mission.attempt!.turnState.portal.cargoCapacityPerActor
													}
												])
											)
										}
									}
								: {})
						}
					}
				: {})
		}
	});
}

function cancelMissionPreparation(state: MissionEngineState): MissionEngineRunState {
	const attempt = state.mission.attempt;
	if (attempt?.status !== 'preparing') throw new IllegalActionError('mission.cancel');
	return parseMissionRunState(state, {
		...state.mission,
		attempt: { ...attempt, status: 'canceled', endedAt: state.simulatedAt, outcome: 'canceled' }
	});
}

type MissionDeploymentResolution = {
	readonly mission: MissionEngineRunState;
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
};

function deployMissionAttempt(state: MissionEngineState): MissionDeploymentResolution {
	const attempt = state.mission.attempt;
	if (attempt?.status !== 'preparing') throw new IllegalActionError('mission.deploy');
	assertMissionPartyReady(state, attempt.party.heroIds);
	const positions = Object.fromEntries(
		attempt.party.memberIds.map((memberId) => [memberId, attempt.entryNodeId])
	);
	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const combat =
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? spawnMissionCombatants(state, state.mission.attempt!, positions, entropy, entropyDraws)
			: null;
	if (combat) entropy = combat.entropy;
	const mission = parseMissionRunState(state, {
		...state.mission,
		attempt: {
			...attempt,
			status: 'deployed',
			positions,
			knowledge: { discoveryIds: [], visitedNodeIds: [attempt.entryNodeId] },
			deployedAt: state.simulatedAt,
			...(combat
				? {
						turnState: {
							...(state.schemaVersion === 13 ||
							state.schemaVersion === 14 ||
							state.schemaVersion === 16 ||
							state.schemaVersion === 17 ||
							state.schemaVersion === 18 ||
							state.schemaVersion === 19 ||
							state.schemaVersion === 20 ||
							state.schemaVersion === 23
								? state.mission.attempt!.turnState
								: {}),
							monsters: combat.monsters,
							currentThreatIntents: combat.threatIntents
						}
					}
				: {})
		}
	});
	return { mission, entropyCursor: entropy.cursor, entropyDraws };
}

function openMissionExtraction(
	state: EngineGameStateV11,
	completedObjectiveIds: readonly string[]
): MissionRunState {
	const attempt = state.mission.attempt;
	if (!attempt || !['deployed', 'resolving'].includes(attempt.status)) {
		throw new IllegalActionError('mission.open.extraction');
	}
	const mission = missionContentForState(state);
	const declaredIds = new Set(mission.objectives.map((objective) => objective.objectiveId));
	const normalized = [...completedObjectiveIds].sort((left, right) => left.localeCompare(right));
	const primaryIds = mission.objectives
		.filter((objective) => objective.primary)
		.map((objective) => objective.objectiveId);
	if (
		new Set(normalized).size !== normalized.length ||
		normalized.some((objectiveId) => !declaredIds.has(objectiveId)) ||
		primaryIds.some((objectiveId) => !normalized.includes(objectiveId))
	) {
		throw new IllegalActionError('mission.open.extraction');
	}
	return MissionRunStateSchema.parse({
		...state.mission,
		attempt: {
			...attempt,
			status: 'extraction',
			completedObjectiveIds: normalized,
			extractionOpenedAt: state.simulatedAt
		}
	});
}

function allPartyAtNode(state: MissionEngineState, nodeIds: readonly string[]): boolean {
	const attempt = state.mission.attempt;
	return Boolean(
		attempt &&
		attempt.party.memberIds.every((memberId) => nodeIds.includes(attempt.positions[memberId]!))
	);
}

function completeMissionExtraction(state: MissionEngineState): MissionEngineRunState {
	const attempt = state.mission.attempt;
	const mission = missionContentForState(state);
	const primaryIds = mission.objectives
		.filter((objective) => objective.primary)
		.map((objective) => objective.objectiveId);
	if (
		attempt?.status !== 'extraction' ||
		primaryIds.some((objectiveId) => !attempt.completedObjectiveIds.includes(objectiveId)) ||
		!allPartyAtNode(state, [attempt.extractionNodeId])
	) {
		throw new IllegalActionError('mission.extract');
	}
	return parseMissionRunState(state, {
		...state.mission,
		attempt: { ...attempt, status: 'success', endedAt: state.simulatedAt, outcome: 'success' }
	});
}

function retreatMissionAttempt(state: MissionEngineState): MissionEngineRunState {
	const attempt = state.mission.attempt;
	const mission = missionContentForState(state);
	if (
		!attempt ||
		!['deployed', 'resolving', 'extraction'].includes(attempt.status) ||
		!allPartyAtNode(state, mission.retreat.nodeIds)
	) {
		throw new IllegalActionError('mission.retreat');
	}
	if (state.schemaVersion === 15) {
		const portalAttempt = state.mission.attempt!;
		const portal = appendPortalCargoLosses(
			portalAttempt,
			portalAttempt.turnState.portal,
			Math.max(1, portalAttempt.turnState.roundNumber)
		);
		return MissionRunStateV5Schema.parse({
			...state.mission,
			attempt: {
				...portalAttempt,
				status: 'retreat',
				endedAt: state.simulatedAt,
				outcome: 'retreat',
				turnState: { ...portalAttempt.turnState, portal }
			}
		});
	}
	return parseMissionRunState(state, {
		...state.mission,
		attempt: { ...attempt, status: 'retreat', endedAt: state.simulatedAt, outcome: 'retreat' }
	});
}

const MISSION_MOVE_PREFIX = 'mission.move.';
const MISSION_INSPECT_PREFIX = 'mission.inspect.';
const MISSION_RECOVER_PREFIX = 'mission.recover.';
const MISSION_ATTACK_PREFIX = 'mission.attack.';
const MISSION_MINE_PREFIX = 'mission.mine.';
const MISSION_COOLING_CONTROL_ACTION_ID = 'mission.control.cooling-wheel';
const MISSION_HOLD_ACTION_ID = 'mission.hold';

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

type MissionTurnEngineState =
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV23;

function missionToolTagsForActor(state: MissionTurnEngineState, actorId: string): Set<string> {
	if (
		state.schemaVersion !== 14 &&
		state.schemaVersion !== 16 &&
		state.schemaVersion !== 17 &&
		state.schemaVersion !== 18 &&
		state.schemaVersion !== 19 &&
		state.schemaVersion !== 20 &&
		state.schemaVersion !== 21 &&
		state.schemaVersion !== 23
	)
		return new Set();
	return new Set(
		Object.values(state.mission.evidence)
			.filter(
				(evidence) =>
					evidence.holderActorId === actorId && evidence.evidenceKey === 'foundry-maintenance-route'
			)
			.map(() => 'relay-route-memory')
	);
}

function missionTurnActionsForState(state: MissionTurnEngineState, actorId: string): LegalAction[] {
	const attempt = state.mission.attempt;
	if (
		!attempt ||
		!['deployed', 'resolving'].includes(attempt.status) ||
		!attempt.party.memberIds.includes(actorId) ||
		attempt.turnState.roundNumber >= attempt.turnState.maximumRounds
	) {
		return [];
	}
	const mission = missionContentForState(state);
	const nodeId = attempt.positions[actorId];
	if (!nodeId) return [];
	const projection = projectMissionArenaKnowledge(mission, attempt.knowledge);
	const visibleEdgeIds = new Set(projection.edgeIds);
	const objective = attempt.turnState.objective;
	const targetNodeId =
		objective.status === 'available'
			? mission.objectives.find((candidate) => candidate.objectiveId === objective.objectiveId)!
					.targetNodeIds[0]!
			: attempt.extractionNodeId;
	const currentRoute = planMissionRoute(mission, nodeId, targetNodeId, attempt.knowledge);
	const actions: LegalAction[] = [];
	for (const edge of mission.arena.edges) {
		if (!visibleEdgeIds.has(edge.edgeId)) continue;
		const toNodeId =
			edge.fromNodeId === nodeId
				? edge.toNodeId
				: edge.bidirectional && edge.toNodeId === nodeId
					? edge.fromNodeId
					: null;
		if (!toNodeId) continue;
		const routeAfterMove = planMissionRoute(mission, toNodeId, targetNodeId, attempt.knowledge);
		const advancesObjective =
			routeAfterMove !== null &&
			currentRoute !== null &&
			routeAfterMove.totalTraversalActions < currentRoute.totalTraversalActions;
		actions.push(
			action({
				actionId: `${MISSION_MOVE_PREFIX}${edge.edgeId}`,
				actorId,
				kind: 'move',
				label: `Move to ${mission.arena.nodes.find((node) => node.nodeId === toNodeId)!.label}`,
				description: advancesObjective
					? objective.status === 'available'
						? 'Advance along a known route toward the primary objective.'
						: 'Carry the company back along a known return route.'
					: 'Move along a known authored edge without inventing unseen topology.',
				targetIds: [],
				resourceCosts: {},
				tags: [
					'mission',
					'move',
					edge.exposure,
					...(advancesObjective
						? objective.status === 'available'
							? ['objective', 'objective-route', 'advance']
							: ['protect', 'return-route', 'extraction']
						: ['explore'])
				]
			})
		);
	}
	for (const affordance of listLegalMissionDiscoveryAffordances(
		mission,
		nodeId,
		attempt.knowledge,
		missionToolTagsForActor(state, actorId)
	)) {
		actions.push(
			action({
				actionId: `${MISSION_INSPECT_PREFIX}${affordance.affordanceId}`,
				actorId,
				kind: 'interact',
				label: affordance.label,
				description: affordance.description,
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'inspect', 'interact', 'secret', 'explore', 'discovery']
			})
		);
	}
	const objectiveDefinition = mission.objectives.find(
		(candidate) => candidate.objectiveId === objective.objectiveId
	)!;
	if (
		objective.status === 'available' &&
		state.schemaVersion !== 15 &&
		objectiveDefinition.completionRule.kind === 'recover-ledger-item' &&
		objectiveDefinition.targetNodeIds.includes(nodeId)
	) {
		actions.push(
			action({
				actionId: `${MISSION_RECOVER_PREFIX}${objective.objectiveId}`,
				actorId,
				kind: 'interact',
				label:
					state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20
						? `Recover ${objectiveDefinition.title}`
						: 'Lift the First Ember',
				description:
					state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20
						? `Physically recover ${objectiveDefinition.title} before attempting the return route.`
						: 'Physically recover the primary objective before attempting the return route.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'interact', 'recover', 'objective', 'protect', 'work']
			})
		);
	}
	if (state.schemaVersion === 15) {
		const cargo = state.mission.attempt!.turnState.portal.cargo[actorId]!;
		for (const deposit of Object.values(state.mission.attempt!.turnState.portal.deposits)
			.filter(
				(candidate) =>
					candidate.nodeId === nodeId &&
					candidate.remainingAmount > 0 &&
					cargo.amount < cargo.capacity
			)
			.sort((left, right) => left.depositId.localeCompare(right.depositId))) {
			const amount = Math.min(
				deposit.mineAmountPerAction,
				deposit.remainingAmount,
				cargo.capacity - cargo.amount
			);
			actions.push(
				action({
					actionId: `${MISSION_MINE_PREFIX}${deposit.depositId}`,
					actorId,
					kind: 'work',
					label: `Mine ${amount} moon iron`,
					description: `Transfer ${amount} authored ore from this finite deposit into ${actorId === state.master.masterId ? 'the Master’s' : 'this hero’s'} bounded cargo.`,
					targetIds: [],
					resourceCosts: {},
					tags: ['mission', 'portal', 'mine', 'resource', 'iron-ore', 'work']
				})
			);
		}
	}
	if (
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
	) {
		const combatAttempt = state.mission.attempt!;
		for (const monster of Object.values(combatAttempt.turnState.monsters)
			.filter((candidate) => candidate.status === 'active' && candidate.nodeId === nodeId)
			.sort((left, right) => left.monsterId.localeCompare(right.monsterId))) {
			actions.push(
				action({
					actionId: `${MISSION_ATTACK_PREFIX}${monster.monsterId}`,
					actorId,
					kind: 'interact',
					label: `Strike ${monster.label}`,
					description:
						'Commit a basic attack against one co-located threat; the engine applies vitality and armor.',
					targetIds: [monster.monsterId],
					resourceCosts: {},
					tags: ['mission', 'attack', 'combat', 'threat', monster.policyId]
				})
			);
		}
	}
	const v14Arena =
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
			? state.mission.attempt!.turnState.arena
			: null;
	if (
		v14Arena &&
		nodeId === v14Arena.coolingControlNodeId &&
		attempt.knowledge.discoveryIds.includes('cooling-control-weakness') &&
		v14Arena.furnaceState !== 'absent' &&
		v14Arena.furnaceState !== 'quenched'
	) {
		actions.push(
			action({
				actionId: MISSION_COOLING_CONTROL_ACTION_ID,
				actorId,
				kind: 'interact',
				label: 'Turn the cooling wheel',
				description: 'Advance the engine-owned furnace from lit to cooling, then quenched.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'interact', 'control', 'cooling', 'furnace']
			})
		);
	}
	actions.push(
		action({
			actionId: MISSION_HOLD_ACTION_ID,
			actorId,
			kind: 'defend',
			label: 'Hold position',
			description:
				'Watch the current lane and preserve the present formation for one bounded round.',
			targetIds: [],
			resourceCosts: {},
			tags: ['mission', 'defend', 'guard', 'protect', 'wait']
		})
	);
	return actions.sort((left, right) => left.actionId.localeCompare(right.actionId));
}

export function missionTurnLegalActions(
	stateInput: EngineGameState,
	actorId: string
): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	return state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 14 ||
		state.schemaVersion === 15 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23
		? missionTurnActionsForState(state, actorId)
		: [];
}

function normalizedMissionTurnChoices(
	state: MissionTurnEngineState,
	choices: readonly MissionTurnChoice[]
): MissionTurnChoice[] {
	const attempt = state.mission.attempt;
	if (!attempt || !['deployed', 'resolving'].includes(attempt.status)) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	if (attempt.turnState.roundNumber >= attempt.turnState.maximumRounds) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const parsedChoices = choices.map((choice) => MissionTurnChoiceSchema.parse(choice));
	const byActor = new Map(parsedChoices.map((choice) => [choice.actorId, choice]));
	if (
		byActor.size !== parsedChoices.length ||
		parsedChoices.length !== attempt.party.memberIds.length ||
		attempt.party.memberIds.some((actorId) => !byActor.has(actorId))
	) {
		throw new IllegalActionError('mission.resolve.turn');
	}
	const normalized = attempt.party.memberIds.map((actorId) => byActor.get(actorId)!);
	for (const choice of normalized) {
		if (
			(choice.actorId === attempt.party.masterId &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				choice.source !== 'manual') ||
			(choice.actorId !== attempt.party.masterId && choice.source === 'manual') ||
			!missionTurnActionsForState(state, choice.actorId).some(
				(candidate) => candidate.actionId === choice.actionId
			)
		) {
			throw new IllegalActionError(choice.actionId);
		}
	}
	return normalized;
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

function gameDayIndex(gameTime: string): number {
	return Math.floor((Date.parse(gameTime) - Date.parse(ENGINE_EPOCH)) / (24 * 60 * 60 * 1_000));
}

function routineLabel(kind: RoutineKind): string {
	return {
		'checks-exits': 'survey the exits',
		'stretches-at-dawn': 'complete a stretching ritual',
		'shares-breakfast': 'prepare a shared breakfast',
		'catalogues-tools': 'catalogue useful tools',
		'walks-the-walls': 'walk the settlement walls',
		'practises-knots': 'practise knots and bindings',
		'assigned-duty': 'work the assigned facility duty',
		'self-directed': 'pursue self-directed practice',
		meal: 'eat a proper meal',
		sleep: 'sleep and recover'
	}[kind];
}

function routineDuration(kind: RoutineKind): number {
	if (kind === 'assigned-duty') return 60;
	if (kind === 'self-directed') return 45;
	if (kind === 'sleep') return 120;
	if (kind === 'meal') return 20;
	return 25;
}

function createDailyPlan(state: EngineRoutineState, heroId: string, commandId: string) {
	const hero = state.heroes[heroId];
	if (!hero) throw new IllegalActionError('hero.plan.day');
	const dayIndex = gameDayIndex(state.simulatedAt);
	const assignmentKind = hero.assignment ? ('assigned-duty' as const) : ('self-directed' as const);
	return DailyPlanSchema.parse({
		planId: deterministicUuid(`${commandId}:daily-plan:${dayIndex}`),
		dayIndex,
		createdAt: state.simulatedAt,
		entries: [
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:habit`),
				period: 'dawn',
				kind: hero.habit.habit,
				buildingId: null,
				status: 'pending',
				startedAt: null,
				completedAt: null
			},
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:duty`),
				period: 'day',
				kind: assignmentKind,
				buildingId: hero.assignment?.buildingId ?? null,
				status: 'pending',
				startedAt: null,
				completedAt: null
			},
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:meal`),
				period: 'evening',
				kind: 'meal',
				buildingId: 'kitchen',
				status: 'pending',
				startedAt: null,
				completedAt: null
			},
			{
				planEntryId: deterministicUuid(`${commandId}:plan-entry:sleep`),
				period: 'night',
				kind: 'sleep',
				buildingId: 'dormitory',
				status: 'pending',
				startedAt: null,
				completedAt: null
			}
		]
	});
}

export function resolveDailyRoutine(
	stateInput: EngineRoutineState,
	heroId: string
): z.infer<typeof RoutineResolutionSchema> | null {
	const state =
		stateInput.schemaVersion === 23
			? EngineGameStateV23Schema.parse(stateInput)
			: stateInput.schemaVersion === 22
				? EngineGameStateV22Schema.parse(stateInput)
				: stateInput.schemaVersion === 21
					? EngineGameStateV21Schema.parse(stateInput)
					: stateInput.schemaVersion === 20
						? EngineGameStateV20Schema.parse(stateInput)
						: stateInput.schemaVersion === 19
							? EngineGameStateV19Schema.parse(stateInput)
							: stateInput.schemaVersion === 18
								? EngineGameStateV18Schema.parse(stateInput)
								: stateInput.schemaVersion === 17
									? EngineGameStateV17Schema.parse(stateInput)
									: stateInput.schemaVersion === 16
										? EngineGameStateV16Schema.parse(stateInput)
										: stateInput.schemaVersion === 15
											? EngineGameStateV15Schema.parse(stateInput)
											: stateInput.schemaVersion === 14
												? EngineGameStateV14Schema.parse(stateInput)
												: stateInput.schemaVersion === 13
													? EngineGameStateV13Schema.parse(stateInput)
													: stateInput.schemaVersion === 12
														? EngineGameStateV12Schema.parse(stateInput)
														: stateInput.schemaVersion === 11
															? EngineGameStateV11Schema.parse(stateInput)
															: stateInput.schemaVersion === 10
																? EngineGameStateV10Schema.parse(stateInput)
																: stateInput.schemaVersion === 9
																	? EngineGameStateV9Schema.parse(stateInput)
																	: stateInput.schemaVersion === 8
																		? EngineGameStateV8Schema.parse(stateInput)
																		: stateInput.schemaVersion === 7
																			? EngineGameStateV7Schema.parse(stateInput)
																			: stateInput.schemaVersion === 6
																				? EngineGameStateV6Schema.parse(stateInput)
																				: EngineGameStateV5Schema.parse(stateInput);
	const hero = state.heroes[heroId];
	if (!hero?.dailyPlan || hero.currentRoutine) return null;
	const pending = hero.dailyPlan.entries.filter((entry) => entry.status === 'pending');
	if (pending.length === 0) return null;
	const candidateScores = pending
		.map((entry) => {
			const reasons: string[] = [];
			let score = 0;
			let eligible = true;
			if (entry.kind === hero.habit.habit) {
				score = hero.habit.strength + Math.round(hero.mind.personality.conscientiousness / 4);
				score -= Math.round(hero.needs.hunger / 3 + hero.needs.fatigue / 3);
				reasons.push(`habit strength ${hero.habit.strength}`);
				reasons.push(`conscientiousness ${hero.mind.personality.conscientiousness}`);
			}
			if (entry.kind === 'assigned-duty') {
				eligible = Boolean(hero.assignment && hero.assignment.buildingId === entry.buildingId);
				score =
					35 +
					Math.round(hero.mind.personality.conscientiousness / 2) +
					(hero.mind.primaryValue === 'duty' || hero.mind.primaryValue === 'mastery' ? 18 : 0);
				reasons.push(
					hero.assignment ? `assigned to ${hero.assignment.buildingId}` : 'assignment lost'
				);
			}
			if (entry.kind === 'self-directed') {
				score =
					30 +
					Math.round(hero.mind.personality.openness / 3) +
					(hero.mind.primaryDrive === 'understand' || hero.mind.primaryDrive === 'create' ? 15 : 0);
				reasons.push(`openness ${hero.mind.personality.openness}`);
			}
			if (entry.kind === 'meal') {
				eligible = state.settlement.resources.food > 0;
				score = Math.round(hero.needs.hunger * 1.4) + (eligible ? 18 : -100);
				if (hero.habit.habit === 'shares-breakfast') score += 16;
				reasons.push(`hunger ${hero.needs.hunger}`);
				reasons.push(eligible ? 'food available' : 'food unavailable');
			}
			if (entry.kind === 'sleep') {
				score =
					Math.round(hero.needs.fatigue * 1.4) +
					(hero.maxHealth - hero.health) * 2 +
					hero.injuries.length * 15;
				reasons.push(`fatigue ${hero.needs.fatigue}`);
				reasons.push(`health ${hero.health}/${hero.maxHealth}`);
			}
			return {
				planEntryId: entry.planEntryId,
				kind: entry.kind,
				score: eligible ? score : Math.min(score, -100),
				eligible,
				reasons
			};
		})
		.sort((left, right) =>
			right.score === left.score
				? left.planEntryId.localeCompare(right.planEntryId)
				: right.score - left.score
		);
	const eligible = candidateScores.filter((candidate) => candidate.eligible);
	const selected = eligible[0];
	if (!selected) return null;
	const margin = selected.score - (eligible[1]?.score ?? Math.max(-200, selected.score - 100));
	const decisionRecommended = eligible.length > 1 && margin <= 5;
	return RoutineResolutionSchema.parse({
		selectedPlanEntryId: selected.planEntryId,
		selectedKind: selected.kind,
		candidateScores,
		margin,
		decisionRecommended,
		fallbackUsed: decisionRecommended,
		summary: decisionRecommended
			? `${routineLabel(selected.kind)} won a close score by ${margin}; deterministic fallback used.`
			: `${routineLabel(selected.kind)} led the next eligible routine by ${margin}.`
	});
}

function routeActions(state: EngineGameState, actorId: string): LegalAction[] {
	const hero = state.heroes[actorId];
	if (!hero || hero.lifeState !== 'active') return [];
	if (currentTravelFor(state, actorId)) return [];
	if (hero.destination === null) {
		return [
			action({
				actionId: 'hero.choose.kitchen',
				actorId,
				kind: 'move',
				label: 'Choose the kitchen',
				description: 'Open the names-before-orders branch and plan a route to the kitchen.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story-branch', 'settlement']
			}),
			action({
				actionId: 'hero.choose.training-ground',
				actorId,
				kind: 'move',
				label: 'Choose the training ground',
				description: 'Open the steel-before-trust branch and plan a route to training.',
				targetIds: [],
				resourceCosts: {},
				tags: ['story-branch', 'settlement']
			})
		];
	}
	const awaitingFirstArrival = hasNavigationState(state)
		? !state.heroes[actorId]!.firstArrivalCompleted
		: false;
	if ((!hasNavigationState(state) && hero.location === 'summoning-gate') || awaitingFirstArrival) {
		return [
			action({
				actionId: hasNavigationState(state) ? 'hero.travel' : 'hero.arrive.destination',
				actorId,
				kind: 'move',
				label: `Walk to the ${hero.destination === 'kitchen' ? 'kitchen' : 'training ground'}`,
				description: hasNavigationState(state)
					? 'Schedule the verified route; arrival commits only when game time reaches its due time.'
					: 'Complete the already selected route through Hearth 01.',
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'arrival']
			})
		];
	}
	return [];
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
	if (
		(state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
		state.mission.attempt
	) {
		const attempt = state.mission.attempt;
		if (attempt.status === 'preparing') {
			return [
				...controlActions,
				action({
					actionId: 'mission.revise.party',
					actorId,
					kind: 'interact',
					label: 'Revise the threshold party',
					description: 'Replace the reserved hero list before deployment.',
					targetIds: attempt.party.heroIds,
					resourceCosts: {},
					tags: ['mission', 'preparation', 'party']
				}),
				action({
					actionId: 'mission.deploy',
					actorId,
					kind: 'move',
					label: 'Cross the Tower Threshold',
					description: 'Commit the exact prepared party to the hash-bound Floor 01 attempt.',
					targetIds: attempt.party.memberIds,
					resourceCosts: {},
					tags: ['mission', 'deployment', 'irreversible-step']
				}),
				action({
					actionId: 'mission.cancel',
					actorId,
					kind: 'wait',
					label: 'Stand the party down',
					description: 'Cancel before deployment and release every reserved hero.',
					targetIds: attempt.party.memberIds,
					resourceCosts: {},
					tags: ['mission', 'preparation', 'cancel']
				})
			];
		}
		if (attempt.status === 'deployed' || attempt.status === 'resolving') {
			const turnActions =
				state.schemaVersion === 11 ? [] : missionTurnActionsForState(state, actorId);
			return allPartyAtNode(state, missionContentForState(state).retreat.nodeIds)
				? [
						...controlActions,
						...turnActions,
						action({
							actionId: 'mission.retreat',
							actorId,
							kind: 'retreat',
							label:
								state.schemaVersion === 15
									? 'Retreat through the portal scar'
									: 'Retreat through the threshold',
							description:
								state.schemaVersion === 15
									? 'End the expedition alive; all carried ore is abandoned.'
									: 'End this attempt without preserving the primary objective.',
							targetIds: attempt.party.memberIds,
							resourceCosts: {},
							tags: ['mission', 'retreat', 'authoritative-boundary']
						})
					]
				: [...controlActions, ...turnActions];
		}
		if (attempt.status === 'extraction') {
			const actions: LegalAction[] = [];
			if (allPartyAtNode(state, [attempt.extractionNodeId])) {
				actions.push(
					action({
						actionId: 'mission.extract',
						actorId,
						kind: 'interact',
						label:
							state.schemaVersion === 15 ? 'Extract the moon iron' : 'Carry the First Ember home',
						description:
							state.schemaVersion === 15
								? 'Cross the portal scar and atomically credit carried ore to settlement stock.'
								: 'Complete the recovered objective across the authored extraction boundary.',
						targetIds: attempt.party.memberIds,
						resourceCosts: {},
						tags: ['mission', 'extraction', 'success']
					})
				);
			}
			if (allPartyAtNode(state, missionContentForState(state).retreat.nodeIds)) {
				actions.push(
					action({
						actionId: 'mission.retreat',
						actorId,
						kind: 'retreat',
						label: 'Abandon the recovery and retreat',
						description: 'End the attempt without preserving the primary objective.',
						targetIds: attempt.party.memberIds,
						resourceCosts: {},
						tags: ['mission', 'retreat', 'authoritative-boundary']
					})
				);
			}
			return [...controlActions, ...actions];
		}
	}
	const actions = [
		...controlActions,
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
	if (
		(state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
		(!state.mission.attempt ||
			['canceled', 'retreat', 'failure', 'death'].includes(state.mission.attempt.status) ||
			(state.schemaVersion >= 18 && state.mission.attempt.status === 'success'))
	) {
		actions.push(
			action({
				actionId: 'mission.prepare',
				actorId,
				kind: 'interact',
				label: `Prepare ${missionContentForState(state).displayName} party`,
				description: 'Reserve the Master and up to four ready heroes at the Tower Threshold.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'preparation', 'content-bound']
			})
		);
	}
	if (
		Object.values(state.heroes).some(
			(hero) =>
				hero.currentActivity ||
				currentTravelFor(state, hero.heroId) ||
				currentRoutineFor(state, hero.heroId)
		) ||
		((state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
			Object.values(state.society.directives).some(
				(directive) => directive.status === 'active' && directive.expiresAt !== null
			))
	) {
		actions.push(
			action({
				actionId: 'simulation.advance',
				actorId,
				kind: 'wait',
				label: 'Advance to the next scheduled outcome',
				description:
					'Advance the injected game clock and resolve every due activity or arrival in order.',
				targetIds: [],
				resourceCosts: {},
				tags: ['fake-clock', 'scheduled-event']
			})
		);
	}
	if (
		state.schemaVersion === 4 ||
		state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		for (const hero of Object.values(state.heroes)) {
			if (hero.lifeState !== 'active') continue;
			if (hero.assignment) {
				actions.push(
					action({
						actionId: `settlement.unassign.${hero.heroId}`,
						actorId,
						kind: 'work',
						label: `Release ${hero.heroId.slice(0, 8)} from duty`,
						description: 'Remove the hero from the authoritative facility roster.',
						targetIds: [hero.heroId],
						resourceCosts: {},
						tags: ['settlement', 'assignment', 'capacity']
					})
				);
			}
			for (const building of Object.values(state.settlement.buildings)) {
				if (
					hero.assignment?.buildingId === building.buildingId ||
					building.assignedHeroIds.length >= building.assignmentCapacity
				)
					continue;
				actions.push(
					action({
						actionId: `settlement.assign.${hero.heroId}.${building.buildingId}`,
						actorId,
						kind: 'work',
						label: `Assign hero as ${building.assignmentRole}`,
						description: `Move the hero into ${building.buildingId}'s ${building.assignedHeroIds.length}/${building.assignmentCapacity} roster.`,
						targetIds: [hero.heroId],
						resourceCosts: {},
						tags: ['settlement', 'assignment', 'capacity', building.buildingId]
					})
				);
			}
		}
		if (state.schemaVersion === 4 || state.schemaVersion === 5)
			for (const building of Object.values(state.settlement.buildings)) {
				if (
					building.buildingId === 'summoning-gate' ||
					state.settlement.poweredBuildingId === building.buildingId
				)
					continue;
				actions.push(
					action({
						actionId: `settlement.power.${building.buildingId}`,
						actorId,
						kind: 'interact',
						label: `Route development power to ${building.buildingId}`,
						description:
							'Reallocate the one reversible development power slot and refresh route access.',
						targetIds: [],
						resourceCosts: {},
						tags: ['settlement', 'power', 'development-proof', building.buildingId]
					})
				);
			}
	}
	if (
		state.schemaVersion === 8 ||
		state.schemaVersion === 9 ||
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		for (const hero of Object.values(state.heroes)) {
			if (hero.location !== state.master.location || !heroCanHearCommunication(hero)) {
				continue;
			}
			actions.push(
				action({
					actionId: `social.communicate.${hero.heroId}`,
					actorId,
					kind: 'interact',
					label: `Speak with ${hero.heroId.slice(0, 8)}`,
					description:
						'Record exact words, compute actual witnesses, and transfer only an engine-approved claim.',
					targetIds: [hero.heroId],
					resourceCosts: {},
					tags: ['social', 'communication', 'witness-bounded']
				})
			);
			if (
				state.schemaVersion === 9 ||
				state.schemaVersion === 10 ||
				state.schemaVersion === 11 ||
				state.schemaVersion === 12 ||
				state.schemaVersion === 13 ||
				state.schemaVersion === 16 ||
				state.schemaVersion === 17 ||
				state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20
			) {
				actions.push(
					action({
						actionId: `social.converse.${hero.heroId}`,
						actorId,
						kind: 'interact',
						label: `Have a conversation with ${hero.heroId.slice(0, 8)}`,
						description:
							'Say, ask, or give a bounded order; the hero replies from their own mind and circumstances.',
						targetIds: [hero.heroId],
						resourceCosts: {},
						tags: ['social', 'conversation', 'agency', 'witness-bounded']
					})
				);
			}
		}
	}
	if (
		state.schemaVersion === 10 ||
		state.schemaVersion === 11 ||
		state.schemaVersion === 12 ||
		state.schemaVersion === 13 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20
	) {
		if (
			Object.values(state.heroes).some(
				(hero) => hero.location === state.master.location && heroCanHearCommunication(hero)
			)
		) {
			actions.push(
				action({
					actionId: 'social.directive.issue',
					actorId,
					kind: 'interact',
					label: 'Give a scoped direction',
					description:
						'Record exact words, recipients, witnessed delivery, priorities, and a bounded lifetime.',
					targetIds: [],
					resourceCosts: {},
					tags: ['social', 'directive', 'best-effort', 'witness-bounded']
				})
			);
		}
		for (const directive of Object.values(state.society.directives).filter(
			(candidate) => candidate.status === 'active'
		)) {
			actions.push(
				action({
					actionId: `social.directive.replace.${directive.directiveId}`,
					actorId,
					kind: 'interact',
					label: 'Replace active direction',
					description: 'End this direction and deliver a witnessed replacement atomically.',
					targetIds: directive.recipientIds,
					resourceCosts: {},
					tags: ['social', 'directive', 'replace']
				}),
				action({
					actionId: `social.directive.revoke.${directive.directiveId}`,
					actorId,
					kind: 'interact',
					label: 'Revoke active direction',
					description: 'End this direction without deleting its witnessed history.',
					targetIds: directive.recipientIds,
					resourceCosts: {},
					tags: ['social', 'directive', 'revoke']
				})
			);
		}
	}
	if (hasFirstEmberState(state) && state.settlement.firstEmber.status === 'available') {
		for (const buildingId of ['kitchen', 'dormitory', 'training-ground'] as const) {
			actions.push(
				action({
					actionId: `settlement.first-ember.${buildingId}`,
					actorId,
					kind: 'interact',
					label: `Bind the First Ember to ${buildingId}`,
					description:
						'Make the irreversible facility commitment and record each hero’s immediate response.',
					targetIds: [],
					resourceCosts: {},
					tags: ['settlement', 'first-ember', 'irreversible', buildingId]
				})
			);
		}
	}
	for (const hero of Object.values(state.heroes)) {
		if (hero.lifeState !== 'active') continue;
		actions.push(
			action({
				actionId: `simulation.damage.hero.${hero.heroId}`,
				actorId,
				kind: 'attack',
				label: 'Apply a controlled hero hazard',
				description: 'Development proof for injury, terminal state, and schedule cancellation.',
				targetIds: [hero.heroId],
				resourceCosts: {},
				tags: ['development-proof', 'permadeath']
			})
		);
	}
	actions.push(
		action({
			actionId: 'simulation.damage.master',
			actorId,
			kind: 'attack',
			label: 'Apply a controlled Master hazard',
			description: 'Development proof that Master death atomically ends the run.',
			targetIds: [actorId],
			resourceCosts: {},
			tags: ['development-proof', 'game-over']
		})
	);
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
	if (
		(state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23) &&
		missionPartyIsReserved(state, actorId)
	) {
		return state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14 ||
			state.schemaVersion === 15 ||
			state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23
			? missionTurnActionsForState(state, actorId)
			: [];
	}
	const route = routeActions(state, actorId);
	if (route.length > 0) return route;
	const hero = state.heroes[actorId];
	if (
		!hero ||
		hero.lifeState !== 'active' ||
		hero.currentActivity ||
		currentTravelFor(state, actorId) ||
		currentRoutineFor(state, actorId)
	)
		return [];
	const actions: LegalAction[] = [];
	if (hasRoutineState(state)) {
		const heroV5 = state.heroes[actorId];
		if (!heroV5) return [];
		const currentDay = gameDayIndex(state.simulatedAt);
		const priorPlanComplete =
			heroV5.dailyPlan?.entries.every(
				(entry) => entry.status === 'completed' || entry.status === 'skipped'
			) ?? false;
		if (!heroV5.dailyPlan || (heroV5.dailyPlan.dayIndex < currentDay && priorPlanComplete)) {
			actions.push(
				action({
					actionId: 'hero.plan.day',
					actorId,
					kind: 'wait',
					label: 'Make a daily plan',
					description:
						'Build four deterministic intentions from this hero’s mind, habit, assignment, and needs.',
					targetIds: [],
					resourceCosts: {},
					tags: ['daily-plan', 'habit', 'zero-model-cost']
				})
			);
		}
		if (resolveDailyRoutine(state, actorId)) {
			actions.push(
				action({
					actionId: 'hero.follow.plan',
					actorId,
					kind: 'work',
					label: 'Follow the next routine',
					description:
						'Rank every pending intention and schedule the highest eligible routine with inspectable scores.',
					targetIds: [],
					resourceCosts: {},
					tags: ['daily-plan', 'habit-resolver', 'scheduled-event', 'zero-model-cost']
				})
			);
		}
	}
	const equipped = hero.equipment.mainHand ? state.items[hero.equipment.mainHand] : null;
	if (hero.location === 'training-ground' && equipped && equipped.durability > 0) {
		actions.push(
			action({
				actionId: 'hero.activity.train',
				actorId,
				kind: 'train',
				label: 'Train for 30 minutes',
				description: 'Gain experience and sword skill at a deterministic injury risk.',
				targetIds: [],
				resourceCosts: {},
				tags: ['activity', 'progression', 'injury-risk']
			})
		);
	}
	if (hero.location === 'kitchen' && state.settlement.resources.food > 0) {
		actions.push(
			action({
				actionId: 'hero.activity.eat',
				actorId,
				kind: 'rest',
				label: 'Eat a meal',
				description: 'Reserve one food and reduce hunger after 15 game minutes.',
				targetIds: [],
				resourceCosts: { food: 1 },
				tags: ['activity', 'need']
			})
		);
	}
	if (hero.needs.fatigue > 0 || hero.health < hero.maxHealth || hero.injuries.length > 0) {
		actions.push(
			action({
				actionId: 'hero.activity.rest',
				actorId,
				kind: 'rest',
				label: 'Rest for one hour',
				description: 'Reduce fatigue, heal, and recover one active injury.',
				targetIds: [],
				resourceCosts: {},
				tags: ['activity', 'recovery']
			})
		);
	}
	if (
		hero.location === 'training-ground' &&
		equipped &&
		equipped.durability < equipped.maxDurability &&
		state.settlement.resources['iron-ore'] > 0
	) {
		actions.push(
			action({
				actionId: 'hero.activity.repair',
				actorId,
				kind: 'work',
				label: `Repair ${equipped.displayName}`,
				description: 'Reserve one iron ore and restore durability after 20 game minutes.',
				targetIds: [equipped.itemId],
				resourceCosts: { 'iron-ore': 1 },
				tags: ['activity', 'equipment']
			})
		);
	}
	for (const item of Object.values(state.items)) {
		if (
			item.ownerId === hero.heroId &&
			item.itemId !== hero.equipment.mainHand &&
			item.durability > 0
		) {
			actions.push(
				action({
					actionId: `hero.equip.${item.itemId}`,
					actorId,
					kind: 'interact',
					label: `Equip ${item.displayName}`,
					description: 'Change the authoritative main-hand equipment slot.',
					targetIds: [item.itemId],
					resourceCosts: {},
					tags: ['inventory', 'equipment']
				})
			);
		}
	}
	if (hasNavigationState(state)) {
		actions.push(
			action({
				actionId: 'hero.travel',
				actorId,
				kind: 'move',
				label: 'Travel through Hearth 01',
				description: 'Choose a reachable authored node and schedule its authoritative arrival.',
				targetIds: [],
				resourceCosts: {},
				tags: ['settlement', 'scheduled-event', 'content-bound']
			})
		);
	}
	return actions;
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
	return isModernState(state) ? heroActionsV2(state, actorId) : routeActions(state, actorId);
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
	const expandedTravel = travelActions(state, actorId, targets);
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

function earliestScheduledTime(state: EngineGameStateModern): string | null {
	return (
		[
			...Object.values(state.heroes).flatMap((hero) => [
				hero.currentActivity?.completesAt,
				currentTravelFor(state, hero.heroId)?.arrivesAt,
				currentRoutineFor(state, hero.heroId)?.completesAt
			]),
			...(state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13 ||
			state.schemaVersion === 14
				? Object.values(state.society.directives).map((directive) =>
						directive.status === 'active' ? directive.expiresAt : null
					)
				: [])
		]
			.filter((value): value is string => Boolean(value))
			.sort((left, right) => compareGameTime(left, right))[0] ?? null
	);
}

function requiredAction(command: EngineCommand): string {
	if (command.commandType === 'hero.choose.destination')
		return `hero.choose.${command.destination}`;
	if (command.commandType === 'hero.arrive') return 'hero.arrive.destination';
	if (command.commandType === 'hero.start.travel') return 'hero.travel';
	if (command.commandType === 'settlement.assign.hero')
		return `settlement.assign.${command.heroId}.${command.buildingId}`;
	if (command.commandType === 'settlement.unassign.hero')
		return `settlement.unassign.${command.heroId}`;
	if (command.commandType === 'settlement.allocate.power')
		return `settlement.power.${command.buildingId}`;
	if (command.commandType === 'story.recover.first.ember') return 'story.recover.first-ember';
	if (command.commandType === 'settlement.commit.first.ember')
		return `settlement.first-ember.${command.buildingId}`;
	if (command.commandType === 'master.communicate')
		return `social.communicate.${command.targetHeroId}`;
	if (command.commandType === 'master.converse') return `social.converse.${command.targetHeroId}`;
	if (command.commandType === 'master.issue.directive') return 'social.directive.issue';
	if (command.commandType === 'master.replace.directive')
		return `social.directive.replace.${command.directiveId}`;
	if (command.commandType === 'master.revoke.directive')
		return `social.directive.revoke.${command.directiveId}`;
	if (command.commandType === 'master.configure.timing') return 'master.control.configure';
	if (command.commandType === 'master.configure.fallback') return 'master.fallback.configure';
	if (command.commandType === 'master.apply.safety-stop') return 'master.safety-stop.apply';
	if (command.commandType === 'master.open.decision') return 'master.decision.open';
	if (command.commandType === 'hero.plan.day') return 'hero.plan.day';
	if (command.commandType === 'hero.start.routine') return 'hero.follow.plan';
	if (command.commandType === 'master.inspect.gate') return 'master.inspect.gate';
	if (command.commandType === 'hero.start.activity') return `hero.activity.${command.activity}`;
	if (command.commandType === 'hero.equip.item') return `hero.equip.${command.itemId}`;
	if (command.commandType === 'simulation.advance') return 'simulation.advance';
	if (command.commandType === 'simulation.sync.clock') return 'simulation.sync.clock';
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
	return command.targetId === command.actorId
		? 'simulation.damage.master'
		: `simulation.damage.hero.${command.targetId}`;
}

function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	if (command.commandType === 'settlement.synthesize.hero') {
		if (
			state.schemaVersion !== 22 ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== null ||
			command.source.fallbackPolicy !== null ||
			command.source.decisionJobId !== null ||
			command.sourceHeroId === command.recipientHeroId ||
			state.mission.attempt !== null ||
			!legalActionsForParsedState(state, command.actorId).some(
				(candidate) => candidate.actionId === requiredAction(command)
			)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		for (const heroId of [command.sourceHeroId, command.recipientHeroId]) {
			const hero = state.heroes[heroId];
			if (
				!hero ||
				hero.lifeState !== 'active' ||
				hero.location !== 'summoning-gate' ||
				hero.currentActivity !== null ||
				hero.currentTravel !== null ||
				hero.currentRoutine !== null ||
				hero.assignment !== null
			) {
				throw new IllegalActionError(command.commandType, []);
			}
		}
		return;
	}
	if (command.commandType === 'hero.share.synthesis.rumor') {
		if (
			state.schemaVersion !== 22 ||
			state.status !== 'active' ||
			!['scripted', 'model', 'habit', 'random'].includes(command.source.source) ||
			command.source.timing !== null ||
			!legalActionsForParsedState(state, command.actorId).some(
				(candidate) => candidate.actionId === requiredAction(command)
			)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (command.commandType === 'story.reveal.first.archive') {
		if (
			state.schemaVersion !== 23 ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step' ||
			state.firstBandArchive.status !== 'recovered' ||
			!state.firstBandArchive.recovery?.survivingHeroIds.includes(command.readerHeroId) ||
			state.heroes[command.readerHeroId]?.lifeState !== 'active' ||
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
	if (command.commandType === 'story.recover.first.ember') {
		if (
			!hasFirstEmberState(state) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'system' ||
			command.source.timing !== null ||
			state.settlement.firstEmber.status !== 'unrecovered'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (command.commandType === 'simulation.sync.clock') {
		const earliest = state.schemaVersion === 1 ? null : earliestScheduledTime(state);
		const minutes = gameMinutesBetween(state.simulatedAt, command.targetGameTime);
		if (
			!hasRoutineState(state) ||
			state.status !== 'active' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'system' ||
			command.source.timing !== null ||
			minutes <= 0 ||
			minutes > 7 * 24 * 60 ||
			(earliest !== null && compareGameTime(command.targetGameTime, earliest) >= 0)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		return;
	}
	if (command.commandType === 'master.communicate') {
		const compatible =
			(command.kind === 'ask' && command.topic === 'hero-memory') ||
			(command.kind !== 'ask' && command.topic !== 'hero-memory');
		if (
			(state.schemaVersion !== 8 &&
				state.schemaVersion !== 9 &&
				state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step' ||
			!compatible
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		const target = state.heroes[command.targetHeroId];
		if (
			!target ||
			target.location !== state.master.location ||
			!heroCanHearCommunication(target) ||
			Object.keys(state.society.communicativeActs).length >= 2_048
		) {
			throw new IllegalActionError(command.commandType, []);
		}
	}
	if (command.commandType === 'master.converse') {
		if (
			(state.schemaVersion !== 9 &&
				state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		const target = state.heroes[command.targetHeroId];
		if (
			!target ||
			target.location !== state.master.location ||
			!heroCanHearCommunication(target) ||
			Object.keys(state.society.conversationTurns).length >= 2_048 ||
			Object.keys(state.society.communicativeActs).length >= 2_048
		) {
			throw new IllegalActionError(command.commandType, []);
		}
	}
	if (
		command.commandType === 'master.issue.directive' ||
		command.commandType === 'master.replace.directive' ||
		command.commandType === 'master.revoke.directive'
	) {
		if (
			(state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 14 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== 'step'
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		if (command.commandType !== 'master.revoke.directive') {
			const recipients = new Set(command.recipientIds);
			if (
				recipients.size !== command.recipientIds.length ||
				command.recipientIds.some((heroId) => {
					const hero = state.heroes[heroId];
					return (
						!hero || hero.location !== state.master.location || !heroCanHearCommunication(hero)
					);
				}) ||
				Object.keys(state.society.directives).length >= 2_048 ||
				Object.keys(state.society.communicativeActs).length >= 2_048
			) {
				throw new IllegalActionError(command.commandType, []);
			}
		}
		if (command.commandType !== 'master.issue.directive') {
			const previous = state.society.directives[command.directiveId];
			if (!previous || previous.status !== 'active') {
				throw new IllegalActionError(command.commandType, []);
			}
		}
	}
	if (command.commandType === 'story.apply.patch') {
		if (
			state.schemaVersion !== 21 ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			!['manual', 'scripted', 'model'].includes(command.source.source) ||
			command.source.fallbackPolicy !== null ||
			command.source.decisionJobId !== null ||
			state.bandStory.appliedPatches.length !== 0 ||
			!validateStoryPatchForState(state, command.candidate).accepted
		) {
			throw new IllegalActionError(command.commandType, []);
		}
	}
	const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
	const required = requiredAction(command);
	if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
	if (command.commandType === 'hero.choose.destination') {
		const branch = command.destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust';
		if (command.storyBranch !== branch) throw new IllegalActionError(required, actionIds);
	}
	if (command.commandType === 'simulation.advance') {
		if (state.schemaVersion === 1) throw new IllegalActionError(required, actionIds);
		const earliest = earliestScheduledTime(state);
		if (!earliest || compareGameTime(command.targetGameTime, earliest) < 0) {
			throw new IllegalActionError(required, actionIds);
		}
		const minutes = gameMinutesBetween(state.simulatedAt, command.targetGameTime);
		if (minutes <= 0 || minutes > 7 * 24 * 60) throw new IllegalActionError(required, actionIds);
	}
	if (command.commandType === 'hero.start.travel') {
		if (!hasNavigationState(state)) throw new IllegalActionError(required, actionIds);
		const hero = state.heroes[command.actorId];
		if (!hero || hero.locationNodeId === command.targetNodeId)
			throw new IllegalActionError(required, actionIds);
		const route = planSettlementRoute(
			settlementForState(state),
			hero.locationNodeId,
			command.targetNodeId,
			new Set(state.settlement.navigation.activeSystemIds)
		);
		if (!route || route.totalTravelGameSeconds <= 0)
			throw new IllegalActionError(required, actionIds);
		if (hasFacilityState(state)) {
			const definition = settlementForState(state);
			const targetNode = definition.nodes.find((node) => node.nodeId === command.targetNodeId);
			const nodeReservations = Object.values(state.heroes).filter(
				(candidate) =>
					candidate.heroId !== hero.heroId &&
					(candidate.locationNodeId === command.targetNodeId ||
						candidate.currentTravel?.toNodeId === command.targetNodeId)
			).length;
			if (!targetNode || nodeReservations >= targetNode.capacity) {
				throw new IllegalActionError(required, actionIds);
			}
			for (const step of route.steps) {
				const edge = definition.edges.find((candidate) => candidate.edgeId === step.edgeId);
				const reservations = Object.values(state.heroes).filter((candidate) =>
					candidate.currentTravel?.route.steps.some(
						(candidateStep) => candidateStep.edgeId === step.edgeId
					)
				).length;
				if (!edge || reservations >= edge.capacity) {
					throw new IllegalActionError(required, actionIds);
				}
			}
		}
		if (
			!hero.firstArrivalCompleted &&
			(!hero.destination ||
				command.targetNodeId !== destinationNodeId(settlementForState(state), hero.destination))
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.assign.hero') {
		if (!hasFacilityState(state)) throw new IllegalActionError(required, actionIds);
		const hero = state.heroes[command.heroId];
		const building = state.settlement.buildings[command.buildingId];
		if (
			!hero ||
			hero.lifeState !== 'active' ||
			!building ||
			building.assignmentRole !== command.role ||
			building.assignedHeroIds.length >= building.assignmentCapacity
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.unassign.hero') {
		if (!hasFacilityState(state) || !state.heroes[command.heroId]?.assignment) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.allocate.power') {
		if (
			!hasFacilityState(state) ||
			command.buildingId === 'summoning-gate' ||
			!state.settlement.buildings[command.buildingId]
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'settlement.commit.first.ember') {
		if (
			!hasFirstEmberState(state) ||
			state.settlement.firstEmber.status !== 'available' ||
			!['kitchen', 'dormitory', 'training-ground'].includes(command.buildingId)
		) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.plan.day') {
		if (!hasRoutineState(state)) throw new IllegalActionError(required, actionIds);
		const hero = state.heroes[command.actorId];
		if (!hero || hero.currentRoutine || hero.currentActivity || hero.currentTravel) {
			throw new IllegalActionError(required, actionIds);
		}
	}
	if (command.commandType === 'hero.start.routine') {
		if (!hasRoutineState(state) || !resolveDailyRoutine(state, command.actorId)) {
			throw new IllegalActionError(required, actionIds);
		}
	}
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
		if (command.commandType === 'mission.deploy') deployMissionAttempt(state);
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
		if (command.commandType === 'mission.retreat') retreatMissionAttempt(state);
	}
}

function buildLegacyEvent(state: EngineGameStateV1, command: EngineCommand): AuthoritativeEvent {
	if (command.commandType === 'hero.choose.destination') {
		const base = eventBase(state, command, 'hero.destination.selected');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: command.destination,
				firstLine: command.firstLine,
				storyBranch: command.storyBranch,
				nextVersion: state.version + 1,
				entropyDraws: []
			}
		});
	}
	if (command.commandType === 'hero.arrive') {
		const hero = state.heroes[command.actorId];
		if (!hero?.destination) throw new IllegalActionError('hero.arrive.destination');
		const base = eventBase(state, command, 'hero.arrived');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: hero.destination,
				nextVersion: state.version + 1,
				entropyDraws: []
			}
		});
	}
	if (command.commandType !== 'master.inspect.gate') {
		throw new IllegalActionError(command.commandType);
	}
	const entropy = drawInteger(
		createEntropyCursor(state.seed, state.entropyCursor),
		'gate.resonance',
		0,
		99
	);
	const base = eventBase(state, command, 'master.gate.inspected');
	return AuthoritativeEventSchema.parse({
		...base,
		seedCursor: entropy.next.cursor,
		payload: {
			masterId: command.actorId,
			resonance: entropy.draw.value,
			nextVersion: state.version + 1,
			entropyDraws: [entropy.draw]
		}
	});
}

function resourceChange(
	state: EngineGameStateModern,
	resource: 'food' | 'iron-ore',
	reason: string
) {
	const before = state.settlement.resources[resource];
	return { resource, before, after: before - 1, delta: -1, reason };
}

function activityDuration(activity: ActivityKind): number {
	return { train: 30, eat: 15, rest: 60, repair: 20 }[activity];
}

function levelFor(experience: number, stars: number): number {
	return Math.min(stars * 10, 1 + Math.floor(experience / 10));
}

function buildActivityOutcome(
	state: EngineGameStateModern,
	heroId: string,
	eventId: string,
	entropyCursor: { seed: string; cursor: number }
): {
	outcome: z.infer<typeof ActivityOutcomeSchema>;
	entropy: typeof entropyCursor;
	draws: EntropyDraw[];
} {
	const hero = state.heroes[heroId];
	const activity = hero?.currentActivity;
	if (!hero || !activity) throw new Error('Cannot resolve a missing activity');
	let healthAfter = hero.health;
	let lifeStateAfter = hero.lifeState;
	let needsAfter = { ...hero.needs };
	let injuriesAfter = [...hero.injuries];
	let progressionAfter = structuredClone(hero.progression);
	let itemUpdate: z.infer<typeof ItemUpdateSchema> | null = null;
	let nextEntropy = entropyCursor;
	const draws: EntropyDraw[] = [];
	const deltas: RewardDelta[] = [];

	if (activity.kind === 'train') {
		const experienceBonus = firstEmberModifier(state, 'hero-experience');
		const skillBonus = firstEmberModifier(state, 'sword-experience');
		const experienceBefore = hero.progression.experience;
		const levelBefore = hero.progression.level;
		const skillBefore = hero.progression.skills.swordFighting.experience;
		const skillAfter = skillBefore + 6 + skillBonus;
		const experienceAfter = experienceBefore + 8 + experienceBonus;
		progressionAfter = {
			...hero.progression,
			experience: experienceAfter,
			level: levelFor(experienceAfter, hero.progression.stars),
			skills: {
				swordFighting: {
					experience: skillAfter,
					rank: Math.min(20, Math.floor(skillAfter / 5))
				}
			}
		};
		needsAfter = {
			hunger: clamp(hero.needs.hunger + 10),
			fatigue: clamp(hero.needs.fatigue + 15)
		};
		deltas.push(
			{
				ownerId: heroId,
				kind: 'experience',
				key: 'hero',
				before: experienceBefore,
				after: experienceAfter,
				delta: 8 + experienceBonus
			},
			{
				ownerId: heroId,
				kind: 'skill',
				key: 'sword-fighting',
				before: skillBefore,
				after: skillAfter,
				delta: 6 + skillBonus
			},
			{
				ownerId: heroId,
				kind: 'need',
				key: 'hunger',
				before: hero.needs.hunger,
				after: needsAfter.hunger,
				delta: needsAfter.hunger - hero.needs.hunger
			},
			{
				ownerId: heroId,
				kind: 'need',
				key: 'fatigue',
				before: hero.needs.fatigue,
				after: needsAfter.fatigue,
				delta: needsAfter.fatigue - hero.needs.fatigue
			}
		);
		if (progressionAfter.level !== levelBefore) {
			deltas.push({
				ownerId: heroId,
				kind: 'level',
				key: 'hero',
				before: levelBefore,
				after: progressionAfter.level,
				delta: progressionAfter.level - levelBefore
			});
		}
		const itemId = hero.equipment.mainHand;
		const item = itemId ? state.items[itemId] : null;
		if (item) {
			const durabilityAfter = Math.max(0, item.durability - 1);
			itemUpdate = { itemId: item.itemId, durabilityAfter };
			deltas.push({
				ownerId: heroId,
				kind: 'durability',
				key: item.templateId,
				before: item.durability,
				after: durabilityAfter,
				delta: durabilityAfter - item.durability
			});
		}
		const injuryDraw = drawInteger(
			createEntropyCursor(nextEntropy.seed, nextEntropy.cursor),
			`activity.train.injury.${heroId.replaceAll('-', '')}`,
			0,
			99
		);
		nextEntropy = injuryDraw.next;
		draws.push(injuryDraw.draw);
		const injuryThreshold = 15 + firstEmberModifier(state, 'training-injury-threshold');
		if (injuryDraw.draw.value < injuryThreshold) {
			healthAfter = Math.max(0, hero.health - 10);
			lifeStateAfter = healthAfter === 0 ? 'dead' : 'active';
			if (healthAfter > 0) {
				injuriesAfter.push({
					injuryId: deterministicUuid(`${eventId}:${heroId}:training-strain`),
					kind: 'strain',
					severity: 10,
					inflictedAt: activity.completesAt
				});
			}
			deltas.push({
				ownerId: heroId,
				kind: 'health',
				key: 'body',
				before: hero.health,
				after: healthAfter,
				delta: healthAfter - hero.health
			});
		}
	}

	if (activity.kind === 'eat') {
		const recovery = 45 + firstEmberModifier(state, 'hunger-recovery');
		needsAfter = { ...hero.needs, hunger: Math.max(0, hero.needs.hunger - recovery) };
		deltas.push({
			ownerId: heroId,
			kind: 'need',
			key: 'hunger',
			before: hero.needs.hunger,
			after: needsAfter.hunger,
			delta: needsAfter.hunger - hero.needs.hunger
		});
	}

	if (activity.kind === 'rest') {
		const fatigueRecovery = 50 + firstEmberModifier(state, 'fatigue-recovery');
		const healthRecovery = 10 + firstEmberModifier(state, 'health-recovery');
		needsAfter = { ...hero.needs, fatigue: Math.max(0, hero.needs.fatigue - fatigueRecovery) };
		healthAfter = Math.min(hero.maxHealth, hero.health + healthRecovery);
		injuriesAfter = hero.injuries.slice(1);
		deltas.push({
			ownerId: heroId,
			kind: 'need',
			key: 'fatigue',
			before: hero.needs.fatigue,
			after: needsAfter.fatigue,
			delta: needsAfter.fatigue - hero.needs.fatigue
		});
		if (healthAfter !== hero.health) {
			deltas.push({
				ownerId: heroId,
				kind: 'health',
				key: 'body',
				before: hero.health,
				after: healthAfter,
				delta: healthAfter - hero.health
			});
		}
	}

	if (activity.kind === 'repair') {
		const itemId = hero.equipment.mainHand;
		const item = itemId ? state.items[itemId] : null;
		if (!item) throw new Error('Repair activity lost its equipment target');
		const durabilityAfter = Math.min(item.maxDurability, item.durability + 3);
		itemUpdate = { itemId: item.itemId, durabilityAfter };
		deltas.push({
			ownerId: heroId,
			kind: 'durability',
			key: item.templateId,
			before: item.durability,
			after: durabilityAfter,
			delta: durabilityAfter - item.durability
		});
	}

	return {
		outcome: ActivityOutcomeSchema.parse({
			scheduledEventId: activity.scheduledEventId,
			heroId,
			activity: activity.kind,
			healthAfter,
			lifeStateAfter,
			needsAfter,
			injuriesAfter,
			progressionAfter,
			itemUpdate,
			rewardDeltas: deltas
		}),
		entropy: nextEntropy,
		draws
	};
}

function buildRoutineOutcome(state: EngineRoutineState, heroId: string) {
	const hero = state.heroes[heroId];
	const routine = hero?.currentRoutine;
	if (!hero || !routine) throw new Error('Cannot resolve a missing routine');
	let needsAfter = { ...hero.needs };
	let healthAfter = hero.health;
	let habitAfter = { ...hero.habit };
	const rewardDeltas: RewardDelta[] = [];
	const changeNeed = (key: 'hunger' | 'fatigue', after: number) => {
		after = clamp(after);
		rewardDeltas.push({
			ownerId: heroId,
			kind: 'need',
			key,
			before: hero.needs[key],
			after,
			delta: after - hero.needs[key]
		});
		needsAfter = { ...needsAfter, [key]: after };
	};

	if (routine.kind === hero.habit.habit) {
		changeNeed('hunger', hero.needs.hunger + 3);
		changeNeed('fatigue', hero.needs.fatigue + 3);
		const strength = clamp(hero.habit.strength + 1);
		const satisfaction = clamp(hero.habit.satisfaction + 8);
		rewardDeltas.push(
			{
				ownerId: heroId,
				kind: 'habit',
				key: 'strength',
				before: hero.habit.strength,
				after: strength,
				delta: strength - hero.habit.strength
			},
			{
				ownerId: heroId,
				kind: 'habit',
				key: 'satisfaction',
				before: hero.habit.satisfaction,
				after: satisfaction,
				delta: satisfaction - hero.habit.satisfaction
			}
		);
		habitAfter = {
			...hero.habit,
			strength,
			satisfaction,
			repetitions: hero.habit.repetitions + 1,
			lastTriggeredAt: routine.completesAt
		};
	}
	if (routine.kind === 'assigned-duty') {
		changeNeed('hunger', hero.needs.hunger + 8);
		changeNeed('fatigue', hero.needs.fatigue + 10);
	}
	if (routine.kind === 'self-directed') {
		changeNeed('hunger', hero.needs.hunger + 5);
		changeNeed('fatigue', hero.needs.fatigue + 7);
	}
	if (routine.kind === 'meal') {
		changeNeed('hunger', hero.needs.hunger - 45 - firstEmberModifier(state, 'hunger-recovery'));
	}
	if (routine.kind === 'sleep') {
		changeNeed('fatigue', hero.needs.fatigue - 55 - firstEmberModifier(state, 'fatigue-recovery'));
		healthAfter = Math.min(
			hero.maxHealth,
			hero.health + 8 + firstEmberModifier(state, 'health-recovery')
		);
		if (healthAfter !== hero.health) {
			rewardDeltas.push({
				ownerId: heroId,
				kind: 'health',
				key: 'body',
				before: hero.health,
				after: healthAfter,
				delta: healthAfter - hero.health
			});
		}
	}

	return RoutineOutcomeSchema.parse({
		scheduledEventId: routine.scheduledEventId,
		heroId,
		planId: routine.planId,
		planEntryId: routine.planEntryId,
		kind: routine.kind,
		needsAfter,
		healthAfter,
		habitAfter,
		rewardDeltas
	});
}

function skipUnfinishedPlan(hero: EngineRoutineState['heroes'][string], resolvedAt: string) {
	if (!hero.dailyPlan) return null;
	return DailyPlanSchema.parse({
		...hero.dailyPlan,
		entries: hero.dailyPlan.entries.map((entry) =>
			entry.status === 'pending' || entry.status === 'active'
				? { ...entry, status: 'skipped', completedAt: resolvedAt }
				: entry
		)
	});
}

type SynthesizeHeroCommand = Extract<EngineCommand, { commandType: 'settlement.synthesize.hero' }>;
type ShareSynthesisRumorCommand = Extract<
	EngineCommand,
	{ commandType: 'hero.share.synthesis.rumor' }
>;

function synthesisRelationshipDeltas(
	hero: EngineGameStateV22['heroes'][string],
	knowledge: 'participant' | 'witness' | 'absence'
) {
	const conscience = Math.round((hero.mind.personality.agreeableness - 50) / 20);
	if (knowledge === 'participant') {
		return {
			trust: -4 - Math.max(0, conscience),
			respect: 2,
			fear: 7,
			affection: 0,
			resentment: 7 + Math.max(0, conscience),
			debt: 12
		};
	}
	if (knowledge === 'witness') {
		return {
			trust: -10 - Math.max(0, conscience),
			respect: -4,
			fear: 14,
			affection: -2,
			resentment: 12 + Math.max(0, conscience),
			debt: 0
		};
	}
	return {
		trust: -3,
		respect: -1,
		fear: 3,
		affection: 0,
		resentment: 2,
		debt: 0
	};
}

function rumorRelationshipDeltas() {
	return { trust: -6, respect: -2, fear: 8, affection: 0, resentment: 7, debt: 0 };
}

function withSynthesisRelationshipEvidence(
	state: EngineGameStateV22,
	society: SocietyStateV5,
	heroId: string,
	eventId: string,
	observationId: string,
	summary: string,
	deltas: ReturnType<typeof synthesisRelationshipDeltas>
): SocietyStateV5['relationships'][string] {
	const relationshipId = deterministicUuid(`${heroId}:${state.master.masterId}:relationship`);
	const previous = society.relationships[relationshipId];
	if (!previous) throw new ReplayIntegrityError('Missing Master relationship', state.eventCursor);
	return {
		...previous,
		dimensions: Object.fromEntries(
			Object.entries(previous.dimensions).map(([key, value]) => [
				key,
				clampSocial(value + deltas[key as keyof typeof deltas])
			])
		) as typeof previous.dimensions,
		updatedAt: state.simulatedAt,
		lastSourceEventId: eventId,
		evidence: [
			...previous.evidence,
			{ sourceEventId: eventId, observationId, summary, deltas }
		].slice(-64)
	};
}

function synthesisEssenceExperience(hero: EngineGameStateV22['heroes'][string]): number {
	return 20 + hero.progression.stars * 15 + hero.progression.level * 5;
}

function resolveSynthesis(
	state: EngineGameStateV22,
	command: SynthesizeHeroCommand,
	eventId: string,
	eventSequence: number
): {
	readonly state: EngineGameStateV22;
	readonly receipt: SynthesisReceipt;
	readonly canceledScheduledEventIds: readonly string[];
	readonly rewardDeltas: readonly RewardDelta[];
} {
	const source = state.heroes[command.sourceHeroId];
	const recipient = state.heroes[command.recipientHeroId];
	if (!source || !recipient) throw new IllegalActionError(command.commandType);
	const receiptId = deterministicUuid(`${eventId}:synthesis-receipt`);
	const essenceExperience = synthesisEssenceExperience(source);
	const recipientExperience = recipient.progression.experience + essenceExperience;
	const recipientProgression = HeroProgressionSchema.parse({
		...recipient.progression,
		experience: recipientExperience,
		level: levelFor(recipientExperience, recipient.progression.stars)
	});
	const observations = { ...state.society.observations };
	const beliefs = { ...state.society.beliefs };
	const relationships = { ...state.society.relationships };
	const consequences = Object.values(state.heroes)
		.filter((hero) => hero.lifeState === 'active' && hero.heroId !== source.heroId)
		.sort((left, right) => left.heroId.localeCompare(right.heroId))
		.map((hero) => {
			const knowledge =
				hero.heroId === recipient.heroId
					? ('participant' as const)
					: command.visibility === 'open' &&
						  hero.location === source.location &&
						  hero.locationNodeId === source.locationNodeId &&
						  heroCanHearCommunication(hero)
						? ('witness' as const)
						: ('absence' as const);
			const observationId = deterministicUuid(`${receiptId}:${hero.heroId}:observation`);
			const beliefId = deterministicUuid(`${observationId}:belief`);
			const relationshipId = deterministicUuid(
				`${hero.heroId}:${state.master.masterId}:relationship`
			);
			const direct = knowledge !== 'absence';
			const summary = direct
				? knowledge === 'participant'
					? `I received ${source.heroId}'s bounded synthesis essence after the Master confirmed the irreversible act.`
					: `I witnessed the Master synthesize ${source.heroId} into ${recipient.heroId}.`
				: `${source.heroId} entered the summoning chamber and did not return; I do not know what happened inside.`;
			observations[observationId] = {
				observationId,
				sourceEventId: eventId,
				observerHeroId: hero.heroId,
				observedAt: state.simulatedAt,
				kind: direct ? 'synthesis-direct' : 'synthesis-absence',
				synthesisReceiptId: receiptId,
				summary,
				subjectIds: direct
					? [source.heroId, recipient.heroId, state.master.masterId]
					: [source.heroId, state.master.masterId]
			};
			beliefs[beliefId] = {
				beliefId,
				holderHeroId: hero.heroId,
				subjectId: source.heroId,
				predicate: direct ? 'was-synthesized-into' : 'is-missing-after-gate-call',
				object: direct
					? { kind: 'entity', entityId: recipient.heroId }
					: { kind: 'text', text: 'Did not return from a private summoning-gate audience.' },
				confidence: direct ? 100 : 35,
				status: 'held',
				learnedAt: state.simulatedAt,
				provenance: {
					kind: direct ? 'observed' : 'inferred',
					sourceEventId: eventId,
					observationId,
					learnedFromId: null,
					chainDepth: 0
				}
			};
			const relationshipDeltas = synthesisRelationshipDeltas(hero, knowledge);
			relationships[relationshipId] = withSynthesisRelationshipEvidence(
				state,
				{ ...state.society, observations, beliefs, relationships },
				hero.heroId,
				eventId,
				observationId,
				summary,
				relationshipDeltas
			);
			return {
				heroId: hero.heroId,
				knowledge,
				observationId,
				beliefId,
				relationshipId,
				confidence: direct ? 100 : 35,
				relationshipDeltas
			};
		});
	const receipt = SynthesisReceiptSchema.parse({
		receiptVersion: 'synthesis-receipt-v1',
		receiptId,
		sourceEventId: eventId,
		masterId: state.master.masterId,
		sourceHeroId: source.heroId,
		recipientHeroId: recipient.heroId,
		visibility: command.visibility,
		warningVersion: command.warningVersion,
		confirmedIrreversible: command.confirmedIrreversible,
		rationale: command.rationale,
		committedAt: state.simulatedAt,
		essenceExperience,
		sourceProgression: source.progression,
		recipientProgressionBefore: recipient.progression,
		recipientProgressionAfter: recipientProgression,
		socialConsequences: consequences
	});
	const canceledScheduledEventIds = [
		source.currentActivity?.scheduledEventId,
		source.currentTravel?.scheduledEventId,
		source.currentRoutine?.scheduledEventId
	].filter((id): id is string => Boolean(id));
	const sourceHero = {
		...source,
		lifeState: 'synthesized' as const,
		health: 0,
		destination: null,
		equipment: { mainHand: null },
		currentActivity: null,
		currentTravel: null,
		assignment: null,
		currentRoutine: null,
		dailyPlan: skipUnfinishedPlan(source, state.simulatedAt)
	};
	const settlement = source.assignment
		? clearBuildingAssignment(state.settlement, source.heroId, source.assignment.buildingId)
		: state.settlement;
	const items = Object.fromEntries(
		Object.entries(state.items).map(([itemId, item]) => [
			itemId,
			item.ownerId === source.heroId
				? { ...item, ownerId: state.master.masterId, equippedById: null }
				: item
		])
	);
	const nextSociety = SocietyStateV5Schema.parse({
		...state.society,
		observations,
		beliefs,
		relationships
	});
	const nextSynthesis = SynthesisStateSchema.parse({
		...state.synthesis,
		receipts: { ...state.synthesis.receipts, [receiptId]: receipt }
	});
	const nextState = EngineGameStateV22Schema.parse({
		...state,
		version: state.version + 1,
		eventCursor: eventSequence,
		heroes: {
			...state.heroes,
			[source.heroId]: sourceHero,
			[recipient.heroId]: { ...recipient, progression: recipientProgression }
		},
		items,
		settlement,
		society: nextSociety,
		synthesis: nextSynthesis
	});
	const rewardDeltas: RewardDelta[] = [
		{
			ownerId: recipient.heroId,
			kind: 'experience',
			key: 'hero',
			before: recipient.progression.experience,
			after: recipientProgression.experience,
			delta: recipientProgression.experience - recipient.progression.experience
		},
		...(recipientProgression.level === recipient.progression.level
			? []
			: [
					{
						ownerId: recipient.heroId,
						kind: 'level' as const,
						key: 'hero',
						before: recipient.progression.level,
						after: recipientProgression.level,
						delta: recipientProgression.level - recipient.progression.level
					}
				]),
		...consequences.flatMap((consequence) =>
			Object.entries(consequence.relationshipDeltas)
				.filter(([, delta]) => delta !== 0)
				.map(([key]) => {
					const before =
						state.society.relationships[consequence.relationshipId]!.dimensions[
							key as keyof typeof consequence.relationshipDeltas
						];
					const after =
						nextSociety.relationships[consequence.relationshipId]!.dimensions[
							key as keyof typeof consequence.relationshipDeltas
						];
					return {
						ownerId: consequence.heroId,
						kind: 'relationship' as const,
						key,
						before,
						after,
						delta: after - before
					};
				})
		)
	];
	return { state: nextState, receipt, canceledScheduledEventIds, rewardDeltas };
}

function resolveSynthesisRumor(
	state: EngineGameStateV22,
	command: ShareSynthesisRumorCommand,
	eventId: string,
	eventSequence: number
): {
	readonly state: EngineGameStateV22;
	readonly rumor: SynthesisRumorRecord;
	readonly rewardDeltas: readonly RewardDelta[];
} {
	const receipt = state.synthesis.receipts[command.receiptId];
	const speaker = state.heroes[command.actorId];
	const listener = state.heroes[command.targetHeroId];
	if (!receipt || !speaker || !listener) throw new IllegalActionError(command.commandType);
	const sourceConsequence = receipt.socialConsequences.find(
		(consequence) => consequence.heroId === speaker.heroId && consequence.knowledge !== 'absence'
	);
	const priorRumor = Object.values(state.synthesis.rumors).find(
		(candidate) =>
			candidate.receiptId === receipt.receiptId && candidate.listenerHeroId === speaker.heroId
	);
	const originObservationId = sourceConsequence?.observationId ?? priorRumor?.originObservationId;
	const originBeliefId = sourceConsequence?.beliefId ?? priorRumor?.beliefId;
	const originBelief = originBeliefId ? state.society.beliefs[originBeliefId] : null;
	if (!originObservationId || !originBelief) throw new IllegalActionError(command.commandType);
	const chainDepth = originBelief.provenance.chainDepth + 1;
	const confidence = Math.max(45, originBelief.confidence - 15);
	const rumorId = deterministicUuid(`${eventId}:synthesis-rumor`);
	const observationId = deterministicUuid(`${rumorId}:${listener.heroId}:observation`);
	const beliefId = deterministicUuid(`${observationId}:belief`);
	const relationshipId = deterministicUuid(
		`${listener.heroId}:${state.master.masterId}:relationship`
	);
	const summary = `${speaker.heroId} told me the Master synthesized ${receipt.sourceHeroId} into ${receipt.recipientHeroId}.`;
	const observations = {
		...state.society.observations,
		[observationId]: {
			observationId,
			sourceEventId: eventId,
			observerHeroId: listener.heroId,
			observedAt: state.simulatedAt,
			kind: 'synthesis-rumor' as const,
			synthesisReceiptId: receipt.receiptId,
			summary,
			subjectIds: [...new Set([receipt.sourceHeroId, receipt.recipientHeroId, speaker.heroId])]
		}
	};
	const beliefs = {
		...state.society.beliefs,
		[beliefId]: {
			beliefId,
			holderHeroId: listener.heroId,
			subjectId: receipt.sourceHeroId,
			predicate: 'was-synthesized-into' as const,
			object: { kind: 'entity' as const, entityId: receipt.recipientHeroId },
			confidence,
			status: 'held' as const,
			learnedAt: state.simulatedAt,
			provenance: {
				kind: 'told' as const,
				sourceEventId: eventId,
				observationId,
				learnedFromId: speaker.heroId,
				chainDepth
			}
		}
	};
	const relationshipDeltas = rumorRelationshipDeltas();
	const relationship = withSynthesisRelationshipEvidence(
		state,
		{ ...state.society, observations, beliefs },
		listener.heroId,
		eventId,
		observationId,
		summary,
		relationshipDeltas
	);
	const society = SocietyStateV5Schema.parse({
		...state.society,
		observations,
		beliefs,
		relationships: { ...state.society.relationships, [relationshipId]: relationship }
	});
	const rumor = SynthesisRumorRecordSchema.parse({
		rumorVersion: 'synthesis-rumor-v1',
		rumorId,
		receiptId: receipt.receiptId,
		sourceEventId: eventId,
		originObservationId,
		speakerHeroId: speaker.heroId,
		listenerHeroId: listener.heroId,
		observationId,
		beliefId,
		relationshipId,
		confidence,
		chainDepth,
		relationshipDeltas,
		sharedAt: state.simulatedAt
	});
	const nextState = EngineGameStateV22Schema.parse({
		...state,
		version: state.version + 1,
		eventCursor: eventSequence,
		society,
		synthesis: {
			...state.synthesis,
			rumors: { ...state.synthesis.rumors, [rumorId]: rumor }
		}
	});
	const rewardDeltas = Object.entries(relationshipDeltas).map(([key]) => {
		const before =
			state.society.relationships[relationshipId]!.dimensions[
				key as keyof typeof relationshipDeltas
			];
		const after = relationship.dimensions[key as keyof typeof relationshipDeltas];
		return {
			ownerId: listener.heroId,
			kind: 'relationship' as const,
			key,
			before,
			after,
			delta: after - before
		};
	});
	return { state: nextState, rumor, rewardDeltas };
}

function buildV2Event(state: EngineGameStateModern, command: EngineCommand): AuthoritativeEvent {
	if (command.commandType === 'settlement.synthesize.hero') {
		if (state.schemaVersion !== 22) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.synthesized');
		const resolved = resolveSynthesis(state, command, base.eventId, base.sequence);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				receipt: resolved.receipt,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The Master irreversibly synthesized ${command.sourceHeroId} into ${command.recipientHeroId}; knowledge remained witness-bounded.`,
					resolved.rewardDeltas
				),
				canceledScheduledEventIds: resolved.canceledScheduledEventIds
			}
		});
	}
	if (command.commandType === 'hero.share.synthesis.rumor') {
		if (state.schemaVersion !== 22) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'social.synthesis.rumor.shared');
		const resolved = resolveSynthesisRumor(state, command, base.eventId, base.sequence);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				rumor: resolved.rumor,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`${command.actorId} told ${command.targetHeroId} what happened in the synthesis chamber; the claim retained its source and confidence.`,
					resolved.rewardDeltas
				)
			}
		});
	}
	if (command.commandType === 'story.apply.patch') {
		if (state.schemaVersion !== 21) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'story.patch.applied');
		const applied = applyValidatedStoryPatch(
			verifiedStoryEnvelope(),
			state.bandStory.history,
			storyPatchCastForState(state),
			command.candidate,
			base.eventId,
			state.simulatedAt
		);
		const bandStory = RuntimeBandStoryStateSchema.parse({
			...state.bandStory,
			history: applied.history,
			appliedPatches: [...state.bandStory.appliedPatches, applied.patch]
		});
		const selected = command.candidate.selectedProposalIds.join(', ');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				candidate: command.candidate,
				validation: applied.patch.validation,
				patch: applied.patch,
				bandStory,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The runtime director committed ${selected} at ${command.candidate.slotId}; every fixed story boundary remained intact.`
				)
			}
		});
	}
	if (command.commandType === 'story.reveal.first.archive') {
		if (state.schemaVersion !== 23) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'story.first.archive.revealed');
		const resolved = revealFirstBandArchive(state, command.readerHeroId, base.eventId);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				reveal: resolved.reveal,
				firstBandArchive: resolved.archive,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`${resolved.reveal.expression.speakerName} opened the recovered fragment: ${FIRST_BAND_ARCHIVE_MESSAGE}`
				)
			}
		});
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
			const deployment = deployMissionAttempt(state);
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
			mission = retreatMissionAttempt(state);
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
	if (command.commandType === 'story.recover.first.ember') {
		if (!hasFirstEmberState(state)) throw new IllegalActionError(command.commandType);
		const firstEmber = FirstEmberStateSchema.parse({
			...state.settlement.firstEmber,
			status: 'available',
			recoveredFrom: 'tower-floor-01',
			recoveredAt: state.simulatedAt
		});
		const base = eventBase(state, command, 'story.first.ember.recovered');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				firstEmber,
				nextVersion: state.version + 1,
				...emptyMetadata(
					'The party returned the First Ember from Floor 01. One permanent facility commitment is now available.'
				)
			}
		});
	}
	if (command.commandType === 'settlement.commit.first.ember') {
		if (!hasFirstEmberState(state)) throw new IllegalActionError(command.commandType);
		const target = state.settlement.buildings[command.buildingId];
		if (!target || state.settlement.firstEmber.status !== 'available') {
			throw new IllegalActionError(command.commandType);
		}
		const reactions = Object.values(state.heroes)
			.filter((hero) => hero.lifeState === 'active')
			.sort((left, right) => left.heroId.localeCompare(right.heroId))
			.map((hero) => buildFirstEmberReaction(hero, command.buildingId, command.rationale));
		const firstEmber = FirstEmberStateSchema.parse({
			...state.settlement.firstEmber,
			status: 'committed',
			committedAt: state.simulatedAt,
			buildingId: command.buildingId,
			rationale: command.rationale,
			modifiers: FIRST_EMBER_MODIFIERS[command.buildingId],
			reactions
		});
		const powerStateChanges = Object.values(state.settlement.buildings)
			.map((building) => ({
				buildingId: building.buildingId,
				before: building.powerState,
				after:
					building.buildingId === command.buildingId
						? ('powered' as const)
						: building.baselinePowerState
			}))
			.filter((change) => change.before !== change.after)
			.sort((left, right) => left.buildingId.localeCompare(right.buildingId));
		const activeSystemIdsAfter = Object.values(state.settlement.buildings)
			.filter(
				(building) =>
					building.buildingId === command.buildingId || building.baselinePowerState !== 'unpowered'
			)
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		const responseCounts = Object.fromEntries(
			['support', 'accept', 'question', 'oppose'].map((stance) => [
				stance,
				reactions.filter((reaction) => reaction.stance === stance).length
			])
		);
		const base = eventBase(state, command, 'settlement.first.ember.committed');
		const society =
			state.schemaVersion === 7 ||
			state.schemaVersion === 8 ||
			state.schemaVersion === 9 ||
			state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13
				? buildFirstEmberSociety(
						state,
						base.eventId,
						command.buildingId,
						command.rationale,
						reactions
					)
				: undefined;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				firstEmber,
				...(society ? { society } : {}),
				previousPoweredBuildingId: state.settlement.poweredBuildingId,
				powerStateChanges,
				activeSystemIdsAfter,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The Master permanently bound the First Ember to ${command.buildingId}: ${responseCounts.support ?? 0} supported, ${responseCounts.accept ?? 0} accepted, ${responseCounts.question ?? 0} questioned, and ${responseCounts.oppose ?? 0} opposed.`
				)
			}
		});
	}
	if (
		command.commandType === 'master.issue.directive' ||
		command.commandType === 'master.replace.directive'
	) {
		if (
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		)
			throw new IllegalActionError(command.commandType);
		const eventType =
			command.commandType === 'master.issue.directive'
				? 'social.directive.issued'
				: 'social.directive.replaced';
		const base = eventBase(state, command, eventType);
		const change = buildDirectiveChange(state, base.eventId, command);
		const canceledScheduledEventIds = change.previousDirective?.expiryScheduledEventId
			? [change.previousDirective.expiryScheduledEventId]
			: [];
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				...change,
				nextVersion: state.version + 1,
				...emptyMetadata(
					command.commandType === 'master.issue.directive'
						? `The Master delivered a ${command.scope} direction to ${command.recipientIds.length} hero${command.recipientIds.length === 1 ? '' : 'es'}.`
						: `The Master replaced one direction with a witnessed ${command.scope} direction.`
				),
				canceledScheduledEventIds
			}
		});
	}
	if (command.commandType === 'master.revoke.directive') {
		if (
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		)
			throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'social.directive.revoked');
		const previousDirective = state.society.directives[command.directiveId]!;
		const change = revokeDirective(state, base.eventId, command.directiveId);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				directive: change.directive,
				previousDirective,
				communicativeAct: null,
				society: change.society,
				scheduledEvent: null,
				nextVersion: state.version + 1,
				...emptyMetadata('The Master revoked an active direction; its witnessed history remains.'),
				canceledScheduledEventIds: previousDirective.expiryScheduledEventId
					? [previousDirective.expiryScheduledEventId]
					: []
			}
		});
	}
	if (command.commandType === 'master.communicate') {
		if (
			state.schemaVersion !== 8 &&
			state.schemaVersion !== 9 &&
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		) {
			throw new IllegalActionError(command.commandType);
		}
		const base = eventBase(state, command, 'social.communicative.act.recorded');
		const { society, communicativeAct } = buildCommunicativeSociety(state, base.eventId, command);
		const bystanders = communicativeAct.witnesses.filter(
			(witness) => witness.role === 'bystander'
		).length;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				communicativeAct,
				society,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The Master used ${command.kind} about ${command.topic}; one intended hero and ${bystanders} bystander${bystanders === 1 ? '' : 's'} witnessed it.`
				)
			}
		});
	}
	if (command.commandType === 'master.converse') {
		if (
			state.schemaVersion !== 9 &&
			state.schemaVersion !== 10 &&
			state.schemaVersion !== 11 &&
			state.schemaVersion !== 12 &&
			state.schemaVersion !== 13 &&
			state.schemaVersion !== 14 &&
			state.schemaVersion !== 16 &&
			state.schemaVersion !== 17 &&
			state.schemaVersion !== 18 &&
			state.schemaVersion !== 19 &&
			state.schemaVersion !== 20
		)
			throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'social.conversation.turn.recorded');
		const { society, conversationTurn } = buildConversationSociety(state, base.eventId, command);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				conversationTurn,
				society,
				nextVersion: state.version + 1,
				...emptyMetadata(
					conversationTurn.response.orderOutcome
						? `The hero ${conversationTurn.response.orderOutcome} the ${conversationTurn.orderIntent} order.`
						: `The hero answered the Master's ${conversationTurn.kind}.`
				)
			}
		});
	}
	if (command.commandType === 'simulation.sync.clock') {
		if (!hasRoutineState(state)) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'simulation.clock.synced');
		return AuthoritativeEventSchema.parse({
			...base,
			gameTime: command.targetGameTime,
			seedCursor: state.entropyCursor,
			payload: {
				targetGameTime: command.targetGameTime,
				nextVersion: state.version + 1,
				...emptyMetadata('The event-driven settlement clock advanced without due work.')
			}
		});
	}
	if (command.commandType === 'hero.plan.day') {
		if (!hasRoutineState(state)) throw new IllegalActionError(command.commandType);
		const dailyPlan = createDailyPlan(state, command.actorId, command.commandId);
		const base = eventBase(state, command, 'hero.daily.plan.created');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				dailyPlan,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero formed day ${dailyPlan.dayIndex}: habit, duty, meal, and sleep remain intentions until resolved.`
				)
			}
		});
	}
	if (command.commandType === 'hero.start.routine') {
		if (!hasRoutineState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		const resolution = resolveDailyRoutine(state, command.actorId);
		if (!hero?.dailyPlan || !resolution) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.routine.started');
		const routineId = deterministicUuid(`${command.commandId}:routine`);
		const scheduledEventId = deterministicUuid(`${command.commandId}:routine-completion`);
		const completesAt = addGameMinutes(state.simulatedAt, routineDuration(resolution.selectedKind));
		const currentRoutine = CurrentRoutineSchema.parse({
			routineId,
			scheduledEventId,
			planId: hero.dailyPlan.planId,
			planEntryId: resolution.selectedPlanEntryId,
			kind: resolution.selectedKind,
			resolution,
			startedAt: state.simulatedAt,
			completesAt
		});
		const scheduledEvent = ScheduledEventSchema.parse({
			scheduledEventId,
			runId: state.runId,
			actorId: command.actorId,
			dueGameTime: completesAt,
			eventKind: 'hero.routine.complete',
			payload: {
				heroId: command.actorId,
				routineId,
				planId: hero.dailyPlan.planId,
				planEntryId: resolution.selectedPlanEntryId,
				kind: resolution.selectedKind
			}
		});
		const resourceChanges =
			resolution.selectedKind === 'meal'
				? [resourceChange(state, 'food', 'daily plan meal reservation')]
				: [];
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				currentRoutine,
				resourceChanges,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The habit resolver selected ${routineLabel(resolution.selectedKind)}. ${resolution.summary}`
				),
				scheduledEvent
			}
		});
	}
	if (command.commandType === 'settlement.assign.hero') {
		if (!hasFacilityState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.heroId];
		const building = state.settlement.buildings[command.buildingId];
		if (!hero || !building) throw new IllegalActionError(command.commandType);
		const assignment = HeroBuildingAssignmentSchema.parse({
			buildingId: building.buildingId,
			nodeId: building.assignmentNodeId,
			role: building.assignmentRole,
			assignedAt: state.simulatedAt
		});
		const base = eventBase(state, command, 'hero.assignment.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: hero.heroId,
				previousAssignment: hero.assignment,
				assignment,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero was assigned to ${building.buildingId} as ${building.assignmentRole}.`
				)
			}
		});
	}
	if (command.commandType === 'settlement.unassign.hero') {
		if (!hasFacilityState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.heroId];
		if (!hero?.assignment) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.assignment.changed');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: hero.heroId,
				previousAssignment: hero.assignment,
				assignment: null,
				nextVersion: state.version + 1,
				...emptyMetadata(`The hero was released from ${hero.assignment.buildingId}.`)
			}
		});
	}
	if (command.commandType === 'settlement.allocate.power') {
		if (!hasFacilityState(state)) throw new IllegalActionError(command.commandType);
		const target = state.settlement.buildings[command.buildingId];
		if (!target) throw new IllegalActionError(command.commandType);
		const powerStateChanges = Object.values(state.settlement.buildings)
			.map((building) => ({
				buildingId: building.buildingId,
				before: building.powerState,
				after:
					building.buildingId === command.buildingId
						? ('powered' as const)
						: building.baselinePowerState
			}))
			.filter((change) => change.before !== change.after)
			.sort((left, right) => left.buildingId.localeCompare(right.buildingId));
		const activeSystemIdsAfter = Object.values(state.settlement.buildings)
			.filter(
				(building) =>
					building.buildingId === command.buildingId || building.baselinePowerState !== 'unpowered'
			)
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		const base = eventBase(state, command, 'settlement.power.allocated');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				buildingId: command.buildingId,
				previousPoweredBuildingId: state.settlement.poweredBuildingId,
				powerStateChanges,
				activeSystemIdsAfter,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The development power slot now feeds ${command.buildingId}; route access was recomputed.`
				)
			}
		});
	}
	if (command.commandType === 'hero.start.travel') {
		if (!hasNavigationState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		if (!hero) throw new IllegalActionError(command.commandType);
		const definition = settlementForState(state);
		const route = planSettlementRoute(
			definition,
			hero.locationNodeId,
			command.targetNodeId,
			new Set(state.settlement.navigation.activeSystemIds)
		);
		const destinationZone = zoneForNode(definition, command.targetNodeId);
		if (!route || route.totalTravelGameSeconds <= 0 || !destinationZone) {
			throw new IllegalActionError(command.commandType);
		}
		const base = eventBase(state, command, 'hero.travel.started');
		const travelId = deterministicUuid(`${command.commandId}:travel`);
		const scheduledEventId = deterministicUuid(`${command.commandId}:arrival`);
		const dueGameTime = addGameSeconds(state.simulatedAt, route.totalTravelGameSeconds);
		const scheduledEvent = ScheduledEventSchema.parse({
			scheduledEventId,
			runId: state.runId,
			actorId: command.actorId,
			dueGameTime,
			eventKind: 'hero.travel.arrive',
			payload: {
				heroId: command.actorId,
				travelId,
				fromNodeId: route.fromNodeId,
				toNodeId: route.toNodeId,
				settlementContentHash: definition.contentHash
			}
		});
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				travelId,
				fromNodeId: route.fromNodeId,
				toNodeId: route.toNodeId,
				destinationZone,
				route,
				settlementContentVersion: definition.contentVersion,
				settlementContentHash: definition.contentHash,
				scheduledEvent,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero began a ${route.totalTravelGameSeconds}-second route from ${route.fromNodeId} to ${route.toNodeId}; arrival is due at ${dueGameTime}.`
				)
			}
		});
	}
	if (command.commandType === 'hero.choose.destination') {
		const base = eventBase(state, command, 'hero.destination.selected');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: command.destination,
				firstLine: command.firstLine,
				storyBranch: command.storyBranch,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero chose the ${command.destination === 'kitchen' ? 'kitchen' : 'training ground'}.`
				)
			}
		});
	}
	if (command.commandType === 'hero.arrive') {
		if (hasNavigationState(state)) throw new IllegalActionError(command.commandType);
		const hero = state.heroes[command.actorId];
		if (!hero?.destination) throw new IllegalActionError('hero.arrive.destination');
		const base = eventBase(state, command, 'hero.arrived');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				destination: hero.destination,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero reached the ${hero.destination === 'kitchen' ? 'kitchen' : 'training ground'}.`
				)
			}
		});
	}
	if (command.commandType === 'master.inspect.gate') {
		const entropy = drawInteger(
			createEntropyCursor(state.seed, state.entropyCursor),
			'gate.resonance',
			0,
			99
		);
		const base = eventBase(state, command, 'master.gate.inspected');
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: entropy.next.cursor,
			payload: {
				masterId: command.actorId,
				resonance: entropy.draw.value,
				nextVersion: state.version + 1,
				...emptyMetadata(`The gate answered with resonance ${entropy.draw.value}.`),
				entropyDraws: [entropy.draw]
			}
		});
	}
	if (command.commandType === 'hero.start.activity') {
		const base = eventBase(state, command, 'hero.activity.started');
		const activityId = deterministicUuid(`${command.commandId}:activity`);
		const scheduledEventId = deterministicUuid(`${command.commandId}:completion`);
		const dueGameTime = addGameMinutes(state.simulatedAt, activityDuration(command.activity));
		const scheduledEvent = ScheduledEventSchema.parse({
			scheduledEventId,
			runId: state.runId,
			actorId: command.actorId,
			dueGameTime,
			eventKind: 'hero.activity.complete',
			payload: { heroId: command.actorId, activityId, activity: command.activity }
		});
		const resourceChanges =
			command.activity === 'eat'
				? [resourceChange(state, 'food', 'meal reserved')]
				: command.activity === 'repair'
					? [resourceChange(state, 'iron-ore', 'repair material reserved')]
					: [];
		const rewardDeltas = resourceChanges.map((change): RewardDelta => ({
			ownerId: state.master.masterId,
			kind: 'resource',
			key: change.resource,
			before: change.before,
			after: change.after,
			delta: change.delta
		}));
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				activity: command.activity,
				activityId,
				scheduledEvent,
				resourceChanges,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero began ${command.activity}; completion is due at ${dueGameTime}.`,
					rewardDeltas
				)
			}
		});
	}
	if (command.commandType === 'hero.equip.item') {
		const hero = state.heroes[command.actorId];
		if (!hero) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.item.equipped');
		const previousItemId = hero.equipment.mainHand;
		const before = previousItemId ? 1 : 0;
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				heroId: command.actorId,
				itemId: command.itemId,
				previousItemId,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The hero equipped ${state.items[command.itemId]?.displayName ?? 'an item'}.`,
					[
						{
							ownerId: command.actorId,
							kind: 'item',
							key: 'main-hand',
							before,
							after: 1,
							delta: 1 - before
						}
					]
				)
			}
		});
	}
	if (command.commandType === 'simulation.advance') {
		const base = eventBase(state, command, 'simulation.advanced');
		const dueHeroes = Object.values(state.heroes)
			.filter(
				(hero) =>
					hero.currentActivity &&
					compareGameTime(hero.currentActivity.completesAt, command.targetGameTime) <= 0
			)
			.sort((left, right) => {
				const time = compareGameTime(
					left.currentActivity!.completesAt,
					right.currentActivity!.completesAt
				);
				return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
			});
		let entropy = createEntropyCursor(state.seed, state.entropyCursor);
		const outcomes: z.infer<typeof ActivityOutcomeSchema>[] = [];
		const draws: EntropyDraw[] = [];
		for (const hero of dueHeroes) {
			const result = buildActivityOutcome(state, hero.heroId, base.eventId, entropy);
			outcomes.push(result.outcome);
			entropy = result.entropy;
			draws.push(...result.draws);
		}
		if (hasRoutineState(state)) {
			const expiredDirectives =
				state.schemaVersion === 10 ||
				state.schemaVersion === 11 ||
				state.schemaVersion === 12 ||
				state.schemaVersion === 13
					? Object.values(state.society.directives)
							.filter(
								(directive) =>
									directive.status === 'active' &&
									directive.expiresAt !== null &&
									compareGameTime(directive.expiresAt, command.targetGameTime) <= 0
							)
							.sort((left, right) =>
								left.expiresAt === right.expiresAt
									? left.directiveId.localeCompare(right.directiveId)
									: compareGameTime(left.expiresAt!, right.expiresAt!)
							)
					: [];
			const dueTravels = Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.currentTravel &&
						compareGameTime(hero.currentTravel.arrivesAt, command.targetGameTime) <= 0
				)
				.sort((left, right) => {
					const time = compareGameTime(
						left.currentTravel!.arrivesAt,
						right.currentTravel!.arrivesAt
					);
					return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
				});
			const travelOutcomes = dueTravels.map((hero) => ({
				scheduledEventId: hero.currentTravel!.scheduledEventId,
				heroId: hero.heroId,
				travelId: hero.currentTravel!.travelId,
				fromNodeId: hero.currentTravel!.fromNodeId,
				toNodeId: hero.currentTravel!.toNodeId,
				locationAfter: hero.currentTravel!.destinationZone
			}));
			const dueRoutines = Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.currentRoutine &&
						compareGameTime(hero.currentRoutine.completesAt, command.targetGameTime) <= 0
				)
				.sort((left, right) => {
					const time = compareGameTime(
						left.currentRoutine!.completesAt,
						right.currentRoutine!.completesAt
					);
					return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
				});
			const routineOutcomes = dueRoutines.map((hero) => buildRoutineOutcome(state, hero.heroId));
			const dueByScheduleId = new Map<string, string>();
			for (const hero of dueHeroes)
				dueByScheduleId.set(
					hero.currentActivity!.scheduledEventId,
					hero.currentActivity!.completesAt
				);
			for (const hero of dueTravels)
				dueByScheduleId.set(hero.currentTravel!.scheduledEventId, hero.currentTravel!.arrivesAt);
			for (const hero of dueRoutines)
				dueByScheduleId.set(
					hero.currentRoutine!.scheduledEventId,
					hero.currentRoutine!.completesAt
				);
			for (const directive of expiredDirectives)
				dueByScheduleId.set(directive.expiryScheduledEventId!, directive.expiresAt!);
			const resolvedScheduledEventIds = [
				...outcomes.map((outcome) => outcome.scheduledEventId),
				...travelOutcomes.map((outcome) => outcome.scheduledEventId),
				...routineOutcomes.map((outcome) => outcome.scheduledEventId),
				...expiredDirectives.map((directive) => directive.expiryScheduledEventId!)
			].sort((left, right) => {
				const time = compareGameTime(dueByScheduleId.get(left)!, dueByScheduleId.get(right)!);
				return time === 0 ? left.localeCompare(right) : time;
			});
			const rewardDeltas = [
				...outcomes.flatMap((outcome) => outcome.rewardDeltas),
				...routineOutcomes.flatMap((outcome) => outcome.rewardDeltas)
			];
			const resolutionParts = [
				outcomes.length === 0
					? null
					: outcomes.length === 1
						? `one ${outcomes[0]!.activity} activity`
						: `${outcomes.length} activities`,
				travelOutcomes.length === 0
					? null
					: travelOutcomes.length === 1
						? 'one scheduled arrival'
						: `${travelOutcomes.length} scheduled arrivals`,
				routineOutcomes.length === 0
					? null
					: routineOutcomes.length === 1
						? 'one daily routine'
						: `${routineOutcomes.length} daily routines`,
				expiredDirectives.length === 0
					? null
					: expiredDirectives.length === 1
						? 'one direction expiry'
						: `${expiredDirectives.length} direction expiries`
			].filter((part): part is string => Boolean(part));
			return AuthoritativeEventSchema.parse({
				...base,
				gameTime: command.targetGameTime,
				seedCursor: entropy.cursor,
				payload: {
					targetGameTime: command.targetGameTime,
					activityOutcomes: outcomes,
					travelOutcomes,
					routineOutcomes,
					expiredDirectiveIds: expiredDirectives.map((directive) => directive.directiveId),
					nextVersion: state.version + 1,
					...emptyMetadata(
						`${resolutionParts.join(' and ').replace(/^./u, (letter) => letter.toUpperCase())} resolved.`,
						rewardDeltas
					),
					resolvedScheduledEventIds,
					entropyDraws: draws
				}
			});
		}
		if (state.schemaVersion === 3 || state.schemaVersion === 4) {
			const dueTravels = Object.values(state.heroes)
				.filter(
					(hero) =>
						hero.currentTravel &&
						compareGameTime(hero.currentTravel.arrivesAt, command.targetGameTime) <= 0
				)
				.sort((left, right) => {
					const time = compareGameTime(
						left.currentTravel!.arrivesAt,
						right.currentTravel!.arrivesAt
					);
					return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
				});
			const travelOutcomes = dueTravels.map((hero) => ({
				scheduledEventId: hero.currentTravel!.scheduledEventId,
				heroId: hero.heroId,
				travelId: hero.currentTravel!.travelId,
				fromNodeId: hero.currentTravel!.fromNodeId,
				toNodeId: hero.currentTravel!.toNodeId,
				locationAfter: hero.currentTravel!.destinationZone
			}));
			const dueByScheduleId = new Map<string, string>();
			for (const hero of dueHeroes)
				dueByScheduleId.set(
					hero.currentActivity!.scheduledEventId,
					hero.currentActivity!.completesAt
				);
			for (const hero of dueTravels)
				dueByScheduleId.set(hero.currentTravel!.scheduledEventId, hero.currentTravel!.arrivesAt);
			const resolvedScheduledEventIds = [
				...outcomes.map((outcome) => outcome.scheduledEventId),
				...travelOutcomes.map((outcome) => outcome.scheduledEventId)
			].sort((left, right) => {
				const time = compareGameTime(dueByScheduleId.get(left)!, dueByScheduleId.get(right)!);
				return time === 0 ? left.localeCompare(right) : time;
			});
			const rewardDeltas = outcomes.flatMap((outcome) => outcome.rewardDeltas);
			const resolutionParts = [
				outcomes.length === 0
					? null
					: outcomes.length === 1
						? `one ${outcomes[0]!.activity} activity`
						: `${outcomes.length} activities`,
				travelOutcomes.length === 0
					? null
					: travelOutcomes.length === 1
						? 'one scheduled arrival'
						: `${travelOutcomes.length} scheduled arrivals`
			].filter((part): part is string => Boolean(part));
			return AuthoritativeEventSchema.parse({
				...base,
				gameTime: command.targetGameTime,
				seedCursor: entropy.cursor,
				payload: {
					targetGameTime: command.targetGameTime,
					activityOutcomes: outcomes,
					travelOutcomes,
					nextVersion: state.version + 1,
					...emptyMetadata(
						`${resolutionParts.join(' and ').replace(/^./u, (letter) => letter.toUpperCase())} resolved.`,
						rewardDeltas
					),
					resolvedScheduledEventIds,
					entropyDraws: draws
				}
			});
		}
		const resolvedScheduledEventIds = outcomes.map((outcome) => outcome.scheduledEventId);
		const rewardDeltas = outcomes.flatMap((outcome) => outcome.rewardDeltas);
		return AuthoritativeEventSchema.parse({
			...base,
			gameTime: command.targetGameTime,
			seedCursor: entropy.cursor,
			payload: {
				targetGameTime: command.targetGameTime,
				outcomes,
				nextVersion: state.version + 1,
				...emptyMetadata(
					outcomes.length === 1
						? `One ${outcomes[0]?.activity} activity completed.`
						: `${outcomes.length} scheduled activities completed.`,
					rewardDeltas
				),
				resolvedScheduledEventIds,
				entropyDraws: draws
			}
		});
	}
	if (command.commandType !== 'simulation.apply.damage') {
		throw new IllegalActionError(command.commandType);
	}
	const targetKind = command.targetId === state.master.masterId ? 'master' : 'hero';
	const target = targetKind === 'master' ? state.master : state.heroes[command.targetId];
	if (!target) throw new IllegalActionError(command.commandType);
	const healthAfter = Math.max(0, target.health - command.amount);
	const fatal = healthAfter === 0;
	const eventType = fatal ? `${targetKind}.died` : `${targetKind}.damaged`;
	const base = eventBase(state, command, eventType);
	const injury = fatal
		? null
		: InjurySchema.parse({
				injuryId: deterministicUuid(`${base.eventId}:${command.targetId}:injury`),
				kind: command.amount >= 50 ? 'critical' : command.amount >= 20 ? 'strain' : 'bruise',
				severity: command.amount,
				inflictedAt: state.simulatedAt
			});
	const targetHero = state.heroes[command.targetId];
	const targetHeroSchedules = targetHero
		? [
				targetHero.currentActivity?.scheduledEventId,
				currentTravelFor(state, command.targetId)?.scheduledEventId,
				currentRoutineFor(state, command.targetId)?.scheduledEventId
			].filter((id): id is string => Boolean(id))
		: [];
	const canceledScheduledEventIds = fatal
		? targetKind === 'master'
			? Object.values(state.heroes)
					.flatMap((hero) => [
						hero.currentActivity?.scheduledEventId,
						currentTravelFor(state, hero.heroId)?.scheduledEventId,
						currentRoutineFor(state, hero.heroId)?.scheduledEventId
					])
					.filter((id): id is string => Boolean(id))
			: targetHeroSchedules
		: [];
	return AuthoritativeEventSchema.parse({
		...base,
		seedCursor: state.entropyCursor,
		payload: {
			targetId: command.targetId,
			targetKind,
			damageKind: command.damageKind,
			amount: command.amount,
			healthBefore: target.health,
			healthAfter,
			injury,
			nextVersion: state.version + 1,
			...emptyMetadata(
				fatal
					? targetKind === 'master'
						? 'The Master died. The run ended atomically.'
						: 'A summoned hero died permanently.'
					: `${targetKind === 'master' ? 'The Master' : 'A hero'} suffered ${command.amount} ${command.damageKind} damage.`,
				[
					{
						ownerId: command.targetId,
						kind: 'health',
						key: 'body',
						before: target.health,
						after: healthAfter,
						delta: healthAfter - target.health
					}
				]
			),
			canceledScheduledEventIds
		}
	});
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

function applyResourceChanges(
	state: EngineGameStateModern,
	event: AuthoritativeEvent,
	changes: readonly z.infer<typeof ResourceChangeSchema>[]
) {
	const resources = { ...state.settlement.resources };
	const resourceLedger = [...state.settlement.resourceLedger];
	for (const [index, change] of changes.entries()) {
		if (resources[change.resource] !== change.before || change.after < 0) {
			throw new ReplayIntegrityError('Resource ledger precondition failed', event.sequence);
		}
		resources[change.resource] = change.after;
		resourceLedger.push({
			entryId: deterministicUuid(`${event.eventId}:resource:${index}`),
			eventId: event.eventId,
			...change
		});
	}
	return { ...state.settlement, resources, resourceLedger };
}

function assignmentsEqual(
	left: z.infer<typeof HeroBuildingAssignmentSchema> | null,
	right: z.infer<typeof HeroBuildingAssignmentSchema> | null
): boolean {
	return (
		left?.buildingId === right?.buildingId &&
		left?.nodeId === right?.nodeId &&
		left?.role === right?.role &&
		left?.assignedAt === right?.assignedAt
	);
}

function clearBuildingAssignment(
	settlement: EngineGameStateV4['settlement'],
	heroId: string,
	buildingId: string
): EngineGameStateV4['settlement'] {
	const building = settlement.buildings[buildingId];
	if (!building) return settlement;
	return {
		...settlement,
		buildings: {
			...settlement.buildings,
			[buildingId]: {
				...building,
				assignedHeroIds: building.assignedHeroIds.filter((candidate) => candidate !== heroId)
			}
		}
	};
}

function reduceV2Event(
	state: EngineGameStateModern,
	event: AuthoritativeEvent
): EngineGameStateModern {
	if (event.eventType === 'story.first.archive.revealed') {
		if (
			state.schemaVersion !== 23 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			event.source.source !== 'manual'
		) {
			throw new ReplayIntegrityError(
				'First-band archive reveal precondition failed',
				event.sequence
			);
		}
		const payload = FirstBandArchiveRevealedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('First-band archive reveal version diverged', event.sequence);
		}
		let expected;
		try {
			expected = revealFirstBandArchive(state, payload.reveal.readerHeroId, event.eventId);
		} catch {
			throw new ReplayIntegrityError(
				'First-band archive reveal could not be reproduced',
				event.sequence
			);
		}
		if (
			hashCanonical(expected.reveal) !== hashCanonical(payload.reveal) ||
			hashCanonical(expected.archive) !== hashCanonical(payload.firstBandArchive)
		) {
			throw new ReplayIntegrityError('First-band archive reveal payload diverged', event.sequence);
		}
		return EngineGameStateV23Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			firstBandArchive: payload.firstBandArchive
		});
	}
	if (event.eventType === 'hero.synthesized') {
		if (
			state.schemaVersion !== 22 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			event.source.source !== 'manual'
		) {
			throw new ReplayIntegrityError('Synthesis precondition failed', event.sequence);
		}
		const payload = SynthesisCommittedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Synthesis version diverged', event.sequence);
		}
		const command = EngineCommandSchema.parse({
			commandId: event.commandId,
			runId: event.runId,
			actorId: event.actorId,
			expectedVersion: state.version,
			correlationId: event.correlationId,
			source: event.source,
			commandType: 'settlement.synthesize.hero',
			sourceHeroId: payload.receipt.sourceHeroId,
			recipientHeroId: payload.receipt.recipientHeroId,
			visibility: payload.receipt.visibility,
			warningVersion: payload.receipt.warningVersion,
			confirmedIrreversible: payload.receipt.confirmedIrreversible,
			rationale: payload.receipt.rationale
		}) as SynthesizeHeroCommand;
		let resolved;
		try {
			resolved = resolveSynthesis(state, command, event.eventId, event.sequence);
		} catch {
			throw new ReplayIntegrityError('Synthesis could not be recomputed', event.sequence);
		}
		if (
			hashCanonical(resolved.receipt) !== hashCanonical(payload.receipt) ||
			hashCanonical(resolved.rewardDeltas) !== hashCanonical(payload.rewardDeltas) ||
			hashCanonical(resolved.canceledScheduledEventIds) !==
				hashCanonical(payload.canceledScheduledEventIds)
		) {
			throw new ReplayIntegrityError('Synthesis payload diverged', event.sequence);
		}
		return resolved.state;
	}
	if (event.eventType === 'social.synthesis.rumor.shared') {
		if (
			state.schemaVersion !== 22 ||
			!event.actorId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			!['scripted', 'model', 'habit', 'random'].includes(event.source.source)
		) {
			throw new ReplayIntegrityError('Synthesis rumor precondition failed', event.sequence);
		}
		const payload = SynthesisRumorSharedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Synthesis rumor version diverged', event.sequence);
		}
		const command = EngineCommandSchema.parse({
			commandId: event.commandId,
			runId: event.runId,
			actorId: event.actorId,
			expectedVersion: state.version,
			correlationId: event.correlationId,
			source: event.source,
			commandType: 'hero.share.synthesis.rumor',
			receiptId: payload.rumor.receiptId,
			targetHeroId: payload.rumor.listenerHeroId
		}) as ShareSynthesisRumorCommand;
		let resolved;
		try {
			resolved = resolveSynthesisRumor(state, command, event.eventId, event.sequence);
		} catch {
			throw new ReplayIntegrityError('Synthesis rumor could not be recomputed', event.sequence);
		}
		if (
			hashCanonical(resolved.rumor) !== hashCanonical(payload.rumor) ||
			hashCanonical(resolved.rewardDeltas) !== hashCanonical(payload.rewardDeltas)
		) {
			throw new ReplayIntegrityError('Synthesis rumor payload diverged', event.sequence);
		}
		return resolved.state;
	}
	if (event.eventType === 'story.patch.applied') {
		if (
			state.schemaVersion !== 21 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			!['manual', 'scripted', 'model'].includes(event.source.source) ||
			state.bandStory.appliedPatches.length !== 0
		) {
			throw new ReplayIntegrityError('Story patch precondition failed', event.sequence);
		}
		const payload = StoryPatchAppliedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Story patch version diverged', event.sequence);
		}
		let expected;
		try {
			expected = applyValidatedStoryPatch(
				verifiedStoryEnvelope(),
				state.bandStory.history,
				storyPatchCastForState(state),
				payload.candidate,
				event.eventId,
				event.gameTime
			);
		} catch {
			throw new ReplayIntegrityError('Story patch could not be revalidated', event.sequence);
		}
		const expectedBandStory = RuntimeBandStoryStateSchema.parse({
			...state.bandStory,
			history: expected.history,
			appliedPatches: [...state.bandStory.appliedPatches, expected.patch]
		});
		if (
			hashCanonical(expected.patch.validation) !== hashCanonical(payload.validation) ||
			hashCanonical(expected.patch) !== hashCanonical(payload.patch) ||
			hashCanonical(expectedBandStory) !== hashCanonical(payload.bandStory)
		) {
			throw new ReplayIntegrityError('Story patch payload diverged', event.sequence);
		}
		return EngineGameStateV21Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			bandStory: payload.bandStory
		});
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
			const expectedBandStory =
				payload.transition === 'extract' ? completeFirstBandStory(state) : state.bandStory;
			const expectedArchive = recoverFirstBandArchive(
				state,
				event.eventId,
				MissionRunStateV8Schema.parse(expectedMission),
				expectedBandStory
			);
			if (
				hashCanonical(expectedMission) !== hashCanonical(payload.mission) ||
				hashCanonical(expectedBandStory) !== hashCanonical(payload.bandStory) ||
				hashCanonical(expectedArchive) !== hashCanonical(payload.firstBandArchive)
			) {
				throw new ReplayIntegrityError(
					'First-band mission transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
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
				...state,
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
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
				const deployment = deployMissionAttempt(state);
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
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
				const deployment = deployMissionAttempt(state);
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission aftermath transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
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
										mission: deployMissionAttempt(state).mission,
										resourceChanges: [] as readonly z.infer<typeof ResourceChangeSchema>[]
									}
								: payload.transition === 'extract'
									? completePortalMissionExtraction(state)
									: {
											mission: retreatMissionAttempt(state),
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
				const deployment = deployMissionAttempt(state);
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission evidence transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
			if (hashCanonical(expected) !== hashCanonical(payload.mission)) {
				throw new ReplayIntegrityError(
					'Mission combat transition payload diverged',
					event.sequence
				);
			}
			if (payload.transition === 'deploy') {
				const deployment = deployMissionAttempt(state);
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
								? deployMissionAttempt(state).mission
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
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
							? deployMissionAttempt(state).mission
							: payload.transition === 'open-extraction'
								? openMissionExtraction(state, payload.completedObjectiveIds)
								: payload.transition === 'extract'
									? completeMissionExtraction(state)
									: retreatMissionAttempt(state);
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
	if (event.eventType === 'story.first.ember.recovered') {
		if (!hasFirstEmberState(state) || state.settlement.firstEmber.status !== 'unrecovered') {
			throw new ReplayIntegrityError('First Ember recovery requires engine-v6', event.sequence);
		}
		const payload = FirstEmberRecoveredPayloadSchema.parse(event.payload);
		const expected = FirstEmberStateSchema.parse({
			...state.settlement.firstEmber,
			status: 'available',
			recoveredFrom: 'tower-floor-01',
			recoveredAt: state.simulatedAt
		});
		if (hashCanonical(expected) !== hashCanonical(payload.firstEmber)) {
			throw new ReplayIntegrityError('First Ember recovery payload diverged', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement: { ...state.settlement, firstEmber: payload.firstEmber }
		});
	}
	if (event.eventType === 'settlement.first.ember.committed') {
		if (!hasFirstEmberState(state) || state.settlement.firstEmber.status !== 'available') {
			throw new ReplayIntegrityError(
				'First Ember commitment requires availability',
				event.sequence
			);
		}
		const payload = FirstEmberCommittedPayloadSchema.parse(event.payload);
		const buildingId = payload.firstEmber.buildingId;
		const rationale = payload.firstEmber.rationale;
		if (!buildingId || !rationale || payload.previousPoweredBuildingId !== null) {
			throw new ReplayIntegrityError('First Ember commitment precondition failed', event.sequence);
		}
		const expected = FirstEmberStateSchema.parse({
			...state.settlement.firstEmber,
			status: 'committed',
			committedAt: state.simulatedAt,
			buildingId,
			rationale,
			modifiers: FIRST_EMBER_MODIFIERS[buildingId],
			reactions: Object.values(state.heroes)
				.filter((hero) => hero.lifeState === 'active')
				.sort((left, right) => left.heroId.localeCompare(right.heroId))
				.map((hero) => buildFirstEmberReaction(hero, buildingId, rationale))
		});
		if (hashCanonical(expected) !== hashCanonical(payload.firstEmber)) {
			throw new ReplayIntegrityError('First Ember reaction projection diverged', event.sequence);
		}
		let society: SocietyState | SocietyStateV2 | SocietyStateV3 | SocietyStateV4 | undefined;
		if (
			state.schemaVersion === 7 ||
			state.schemaVersion === 8 ||
			state.schemaVersion === 9 ||
			state.schemaVersion === 10 ||
			state.schemaVersion === 11 ||
			state.schemaVersion === 12 ||
			state.schemaVersion === 13
		) {
			society = buildFirstEmberSociety(
				state,
				event.eventId,
				buildingId,
				rationale,
				expected.reactions
			);
			if (!payload.society || hashCanonical(society) !== hashCanonical(payload.society)) {
				throw new ReplayIntegrityError('First Ember social projection diverged', event.sequence);
			}
		} else if (payload.society) {
			throw new ReplayIntegrityError(
				'Legacy First Ember event contains social state',
				event.sequence
			);
		}
		const buildings = { ...state.settlement.buildings };
		for (const change of payload.powerStateChanges) {
			const building = buildings[change.buildingId];
			if (!building || building.powerState !== change.before) {
				throw new ReplayIntegrityError('First Ember power precondition failed', event.sequence);
			}
			buildings[change.buildingId] = { ...building, powerState: change.after };
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement: {
				...state.settlement,
				poweredBuildingId: buildingId,
				buildings,
				firstEmber: payload.firstEmber,
				navigation: {
					...state.settlement.navigation,
					activeSystemIds: payload.activeSystemIdsAfter
				}
			},
			...(society ? { society } : {})
		});
	}
	if (
		event.eventType === 'social.directive.issued' ||
		event.eventType === 'social.directive.replaced' ||
		event.eventType === 'social.directive.revoked'
	) {
		if (
			(state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13 &&
				state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20) ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.source.source !== 'manual' ||
			event.source.timing !== 'step'
		) {
			throw new ReplayIntegrityError('Directive lifecycle precondition failed', event.sequence);
		}
		const payload = DirectiveChangedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Directive version diverged', event.sequence);
		}
		if (event.eventType === 'social.directive.revoked') {
			const expected = revokeDirective(state, event.eventId, payload.directive.directiveId);
			if (
				payload.communicativeAct !== null ||
				payload.scheduledEvent !== null ||
				hashCanonical(expected.directive) !== hashCanonical(payload.directive) ||
				hashCanonical(expected.society) !== hashCanonical(payload.society)
			) {
				throw new ReplayIntegrityError('Directive revocation projection diverged', event.sequence);
			}
		} else {
			const act = payload.communicativeAct;
			if (!act) throw new ReplayIntegrityError('Directive delivery is missing', event.sequence);
			const command = EngineCommandSchema.parse({
				commandId: event.commandId,
				runId: state.runId,
				actorId: state.master.masterId,
				expectedVersion: state.version,
				correlationId: event.correlationId,
				source: event.source,
				commandType:
					event.eventType === 'social.directive.issued'
						? 'master.issue.directive'
						: 'master.replace.directive',
				...(event.eventType === 'social.directive.replaced' && payload.previousDirective
					? { directiveId: payload.previousDirective.directiveId }
					: {}),
				text: payload.directive.text,
				scope: payload.directive.scope,
				recipientIds: payload.directive.recipientIds,
				priorities: payload.directive.priorities,
				tone: act.tone ?? 'neutral',
				delivery: payload.directive.delivery
			}) as DirectiveIssueCommand;
			const expected = buildDirectiveChange(state, event.eventId, command);
			if (
				hashCanonical(expected.directive) !== hashCanonical(payload.directive) ||
				hashCanonical(expected.previousDirective) !== hashCanonical(payload.previousDirective) ||
				hashCanonical(expected.communicativeAct) !== hashCanonical(payload.communicativeAct) ||
				hashCanonical(expected.society) !== hashCanonical(payload.society) ||
				hashCanonical(expected.scheduledEvent) !== hashCanonical(payload.scheduledEvent)
			) {
				throw new ReplayIntegrityError('Directive delivery projection diverged', event.sequence);
			}
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			society: payload.society
		});
	}
	if (event.eventType === 'social.communicative.act.recorded') {
		if (
			(state.schemaVersion !== 8 &&
				state.schemaVersion !== 9 &&
				state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13) ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.source.source !== 'manual' ||
			event.source.timing !== 'step'
		) {
			throw new ReplayIntegrityError('Communicative act precondition failed', event.sequence);
		}
		const payload = CommunicativeActRecordedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Communicative act version diverged', event.sequence);
		}
		const expected = buildCommunicativeSociety(state, event.eventId, {
			targetHeroId: payload.communicativeAct.intendedAudienceIds[0]!,
			kind: payload.communicativeAct.kind as CommunicationInput['kind'],
			topic: payload.communicativeAct.topic,
			exactText: payload.communicativeAct.exactText,
			tone: payload.communicativeAct.tone,
			delivery: payload.communicativeAct.delivery
		});
		if (
			hashCanonical(expected.communicativeAct) !== hashCanonical(payload.communicativeAct) ||
			hashCanonical(expected.society) !== hashCanonical(payload.society)
		) {
			throw new ReplayIntegrityError('Communicative act projection diverged', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			society: payload.society
		});
	}
	if (event.eventType === 'social.conversation.turn.recorded') {
		if (
			(state.schemaVersion !== 9 &&
				state.schemaVersion !== 10 &&
				state.schemaVersion !== 11 &&
				state.schemaVersion !== 12 &&
				state.schemaVersion !== 13) ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.source.source !== 'manual' ||
			event.source.timing !== 'step'
		) {
			throw new ReplayIntegrityError('Conversation turn precondition failed', event.sequence);
		}
		const payload = ConversationTurnRecordedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1) {
			throw new ReplayIntegrityError('Conversation turn version diverged', event.sequence);
		}
		const act = payload.society.communicativeActs[payload.conversationTurn.communicationActId];
		if (!act)
			throw new ReplayIntegrityError('Conversation communication is missing', event.sequence);
		const expected = buildConversationSociety(state, event.eventId, {
			commandId: event.commandId,
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: event.correlationId,
			source: event.source,
			commandType: 'master.converse',
			targetHeroId: payload.conversationTurn.heroId,
			kind: payload.conversationTurn.kind,
			exactText: act.exactText,
			tone: act.tone ?? 'neutral',
			delivery: act.delivery,
			orderIntent: payload.conversationTurn.orderIntent
		});
		if (
			hashCanonical(expected.conversationTurn) !== hashCanonical(payload.conversationTurn) ||
			hashCanonical(expected.society) !== hashCanonical(payload.society)
		) {
			throw new ReplayIntegrityError('Conversation turn projection diverged', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			society: payload.society
		});
	}
	if (event.eventType === 'simulation.clock.synced') {
		if (!hasRoutineState(state))
			throw new ReplayIntegrityError('Clock sync event requires engine-v5', event.sequence);
		const payload = SimulationClockSyncedPayloadSchema.parse(event.payload);
		const earliest = earliestScheduledTime(state);
		if (
			event.gameTime !== payload.targetGameTime ||
			compareGameTime(payload.targetGameTime, state.simulatedAt) <= 0 ||
			(earliest !== null && compareGameTime(payload.targetGameTime, earliest) >= 0)
		) {
			throw new ReplayIntegrityError('Clock sync precondition failed', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			simulatedAt: payload.targetGameTime
		});
	}
	if (event.eventType === 'hero.daily.plan.created') {
		if (!hasRoutineState(state))
			throw new ReplayIntegrityError('Daily plan event requires engine-v5', event.sequence);
		const payload = DailyPlanCreatedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (
			!hero ||
			hero.currentActivity ||
			hero.currentTravel ||
			hero.currentRoutine ||
			payload.dailyPlan.dayIndex !== gameDayIndex(state.simulatedAt)
		) {
			throw new ReplayIntegrityError('Daily plan precondition failed', event.sequence);
		}
		const expected = createDailyPlan(state, payload.heroId, event.commandId!);
		if (hashCanonical(expected) !== hashCanonical(payload.dailyPlan)) {
			throw new ReplayIntegrityError('Daily plan content diverged', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: {
				...state.heroes,
				[payload.heroId]: { ...hero, dailyPlan: payload.dailyPlan }
			}
		});
	}
	if (event.eventType === 'hero.routine.started') {
		if (!hasRoutineState(state))
			throw new ReplayIntegrityError('Routine event requires engine-v5', event.sequence);
		const payload = RoutineStartedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		const entry = hero?.dailyPlan?.entries.find(
			(candidate) => candidate.planEntryId === payload.currentRoutine.planEntryId
		);
		const expectedResolution = resolveDailyRoutine(state, payload.heroId);
		if (
			!hero ||
			!hero.dailyPlan ||
			hero.currentActivity ||
			hero.currentTravel ||
			hero.currentRoutine ||
			entry?.status !== 'pending' ||
			entry.kind !== payload.currentRoutine.kind ||
			hero.dailyPlan.planId !== payload.currentRoutine.planId ||
			payload.scheduledEvent.scheduledEventId !== payload.currentRoutine.scheduledEventId ||
			payload.scheduledEvent.dueGameTime !== payload.currentRoutine.completesAt ||
			payload.currentRoutine.startedAt !== state.simulatedAt ||
			!expectedResolution ||
			hashCanonical(expectedResolution) !== hashCanonical(payload.currentRoutine.resolution)
		) {
			throw new ReplayIntegrityError('Routine start precondition failed', event.sequence);
		}
		const settlement = applyResourceChanges(state, event, payload.resourceChanges);
		const dailyPlan = DailyPlanSchema.parse({
			...hero.dailyPlan,
			entries: hero.dailyPlan.entries.map((candidate) =>
				candidate.planEntryId === entry.planEntryId
					? { ...candidate, status: 'active', startedAt: state.simulatedAt }
					: candidate
			)
		});
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement,
			heroes: {
				...state.heroes,
				[payload.heroId]: {
					...hero,
					dailyPlan,
					currentRoutine: payload.currentRoutine
				}
			}
		});
	}
	if (event.eventType === 'hero.assignment.changed') {
		if (!hasFacilityState(state))
			throw new ReplayIntegrityError('Assignment event requires engine-v4', event.sequence);
		const payload = AssignmentChangedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero || !assignmentsEqual(hero.assignment, payload.previousAssignment)) {
			throw new ReplayIntegrityError('Assignment precondition failed', event.sequence);
		}
		let settlement = state.settlement;
		if (payload.previousAssignment) {
			settlement = clearBuildingAssignment(
				settlement,
				hero.heroId,
				payload.previousAssignment.buildingId
			);
		}
		if (payload.assignment) {
			const building = settlement.buildings[payload.assignment.buildingId];
			if (
				!building ||
				building.assignmentNodeId !== payload.assignment.nodeId ||
				building.assignmentRole !== payload.assignment.role ||
				building.assignedHeroIds.length >= building.assignmentCapacity
			) {
				throw new ReplayIntegrityError('Assignment target precondition failed', event.sequence);
			}
			settlement = {
				...settlement,
				buildings: {
					...settlement.buildings,
					[building.buildingId]: {
						...building,
						assignedHeroIds: [...building.assignedHeroIds, hero.heroId].sort((left, right) =>
							left.localeCompare(right)
						)
					}
				}
			};
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement,
			heroes: {
				...state.heroes,
				[payload.heroId]: { ...hero, assignment: payload.assignment }
			}
		});
	}
	if (event.eventType === 'settlement.power.allocated') {
		if (!hasFacilityState(state))
			throw new ReplayIntegrityError('Power event requires engine-v4', event.sequence);
		const payload = PowerAllocatedPayloadSchema.parse(event.payload);
		if (state.settlement.poweredBuildingId !== payload.previousPoweredBuildingId) {
			throw new ReplayIntegrityError('Power allocation precondition failed', event.sequence);
		}
		const buildings = { ...state.settlement.buildings };
		for (const change of payload.powerStateChanges) {
			const building = buildings[change.buildingId];
			if (!building || building.powerState !== change.before) {
				throw new ReplayIntegrityError('Building power precondition failed', event.sequence);
			}
			buildings[change.buildingId] = { ...building, powerState: change.after };
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement: {
				...state.settlement,
				poweredBuildingId: payload.buildingId,
				buildings,
				navigation: {
					...state.settlement.navigation,
					activeSystemIds: payload.activeSystemIdsAfter
				}
			}
		});
	}
	if (event.eventType === 'hero.destination.selected') {
		const payload = ChoosePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError(
				'Destination event references an unknown hero',
				event.sequence
			);
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, destination: payload.destination } },
			story: { ...state.story, branch: payload.storyBranch }
		});
	}
	if (event.eventType === 'hero.travel.started') {
		if (!hasNavigationState(state))
			throw new ReplayIntegrityError('Travel event requires navigation state', event.sequence);
		const payload = TravelStartedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (
			!hero ||
			hero.currentActivity ||
			hero.currentTravel ||
			hero.locationNodeId !== payload.fromNodeId ||
			state.settlement.navigation.contentVersion !== payload.settlementContentVersion ||
			state.settlement.navigation.contentHash !== payload.settlementContentHash
		) {
			throw new ReplayIntegrityError('Travel start precondition failed', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: {
				...state.heroes,
				[payload.heroId]: {
					...hero,
					currentTravel: {
						travelId: payload.travelId,
						scheduledEventId: payload.scheduledEvent.scheduledEventId,
						fromNodeId: payload.fromNodeId,
						toNodeId: payload.toNodeId,
						destinationZone: payload.destinationZone,
						route: payload.route,
						settlementContentVersion: payload.settlementContentVersion,
						settlementContentHash: payload.settlementContentHash,
						startedAt: state.simulatedAt,
						arrivesAt: payload.scheduledEvent.dueGameTime
					}
				}
			}
		});
	}
	if (event.eventType === 'hero.arrived') {
		const payload = ArrivePayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero)
			throw new ReplayIntegrityError('Arrival event references an unknown hero', event.sequence);
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: { ...state.heroes, [payload.heroId]: { ...hero, location: payload.destination } }
		});
	}
	if (event.eventType === 'master.gate.inspected') {
		const payload = InspectPayloadSchema.parse(event.payload);
		return parseModernState(state, {
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
	if (event.eventType === 'hero.activity.started') {
		const payload = ActivityStartedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (!hero || hero.currentActivity || currentTravelFor(state, payload.heroId))
			throw new ReplayIntegrityError('Activity start is not legal', event.sequence);
		const settlement = applyResourceChanges(state, event, payload.resourceChanges);
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement,
			heroes: {
				...state.heroes,
				[payload.heroId]: {
					...hero,
					currentActivity: {
						activityId: payload.activityId,
						scheduledEventId: payload.scheduledEvent.scheduledEventId,
						kind: payload.activity,
						startedAt: state.simulatedAt,
						completesAt: payload.scheduledEvent.dueGameTime
					}
				}
			}
		});
	}
	if (event.eventType === 'hero.item.equipped') {
		const payload = ItemEquippedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		const item = state.items[payload.itemId];
		if (!hero || !item || item.ownerId !== hero.heroId)
			throw new ReplayIntegrityError('Equipment ownership failed', event.sequence);
		const items = { ...state.items };
		if (payload.previousItemId) {
			const previous = items[payload.previousItemId];
			if (previous) items[payload.previousItemId] = { ...previous, equippedById: null };
		}
		items[payload.itemId] = { ...item, equippedById: hero.heroId };
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			items,
			heroes: {
				...state.heroes,
				[payload.heroId]: { ...hero, equipment: { mainHand: payload.itemId } }
			}
		});
	}
	if (event.eventType === 'simulation.advanced') {
		if (hasRoutineState(state)) {
			const payload = SimulationAdvancedPayloadV5Schema.parse(event.payload);
			const heroes = { ...state.heroes };
			const items = { ...state.items };
			let settlement = state.settlement;
			for (const outcome of payload.activityOutcomes) {
				const hero = heroes[outcome.heroId];
				if (
					!hero?.currentActivity ||
					hero.currentActivity.scheduledEventId !== outcome.scheduledEventId ||
					compareGameTime(hero.currentActivity.completesAt, payload.targetGameTime) > 0
				) {
					throw new ReplayIntegrityError('Scheduled activity precondition failed', event.sequence);
				}
				heroes[outcome.heroId] = {
					...hero,
					health: outcome.healthAfter,
					lifeState: outcome.lifeStateAfter,
					needs: outcome.needsAfter,
					injuries: outcome.injuriesAfter,
					progression: outcome.progressionAfter,
					currentActivity: null,
					assignment: outcome.lifeStateAfter === 'active' ? hero.assignment : null,
					dailyPlan:
						outcome.lifeStateAfter === 'active'
							? hero.dailyPlan
							: skipUnfinishedPlan(hero, payload.targetGameTime)
				};
				if (outcome.lifeStateAfter !== 'active' && hero.assignment) {
					settlement = clearBuildingAssignment(
						settlement,
						outcome.heroId,
						hero.assignment.buildingId
					);
				}
				if (outcome.itemUpdate) {
					const item = items[outcome.itemUpdate.itemId];
					if (!item) throw new ReplayIntegrityError('Activity item disappeared', event.sequence);
					items[item.itemId] = { ...item, durability: outcome.itemUpdate.durabilityAfter };
				}
			}
			for (const outcome of payload.travelOutcomes) {
				const hero = heroes[outcome.heroId];
				if (
					!hero?.currentTravel ||
					hero.currentTravel.scheduledEventId !== outcome.scheduledEventId ||
					hero.currentTravel.travelId !== outcome.travelId ||
					hero.currentTravel.fromNodeId !== outcome.fromNodeId ||
					hero.currentTravel.toNodeId !== outcome.toNodeId ||
					compareGameTime(hero.currentTravel.arrivesAt, payload.targetGameTime) > 0
				) {
					throw new ReplayIntegrityError('Scheduled travel precondition failed', event.sequence);
				}
				heroes[outcome.heroId] = {
					...hero,
					location: outcome.locationAfter,
					locationNodeId: outcome.toNodeId,
					firstArrivalCompleted: true,
					currentTravel: null
				};
			}
			for (const outcome of payload.routineOutcomes) {
				const heroBefore = state.heroes[outcome.heroId];
				const hero = heroes[outcome.heroId];
				const routine = hero?.currentRoutine;
				const activeEntry = hero?.dailyPlan?.entries.find(
					(entry) => entry.planEntryId === outcome.planEntryId
				);
				const expected = heroBefore?.currentRoutine
					? buildRoutineOutcome(state, outcome.heroId)
					: null;
				if (
					!hero ||
					!routine ||
					!hero.dailyPlan ||
					activeEntry?.status !== 'active' ||
					routine.scheduledEventId !== outcome.scheduledEventId ||
					routine.planId !== outcome.planId ||
					routine.planEntryId !== outcome.planEntryId ||
					routine.kind !== outcome.kind ||
					compareGameTime(routine.completesAt, payload.targetGameTime) > 0 ||
					!expected ||
					hashCanonical(expected) !== hashCanonical(outcome)
				) {
					throw new ReplayIntegrityError('Scheduled routine precondition failed', event.sequence);
				}
				const dailyPlan = DailyPlanSchema.parse({
					...hero.dailyPlan,
					entries: hero.dailyPlan.entries.map((entry) =>
						entry.planEntryId === outcome.planEntryId
							? { ...entry, status: 'completed', completedAt: routine.completesAt }
							: entry
					)
				});
				heroes[outcome.heroId] = {
					...hero,
					health: outcome.healthAfter,
					needs: outcome.needsAfter,
					habit: outcome.habitAfter,
					dailyPlan,
					currentRoutine: null
				};
			}
			if (
				state.schemaVersion === 10 ||
				state.schemaVersion === 11 ||
				state.schemaVersion === 12 ||
				state.schemaVersion === 13
			) {
				const society = SocietyStateV4Schema.parse({
					...state.society,
					directives: Object.fromEntries(
						Object.entries(state.society.directives).map(([directiveId, directive]) => [
							directiveId,
							(payload.expiredDirectiveIds ?? []).includes(directiveId)
								? DirectiveRecordSchema.parse({
										...directive,
										status: 'expired',
										terminalAt: directive.expiresAt,
										terminalEventId: event.eventId
									})
								: directive
						])
					)
				});
				return parseModernState(state, {
					...state,
					version: payload.nextVersion,
					eventCursor: event.sequence,
					entropyCursor: event.seedCursor,
					simulatedAt: payload.targetGameTime,
					heroes,
					items,
					settlement,
					society
				});
			}
			return parseModernState(state, {
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				simulatedAt: payload.targetGameTime,
				heroes,
				items,
				settlement
			});
		}
		if (state.schemaVersion === 3 || state.schemaVersion === 4) {
			const payload = SimulationAdvancedPayloadV3Schema.parse(event.payload);
			const heroes = { ...state.heroes };
			const items = { ...state.items };
			for (const outcome of payload.activityOutcomes) {
				const hero = heroes[outcome.heroId];
				if (
					!hero?.currentActivity ||
					hero.currentActivity.scheduledEventId !== outcome.scheduledEventId ||
					compareGameTime(hero.currentActivity.completesAt, payload.targetGameTime) > 0
				) {
					throw new ReplayIntegrityError('Scheduled activity precondition failed', event.sequence);
				}
				heroes[outcome.heroId] = {
					...hero,
					health: outcome.healthAfter,
					lifeState: outcome.lifeStateAfter,
					needs: outcome.needsAfter,
					injuries: outcome.injuriesAfter,
					progression: outcome.progressionAfter,
					currentActivity: null
				};
				if (outcome.itemUpdate) {
					const item = items[outcome.itemUpdate.itemId];
					if (!item) throw new ReplayIntegrityError('Activity item disappeared', event.sequence);
					items[item.itemId] = { ...item, durability: outcome.itemUpdate.durabilityAfter };
				}
			}
			for (const outcome of payload.travelOutcomes) {
				const hero = heroes[outcome.heroId];
				if (
					!hero?.currentTravel ||
					hero.currentTravel.scheduledEventId !== outcome.scheduledEventId ||
					hero.currentTravel.travelId !== outcome.travelId ||
					hero.currentTravel.fromNodeId !== outcome.fromNodeId ||
					hero.currentTravel.toNodeId !== outcome.toNodeId ||
					compareGameTime(hero.currentTravel.arrivesAt, payload.targetGameTime) > 0
				) {
					throw new ReplayIntegrityError('Scheduled travel precondition failed', event.sequence);
				}
				heroes[outcome.heroId] = {
					...hero,
					location: outcome.locationAfter,
					locationNodeId: outcome.toNodeId,
					firstArrivalCompleted: true,
					currentTravel: null
				};
			}
			let settlement = state.settlement;
			if (state.schemaVersion === 4) {
				let settlementV4 = state.settlement;
				for (const outcome of payload.activityOutcomes) {
					if (outcome.lifeStateAfter !== 'active') {
						const assignment = state.heroes[outcome.heroId]?.assignment;
						if (assignment) {
							settlementV4 = clearBuildingAssignment(
								settlementV4,
								outcome.heroId,
								assignment.buildingId
							);
							heroes[outcome.heroId] = { ...heroes[outcome.heroId]!, assignment: null };
						}
					}
				}
				settlement = settlementV4;
			}
			return parseModernState(state, {
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				simulatedAt: payload.targetGameTime,
				heroes,
				items,
				settlement
			});
		}
		const payload = SimulationAdvancedPayloadSchema.parse(event.payload);
		const heroes = { ...state.heroes };
		const items = { ...state.items };
		for (const outcome of payload.outcomes) {
			const hero = heroes[outcome.heroId];
			if (
				!hero?.currentActivity ||
				hero.currentActivity.scheduledEventId !== outcome.scheduledEventId ||
				compareGameTime(hero.currentActivity.completesAt, payload.targetGameTime) > 0
			) {
				throw new ReplayIntegrityError('Scheduled activity precondition failed', event.sequence);
			}
			heroes[outcome.heroId] = {
				...hero,
				health: outcome.healthAfter,
				lifeState: outcome.lifeStateAfter,
				needs: outcome.needsAfter,
				injuries: outcome.injuriesAfter,
				progression: outcome.progressionAfter,
				currentActivity: null
			};
			if (outcome.itemUpdate) {
				const item = items[outcome.itemUpdate.itemId];
				if (!item) throw new ReplayIntegrityError('Activity item disappeared', event.sequence);
				items[item.itemId] = { ...item, durability: outcome.itemUpdate.durabilityAfter };
			}
		}
		return EngineGameStateV2Schema.parse({
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			simulatedAt: payload.targetGameTime,
			heroes,
			items
		});
	}
	if (['master.damaged', 'master.died', 'hero.damaged', 'hero.died'].includes(event.eventType)) {
		const payload = DamagePayloadSchema.parse(event.payload);
		if (payload.targetKind === 'master') {
			if (state.master.health !== payload.healthBefore)
				throw new ReplayIntegrityError('Master damage precondition failed', event.sequence);
			const dead = payload.healthAfter === 0;
			const heroes = dead
				? Object.fromEntries(
						Object.entries(state.heroes).map(([id, hero]) => {
							const routineState = hasRoutineState(state)
								? {
										currentRoutine: null,
										dailyPlan: skipUnfinishedPlan(state.heroes[id]!, state.simulatedAt)
									}
								: {};
							return [
								id,
								{
									...hero,
									currentActivity: null,
									...(hasNavigationState(state) ? { currentTravel: null } : {}),
									...routineState
								}
							];
						})
					)
				: state.heroes;
			return parseModernState(state, {
				...state,
				status: dead ? 'game_over' : state.status,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				heroes,
				master: {
					...state.master,
					health: payload.healthAfter,
					lifeState: dead ? 'dead' : 'alive',
					injuries: payload.injury
						? [...state.master.injuries, payload.injury]
						: state.master.injuries
				}
			});
		}
		const hero = state.heroes[payload.targetId];
		if (!hero || hero.health !== payload.healthBefore)
			throw new ReplayIntegrityError('Hero damage precondition failed', event.sequence);
		const dead = payload.healthAfter === 0;
		const assignment = hasFacilityState(state) ? state.heroes[payload.targetId]?.assignment : null;
		const settlement =
			hasFacilityState(state) && dead && assignment
				? clearBuildingAssignment(state.settlement, hero.heroId, assignment.buildingId)
				: state.settlement;
		const routineState = hasRoutineState(state)
			? {
					currentRoutine: dead ? null : state.heroes[payload.targetId]!.currentRoutine,
					dailyPlan: dead
						? skipUnfinishedPlan(state.heroes[payload.targetId]!, state.simulatedAt)
						: state.heroes[payload.targetId]!.dailyPlan
				}
			: {};
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement,
			heroes: {
				...state.heroes,
				[payload.targetId]: {
					...hero,
					health: payload.healthAfter,
					lifeState: dead ? 'dead' : 'active',
					injuries: payload.injury ? [...hero.injuries, payload.injury] : hero.injuries,
					currentActivity: dead ? null : hero.currentActivity,
					...(hasNavigationState(state)
						? { currentTravel: dead ? null : currentTravelFor(state, payload.targetId) }
						: {}),
					...(hasFacilityState(state) ? { assignment: dead ? null : assignment } : {}),
					...routineState
				}
			}
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
