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
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema,
	EngineGameStateV8Schema,
	EngineGameStateV9Schema,
	EngineSnapshotSchema,
	EntropyDrawSchema,
	HeroBuildingAssignmentSchema,
	HeroDecisionPacketSchema,
	HeroPolicyResultSchema,
	HeroProgressionSchema,
	HabitStateSchema,
	FirstEmberStateSchema,
	InjurySchema,
	LegalActionSchema,
	NeedStateSchema,
	ResourceKeySchema,
	RewardDeltaSchema,
	RoutineResolutionSchema,
	ScheduledEventSchema,
	SettlementRoutePlanSchema,
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	type ActivityKind,
	type AuthoritativeEvent,
	type BuildingAssignmentRole,
	type CharacterMind,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV1,
	type EngineGameStateV2,
	type EngineGameStateV3,
	type EngineGameStateV4,
	type EngineGameStateV5,
	type EngineGameStateV6,
	type EngineGameStateV7,
	type EngineGameStateV8,
	type EngineGameStateV9,
	type EngineSnapshot,
	type EntropyDraw,
	type FirstEmberFacility,
	type FirstEmberRationale,
	type ConversationOrderIntent,
	type ConversationOrderOutcome,
	type HeroDecisionPacket,
	type HeroPolicyResult,
	type LegalAction,
	type RewardDelta,
	type RoutineKind,
	type SettlementDefinition,
	type SocietyState,
	type SocietyStateV2,
	type SocietyStateV3,
	type ScheduledEvent
} from '@summonlab/contracts';
import { HEARTH_01_DEFINITION, planSettlementRoute } from '@summonlab/content';
import { z } from 'zod';

import { createEntropyCursor, drawInteger } from './entropy.js';
import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from './errors.js';
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from './hash.js';
import { eventDeltas, eventSummary } from './journal.js';
import { addGameMinutes, addGameSeconds, compareGameTime, gameMinutesBetween } from './time.js';

export const ENGINE_CONTENT_VERSION = 'engine-v9';
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

const DEFAULT_ACTIVE_SYSTEM_IDS = Object.freeze([
	'dormitory-system',
	'gate-system',
	'hearth-system',
	'training-system'
] as const);

type EngineGameStateModern =
	| EngineGameStateV2
	| EngineGameStateV3
	| EngineGameStateV4
	| EngineGameStateV5
	| EngineGameStateV6
	| EngineGameStateV7
	| EngineGameStateV8
	| EngineGameStateV9;
type EngineRoutineState =
	EngineGameStateV5 | EngineGameStateV6 | EngineGameStateV7 | EngineGameStateV8 | EngineGameStateV9;

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

export interface BootstrapEngineInput {
	readonly runId: string;
	readonly seed: string;
	readonly heroId: string;
	readonly manifestHash: string;
	readonly rarityStars?: number;
	readonly simulatedAt?: string;
	readonly mind?: CharacterMind;
}

export interface BootstrapEngineResult {
	readonly snapshot: EngineSnapshot;
	readonly event: AuthoritativeEvent;
}

export interface EngineApplyResult {
	readonly state: EngineGameState;
	readonly stateHash: string;
	readonly events: readonly AuthoritativeEvent[];
	readonly scheduled: readonly ScheduledEvent[];
	readonly resolvedScheduledEventIds: readonly string[];
	readonly canceledScheduledEventIds: readonly string[];
	readonly decisionRequests: readonly never[];
	readonly legalActions: readonly LegalAction[];
}

const RewardDeltasSchema = z.array(RewardDeltaSchema);
const EmptyMetadataSchema = z.object({
	summary: z.string().min(1).max(1_000),
	rewardDeltas: RewardDeltasSchema,
	resolvedScheduledEventIds: z.array(z.string().uuid()),
	canceledScheduledEventIds: z.array(z.string().uuid()),
	entropyDraws: z.array(EntropyDrawSchema)
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
	society: z.union([SocietyStateSchema, SocietyStateV2Schema, SocietyStateV3Schema]).optional(),
	previousPoweredBuildingId: z.string().nullable(),
	powerStateChanges: z.array(PowerStateChangeSchema).min(1),
	activeSystemIdsAfter: z.array(z.string()),
	nextVersion: z.number().int().nonnegative()
}).strict();

const CommunicativeActRecordedPayloadSchema = EmptyMetadataSchema.extend({
	communicativeAct: CommunicativeActSchema,
	society: z.union([SocietyStateV2Schema, SocietyStateV3Schema]),
	nextVersion: z.number().int().nonnegative()
}).strict();

const ConversationTurnRecordedPayloadSchema = EmptyMetadataSchema.extend({
	conversationTurn: HeroConversationTurnSchema,
	society: SocietyStateV3Schema,
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

function systemSource() {
	return {
		source: 'system' as const,
		timing: null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function emptyMetadata(summary: string, rewardDeltas: readonly RewardDelta[] = []) {
	return {
		summary,
		rewardDeltas,
		resolvedScheduledEventIds: [] as string[],
		canceledScheduledEventIds: [] as string[],
		entropyDraws: [] as EntropyDraw[]
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
): SocietyStateV3 {
	const observationId = deterministicUuid(`${eventId}:${heroId}:awakening-observation`);
	const selfBeliefId = deterministicUuid(`${observationId}:self-awakened`);
	const presenceBeliefId = deterministicUuid(`${observationId}:master-present`);
	const relationshipId = deterministicUuid(`${heroId}:${masterId}:relationship`);
	const authorityId = deterministicUuid(`${heroId}:${masterId}:authority`);
	return SocietyStateV3Schema.parse({
		contentVersion: 'society-v3',
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
		conversationTurns: {}
	});
}

export function hashGameState(state: EngineGameState): string {
	return hashParsedGameState(EngineGameStateSchema.parse(state));
}

function hashParsedGameState(state: EngineGameState): string {
	return hashCanonical(state);
}

export function createBootstrapEngine(input: BootstrapEngineInput): BootstrapEngineResult {
	const masterId = deterministicUuid(`${input.runId}:master`);
	const commandId = deterministicUuid(`${input.runId}:bootstrap`);
	const eventId = deterministicUuid(`${commandId}:1:run.initialized`);
	const bladeId = deterministicUuid(`${input.runId}:${input.heroId}:practice-blade`);
	const bowId = deterministicUuid(`${input.runId}:${input.heroId}:short-bow`);
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
	const mind = CharacterMindSchema.parse(input.mind ?? DEFAULT_CHARACTER_MIND);
	const state = EngineGameStateV9Schema.parse({
		schemaVersion: 9,
		runId: input.runId,
		seed: input.seed,
		contentVersion: ENGINE_CONTENT_VERSION,
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
		heroes: {
			[input.heroId]: {
				heroId: input.heroId,
				lifeState: 'active',
				location: 'summoning-gate',
				locationNodeId: settlementContent.spawnNodeId,
				firstArrivalCompleted: false,
				destination: null,
				health: 100,
				maxHealth: 100,
				manifestHash: input.manifestHash,
				needs: { hunger: 20, fatigue: 15 },
				injuries: [],
				progression: {
					stars: input.rarityStars ?? 1,
					level: 1,
					experience: 0,
					skills: { swordFighting: { rank: 0, experience: 0 } }
				},
				equipment: { mainHand: bladeId },
				currentActivity: null,
				currentTravel: null,
				assignment: null,
				mind,
				habit: {
					habit: mind.dailyHabit,
					strength: clamp(Math.round(35 + mind.personality.conscientiousness * 0.55)),
					repetitions: 0,
					satisfaction: 50,
					lastTriggeredAt: null
				},
				dailyPlan: null,
				currentRoutine: null
			}
		},
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
		items: {
			[bladeId]: {
				itemId: bladeId,
				templateId: 'practice-blade',
				displayName: 'Gatehouse Practice Blade',
				ownerId: input.heroId,
				slot: 'main-hand',
				equippedById: input.heroId,
				durability: 6,
				maxDurability: 6
			},
			[bowId]: {
				itemId: bowId,
				templateId: 'short-bow',
				displayName: 'Ash Short Bow',
				ownerId: input.heroId,
				slot: 'main-hand',
				equippedById: null,
				durability: 4,
				maxDurability: 4
			}
		},
		society: createBootstrapSociety(input.heroId, masterId, eventId, simulatedAt),
		story: { envelopeId: 'first-ember-v1', branch: null }
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
				'The Master awakened beside a stocked gate and one new summon.',
				rewardDeltas
			)
		}
	});
	return { snapshot: EngineSnapshotSchema.parse({ state, stateHash }), event };
}

let verifiedSettlement: SettlementDefinition | undefined;

function verifiedSettlementContent(): SettlementDefinition {
	if (verifiedSettlement) return verifiedSettlement;
	const { contentHash, ...payload } = HEARTH_01_DEFINITION;
	const calculatedHash = hashCanonical(payload);
	if (calculatedHash !== contentHash) {
		throw new Error(
			`Hearth 01 content hash drifted: expected ${contentHash}, calculated ${calculatedHash}`
		);
	}
	verifiedSettlement = HEARTH_01_DEFINITION;
	return verifiedSettlement;
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
	state: EngineGameStateV7 | EngineGameStateV8 | EngineGameStateV9,
	eventId: string,
	buildingId: FirstEmberFacility,
	rationale: FirstEmberRationale,
	reactions: readonly ReturnType<typeof buildFirstEmberReaction>[]
): SocietyState | SocietyStateV2 | SocietyStateV3 {
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
type EngineCommunicationState = EngineGameStateV8 | EngineGameStateV9;

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
	society: SocietyStateV2 | SocietyStateV3;
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
			state.schemaVersion === 9
				? SocietyStateV3Schema.parse(candidate)
				: SocietyStateV2Schema.parse(candidate)
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
	state: EngineGameStateV9,
	hero: EngineGameStateV9['heroes'][string],
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

function conversationVoice(hero: EngineGameStateV9['heroes'][string]): {
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
	state: EngineGameStateV9,
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
	state: EngineGameStateV9,
	eventId: string,
	command: MasterConverseCommand
): { society: SocietyStateV3; conversationTurn: z.infer<typeof HeroConversationTurnSchema> } {
	const communication = buildCommunicativeSociety(state, eventId, {
		targetHeroId: command.targetHeroId,
		kind: command.kind === 'say' ? 'tell' : command.kind,
		topic: command.kind === 'order' ? 'daily-order' : 'open-conversation',
		exactText: command.exactText,
		tone: command.tone,
		delivery: command.delivery
	});
	const baseSociety = SocietyStateV3Schema.parse(communication.society);
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
	const society = SocietyStateV3Schema.parse({
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
	});
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

function settlementForState(
	state:
		| EngineGameStateV3
		| EngineGameStateV4
		| EngineGameStateV5
		| EngineGameStateV6
		| EngineGameStateV7
		| EngineGameStateV8
		| EngineGameStateV9
): SettlementDefinition {
	const definition = verifiedSettlementContent();
	const binding = state.settlement.navigation;
	if (
		binding.settlementId !== definition.settlementId ||
		binding.contentVersion !== definition.contentVersion ||
		binding.contentHash !== definition.contentHash
	) {
		throw new ReplayIntegrityError('Settlement content binding is unavailable', state.eventCursor);
	}
	return definition;
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
		| EngineGameStateV9,
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
		| EngineGameStateV9,
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
		state.schemaVersion === 9
		? (state.heroes[heroId]?.currentTravel ?? null)
		: null;
}

function currentRoutineFor(state: EngineGameState, heroId: string) {
	return state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9
		? (state.heroes[heroId]?.currentRoutine ?? null)
		: null;
}

function hasNavigationState(
	state: EngineGameState
): state is
	| EngineGameStateV3
	| EngineGameStateV4
	| EngineGameStateV5
	| EngineGameStateV6
	| EngineGameStateV7
	| EngineGameStateV8
	| EngineGameStateV9 {
	return [3, 4, 5, 6, 7, 8, 9].includes(state.schemaVersion);
}

function hasFacilityState(
	state: EngineGameState
): state is
	| EngineGameStateV4
	| EngineGameStateV5
	| EngineGameStateV6
	| EngineGameStateV7
	| EngineGameStateV8
	| EngineGameStateV9 {
	return [4, 5, 6, 7, 8, 9].includes(state.schemaVersion);
}

function hasRoutineState(state: EngineGameState): state is EngineRoutineState {
	return (
		state.schemaVersion === 5 ||
		state.schemaVersion === 6 ||
		state.schemaVersion === 7 ||
		state.schemaVersion === 8 ||
		state.schemaVersion === 9
	);
}

function hasFirstEmberState(
	state: EngineGameState
): state is EngineGameStateV6 | EngineGameStateV7 | EngineGameStateV8 | EngineGameStateV9 {
	return [6, 7, 8, 9].includes(state.schemaVersion);
}

function isModernState(state: EngineGameState): state is EngineGameStateModern {
	return state.schemaVersion !== 1;
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
		stateInput.schemaVersion === 9
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
	const actions = [
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
	if (
		Object.values(state.heroes).some(
			(hero) =>
				hero.currentActivity ||
				currentTravelFor(state, hero.heroId) ||
				currentRoutineFor(state, hero.heroId)
		)
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
		state.schemaVersion === 9
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
	if (state.schemaVersion === 8 || state.schemaVersion === 9) {
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
			if (state.schemaVersion === 9) {
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
		Object.values(state.heroes)
			.flatMap((hero) => [
				hero.currentActivity?.completesAt,
				currentTravelFor(state, hero.heroId)?.arrivesAt,
				currentRoutineFor(state, hero.heroId)?.completesAt
			])
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
	if (command.commandType === 'hero.plan.day') return 'hero.plan.day';
	if (command.commandType === 'hero.start.routine') return 'hero.follow.plan';
	if (command.commandType === 'master.inspect.gate') return 'master.inspect.gate';
	if (command.commandType === 'hero.start.activity') return `hero.activity.${command.activity}`;
	if (command.commandType === 'hero.equip.item') return `hero.equip.${command.itemId}`;
	if (command.commandType === 'simulation.advance') return 'simulation.advance';
	if (command.commandType === 'simulation.sync.clock') return 'simulation.sync.clock';
	return command.targetId === command.actorId
		? 'simulation.damage.master'
		: `simulation.damage.hero.${command.targetId}`;
}

function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
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
			(state.schemaVersion !== 8 && state.schemaVersion !== 9) ||
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
			state.schemaVersion !== 9 ||
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
}

function eventBase(state: EngineGameState, command: EngineCommand, eventType: string) {
	const sequence = state.eventCursor + 1;
	return {
		eventId: deterministicUuid(`${command.commandId}:${sequence}:${eventType}`),
		runId: state.runId,
		sequence,
		schemaVersion: state.schemaVersion,
		gameTime: state.simulatedAt,
		eventType,
		actorId: command.actorId,
		commandId: command.commandId,
		causationId: null,
		correlationId: command.correlationId,
		source: command.source,
		beforeStateHash: hashParsedGameState(state),
		afterStateHash: EMPTY_STATE_HASH,
		contentVersion: state.contentVersion
	};
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

function buildV2Event(state: EngineGameStateModern, command: EngineCommand): AuthoritativeEvent {
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
			state.schemaVersion === 7 || state.schemaVersion === 8 || state.schemaVersion === 9
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
	if (command.commandType === 'master.communicate') {
		if (state.schemaVersion !== 8 && state.schemaVersion !== 9) {
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
		if (state.schemaVersion !== 9) throw new IllegalActionError(command.commandType);
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
			const resolvedScheduledEventIds = [
				...outcomes.map((outcome) => outcome.scheduledEventId),
				...travelOutcomes.map((outcome) => outcome.scheduledEventId),
				...routineOutcomes.map((outcome) => outcome.scheduledEventId)
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
						: `${routineOutcomes.length} daily routines`
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

function parseModernState(state: EngineGameStateModern, value: unknown): EngineGameStateModern {
	if (state.schemaVersion === 2) return EngineGameStateV2Schema.parse(value);
	if (state.schemaVersion === 3) return EngineGameStateV3Schema.parse(value);
	if (state.schemaVersion === 4) return EngineGameStateV4Schema.parse(value);
	if (state.schemaVersion === 5) return EngineGameStateV5Schema.parse(value);
	if (state.schemaVersion === 6) return EngineGameStateV6Schema.parse(value);
	if (state.schemaVersion === 7) return EngineGameStateV7Schema.parse(value);
	if (state.schemaVersion === 8) return EngineGameStateV8Schema.parse(value);
	return EngineGameStateV9Schema.parse(value);
}

function reduceV2Event(
	state: EngineGameStateModern,
	event: AuthoritativeEvent
): EngineGameStateModern {
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
		let society: SocietyState | SocietyStateV2 | SocietyStateV3 | undefined;
		if (state.schemaVersion === 7 || state.schemaVersion === 8 || state.schemaVersion === 9) {
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
	if (event.eventType === 'social.communicative.act.recorded') {
		if (
			(state.schemaVersion !== 8 && state.schemaVersion !== 9) ||
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
			state.schemaVersion !== 9 ||
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
		return EngineGameStateV9Schema.parse({
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
	return state.schemaVersion === 1 ? reduceLegacyEvent(state, event) : reduceV2Event(state, event);
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

function metadataIds(
	event: AuthoritativeEvent,
	key: 'resolvedScheduledEventIds' | 'canceledScheduledEventIds'
): string[] {
	const payload = event.payload as Record<string, unknown>;
	return z.array(z.string().uuid()).parse(payload[key] ?? []);
}

export function scheduledEventsFromEvent(event: AuthoritativeEvent): readonly ScheduledEvent[] {
	if (event.eventType === 'hero.activity.started')
		return [ActivityStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.travel.started')
		return [TravelStartedPayloadSchema.parse(event.payload).scheduledEvent];
	if (event.eventType === 'hero.routine.started')
		return [RoutineStartedPayloadSchema.parse(event.payload).scheduledEvent];
	return [];
}

export function resolvedScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'resolvedScheduledEventIds');
}

export function canceledScheduledEventIdsFromEvent(event: AuthoritativeEvent): readonly string[] {
	return metadataIds(event, 'canceledScheduledEventIds');
}

export function applyCommand(
	stateInput: EngineGameState,
	commandInput: EngineCommand
): EngineApplyResult {
	const state = EngineGameStateSchema.parse(stateInput);
	const command = EngineCommandSchema.parse(commandInput);
	assertCommandIsLegal(state, command);
	const eventDraft =
		state.schemaVersion === 1 ? buildLegacyEvent(state, command) : buildV2Event(state, command);
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

export interface ReplayCheck {
	readonly sequence: number;
	readonly gameTime: string;
	readonly eventType: string;
	readonly actorId: string | null;
	readonly source: AuthoritativeEvent['source'];
	readonly summary: string;
	readonly beforeStateHash: string;
	readonly afterStateHash: string;
	readonly computedStateHash: string;
	readonly verified: boolean;
	readonly entropyDraws: readonly EntropyDraw[];
	readonly deltas: readonly RewardDelta[];
}

export interface ReplayResult {
	readonly snapshot: EngineSnapshot;
	readonly checks: readonly ReplayCheck[];
	readonly verified: boolean;
}

function entropyDrawsFromEvent(event: AuthoritativeEvent): readonly EntropyDraw[] {
	const payload = event.payload as Record<string, unknown>;
	return z.array(EntropyDrawSchema).parse(payload.entropyDraws ?? []);
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
