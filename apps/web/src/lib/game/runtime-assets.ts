import type { RuntimeVisualManifest } from '@summonlab/contracts';
import { assetUrl } from '$lib/asset-url';

let initializedManifestHash: string | undefined;

export async function loadRuntimeVisualBundle(manifest: RuntimeVisualManifest, bundleName: string) {
	const { Assets } = await import('pixi.js');
	if (!initializedManifestHash) {
		await Assets.init({
			manifest: {
				bundles: manifest.pixiManifest.bundles.map((bundle) => ({
					...bundle,
					assets: bundle.assets.map((asset) => ({ ...asset, src: assetUrl(asset.src) }))
				}))
			}
		});
		initializedManifestHash = manifest.manifestHash;
	} else if (initializedManifestHash !== manifest.manifestHash) {
		throw new Error('PixiJS Assets is already bound to a different runtime visual manifest.');
	}
	return Assets.loadBundle(bundleName);
}
