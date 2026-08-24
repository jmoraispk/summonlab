import {
	VISUAL_CHARACTER_GENERATION_VERSION,
	generateCharacterDraft,
	recipeFromSeed
} from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { CharacterVisualCatalogSchema, VisualReviewListSchema } from '@summonlab/contracts';
import { listVisualAssetReviews } from '@summonlab/database';
import visualCatalog from '../../../../../assets/heroes/visuals/catalog.json';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const catalog = CharacterVisualCatalogSchema.parse(visualCatalog);
	let reviewPersistenceAvailable = true;
	let reviewHistory = VisualReviewListSchema.parse({ reviews: [], latestByAsset: {} });
	try {
		reviewHistory = await listVisualAssetReviews(getConfig().databaseUrl, catalog.catalogVersion);
	} catch {
		reviewPersistenceAvailable = false;
	}
	return {
		catalog,
		characters: await Promise.all(
			['ember-01', 'hearth-02'].map((seed) =>
				generateCharacterDraft(recipeFromSeed(seed, VISUAL_CHARACTER_GENERATION_VERSION))
			)
		),
		reviewHistory,
		reviewPersistenceAvailable
	};
};
