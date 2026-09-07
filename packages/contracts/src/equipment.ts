import { z } from 'zod';

export const EquipmentRankSchema = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']);

export const EquipmentMaterialFamilySchema = z.enum([
	'metal',
	'wood',
	'hide-or-scale',
	'cloth-or-fiber'
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
	'heavy-armor',
	'light-armor',
	'robes'
]);

export const EquipmentArmorSlotSchema = z.enum(['head', 'torso', 'legs', 'boots']);
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

export const EquipmentDefinitionIdSchema = z
	.string()
	.regex(/^equipment-[a-z0-9]+(?:-[a-z0-9]+)*$/u);

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
	'hemp-weave': { family: 'cloth-or-fiber', rank: 'F' },
	wool: { family: 'cloth-or-fiber', rank: 'E' },
	'layered-silk': { family: 'cloth-or-fiber', rank: 'D' },
	spellweave: { family: 'cloth-or-fiber', rank: 'C' },
	moonweave: { family: 'cloth-or-fiber', rank: 'B' },
	starcloth: { family: 'cloth-or-fiber', rank: 'A' },
	fateweave: { family: 'cloth-or-fiber', rank: 'S' }
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

		const armorSlots = new Set(['head', 'torso', 'legs', 'boots']);
		const isArmor = ['heavy-armor', 'light-armor', 'robes'].includes(definition.equipmentClass);
		const legalFamily =
			definition.materialFamily === 'metal'
				? ['sword', 'dagger', 'spear', 'axe', 'mace', 'shield', 'heavy-armor'].includes(
						definition.equipmentClass
					)
				: definition.materialFamily === 'wood'
					? ['bow', 'staff'].includes(definition.equipmentClass)
					: definition.materialFamily === 'hide-or-scale'
						? definition.equipmentClass === 'light-armor'
						: definition.equipmentClass === 'robes';
		if (!legalFamily) {
			context.addIssue({
				code: 'custom',
				message: 'Material and equipment class are incompatible'
			});
		}

		const handlingIsLegal = isArmor
			? armorSlots.has(definition.slot) &&
				definition.handedness === 'none' &&
				definition.weightClass ===
					(definition.equipmentClass === 'heavy-armor'
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
export type EquipmentArmorSlot = z.infer<typeof EquipmentArmorSlotSchema>;
export type EquipmentDefinitionSlot = z.infer<typeof EquipmentDefinitionSlotSchema>;
export type EquipmentLoadoutSlot = z.infer<typeof EquipmentLoadoutSlotSchema>;
export type EquipmentHandedness = z.infer<typeof EquipmentHandednessSchema>;
export type EquipmentWeightClass = z.infer<typeof EquipmentWeightClassSchema>;
export type EquipmentDefinition = z.infer<typeof EquipmentDefinitionSchema>;
export type EquipmentDefinitionCatalog = z.infer<typeof EquipmentDefinitionCatalogSchema>;
export type EquipmentCraftsmanship = z.infer<typeof EquipmentCraftsmanshipSchema>;
export type EquipmentOrigin = z.infer<typeof EquipmentOriginSchema>;
export type EquipmentStandardRecipeDescriptor = z.infer<
	typeof EquipmentStandardRecipeDescriptorSchema
>;
