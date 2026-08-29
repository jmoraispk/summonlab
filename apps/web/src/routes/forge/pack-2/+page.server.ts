import { generatePackTwoCohort } from '@summonlab/characters';
import { getConfig } from '@summonlab/config';
import { VisualReviewListSchema } from '@summonlab/contracts';
import { listVisualAssetReviews } from '@summonlab/database';

import catalog from '../../../../../../assets/heroes/visuals/forge-v2/catalog.json';
import benchmark from '../../../../../../assets/benchmarks/pack-two/report.json';
import benchmarkSamples from '../../../../../../assets/benchmarks/pack-two/samples.json';

import type { PageServerLoad } from './$types';

export const load = (async () => {
	const drafts = await generatePackTwoCohort();
	let reviewPersistenceAvailable = true;
	let reviewHistory = VisualReviewListSchema.parse({ reviews: [], latestByAsset: {} });
	try {
		reviewHistory = await listVisualAssetReviews(getConfig().databaseUrl, catalog.catalogVersion);
	} catch {
		reviewPersistenceAvailable = false;
	}
	return {
		benchmark,
		benchmarkAssets: benchmarkSamples.samples.flatMap((sample) => {
			if (
				sample.assetType === 'individual-monster-anchor' ||
				!('stateProfile' in sample) ||
				!sample.stateProfile
			)
				return [];
			const { stateProfile } = sample;
			return [
				{
					assetKey: sample.assetKey,
					role: sample.assetType,
					contentHash: sample.contentHash,
					characterId: stateProfile.characterId,
					humanStatus: sample.humanStatus
				}
			];
		}),
		reviewHistory,
		reviewPersistenceAvailable,
		catalog: {
			packId: catalog.packId,
			catalogVersion: catalog.catalogVersion,
			status: catalog.status
		},
		cohort: drafts.map((draft) => {
			const human = catalog.humans.find((entry) => entry.manifestHash === draft.manifestHash);
			if (!human) throw new Error(`Pack 2 catalog is missing ${draft.manifest.displayName}`);
			const assets = human.assetKeys.map((assetKey) => {
				const asset = catalog.assets.find((entry) => entry.assetKey === assetKey);
				if (!asset) throw new Error(`Pack 2 catalog is missing ${assetKey}`);
				return asset;
			});
			return { draft, human, assets };
		})
	};
}) satisfies PageServerLoad;
