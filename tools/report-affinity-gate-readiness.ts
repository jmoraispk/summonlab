import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type {
	ImageProductionBlindReview,
	ImageProductionTarget
} from '../packages/contracts/src/index.js';

import { createAffinityWorkflowExportBundle } from './image-production-lib.js';
import {
	scanAffinityReviewWorkspace,
	type AffinityReviewSyncIssue,
	type ValidatedImageProductionExecution
} from './sync-affinity-review.js';

const CRITICAL_VISUAL_CATEGORIES = new Set([
	'anatomy',
	'canvas-completion',
	'framing',
	'silhouette'
]);

export const AFFINITY_CONTROLLED_GATE_THRESHOLDS = {
	firstAttemptCandidates: 20,
	speciesCorrectBlindReviews: 23,
	affinityCorrectBlindReviews: 20,
	normalUnaffiliatedBlindReviews: 4,
	acceptedMeaningfulNonNormal: 20,
	acceptedCriticalVisualFailures: 0
} as const;

export type AffinityGateCriterionId = keyof typeof AFFINITY_CONTROLLED_GATE_THRESHOLDS;
export type AffinityGateThresholdOperator = 'at-least' | 'exactly' | 'at-most';

export interface AffinityGateCriterionReadiness {
	readonly current: number;
	/** The largest value this metric can take without adding controlled targets. */
	readonly maximum: number;
	/** The best value still reachable from the current monotonic evidence. */
	readonly bestAttainable: number;
	readonly threshold: number;
	readonly thresholdOperator: AffinityGateThresholdOperator;
	readonly satisfied: boolean;
	readonly attainable: boolean;
	readonly explanation: string;
}

export interface AffinityGateReadinessReport {
	readonly schemaVersion: 'affinity-controlled-gate-readiness-v1';
	readonly experimentId: string;
	readonly workspace: {
		readonly valid: boolean;
		readonly issueCount: number;
		readonly issues: readonly AffinityReviewSyncIssue[];
	};
	readonly controlledCohort: {
		readonly targetCount: number;
		readonly completedCount: number;
		readonly unresolvedCount: number;
		readonly candidateCount: number;
		readonly reviseOrFailedCount: number;
	};
	readonly reviewEvidence: {
		readonly recordCount: number;
		readonly blindRecordCount: number;
		readonly eligibleBlindRecordCount: number;
		readonly ignoredRecordCount: number;
		readonly modePolicy: 'legacy-blind-aggregate' | 'explicit-blind-only';
	};
	readonly criteria: Readonly<Record<AffinityGateCriterionId, AffinityGateCriterionReadiness>>;
	readonly gate: {
		readonly currentlySatisfied: boolean;
		readonly attainableWithExistingControlledCohort: boolean;
		readonly unattainableCriteria: readonly AffinityGateCriterionId[];
	};
}

export interface AffinityGateReadinessInput {
	readonly experimentId: string;
	readonly controlledTargets: readonly ImageProductionTarget[];
	readonly executions: readonly ValidatedImageProductionExecution[];
	readonly blindReviews: readonly ImageProductionBlindReview[];
	readonly workspaceIssues?: readonly AffinityReviewSyncIssue[];
}

type PotentiallyModeAwareReview = ImageProductionBlindReview & {
	readonly reviewMode?: unknown;
};

function selectedAttempt(execution: ValidatedImageProductionExecution) {
	return execution.result.attempts.find(
		(attempt) => attempt.attemptId === execution.result.selectedAttemptId
	);
}

function selectedCandidateHash(execution: ValidatedImageProductionExecution): string | null {
	if (execution.result.status !== 'candidate') return null;
	return selectedAttempt(execution)?.output?.contentHash ?? null;
}

function containsCriticalVisualFailure(execution: ValidatedImageProductionExecution): boolean {
	return (
		selectedAttempt(execution)?.findings.some(
			(finding) => finding.outcome === 'fail' && CRITICAL_VISUAL_CATEGORIES.has(finding.category)
		) ?? false
	);
}

function selectBlindReviews(reviews: readonly ImageProductionBlindReview[]): {
	readonly reviews: readonly ImageProductionBlindReview[];
	readonly modePolicy: AffinityGateReadinessReport['reviewEvidence']['modePolicy'];
} {
	const explicitModesPresent =
		reviews.length === 0 || reviews.some((review) => Object.hasOwn(review as object, 'reviewMode'));
	if (!explicitModesPresent) return { reviews, modePolicy: 'legacy-blind-aggregate' };
	return {
		reviews: reviews.filter(
			(review) => (review as PotentiallyModeAwareReview).reviewMode === 'blind'
		),
		modePolicy: 'explicit-blind-only'
	};
}

function atLeast(
	current: number,
	maximum: number,
	threshold: number,
	explanation: string
): AffinityGateCriterionReadiness {
	return {
		current,
		maximum,
		bestAttainable: maximum,
		threshold,
		thresholdOperator: 'at-least',
		satisfied: current >= threshold,
		attainable: maximum >= threshold,
		explanation
	};
}

function exactly(
	current: number,
	maximum: number,
	threshold: number,
	explanation: string
): AffinityGateCriterionReadiness {
	const attainable = current <= threshold && maximum >= threshold;
	return {
		current,
		maximum,
		bestAttainable: attainable ? threshold : current > threshold ? current : maximum,
		threshold,
		thresholdOperator: 'exactly',
		satisfied: current === threshold,
		attainable,
		explanation
	};
}

function atMostMonotonic(
	current: number,
	maximum: number,
	threshold: number,
	explanation: string
): AffinityGateCriterionReadiness {
	return {
		current,
		maximum,
		bestAttainable: current,
		threshold,
		thresholdOperator: 'at-most',
		satisfied: current <= threshold,
		attainable: current <= threshold,
		explanation
	};
}

/** Pure, deterministic derivation of controlled-gate readiness from validated scan inputs. */
export function buildAffinityGateReadiness(
	input: AffinityGateReadinessInput
): AffinityGateReadinessReport {
	const controlledTargets = input.controlledTargets.filter(
		(target) => target.cohort === 'controlled'
	);
	const controlledTargetById = new Map(
		controlledTargets.map((target) => [target.targetId, target] as const)
	);
	const controlledExecutions = input.executions.filter(
		(execution) =>
			execution.target.cohort === 'controlled' &&
			controlledTargetById.has(execution.target.targetId)
	);
	const executionByTargetId = new Map(
		controlledExecutions.map((execution) => [execution.target.targetId, execution] as const)
	);
	const unresolvedTargets = controlledTargets.filter(
		(target) => !executionByTargetId.has(target.targetId)
	);
	const candidateExecutions = controlledExecutions.filter(
		(execution) => execution.result.status === 'candidate'
	);
	const firstAttemptCandidateCount = candidateExecutions.filter(
		(execution) => execution.result.selectedAttemptId === execution.result.attempts[0]?.attemptId
	).length;

	const { reviews: blindReviews, modePolicy } = selectBlindReviews(input.blindReviews);
	const eligibleBlindReviews = blindReviews.filter((review) => {
		const execution = executionByTargetId.get(review.targetId);
		return execution && selectedCandidateHash(execution) === review.candidateContentHash;
	});
	const acceptedTargetIds = new Set(
		eligibleBlindReviews
			.filter((review) => review.verdict === 'candidate')
			.map((review) => review.targetId)
	);

	const speciesCorrectCount = eligibleBlindReviews.filter((review) => {
		const execution = executionByTargetId.get(review.targetId);
		return execution?.target.speciesId === review.identifiedSpeciesId;
	}).length;
	const affinityCorrectCount = eligibleBlindReviews.filter((review) => {
		const execution = executionByTargetId.get(review.targetId);
		return execution?.target.affinity === review.identifiedAffinity;
	}).length;
	const normalUnaffiliatedCount = eligibleBlindReviews.filter((review) => {
		const execution = executionByTargetId.get(review.targetId);
		return execution?.target.affinity === 'normal' && review.identifiedAffinity === 'normal';
	}).length;
	const acceptedMeaningfulNonNormalCount = candidateExecutions.filter((execution) => {
		return (
			execution.target.affinity !== 'normal' &&
			new Set(execution.target.affinityDesign.alteredDimensions).size >= 2 &&
			acceptedTargetIds.has(execution.target.targetId)
		);
	}).length;
	const acceptedCriticalVisualFailureCount = candidateExecutions.filter(
		(execution) =>
			acceptedTargetIds.has(execution.target.targetId) && containsCriticalVisualFailure(execution)
	).length;

	const unresolvedCount = unresolvedTargets.length;
	const candidateCapacity = candidateExecutions.length + unresolvedCount;
	const normalCandidateCapacity =
		candidateExecutions.filter((execution) => execution.target.affinity === 'normal').length +
		unresolvedTargets.filter((target) => target.affinity === 'normal').length;
	const meaningfulNonNormalCandidateCapacity =
		candidateExecutions.filter(
			(execution) =>
				execution.target.affinity !== 'normal' &&
				new Set(execution.target.affinityDesign.alteredDimensions).size >= 2
		).length +
		unresolvedTargets.filter(
			(target) =>
				target.affinity !== 'normal' && new Set(target.affinityDesign.alteredDimensions).size >= 2
		).length;
	const criticalFailureCapacity =
		candidateExecutions.filter(containsCriticalVisualFailure).length + unresolvedCount;

	const criteria = {
		firstAttemptCandidates: atLeast(
			firstAttemptCandidateCount,
			firstAttemptCandidateCount + unresolvedCount,
			AFFINITY_CONTROLLED_GATE_THRESHOLDS.firstAttemptCandidates,
			'Only unresolved controlled targets can still add a first-attempt candidate; completed retries are immutable evidence.'
		),
		speciesCorrectBlindReviews: atLeast(
			speciesCorrectCount,
			candidateCapacity,
			AFFINITY_CONTROLLED_GATE_THRESHOLDS.speciesCorrectBlindReviews,
			'Only producer candidates in the controlled cohort are eligible for hash-bound blind recognition review.'
		),
		affinityCorrectBlindReviews: atLeast(
			affinityCorrectCount,
			candidateCapacity,
			AFFINITY_CONTROLLED_GATE_THRESHOLDS.affinityCorrectBlindReviews,
			'Only producer candidates in the controlled cohort are eligible for hash-bound blind affinity review.'
		),
		normalUnaffiliatedBlindReviews: exactly(
			normalUnaffiliatedCount,
			normalCandidateCapacity,
			AFFINITY_CONTROLLED_GATE_THRESHOLDS.normalUnaffiliatedBlindReviews,
			'All four controlled Normal targets must be recognized as unaffiliated in eligible blind review.'
		),
		acceptedMeaningfulNonNormal: exactly(
			acceptedMeaningfulNonNormalCount,
			meaningfulNonNormalCandidateCapacity,
			AFFINITY_CONTROLLED_GATE_THRESHOLDS.acceptedMeaningfulNonNormal,
			'Every controlled non-Normal target must remain a producer candidate, alter at least two dimensions, and receive hash-bound human acceptance.'
		),
		acceptedCriticalVisualFailures: atMostMonotonic(
			acceptedCriticalVisualFailureCount,
			criticalFailureCapacity,
			AFFINITY_CONTROLLED_GATE_THRESHOLDS.acceptedCriticalVisualFailures,
			'Accepted critical visual failures are monotonic evidence; pending critical candidates can remain unaccepted.'
		)
	} satisfies Record<AffinityGateCriterionId, AffinityGateCriterionReadiness>;
	const criterionEntries = Object.entries(criteria) as Array<
		[AffinityGateCriterionId, AffinityGateCriterionReadiness]
	>;
	const workspaceIssues = [...(input.workspaceIssues ?? [])];
	const unattainableCriteria = criterionEntries
		.filter(([, criterion]) => !criterion.attainable)
		.map(([criterionId]) => criterionId);

	return {
		schemaVersion: 'affinity-controlled-gate-readiness-v1',
		experimentId: input.experimentId,
		workspace: {
			valid: workspaceIssues.length === 0,
			issueCount: workspaceIssues.length,
			issues: workspaceIssues
		},
		controlledCohort: {
			targetCount: controlledTargets.length,
			completedCount: controlledExecutions.length,
			unresolvedCount,
			candidateCount: candidateExecutions.length,
			reviseOrFailedCount: controlledExecutions.length - candidateExecutions.length
		},
		reviewEvidence: {
			recordCount: input.blindReviews.length,
			blindRecordCount: blindReviews.length,
			eligibleBlindRecordCount: eligibleBlindReviews.length,
			ignoredRecordCount: input.blindReviews.length - eligibleBlindReviews.length,
			modePolicy
		},
		criteria,
		gate: {
			currentlySatisfied:
				workspaceIssues.length === 0 &&
				criterionEntries.every(([, criterion]) => criterion.satisfied),
			attainableWithExistingControlledCohort: unattainableCriteria.length === 0,
			unattainableCriteria
		}
	};
}

export async function reportAffinityGateReadiness(
	workspaceRoot = process.cwd()
): Promise<AffinityGateReadinessReport> {
	const scan = await scanAffinityReviewWorkspace(workspaceRoot);
	const controlledTargets = createAffinityWorkflowExportBundle().targets.filter(
		(target) => target.cohort === 'controlled'
	);
	return buildAffinityGateReadiness({
		experimentId: scan.catalog.experimentId,
		controlledTargets,
		executions: scan.executions,
		blindReviews: scan.blindReviews.reviews,
		workspaceIssues: scan.issues
	});
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const report = await reportAffinityGateReadiness(process.cwd());
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (!report.workspace.valid) process.exitCode = 1;
}
