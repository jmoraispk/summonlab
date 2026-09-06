import { z } from 'zod';

import { ResistanceTagSchema } from './combat-rules.js';

export const EquipmentRankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);

export const EquipmentMaterialFamilySchema = z.enum([
	'metal',
	'wood',
	'hide-or-scale',
	'cloth-or-fibre'
]);

export const EquipmentMaterialIdSchema = z.enum([
	'bronze',
	'iron',
	'steel',
	'blacksteel',
	'skyiron',
	'starmetal',
	'sunsteel',
	'ash',
	'yew',
	'ironwood',
	'heartwood',
	'spiritwood',
	'living-branch',
	'worldtree-limb',
	'coarse-hide',
	'hard-leather',
	'beast-scale',
	'chitin',
	'drakescale',
	'wyrmscale',
	'ancient-dragon-scale',
	'hemp-weave',
	'wool',
	'layered-silk',
	'spellweave',
	'moonweave',
	'starcloth',
	'fateweave'
]);

export const EquipmentClassSchema = z.enum([
	'sword',
	'dagger',
	'spear',
	'bow',
	'axe',
	'mace',
	'shield',
	'staff',
	'heavy-armour',
	'light-armour',
	'robes'
]);

export const EquipmentArmourSlotSchema = z.enum(['head', 'torso', 'legs', 'boots']);
export const EquipmentDefinitionSlotSchema = z.enum([
	'main-hand',
	'off-hand',
	'head',
	'torso',
	'legs',
	'boots'
]);
export const EquipmentLoadoutSlotSchema = EquipmentDefinitionSlotSchema;
export const EquipmentHandednessSchema = z.enum(['one-handed', 'two-handed', 'none']);
export const EquipmentWeightClassSchema = z.enum(['light', 'medium', 'heavy']);

export const EquipmentFamilyTagSchema = z.enum([
	'unarmed',
	'one-handed-blade',
	'two-handed-blade',
	'bow',
	'staff-focus',
	'shield'
]);

export const EquipmentProficiencyTagSchema = z.enum(['armour-training']);

export const NamedResistanceGrantSchema = z
	.object({
		tag: ResistanceTagSchema,
		basisPoints: z.number().int().positive().max(10_000)
	})
	.strict();

export const AuthoredBreakMeterSchema = z
	.object({
		maximum: z.number().int().positive(),
		recoveryPerTick: z.number().int().nonnegative()
	})
	.strict();

export const EquipmentDefinitionIdSchema = z
	.string()
	.regex(/^equipment-[a-z0-9]+(?:-[a-z0-9]+)*$/u);

export const CombatEquipmentProfileSchema = z
	.object({
		schemaVersion: z.literal('combat-equipment-profile-v1'),
		definitionId: EquipmentDefinitionIdSchema,
		familyTags: z.array(EquipmentFamilyTagSchema).max(EquipmentFamilyTagSchema.options.length),
		load: z.number().int().positive().max(1_000),
		requirements: z
			.object({
				minimumMight: z.number().int().min(1).max(100).nullable(),
				proficiencyTags: z
					.array(EquipmentProficiencyTagSchema)
					.max(EquipmentProficiencyTagSchema.options.length)
			})
			.strict(),
		resistanceGrants: z.array(NamedResistanceGrantSchema).max(ResistanceTagSchema.options.length),
		breakMeter: AuthoredBreakMeterSchema.optional()
	})
	.strict()
	.superRefine((profile, context) => {
		if (new Set(profile.familyTags).size !== profile.familyTags.length) {
			context.addIssue({
				code: 'custom',
				path: ['familyTags'],
				message: 'Equipment family tags must be unique'
			});
		}
		if (
			new Set(profile.requirements.proficiencyTags).size !==
			profile.requirements.proficiencyTags.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['requirements', 'proficiencyTags'],
				message: 'Equipment proficiency tags must be unique'
			});
		}
		const resistanceTags = profile.resistanceGrants.map((grant) => grant.tag);
		if (new Set(resistanceTags).size !== resistanceTags.length) {
			context.addIssue({
				code: 'custom',
				path: ['resistanceGrants'],
				message: 'Equipment resistance tags must be unique'
			});
		}
	});

const EQUIPMENT_MATERIAL_METADATA: Readonly<
	Record<
		string,
		{
			family: z.infer<typeof EquipmentMaterialFamilySchema>;
			rank: z.infer<typeof EquipmentRankSchema>;
		}
	>
> = {
	bronze: { family: 'metal', rank: 'F' },
	iron: { family: 'metal', rank: 'E' },
	steel: { family: 'metal', rank: 'D' },
	blacksteel: { family: 'metal', rank: 'C' },
	skyiron: { family: 'metal', rank: 'B' },
	starmetal: { family: 'metal', rank: 'A' },
	sunsteel: { family: 'metal', rank: 'S' },
	ash: { family: 'wood', rank: 'F' },
	yew: { family: 'wood', rank: 'E' },
	ironwood: { family: 'wood', rank: 'D' },
	heartwood: { family: 'wood', rank: 'C' },
	spiritwood: { family: 'wood', rank: 'B' },
	'living-branch': { family: 'wood', rank: 'A' },
	'worldtree-limb': { family: 'wood', rank: 'S' },
	'coarse-hide': { family: 'hide-or-scale', rank: 'F' },
	'hard-leather': { family: 'hide-or-scale', rank: 'E' },
	'beast-scale': { family: 'hide-or-scale', rank: 'D' },
	chitin: { family: 'hide-or-scale', rank: 'C' },
	drakescale: { family: 'hide-or-scale', rank: 'B' },
	wyrmscale: { family: 'hide-or-scale', rank: 'A' },
	'ancient-dragon-scale': { family: 'hide-or-scale', rank: 'S' },
	'hemp-weave': { family: 'cloth-or-fibre', rank: 'F' },
	wool: { family: 'cloth-or-fibre', rank: 'E' },
	'layered-silk': { family: 'cloth-or-fibre', rank: 'D' },
	spellweave: { family: 'cloth-or-fibre', rank: 'C' },
	moonweave: { family: 'cloth-or-fibre', rank: 'B' },
	starcloth: { family: 'cloth-or-fibre', rank: 'A' },
	fateweave: { family: 'cloth-or-fibre', rank: 'S' }
};

export const EquipmentDefinitionSchema = z
	.object({
		schemaVersion: z.literal('equipment-definition-v1'),
		definitionId: EquipmentDefinitionIdSchema,
		displayName: z.string().trim().min(1).max(100),
		materialId: EquipmentMaterialIdSchema,
		materialFamily: EquipmentMaterialFamilySchema,
		materialRank: EquipmentRankSchema,
		equipmentClass: EquipmentClassSchema,
		slot: EquipmentDefinitionSlotSchema,
		handedness: EquipmentHandednessSchema,
		weightClass: EquipmentWeightClassSchema,
		approvedVisualAssetKey: z.string().regex(/^equipment-v1-[fedcbas]-[a-z0-9-]+$/u),
		runtimeCardAlias: z.string().regex(/^equipment\.equipment-v1-[fedcbas]-[a-z0-9-]+\.card$/u),
		runtimeDetailAlias: z.string().regex(/^equipment\.equipment-v1-[fedcbas]-[a-z0-9-]+\.detail$/u),
		forgeable: z.literal(true)
	})
	.strict()
	.superRefine((definition, context) => {
		const material = EQUIPMENT_MATERIAL_METADATA[definition.materialId];
		if (
			!material ||
			material.family !== definition.materialFamily ||
			material.rank !== definition.materialRank
		) {
			context.addIssue({ code: 'custom', message: 'Definition material metadata is inconsistent' });
		}

		const armourSlots = new Set(['head', 'torso', 'legs', 'boots']);
		const isArmour = ['heavy-armour', 'light-armour', 'robes'].includes(definition.equipmentClass);
		const legalFamily =
			definition.materialFamily === 'metal'
				? ['sword', 'dagger', 'spear', 'axe', 'mace', 'shield', 'heavy-armour'].includes(
						definition.equipmentClass
					)
				: definition.materialFamily === 'wood'
					? ['bow', 'staff'].includes(definition.equipmentClass)
					: definition.materialFamily === 'hide-or-scale'
						? definition.equipmentClass === 'light-armour'
						: definition.equipmentClass === 'robes';
		if (!legalFamily) {
			context.addIssue({
				code: 'custom',
				message: 'Material and equipment class are incompatible'
			});
		}

		const handlingIsLegal = isArmour
			? armourSlots.has(definition.slot) &&
				definition.handedness === 'none' &&
				definition.weightClass ===
					(definition.equipmentClass === 'heavy-armour'
						? 'heavy'
						: definition.equipmentClass === 'robes'
							? 'light'
							: 'medium')
			: definition.equipmentClass === 'shield'
				? definition.slot === 'off-hand' &&
					definition.handedness === 'one-handed' &&
					definition.weightClass === 'medium'
				: definition.slot === 'main-hand' &&
					definition.handedness ===
						(['spear', 'bow', 'staff'].includes(definition.equipmentClass)
							? 'two-handed'
							: 'one-handed') &&
					definition.weightClass ===
						(definition.equipmentClass === 'dagger'
							? 'light'
							: ['axe', 'mace'].includes(definition.equipmentClass)
								? 'heavy'
								: 'medium');
		if (!handlingIsLegal) {
			context.addIssue({ code: 'custom', message: 'Equipment handling metadata is inconsistent' });
		}

		const stem = definition.definitionId.slice('equipment-'.length);
		const expectedAssetKey = `equipment-v1-${definition.materialRank.toLowerCase()}-${stem}`;
		if (definition.approvedVisualAssetKey !== expectedAssetKey) {
			context.addIssue({
				code: 'custom',
				message: 'Definition and approved visual keys must match'
			});
		}
		if (definition.runtimeCardAlias !== `equipment.${expectedAssetKey}.card`) {
			context.addIssue({
				code: 'custom',
				message: 'Definition card alias must match its visual key'
			});
		}
		if (definition.runtimeDetailAlias !== `equipment.${expectedAssetKey}.detail`) {
			context.addIssue({
				code: 'custom',
				message: 'Definition detail alias must match its visual key'
			});
		}
	});

export const EquipmentDefinitionCatalogSchema = z
	.object({
		schemaVersion: z.literal('equipment-definition-catalog-v1'),
		contentVersion: z.literal('equipment-content-v1'),
		contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
		definitions: z.array(EquipmentDefinitionSchema).length(140)
	})
	.strict()
	.superRefine((catalog, context) => {
		for (const field of [
			'definitionId',
			'approvedVisualAssetKey',
			'runtimeCardAlias',
			'runtimeDetailAlias'
		] as const) {
			if (new Set(catalog.definitions.map((definition) => definition[field])).size !== 140) {
				context.addIssue({ code: 'custom', message: `Equipment ${field} values must be unique` });
			}
		}
	});

export const EquipmentCraftsmanshipSchema = z.discriminatedUnion('label', [
	z.object({ label: z.literal('standard'), bonus: z.literal(0) }).strict(),
	z.object({ label: z.literal('fine'), bonus: z.literal(1) }).strict(),
	z.object({ label: z.literal('masterwork'), bonus: z.literal(2) }).strict()
]);

export const EquipmentOriginSchema = z.discriminatedUnion('kind', [
	z
		.object({
			kind: z.literal('forged'),
			forgeEventId: z.string().uuid(),
			crafterId: z.string().uuid()
		})
		.strict(),
	z
		.object({
			kind: z.literal('dropped'),
			missionId: z.string().min(1),
			rewardId: z.string().min(1),
			sourceId: z.string().min(1)
		})
		.strict(),
	z
		.object({
			kind: z.literal('legacy'),
			legacyTemplateId: z.enum(['practice-blade', 'short-bow'])
		})
		.strict()
]);

export const EquipmentStandardRecipeDescriptorSchema = z
	.object({
		schemaVersion: z.literal('equipment-standard-recipe-v1'),
		recipeId: z.string().regex(/^forge-equipment-[a-z0-9-]+-standard$/u),
		definitionId: EquipmentDefinitionIdSchema,
		material: z.object({ materialId: EquipmentMaterialIdSchema, lots: z.literal(1) }).strict(),
		craftsmanship: z.object({ label: z.literal('standard'), bonus: z.literal(0) }).strict()
	})
	.strict()
	.superRefine((recipe, context) => {
		if (recipe.recipeId !== `forge-${recipe.definitionId}-standard`) {
			context.addIssue({ code: 'custom', message: 'Recipe ID must match its definition' });
		}
		if (!recipe.definitionId.startsWith(`equipment-${recipe.material.materialId}-`)) {
			context.addIssue({ code: 'custom', message: 'Recipe material must match its definition' });
		}
	});

export type EquipmentRank = z.infer<typeof EquipmentRankSchema>;
export type EquipmentMaterialFamily = z.infer<typeof EquipmentMaterialFamilySchema>;
export type EquipmentMaterialId = z.infer<typeof EquipmentMaterialIdSchema>;
export type EquipmentClass = z.infer<typeof EquipmentClassSchema>;
export type EquipmentArmourSlot = z.infer<typeof EquipmentArmourSlotSchema>;
export type EquipmentDefinitionSlot = z.infer<typeof EquipmentDefinitionSlotSchema>;
export type EquipmentLoadoutSlot = z.infer<typeof EquipmentLoadoutSlotSchema>;
export type EquipmentHandedness = z.infer<typeof EquipmentHandednessSchema>;
export type EquipmentWeightClass = z.infer<typeof EquipmentWeightClassSchema>;
export type AuthoredBreakMeter = z.infer<typeof AuthoredBreakMeterSchema>;
export type EquipmentFamilyTag = z.infer<typeof EquipmentFamilyTagSchema>;
export type EquipmentProficiencyTag = z.infer<typeof EquipmentProficiencyTagSchema>;
export type NamedResistanceGrant = z.infer<typeof NamedResistanceGrantSchema>;
export type CombatEquipmentProfile = z.infer<typeof CombatEquipmentProfileSchema>;
export type EquipmentDefinition = z.infer<typeof EquipmentDefinitionSchema>;
export type EquipmentDefinitionCatalog = z.infer<typeof EquipmentDefinitionCatalogSchema>;
export type EquipmentCraftsmanship = z.infer<typeof EquipmentCraftsmanshipSchema>;
export type EquipmentOrigin = z.infer<typeof EquipmentOriginSchema>;
export type EquipmentStandardRecipeDescriptor = z.infer<
	typeof EquipmentStandardRecipeDescriptorSchema
>;
