import { getConfig } from '@summonlab/config';
import {
	AffinityWorkflowExperimentIdSchema,
	AffinityWorkflowReviewCreateRequestSchema,
	AffinityWorkflowReviewListSchema,
	ImageProductionCatalogSchema
} from '@summonlab/contracts';
import {
	AffinityWorkflowReviewIdempotencyConflictError,
	createAffinityWorkflowReview,
	listAffinityWorkflowReviews
} from '@summonlab/database';
import { json } from '@sveltejs/kit';
import affinityCatalogSource from '../../../../../../../assets/enemies/experiments/affinity-workflow-v1/review/catalog.json';

import type { RequestHandler } from './$types';
import { reviewMatchesCurrentAffinityCandidate } from './catalog.js';

const experimentId = AffinityWorkflowExperimentIdSchema.parse('affinity-workflow-v1');
const catalog = ImageProductionCatalogSchema.parse(affinityCatalogSource);

export const GET: RequestHandler = async ({ url }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const requestedExperiment = url.searchParams.get('experimentId') ?? experimentId;
	if (requestedExperiment !== experimentId || catalog.experimentId !== experimentId) {
		return json({ message: 'Unknown affinity workflow experiment.' }, { status: 404 });
	}

	try {
		const reviews = await listAffinityWorkflowReviews(getConfig().databaseUrl, experimentId, {
			includeAutomated: url.searchParams.get('includeAutomated') === 'true'
		});
		return json(AffinityWorkflowReviewListSchema.parse(reviews), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{
				message: 'Affinity review history is unavailable. Start PostgreSQL with pnpm dev.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const parsed = AffinityWorkflowReviewCreateRequestSchema.safeParse(
		await request.json().catch(() => null)
	);
	if (!parsed.success) {
		return json(
			{ message: 'The affinity workflow review is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}

	if (!reviewMatchesCurrentAffinityCandidate(parsed.data, catalog)) {
		return json(
			{ message: 'The affinity candidate changed. Reload the experiment before reviewing it.' },
			{ status: 409 }
		);
	}

	try {
		const result = await createAffinityWorkflowReview(getConfig().databaseUrl, {
			...parsed.data,
			reviewMode: 'api-unverified'
		});
		return json(result.review, {
			status: result.created ? 201 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		if (error instanceof AffinityWorkflowReviewIdempotencyConflictError) {
			return json({ message: error.message }, { status: 409 });
		}
		return json(
			{
				message: 'The affinity workflow review could not be persisted.',
				detail: error instanceof Error ? error.message : 'unknown persistence failure'
			},
			{ status: 503 }
		);
	}
};
