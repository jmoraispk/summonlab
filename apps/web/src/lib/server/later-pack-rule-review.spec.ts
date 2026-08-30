import {
	LaterPackRuleDomains,
	LaterPackRuleIds,
	LaterPackRulesHumanDecisionListSchema,
	LaterPackRulesHumanDecisionRecordSchema
} from '@summonlab/contracts';
import { describe, expect, it, vi } from 'vitest';

import { sha256Json } from '../../../../../tools/image-production-lib.js';
import {
	createLaterPackRuleReviewForActor,
	listLaterPackRuleReviewForActor,
	parseLaterPackRuleActor,
	type LaterPackRuleReviewDependencies
} from './later-pack-rule-review.js';

const rules = LaterPackRuleIds.map((ruleId, index) => ({
	ruleId,
	domain: LaterPackRuleDomains[index]!,
	requiredDecision: true as const,
	text: `Plan-owned rule ${index + 1}.`,
	textHash: String(index).repeat(64)
}));
const proposal = {
	schemaVersion: 'affinity-later-pack-visual-rules-proposal-v1' as const,
	experimentId: 'affinity-workflow-v1' as const,
	status: 'proposed-not-accepted' as const,
	rules
};
const readiness = {
	schemaVersion: 'affinity-later-pack-rules-readiness-v1' as const,
	eligibleForHumanAcceptance: true,
	acceptedArtifactValid: false,
	counts: { finalTargets: 24, finalCandidates: 24, eligibleBlindReviews: 24, proposalRules: 8 },
	bindings: {
		proposalCanonicalSha256: sha256Json(proposal),
		planCanonicalSha256: 'a'.repeat(64),
		activationReceiptCanonicalSha256: 'b'.repeat(64),
		catalogCanonicalSha256: 'c'.repeat(64),
		blindReviewCollectionCanonicalSha256: 'd'.repeat(64),
		executionSnapshotCanonicalSha256: 'e'.repeat(64),
		gateEvidenceCanonicalSha256: 'f'.repeat(64),
		sourceReadinessCanonicalSha256: '1'.repeat(64),
		eligibleBlindReviews: [],
		gateEvidence: {
			firstAttempt: 24,
			speciesCorrect: 24,
			affinityCorrect: 24,
			normalCorrect: 4,
			meaningfulAccepted: 20,
			criticalAccepted: 0
		}
	},
	blockers: [] as { code: string; detail: string }[]
};

function request(overrides: Record<string, unknown> = {}) {
	return {
		decisionId: '11111111-1111-4111-8111-111111111111',
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		mode: 'human-interactive',
		actor: 'visual-director',
		proposalCanonicalSha256: readiness.bindings.proposalCanonicalSha256,
		sourceReadinessCanonicalSha256: readiness.bindings.sourceReadinessCanonicalSha256,
		supersedesDecisionId: null,
		decisions: rules.map(({ ruleId, domain, textHash }) => ({
			ruleId,
			domain,
			textHash,
			decision: 'accepted',
			humanRationale: `Reviewed rule ${ruleId} against the eligible evidence.`
		})),
		attestation: {
			producerDidNotApprove: true,
			reviewedEligibleBlindEvidence: true,
			acceptsRulesForLaterPacks: true
		},
		...overrides
	};
}

function dependencies() {
	const record = LaterPackRulesHumanDecisionRecordSchema.parse({
		...request(),
		decidedAt: '2026-08-29T23:00:00.000Z'
	});
	return {
		loadReadiness: vi.fn(async () => readiness),
		loadProposal: vi.fn(async () => proposal),
		listDecisions: vi.fn(async () =>
			LaterPackRulesHumanDecisionListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				roundId: 'final-controlled-v1',
				records: [record],
				latestByActor: [record]
			})
		),
		createDecision: vi.fn(async () => ({ decision: record, created: true }))
	} satisfies LaterPackRuleReviewDependencies;
}

describe('later-pack rule review service', () => {
	it('requires a printable explicit actor', () => {
		expect(parseLaterPackRuleActor('  visual-director ')).toBe('visual-director');
		expect(() => parseLaterPackRuleActor(null)).toThrow('explicit actor');
		expect(() => parseLaterPackRuleActor('bad\nactor')).toThrow('explicit actor');
	});

	it('lists only the explicit actor history with current proposal and readiness', async () => {
		const deps = dependencies();
		const result = await listLaterPackRuleReviewForActor({
			databaseUrl: 'unused',
			actor: 'visual-director',
			workspaceRoot: '/unused',
			dependencies: deps
		});
		expect(result.decisions.records).toHaveLength(1);
		expect(result.decisions.latestByActor[0]?.actor).toBe('visual-director');
		expect(result.proposal.rules).toHaveLength(8);
		expect(result.readiness.eligibleForHumanAcceptance).toBe(true);
	});

	it('persists a strict explicit human decision without changing its verdicts', async () => {
		const deps = dependencies();
		const submitted = request({
			decisions: request().decisions.map((decision, index) =>
				index === 3 ? { ...decision, decision: 'rejected' } : decision
			)
		});
		await createLaterPackRuleReviewForActor({
			databaseUrl: 'unused',
			actor: 'visual-director',
			request: submitted,
			workspaceRoot: '/unused',
			dependencies: deps
		});
		expect(deps.createDecision).toHaveBeenCalledWith(
			'unused',
			expect.objectContaining({ decisions: submitted.decisions })
		);
	});

	it('rejects extra input, actor mismatch, ineligible evidence, and stale hashes', async () => {
		const deps = dependencies();
		await expect(
			createLaterPackRuleReviewForActor({
				databaseUrl: 'unused',
				actor: 'visual-director',
				request: request({ extra: true }),
				workspaceRoot: '/unused',
				dependencies: deps
			})
		).rejects.toThrow('invalid');
		await expect(
			createLaterPackRuleReviewForActor({
				databaseUrl: 'unused',
				actor: 'another-reviewer',
				request: request(),
				workspaceRoot: '/unused',
				dependencies: deps
			})
		).rejects.toThrow('must match');
		deps.loadReadiness.mockResolvedValueOnce({
			...readiness,
			eligibleForHumanAcceptance: false,
			blockers: [{ code: 'final-human-gate-not-passed', detail: 'Pending review.' }]
		});
		await expect(
			createLaterPackRuleReviewForActor({
				databaseUrl: 'unused',
				actor: 'visual-director',
				request: request(),
				workspaceRoot: '/unused',
				dependencies: deps
			})
		).rejects.toThrow('not eligible');
		await expect(
			createLaterPackRuleReviewForActor({
				databaseUrl: 'unused',
				actor: 'visual-director',
				request: request({ sourceReadinessCanonicalSha256: '9'.repeat(64) }),
				workspaceRoot: '/unused',
				dependencies: deps
			})
		).rejects.toThrow('changed');
		await expect(
			createLaterPackRuleReviewForActor({
				databaseUrl: 'unused',
				actor: 'visual-director',
				request: request({
					decisions: request().decisions.map((decision, index) =>
						index === 0 ? { ...decision, textHash: '8'.repeat(64) } : decision
					)
				}),
				workspaceRoot: '/unused',
				dependencies: deps
			})
		).rejects.toThrow('text hashes');
		expect(deps.createDecision).not.toHaveBeenCalled();
	});
});
