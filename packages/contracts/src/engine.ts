import { z } from 'zod';

import { CharacterMindSchema, LegalActionSchema } from './character.js';
import {
	ActionSourceSchema,
	AuthoritativeEventSchema,
	JournalEntrySchema,
	RewardDeltaSchema
} from './event.js';
import { RunStatusSchema } from './run.js';
import { SettlementRoutePlanSchema, SettlementSlugSchema } from './settlement.js';
import { SocietyStateSchema } from './social.js';
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

export const EngineGameStateSchema = z.discriminatedUnion('schemaVersion', [
	EngineGameStateV1Schema,
	EngineGameStateV2Schema,
	EngineGameStateV3Schema,
	EngineGameStateV4Schema,
	EngineGameStateV5Schema,
	EngineGameStateV6Schema,
	EngineGameStateV7Schema
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

export const EngineCommandSchema = z.discriminatedUnion('commandType', [
	ChooseDestinationCommandSchema,
	ArriveDestinationCommandSchema,
	StartTravelCommandSchema,
	AssignHeroBuildingCommandSchema,
	UnassignHeroBuildingCommandSchema,
	AllocateBuildingPowerCommandSchema,
	RecoverFirstEmberCommandSchema,
	CommitFirstEmberCommandSchema,
	CreateDailyPlanCommandSchema,
	StartRoutineCommandSchema,
	InspectGateCommandSchema,
	StartActivityCommandSchema,
	EquipItemCommandSchema,
	AdvanceSimulationCommandSchema,
	SyncSimulationClockCommandSchema,
	ApplyDamageCommandSchema
]);

export const EntropyDrawSchema = z
	.object({
		purpose: z.string().regex(/^[a-z][a-z0-9.]{2,99}$/u),
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
export type EngineItemState = z.infer<typeof EngineItemStateSchema>;
export type EngineReplayReport = z.infer<typeof EngineReplayReportSchema>;
export type EngineScheduleRecord = z.infer<typeof EngineScheduleRecordSchema>;
export type EngineSnapshot = z.infer<typeof EngineSnapshotSchema>;
export type EntropyDraw = z.infer<typeof EntropyDrawSchema>;
export type FirstEmberFacility = z.infer<typeof FirstEmberFacilitySchema>;
export type FirstEmberRationale = z.infer<typeof FirstEmberRationaleSchema>;
export type FirstEmberRequest = z.infer<typeof FirstEmberRequestSchema>;
export type FirstEmberState = z.infer<typeof FirstEmberStateSchema>;
export type RoutineKind = z.infer<typeof RoutineKindSchema>;
export type ScheduledEvent = z.infer<typeof ScheduledEventSchema>;
export type SimulationClock = z.infer<typeof SimulationClockSchema>;
