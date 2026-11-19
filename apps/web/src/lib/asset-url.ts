/**
 * Where the browser fetches image and animation files.
 *
 * Build with `VITE_ASSET_BASE` (for example `https://assets.summonlab.ai`) to load them from the public
 * asset bucket instead of this deployment and GitHub. The bucket mirrors two trees: `apps/web/static`
 * at its root (`/runtime/…`, `/wiki-media/…`, `/hero-archive/…`) and repository art at its repository
 * path (`/assets/…`). Unset, every URL stays exactly as before.
 *
 * Content records keep their root-relative paths (contracts validate them as `/runtime/…`); apply
 * these helpers only where a file is fetched or shown.
 */
const ASSET_BASE = String(import.meta.env.VITE_ASSET_BASE ?? '').replace(/\/+$/u, '');
const REPOSITORY = 'jmoraispk/summonlab';

export const assetBucketConfigured = ASSET_BASE !== '';

/**
 * A file under `apps/web/static`, given its root-relative URL (`/runtime/…`). `local` is the URL used
 * without a bucket, for callers that add the app's base path.
 */
export function assetUrl(path: string, local: string = path): string {
	if (!ASSET_BASE || !path.startsWith('/') || path.startsWith('//')) return local;
	return `${ASSET_BASE}${path}`;
}

/** The full-size file for repository art kept in Git LFS, e.g. `assets/enemies/…/normal.png`. */
export function repositoryArtUrl(repositoryPath: string): string {
	const path = repositoryPath.replace(/^\/+/u, '');
	return ASSET_BASE
		? `${ASSET_BASE}/${path}`
		: `https://media.githubusercontent.com/media/${REPOSITORY}/main/${path}`;
}

/** Where an "original file" link points: the bucket's copy, or the file's page on GitHub. */
export function repositoryArtLink(repositoryPath: string): string {
	const path = repositoryPath.replace(/^\/+/u, '');
	return ASSET_BASE
		? `${ASSET_BASE}/${path}`
		: `https://github.com/${REPOSITORY}/blob/main/${path}`;
}
