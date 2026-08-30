import {
	LaterPackRuleDomains,
	LaterPackRuleIds,
	LaterPackRulesHumanDecisionListSchema,
	LaterPackRulesHumanDecisionRecordSchema,
	type LaterPackRulesHumanDecisionRecord
} from '../packages/contracts/src/index.js';
import { describe, expect, it, vi } from 'vitest';

import { sha256Json } from './image-production-lib.js';
import { AcceptedLaterPackVisualRulesV2Schema } from './report-later-pack-visual-rules-readiness.js';
import { verifyAcceptedLaterPackRulesForCompletion } from './verify-accepted-later-pack-rules-completion.js';

const decisions = LaterPackRuleIds.map((ruleId, index) => ({
	ruleId,
	domain: LaterPackRuleDomains[index]!,
	textHash: String(index).repeat(64),
	decision: 'accepted' as const,
	humanRationale: `Human review rationale for ${ruleId}.`
}));

function decision(
	overrides: Partial<LaterPackRulesHumanDecisionRecord> = {}
): LaterPackRulesHumanDecisionRecord {
	return LaterPackRulesHumanDecisionRecordSchema.parse({
		decisionId: '11111111-1111-4111-8111-111111111111',
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		mode: 'human-interactive',
		actor: 'product-owner',
		proposalCanonicalSha256: 'a'.repeat(64),
		sourceReadinessCanonicalSha256: 'b'.repeat(64),
		supersedesDecisionId: null,
		decisions,
		attestation: {
			producerDidNotApprove: true,
			reviewedEligibleBlindEvidence: true,
			acceptsRulesForLaterPacks: true
		},
		decidedAt: '2026-08-29T22:00:00.000Z',
		...overrides
	});
}

function artifact(record = decision()) {
	return AcceptedLaterPackVisualRulesV2Schema.parse({
		schemaVersion: 'affinity-accepted-later-pack-visual-rules-v2',
		experimentId: 'affinity-workflow-v1',
		status: 'accepted',
		acceptanceId: record.decisionId,
		acceptedBy: record.actor,
		acceptedAt: record.decidedAt,
		acceptanceMode: 'human-interactive-db-export',
		humanDecisionRecord: {
			decisionId: record.decisionId,
			contentHash: sha256Json(record)
		},
		sources: {
			proposalCanonicalSha256: 'a'.repeat(64),
			planCanonicalSha256: 'c'.repeat(64),
			activationReceiptCanonicalSha256: 'd'.repeat(64),
			catalogCanonicalSha256: 'e'.repeat(64),
			blindReviewCollectionCanonicalSha256: 'f'.repeat(64),
			executionSnapshotCanonicalSha256: '1'.repeat(64),
			gateEvidenceCanonicalSha256: '2'.repeat(64)
		},
		eligibleBlindReviews: Array.from({ length: 24 }, (_, index) => ({
			reviewId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
			targetId: `final-controlled-target-${index}`,
			candidateHash: '3'.repeat(64),
			reviewHash: '4'.repeat(64)
		})),
		rules: record.decisions
	});
}

function list(records: LaterPackRulesHumanDecisionRecord[], latestByActor = records.slice(-1)) {
	return LaterPackRulesHumanDecisionListSchema.parse({
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		records,
		latestByActor
	});
}

describe('accepted later-pack rules completion authenticity', () => {
	it('does not query the database or readiness when the artifact is absent', async () => {
		const loadDecisions = vi.fn(async () => {
			throw new Error('database unavailable');
		});
		const validateReadiness = vi.fn(async () => ({
			eligibleForHumanAcceptance: true,
			acceptedArtifactValid: true
		}));
		const loadDatabaseUrl = vi.fn(() => {
			throw new Error('configuration should not be loaded');
		});
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			loadArtifact: async () => ({ present: false }),
			loadDatabaseUrl,
			loadDecisions,
			validateReadiness
		});
		expect(result).toMatchObject({
			artifactPresent: false,
			acceptedArtifactValid: false,
			failure: null
		});
		expect(loadDecisions).not.toHaveBeenCalled();
		expect(validateReadiness).not.toHaveBeenCalled();
		expect(loadDatabaseUrl).not.toHaveBeenCalled();
	});

	it('rejects a hand-authored decision hash before full readiness validation', async () => {
		const record = decision();
		const handAuthored = {
			...artifact(record),
			humanDecisionRecord: {
				decisionId: record.decisionId,
				contentHash: '9'.repeat(64)
			}
		};
		const validateReadiness = vi.fn(async () => ({
			eligibleForHumanAcceptance: true,
			acceptedArtifactValid: true
		}));
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			databaseUrl: 'postgres://unused',
			actor: record.actor,
			loadArtifact: async () => ({ present: true, artifact: handAuthored }),
			loadDecisions: async () => list([record]),
			validateReadiness
		});
		expect(result).toMatchObject({
			acceptedArtifactValid: false,
			failure: 'artifact-decision-hash-mismatch'
		});
		expect(validateReadiness).not.toHaveBeenCalled();
	});

	it('requires an explicit actor before querying an existing artifact decision', async () => {
		const record = decision();
		const loadDecisions = vi.fn(async () => list([record]));
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			databaseUrl: 'postgres://unused',
			loadArtifact: async () => ({ present: true, artifact: artifact(record) }),
			loadDecisions
		});
		expect(result).toMatchObject({
			artifactPresent: true,
			acceptedArtifactValid: false,
			failure: 'actor-required'
		});
		expect(loadDecisions).not.toHaveBeenCalled();
	});

	it('rejects an artifact bound to a superseded rather than latest actor decision', async () => {
		const first = decision();
		const latest = decision({
			decisionId: '22222222-2222-4222-8222-222222222222',
			supersedesDecisionId: first.decisionId,
			decidedAt: '2026-08-29T23:00:00.000Z'
		});
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			databaseUrl: 'postgres://unused',
			actor: first.actor,
			loadArtifact: async () => ({ present: true, artifact: artifact(first) }),
			loadDecisions: async () => list([first, latest], [latest]),
			validateReadiness: async () => ({
				eligibleForHumanAcceptance: true,
				acceptedArtifactValid: true
			})
		});
		expect(result).toMatchObject({
			acceptedArtifactValid: false,
			decisionId: latest.decisionId,
			failure: 'latest-decision-mismatch'
		});
	});

	it('fails closed without throwing when an artifact exists but the database is unavailable', async () => {
		const record = decision();
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			databaseUrl: 'postgres://unavailable',
			actor: record.actor,
			loadArtifact: async () => ({ present: true, artifact: artifact(record) }),
			loadDecisions: async () => {
				throw new Error('connection refused');
			}
		});
		expect(result).toMatchObject({
			artifactPresent: true,
			acceptedArtifactValid: false,
			failure: 'database-unavailable'
		});
	});

	it('accepts only the current DB record after full artifact-plus-record readiness validation', async () => {
		const record = decision();
		const acceptedArtifact = artifact(record);
		const validateReadiness = vi.fn(async () => ({
			eligibleForHumanAcceptance: true,
			acceptedArtifactValid: true
		}));
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			workspaceRoot: '/workspace',
			databaseUrl: 'postgres://unused',
			actor: record.actor,
			loadArtifact: async () => ({ present: true, artifact: acceptedArtifact }),
			loadDecisions: async () => list([record]),
			validateReadiness
		});
		expect(result).toEqual({
			artifactPresent: true,
			acceptedArtifactValid: true,
			sourceBlindReviewCount: 24,
			actor: record.actor,
			decisionId: record.decisionId,
			failure: null
		});
		expect(validateReadiness).toHaveBeenCalledWith('/workspace', {
			acceptedArtifact,
			humanDecisionRecord: record
		});
	});

	it('fails closed when the latest record is stale for full current readiness', async () => {
		const record = decision({ sourceReadinessCanonicalSha256: '8'.repeat(64) });
		const result = await verifyAcceptedLaterPackRulesForCompletion({
			databaseUrl: 'postgres://unused',
			actor: record.actor,
			loadArtifact: async () => ({ present: true, artifact: artifact(record) }),
			loadDecisions: async () => list([record]),
			validateReadiness: async () => ({
				eligibleForHumanAcceptance: true,
				acceptedArtifactValid: false
			})
		});
		expect(result).toMatchObject({
			acceptedArtifactValid: false,
			failure: 'full-readiness-validation-failed'
		});
	});
});
