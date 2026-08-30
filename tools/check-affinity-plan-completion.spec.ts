import type {
	ImageProductionBlindReview,
	ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import {
	compositeAffinityWorkspaceIsValid,
	buildAffinityPlanCompletionReport,
	buildFinalControlledGateEvidence,
	finalControlledReceiptFailureInvalidatesWorkspace,
	findFinalControlledCrossCohortIdConflicts,
	roundFinalEvaluationMatchesCanonicalDerivation,
	validateSchedulerRunEligibility,
	type AffinityPlanCompletionEvidence
} from './check-affinity-plan-completion.js';
import { AffinityRoundFinalEvaluationSchema } from './finalize-affinity-round-evaluation.js';
import { AffinityScaleRecommendationV3Schema as ScaleRecommendationSchema } from './finalize-affinity-scale-recommendation.js';
import { canonicalJsonSha256 } from './affinity-wave-scheduler-lib.js';
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
			activationReceiptValid: true,
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
			legacyEffectiveLevels: [2],
			schedulerEffectiveLevels: [2, 4, 6, 8, 12],
			eligibleSchedulerRuns: [],
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
			sourceEffectiveConcurrencyLevels: [2, 4, 6, 8, 12],
			sourceBindingsValid: true,
			matchesEligibleSchedulerLevels: true
		}
	};
}

describe('affinity image-production plan completion', () => {
	it('rejects stored round counters that differ from the canonical derivation', () => {
		const canonical = AffinityRoundFinalEvaluationSchema.parse({
			schemaVersion: 'affinity-review-round-final-evaluation-v1',
			experimentId: 'affinity-workflow-v1',
			roundId: 'breadth-v1',
			status: 'passed',
			finalizedAt: '2026-08-29T22:00:00.000Z',
			integrationReceiptCanonicalSha256: 'a'.repeat(64),
			blindReviewCanonicalSha256: 'b'.repeat(64),
			criteria: {
				reviewCount: 24,
				firstAttemptCandidateCount: 20,
				speciesCorrectCount: 23,
				affinityCorrectCount: 20,
				normalUnaffiliatedCount: 4,
				acceptedMeaningfulAffinityCount: 20,
				acceptedCriticalVisualFailureCount: 0,
				representedSpeciesCount: 4,
				acceptedUnusualAnatomyCount: 1,
				workflowViolationCount: 0
			}
		});
		const derivation = { eligible: true, blockers: [], evaluation: canonical } as const;
		expect(roundFinalEvaluationMatchesCanonicalDerivation(canonical, derivation)).toBe(true);
		const forgedUnusualCount = AffinityRoundFinalEvaluationSchema.parse({
			...canonical,
			criteria: { ...canonical.criteria, acceptedUnusualAnatomyCount: 2 }
		});
		expect(roundFinalEvaluationMatchesCanonicalDerivation(forgedUnusualCount, derivation)).toBe(
			false
		);
		expect(
			AffinityRoundFinalEvaluationSchema.safeParse({
				...canonical,
				criteria: { ...canonical.criteria, representedSpeciesCount: 5 }
			}).success
		).toBe(false);
	});

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
			activationReceiptValid: true,
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

	it('distinguishes a pristine pre-activation workspace from receipt-less activation artifacts', () => {
		expect(
			finalControlledReceiptFailureInvalidatesWorkspace({
				receiptPresent: false,
				plannedArtifactCount: 0
			})
		).toBe(false);
		expect(
			finalControlledReceiptFailureInvalidatesWorkspace({
				receiptPresent: false,
				plannedArtifactCount: 1
			})
		).toBe(true);
		expect(
			finalControlledReceiptFailureInvalidatesWorkspace({
				receiptPresent: true,
				plannedArtifactCount: 0
			})
		).toBe(true);
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

	it('accepts only exact, completed, gate-bound scheduler reports without workflow failures', () => {
		const preflight = {
			schemaVersion: 'affinity-wave-preflight-v1',
			runId: 'canary-eligible',
			experimentId: 'affinity-workflow-v1',
			stage: 'canary',
			createdAt: '2026-08-29T20:00:00.000Z',
			status: 'ready',
			requestedConcurrency: 2,
			availableAgentSlots: 3,
			reservedOrchestratorSlots: 1,
			admittedWorkerCapacity: 2,
			exactConcurrencyReady: true,
			runDirectory: 'assets/enemies/experiments/affinity-workflow-v1/wave-runs/canary-eligible',
			stopRules: {
				capacityFailureLimit: 3,
				stopOnOutputCollision: true,
				retryCapacityFailuresInWave: false
			},
			dispatchGateSatisfied: true,
			dispatchGateEvidence: {
				status: 'satisfied',
				artifactPath: 'assets/enemies/experiments/affinity-workflow-v1/review/gates/canary.json',
				expectedCanonicalSha256: 'a'.repeat(64),
				observedCanonicalSha256: 'a'.repeat(64),
				gate: {
					schemaVersion: 'affinity-wave-dispatch-gate-v2',
					gateId: 'canary-gate',
					experimentId: 'affinity-workflow-v1',
					status: 'authorized',
					authorizedStage: 'canary',
					qualityGateSatisfied: true,
					humanGateSatisfied: false,
					prerequisiteRunIds: [],
					derivation: { profile: 'normal-canary' },
					evidenceBindings: [
						{
							path: 'assets/enemies/experiments/affinity-workflow-v1/review/evaluation.json',
							canonicalSha256: 'b'.repeat(64)
						}
					]
				},
				evidenceChecks: [
					{
						path: 'assets/enemies/experiments/affinity-workflow-v1/review/evaluation.json',
						expectedCanonicalSha256: 'b'.repeat(64),
						observedCanonicalSha256: 'b'.repeat(64),
						status: 'verified'
					}
				]
			},
			collisionPaths: [],
			jobs: [
				{
					targetId: 'eligible-target',
					assignmentId: 'eligible-assignment',
					speciesId: 'death-knight',
					affinity: 'normal',
					targetPath: 'assets/enemies/experiments/affinity-workflow-v1/targets/test.json',
					assignmentPath: 'assets/enemies/experiments/affinity-workflow-v1/assignments/test.json',
					candidatePath: 'assets/enemies/experiments/affinity-workflow-v1/candidates/test.png',
					resultPath: 'assets/enemies/experiments/affinity-workflow-v1/results/test.json'
				},
				{
					targetId: 'eligible-target-two',
					assignmentId: 'eligible-assignment-two',
					speciesId: 'death-knight',
					affinity: 'fire',
					targetPath: 'assets/enemies/experiments/affinity-workflow-v1/targets/test-two.json',
					assignmentPath:
						'assets/enemies/experiments/affinity-workflow-v1/assignments/test-two.json',
					candidatePath: 'assets/enemies/experiments/affinity-workflow-v1/candidates/test-two.png',
					resultPath: 'assets/enemies/experiments/affinity-workflow-v1/results/test-two.json'
				}
			]
		};
		const stageMetrics = {
			stage: 'canary',
			plannedParallelJobs: 2,
			effectiveParallelJobs: 2,
			targetCount: 2,
			candidateCount: 2,
			reviseCount: 0,
			failedCount: 0,
			throttleCount: 0,
			timeoutCount: 0,
			retryCount: 0,
			generationMedianMs: 10,
			generationP90Ms: null,
			generationP95Ms: null,
			slowestCompletionMs: 20,
			waveWallTimeMs: 20,
			summedJobTimeMs: 30,
			effectiveSpeedup: 1.5,
			parallelEfficiency: 0.75,
			queueDelayMs: null,
			visualCandidateRate: 1,
			provenanceCompletenessRate: 1,
			missingResultCount: 0,
			duplicateIdCount: 0,
			pathConflictCount: 0,
			integrationErrorCount: 0
		};
		const report = {
			schemaVersion: 'affinity-wave-report-v2',
			runId: 'canary-eligible',
			experimentId: 'affinity-workflow-v1',
			stage: 'canary',
			generatedAt: '2026-08-29T20:00:03.000Z',
			status: 'completed',
			requestedConcurrency: 2,
			admittedWorkerCapacity: 2,
			effectiveConcurrency: 2,
			workerCount: 2,
			startedAt: '2026-08-29T20:00:01.000Z',
			completedAt: '2026-08-29T20:00:02.000Z',
			waveWallTimeMs: 1_000,
			targetCount: 2,
			dispatchedCount: 2,
			terminalCount: 2,
			unlaunchedCount: 0,
			candidateCount: 2,
			reviseCount: 0,
			failedCount: 0,
			capacityFailureCount: 0,
			providerThrottleCount: 0,
			timeoutCount: 0,
			malformedOutputCount: 0,
			retryCount: 0,
			retriedTargetCount: 0,
			retryRate: 0,
			generationMedianMs: 10,
			generationP90Ms: null,
			generationP95Ms: null,
			slowestCompletionMs: 20,
			summedJobTimeMs: 30,
			effectiveSpeedup: 1.5,
			parallelEfficiency: 0.75,
			provenanceCompletenessRate: 1,
			stopRule: { capacityFailureLimit: 3, triggered: false, triggeredAt: null },
			sourceEvidence: {
				preflight: {
					path: `${preflight.runDirectory}/preflight.json`,
					canonicalSha256: canonicalJsonSha256(preflight)
				},
				events: [],
				results: preflight.jobs.map((job) => ({
					targetId: job.targetId,
					path: job.resultPath,
					canonicalSha256: 'c'.repeat(64),
					candidatePath: job.candidatePath,
					candidateByteSha256: 'd'.repeat(64)
				}))
			},
			stageMetrics
		};

		expect(validateSchedulerRunEligibility(preflight, report)).toEqual({
			eligible: true,
			reasons: []
		});
		const legacyGatePreflight = {
			...preflight,
			dispatchGateEvidence: {
				...preflight.dispatchGateEvidence,
				gate: {
					schemaVersion: 'affinity-wave-dispatch-gate-v1',
					gateId: preflight.dispatchGateEvidence.gate.gateId,
					experimentId: preflight.dispatchGateEvidence.gate.experimentId,
					status: preflight.dispatchGateEvidence.gate.status,
					authorizedStage: preflight.dispatchGateEvidence.gate.authorizedStage,
					qualityGateSatisfied: preflight.dispatchGateEvidence.gate.qualityGateSatisfied,
					humanGateSatisfied: preflight.dispatchGateEvidence.gate.humanGateSatisfied,
					prerequisiteRunIds: preflight.dispatchGateEvidence.gate.prerequisiteRunIds,
					evidencePaths: preflight.dispatchGateEvidence.gate.evidenceBindings.map(
						(binding) => binding.path
					)
				},
				evidenceChecks: undefined
			}
		};
		expect(validateSchedulerRunEligibility(legacyGatePreflight, report)).toMatchObject({
			eligible: false,
			reasons: expect.arrayContaining(['invalid-preflight'])
		});
		expect(
			validateSchedulerRunEligibility(preflight, { ...report, effectiveConcurrency: 1 })
		).toMatchObject({
			eligible: false,
			reasons: expect.arrayContaining(['requested-effective-concurrency-mismatch'])
		});
		expect(
			validateSchedulerRunEligibility(preflight, {
				...report,
				failedCount: 1,
				candidateCount: 1,
				stageMetrics: { ...stageMetrics, failedCount: 1, candidateCount: 1 }
			})
		).toMatchObject({ eligible: false });
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
				sourceEffectiveConcurrencyLevels: [2, 4, 6, 8, 12],
				sourceBindingsValid: false,
				matchesEligibleSchedulerLevels: false
			}
		});

		expect(report.sections.acceptedLaterPackRules.complete).toBe(false);
		expect(report.sections.scaleRecommendation.complete).toBe(false);
		expect(report.status).toBe('incomplete');
	});

	it('rejects claim-only scale recommendations without hash-bound scheduler sources', () => {
		expect(
			ScaleRecommendationSchema.safeParse({
				schemaVersion: 'affinity-scale-recommendation-v1',
				experimentId: 'affinity-workflow-v1',
				status: 'final',
				recommendedSafeConcurrency: 12,
				sourceEffectiveConcurrencyLevels: [2, 4, 6, 8, 12],
				productionStrategy: 'Claimed without run evidence.',
				fallbackBehavior: 'Claimed fallback.'
			}).success
		).toBe(false);
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
