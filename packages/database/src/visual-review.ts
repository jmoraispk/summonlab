import {
	VisualReviewCreateRequestSchema,
	VisualReviewListSchema,
	VisualReviewRecordSchema,
	type VisualReviewCreateRequest,
	type VisualReviewList,
	type VisualReviewRecord
} from '@summonlab/contracts';
import postgres from 'postgres';

interface VisualReviewRow {
	review_id: string;
	asset_key: string;
	catalog_version: string;
	asset_content_hash: string;
	verdict: string;
	note: string;
	reviewer: string;
	created_at: Date | string;
}

export class VisualReviewIdempotencyConflictError extends Error {
	public readonly code = 'VISUAL_REVIEW_IDEMPOTENCY_CONFLICT';

	public constructor(reviewId: string) {
		super(`Visual review id ${reviewId} was already used for a different decision`);
		this.name = 'VisualReviewIdempotencyConflictError';
	}
}

function recordFromRow(row: VisualReviewRow): VisualReviewRecord {
	return VisualReviewRecordSchema.parse({
		reviewId: row.review_id,
		assetKey: row.asset_key,
		catalogVersion: row.catalog_version,
		assetContentHash: row.asset_content_hash,
		verdict: row.verdict,
		note: row.note,
		reviewer: row.reviewer,
		createdAt:
			row.created_at instanceof Date
				? row.created_at.toISOString()
				: new Date(row.created_at).toISOString()
	});
}

function matchesRequest(review: VisualReviewRecord, request: VisualReviewCreateRequest): boolean {
	return (
		review.reviewId === request.reviewId &&
		review.assetKey === request.assetKey &&
		review.catalogVersion === request.catalogVersion &&
		review.assetContentHash === request.assetContentHash &&
		review.verdict === request.verdict &&
		review.note === request.note &&
		review.reviewer === request.reviewer
	);
}

export async function createVisualAssetReview(
	databaseUrl: string,
	input: VisualReviewCreateRequest
): Promise<{ review: VisualReviewRecord; created: boolean }> {
	const request = VisualReviewCreateRequestSchema.parse(input);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const inserted = await sql<VisualReviewRow[]>`
			insert into summonlab_visual_asset_reviews (
				review_id, asset_key, catalog_version, asset_content_hash, verdict, note, reviewer
			) values (
				${request.reviewId}, ${request.assetKey}, ${request.catalogVersion},
				${request.assetContentHash}, ${request.verdict}, ${request.note}, ${request.reviewer}
			)
			on conflict (review_id) do nothing
			returning *
		`;
		const rows =
			inserted.length > 0
				? inserted
				: await sql<VisualReviewRow[]>`
					select * from summonlab_visual_asset_reviews where review_id = ${request.reviewId}
				`;
		const row = rows[0];
		if (!row) throw new Error(`Visual review could not be loaded: ${request.reviewId}`);
		const review = recordFromRow(row);
		if (!matchesRequest(review, request)) {
			throw new VisualReviewIdempotencyConflictError(request.reviewId);
		}
		return { review, created: inserted.length > 0 };
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function listVisualAssetReviews(
	databaseUrl: string,
	catalogVersion: string,
	options: { includeAutomated?: boolean } = {}
): Promise<VisualReviewList> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = options.includeAutomated
			? await sql<VisualReviewRow[]>`
					select * from summonlab_visual_asset_reviews
					where catalog_version = ${catalogVersion}
					order by created_at asc, review_id asc
				`
			: await sql<VisualReviewRow[]>`
					select * from summonlab_visual_asset_reviews
					where catalog_version = ${catalogVersion} and reviewer not like 'test:%'
					order by created_at asc, review_id asc
				`;
		const reviews = rows.map(recordFromRow);
		const latestByAsset = Object.fromEntries(
			reviews.map((review) => [review.assetKey, review] as const)
		);
		return VisualReviewListSchema.parse({ reviews, latestByAsset });
	} finally {
		await sql.end({ timeout: 5 });
	}
}
