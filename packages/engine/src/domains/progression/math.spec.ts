import type { CharacterCapabilityProfileV1 } from '@summonlab/contracts';
import { PROGRESSION_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	attributePowerMilli,
	awakeningTier,
	combatExperience,
	craftExperience,
	intrinsicAttributes,
	maximumHealth,
	multiplyBasisPoints
} from './math.js';

const PROFILE: CharacterCapabilityProfileV1 = {
	profileVersion: 'character-capability-v1',
	attributes: { strength: 20, agility: 30, vitality: 40, magic: 50 },
	learning: {
		cognitiveLearningScore: 60,
		domainAptitudes: { martial: 50, magical: 50, crafting: 50, survival: 50, social: 50 }
	}
};

describe('awakening progression math', () => {
	it.each([
		[1, 0, 1_000, 5],
		[99, 0, 1_000, 5],
		[100, 1, 1_200, 6],
		[500, 5, 2_600, 13],
		[899, 8, 4_400, 22],
		[900, 9, 5_000, 25],
		[999, 9, 5_000, 25]
	])('resolves level %i from the authored table', (level, tier, powerMilli, health) => {
		expect(awakeningTier(level)).toBe(tier);
		expect(PROGRESSION_RULES_V1.powerPerAttributeMilli[tier]).toBe(powerMilli);
		expect(PROGRESSION_RULES_V1.healthPerVitality[tier]).toBe(health);
	});

	it('rejects levels outside 1 through 999', () => {
		for (const level of [0, 1_000, 1.5, Number.NaN]) {
			expect(() => awakeningTier(level)).toThrow(RangeError);
		}
	});

	it('adds permanent intrinsic growth in canonical order', () => {
		const profileBefore = structuredClone(PROFILE);
		expect(
			intrinsicAttributes(PROFILE, { strength: 2, agility: 3, vitality: 4, magic: 5 })
		).toStrictEqual({ strength: 22, agility: 33, vitality: 44, magic: 55 });
		expect(PROFILE).toStrictEqual(profileBefore);
	});

	it('makes tier-nine attribute conversion exactly five times tier zero', () => {
		expect(attributePowerMilli(37, 900, PROGRESSION_RULES_V1)).toBe(
			attributePowerMilli(37, 99, PROGRESSION_RULES_V1) * 5
		);
		expect(maximumHealth(37, 900, PROGRESSION_RULES_V1)).toBe(
			maximumHealth(37, 99, PROGRESSION_RULES_V1) * 5
		);
	});

	it('uses only the supplied table, leaving state and flat values unchanged', () => {
		const candidate = {
			...PROGRESSION_RULES_V1,
			powerPerAttributeMilli: [...PROGRESSION_RULES_V1.powerPerAttributeMilli.slice(0, 9), 4_000]
		};
		const state = { level: 900, strength: 10, flatGearPowerMilli: 7_500, ratioBps: 12_000 };
		expect(attributePowerMilli(state.strength, state.level, candidate)).toBe(40_000);
		expect(state).toStrictEqual({
			level: 900,
			strength: 10,
			flatGearPowerMilli: 7_500,
			ratioBps: 12_000
		});
	});

	it('rounds basis points half up with integers', () => {
		expect(multiplyBasisPoints(5, 5_000)).toBe(3);
		expect(multiplyBasisPoints(10, 12_500)).toBe(13);
	});

	it('keeps crafting rewards monotonic across difficulty and rarity bands', () => {
		for (let difficultyBand = 1; difficultyBand <= 7; difficultyBand += 1) {
			let previous = 0;
			for (let ingredientRarityBand = 1; ingredientRarityBand <= 7; ingredientRarityBand += 1) {
				const reward = craftExperience(
					{
						difficultyBand,
						ingredientRarityBand,
						quality: 'standard',
						firstSuccess: false,
						priorCompletions: 0
					},
					PROGRESSION_RULES_V1
				);
				expect(reward).toBeGreaterThanOrEqual(previous);
				previous = reward;
			}
		}
	});

	it('rewards harder combat monotonically and decays repetitions to a floor', () => {
		let previous = 0;
		for (let difficultyBand = 1; difficultyBand <= 7; difficultyBand += 1) {
			const reward = combatExperience(
				{ difficultyBand, objectiveCompleted: true, firstClear: false, priorCompletions: 0 },
				PROGRESSION_RULES_V1
			);
			expect(reward).toBeGreaterThanOrEqual(previous);
			previous = reward;
		}
		expect(
			combatExperience(
				{ difficultyBand: 1, objectiveCompleted: false, firstClear: false, priorCompletions: 999 },
				PROGRESSION_RULES_V1
			)
		).toBe(PROGRESSION_RULES_V1.combat.minimumExperience);
	});
});
