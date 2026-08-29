import type {
	ImageProductionBlindReview,
	ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import {
	compositeAffinityWorkspaceIsValid,
	buildAffinityPlanCompletionReport,
	buildFinalControlledGateEvidence,
	findFinalControlledCrossCohortIdConflicts,
	type AffinityPlanCompletionEvidence
} from './check-affinity-plan-completion.js';
import type { ValidatedImageProductionExecution } from './sync-affinity-review.js';

const FINAL_HASH = 'b'.repeat(64);

function finalTarget(index: number): ImageProductionTarget {
	const affinity = index < 4 ? 'normal' : 'fire';
	return {
		targetId: `final-controlled-target-${index}`,
		cohort: 'controlled',
		speciesId: 'death-knight',
		affinity,
		affinityDesign: {
			alteredDimensions: affinity === 'normal' ? [] : ['material', 'silhouette']
		}
	} as unknown as ImageProductionTarget;
}

function finalExecution(target: ImageProductionTarget): ValidatedImageProductionExecution {
	const attemptId = `${target.targetId}-attempt-1`;
	return {
		target,
		assignment: {},
		result: {
			status: 'candidate',
			selectedAttemptId: attemptId,
			attempts: [
				{
					attemptId,
					output: { contentHash: FINAL_HASH },
					findings: []
				}
			]
		}
	} as unknown as ValidatedImageProductionExecution;
}

function finalReview(target: ImageProductionTarget): ImageProductionBlindReview {
	return {
		targetId: target.targetId,
		candidateContentHash: FINAL_HASH,
		identifiedSpeciesId: target.speciesId,
		identifiedAffinity: target.affinity,
		verdict: 'candidate',
		reviewMode: 'blind'
	} as unknown as ImageProductionBlindReview;
}

function completeEvidence(): AffinityPlanCompletionEvidence {
	return {
		workspaceValid: true,
		skillAndDryRun: {
			requiredFileCount: 10,
			presentFileCount: 10,
			installedSkillMatchesRepository: true,
			dryRunValidated: true
		},
		controlledFinalRerun: {
			planValidated: true,
			targetManifestCount: 24,
			assignmentCount: 24,
			resultCount: 24,
			candidateImageCount: 24,
			gateSatisfied: true,
			evaluationPassed: true
		},
		humanBlindEvidence: {
			eligibleBlindReviewCount: 24,
			speciesThresholdSatisfied: true,
			affinityThresholdSatisfied: true,
			normalThresholdSatisfied: true,
			meaningfulAcceptanceThresholdSatisfied: true,
			criticalFailureThresholdSatisfied: true
		},
		goblinAudits: { audit60Passed: true, audit600Passed: true },
		breadthAndUnusualAnatomy: {
			targetManifestCount: 24,
			resultCount: 24,
			reviewedResultCount: 24,
			representedSpeciesCount: 4,
			unusualCandidateCount: 1,
			breadthContactSheetPresent: true
		},
		concurrencyLadder: {
			effectiveLevels: [2, 4, 6, 8, 12],
			requiredLevels: [2, 4, 6, 8, 12],
			recommendedSafeConcurrency: 12,
			scaleEndpointEvidenced: true
		},
		forgeEvidence: {
			requiredFileCount: 6,
			presentFileCount: 6,
			labeledProjectionValid: true,
			blindProjectionStripped: true
		},
		acceptedLaterPackRules: {
			artifactPresent: true,
			acceptedArtifactValid: true,
			sourceBlindReviewCount: 24
		},
		scaleRecommendation: {
			artifactPresent: true,
			finalArtifactValid: true,
			sourceEffectiveConcurrencyLevels: [2, 4, 6, 8, 12]
		}
	};
}

describe('affinity image-production plan completion', () => {
	it('marks complete only when every plan-level evidence section is complete', () => {
		const report = buildAffinityPlanCompletionReport(completeEvidence());

		expect(report.status).toBe('complete');
		expect(report.incompleteSections).toEqual([]);
		expect(Object.values(report.sections).every((section) => section.complete)).toBe(true);
	});

	it('does not mistake a planned controlled rerun for completed execution', () => {
		const evidence = completeEvidence();
		const report = buildAffinityPlanCompletionReport({
			...evidence,
			controlledFinalRerun: {
				...evidence.controlledFinalRerun,
				targetManifestCount: 0,
				assignmentCount: 0,
				resultCount: 0,
				candidateImageCount: 0,
				gateSatisfied: false,
				evaluationPassed: false
			}
		});

		expect(report.status).toBe('incomplete');
		expect(report.sections.controlledFinalRerun.complete).toBe(false);
		expect(report.incompleteSections).toContain('controlledFinalRerun');
		expect(report.blockerSummary.human).toContain('controlledFinalRerun');
	});

	it('lets a completed final cohort pass independently of the failed immutable v1 cohort', () => {
		const targets = Array.from({ length: 24 }, (_, index) => finalTarget(index));
		const finalEvidence = buildFinalControlledGateEvidence({
			planValidated: true,
			targets,
			assignmentCount: 24,
			executions: targets.map(finalExecution),
			verifiedImageCount: 24,
			blindReviews: targets.map(finalReview)
		});
		const evidence = completeEvidence();
		const report = buildAffinityPlanCompletionReport({
			...evidence,
			controlledFinalRerun: finalEvidence.controlledFinalRerun,
			humanBlindEvidence: finalEvidence.humanBlindEvidence
		});

		expect(finalEvidence.controlledFinalRerun).toMatchObject({
			gateSatisfied: true,
			evaluationPassed: true
		});
		expect(finalEvidence.humanBlindEvidence).toMatchObject({
			eligibleBlindReviewCount: 24,
			speciesThresholdSatisfied: true,
			affinityThresholdSatisfied: true,
			normalThresholdSatisfied: true,
			meaningfulAcceptanceThresholdSatisfied: true,
			criticalFailureThresholdSatisfied: true
		});
		expect(report.sections.controlledFinalRerun.complete).toBe(true);
		expect(report.sections.humanBlindEvidence.complete).toBe(true);
		expect(report.status).toBe('complete');
	});

	it('accepts scanner orphan notices only for separately validated final paths', () => {
		const finalPath =
			'assets/enemies/experiments/affinity-workflow-v1/targets/final-controlled/death-knight/fire-v4.json';
		const finalOrphan = {
			kind: 'orphan-artifact' as const,
			path: finalPath,
			targetId: 'final-death-knight-fire-v4',
			message: 'Unexpected target manifest.'
		};

		expect(
			compositeAffinityWorkspaceIsValid({
				baseProjectionValidated: true,
				scanIssues: [finalOrphan],
				finalPlannedPaths: new Set([finalPath]),
				finalValidationIssues: []
			})
		).toBe(true);
		expect(
			compositeAffinityWorkspaceIsValid({
				baseProjectionValidated: true,
				scanIssues: [{ ...finalOrphan, kind: 'provenance-mismatch' }],
				finalPlannedPaths: new Set([finalPath]),
				finalValidationIssues: []
			})
		).toBe(false);
		expect(
			compositeAffinityWorkspaceIsValid({
				baseProjectionValidated: true,
				scanIssues: [finalOrphan],
				finalPlannedPaths: new Set([finalPath]),
				finalValidationIssues: ['hash mismatch']
			})
		).toBe(false);
	});

	it('detects target, assignment, and result IDs reused from immutable base evidence', () => {
		expect(
			findFinalControlledCrossCohortIdConflicts({
				baseTargetIds: ['base-target', 'shared-target'],
				baseAssignmentIds: ['base-assignment', 'shared-assignment'],
				baseResultIds: ['base-result', 'shared-result'],
				finalTargetIds: ['final-target', 'shared-target'],
				finalAssignmentIds: ['final-assignment', 'shared-assignment'],
				finalResultIds: ['final-result', 'shared-result']
			})
		).toEqual(['assignment:shared-assignment', 'result:shared-result', 'target:shared-target']);
	});

	it('requires measured ladder levels even when a lower capacity endpoint is recorded', () => {
		const evidence = completeEvidence();
		const report = buildAffinityPlanCompletionReport({
			...evidence,
			concurrencyLadder: {
				...evidence.concurrencyLadder,
				effectiveLevels: [2, 3],
				recommendedSafeConcurrency: 3,
				scaleEndpointEvidenced: true
			}
		});

		expect(report.sections.concurrencyLadder.complete).toBe(false);
		expect(report.blockerSummary.capacity).toContain('concurrencyLadder');
	});

	it('rejects provisional rules and recommendations without accepted final artifacts', () => {
		const evidence = completeEvidence();
		const report = buildAffinityPlanCompletionReport({
			...evidence,
			acceptedLaterPackRules: {
				artifactPresent: true,
				acceptedArtifactValid: false,
				sourceBlindReviewCount: 24
			},
			scaleRecommendation: {
				artifactPresent: true,
				finalArtifactValid: false,
				sourceEffectiveConcurrencyLevels: [2, 4, 6, 8, 12]
			}
		});

		expect(report.sections.acceptedLaterPackRules.complete).toBe(false);
		expect(report.sections.scaleRecommendation.complete).toBe(false);
		expect(report.status).toBe('incomplete');
	});

	it('keeps invalid workspace evidence from producing a complete status', () => {
		const report = buildAffinityPlanCompletionReport({
			...completeEvidence(),
			workspaceValid: false
		});

		expect(report.status).toBe('incomplete');
		expect(report.incompleteSections).toEqual([]);
		expect(report.workspaceValid).toBe(false);
	});
});
