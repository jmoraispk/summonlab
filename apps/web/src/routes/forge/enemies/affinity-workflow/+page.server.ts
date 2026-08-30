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
import { error, fail } from '@sveltejs/kit';

import {
	listLaterPackRuleReviewForActor,
	loadLaterPackRuleReviewContext,
	parseLaterPackRuleActor
} from '$lib/server/later-pack-rule-review.js';

import {
	ControlledRoundUnavailableError,
	findVerifiedMediaByOpaqueId,
	loadAffinityReviewData,
	parseAffinityReviewScope,
	parseControlledRoundId,
	parseAffinityReviewer
} from './affinity-review';

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
	let scope: ReturnType<typeof parseAffinityReviewScope>;
	let controlledRound: ReturnType<typeof parseControlledRoundId>;
	let activeReviewer: ReturnType<typeof parseAffinityReviewer>;
	let laterPackRuleActor: string | null;
	try {
		scope = blind ? parseAffinityReviewScope(url.searchParams.get('scope')) : 'all';
		controlledRound = parseControlledRoundId(url.searchParams.get('round'));
		activeReviewer = blind ? parseAffinityReviewer(url.searchParams.get('reviewer')) : null;
		const requestedRuleActor = url.searchParams.has('actor')
			? parseLaterPackRuleActor(url.searchParams.get('actor'))
			: null;
		if (activeReviewer && requestedRuleActor && activeReviewer !== requestedRuleActor) {
			throw new Error('Reviewer session actor mismatch.');
		}
		laterPackRuleActor = activeReviewer ?? requestedRuleActor;
	} catch {
		error(400, 'Unknown reviewer, rule actor, affinity review scope, or controlled round.');
	}
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
	let laterPackRuleReview: {
		actor: string | null;
		proposal: Awaited<ReturnType<typeof loadLaterPackRuleReviewContext>>['proposal'] | null;
		readiness: Awaited<ReturnType<typeof loadLaterPackRuleReviewContext>>['readiness'] | null;
		decisions: Awaited<ReturnType<typeof listLaterPackRuleReviewForActor>>['decisions'] | null;
		persistenceAvailable: boolean;
		message: string;
	};
	try {
		if (laterPackRuleActor && config.devRoutesEnabled) {
			const surface = await listLaterPackRuleReviewForActor({
				databaseUrl: config.databaseUrl,
				actor: laterPackRuleActor
			});
			laterPackRuleReview = {
				actor: surface.actor,
				proposal: surface.proposal,
				readiness: surface.readiness,
				decisions: surface.decisions,
				persistenceAvailable: true,
				message: ''
			};
		} else {
			const context = await loadLaterPackRuleReviewContext({});
			laterPackRuleReview = {
				actor: laterPackRuleActor,
				...context,
				decisions: null,
				persistenceAvailable: false,
				message: config.devRoutesEnabled
					? 'Set an explicit rule-review actor to load history and record a decision.'
					: 'Rule-decision persistence is disabled because developer routes are not enabled.'
			};
		}
	} catch {
		let context: Awaited<ReturnType<typeof loadLaterPackRuleReviewContext>> | null = null;
		try {
			context = await loadLaterPackRuleReviewContext({});
		} catch {
			// The page remains useful for image inspection even if rule evidence cannot be loaded.
		}
		laterPackRuleReview = {
			actor: laterPackRuleActor,
			proposal: context?.proposal ?? null,
			readiness: context?.readiness ?? null,
			decisions: null,
			persistenceAvailable: false,
			message:
				'Later-pack rule review is unavailable. Start PostgreSQL with pnpm dev and verify the current evidence.'
		};
	}
	try {
		const affinityReviewData = await loadAffinityReviewData(
			blind,
			reviews.reviews,
			scope,
			controlledRound,
			activeReviewer
		);
		const safeLaterPackRuleReview =
			blind && affinityReviewData.remainingCandidateCount > 0
				? {
						actor: laterPackRuleActor,
						proposal: null,
						readiness: null,
						decisions: null,
						persistenceAvailable: false,
						message:
							'Rule proposal and decision history are withheld until this reviewer completes the current blind set.'
					}
				: laterPackRuleReview;
		return {
			...affinityReviewData,
			reviewId: randomUUID(),
			reviewPersistenceAvailable,
			reviewPersistenceMessage,
			laterPackRuleReview: safeLaterPackRuleReview
		};
	} catch (loadError) {
		if (loadError instanceof ControlledRoundUnavailableError) {
			error(409, 'The requested controlled round is not fully validated and available.');
		}
		throw loadError;
	}
}) satisfies PageServerLoad;

export const actions = {
	default: async ({ request, url }) => {
		const config = getConfig();
		if (!config.devRoutesEnabled) {
			return fail(404, { reviewError: 'Review persistence is not enabled.' });
		}
		if (url.searchParams.get('mode') !== 'blind') {
			return fail(409, {
				reviewError: 'Review evidence can only be recorded from the server-stripped blind mode.'
			});
		}

		const formData = await request.formData();
		let controlledRound: ReturnType<typeof parseControlledRoundId>;
		let scope: ReturnType<typeof parseAffinityReviewScope>;
		let activeReviewer: ReturnType<typeof parseAffinityReviewer>;
		try {
			controlledRound = parseControlledRoundId(url.searchParams.get('round'));
			scope = parseAffinityReviewScope(url.searchParams.get('scope'));
			activeReviewer = parseAffinityReviewer(url.searchParams.get('reviewer'));
			if (!activeReviewer)
				return fail(400, { reviewError: 'Start a named reviewer session first.' });
			if (formString(formData, 'controlledRound') !== controlledRound) {
				return fail(409, { reviewError: 'The controlled review round changed. Reload first.' });
			}
		} catch {
			return fail(400, {
				reviewError: 'Unknown reviewer, affinity review scope, or controlled round.'
			});
		}
		const opaqueMediaId = formString(formData, 'opaqueMediaId');
		let candidate;
		try {
			candidate = await findVerifiedMediaByOpaqueId(opaqueMediaId, controlledRound, scope);
		} catch (bindingError) {
			if (bindingError instanceof ControlledRoundUnavailableError) {
				return fail(409, {
					reviewError: 'This controlled round is no longer fully validated. Reload first.'
				});
			}
			throw bindingError;
		}
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
			reviewer: activeReviewer,
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
				reviewError: 'Complete the guesses, seven scores, verdict, and note.'
			});
		}

		try {
			const result = await createAffinityWorkflowReview(config.databaseUrl, {
				...parsed.data,
				reviewMode: 'blind'
			});
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
