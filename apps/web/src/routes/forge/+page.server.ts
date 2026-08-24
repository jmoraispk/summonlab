import {
	VISUAL_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';

import type { PageServerLoad } from './$types';

const forgeSeeds = [
	'ember-01',
	'hearth-02',
	'hearth-03',
	'hearth-05',
	'hearth-06',
	'hearth-09',
	'hearth-10',
	'hearth-12',
	'hearth-13',
	'hearth-17',
	'hearth-21',
	'hearth-29'
];

export const load: PageServerLoad = async () => ({
	drafts: await Promise.all(
		forgeSeeds.map((seed) =>
			generateCharacterDraft(
				recipeFromSeed(
					seed,
					seed === 'ember-01' || seed === 'hearth-02'
						? VISUAL_CHARACTER_GENERATION_VERSION
						: undefined
				)
			)
		)
	)
});
