import { describe, expect, it } from 'vitest';

import {
	EquipmentCraftsmanshipSchema,
	EquipmentDefinitionCatalogSchema,
	EquipmentDefinitionSchema,
	EquipmentMaterialIdSchema,
	EquipmentStandardRecipeDescriptorSchema
} from './equipment.js';

const sword = {
	schemaVersion: 'equipment-definition-v1',
	definitionId: 'equipment-bronze-sword',
	displayName: 'Bronze Sword',
	materialId: 'bronze',
	materialFamily: 'metal',
	materialRank: 'F',
	equipmentClass: 'sword',
	slot: 'main-hand',
	handedness: 'one-handed',
	weightClass: 'medium',
	approvedVisualAssetKey: 'equipment-v1-f-bronze-sword',
	runtimeCardAlias: 'equipment.equipment-v1-f-bronze-sword.card',
	runtimeDetailAlias: 'equipment.equipment-v1-f-bronze-sword.detail',
	forgeable: true
} as const;

describe('equipment contracts', () => {
	it('freezes the 28 canonical material identifiers', () => {
		expect(EquipmentMaterialIdSchema.options).toHaveLength(28);
		expect(EquipmentMaterialIdSchema.options).toContain('worldtree-limb');
		expect(EquipmentMaterialIdSchema.options).toContain('ancient-dragon-scale');
		expect(EquipmentMaterialIdSchema.safeParse('pig-steel').success).toBe(false);
	});

	it('accepts a strict visual-bound definition and rejects drift', () => {
		expect(EquipmentDefinitionSchema.parse(sword)).toStrictEqual(sword);
		expect(EquipmentDefinitionSchema.safeParse({ ...sword, futureStat: 1 }).success).toBe(false);
		expect(
			EquipmentDefinitionSchema.safeParse({
				...sword,
				approvedVisualAssetKey: 'equipment-v1-e-iron-sword'
			}).success
		).toBe(false);
		expect(
			EquipmentDefinitionSchema.safeParse({ ...sword, handedness: 'two-handed' }).success
		).toBe(false);
		expect(EquipmentDefinitionSchema.safeParse({ ...sword, materialFamily: 'wood' }).success).toBe(
			false
		);
	});

	it('encodes craftsmanship labels and bonuses as inseparable pairs', () => {
		expect(EquipmentCraftsmanshipSchema.parse({ label: 'standard', bonus: 0 })).toEqual({
			label: 'standard',
			bonus: 0
		});
		expect(EquipmentCraftsmanshipSchema.parse({ label: 'fine', bonus: 1 })).toEqual({
			label: 'fine',
			bonus: 1
		});
		expect(EquipmentCraftsmanshipSchema.parse({ label: 'masterwork', bonus: 2 })).toEqual({
			label: 'masterwork',
			bonus: 2
		});
		expect(EquipmentCraftsmanshipSchema.safeParse({ label: 'fine', bonus: 2 }).success).toBe(false);
	});

	it('requires one matching material lot in a Standard recipe descriptor', () => {
		const recipe = {
			schemaVersion: 'equipment-standard-recipe-v1',
			recipeId: 'forge-equipment-bronze-sword-standard',
			definitionId: 'equipment-bronze-sword',
			material: { materialId: 'bronze', lots: 1 },
			craftsmanship: { label: 'standard', bonus: 0 }
		} as const;
		expect(EquipmentStandardRecipeDescriptorSchema.parse(recipe)).toStrictEqual(recipe);
		expect(
			EquipmentStandardRecipeDescriptorSchema.safeParse({
				...recipe,
				material: { materialId: 'bronze', lots: 2 }
			}).success
		).toBe(false);
		expect(
			EquipmentStandardRecipeDescriptorSchema.safeParse({
				...recipe,
				material: { materialId: 'iron', lots: 1 }
			}).success
		).toBe(false);
	});

	it('requires 140 unique definitions in a versioned, hash-bound catalog', () => {
		const definitions = Array.from({ length: 140 }, (_, index) => ({
			...sword,
			definitionId: `equipment-bronze-sword-${index}`,
			approvedVisualAssetKey: `equipment-v1-f-bronze-sword-${index}`,
			runtimeCardAlias: `equipment.equipment-v1-f-bronze-sword-${index}.card`,
			runtimeDetailAlias: `equipment.equipment-v1-f-bronze-sword-${index}.detail`
		}));
		const catalog = {
			schemaVersion: 'equipment-definition-catalog-v1',
			contentVersion: 'equipment-content-v1',
			contentHash: 'a'.repeat(64),
			definitions
		};
		expect(EquipmentDefinitionCatalogSchema.safeParse(catalog).success).toBe(true);
		expect(
			EquipmentDefinitionCatalogSchema.safeParse({
				...catalog,
				definitions: definitions.map((definition) => ({
					...definition,
					definitionId: 'equipment-x'
				}))
			}).success
		).toBe(false);
	});
});
