import { z } from 'zod';

import { DamageTagSchema } from './combat-rules.js';
import {
	AuthoredBreakMeterSchema,
	EquipmentFamilyTagSchema,
	NamedResistanceGrantSchema
} from './equipment.js';
import { StateHashSchema } from './shared.js';

export const CombatSkillIdSchema = z.string().regex(/^combat-skill-[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const CombatSkillKindSchema = z.enum(['attack', 'stance', 'passive']);

export const CombatSkillMasteryStepSchema = z
	.object({
		minimumMastery: z.number().int().min(0).max(100),
		accuracyBasisPoints: z.number().int().min(0).max(10_000),
		reliabilityBasisPoints: z.number().int().min(0).max(10_000),
		refinementUnlockIds: z
			.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u))
			.min(1)
			.optional()
	})
	.strict();

export const CombatSkillDefinitionSchema = z
	.object({
		schemaVersion: z.literal('combat-skill-v1'),
		skillId: CombatSkillIdSchema,
		displayName: z.string().trim().min(1).max(100),
		kind: CombatSkillKindSchema,
		deliveryTags: z.array(EquipmentFamilyTagSchema).max(EquipmentFamilyTagSchema.options.length),
		damageTags: z.array(DamageTagSchema).max(DamageTagSchema.options.length),
		masteryProgression: z.array(CombatSkillMasteryStepSchema).min(1).max(101),
		resistanceGrants: z.array(NamedResistanceGrantSchema).max(7),
		breakMeter: AuthoredBreakMeterSchema.optional()
	})
	.strict()
	.superRefine((skill, context) => {
		if (skill.kind !== 'passive' && skill.deliveryTags.length === 0) {
			context.addIssue({
				code: 'custom',
				path: ['deliveryTags'],
				message: 'Active combat skills require at least one delivery tag'
			});
		}
		for (const [path, values] of [
			['deliveryTags', skill.deliveryTags],
			['damageTags', skill.damageTags],
			['resistanceGrants', skill.resistanceGrants.map((grant) => grant.tag)]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', path: [path], message: `${path} must be unique` });
			}
		}
		if (skill.masteryProgression[0]?.minimumMastery !== 0) {
			context.addIssue({
				code: 'custom',
				path: ['masteryProgression'],
				message: 'Mastery progression must begin at zero'
			});
		}
		for (let index = 1; index < skill.masteryProgression.length; index += 1) {
			const previous = skill.masteryProgression[index - 1]!;
			const current = skill.masteryProgression[index]!;
			if (
				current.minimumMastery <= previous.minimumMastery ||
				current.accuracyBasisPoints < previous.accuracyBasisPoints ||
				current.reliabilityBasisPoints < previous.reliabilityBasisPoints
			) {
				context.addIssue({
					code: 'custom',
					path: ['masteryProgression', index],
					message: 'Mastery thresholds and reliability must progress monotonically'
				});
			}
		}
	});

export const CombatSkillCatalogSchema = z
	.object({
		schemaVersion: z.literal('combat-skill-catalog-v1'),
		contentVersion: z.literal('combat-skills-v1'),
		contentHash: StateHashSchema,
		skills: z.array(CombatSkillDefinitionSchema).min(1)
	})
	.strict()
	.superRefine((catalog, context) => {
		const skillIds = catalog.skills.map((skill) => skill.skillId);
		if (new Set(skillIds).size !== skillIds.length) {
			context.addIssue({
				code: 'custom',
				path: ['skills'],
				message: 'Combat skill IDs must be unique'
			});
		}
	});

export const LearnedCombatSkillStateSchema = z
	.object({
		schemaVersion: z.literal('learned-combat-skill-v1'),
		skillId: CombatSkillIdSchema,
		mastery: z.number().int().min(0).max(100),
		trainedDeliveryTags: z
			.array(EquipmentFamilyTagSchema)
			.max(EquipmentFamilyTagSchema.options.length)
	})
	.strict()
	.superRefine((state, context) => {
		if (new Set(state.trainedDeliveryTags).size !== state.trainedDeliveryTags.length) {
			context.addIssue({
				code: 'custom',
				path: ['trainedDeliveryTags'],
				message: 'Trained delivery tags must be unique'
			});
		}
	});

export const NamedResistanceSourceSchema = z
	.object({
		schemaVersion: z.literal('named-resistance-source-v1'),
		sourceKind: z.enum(['equipment', 'passive-skill', 'physiology']),
		sourceId: z.string().trim().min(1).max(120),
		grants: z.array(NamedResistanceGrantSchema).min(1).max(7)
	})
	.strict()
	.superRefine((source, context) => {
		const tags = source.grants.map((grant) => grant.tag);
		if (new Set(tags).size !== tags.length) {
			context.addIssue({
				code: 'custom',
				path: ['grants'],
				message: 'A source may grant each named resistance once'
			});
		}
	});

export type CombatSkillDefinition = z.infer<typeof CombatSkillDefinitionSchema>;
export type CombatSkillCatalog = z.infer<typeof CombatSkillCatalogSchema>;
export type CombatSkillId = z.infer<typeof CombatSkillIdSchema>;
export type CombatSkillKind = z.infer<typeof CombatSkillKindSchema>;
export type CombatSkillMasteryStep = z.infer<typeof CombatSkillMasteryStepSchema>;
export type LearnedCombatSkillState = z.infer<typeof LearnedCombatSkillStateSchema>;
export type NamedResistanceSource = z.infer<typeof NamedResistanceSourceSchema>;
