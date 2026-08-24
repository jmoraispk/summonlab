import {
	AuthoritativeEventSchema,
	EngineCommandSchema,
	EngineGameStateSchema,
	EngineGameStateV1Schema,
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineSnapshotSchema,
	EntropyDrawSchema,
	HeroProgressionSchema,
	InjurySchema,
	LegalActionSchema,
	NeedStateSchema,
	ResourceKeySchema,
	RewardDeltaSchema,
	ScheduledEventSchema,
	SettlementRoutePlanSchema,
	type ActivityKind,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV1,
	type EngineGameStateV2,
	type EngineGameStateV3,
	type EngineSnapshot,
	type EntropyDraw,
	type LegalAction,
	type RewardDelta,
	type SettlementDefinition,
	type ScheduledEvent
} from '@summonlab/contracts';
import { HEARTH_01_DEFINITION, planSettlementRoute } from '@summonlab/content';
import { z } from 'zod';

import { createEntropyCursor, drawInteger } from './entropy.js';
import { IllegalActionError, ReplayIntegrityError, StaleStateVersionError } from './errors.js';
import { deterministicUuid, EMPTY_STATE_HASH, hashCanonical } from './hash.js';
import { eventDeltas, eventSummary } from './journal.js';
import { addGameMinutes, addGameSeconds, compareGameTime, gameMinutesBetween } from './time.js';

export const ENGINE_CONTENT_VERSION = 'engine-v3';
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

type EngineGameStateModern = EngineGameStateV2 | EngineGameStateV3;

export interface BootstrapEngineInput {
	readonly runId: string;
	readonly seed: string;
	readonly heroId: string;
	readonly manifestHash: string;
	readonly rarityStars?: number;
	readonly simulatedAt?: string;
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

export function hashGameState(state: EngineGameState): string {
	return hashCanonical(EngineGameStateSchema.parse(state));
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
	const state = EngineGameStateV3Schema.parse({
		schemaVersion: 3,
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
				currentTravel: null
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
		story: { envelopeId: 'first-ember-v1', branch: null }
	});
	const stateHash = hashGameState(state);
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

function settlementForState(state: EngineGameStateV3): SettlementDefinition {
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

function currentTravelFor(state: EngineGameState, heroId: string) {
	return state.schemaVersion === 3 ? (state.heroes[heroId]?.currentTravel ?? null) : null;
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
	const awaitingFirstArrival =
		state.schemaVersion === 3 ? !state.heroes[actorId]!.firstArrivalCompleted : false;
	if ((state.schemaVersion !== 3 && hero.location === 'summoning-gate') || awaitingFirstArrival) {
		return [
			action({
				actionId: state.schemaVersion === 3 ? 'hero.travel' : 'hero.arrive.destination',
				actorId,
				kind: 'move',
				label: `Walk to the ${hero.destination === 'kitchen' ? 'kitchen' : 'training ground'}`,
				description:
					state.schemaVersion === 3
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
			(hero) => hero.currentActivity || currentTravelFor(state, hero.heroId)
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
		currentTravelFor(state, actorId)
	)
		return [];
	const actions: LegalAction[] = [];
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
	if (state.schemaVersion === 3) {
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

export function legalActions(stateInput: EngineGameState, actorId: string): readonly LegalAction[] {
	const state = EngineGameStateSchema.parse(stateInput);
	if (state.status !== 'active') return [];
	if (actorId === state.master.masterId && state.master.lifeState === 'alive') {
		if (state.schemaVersion === 2 || state.schemaVersion === 3) return masterActionsV2(state);
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
	return state.schemaVersion === 2 || state.schemaVersion === 3
		? heroActionsV2(state, actorId)
		: routeActions(state, actorId);
}

function earliestScheduledTime(state: EngineGameStateModern): string | null {
	return (
		Object.values(state.heroes)
			.flatMap((hero) => [
				hero.currentActivity?.completesAt,
				currentTravelFor(state, hero.heroId)?.arrivesAt
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
	if (command.commandType === 'master.inspect.gate') return 'master.inspect.gate';
	if (command.commandType === 'hero.start.activity') return `hero.activity.${command.activity}`;
	if (command.commandType === 'hero.equip.item') return `hero.equip.${command.itemId}`;
	if (command.commandType === 'simulation.advance') return 'simulation.advance';
	return command.targetId === command.actorId
		? 'simulation.damage.master'
		: `simulation.damage.hero.${command.targetId}`;
}

function assertCommandIsLegal(state: EngineGameState, command: EngineCommand): void {
	if (command.runId !== state.runId) throw new IllegalActionError(command.commandType, []);
	if (command.expectedVersion !== state.version) {
		throw new StaleStateVersionError(command.expectedVersion, state.version);
	}
	const actionIds = legalActions(state, command.actorId).map((candidate) => candidate.actionId);
	const required = requiredAction(command);
	if (!actionIds.includes(required)) throw new IllegalActionError(required, actionIds);
	if (command.commandType === 'hero.choose.destination') {
		const branch = command.destination === 'kitchen' ? 'names-before-orders' : 'steel-before-trust';
		if (command.storyBranch !== branch) throw new IllegalActionError(required, actionIds);
	}
	if (command.commandType === 'simulation.advance') {
		if (state.schemaVersion !== 2 && state.schemaVersion !== 3)
			throw new IllegalActionError(required, actionIds);
		const earliest = earliestScheduledTime(state);
		if (!earliest || compareGameTime(command.targetGameTime, earliest) < 0) {
			throw new IllegalActionError(required, actionIds);
		}
		const minutes = gameMinutesBetween(state.simulatedAt, command.targetGameTime);
		if (minutes <= 0 || minutes > 7 * 24 * 60) throw new IllegalActionError(required, actionIds);
	}
	if (command.commandType === 'hero.start.travel') {
		if (state.schemaVersion !== 3) throw new IllegalActionError(required, actionIds);
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
		if (
			!hero.firstArrivalCompleted &&
			(!hero.destination ||
				command.targetNodeId !== destinationNodeId(settlementForState(state), hero.destination))
		) {
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
		beforeStateHash: hashGameState(state),
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
		const experienceBefore = hero.progression.experience;
		const levelBefore = hero.progression.level;
		const skillBefore = hero.progression.skills.swordFighting.experience;
		const skillAfter = skillBefore + 6;
		const experienceAfter = experienceBefore + 8;
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
				delta: 8
			},
			{
				ownerId: heroId,
				kind: 'skill',
				key: 'sword-fighting',
				before: skillBefore,
				after: skillAfter,
				delta: 6
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
		if (injuryDraw.draw.value < 15) {
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
		needsAfter = { ...hero.needs, hunger: Math.max(0, hero.needs.hunger - 45) };
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
		needsAfter = { ...hero.needs, fatigue: Math.max(0, hero.needs.fatigue - 50) };
		healthAfter = Math.min(hero.maxHealth, hero.health + 10);
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

function buildV2Event(state: EngineGameStateModern, command: EngineCommand): AuthoritativeEvent {
	if (command.commandType === 'hero.start.travel') {
		if (state.schemaVersion !== 3) throw new IllegalActionError(command.commandType);
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
		if (state.schemaVersion === 3) throw new IllegalActionError(command.commandType);
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
		if (state.schemaVersion === 3) {
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
				currentTravelFor(state, command.targetId)?.scheduledEventId
			].filter((id): id is string => Boolean(id))
		: [];
	const canceledScheduledEventIds = fatal
		? targetKind === 'master'
			? Object.values(state.heroes)
					.flatMap((hero) => [
						hero.currentActivity?.scheduledEventId,
						currentTravelFor(state, hero.heroId)?.scheduledEventId
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

function parseModernState(state: EngineGameStateModern, value: unknown): EngineGameStateModern {
	return state.schemaVersion === 2
		? EngineGameStateV2Schema.parse(value)
		: EngineGameStateV3Schema.parse(value);
}

function reduceV2Event(
	state: EngineGameStateModern,
	event: AuthoritativeEvent
): EngineGameStateModern {
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
		if (state.schemaVersion !== 3)
			throw new ReplayIntegrityError('Travel event requires engine-v3', event.sequence);
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
		return EngineGameStateV3Schema.parse({
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
		if (state.schemaVersion === 3) {
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
			return EngineGameStateV3Schema.parse({
				...state,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor,
				simulatedAt: payload.targetGameTime,
				heroes,
				items
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
						Object.entries(state.heroes).map(([id, hero]) => [
							id,
							{
								...hero,
								currentActivity: null,
								...(state.schemaVersion === 3 ? { currentTravel: null } : {})
							}
						])
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
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: {
				...state.heroes,
				[payload.targetId]: {
					...hero,
					health: payload.healthAfter,
					lifeState: dead ? 'dead' : 'active',
					injuries: payload.injury ? [...hero.injuries, payload.injury] : hero.injuries,
					currentActivity: dead ? null : hero.currentActivity,
					...(state.schemaVersion === 3
						? { currentTravel: dead ? null : currentTravelFor(state, payload.targetId) }
						: {})
				}
			}
		});
	}
	throw new ReplayIntegrityError(`Unsupported event type: ${event.eventType}`, event.sequence);
}

export function reduceEvent(
	stateInput: EngineGameState,
	eventInput: AuthoritativeEvent
): EngineGameState {
	const state = EngineGameStateSchema.parse(stateInput);
	const event = AuthoritativeEventSchema.parse(eventInput);
	if (event.runId !== state.runId)
		throw new ReplayIntegrityError('Event run does not match state', event.sequence);
	if (event.sequence !== state.eventCursor + 1)
		throw new ReplayIntegrityError('Event sequence is not contiguous', event.sequence);
	return state.schemaVersion === 1 ? reduceLegacyEvent(state, event) : reduceV2Event(state, event);
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
	const nextState = reduceEvent(state, eventDraft);
	const stateHash = hashGameState(nextState);
	const event = AuthoritativeEventSchema.parse({ ...eventDraft, afterStateHash: stateHash });
	return {
		state: nextState,
		stateHash,
		events: [event],
		scheduled: scheduledEventsFromEvent(event),
		resolvedScheduledEventIds: resolvedScheduledEventIdsFromEvent(event),
		canceledScheduledEventIds: canceledScheduledEventIdsFromEvent(event),
		decisionRequests: [],
		legalActions: legalActions(nextState, command.actorId)
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
	let computedHash = hashGameState(state);
	const checks: ReplayCheck[] = [
		replayCheck(
			first,
			computedHash,
			first.beforeStateHash === EMPTY_STATE_HASH && first.afterStateHash === computedHash
		)
	];
	for (const event of events.slice(1)) {
		const beforeHash = hashGameState(state);
		state = reduceEvent(state, event);
		computedHash = hashGameState(state);
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
