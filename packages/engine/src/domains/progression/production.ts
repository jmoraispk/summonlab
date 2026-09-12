import {
	ProductionCompletionEvidenceV1Schema,
	type ExperienceClaim,
	type ProductionCompletionEvidenceV1
} from '@summonlab/contracts';
import type { ProgressionRulesV1 } from '@summonlab/content';

import { deterministicUuid } from '../../hash.js';
import { craftExperience } from './math.js';

export type ProductionHistory = Readonly<{ priorCompletions: number }>;

function roundedAverage(values: readonly number[]): number {
	const total = values.reduce((sum, value) => sum + value, 0);
	return Math.floor((total + values.length / 2) / values.length);
}

export function productionEvidenceKey(
	evidence: Pick<ProductionCompletionEvidenceV1, 'craftKind' | 'recipeId'>
): string {
	return `${evidence.craftKind}:${evidence.recipeId}`;
}

export function experienceClaimForProduction(
	evidenceInput: ProductionCompletionEvidenceV1,
	history: ProductionHistory,
	rules: ProgressionRulesV1
): ExperienceClaim {
	const evidence = ProductionCompletionEvidenceV1Schema.parse(evidenceInput);
	if (!Number.isSafeInteger(history.priorCompletions) || history.priorCompletions < 0) {
		throw new RangeError('priorCompletions');
	}
	const evidenceKey = productionEvidenceKey(evidence);
	return {
		claimId: deterministicUuid(`${evidence.completionEventId}:${evidence.heroId}:crafting-xp`),
		heroId: evidence.heroId,
		sourceEventId: evidence.completionEventId,
		evidenceKey,
		amount: craftExperience(
			{
				difficultyBand: evidence.recipeDifficulty,
				ingredientRarityBand: roundedAverage(evidence.consumedIngredientRarities),
				quality: evidence.resultQuality,
				firstSuccess: history.priorCompletions === 0,
				priorCompletions: history.priorCompletions
			},
			rules
		),
		sourceKind: 'crafting'
	};
}
