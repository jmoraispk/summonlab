import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { CharacterVisualCatalogSchema } from '@summonlab/contracts';
import visualCatalog from '../../../../../assets/heroes/visuals/catalog.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => ({
	catalog: CharacterVisualCatalogSchema.parse(visualCatalog),
	characters: await Promise.all(
		['ember-01', 'hearth-02'].map((seed) => generateCharacterDraft(recipeFromSeed(seed)))
	)
});
