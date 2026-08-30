import { randomUUID } from 'node:crypto';

import { FinalControlledDesignRisks } from '@summonlab/contracts';
import postgres from 'postgres';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
	FinalControlledDesignRiskDecisionIdempotencyConflictError,
	FinalControlledDesignRiskDecisionSupersessionConflictError,
	createFinalControlledDesignRiskDecision,
	listFinalControlledDesignRiskDecisions
} from './final-controlled-design-risk-decisions.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

async function cleanup(): Promise<void> {
	if (!databaseUrl) return;
	const sql = postgres(databaseUrl, { max: 1 });
	try {
		await sql`
			delete from summonlab_final_controlled_design_risk_decisions
			where actor like 'test:design-risks-%'
		`;
	} finally {
		await sql.end();
	}
}

function request(actor: string, overrides: Record<string, unknown> = {}) {
	return {
		decisionId: randomUUID(),
		experimentId: 'affinity-workflow-v1' as const,
		scopeId: 'final-controlled-activation-v1' as const,
		mode: 'human-interactive' as const,
		actor,
		evidenceBindings: {
			planCanonicalSha256: 'a'.repeat(64),
			catalogCanonicalSha256: 'b'.repeat(64),
			executionSnapshotCanonicalSha256: 'c'.repeat(64),
			blindReviewCollectionCanonicalSha256: 'd'.repeat(64),
			sourceAuditCanonicalSha256: 'e'.repeat(64)
		},
		supersedesDecisionId: null,
		decisions: FinalControlledDesignRisks.map((risk) => ({
			...risk,
			decision:
				risk.severity === 'blocking' ? ('replace-derived-target' as const) : ('retain' as const),
			humanRationale: `Human rationale for ${risk.riskId}.`
		})),
		attestation: {
			producerDidNotResolveRisks: true as const,
			reviewedEligibleBlindEvidence: true as const,
			reviewedCompleteSourceAudit: true as const,
			deliberatelyResolvedAllRisks: true as const,
			understandsActivationRequiresIndependentVerification: true as const
		},
		...overrides
	};
}

describe('final-controlled design-risk decision persistence', () => {
	beforeEach(cleanup);
	afterEach(cleanup);

	run('is append-only, idempotent, timestamped, and linearly superseded per actor', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const actor = `test:design-risks-${randomUUID()}`;
		const firstRequest = request(actor);
		const first = await createFinalControlledDesignRiskDecision(databaseUrl, firstRequest);
		expect(first.created).toBe(true);
		expect(Date.parse(first.decision.decidedAt)).not.toBeNaN();
		expect(await createFinalControlledDesignRiskDecision(databaseUrl, firstRequest)).toEqual({
			decision: first.decision,
			created: false
		});

		await expect(
			createFinalControlledDesignRiskDecision(databaseUrl, {
				...firstRequest,
				evidenceBindings: {
					...firstRequest.evidenceBindings,
					sourceAuditCanonicalSha256: 'f'.repeat(64)
				}
			})
		).rejects.toBeInstanceOf(FinalControlledDesignRiskDecisionIdempotencyConflictError);
		await expect(
			createFinalControlledDesignRiskDecision(databaseUrl, request(actor))
		).rejects.toBeInstanceOf(FinalControlledDesignRiskDecisionSupersessionConflictError);

		const second = await createFinalControlledDesignRiskDecision(
			databaseUrl,
			request(actor, {
				supersedesDecisionId: first.decision.decisionId,
				evidenceBindings: {
					...firstRequest.evidenceBindings,
					blindReviewCollectionCanonicalSha256: 'f'.repeat(64)
				}
			})
		);
		await expect(
			createFinalControlledDesignRiskDecision(
				databaseUrl,
				request(actor, { supersedesDecisionId: first.decision.decisionId })
			)
		).rejects.toBeInstanceOf(FinalControlledDesignRiskDecisionSupersessionConflictError);

		const other = await createFinalControlledDesignRiskDecision(
			databaseUrl,
			request(`${actor}-other`)
		);
		const listed = await listFinalControlledDesignRiskDecisions(
			databaseUrl,
			'affinity-workflow-v1',
			'final-controlled-activation-v1',
			{ includeAutomated: true }
		);
		expect(listed.records.filter((record) => record.actor.startsWith(actor))).toHaveLength(3);
		expect(listed.latestByActor).toEqual(expect.arrayContaining([second.decision, other.decision]));
		expect(listed.latestByActor).not.toContainEqual(first.decision);
	});
});
