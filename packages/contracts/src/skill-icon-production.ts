import { z } from 'zod';

const NonEmptyTextSchema = z.string().trim().min(1);

export const SkillIconRaritySchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);
export const SkillIconLifecycleSchema = z.enum(['mapped', 'authored', 'candidate', 'approved']);
export const SkillIconTargetIdSchema = z
	.string()
	.regex(
		/^(?:martial|magical|craft):[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/u,
		'Expected a canonical skill target ID'
	);

export const SkillIconVisualSpecSchema = z
	.object({
		dominantSubject: NonEmptyTextSchema,
		supportingCue: NonEmptyTextSchema,
		semanticPalette: z.array(NonEmptyTextSchema).min(1),
		composition: NonEmptyTextSchema,
		exclusions: z.array(NonEmptyTextSchema).min(1)
	})
	.strict();

const SkillLabelSchema = z
	.object({
		namespace: z.enum(['Equipment', 'Element']),
		value: NonEmptyTextSchema
	})
	.strict();

const BaseRecordSchema = z
	.object({
		targetId: SkillIconTargetIdSchema,
		domain: z.enum(['Martial', 'Magical', 'Craft']),
		family: NonEmptyTextSchema,
		name: NonEmptyTextSchema,
		labels: z.array(SkillLabelSchema),
		rarity: SkillIconRaritySchema,
		type: z.enum(['A', 'P', 'St', 'C']),
		requires: NonEmptyTextSchema,
		effect: NonEmptyTextSchema,
		mapEntryId: NonEmptyTextSchema,
		motifFamily: NonEmptyTextSchema.nullable(),
		primaryVisualParent: SkillIconTargetIdSchema.nullable(),
		assets: z.null(),
		review: z.null()
	})
	.strict();

export const SkillIconRecordSchema = z.discriminatedUnion('status', [
	BaseRecordSchema.extend({ status: z.literal('mapped'), visualSpec: z.null() }).strict(),
	BaseRecordSchema.extend({
		status: z.literal('authored'),
		visualSpec: SkillIconVisualSpecSchema
	}).strict(),
	BaseRecordSchema.extend({
		status: z.literal('candidate'),
		visualSpec: SkillIconVisualSpecSchema
	}).strict(),
	BaseRecordSchema.extend({
		status: z.literal('approved'),
		visualSpec: SkillIconVisualSpecSchema
	}).strict()
]);

export const SkillIconCatalogSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-catalog-v1'),
		records: z.array(SkillIconRecordSchema)
	})
	.strict();

export type SkillIconRecord = z.infer<typeof SkillIconRecordSchema>;
export type SkillIconCatalog = z.infer<typeof SkillIconCatalogSchema>;
export type SkillIconRarity = z.infer<typeof SkillIconRaritySchema>;
