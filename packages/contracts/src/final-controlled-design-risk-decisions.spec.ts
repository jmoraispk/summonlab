import { describe, expect, it } from 'vitest';

import {
	FinalControlledDesignRiskDecisionCreateRequestSchema,
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskDecisionRecordSchema,
	FinalControlledDesignRisks
} from './final-controlled-design-risk-decisions.js';

const decisions = () =>
	FinalControlledDesignRisks.map((risk) => ({
		...risk,
		decision:
			risk.severity === 'blocking' ? ('replace-derived-target' as const) : ('retain' as const),
		humanRationale: `Reviewed evidence and deliberately resolved ${risk.riskId}.`
	}));

function request(overrides: Record<string, unknown> = {}) {
	return {
		decisionId: '11111111-1111-4111-8111-111111111111',
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		mode: 'human-interactive',
		actor: 'product-owner',
		evidenceBindings: {
			planCanonicalSha256: 'a'.repeat(64),
			catalogCanonicalSha256: 'b'.repeat(64),
			executionSnapshotCanonicalSha256: 'c'.repeat(64),
			blindReviewCollectionCanonicalSha256: 'd'.repeat(64),
			sourceAuditCanonicalSha256: 'e'.repeat(64)
		},
		supersedesDecisionId: null,
		decisions: decisions(),
		attestation: {
			producerDidNotResolveRisks: true,
			reviewedEligibleBlindEvidence: true,
			reviewedCompleteSourceAudit: true,
			deliberatelyResolvedAllRisks: true,
			understandsActivationRequiresIndependentVerification: true
		},
		...overrides
	};
}

describe('final-controlled human design-risk decisions', () => {
	it('accepts one strict decision over all 16 exact risks and a server-timestamped record', () => {
		expect(FinalControlledDesignRiskDecisionCreateRequestSchema.parse(request())).toEqual(
			request()
		);
		expect(
			FinalControlledDesignRiskDecisionRecordSchema.parse({
				...request(),
				decidedAt: '2026-08-29T21:00:00.000Z'
			})
		).toBeTruthy();
	});

	it('rejects producer mode, incomplete or reordered risks, stale bindings, and blank rationale', () => {
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(
				request({ mode: 'producer-self-review' })
			).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(
				request({ decisions: decisions().slice(1) })
			).success
		).toBe(false);
		const reordered = decisions();
		[reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(
				request({ decisions: reordered })
			).success
		).toBe(false);
		const stale = decisions() as unknown as Array<Record<string, unknown>>;
		stale[0] = { ...stale[0]!, coordinate: stale[1]!.coordinate };
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(request({ decisions: stale }))
				.success
		).toBe(false);
		const blank = decisions();
		blank[0]!.humanRationale = ' ';
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(request({ decisions: blank }))
				.success
		).toBe(false);
	});

	it('rejects retaining a blocking risk, incomplete attestations, and self-supersession', () => {
		const retained = decisions();
		retained[0] = { ...retained[0]!, decision: 'retain' };
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(
				request({ decisions: retained })
			).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(
				request({
					attestation: {
						producerDidNotResolveRisks: true,
						reviewedEligibleBlindEvidence: true
					}
				})
			).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse(
				request({ supersedesDecisionId: request().decisionId })
			).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskDecisionCreateRequestSchema.safeParse({
				...request(),
				clientApprovedAt: '2026-08-29T20:00:00.000Z'
			}).success
		).toBe(false);
	});

	it('validates append-only chains and exactly one latest decision per actor and scope', () => {
		const first = FinalControlledDesignRiskDecisionRecordSchema.parse({
			...request(),
			decidedAt: '2026-08-29T21:00:00.000Z'
		});
		const second = FinalControlledDesignRiskDecisionRecordSchema.parse({
			...request({
				decisionId: '22222222-2222-4222-8222-222222222222',
				supersedesDecisionId: first.decisionId,
				evidenceBindings: {
					...request().evidenceBindings,
					blindReviewCollectionCanonicalSha256: 'f'.repeat(64)
				}
			}),
			decidedAt: '2026-08-29T22:00:00.000Z'
		});
		expect(
			FinalControlledDesignRiskDecisionListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				scopeId: 'final-controlled-activation-v1',
				records: [first, second],
				latestByActor: [second]
			})
		).toBeTruthy();
		expect(
			FinalControlledDesignRiskDecisionListSchema.safeParse({
				experimentId: 'affinity-workflow-v1',
				scopeId: 'final-controlled-activation-v1',
				records: [first, second],
				latestByActor: [first]
			}).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskDecisionListSchema.safeParse({
				experimentId: 'affinity-workflow-v1',
				scopeId: 'final-controlled-activation-v1',
				records: [first, second],
				latestByActor: [{ ...second, actor: 'another-human' }]
			}).success
		).toBe(false);
	});
});
