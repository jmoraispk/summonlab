import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import {
	AffinityWorkflowReviewCreateRequestSchema,
	AffinityWorkflowReviewListSchema
} from '@summonlab/contracts';
import {
	AffinityWorkflowReviewIdempotencyConflictError,
	createAffinityWorkflowReview,
	listAffinityWorkflowReviews
} from '@summonlab/database';
import { fail } from '@sveltejs/kit';

import { findVerifiedMediaByOpaqueId, loadAffinityReviewData } from './affinity-review';

import type { Actions, PageServerLoad } from './$types';

const EXPERIMENT_ID = 'affinity-workflow-v1';

function formString(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === 'string' ? value : '';
}

function score(formData: FormData, name: string): number {
	return Number(formString(formData, name));
}

export const load = (async ({ url }) => {
	const blind = url.searchParams.get('mode') === 'blind';
	const config = getConfig();
	let reviewPersistenceAvailable = config.devRoutesEnabled;
	let reviewPersistenceMessage = config.devRoutesEnabled
		? ''
		: 'Review persistence is disabled because developer routes are not enabled.';
	let reviews = AffinityWorkflowReviewListSchema.parse({
		experimentId: EXPERIMENT_ID,
		reviews: [],
		latestByTargetReviewer: []
	});
	if (config.devRoutesEnabled) {
		try {
			reviews = await listAffinityWorkflowReviews(config.databaseUrl, EXPERIMENT_ID);
		} catch {
			reviewPersistenceAvailable = false;
			reviewPersistenceMessage =
				'Affinity review history is unavailable. Start PostgreSQL with pnpm dev, then reload.';
		}
	}
	return {
		...(await loadAffinityReviewData(blind, reviews.reviews)),
		reviewId: randomUUID(),
		reviewPersistenceAvailable,
		reviewPersistenceMessage
	};
}) satisfies PageServerLoad;

export const actions = {
	default: async ({ request }) => {
		const config = getConfig();
		if (!config.devRoutesEnabled) {
			return fail(404, { reviewError: 'Review persistence is not enabled.' });
		}

		const formData = await request.formData();
		const opaqueMediaId = formString(formData, 'opaqueMediaId');
		const candidate = await findVerifiedMediaByOpaqueId(opaqueMediaId);
		if (!candidate) {
			return fail(409, {
				reviewError: 'This verified candidate changed or is unavailable. Reload before reviewing.'
			});
		}
		if (candidate.resultStatus !== 'candidate') {
			return fail(409, {
				reviewError: 'Revision evidence can be inspected but cannot receive a candidate review.'
			});
		}

		const parsed = AffinityWorkflowReviewCreateRequestSchema.safeParse({
			reviewId: formString(formData, 'reviewId'),
			experimentId: EXPERIMENT_ID,
			targetId: candidate.targetId,
			candidateContentHash: candidate.contentHash,
			reviewer: formString(formData, 'reviewer'),
			identifiedSpeciesId: formString(formData, 'identifiedSpeciesId'),
			identifiedAffinity: formString(formData, 'identifiedAffinity'),
			scores: {
				speciesIdentity: score(formData, 'speciesIdentity'),
				affinityReadability: score(formData, 'affinityReadability'),
				silhouetteAndDuty: score(formData, 'silhouetteAndDuty'),
				materialCredibility: score(formData, 'materialCredibility'),
				anatomyAndGroundContact: score(formData, 'anatomyAndGroundContact'),
				affinityIntegration: score(formData, 'affinityIntegration'),
				styleCohesion: score(formData, 'styleCohesion')
			},
			verdict: formString(formData, 'verdict'),
			note: formString(formData, 'note')
		});
		if (!parsed.success) {
			return fail(400, {
				reviewError: 'Complete the reviewer, guesses, seven scores, verdict, and note.'
			});
		}

		try {
			const result = await createAffinityWorkflowReview(config.databaseUrl, parsed.data);
			return {
				reviewSaved: true,
				reviewCreated: result.created,
				reviewMessage: result.created
					? 'Review saved against the verified candidate hash. No asset was promoted.'
					: 'This exact review was already saved; the retry was safely idempotent.'
			};
		} catch (error) {
			if (error instanceof AffinityWorkflowReviewIdempotencyConflictError) {
				return fail(409, { reviewError: error.message });
			}
			return fail(503, {
				reviewError:
					'The review could not be persisted. Start PostgreSQL with pnpm dev and try again.'
			});
		}
	}
} satisfies Actions;
