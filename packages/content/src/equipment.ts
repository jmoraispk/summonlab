import {
	EquipmentDefinitionCatalogSchema,
	EquipmentStandardRecipeDescriptorSchema,
	type EquipmentArmourSlot,
	type EquipmentClass,
	type EquipmentDefinition,
	type EquipmentHandedness,
	type EquipmentMaterialFamily,
	type EquipmentMaterialId,
	type EquipmentRank,
	type EquipmentStandardRecipeDescriptor,
	type EquipmentWeightClass
} from '@summonlab/contracts';

type MaterialDefinition = Readonly<{
	materialId: EquipmentMaterialId;
	displayName: string;
	family: EquipmentMaterialFamily;
	rank: EquipmentRank;
}>;

export const EQUIPMENT_MATERIALS = Object.freeze([
	{ materialId: 'bronze', displayName: 'Bronze', family: 'metal', rank: 'F' },
	{ materialId: 'iron', displayName: 'Iron', family: 'metal', rank: 'E' },
	{ materialId: 'steel', displayName: 'Steel', family: 'metal', rank: 'D' },
	{ materialId: 'blacksteel', displayName: 'Blacksteel', family: 'metal', rank: 'C' },
	{ materialId: 'skyiron', displayName: 'Skyiron', family: 'metal', rank: 'B' },
	{ materialId: 'starmetal', displayName: 'Starmetal', family: 'metal', rank: 'A' },
	{ materialId: 'sunsteel', displayName: 'Sunsteel', family: 'metal', rank: 'S' },
	{ materialId: 'ash', displayName: 'Ash', family: 'wood', rank: 'F' },
	{ materialId: 'yew', displayName: 'Yew', family: 'wood', rank: 'E' },
	{ materialId: 'ironwood', displayName: 'Ironwood', family: 'wood', rank: 'D' },
	{ materialId: 'heartwood', displayName: 'Heartwood', family: 'wood', rank: 'C' },
	{ materialId: 'spiritwood', displayName: 'Spiritwood', family: 'wood', rank: 'B' },
	{ materialId: 'living-branch', displayName: 'Living Branch', family: 'wood', rank: 'A' },
	{ materialId: 'worldtree-limb', displayName: 'Worldtree Limb', family: 'wood', rank: 'S' },
	{
		materialId: 'coarse-hide',
		displayName: 'Coarse Hide',
		family: 'hide-or-scale',
		rank: 'F'
	},
	{
		materialId: 'hard-leather',
		displayName: 'Hard Leather',
		family: 'hide-or-scale',
		rank: 'E'
	},
	{
		materialId: 'beast-scale',
		displayName: 'Beast Scale',
		family: 'hide-or-scale',
		rank: 'D'
	},
	{ materialId: 'chitin', displayName: 'Chitin', family: 'hide-or-scale', rank: 'C' },
	{
		materialId: 'drakescale',
		displayName: 'Drakescale',
		family: 'hide-or-scale',
		rank: 'B'
	},
	{
		materialId: 'wyrmscale',
		displayName: 'Wyrmscale',
		family: 'hide-or-scale',
		rank: 'A'
	},
	{
		materialId: 'ancient-dragon-scale',
		displayName: 'Ancient Dragon Scale',
		family: 'hide-or-scale',
		rank: 'S'
	},
	{
		materialId: 'hemp-weave',
		displayName: 'Hemp Weave',
		family: 'cloth-or-fibre',
		rank: 'F'
	},
	{ materialId: 'wool', displayName: 'Wool', family: 'cloth-or-fibre', rank: 'E' },
	{
		materialId: 'layered-silk',
		displayName: 'Layered Silk',
		family: 'cloth-or-fibre',
		rank: 'D'
	},
	{
		materialId: 'spellweave',
		displayName: 'Spellweave',
		family: 'cloth-or-fibre',
		rank: 'C'
	},
	{
		materialId: 'moonweave',
		displayName: 'Moonweave',
		family: 'cloth-or-fibre',
		rank: 'B'
	},
	{
		materialId: 'starcloth',
		displayName: 'Starcloth',
		family: 'cloth-or-fibre',
		rank: 'A'
	},
	{
		materialId: 'fateweave',
		displayName: 'Fateweave',
		family: 'cloth-or-fibre',
		rank: 'S'
	}
] satisfies readonly MaterialDefinition[]);

const METAL_CLASSES = Object.freeze([
	'sword',
	'dagger',
	'spear',
	'axe',
	'mace',
	'shield'
] satisfies readonly EquipmentClass[]);
const WOOD_CLASSES = Object.freeze(['bow', 'staff'] satisfies readonly EquipmentClass[]);
const ARMOUR_SLOTS = Object.freeze([
	'head',
	'torso',
	'legs',
	'boots'
] satisfies readonly EquipmentArmourSlot[]);

const MATERIALS_BY_ID = Object.freeze(
	Object.fromEntries(
		EQUIPMENT_MATERIALS.map((material) => [material.materialId, material])
	) as Record<EquipmentMaterialId, MaterialDefinition>
);

function classDisplayName(equipmentClass: EquipmentClass): string {
	if (equipmentClass === 'heavy-armour') return 'Heavy Armour';
	if (equipmentClass === 'light-armour') return 'Light Armour';
	if (equipmentClass === 'robes') return 'Robes';
	return equipmentClass.charAt(0).toUpperCase() + equipmentClass.slice(1);
}

function slotDisplayName(slot: EquipmentArmourSlot): string {
	return slot.charAt(0).toUpperCase() + slot.slice(1);
}

function handlingFor(equipmentClass: EquipmentClass): {
	slot: EquipmentDefinition['slot'];
	handedness: EquipmentHandedness;
	weightClass: EquipmentWeightClass;
} {
	if (equipmentClass === 'shield') {
		return { slot: 'off-hand', handedness: 'one-handed', weightClass: 'medium' };
	}
	if (equipmentClass === 'dagger') {
		return { slot: 'main-hand', handedness: 'one-handed', weightClass: 'light' };
	}
	if (equipmentClass === 'sword') {
		return { slot: 'main-hand', handedness: 'one-handed', weightClass: 'medium' };
	}
	if (equipmentClass === 'axe' || equipmentClass === 'mace') {
		return { slot: 'main-hand', handedness: 'one-handed', weightClass: 'heavy' };
	}
	return { slot: 'main-hand', handedness: 'two-handed', weightClass: 'medium' };
}

function createDefinition(
	material: MaterialDefinition,
	equipmentClass: EquipmentClass,
	armourSlot?: EquipmentArmourSlot
): Readonly<EquipmentDefinition> {
	const form = `${equipmentClass}${armourSlot ? `-${armourSlot}` : ''}`;
	const definitionId = `equipment-${material.materialId}-${form}`;
	const approvedVisualAssetKey = `equipment-v1-${material.rank.toLowerCase()}-${material.materialId}-${form}`;
	const handling = armourSlot
		? {
				slot: armourSlot,
				handedness: 'none' as const,
				weightClass:
					equipmentClass === 'heavy-armour'
						? ('heavy' as const)
						: equipmentClass === 'robes'
							? ('light' as const)
							: ('medium' as const)
			}
		: handlingFor(equipmentClass);

	return Object.freeze({
		schemaVersion: 'equipment-definition-v1' as const,
		definitionId,
		displayName: `${material.displayName} ${classDisplayName(equipmentClass)}${
			armourSlot ? ` ${slotDisplayName(armourSlot)}` : ''
		}`,
		materialId: material.materialId,
		materialFamily: material.family,
		materialRank: material.rank,
		equipmentClass,
		...handling,
		approvedVisualAssetKey,
		runtimeCardAlias: `equipment.${approvedVisualAssetKey}.card`,
		runtimeDetailAlias: `equipment.${approvedVisualAssetKey}.detail`,
		forgeable: true as const
	});
}

function expandMaterial(material: MaterialDefinition): readonly Readonly<EquipmentDefinition>[] {
	if (material.family === 'metal') {
		return [
			...METAL_CLASSES.map((equipmentClass) => createDefinition(material, equipmentClass)),
			...ARMOUR_SLOTS.map((slot) => createDefinition(material, 'heavy-armour', slot))
		];
	}
	if (material.family === 'wood') {
		return WOOD_CLASSES.map((equipmentClass) => createDefinition(material, equipmentClass));
	}
	const armourClass = material.family === 'hide-or-scale' ? 'light-armour' : 'robes';
	return ARMOUR_SLOTS.map((slot) => createDefinition(material, armourClass, slot));
}

export const EQUIPMENT_DEFINITIONS = Object.freeze(EQUIPMENT_MATERIALS.flatMap(expandMaterial));

export const EQUIPMENT_DEFINITIONS_BY_ID = Object.freeze(
	Object.fromEntries(
		EQUIPMENT_DEFINITIONS.map((definition) => [definition.definitionId, definition])
	) as Readonly<Record<string, Readonly<EquipmentDefinition>>>
);

export const EQUIPMENT_DEFINITION_CATALOG = Object.freeze(
	EquipmentDefinitionCatalogSchema.parse({
		schemaVersion: 'equipment-definition-catalog-v1',
		contentVersion: 'equipment-content-v1',
		contentHash: '42a8ffc1899ee458ca8360d33dffbeac3713864548734b7345ce489c3599035c',
		definitions: EQUIPMENT_DEFINITIONS
	})
);

export function getEquipmentDefinition(
	definitionId: string
): Readonly<EquipmentDefinition> | undefined {
	return EQUIPMENT_DEFINITIONS_BY_ID[definitionId];
}

export function isEquipmentMaterialCompatible(
	materialId: EquipmentMaterialId,
	equipmentClass: EquipmentClass
): boolean {
	const family = MATERIALS_BY_ID[materialId].family;
	if (family === 'metal')
		return (
			(METAL_CLASSES as readonly EquipmentClass[]).includes(equipmentClass) ||
			equipmentClass === 'heavy-armour'
		);
	if (family === 'wood')
		return (WOOD_CLASSES as readonly EquipmentClass[]).includes(equipmentClass);
	if (family === 'hide-or-scale') return equipmentClass === 'light-armour';
	return equipmentClass === 'robes';
}

export function getEquipmentDefinitionsForMaterial(
	materialId: EquipmentMaterialId
): readonly Readonly<EquipmentDefinition>[] {
	return EQUIPMENT_DEFINITIONS.filter((definition) => definition.materialId === materialId);
}

export function deriveStandardEquipmentRecipe(
	definition: EquipmentDefinition
): EquipmentStandardRecipeDescriptor {
	return EquipmentStandardRecipeDescriptorSchema.parse({
		schemaVersion: 'equipment-standard-recipe-v1',
		recipeId: `forge-${definition.definitionId}-standard`,
		definitionId: definition.definitionId,
		material: { materialId: definition.materialId, lots: 1 },
		craftsmanship: { label: 'standard', bonus: 0 }
	});
}
