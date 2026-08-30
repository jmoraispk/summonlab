import {
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskDecisionRecordSchema,
	FinalControlledDesignRisks
} from '@summonlab/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { FinalControlledDesignRiskReadinessReport } from '../../../../../tools/final-controlled-design-risk-readiness.js';
import { sha256Json } from '../../../../../tools/image-production-lib.js';
import {
	FinalControlledDesignRiskReviewRequestError,
	createFinalControlledDesignRiskReview,
	loadFinalControlledDesignRiskReviewSurface,
	type FinalControlledDesignRiskReviewDependencies
} from './final-controlled-design-risk-review.js';

const evidenceBindings = {
	planCanonicalSha256: '1'.repeat(64),
	catalogCanonicalSha256: '2'.repeat(64),
	executionSnapshotCanonicalSha256: '3'.repeat(64),
	blindReviewCollectionCanonicalSha256: '4'.repeat(64),
	sourceAuditCanonicalSha256: '5'.repeat(64)
};
const decisions = FinalControlledDesignRisks.map((risk) => ({
	...risk,
	decision: 'replace-derived-target' as const,
	humanRationale: `Reviewed ${risk.riskId} against the complete baseline evidence.`
}));
const attestation = {
	producerDidNotResolveRisks: true as const,
	reviewedEligibleBlindEvidence: true as const,
	reviewedCompleteSourceAudit: true as const,
	deliberatelyResolvedAllRisks: true as const,
	understandsActivationRequiresIndependentVerification: true as const
};
const readyReport: FinalControlledDesignRiskReadinessReport = {
	schemaVersion: 'final-controlled-design-risk-readiness-v1',
	status: 'ready',
	reviewer: 'visual-director',
	counts: {
		targetCount: 24,
		resultCount: 24,
		candidateCount: 21,
		reviseCount: 3,
		exportedBlindReviewCount: 21,
		databaseLatestBlindReviewCount: 21
	},
	evidenceBindings,
	blockers: []
};

function record(actor: string, decisionId: string) {
	return FinalControlledDesignRiskDecisionRecordSchema.parse({
		decisionId,
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		mode: 'human-interactive',
		actor,
		evidenceBindings,
		supersedesDecisionId: null,
		decisions,
		attestation,
		decidedAt: '2026-08-29T23:00:00.000Z'
	});
}

function clientRequest(overrides: Record<string, unknown> = {}) {
	return {
		evidenceFingerprint: sha256Json(evidenceBindings),
		decisions,
		attestation,
		...overrides
	};
}

function dependencies(
	options: {
		actor?: string | null;
		readiness?: FinalControlledDesignRiskReadinessReport;
		history?: ReturnType<typeof record>[];
	} = {}
) {
	const actor = options.actor === undefined ? 'visual-director' : options.actor;
	const history = options.history ?? [];
	return {
		loadConfig: vi.fn(() => ({
			databaseUrl: 'postgres://unused',
			affinityReviewActor: actor
		})),
		loadReadiness: vi.fn(async () => options.readiness ?? readyReport),
		listDecisions: vi.fn(async () =>
			FinalControlledDesignRiskDecisionListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				scopeId: 'final-controlled-activation-v1',
				records: history,
				latestByActor: history
			})
		),
		createDecision: vi.fn(async (_databaseUrl, request) => ({
			decision: FinalControlledDesignRiskDecisionRecordSchema.parse({
				...request,
				decidedAt: '2026-08-29T23:30:00.000Z'
			}),
			created: true
		})),
		createDecisionId: vi.fn(() => '33333333-3333-4333-8333-333333333333')
	} satisfies FinalControlledDesignRiskReviewDependencies;
}

describe('final-controlled design-risk review service', () => {
	it('returns a blank, actor-filtered surface without preselecting decisions', async () => {
		const own = record('visual-director', '11111111-1111-4111-8111-111111111111');
		const other = record('another-reviewer', '22222222-2222-4222-8222-222222222222');
		const deps = dependencies({ history: [own, other] });
		const surface = await loadFinalControlledDesignRiskReviewSurface({
			workspaceRoot: '/unused',
			dependencies: deps
		});

		expect(surface).toMatchObject({
			status: 'ready',
			ready: true,
			actor: 'visual-director',
			evidenceFingerprint: sha256Json(evidenceBindings)
		});
		expect(surface.history).toEqual([own]);
		expect(surface.risks).toHaveLength(16);
		expect(surface.risks.every((risk) => risk.decision === null)).toBe(true);
		expect(Object.values(surface.attestation).every((value) => value === false)).toBe(true);
		expect(deps.loadReadiness).toHaveBeenCalledWith('visual-director', '/unused');
	});

	it('derives actor, UUID, evidence bindings, and supersession only on the server', async () => {
		const previous = FinalControlledDesignRiskDecisionRecordSchema.parse({
			...record('visual-director', '11111111-1111-4111-8111-111111111111'),
			decisions: decisions.map((decision, index) =>
				index === 8 ? { ...decision, decision: 'retain' as const } : decision
			)
		});
		const deps = dependencies({ history: [previous] });
		await createFinalControlledDesignRiskReview({
			request: clientRequest(),
			workspaceRoot: '/unused',
			dependencies: deps
		});

		expect(deps.createDecision).toHaveBeenCalledWith(
			'postgres://unused',
			expect.objectContaining({
				decisionId: '33333333-3333-4333-8333-333333333333',
				actor: 'visual-director',
				evidenceBindings,
				supersedesDecisionId: previous.decisionId,
				decisions,
				attestation
			})
		);
	});

	it('treats a lost-response retry of the current actor decision as idempotent', async () => {
		const previous = record('visual-director', '11111111-1111-4111-8111-111111111111');
		const deps = dependencies({ history: [previous] });
		const result = await createFinalControlledDesignRiskReview({
			request: clientRequest(),
			workspaceRoot: '/unused',
			dependencies: deps
		});

		expect(result).toEqual({ decision: previous, created: false });
		expect(deps.createDecisionId).not.toHaveBeenCalled();
		expect(deps.createDecision).not.toHaveBeenCalled();
	});

	it('rejects spoofed authority fields and incomplete decision sets', async () => {
		for (const request of [
			clientRequest({ actor: 'spoofed-reviewer' }),
			clientRequest({ decisionId: '11111111-1111-4111-8111-111111111111' }),
			clientRequest({ evidenceBindings }),
			clientRequest({ supersedesDecisionId: null }),
			clientRequest({ decisions: decisions.slice(0, 15) })
		]) {
			const deps = dependencies();
			await expect(
				createFinalControlledDesignRiskReview({
					request,
					workspaceRoot: '/unused',
					dependencies: deps
				})
			).rejects.toMatchObject({ status: 400 });
			expect(deps.loadReadiness).not.toHaveBeenCalled();
			expect(deps.createDecision).not.toHaveBeenCalled();
		}
	});

	it('returns the recomputed current state on a stale evidence fingerprint', async () => {
		const deps = dependencies();
		let failure: unknown;
		try {
			await createFinalControlledDesignRiskReview({
				request: clientRequest({ evidenceFingerprint: '9'.repeat(64) }),
				workspaceRoot: '/unused',
				dependencies: deps
			});
		} catch (error) {
			failure = error;
		}
		expect(failure).toBeInstanceOf(FinalControlledDesignRiskReviewRequestError);
		expect(failure).toMatchObject({
			status: 409,
			currentState: {
				status: 'ready',
				evidenceFingerprint: sha256Json(evidenceBindings)
			}
		});
		expect(deps.createDecision).not.toHaveBeenCalled();
	});

	it('locks GET and POST when the server actor or authoritative evidence is missing', async () => {
		const missingActor = dependencies({
			actor: null,
			readiness: {
				...readyReport,
				status: 'blocked',
				reviewer: null,
				evidenceBindings: null,
				blockers: [{ code: 'reviewer-required', detail: 'Reviewer is required.' }]
			}
		});
		const surface = await loadFinalControlledDesignRiskReviewSurface({
			workspaceRoot: '/unused',
			dependencies: missingActor
		});
		expect(surface).toMatchObject({ status: 'locked', ready: false, actor: null });
		expect(missingActor.listDecisions).not.toHaveBeenCalled();
		await expect(
			createFinalControlledDesignRiskReview({
				request: clientRequest(),
				workspaceRoot: '/unused',
				dependencies: missingActor
			})
		).rejects.toMatchObject({ status: 409, currentState: { status: 'locked' } });
		expect(missingActor.createDecision).not.toHaveBeenCalled();

		const blockedEvidence = dependencies({
			readiness: {
				...readyReport,
				status: 'blocked',
				evidenceBindings: null,
				blockers: [{ code: 'workspace-invalid', detail: 'Workspace is invalid.' }]
			}
		});
		await expect(
			createFinalControlledDesignRiskReview({
				request: clientRequest(),
				workspaceRoot: '/unused',
				dependencies: blockedEvidence
			})
		).rejects.toMatchObject({ status: 409, currentState: { status: 'locked' } });
		expect(blockedEvidence.createDecision).not.toHaveBeenCalled();
	});
});
