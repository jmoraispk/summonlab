import { z } from 'zod';

import {
	EquipmentCraftsmanshipSchema,
	EquipmentDefinitionIdSchema,
	EquipmentLoadoutSlotSchema,
	EquipmentOriginSchema,
	EquipmentRankSchema
} from '../equipment.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from '../shared.js';

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

export const EngineEquipmentLoadoutV24Schema = z
	.object({
		mainHand: EntityIdSchema.nullable(),
		offHand: EntityIdSchema.nullable(),
		head: EntityIdSchema.nullable(),
		torso: EntityIdSchema.nullable(),
		legs: EntityIdSchema.nullable(),
		boots: EntityIdSchema.nullable()
	})
	.strict()
	.superRefine((loadout, context) => {
		const occupied = EquipmentLoadoutSlotSchema.options
			.map(
				(slot) =>
					loadout[slot === 'main-hand' ? 'mainHand' : slot === 'off-hand' ? 'offHand' : slot]
			)
			.filter((itemId): itemId is string => itemId !== null);
		if (new Set(occupied).size !== occupied.length) {
			context.addIssue({ code: 'custom', message: 'An item cannot occupy multiple loadout slots' });
		}
	});

export const EngineEquipmentItemStateV24Schema = z
	.object({
		itemId: EntityIdSchema,
		definitionId: EquipmentDefinitionIdSchema,
		ownerId: EntityIdSchema,
		equippedById: EntityIdSchema.nullable(),
		craftsmanship: EquipmentCraftsmanshipSchema,
		finalRank: EquipmentRankSchema,
		durability: z.number().int().nonnegative(),
		maxDurability: z.number().int().positive(),
		origin: EquipmentOriginSchema
	})
	.strict()
	.refine((value) => value.durability <= value.maxDurability, {
		message: 'Item durability cannot exceed maxDurability'
	});

export type ActivityKind = z.infer<typeof ActivityKindSchema>;
export type EngineItemState = z.infer<typeof EngineItemStateSchema>;
export type EngineEquipmentLoadoutV24 = z.infer<typeof EngineEquipmentLoadoutV24Schema>;
export type EngineEquipmentItemStateV24 = z.infer<typeof EngineEquipmentItemStateV24Schema>;
