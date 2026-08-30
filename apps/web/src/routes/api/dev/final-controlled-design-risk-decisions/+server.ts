import { getConfig } from '@summonlab/config';
import {
	FinalControlledDesignRiskDecisionIdempotencyConflictError,
	FinalControlledDesignRiskDecisionSupersessionConflictError
} from '@summonlab/database';
import { json } from '@sveltejs/kit';

import {
	FinalControlledDesignRiskReviewRequestError,
	createFinalControlledDesignRiskReview,
	loadFinalControlledDesignRiskReviewSurface
} from '$lib/server/final-controlled-design-risk-review.js';

import type { RequestHandler } from './$types';

function unavailable(message: string) {
	return json({ message }, { status: 503, headers: { 'cache-control': 'no-store' } });
}

export const GET: RequestHandler = async () => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		return json(await loadFinalControlledDesignRiskReviewSurface(), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch {
		return unavailable(
			'Final-controlled design-risk review is unavailable. Check the workspace and PostgreSQL.'
		);
	}
};

export const POST: RequestHandler = async ({ request }) => {
	if (!getConfig().devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const result = await createFinalControlledDesignRiskReview({
			request: await request.json().catch(() => null)
		});
		return json(result, {
			status: result.created ? 201 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		if (error instanceof FinalControlledDesignRiskReviewRequestError) {
			return json(
				{
					message: error.message,
					...(error.currentState ? { currentState: error.currentState } : {})
				},
				{ status: error.status, headers: { 'cache-control': 'no-store' } }
			);
		}
		if (
			error instanceof FinalControlledDesignRiskDecisionIdempotencyConflictError ||
			error instanceof FinalControlledDesignRiskDecisionSupersessionConflictError
		) {
			return json(
				{ message: 'The decision history changed. Reload before deciding.' },
				{ status: 409, headers: { 'cache-control': 'no-store' } }
			);
		}
		return unavailable('The final-controlled design-risk decision could not be persisted.');
	}
};
