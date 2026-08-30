import { describe, expect, it } from 'vitest';

import { AFFINITY_SPECIES_IDS } from './affinity-workflow.js';
import {
	ENEMY_AFFINITY_ARCHETYPE_LINKS,
	ENEMY_AFFINITY_EXPANSION_ARCHETYPE_LINKS,
	ENEMY_AFFINITY_FAMILY_PILOTS
} from './enemy-affinity.js';
import { ENEMY_AFFINITY_EXPANSION_SPECIES_IDS } from './enemy-affinity-expansion.js';
import { ENEMY_ARCHETYPES, ENEMY_REVIEW_FAMILIES } from './enemy-roster.js';
import { PACK_TWO_MONSTER_ARCHETYPES, PACK_TWO_MONSTER_FAMILIES } from './pack-two-monsters.js';

describe('enemy affinity wiki links', () => {
	it('binds all eight generated species to six exact archetypes and two family pilots', () => {
		const canonicalEnemyIds = new Set([
			...ENEMY_ARCHETYPES.map((enemy) => enemy.id),
			...PACK_TWO_MONSTER_ARCHETYPES.map((enemy) => enemy.id)
		]);
		const canonicalFamilyIds = new Set([
			...ENEMY_REVIEW_FAMILIES.map((family) => family.id),
			...PACK_TWO_MONSTER_FAMILIES.map((family) => family.id)
		]);
		const linkedSpeciesIds = [
			...ENEMY_AFFINITY_ARCHETYPE_LINKS.map((link) => link.affinitySpeciesId),
			...ENEMY_AFFINITY_FAMILY_PILOTS.map((link) => link.affinitySpeciesId)
		];

		expect(ENEMY_AFFINITY_ARCHETYPE_LINKS).toHaveLength(6);
		expect(ENEMY_AFFINITY_FAMILY_PILOTS).toHaveLength(2);
		expect(new Set(linkedSpeciesIds)).toEqual(new Set(AFFINITY_SPECIES_IDS));
		expect(
			ENEMY_AFFINITY_ARCHETYPE_LINKS.every((link) => canonicalEnemyIds.has(link.archetypeId))
		).toBe(true);
		expect(
			ENEMY_AFFINITY_FAMILY_PILOTS.every((link) => canonicalFamilyIds.has(link.familyId))
		).toBe(true);
		expect(canonicalEnemyIds.size - ENEMY_AFFINITY_ARCHETYPE_LINKS.length).toBe(34);
	});

	it('links every remaining canonical archetype to the 34-species expansion', () => {
		const canonicalEnemyIds = new Set([
			...ENEMY_ARCHETYPES.map((enemy) => enemy.id),
			...PACK_TWO_MONSTER_ARCHETYPES.map((enemy) => enemy.id)
		]);
		const baselineIds = new Set<string>(
			ENEMY_AFFINITY_ARCHETYPE_LINKS.map((link) => link.archetypeId)
		);
		const expansionIds = new Set<string>(
			ENEMY_AFFINITY_EXPANSION_ARCHETYPE_LINKS.map((link) => link.archetypeId)
		);

		expect(ENEMY_AFFINITY_EXPANSION_ARCHETYPE_LINKS).toHaveLength(34);
		expect(
			new Set(ENEMY_AFFINITY_EXPANSION_ARCHETYPE_LINKS.map((link) => link.affinitySpeciesId))
		).toEqual(new Set(ENEMY_AFFINITY_EXPANSION_SPECIES_IDS));
		expect([...baselineIds].every((id) => !expansionIds.has(id))).toBe(true);
		expect(new Set([...baselineIds, ...expansionIds])).toEqual(canonicalEnemyIds);
	});
});
