import { getConfig } from '@summonlab/config';
import {
	LaterPackRuleDecisionIdempotencyConflictError,
	LaterPackRuleDecisionSupersessionConflictError
} from '@summonlab/database';
import { json } from '@sveltejs/kit';

import {
	LaterPackRuleReviewRequestError,
	createLaterPackRuleReviewForActor,
	listLaterPackRuleReviewForActor,
	parseLaterPackRuleActor
} from '$lib/server/later-pack-rule-review.js';

import type { RequestHandler } from './$types';

function persistenceFailure(message: string, error: unknown) {
	return json(
		{
			message,
			detail: error instanceof Error ? error.message : 'unknown persistence failure'
		},
		{ status: 503 }
	);
}

export const GET: RequestHandler = async ({ url }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	let actor: string;
	try {
		actor = parseLaterPackRuleActor(url.searchParams.get('actor'));
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'An explicit actor is required.' },
			{ status: 400 }
		);
	}
	try {
		const surface = await listLaterPackRuleReviewForActor({
			databaseUrl: config.databaseUrl,
			actor
		});
		return json(surface, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		if (error instanceof LaterPackRuleReviewRequestError) {
			return json({ message: error.message }, { status: error.status });
		}
		return persistenceFailure(
			'Later-pack rule review history is unavailable. Start PostgreSQL with pnpm dev.',
			error
		);
	}
};

export const POST: RequestHandler = async ({ request, url }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	try {
		const result = await createLaterPackRuleReviewForActor({
			databaseUrl: config.databaseUrl,
			actor: parseLaterPackRuleActor(url.searchParams.get('actor')),
			request: await request.json().catch(() => null)
		});
		return json(result, {
			status: result.created ? 201 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		if (error instanceof LaterPackRuleReviewRequestError) {
			return json({ message: error.message }, { status: error.status });
		}
		if (
			error instanceof LaterPackRuleDecisionIdempotencyConflictError ||
			error instanceof LaterPackRuleDecisionSupersessionConflictError
		) {
			return json({ message: error.message }, { status: 409 });
		}
		return persistenceFailure('The later-pack rule decision could not be persisted.', error);
	}
};
