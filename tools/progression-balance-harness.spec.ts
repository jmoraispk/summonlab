import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
	PROGRESSION_BALANCE_LEVELS,
	createProgressionBalanceEvidence,
	serializeProgressionBalanceEvidence
} from './progression-balance-harness.js';

describe('awakening and multi-path progression balance evidence', () => {
	it('covers every awakening boundary, both star endpoints, and both macro paths', () => {
		const evidence = createProgressionBalanceEvidence();

		expect(PROGRESSION_BALANCE_LEVELS).toEqual([1, 99, 100, 199, 200, 499, 500, 899, 900, 999]);
		expect(evidence.fixtures.stars).toEqual([1, 7]);
		expect(evidence.fixtures.paths).toEqual(['combat', 'crafting']);
		expect(evidence.projections).toHaveLength(PROGRESSION_BALANCE_LEVELS.length * 2 * 2);
		expect(evidence.projections.every(({ nonLevelGrowth }) => nonLevelGrowth >= 240)).toBe(true);
	});

	it('freezes all ten additive rate rows and exact physical, magical, and Health projections', () => {
		const evidence = createProgressionBalanceEvidence();

		expect(evidence.rateRows.map(({ powerPerAttributeMilli }) => powerPerAttributeMilli)).toEqual([
			1_000, 1_200, 1_400, 1_800, 2_200, 2_600, 3_200, 3_800, 4_400, 5_000
		]);
		expect(evidence.rateRows.map(({ healthPerVitality }) => healthPerVitality)).toEqual([
			5, 6, 7, 9, 11, 13, 16, 19, 22, 25
		]);
		for (const projection of evidence.projections) {
			expect(projection.physicalPowerMilli).toBe(
				projection.strength * evidence.rateRows[projection.awakeningTier]!.powerPerAttributeMilli
			);
			expect(projection.magicalPowerMilli).toBe(
				projection.magic * evidence.rateRows[projection.awakeningTier]!.powerPerAttributeMilli
			);
			expect(projection.maximumHealth).toBe(
				projection.vitality * evidence.rateRows[projection.awakeningTier]!.healthPerVitality
			);
		}
	});

	it('proves immutable-star multi-level grants and monotonic bounded XP inputs', () => {
		const evidence = createProgressionBalanceEvidence();

		expect(
			evidence.experience.multiLevel.map(({ stars, levelsCrossed, pointsGranted }) => ({
				stars,
				levelsCrossed,
				pointsGranted
			}))
		).toEqual([
			{ stars: 1, levelsCrossed: [100, 101, 102], pointsGranted: 3 },
			{ stars: 7, levelsCrossed: [100, 101, 102], pointsGranted: 21 }
		]);
		expect(evidence.experience.crafting.difficulty).toEqual(
			[...evidence.experience.crafting.difficulty].sort((a, b) => a - b)
		);
		expect(evidence.experience.crafting.rarity).toEqual(
			[...evidence.experience.crafting.rarity].sort((a, b) => a - b)
		);
		expect(Math.min(...evidence.experience.crafting.repetition)).toBeGreaterThanOrEqual(1);
		expect(Math.min(...evidence.experience.combat.repetition)).toBeGreaterThanOrEqual(1);
	});

	it('keeps flat gear and ratio terms outside awakenings and models data-only nerfs', async () => {
		const evidence = createProgressionBalanceEvidence();

		expect(evidence.nonAwakenedTerms.tier0).toEqual(evidence.nonAwakenedTerms.tier9);
		expect(evidence.candidateRateTable.stateSchema).toBe(evidence.bindings.stateSchema);
		expect(evidence.candidateRateTable.powerPerAttributeMilli).not.toEqual(
			evidence.rateRows.map(({ powerPerAttributeMilli }) => powerPerAttributeMilli)
		);
		expect(evidence.status).toBe('passed');
		expect(serializeProgressionBalanceEvidence(evidence)).toBe(
			await readFile('docs/evidence/progression-balance-v1.json', 'utf8')
		);
	});
});
