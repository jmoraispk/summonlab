import { assetBucketConfigured, assetUrl } from '$lib/asset-url';

/**
 * The 3D rig test bench is a standalone page published to the asset bucket (`bench/rigging/`) by the
 * image-to-3D experiment's `sync_r2.py publish bench`; `/rigging` embeds it. Builds without
 * `VITE_ASSET_BASE` (local development) still show the hosted copy, since the bench and its models are
 * not part of this app's static files.
 */
const BENCH_PATH = '/bench/rigging/index.html';
const HOSTED_ASSET_BASE = 'https://assets.summonlab.ai';

export const rigBenchUrl = assetBucketConfigured
	? assetUrl(BENCH_PATH)
	: `${HOSTED_ASSET_BASE}${BENCH_PATH}`;

export const rigBenchOrigin = new URL(rigBenchUrl).origin;

/** The bench URL for a given entry id (for example `api/asha-neutral`), or its default view. */
export function rigBenchSource(entry: string | null): string {
	if (!entry) return rigBenchUrl;
	const url = new URL(rigBenchUrl);
	url.searchParams.set('entry', entry);
	return url.toString();
}

/** The entry id from a bench `postMessage`, when the message really came from the bench. */
export function rigBenchEntryFromMessage(origin: string, data: unknown): string | null {
	if (origin !== rigBenchOrigin || typeof data !== 'object' || data === null) return null;
	const { type, entry } = data as { type?: unknown; entry?: unknown };
	return type === 'rig-bench-entry' && typeof entry === 'string' && entry.length <= 200
		? entry
		: null;
}
