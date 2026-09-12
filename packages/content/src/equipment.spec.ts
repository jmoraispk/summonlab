import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	COMBAT_EQUIPMENT_PROFILE_CATALOG,
	COMBAT_EQUIPMENT_PROFILES_BY_ID,
	EQUIPMENT_DEFINITIONS,
	EQUIPMENT_DEFINITIONS_BY_ID,
	EQUIPMENT_DEFINITION_CATALOG,
	EQUIPMENT_MATERIALS,
	calculateCombatEquipmentProfileContentHash,
	deriveStandardEquipmentRecipe,
	getEquipmentDefinition,
	getEquipmentDefinitionsForMaterial,
	isEquipmentMaterialCompatible,
	verifyCombatEquipmentProfileCatalog
} from './equipment.js';
import {
	BASIC_BOW_SHOT,
	BASIC_SWORD_STRIKE,
	COMBAT_SKILL_CATALOG,
	COMBAT_SKILLS_BY_ID,
	calculateCombatSkillContentHash,
	verifyCombatSkillCatalog
} from './combat-skills.js';
import {
	COMBAT_CONTENT_BINDING,
	calculateCombatContentAggregateHash,
	loadCombatContentBinding
} from './combat-content-binding.js';

describe('equipment content catalog', () => {
	it('keeps starter sword and bow IDs stable while adding combat-family tags', () => {
		expect(COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-bronze-sword']).toMatchObject({
			definitionId: 'equipment-bronze-sword',
			familyTags: ['one-handed-blade'],
			load: 12
		});
		expect(COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-ash-bow']).toMatchObject({
			definitionId: 'equipment-ash-bow',
			familyTags: ['bow'],
			load: 14
		});
		expect(COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-bronze-spear']?.familyTags).toStrictEqual([]);
		expect(BASIC_SWORD_STRIKE).toMatchObject({
			skillId: 'combat-skill-basic-sword-strike',
			deliveryTags: ['one-handed-blade']
		});
		expect(BASIC_BOW_SHOT).toMatchObject({
			skillId: 'combat-skill-basic-bow-shot',
			deliveryTags: ['bow']
		});
		expect(Object.keys(COMBAT_SKILLS_BY_ID).sort()).toStrictEqual([
			'combat-skill-basic-bow-shot',
			'combat-skill-basic-sword-strike'
		]);
	});

	it('authors load, heavy Strength requirements, armour training, and named resistance grants', () => {
		const heavyWeapon = COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-bronze-axe'];
		const heavyArmour = COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-iron-heavy-armour-torso'];
		expect(heavyWeapon).toMatchObject({
			load: 20,
			requirements: { minimumStrength: 35, proficiencyTags: [] }
		});
		expect(heavyArmour).toMatchObject({
			load: 28,
			requirements: { minimumStrength: 45, proficiencyTags: ['armour-training'] }
		});
		expect(heavyArmour?.resistanceGrants).toEqual(
			expect.arrayContaining([
				{ tag: 'cut', basisPoints: 800, capBasisPoints: 1_500 },
				{ tag: 'impact', basisPoints: 600, capBasisPoints: 1_200 }
			])
		);
		expect(JSON.stringify(COMBAT_EQUIPMENT_PROFILES_BY_ID)).not.toMatch(/vitality|poise/iu);
	});

	it('deeply freezes versioned skill and equipment mechanics', () => {
		const sword = COMBAT_EQUIPMENT_PROFILES_BY_ID['equipment-bronze-sword']!;
		expect(Object.isFrozen(sword)).toBe(true);
		expect(Object.isFrozen(sword.familyTags)).toBe(true);
		expect(Object.isFrozen(sword.requirements)).toBe(true);
		expect(Object.isFrozen(sword.requirements.proficiencyTags)).toBe(true);
		expect(Object.isFrozen(BASIC_SWORD_STRIKE.masteryProgression)).toBe(true);
		expect(Object.isFrozen(BASIC_SWORD_STRIKE.masteryProgression[0])).toBe(true);
	});

	it('rejects independent combat skill and equipment catalog hash drift', async () => {
		expect(await calculateCombatSkillContentHash(COMBAT_SKILL_CATALOG)).toBe(
			COMBAT_SKILL_CATALOG.contentHash
		);
		expect(await calculateCombatEquipmentProfileContentHash(COMBAT_EQUIPMENT_PROFILE_CATALOG)).toBe(
			COMBAT_EQUIPMENT_PROFILE_CATALOG.contentHash
		);
		expect(Object.isFrozen(COMBAT_SKILL_CATALOG.skills)).toBe(true);
		expect(Object.isFrozen(COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles)).toBe(true);

		const skillDrifts = [
			COMBAT_SKILL_CATALOG.skills.map((skill, index) =>
				index === 0
					? { ...skill, deliveryTags: COMBAT_SKILL_CATALOG.skills[1]!.deliveryTags }
					: skill
			),
			COMBAT_SKILL_CATALOG.skills.map((skill, index) =>
				index === 0
					? {
							...skill,
							masteryProgression: skill.masteryProgression.map((step, stepIndex) =>
								stepIndex === 0 ? { ...step, accuracyBasisPoints: 6_751 } : step
							)
						}
					: skill
			)
		];
		for (const skills of skillDrifts) {
			await expect(verifyCombatSkillCatalog({ ...COMBAT_SKILL_CATALOG, skills })).rejects.toThrow(
				/combat skill content hash drifted/iu
			);
		}

		const heavyArmourId = 'equipment-iron-heavy-armour-torso';
		const equipmentDrifts = [
			COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.map((profile, index) =>
				index === 0 ? { ...profile, load: profile.load + 1 } : profile
			),
			COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.map((profile) =>
				profile.definitionId === heavyArmourId
					? {
							...profile,
							requirements: {
								...profile.requirements,
								minimumStrength: profile.requirements.minimumStrength! + 1
							}
						}
					: profile
			),
			COMBAT_EQUIPMENT_PROFILE_CATALOG.profiles.map((profile) =>
				profile.definitionId === heavyArmourId
					? {
							...profile,
							resistanceGrants: profile.resistanceGrants.map((grant, index) =>
								index === 0 ? { ...grant, basisPoints: grant.basisPoints + 1 } : grant
							)
						}
					: profile
			)
		];
		for (const profiles of equipmentDrifts) {
			await expect(
				verifyCombatEquipmentProfileCatalog({
					...COMBAT_EQUIPMENT_PROFILE_CATALOG,
					profiles
				})
			).rejects.toThrow(/combat equipment profile content hash drifted/iu);
		}
	});

	it('builds an immutable order-independent aggregate from only component version/hash pairs', async () => {
		expect(await calculateCombatContentAggregateHash(COMBAT_CONTENT_BINDING.components)).toBe(
			COMBAT_CONTENT_BINDING.contentHash
		);
		expect(
			await calculateCombatContentAggregateHash([...COMBAT_CONTENT_BINDING.components].reverse())
		).toBe(COMBAT_CONTENT_BINDING.contentHash);
		expect(
			await calculateCombatContentAggregateHash(
				COMBAT_CONTENT_BINDING.components.map((component) => ({
					...component,
					ignoredRuntimeDetail: 'not-authoritative'
				}))
			)
		).toBe(COMBAT_CONTENT_BINDING.contentHash);
		expect(
			await calculateCombatContentAggregateHash(
				COMBAT_CONTENT_BINDING.components.map((component, index) =>
					index === 0
						? { ...component, contentHash: `${component.contentHash.slice(0, -1)}0` }
						: component
				)
			)
		).not.toBe(COMBAT_CONTENT_BINDING.contentHash);
		expect(Object.isFrozen(COMBAT_CONTENT_BINDING)).toBe(true);
		expect(Object.isFrozen(COMBAT_CONTENT_BINDING.components)).toBe(true);
		expect(await loadCombatContentBinding()).toBe(COMBAT_CONTENT_BINDING);
		expect(EQUIPMENT_DEFINITION_CATALOG.contentHash).toBe(
			'42a8ffc1899ee458ca8360d33dffbeac3713864548734b7345ce489c3599035c'
		);
	});
	it('expands the four material families into exactly 140 frozen definitions', () => {
		expect(EQUIPMENT_MATERIALS).toHaveLength(28);
		expect(EQUIPMENT_DEFINITIONS).toHaveLength(140);
		expect(Object.isFrozen(EQUIPMENT_DEFINITIONS)).toBe(true);
		expect(Object.isFrozen(EQUIPMENT_DEFINITIONS_BY_ID)).toBe(true);

		const counts = Object.fromEntries(
			['metal', 'wood', 'hide-or-scale', 'cloth-or-fibre'].map((family) => [
				family,
				EQUIPMENT_DEFINITIONS.filter((definition) => definition.materialFamily === family).length
			])
		);
		expect(counts).toStrictEqual({
			metal: 70,
			wood: 14,
			'hide-or-scale': 28,
			'cloth-or-fibre': 28
		});
	});

	it('contains 84 separate armour pieces and no set definitions', () => {
		const armour = EQUIPMENT_DEFINITIONS.filter((definition) =>
			['heavy-armour', 'light-armour', 'robes'].includes(definition.equipmentClass)
		);
		expect(armour).toHaveLength(84);
		expect(
			armour.every((definition) => ['head', 'torso', 'legs', 'boots'].includes(definition.slot))
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
		const definition = getEquipmentDefinition('equipment-iron-heavy-armour-torso');
		expect(definition).toBeDefined();
		const recipe = deriveStandardEquipmentRecipe(definition!);
		expect(recipe).toStrictEqual({
			schemaVersion: 'equipment-standard-recipe-v1',
			recipeId: 'forge-equipment-iron-heavy-armour-torso-standard',
			definitionId: 'equipment-iron-heavy-armour-torso',
			material: { materialId: 'iron', lots: 1 },
			craftsmanship: { label: 'standard', bonus: 0 }
		});
		expect(getEquipmentDefinitionsForMaterial('iron')).toHaveLength(10);
		expect(getEquipmentDefinitionsForMaterial('ash')).toHaveLength(2);
	});
});
