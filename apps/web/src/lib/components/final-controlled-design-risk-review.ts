import type {
	FinalControlledDesignRiskDecisionRecord,
	FinalControlledDesignRiskHumanDecision
} from '@summonlab/contracts';

export type FinalControlledDesignRisk = Pick<
	FinalControlledDesignRiskHumanDecision,
	'riskId' | 'coordinate' | 'sourceTargetId' | 'severity'
>;
export type FinalControlledDesignRiskDecision =
	'' | 'replace-derived-target' | 'replace-reference' | 'retain';

export interface FinalControlledDesignRiskDraft {
	decision: FinalControlledDesignRiskDecision;
	humanRationale: string;
}

export type FinalControlledDesignRiskDrafts = Record<string, FinalControlledDesignRiskDraft>;

export interface FinalControlledDesignRiskAttestations {
	producerDidNotResolveRisks: boolean;
	reviewedEligibleBlindEvidence: boolean;
	reviewedCompleteSourceAudit: boolean;
	deliberatelyResolvedAllRisks: boolean;
	understandsActivationRequiresIndependentVerification: boolean;
}

export interface FinalControlledDesignRiskSubmission {
	evidenceFingerprint: string;
	decisions: Array<{
		riskId: FinalControlledDesignRisk['riskId'];
		coordinate: FinalControlledDesignRisk['coordinate'];
		sourceTargetId: FinalControlledDesignRisk['sourceTargetId'];
		severity: FinalControlledDesignRisk['severity'];
		decision: Exclude<FinalControlledDesignRiskDecision, ''>;
		humanRationale: string;
	}>;
	attestation: {
		producerDidNotResolveRisks: true;
		reviewedEligibleBlindEvidence: true;
		reviewedCompleteSourceAudit: true;
		deliberatelyResolvedAllRisks: true;
		understandsActivationRequiresIndependentVerification: true;
	};
}

export interface FinalControlledDesignRiskBlocker {
	code: string;
	detail: string;
}

export interface FinalControlledDesignRiskReviewProps {
	ready: boolean;
	evidenceFingerprint: string | null;
	actionEndpoint: string;
	actor: string | null;
	risks: readonly FinalControlledDesignRisk[];
	blockers?: readonly FinalControlledDesignRiskBlocker[];
	history?: readonly FinalControlledDesignRiskDecisionRecord[];
	onRefresh?: () => void | Promise<void>;
}

export const EmptyFinalControlledDesignRiskAttestations: FinalControlledDesignRiskAttestations = {
	producerDidNotResolveRisks: false,
	reviewedEligibleBlindEvidence: false,
	reviewedCompleteSourceAudit: false,
	deliberatelyResolvedAllRisks: false,
	understandsActivationRequiresIndependentVerification: false
};

export function createEmptyFinalControlledDesignRiskDrafts(
	risks: readonly FinalControlledDesignRisk[]
): FinalControlledDesignRiskDrafts {
	return Object.fromEntries(
		risks.map((risk) => [risk.riskId, { decision: '', humanRationale: '' }])
	);
}

export function isFinalControlledDesignRiskFormComplete(
	risks: readonly FinalControlledDesignRisk[],
	drafts: FinalControlledDesignRiskDrafts,
	attestations: FinalControlledDesignRiskAttestations
): boolean {
	return (
		risks.length === 16 &&
		risks.every((risk) => {
			const draft = drafts[risk.riskId];
			return (
				Boolean(draft?.humanRationale.trim()) &&
				draft?.decision !== '' &&
				!(risk.severity === 'blocking' && draft?.decision === 'retain')
			);
		}) &&
		Object.values(attestations).every(Boolean)
	);
}

export function buildFinalControlledDesignRiskSubmission(
	evidenceFingerprint: string | null,
	risks: readonly FinalControlledDesignRisk[],
	drafts: FinalControlledDesignRiskDrafts,
	attestations: FinalControlledDesignRiskAttestations
): FinalControlledDesignRiskSubmission | null {
	if (
		!evidenceFingerprint ||
		!isFinalControlledDesignRiskFormComplete(risks, drafts, attestations)
	) {
		return null;
	}

	return {
		evidenceFingerprint,
		decisions: risks.map((risk) => {
			const draft = drafts[risk.riskId]!;
			return {
				...risk,
				decision: draft.decision as Exclude<FinalControlledDesignRiskDecision, ''>,
				humanRationale: draft.humanRationale.trim()
			};
		}),
		attestation: {
			producerDidNotResolveRisks: true,
			reviewedEligibleBlindEvidence: true,
			reviewedCompleteSourceAudit: true,
			deliberatelyResolvedAllRisks: true,
			understandsActivationRequiresIndependentVerification: true
		}
	};
}

export function readableDesignRiskLabel(value: string): string {
	return value
		.replace(/-v\d+$/u, '')
		.split('-')
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(' ');
}
