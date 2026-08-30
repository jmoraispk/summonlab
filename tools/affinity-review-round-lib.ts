import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type ImageProductionAssignment,
	type ImageProductionCatalog,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import {
	AFFINITY_EXPERIMENT_ROOT,
	assignmentArtifactPath,
	canonicalJson,
	createAffinityWorkflowExportBundle,
	sha256Json,
	targetArtifactPath
} from './image-production-lib.js';
import { verifyFinalControlledActivationReceipt } from './final-controlled-activation-evidence.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle
} from './prepare-final-controlled-rerun.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPath = z
	.string()
	.min(1)
	.refine((value) => !path.posix.isAbsolute(value) && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository path segments must be contained' }
	);

export const AFFINITY_REVIEW_ROUND_IDS = [
	'baseline-v1',
	'final-controlled-v1',
	'breadth-v1'
] as const;
export const AffinityReviewRoundIdSchema = z.enum(AFFINITY_REVIEW_ROUND_IDS);
export type AffinityReviewRoundId = z.infer<typeof AffinityReviewRoundIdSchema>;

export const AffinityRoundEvaluationSchema = z
	.object({
		schemaVersion: z.literal('affinity-review-round-evaluation-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: AffinityReviewRoundIdSchema,
		generatedAt: z.iso.datetime(),
		status: z.literal('incomplete'),
		catalogCanonicalSha256: Hash,
		counts: z
			.object({
				targets: z.literal(24),
				results: z.literal(24),
				candidates: z.number().int().min(0).max(24),
				revise: z.number().int().min(0).max(24),
				failed: z.number().int().min(0).max(24),
				firstAttemptCandidates: z.number().int().min(0).max(24)
			})
			.strict(),
		workflow: z
			.object({
				completeProvenanceCount: z.literal(24),
				pathConflictCount: z.literal(0),
				sharedFileEditCount: z.literal(0),
				retryCeilingViolationCount: z.literal(0)
			})
			.strict(),
		activationReceiptCanonicalSha256: Hash.nullable()
	})
	.strict()
	.superRefine((evaluation, context) => {
		if (evaluation.counts.candidates + evaluation.counts.revise + evaluation.counts.failed !== 24)
			context.addIssue({
				code: 'custom',
				path: ['counts'],
				message: 'Outcome counts must total 24'
			});
		if (
			(evaluation.roundId === 'final-controlled-v1') !==
			(evaluation.activationReceiptCanonicalSha256 !== null)
		)
			context.addIssue({
				code: 'custom',
				path: ['activationReceiptCanonicalSha256'],
				message: 'Only the final-controlled round requires an activation receipt binding'
			});
	});
export type AffinityRoundEvaluation = z.infer<typeof AffinityRoundEvaluationSchema>;

const RoundEvidenceSchema = z
	.object({
		targetId: z.string().min(1),
		targetPath: RepositoryPath,
		targetCanonicalSha256: Hash,
		assignmentId: z.string().min(1),
		assignmentPath: RepositoryPath,
		assignmentCanonicalSha256: Hash,
		resultId: z.string().min(1),
		resultPath: RepositoryPath,
		resultCanonicalSha256: Hash,
		candidatePath: RepositoryPath.nullable(),
		candidateByteSha256: Hash.nullable()
	})
	.strict()
	.superRefine((evidence, context) => {
		if ((evidence.candidatePath === null) !== (evidence.candidateByteSha256 === null))
			context.addIssue({
				code: 'custom',
				message: 'Candidate path and byte hash must appear together'
			});
	});

const AggregateArtifactSchema = z
	.object({
		kind: z.enum(['catalog', 'evaluation']),
		path: RepositoryPath,
		canonicalSha256: Hash,
		byteSha256: Hash
	})
	.strict();

export const AffinityRoundIntegrationReceiptSchema = z
	.object({
		schemaVersion: z.literal('affinity-review-round-integration-receipt-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: AffinityReviewRoundIdSchema,
		status: z.literal('complete'),
		completedAt: z.iso.datetime(),
		registryCanonicalSha256: Hash,
		activationReceiptCanonicalSha256: Hash.nullable(),
		evidenceSetCanonicalSha256: Hash,
		evidence: z.array(RoundEvidenceSchema).length(24),
		aggregates: z.array(AggregateArtifactSchema).length(2)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (new Set(receipt.evidence.map((entry) => entry.targetId)).size !== 24)
			context.addIssue({
				code: 'custom',
				path: ['evidence'],
				message: 'Target IDs must be unique'
			});
		if (sha256Json(receipt.evidence) !== receipt.evidenceSetCanonicalSha256)
			context.addIssue({
				code: 'custom',
				path: ['evidenceSetCanonicalSha256'],
				message: 'Evidence-set hash does not match evidence'
			});
		if (
			(receipt.roundId === 'final-controlled-v1') !==
			(receipt.activationReceiptCanonicalSha256 !== null)
		)
			context.addIssue({
				code: 'custom',
				path: ['activationReceiptCanonicalSha256'],
				message: 'Only final-controlled integration binds an activation receipt'
			});
	});
export type AffinityRoundIntegrationReceipt = z.infer<typeof AffinityRoundIntegrationReceiptSchema>;

export interface AffinityReviewRoundEntry {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly target: ImageProductionTarget;
	readonly assignment: ImageProductionAssignment;
}

export interface AffinityReviewRoundRegistry {
	readonly schemaVersion: 'affinity-review-round-registry-v1';
	readonly experimentId: 'affinity-workflow-v1';
	readonly roundId: AffinityReviewRoundId;
	readonly cohort: 'controlled' | 'breadth';
	readonly activationReceiptCanonicalSha256: string | null;
	readonly entries: readonly AffinityReviewRoundEntry[];
}

export function affinityRoundRoot(roundId: AffinityReviewRoundId): string {
	return `${AFFINITY_EXPERIMENT_ROOT}/review/rounds/${roundId}`;
}

export function affinityRoundAggregatePaths(roundId: AffinityReviewRoundId): {
	readonly catalog: string;
	readonly evaluation: string;
	readonly receipt: string;
} {
	const root = affinityRoundRoot(roundId);
	return {
		catalog: `${root}/catalog.json`,
		evaluation: `${root}/evaluation.json`,
		receipt: `${root}/integration-receipt.json`
	};
}

export function canonicalRegistryProjection(registry: AffinityReviewRoundRegistry): unknown {
	return {
		schemaVersion: registry.schemaVersion,
		experimentId: registry.experimentId,
		roundId: registry.roundId,
		cohort: registry.cohort,
		activationReceiptCanonicalSha256: registry.activationReceiptCanonicalSha256,
		entries: registry.entries.map((entry) => ({
			targetPath: entry.targetPath,
			assignmentPath: entry.assignmentPath,
			targetCanonicalSha256: sha256Json(entry.target),
			assignmentCanonicalSha256: sha256Json(entry.assignment)
		}))
	};
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	RepositoryPath.parse(repositoryPath);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error(`Repository path escapes workspace: ${repositoryPath}`);
	return absolute;
}

export async function readContainedRoundJson(
	workspaceRoot: string,
	repositoryPath: string
): Promise<unknown> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	const root = path.resolve(workspaceRoot);
	let cursor = root;
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	return JSON.parse(await readFile(absolute, 'utf8'));
}

function baseRegistry(roundId: 'baseline-v1' | 'breadth-v1'): AffinityReviewRoundRegistry {
	const bundle = createAffinityWorkflowExportBundle();
	const cohort = roundId === 'baseline-v1' ? 'controlled' : 'breadth';
	const targets = bundle.targets.filter((target) => target.cohort === cohort);
	const assignments = new Map(
		bundle.assignments.map((assignment) => [assignment.targetId, assignment])
	);
	if (targets.length !== 24) throw new Error(`${roundId} requires exactly 24 canonical targets.`);
	return {
		schemaVersion: 'affinity-review-round-registry-v1',
		experimentId: 'affinity-workflow-v1',
		roundId,
		cohort,
		activationReceiptCanonicalSha256: null,
		entries: targets.map((target) => ({
			targetPath: targetArtifactPath(target),
			assignmentPath: assignmentArtifactPath(target),
			target,
			assignment: assignments.get(target.targetId)!
		}))
	};
}

async function finalRegistry(workspaceRoot: string): Promise<AffinityReviewRoundRegistry> {
	const planPath = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`;
	const plan = FinalControlledRerunPlanSchema.parse(
		await readContainedRoundJson(workspaceRoot, planPath)
	);
	const activation = await verifyFinalControlledActivationReceipt(workspaceRoot, sha256Json(plan));
	if (!activation.valid || !activation.receipt)
		throw new Error(
			`Final-controlled activation receipt is invalid: ${activation.issues.join('; ')}`
		);
	const bundle = buildFinalControlledRerunBundle(plan);
	const expectedArtifactPaths = bundle.artifacts.map((artifact) => artifact.livePath).toSorted();
	const receiptArtifactPaths = activation.receipt.artifacts
		.map((artifact) => artifact.livePath)
		.toSorted();
	if (canonicalJson(expectedArtifactPaths) !== canonicalJson(receiptArtifactPaths))
		throw new Error(
			'Activation receipt does not bind the exact 24 target and 24 assignment paths.'
		);
	const receiptByPath = new Map(
		activation.receipt.artifacts.map((artifact) => [artifact.livePath, artifact])
	);
	const entries: AffinityReviewRoundEntry[] = [];
	for (const [index, planned] of plan.targets.entries()) {
		const targetPath = bundle.artifacts[index * 2]!.livePath;
		const assignmentPath = bundle.artifacts[index * 2 + 1]!.livePath;
		const target = ImageProductionTargetSchema.parse(
			await readContainedRoundJson(workspaceRoot, targetPath)
		);
		const assignment = ImageProductionAssignmentSchema.parse(
			await readContainedRoundJson(workspaceRoot, assignmentPath)
		);
		const expectedTargetId = `${plan.experimentId}-${planned.key}`;
		if (
			target.targetId !== expectedTargetId ||
			target.speciesId !== planned.speciesId ||
			target.affinity !== planned.affinity ||
			target.cohort !== 'controlled' ||
			assignment.targetId !== target.targetId ||
			assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
			assignment.permittedOutputs.resultPath !== target.output.resultPath
		)
			throw new Error(`Final-controlled manifest pair is not plan-bound: ${planned.key}`);
		if (
			receiptByPath.get(targetPath)?.kind !== 'target' ||
			receiptByPath.get(targetPath)?.canonicalSha256 !== sha256Json(target) ||
			receiptByPath.get(assignmentPath)?.kind !== 'assignment' ||
			receiptByPath.get(assignmentPath)?.canonicalSha256 !== sha256Json(assignment)
		)
			throw new Error(`Activation receipt manifest binding differs: ${planned.key}`);
		entries.push({ targetPath, assignmentPath, target, assignment });
	}
	return {
		schemaVersion: 'affinity-review-round-registry-v1',
		experimentId: 'affinity-workflow-v1',
		roundId: 'final-controlled-v1',
		cohort: 'controlled',
		activationReceiptCanonicalSha256: sha256Json(activation.receipt),
		entries
	};
}

export async function loadAffinityReviewRoundRegistry(
	workspaceRoot: string,
	roundInput: unknown
): Promise<AffinityReviewRoundRegistry> {
	const roundId = AffinityReviewRoundIdSchema.parse(roundInput);
	const registry =
		roundId === 'final-controlled-v1' ? await finalRegistry(workspaceRoot) : baseRegistry(roundId);
	const targetIds = registry.entries.map((entry) => entry.target.targetId);
	const assignmentIds = registry.entries.map((entry) => entry.assignment.assignmentId);
	const ownedPaths = registry.entries.flatMap((entry) => [
		entry.targetPath,
		entry.assignmentPath,
		entry.target.output.candidatePath,
		entry.target.output.resultPath
	]);
	if (
		registry.entries.length !== 24 ||
		new Set(targetIds).size !== 24 ||
		new Set(assignmentIds).size !== 24 ||
		new Set(ownedPaths).size !== 96
	)
		throw new Error(`${roundId} registry is not collision-free and exact.`);
	return registry;
}

export function parseRoundCatalog(value: unknown): ImageProductionCatalog {
	return ImageProductionCatalogSchema.parse(value);
}

export function parseRoundResult(value: unknown): ImageProductionResult {
	return ImageProductionResultSchema.parse(value);
}

export function sha256Bytes(value: Uint8Array | string): string {
	return createHash('sha256').update(value).digest('hex');
}
