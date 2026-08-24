import {
	CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';

import type { PageServerLoad } from './$types';

function counts(values: string[]): Record<string, number> {
	return Object.fromEntries(
		[...new Set(values)]
			.sort()
			.map((value) => [value, values.filter((item) => item === value).length])
	);
}

export const load: PageServerLoad = async () => {
	const drafts = await Promise.all(
		Array.from({ length: 100 }, (_, index) =>
			generateCharacterDraft(recipeFromSeed(`cohort-${index}`))
		)
	);
	return {
		generationVersion: CHARACTER_GENERATION_VERSION,
		drafts,
		summary: {
			meanAge: Number(
				(
					drafts.reduce((total, draft) => total + draft.manifest.adultAge, 0) / drafts.length
				).toFixed(1)
			),
			meanHeightCm: Number(
				(
					drafts.reduce((total, draft) => total + draft.manifest.heightCm, 0) / drafts.length
				).toFixed(1)
			),
			uniqueNames: new Set(drafts.map((draft) => draft.manifest.displayName)).size,
			presentations: counts(drafts.map((draft) => draft.manifest.genderPresentation)),
			skinTones: counts(drafts.map((draft) => draft.manifest.phenotype.skinTone)),
			hairTextures: counts(drafts.map((draft) => draft.manifest.phenotype.hairTexture)),
			limbProportions: counts(
				drafts.map((draft) => draft.manifest.physiology?.limbProportion ?? 'legacy')
			)
		}
	};
};
