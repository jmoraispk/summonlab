import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionEvaluationSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionAssignment,
	type ImageProductionBlindReview,
	type ImageProductionCatalog,
	type ImageProductionCatalogEntry,
	type ImageProductionEvaluation,
	type ImageProductionOutput,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import {
	AFFINITY_EXPERIMENT_ROOT,
	AFFINITY_EXPORT_TIMESTAMP,
	ImageProductionBlindReviewCollectionSchema,
	assignmentArtifactPath,
	canonicalJson,
	createAffinityWorkflowExportBundle,
	sha256Json,
	targetArtifactPath,
	type ImageProductionBlindReviewCollection
} from './image-production-lib.js';
import sharp from 'sharp';

const CATALOG_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json` as const;
const BLIND_REVIEW_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/blind-review.json` as const;
const EVALUATION_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json` as const;

export type AffinityReviewSyncIssueKind =
	| 'invalid-artifact'
	| 'manifest-mismatch'
	| 'orphan-artifact'
	| 'path-conflict'
	| 'missing-output'
	| 'provenance-mismatch'
	| 'review-mismatch';

export interface AffinityReviewSyncIssue {
	readonly kind: AffinityReviewSyncIssueKind;
	readonly path: string;
	readonly targetId: string | null;
	readonly message: string;
}

export interface ValidatedImageProductionExecution {
	readonly target: ImageProductionTarget;
	readonly assignment: ImageProductionAssignment;
	readonly result: ImageProductionResult;
}

export interface AffinityReviewScan {
	readonly executions: readonly ValidatedImageProductionExecution[];
	readonly missingResultTargetIds: readonly string[];
	readonly issues: readonly AffinityReviewSyncIssue[];
	readonly catalog: ImageProductionCatalog;
	readonly blindReviews: ImageProductionBlindReviewCollection;
	readonly evaluation: ImageProductionEvaluation;
}

export interface AffinityReviewState {
	readonly catalog: ImageProductionCatalog;
	readonly evaluation: ImageProductionEvaluation;
}

export interface AffinityReviewSyncReport {
	readonly mode: 'check' | 'write';
	readonly written: boolean;
	readonly inSync: boolean;
	readonly executionCount: number;
	readonly missingResultCount: number;
	readonly catalogEntryCount: number;
	readonly issueCount: number;
	readonly pathConflictCount: number;
	readonly integrationErrorCount: number;
	readonly issues: readonly AffinityReviewSyncIssue[];
	readonly catalogHash: string;
}

async function listFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const files = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(root, entry.name);
			return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
		})
	);
	return files.flat().sort((left, right) => left.localeCompare(right));
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function relativePath(workspaceRoot: string, absolutePath: string): string {
	return path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
}

function issue(
	kind: AffinityReviewSyncIssueKind,
	artifactPath: string,
	message: string,
	targetId: string | null = null
): AffinityReviewSyncIssue {
	return { kind, path: artifactPath, targetId, message };
}

function selectedOutput(result: ImageProductionResult): ImageProductionOutput | null {
	return (
		result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output ??
		null
	);
}

function latestOutput(result: ImageProductionResult): ImageProductionOutput | null {
	return [...result.attempts].reverse().find((attempt) => attempt.output !== null)?.output ?? null;
}

function reviewOutput(result: ImageProductionResult): ImageProductionOutput | null {
	return result.status === 'candidate' ? selectedOutput(result) : latestOutput(result);
}

async function verifyOutputFile(
	workspaceRoot: string,
	output: ImageProductionOutput,
	issues: AffinityReviewSyncIssue[],
	targetId: string
): Promise<void> {
	const outputPath = path.resolve(workspaceRoot, output.path);
	try {
		const bytes = await readFile(outputPath);
		const metadata = await sharp(bytes).metadata();
		const mediaType =
			metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
		if (
			bytes.byteLength !== output.bytes ||
			sha256(bytes) !== output.contentHash ||
			metadata.width !== output.width ||
			metadata.height !== output.height ||
			mediaType !== output.mediaType
		) {
			issues.push(
				issue(
					'provenance-mismatch',
					output.path,
					'Candidate bytes, hash, dimensions, or media type do not match the result record.',
					targetId
				)
			);
		}
	} catch (error) {
		issues.push(
			issue(
				'missing-output',
				output.path,
				`Result output cannot be read: ${error instanceof Error ? error.message : String(error)}`,
				targetId
			)
		);
	}
}

function duplicateValues<T>(values: readonly T[]): Set<T> {
	const seen = new Set<T>();
	const duplicates = new Set<T>();
	for (const value of values) {
		if (seen.has(value)) duplicates.add(value);
		seen.add(value);
	}
	return duplicates;
}

function latestTimestamp(values: readonly string[]): string {
	return values.length === 0
		? AFFINITY_EXPORT_TIMESTAMP
		: [...values].sort((left, right) => Date.parse(left) - Date.parse(right)).at(-1)!;
}

function catalogEntry(
	execution: ValidatedImageProductionExecution,
	review: ImageProductionBlindReview | undefined,
	priorEntry: ImageProductionCatalogEntry | undefined
): ImageProductionCatalogEntry {
	const { target, assignment, result } = execution;
	const output = reviewOutput(result);
	const boundReview = review?.candidateContentHash === output?.contentHash ? review : undefined;
	const samePriorCandidate =
		priorEntry?.resultId === result.resultId &&
		priorEntry.candidatePath === (output?.path ?? null) &&
		priorEntry.candidateHash === (output?.contentHash ?? null);
	let reviewState: ImageProductionCatalogEntry['reviewState'] = 'pending';
	if (result.status === 'candidate' && boundReview) {
		reviewState = boundReview.verdict === 'candidate' ? 'accepted' : 'revise';
	} else if (samePriorCandidate && priorEntry?.reviewState !== 'accepted') {
		// Preserve a prior human rejection/revision, but never infer acceptance without a review.
		reviewState = priorEntry?.reviewState ?? 'pending';
	}
	return {
		targetId: target.targetId,
		resultId: result.resultId,
		assignmentId: assignment.assignmentId,
		speciesId: target.speciesId,
		affinity: target.affinity,
		cohort: target.cohort,
		status: result.status,
		candidatePath: output?.path ?? null,
		candidateHash: output?.contentHash ?? null,
		reviewState,
		promoted: false
	};
}

function isCriticalVisualFailure(result: ImageProductionResult): boolean {
	const selected = result.attempts.find(
		(attempt) => attempt.attemptId === result.selectedAttemptId
	);
	return (
		selected?.findings.some(
			(finding) =>
				finding.outcome === 'fail' &&
				['anatomy', 'canvas-completion', 'framing', 'silhouette'].includes(finding.category)
		) ?? false
	);
}

function controlledThresholdsPass(evaluation: ImageProductionEvaluation): boolean {
	return (
		evaluation.controlled.firstAttemptCandidateCount >= 20 &&
		evaluation.controlled.speciesCorrectCount >= 23 &&
		evaluation.controlled.affinityCorrectCount >= 20 &&
		evaluation.controlled.normalUnaffiliatedCount === 4 &&
		evaluation.controlled.acceptedMeaningfulAffinityCount === 20 &&
		evaluation.controlled.acceptedCriticalVisualFailureCount === 0 &&
		evaluation.workflow.pathConflictCount === 0 &&
		evaluation.workflow.sharedFileEditCount === 0 &&
		evaluation.workflow.retryCeilingViolationCount === 0 &&
		evaluation.workflow.completedTargetCount === evaluation.workflow.completeProvenanceCount
	);
}

/** Pure deterministic aggregate builder. It never promotes or invents human approval. */
export function buildAffinityReviewState(input: {
	readonly executions: readonly ValidatedImageProductionExecution[];
	readonly blindReviews: ImageProductionBlindReviewCollection;
	readonly priorCatalog: ImageProductionCatalog;
	readonly priorEvaluation: ImageProductionEvaluation;
	readonly pathConflictCount?: number;
}): AffinityReviewState {
	const executions = [...input.executions].sort((left, right) =>
		left.target.targetId.localeCompare(right.target.targetId)
	);
	const reviewsByTarget = new Map(
		input.blindReviews.reviews.map((review) => [review.targetId, review])
	);
	const priorEntriesByTarget = new Map(
		input.priorCatalog.entries.map((entry) => [entry.targetId, entry])
	);
	const entries = executions.map((execution) =>
		catalogEntry(
			execution,
			reviewsByTarget.get(execution.target.targetId),
			priorEntriesByTarget.get(execution.target.targetId)
		)
	);
	const generatedAt = latestTimestamp([
		...executions.map(({ result }) => result.completedAt),
		...input.blindReviews.reviews.map((review) => review.reviewedAt),
		input.blindReviews.updatedAt,
		input.priorEvaluation.generatedAt
	]);
	const catalog = ImageProductionCatalogSchema.parse({
		schemaVersion: 'image-production-catalog-v1',
		experimentId: input.priorCatalog.experimentId,
		generatedAt,
		status: 'experimental-unpromoted',
		entries
	});
	const controlledExecutions = executions.filter(({ target }) => target.cohort === 'controlled');
	const controlledReviews = input.blindReviews.reviews.filter((review) =>
		controlledExecutions.some(({ target }) => target.targetId === review.targetId)
	);
	const resultsById = new Map(executions.map(({ result }) => [result.resultId, result]));
	const targetsById = new Map(executions.map(({ target }) => [target.targetId, target]));
	const controlled = {
		targetCount: 24 as const,
		firstAttemptCandidateCount: controlledExecutions.filter(
			({ result }) =>
				result.status === 'candidate' && result.selectedAttemptId === result.attempts[0]?.attemptId
		).length,
		speciesCorrectCount: controlledReviews.filter((review) => review.speciesCorrect).length,
		affinityCorrectCount: controlledReviews.filter((review) => review.affinityCorrect).length,
		normalUnaffiliatedCount: controlledReviews.filter(
			(review) => review.affinityCorrect && targetsById.get(review.targetId)?.affinity === 'normal'
		).length,
		acceptedMeaningfulAffinityCount: entries.filter((entry) => {
			const target = targetsById.get(entry.targetId);
			return (
				target?.cohort === 'controlled' &&
				target.affinity !== 'normal' &&
				entry.reviewState === 'accepted'
			);
		}).length,
		acceptedCriticalVisualFailureCount: entries.filter((entry) => {
			if (entry.reviewState !== 'accepted') return false;
			const result = resultsById.get(entry.resultId);
			return result ? isCriticalVisualFailure(result) : false;
		}).length
	};
	const workflow = {
		completedTargetCount: entries.length,
		completeProvenanceCount: executions.length,
		pathConflictCount: input.pathConflictCount ?? 0,
		sharedFileEditCount: executions.filter(({ result }) => !result.noSharedFilesEdited).length,
		retryCeilingViolationCount: executions.filter(
			({ assignment, result }) => result.attempts.length > assignment.retryCeiling + 1
		).length
	};
	const evaluationBase = {
		schemaVersion: 'image-production-evaluation-v1' as const,
		experimentId: input.priorEvaluation.experimentId,
		generatedAt,
		catalogHash: sha256Json(catalog),
		status: 'incomplete' as const,
		controlled,
		workflow,
		blindReviews: input.blindReviews.reviews,
		concurrencyStages: input.priorEvaluation.concurrencyStages,
		failureClassifications: input.priorEvaluation.failureClassifications,
		recommendedSafeConcurrency: input.priorEvaluation.recommendedSafeConcurrency,
		completionNotes: input.priorEvaluation.completionNotes
	};
	const status =
		input.priorEvaluation.status === 'passed' &&
		controlledThresholdsPass(ImageProductionEvaluationSchema.parse(evaluationBase))
			? 'passed'
			: input.priorEvaluation.status === 'failed'
				? 'failed'
				: 'incomplete';
	const evaluation = ImageProductionEvaluationSchema.parse({ ...evaluationBase, status });
	return { catalog, evaluation };
}

async function parseArtifacts<T>(input: {
	readonly workspaceRoot: string;
	readonly files: readonly string[];
	readonly schema: { parse(value: unknown): T };
	readonly label: string;
	readonly issues: AffinityReviewSyncIssue[];
}): Promise<Array<{ path: string; value: T }>> {
	const parsed: Array<{ path: string; value: T }> = [];
	for (const absolutePath of input.files) {
		const artifactPath = relativePath(input.workspaceRoot, absolutePath);
		try {
			parsed.push({ path: artifactPath, value: input.schema.parse(await readJson(absolutePath)) });
		} catch (error) {
			input.issues.push(
				issue(
					'invalid-artifact',
					artifactPath,
					`Invalid ${input.label}: ${error instanceof Error ? error.message : String(error)}`
				)
			);
		}
	}
	return parsed;
}

/** Read-only scan. Partial result cohorts are valid; malformed or orphaned artifacts are reported. */
export async function scanAffinityReviewWorkspace(
	workspaceRoot = process.cwd()
): Promise<AffinityReviewScan> {
	const issues: AffinityReviewSyncIssue[] = [];
	const bundle = createAffinityWorkflowExportBundle();
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const targetFiles = await listFiles(path.join(experimentRoot, 'targets'));
	const assignmentFiles = await listFiles(path.join(experimentRoot, 'assignments'));
	const resultFiles = await listFiles(path.join(experimentRoot, 'results'));
	const candidateFiles = await listFiles(path.join(experimentRoot, 'candidates'));
	const parsedTargets = await parseArtifacts({
		workspaceRoot,
		files: targetFiles,
		schema: ImageProductionTargetSchema,
		label: 'target',
		issues
	});
	const parsedAssignments = await parseArtifacts({
		workspaceRoot,
		files: assignmentFiles,
		schema: ImageProductionAssignmentSchema,
		label: 'assignment',
		issues
	});
	const parsedResults = await parseArtifacts({
		workspaceRoot,
		files: resultFiles,
		schema: ImageProductionResultSchema,
		label: 'result',
		issues
	});

	const expectedTargets = new Map<string, ImageProductionTarget>(
		bundle.targets.map((target) => [targetArtifactPath(target), target])
	);
	const expectedAssignments = new Map<string, ImageProductionAssignment>(
		bundle.assignments.map((assignment) => {
			const target = bundle.targets.find(
				(candidate) => candidate.targetId === assignment.targetId
			)!;
			return [assignmentArtifactPath(target), assignment] as const;
		})
	);
	for (const [artifactPath, expected] of expectedTargets) {
		const actual = parsedTargets.find((entry) => entry.path === artifactPath)?.value;
		if (!actual || canonicalJson(actual) !== canonicalJson(expected)) {
			issues.push(issue('manifest-mismatch', artifactPath, 'Target manifest is missing or stale.'));
		}
	}
	for (const entry of parsedTargets) {
		if (!expectedTargets.has(entry.path)) {
			issues.push(issue('orphan-artifact', entry.path, 'Unexpected target manifest.'));
		}
	}
	for (const [artifactPath, expected] of expectedAssignments) {
		const actual = parsedAssignments.find((entry) => entry.path === artifactPath)?.value;
		if (!actual || canonicalJson(actual) !== canonicalJson(expected)) {
			issues.push(
				issue('manifest-mismatch', artifactPath, 'Assignment manifest is missing or stale.')
			);
		}
	}
	for (const entry of parsedAssignments) {
		if (!expectedAssignments.has(entry.path)) {
			issues.push(issue('orphan-artifact', entry.path, 'Unexpected assignment manifest.'));
		}
	}

	const targets = parsedTargets.map(({ value }) => value);
	const assignments = parsedAssignments.map(({ value }) => value);
	for (const value of duplicateValues(targets.map((target) => target.targetId))) {
		issues.push(issue('path-conflict', 'targets', `Duplicate target ID: ${value}`, String(value)));
	}
	for (const value of duplicateValues(assignments.map((entry) => entry.assignmentId))) {
		issues.push(issue('path-conflict', 'assignments', `Duplicate assignment ID: ${value}`));
	}
	for (const value of duplicateValues(assignments.map((entry) => entry.targetId))) {
		issues.push(
			issue('path-conflict', 'assignments', `Multiple assignments target ${value}.`, String(value))
		);
	}
	for (const outputPath of duplicateValues(targets.map((target) => target.output.candidatePath))) {
		issues.push(
			issue('path-conflict', outputPath, 'Multiple targets own the same candidate output path.')
		);
	}
	for (const outputPath of duplicateValues(targets.map((target) => target.output.resultPath))) {
		issues.push(
			issue('path-conflict', outputPath, 'Multiple targets own the same result output path.')
		);
	}
	for (const outputPath of duplicateValues(
		assignments.flatMap((assignment) => Object.values(assignment.permittedOutputs))
	)) {
		issues.push(
			issue('path-conflict', outputPath, 'Multiple assignments permit the same output path.')
		);
	}
	for (const value of duplicateValues(parsedResults.map(({ value }) => value.resultId))) {
		issues.push(issue('path-conflict', 'results', `Duplicate result ID: ${value}`));
	}
	for (const value of duplicateValues(parsedResults.map(({ value }) => value.targetId))) {
		issues.push(
			issue('path-conflict', 'results', `Multiple results target ${value}.`, String(value))
		);
	}

	const targetsById = new Map(targets.map((target) => [target.targetId, target]));
	const assignmentsById = new Map(assignments.map((entry) => [entry.assignmentId, entry]));
	const executions: ValidatedImageProductionExecution[] = [];
	for (const { path: resultPath, value: result } of parsedResults) {
		const target = targetsById.get(result.targetId);
		const assignment = assignmentsById.get(result.assignmentId);
		if (!target || !assignment) {
			issues.push(
				issue(
					'orphan-artifact',
					resultPath,
					'Result refers to an unknown target or assignment.',
					result.targetId
				)
			);
			continue;
		}
		if (resultPath !== target.output.resultPath) {
			issues.push(
				issue(
					'path-conflict',
					resultPath,
					`Result must be stored at ${target.output.resultPath}.`,
					target.targetId
				)
			);
			continue;
		}
		try {
			validateImageProductionExecution({ target, assignment, result });
			executions.push({ target, assignment, result });
		} catch (error) {
			issues.push(
				issue(
					'provenance-mismatch',
					resultPath,
					`Execution contract failed: ${error instanceof Error ? error.message : String(error)}`,
					target.targetId
				)
			);
		}
	}

	const allowedCandidates = new Map(
		targets.map((target) => [target.output.candidatePath, target.targetId])
	);
	const executionsByTarget = new Map(
		executions.map((execution) => [execution.target.targetId, execution])
	);
	for (const candidateFile of candidateFiles) {
		const candidatePath = relativePath(workspaceRoot, candidateFile);
		const targetId = allowedCandidates.get(candidatePath);
		const execution = targetId ? executionsByTarget.get(targetId) : undefined;
		const output = execution ? reviewOutput(execution.result) : null;
		if (!targetId || !execution || output?.path !== candidatePath) {
			issues.push(
				issue(
					'orphan-artifact',
					candidatePath,
					'Candidate image has no matching strictly valid result.',
					targetId ?? null
				)
			);
		}
	}
	for (const execution of executions) {
		const output = reviewOutput(execution.result);
		if (output) await verifyOutputFile(workspaceRoot, output, issues, execution.target.targetId);
	}

	let catalog = bundle.catalog;
	let blindReviews = bundle.blindReviews;
	let evaluation = bundle.evaluation;
	try {
		catalog = ImageProductionCatalogSchema.parse(
			await readJson(path.resolve(workspaceRoot, CATALOG_PATH))
		);
		if (catalog.experimentId !== bundle.catalog.experimentId) {
			issues.push(issue('review-mismatch', CATALOG_PATH, 'Catalog belongs to another experiment.'));
			catalog = bundle.catalog;
		}
	} catch (error) {
		issues.push(
			issue(
				'invalid-artifact',
				CATALOG_PATH,
				`Invalid catalog: ${error instanceof Error ? error.message : String(error)}`
			)
		);
	}
	try {
		blindReviews = ImageProductionBlindReviewCollectionSchema.parse(
			await readJson(path.resolve(workspaceRoot, BLIND_REVIEW_PATH))
		);
	} catch (error) {
		issues.push(
			issue(
				'invalid-artifact',
				BLIND_REVIEW_PATH,
				`Invalid blind-review aggregate: ${error instanceof Error ? error.message : String(error)}`
			)
		);
	}
	try {
		evaluation = ImageProductionEvaluationSchema.parse(
			await readJson(path.resolve(workspaceRoot, EVALUATION_PATH))
		);
		if (evaluation.experimentId !== bundle.evaluation.experimentId) {
			issues.push(
				issue('review-mismatch', EVALUATION_PATH, 'Evaluation belongs to another experiment.')
			);
			evaluation = bundle.evaluation;
		}
	} catch (error) {
		issues.push(
			issue(
				'invalid-artifact',
				EVALUATION_PATH,
				`Invalid evaluation: ${error instanceof Error ? error.message : String(error)}`
			)
		);
	}
	for (const review of blindReviews.reviews) {
		const execution = executionsByTarget.get(review.targetId);
		if (!execution || execution.result.status !== 'candidate') {
			issues.push(
				issue(
					'review-mismatch',
					BLIND_REVIEW_PATH,
					'Blind review has no matching valid candidate execution.',
					review.targetId
				)
			);
			continue;
		}
		const candidate = reviewOutput(execution.result);
		if (candidate?.contentHash !== review.candidateContentHash) {
			issues.push(
				issue(
					'review-mismatch',
					BLIND_REVIEW_PATH,
					'Blind review candidate hash does not match the current retained candidate.',
					review.targetId
				)
			);
		}
		if (
			review.speciesCorrect !== (review.identifiedSpeciesId === execution.target.speciesId) ||
			review.affinityCorrect !== (review.identifiedAffinity === execution.target.affinity)
		) {
			issues.push(
				issue(
					'review-mismatch',
					BLIND_REVIEW_PATH,
					'Blind review correctness flags do not match the target.',
					review.targetId
				)
			);
		}
	}

	const executionTargetIds = new Set(executions.map(({ target }) => target.targetId));
	const missingResultTargetIds = targets
		.map((target) => target.targetId)
		.filter((targetId) => !executionTargetIds.has(targetId))
		.sort((left, right) => left.localeCompare(right));
	issues.sort((left, right) =>
		`${left.kind}\0${left.path}\0${left.message}`.localeCompare(
			`${right.kind}\0${right.path}\0${right.message}`
		)
	);
	return {
		executions: executions.sort((left, right) =>
			left.target.targetId.localeCompare(right.target.targetId)
		),
		missingResultTargetIds,
		issues,
		catalog,
		blindReviews,
		evaluation
	};
}

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

async function atomicWriteJsonBatch(
	entries: readonly { path: string; value: unknown }[]
): Promise<void> {
	const prepared: Array<{ destination: string; temporary: string }> = [];
	for (const entry of entries) {
		await mkdir(path.dirname(entry.path), { recursive: true });
		const temporary = `${entry.path}.sync-${process.pid}.tmp`;
		await writeFile(temporary, jsonText(entry.value), { encoding: 'utf8', flag: 'wx' });
		prepared.push({ destination: entry.path, temporary });
	}
	for (const entry of prepared) await rename(entry.temporary, entry.destination);
}

/**
 * The sole shared-file writer. It writes exactly catalog.json and evaluation.json, and only when
 * the complete scan is free of integration errors. blind-review.json remains human-owned.
 */
export async function syncAffinityReviewWorkspace(
	workspaceRoot = process.cwd(),
	mode: 'check' | 'write' = 'check'
): Promise<AffinityReviewSyncReport> {
	const scan = await scanAffinityReviewWorkspace(workspaceRoot);
	const pathConflictCount = scan.issues.filter((entry) => entry.kind === 'path-conflict').length;
	const state = buildAffinityReviewState({
		executions: scan.executions,
		blindReviews: scan.blindReviews,
		priorCatalog: scan.catalog,
		priorEvaluation: scan.evaluation,
		pathConflictCount
	});
	const catalogPath = path.resolve(workspaceRoot, CATALOG_PATH);
	const evaluationPath = path.resolve(workspaceRoot, EVALUATION_PATH);
	const expectedCatalog = jsonText(state.catalog);
	const expectedEvaluation = jsonText(state.evaluation);
	const inSync =
		(await readFile(catalogPath, 'utf8').catch(() => null)) === expectedCatalog &&
		(await readFile(evaluationPath, 'utf8').catch(() => null)) === expectedEvaluation;
	let written = false;
	if (mode === 'write' && scan.issues.length === 0 && !inSync) {
		await atomicWriteJsonBatch([
			{ path: catalogPath, value: state.catalog },
			{ path: evaluationPath, value: state.evaluation }
		]);
		written = true;
	}
	return {
		mode,
		written,
		inSync: written || inSync,
		executionCount: scan.executions.length,
		missingResultCount: scan.missingResultTargetIds.length,
		catalogEntryCount: state.catalog.entries.length,
		issueCount: scan.issues.length,
		pathConflictCount,
		integrationErrorCount: scan.issues.filter((entry) => entry.kind !== 'path-conflict').length,
		issues: scan.issues,
		catalogHash: state.evaluation.catalogHash
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const mode = process.argv.includes('--write') ? 'write' : 'check';
	const report = await syncAffinityReviewWorkspace(process.cwd(), mode);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (report.issueCount > 0 || (mode === 'check' && !report.inSync)) process.exitCode = 1;
}
