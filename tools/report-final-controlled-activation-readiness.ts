import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import { getConfig } from '../packages/config/src/index.js';
import {
	FinalControlledDesignRiskDecisionListSchema,
	FinalControlledDesignRiskResolutionLedgerV2Schema,
	FinalControlledDesignRiskStagedTargetPaths,
	FinalControlledEligibleOriginalCandidateTargetIds,
	FinalControlledOriginalReviseResults,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type FinalControlledDesignRiskResolutionLedgerV2,
	type ImageProductionCatalog,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { listFinalControlledDesignRiskDecisions } from '../packages/database/src/index.js';

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
import {
	FinalControlledActivationReceiptSchema,
	type FinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';
import { validateAffinityWorkflowWorkspace } from './validate-affinity-workflow.js';

const execFileAsync = promisify(execFile);

export const RESOLUTION_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-design-risk-resolutions.json`;
const STAGING_PREFIX = `${AFFINITY_EXPERIMENT_ROOT}/review/activation-staging/targets/`;

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
	readonly decisionList?: unknown;
	readonly decisionDatabaseAvailable: boolean;
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

export interface ActivatedFinalControlledDecisionChainReport {
	readonly valid: boolean;
	readonly readiness: ActivationReadinessReport;
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
			['death-knight', 'elemental', 'gray-wolf', 'cave-bear'].includes(target.speciesId)
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
	const parsed = FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(input.resolutions);
	if (!parsed.success) {
		blockers.push({ code: 'missing-or-invalid-v2-resolutions', detail: parsed.error.message });
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
	if (
		ledger.humanDecisionRecord.recordCanonicalSha256 !==
		sha256Json(ledger.humanDecisionRecord.record)
	)
		blockers.push({
			code: 'invalid-human-decision-record-hash',
			detail: 'The embedded DB decision canonical hash is invalid'
		});
	if (!input.decisionDatabaseAvailable) {
		blockers.push({
			code: 'decision-database-unavailable',
			detail: 'Authoritative design-risk decision evidence is unavailable'
		});
	} else {
		const decisionList = FinalControlledDesignRiskDecisionListSchema.safeParse(input.decisionList);
		if (!decisionList.success) {
			blockers.push({
				code: 'invalid-decision-database-evidence',
				detail: 'Authoritative design-risk decision evidence is invalid'
			});
		} else {
			const latestForActor = decisionList.data.latestByActor.filter(
				(record) => record.actor === ledger.actor
			);
			if (
				latestForActor.length !== 1 ||
				latestForActor[0]?.decisionId !== ledger.resolutionId ||
				canonicalJson(latestForActor[0]) !== canonicalJson(ledger.humanDecisionRecord.record)
			) {
				blockers.push({
					code: 'noncurrent-or-inauthentic-human-decision',
					detail:
						'The ledger does not embed the actor’s latest unsuperseded authoritative DB decision'
				});
			}
		}
	}
	for (const [label, actual, expected] of [
		['plan', ledger.evidenceBindings.planCanonicalSha256, sha256Json(plan)],
		['catalog', ledger.evidenceBindings.catalogCanonicalSha256, sha256Json(catalog)],
		[
			'execution-snapshot',
			ledger.evidenceBindings.executionSnapshotCanonicalSha256,
			expectedSnapshotHash
		],
		[
			'blind-review',
			ledger.evidenceBindings.blindReviewCollectionCanonicalSha256,
			sha256Json(reviews)
		],
		[
			'source-audit',
			ledger.evidenceBindings.sourceAuditCanonicalSha256,
			sha256Json(plan.designRiskReview)
		]
	] as const)
		if (actual !== expected)
			blockers.push({
				code: 'stale-binding',
				detail: `${label} hash does not match current evidence`
			});
	if (
		canonicalJson(ledger.eligibleOriginalControlledTargetIds) !==
			canonicalJson(FinalControlledEligibleOriginalCandidateTargetIds) ||
		canonicalJson(candidateIds) !== canonicalJson(FinalControlledEligibleOriginalCandidateTargetIds)
	)
		blockers.push({
			code: 'eligible-target-binding-mismatch',
			detail: 'The 21 eligible target IDs are not canonical'
		});
	const expectedRevises = FinalControlledOriginalReviseResults.map((expected) => {
		const result = reviseResults.find(
			(candidate) => candidate.resultId === expected.id && candidate.targetId === expected.targetId
		);
		return result ? { ...expected, contentHash: sha256Json(result) } : null;
	});
	if (
		expectedRevises.some((result) => result === null) ||
		canonicalJson(ledger.reviseResults) !== canonicalJson(expectedRevises)
	)
		blockers.push({
			code: 'revise-binding-mismatch',
			detail: 'The three revise result hashes are not immutable/current'
		});
	const eligibleReviewByTarget = new Map(
		eligibleReviews.map((review) => [review.targetId, review])
	);
	const planned = buildFinalControlledRerunBundle(plan);
	for (const [index, risk] of plan.designRiskReview.risks.entries()) {
		const resolution = ledger.resolutions[index];
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
		for (const evidence of resolution.blindReviewEvidence)
			if (
				!eligibleReviews.some(
					(review) =>
						review.reviewId === evidence.id &&
						review.targetId === evidence.targetId &&
						review.candidateContentHash === evidence.candidateContentHash &&
						sha256Json(review) === evidence.contentHash
				)
			)
				blockers.push({
					code: 'invalid-risk-review-evidence',
					detail: `Risk ${risk.riskId} cites non-eligible blind evidence`
				});
		for (const evidence of resolution.reviseResultEvidence)
			if (
				!reviseResults.some(
					(result) =>
						result.resultId === evidence.id &&
						result.targetId === evidence.targetId &&
						sha256Json(result) === evidence.contentHash
				)
			)
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
		if (originalResult?.status === 'candidate') {
			const requiredReview = eligibleReviewByTarget.get(originalResult.targetId);
			if (
				!requiredReview ||
				!resolution.blindReviewEvidence.some(
					(evidence) =>
						evidence.id === requiredReview.reviewId &&
						evidence.targetId === requiredReview.targetId &&
						evidence.candidateContentHash === requiredReview.candidateContentHash &&
						evidence.contentHash === sha256Json(requiredReview)
				)
			) {
				blockers.push({
					code: 'missing-coordinate-review-evidence',
					detail: `Risk ${risk.riskId} lacks blind evidence for its own original coordinate`
				});
			}
		}
		if (originalResult?.status === 'revise') {
			const resultHash = sha256Json(originalResult);
			if (
				!resolution.reviseResultEvidence.some(
					(evidence) =>
						evidence.id === originalResult.resultId &&
						evidence.targetId === originalResult.targetId &&
						evidence.contentHash === resultHash
				)
			) {
				blockers.push({
					code: 'missing-coordinate-revise-evidence',
					detail: `Risk ${risk.riskId} lacks immutable revise evidence for its own original coordinate`
				});
			}
		}
		if (resolution.decision.startsWith('replace-') && resolution.stagedTarget) {
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
				resolution.stagedTarget.path === FinalControlledDesignRiskStagedTargetPaths[index];
			const promptHash = createHash('sha256').update(verification.exactPrompt).digest('hex');
			const refsValid =
				target.references.length === Object.keys(verification.referenceHashes).length &&
				target.references.every(
					(ref) => verification.referenceHashes[ref.path] === ref.contentHash
				);
			if (
				!validPath ||
				target.targetId !== expected.targetId ||
				target.assetId !== expected.assetId ||
				target.experimentId !== expected.experimentId ||
				target.packId !== expected.packId ||
				target.speciesId !== expected.speciesId ||
				target.affinity !== expected.affinity ||
				target.cohort !== expected.cohort ||
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
			resolvedRisks: ledger.resolutions.length
		},
		blockers
	};
}

/**
 * Revalidates the immutable evidence and current DB decision behind an existing activation.
 * Expected live final-controlled paths and the base-only workspace validator are intentionally
 * excluded here: the receipt verifier owns the activated artifact bytes, while this verifier owns
 * the v2 ledger, original evidence, staged corrections, and latest append-only human decision.
 */
export function buildActivatedFinalControlledDecisionChainReadiness(
	input: ActivationReadinessInput,
	receiptInput: unknown
): ActivatedFinalControlledDecisionChainReport {
	const readiness = buildFinalControlledActivationReadiness({
		...input,
		currentWorkspaceValid: true,
		plannedPathsAbsent: true
	});
	const blockers = [...readiness.blockers];
	const receipt = FinalControlledActivationReceiptSchema.safeParse(receiptInput);
	const ledger = FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(input.resolutions);
	if (!receipt.success) {
		blockers.push({
			code: 'missing-or-invalid-activation-receipt',
			detail: 'The existing activation receipt is missing or invalid.'
		});
	} else if (ledger.success) {
		const expectedBindings: FinalControlledActivationReceipt['bindings'] = {
			planCanonicalSha256: ledger.data.evidenceBindings.planCanonicalSha256,
			resolutionLedgerCanonicalSha256: sha256Json(ledger.data),
			blindReviewCanonicalSha256: ledger.data.evidenceBindings.blindReviewCollectionCanonicalSha256,
			catalogCanonicalSha256: ledger.data.evidenceBindings.catalogCanonicalSha256,
			executionSnapshotSha256: ledger.data.evidenceBindings.executionSnapshotCanonicalSha256
		};
		if (canonicalJson(receipt.data.bindings) !== canonicalJson(expectedBindings)) {
			blockers.push({
				code: 'activation-receipt-ledger-binding-mismatch',
				detail:
					'The existing activation receipt is not bound to the current DB-authentic v2 ledger and evidence.'
			});
		}
	}
	return {
		valid: readiness.authorized && blockers.length === 0,
		readiness,
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
	resolution: FinalControlledDesignRiskResolutionLedgerV2['resolutions'][number]
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
	let decisionList: unknown;
	let decisionDatabaseAvailable = true;
	try {
		decisionList = await listFinalControlledDesignRiskDecisions(
			getConfig().databaseUrl,
			'affinity-workflow-v1',
			'final-controlled-activation-v1'
		);
	} catch {
		decisionDatabaseAvailable = false;
	}
	const parsedResolutions =
		FinalControlledDesignRiskResolutionLedgerV2Schema.safeParse(resolutions);
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
		decisionList,
		decisionDatabaseAvailable,
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
