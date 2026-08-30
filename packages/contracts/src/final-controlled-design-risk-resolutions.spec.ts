import { describe, expect, it } from 'vitest';

import {
	FinalControlledDesignRisks,
	type FinalControlledDesignRiskHumanDecision
} from './final-controlled-design-risk-decisions.js';
import {
	FinalControlledDesignRiskResolutionLedgerV2Schema,
	FinalControlledDesignRiskStagedTargetPaths,
	FinalControlledEligibleOriginalCandidateTargetIds,
	FinalControlledOriginalReviseResults
} from './final-controlled-design-risk-resolutions.js';

const hash = (character: string) => character.repeat(64);
const hexCharacters = '0123456789abcdef';

function originalTargetId(coordinate: string): string {
	return `affinity-workflow-v1-${coordinate.replace(/-v\d+$/u, '')}`;
}

function humanDecision(index: number): FinalControlledDesignRiskHumanDecision {
	const risk = FinalControlledDesignRisks[index]!;
	return {
		...risk,
		decision: risk.severity === 'blocking' ? 'replace-derived-target' : 'retain',
		humanRationale: `Human resolution for ${risk.riskId}.`
	};
}

function ledger() {
	const reviseResults = FinalControlledOriginalReviseResults.map((result, index) => ({
		...result,
		contentHash: String(index + 1).repeat(64)
	}));
	const evidenceBindings = {
		planCanonicalSha256: hash('b'),
		catalogCanonicalSha256: hash('c'),
		executionSnapshotCanonicalSha256: hash('d'),
		blindReviewCollectionCanonicalSha256: hash('e'),
		sourceAuditCanonicalSha256: hash('f')
	};
	const resolutions = FinalControlledDesignRisks.map((risk, index) => {
		const decision = humanDecision(index);
		const targetId = originalTargetId(risk.coordinate);
		const revise = reviseResults.find((result) => result.targetId === targetId);
		return {
			...decision,
			status: 'resolved',
			blindReviewEvidence: revise
				? []
				: [
						{
							id: `00000000-0000-4000-8${String(index).padStart(3, '0')}-000000000000`,
							targetId,
							candidateContentHash: hash(hexCharacters[index]!),
							contentHash: hash(hexCharacters[15 - index]!)
						}
					],
			reviseResultEvidence: revise ? [revise] : [],
			stagedTarget:
				decision.decision === 'retain'
					? null
					: {
							path: FinalControlledDesignRiskStagedTargetPaths[index],
							canonicalHash: index.toString(16).repeat(64),
							promptHash: ((index + 1) % 16).toString(16).repeat(64),
							promptByteLength: 4_096 + index
						}
		};
	});
	const humanDecisionRecord = {
		decisionId: '11111111-1111-4111-8111-111111111111',
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		mode: 'human-interactive',
		actor: 'visual-director',
		evidenceBindings: { ...evidenceBindings },
		supersedesDecisionId: null,
		decisions: resolutions.map(
			({ riskId, coordinate, sourceTargetId, severity, decision, humanRationale }) => ({
				riskId,
				coordinate,
				sourceTargetId,
				severity,
				decision,
				humanRationale
			})
		),
		attestation: {
			producerDidNotResolveRisks: true,
			reviewedEligibleBlindEvidence: true,
			reviewedCompleteSourceAudit: true,
			deliberatelyResolvedAllRisks: true,
			understandsActivationRequiresIndependentVerification: true
		},
		decidedAt: '2026-08-29T21:00:00.000Z'
	};
	return {
		schemaVersion: 'affinity-final-controlled-design-risk-resolutions-v2',
		experimentId: 'affinity-workflow-v1',
		scopeId: 'final-controlled-activation-v1',
		status: 'resolved',
		resolutionId: '11111111-1111-4111-8111-111111111111',
		actor: 'visual-director',
		decidedAt: '2026-08-29T21:00:00.000Z',
		mode: 'human-interactive-db-export',
		humanDecisionRecord: {
			record: humanDecisionRecord,
			recordCanonicalSha256: hash('a')
		},
		evidenceBindings,
		eligibleOriginalControlledTargetIds: [...FinalControlledEligibleOriginalCandidateTargetIds],
		reviseResults,
		resolutions
	};
}

describe('final-controlled immutable design-risk resolution ledger v2', () => {
	it('accepts one strict DB-exported ledger bound to the exact audited evidence sets', () => {
		const parsed = FinalControlledDesignRiskResolutionLedgerV2Schema.parse(ledger());
		expect(parsed.resolutions).toHaveLength(16);
		expect(parsed.eligibleOriginalControlledTargetIds).toHaveLength(21);
		expect(parsed.reviseResults).toHaveLength(3);
		expect(parsed.resolutions.filter((resolution) => resolution.stagedTarget)).toHaveLength(8);
	});

	it('rejects non-export modes, extra fields, and a resolution ID detached from the DB record', () => {
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse({
				...ledger(),
				mode: 'producer-authored'
			}).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse({
				...ledger(),
				unexpected: true
			}).success
		).toBe(false);
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse({
				...ledger(),
				resolutionId: '22222222-2222-4222-8222-222222222222'
			}).success
		).toBe(false);
	});

	it('requires actor, timestamp, evidence, direction, and rationale to match the DB record', () => {
		const wrongActor = ledger();
		wrongActor.actor = 'another-actor';
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(wrongActor).success).toBe(
			false
		);

		const wrongTime = ledger();
		wrongTime.decidedAt = '2026-08-29T22:00:00.000Z';
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(wrongTime).success).toBe(
			false
		);

		const wrongEvidence = ledger();
		wrongEvidence.evidenceBindings.catalogCanonicalSha256 = hash('0');
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(wrongEvidence).success).toBe(
			false
		);

		const wrongDirection = ledger();
		wrongDirection.resolutions[8]!.decision = 'replace-reference';
		wrongDirection.resolutions[8]!.stagedTarget = {
			path: FinalControlledDesignRiskStagedTargetPaths[8],
			canonicalHash: hash('8'),
			promptHash: hash('9'),
			promptByteLength: 4_200
		};
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(wrongDirection).success
		).toBe(false);

		const wrongRationale = ledger();
		wrongRationale.resolutions[8]!.humanRationale = 'Different human rationale.';
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(wrongRationale).success
		).toBe(false);
	});

	it('rejects missing, duplicated, or reordered immutable candidate and revise sets', () => {
		const missingCandidate = ledger();
		missingCandidate.eligibleOriginalControlledTargetIds.pop();
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(missingCandidate).success
		).toBe(false);

		const reorderedCandidates = ledger();
		[
			reorderedCandidates.eligibleOriginalControlledTargetIds[0],
			reorderedCandidates.eligibleOriginalControlledTargetIds[1]
		] = [
			reorderedCandidates.eligibleOriginalControlledTargetIds[1]!,
			reorderedCandidates.eligibleOriginalControlledTargetIds[0]!
		];
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(reorderedCandidates).success
		).toBe(false);

		const wrongRevise = ledger();
		wrongRevise.reviseResults[1] = { ...wrongRevise.reviseResults[0]! };
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(wrongRevise).success).toBe(
			false
		);
	});

	it('rejects reordered identities, blocking retention, and blank human rationale', () => {
		const reordered = ledger();
		[reordered.resolutions[0], reordered.resolutions[1]] = [
			reordered.resolutions[1]!,
			reordered.resolutions[0]!
		];
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(reordered).success).toBe(
			false
		);

		const retainedBlocker = ledger();
		retainedBlocker.resolutions[0]!.decision = 'retain';
		retainedBlocker.resolutions[0]!.stagedTarget = null;
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(retainedBlocker).success
		).toBe(false);

		const blank = ledger();
		blank.resolutions[8]!.humanRationale = ' ';
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(blank).success).toBe(false);
	});

	it('requires a coordinate-owned stage for every replacement and forbids one for retain', () => {
		const missingStage = ledger();
		missingStage.resolutions[0]!.stagedTarget = null;
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(missingStage).success).toBe(
			false
		);

		const stagedRetain = ledger();
		stagedRetain.resolutions[8]!.stagedTarget = {
			path: FinalControlledDesignRiskStagedTargetPaths[8],
			canonicalHash: hash('1'),
			promptHash: hash('2'),
			promptByteLength: 1024
		};
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(stagedRetain).success).toBe(
			false
		);

		const crossWiredStage = ledger();
		crossWiredStage.resolutions[0]!.stagedTarget!.path =
			FinalControlledDesignRiskStagedTargetPaths[1];
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(crossWiredStage).success
		).toBe(false);

		const unsafeStage = ledger() as unknown as {
			resolutions: Array<{ stagedTarget: { path: string; promptByteLength: number } }>;
		};
		unsafeStage.resolutions[0]!.stagedTarget!.path = '../../outside.json';
		unsafeStage.resolutions[0]!.stagedTarget!.promptByteLength = 0;
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(unsafeStage).success).toBe(
			false
		);
	});

	it('rejects blind or revise evidence borrowed from another coordinate', () => {
		const borrowedBlind = ledger();
		borrowedBlind.resolutions[0]!.blindReviewEvidence = [
			borrowedBlind.resolutions[1]!.blindReviewEvidence[0]!
		];
		expect(FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(borrowedBlind).success).toBe(
			false
		);

		const borrowedRevise = ledger();
		const reviseResolution = borrowedRevise.resolutions.find(
			(resolution) => resolution.reviseResultEvidence.length > 0
		)!;
		reviseResolution.reviseResultEvidence = [borrowedRevise.reviseResults[2]!];
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(borrowedRevise).success
		).toBe(false);

		const duplicateReviewHash = ledger();
		duplicateReviewHash.resolutions[1]!.blindReviewEvidence[0]!.contentHash =
			duplicateReviewHash.resolutions[0]!.blindReviewEvidence[0]!.contentHash;
		expect(
			FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(duplicateReviewHash).success
		).toBe(false);
	});
});
