import { getConfig } from '@summonlab/config';
import { VisualReviewListSchema } from '@summonlab/contracts';
import { listVisualAssetReviews } from '@summonlab/database';

import catalog from '../../../../../../../assets/enemies/review/pack-2/catalog.json';
import benchmarkCatalog from '../../../../../../../assets/enemies/review/pack-2/benchmarks/catalog.json';

import type { PageServerLoad } from './$types';

export const load = (async () => {
	let reviewPersistenceAvailable = true;
	let reviewHistory = VisualReviewListSchema.parse({ reviews: [], latestByAsset: {} });
	try {
		reviewHistory = await listVisualAssetReviews(getConfig().databaseUrl, catalog.catalogVersion);
	} catch {
		reviewPersistenceAvailable = false;
	}
	return {
		catalog,
		benchmarkAssets: benchmarkCatalog.assets.map((sample) => ({
			assetKey: sample.assetKey,
			name: sample.name,
			contentHash: sample.contentHash,
			humanStatus: sample.humanStatus
		})),
		reviewHistory,
		reviewPersistenceAvailable
	};
}) satisfies PageServerLoad;
