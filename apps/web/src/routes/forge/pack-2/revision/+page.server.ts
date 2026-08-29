import { getConfig } from '@summonlab/config';
import { VisualReviewListSchema } from '@summonlab/contracts';
import { listVisualAssetReviews } from '@summonlab/database';

import catalog from '../../../../../../../assets/heroes/visuals/forge-v2/revisions/catalog.json';

import type { PageServerLoad } from './$types';

export const load = (async () => {
	let reviewPersistenceAvailable = true;
	let reviewHistory = VisualReviewListSchema.parse({ reviews: [], latestByAsset: {} });
	try {
		reviewHistory = await listVisualAssetReviews(getConfig().databaseUrl, catalog.catalogVersion);
	} catch {
		reviewPersistenceAvailable = false;
	}
	return { catalog, reviewHistory, reviewPersistenceAvailable };
}) satisfies PageServerLoad;
