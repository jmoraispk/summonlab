import { generatePackTwoCohort } from '@summonlab/characters';

import catalog from '../../../../../../assets/heroes/visuals/forge-v2/catalog.json';

import type { PageServerLoad } from './$types';

export const load = (async () => {
	const drafts = await generatePackTwoCohort();
	return {
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
