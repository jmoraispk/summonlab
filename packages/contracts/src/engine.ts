import { z } from 'zod';

import { CharacterMindSchema, LegalActionSchema } from './character.js';
import {
	ActionSourceSchema,
	AuthoritativeEventSchema,
	DirectiveScopeSchema,
	JournalEntrySchema,
	RewardDeltaSchema
} from './event.js';
import { RunStatusSchema } from './run.js';
import { MissionArenaKnowledgeSchema, MissionSlugSchema } from './mission.js';
import { SettlementRoutePlanSchema, SettlementSlugSchema } from './settlement.js';
import {
	ConversationActKindSchema,
	ConversationOrderIntentSchema,
	CommunicationDeliverySchema,
	CommunicationToneSchema,
	CommunicationTopicSchema,
	OnboardingCommunicativeActKindSchema,
	SocietyStateSchema,
	SocietyStateV2Schema,
	SocietyStateV3Schema,
	SocietyStateV4Schema
} from './social.js';
import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from './shared.js';

export const EngineLocationV1Schema = z.enum(['summoning-gate', 'kitchen', 'training-ground']);
export const EngineLocationSchema = z.enum([
	'summoning-gate',
	'kitchen',
	'training-ground',
	'dormitory',
	'workshop'
]);
export const EngineZoneSchema = z.enum([...EngineLocationSchema.options, 'settlement-exterior']);
export const HeroLifeStateSchema = z.enum(['active', 'dead', 'synthesized']);
export const MasterLifeStateSchema = z.enum(['alive', 'dead']);
export const ResourceKeySchema = z.enum(['food', 'iron-ore', 'ember-shard']);
export const ActivityKindSchema = z.enum(['train', 'eat', 'rest', 'repair']);
export const InjuryKindSchema = z.enum(['bruise', 'strain', 'critical']);
export const EquipmentSlotSchema = z.enum(['main-hand']);

const HealthSchema = z
	.object({
		health: z.number().int().min(0).max(100),
		maxHealth: z.number().int().positive().max(100)
	})
	.refine((value) => value.health <= value.maxHealth, {
		message: 'Health cannot exceed maxHealth'
	});

export const EngineHeroStateV1Schema = z
	.object({
		heroId: EntityIdSchema,
		lifeState: HeroLifeStateSchema,
		location: EngineLocationV1Schema,
		destination: z.enum(['kitchen', 'training-ground']).nullable(),
		health: HealthSchema.shape.health,
		maxHealth: HealthSchema.shape.maxHealth,
		manifestHash: StateHashSchema
	})
	.strict()
	.refine((value) => value.health <= value.maxHealth, {
		message: 'Hero health cannot exceed maxHealth'
	});

export const EngineMasterStateV1Schema = z
	.object({
		masterId: EntityIdSchema,
		lifeState: MasterLifeStateSchema,
		location: EngineLocationV1Schema,
		health: HealthSchema.shape.health,
		maxHealth: HealthSchema.shape.maxHealth,
		gateInspectionCount: z.number().int().nonnegative(),
		lastGateResonance: z.number().int().min(0).max(99).nullable()
	})
	.strict()
	.refine((value) => value.health <= value.maxHealth, {
		message: 'Master health cannot exceed maxHealth'
	});

export const EngineStoryStateSchema = z
	.object({
		envelopeId: z.literal('first-ember-v1'),
		branch: z.string().min(1).nullable()
	})
	.strict();

export const EngineGameStateV1Schema = z
	.object({
		schemaVersion: z.literal(1),
		runId: EntityIdSchema,
		seed: z.string().min(1).max(128),
		contentVersion: ContentVersionSchema,
		status: RunStatusSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		entropyCursor: z.number().int().nonnegative(),
		simulatedAt: IsoDateTimeSchema,
		master: EngineMasterStateV1Schema,
		heroes: z.record(EntityIdSchema, EngineHeroStateV1Schema),
		story: EngineStoryStateSchema
	})
	.strict();

export const InjurySchema = z
	.object({
		injuryId: EntityIdSchema,
		kind: InjuryKindSchema,
		severity: z.number().int().min(1).max(100),
		inflictedAt: IsoDateTimeSchema
	})
	.strict();

export const NeedStateSchema = z
	.object({
		hunger: z.number().int().min(0).max(100),
		fatigue: z.number().int().min(0).max(100)
	})
	.strict();

export const SkillProgressSchema = z
	.object({
		rank: z.number().int().min(0).max(20),
		experience: z.number().int().nonnegative()
	})
	.strict();

export const HeroProgressionSchema = z
	.object({
		stars: z.number().int().min(1).max(7),
		level: z.number().int().min(1).max(70),
		experience: z.number().int().nonnegative(),
		skills: z
			.object({
				swordFighting: SkillProgressSchema
			})
			.strict()
	})
	.strict()
	.refine((value) => value.level <= value.stars * 10, {
		message: 'Hero level cannot exceed the current star cap'
	});

export const CurrentActivitySchema = z
	.object({
		activityId: EntityIdSchema,
		scheduledEventId: EntityIdSchema,
		kind: ActivityKindSchema,
		startedAt: IsoDateTimeSchema,
		completesAt: IsoDateTimeSchema
	})
	.strict();

const SettlementNodeIdSchema = SettlementSlugSchema;

export const CurrentTravelSchema = z
	.object({
		travelId: EntityIdSchema,
		scheduledEventId: EntityIdSchema,
		fromNodeId: SettlementNodeIdSchema,
		toNodeId: SettlementNodeIdSchema,
		destinationZone: EngineZoneSchema,
		route: SettlementRoutePlanSchema,
		settlementContentVersion: ContentVersionSchema,
		settlementContentHash: StateHashSchema,
		startedAt: IsoDateTimeSchema,
		arrivesAt: IsoDateTimeSchema
	})
	.strict()
	.refine(
		(value) =>
			value.route.fromNodeId === value.fromNodeId && value.route.toNodeId === value.toNodeId,
		{ message: 'Current travel route endpoints must match the journey' }
	);

export const EngineHeroStateV2Schema = z
	.object({
		heroId: EntityIdSchema,
		lifeState: HeroLifeStateSchema,
		location: EngineLocationSchema,
		destination: z.enum(['kitchen', 'training-ground']).nullable(),
		health: HealthSchema.shape.health,
		maxHealth: HealthSchema.shape.maxHealth,
		manifestHash: StateHashSchema,
		needs: NeedStateSchema,
		injuries: z.array(InjurySchema).max(20),
		progression: HeroProgressionSchema,
		equipment: z
			.object({
				mainHand: EntityIdSchema.nullable()
			})
			.strict(),
		currentActivity: CurrentActivitySchema.nullable()
	})
	.strict()
	.superRefine((value, context) => {
		if (value.health > value.maxHealth) {
			context.addIssue({ code: 'custom', message: 'Hero health cannot exceed maxHealth' });
		}
		if (value.lifeState === 'active' && value.health === 0) {
			context.addIssue({ code: 'custom', message: 'An active hero must have health' });
		}
		if (value.lifeState !== 'active' && value.health !== 0) {
			context.addIssue({ code: 'custom', message: 'A terminal hero must have zero health' });
		}
		if (value.lifeState !== 'active' && value.currentActivity !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot have an activity' });
		}
	});

export const EngineHeroStateV3Schema = z
	.object({
		...EngineHeroStateV2Schema.shape,
		location: EngineZoneSchema,
		locationNodeId: SettlementNodeIdSchema,
		firstArrivalCompleted: z.boolean(),
		currentTravel: CurrentTravelSchema.nullable()
	})
	.strict()
	.superRefine((value, context) => {
		if (value.health > value.maxHealth) {
			context.addIssue({ code: 'custom', message: 'Hero health cannot exceed maxHealth' });
		}
		if (value.lifeState === 'active' && value.health === 0) {
			context.addIssue({ code: 'custom', message: 'An active hero must have health' });
		}
		if (value.lifeState !== 'active' && value.health !== 0) {
			context.addIssue({ code: 'custom', message: 'A terminal hero must have zero health' });
		}
		if (value.lifeState !== 'active' && value.currentActivity !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot have an activity' });
		}
		if (value.currentActivity && value.currentTravel) {
			context.addIssue({ code: 'custom', message: 'A hero cannot work while traveling' });
		}
		if (value.lifeState !== 'active' && value.currentTravel !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot travel' });
		}
		if (value.currentTravel && value.currentTravel.fromNodeId !== value.locationNodeId) {
			context.addIssue({ code: 'custom', message: 'Travel must begin at the authoritative node' });
		}
	});

export const BuildingAssignmentRoleSchema = z.enum([
	'gate-attendant',
	'cook',
	'resident',
	'trainee',
	'artisan'
]);

export const HeroBuildingAssignmentSchema = z
	.object({
		buildingId: SettlementSlugSchema,
		nodeId: SettlementNodeIdSchema,
		role: BuildingAssignmentRoleSchema,
		assignedAt: IsoDateTimeSchema
	})
	.strict();

export const EngineHeroStateV4Schema = z
	.object({
		...EngineHeroStateV3Schema.shape,
		assignment: HeroBuildingAssignmentSchema.nullable()
	})
	.strict()
	.superRefine((value, context) => {
		if (value.health > value.maxHealth) {
			context.addIssue({ code: 'custom', message: 'Hero health cannot exceed maxHealth' });
		}
		if (value.lifeState === 'active' && value.health === 0) {
			context.addIssue({ code: 'custom', message: 'An active hero must have health' });
		}
		if (value.lifeState !== 'active' && value.health !== 0) {
			context.addIssue({ code: 'custom', message: 'A terminal hero must have zero health' });
		}
		if (value.lifeState !== 'active' && value.currentActivity !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot have an activity' });
		}
		if (value.currentActivity && value.currentTravel) {
			context.addIssue({ code: 'custom', message: 'A hero cannot work while traveling' });
		}
		if (value.lifeState !== 'active' && value.currentTravel !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot travel' });
		}
		if (value.currentTravel && value.currentTravel.fromNodeId !== value.locationNodeId) {
			context.addIssue({ code: 'custom', message: 'Travel must begin at the authoritative node' });
		}
		if (value.lifeState !== 'active' && value.assignment !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot remain assigned' });
		}
	});

export const RoutineKindSchema = z.enum([
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
]);

export const HabitStateSchema = z
	.object({
		habit: CharacterMindSchema.shape.dailyHabit,
		strength: z.number().int().min(0).max(100),
		repetitions: z.number().int().nonnegative(),
		satisfaction: z.number().int().min(0).max(100),
		lastTriggeredAt: IsoDateTimeSchema.nullable()
	})
	.strict();

export const DailyPlanEntrySchema = z
	.object({
		planEntryId: EntityIdSchema,
		period: z.enum(['dawn', 'day', 'evening', 'night']),
		kind: RoutineKindSchema,
		buildingId: SettlementSlugSchema.nullable(),
		status: z.enum(['pending', 'active', 'completed', 'skipped']),
		startedAt: IsoDateTimeSchema.nullable(),
		completedAt: IsoDateTimeSchema.nullable()
	})
	.strict()
	.superRefine((entry, context) => {
		if (entry.status === 'pending' && (entry.startedAt || entry.completedAt)) {
			context.addIssue({ code: 'custom', message: 'Pending plan entry has timestamps' });
		}
		if (entry.status === 'active' && (!entry.startedAt || entry.completedAt)) {
			context.addIssue({ code: 'custom', message: 'Active plan entry timestamps are invalid' });
		}
		if (entry.status === 'completed' && (!entry.startedAt || !entry.completedAt)) {
			context.addIssue({ code: 'custom', message: 'Completed plan entry lacks timestamps' });
		}
		if (entry.status === 'skipped' && !entry.completedAt) {
			context.addIssue({ code: 'custom', message: 'Skipped plan entry lacks resolution time' });
		}
	});

export const DailyPlanSchema = z
	.object({
		planId: EntityIdSchema,
		dayIndex: z.number().int().nonnegative(),
		createdAt: IsoDateTimeSchema,
		entries: z.array(DailyPlanEntrySchema).length(4)
	})
	.strict()
	.superRefine((plan, context) => {
		if (new Set(plan.entries.map((entry) => entry.planEntryId)).size !== plan.entries.length) {
			context.addIssue({ code: 'custom', message: 'Daily plan entry ids must be unique' });
		}
		if (plan.entries.filter((entry) => entry.status === 'active').length > 1) {
			context.addIssue({ code: 'custom', message: 'Daily plan has multiple active entries' });
		}
	});

export const RoutineCandidateScoreSchema = z
	.object({
		planEntryId: EntityIdSchema,
		kind: RoutineKindSchema,
		score: z.number().int().min(-200).max(500),
		eligible: z.boolean(),
		reasons: z.array(z.string().min(1).max(160)).min(1).max(8)
	})
	.strict();

export const RoutineResolutionSchema = z
	.object({
		selectedPlanEntryId: EntityIdSchema,
		selectedKind: RoutineKindSchema,
		candidateScores: z.array(RoutineCandidateScoreSchema).min(1).max(4),
		margin: z.number().int().nonnegative().max(700),
		decisionRecommended: z.boolean(),
		fallbackUsed: z.boolean(),
		summary: z.string().min(1).max(500)
	})
	.strict()
	.refine((resolution) => resolution.decisionRecommended === resolution.fallbackUsed, {
		message: 'Routine fallback must expose every deferred decision boundary'
	});

export const CurrentRoutineSchema = z
	.object({
		routineId: EntityIdSchema,
		scheduledEventId: EntityIdSchema,
		planId: EntityIdSchema,
		planEntryId: EntityIdSchema,
		kind: RoutineKindSchema,
		resolution: RoutineResolutionSchema,
		startedAt: IsoDateTimeSchema,
		completesAt: IsoDateTimeSchema
	})
	.strict();

export const EngineHeroStateV5Schema = z
	.object({
		...EngineHeroStateV4Schema.shape,
		mind: CharacterMindSchema,
		habit: HabitStateSchema,
		dailyPlan: DailyPlanSchema.nullable(),
		currentRoutine: CurrentRoutineSchema.nullable()
	})
	.strict()
	.superRefine((hero, context) => {
		if (hero.habit.habit !== hero.mind.dailyHabit) {
			context.addIssue({ code: 'custom', message: 'Habit state diverged from stable mind' });
		}
		if (hero.health > hero.maxHealth) {
			context.addIssue({ code: 'custom', message: 'Hero health cannot exceed maxHealth' });
		}
		if (hero.lifeState === 'active' && hero.health === 0) {
			context.addIssue({ code: 'custom', message: 'An active hero must have health' });
		}
		if (hero.lifeState !== 'active' && hero.health !== 0) {
			context.addIssue({ code: 'custom', message: 'A terminal hero must have zero health' });
		}
		if (hero.lifeState !== 'active' && hero.currentActivity !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot have an activity' });
		}
		if (hero.lifeState !== 'active' && hero.currentTravel !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot travel' });
		}
		if (hero.currentTravel && hero.currentTravel.fromNodeId !== hero.locationNodeId) {
			context.addIssue({ code: 'custom', message: 'Travel must begin at the authoritative node' });
		}
		if (hero.lifeState !== 'active' && hero.assignment !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot remain assigned' });
		}
		if (
			[hero.currentActivity, hero.currentTravel, hero.currentRoutine].filter(Boolean).length > 1
		) {
			context.addIssue({ code: 'custom', message: 'A hero cannot perform concurrent work' });
		}
		if (hero.lifeState !== 'active' && hero.currentRoutine !== null) {
			context.addIssue({ code: 'custom', message: 'A terminal hero cannot follow a routine' });
		}
		const activeEntries =
			hero.dailyPlan?.entries.filter((entry) => entry.status === 'active') ?? [];
		if (hero.currentRoutine) {
			const entry = activeEntries[0];
			if (
				activeEntries.length !== 1 ||
				hero.dailyPlan?.planId !== hero.currentRoutine.planId ||
				entry?.planEntryId !== hero.currentRoutine.planEntryId ||
				entry?.kind !== hero.currentRoutine.kind
			) {
				context.addIssue({ code: 'custom', message: 'Current routine diverged from daily plan' });
			}
		} else if (activeEntries.length !== 0) {
			context.addIssue({ code: 'custom', message: 'Daily plan has an orphaned active entry' });
		}
	});

export const EngineMasterStateV2Schema = z
	.object({
		masterId: EntityIdSchema,
		lifeState: MasterLifeStateSchema,
		location: EngineLocationSchema,
		health: HealthSchema.shape.health,
		maxHealth: HealthSchema.shape.maxHealth,
		injuries: z.array(InjurySchema).max(20),
		gateInspectionCount: z.number().int().nonnegative(),
		lastGateResonance: z.number().int().min(0).max(99).nullable()
	})
	.strict()
	.superRefine((value, context) => {
		if (value.health > value.maxHealth) {
			context.addIssue({ code: 'custom', message: 'Master health cannot exceed maxHealth' });
		}
		if (value.lifeState === 'alive' && value.health === 0) {
			context.addIssue({ code: 'custom', message: 'A living Master must have health' });
		}
		if (value.lifeState === 'dead' && value.health !== 0) {
			context.addIssue({ code: 'custom', message: 'A dead Master must have zero health' });
		}
	});

export const ResourceBalancesSchema = z
	.object({
		food: z.number().int().nonnegative(),
		'iron-ore': z.number().int().nonnegative(),
		'ember-shard': z.number().int().nonnegative()
	})
	.strict();

export const ResourceLedgerEntrySchema = z
	.object({
		entryId: EntityIdSchema,
		eventId: EntityIdSchema,
		resource: ResourceKeySchema,
		before: z.number().int().nonnegative(),
		after: z.number().int().nonnegative(),
		delta: z.number().int(),
		reason: z.string().min(1).max(120)
	})
	.strict()
	.refine((value) => value.after - value.before === value.delta, {
		message: 'Resource ledger delta must equal after minus before'
	});

export const EngineSettlementStateSchema = z
	.object({
		resources: ResourceBalancesSchema,
		resourceLedger: z.array(ResourceLedgerEntrySchema).max(10_000)
	})
	.strict();

export const SettlementNavigationStateSchema = z
	.object({
		settlementId: SettlementNodeIdSchema,
		contentVersion: ContentVersionSchema,
		contentHash: StateHashSchema,
		activeSystemIds: z.array(SettlementNodeIdSchema).max(20)
	})
	.strict()
	.refine((value) => new Set(value.activeSystemIds).size === value.activeSystemIds.length, {
		message: 'Active settlement systems must be unique'
	});

export const EngineSettlementStateV3Schema = EngineSettlementStateSchema.extend({
	navigation: SettlementNavigationStateSchema
}).strict();

export const BuildingPowerStateSchema = z.enum(['unpowered', 'reserve', 'powered']);

export const EngineBuildingStateSchema = z
	.object({
		buildingId: SettlementSlugSchema,
		systemId: SettlementSlugSchema,
		assignmentNodeId: SettlementNodeIdSchema,
		assignmentRole: BuildingAssignmentRoleSchema,
		assignmentCapacity: z.number().int().min(1).max(30),
		assignedHeroIds: z.array(EntityIdSchema).max(30),
		baselinePowerState: z.enum(['unpowered', 'reserve']),
		powerState: BuildingPowerStateSchema
	})
	.strict()
	.superRefine((building, context) => {
		if (new Set(building.assignedHeroIds).size !== building.assignedHeroIds.length) {
			context.addIssue({ code: 'custom', message: 'Building assignments must be unique' });
		}
		if (building.assignedHeroIds.length > building.assignmentCapacity) {
			context.addIssue({ code: 'custom', message: 'Building assignment capacity was exceeded' });
		}
	});

export const EngineSettlementStateV4Schema = z
	.object({
		...EngineSettlementStateV3Schema.shape,
		poweredBuildingId: SettlementSlugSchema.nullable(),
		buildings: z.record(SettlementSlugSchema, EngineBuildingStateSchema)
	})
	.strict();

export const EngineItemStateSchema = z
	.object({
		itemId: EntityIdSchema,
		templateId: z.enum(['practice-blade', 'short-bow']),
		displayName: z.string().min(1).max(80),
		ownerId: EntityIdSchema,
		slot: EquipmentSlotSchema,
		equippedById: EntityIdSchema.nullable(),
		durability: z.number().int().nonnegative(),
		maxDurability: z.number().int().positive().max(100)
	})
	.strict()
	.refine((value) => value.durability <= value.maxDurability, {
		message: 'Item durability cannot exceed maxDurability'
	});

export const EngineGameStateV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		runId: EntityIdSchema,
		seed: z.string().min(1).max(128),
		contentVersion: ContentVersionSchema,
		status: RunStatusSchema,
		version: z.number().int().nonnegative(),
		eventCursor: z.number().int().positive(),
		entropyCursor: z.number().int().nonnegative(),
		simulatedAt: IsoDateTimeSchema,
		master: EngineMasterStateV2Schema,
		heroes: z.record(EntityIdSchema, EngineHeroStateV2Schema),
		settlement: EngineSettlementStateSchema,
		items: z.record(EntityIdSchema, EngineItemStateSchema),
		story: EngineStoryStateSchema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (!itemId) continue;
			const item = state.items[itemId];
			if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
				context.addIssue({
					code: 'custom',
					message: 'Hero equipment must reference an owned item'
				});
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV3Schema = z
	.object({
		...EngineGameStateV2Schema.shape,
		schemaVersion: z.literal(3),
		heroes: z.record(EntityIdSchema, EngineHeroStateV3Schema),
		settlement: EngineSettlementStateV3Schema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (!itemId) continue;
			const item = state.items[itemId];
			if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
				context.addIssue({
					code: 'custom',
					message: 'Hero equipment must reference an owned item'
				});
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV4Schema = z
	.object({
		...EngineGameStateV3Schema.shape,
		schemaVersion: z.literal(4),
		heroes: z.record(EntityIdSchema, EngineHeroStateV4Schema),
		settlement: EngineSettlementStateV4Schema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
			}
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'Powered building slot is inconsistent' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({ code: 'custom', message: 'Active systems diverged from building power' });
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const EngineGameStateV5Schema = z
	.object({
		...EngineGameStateV4Schema.shape,
		schemaVersion: z.literal(5),
		heroes: z.record(EntityIdSchema, EngineHeroStateV5Schema)
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
			}
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'Powered building slot is inconsistent' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({ code: 'custom', message: 'Active systems diverged from building power' });
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
	});

export const FirstEmberFacilitySchema = z.enum(['kitchen', 'dormitory', 'training-ground']);
export const FirstEmberRationaleSchema = z.enum([
	'feed-everyone',
	'protect-recovery',
	'prepare-tower'
]);
export const FirstEmberReactionStanceSchema = z.enum(['support', 'accept', 'question', 'oppose']);
export const FirstEmberModifierKeySchema = z.enum([
	'hunger-recovery',
	'fatigue-recovery',
	'health-recovery',
	'hero-experience',
	'sword-experience',
	'training-injury-threshold'
]);

export const FirstEmberModifierSchema = z
	.object({
		key: FirstEmberModifierKeySchema,
		amount: z.number().int().min(-100).max(100)
	})
	.strict();

export const FirstEmberHeroReactionSchema = z
	.object({
		heroId: EntityIdSchema,
		stance: FirstEmberReactionStanceSchema,
		score: z.number().int().min(-100).max(100),
		summary: z.string().min(1).max(300),
		factors: z.array(z.string().min(1).max(120)).min(2).max(8)
	})
	.strict();

export const FirstEmberStateSchema = z
	.object({
		coreId: z.literal('first-ember-core'),
		status: z.enum(['unrecovered', 'available', 'committed']),
		recoveredFrom: z.literal('tower-floor-01').nullable(),
		recoveredAt: IsoDateTimeSchema.nullable(),
		committedAt: IsoDateTimeSchema.nullable(),
		buildingId: FirstEmberFacilitySchema.nullable(),
		rationale: FirstEmberRationaleSchema.nullable(),
		modifiers: z.array(FirstEmberModifierSchema).max(6),
		reactions: z.array(FirstEmberHeroReactionSchema).max(32)
	})
	.strict()
	.superRefine((core, context) => {
		const recoveryFields = core.recoveredFrom !== null && core.recoveredAt !== null;
		const commitmentFields =
			core.committedAt !== null && core.buildingId !== null && core.rationale !== null;
		if (
			(core.status === 'unrecovered' &&
				(recoveryFields ||
					commitmentFields ||
					core.modifiers.length > 0 ||
					core.reactions.length > 0)) ||
			(core.status === 'available' &&
				(!recoveryFields ||
					commitmentFields ||
					core.modifiers.length > 0 ||
					core.reactions.length > 0)) ||
			(core.status === 'committed' && (!recoveryFields || !commitmentFields))
		) {
			context.addIssue({
				code: 'custom',
				message: 'First Ember lifecycle fields are inconsistent'
			});
		}
		if (new Set(core.modifiers.map((modifier) => modifier.key)).size !== core.modifiers.length) {
			context.addIssue({ code: 'custom', message: 'First Ember modifiers must be unique' });
		}
		if (new Set(core.reactions.map((reaction) => reaction.heroId)).size !== core.reactions.length) {
			context.addIssue({ code: 'custom', message: 'First Ember hero reactions must be unique' });
		}
	});

export const EngineSettlementStateV6Schema = z
	.object({
		...EngineSettlementStateV4Schema.shape,
		firstEmber: FirstEmberStateSchema
	})
	.strict();

export const EngineGameStateV6Schema = z
	.object({
		...EngineGameStateV5Schema.shape,
		schemaVersion: z.literal(6),
		settlement: EngineSettlementStateV6Schema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({
					code: 'custom',
					message: 'Building power diverged from its baseline'
				});
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const entries = state.settlement.resourceLedger.filter(
				(entry) => entry.resource === resource
			);
			const last = entries.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
		if (
			state.settlement.firstEmber.status === 'committed' &&
			state.settlement.poweredBuildingId !== state.settlement.firstEmber.buildingId
		) {
			context.addIssue({
				code: 'custom',
				message: 'Committed First Ember must own the power slot'
			});
		}
		if (
			state.settlement.firstEmber.status !== 'committed' &&
			state.settlement.poweredBuildingId !== null
		) {
			context.addIssue({
				code: 'custom',
				message: 'Uncommitted First Ember cannot power a facility'
			});
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'First Ember power projection is inconsistent' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({
				code: 'custom',
				message: 'Active systems diverged from First Ember power'
			});
		}
	});

export const EngineGameStateV7Schema = z
	.object({
		...EngineGameStateV6Schema.shape,
		schemaVersion: z.literal(7),
		society: SocietyStateSchema
	})
	.strict()
	.superRefine((state, context) => {
		if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
			context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
		}
		if (state.status === 'active' && state.master.lifeState !== 'alive') {
			context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
		}
		for (const hero of Object.values(state.heroes)) {
			const itemId = hero.equipment.mainHand;
			if (itemId) {
				const item = state.items[itemId];
				if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
					context.addIssue({
						code: 'custom',
						message: 'Hero equipment must reference an owned item'
					});
				}
			}
			if (hero.assignment) {
				const building = state.settlement.buildings[hero.assignment.buildingId];
				if (
					!building ||
					building.assignmentNodeId !== hero.assignment.nodeId ||
					building.assignmentRole !== hero.assignment.role ||
					!building.assignedHeroIds.includes(hero.heroId)
				) {
					context.addIssue({
						code: 'custom',
						message: 'Hero assignment diverged from building state'
					});
				}
			}
		}
		for (const item of Object.values(state.items)) {
			if (
				item.equippedById &&
				state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId
			) {
				context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
			}
		}
		for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
			if (building.buildingId !== buildingId) {
				context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
			}
			for (const heroId of building.assignedHeroIds) {
				if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
					context.addIssue({
						code: 'custom',
						message: 'Building roster diverged from hero assignment'
					});
				}
			}
			if (
				building.powerState !== 'powered' &&
				building.powerState !== building.baselinePowerState
			) {
				context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
			}
		}
		for (const resource of ResourceKeySchema.options) {
			const last = state.settlement.resourceLedger
				.filter((entry) => entry.resource === resource)
				.at(-1);
			if (last && last.after !== state.settlement.resources[resource]) {
				context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
			}
		}
		const powered = Object.values(state.settlement.buildings).filter(
			(building) => building.powerState === 'powered'
		);
		if (
			powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
			(state.settlement.poweredBuildingId !== null &&
				powered[0]?.buildingId !== state.settlement.poweredBuildingId)
		) {
			context.addIssue({ code: 'custom', message: 'First Ember power projection is inconsistent' });
		}
		if (
			(state.settlement.firstEmber.status === 'committed' &&
				state.settlement.poweredBuildingId !== state.settlement.firstEmber.buildingId) ||
			(state.settlement.firstEmber.status !== 'committed' &&
				state.settlement.poweredBuildingId !== null)
		) {
			context.addIssue({ code: 'custom', message: 'First Ember lifecycle diverged from power' });
		}
		const activeSystemIds = Object.values(state.settlement.buildings)
			.filter((building) => building.powerState !== 'unpowered')
			.map((building) => building.systemId)
			.sort((left, right) => left.localeCompare(right));
		if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
			context.addIssue({
				code: 'custom',
				message: 'Active systems diverged from First Ember power'
			});
		}
		for (const observation of Object.values(state.society.observations)) {
			if (
				!state.heroes[observation.observerHeroId] ||
				observation.subjectIds.some(
					(subjectId) => subjectId !== state.master.masterId && !state.heroes[subjectId]
				)
			) {
				context.addIssue({ code: 'custom', message: 'Observation holder and subjects must exist' });
			}
		}
		for (const belief of Object.values(state.society.beliefs)) {
			const observation = state.society.observations[belief.provenance.observationId];
			if (
				!state.heroes[belief.holderHeroId] ||
				(belief.subjectId !== state.master.masterId && !state.heroes[belief.subjectId]) ||
				(belief.provenance.learnedFromId !== null &&
					belief.provenance.learnedFromId !== state.master.masterId &&
					!state.heroes[belief.provenance.learnedFromId]) ||
				(belief.object.kind === 'entity' &&
					belief.object.entityId !== state.master.masterId &&
					!state.heroes[belief.object.entityId]) ||
				(belief.object.kind === 'promise' && !state.society.promises[belief.object.promiseId]) ||
				!observation ||
				observation.observerHeroId !== belief.holderHeroId ||
				observation.sourceEventId !== belief.provenance.sourceEventId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Belief provenance must resolve to its holder observation'
				});
			}
		}
		const relationshipPairs = new Set<string>();
		for (const relationship of Object.values(state.society.relationships)) {
			const pair = `${relationship.fromHeroId}:${relationship.toEntityId}`;
			if (relationshipPairs.has(pair)) {
				context.addIssue({
					code: 'custom',
					message: 'Directed relationship endpoints must be unique'
				});
			}
			relationshipPairs.add(pair);
			if (
				!state.heroes[relationship.fromHeroId] ||
				(relationship.toEntityId !== state.master.masterId &&
					!state.heroes[relationship.toEntityId])
			) {
				context.addIssue({ code: 'custom', message: 'Relationship endpoints must exist' });
			}
			for (const evidence of relationship.evidence) {
				const observation = state.society.observations[evidence.observationId];
				if (
					!observation ||
					observation.observerHeroId !== relationship.fromHeroId ||
					observation.sourceEventId !== evidence.sourceEventId
				) {
					context.addIssue({
						code: 'custom',
						message: 'Relationship evidence requires an observation'
					});
				}
			}
		}
		const authorityPairs = new Set<string>();
		for (const authority of Object.values(state.society.authority)) {
			const pair = `${authority.observerHeroId}:${authority.subjectId}`;
			if (authorityPairs.has(pair)) {
				context.addIssue({
					code: 'custom',
					message: 'Authority observer and subject must be unique'
				});
			}
			authorityPairs.add(pair);
			if (
				!state.heroes[authority.observerHeroId] ||
				authority.subjectId !== state.master.masterId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Authority must be a hero view of the Master'
				});
			}
			for (const evidence of authority.evidence) {
				const observation = state.society.observations[evidence.observationId];
				if (
					!observation ||
					observation.observerHeroId !== authority.observerHeroId ||
					observation.sourceEventId !== evidence.sourceEventId
				) {
					context.addIssue({
						code: 'custom',
						message: 'Authority evidence requires an observation'
					});
				}
			}
		}
		for (const promise of Object.values(state.society.promises)) {
			if (
				promise.promisorId !== state.master.masterId ||
				promise.promiseeHeroIds.some((heroId) => !state.heroes[heroId]) ||
				promise.witnessObservationIds.some((observationId) => {
					const observation = state.society.observations[observationId];
					return (
						!observation ||
						observation.sourceEventId !== promise.sourceEventId ||
						!promise.promiseeHeroIds.includes(observation.observerHeroId)
					);
				})
			) {
				context.addIssue({
					code: 'custom',
					message: 'Promise participants and witnesses must exist'
				});
			}
		}
	});

const EngineGameStateV8BaseSchema = z
	.object({
		...EngineGameStateV7Schema.shape,
		schemaVersion: z.literal(8),
		society: SocietyStateV2Schema
	})
	.strict();

const EngineGameStateV9BaseSchema = z
	.object({
		...EngineGameStateV7Schema.shape,
		schemaVersion: z.literal(9),
		society: SocietyStateV3Schema
	})
	.strict();

const EngineGameStateV10BaseSchema = z
	.object({
		...EngineGameStateV7Schema.shape,
		schemaVersion: z.literal(10),
		society: SocietyStateV4Schema
	})
	.strict();

export const MissionAttemptStatusSchema = z.enum([
	'preparing',
	'deployed',
	'resolving',
	'extraction',
	'success',
	'failure',
	'retreat',
	'canceled',
	'death'
]);

export const MissionAttemptOutcomeSchema = z.enum([
	'success',
	'failure',
	'retreat',
	'canceled',
	'death'
]);

export const MissionContentBindingSchema = z
	.object({
		missionId: MissionSlugSchema,
		contentVersion: ContentVersionSchema,
		contentHash: StateHashSchema
	})
	.strict();

export const MissionPartySchema = z
	.object({
		masterId: EntityIdSchema,
		heroIds: z.array(EntityIdSchema).max(7),
		memberIds: z.array(EntityIdSchema).min(1).max(8)
	})
	.strict()
	.superRefine((party, context) => {
		if (
			party.memberIds[0] !== party.masterId ||
			party.memberIds.slice(1).join('|') !== party.heroIds.join('|')
		) {
			context.addIssue({ code: 'custom', message: 'Mission party members must be Master first' });
		}
		if (
			new Set(party.heroIds).size !== party.heroIds.length ||
			new Set(party.memberIds).size !== party.memberIds.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission party members must be unique' });
		}
	});

export const MissionAttemptSchema = z
	.object({
		attemptId: EntityIdSchema,
		ordinal: z.number().int().positive(),
		status: MissionAttemptStatusSchema,
		party: MissionPartySchema,
		entryNodeId: MissionSlugSchema,
		extractionNodeId: MissionSlugSchema,
		positions: z.record(EntityIdSchema, MissionSlugSchema),
		knowledge: MissionArenaKnowledgeSchema,
		completedObjectiveIds: z.array(MissionSlugSchema).max(20),
		preparedAt: IsoDateTimeSchema,
		deployedAt: IsoDateTimeSchema.nullable(),
		extractionOpenedAt: IsoDateTimeSchema.nullable(),
		endedAt: IsoDateTimeSchema.nullable(),
		outcome: MissionAttemptOutcomeSchema.nullable()
	})
	.strict()
	.superRefine((attempt, context) => {
		if (new Set(attempt.completedObjectiveIds).size !== attempt.completedObjectiveIds.length) {
			context.addIssue({ code: 'custom', message: 'Completed mission objectives must be unique' });
		}
		const terminal = ['success', 'failure', 'retreat', 'canceled', 'death'].includes(
			attempt.status
		);
		if (terminal !== (attempt.endedAt !== null) || terminal !== (attempt.outcome !== null)) {
			context.addIssue({ code: 'custom', message: 'Mission terminal fields are inconsistent' });
		}
		if (terminal && attempt.outcome !== attempt.status) {
			context.addIssue({ code: 'custom', message: 'Mission outcome must match terminal status' });
		}
		if (
			(attempt.status !== 'preparing' && attempt.status !== 'canceled') !==
			(attempt.deployedAt !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission deployment timestamp is inconsistent' });
		}
		if (
			(['extraction', 'success'].includes(attempt.status) && attempt.extractionOpenedAt === null) ||
			(['preparing', 'deployed', 'resolving', 'canceled'].includes(attempt.status) &&
				attempt.extractionOpenedAt !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission extraction timestamp is inconsistent' });
		}
		const positionIds = Object.keys(attempt.positions).sort();
		const memberIds = [...attempt.party.memberIds].sort();
		const positionsRequired = attempt.status !== 'preparing' && attempt.status !== 'canceled';
		if (
			positionsRequired ? positionIds.join('|') !== memberIds.join('|') : positionIds.length !== 0
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission positions must match the deployed party'
			});
		}
	});

export const MissionRunStateSchema = z
	.object({
		binding: MissionContentBindingSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptSchema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({ code: 'custom', message: 'Mission attempt count is inconsistent' });
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Current mission attempt ordinal is inconsistent'
			});
		}
	});

export const MissionChoiceSourceSchema = z.enum(['manual', 'scripted', 'random', 'model']);

export const MissionObjectiveProgressSchema = z
	.object({
		objectiveId: MissionSlugSchema,
		status: z.enum(['available', 'carried', 'delivered']),
		carrierId: EntityIdSchema.nullable(),
		recoveredOnRound: z.number().int().positive().nullable(),
		deliveredOnRound: z.number().int().positive().nullable()
	})
	.strict()
	.superRefine((objective, context) => {
		if ((objective.status === 'carried') !== (objective.carrierId !== null)) {
			context.addIssue({ code: 'custom', message: 'Mission objective carrier is inconsistent' });
		}
		if ((objective.status !== 'available') !== (objective.recoveredOnRound !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective recovery round is inconsistent'
			});
		}
		if ((objective.status === 'delivered') !== (objective.deliveredOnRound !== null)) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective delivery round is inconsistent'
			});
		}
	});

export const MissionTurnChoiceSchema = z
	.object({
		actorId: EntityIdSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		source: MissionChoiceSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		packetHash: StateHashSchema.nullable(),
		legalActionHash: StateHashSchema.nullable(),
		policyResultHash: StateHashSchema.nullable(),
		publicIntent: z.string().min(1).max(240)
	})
	.strict()
	.superRefine((choice, context) => {
		const policyChoice = choice.source !== 'manual';
		if (
			policyChoice !== (choice.policyId !== null) ||
			policyChoice !== (choice.packetHash !== null) ||
			policyChoice !== (choice.legalActionHash !== null) ||
			policyChoice !== (choice.policyResultHash !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission choice policy evidence is inconsistent'
			});
		}
	});

export const MissionResolvedActionSchema = z
	.object({
		actorId: EntityIdSchema,
		actorKind: z.enum(['master', 'hero']),
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		choiceSource: MissionChoiceSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		packetHash: StateHashSchema.nullable(),
		legalActionHash: StateHashSchema.nullable(),
		policyResultHash: StateHashSchema.nullable(),
		publicIntent: z.string().min(1).max(240),
		initiativeBase: z.number().int().min(0).max(1_000),
		initiativeTieBreak: z.number().int().min(0).max(99),
		initiative: z.number().int().min(0).max(1_099),
		outcome: z.enum(['applied', 'superseded']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		discoveryIds: z.array(MissionSlugSchema).max(20),
		objectiveTransition: z.enum(['recovered', 'delivered']).nullable(),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.refine((action) => action.initiative === action.initiativeBase + action.initiativeTieBreak, {
		message: 'Mission initiative total is inconsistent'
	});

export const MissionRoundSchema = z
	.object({
		roundNumber: z.number().int().positive(),
		stateVersion: z.number().int().nonnegative(),
		environmentEventIds: z.array(MissionSlugSchema).max(20),
		monsterActionIds: z.array(z.string().min(1).max(120)).max(40),
		initiativeOrder: z.array(EntityIdSchema).min(1).max(8),
		actions: z.array(MissionResolvedActionSchema).min(1).max(8),
		statusAfter: MissionAttemptStatusSchema
	})
	.strict()
	.superRefine((round, context) => {
		if (
			round.actions.map((action) => action.actorId).join('|') !== round.initiativeOrder.join('|') ||
			new Set(round.initiativeOrder).size !== round.initiativeOrder.length
		) {
			context.addIssue({ code: 'custom', message: 'Mission initiative order is inconsistent' });
		}
	});

export const MissionTurnStateSchema = z
	.object({
		turnVersion: z.literal('mission-turn-v1'),
		maximumRounds: z.literal(48),
		roundNumber: z.number().int().nonnegative().max(48),
		objective: MissionObjectiveProgressSchema,
		rounds: z.array(MissionRoundSchema).max(48)
	})
	.strict()
	.superRefine((turn, context) => {
		if (turn.roundNumber !== turn.rounds.length) {
			context.addIssue({ code: 'custom', message: 'Mission round history is inconsistent' });
		}
		if (turn.rounds.some((round, index) => round.roundNumber !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Mission round numbers must be contiguous' });
		}
	});

export const MissionAttemptV2Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateSchema
	})
	.strict()
	.superRefine((attempt, context) => {
		const legacyAttempt = Object.fromEntries(
			Object.entries(attempt).filter(([key]) => key !== 'turnState')
		);
		const legacy = MissionAttemptSchema.safeParse(legacyAttempt);
		if (!legacy.success) {
			context.addIssue({ code: 'custom', message: 'Mission attempt lifecycle is inconsistent' });
		}
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
			(attempt.turnState.objective.status === 'delivered')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective completion and delivery diverged'
			});
		}
		if (attempt.status === 'extraction' && attempt.turnState.objective.status !== 'delivered') {
			context.addIssue({
				code: 'custom',
				message: 'Mission extraction requires a delivered objective'
			});
		}
	});

export const MissionRunStateV2Schema = z
	.object({
		binding: MissionContentBindingSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV2Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({ code: 'custom', message: 'Mission attempt count is inconsistent' });
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Current mission attempt ordinal is inconsistent'
			});
		}
	});

export const MissionMonsterPolicyBindingSchema = z
	.object({
		contentVersion: ContentVersionSchema,
		contentHash: StateHashSchema
	})
	.strict();

export const MissionMonsterStateSchema = z
	.object({
		monsterId: EntityIdSchema,
		dutySlotId: MissionSlugSchema,
		policyId: MissionSlugSchema,
		label: z.string().min(1).max(100),
		ordinal: z.number().int().positive().max(100),
		nodeId: MissionSlugSchema,
		status: z.enum(['active', 'defeated']),
		vitality: z.number().int().nonnegative().max(1_000),
		maximumVitality: z.number().int().positive().max(1_000),
		alertState: z.enum(['duty', 'alarmed', 'engaged']),
		defeatedOnRound: z.number().int().positive().nullable(),
		lastActionId: z
			.string()
			.regex(/^[a-z][a-z0-9._-]{1,119}$/u)
			.nullable()
	})
	.strict()
	.superRefine((monster, context) => {
		if (
			monster.vitality > monster.maximumVitality ||
			(monster.status === 'active') !== monster.vitality > 0 ||
			(monster.status === 'defeated') !== (monster.defeatedOnRound !== null)
		) {
			context.addIssue({ code: 'custom', message: 'Mission monster state is inconsistent' });
		}
	});

export const MissionPartyGuardStateSchema = z
	.object({
		actorId: EntityIdSchema,
		guard: z.number().int().nonnegative().max(100),
		maximumGuard: z.number().int().positive().max(100),
		status: z.enum(['ready', 'exposed']),
		lastChangedOnRound: z.number().int().nonnegative().max(48)
	})
	.strict()
	.superRefine((guard, context) => {
		if (guard.guard > guard.maximumGuard || (guard.status === 'ready') !== guard.guard > 0) {
			context.addIssue({ code: 'custom', message: 'Mission party guard is inconsistent' });
		}
	});

export const MissionFurnaceStateSchema = z.enum(['absent', 'lit', 'cooling', 'quenched']);

export const MissionCombatArenaStateSchema = z
	.object({
		furnaceState: MissionFurnaceStateSchema,
		coolingControlNodeId: MissionSlugSchema.nullable(),
		coolingControlExposed: z.boolean()
	})
	.strict()
	.superRefine((arena, context) => {
		if (
			(arena.furnaceState === 'absent') !== (arena.coolingControlNodeId === null) ||
			(arena.coolingControlNodeId === null && arena.coolingControlExposed)
		) {
			context.addIssue({ code: 'custom', message: 'Mission furnace state is inconsistent' });
		}
	});

export const MissionMonsterIntentSchema = z
	.object({
		monsterId: EntityIdSchema,
		policyId: MissionSlugSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,119}$/u),
		kind: z.enum(['hold', 'move', 'strike', 'alarm', 'furnace-surge', 'defend-control']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		targetId: EntityIdSchema.nullable(),
		telegraph: z.string().min(1).max(240),
		anticipatedEffect: z.string().min(1).max(240)
	})
	.strict();

export const MissionResolvedEffectSchema = z
	.object({
		effectId: EntityIdSchema,
		sourceKind: z.enum(['party', 'monster', 'environment']),
		sourceId: z.string().min(1).max(120),
		targetKind: z.enum(['party', 'monster', 'arena']),
		targetId: z.string().min(1).max(120),
		kind: z.enum(['guard-damage', 'vitality-damage', 'alarm', 'furnace-change']),
		amount: z.number().int().nonnegative().max(1_000),
		before: z.number().int().nonnegative().max(1_000).nullable(),
		after: z.number().int().nonnegative().max(1_000).nullable(),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.superRefine((effect, context) => {
		const numerical = effect.kind === 'guard-damage' || effect.kind === 'vitality-damage';
		if (numerical !== (effect.before !== null && effect.after !== null)) {
			context.addIssue({ code: 'custom', message: 'Mission effect values are inconsistent' });
		}
	});

export const MissionResolvedPartyActionV2Schema = z
	.object({
		actorId: EntityIdSchema,
		actorKind: z.enum(['master', 'hero']),
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u),
		choiceSource: MissionChoiceSourceSchema,
		policyId: z.string().min(1).max(120).nullable(),
		packetHash: StateHashSchema.nullable(),
		legalActionHash: StateHashSchema.nullable(),
		policyResultHash: StateHashSchema.nullable(),
		publicIntent: z.string().min(1).max(240),
		initiativeBase: z.number().int().min(0).max(1_000),
		initiativeTieBreak: z.number().int().min(0).max(99),
		initiative: z.number().int().min(0).max(1_099),
		outcome: z.enum(['applied', 'superseded']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		targetId: EntityIdSchema.nullable(),
		discoveryIds: z.array(MissionSlugSchema).max(20),
		objectiveTransition: z.enum(['recovered', 'delivered']).nullable(),
		effectIds: z.array(EntityIdSchema).max(20),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.refine((action) => action.initiative === action.initiativeBase + action.initiativeTieBreak, {
		message: 'Mission initiative total is inconsistent'
	});

export const MissionResolvedMonsterActionSchema = z
	.object({
		monsterId: EntityIdSchema,
		policyId: MissionSlugSchema,
		actionId: z.string().regex(/^[a-z][a-z0-9._-]{1,119}$/u),
		kind: z.enum(['hold', 'move', 'strike', 'alarm', 'furnace-surge', 'defend-control']),
		initiativeBase: z.number().int().min(0).max(1_000),
		initiativeTieBreak: z.number().int().min(0).max(99),
		initiative: z.number().int().min(0).max(1_099),
		outcome: z.enum(['applied', 'superseded']),
		fromNodeId: MissionSlugSchema,
		toNodeId: MissionSlugSchema,
		targetId: EntityIdSchema.nullable(),
		effectIds: z.array(EntityIdSchema).max(20),
		summary: z.string().min(1).max(300)
	})
	.strict()
	.refine((action) => action.initiative === action.initiativeBase + action.initiativeTieBreak, {
		message: 'Mission monster initiative total is inconsistent'
	});

export const MissionRoundV2Schema = z
	.object({
		roundVersion: z.literal('mission-round-v2'),
		roundNumber: z.number().int().positive(),
		stateVersion: z.number().int().nonnegative(),
		environmentEventIds: z.array(MissionSlugSchema).max(20),
		threatIntents: z.array(MissionMonsterIntentSchema).max(40),
		monsterActionIds: z.array(z.string().min(1).max(120)).max(40),
		initiativeOrder: z.array(EntityIdSchema).min(1).max(48),
		actions: z.array(MissionResolvedPartyActionV2Schema).min(1).max(8),
		monsterActions: z.array(MissionResolvedMonsterActionSchema).max(40),
		effects: z.array(MissionResolvedEffectSchema).max(120),
		statusAfter: MissionAttemptStatusSchema
	})
	.strict()
	.superRefine((round, context) => {
		const ranked = [...round.actions, ...round.monsterActions]
			.sort(
				(left, right) =>
					right.initiative - left.initiative ||
					('actorId' in left ? left.actorId : left.monsterId).localeCompare(
						'actorId' in right ? right.actorId : right.monsterId
					)
			)
			.map((action) => ('actorId' in action ? action.actorId : action.monsterId));
		if (
			ranked.join('|') !== round.initiativeOrder.join('|') ||
			new Set(round.initiativeOrder).size !== round.initiativeOrder.length ||
			round.monsterActionIds.join('|') !==
				round.monsterActions.map((action) => action.actionId).join('|')
		) {
			context.addIssue({ code: 'custom', message: 'Mission combat initiative is inconsistent' });
		}
	});

export const MissionTurnStateV2Schema = z
	.object({
		turnVersion: z.literal('mission-turn-v2'),
		maximumRounds: z.literal(48),
		roundNumber: z.number().int().nonnegative().max(48),
		objective: MissionObjectiveProgressSchema,
		policyBinding: MissionMonsterPolicyBindingSchema,
		monsters: z.record(EntityIdSchema, MissionMonsterStateSchema),
		partyGuard: z.record(EntityIdSchema, MissionPartyGuardStateSchema),
		arena: MissionCombatArenaStateSchema,
		currentThreatIntents: z.array(MissionMonsterIntentSchema).max(40),
		rounds: z.array(MissionRoundV2Schema).max(48)
	})
	.strict()
	.superRefine((turn, context) => {
		if (turn.roundNumber !== turn.rounds.length) {
			context.addIssue({ code: 'custom', message: 'Mission combat round history is inconsistent' });
		}
		if (turn.rounds.some((round, index) => round.roundNumber !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Mission combat rounds must be contiguous' });
		}
		for (const [monsterId, monster] of Object.entries(turn.monsters)) {
			if (monster.monsterId !== monsterId) {
				context.addIssue({ code: 'custom', message: 'Mission monster key must match its id' });
			}
		}
		for (const [actorId, guard] of Object.entries(turn.partyGuard)) {
			if (guard.actorId !== actorId) {
				context.addIssue({ code: 'custom', message: 'Mission guard key must match its actor id' });
			}
		}
		if (
			turn.currentThreatIntents.some(
				(intent) => turn.monsters[intent.monsterId]?.status !== 'active'
			)
		) {
			context.addIssue({ code: 'custom', message: 'Only active monsters may telegraph intent' });
		}
	});

export const MissionAttemptV3Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateV2Schema
	})
	.strict()
	.superRefine((attempt, context) => {
		const legacyAttempt = Object.fromEntries(
			Object.entries(attempt).filter(([key]) => key !== 'turnState')
		);
		if (!MissionAttemptSchema.safeParse(legacyAttempt).success) {
			context.addIssue({ code: 'custom', message: 'Mission combat lifecycle is inconsistent' });
		}
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
			(attempt.turnState.objective.status === 'delivered')
		) {
			context.addIssue({ code: 'custom', message: 'Mission combat objective delivery diverged' });
		}
		const members = [...attempt.party.memberIds].sort().join('|');
		if (Object.keys(attempt.turnState.partyGuard).sort().join('|') !== members) {
			context.addIssue({ code: 'custom', message: 'Mission guard must match the complete party' });
		}
	});

export const MissionRunStateV3Schema = z
	.object({
		binding: MissionContentBindingSchema,
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({ code: 'custom', message: 'Mission combat attempt count is inconsistent' });
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Mission combat attempt ordinal is inconsistent'
			});
		}
	});

export const MissionEvidenceRecordSchema = z
	.object({
		evidenceId: EntityIdSchema,
		evidenceKey: MissionSlugSchema,
		holderActorId: EntityIdSchema,
		sourceBinding: MissionContentBindingSchema,
		sourceAttemptId: EntityIdSchema,
		discoveredOnRound: z.number().int().positive().max(48)
	})
	.strict();

export const MissionRunStateV4Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV3Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if ((mission.attempt === null) !== (mission.attemptCount === 0)) {
			context.addIssue({
				code: 'custom',
				message: 'Mission evidence attempt count is inconsistent'
			});
		}
		if (mission.attempt && mission.attempt.ordinal !== mission.attemptCount) {
			context.addIssue({
				code: 'custom',
				message: 'Mission evidence attempt ordinal is inconsistent'
			});
		}
		if (
			new Set(mission.availableMissionIds).size !== mission.availableMissionIds.length ||
			!mission.availableMissionIds.includes(mission.binding.missionId)
		) {
			context.addIssue({ code: 'custom', message: 'Mission availability binding is inconsistent' });
		}
		for (const [evidenceId, evidence] of Object.entries(mission.evidence)) {
			if (evidence.evidenceId !== evidenceId) {
				context.addIssue({ code: 'custom', message: 'Mission evidence key must match its id' });
			}
		}
	});

export const PortalPressureStageSchema = z.enum(['stable', 'warning', 'critical', 'collapsed']);

export const PortalDepositStateSchema = z
	.object({
		depositId: MissionSlugSchema,
		nodeId: MissionSlugSchema,
		resource: z.literal('iron-ore'),
		initialAmount: z.number().int().positive().max(100),
		remainingAmount: z.number().int().nonnegative().max(100),
		mineAmountPerAction: z.number().int().positive().max(20)
	})
	.strict()
	.superRefine((deposit, context) => {
		if (
			deposit.remainingAmount > deposit.initialAmount ||
			deposit.mineAmountPerAction > deposit.initialAmount
		) {
			context.addIssue({ code: 'custom', message: 'Portal deposit state is inconsistent' });
		}
	});

export const PortalCargoStateSchema = z
	.object({
		actorId: EntityIdSchema,
		resource: z.literal('iron-ore'),
		amount: z.number().int().nonnegative().max(100),
		capacity: z.number().int().positive().max(100)
	})
	.strict()
	.refine((cargo) => cargo.amount <= cargo.capacity, {
		message: 'Portal cargo exceeds actor capacity'
	});

export const PortalOreLedgerEntrySchema = z
	.object({
		entryId: EntityIdSchema,
		sequence: z.number().int().positive().max(1_000),
		roundNumber: z.number().int().positive().max(48),
		kind: z.enum(['mined', 'extracted', 'lost']),
		actorId: EntityIdSchema,
		depositId: MissionSlugSchema.nullable(),
		nodeId: MissionSlugSchema,
		amount: z.number().int().positive().max(100),
		cargoBefore: z.number().int().nonnegative().max(100),
		cargoAfter: z.number().int().nonnegative().max(100),
		depositBefore: z.number().int().nonnegative().max(100).nullable(),
		depositAfter: z.number().int().nonnegative().max(100).nullable(),
		settlementBefore: z.number().int().nonnegative().nullable(),
		settlementAfter: z.number().int().nonnegative().nullable()
	})
	.strict()
	.superRefine((entry, context) => {
		if (
			entry.cargoBefore - entry.cargoAfter !==
			(entry.kind === 'mined' ? -entry.amount : entry.amount)
		) {
			context.addIssue({ code: 'custom', message: 'Portal ore cargo delta is inconsistent' });
		}
		if (entry.kind === 'mined') {
			if (
				entry.depositId === null ||
				entry.depositBefore === null ||
				entry.depositAfter === null ||
				entry.depositBefore - entry.depositAfter !== entry.amount ||
				entry.settlementBefore !== null ||
				entry.settlementAfter !== null
			) {
				context.addIssue({ code: 'custom', message: 'Portal mining ledger entry is inconsistent' });
			}
		} else if (
			entry.depositId !== null ||
			entry.depositBefore !== null ||
			entry.depositAfter !== null ||
			(entry.kind === 'extracted'
				? entry.settlementBefore === null ||
					entry.settlementAfter === null ||
					entry.settlementAfter - entry.settlementBefore !== entry.amount
				: entry.settlementBefore !== null || entry.settlementAfter !== null)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Portal terminal ore ledger entry is inconsistent'
			});
		}
	});

export const PortalMissionObjectiveProgressSchema = z
	.object({
		objectiveId: MissionSlugSchema,
		status: z.enum(['available', 'quota-met', 'delivered']),
		quota: z.number().int().positive().max(1_000),
		minedAmount: z.number().int().nonnegative().max(10_000),
		quotaReachedOnRound: z.number().int().positive().max(48).nullable(),
		deliveredOnRound: z.number().int().positive().max(48).nullable()
	})
	.strict()
	.superRefine((objective, context) => {
		if (
			(objective.status === 'available') !== (objective.quotaReachedOnRound === null) ||
			(objective.status === 'delivered') !== (objective.deliveredOnRound !== null) ||
			(objective.status === 'available' && objective.minedAmount >= objective.quota) ||
			(objective.status !== 'available' && objective.minedAmount < objective.quota)
		) {
			context.addIssue({ code: 'custom', message: 'Portal objective progress is inconsistent' });
		}
	});

export const PortalRoundWindowSchema = z
	.object({
		roundsRemainingBefore: z.number().int().positive().max(48),
		roundsRemainingAfter: z.number().int().nonnegative().max(47),
		pressureBefore: PortalPressureStageSchema.exclude(['collapsed']),
		pressureAfter: PortalPressureStageSchema
	})
	.strict()
	.refine((window) => window.roundsRemainingBefore - window.roundsRemainingAfter === 1, {
		message: 'Portal round window must consume exactly one round'
	});

export const MissionRoundV3Schema = z
	.object({
		...MissionRoundV2Schema.shape,
		roundVersion: z.literal('mission-round-v3'),
		portalWindow: PortalRoundWindowSchema,
		oreLedgerEntryIds: z.array(EntityIdSchema).max(16)
	})
	.strict()
	.superRefine((round, context) => {
		const combatRound = Object.fromEntries(
			Object.entries(round).filter(([key]) => key !== 'portalWindow' && key !== 'oreLedgerEntryIds')
		);
		const combat = MissionRoundV2Schema.safeParse({
			...combatRound,
			roundVersion: 'mission-round-v2'
		});
		if (!combat.success) {
			context.addIssue({ code: 'custom', message: 'Portal round combat ledger is inconsistent' });
		}
		if (new Set(round.oreLedgerEntryIds).size !== round.oreLedgerEntryIds.length) {
			context.addIssue({ code: 'custom', message: 'Portal round ore ledger ids must be unique' });
		}
	});

export const PortalMissionStateSchema = z
	.object({
		portalVersion: z.literal('portal-runtime-v1'),
		portalId: MissionSlugSchema,
		durationRounds: z.number().int().min(3).max(48),
		roundsRemaining: z.number().int().nonnegative().max(48),
		warningAtRemainingRounds: z.number().int().positive().max(47),
		criticalAtRemainingRounds: z.number().int().positive().max(46),
		pressureStage: PortalPressureStageSchema,
		extractionQuota: z.number().int().positive().max(1_000),
		cargoCapacityPerActor: z.number().int().positive().max(100),
		deposits: z.record(MissionSlugSchema, PortalDepositStateSchema),
		cargo: z.record(EntityIdSchema, PortalCargoStateSchema),
		oreLedger: z.array(PortalOreLedgerEntrySchema).max(1_000),
		extractedAmount: z.number().int().nonnegative().max(10_000),
		extractionCredited: z.boolean()
	})
	.strict()
	.superRefine((portal, context) => {
		if (
			portal.warningAtRemainingRounds >= portal.durationRounds ||
			portal.criticalAtRemainingRounds >= portal.warningAtRemainingRounds
		) {
			context.addIssue({ code: 'custom', message: 'Portal runtime thresholds are inconsistent' });
		}
		const expectedPressure =
			portal.roundsRemaining === 0
				? 'collapsed'
				: portal.roundsRemaining <= portal.criticalAtRemainingRounds
					? 'critical'
					: portal.roundsRemaining <= portal.warningAtRemainingRounds
						? 'warning'
						: 'stable';
		if (portal.pressureStage !== expectedPressure) {
			context.addIssue({
				code: 'custom',
				message: 'Portal pressure stage diverged from its timer'
			});
		}
		for (const [depositId, deposit] of Object.entries(portal.deposits)) {
			if (deposit.depositId !== depositId) {
				context.addIssue({ code: 'custom', message: 'Portal deposit key must match its id' });
			}
		}
		for (const [actorId, cargo] of Object.entries(portal.cargo)) {
			if (cargo.actorId !== actorId || cargo.capacity !== portal.cargoCapacityPerActor) {
				context.addIssue({ code: 'custom', message: 'Portal cargo holder is inconsistent' });
			}
		}
		if (portal.oreLedger.some((entry, index) => entry.sequence !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Portal ore ledger sequence is inconsistent' });
		}
		const extracted = portal.oreLedger
			.filter((entry) => entry.kind === 'extracted')
			.reduce((sum, entry) => sum + entry.amount, 0);
		if (portal.extractedAmount !== extracted || portal.extractionCredited !== extracted > 0) {
			context.addIssue({ code: 'custom', message: 'Portal extracted ore total is inconsistent' });
		}
	});

export const MissionTurnStateV3Schema = z
	.object({
		turnVersion: z.literal('mission-turn-v3'),
		maximumRounds: z.number().int().min(3).max(48),
		roundNumber: z.number().int().nonnegative().max(48),
		objective: PortalMissionObjectiveProgressSchema,
		policyBinding: MissionMonsterPolicyBindingSchema,
		monsters: z.record(EntityIdSchema, MissionMonsterStateSchema),
		partyGuard: z.record(EntityIdSchema, MissionPartyGuardStateSchema),
		arena: MissionCombatArenaStateSchema,
		currentThreatIntents: z.array(MissionMonsterIntentSchema).max(40),
		portal: PortalMissionStateSchema,
		rounds: z.array(MissionRoundV3Schema).max(48)
	})
	.strict()
	.superRefine((turn, context) => {
		if (
			turn.roundNumber !== turn.rounds.length ||
			turn.maximumRounds !== turn.portal.durationRounds ||
			turn.portal.roundsRemaining !== turn.maximumRounds - turn.roundNumber
		) {
			context.addIssue({
				code: 'custom',
				message: 'Portal turn history and timer are inconsistent'
			});
		}
		if (turn.rounds.some((round, index) => round.roundNumber !== index + 1)) {
			context.addIssue({ code: 'custom', message: 'Portal rounds must be contiguous' });
		}
		for (const [monsterId, monster] of Object.entries(turn.monsters)) {
			if (monster.monsterId !== monsterId) {
				context.addIssue({ code: 'custom', message: 'Portal monster key must match its id' });
			}
		}
	});

export const MissionAttemptV4Schema = z
	.object({
		...MissionAttemptSchema.shape,
		turnState: MissionTurnStateV3Schema
	})
	.strict()
	.superRefine((attempt, context) => {
		const lifecycle = MissionAttemptSchema.safeParse(
			Object.fromEntries(Object.entries(attempt).filter(([key]) => key !== 'turnState'))
		);
		if (!lifecycle.success) {
			context.addIssue({ code: 'custom', message: 'Portal mission lifecycle is inconsistent' });
		}
		const memberIds = [...attempt.party.memberIds].sort().join('|');
		if (
			Object.keys(attempt.turnState.partyGuard).sort().join('|') !== memberIds ||
			Object.keys(attempt.turnState.portal.cargo).sort().join('|') !== memberIds
		) {
			context.addIssue({ code: 'custom', message: 'Portal party state must match every member' });
		}
		const delivered = attempt.turnState.objective.status === 'delivered';
		if (
			attempt.completedObjectiveIds.includes(attempt.turnState.objective.objectiveId) !==
				delivered ||
			(attempt.status === 'extraction' && !delivered) ||
			(attempt.status === 'failure') !== (attempt.turnState.portal.pressureStage === 'collapsed') ||
			(attempt.status === 'success') !== attempt.turnState.portal.extractionCredited
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission outcome is inconsistent' });
		}
	});

export const MissionRunStateV5Schema = z
	.object({
		binding: MissionContentBindingSchema,
		availableMissionIds: z.array(MissionSlugSchema).min(1).max(100),
		evidence: z.record(EntityIdSchema, MissionEvidenceRecordSchema),
		attemptCount: z.number().int().nonnegative(),
		attempt: MissionAttemptV4Schema.nullable()
	})
	.strict()
	.superRefine((mission, context) => {
		if (
			(mission.attempt === null) !== (mission.attemptCount === 0) ||
			(mission.attempt !== null && mission.attempt.ordinal !== mission.attemptCount)
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission attempt count is inconsistent' });
		}
		if (
			new Set(mission.availableMissionIds).size !== mission.availableMissionIds.length ||
			!mission.availableMissionIds.includes(mission.binding.missionId)
		) {
			context.addIssue({ code: 'custom', message: 'Portal mission availability is inconsistent' });
		}
		for (const [evidenceId, evidence] of Object.entries(mission.evidence)) {
			if (evidence.evidenceId !== evidenceId) {
				context.addIssue({ code: 'custom', message: 'Portal evidence key must match its id' });
			}
		}
	});

const EngineGameStateV11BaseSchema = z
	.object({
		...EngineGameStateV10BaseSchema.shape,
		schemaVersion: z.literal(11),
		mission: MissionRunStateSchema
	})
	.strict();

const EngineGameStateV12BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(12),
		mission: MissionRunStateV2Schema
	})
	.strict();

const EngineGameStateV13BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(13),
		mission: MissionRunStateV3Schema
	})
	.strict();

const EngineGameStateV14BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(14),
		mission: MissionRunStateV4Schema
	})
	.strict();

const EngineGameStateV15BaseSchema = z
	.object({
		...EngineGameStateV11BaseSchema.shape,
		schemaVersion: z.literal(15),
		mission: MissionRunStateV5Schema
	})
	.strict();

type CommunicationEngineValidationState =
	| z.infer<typeof EngineGameStateV8BaseSchema>
	| z.infer<typeof EngineGameStateV9BaseSchema>
	| z.infer<typeof EngineGameStateV10BaseSchema>
	| z.infer<typeof EngineGameStateV11BaseSchema>
	| z.infer<typeof EngineGameStateV12BaseSchema>
	| z.infer<typeof EngineGameStateV13BaseSchema>
	| z.infer<typeof EngineGameStateV14BaseSchema>
	| z.infer<typeof EngineGameStateV15BaseSchema>;

function validateCommunicationEngineState(
	state: CommunicationEngineValidationState,
	context: z.RefinementCtx
): void {
	if (state.master.lifeState === 'dead' && state.status !== 'game_over') {
		context.addIssue({ code: 'custom', message: 'Master death must atomically end the run' });
	}
	if (state.status === 'active' && state.master.lifeState !== 'alive') {
		context.addIssue({ code: 'custom', message: 'An active run requires a living Master' });
	}
	for (const hero of Object.values(state.heroes)) {
		const itemId = hero.equipment.mainHand;
		if (itemId) {
			const item = state.items[itemId];
			if (!item || item.ownerId !== hero.heroId || item.equippedById !== hero.heroId) {
				context.addIssue({
					code: 'custom',
					message: 'Hero equipment must reference an owned item'
				});
			}
		}
		if (hero.assignment) {
			const building = state.settlement.buildings[hero.assignment.buildingId];
			if (
				!building ||
				building.assignmentNodeId !== hero.assignment.nodeId ||
				building.assignmentRole !== hero.assignment.role ||
				!building.assignedHeroIds.includes(hero.heroId)
			) {
				context.addIssue({
					code: 'custom',
					message: 'Hero assignment diverged from building state'
				});
			}
		}
	}
	for (const item of Object.values(state.items)) {
		if (item.equippedById && state.heroes[item.equippedById]?.equipment.mainHand !== item.itemId) {
			context.addIssue({ code: 'custom', message: 'Equipped item must be linked by its hero' });
		}
	}
	for (const [buildingId, building] of Object.entries(state.settlement.buildings)) {
		if (building.buildingId !== buildingId) {
			context.addIssue({ code: 'custom', message: 'Building record key does not match its id' });
		}
		for (const heroId of building.assignedHeroIds) {
			if (state.heroes[heroId]?.assignment?.buildingId !== buildingId) {
				context.addIssue({
					code: 'custom',
					message: 'Building roster diverged from hero assignment'
				});
			}
		}
		if (building.powerState !== 'powered' && building.powerState !== building.baselinePowerState) {
			context.addIssue({ code: 'custom', message: 'Building power diverged from its baseline' });
		}
	}
	for (const resource of ResourceKeySchema.options) {
		const last = state.settlement.resourceLedger
			.filter((entry) => entry.resource === resource)
			.at(-1);
		if (last && last.after !== state.settlement.resources[resource]) {
			context.addIssue({ code: 'custom', message: `Resource ledger diverged for ${resource}` });
		}
	}
	const powered = Object.values(state.settlement.buildings).filter(
		(building) => building.powerState === 'powered'
	);
	if (
		powered.length !== (state.settlement.poweredBuildingId ? 1 : 0) ||
		(state.settlement.poweredBuildingId !== null &&
			powered[0]?.buildingId !== state.settlement.poweredBuildingId)
	) {
		context.addIssue({ code: 'custom', message: 'First Ember power projection is inconsistent' });
	}
	if (
		(state.settlement.firstEmber.status === 'committed' &&
			state.settlement.poweredBuildingId !== state.settlement.firstEmber.buildingId) ||
		(state.settlement.firstEmber.status !== 'committed' &&
			state.settlement.poweredBuildingId !== null)
	) {
		context.addIssue({ code: 'custom', message: 'First Ember lifecycle diverged from power' });
	}
	const activeSystemIds = Object.values(state.settlement.buildings)
		.filter((building) => building.powerState !== 'unpowered')
		.map((building) => building.systemId)
		.sort((left, right) => left.localeCompare(right));
	if (activeSystemIds.join('|') !== state.settlement.navigation.activeSystemIds.join('|')) {
		context.addIssue({
			code: 'custom',
			message: 'Active systems diverged from First Ember power'
		});
	}
	for (const observation of Object.values(state.society.observations)) {
		if (
			!state.heroes[observation.observerHeroId] ||
			observation.subjectIds.some(
				(subjectId) => subjectId !== state.master.masterId && !state.heroes[subjectId]
			)
		) {
			context.addIssue({ code: 'custom', message: 'Observation holder and subjects must exist' });
		}
	}
	for (const belief of Object.values(state.society.beliefs)) {
		const observation = state.society.observations[belief.provenance.observationId];
		if (
			!state.heroes[belief.holderHeroId] ||
			(belief.subjectId !== state.master.masterId && !state.heroes[belief.subjectId]) ||
			(belief.provenance.learnedFromId !== null &&
				belief.provenance.learnedFromId !== state.master.masterId &&
				!state.heroes[belief.provenance.learnedFromId]) ||
			(belief.object.kind === 'entity' &&
				belief.object.entityId !== state.master.masterId &&
				!state.heroes[belief.object.entityId]) ||
			(belief.object.kind === 'promise' && !state.society.promises[belief.object.promiseId]) ||
			!observation ||
			observation.observerHeroId !== belief.holderHeroId ||
			observation.sourceEventId !== belief.provenance.sourceEventId
		) {
			context.addIssue({
				code: 'custom',
				message: 'Belief provenance must resolve to its holder observation'
			});
		}
	}
	const relationshipPairs = new Set<string>();
	for (const relationship of Object.values(state.society.relationships)) {
		const pair = `${relationship.fromHeroId}:${relationship.toEntityId}`;
		if (relationshipPairs.has(pair)) {
			context.addIssue({
				code: 'custom',
				message: 'Directed relationship endpoints must be unique'
			});
		}
		relationshipPairs.add(pair);
		if (
			!state.heroes[relationship.fromHeroId] ||
			(relationship.toEntityId !== state.master.masterId && !state.heroes[relationship.toEntityId])
		) {
			context.addIssue({ code: 'custom', message: 'Relationship endpoints must exist' });
		}
		for (const evidence of relationship.evidence) {
			const observation = state.society.observations[evidence.observationId];
			if (
				!observation ||
				observation.observerHeroId !== relationship.fromHeroId ||
				observation.sourceEventId !== evidence.sourceEventId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Relationship evidence requires an observation'
				});
			}
		}
	}
	const authorityPairs = new Set<string>();
	for (const authority of Object.values(state.society.authority)) {
		const pair = `${authority.observerHeroId}:${authority.subjectId}`;
		if (authorityPairs.has(pair)) {
			context.addIssue({
				code: 'custom',
				message: 'Authority observer and subject must be unique'
			});
		}
		authorityPairs.add(pair);
		if (!state.heroes[authority.observerHeroId] || authority.subjectId !== state.master.masterId) {
			context.addIssue({
				code: 'custom',
				message: 'Authority must be a hero view of the Master'
			});
		}
		for (const evidence of authority.evidence) {
			const observation = state.society.observations[evidence.observationId];
			if (
				!observation ||
				observation.observerHeroId !== authority.observerHeroId ||
				observation.sourceEventId !== evidence.sourceEventId
			) {
				context.addIssue({
					code: 'custom',
					message: 'Authority evidence requires an observation'
				});
			}
		}
	}
	for (const promise of Object.values(state.society.promises)) {
		if (
			promise.promisorId !== state.master.masterId ||
			promise.promiseeHeroIds.some((heroId) => !state.heroes[heroId]) ||
			promise.witnessObservationIds.some((observationId) => {
				const observation = state.society.observations[observationId];
				return (
					!observation ||
					observation.sourceEventId !== promise.sourceEventId ||
					!promise.promiseeHeroIds.includes(observation.observerHeroId)
				);
			})
		) {
			context.addIssue({
				code: 'custom',
				message: 'Promise participants and witnesses must exist'
			});
		}
	}
	const communicationSourceEvents = new Set<string>();
	for (const act of Object.values(state.society.communicativeActs)) {
		if (communicationSourceEvents.has(act.sourceEventId)) {
			context.addIssue({
				code: 'custom',
				message: 'One event cannot own multiple communicative acts'
			});
		}
		communicationSourceEvents.add(act.sourceEventId);
		if (
			(act.speakerId !== state.master.masterId && !state.heroes[act.speakerId]) ||
			act.intendedAudienceIds.some((heroId) => !state.heroes[heroId])
		) {
			context.addIssue({ code: 'custom', message: 'Communication participants must exist' });
		}
		for (const witness of act.witnesses) {
			const observation = state.society.observations[witness.observationId];
			const belief = witness.beliefId ? (state.society.beliefs[witness.beliefId] ?? null) : null;
			if (
				!state.heroes[witness.heroId] ||
				!observation ||
				observation.kind !== 'communication' ||
				observation.communicationActId !== act.actId ||
				observation.observerHeroId !== witness.heroId ||
				observation.sourceEventId !== act.sourceEventId ||
				(act.claim === null) !== (belief === null) ||
				(belief !== null &&
					(belief.holderHeroId !== witness.heroId ||
						belief.subjectId !== act.claim?.subjectId ||
						belief.predicate !== act.claim?.predicate ||
						JSON.stringify(belief.object) !== JSON.stringify(act.claim.object) ||
						belief.provenance.kind !== 'told' ||
						belief.provenance.sourceEventId !== act.sourceEventId ||
						belief.provenance.observationId !== witness.observationId ||
						belief.provenance.learnedFromId !== act.speakerId ||
						belief.provenance.chainDepth !== 1))
			) {
				context.addIssue({
					code: 'custom',
					message: 'Communication witness chain is inconsistent'
				});
			}
		}
	}
	for (const observation of Object.values(state.society.observations)) {
		if (observation.kind !== 'communication') continue;
		const act = state.society.communicativeActs[observation.communicationActId];
		if (!act?.witnesses.some((witness) => witness.observationId === observation.observationId)) {
			context.addIssue({
				code: 'custom',
				message: 'Communication observation must resolve to its act'
			});
		}
	}
	for (const belief of Object.values(state.society.beliefs)) {
		if (belief.provenance.kind !== 'told') continue;
		const observation = state.society.observations[belief.provenance.observationId];
		const act =
			observation?.kind === 'communication'
				? state.society.communicativeActs[observation.communicationActId]
				: null;
		if (!act?.witnesses.some((witness) => witness.beliefId === belief.beliefId)) {
			context.addIssue({
				code: 'custom',
				message: 'Told belief must resolve to one communication witness'
			});
		}
	}
}

export const EngineGameStateV8Schema = EngineGameStateV8BaseSchema.superRefine(
	validateCommunicationEngineState
);

export const EngineGameStateV9Schema = EngineGameStateV9BaseSchema.superRefine((state, context) => {
	validateCommunicationEngineState(state, context);
	for (const turn of Object.values(state.society.conversationTurns)) {
		const act = state.society.communicativeActs[turn.communicationActId];
		if (
			turn.masterId !== state.master.masterId ||
			!state.heroes[turn.heroId] ||
			!act?.witnesses.some(
				(witness) => witness.heroId === turn.heroId && witness.role === 'intended'
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Conversation turn participants and addressed witness must exist'
			});
		}
	}
});

export const EngineGameStateV10Schema = EngineGameStateV10BaseSchema.superRefine(
	(state, context) => {
		validateCommunicationEngineState(state, context);
		for (const turn of Object.values(state.society.conversationTurns)) {
			const act = state.society.communicativeActs[turn.communicationActId];
			if (
				turn.masterId !== state.master.masterId ||
				!state.heroes[turn.heroId] ||
				!act?.witnesses.some(
					(witness) => witness.heroId === turn.heroId && witness.role === 'intended'
				)
			) {
				context.addIssue({
					code: 'custom',
					message: 'Conversation turn participants and addressed witness must exist'
				});
			}
		}
		for (const directive of Object.values(state.society.directives)) {
			const witnessObservers = directive.witnessObservationIds.map(
				(observationId) => state.society.observations[observationId]?.observerHeroId
			);
			if (
				directive.runId !== state.runId ||
				directive.authorId !== state.master.masterId ||
				directive.witnessEventId === null ||
				directive.recipientIds.some(
					(heroId) => !state.heroes[heroId] || !witnessObservers.includes(heroId)
				) ||
				directive.witnessObservationIds.some((observationId) => {
					const observation = state.society.observations[observationId];
					return !observation || observation.sourceEventId !== directive.witnessEventId;
				}) ||
				(directive.status === 'active' &&
					directive.expiresAt !== null &&
					Date.parse(directive.expiresAt) <= Date.parse(state.simulatedAt))
			) {
				context.addIssue({ code: 'custom', message: 'Directive lifecycle is inconsistent' });
			}
		}
		for (const influence of Object.values(state.society.directiveInfluences)) {
			if (!state.heroes[influence.heroId]) {
				context.addIssue({ code: 'custom', message: 'Directive influence hero must exist' });
			}
		}
	}
);

type MissionEngineValidationState =
	| z.infer<typeof EngineGameStateV11BaseSchema>
	| z.infer<typeof EngineGameStateV12BaseSchema>
	| z.infer<typeof EngineGameStateV13BaseSchema>
	| z.infer<typeof EngineGameStateV14BaseSchema>
	| z.infer<typeof EngineGameStateV15BaseSchema>;

function validateMissionEngineState(
	state: MissionEngineValidationState,
	context: z.RefinementCtx
): void {
	validateCommunicationEngineState(state, context);
	for (const turn of Object.values(state.society.conversationTurns)) {
		const act = state.society.communicativeActs[turn.communicationActId];
		if (
			turn.masterId !== state.master.masterId ||
			!state.heroes[turn.heroId] ||
			!act?.witnesses.some(
				(witness) => witness.heroId === turn.heroId && witness.role === 'intended'
			)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Conversation turn participants and addressed witness must exist'
			});
		}
	}
	for (const directive of Object.values(state.society.directives)) {
		const witnessObservers = directive.witnessObservationIds.map(
			(observationId) => state.society.observations[observationId]?.observerHeroId
		);
		if (
			directive.runId !== state.runId ||
			directive.authorId !== state.master.masterId ||
			directive.witnessEventId === null ||
			directive.recipientIds.some(
				(heroId) => !state.heroes[heroId] || !witnessObservers.includes(heroId)
			) ||
			directive.witnessObservationIds.some((observationId) => {
				const observation = state.society.observations[observationId];
				return !observation || observation.sourceEventId !== directive.witnessEventId;
			}) ||
			(directive.status === 'active' &&
				directive.expiresAt !== null &&
				Date.parse(directive.expiresAt) <= Date.parse(state.simulatedAt))
		) {
			context.addIssue({ code: 'custom', message: 'Directive lifecycle is inconsistent' });
		}
	}
	for (const influence of Object.values(state.society.directiveInfluences)) {
		if (!state.heroes[influence.heroId]) {
			context.addIssue({ code: 'custom', message: 'Directive influence hero must exist' });
		}
	}
	const attempt = state.mission.attempt;
	if (!attempt) return;
	if (
		attempt.party.masterId !== state.master.masterId ||
		attempt.party.heroIds.some((heroId) => !state.heroes[heroId])
	) {
		context.addIssue({ code: 'custom', message: 'Mission party members must exist in the run' });
	}
	if (
		['preparing', 'deployed', 'resolving', 'extraction'].includes(attempt.status) &&
		attempt.party.heroIds.some((heroId) => state.heroes[heroId]?.lifeState !== 'active')
	) {
		context.addIssue({
			code: 'custom',
			message: 'An active mission party requires living heroes'
		});
	}
	if (state.schemaVersion === 12 || state.schemaVersion === 13 || state.schemaVersion === 14) {
		const turnAttempt = state.mission.attempt;
		if (
			turnAttempt?.turnState.objective.carrierId !== null &&
			turnAttempt?.turnState.objective.carrierId !== undefined &&
			!turnAttempt.party.memberIds.includes(turnAttempt.turnState.objective.carrierId)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Mission objective carrier must be in the party'
			});
		}
	}
	if (state.schemaVersion === 14 || state.schemaVersion === 15) {
		for (const evidence of Object.values(state.mission.evidence)) {
			if (
				evidence.holderActorId !== state.master.masterId &&
				!state.heroes[evidence.holderActorId]
			) {
				context.addIssue({ code: 'custom', message: 'Mission evidence holder must exist' });
			}
		}
	}
}

export const EngineGameStateV11Schema = EngineGameStateV11BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV12Schema = EngineGameStateV12BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV13Schema = EngineGameStateV13BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV14Schema = EngineGameStateV14BaseSchema.superRefine(
	validateMissionEngineState
);
export const EngineGameStateV15Schema = EngineGameStateV15BaseSchema.superRefine(
	validateMissionEngineState
);

export const EngineGameStateSchema = z.discriminatedUnion('schemaVersion', [
	EngineGameStateV1Schema,
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
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
	EngineGameStateV15Schema
]);

const EngineCommandBaseSchema = z
	.object({
		commandId: EntityIdSchema,
		runId: EntityIdSchema,
		actorId: EntityIdSchema,
		expectedVersion: z.number().int().nonnegative(),
		correlationId: EntityIdSchema,
		source: ActionSourceSchema
	})
	.strict();

export const ChooseDestinationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.choose.destination'),
	destination: z.enum(['kitchen', 'training-ground']),
	firstLine: z.string().min(1).max(500),
	storyBranch: z.string().min(1).max(100)
}).strict();

export const ArriveDestinationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.arrive')
}).strict();

export const StartTravelCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.travel'),
	targetNodeId: SettlementNodeIdSchema
}).strict();

export const AssignHeroBuildingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.assign.hero'),
	heroId: EntityIdSchema,
	buildingId: SettlementSlugSchema,
	role: BuildingAssignmentRoleSchema
}).strict();

export const UnassignHeroBuildingCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.unassign.hero'),
	heroId: EntityIdSchema
}).strict();

export const AllocateBuildingPowerCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.allocate.power'),
	buildingId: SettlementSlugSchema
}).strict();

export const RecoverFirstEmberCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('story.recover.first.ember')
}).strict();

export const CommitFirstEmberCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('settlement.commit.first.ember'),
	buildingId: FirstEmberFacilitySchema,
	rationale: FirstEmberRationaleSchema
}).strict();

export const MasterCommunicateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.communicate'),
	targetHeroId: EntityIdSchema,
	kind: OnboardingCommunicativeActKindSchema,
	topic: CommunicationTopicSchema,
	exactText: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Communication text must contain a visible character'
		}),
	tone: CommunicationToneSchema.nullable(),
	delivery: CommunicationDeliverySchema
}).strict();

export const CommunicationRequestSchema = z
	.object({
		targetHeroId: EntityIdSchema,
		kind: OnboardingCommunicativeActKindSchema,
		topic: CommunicationTopicSchema,
		exactText: z
			.string()
			.min(1)
			.max(600)
			.refine((text) => /\S/u.test(text), {
				message: 'Communication text must contain a visible character'
			}),
		tone: CommunicationToneSchema.nullable(),
		delivery: CommunicationDeliverySchema
	})
	.strict();

const ConversationRequestShape = {
	targetHeroId: EntityIdSchema,
	kind: ConversationActKindSchema,
	exactText: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Conversation text must contain a visible character'
		}),
	tone: CommunicationToneSchema,
	delivery: CommunicationDeliverySchema,
	orderIntent: ConversationOrderIntentSchema.nullable()
} as const;

function validateConversationRequest(
	request: { kind: 'say' | 'ask' | 'order'; orderIntent: string | null },
	context: z.RefinementCtx
): void {
	if ((request.kind === 'order') !== (request.orderIntent !== null)) {
		context.addIssue({ code: 'custom', message: 'Only an order has an order intent' });
	}
}

export const MasterConverseCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.converse'),
	...ConversationRequestShape
})
	.strict()
	.superRefine(validateConversationRequest);

export const ConversationRequestSchema = z
	.object(ConversationRequestShape)
	.strict()
	.superRefine(validateConversationRequest);

const DirectiveIssueShape = {
	text: z
		.string()
		.min(1)
		.max(600)
		.refine((text) => /\S/u.test(text), {
			message: 'Directive text must contain a visible character'
		}),
	scope: DirectiveScopeSchema,
	recipientIds: z.array(EntityIdSchema).min(1).max(8),
	priorities: z.array(z.string().min(1).max(80)).max(12),
	tone: CommunicationToneSchema,
	delivery: CommunicationDeliverySchema
} as const;

export const MasterIssueDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.issue.directive'),
	...DirectiveIssueShape
}).strict();

export const MasterReplaceDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.replace.directive'),
	directiveId: EntityIdSchema,
	...DirectiveIssueShape
}).strict();

export const MasterRevokeDirectiveCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.revoke.directive'),
	directiveId: EntityIdSchema
}).strict();

export const DirectiveRequestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('issue'), ...DirectiveIssueShape }).strict(),
	z
		.object({
			action: z.literal('replace'),
			directiveId: EntityIdSchema,
			...DirectiveIssueShape
		})
		.strict(),
	z.object({ action: z.literal('revoke'), directiveId: EntityIdSchema }).strict()
]);

export const FirstEmberRequestSchema = z.discriminatedUnion('action', [
	z.object({ action: z.literal('recover') }).strict(),
	z
		.object({
			action: z.literal('commit'),
			buildingId: FirstEmberFacilitySchema,
			rationale: FirstEmberRationaleSchema
		})
		.strict()
]);

export const CreateDailyPlanCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.plan.day')
}).strict();

export const StartRoutineCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.routine')
}).strict();

export const InspectGateCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('master.inspect.gate')
}).strict();

export const StartActivityCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.start.activity'),
	activity: ActivityKindSchema
}).strict();

export const EquipItemCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('hero.equip.item'),
	itemId: EntityIdSchema
}).strict();

export const AdvanceSimulationCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.advance'),
	targetGameTime: IsoDateTimeSchema
}).strict();

export const SyncSimulationClockCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.sync.clock'),
	targetGameTime: IsoDateTimeSchema
}).strict();

export const ApplyDamageCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('simulation.apply.damage'),
	targetId: EntityIdSchema,
	amount: z.number().int().min(1).max(100),
	damageKind: z.enum(['hazard', 'training', 'combat'])
}).strict();

export const PrepareMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.prepare'),
	heroIds: z.array(EntityIdSchema).max(7),
	missionId: MissionSlugSchema.optional()
}).strict();

export const ReviseMissionPartyCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.revise.party'),
	heroIds: z.array(EntityIdSchema).max(7)
}).strict();

export const CancelMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.cancel')
}).strict();

export const DeployMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.deploy')
}).strict();

export const ResolveMissionTurnCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.resolve.turn'),
	choices: z.array(MissionTurnChoiceSchema).min(1).max(8)
}).strict();

export const OpenMissionExtractionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.open.extraction'),
	completedObjectiveIds: z.array(MissionSlugSchema).min(1).max(20)
}).strict();

export const ExtractMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.extract')
}).strict();

export const RetreatMissionCommandSchema = EngineCommandBaseSchema.extend({
	commandType: z.literal('mission.retreat')
}).strict();

export const EngineCommandSchema = z.discriminatedUnion('commandType', [
	ChooseDestinationCommandSchema,
	ArriveDestinationCommandSchema,
	StartTravelCommandSchema,
	AssignHeroBuildingCommandSchema,
	UnassignHeroBuildingCommandSchema,
	AllocateBuildingPowerCommandSchema,
	RecoverFirstEmberCommandSchema,
	CommitFirstEmberCommandSchema,
	MasterCommunicateCommandSchema,
	MasterConverseCommandSchema,
	MasterIssueDirectiveCommandSchema,
	MasterReplaceDirectiveCommandSchema,
	MasterRevokeDirectiveCommandSchema,
	CreateDailyPlanCommandSchema,
	StartRoutineCommandSchema,
	InspectGateCommandSchema,
	StartActivityCommandSchema,
	EquipItemCommandSchema,
	AdvanceSimulationCommandSchema,
	SyncSimulationClockCommandSchema,
	ApplyDamageCommandSchema,
	PrepareMissionCommandSchema,
	ReviseMissionPartyCommandSchema,
	CancelMissionCommandSchema,
	DeployMissionCommandSchema,
	ResolveMissionTurnCommandSchema,
	OpenMissionExtractionCommandSchema,
	ExtractMissionCommandSchema,
	RetreatMissionCommandSchema
]);

export const MissionLifecycleRequestSchema = z.discriminatedUnion('action', [
	z
		.object({
			action: z.literal('prepare'),
			heroIds: z.array(EntityIdSchema).max(4),
			missionId: MissionSlugSchema.optional()
		})
		.strict(),
	z.object({ action: z.literal('revise-party'), heroIds: z.array(EntityIdSchema).max(4) }).strict(),
	z.object({ action: z.literal('cancel') }).strict(),
	z.object({ action: z.literal('deploy') }).strict(),
	z
		.object({
			action: z.literal('resolve-turn'),
			masterActionId: z.string().regex(/^[a-z][a-z0-9._-]{1,79}$/u)
		})
		.strict(),
	z.object({ action: z.literal('extract') }).strict(),
	z.object({ action: z.literal('retreat') }).strict()
]);

export const EntropyDrawSchema = z
	.object({
		purpose: z.string().regex(/^[a-z][a-z0-9.-]{2,99}$/u),
		cursor: z.number().int().nonnegative(),
		minimum: z.number().int(),
		maximum: z.number().int(),
		value: z.number().int()
	})
	.strict()
	.refine((draw) => draw.minimum <= draw.value && draw.value <= draw.maximum, {
		message: 'Entropy draw fell outside its declared bounds'
	});

export const ScheduledEventSchema = z
	.object({
		scheduledEventId: EntityIdSchema,
		runId: EntityIdSchema,
		actorId: EntityIdSchema,
		dueGameTime: IsoDateTimeSchema,
		eventKind: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		payload: z.record(z.string(), z.unknown())
	})
	.strict();

export const EngineScheduleRecordSchema = ScheduledEventSchema.extend({
	status: z.enum(['pending', 'resolved', 'canceled']),
	createdEventId: EntityIdSchema,
	terminalEventId: EntityIdSchema.nullable()
}).strict();

export const ClockSpeedSchema = z.union([
	z.literal(0),
	z.literal(1),
	z.literal(2),
	z.literal(4),
	z.literal(8)
]);

export const SimulationClockSchema = z
	.object({
		runId: EntityIdSchema,
		speed: ClockSpeedSchema,
		anchorGameTime: IsoDateTimeSchema,
		anchorRealTime: IsoDateTimeSchema,
		currentGameTime: IsoDateTimeSchema,
		projectedGameTime: IsoDateTimeSchema,
		lastCatchUpAt: IsoDateTimeSchema.nullable(),
		nextDueGameTime: IsoDateTimeSchema.nullable(),
		nextDueRealTime: IsoDateTimeSchema.nullable(),
		backlogGameMinutes: z.number().nonnegative(),
		leaseStatus: z.enum(['idle', 'leased'])
	})
	.strict();

export const CatchUpEventSchema = z
	.object({
		sequence: z.number().int().positive(),
		gameTime: IsoDateTimeSchema,
		eventType: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
		summary: z.string().min(1).max(1_000)
	})
	.strict();

export const CatchUpRequestSchema = z
	.object({
		wallTime: IsoDateTimeSchema.optional()
	})
	.strict();

export const CatchUpReportSchema = z
	.object({
		runId: EntityIdSchema,
		result: z.enum(['caught_up', 'noop', 'lease_busy', 'terminal', 'safety_limit']),
		fromGameTime: IsoDateTimeSchema,
		toGameTime: IsoDateTimeSchema,
		targetGameTime: IsoDateTimeSchema,
		wallTime: IsoDateTimeSchema,
		speed: ClockSpeedSchema,
		commandsApplied: z.number().int().nonnegative(),
		schedulesResolved: z.number().int().nonnegative(),
		plansCreated: z.number().int().nonnegative(),
		routinesStarted: z.number().int().nonnegative(),
		truncated: z.boolean(),
		events: z.array(CatchUpEventSchema).max(512),
		clock: SimulationClockSchema
	})
	.strict();

export const EngineSnapshotSchema = z
	.object({
		state: EngineGameStateSchema,
		stateHash: StateHashSchema
	})
	.strict();

export const EngineCommitSchema = z
	.object({
		snapshot: EngineSnapshotSchema,
		events: z.array(AuthoritativeEventSchema).min(1),
		scheduled: z.array(ScheduledEventSchema),
		resolvedScheduledEventIds: z.array(EntityIdSchema),
		canceledScheduledEventIds: z.array(EntityIdSchema),
		legalActions: z.array(LegalActionSchema),
		idempotentReplay: z.boolean()
	})
	.strict();

export const ReplayEventCheckSchema = z
	.object({
		sequence: z.number().int().positive(),
		gameTime: IsoDateTimeSchema,
		eventType: z.string(),
		actorId: EntityIdSchema.nullable(),
		source: ActionSourceSchema,
		summary: z.string().min(1).max(1_000),
		beforeStateHash: StateHashSchema,
		afterStateHash: StateHashSchema,
		computedStateHash: StateHashSchema,
		verified: z.boolean(),
		entropyDraws: z.array(EntropyDrawSchema),
		deltas: z.array(RewardDeltaSchema)
	})
	.strict();

export const EngineReplayReportSchema = z
	.object({
		runId: EntityIdSchema,
		verified: z.boolean(),
		eventCount: z.number().int().positive(),
		checks: z.array(ReplayEventCheckSchema),
		journalEntries: z.array(JournalEntrySchema),
		scheduledEvents: z.array(EngineScheduleRecordSchema),
		clock: SimulationClockSchema,
		snapshot: EngineSnapshotSchema,
		persistedStateHash: StateHashSchema,
		hashMatchesPersistedSnapshot: z.boolean(),
		legalActions: z.array(LegalActionSchema),
		legalActionsByActor: z.record(EntityIdSchema, z.array(LegalActionSchema))
	})
	.strict();

export const EngineErrorResponseSchema = z.discriminatedUnion('code', [
	z
		.object({
			code: z.literal('STALE_RUN_VERSION'),
			message: z.string(),
			latestVersion: z.number().int().nonnegative(),
			eventCursor: z.number().int().positive(),
			stateHash: StateHashSchema
		})
		.strict(),
	z
		.object({
			code: z.literal('ILLEGAL_ACTION'),
			message: z.string(),
			legalActionIds: z.array(z.string())
		})
		.strict(),
	z
		.object({
			code: z.literal('IDEMPOTENCY_CONFLICT'),
			message: z.string()
		})
		.strict()
]);

export type ActivityKind = z.infer<typeof ActivityKindSchema>;
export type BuildingAssignmentRole = z.infer<typeof BuildingAssignmentRoleSchema>;
export type CatchUpReport = z.infer<typeof CatchUpReportSchema>;
export type ClockSpeed = z.infer<typeof ClockSpeedSchema>;
export type EngineCommand = z.infer<typeof EngineCommandSchema>;
export type EngineCommit = z.infer<typeof EngineCommitSchema>;
export type EngineGameState = z.infer<typeof EngineGameStateSchema>;
export type EngineGameStateV1 = z.infer<typeof EngineGameStateV1Schema>;
export type EngineGameStateV2 = z.infer<typeof EngineGameStateV2Schema>;
export type EngineGameStateV3 = z.infer<typeof EngineGameStateV3Schema>;
export type EngineGameStateV4 = z.infer<typeof EngineGameStateV4Schema>;
export type EngineGameStateV5 = z.infer<typeof EngineGameStateV5Schema>;
export type EngineGameStateV6 = z.infer<typeof EngineGameStateV6Schema>;
export type EngineGameStateV7 = z.infer<typeof EngineGameStateV7Schema>;
export type EngineGameStateV8 = z.infer<typeof EngineGameStateV8Schema>;
export type EngineGameStateV9 = z.infer<typeof EngineGameStateV9Schema>;
export type EngineGameStateV10 = z.infer<typeof EngineGameStateV10Schema>;
export type EngineGameStateV11 = z.infer<typeof EngineGameStateV11Schema>;
export type EngineGameStateV12 = z.infer<typeof EngineGameStateV12Schema>;
export type EngineGameStateV13 = z.infer<typeof EngineGameStateV13Schema>;
export type EngineGameStateV14 = z.infer<typeof EngineGameStateV14Schema>;
export type EngineGameStateV15 = z.infer<typeof EngineGameStateV15Schema>;
export type EngineItemState = z.infer<typeof EngineItemStateSchema>;
export type EngineReplayReport = z.infer<typeof EngineReplayReportSchema>;
export type EngineScheduleRecord = z.infer<typeof EngineScheduleRecordSchema>;
export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
export type EntropyDraw = z.infer<typeof EntropyDrawSchema>;
export type FirstEmberFacility = z.infer<typeof FirstEmberFacilitySchema>;
export type FirstEmberRationale = z.infer<typeof FirstEmberRationaleSchema>;
export type FirstEmberRequest = z.infer<typeof FirstEmberRequestSchema>;
export type FirstEmberState = z.infer<typeof FirstEmberStateSchema>;
export type MissionAttempt = z.infer<typeof MissionAttemptSchema>;
export type MissionAttemptStatus = z.infer<typeof MissionAttemptStatusSchema>;
export type MissionRound = z.infer<typeof MissionRoundSchema>;
export type MissionRoundV2 = z.infer<typeof MissionRoundV2Schema>;
export type MissionMonsterIntent = z.infer<typeof MissionMonsterIntentSchema>;
export type MissionMonsterState = z.infer<typeof MissionMonsterStateSchema>;
export type MissionResolvedEffect = z.infer<typeof MissionResolvedEffectSchema>;
export type MissionTurnChoice = z.infer<typeof MissionTurnChoiceSchema>;
export type MissionLifecycleRequest = z.infer<typeof MissionLifecycleRequestSchema>;
export type MissionRunState = z.infer<typeof MissionRunStateSchema>;
export type MissionRunStateV2 = z.infer<typeof MissionRunStateV2Schema>;
export type MissionRunStateV3 = z.infer<typeof MissionRunStateV3Schema>;
export type MissionRunStateV4 = z.infer<typeof MissionRunStateV4Schema>;
export type MissionRunStateV5 = z.infer<typeof MissionRunStateV5Schema>;
export type MissionEvidenceRecord = z.infer<typeof MissionEvidenceRecordSchema>;
export type MissionRoundV3 = z.infer<typeof MissionRoundV3Schema>;
export type PortalMissionState = z.infer<typeof PortalMissionStateSchema>;
export type PortalOreLedgerEntry = z.infer<typeof PortalOreLedgerEntrySchema>;
export type CommunicationRequest = z.infer<typeof CommunicationRequestSchema>;
export type ConversationRequest = z.infer<typeof ConversationRequestSchema>;
export type DirectiveRequest = z.infer<typeof DirectiveRequestSchema>;
export type RoutineKind = z.infer<typeof RoutineKindSchema>;
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;
export type SimulationClock = z.infer<typeof SimulationClockSchema>;
