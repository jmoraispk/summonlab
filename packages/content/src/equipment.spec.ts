import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	EQUIPMENT_DEFINITIONS,
	EQUIPMENT_DEFINITIONS_BY_ID,
	EQUIPMENT_DEFINITION_CATALOG,
	EQUIPMENT_MATERIALS,
	deriveStandardEquipmentRecipe,
	getEquipmentDefinition,
	getEquipmentDefinitionsForMaterial,
	isEquipmentMaterialCompatible
} from './equipment.js';

describe('equipment content catalog', () => {
	it('expands the four material families into exactly 140 frozen definitions', () => {
		expect(EQUIPMENT_MATERIALS).toHaveLength(28);
		expect(EQUIPMENT_DEFINITIONS).toHaveLength(140);
		expect(Object.isFrozen(EQUIPMENT_DEFINITIONS)).toBe(true);
		expect(Object.isFrozen(EQUIPMENT_DEFINITIONS_BY_ID)).toBe(true);

		const counts = Object.fromEntries(
			['metal', 'wood', 'hide-or-scale', 'cloth-or-fiber'].map((family) => [
				family,
				EQUIPMENT_DEFINITIONS.filter((definition) => definition.materialFamily === family).length
			])
		);
		expect(counts).toStrictEqual({
			metal: 70,
			wood: 14,
			'hide-or-scale': 28,
			'cloth-or-fiber': 28
		});
	});

	it('contains 84 separate armor pieces and no set definitions', () => {
		const armor = EQUIPMENT_DEFINITIONS.filter((definition) =>
			['heavy-armor', 'light-armor', 'robes'].includes(definition.equipmentClass)
		);
		expect(armor).toHaveLength(84);
		expect(
			armor.every((definition) => ['head', 'torso', 'legs', 'boots'].includes(definition.slot))
		).toBe(true);
		expect(
			EQUIPMENT_DEFINITIONS.some(({ definitionId }) => definitionId.includes('full-set'))
		).toBe(false);
	});

	it('inherits rank from material and uses the approved handling rules', () => {
		for (const definition of EQUIPMENT_DEFINITIONS) {
			const material = EQUIPMENT_MATERIALS.find(
				(candidate) => candidate.materialId === definition.materialId
			);
			expect(definition.materialRank).toBe(material?.rank);
			expect(isEquipmentMaterialCompatible(definition.materialId, definition.equipmentClass)).toBe(
				true
			);
		}
		expect(getEquipmentDefinition('equipment-bronze-sword')).toMatchObject({
			slot: 'main-hand',
			handedness: 'one-handed'
		});
		expect(getEquipmentDefinition('equipment-bronze-spear')).toMatchObject({
			slot: 'main-hand',
			handedness: 'two-handed'
		});
		expect(getEquipmentDefinition('equipment-bronze-shield')).toMatchObject({
			slot: 'off-hand',
			handedness: 'one-handed'
		});
		expect(getEquipmentDefinition('equipment-fateweave-robes-head')).toMatchObject({
			slot: 'head',
			handedness: 'none'
		});
	});

	it('keeps every ID and visual binding stable and unique', () => {
		expect(new Set(EQUIPMENT_DEFINITIONS.map(({ definitionId }) => definitionId)).size).toBe(140);
		expect(
			new Set(EQUIPMENT_DEFINITIONS.map(({ approvedVisualAssetKey }) => approvedVisualAssetKey))
				.size
		).toBe(140);
		expect(getEquipmentDefinition('equipment-worldtree-limb-staff')).toMatchObject({
			materialRank: 'S',
			approvedVisualAssetKey: 'equipment-v1-s-worldtree-limb-staff',
			runtimeCardAlias: 'equipment.equipment-v1-s-worldtree-limb-staff.card',
			runtimeDetailAlias: 'equipment.equipment-v1-s-worldtree-limb-staff.detail'
		});
	});

	it('binds the frozen definitions to the declared catalog hash', () => {
		const observed = createHash('sha256')
			.update(JSON.stringify(EQUIPMENT_DEFINITION_CATALOG.definitions))
			.digest('hex');
		expect(EQUIPMENT_DEFINITION_CATALOG.contentVersion).toBe('equipment-content-v1');
		expect(EQUIPMENT_DEFINITION_CATALOG.contentHash).toBe(observed);
	});

	it('derives one-lot Standard recipes rather than storing 140 recipe documents', () => {
		const definition = getEquipmentDefinition('equipment-iron-heavy-armor-torso');
		expect(definition).toBeDefined();
		const recipe = deriveStandardEquipmentRecipe(definition!);
		expect(recipe).toStrictEqual({
			schemaVersion: 'equipment-standard-recipe-v1',
			recipeId: 'forge-equipment-iron-heavy-armor-torso-standard',
			definitionId: 'equipment-iron-heavy-armor-torso',
			material: { materialId: 'iron', lots: 1 },
			craftsmanship: { label: 'standard', bonus: 0 }
		});
		expect(getEquipmentDefinitionsForMaterial('iron')).toHaveLength(10);
		expect(getEquipmentDefinitionsForMaterial('ash')).toHaveLength(2);
	});
});
