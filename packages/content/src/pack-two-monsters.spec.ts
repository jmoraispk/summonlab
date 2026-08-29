import { describe, expect, it } from 'vitest';

import { PACK_TWO_MONSTER_ARCHETYPES, PACK_TWO_MONSTER_FAMILIES } from './pack-two-monsters.js';

describe('Character Pack 2 monster roster', () => {
	it('defines six four-member families with 24 unique archetypes and duties', () => {
		expect(PACK_TWO_MONSTER_ARCHETYPES).toHaveLength(24);
		expect(PACK_TWO_MONSTER_FAMILIES).toHaveLength(6);
		expect(PACK_TWO_MONSTER_FAMILIES.every((family) => family.monsterIds.length === 4)).toBe(true);
		expect(new Set(PACK_TWO_MONSTER_ARCHETYPES.map((monster) => monster.id)).size).toBe(24);
		expect(new Set(PACK_TWO_MONSTER_ARCHETYPES.map((monster) => monster.duty)).size).toBe(24);
		expect(new Set(PACK_TWO_MONSTER_FAMILIES.flatMap((family) => family.monsterIds)).size).toBe(24);
	});

	it('gives every monster a visible duty cue, telegraph, and counterplay weak point', () => {
		const known = new Set(PACK_TWO_MONSTER_ARCHETYPES.map((monster) => monster.id));
		for (const family of PACK_TWO_MONSTER_FAMILIES) {
			expect(family.monsterIds.every((monsterId) => known.has(monsterId))).toBe(true);
		}
		for (const monster of PACK_TWO_MONSTER_ARCHETYPES) {
			expect(monster.dutyCue.length).toBeGreaterThan(30);
			expect(monster.telegraph.length).toBeGreaterThan(30);
			expect(monster.weakPoint.length).toBeGreaterThan(10);
		}
	});
});
