import {
	AttributeGrowthReceiptSchema,
	CommunicativeActSchema,
	CurrentForgingSchema,
	CurrentRoutineSchema,
	DailyPlanSchema,
	DirectiveRecordSchema,
	EngineCommandSchema,
	EngineGameStateV2Schema,
	FirstEmberStateSchema,
	HeroBuildingAssignmentSchema,
	HeroConversationTurnSchema,
	InjurySchema,
	ResourceKeySchema,
	ScheduledEventSchema,
	SettlementRoutePlanSchema,
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	SocietyStateV4Schema,
	type AuthoritativeEvent,
	type EngineGameState,
	type EngineGameStateV4,
	type SocietyState,
	type SocietyStateV2,
	type SocietyStateV3,
	type SocietyStateV4
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { z } from 'zod';

import { EmptyMetadataSchema } from '../../core/event-metadata.js';
import { intrinsicAttributes, maximumHealth, maximumMana } from '../../core/capability.js';
import { parseModernState } from '../../core/state.js';
import type { EngineEventReducer, EngineGameStateModern } from '../../core/types.js';
import {
	hasFacilityState,
	hasFirstEmberState,
	hasNavigationState,
	hasRoutineState
} from '../../core/versions.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { compareGameTime } from '../../time.js';
import { earliestSettlementScheduledTime } from './commands.js';
import { currentTravelFor } from './navigation.js';
import {
	ActivityOutcomeSchema,
	ActivityOutcomeV25Schema,
	RoutineOutcomeSchema,
	RoutineOutcomeV25Schema,
	buildRoutineOutcome,
	createDailyPlan,
	gameDayIndex,
	resolveDailyRoutine,
	skipUnfinishedPlan
} from './routines.js';
import {
	FIRST_EMBER_MODIFIERS,
	buildCommunicativeSociety,
	buildConversationSociety,
	buildDirectiveChange,
	buildFirstEmberReaction,
	buildFirstEmberSociety,
	revokeDirective
} from './society.js';
import type { CommunicationInput, DirectiveIssueCommand } from './society.js';
import { equipEquipmentItem } from './equipment.js';
import {
	ForgingMaterialLotChangeSchema,
	ForgingOutcomeSchema,
	buildStandardForgingStart,
	currentForgingFor,
	forgingOutcomeMatches
} from './forging.js';

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

export const ResourceChangeSchema = z
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

export const ActivityStartedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	activity: z.enum(['train', 'eat', 'rest', 'repair']),
	activityId: z.string().uuid(),
	scheduledEvent: ScheduledEventSchema,
	resourceChanges: z.array(ResourceChangeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

export const ForgingStartedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	currentForging: CurrentForgingSchema,
	scheduledEvent: ScheduledEventSchema,
	materialLotChange: ForgingMaterialLotChangeSchema,
	nextVersion: z.number().int().nonnegative()
}).strict();

export const TravelStartedPayloadSchema = EmptyMetadataSchema.extend({
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

export const DirectiveChangedPayloadSchema = EmptyMetadataSchema.extend({
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

export const RoutineStartedPayloadSchema = EmptyMetadataSchema.extend({
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
	targetSlot: z.enum(['main-hand', 'off-hand', 'head', 'torso', 'legs', 'boots']).optional(),
	nextVersion: z.number().int().nonnegative()
}).strict();

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

const SimulationAdvancedPayloadV5Schema = EmptyMetadataSchema.extend({
	targetGameTime: z.string().datetime(),
	activityOutcomes: z.array(ActivityOutcomeSchema),
	travelOutcomes: z.array(TravelOutcomeSchema),
	routineOutcomes: z.array(RoutineOutcomeSchema),
	nextVersion: z.number().int().nonnegative()
}).strict();

const SimulationAdvancedPayloadV24Schema = SimulationAdvancedPayloadV5Schema.extend({
	forgingOutcomes: z.array(ForgingOutcomeSchema)
}).strict();

const SimulationAdvancedPayloadV25Schema = SimulationAdvancedPayloadV5Schema.extend({
	activityOutcomes: z.array(ActivityOutcomeV25Schema),
	routineOutcomes: z.array(RoutineOutcomeV25Schema)
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

const DamagePayloadV25Schema = DamagePayloadSchema.extend({
	healthBefore: z.number().int().min(0).max(10_000),
	healthAfter: z.number().int().min(0).max(10_000)
}).strict();

const AttributeAllocatedPayloadSchema = EmptyMetadataSchema.extend({
	heroId: z.string().uuid(),
	attributeGrowthReceipt: AttributeGrowthReceiptSchema,
	nextVersion: z.number().int().nonnegative()
}).strict();

export function applyResourceChanges(
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

export const SETTLEMENT_EVENT_TYPES = [
	'hero.activity.started',
	'hero.arrived',
	'hero.assignment.changed',
	'hero.daily.plan.created',
	'hero.damaged',
	'hero.destination.selected',
	'hero.died',
	'hero.forging.started',
	'hero.item.equipped',
	'hero.routine.started',
	'hero.travel.started',
	'master.damaged',
	'master.died',
	'master.gate.inspected',
	'settlement.first.ember.committed',
	'settlement.power.allocated',
	'simulation.advanced',
	'simulation.clock.synced',
	'social.communicative.act.recorded',
	'social.conversation.turn.recorded',
	'social.directive.issued',
	'social.directive.replaced',
	'social.directive.revoked',
	'story.first.ember.recovered',
	'hero.attribute.allocated'
] as const;

function reduceSettlementEvent(
	state: EngineGameStateModern,
	event: AuthoritativeEvent
): EngineGameState {
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
		const earliest = earliestSettlementScheduledTime(state);
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
			currentForgingFor(state, payload.heroId) ||
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
			currentForgingFor(state, payload.heroId) ||
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
			currentForgingFor(state, payload.heroId) ||
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
		if (
			!hero ||
			hero.currentActivity ||
			currentTravelFor(state, payload.heroId) ||
			currentForgingFor(state, payload.heroId)
		)
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
	if (event.eventType === 'hero.forging.started') {
		if (state.schemaVersion !== 24 || !event.commandId) {
			throw new ReplayIntegrityError('Forging start requires engine-v24', event.sequence);
		}
		const payload = ForgingStartedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		if (
			!hero ||
			hero.currentActivity ||
			hero.currentTravel ||
			hero.currentRoutine ||
			hero.currentForging
		) {
			throw new ReplayIntegrityError('Forging start is not legal', event.sequence);
		}
		let expected;
		try {
			expected = buildStandardForgingStart({
				state,
				commandId: event.commandId,
				forgeEventId: event.eventId,
				heroId: payload.heroId,
				definitionId: payload.currentForging.definitionId,
				materialId: payload.materialLotChange.materialId,
				craftsmanship: payload.currentForging.recipe.craftsmanship
			});
		} catch {
			throw new ReplayIntegrityError('Forging start content is unavailable', event.sequence);
		}
		if (
			hashCanonical(expected.currentForging) !== hashCanonical(payload.currentForging) ||
			hashCanonical(expected.scheduledEvent) !== hashCanonical(payload.scheduledEvent) ||
			hashCanonical(expected.materialLotChange) !== hashCanonical(payload.materialLotChange)
		) {
			throw new ReplayIntegrityError('Forging start payload diverged', event.sequence);
		}
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			settlement: {
				...state.settlement,
				materialLots: {
					...state.settlement.materialLots,
					[payload.materialLotChange.materialId]: payload.materialLotChange.after
				}
			},
			heroes: {
				...state.heroes,
				[payload.heroId]: { ...hero, currentForging: payload.currentForging }
			}
		});
	}
	if (event.eventType === 'hero.item.equipped') {
		const payload = ItemEquippedPayloadSchema.parse(event.payload);
		if (state.schemaVersion === 24 || state.schemaVersion === 25) {
			const equipped = equipEquipmentItem(state, {
				heroId: payload.heroId,
				itemId: payload.itemId,
				...(payload.targetSlot ? { targetSlot: payload.targetSlot } : {})
			});
			return parseModernState(state, {
				...equipped,
				version: payload.nextVersion,
				eventCursor: event.sequence,
				entropyCursor: event.seedCursor
			});
		}
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
	if (event.eventType === 'hero.attribute.allocated') {
		if (state.schemaVersion !== 25) {
			throw new ReplayIntegrityError('Attribute allocation requires engine-v25', event.sequence);
		}
		const payload = AttributeAllocatedPayloadSchema.parse(event.payload);
		const hero = state.heroes[payload.heroId];
		const receipt = payload.attributeGrowthReceipt;
		if (
			!hero ||
			hero.lifeState !== 'active' ||
			event.actorId !== hero.heroId ||
			event.gameTime !== state.simulatedAt ||
			payload.nextVersion !== state.version + 1 ||
			hero.progression.unspentAttributePoints < receipt.spentPoints ||
			receipt.heroId !== hero.heroId ||
			receipt.beforeIntrinsicValue !==
				intrinsicAttributes(
					hero.capabilityProfile,
					hero.progression.attributeGrowthReceipts,
					COMBAT_RULES_V1
				)[receipt.attribute] ||
			receipt.afterIntrinsicValue > COMBAT_RULES_V1.attributes.intrinsicMaximum ||
			receipt.sourceLevel !== hero.progression.level ||
			receipt.rulesVersion !== COMBAT_RULES_V1.rulesVersion ||
			receipt.commandId !== event.commandId ||
			receipt.gameTime !== state.simulatedAt ||
			receipt.receiptId !== deterministicUuid(`${event.eventId}:attribute-growth`)
		) {
			throw new ReplayIntegrityError('Attribute allocation receipt diverged', event.sequence);
		}
		const maxHealth =
			receipt.attribute === 'vitality'
				? maximumHealth(receipt.afterIntrinsicValue, COMBAT_RULES_V1)
				: hero.maxHealth;
		const maxMana =
			receipt.attribute === 'spirit'
				? maximumMana(receipt.afterIntrinsicValue, COMBAT_RULES_V1)
				: hero.maxMana;
		return parseModernState(state, {
			...state,
			version: payload.nextVersion,
			eventCursor: event.sequence,
			entropyCursor: event.seedCursor,
			heroes: {
				...state.heroes,
				[hero.heroId]: {
					...hero,
					maxHealth,
					maxMana,
					progression: {
						...hero.progression,
						unspentAttributePoints: hero.progression.unspentAttributePoints - receipt.spentPoints,
						attributeGrowthReceipts: [...hero.progression.attributeGrowthReceipts, receipt]
					}
				}
			}
		});
	}
	if (event.eventType === 'simulation.advanced') {
		if (hasRoutineState(state)) {
			const payload =
				state.schemaVersion === 25
					? SimulationAdvancedPayloadV25Schema.parse(event.payload)
					: state.schemaVersion === 24
						? SimulationAdvancedPayloadV24Schema.parse(event.payload)
						: SimulationAdvancedPayloadV5Schema.parse(event.payload);
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
				} as (typeof heroes)[string];
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
			if (state.schemaVersion === 24) {
				const forgingPayload = SimulationAdvancedPayloadV24Schema.parse(event.payload);
				const dueForgingHeroIds = Object.values(state.heroes)
					.filter(
						(hero) =>
							hero.currentForging &&
							compareGameTime(hero.currentForging.completesAt, payload.targetGameTime) <= 0
					)
					.sort((left, right) => {
						const time = compareGameTime(
							left.currentForging!.completesAt,
							right.currentForging!.completesAt
						);
						return time === 0 ? left.heroId.localeCompare(right.heroId) : time;
					})
					.map((hero) => hero.heroId);
				if (
					forgingPayload.forgingOutcomes.length !== dueForgingHeroIds.length ||
					forgingPayload.forgingOutcomes.some(
						(outcome, index) =>
							outcome.heroId !== dueForgingHeroIds[index] || !forgingOutcomeMatches(state, outcome)
					)
				) {
					throw new ReplayIntegrityError('Scheduled forging outcomes diverged', event.sequence);
				}
				for (const outcome of forgingPayload.forgingOutcomes) {
					const hero = heroes[outcome.heroId];
					if (!hero || !('currentForging' in hero) || !hero.currentForging) {
						throw new ReplayIntegrityError('Forging job disappeared', event.sequence);
					}
					if (items[outcome.item.itemId]) {
						throw new ReplayIntegrityError('Forged item already exists', event.sequence);
					}
					heroes[outcome.heroId] = { ...hero, currentForging: null };
					items[outcome.item.itemId] = outcome.item;
				}
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
		const payload = (
			state.schemaVersion === 25 ? DamagePayloadV25Schema : DamagePayloadSchema
		).parse(event.payload);
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
									...(state.schemaVersion === 24 ? { currentForging: null } : {}),
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
					...(state.schemaVersion === 24
						? { currentForging: dead ? null : state.heroes[payload.targetId]!.currentForging }
						: {}),
					...routineState
				}
			}
		});
	}
	throw new ReplayIntegrityError(`Unsupported event type: ${event.eventType}`, event.sequence);
}

export const settlementEventReducer: EngineEventReducer = {
	ownerId: 'settlement',
	eventTypes: SETTLEMENT_EVENT_TYPES,
	reduce(state, event) {
		if (state.schemaVersion === 1) {
			throw new ReplayIntegrityError(
				'Settlement reducer does not own legacy state',
				event.sequence
			);
		}
		return reduceSettlementEvent(state, event);
	}
};
