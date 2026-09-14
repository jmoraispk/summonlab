import { ProductionCompletionEvidenceV1Schema } from '@summonlab/contracts';
import { PROGRESSION_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { deterministicUuid } from '../../hash.js';
import { experienceClaimForProduction } from './production.js';

const HERO_ID = deterministicUuid('production-evidence-hero');
const EVENT_ID = deterministicUuid('production-evidence-event');

function evidence(overrides: Record<string, unknown> = {}) {
	return ProductionCompletionEvidenceV1Schema.parse({
		evidenceVersion: 'production-completion-v1',
		craftKind: 'cooking',
		heroId: HERO_ID,
		resultId: 'food-hearth-stew',
		recipeId: 'recipe-hearth-stew',
		recipeDifficulty: 2,
		consumedIngredientRarities: [1, 2, 2],
		resultQuality: 'standard',
		completionEventId: EVENT_ID,
		...overrides
	});
}

describe('completed production experience', () => {
	it.each(['forging', 'cooking'] as const)(
		'creates a deterministic %s crafting claim',
		(craftKind) => {
			const claim = experienceClaimForProduction(
				evidence({ craftKind }),
				{ priorCompletions: 0 },
				PROGRESSION_RULES_V1
			);
			expect(claim).toMatchObject({
				heroId: HERO_ID,
				sourceEventId: EVENT_ID,
				sourceKind: 'crafting',
				evidenceKey: `${craftKind}:recipe-hearth-stew`
			});
			expect(claim.amount).toBeGreaterThan(0);
		}
	);

	it('is monotonic across difficulty and averaged ingredient rarity', () => {
		let prior = 0;
		for (let band = 1; band <= 7; band += 1) {
			const amount = experienceClaimForProduction(
				evidence({ recipeDifficulty: band, consumedIngredientRarities: [band] }),
				{ priorCompletions: 1 },
				PROGRESSION_RULES_V1
			).amount;
			expect(amount).toBeGreaterThanOrEqual(prior);
			prior = amount;
		}
	});

	it('rewards discovery, decays repetition, and retains the authored floor', () => {
		const first = experienceClaimForProduction(
			evidence(),
			{ priorCompletions: 0 },
			PROGRESSION_RULES_V1
		);
		const repeated = experienceClaimForProduction(
			evidence(),
			{ priorCompletions: 1 },
			PROGRESSION_RULES_V1
		);
		const exhausted = experienceClaimForProduction(
			evidence({ recipeDifficulty: 1, consumedIngredientRarities: [1] }),
			{ priorCompletions: 999 },
			PROGRESSION_RULES_V1
		);
		expect(first.amount).toBeGreaterThan(repeated.amount);
		expect(exhausted.amount).toBe(PROGRESSION_RULES_V1.crafting.minimumExperience);
	});

	it('applies result quality without changing the evidence identity', () => {
		const standard = experienceClaimForProduction(
			evidence(),
			{ priorCompletions: 0 },
			PROGRESSION_RULES_V1
		);
		const masterwork = experienceClaimForProduction(
			evidence({ resultQuality: 'masterwork' }),
			{ priorCompletions: 0 },
			PROGRESSION_RULES_V1
		);
		expect(masterwork.amount).toBeGreaterThan(standard.amount);
		expect(masterwork.evidenceKey).toBe(standard.evidenceKey);
	});
});
