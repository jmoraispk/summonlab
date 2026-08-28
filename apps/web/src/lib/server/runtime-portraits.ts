import { RuntimeVisualManifestSchema, type RuntimeVisualUsage } from '@summonlab/contracts';

import runtimeVisualManifestSource from '../../../static/runtime/visual-catalog-v1/manifest.json';

const runtimeVisualManifest = RuntimeVisualManifestSchema.parse(runtimeVisualManifestSource);
const runtimePortraits = runtimeVisualManifest.bundles.flatMap((bundle) => bundle.assets);

export interface RuntimePortrait {
	readonly publicPath: string;
	readonly width: number;
	readonly height: number;
}

export function runtimePortraitFor(
	manifestHash: string,
	artKey: string | null,
	usage: RuntimeVisualUsage
): RuntimePortrait | null {
	const asset = runtimePortraits.find(
		(candidate) =>
			candidate.usage === usage &&
			(candidate.manifestHashes.includes(manifestHash) ||
				(artKey !== null && candidate.sourceAssetKey === artKey))
	);
	return asset ? { publicPath: asset.publicPath, width: asset.width, height: asset.height } : null;
}
