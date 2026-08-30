import { describe, expect, it } from 'vitest';

import {
	LaterPackRuleDomains,
	LaterPackRuleIds,
	LaterPackRulesHumanDecisionCreateRequestSchema,
	LaterPackRulesHumanDecisionListSchema,
	LaterPackRulesHumanDecisionRecordSchema
} from './later-pack-rules.js';

const decisions = () =>
	LaterPackRuleIds.map((ruleId, index) => ({
		ruleId,
		domain: LaterPackRuleDomains[index]!,
		textHash: String(index).repeat(64),
		decision: 'accepted' as const,
		humanRationale: `Human rationale for ${ruleId}.`
	}));

function request(overrides: Record<string, unknown> = {}) {
	return {
		decisionId: '11111111-1111-4111-8111-111111111111',
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		mode: 'human-interactive',
		actor: 'product-owner',
		proposalCanonicalSha256: 'a'.repeat(64),
		sourceReadinessCanonicalSha256: 'b'.repeat(64),
		supersedesDecisionId: null,
		decisions: decisions(),
		attestation: {
			producerDidNotApprove: true,
			reviewedEligibleBlindEvidence: true,
			acceptsRulesForLaterPacks: true
		},
		...overrides
	};
}

describe('later-pack human rule decisions', () => {
	it('accepts a strict complete human-interactive request and server timestamped record', () => {
		expect(LaterPackRulesHumanDecisionCreateRequestSchema.parse(request())).toEqual(request());
		expect(
			LaterPackRulesHumanDecisionRecordSchema.parse({
				...request(),
				decidedAt: '2026-08-29T21:00:00.000Z'
			})
		).toBeTruthy();
	});

	it('rejects producer modes, missing decisions, wrong order, blank rationale, and self-supersession', () => {
		expect(
			LaterPackRulesHumanDecisionCreateRequestSchema.safeParse(
				request({ mode: 'producer-self-review' })
			).success
		).toBe(false);
		expect(
			LaterPackRulesHumanDecisionCreateRequestSchema.safeParse(
				request({ decisions: decisions().slice(1) })
			).success
		).toBe(false);
		const reordered = decisions();
		[reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
		expect(
			LaterPackRulesHumanDecisionCreateRequestSchema.safeParse(request({ decisions: reordered }))
				.success
		).toBe(false);
		const blank = decisions();
		blank[0]!.humanRationale = ' ';
		expect(
			LaterPackRulesHumanDecisionCreateRequestSchema.safeParse(request({ decisions: blank }))
				.success
		).toBe(false);
		expect(
			LaterPackRulesHumanDecisionCreateRequestSchema.safeParse(
				request({ supersedesDecisionId: request().decisionId })
			).success
		).toBe(false);
	});

	it('validates append-only chains and exactly one latest decision per actor', () => {
		const first = LaterPackRulesHumanDecisionRecordSchema.parse({
			...request(),
			decidedAt: '2026-08-29T21:00:00.000Z'
		});
		const second = LaterPackRulesHumanDecisionRecordSchema.parse({
			...request({
				decisionId: '22222222-2222-4222-8222-222222222222',
				supersedesDecisionId: first.decisionId,
				sourceReadinessCanonicalSha256: 'c'.repeat(64)
			}),
			decidedAt: '2026-08-29T22:00:00.000Z'
		});
		expect(
			LaterPackRulesHumanDecisionListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				roundId: 'final-controlled-v1',
				records: [first, second],
				latestByActor: [second]
			})
		).toBeTruthy();
		expect(
			LaterPackRulesHumanDecisionListSchema.safeParse({
				experimentId: 'affinity-workflow-v1',
				roundId: 'final-controlled-v1',
				records: [first, second],
				latestByActor: [first]
			}).success
		).toBe(false);
	});
});
