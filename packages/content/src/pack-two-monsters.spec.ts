import { describe, expect, it } from 'vitest';

import {
	PACK_TWO_MONSTER_ARCHETYPES,
	PACK_TWO_MONSTER_FAMILIES,
	PACK_TWO_MONSTER_GRADES,
	createPackTwoMonsterVariant
} from './pack-two-monsters.js';

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

	it('supports deterministic grades 1–10 for every archetype', () => {
		expect(PACK_TWO_MONSTER_GRADES).toHaveLength(10);
		for (const monster of PACK_TWO_MONSTER_ARCHETYPES) {
			for (const profile of PACK_TWO_MONSTER_GRADES) {
				const left = createPackTwoMonsterVariant(monster.id, profile.grade, 'determinism-proof');
				const right = createPackTwoMonsterVariant(monster.id, profile.grade, 'determinism-proof');
				expect(left).toEqual(right);
				expect(left.level).toBeGreaterThanOrEqual(profile.levelMin);
				expect(left.level).toBeLessThanOrEqual(profile.levelMax);
				expect(left.gradeTitle).toBe(profile.title);
			}
		}
	});

	it('uses overlapping level bands whose sampled means and escalation signals clearly rise', () => {
		for (let index = 1; index < PACK_TWO_MONSTER_GRADES.length; index += 1) {
			const previous = PACK_TWO_MONSTER_GRADES[index - 1]!;
			const current = PACK_TWO_MONSTER_GRADES[index]!;
			expect(previous.levelMax).toBeGreaterThanOrEqual(current.levelMin);
			expect(current.levelMean).toBeGreaterThan(previous.levelMean);
		}

		const sampled = PACK_TWO_MONSTER_GRADES.map((profile) => {
			const variants = Array.from({ length: 500 }, (_, index) =>
				createPackTwoMonsterVariant('death-knight', profile.grade, `mean-${index}`)
			);
			return {
				mean: variants.reduce((total, variant) => total + variant.level, 0) / variants.length,
				size: variants.reduce((total, variant) => total + variant.sizeScale, 0) / variants.length,
				muscle:
					variants.reduce((total, variant) => total + variant.musculatureScale, 0) /
					variants.length,
				weapon:
					variants.reduce((total, variant) => total + variant.weaponScale, 0) / variants.length
			};
		});

		for (let index = 0; index < sampled.length; index += 1) {
			expect(sampled[index]!.mean).toBeCloseTo(PACK_TWO_MONSTER_GRADES[index]!.levelMean, 0);
			if (index === 0) continue;
			expect(sampled[index]!.size).toBeGreaterThan(sampled[index - 1]!.size);
			expect(sampled[index]!.muscle).toBeGreaterThan(sampled[index - 1]!.muscle);
			expect(sampled[index]!.weapon).toBeGreaterThan(sampled[index - 1]!.weapon);
		}
	});

	it('escalates magical families primarily through glow and warriors through weapons', () => {
		const mageLow = createPackTwoMonsterVariant('tower-archmage', 4, 'comparison');
		const mageHigh = createPackTwoMonsterVariant('tower-archmage', 10, 'comparison');
		const warriorLow = createPackTwoMonsterVariant('death-knight', 4, 'comparison');
		const warriorHigh = createPackTwoMonsterVariant('death-knight', 10, 'comparison');

		expect(mageHigh.magicGlowScale - mageLow.magicGlowScale).toBeGreaterThan(
			mageHigh.musculatureScale - mageLow.musculatureScale
		);
		expect(warriorHigh.weaponScale - warriorLow.weaponScale).toBeGreaterThan(
			warriorHigh.magicGlowScale - warriorLow.magicGlowScale
		);
		expect(mageHigh.escalationCues).toHaveLength(3);
		expect(warriorHigh.escalationCues).toHaveLength(3);
	});
});
