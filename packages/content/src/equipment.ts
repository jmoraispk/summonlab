import {
	CombatEquipmentProfileSchema,
	CombatEquipmentProfileCatalogSchema,
	EquipmentDefinitionCatalogSchema,
	EquipmentStandardRecipeDescriptorSchema,
	type EquipmentArmorSlot,
	type EquipmentClass,
	type CombatEquipmentProfile,
	type CombatEquipmentProfileCatalog,
	type EquipmentDefinition,
	type EquipmentFamilyTag,
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

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

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
		family: 'cloth-or-fiber',
		rank: 'F'
	},
	{ materialId: 'wool', displayName: 'Wool', family: 'cloth-or-fiber', rank: 'E' },
	{
		materialId: 'layered-silk',
		displayName: 'Layered Silk',
		family: 'cloth-or-fiber',
		rank: 'D'
	},
	{
		materialId: 'spellweave',
		displayName: 'Spellweave',
		family: 'cloth-or-fiber',
		rank: 'C'
	},
	{
		materialId: 'moonweave',
		displayName: 'Moonweave',
		family: 'cloth-or-fiber',
		rank: 'B'
	},
	{
		materialId: 'starcloth',
		displayName: 'Starcloth',
		family: 'cloth-or-fiber',
		rank: 'A'
	},
	{
		materialId: 'fateweave',
		displayName: 'Fateweave',
		family: 'cloth-or-fiber',
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
const ARMOR_SLOTS = Object.freeze([
	'head',
	'torso',
	'legs',
	'boots'
] satisfies readonly EquipmentArmorSlot[]);

const MATERIALS_BY_ID = Object.freeze(
	Object.fromEntries(
		EQUIPMENT_MATERIALS.map((material) => [material.materialId, material])
	) as Record<EquipmentMaterialId, MaterialDefinition>
);

function classDisplayName(equipmentClass: EquipmentClass): string {
	if (equipmentClass === 'heavy-armor') return 'Heavy Armor';
	if (equipmentClass === 'light-armor') return 'Light Armor';
	if (equipmentClass === 'robes') return 'Robes';
	return equipmentClass.charAt(0).toUpperCase() + equipmentClass.slice(1);
}

function slotDisplayName(slot: EquipmentArmorSlot): string {
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
	armorSlot?: EquipmentArmorSlot
): Readonly<EquipmentDefinition> {
	const form = `${equipmentClass}${armorSlot ? `-${armorSlot}` : ''}`;
	const definitionId = `equipment-${material.materialId}-${form}`;
	const approvedVisualAssetKey = `equipment-v1-${material.rank.toLowerCase()}-${material.materialId}-${form}`;
	const handling = armorSlot
		? {
				slot: armorSlot,
				handedness: 'none' as const,
				weightClass:
					equipmentClass === 'heavy-armor'
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
			armorSlot ? ` ${slotDisplayName(armorSlot)}` : ''
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
			...ARMOR_SLOTS.map((slot) => createDefinition(material, 'heavy-armor', slot))
		];
	}
	if (material.family === 'wood') {
		return WOOD_CLASSES.map((equipmentClass) => createDefinition(material, equipmentClass));
	}
	const armorClass = material.family === 'hide-or-scale' ? 'light-armor' : 'robes';
	return ARMOR_SLOTS.map((slot) => createDefinition(material, armorClass, slot));
}

export const EQUIPMENT_DEFINITIONS = Object.freeze(EQUIPMENT_MATERIALS.flatMap(expandMaterial));

export const EQUIPMENT_DEFINITIONS_BY_ID = Object.freeze(
	Object.fromEntries(
		EQUIPMENT_DEFINITIONS.map((definition) => [definition.definitionId, definition])
	) as Readonly<Record<string, Readonly<EquipmentDefinition>>>
);

const EQUIPMENT_LOAD_BY_CLASS = Object.freeze({
	sword: 12,
	dagger: 6,
	spear: 16,
	bow: 14,
	axe: 20,
	mace: 20,
	shield: 16,
	staff: 14,
	'heavy-armour': 0,
	'light-armour': 0,
	robes: 0
} satisfies Readonly<Record<EquipmentClass, number>>);

const ARMOUR_LOAD_BY_CLASS_AND_SLOT = Object.freeze({
	'heavy-armour': Object.freeze({ head: 12, torso: 28, legs: 22, boots: 10 }),
	'light-armour': Object.freeze({ head: 6, torso: 14, legs: 11, boots: 5 }),
	robes: Object.freeze({ head: 2, torso: 4, legs: 3, boots: 2 })
} as const);

function combatFamilyTags(definition: EquipmentDefinition): readonly EquipmentFamilyTag[] {
	if (definition.equipmentClass === 'sword' || definition.equipmentClass === 'dagger') {
		return ['one-handed-blade'];
	}
	if (definition.equipmentClass === 'bow') return ['bow'];
	if (definition.equipmentClass === 'staff') return ['staff-focus'];
	if (definition.equipmentClass === 'shield') return ['shield'];
	return [];
}

function equipmentLoad(definition: EquipmentDefinition): number {
	if (
		definition.equipmentClass === 'heavy-armour' ||
		definition.equipmentClass === 'light-armour' ||
		definition.equipmentClass === 'robes'
	) {
		return ARMOUR_LOAD_BY_CLASS_AND_SLOT[definition.equipmentClass][
			definition.slot as EquipmentArmourSlot
		];
	}
	return EQUIPMENT_LOAD_BY_CLASS[definition.equipmentClass];
}

function createCombatEquipmentProfile(
	definition: EquipmentDefinition
): Readonly<CombatEquipmentProfile> {
	const heavyArmour = definition.equipmentClass === 'heavy-armour';
	const resistanceGrants = heavyArmour
		? [
				{ tag: 'cut' as const, basisPoints: 800, capBasisPoints: 1_500 },
				{ tag: 'impact' as const, basisPoints: 600, capBasisPoints: 1_200 }
			]
		: definition.equipmentClass === 'light-armour'
			? [{ tag: 'pierce' as const, basisPoints: 400, capBasisPoints: 1_000 }]
			: definition.equipmentClass === 'robes'
				? [{ tag: 'arcane' as const, basisPoints: 300, capBasisPoints: 900 }]
				: [];
	return deepFreeze(
		CombatEquipmentProfileSchema.parse({
			schemaVersion: 'combat-equipment-profile-v1',
			definitionId: definition.definitionId,
			familyTags: combatFamilyTags(definition),
			load: equipmentLoad(definition),
			requirements: {
				minimumStrength: heavyArmour ? 45 : definition.weightClass === 'heavy' ? 35 : null,
				proficiencyTags: heavyArmour ? ['armour-training'] : []
			},
			resistanceGrants
		})
	);
}

export const COMBAT_EQUIPMENT_PROFILE_CATALOG = deepFreeze(
	CombatEquipmentProfileCatalogSchema.parse({
		schemaVersion: 'combat-equipment-profile-catalog-v1',
		contentVersion: 'combat-equipment-profiles-v1',
		contentHash: '38472191a697de908ae96296cf33939d72d985587d029c72c17df108799c97dd',
		profiles: EQUIPMENT_DEFINITIONS.map(createCombatEquipmentProfile)
	})
);

export const COMBAT_EQUIPMENT_PROFILES = COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles;

export const COMBAT_EQUIPMENT_PROFILES_BY_ID = Object.freeze(
	Object.fromEntries(
		COMBAT_EQUIPMENT_PROFILES.map((profile) => [profile.definitionId, profile])
	) as Readonly<Record<string, Readonly<CombatEquipmentProfile>>>
);

function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
	const object = value as Record<string, unknown>;
	return `{${Object.keys(object)
		.sort((left, right) => left.localeCompare(right))
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
		.join(',')}}`;
}

export async function calculateCombatEquipmentProfileContentHash(
	catalog: CombatEquipmentProfileCatalog
): Promise<string> {
	const payload: Partial<CombatEquipmentProfileCatalog> = { ...catalog };
	delete payload.contentHash;
	const digest = await globalThis.crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(canonicalJson(payload))
	);
	return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyCombatEquipmentProfileCatalog(
	catalogInput: CombatEquipmentProfileCatalog
): Promise<CombatEquipmentProfileCatalog> {
	const catalog = CombatEquipmentProfileCatalogSchema.parse(catalogInput);
	const calculated = await calculateCombatEquipmentProfileContentHash(catalog);
	if (calculated !== catalog.contentHash) {
		throw new Error(
			`Combat equipment profile content hash drifted: expected ${catalog.contentHash}, calculated ${calculated}`
		);
	}
	return catalog;
}

let verifiedCombatEquipmentCatalog: Promise<CombatEquipmentProfileCatalog> | undefined;

export function loadCombatEquipmentProfileCatalog(): Promise<CombatEquipmentProfileCatalog> {
	verifiedCombatEquipmentCatalog ??= verifyCombatEquipmentProfileCatalog(
		COMBAT_EQUIPMENT_PROFILE_CATALOG
	);
	return verifiedCombatEquipmentCatalog;
}

export const EQUIPMENT_DEFINITION_CATALOG = Object.freeze(
	EquipmentDefinitionCatalogSchema.parse({
		schemaVersion: 'equipment-definition-catalog-v1',
		contentVersion: 'equipment-content-v1',
		contentHash: '42e64ba49543b86482f9b75d885885ba9b0681d6e68d1fc9f8f37ddcb5c0eaf9',
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
			equipmentClass === 'heavy-armor'
		);
	if (family === 'wood')
		return (WOOD_CLASSES as readonly EquipmentClass[]).includes(equipmentClass);
	if (family === 'hide-or-scale') return equipmentClass === 'light-armor';
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
