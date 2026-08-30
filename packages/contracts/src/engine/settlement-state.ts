import { z } from 'zod';

import { CharacterMindSchema } from '../character.js';
import { SettlementRoutePlanSchema, SettlementSlugSchema } from '../settlement.js';
import {
	ContentVersionSchema,
	EntityIdSchema,
	IsoDateTimeSchema,
	StateHashSchema
} from '../shared.js';
import {
	EngineHeroStateV2Schema,
	EngineZoneSchema,
	ResourceBalancesSchema,
	ResourceLedgerEntrySchema
} from './base-state.js';

export const SettlementNodeIdSchema = SettlementSlugSchema;

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

export type BuildingAssignmentRole = z.infer<typeof BuildingAssignmentRoleSchema>;
export type FirstEmberFacility = z.infer<typeof FirstEmberFacilitySchema>;
export type FirstEmberRationale = z.infer<typeof FirstEmberRationaleSchema>;
export type FirstEmberState = z.infer<typeof FirstEmberStateSchema>;
export type RoutineKind = z.infer<typeof RoutineKindSchema>;
