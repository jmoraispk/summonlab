import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type {
	AffinityWorkflowReviewCreateRequest,
	ImageProductionCatalog
} from '@summonlab/contracts';

import { reviewMatchesCurrentAffinityCandidate } from './catalog.js';

const review: AffinityWorkflowReviewCreateRequest = {
	reviewId: randomUUID(),
	experimentId: 'affinity-workflow-v1',
	targetId: 'affinity-workflow-v1-death-knight-fire',
	candidateContentHash: 'a'.repeat(64),
	reviewer: 'visual-director',
	identifiedSpeciesId: 'death-knight',
	identifiedAffinity: 'fire',
	scores: {
		speciesIdentity: 5,
		affinityReadability: 5,
		silhouetteAndDuty: 5,
		materialCredibility: 5,
		anatomyAndGroundContact: 5,
		affinityIntegration: 5,
		styleCohesion: 5
	},
	verdict: 'candidate',
	note: 'Current exact-hash candidate.'
};

const catalog: ImageProductionCatalog = {
	schemaVersion: 'image-production-catalog-v1',
	experimentId: 'affinity-workflow-v1',
	generatedAt: '2026-08-29T19:00:00.000Z',
	status: 'experimental-unpromoted',
	entries: [
		{
			targetId: review.targetId,
			resultId: 'result-affinity-workflow-v1-death-knight-fire',
			assignmentId: 'assignment-affinity-workflow-v1-death-knight-fire',
			speciesId: 'death-knight',
			affinity: 'fire',
			cohort: 'controlled',
			status: 'candidate',
			candidatePath:
				'assets/enemies/experiments/affinity-workflow-v1/candidates/death-knight/fire-v1.png',
			candidateHash: review.candidateContentHash,
			reviewState: 'pending',
			promoted: false
		}
	]
};

describe('affinity review catalog binding', () => {
	it('accepts only the current target and exact candidate hash', () => {
		expect(reviewMatchesCurrentAffinityCandidate(review, catalog)).toBe(true);
		expect(
			reviewMatchesCurrentAffinityCandidate(
				{ ...review, candidateContentHash: 'b'.repeat(64) },
				catalog
			)
		).toBe(false);
		expect(
			reviewMatchesCurrentAffinityCandidate(
				{ ...review, targetId: 'affinity-workflow-v1-death-knight-water' },
				catalog
			)
		).toBe(false);
		expect(
			reviewMatchesCurrentAffinityCandidate(review, {
				...catalog,
				entries: [{ ...catalog.entries[0]!, status: 'revise' }]
			})
		).toBe(false);
	});
});
