import { getConfig } from '@summonlab/config';
import {
	CharacterVisualCatalogSchema,
	VisualReviewCreateRequestSchema,
	VisualReviewListSchema
} from '@summonlab/contracts';
import {
	VisualReviewIdempotencyConflictError,
	createVisualAssetReview,
	listVisualAssetReviews
} from '@summonlab/database';
import { json } from '@sveltejs/kit';
import visualCatalogSource from '../../../../../../../assets/heroes/visuals/catalog.json';
import packTwoBenchmarkSource from '../../../../../../../assets/benchmarks/pack-two/samples.json';
import packTwoCatalogSource from '../../../../../../../assets/heroes/visuals/forge-v2/catalog.json';
import packTwoRevisionCatalogSource from '../../../../../../../assets/heroes/visuals/forge-v2/revisions/catalog.json';
import packTwoMonsterCatalogSource from '../../../../../../../assets/enemies/review/pack-2/catalog.json';

import type { RequestHandler } from './$types';

const catalog = CharacterVisualCatalogSchema.parse(visualCatalogSource);
const humanBenchmarkAssets = packTwoBenchmarkSource.samples.filter(
	(sample) => sample.assetType !== 'individual-monster-anchor'
);
const monsterBenchmarkAssets = packTwoBenchmarkSource.samples.filter(
	(sample) => sample.assetType === 'individual-monster-anchor'
);
const supportedCatalogs = new Map([
	[
		catalog.catalogVersion,
		catalog.assets.map((asset) => ({ assetKey: asset.assetKey, contentHash: asset.contentHash }))
	],
	[
		packTwoCatalogSource.catalogVersion,
		[...packTwoCatalogSource.assets, ...humanBenchmarkAssets].map((asset) => ({
			assetKey: asset.assetKey,
			contentHash: asset.contentHash
		}))
	],
	[
		packTwoMonsterCatalogSource.catalogVersion,
		[...packTwoMonsterCatalogSource.plates, ...monsterBenchmarkAssets].map((plate) => ({
			assetKey: plate.assetKey,
			contentHash: plate.contentHash
		}))
	],
	[
		packTwoRevisionCatalogSource.catalogVersion,
		packTwoRevisionCatalogSource.assets.map((asset) => ({
			assetKey: asset.assetKey,
			contentHash: asset.contentHash
		}))
	]
]);

export const GET: RequestHandler = async ({ url }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const catalogVersion = url.searchParams.get('catalogVersion') ?? catalog.catalogVersion;
	if (!supportedCatalogs.has(catalogVersion)) {
		return json({ message: 'Unknown visual catalog.' }, { status: 404 });
	}
	try {
		const reviews = await listVisualAssetReviews(getConfig().databaseUrl, catalogVersion, {
			includeAutomated: url.searchParams.get('includeAutomated') === 'true'
		});
		return json(VisualReviewListSchema.parse(reviews), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{
				message: 'Visual review history is unavailable. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = VisualReviewCreateRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'The visual review is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	const assets = supportedCatalogs.get(parsed.data.catalogVersion);
	const asset = assets?.find((candidate) => candidate.assetKey === parsed.data.assetKey);
	if (!asset || parsed.data.assetContentHash !== asset.contentHash) {
		return json(
			{ message: 'The visual asset changed. Reload the catalog before reviewing it.' },
			{ status: 409 }
		);
	}

	try {
		const result = await createVisualAssetReview(getConfig().databaseUrl, parsed.data);
		return json(result.review, {
			status: result.created ? 201 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		if (error instanceof VisualReviewIdempotencyConflictError) {
			return json({ message: error.message }, { status: 409 });
		}
		return json(
			{
				message: 'The visual review could not be persisted.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
