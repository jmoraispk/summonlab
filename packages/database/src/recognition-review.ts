import {
	RecognitionReviewCreateRequestSchema,
	RecognitionReviewListSchema,
	RecognitionReviewRecordSchema,
	type RecognitionCueOutcome,
	type RecognitionReviewCreateRequest,
	type RecognitionReviewList,
	type RecognitionReviewRecord
} from '@summonlab/contracts';
import postgres from 'postgres';

interface RecognitionReviewRow {
	review_id: string;
	audit_hash: string;
	catalog_version: string;
	character_id: string;
	case_id: string;
	outcomes: RecognitionCueOutcome[] | string;
	verdict: string;
	note: string;
	reviewer: string;
	created_at: Date | string;
}

export class RecognitionReviewIdempotencyConflictError extends Error {
	public readonly code = 'RECOGNITION_REVIEW_IDEMPOTENCY_CONFLICT';

	public constructor(reviewId: string) {
		super(`Recognition review id ${reviewId} was already used for different evidence`);
		this.name = 'RecognitionReviewIdempotencyConflictError';
	}
}

function recordFromRow(row: RecognitionReviewRow): RecognitionReviewRecord {
	return RecognitionReviewRecordSchema.parse({
		reviewId: row.review_id,
		auditHash: row.audit_hash,
		catalogVersion: row.catalog_version,
		characterId: row.character_id,
		caseId: row.case_id,
		outcomes: typeof row.outcomes === 'string' ? JSON.parse(row.outcomes) : row.outcomes,
		verdict: row.verdict,
		note: row.note,
		reviewer: row.reviewer,
		createdAt:
			row.created_at instanceof Date
				? row.created_at.toISOString()
				: new Date(row.created_at).toISOString()
	});
}

function matchesRequest(
	review: RecognitionReviewRecord,
	request: RecognitionReviewCreateRequest
): boolean {
	return (
		review.reviewId === request.reviewId &&
		review.auditHash === request.auditHash &&
		review.catalogVersion === request.catalogVersion &&
		review.characterId === request.characterId &&
		review.caseId === request.caseId &&
		JSON.stringify(review.outcomes) === JSON.stringify(request.outcomes) &&
		review.verdict === request.verdict &&
		review.note === request.note &&
		review.reviewer === request.reviewer
	);
}

export async function createRecognitionReview(
	databaseUrl: string,
	input: RecognitionReviewCreateRequest
): Promise<{ review: RecognitionReviewRecord; created: boolean }> {
	const request = RecognitionReviewCreateRequestSchema.parse(input);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const inserted = await sql<RecognitionReviewRow[]>`
			insert into summonlab_visual_recognition_reviews (
				review_id, audit_hash, catalog_version, character_id, case_id,
				outcomes, verdict, note, reviewer
			) values (
				${request.reviewId}, ${request.auditHash}, ${request.catalogVersion},
				${request.characterId}, ${request.caseId}, ${sql.json(request.outcomes)},
				${request.verdict}, ${request.note}, ${request.reviewer}
			)
			on conflict (review_id) do nothing
			returning *
		`;
		const rows =
			inserted.length > 0
				? inserted
				: await sql<RecognitionReviewRow[]>`
						select * from summonlab_visual_recognition_reviews where review_id = ${request.reviewId}
					`;
		const row = rows[0];
		if (!row) throw new Error(`Recognition review could not be loaded: ${request.reviewId}`);
		const review = recordFromRow(row);
		if (!matchesRequest(review, request)) {
			throw new RecognitionReviewIdempotencyConflictError(request.reviewId);
		}
		return { review, created: inserted.length > 0 };
	} finally {
		await sql.end({ timeout: 5 });
	}
}

export async function listRecognitionReviews(
	databaseUrl: string,
	auditHash: string,
	options: { includeAutomated?: boolean } = {}
): Promise<RecognitionReviewList> {
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = options.includeAutomated
			? await sql<RecognitionReviewRow[]>`
					select * from summonlab_visual_recognition_reviews
					where audit_hash = ${auditHash}
					order by created_at asc, review_id asc
				`
			: await sql<RecognitionReviewRow[]>`
					select * from summonlab_visual_recognition_reviews
					where audit_hash = ${auditHash} and reviewer not like 'test:%'
					order by created_at asc, review_id asc
				`;
		const reviews = rows.map(recordFromRow);
		const latestByCase = Object.fromEntries(
			reviews.map((review) => [review.caseId, review] as const)
		);
		return RecognitionReviewListSchema.parse({ reviews, latestByCase });
	} finally {
		await sql.end({ timeout: 5 });
	}
}
