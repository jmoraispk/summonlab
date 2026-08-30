/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFile } from 'node:fs/promises';

import {
	ImageProductionCatalogSchema,
	ImageProductionResultSchema
} from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import { sha256Json } from './image-production-lib.js';
import { buildFinalControlledRerunBundle } from './prepare-final-controlled-rerun.js';
import {
	AcceptedLaterPackVisualRulesV2Schema,
	LaterPackVisualRulesProposalSchema,
	buildLaterPackRulesReadiness,
	reportCurrentLaterPackRulesReadiness
} from './report-later-pack-visual-rules-readiness.js';
import { LaterPackRulesHumanDecisionRecordSchema } from '../packages/contracts/src/index.js';

const readJson = async (file: string) => JSON.parse(await readFile(file, 'utf8'));

async function fixture() {
	const plan = await readJson(
		'assets/enemies/experiments/affinity-workflow-v1/review/final-controlled-rerun-plan.json'
	);
	const proposal = await readJson(
		'assets/enemies/experiments/affinity-workflow-v1/review/later-pack-visual-rules-proposal.json'
	);
	const targets = [...buildFinalControlledRerunBundle(plan).targets];
	const template = ImageProductionResultSchema.parse(
		await readJson('assets/enemies/experiments/affinity-workflow-v1/results/cave-bear-fire-v1.json')
	);
	const results = targets.map((target, index) =>
		ImageProductionResultSchema.parse({
			...template,
			resultId: `later-pack-fixture-result-${index}`,
			targetId: target.targetId,
			assignmentId: `later-pack-fixture-assignment-${index}`
		})
	);
	const hash = results[0]!.attempts.find(
		(attempt) => attempt.attemptId === results[0]!.selectedAttemptId
	)!.output!.contentHash;
	const catalog = ImageProductionCatalogSchema.parse({
		schemaVersion: 'image-production-catalog-v1',
		experimentId: 'affinity-workflow-v1',
		generatedAt: '2026-08-29T20:00:00.000Z',
		status: 'experimental-unpromoted',
		entries: targets.map((target, index) => ({
			targetId: target.targetId,
			resultId: results[index]!.resultId,
			assignmentId: results[index]!.assignmentId,
			speciesId: target.speciesId,
			affinity: target.affinity,
			cohort: 'controlled',
			status: 'candidate',
			candidatePath: target.output.candidatePath,
			candidateHash: hash,
			reviewState: 'accepted',
			promoted: false
		}))
	});
	const reviews = {
		schemaVersion: 'affinity-review-round-blind-reviews-v1',
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		integrationReceiptCanonicalSha256: '9'.repeat(64),
		reviewer: 'human-reviewer',
		updatedAt: '2026-08-29T20:00:00.000Z',
		reviews: targets.map((target, index) => ({
			reviewId: `00000000-0000-4000-8${String(index).padStart(3, '0')}-000000000000`,
			targetId: target.targetId,
			candidateContentHash: hash,
			reviewer: 'human-reviewer',
			reviewMode: 'blind',
			reviewedAt: '2026-08-29T20:00:00.000Z',
			identifiedSpeciesId: target.speciesId,
			identifiedAffinity: target.affinity,
			speciesCorrect: true,
			affinityCorrect: true,
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
			note: 'Eligible human blind review.'
		}))
	};
	const artifacts = Array.from({ length: 48 }, (_, index) => ({
		kind: index < 24 ? 'target' : 'assignment',
		livePath: `assets/enemies/experiments/affinity-workflow-v1/${index < 24 ? 'targets' : 'assignments'}/final-controlled/fixture-${index}.json`,
		canonicalSha256: 'a'.repeat(64),
		byteSha256: 'b'.repeat(64),
		source: 'derived'
	}));
	const activationReceipt = {
		schemaVersion: 'affinity-final-controlled-activation-receipt-v1',
		experimentId: 'affinity-workflow-v1',
		activationId: 'final-controlled-0123456789abcdef',
		status: 'complete',
		completedAt: '2026-08-29T20:00:00.000Z',
		bindings: {
			planCanonicalSha256: sha256Json(plan),
			resolutionLedgerCanonicalSha256: 'c'.repeat(64),
			blindReviewCanonicalSha256: 'd'.repeat(64),
			catalogCanonicalSha256: 'e'.repeat(64),
			executionSnapshotSha256: 'f'.repeat(64)
		},
		targetCount: 24,
		assignmentCount: 24,
		artifactCount: 48,
		artifactSetSha256: '1'.repeat(64),
		artifacts
	};
	return {
		proposal,
		plan,
		activationReceipt,
		activationReceiptValid: true,
		activationDecisionChainValid: true,
		catalog,
		blindReviews: reviews,
		finalTargets: targets,
		finalResults: results
	};
}

describe('later-pack visual-rules readiness', () => {
	it('validates the immutable proposal and its exact text hashes', async () => {
		const proposal = LaterPackVisualRulesProposalSchema.parse(
			await readJson(
				'assets/enemies/experiments/affinity-workflow-v1/review/later-pack-visual-rules-proposal.json'
			)
		);
		expect(proposal.rules).toHaveLength(8);
		const changed = structuredClone(proposal);
		changed.rules[0]!.text += ' changed';
		expect(LaterPackVisualRulesProposalSchema.safeParse(changed).success).toBe(false);
	});

	it('reports the real current repository as incomplete without writing', async () => {
		const report = await reportCurrentLaterPackRulesReadiness();
		expect(report.eligibleForHumanAcceptance).toBe(false);
		expect(report.acceptedArtifactValid).toBe(false);
		expect(report.blockers.map((item) => item.code)).toEqual(
			expect.arrayContaining(['final-round-not-integrated'])
		);
	});

	it('recognizes a complete synthetic final cohort as eligible but never infers acceptance', async () => {
		const input = await fixture();
		const report = buildLaterPackRulesReadiness(input);
		expect(report.eligibleForHumanAcceptance, JSON.stringify(report.blockers)).toBe(true);
		expect(report.acceptedArtifactValid).toBe(false);
		expect(report.counts).toEqual({
			finalTargets: 24,
			finalCandidates: 24,
			eligibleBlindReviews: 24,
			proposalRules: 8
		});
	});

	it('rejects an activation whose v2 ledger or latest DB decision is no longer authentic', async () => {
		const input = await fixture();
		for (const condition of [
			'superseded-decision',
			'database-unavailable',
			'stale-ledger'
		] as const) {
			const report = buildLaterPackRulesReadiness({
				...input,
				activationDecisionChainValid: false
			});
			expect(report.eligibleForHumanAcceptance, condition).toBe(false);
			expect(report.blockers.map((item) => item.code)).toContain(
				'activation-decision-chain-invalid'
			);
		}
	});

	it('rejects missing, API-like, stale, and failed-gate review evidence', async () => {
		for (const mutation of ['missing', 'stale', 'gate'] as const) {
			const input = await fixture();
			const reviews = structuredClone(input.blindReviews as any);
			if (mutation === 'missing') reviews.reviews.pop();
			if (mutation === 'stale') reviews.reviews[0].candidateContentHash = '0'.repeat(64);
			if (mutation === 'gate') {
				reviews.reviews[0].speciesCorrect = false;
				reviews.reviews[0].identifiedSpeciesId = 'goblin';
				reviews.reviews[1].speciesCorrect = false;
				reviews.reviews[1].identifiedSpeciesId = 'goblin';
			}
			const report = buildLaterPackRulesReadiness({ ...input, blindReviews: reviews });
			expect(report.eligibleForHumanAcceptance).toBe(false);
		}
		const input = await fixture();
		const reviews = structuredClone(input.blindReviews as any);
		reviews.reviews[0].reviewMode = 'api-unverified';
		const report = buildLaterPackRulesReadiness({ ...input, blindReviews: reviews });
		expect(report.blockers.map((item) => item.code)).toContain('invalid-blind-reviews');
	});

	it('verifies only a DB-derived, canonically bound strict v2 acceptance', async () => {
		const input = await fixture();
		const ready = buildLaterPackRulesReadiness(input) as any;
		const proposal = LaterPackVisualRulesProposalSchema.parse(input.proposal);
		const decisions = proposal.rules.map((rule) => ({
			ruleId: rule.ruleId,
			domain: rule.domain,
			textHash: rule.textHash,
			decision: 'accepted' as const,
			humanRationale: 'Human product review accepts this rule for later packs.'
		}));
		const humanDecision = LaterPackRulesHumanDecisionRecordSchema.parse({
			decisionId: '11111111-1111-4111-8111-111111111111',
			experimentId: 'affinity-workflow-v1',
			roundId: 'final-controlled-v1',
			mode: 'human-interactive',
			actor: 'product-owner',
			decidedAt: '2026-08-29T21:00:00.000Z',
			proposalCanonicalSha256: ready.bindings.proposalCanonicalSha256,
			sourceReadinessCanonicalSha256: ready.bindings.sourceReadinessCanonicalSha256,
			supersedesDecisionId: null,
			decisions,
			attestation: {
				producerDidNotApprove: true,
				reviewedEligibleBlindEvidence: true,
				acceptsRulesForLaterPacks: true
			}
		});
		const eligibleBlindReviews = ready.bindings.eligibleBlindReviews;
		const sources = {
			proposalCanonicalSha256: ready.bindings.proposalCanonicalSha256,
			planCanonicalSha256: ready.bindings.planCanonicalSha256,
			activationReceiptCanonicalSha256: ready.bindings.activationReceiptCanonicalSha256,
			catalogCanonicalSha256: ready.bindings.catalogCanonicalSha256,
			blindReviewCollectionCanonicalSha256: ready.bindings.blindReviewCollectionCanonicalSha256,
			executionSnapshotCanonicalSha256: ready.bindings.executionSnapshotCanonicalSha256,
			gateEvidenceCanonicalSha256: ready.bindings.gateEvidenceCanonicalSha256
		};
		const artifact = AcceptedLaterPackVisualRulesV2Schema.parse({
			schemaVersion: 'affinity-accepted-later-pack-visual-rules-v2',
			experimentId: 'affinity-workflow-v1',
			status: 'accepted',
			acceptanceId: '22222222-2222-4222-8222-222222222222',
			acceptedBy: humanDecision.actor,
			acceptedAt: humanDecision.decidedAt,
			acceptanceMode: 'human-interactive-db-export',
			humanDecisionRecord: {
				decisionId: humanDecision.decisionId,
				contentHash: sha256Json(humanDecision)
			},
			sources,
			eligibleBlindReviews,
			rules: decisions
		});
		let report = buildLaterPackRulesReadiness({
			...input,
			acceptedArtifact: artifact,
			humanDecisionRecord: humanDecision
		});
		expect(report.acceptedArtifactValid, JSON.stringify(report.blockers)).toBe(true);
		const stale = structuredClone(artifact);
		stale.sources.catalogCanonicalSha256 = '0'.repeat(64);
		report = buildLaterPackRulesReadiness({
			...input,
			acceptedArtifact: stale,
			humanDecisionRecord: humanDecision
		});
		expect(report.acceptedArtifactValid).toBe(false);
		expect(report.blockers.map((item) => item.code)).toContain(
			'stale-or-unbound-accepted-artifact'
		);
	});
});
