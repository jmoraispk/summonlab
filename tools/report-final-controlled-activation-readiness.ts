import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type ImageProductionCatalog,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	canonicalJson,
	sha256Json,
	type ImageProductionBlindReviewCollection
} from './image-production-lib.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import { validateAffinityWorkflowWorkspace } from './validate-affinity-workflow.js';

const execFileAsync = promisify(execFile);

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const Slug = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
export const RESOLUTION_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-design-risk-resolutions.json`;
const STAGING_PREFIX = `${AFFINITY_EXPERIMENT_ROOT}/review/activation-staging/targets/`;

const BlindEvidence = z.object({ id: z.string().uuid(), contentHash: Hash }).strict();
const ResultEvidence = z.object({ id: Slug, contentHash: Hash }).strict();
const StagedTarget = z
	.object({
		path: z.string().startsWith(STAGING_PREFIX).endsWith('.json'),
		canonicalHash: Hash,
		promptHash: Hash,
		promptByteLength: z.number().int().positive()
	})
	.strict();

const Resolution = z
	.object({
		riskId: Slug,
		coordinate: Slug,
		sourceTargetId: Slug,
		severity: z.enum(['blocking', 'risk']),
		status: z.enum(['pending', 'resolved']),
		decision: z.enum(['replace-derived-target', 'replace-reference', 'retain']).nullable(),
		humanRationale: z.string().trim().min(1).nullable(),
		blindReviewEvidence: z.array(BlindEvidence),
		reviseResultEvidence: z.array(ResultEvidence),
		stagedTarget: StagedTarget.nullable()
	})
	.strict()
	.superRefine((value, context) => {
		if (
			value.status === 'pending' &&
			(value.decision || value.humanRationale || value.stagedTarget)
		)
			context.addIssue({
				code: 'custom',
				message: 'Pending risks cannot claim a decision or stage'
			});
		if (value.status === 'resolved' && (!value.decision || !value.humanRationale))
			context.addIssue({
				code: 'custom',
				message: 'Resolved risks require a decision and human rationale'
			});
		if (value.severity === 'blocking' && value.status === 'resolved' && !value.stagedTarget)
			context.addIssue({
				code: 'custom',
				message: 'Resolved blocking risks require a staged target'
			});
		if (
			value.decision === 'retain' &&
			(value.severity === 'blocking' || !value.blindReviewEvidence.length)
		)
			context.addIssue({
				code: 'custom',
				message: 'Retain is only allowed for nonblocking risks with blind evidence'
			});
		if (value.decision?.startsWith('replace-') && !value.stagedTarget)
			context.addIssue({
				code: 'custom',
				message: 'Replacement decisions require a staged target'
			});
	});

export const FinalControlledDesignRiskResolutionCollectionSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-design-risk-resolutions-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		planContentHash: Hash,
		blindReviewCollectionHash: Hash,
		catalogContentHash: Hash,
		executionSnapshotHash: Hash,
		eligibleOriginalControlledTargetIds: z.array(Slug).length(21),
		reviseResults: z.array(ResultEvidence.extend({ targetId: Slug })).length(3),
		resolutions: z.array(Resolution).length(16)
	})
	.strict()
	.superRefine((value, context) => {
		for (const field of ['eligibleOriginalControlledTargetIds'] as const)
			if (new Set(value[field]).size !== value[field].length)
				context.addIssue({ code: 'custom', path: [field], message: 'Values must be unique' });
		for (const field of ['riskId', 'coordinate'] as const)
			if (new Set(value.resolutions.map((entry) => entry[field])).size !== 16)
				context.addIssue({
					code: 'custom',
					path: ['resolutions'],
					message: `${field} values must be unique`
				});
	});
export type FinalControlledDesignRiskResolutionCollection = z.infer<
	typeof FinalControlledDesignRiskResolutionCollectionSchema
>;

export interface StagedVerification {
	readonly target: unknown;
	readonly exactPrompt: string;
	readonly referenceHashes: Readonly<Record<string, string>>;
}
export interface ActivationReadinessInput {
	readonly plan: unknown;
	readonly blindReviews: unknown;
	readonly catalog: unknown;
	readonly originalTargets: readonly unknown[];
	readonly results: readonly unknown[];
	readonly resolutions?: unknown;
	readonly staged?: Readonly<Record<string, StagedVerification>>;
	readonly currentWorkspaceValid: boolean;
	readonly plannedPathsAbsent: boolean;
}
export interface ActivationReadinessReport {
	readonly schemaVersion: 'affinity-final-controlled-activation-readiness-v1';
	readonly authorized: boolean;
	readonly counts: {
		eligibleCandidates: number;
		eligibleBlindReviews: number;
		reviseResults: number;
		risks: number;
		resolvedRisks: number;
	};
	readonly blockers: readonly { code: string; detail: string }[];
}

function snapshot(
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
		.toSorted((a, b) => a.targetId.localeCompare(b.targetId));
}

export function buildFinalControlledActivationReadiness(
	input: ActivationReadinessInput
): ActivationReadinessReport {
	const blockers: { code: string; detail: string }[] = [];
	let plan: FinalControlledRerunPlan;
	let reviews: ImageProductionBlindReviewCollection;
	let catalog: ImageProductionCatalog;
	let targets: ImageProductionTarget[];
	let results: ImageProductionResult[];
	try {
		plan = FinalControlledRerunPlanSchema.parse(input.plan);
		reviews = ImageProductionBlindReviewCollectionSchema.parse(input.blindReviews);
		catalog = ImageProductionCatalogSchema.parse(input.catalog);
		targets = input.originalTargets.map((value) => ImageProductionTargetSchema.parse(value));
		results = input.results.map((value) => ImageProductionResultSchema.parse(value));
	} catch (error) {
		return {
			schemaVersion: 'affinity-final-controlled-activation-readiness-v1',
			authorized: false,
			counts: {
				eligibleCandidates: 0,
				eligibleBlindReviews: 0,
				reviseResults: 0,
				risks: 0,
				resolvedRisks: 0
			},
			blockers: [
				{ code: 'invalid-input', detail: error instanceof Error ? error.message : String(error) }
			]
		};
	}
	const originals = targets.filter(
		(target) =>
			target.cohort === 'controlled' &&
			['death-knight', 'elemental', 'grey-wolf', 'cave-bear'].includes(target.speciesId)
	);
	const candidateIds = originals
		.filter((target) => results.find((r) => r.targetId === target.targetId)?.status === 'candidate')
		.map((t) => t.targetId)
		.toSorted();
	const reviseResults = results
		.filter((r) => originals.some((t) => t.targetId === r.targetId) && r.status === 'revise')
		.toSorted((a, b) => a.targetId.localeCompare(b.targetId));
	const catalogByTarget = new Map(catalog.entries.map((entry) => [entry.targetId, entry]));
	const eligibleReviews = reviews.reviews.filter(
		(review) =>
			candidateIds.includes(review.targetId) &&
			catalogByTarget.get(review.targetId)?.candidateHash === review.candidateContentHash
	);
	if (originals.length !== 24 || candidateIds.length !== 21)
		blockers.push({
			code: 'original-cohort-mismatch',
			detail: `Expected 24 originals/21 candidates; found ${originals.length}/${candidateIds.length}`
		});
	if (reviseResults.length !== 3)
		blockers.push({
			code: 'revise-result-mismatch',
			detail: `Expected 3 immutable revise results; found ${reviseResults.length}`
		});
	if (eligibleReviews.length !== 21 || new Set(eligibleReviews.map((r) => r.targetId)).size !== 21)
		blockers.push({
			code: 'blind-review-incomplete',
			detail: `Expected 21 eligible blind reviews; found ${eligibleReviews.length}`
		});
	if (!input.currentWorkspaceValid)
		blockers.push({
			code: 'workspace-invalid',
			detail: 'Current workflow validation has not passed'
		});
	if (!input.plannedPathsAbsent)
		blockers.push({
			code: 'planned-path-collision',
			detail: 'One or more live final-controlled paths exist'
		});
	const parsed = FinalControlledDesignRiskResolutionCollectionSchema.safeParse(input.resolutions);
	if (!parsed.success) {
		blockers.push({ code: 'missing-or-invalid-resolutions', detail: parsed.error.message });
		return {
			schemaVersion: 'affinity-final-controlled-activation-readiness-v1',
			authorized: false,
			counts: {
				eligibleCandidates: candidateIds.length,
				eligibleBlindReviews: eligibleReviews.length,
				reviseResults: reviseResults.length,
				risks: plan.designRiskReview.risks.length,
				resolvedRisks: 0
			},
			blockers
		};
	}
	const ledger = parsed.data;
	const expectedSnapshotHash = sha256Json(snapshot(originals, results));
	for (const [label, actual, expected] of [
		['plan', ledger.planContentHash, sha256Json(plan)],
		['blind-review', ledger.blindReviewCollectionHash, sha256Json(reviews)],
		['catalog', ledger.catalogContentHash, sha256Json(catalog)],
		['execution-snapshot', ledger.executionSnapshotHash, expectedSnapshotHash]
	] as const)
		if (actual !== expected)
			blockers.push({
				code: 'stale-binding',
				detail: `${label} hash does not match current evidence`
			});
	if (
		canonicalJson(ledger.eligibleOriginalControlledTargetIds.toSorted()) !==
		canonicalJson(candidateIds)
	)
		blockers.push({
			code: 'eligible-target-binding-mismatch',
			detail: 'The 21 eligible target IDs are not canonical'
		});
	const expectedRevises = reviseResults.map((r) => ({
		id: r.resultId,
		targetId: r.targetId,
		contentHash: sha256Json(r)
	}));
	if (
		canonicalJson(ledger.reviseResults.toSorted((a, b) => a.targetId.localeCompare(b.targetId))) !==
		canonicalJson(expectedRevises)
	)
		blockers.push({
			code: 'revise-binding-mismatch',
			detail: 'The three revise result hashes are not immutable/current'
		});
	const reviewHashes = new Map(
		eligibleReviews.map((review) => [review.reviewId, sha256Json(review)])
	);
	const eligibleReviewByTarget = new Map(
		eligibleReviews.map((review) => [review.targetId, review])
	);
	const reviseEvidenceByResultId = new Map(
		reviseResults.map((result) => [result.resultId, sha256Json(result)])
	);
	const planned = buildFinalControlledRerunBundle(plan);
	for (const risk of plan.designRiskReview.risks) {
		const resolution = ledger.resolutions.find((r) => r.riskId === risk.riskId);
		if (
			!resolution ||
			resolution.coordinate !== risk.coordinate ||
			resolution.sourceTargetId !== risk.sourceTargetId ||
			resolution.severity !== risk.severity
		) {
			blockers.push({
				code: 'risk-binding-mismatch',
				detail: `Risk ${risk.riskId} is missing or stale`
			});
			continue;
		}
		if (resolution.status !== 'resolved')
			blockers.push({ code: 'unresolved-risk', detail: `Risk ${risk.riskId} remains pending` });
		for (const evidence of resolution.blindReviewEvidence)
			if (reviewHashes.get(evidence.id) !== evidence.contentHash)
				blockers.push({
					code: 'invalid-risk-review-evidence',
					detail: `Risk ${risk.riskId} cites non-eligible blind evidence`
				});
		for (const evidence of resolution.reviseResultEvidence)
			if (reviseEvidenceByResultId.get(evidence.id) !== evidence.contentHash)
				blockers.push({
					code: 'invalid-risk-revise-evidence',
					detail: `Risk ${risk.riskId} cites non-eligible revise evidence`
				});
		const expected = planned.targets.find((target) => target.targetId.endsWith(risk.coordinate));
		const original = expected
			? originals.find(
					(target) =>
						target.speciesId === expected.speciesId && target.affinity === expected.affinity
				)
			: undefined;
		const originalResult = original
			? results.find((result) => result.targetId === original.targetId)
			: undefined;
		if (resolution.status === 'resolved' && originalResult?.status === 'candidate') {
			const requiredReview = eligibleReviewByTarget.get(originalResult.targetId);
			if (
				!requiredReview ||
				!resolution.blindReviewEvidence.some(
					(evidence) =>
						evidence.id === requiredReview.reviewId &&
						evidence.contentHash === sha256Json(requiredReview)
				)
			) {
				blockers.push({
					code: 'missing-coordinate-review-evidence',
					detail: `Risk ${risk.riskId} lacks blind evidence for its own original coordinate`
				});
			}
		}
		if (resolution.status === 'resolved' && originalResult?.status === 'revise') {
			const resultHash = sha256Json(originalResult);
			if (
				!resolution.reviseResultEvidence.some(
					(evidence) =>
						evidence.id === originalResult.resultId && evidence.contentHash === resultHash
				)
			) {
				blockers.push({
					code: 'missing-coordinate-revise-evidence',
					detail: `Risk ${risk.riskId} lacks immutable revise evidence for its own original coordinate`
				});
			}
		}
		if (resolution.stagedTarget) {
			const verification = input.staged?.[resolution.stagedTarget.path];
			if (!verification || !expected) {
				blockers.push({
					code: 'missing-staged-target',
					detail: `Risk ${risk.riskId} staged target is unavailable`
				});
				continue;
			}
			const targetResult = ImageProductionTargetSchema.safeParse(verification.target);
			if (!targetResult.success) {
				blockers.push({
					code: 'invalid-staged-target',
					detail: `Risk ${risk.riskId} staged target fails schema`
				});
				continue;
			}
			const target = targetResult.data;
			const validPath =
				resolution.stagedTarget.path ===
				`${STAGING_PREFIX}${target.speciesId}/${target.affinity}-${risk.coordinate.match(/v\d+$/u)?.[0]}.json`;
			const promptHash = createHash('sha256').update(verification.exactPrompt).digest('hex');
			const refsValid = target.references.every(
				(ref) => verification.referenceHashes[ref.path] === ref.contentHash
			);
			if (
				!validPath ||
				target.targetId !== expected.targetId ||
				target.speciesId !== expected.speciesId ||
				target.affinity !== expected.affinity ||
				canonicalJson(target.output) !== canonicalJson(expected.output) ||
				target.promptProtocol !== plan.promptProtocol ||
				target.authoringProtocol !== plan.authoringProtocol ||
				!refsValid ||
				sha256Json(target) !== resolution.stagedTarget.canonicalHash ||
				sha256Json(target) === sha256Json(expected) ||
				promptHash !== resolution.stagedTarget.promptHash ||
				Buffer.byteLength(verification.exactPrompt) !== resolution.stagedTarget.promptByteLength
			)
				blockers.push({
					code: 'staged-target-verification-failed',
					detail: `Risk ${risk.riskId} staged target identity/output/protocol/references/hash/prompt is invalid`
				});
		}
	}
	return {
		schemaVersion: 'affinity-final-controlled-activation-readiness-v1',
		authorized: blockers.length === 0,
		counts: {
			eligibleCandidates: candidateIds.length,
			eligibleBlindReviews: eligibleReviews.length,
			reviseResults: reviseResults.length,
			risks: plan.designRiskReview.risks.length,
			resolvedRisks: ledger.resolutions.filter((r) => r.status === 'resolved').length
		},
		blockers
	};
}

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8'));
}

function containedPath(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath
			.split('/')
			.some((segment) => segment === '' || segment === '.' || segment === '..')
	) {
		throw new Error(`Unsafe repository path: ${repositoryPath}`);
	}
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${path.sep}`)) {
		throw new Error(`Path escapes workspace: ${repositoryPath}`);
	}
	return absolute;
}

async function verifiedContainedFile(
	workspaceRoot: string,
	repositoryPath: string,
	rejectDirectSymlink = false
): Promise<string> {
	const absolute = containedPath(workspaceRoot, repositoryPath);
	const metadata = await lstat(absolute);
	if (!metadata.isFile() && !metadata.isSymbolicLink()) {
		throw new Error(`Expected regular file: ${repositoryPath}`);
	}
	if (rejectDirectSymlink && metadata.isSymbolicLink()) {
		throw new Error(`Staged target cannot be a symlink: ${repositoryPath}`);
	}
	const root = await realpath(path.resolve(workspaceRoot));
	const resolved = await realpath(absolute);
	if (!resolved.startsWith(`${root}${path.sep}`)) {
		throw new Error(`Resolved path escapes workspace: ${repositoryPath}`);
	}
	return absolute;
}

export function expectedStagedTargetPath(
	plan: FinalControlledRerunPlan,
	resolution: FinalControlledDesignRiskResolutionCollection['resolutions'][number]
): string {
	const coordinate = plan.targets.find((target) => target.key === resolution.coordinate);
	if (!coordinate) throw new Error(`Unknown staged coordinate: ${resolution.coordinate}`);
	return `${STAGING_PREFIX}${coordinate.speciesId}/${coordinate.affinity}-${coordinate.version}.json`;
}

export async function loadStagedVerification(
	workspaceRoot: string,
	stagePath: string,
	expectedPath: string
): Promise<StagedVerification> {
	if (stagePath !== expectedPath) {
		throw new Error(`Staged target path does not match its plan coordinate: ${stagePath}`);
	}
	const absolute = await verifiedContainedFile(workspaceRoot, stagePath, true);
	const target = ImageProductionTargetSchema.parse(await readJson(absolute));
	const renderer = path.resolve(
		workspaceRoot,
		'skills/summonlab-image-production/scripts/render_prompt.py'
	);
	const { stdout: exactPrompt } = await execFileAsync('python3', [renderer, absolute], {
		maxBuffer: 2_000_000
	});
	const referenceHashes: Record<string, string> = {};
	for (const reference of target.references) {
		const referencePath = await verifiedContainedFile(workspaceRoot, reference.path);
		referenceHashes[reference.path] = createHash('sha256')
			.update(await readFile(referencePath))
			.digest('hex');
	}
	return { target, exactPrompt, referenceHashes };
}

/** Only ENOENT is evidence of absence; permission, type, and I/O failures propagate. */
export async function repositoryPathIsAbsent(
	workspaceRoot: string,
	repositoryPath: string
): Promise<boolean> {
	try {
		await lstat(containedPath(workspaceRoot, repositoryPath));
		return false;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
		throw error;
	}
}

export async function loadCurrentActivationReadinessInput(
	workspaceRoot = process.cwd()
): Promise<ActivationReadinessInput> {
	const root = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const plan = await readJson(path.join(root, 'review/final-controlled-rerun-plan.json'));
	const reviews = await readJson(path.join(root, 'review/blind-review.json'));
	const catalog = await readJson(path.join(root, 'review/catalog.json'));
	const targets = await Promise.all(
		(plan as FinalControlledRerunPlan).targets.map((t) =>
			readJson(path.join(root, `targets/${t.speciesId}/${t.affinity}.json`))
		)
	);
	const entries = ImageProductionCatalogSchema.parse(catalog).entries.filter((e) =>
		targets.some((t) => (t as ImageProductionTarget).targetId === e.targetId)
	);
	const results = await Promise.all(
		entries.map((e) =>
			readJson(
				path.resolve(
					workspaceRoot,
					(
						targets.find(
							(t) => (t as ImageProductionTarget).targetId === e.targetId
						) as ImageProductionTarget
					).output.resultPath
				)
			)
		)
	);
	const resolutions = await readJson(path.resolve(workspaceRoot, RESOLUTION_PATH)).catch(
		() => undefined
	);
	const parsedResolutions =
		FinalControlledDesignRiskResolutionCollectionSchema.safeParse(resolutions);
	const staged: Record<string, StagedVerification> = {};
	if (parsedResolutions.success) {
		for (const resolution of parsedResolutions.data.resolutions) {
			if (resolution.stagedTarget)
				staged[resolution.stagedTarget.path] = await loadStagedVerification(
					workspaceRoot,
					resolution.stagedTarget.path,
					expectedStagedTargetPath(FinalControlledRerunPlanSchema.parse(plan), resolution)
				);
		}
	}
	const bundle = buildFinalControlledRerunBundle(plan);
	const plannedPathsAbsent = await Promise.all(
		bundle.plannedPaths.map((plannedPath) => repositoryPathIsAbsent(workspaceRoot, plannedPath))
	).then((v) => v.every(Boolean));
	const currentWorkspaceValid = await validateAffinityWorkflowWorkspace(workspaceRoot).then(
		() => true,
		() => false
	);
	return {
		plan,
		blindReviews: reviews,
		catalog,
		originalTargets: targets,
		results,
		resolutions,
		staged,
		currentWorkspaceValid,
		plannedPathsAbsent
	};
}

export async function reportCurrentWorkspace(
	workspaceRoot = process.cwd()
): Promise<ActivationReadinessReport> {
	return buildFinalControlledActivationReadiness(
		await loadCurrentActivationReadinessInput(workspaceRoot)
	);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href)
	reportCurrentWorkspace()
		.then((report) => {
			process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			process.exitCode = report.authorized ? 0 : 1;
		})
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		});
