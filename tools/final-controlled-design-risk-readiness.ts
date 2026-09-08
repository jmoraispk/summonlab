import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	AffinityWorkflowReviewListSchema,
	FinalControlledDesignRisks,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type AffinityWorkflowReviewList,
	type AffinityWorkflowReviewRecord,
	type FinalControlledDesignRiskEvidenceBindings,
	type ImageProductionBlindReview,
	type ImageProductionCatalog,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { listAffinityWorkflowReviews } from '../packages/database/src/index.js';

import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	sha256Json,
	type ImageProductionBlindReviewCollection
} from './image-production-lib.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import { repositoryPathIsAbsent } from './report-final-controlled-activation-readiness.js';
import { validateAffinityWorkflowWorkspace } from './validate-affinity-workflow.js';

const SPECIES = ['death-knight', 'elemental', 'gray-wolf', 'cave-bear'] as const;
const AFFINITIES = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
export const FINAL_CONTROLLED_BASELINE_TARGET_IDS = SPECIES.flatMap((species) =>
	AFFINITIES.map((affinity) => `affinity-workflow-v1-${species}-${affinity}`)
).toSorted();

export interface FinalControlledDesignRiskReadinessReport {
	readonly schemaVersion: 'final-controlled-design-risk-readiness-v1';
	readonly status: 'ready' | 'blocked';
	readonly reviewer: string | null;
	readonly counts: {
		readonly targetCount: number;
		readonly resultCount: number;
		readonly candidateCount: number;
		readonly reviseCount: number;
		readonly exportedBlindReviewCount: number;
		readonly databaseLatestBlindReviewCount: number;
	};
	readonly evidenceBindings: FinalControlledDesignRiskEvidenceBindings | null;
	readonly blockers: readonly { readonly code: string; readonly detail: string }[];
}

export interface FinalControlledDesignRiskReadinessInput {
	readonly reviewer?: unknown;
	readonly plan?: unknown;
	readonly catalog?: unknown;
	readonly targets?: readonly unknown[];
	readonly results?: readonly unknown[];
	readonly blindReviewCollection?: unknown;
	readonly databaseReviewList?: unknown;
	readonly currentWorkspaceValid: boolean;
	readonly plannedPathsAbsent: boolean;
}

interface ParsedEvidence {
	readonly plan: FinalControlledRerunPlan | null;
	readonly catalog: ImageProductionCatalog | null;
	readonly targets: readonly ImageProductionTarget[];
	readonly results: readonly ImageProductionResult[];
	readonly reviews: ImageProductionBlindReviewCollection | null;
	readonly database: AffinityWorkflowReviewList | null;
}

function blocker(
	blockers: Array<{ code: string; detail: string }>,
	code: string,
	detail: string
): void {
	if (!blockers.some((entry) => entry.code === code && entry.detail === detail)) {
		blockers.push({ code, detail });
	}
}

function parseEvidence(
	input: FinalControlledDesignRiskReadinessInput,
	blockers: Array<{ code: string; detail: string }>
): ParsedEvidence {
	const plan = FinalControlledRerunPlanSchema.safeParse(input.plan);
	if (!plan.success) blocker(blockers, 'invalid-plan', plan.error.message);
	const catalog = ImageProductionCatalogSchema.safeParse(input.catalog);
	if (!catalog.success) blocker(blockers, 'invalid-catalog', catalog.error.message);
	const targets = (input.targets ?? []).map((value) =>
		ImageProductionTargetSchema.safeParse(value)
	);
	if (targets.some((result) => !result.success)) {
		blocker(blockers, 'invalid-targets', 'One or more baseline target manifests are invalid.');
	}
	const results = (input.results ?? []).map((value) =>
		ImageProductionResultSchema.safeParse(value)
	);
	if (results.some((result) => !result.success)) {
		blocker(blockers, 'invalid-results', 'One or more baseline result records are invalid.');
	}
	const reviews = ImageProductionBlindReviewCollectionSchema.safeParse(input.blindReviewCollection);
	if (!reviews.success) {
		blocker(
			blockers,
			input.blindReviewCollection === undefined
				? 'blind-review-collection-missing'
				: 'blind-review-collection-invalid',
			reviews.error.message
		);
	}
	const database = AffinityWorkflowReviewListSchema.safeParse(input.databaseReviewList);
	if (!database.success) {
		blocker(
			blockers,
			'database-reviews-unavailable',
			'Review database evidence is unavailable or invalid.'
		);
	}
	return {
		plan: plan.success ? plan.data : null,
		catalog: catalog.success ? catalog.data : null,
		targets: targets.flatMap((result) => (result.success ? [result.data] : [])),
		results: results.flatMap((result) => (result.success ? [result.data] : [])),
		reviews: reviews.success ? reviews.data : null,
		database: database.success ? database.data : null
	};
}

export function buildFinalControlledExecutionSnapshot(
	targets: readonly ImageProductionTarget[],
	results: readonly ImageProductionResult[]
) {
	return targets
		.map((target) => {
			const result = results.find((item) => item.targetId === target.targetId);
			return {
				targetId: target.targetId,
				targetHash: sha256Json(target),
				resultId: result?.resultId ?? null,
				resultHash: result ? sha256Json(result) : null,
				status: result?.status ?? null
			};
		})
		.toSorted((left, right) => left.targetId.localeCompare(right.targetId));
}

function verifyInventory(
	evidence: ParsedEvidence,
	blockers: Array<{ code: string; detail: string }>
): { candidateTargetIds: readonly string[]; candidateCount: number; reviseCount: number } {
	const expectedIds = FINAL_CONTROLLED_BASELINE_TARGET_IDS;
	const targetIds = evidence.targets.map((target) => target.targetId).toSorted();
	if (
		evidence.targets.length !== 24 ||
		new Set(targetIds).size !== 24 ||
		JSON.stringify(targetIds) !== JSON.stringify(expectedIds)
	) {
		blocker(
			blockers,
			'baseline-target-inventory-mismatch',
			`Expected the exact 24 baseline targets; found ${evidence.targets.length}.`
		);
	}
	const resultIds = evidence.results.map((result) => result.targetId).toSorted();
	if (
		evidence.results.length !== 24 ||
		new Set(resultIds).size !== 24 ||
		JSON.stringify(resultIds) !== JSON.stringify(expectedIds)
	) {
		blocker(
			blockers,
			'baseline-result-inventory-mismatch',
			`Expected one result for each of 24 baseline targets; found ${evidence.results.length}.`
		);
	}
	const catalogEntries =
		evidence.catalog?.entries.filter((entry) => expectedIds.includes(entry.targetId)) ?? [];
	if (catalogEntries.length !== 24) {
		blocker(
			blockers,
			'baseline-catalog-inventory-mismatch',
			`Expected 24 baseline catalog entries; found ${catalogEntries.length}.`
		);
	}
	for (const target of evidence.targets) {
		const result = evidence.results.find((item) => item.targetId === target.targetId);
		const entry = catalogEntries.find((item) => item.targetId === target.targetId);
		const selected = result?.attempts.find(
			(attempt) => attempt.attemptId === result.selectedAttemptId
		);
		if (
			!result ||
			!entry ||
			result.resultId !== entry.resultId ||
			result.assignmentId !== entry.assignmentId ||
			result.status !== entry.status ||
			target.speciesId !== entry.speciesId ||
			target.affinity !== entry.affinity ||
			target.cohort !== 'controlled' ||
			entry.cohort !== 'controlled'
		) {
			blocker(
				blockers,
				'baseline-execution-binding-mismatch',
				`Target, result, and catalog identity differ for ${target.targetId}.`
			);
			continue;
		}
		if (
			result.status === 'candidate' &&
			(!selected?.output ||
				selected.output.path !== entry.candidatePath ||
				selected.output.contentHash !== entry.candidateHash)
		) {
			blocker(
				blockers,
				'candidate-output-binding-mismatch',
				`Candidate output does not match the catalog for ${target.targetId}.`
			);
		}
	}
	const candidateEntries = catalogEntries.filter((entry) => entry.status === 'candidate');
	const reviseEntries = catalogEntries.filter((entry) => entry.status === 'revise');
	if (candidateEntries.length !== 21 || reviseEntries.length !== 3) {
		blocker(
			blockers,
			'baseline-status-inventory-mismatch',
			`Expected exactly 21 candidates and 3 revise results; found ${candidateEntries.length}/${reviseEntries.length}.`
		);
	}
	return {
		candidateTargetIds: candidateEntries.map((entry) => entry.targetId).toSorted(),
		candidateCount: candidateEntries.length,
		reviseCount: reviseEntries.length
	};
}

function verifyExactSourceAudit(
	plan: FinalControlledRerunPlan | null,
	blockers: Array<{ code: string; detail: string }>
): void {
	if (!plan) return;
	const actual = plan.designRiskReview.risks.map((risk) => ({
		riskId: risk.riskId,
		coordinate: risk.coordinate,
		sourceTargetId: risk.sourceTargetId,
		severity: risk.severity
	}));
	if (JSON.stringify(actual) !== JSON.stringify(FinalControlledDesignRisks)) {
		blocker(
			blockers,
			'source-audit-risk-set-mismatch',
			'The plan source audit does not match the exact 16 contract-owned risk bindings.'
		);
	}
}

function projectDatabaseReview(
	record: AffinityWorkflowReviewRecord,
	target: ImageProductionTarget
): ImageProductionBlindReview {
	return {
		reviewId: record.reviewId,
		targetId: record.targetId,
		candidateContentHash: record.candidateContentHash,
		reviewer: record.reviewer,
		reviewMode: 'blind',
		reviewedAt: record.reviewedAt,
		identifiedSpeciesId: record.identifiedSpeciesId,
		identifiedAffinity: record.identifiedAffinity,
		speciesCorrect: record.identifiedSpeciesId === target.speciesId,
		affinityCorrect: record.identifiedAffinity === target.affinity,
		scores: record.scores,
		verdict: record.verdict,
		note: record.note
	};
}

function verifyDatabaseAuthenticity(
	evidence: ParsedEvidence,
	reviewer: string | null,
	candidateTargetIds: readonly string[],
	blockers: Array<{ code: string; detail: string }>
): number {
	if (!reviewer || !evidence.database || !evidence.reviews || !evidence.catalog) return 0;
	const candidateEntries = new Map(
		evidence.catalog.entries
			.filter(
				(entry) => entry.status === 'candidate' && candidateTargetIds.includes(entry.targetId)
			)
			.map((entry) => [entry.targetId, entry])
	);
	const latestBlind = evidence.database.latestByTargetReviewer.filter(
		(record) =>
			record.reviewer === reviewer &&
			record.reviewMode === 'blind' &&
			candidateTargetIds.includes(record.targetId)
	);
	const apiOnlyTargets = candidateTargetIds.filter(
		(targetId) =>
			!latestBlind.some((record) => record.targetId === targetId) &&
			evidence.database!.latestByTargetReviewer.some(
				(record) =>
					record.reviewer === reviewer &&
					record.targetId === targetId &&
					record.reviewMode !== 'blind'
			)
	);
	if (apiOnlyTargets.length) {
		blocker(
			blockers,
			'api-unverified-review-not-eligible',
			`${apiOnlyTargets.length} targets have only api/legacy-unverified evidence for this reviewer.`
		);
	}
	if (
		latestBlind.length !== 21 ||
		new Set(latestBlind.map((record) => record.targetId)).size !== 21
	) {
		blocker(
			blockers,
			'database-latest-blind-review-inventory-mismatch',
			`Expected 21 latest blind database reviews for ${reviewer}; found ${latestBlind.length}.`
		);
	}
	for (const record of latestBlind) {
		const entry = candidateEntries.get(record.targetId);
		if (!entry || entry.candidateHash !== record.candidateContentHash) {
			blocker(
				blockers,
				'stale-database-review',
				`Database review ${record.reviewId} is not bound to a current candidate.`
			);
		}
	}
	for (const review of evidence.reviews.reviews) {
		if (review.reviewer !== reviewer) {
			blocker(
				blockers,
				'wrong-reviewer',
				`Exported review ${review.reviewId} belongs to ${review.reviewer}, not ${reviewer}.`
			);
		}
		const entry = candidateEntries.get(review.targetId);
		if (!entry) {
			blocker(
				blockers,
				'noncandidate-review-substitution',
				`Exported review ${review.reviewId} does not belong to one of the 21 candidates.`
			);
		} else if (entry.candidateHash !== review.candidateContentHash) {
			blocker(
				blockers,
				'stale-exported-review',
				`Exported review ${review.reviewId} has a stale candidate hash.`
			);
		}
	}
	const projected = latestBlind
		.flatMap((record) => {
			const target = evidence.targets.find((item) => item.targetId === record.targetId);
			return target ? [projectDatabaseReview(record, target)] : [];
		})
		.toSorted((left, right) => left.targetId.localeCompare(right.targetId));
	const updatedAt = projected.reduce(
		(latest, review) =>
			Date.parse(review.reviewedAt) > Date.parse(latest) ? review.reviewedAt : latest,
		projected[0]?.reviewedAt ?? '1970-01-01T00:00:00.000Z'
	);
	const expectedCollection = ImageProductionBlindReviewCollectionSchema.safeParse({
		schemaVersion: 'image-production-blind-reviews-v1',
		experimentId: 'affinity-workflow-v1',
		updatedAt,
		reviews: projected
	});
	if (
		!expectedCollection.success ||
		sha256Json(expectedCollection.data) !== sha256Json(evidence.reviews)
	) {
		blocker(
			blockers,
			'blind-review-database-binding-mismatch',
			'Exported blind review collection is not the exact latest database projection for this reviewer.'
		);
	}
	return latestBlind.length;
}

export function buildFinalControlledDesignRiskReadiness(
	input: FinalControlledDesignRiskReadinessInput
): FinalControlledDesignRiskReadinessReport {
	const blockers: Array<{ code: string; detail: string }> = [];
	const reviewer =
		typeof input.reviewer === 'string' && input.reviewer.trim().length > 0
			? input.reviewer.trim()
			: null;
	if (!reviewer) {
		blocker(blockers, 'reviewer-required', 'An explicit reviewer identity is required.');
	}
	if (!input.currentWorkspaceValid) {
		blocker(
			blockers,
			'workspace-invalid',
			'The current affinity workflow workspace does not validate.'
		);
	}
	if (!input.plannedPathsAbsent) {
		blocker(
			blockers,
			'final-path-collision',
			'One or more reserved final-controlled paths already exist.'
		);
	}
	const evidence = parseEvidence(input, blockers);
	verifyExactSourceAudit(evidence.plan, blockers);
	const inventory = verifyInventory(evidence, blockers);
	if (evidence.reviews?.reviews.length !== 21) {
		blocker(
			blockers,
			'exported-blind-review-inventory-mismatch',
			`Expected exactly 21 exported blind reviews; found ${evidence.reviews?.reviews.length ?? 0}.`
		);
	}
	const databaseLatestBlindReviewCount = verifyDatabaseAuthenticity(
		evidence,
		reviewer,
		inventory.candidateTargetIds,
		blockers
	);
	const ready = blockers.length === 0;
	const evidenceBindings =
		ready && evidence.plan && evidence.catalog && evidence.reviews
			? {
					planCanonicalSha256: sha256Json(evidence.plan),
					catalogCanonicalSha256: sha256Json(evidence.catalog),
					executionSnapshotCanonicalSha256: sha256Json(
						buildFinalControlledExecutionSnapshot(evidence.targets, evidence.results)
					),
					blindReviewCollectionCanonicalSha256: sha256Json(evidence.reviews),
					sourceAuditCanonicalSha256: sha256Json(evidence.plan.designRiskReview)
				}
			: null;
	return {
		schemaVersion: 'final-controlled-design-risk-readiness-v1',
		status: ready ? 'ready' : 'blocked',
		reviewer,
		counts: {
			targetCount: evidence.targets.length,
			resultCount: evidence.results.length,
			candidateCount: inventory.candidateCount,
			reviseCount: inventory.reviseCount,
			exportedBlindReviewCount: evidence.reviews?.reviews.length ?? 0,
			databaseLatestBlindReviewCount
		},
		evidenceBindings,
		blockers
	};
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

export interface FinalControlledDesignRiskReporterDependencies {
	readonly loadDatabaseReviews?: (
		databaseUrl: string,
		experimentId: 'affinity-workflow-v1'
	) => Promise<AffinityWorkflowReviewList>;
}

export async function reportFinalControlledDesignRiskReadiness(
	reviewerInput: unknown,
	workspaceRoot = process.cwd(),
	dependencies: FinalControlledDesignRiskReporterDependencies = {}
): Promise<FinalControlledDesignRiskReadinessReport> {
	const reviewer = typeof reviewerInput === 'string' ? reviewerInput.trim() : '';
	const root = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const plan = await readJson(path.join(root, 'review/final-controlled-rerun-plan.json')).catch(
		() => undefined
	);
	const catalog = await readJson(path.join(root, 'review/catalog.json')).catch(() => undefined);
	const blindReviewCollection = await readJson(path.join(root, 'review/blind-review.json')).catch(
		() => undefined
	);
	const targets = await Promise.all(
		SPECIES.flatMap((species) =>
			AFFINITIES.map((affinity) =>
				readJson(path.join(root, `targets/${species}/${affinity}.json`)).catch(() => undefined)
			)
		)
	);
	const results = await Promise.all(
		targets.map((target) => {
			const parsed = ImageProductionTargetSchema.safeParse(target);
			return parsed.success
				? readJson(path.resolve(workspaceRoot, parsed.data.output.resultPath)).catch(
						() => undefined
					)
				: Promise.resolve(undefined);
		})
	);
	let databaseReviewList: AffinityWorkflowReviewList | undefined;
	if (reviewer) {
		try {
			databaseReviewList = await (dependencies.loadDatabaseReviews ?? listAffinityWorkflowReviews)(
				getConfig().databaseUrl,
				'affinity-workflow-v1'
			);
		} catch {
			databaseReviewList = undefined;
		}
	}
	const parsedPlan = FinalControlledRerunPlanSchema.safeParse(plan);
	const plannedPathsAbsent = parsedPlan.success
		? await Promise.all(
				buildFinalControlledRerunBundle(parsedPlan.data).plannedPaths.map((plannedPath) =>
					repositoryPathIsAbsent(workspaceRoot, plannedPath).catch(() => false)
				)
			).then((values) => values.every(Boolean))
		: false;
	const currentWorkspaceValid = await validateAffinityWorkflowWorkspace(workspaceRoot).then(
		() => true,
		() => false
	);
	return buildFinalControlledDesignRiskReadiness({
		reviewer,
		plan,
		catalog,
		targets,
		results,
		blindReviewCollection,
		databaseReviewList,
		currentWorkspaceValid,
		plannedPathsAbsent
	});
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const reviewerIndex = process.argv.indexOf('--reviewer');
	const reviewer = reviewerIndex >= 0 ? process.argv[reviewerIndex + 1] : undefined;
	const report = await reportFinalControlledDesignRiskReadiness(reviewer);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (report.status !== 'ready') process.exitCode = 1;
}
