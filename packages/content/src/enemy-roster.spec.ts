import { describe, expect, it } from 'vitest';

import {
	ENEMY_ARCHETYPES,
	ENEMY_REVIEW_FAMILIES,
	TOWER_PROGRESSION_PREVIEW
} from './enemy-roster.js';

describe('enemy review roster and floor progression', () => {
	it('assigns sixteen unique classic archetypes to four readable visual families', () => {
		expect(ENEMY_ARCHETYPES).toHaveLength(16);
		expect(new Set(ENEMY_ARCHETYPES.map((enemy) => enemy.id)).size).toBe(16);
		expect(ENEMY_REVIEW_FAMILIES).toHaveLength(4);
		expect(ENEMY_REVIEW_FAMILIES.every((family) => family.enemyIds.length === 4)).toBe(true);
		expect(new Set(ENEMY_REVIEW_FAMILIES.flatMap((family) => family.enemyIds)).size).toBe(16);
	});

	it('gives every preview floor a level range, skill test, and known enemy', () => {
		const knownEnemyIds = new Set(ENEMY_ARCHETYPES.map((enemy) => enemy.id));
		expect(TOWER_PROGRESSION_PREVIEW).toHaveLength(20);
		for (const [index, floor] of TOWER_PROGRESSION_PREVIEW.entries()) {
			expect(floor.floor).toBe(index + 1);
			expect(floor.recommendedLevels[0]).toBeLessThanOrEqual(floor.recommendedLevels[1]);
			expect(floor.skillTest.length).toBeGreaterThan(0);
			expect(floor.newPressure.length).toBeGreaterThan(0);
			expect(floor.enemyIds.every((enemyId) => knownEnemyIds.has(enemyId))).toBe(true);
		}
		expect(
			TOWER_PROGRESSION_PREVIEW.filter((floor) => floor.threshold).map((floor) => floor.floor)
		).toEqual([5, 10, 15, 20]);
	});
});
