import {
	AffinityWorkflowExperimentIdSchema,
	AffinityWorkflowReviewCreateRequestSchema,
	AffinityWorkflowReviewListSchema,
	AffinityWorkflowReviewRecordSchema,
	type AffinityWorkflowReviewCreateRequest,
	type AffinityWorkflowReviewList,
	type AffinityWorkflowReviewRecord
} from '@summonlab/contracts';
import postgres from 'postgres';

interface AffinityWorkflowReviewRow {
	review_id: string;
	experiment_id: string;
	target_id: string;
	candidate_content_hash: string;
	reviewer: string;
	identified_species_id: string;
	identified_affinity: string;
	species_identity_score: number;
	affinity_readability_score: number;
	silhouette_and_duty_score: number;
	material_credibility_score: number;
	anatomy_and_ground_contact_score: number;
	affinity_integration_score: number;
	style_cohesion_score: number;
	verdict: string;
	note: string;
	reviewed_at: Date | string;
}

export class AffinityWorkflowReviewIdempotencyConflictError extends Error {
	public readonly code = 'AFFINITY_WORKFLOW_REVIEW_IDEMPOTENCY_CONFLICT';

	public constructor(reviewId: string) {
		super(`Affinity workflow review id ${reviewId} was already used for different evidence`);
		this.name = 'AffinityWorkflowReviewIdempotencyConflictError';
	}
}

function recordFromRow(row: AffinityWorkflowReviewRow): AffinityWorkflowReviewRecord {
	return AffinityWorkflowReviewRecordSchema.parse({
		reviewId: row.review_id,
		experimentId: row.experiment_id,
		targetId: row.target_id,
		candidateContentHash: row.candidate_content_hash,
		reviewer: row.reviewer,
		identifiedSpeciesId: row.identified_species_id,
		identifiedAffinity: row.identified_affinity,
		scores: {
			speciesIdentity: row.species_identity_score,
			affinityReadability: row.affinity_readability_score,
			silhouetteAndDuty: row.silhouette_and_duty_score,
			materialCredibility: row.material_credibility_score,
			anatomyAndGroundContact: row.anatomy_and_ground_contact_score,
			affinityIntegration: row.affinity_integration_score,
			styleCohesion: row.style_cohesion_score
		},
		verdict: row.verdict,
		note: row.note,
		reviewedAt:
			row.reviewed_at instanceof Date
				? row.reviewed_at.toISOString()
				: new Date(row.reviewed_at).toISOString()
	});
}

function matchesRequest(
	review: AffinityWorkflowReviewRecord,
	request: AffinityWorkflowReviewCreateRequest
): boolean {
	return (
		review.reviewId === request.reviewId &&
		review.experimentId === request.experimentId &&
		review.targetId === request.targetId &&
		review.candidateContentHash === request.candidateContentHash &&
		review.reviewer === request.reviewer &&
		review.identifiedSpeciesId === request.identifiedSpeciesId &&
		review.identifiedAffinity === request.identifiedAffinity &&
		JSON.stringify(review.scores) === JSON.stringify(request.scores) &&
		review.verdict === request.verdict &&
		review.note === request.note
	);
}

export async function createAffinityWorkflowReview(
	databaseUrl: string,
	input: AffinityWorkflowReviewCreateRequest
): Promise<{ review: AffinityWorkflowReviewRecord; created: boolean }> {
	const request = AffinityWorkflowReviewCreateRequestSchema.parse(input);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const inserted = await sql<AffinityWorkflowReviewRow[]>`
			insert into summonlab_affinity_workflow_reviews (
				review_id, experiment_id, target_id, candidate_content_hash, reviewer,
				identified_species_id, identified_affinity,
				species_identity_score, affinity_readability_score, silhouette_and_duty_score,
				material_credibility_score, anatomy_and_ground_contact_score,
				affinity_integration_score, style_cohesion_score, verdict, note
			) values (
				${request.reviewId}, ${request.experimentId}, ${request.targetId},
				${request.candidateContentHash}, ${request.reviewer},
				${request.identifiedSpeciesId}, ${request.identifiedAffinity},
				${request.scores.speciesIdentity}, ${request.scores.affinityReadability},
				${request.scores.silhouetteAndDuty}, ${request.scores.materialCredibility},
				${request.scores.anatomyAndGroundContact}, ${request.scores.affinityIntegration},
				${request.scores.styleCohesion}, ${request.verdict}, ${request.note}
			)
			on conflict (review_id) do nothing
			returning *
		`;
		const rows =
			inserted.length > 0
				? inserted
				: await sql<AffinityWorkflowReviewRow[]>`
						select * from summonlab_affinity_workflow_reviews
						where review_id = ${request.reviewId}
					`;
		const row = rows[0];
		if (!row) throw new Error(`Affinity workflow review could not be loaded: ${request.reviewId}`);
		const review = recordFromRow(row);
		if (!matchesRequest(review, request)) {
			throw new AffinityWorkflowReviewIdempotencyConflictError(request.reviewId);
		}
		return { review, created: inserted.length > 0 };
	} finally {
		await sql.end({ timeout: 5 });
	}
}

/**
 * Lists one experiment's append-only history plus the newest record for each
 * target/reviewer pair. This preserves independent reviewers instead of allowing
 * the most recent person to hide another person's evidence.
 */
export async function listAffinityWorkflowReviews(
	databaseUrl: string,
	experimentId: string,
	options: { includeAutomated?: boolean } = {}
): Promise<AffinityWorkflowReviewList> {
	const scopedExperimentId = AffinityWorkflowExperimentIdSchema.parse(experimentId);
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		const rows = options.includeAutomated
			? await sql<AffinityWorkflowReviewRow[]>`
					select * from summonlab_affinity_workflow_reviews
					where experiment_id = ${scopedExperimentId}
					order by reviewed_at asc, review_id asc
				`
			: await sql<AffinityWorkflowReviewRow[]>`
					select * from summonlab_affinity_workflow_reviews
					where experiment_id = ${scopedExperimentId} and reviewer not like 'test:%'
					order by reviewed_at asc, review_id asc
				`;
		const reviews = rows.map(recordFromRow);
		const latest = new Map<string, AffinityWorkflowReviewRecord>();
		for (const review of reviews) {
			latest.set(`${review.targetId}\u0000${review.reviewer}`, review);
		}
		return AffinityWorkflowReviewListSchema.parse({
			experimentId: scopedExperimentId,
			reviews,
			latestByTargetReviewer: [...latest.values()]
		});
	} finally {
		await sql.end({ timeout: 5 });
	}
}
