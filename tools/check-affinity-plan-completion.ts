import { createHash } from 'node:crypto';
import {
	copyFile,
	mkdir,
	mkdtemp,
	readFile,
	readdir,
	realpath,
	rm,
	stat,
	symlink
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskResolutionLedgerV2Schema,
	ImageProductionAssignmentSchema,
	ImageProductionConcurrencyStageSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionBlindReview,
	type ImageProductionOutput,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { getConfig } from '../packages/config/src/index.js';
import { listFinalControlledDesignRiskDecisions } from '../packages/database/src/index.js';
import { z } from 'zod';

import { loadAffinityReviewData } from '../apps/web/src/routes/forge/enemies/affinity-workflow/affinity-review.js';
import {
	AFFINITY_EXPERIMENT_ROOT,
	createAffinityWorkflowExportBundle,
	sha256Json
} from './image-production-lib.js';
import {
	loadRoundBlindReviews,
	loadVerifiedAffinityReviewRound
} from './affinity-round-postgeneration-lib.js';
import { affinityRoundRoot } from './affinity-review-round-lib.js';
import { exportAffinityRoundContactSheet } from './export-affinity-round-contact-sheet.js';
import {
	deriveAffinityRoundFinalEvaluation,
	AffinityRoundFinalEvaluationReceiptSchema,
	AffinityRoundFinalEvaluationSchema,
	type RoundFinalizationDerivation
} from './finalize-affinity-round-evaluation.js';
import {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	FinalControlledActivationReceiptSchema,
	verifyFinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';
import { ACCEPTED_LATER_PACK_RULES_PATH } from './report-later-pack-visual-rules-readiness.js';
import { buildAffinityGateReadiness } from './report-affinity-gate-readiness.js';
import {
	AffinityWavePreflightSchema,
	AffinityWaveReportSchema,
	buildWaveReport,
	canonicalJsonSha256,
	dispatchGateEvidenceAuthorizes,
	readWaveEvents,
	type AffinityWavePreflight,
	type AffinityWaveReport
} from './affinity-wave-scheduler-lib.js';
import {
	scanAffinityReviewWorkspace,
	type AffinityReviewSyncIssue,
	type ValidatedImageProductionExecution
} from './sync-affinity-review.js';
import {
	canonicalGoblinAuditMatches,
	validateAffinityWorkflowWorkspace
} from './validate-affinity-workflow.js';
import { validateAffinityClientBundlePrivacy } from './validate-affinity-client-bundle-privacy.js';
import { verifyAcceptedLaterPackRulesForCompletion } from './verify-accepted-later-pack-rules-completion.js';
import sharp from 'sharp';

const REQUIRED_CONCURRENCY_LEVELS = [2, 4, 6, 8, 12] as const;
const REQUIRED_SKILL_FILES = [
	'SKILL.md',
	'agents/openai.yaml',
	'references/affinity-grammar.md',
	'references/result-schema.md',
	'references/review-rubric.md',
	'references/species-grammar.md',
	'references/target-schema.md',
	'scripts/render_prompt.py',
	'scripts/validate_target.py',
	'scripts/verify_result.py'
] as const;
const REQUIRED_FORGE_FILES = [
	'apps/web/src/lib/components/FinalControlledDesignRiskReview.svelte',
	'apps/web/src/lib/components/final-controlled-design-risk-review.ts',
	'apps/web/src/lib/components/final-controlled-design-risk-review.spec.ts',
	'apps/web/src/lib/server/final-controlled-design-risk-review.ts',
	'apps/web/src/lib/server/final-controlled-design-risk-review.spec.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow/+page.server.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow/+page.svelte',
	'apps/web/src/routes/forge/enemies/affinity-workflow/affinity-review.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow/affinity-review.spec.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow.e2e.ts',
	'apps/web/src/routes/api/dev/affinity-reviews/+server.ts',
	'apps/web/src/lib/server/later-pack-rule-review.ts',
	'apps/web/src/lib/server/later-pack-rule-review.spec.ts',
	'apps/web/src/routes/api/dev/later-pack-rule-decisions/+server.ts',
	'apps/web/src/routes/api/dev/later-pack-rule-decisions/server.spec.ts',
	'apps/web/src/routes/api/dev/final-controlled-design-risk-decisions/+server.ts',
	'apps/web/src/routes/api/dev/final-controlled-design-risk-decisions/server.spec.ts',
	'tools/validate-affinity-client-bundle-privacy.ts',
	'tools/validate-affinity-client-bundle-privacy.spec.ts'
] as const;
const SCALE_RECOMMENDATION_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/scale-recommendation.json` as const;
const FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-design-risk-resolutions.json` as const;

const FinalControlledRerunPlanSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-rerun-plan-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		targets: z
			.array(
				z
					.object({
						key: z.string().min(1),
						speciesId: z.string().min(1),
						affinity: z.string().min(1),
						version: z.string().min(1)
					})
					.passthrough()
			)
			.length(24),
		plannedPathTemplates: z
			.object({
				target: z.string().min(1),
				assignment: z.string().min(1),
				candidate: z.string().min(1),
				result: z.string().min(1)
			})
			.strict()
	})
	.passthrough();

export interface EligibleSchedulerRun {
	readonly runId: string;
	readonly stage: AffinityWaveReport['stage'];
	readonly effectiveConcurrency: number;
	readonly preflightPath: string;
	readonly preflightCanonicalSha256: string;
	readonly reportPath: string;
	readonly reportCanonicalSha256: string;
}

export type AffinityPlanCompletionSectionId =
	| 'skillAndDryRun'
	| 'controlledFinalRerun'
	| 'humanBlindEvidence'
	| 'goblinAudits'
	| 'breadthAndUnusualAnatomy'
	| 'concurrencyLadder'
	| 'forgeEvidence'
	| 'acceptedLaterPackRules'
	| 'scaleRecommendation';

export type AffinityPlanBlockerClass = 'implementable' | 'human' | 'capacity' | 'gated';

export interface AffinityPlanCompletionEvidence {
	readonly workspaceValid: boolean;
	readonly skillAndDryRun: {
		readonly requiredFileCount: number;
		readonly presentFileCount: number;
		readonly installedSkillMatchesRepository: boolean;
		readonly dryRunValidated: boolean;
	};
	readonly controlledFinalRerun: {
		readonly planValidated: boolean;
		readonly activationReceiptValid: boolean;
		readonly designRiskLedgerV2Valid: boolean;
		readonly embeddedHumanDecisionHashValid: boolean;
		readonly humanDecisionDatabaseAuthentic: boolean;
		readonly activationReceiptLedgerBindingValid: boolean;
		readonly stagedCorrectionCount: number;
		readonly stagedCorrectionsValid: boolean;
		readonly targetManifestCount: number;
		readonly assignmentCount: number;
		readonly resultCount: number;
		readonly candidateImageCount: number;
		readonly gateSatisfied: boolean;
		readonly evaluationPassed: boolean;
	};
	readonly humanBlindEvidence: {
		readonly eligibleBlindReviewCount: number;
		readonly speciesThresholdSatisfied: boolean;
		readonly affinityThresholdSatisfied: boolean;
		readonly normalThresholdSatisfied: boolean;
		readonly meaningfulAcceptanceThresholdSatisfied: boolean;
		readonly criticalFailureThresholdSatisfied: boolean;
	};
	readonly goblinAudits: {
		readonly audit60Passed: boolean;
		readonly audit600Passed: boolean;
	};
	readonly breadthAndUnusualAnatomy: {
		readonly targetManifestCount: number;
		readonly resultCount: number;
		readonly reviewedResultCount: number;
		readonly representedSpeciesCount: number;
		readonly unusualCandidateCount: number;
		readonly breadthContactSheetPresent: boolean;
	};
	readonly concurrencyLadder: {
		readonly effectiveLevels: readonly number[];
		readonly legacyEffectiveLevels: readonly number[];
		readonly schedulerEffectiveLevels: readonly number[];
		readonly eligibleSchedulerRuns: readonly EligibleSchedulerRun[];
		readonly requiredLevels: readonly number[];
		readonly recommendedSafeConcurrency: number | null;
		readonly scaleEndpointEvidenced: boolean;
	};
	readonly forgeEvidence: {
		readonly requiredFileCount: number;
		readonly presentFileCount: number;
		readonly labeledProjectionValid: boolean;
		readonly blindProjectionStripped: boolean;
		readonly clientBundlePrivacyValid: boolean;
	};
	readonly acceptedLaterPackRules: {
		readonly artifactPresent: boolean;
		readonly acceptedArtifactValid: boolean;
		readonly sourceBlindReviewCount: number;
	};
	readonly scaleRecommendation: {
		readonly artifactPresent: boolean;
		readonly finalArtifactValid: boolean;
		readonly sourceEffectiveConcurrencyLevels: readonly number[];
		readonly sourceBindingsValid: boolean;
		readonly matchesEligibleSchedulerLevels: boolean;
	};
}

export interface AffinityPlanCompletionSection {
	readonly complete: boolean;
	readonly evidence: Readonly<Record<string, unknown>>;
	readonly blockers: readonly string[];
	readonly blockerClasses: readonly AffinityPlanBlockerClass[];
}

export interface AffinityPlanCompletionReport {
	readonly schemaVersion: 'affinity-image-production-plan-completion-v1';
	readonly experimentId: 'affinity-workflow-v1';
	readonly planPath: 'docs/image-production-skill-and-affinity-test-plan.md';
	readonly status: 'complete' | 'incomplete';
	readonly workspaceValid: boolean;
	readonly sections: Readonly<
		Record<AffinityPlanCompletionSectionId, AffinityPlanCompletionSection>
	>;
	readonly incompleteSections: readonly AffinityPlanCompletionSectionId[];
	readonly blockerSummary: Readonly<Record<AffinityPlanBlockerClass, readonly string[]>>;
}

export interface FinalControlledGateEvidenceInput {
	readonly planValidated: boolean;
	readonly activationReceiptValid: boolean;
	readonly designRiskLifecycle?: FinalControlledDesignRiskLifecycleEvidence;
	readonly targets: readonly ImageProductionTarget[];
	readonly assignmentCount: number;
	readonly executions: readonly ValidatedImageProductionExecution[];
	readonly verifiedImageCount: number;
	readonly blindReviews: readonly ImageProductionBlindReview[];
	readonly validationIssues?: readonly string[];
}

export interface FinalControlledGateEvidence {
	readonly controlledFinalRerun: AffinityPlanCompletionEvidence['controlledFinalRerun'];
	readonly humanBlindEvidence: AffinityPlanCompletionEvidence['humanBlindEvidence'];
}

export interface FinalControlledDesignRiskLifecycleInput {
	readonly plan: z.infer<typeof FinalControlledRerunPlanSchema>;
	readonly ledger: unknown;
	readonly activationReceipt: unknown;
	readonly stagedTargetCanonicalHashes: Readonly<Record<string, string>>;
	readonly decisionDatabaseAvailable: boolean;
	readonly decisionList: unknown;
	readonly authoritativeActor: string | null;
}

export interface FinalControlledDesignRiskLifecycleEvidence {
	readonly designRiskLedgerV2Valid: boolean;
	readonly embeddedHumanDecisionHashValid: boolean;
	readonly humanDecisionDatabaseAuthentic: boolean;
	readonly activationReceiptLedgerBindingValid: boolean;
	readonly stagedCorrectionCount: number;
	readonly stagedCorrectionsValid: boolean;
	readonly issues: readonly string[];
}

export interface CrossCohortIdSets {
	readonly baseTargetIds: readonly string[];
	readonly baseAssignmentIds: readonly string[];
	readonly baseResultIds: readonly string[];
	readonly finalTargetIds: readonly string[];
	readonly finalAssignmentIds: readonly string[];
	readonly finalResultIds: readonly string[];
}

/** Report every final ID that collides with immutable base evidence, grouped by identity kind. */
export function findFinalControlledCrossCohortIdConflicts(input: CrossCohortIdSets): string[] {
	const conflicts: string[] = [];
	for (const [label, baseValues, finalValues] of [
		['target', input.baseTargetIds, input.finalTargetIds],
		['assignment', input.baseAssignmentIds, input.finalAssignmentIds],
		['result', input.baseResultIds, input.finalResultIds]
	] as const) {
		const base = new Set(baseValues);
		for (const value of new Set(finalValues)) {
			if (base.has(value)) conflicts.push(`${label}:${value}`);
		}
	}
	return conflicts.sort((left, right) => left.localeCompare(right));
}

export function baseWorkspaceIssuesExcludingValidatedFinalPaths(
	issues: readonly AffinityReviewSyncIssue[],
	finalPlannedPaths: ReadonlySet<string>
): readonly AffinityReviewSyncIssue[] {
	return issues.filter(
		(issue) => !(issue.kind === 'orphan-artifact' && finalPlannedPaths.has(issue.path))
	);
}

export function compositeAffinityWorkspaceIsValid(input: {
	readonly baseProjectionValidated: boolean;
	readonly scanIssues: readonly AffinityReviewSyncIssue[];
	readonly finalPlannedPaths: ReadonlySet<string>;
	readonly finalValidationIssues: readonly string[];
}): boolean {
	return (
		input.baseProjectionValidated &&
		baseWorkspaceIssuesExcludingValidatedFinalPaths(input.scanIssues, input.finalPlannedPaths)
			.length === 0 &&
		input.finalValidationIssues.length === 0
	);
}

/**
 * Verify the human design-risk lifecycle independently of the activation tool.
 * A canonical hash on an embedded record is only an integrity check; it is not proof that the
 * record came from the append-only decision database.
 */
export function validateFinalControlledDesignRiskLifecycle(
	input: FinalControlledDesignRiskLifecycleInput
): FinalControlledDesignRiskLifecycleEvidence {
	const issues: string[] = [];
	const parsedLedger = FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(input.ledger);
	const parsedReceipt = FinalControlledActivationReceiptSchema.safeParse(input.activationReceipt);
	if (!parsedLedger.success) {
		return {
			designRiskLedgerV2Valid: false,
			embeddedHumanDecisionHashValid: false,
			humanDecisionDatabaseAuthentic: false,
			activationReceiptLedgerBindingValid: false,
			stagedCorrectionCount: 0,
			stagedCorrectionsValid: false,
			issues: ['The final-controlled design-risk ledger is missing or is not the strict v2 schema.']
		};
	}
	const ledger = parsedLedger.data;
	const embeddedHumanDecisionHashValid =
		ledger.humanDecisionRecord.recordCanonicalSha256 ===
		sha256Json(ledger.humanDecisionRecord.record);
	if (!embeddedHumanDecisionHashValid) {
		issues.push('The embedded human decision record canonical hash is invalid.');
	}

	let humanDecisionDatabaseAuthentic = false;
	if (!input.decisionDatabaseAvailable) {
		issues.push('The authoritative human decision database is unavailable.');
	} else {
		const parsedDecisionList = FinalControlledDesignRiskDecisionListSchema.safeParse(
			input.decisionList
		);
		if (!parsedDecisionList.success) {
			issues.push('The authoritative human decision database projection is invalid.');
		} else {
			const latestForActor = parsedDecisionList.data.latestByActor.filter(
				(record) => record.actor === ledger.actor
			);
			humanDecisionDatabaseAuthentic =
				!ledger.actor.startsWith('test:') &&
				input.authoritativeActor !== null &&
				input.authoritativeActor === ledger.actor &&
				latestForActor.length === 1 &&
				latestForActor[0]?.decisionId === ledger.resolutionId &&
				sha256Json(latestForActor[0]) === sha256Json(ledger.humanDecisionRecord.record);
			if (!humanDecisionDatabaseAuthentic) {
				issues.push(
					'The ledger does not embed the authoritative actor’s latest unsuperseded human DB decision.'
				);
			}
		}
	}

	let activationReceiptLedgerBindingValid = false;
	if (!parsedReceipt.success) {
		issues.push('The final-controlled activation receipt is missing or invalid.');
	} else {
		const receipt = parsedReceipt.data;
		activationReceiptLedgerBindingValid =
			receipt.bindings.resolutionLedgerCanonicalSha256 === sha256Json(ledger) &&
			receipt.bindings.planCanonicalSha256 === ledger.evidenceBindings.planCanonicalSha256 &&
			receipt.bindings.planCanonicalSha256 === sha256Json(input.plan) &&
			receipt.bindings.catalogCanonicalSha256 === ledger.evidenceBindings.catalogCanonicalSha256 &&
			receipt.bindings.executionSnapshotSha256 ===
				ledger.evidenceBindings.executionSnapshotCanonicalSha256 &&
			receipt.bindings.blindReviewCanonicalSha256 ===
				ledger.evidenceBindings.blindReviewCollectionCanonicalSha256;
		if (!activationReceiptLedgerBindingValid) {
			issues.push('The activation receipt is stale or is not bound to the verified v2 ledger.');
		}
	}

	const stagedResolutions = ledger.resolutions.filter(
		(resolution) => resolution.stagedTarget !== null
	);
	let stagedCorrectionsValid = parsedReceipt.success;
	if (parsedReceipt.success) {
		const stagedReceiptArtifacts = parsedReceipt.data.artifacts.filter(
			(artifact) => artifact.source === 'staged'
		);
		if (stagedReceiptArtifacts.length !== stagedResolutions.length) {
			stagedCorrectionsValid = false;
		}
		for (const resolution of stagedResolutions) {
			const stagedTarget = resolution.stagedTarget!;
			const planned = input.plan.targets.find((target) => target.key === resolution.coordinate);
			const livePath = planned
				? renderPlannedPath(input.plan.plannedPathTemplates.target, planned)
				: null;
			const receiptArtifact = livePath
				? stagedReceiptArtifacts.find(
						(artifact) => artifact.kind === 'target' && artifact.livePath === livePath
					)
				: undefined;
			if (
				input.stagedTargetCanonicalHashes[stagedTarget.path] !== stagedTarget.canonicalHash ||
				receiptArtifact?.canonicalSha256 !== stagedTarget.canonicalHash
			) {
				stagedCorrectionsValid = false;
			}
		}
	}
	if (!stagedCorrectionsValid) {
		issues.push(
			'One or more human-directed staged corrections are missing, stale, or absent from activation.'
		);
	}

	return {
		designRiskLedgerV2Valid: true,
		embeddedHumanDecisionHashValid,
		humanDecisionDatabaseAuthentic,
		activationReceiptLedgerBindingValid,
		stagedCorrectionCount: stagedResolutions.length,
		stagedCorrectionsValid,
		issues
	};
}

/** Derive final-cohort gates without consulting or inheriting the immutable v1 evaluation. */
export function buildFinalControlledGateEvidence(
	input: FinalControlledGateEvidenceInput
): FinalControlledGateEvidence {
	const validationIssues = input.validationIssues ?? [];
	const readiness = buildAffinityGateReadiness({
		experimentId: 'affinity-workflow-v1',
		controlledTargets: input.targets,
		executions: input.executions,
		blindReviews: input.blindReviews
	});
	const valid = validationIssues.length === 0;
	const criteria = readiness.criteria;
	const lifecycle = input.designRiskLifecycle ?? {
		designRiskLedgerV2Valid: false,
		embeddedHumanDecisionHashValid: false,
		humanDecisionDatabaseAuthentic: false,
		activationReceiptLedgerBindingValid: false,
		stagedCorrectionCount: 0,
		stagedCorrectionsValid: false,
		issues: ['Final-controlled design-risk lifecycle evidence was not supplied.']
	};
	return {
		controlledFinalRerun: {
			planValidated: input.planValidated,
			activationReceiptValid: input.activationReceiptValid,
			designRiskLedgerV2Valid: lifecycle.designRiskLedgerV2Valid,
			embeddedHumanDecisionHashValid: lifecycle.embeddedHumanDecisionHashValid,
			humanDecisionDatabaseAuthentic: lifecycle.humanDecisionDatabaseAuthentic,
			activationReceiptLedgerBindingValid: lifecycle.activationReceiptLedgerBindingValid,
			stagedCorrectionCount: lifecycle.stagedCorrectionCount,
			stagedCorrectionsValid: lifecycle.stagedCorrectionsValid,
			targetManifestCount: input.targets.length,
			assignmentCount: input.assignmentCount,
			resultCount: input.executions.length,
			candidateImageCount: input.verifiedImageCount,
			gateSatisfied: valid && readiness.gate.currentlySatisfied,
			evaluationPassed: valid && readiness.gate.currentlySatisfied
		},
		humanBlindEvidence: {
			eligibleBlindReviewCount: readiness.reviewEvidence.eligibleBlindRecordCount,
			speciesThresholdSatisfied: valid && criteria.speciesCorrectBlindReviews.satisfied,
			affinityThresholdSatisfied: valid && criteria.affinityCorrectBlindReviews.satisfied,
			normalThresholdSatisfied: valid && criteria.normalUnaffiliatedBlindReviews.satisfied,
			meaningfulAcceptanceThresholdSatisfied:
				valid && criteria.acceptedMeaningfulNonNormal.satisfied,
			criticalFailureThresholdSatisfied: valid && criteria.acceptedCriticalVisualFailures.satisfied
		}
	};
}

function section(
	complete: boolean,
	evidence: Readonly<Record<string, unknown>>,
	blockers: readonly string[],
	blockerClasses: readonly AffinityPlanBlockerClass[]
): AffinityPlanCompletionSection {
	return {
		complete,
		evidence,
		blockers: complete ? [] : blockers,
		blockerClasses: complete ? [] : [...new Set(blockerClasses)]
	};
}

/** Pure plan-level finalizer. It accepts measured evidence only; plans and prose are not outcomes. */
export function buildAffinityPlanCompletionReport(
	evidence: AffinityPlanCompletionEvidence
): AffinityPlanCompletionReport {
	const skillComplete =
		evidence.skillAndDryRun.presentFileCount === evidence.skillAndDryRun.requiredFileCount &&
		evidence.skillAndDryRun.installedSkillMatchesRepository &&
		evidence.skillAndDryRun.dryRunValidated;
	const controlledComplete =
		evidence.controlledFinalRerun.planValidated &&
		evidence.controlledFinalRerun.activationReceiptValid &&
		evidence.controlledFinalRerun.designRiskLedgerV2Valid &&
		evidence.controlledFinalRerun.embeddedHumanDecisionHashValid &&
		evidence.controlledFinalRerun.humanDecisionDatabaseAuthentic &&
		evidence.controlledFinalRerun.activationReceiptLedgerBindingValid &&
		evidence.controlledFinalRerun.stagedCorrectionCount > 0 &&
		evidence.controlledFinalRerun.stagedCorrectionsValid &&
		evidence.controlledFinalRerun.targetManifestCount === 24 &&
		evidence.controlledFinalRerun.assignmentCount === 24 &&
		evidence.controlledFinalRerun.resultCount === 24 &&
		evidence.controlledFinalRerun.candidateImageCount === 24 &&
		evidence.controlledFinalRerun.gateSatisfied &&
		evidence.controlledFinalRerun.evaluationPassed;
	const humanComplete =
		evidence.humanBlindEvidence.eligibleBlindReviewCount >= 24 &&
		evidence.humanBlindEvidence.speciesThresholdSatisfied &&
		evidence.humanBlindEvidence.affinityThresholdSatisfied &&
		evidence.humanBlindEvidence.normalThresholdSatisfied &&
		evidence.humanBlindEvidence.meaningfulAcceptanceThresholdSatisfied &&
		evidence.humanBlindEvidence.criticalFailureThresholdSatisfied;
	const goblinComplete =
		evidence.goblinAudits.audit60Passed && evidence.goblinAudits.audit600Passed;
	const breadthComplete =
		evidence.breadthAndUnusualAnatomy.targetManifestCount === 24 &&
		evidence.breadthAndUnusualAnatomy.resultCount === 24 &&
		evidence.breadthAndUnusualAnatomy.reviewedResultCount === 24 &&
		evidence.breadthAndUnusualAnatomy.representedSpeciesCount === 4 &&
		evidence.breadthAndUnusualAnatomy.unusualCandidateCount >= 1 &&
		evidence.breadthAndUnusualAnatomy.breadthContactSheetPresent;
	const measuredLevels = new Set(evidence.concurrencyLadder.effectiveLevels);
	const concurrencyComplete =
		evidence.concurrencyLadder.requiredLevels.every((level) => measuredLevels.has(level)) &&
		evidence.concurrencyLadder.recommendedSafeConcurrency !== null &&
		evidence.concurrencyLadder.scaleEndpointEvidenced;
	const forgeComplete =
		evidence.forgeEvidence.presentFileCount === evidence.forgeEvidence.requiredFileCount &&
		evidence.forgeEvidence.labeledProjectionValid &&
		evidence.forgeEvidence.blindProjectionStripped &&
		evidence.forgeEvidence.clientBundlePrivacyValid;
	const laterPackRulesComplete =
		evidence.acceptedLaterPackRules.artifactPresent &&
		evidence.acceptedLaterPackRules.acceptedArtifactValid &&
		evidence.acceptedLaterPackRules.sourceBlindReviewCount >= 24;
	const scaleRecommendationComplete =
		evidence.scaleRecommendation.artifactPresent &&
		evidence.scaleRecommendation.finalArtifactValid &&
		evidence.scaleRecommendation.sourceBindingsValid &&
		evidence.scaleRecommendation.matchesEligibleSchedulerLevels &&
		evidence.concurrencyLadder.requiredLevels.every((level) =>
			evidence.scaleRecommendation.sourceEffectiveConcurrencyLevels.includes(level)
		);

	const sections = {
		skillAndDryRun: section(
			skillComplete,
			evidence.skillAndDryRun,
			[
				'The repository skill, installed skill, and hash-bound fresh-agent dry run must all validate.'
			],
			['implementable']
		),
		controlledFinalRerun: section(
			controlledComplete,
			evidence.controlledFinalRerun,
			[
				'A planned rerun is not execution evidence: a genuine latest human DB decision, its strict v2 ledger, every staged correction, a ledger-bound activation receipt, all 24 final-protocol outputs, and a passing controlled evaluation must exist.'
			],
			['human', 'gated', 'implementable']
		),
		humanBlindEvidence: section(
			humanComplete,
			evidence.humanBlindEvidence,
			[
				'Twenty-four eligible hash-bound blind reviews must satisfy species, affinity, Normal, meaningful-acceptance, and critical-failure thresholds.'
			],
			['human']
		),
		goblinAudits: section(
			goblinComplete,
			evidence.goblinAudits,
			['Both deterministic 60- and 600-manifest Goblin independence audits must pass.'],
			['implementable']
		),
		breadthAndUnusualAnatomy: section(
			breadthComplete,
			evidence.breadthAndUnusualAnatomy,
			[
				'All 24 breadth targets need bounded results and review states, all four breadth species must be represented, an unusual drake or basilisk must pass, and a breadth contact sheet must exist.'
			],
			['gated', 'human', 'implementable']
		),
		concurrencyLadder: section(
			concurrencyComplete,
			evidence.concurrencyLadder,
			[
				'Effective 2-, 4-, 6-, 8-, and 12-worker stages must be measured, with a final recommendation and either a 16-worker result or explicit lower-capacity endpoint evidence.'
			],
			['capacity', 'implementable']
		),
		forgeEvidence: section(
			forgeComplete,
			evidence.forgeEvidence,
			[
				'The Forge implementation and executable labeled/blind projections must expose review evidence while stripping blind semantics.'
			],
			['implementable']
		),
		acceptedLaterPackRules: section(
			laterPackRulesComplete,
			evidence.acceptedLaterPackRules,
			[
				`Provisional prose is insufficient; ${ACCEPTED_LATER_PACK_RULES_PATH} must contain an explicitly accepted, review-bound rules artifact.`
			],
			['human', 'implementable']
		),
		scaleRecommendation: section(
			scaleRecommendationComplete,
			evidence.scaleRecommendation,
			[
				`Preliminary timing prose is insufficient; ${SCALE_RECOMMENDATION_PATH} must be final and cite every required measured concurrency level.`
			],
			['capacity', 'implementable']
		)
	} satisfies Record<AffinityPlanCompletionSectionId, AffinityPlanCompletionSection>;
	const entries = Object.entries(sections) as Array<
		[AffinityPlanCompletionSectionId, AffinityPlanCompletionSection]
	>;
	const incompleteSections = entries
		.filter(([, value]) => !value.complete)
		.map(([sectionId]) => sectionId);
	const blockerSummary: Record<AffinityPlanBlockerClass, string[]> = {
		implementable: [],
		human: [],
		capacity: [],
		gated: []
	};
	for (const [sectionId, value] of entries) {
		for (const blockerClass of value.blockerClasses) {
			blockerSummary[blockerClass].push(sectionId);
		}
	}
	if (!evidence.workspaceValid) blockerSummary.implementable.unshift('workspace-invalid');

	return {
		schemaVersion: 'affinity-image-production-plan-completion-v1',
		experimentId: 'affinity-workflow-v1',
		planPath: 'docs/image-production-skill-and-affinity-test-plan.md',
		status: evidence.workspaceValid && incompleteSections.length === 0 ? 'complete' : 'incomplete',
		workspaceValid: evidence.workspaceValid,
		sections,
		incompleteSections,
		blockerSummary
	};
}

async function fileExists(filePath: string): Promise<boolean> {
	return stat(filePath)
		.then((metadata) => metadata.isFile() && metadata.size > 0)
		.catch(() => false);
}

async function listFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(root, entry.name);
			return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
		})
	);
	return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function linkProjectedFile(
	workspaceRoot: string,
	projectionRoot: string,
	repositoryPath: string
): Promise<void> {
	const source = path.resolve(workspaceRoot, repositoryPath);
	const destination = path.resolve(projectionRoot, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	if (!(await fileExists(destination))) await symlink(source, destination, 'file');
}

async function copyContainedProjectedFile(
	workspaceRoot: string,
	projectionRoot: string,
	repositoryPath: string
): Promise<void> {
	const source = path.resolve(workspaceRoot, repositoryPath);
	const destination = path.resolve(projectionRoot, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await rm(destination, { force: true });
	await copyFile(source, destination);
}

async function validateBaseWorkspaceProjection(
	workspaceRoot: string,
	excludedRepositoryPaths: ReadonlySet<string>
): Promise<Awaited<ReturnType<typeof validateAffinityWorkflowWorkspace>> | null> {
	const projectionRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-affinity-base-'));
	try {
		const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
		for (const absolutePath of await listFiles(experimentRoot)) {
			const repositoryPath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
			if (!excludedRepositoryPaths.has(repositoryPath)) {
				await linkProjectedFile(workspaceRoot, projectionRoot, repositoryPath);
			}
		}
		const bundle = createAffinityWorkflowExportBundle();
		for (const referencePath of new Set(
			bundle.targets.flatMap((target) => target.references.map((reference) => reference.path))
		)) {
			await linkProjectedFile(workspaceRoot, projectionRoot, referencePath);
		}
		const dryRunTarget = bundle.targets.find(
			(target) => target.targetId === 'affinity-workflow-v1-goblin-normal'
		);
		if (!dryRunTarget) throw new Error('Goblin Normal dry-run target is missing.');
		for (const repositoryPath of [
			`${AFFINITY_EXPERIMENT_ROOT}/targets/goblin/normal.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/dry-runs/goblin-normal-assignment-v1.json`,
			...dryRunTarget.references.map((reference) => reference.path)
		]) {
			await copyContainedProjectedFile(workspaceRoot, projectionRoot, repositoryPath);
		}
		for (const absolutePath of await listFiles(
			path.resolve(workspaceRoot, 'skills/summonlab-image-production')
		)) {
			await linkProjectedFile(
				workspaceRoot,
				projectionRoot,
				path.relative(workspaceRoot, absolutePath).split(path.sep).join('/')
			);
		}
		return await validateAffinityWorkflowWorkspace(projectionRoot);
	} catch {
		return null;
	} finally {
		await rm(projectionRoot, { recursive: true, force: true });
	}
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function renderPlannedPath(
	template: string,
	target: z.infer<typeof FinalControlledRerunPlanSchema>['targets'][number]
): string {
	return template
		.replace('{speciesId}', target.speciesId)
		.replace('{affinity}', target.affinity)
		.replace('{version}', target.version);
}

function retainedOutput(
	execution: ValidatedImageProductionExecution
): ImageProductionOutput | null {
	if (execution.result.status === 'candidate') {
		return (
			execution.result.attempts.find(
				(attempt) => attempt.attemptId === execution.result.selectedAttemptId
			)?.output ?? null
		);
	}
	return [...execution.result.attempts].reverse().find((attempt) => attempt.output)?.output ?? null;
}

async function verifyFinalImage(
	workspaceRoot: string,
	expectedPath: string,
	execution: ValidatedImageProductionExecution
): Promise<void> {
	const output = retainedOutput(execution);
	if (!output || output.path !== expectedPath) {
		throw new Error(`Final result does not retain its planned image: ${expectedPath}`);
	}
	const bytes = await readFile(path.resolve(workspaceRoot, output.path));
	const metadata = await sharp(bytes).metadata();
	const mediaType =
		metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
	if (
		bytes.byteLength !== output.bytes ||
		createHash('sha256').update(bytes).digest('hex') !== output.contentHash ||
		metadata.width !== output.width ||
		metadata.height !== output.height ||
		mediaType !== output.mediaType
	) {
		throw new Error(
			`Final image bytes or metadata do not match result provenance: ${expectedPath}`
		);
	}
}

function finalPlanIsStructurallyValid(
	plan: z.infer<typeof FinalControlledRerunPlanSchema>
): boolean {
	const keys = plan.targets.map((target) => target.key);
	const coordinates = plan.targets.map((target) => `${target.speciesId}:${target.affinity}`);
	const allPaths = plan.targets.flatMap((target) =>
		Object.values(plan.plannedPathTemplates).map((template) => renderPlannedPath(template, target))
	);
	return (
		new Set(keys).size === 24 && new Set(coordinates).size === 24 && new Set(allPaths).size === 96
	);
}

export function finalControlledReceiptFailureInvalidatesWorkspace(input: {
	readonly receiptPresent: boolean;
	readonly plannedArtifactCount: number;
}): boolean {
	return input.receiptPresent || input.plannedArtifactCount > 0;
}

async function inspectFinalControlledExecutionEvidence(input: {
	readonly workspaceRoot: string;
	readonly plan: z.infer<typeof FinalControlledRerunPlanSchema> | null;
	readonly blindReviews: readonly ImageProductionBlindReview[];
	readonly baseTargetIds: readonly string[];
	readonly baseAssignmentIds: readonly string[];
	readonly baseResultIds: readonly string[];
}): Promise<{
	readonly gateEvidence: FinalControlledGateEvidence;
	readonly validationIssues: readonly string[];
	readonly plannedPaths: ReadonlySet<string>;
}> {
	if (!input.plan) {
		const validationIssues = ['Final controlled rerun plan is missing or invalid.'];
		return {
			gateEvidence: buildFinalControlledGateEvidence({
				planValidated: false,
				activationReceiptValid: false,
				targets: [],
				assignmentCount: 0,
				executions: [],
				verifiedImageCount: 0,
				blindReviews: input.blindReviews,
				validationIssues
			}),
			validationIssues,
			plannedPaths: new Set()
		};
	}
	const plannedPaths = new Set(
		input.plan.targets.flatMap((target) =>
			Object.values(input.plan!.plannedPathTemplates).map((template) =>
				renderPlannedPath(template, target)
			)
		)
	);
	const targets: ImageProductionTarget[] = [];
	const executions: ValidatedImageProductionExecution[] = [];
	const validationIssues: string[] = [];
	const receiptVerification = await verifyFinalControlledActivationReceipt(
		input.workspaceRoot,
		sha256Json(input.plan)
	);
	const receiptPresent = await fileExists(
		path.resolve(input.workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH)
	);
	const ledgerInput = await readJson(
		path.resolve(input.workspaceRoot, FINAL_CONTROLLED_DESIGN_RISK_LEDGER_PATH)
	).catch(() => null);
	const parsedLedger = FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(ledgerInput);
	const stagedTargetCanonicalHashes: Record<string, string> = {};
	if (parsedLedger.success) {
		for (const resolution of parsedLedger.data.resolutions) {
			if (!resolution.stagedTarget) continue;
			const staged = await readJson(
				path.resolve(input.workspaceRoot, resolution.stagedTarget.path)
			).catch(() => null);
			if (staged !== null)
				stagedTargetCanonicalHashes[resolution.stagedTarget.path] = sha256Json(staged);
		}
	}
	const config = getConfig();
	let decisionList: unknown = null;
	let decisionDatabaseAvailable = false;
	if (parsedLedger.success) {
		try {
			decisionList = await listFinalControlledDesignRiskDecisions(
				config.databaseUrl,
				'affinity-workflow-v1',
				'final-controlled-activation-v1'
			);
			decisionDatabaseAvailable = true;
		} catch {
			decisionDatabaseAvailable = false;
		}
	}
	const designRiskLifecycle = validateFinalControlledDesignRiskLifecycle({
		plan: input.plan,
		ledger: ledgerInput,
		activationReceipt: receiptVerification.receipt ?? null,
		stagedTargetCanonicalHashes,
		decisionDatabaseAvailable,
		decisionList,
		authoritativeActor: config.affinityReviewActor
	});
	const assignmentIds: string[] = [];
	const resultIds: string[] = [];
	let assignmentCount = 0;
	let verifiedImageCount = 0;
	let plannedArtifactCount = 0;
	for (const planned of input.plan.targets) {
		const targetPath = renderPlannedPath(input.plan.plannedPathTemplates.target, planned);
		const assignmentPath = renderPlannedPath(input.plan.plannedPathTemplates.assignment, planned);
		const resultPath = renderPlannedPath(input.plan.plannedPathTemplates.result, planned);
		const candidatePath = renderPlannedPath(input.plan.plannedPathTemplates.candidate, planned);
		const coordinatePaths = [targetPath, assignmentPath, resultPath, candidatePath];
		const pathPresence = await Promise.all(
			coordinatePaths.map(async (repositoryPath) => ({
				repositoryPath,
				present: await fileExists(path.resolve(input.workspaceRoot, repositoryPath))
			}))
		);
		const presentPaths = pathPresence.filter((entry) => entry.present);
		plannedArtifactCount += presentPaths.length;
		if (presentPaths.length === 0) continue;
		if (presentPaths.length !== coordinatePaths.length) {
			validationIssues.push(
				`${planned.key}: partial final-controlled coordinate; present ${presentPaths.length}/4 planned artifacts.`
			);
		}
		try {
			const target = ImageProductionTargetSchema.parse(
				await readJson(path.resolve(input.workspaceRoot, targetPath))
			);
			if (
				target.targetId !== `affinity-workflow-v1-${planned.key}` ||
				target.cohort !== 'controlled' ||
				target.speciesId !== planned.speciesId ||
				target.affinity !== planned.affinity ||
				target.output.candidatePath !== candidatePath ||
				target.output.resultPath !== resultPath
			) {
				throw new Error('Target identity, cohort, coordinate, or owned outputs differ from plan.');
			}
			targets.push(target);
			const assignment = ImageProductionAssignmentSchema.parse(
				await readJson(path.resolve(input.workspaceRoot, assignmentPath))
			);
			if (
				assignment.targetId !== target.targetId ||
				assignment.permittedOutputs.candidatePath !== candidatePath ||
				assignment.permittedOutputs.resultPath !== resultPath
			) {
				throw new Error('Assignment is not bound to the planned target and outputs.');
			}
			assignmentCount += 1;
			assignmentIds.push(assignment.assignmentId);
			const result = ImageProductionResultSchema.parse(
				await readJson(path.resolve(input.workspaceRoot, resultPath))
			);
			validateImageProductionExecution({ target, assignment, result });
			const execution = { target, assignment, result };
			executions.push(execution);
			resultIds.push(result.resultId);
			await verifyFinalImage(input.workspaceRoot, candidatePath, execution);
			verifiedImageCount += 1;
		} catch (error) {
			validationIssues.push(
				`${planned.key}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	if (
		!receiptVerification.valid &&
		finalControlledReceiptFailureInvalidatesWorkspace({
			receiptPresent,
			plannedArtifactCount
		})
	) {
		validationIssues.push(
			...receiptVerification.issues.map((issue) => `Activation receipt: ${issue}`)
		);
	}
	if (
		!designRiskLifecycle.designRiskLedgerV2Valid ||
		!designRiskLifecycle.embeddedHumanDecisionHashValid ||
		!designRiskLifecycle.humanDecisionDatabaseAuthentic ||
		!designRiskLifecycle.activationReceiptLedgerBindingValid ||
		!designRiskLifecycle.stagedCorrectionsValid
	) {
		if (receiptPresent || plannedArtifactCount > 0) {
			validationIssues.push(
				...designRiskLifecycle.issues.map((issue) => `Design-risk lifecycle: ${issue}`)
			);
		}
	}
	for (const [label, values] of [
		['target IDs', targets.map((target) => target.targetId)],
		['assignment IDs', assignmentIds],
		['result IDs', resultIds]
	] as const) {
		if (new Set(values).size !== values.length) {
			validationIssues.push(`Final controlled ${label} are not unique.`);
		}
	}
	for (const conflict of findFinalControlledCrossCohortIdConflicts({
		baseTargetIds: input.baseTargetIds,
		baseAssignmentIds: input.baseAssignmentIds,
		baseResultIds: input.baseResultIds,
		finalTargetIds: targets.map((target) => target.targetId),
		finalAssignmentIds: assignmentIds,
		finalResultIds: resultIds
	})) {
		validationIssues.push(`Final controlled ID collides with immutable base evidence: ${conflict}`);
	}
	return {
		gateEvidence: buildFinalControlledGateEvidence({
			planValidated: finalPlanIsStructurallyValid(input.plan),
			activationReceiptValid: receiptVerification.valid,
			designRiskLifecycle,
			targets,
			assignmentCount,
			executions,
			verifiedImageCount,
			blindReviews: input.blindReviews,
			validationIssues
		}),
		validationIssues,
		plannedPaths
	};
}

export interface SchedulerRunEligibility {
	readonly eligible: boolean;
	readonly reasons: readonly string[];
}

export function validateSchedulerRunEligibility(
	preflightInput: unknown,
	reportInput: unknown
): SchedulerRunEligibility {
	const preflight = AffinityWavePreflightSchema.safeParse(preflightInput);
	const report = AffinityWaveReportSchema.safeParse(reportInput);
	const reasons: string[] = [];
	if (!preflight.success) reasons.push('invalid-preflight');
	if (!report.success) reasons.push('invalid-report');
	if (!preflight.success || !report.success) return { eligible: false, reasons };
	const p = preflight.data;
	const r = report.data;
	if (p.runId !== r.runId || p.stage !== r.stage || p.experimentId !== r.experimentId) {
		reasons.push('run-binding-mismatch');
	}
	if (
		r.sourceEvidence.preflight.path !== `${p.runDirectory}/preflight.json` ||
		r.sourceEvidence.preflight.canonicalSha256 !== canonicalJsonSha256(p)
	)
		reasons.push('report-preflight-source-binding-mismatch');
	if (r.sourceEvidence.results.length !== r.candidateCount + r.reviseCount)
		reasons.push('report-result-source-count-mismatch');
	if (p.status !== 'ready' || !p.exactConcurrencyReady) reasons.push('preflight-not-exact-ready');
	if (
		p.dispatchGateSatisfied !== true ||
		!dispatchGateEvidenceAuthorizes(p.dispatchGateEvidence) ||
		p.dispatchGateEvidence?.gate?.qualityGateSatisfied !== true ||
		p.dispatchGateEvidence?.gate?.authorizedStage !== p.stage ||
		p.dispatchGateEvidence?.expectedCanonicalSha256 !==
			p.dispatchGateEvidence?.observedCanonicalSha256
	) {
		reasons.push('promotion-gate-not-evidenced');
	}
	if (
		['breadth', 'load', 'scale'].includes(p.stage) &&
		p.dispatchGateEvidence?.gate?.humanGateSatisfied !== true
	) {
		reasons.push('human-gate-not-evidenced');
	}
	if (p.collisionPaths.length !== 0) reasons.push('preflight-output-collision');
	if (p.jobs.length !== r.targetCount) reasons.push('preflight-report-target-count-mismatch');
	if (r.status !== 'completed') reasons.push('report-not-completed');
	if (
		r.requestedConcurrency !== r.effectiveConcurrency ||
		r.requestedConcurrency !== p.requestedConcurrency
	) {
		reasons.push('requested-effective-concurrency-mismatch');
	}
	if (r.workerCount < r.effectiveConcurrency) reasons.push('insufficient-distinct-worker-evidence');
	if (
		r.dispatchedCount !== r.targetCount ||
		r.terminalCount !== r.targetCount ||
		r.unlaunchedCount !== 0
	) {
		reasons.push('incomplete-dispatch-or-terminal-count');
	}
	if (
		r.failedCount !== 0 ||
		r.capacityFailureCount !== 0 ||
		r.providerThrottleCount !== 0 ||
		r.timeoutCount !== 0 ||
		r.malformedOutputCount !== 0
	) {
		reasons.push('scheduler-or-provider-failure');
	}
	if (r.provenanceCompletenessRate !== 1) reasons.push('incomplete-provenance');
	const metrics = r.stageMetrics;
	if (!metrics) {
		reasons.push('missing-stage-metrics');
	} else {
		if (
			metrics.stage !== r.stage ||
			metrics.plannedParallelJobs !== r.requestedConcurrency ||
			metrics.effectiveParallelJobs !== r.effectiveConcurrency ||
			metrics.targetCount !== r.targetCount
		) {
			reasons.push('stage-metric-binding-mismatch');
		}
		if (
			metrics.failedCount !== 0 ||
			metrics.throttleCount !== 0 ||
			metrics.timeoutCount !== 0 ||
			metrics.missingResultCount !== 0 ||
			metrics.duplicateIdCount !== 0 ||
			metrics.pathConflictCount !== 0 ||
			metrics.integrationErrorCount !== 0 ||
			metrics.provenanceCompletenessRate !== 1
		) {
			reasons.push('stage-quality-or-workflow-violation');
		}
	}
	return { eligible: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function legacyConcurrencyStageEligible(
	stage: z.infer<typeof ImageProductionConcurrencyStageSchema>
): boolean {
	return (
		stage.effectiveParallelJobs <= 3 &&
		stage.candidateCount + stage.reviseCount === stage.targetCount &&
		stage.failedCount === 0 &&
		stage.throttleCount === 0 &&
		stage.timeoutCount === 0 &&
		stage.provenanceCompletenessRate === 1 &&
		stage.missingResultCount === 0 &&
		stage.duplicateIdCount === 0 &&
		stage.pathConflictCount === 0 &&
		stage.integrationErrorCount === 0
	);
}

export interface SchedulerEvidenceScan {
	readonly eligibleRuns: readonly EligibleSchedulerRun[];
	readonly blockedScalePreflights: readonly {
		readonly runId: string;
		readonly preflightPath: string;
		readonly preflightCanonicalSha256: string;
		readonly prerequisiteRunIds: readonly string[];
	}[];
}

export async function inspectSchedulerEvidence(
	workspaceRoot: string
): Promise<SchedulerEvidenceScan> {
	const runsRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT, 'wave-runs');
	const entries = await readdir(runsRoot, { withFileTypes: true }).catch(() => []);
	const basicEligible = new Map<
		string,
		{ run: EligibleSchedulerRun; preflight: AffinityWavePreflight }
	>();
	const blockedScalePreflights: SchedulerEvidenceScan['blockedScalePreflights'][number][] = [];
	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		const preflightAbsolute = path.join(runsRoot, entry.name, 'preflight.json');
		const preflightInput = await readJson(preflightAbsolute).catch(() => null);
		const preflight = AffinityWavePreflightSchema.safeParse(preflightInput);
		if (!preflight.success) continue;
		const preflightPath = path.relative(workspaceRoot, preflightAbsolute);
		const preflightCanonicalSha256 = canonicalJsonSha256(preflight.data);
		if (
			preflight.data.stage === 'scale' &&
			preflight.data.requestedConcurrency === 16 &&
			preflight.data.status === 'blocked-capacity' &&
			preflight.data.exactConcurrencyReady === false &&
			preflight.data.collisionPaths.length === 0 &&
			preflight.data.dispatchGateSatisfied === true &&
			dispatchGateEvidenceAuthorizes(preflight.data.dispatchGateEvidence) &&
			preflight.data.dispatchGateEvidence?.gate?.authorizedStage === 'scale' &&
			preflight.data.dispatchGateEvidence?.gate?.qualityGateSatisfied === true &&
			preflight.data.dispatchGateEvidence?.gate?.humanGateSatisfied === true &&
			preflight.data.dispatchGateEvidence?.expectedCanonicalSha256 ===
				preflight.data.dispatchGateEvidence?.observedCanonicalSha256
		) {
			blockedScalePreflights.push({
				runId: preflight.data.runId,
				preflightPath,
				preflightCanonicalSha256,
				prerequisiteRunIds: preflight.data.dispatchGateEvidence?.gate?.prerequisiteRunIds ?? []
			});
		}
		const reportAbsolute = path.join(runsRoot, entry.name, 'report.json');
		const reportInput = await readJson(reportAbsolute).catch(() => null);
		const eligibility = validateSchedulerRunEligibility(preflight.data, reportInput);
		const report = AffinityWaveReportSchema.safeParse(reportInput);
		if (!eligibility.eligible || !report.success) continue;
		const rebuiltReport = await readWaveEvents(workspaceRoot, preflight.data)
			.then((events) =>
				buildWaveReport(workspaceRoot, preflight.data, events, report.data.generatedAt)
			)
			.catch(() => null);
		if (!rebuiltReport || canonicalJsonSha256(rebuiltReport) !== canonicalJsonSha256(report.data))
			continue;
		basicEligible.set(preflight.data.runId, {
			preflight: preflight.data,
			run: {
				runId: preflight.data.runId,
				stage: report.data.stage,
				effectiveConcurrency: report.data.effectiveConcurrency,
				preflightPath,
				preflightCanonicalSha256,
				reportPath: path.relative(workspaceRoot, reportAbsolute),
				reportCanonicalSha256: canonicalJsonSha256(report.data)
			}
		});
	}
	const eligible = new Map<string, EligibleSchedulerRun>();
	const precedingStage = {
		canary: null,
		pilot: 'canary',
		controlled: 'pilot',
		breadth: 'controlled',
		load: 'breadth',
		scale: 'load'
	} as const;
	let changed = true;
	while (changed) {
		changed = false;
		for (const [runId, candidate] of basicEligible) {
			if (eligible.has(runId)) continue;
			const prerequisites =
				candidate.preflight.dispatchGateEvidence?.gate?.prerequisiteRunIds ?? [];
			const requiredPrecedingStage = precedingStage[candidate.run.stage];
			const prerequisitesEligible = prerequisites.every((prerequisite) =>
				eligible.has(prerequisite)
			);
			const precedingStageEvidenced =
				requiredPrecedingStage === null
					? prerequisites.length === 0
					: prerequisites.some(
							(prerequisite) => eligible.get(prerequisite)?.stage === requiredPrecedingStage
						);
			if (prerequisitesEligible && precedingStageEvidenced) {
				eligible.set(runId, candidate.run);
				changed = true;
			}
		}
	}
	return {
		eligibleRuns: [...eligible.values()].sort(
			(left, right) => left.effectiveConcurrency - right.effectiveConcurrency
		),
		blockedScalePreflights: blockedScalePreflights.filter((preflight) =>
			preflight.prerequisiteRunIds.some(
				(prerequisite) => eligible.get(prerequisite)?.stage === 'load'
			)
		)
	};
}

interface VerifiedRoundFinalEvidence {
	readonly passed: boolean;
	readonly reviewCount: number;
	readonly representedSpeciesCount: number;
	readonly acceptedUnusualAnatomyCount: number;
	readonly contactSheetValid: boolean;
}

export function roundFinalEvaluationMatchesCanonicalDerivation(
	evaluation: z.infer<typeof AffinityRoundFinalEvaluationSchema>,
	derivation: RoundFinalizationDerivation
): boolean {
	return (
		derivation.eligible &&
		derivation.evaluation !== null &&
		sha256Json(evaluation) === sha256Json(derivation.evaluation)
	);
}

async function inspectRoundFinalEvidence(
	workspaceRoot: string,
	roundId: 'final-controlled-v1' | 'breadth-v1'
): Promise<VerifiedRoundFinalEvidence> {
	const empty = {
		passed: false,
		reviewCount: 0,
		representedSpeciesCount: 0,
		acceptedUnusualAnatomyCount: 0,
		contactSheetValid: false
	};
	try {
		const root = affinityRoundRoot(roundId);
		const evaluationPath = `${root}/final-evaluation.json`;
		const receiptPath = `${root}/final-evaluation-receipt.json`;
		const [round, reviews, evaluationBytes, receiptInput, derivation] = await Promise.all([
			loadVerifiedAffinityReviewRound(workspaceRoot, roundId),
			loadRoundBlindReviews(workspaceRoot, roundId, true),
			readFile(path.resolve(workspaceRoot, evaluationPath)),
			readJson(path.resolve(workspaceRoot, receiptPath)),
			deriveAffinityRoundFinalEvaluation(workspaceRoot, roundId)
		]);
		if (!reviews) return empty;
		const evaluation = AffinityRoundFinalEvaluationSchema.parse(
			JSON.parse(evaluationBytes.toString('utf8'))
		);
		const receipt = AffinityRoundFinalEvaluationReceiptSchema.parse(receiptInput);
		const evaluationBound =
			roundFinalEvaluationMatchesCanonicalDerivation(evaluation, derivation) &&
			evaluation.roundId === roundId &&
			receipt.roundId === roundId &&
			receipt.evaluationPath === evaluationPath &&
			receipt.integrationReceiptCanonicalSha256 === round.integrationReceiptCanonicalSha256 &&
			evaluation.integrationReceiptCanonicalSha256 === round.integrationReceiptCanonicalSha256 &&
			receipt.blindReviewCanonicalSha256 === sha256Json(reviews) &&
			evaluation.blindReviewCanonicalSha256 === sha256Json(reviews) &&
			receipt.evaluationCanonicalSha256 === sha256Json(evaluation) &&
			receipt.evaluationByteSha256 === createHash('sha256').update(evaluationBytes).digest('hex');

		let contactSheetValid = false;
		try {
			contactSheetValid = (
				await exportAffinityRoundContactSheet({ workspaceRoot, roundId, mode: 'check' })
			).inSync;
		} catch {
			contactSheetValid = false;
		}
		return {
			passed: evaluationBound,
			reviewCount: evaluationBound ? evaluation.criteria.reviewCount : 0,
			representedSpeciesCount: evaluationBound ? evaluation.criteria.representedSpeciesCount : 0,
			acceptedUnusualAnatomyCount: evaluationBound
				? evaluation.criteria.acceptedUnusualAnatomyCount
				: 0,
			contactSheetValid
		};
	} catch {
		return empty;
	}
}

async function optionalAcceptedRules(workspaceRoot: string) {
	return verifyAcceptedLaterPackRulesForCompletion({
		workspaceRoot,
		actor: process.env.SUMMONLAB_LATER_PACK_RULE_ACTOR ?? null,
		loadDatabaseUrl: () => getConfig().databaseUrl
	});
}

async function optionalScaleRecommendation(
	workspaceRoot: string,
	schedulerEvidence: SchedulerEvidenceScan
) {
	const filePath = path.resolve(workspaceRoot, SCALE_RECOMMENDATION_PATH);
	const artifactPresent = await fileExists(filePath);
	if (!artifactPresent)
		return {
			artifactPresent,
			finalArtifactValid: false,
			sourceEffectiveConcurrencyLevels: [] as number[],
			sourceBindingsValid: false,
			matchesEligibleSchedulerLevels: false,
			recommendedSafeConcurrency: null
		};
	const { AffinityScaleRecommendationV3Schema } =
		await import('./finalize-affinity-scale-recommendation.js');
	const parsed = AffinityScaleRecommendationV3Schema.safeParse(
		await readJson(filePath).catch(() => null)
	);
	const eligibleByRunId = new Map(
		schedulerEvidence.eligibleRuns.map((run) => [run.runId, run] as const)
	);
	const sourceBindingsValid =
		parsed.success &&
		parsed.data.sourceRuns.every((source) => {
			const eligible = eligibleByRunId.get(source.runId);
			return (
				eligible !== undefined &&
				eligible.stage === source.stage &&
				eligible.effectiveConcurrency === source.effectiveConcurrency &&
				eligible.preflightPath === source.preflightPath &&
				eligible.preflightCanonicalSha256 === source.preflightCanonicalSha256 &&
				eligible.reportPath === source.reportPath &&
				eligible.reportCanonicalSha256 === source.reportCanonicalSha256
			);
		});
	const eligibleLevels = [
		...new Set(schedulerEvidence.eligibleRuns.map((run) => run.effectiveConcurrency))
	].sort((left, right) => left - right);
	const matchesEligibleSchedulerLevels =
		parsed.success &&
		JSON.stringify(parsed.data.sourceEffectiveConcurrencyLevels) === JSON.stringify(eligibleLevels);
	let endpointBound = false;
	if (parsed.success) {
		const endpoint = parsed.data.scaleEndpointSource;
		endpointBound =
			endpoint.kind === 'completed-scale'
				? schedulerEvidence.eligibleRuns.some(
						(run) =>
							run.stage === 'scale' &&
							run.runId === endpoint.runId &&
							run.preflightPath === endpoint.preflightPath &&
							run.preflightCanonicalSha256 === endpoint.preflightCanonicalSha256 &&
							run.reportPath === endpoint.reportPath &&
							run.reportCanonicalSha256 === endpoint.reportCanonicalSha256
					)
				: schedulerEvidence.blockedScalePreflights.some(
						(preflight) =>
							preflight.runId === endpoint.runId &&
							preflight.preflightPath === endpoint.preflightPath &&
							preflight.preflightCanonicalSha256 === endpoint.preflightCanonicalSha256
					);
	}
	return {
		artifactPresent,
		finalArtifactValid: parsed.success && endpointBound,
		sourceEffectiveConcurrencyLevels: parsed.success
			? parsed.data.sourceEffectiveConcurrencyLevels
			: [],
		sourceBindingsValid,
		matchesEligibleSchedulerLevels,
		recommendedSafeConcurrency:
			parsed.success && endpointBound && sourceBindingsValid && matchesEligibleSchedulerLevels
				? parsed.data.recommendedSafeConcurrency
				: null
	};
}

export async function inspectAffinityPlanCompletionEvidence(
	workspaceRoot = process.cwd()
): Promise<AffinityPlanCompletionEvidence> {
	const exportBundle = createAffinityWorkflowExportBundle();
	const scan = await scanAffinityReviewWorkspace(workspaceRoot);
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const repoSkillRoot = path.resolve(workspaceRoot, 'skills/summonlab-image-production');
	const installedSkillRoot = '/home/joao/.codex/skills/summonlab-image-production';
	const presentSkillFiles = (
		await Promise.all(
			REQUIRED_SKILL_FILES.map((relativePath) => fileExists(path.join(repoSkillRoot, relativePath)))
		)
	).filter(Boolean).length;
	const installedSkillMatchesRepository = await Promise.all([
		realpath(repoSkillRoot).catch(() => null),
		realpath(installedSkillRoot).catch(() => null)
	]).then(([repository, installed]) => repository !== null && repository === installed);

	const finalPlanPath = path.join(experimentRoot, 'review/final-controlled-rerun-plan.json');
	const finalPlan = FinalControlledRerunPlanSchema.safeParse(
		await readJson(finalPlanPath).catch(() => null)
	);
	const finalRoundReviews = await loadRoundBlindReviews(
		workspaceRoot,
		'final-controlled-v1',
		false
	).catch(() => null);
	const baseTargetIds = exportBundle.targets.map((target) => target.targetId);
	const baseTargetIdSet = new Set(baseTargetIds);
	const finalControlled = await inspectFinalControlledExecutionEvidence({
		workspaceRoot,
		plan: finalPlan.success ? finalPlan.data : null,
		blindReviews: finalRoundReviews?.reviews ?? [],
		baseTargetIds,
		baseAssignmentIds: exportBundle.assignments.map((assignment) => assignment.assignmentId),
		baseResultIds: scan.executions
			.filter(({ target }) => baseTargetIdSet.has(target.targetId))
			.map(({ result }) => result.resultId)
	});
	const finalRoundEvidence = await inspectRoundFinalEvidence(workspaceRoot, 'final-controlled-v1');
	const breadthRoundEvidence = await inspectRoundFinalEvidence(workspaceRoot, 'breadth-v1');
	const validation = await validateBaseWorkspaceProjection(
		workspaceRoot,
		finalControlled.plannedPaths
	);
	const workspaceValid = compositeAffinityWorkspaceIsValid({
		baseProjectionValidated: validation !== null,
		scanIssues: scan.issues,
		finalPlannedPaths: finalControlled.plannedPaths,
		finalValidationIssues: finalControlled.validationIssues
	});

	const auditPassed = async (sampleSize: 60 | 600): Promise<boolean> => {
		const value = await readJson(
			path.join(experimentRoot, `review/goblin-audit-${sampleSize}.json`)
		).catch(() => null);
		return canonicalGoblinAuditMatches(value, sampleSize) && validation !== null;
	};

	const schedulerEvidence = await inspectSchedulerEvidence(workspaceRoot);
	const legacyEffectiveLevels = [
		...new Set(
			scan.evaluation.concurrencyStages
				.filter(legacyConcurrencyStageEligible)
				.map((stage) => stage.effectiveParallelJobs)
		)
	].sort((left, right) => left - right);
	const schedulerEffectiveLevels = [
		...new Set(schedulerEvidence.eligibleRuns.map((run) => run.effectiveConcurrency))
	].sort((left, right) => left - right);
	const effectiveLevels = [
		...new Set([...legacyEffectiveLevels, ...schedulerEffectiveLevels])
	].sort((left, right) => left - right);
	const scaleEndpointEvidenced =
		schedulerEvidence.eligibleRuns.some((run) => run.stage === 'scale') ||
		schedulerEvidence.blockedScalePreflights.length > 0;

	const presentForgeFiles = (
		await Promise.all(
			REQUIRED_FORGE_FILES.map((relativePath) =>
				fileExists(path.resolve(workspaceRoot, relativePath))
			)
		)
	).filter(Boolean).length;
	const [labeledForge, blindForge] = await Promise.all([
		loadAffinityReviewData(false, []),
		loadAffinityReviewData(true, [], 'controlled')
	]);
	const labeledCells = labeledForge.rows.flatMap((row) => row.cells);
	const blindCells = blindForge.rows.flatMap((row) => row.cells);
	const labeledProjectionValid =
		labeledCells.length === 84 &&
		labeledCells.some((cell) => cell.status === 'candidate' && cell.metadata !== null) &&
		labeledCells.some((cell) => cell.status === 'pending');
	const blindProjectionStripped =
		blindCells.length === 24 &&
		blindCells.every((cell) => cell.labels === null && cell.metadata === null) &&
		blindCells.filter((cell) => cell.status === 'candidate').length === 21;
	const clientBundlePrivacyValid = await validateAffinityClientBundlePrivacy(workspaceRoot)
		.then(() => true)
		.catch(() => false);

	const acceptedLaterPackRules = await optionalAcceptedRules(workspaceRoot);
	const scaleRecommendation = await optionalScaleRecommendation(workspaceRoot, schedulerEvidence);

	return {
		workspaceValid,
		skillAndDryRun: {
			requiredFileCount: REQUIRED_SKILL_FILES.length,
			presentFileCount: presentSkillFiles,
			installedSkillMatchesRepository,
			dryRunValidated: validation?.dryRunEvidence ?? false
		},
		controlledFinalRerun: {
			...finalControlled.gateEvidence.controlledFinalRerun,
			evaluationPassed: finalRoundEvidence.passed
		},
		humanBlindEvidence: finalControlled.gateEvidence.humanBlindEvidence,
		goblinAudits: {
			audit60Passed: await auditPassed(60),
			audit600Passed: await auditPassed(600)
		},
		breadthAndUnusualAnatomy: {
			targetManifestCount: exportBundle.targets.filter((target) => target.cohort === 'breadth')
				.length,
			resultCount: breadthRoundEvidence.passed ? 24 : 0,
			reviewedResultCount: breadthRoundEvidence.reviewCount,
			representedSpeciesCount: breadthRoundEvidence.representedSpeciesCount,
			unusualCandidateCount: breadthRoundEvidence.acceptedUnusualAnatomyCount,
			breadthContactSheetPresent: breadthRoundEvidence.contactSheetValid
		},
		concurrencyLadder: {
			effectiveLevels,
			legacyEffectiveLevels,
			schedulerEffectiveLevels,
			eligibleSchedulerRuns: schedulerEvidence.eligibleRuns,
			requiredLevels: REQUIRED_CONCURRENCY_LEVELS,
			recommendedSafeConcurrency: scaleRecommendation.recommendedSafeConcurrency,
			scaleEndpointEvidenced
		},
		forgeEvidence: {
			requiredFileCount: REQUIRED_FORGE_FILES.length,
			presentFileCount: presentForgeFiles,
			labeledProjectionValid,
			blindProjectionStripped,
			clientBundlePrivacyValid
		},
		acceptedLaterPackRules,
		scaleRecommendation
	};
}

export async function checkAffinityPlanCompletion(
	workspaceRoot = process.cwd()
): Promise<AffinityPlanCompletionReport> {
	return buildAffinityPlanCompletionReport(
		await inspectAffinityPlanCompletionEvidence(workspaceRoot)
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const report = await checkAffinityPlanCompletion(process.cwd());
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (report.status !== 'complete') process.exitCode = 1;
}
