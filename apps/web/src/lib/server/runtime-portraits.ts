import {
	SummonableHeroRuntimeManifestSchema,
	type CombatRasterBinding,
	type RuntimeVisualUsage
} from '@summonlab/contracts';

import summonableHeroRuntimeManifestSource from '../../../static/runtime/summonable-heroes-v1/manifest.json';

const summonableHeroRuntimeManifest = SummonableHeroRuntimeManifestSchema.parse(
	summonableHeroRuntimeManifestSource
);
const runtimePortraits = summonableHeroRuntimeManifest.entries.flatMap(
	(entry) => entry.bundle.assets
);

export interface RuntimePortrait {
	readonly publicPath: string;
	readonly width: number;
	readonly height: number;
}

export function runtimeCombatBindingFor(
	manifestHash: string,
	artKey: string | null
): CombatRasterBinding | null {
	const asset = runtimePortraits.find(
		(candidate) =>
			candidate.usage === 'combat-chibi' &&
			candidate.sourceStatus === 'approved' &&
			(candidate.manifestHashes.includes(manifestHash) ||
				(artKey !== null && candidate.sourceAssetKey === artKey))
	);
	return asset
		? {
				assetKey: asset.sourceAssetKey,
				source: asset.publicPath,
				contentHash: asset.contentHash,
				approvalStatus: 'approved',
				approvalId: `${asset.sourceAssetKey}-runtime-approved`
			}
		: null;
}

export function runtimePortraitFor(
	manifestHash: string,
	artKey: string | null,
	usage: RuntimeVisualUsage
): RuntimePortrait | null {
	const identityMatches = (candidate: (typeof runtimePortraits)[number]) =>
		candidate.manifestHashes.includes(manifestHash) ||
		(artKey !== null && candidate.sourceAssetKey === artKey);
	const exact = runtimePortraits.find(
		(candidate) => candidate.usage === usage && identityMatches(candidate)
	);
	const asset =
		exact ??
		(['dialogue', 'roster'].includes(usage)
			? runtimePortraits.find(
					(candidate) => candidate.usage === 'summon' && identityMatches(candidate)
				)
			: undefined);
	return asset ? { publicPath: asset.publicPath, width: asset.width, height: asset.height } : null;
}
