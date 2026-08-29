import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionEvaluationSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionCatalogEntry,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	canonicalJson,
	createAffinityWorkflowExportBundle,
	sha256Json,
	validateAffinityWorkflowDefinitions
} from './image-production-lib.js';
import sharp from 'sharp';
import { z } from 'zod';

const GoblinAuditSchema = z
	.object({
		version: z.literal('goblin-affinity-audit-v1'),
		seed: z.string().min(1),
		sampleSize: z.union([z.literal(60), z.literal(600)]),
		coverage: z.array(
			z
				.object({
					axis: z.string().min(1),
					expectedValues: z.number().int().positive(),
					observedValues: z.number().int().positive(),
					minimumCount: z.number().int().nonnegative(),
					requiredMinimumCount: z.number().int().positive(),
					passed: z.boolean()
				})
				.strict()
		),
		correlations: z.array(
			z
				.object({
					leftAxis: z.literal('affinityId'),
					rightAxis: z.string().min(1),
					biasCorrectedCramersV: z.number().nonnegative(),
					maximumAllowed: z.number().positive(),
					passed: z.boolean()
				})
				.strict()
		),
		gates: z
			.object({
				coveragePassed: z.literal(true),
				correlationPassed: z.literal(true),
				passed: z.literal(true)
			})
			.strict()
	})
	.strict();

async function listFiles(root: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
		const filePath = path.join(root, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(filePath)));
		else files.push(filePath);
	}
	return files.sort();
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function assertExactPaths(
	actual: readonly string[],
	expected: ReadonlySet<string>,
	label: string
): void {
	const actualSet = new Set(actual);
	const missing = [...expected].find((expectedPath) => !actualSet.has(expectedPath));
	if (missing) throw new Error(`Missing ${label}: ${missing}`);
	const unexpected = actual.find((actualPath) => !expected.has(actualPath));
	if (unexpected) throw new Error(`Unexpected ${label}: ${unexpected}`);
}

function selectedOutput(result: ImageProductionResult) {
	return result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output;
}

function latestOutput(result: ImageProductionResult) {
	return [...result.attempts].reverse().find((attempt) => attempt.output)?.output ?? null;
}

async function verifyImage(
	workspaceRoot: string,
	output: NonNullable<ReturnType<typeof latestOutput>>
): Promise<void> {
	const bytes = await readFile(path.resolve(workspaceRoot, output.path));
	if (bytes.byteLength !== output.bytes)
		throw new Error(`Image byte count changed: ${output.path}`);
	if (sha256(bytes) !== output.contentHash) throw new Error(`Image hash changed: ${output.path}`);
	const metadata = await sharp(bytes).metadata();
	const mediaType =
		metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
	if (
		metadata.width !== output.width ||
		metadata.height !== output.height ||
		mediaType !== output.mediaType
	) {
		throw new Error(`Image metadata does not match its result record: ${output.path}`);
	}
}

function verifyCatalogEntry(
	entry: ImageProductionCatalogEntry,
	target: ImageProductionTarget,
	result: ImageProductionResult
): void {
	if (
		entry.targetId !== target.targetId ||
		entry.resultId !== result.resultId ||
		entry.assignmentId !== result.assignmentId ||
		entry.speciesId !== target.speciesId ||
		entry.affinity !== target.affinity ||
		entry.cohort !== target.cohort ||
		entry.status !== result.status
	) {
		throw new Error(`Catalog entry does not match its target/result: ${entry.targetId}`);
	}
	const output = selectedOutput(result);
	if (result.status === 'candidate') {
		if (entry.candidatePath !== output?.path || entry.candidateHash !== output.contentHash) {
			throw new Error(`Catalog candidate provenance is stale: ${entry.targetId}`);
		}
	}
}

export interface AffinityWorkflowValidationSummary {
	readonly targets: number;
	readonly assignments: number;
	readonly references: number;
	readonly results: number;
	readonly images: number;
	readonly catalogEntries: number;
	readonly blindReviews: number;
	readonly evaluationStatus: 'incomplete' | 'passed' | 'failed';
}

export async function validateAffinityWorkflowWorkspace(
	workspaceRoot = process.cwd()
): Promise<AffinityWorkflowValidationSummary> {
	const exportBundle = createAffinityWorkflowExportBundle();
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const expectedTargetPaths = new Set(
		exportBundle.artifacts
			.filter((artifact) => artifact.path.includes('/targets/'))
			.map((artifact) => path.resolve(workspaceRoot, artifact.path))
	);
	const expectedAssignmentPaths = new Set(
		exportBundle.artifacts
			.filter((artifact) => artifact.path.includes('/assignments/'))
			.map((artifact) => path.resolve(workspaceRoot, artifact.path))
	);
	const targetFiles = await listFiles(path.join(experimentRoot, 'targets'));
	const assignmentFiles = await listFiles(path.join(experimentRoot, 'assignments'));
	assertExactPaths(targetFiles, expectedTargetPaths, 'target manifest');
	assertExactPaths(assignmentFiles, expectedAssignmentPaths, 'assignment manifest');
	const targets = await Promise.all(
		targetFiles.map(async (file) => ImageProductionTargetSchema.parse(await readJson(file)))
	);
	const assignments = await Promise.all(
		assignmentFiles.map(async (file) => ImageProductionAssignmentSchema.parse(await readJson(file)))
	);
	validateAffinityWorkflowDefinitions(targets, assignments);
	const targetsById = new Map(targets.map((target) => [target.targetId, target]));
	const assignmentsById = new Map(
		assignments.map((assignment) => [assignment.assignmentId, assignment])
	);
	const references = new Map<string, string>();
	for (const target of targets) {
		for (const reference of target.references) {
			const previousHash = references.get(reference.path);
			if (previousHash && previousHash !== reference.contentHash) {
				throw new Error(`Conflicting declared hashes for reference ${reference.path}`);
			}
			references.set(reference.path, reference.contentHash);
		}
	}
	for (const [referencePath, expectedHash] of references) {
		const bytes = await readFile(path.resolve(workspaceRoot, referencePath));
		if (sha256(bytes) !== expectedHash) throw new Error(`Reference hash changed: ${referencePath}`);
	}

	const allowedResultPaths = new Set(
		targets.map((target) => path.resolve(workspaceRoot, target.output.resultPath))
	);
	const resultFiles = await listFiles(path.join(experimentRoot, 'results'));
	const unexpectedResult = resultFiles.find((file) => !allowedResultPaths.has(file));
	if (unexpectedResult) throw new Error(`Unexpected result record: ${unexpectedResult}`);
	const results: ImageProductionResult[] = [];
	for (const resultFile of resultFiles) {
		const result = ImageProductionResultSchema.parse(await readJson(resultFile));
		const target = targetsById.get(result.targetId);
		const assignment = assignmentsById.get(result.assignmentId);
		if (!target || !assignment)
			throw new Error(`Result has unknown target or assignment: ${resultFile}`);
		if (path.resolve(workspaceRoot, target.output.resultPath) !== resultFile) {
			throw new Error(`Result is stored at the wrong path: ${resultFile}`);
		}
		validateImageProductionExecution({ target, assignment, result });
		results.push(result);
	}
	const resultsById = new Map(results.map((result) => [result.resultId, result]));
	const resultsByTargetId = new Map(results.map((result) => [result.targetId, result]));
	if (resultsById.size !== results.length || resultsByTargetId.size !== results.length) {
		throw new Error('Result and target IDs must be unique across partial results');
	}

	const candidateFiles = await listFiles(path.join(experimentRoot, 'candidates'));
	const allowedCandidatePaths = new Set(
		targets.map((target) => path.resolve(workspaceRoot, target.output.candidatePath))
	);
	const unexpectedCandidate = candidateFiles.find((file) => !allowedCandidatePaths.has(file));
	if (unexpectedCandidate) throw new Error(`Unexpected candidate image: ${unexpectedCandidate}`);
	for (const candidateFile of candidateFiles) {
		const target = targets.find(
			(candidate) => path.resolve(workspaceRoot, candidate.output.candidatePath) === candidateFile
		);
		const result = target ? resultsByTargetId.get(target.targetId) : undefined;
		const output = result ? latestOutput(result) : null;
		if (
			!target ||
			!result ||
			!output ||
			path.resolve(workspaceRoot, output.path) !== candidateFile
		) {
			throw new Error(`Candidate image has no matching result provenance: ${candidateFile}`);
		}
		await verifyImage(workspaceRoot, output);
	}
	for (const result of results) {
		const output = latestOutput(result);
		if (output && !candidateFiles.includes(path.resolve(workspaceRoot, output.path))) {
			throw new Error(`Result output image is missing: ${output.path}`);
		}
	}

	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.join(experimentRoot, 'review/catalog.json'))
	);
	if (catalog.experimentId !== exportBundle.catalog.experimentId) {
		throw new Error('Catalog belongs to the wrong experiment');
	}
	for (const entry of catalog.entries) {
		const target = targetsById.get(entry.targetId);
		const result = resultsById.get(entry.resultId);
		if (!target || !result)
			throw new Error(`Catalog entry has no target/result: ${entry.targetId}`);
		verifyCatalogEntry(entry, target, result);
	}

	const blindReviews = ImageProductionBlindReviewCollectionSchema.parse(
		await readJson(path.join(experimentRoot, 'review/blind-review.json'))
	);
	for (const review of blindReviews.reviews) {
		const target = targetsById.get(review.targetId);
		const entry = catalog.entries.find((candidate) => candidate.targetId === review.targetId);
		if (!target || !entry || entry.status !== 'candidate') {
			throw new Error(`Blind review has no cataloged candidate: ${review.targetId}`);
		}
		if (
			review.speciesCorrect !== (review.identifiedSpeciesId === target.speciesId) ||
			review.affinityCorrect !== (review.identifiedAffinity === target.affinity)
		) {
			throw new Error(`Blind review correctness flags are stale: ${review.reviewId}`);
		}
	}

	const evaluation = ImageProductionEvaluationSchema.parse(
		await readJson(path.join(experimentRoot, 'review/evaluation.json'))
	);
	if (evaluation.catalogHash !== sha256Json(catalog)) {
		throw new Error('Evaluation catalog hash is stale');
	}
	if (canonicalJson(evaluation.blindReviews) !== canonicalJson(blindReviews.reviews)) {
		throw new Error('Evaluation blind reviews do not match the review aggregate');
	}
	const catalogedResults = catalog.entries.map((entry) => resultsById.get(entry.resultId)!);
	const controlledResults = catalogedResults.filter(
		(result) => targetsById.get(result.targetId)?.cohort === 'controlled'
	);
	const controlledReviews = blindReviews.reviews.filter(
		(review) => targetsById.get(review.targetId)?.cohort === 'controlled'
	);
	const firstAttemptCandidateCount = controlledResults.filter(
		(result) =>
			result.status === 'candidate' && result.selectedAttemptId === result.attempts[0]?.attemptId
	).length;
	const speciesCorrectCount = controlledReviews.filter((review) => review.speciesCorrect).length;
	const affinityCorrectCount = controlledReviews.filter((review) => review.affinityCorrect).length;
	const normalUnaffiliatedCount = controlledReviews.filter(
		(review) => review.affinityCorrect && targetsById.get(review.targetId)?.affinity === 'normal'
	).length;
	const acceptedMeaningfulAffinityCount = catalog.entries.filter((entry) => {
		const target = targetsById.get(entry.targetId);
		return (
			target?.cohort === 'controlled' &&
			target.affinity !== 'normal' &&
			entry.reviewState === 'accepted'
		);
	}).length;
	const acceptedCriticalVisualFailureCount = catalog.entries.filter((entry) => {
		if (entry.reviewState !== 'accepted') return false;
		const result = resultsById.get(entry.resultId);
		const attempt = result?.attempts.find(
			(candidate) => candidate.attemptId === result.selectedAttemptId
		);
		return (
			attempt?.findings.some(
				(finding) =>
					finding.outcome === 'fail' &&
					['anatomy', 'canvas-completion', 'framing', 'silhouette'].includes(finding.category)
			) ?? false
		);
	}).length;
	const expectedControlled = {
		targetCount: 24,
		firstAttemptCandidateCount,
		speciesCorrectCount,
		affinityCorrectCount,
		normalUnaffiliatedCount,
		acceptedMeaningfulAffinityCount,
		acceptedCriticalVisualFailureCount
	};
	if (canonicalJson(evaluation.controlled) !== canonicalJson(expectedControlled)) {
		throw new Error('Evaluation controlled counters are stale');
	}
	if (
		evaluation.workflow.completedTargetCount !== catalog.entries.length ||
		evaluation.workflow.completeProvenanceCount !== catalog.entries.length
	) {
		throw new Error('Evaluation workflow completion counters are stale');
	}

	for (const [sampleSize, filename] of [
		[60, 'goblin-audit-60.json'],
		[600, 'goblin-audit-600.json']
	] as const) {
		const audit = GoblinAuditSchema.parse(
			await readJson(path.join(experimentRoot, 'review', filename))
		);
		if (audit.sampleSize !== sampleSize) throw new Error(`Wrong sample size in ${filename}`);
		if (!audit.coverage.every((entry) => entry.passed))
			throw new Error(`Coverage failed in ${filename}`);
		if (!audit.correlations.every((entry) => entry.passed)) {
			throw new Error(`Correlation gate failed in ${filename}`);
		}
	}

	const schemaFiles = await listFiles(path.join(experimentRoot, 'schemas'));
	const expectedSchemaPaths = new Set(
		exportBundle.artifacts
			.filter((artifact) => artifact.path.includes('/schemas/'))
			.map((artifact) => path.resolve(workspaceRoot, artifact.path))
	);
	assertExactPaths(schemaFiles, expectedSchemaPaths, 'JSON schema');
	await Promise.all(schemaFiles.map((file) => readJson(file)));

	return {
		targets: targets.length,
		assignments: assignments.length,
		references: references.size,
		results: results.length,
		images: candidateFiles.length,
		catalogEntries: catalog.entries.length,
		blindReviews: blindReviews.reviews.length,
		evaluationStatus: evaluation.status
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const summary = await validateAffinityWorkflowWorkspace();
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
