import { FinalControlledDesignRisks } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	buildFinalControlledDesignRiskSubmission,
	createEmptyFinalControlledDesignRiskDrafts,
	EmptyFinalControlledDesignRiskAttestations,
	isFinalControlledDesignRiskFormComplete,
	type FinalControlledDesignRiskAttestations
} from './final-controlled-design-risk-review';

function completedDrafts() {
	const drafts = createEmptyFinalControlledDesignRiskDrafts(FinalControlledDesignRisks);
	for (const risk of FinalControlledDesignRisks) {
		drafts[risk.riskId] = {
			decision: risk.severity === 'blocking' ? 'replace-derived-target' : 'retain',
			humanRationale: `Human rationale for ${risk.coordinate}`
		};
	}
	return drafts;
}

const completeAttestations: FinalControlledDesignRiskAttestations = {
	producerDidNotResolveRisks: true,
	reviewedEligibleBlindEvidence: true,
	reviewedCompleteSourceAudit: true,
	deliberatelyResolvedAllRisks: true,
	understandsActivationRequiresIndependentVerification: true
};

describe('final controlled design-risk review form', () => {
	it('starts every one of the exact 16 risks without a selected decision or rationale', () => {
		const drafts = createEmptyFinalControlledDesignRiskDrafts(FinalControlledDesignRisks);

		expect(Object.keys(drafts)).toEqual(FinalControlledDesignRisks.map((risk) => risk.riskId));
		expect(Object.values(drafts)).toHaveLength(16);
		expect(Object.values(drafts).every((draft) => draft.decision === '')).toBe(true);
		expect(Object.values(drafts).every((draft) => draft.humanRationale === '')).toBe(true);
	});

	it('requires all decisions, rationales, and five attestations', () => {
		const drafts = completedDrafts();

		expect(
			isFinalControlledDesignRiskFormComplete(
				FinalControlledDesignRisks,
				drafts,
				EmptyFinalControlledDesignRiskAttestations
			)
		).toBe(false);
		expect(
			isFinalControlledDesignRiskFormComplete(
				FinalControlledDesignRisks,
				drafts,
				completeAttestations
			)
		).toBe(true);

		drafts[FinalControlledDesignRisks[15].riskId]!.humanRationale = '   ';
		expect(
			isFinalControlledDesignRiskFormComplete(
				FinalControlledDesignRisks,
				drafts,
				completeAttestations
			)
		).toBe(false);
	});

	it('rejects retain for a blocking risk even if a caller bypasses the disabled control', () => {
		const drafts = completedDrafts();
		drafts[FinalControlledDesignRisks[0].riskId]!.decision = 'retain';

		expect(
			isFinalControlledDesignRiskFormComplete(
				FinalControlledDesignRisks,
				drafts,
				completeAttestations
			)
		).toBe(false);
		expect(
			buildFinalControlledDesignRiskSubmission(
				'f'.repeat(64),
				FinalControlledDesignRisks,
				drafts,
				completeAttestations
			)
		).toBeNull();
	});

	it('builds only the server-safe transport and preserves exact plan order', () => {
		const drafts = completedDrafts();
		drafts[FinalControlledDesignRisks[8].riskId]!.humanRationale = '  Framing is acceptable.  ';

		const submission = buildFinalControlledDesignRiskSubmission(
			'f'.repeat(64),
			FinalControlledDesignRisks,
			drafts,
			completeAttestations
		);

		expect(submission?.decisions.map((decision) => decision.riskId)).toEqual(
			FinalControlledDesignRisks.map((risk) => risk.riskId)
		);
		expect(submission?.decisions[8]?.humanRationale).toBe('Framing is acceptable.');
		expect(submission?.attestation).toEqual(completeAttestations);
		expect(submission).not.toHaveProperty('actor');
		expect(submission).not.toHaveProperty('decisionId');
		expect(submission).not.toHaveProperty('evidenceBindings');
	});

	it('refuses submission without a current evidence fingerprint', () => {
		expect(
			buildFinalControlledDesignRiskSubmission(
				null,
				FinalControlledDesignRisks,
				completedDrafts(),
				completeAttestations
			)
		).toBeNull();
	});
});
