import { z } from 'zod';

import { CombatAttributeNameSchema } from './capability.js';
import { SkillProgressSchema } from './engine/base-state.js';
import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

export const ProgressionMacroPathSchema = z.enum(['combat', 'crafting']);

export const ExperienceSourceKindSchema = z.enum([
	'combat',
	'crafting',
	'training',
	'synthesis',
	'authored'
]);

export const PermanentAttributeGrowthSchema = z
	.object({
		strength: z.number().int().nonnegative(),
		agility: z.number().int().nonnegative(),
		vitality: z.number().int().nonnegative(),
		magic: z.number().int().nonnegative()
	})
	.strict();

const EvidenceCountsSchema = z
	.object({
		combat: z.record(z.string().min(1).max(160), z.number().int().nonnegative()),
		crafting: z.record(z.string().min(1).max(160), z.number().int().nonnegative())
	})
	.strict();

export const HeroProgressionV2Schema = z
	.object({
		progressionVersion: z.literal('hero-progression-v2'),
		stars: z.number().int().min(1).max(7),
		level: z.number().int().min(1).max(999),
		experience: z.number().int().nonnegative(),
		unallocatedAttributePoints: z.number().int().nonnegative(),
		permanentGrowth: PermanentAttributeGrowthSchema,
		evidenceCounts: EvidenceCountsSchema,
		skills: z.object({ swordFighting: SkillProgressSchema }).strict()
	})
	.strict();

export const ProgressionRulesBindingSchema = z
	.object({
		rulesVersion: z.literal('progression-rules-v1'),
		contentHash: StateHashSchema
	})
	.strict();

const ExperienceClaimBaseSchema = z.object({
	claimId: EntityIdSchema,
	heroId: EntityIdSchema,
	sourceEventId: EntityIdSchema,
	evidenceKey: z.string().min(1).max(160),
	amount: z.number().int().positive()
});

export const ExperienceClaimSchema = z.discriminatedUnion('sourceKind', [
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('combat') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('crafting') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('training') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('synthesis') }).strict(),
	ExperienceClaimBaseSchema.extend({ sourceKind: z.literal('authored') }).strict()
]);

const AttributeGrowthClaimBaseSchema = z.object({
	claimId: EntityIdSchema,
	heroId: EntityIdSchema,
	sourceEventId: EntityIdSchema,
	attribute: CombatAttributeNameSchema,
	amount: z.number().int().positive()
});

export const AttributeGrowthClaimSchema = z.discriminatedUnion('sourceKind', [
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('allocation') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('training') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('achievement') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('consumable') }).strict(),
	AttributeGrowthClaimBaseSchema.extend({ sourceKind: z.literal('cultivation') }).strict()
]);

export const ExperienceReceiptSchema = z
	.object({
		receiptVersion: z.literal('experience-receipt-v1'),
		receiptId: EntityIdSchema,
		claim: ExperienceClaimSchema,
		rules: ProgressionRulesBindingSchema,
		experienceBefore: z.number().int().nonnegative(),
		experienceAfter: z.number().int().nonnegative(),
		levelBefore: z.number().int().min(1).max(999),
		levelAfter: z.number().int().min(1).max(999),
		levelsCrossed: z.array(z.number().int().min(2).max(999)),
		pointsGranted: z.number().int().nonnegative(),
		occurredAt: IsoDateTimeSchema
	})
	.strict();

export const AttributeGrowthReceiptV2Schema = z
	.object({
		receiptVersion: z.literal('attribute-growth-receipt-v2'),
		receiptId: EntityIdSchema,
		claim: AttributeGrowthClaimSchema,
		rules: ProgressionRulesBindingSchema,
		intrinsicBefore: z.number().int().nonnegative(),
		intrinsicAfter: z.number().int().positive(),
		pointsSpent: z.number().int().nonnegative(),
		unallocatedBefore: z.number().int().nonnegative(),
		unallocatedAfter: z.number().int().nonnegative(),
		occurredAt: IsoDateTimeSchema
	})
	.strict();

export type AttributeGrowthClaim = z.infer<typeof AttributeGrowthClaimSchema>;
export type AttributeGrowthReceiptV2 = z.infer<typeof AttributeGrowthReceiptV2Schema>;
export type ExperienceClaim = z.infer<typeof ExperienceClaimSchema>;
export type ExperienceReceipt = z.infer<typeof ExperienceReceiptSchema>;
export type ExperienceSourceKind = z.infer<typeof ExperienceSourceKindSchema>;
export type HeroProgressionV2 = z.infer<typeof HeroProgressionV2Schema>;
export type PermanentAttributeGrowth = z.infer<typeof PermanentAttributeGrowthSchema>;
export type ProgressionMacroPath = z.infer<typeof ProgressionMacroPathSchema>;
export type ProgressionRulesBinding = z.infer<typeof ProgressionRulesBindingSchema>;
