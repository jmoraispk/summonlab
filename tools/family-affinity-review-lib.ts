import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import {
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	stat,
	unlink,
	writeFile,
	type FileHandle
} from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import sharp from 'sharp';
import { z } from 'zod';

import {
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityBlindReviewReceiptSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityResultSchema,
	FamilyAffinityReviewAssignmentSchema,
	FamilyAffinityReviewReceiptSchema,
	FamilyAffinityTargetSchema,
	familyAffinitySourcePacketBinding,
	PRODUCTION_AFFINITIES,
	bridgeAttemptPaths,
	canonicalAttemptPaths,
	familyAffinityProducerIdentitySha256,
	familyAffinityPromptSha256,
	familyAffinityRawSha256,
	familyAffinityReviewIssuerAttestationSha256,
	familyAffinityReviewAssignmentPath,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	validateFamilyAffinityCandidateEvidence,
	validateFamilyAffinityAttemptCrossBinding,
	validateFamilyAffinityReceiptEvidence,
	validateFamilyAffinityReviewAssignmentEvidence,
	validateCanonicalTargetSourceBinding,
	type FamilyAffinityAssignment,
	type FamilyAffinityBlindReviewReceipt,
	type FamilyAffinityManifest,
	type FamilyAffinityResult,
	type FamilyAffinityReviewAssignment,
	type FamilyAffinityReviewReceipt,
	type FamilyAffinityTarget,
	type FamilyForm,
	type FamilyPacket
} from './family-affinity-production-lib.js';

export {
	FamilyAffinityBlindReviewReceiptSchema as BlindReviewReceiptSchema,
	FamilyAffinityResultSchema as FamilyAffinityCandidateResultSchema,
	FamilyAffinityReviewAssignmentSchema,
	FamilyAffinityReviewReceiptSchema as OrdinaryReviewReceiptSchema
} from './family-affinity-production-lib.js';

export const FAMILY_AFFINITY_REVIEW_ROOT = `${FAMILY_AFFINITY_ROOT}/review` as const;
export const FAMILY_AFFINITY_REVIEW_CATALOG_PATH =
	`${FAMILY_AFFINITY_REVIEW_ROOT}/catalog.json` as const;
export const FAMILY_CONTACT_SHEET_WIDTH = 1600 as const;
export const FAMILY_CONTACT_SHEET_HEIGHT = 1200 as const;

const FailureHashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const GenerationFailureCallSchema = z
	.object({
		callOrdinal: z.number().int().positive(),
		kind: z.enum(['initial', 'correction']),
		promptSha256: FailureHashSchema.nullable(),
		providerRunId: z.string().min(1).nullable(),
		sourcePath: z.string().min(1).nullable(),
		sourceSha256: FailureHashSchema.nullable(),
		outcomeCode: z.enum([
			'provider-output-unavailable',
			'provider-moderation-blocked',
			'visual-contract-rejected'
		]),
		reasons: z.array(z.string().min(1)).min(1)
	})
	.strict();
const GenerationFailureRunSchema = z
	.object({
		runOrdinal: z.number().int().positive(),
		producerId: z.string().min(1),
		canonicalPromptSha256: FailureHashSchema,
		calls: z.array(GenerationFailureCallSchema).min(1).max(2)
	})
	.strict();
const GenerationFailureSupersessionOverridesSchema = z
	.object({
		anatomyInvariants: z.array(z.string().min(1)).min(1).optional(),
		telegraph: z.string().min(1).optional(),
		acceptanceCriteria: z.array(z.string().min(1)).min(8).optional()
	})
	.strict()
	.refine((value) => Object.keys(value).length > 0, {
		message: 'Generation-failure supersession overrides cannot be empty'
	});
export const FamilyAffinityGenerationFailureSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-generation-failure-v1'),
		experimentId: z.literal('family-affinity-v1'),
		namespace: z.literal('canonical'),
		coordinateId: z.string().min(1),
		targetId: z.string().min(1),
		targetPath: z.string().min(1),
		targetSha256: FailureHashSchema,
		assignmentPath: z.string().min(1),
		assignmentSha256: FailureHashSchema,
		candidateVersion: z.number().int().positive(),
		failureKind: z.literal('exhausted-nonretained-generation'),
		producerRuns: z.array(GenerationFailureRunSchema).length(2),
		retainedCandidateCreated: z.literal(false),
		resultReceiptCreated: z.literal(false),
		reviewReceiptsCreated: z.literal(false),
		supersessionTargetVersion: z.number().int().positive(),
		supersessionOverrides: GenerationFailureSupersessionOverridesSchema.optional(),
		supersessionAuthorizedBy: z.string().min(1),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict();
export type FamilyAffinityGenerationFailure = z.infer<typeof FamilyAffinityGenerationFailureSchema>;

export type CanonicalGenerationFailureSupersessionSourceBinding = {
	previousTargetPath: string;
	previousAssignmentPath: string;
	previousTarget: unknown;
	previousAssignment: unknown;
	generationFailure: unknown;
};

export function familyAffinityGenerationFailurePath(target: FamilyAffinityTarget): string {
	return target.namespace === 'canonical'
		? `${FAMILY_AFFINITY_ROOT}/generation-failures/${target.familyId}/${target.formId}/${target.affinity}/attempt-v${target.version}.json`
		: `${FAMILY_AFFINITY_ROOT}/generation-failures/bridge/${target.currentClassId}/${target.affinity}/attempt-v${target.version}.json`;
}

export function validateFamilyAffinityGenerationFailureEvidence(input: {
	target: FamilyAffinityTarget;
	targetPath: string;
	assignment: FamilyAffinityAssignment;
	assignmentPath: string;
	evidence: unknown;
}): FamilyAffinityGenerationFailure {
	const evidence = FamilyAffinityGenerationFailureSchema.parse(input.evidence);
	const promptSha256 = familyAffinityPromptSha256(input.target, input.assignment);
	if (
		evidence.coordinateId !== input.target.coordinateId ||
		evidence.targetId !== input.target.targetId ||
		evidence.targetPath !== input.targetPath ||
		evidence.targetSha256 !== familyAffinitySha256(input.target) ||
		evidence.assignmentPath !== input.assignmentPath ||
		evidence.assignmentSha256 !== familyAffinitySha256(input.assignment) ||
		evidence.candidateVersion !== input.target.version ||
		evidence.supersessionTargetVersion !== input.target.version + 1 ||
		evidence.producerRuns.some((run) => run.canonicalPromptSha256 !== promptSha256) ||
		new Set(evidence.producerRuns.map(({ producerId }) => producerId)).size !== 2 ||
		evidence.producerRuns.some(
			(run) =>
				run.calls.length !== input.assignment.retryCeiling + 1 ||
				run.calls[0]?.kind !== 'initial' ||
				run.calls[0]?.promptSha256 !== promptSha256 ||
				run.calls[1]?.kind !== 'correction'
		)
	) {
		throw new Error('Generation-failure evidence is stale, incomplete, or cross-bound');
	}
	return evidence;
}

/**
 * Preserves strict packet binding for a canonical target whose immediately preceding
 * generation-failure receipt explicitly authorized a small, schema-allowlisted source override.
 * The ordinary packet validator remains unchanged and cannot be bypassed without authenticated
 * predecessor evidence.
 */
export function validateCanonicalGenerationFailureSupersessionSourceBinding(input: {
	family: FamilyPacket;
	form: FamilyForm;
	supersedingTarget: unknown;
	binding: CanonicalGenerationFailureSupersessionSourceBinding;
}): void {
	const previousTarget = FamilyAffinityTargetSchema.parse(input.binding.previousTarget);
	const previousAssignment = FamilyAffinityAssignmentSchema.parse(input.binding.previousAssignment);
	const supersedingTarget = FamilyAffinityTargetSchema.parse(input.supersedingTarget);
	validateCanonicalTargetSourceBinding(previousTarget, input.family, input.form);
	const failure = validateFamilyAffinityGenerationFailureEvidence({
		target: previousTarget,
		targetPath: input.binding.previousTargetPath,
		assignment: previousAssignment,
		assignmentPath: input.binding.previousAssignmentPath,
		evidence: input.binding.generationFailure
	});
	const overrides = failure.supersessionOverrides;
	if (!overrides) {
		throw new Error('Generation-failure source binding requires explicit supersession overrides');
	}
	if (
		supersedingTarget.namespace !== 'canonical' ||
		previousTarget.coordinateId !== supersedingTarget.coordinateId ||
		previousTarget.version + 1 !== supersedingTarget.version ||
		failure.supersessionTargetVersion !== supersedingTarget.version
	) {
		throw new Error('Generation-failure source binding is not an immediate canonical supersession');
	}
	for (const field of ['anatomyInvariants', 'telegraph', 'acceptanceCriteria'] as const) {
		const override = overrides[field];
		if (
			override !== undefined &&
			stableFamilyAffinityJson(supersedingTarget[field]) !== stableFamilyAffinityJson(override)
		) {
			throw new Error(
				`Generation-failure source override does not match superseding target: ${field}`
			);
		}
	}
	const normalizedTarget = FamilyAffinityTargetSchema.parse({
		...supersedingTarget,
		...(overrides.anatomyInvariants === undefined
			? {}
			: { anatomyInvariants: previousTarget.anatomyInvariants }),
		...(overrides.telegraph === undefined ? {} : { telegraph: previousTarget.telegraph }),
		...(overrides.acceptanceCriteria === undefined
			? {}
			: { acceptanceCriteria: previousTarget.acceptanceCriteria })
	});
	validateCanonicalTargetSourceBinding(normalizedTarget, input.family, input.form);
}

export type FamilyAffinityCandidateResult = FamilyAffinityResult;
export type OrdinaryReviewReceipt = FamilyAffinityReviewReceipt;
export type BlindReviewReceipt = FamilyAffinityBlindReviewReceipt;
export type ReviewDecision = 'approved-review' | 'rejected' | 'revise';
export type ReviewState = 'planned' | 'candidate' | 'approved-review' | 'rejected' | 'revise';

export function reviewReceiptPath(
	kind: 'ordinary' | 'blind',
	familyId: string,
	formId: string,
	affinity: (typeof PRODUCTION_AFFINITIES)[number],
	candidateVersion: number,
	decisionVersion: number
): string {
	const leaf =
		kind === 'ordinary'
			? `candidate-v${candidateVersion}-review-v${decisionVersion}.json`
			: `candidate-v${candidateVersion}-blind-v${decisionVersion}.json`;
	const bucket = kind === 'ordinary' ? 'decisions' : 'blind';
	return `${FAMILY_AFFINITY_REVIEW_ROOT}/${bucket}/${familyId}/${formId}/${affinity}/${leaf}`;
}

export function validateReviewTransition(from: ReviewState, to: ReviewState): void {
	if ((from as string) === 'runtime' || (to as string) === 'runtime') {
		throw new Error('Runtime transitions are forbidden inside family-affinity-v1');
	}
	if (
		(from === 'planned' && to === 'candidate') ||
		(from === 'candidate' && to === 'approved-review')
	) {
		return;
	}
	throw new Error(`Illegal review transition ${from} → ${to}; approval requires candidate state`);
}

export function evaluateFamilyAffinityReviewAttempt(input: {
	target: unknown;
	assignment?: unknown;
	familyPacketBytes?: Uint8Array;
	candidateBytes?: Uint8Array;
	resultBytes?: Uint8Array;
	ordinary?: unknown;
	blind?: unknown;
}): { state: ReviewState; revisionRequired: boolean; approved: boolean } {
	const target = FamilyAffinityTargetSchema.parse(input.target);
	if (!input.candidateBytes && !input.resultBytes && !input.ordinary && !input.blind) {
		return { state: 'planned', revisionRequired: false, approved: false };
	}
	if (!input.resultBytes) throw new Error('Candidate requires an immutable result receipt');
	if (!input.candidateBytes) throw new Error('Result receipt requires candidate bytes');
	if (target.status !== 'planned' && target.status !== 'earth-bridge-provisional')
		throw new Error('Only a planned production target may enter candidate state');
	validateReviewTransition('planned', 'candidate');

	if (!input.assignment)
		throw new Error('Candidate review requires production assignment evidence');
	if (!input.familyPacketBytes) throw new Error('Candidate review requires family packet evidence');
	const evidence = validateFamilyAffinityCandidateEvidence({
		target,
		assignment: input.assignment,
		familyPacketBytes: input.familyPacketBytes,
		candidateBytes: input.candidateBytes,
		resultBytes: input.resultBytes
	});
	const result = evidence.result;
	const requiresBlind = target.tier === 'T3' || target.tier === 'T5';
	let blind: BlindReviewReceipt | undefined;
	if (input.blind) {
		blind = validateFamilyAffinityReceiptEvidence({
			target,
			result,
			resultSha256: evidence.resultSha256,
			receipt: input.blind,
			kind: 'blind'
		}) as BlindReviewReceipt;
		if (!requiresBlind)
			throw new Error('Blind receipts are owned only by T3/T5 candidate versions');
	}
	if (!input.ordinary) return { state: 'candidate', revisionRequired: false, approved: false };
	const ordinary = validateFamilyAffinityReceiptEvidence({
		target,
		result,
		resultSha256: evidence.resultSha256,
		receipt: input.ordinary,
		kind: 'ordinary'
	}) as OrdinaryReviewReceipt;
	if (blind?.reviewerId === ordinary.reviewerId) {
		throw new Error('Blind reviewer must be independent from the ordinary reviewer');
	}
	if (requiresBlind && !blind)
		throw new Error('T3/T5 candidate version requires a blind review receipt');
	if (blind && blind.decision !== ordinary.decision) {
		return { state: 'revise', revisionRequired: true, approved: false };
	}
	if (
		target.anchor.kind === 'earth-bridge-provisional' &&
		ordinary.decision === 'approved-review'
	) {
		throw new Error('Provisional Earth target cannot reach approved-review before Normal anchor');
	}
	if (ordinary.decision !== 'approved-review') {
		return { state: ordinary.decision, revisionRequired: true, approved: false };
	}
	validateReviewTransition('candidate', 'approved-review');
	return { state: 'approved-review', revisionRequired: false, approved: true };
}

function absoluteOwnedPath(repositoryRoot: string, ownedPath: string): string {
	const absoluteRoot = resolve(repositoryRoot);
	const absolute = resolve(absoluteRoot, ownedPath);
	if (!absolute.startsWith(`${absoluteRoot}${sep}`))
		throw new Error('Owned path escapes repository root');
	return absolute;
}

type AnchoredOwnedParent = {
	handle: FileHandle;
	ownedPath: string;
	basename: string;
};

const ANCHORED_DIRECTORY_FLAGS =
	fsConstants.O_RDONLY | fsConstants.O_DIRECTORY | fsConstants.O_NOFOLLOW;
const ANCHORED_CREATE_FLAGS =
	fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW;

function procFdPath(handle: FileHandle, basename?: string): string {
	const root = `/proc/self/fd/${handle.fd}`;
	return basename === undefined ? root : `${root}/${basename}`;
}

async function verifyProcFdHandle(handle: FileHandle, context: string): Promise<void> {
	if (process.platform !== 'linux') {
		throw new Error('Anchored review mutation requires Linux O_NOFOLLOW and /proc/self/fd');
	}
	try {
		const [held, throughProc] = await Promise.all([handle.stat(), stat(procFdPath(handle))]);
		if (
			!held.isDirectory() ||
			!throughProc.isDirectory() ||
			held.dev !== throughProc.dev ||
			held.ino !== throughProc.ino
		) {
			throw new Error('proc-fd inode mismatch');
		}
	} catch (error) {
		throw new Error(
			`Anchored review mutation cannot verify Linux /proc/self/fd for ${context}; fail closed`,
			{ cause: error }
		);
	}
}

async function openAnchoredOwnedParent(
	repositoryRoot: string,
	ownedPath: string,
	createDirectories: boolean
): Promise<AnchoredOwnedParent> {
	absoluteOwnedPath(repositoryRoot, ownedPath);
	const parts = ownedPath.split('/');
	if (
		parts.length < 2 ||
		parts.some((part) => part.length === 0 || part === '.' || part === '..')
	) {
		throw new Error(`Anchored review mutation requires a normalized owned path: ${ownedPath}`);
	}
	const basename = parts.pop()!;
	let current: FileHandle;
	try {
		current = await open(resolve(repositoryRoot), ANCHORED_DIRECTORY_FLAGS);
	} catch (error) {
		throw new Error(
			'Anchored review mutation cannot open the repository root without following links',
			{
				cause: error
			}
		);
	}
	try {
		await verifyProcFdHandle(current, repositoryRoot);
		for (const part of parts) {
			const childPath = procFdPath(current, part);
			let child: FileHandle;
			try {
				child = await open(childPath, ANCHORED_DIRECTORY_FLAGS);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'ENOENT' || !createDirectories) {
					throw new Error(
						`Anchored review parent is missing, changed, or symlinked: ${ownedPath}`,
						{ cause: error }
					);
				}
				try {
					await mkdir(childPath);
				} catch (creationError) {
					if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
				}
				try {
					child = await open(childPath, ANCHORED_DIRECTORY_FLAGS);
				} catch (openError) {
					throw new Error(
						`Anchored review parent was replaced or symlinked during creation: ${ownedPath}`,
						{ cause: openError }
					);
				}
			}
			try {
				await verifyProcFdHandle(child, `${ownedPath}:${part}`);
				await current.close();
			} catch (error) {
				await child.close().catch(() => undefined);
				throw error;
			}
			current = child;
		}
		return { handle: current, ownedPath, basename };
	} catch (error) {
		await current.close().catch(() => undefined);
		throw error;
	}
}

async function verifyAnchoredOwnedParentBinding(
	repositoryRoot: string,
	anchored: AnchoredOwnedParent
): Promise<void> {
	let rebound: AnchoredOwnedParent;
	try {
		rebound = await openAnchoredOwnedParent(repositoryRoot, anchored.ownedPath, false);
	} catch (error) {
		throw new Error(
			`Anchored review parent binding changed or became symlinked: ${anchored.ownedPath}`,
			{
				cause: error
			}
		);
	}
	try {
		const [held, current] = await Promise.all([anchored.handle.stat(), rebound.handle.stat()]);
		if (held.dev !== current.dev || held.ino !== current.ino) {
			throw new Error(`Anchored review parent binding changed: ${anchored.ownedPath}`);
		}
	} finally {
		await rebound.handle.close();
	}
}

async function writeExclusiveThroughAnchoredParent(
	parent: AnchoredOwnedParent,
	bytes: Uint8Array
): Promise<void> {
	const file = await open(procFdPath(parent.handle, parent.basename), ANCHORED_CREATE_FLAGS, 0o600);
	try {
		await file.writeFile(bytes);
	} finally {
		await file.close();
	}
}

async function ensureSafeParent(repositoryRoot: string, ownedPath: string): Promise<string> {
	const absolute = absoluteOwnedPath(repositoryRoot, ownedPath);
	const parent = dirname(absolute);
	const root = resolve(repositoryRoot);
	const parts = relative(root, parent).split(sep).filter(Boolean);
	let cursor = root;
	for (const part of parts) {
		cursor = join(cursor, part);
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
				throw new Error(`Review receipt parent is not a real directory: ${cursor}`);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			try {
				await mkdir(cursor);
			} catch (creationError) {
				if ((creationError as NodeJS.ErrnoException).code !== 'EEXIST') throw creationError;
				const metadata = await lstat(cursor);
				if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
					throw new Error(`Review receipt parent is not a real directory: ${cursor}`);
				}
			}
		}
	}
	return absolute;
}

async function requiredRealFile(repositoryRoot: string, ownedPath: string): Promise<Buffer> {
	const bytes = await optionalRealFile(repositoryRoot, ownedPath);
	if (!bytes) throw new Error(`Missing immutable review artifact: ${ownedPath}`);
	return bytes;
}

async function loadLiveReviewAttempt(
	repositoryRoot: string,
	targetPath: string,
	productionAssignmentPath: string,
	manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`
) {
	const manifestBytes = await requiredRealFile(repositoryRoot, manifestPath);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const targetBytes = await requiredRealFile(repositoryRoot, targetPath);
	const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
	const productionAssignmentBytes = await requiredRealFile(
		repositoryRoot,
		productionAssignmentPath
	);
	const productionAssignment = FamilyAffinityAssignmentSchema.parse(
		JSON.parse(productionAssignmentBytes.toString('utf8'))
	);
	const expectedPaths =
		target.namespace === 'canonical'
			? canonicalAttemptPaths(target.familyId, target.formId, target.affinity, target.version)
			: bridgeAttemptPaths(target.currentClassId!, target.affinity, target.version);
	if (
		targetPath !== expectedPaths.target ||
		productionAssignmentPath !== expectedPaths.assignment
	) {
		throw new Error('Review authorization target/assignment paths are not exact');
	}
	const collection = target.namespace === 'canonical' ? manifest.canonicalMatrix : manifest.bridge;
	const coordinate = collection.activeCoordinates.find(
		(entry) => entry.coordinateId === target.coordinateId
	);
	if (
		!coordinate ||
		coordinate.activeVersion !== target.version ||
		coordinate.targetPath !== targetPath ||
		coordinate.targetSha256 !== familyAffinitySha256(target) ||
		coordinate.assignmentPath !== productionAssignmentPath ||
		coordinate.assignmentSha256 !== familyAffinitySha256(productionAssignment)
	) {
		throw new Error('Review authorization is stale or manifest-unbound');
	}
	const candidateBytes = await requiredRealFile(repositoryRoot, target.ownedPaths.candidate);
	const resultBytes = await requiredRealFile(repositoryRoot, target.ownedPaths.result);
	const familyPacketBytes = await requiredRealFile(
		repositoryRoot,
		familyAffinitySourcePacketBinding(target).path
	);
	const result = FamilyAffinityResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
	evaluateFamilyAffinityReviewAttempt({
		target,
		assignment: productionAssignment,
		familyPacketBytes,
		candidateBytes,
		resultBytes
	});
	return {
		manifestBytes,
		target,
		productionAssignment,
		productionAssignmentBytes,
		candidateBytes,
		result,
		resultBytes,
		familyPacketBytes
	};
}

type ReviewAssignmentIdentityPair = {
	producerId: string;
	ordinary?: FamilyAffinityReviewAssignment;
	blind?: FamilyAffinityReviewAssignment;
};

function validateReviewAssignmentIdentityPair(input: ReviewAssignmentIdentityPair): void {
	for (const assignment of [input.ordinary, input.blind]) {
		if (!assignment) continue;
		if (
			assignment.issuerId === input.producerId ||
			assignment.reviewerId === input.producerId ||
			assignment.issuerId === assignment.reviewerId
		) {
			throw new Error(
				'Review assignment controller, producer, and reviewer identities must be separate'
			);
		}
	}
	if (!input.ordinary || !input.blind) return;
	if (
		input.ordinary.reviewerId === input.blind.reviewerId ||
		input.ordinary.issuerId === input.blind.reviewerId ||
		input.blind.issuerId === input.ordinary.reviewerId
	) {
		throw new Error(
			'Ordinary and blind review assignments require independent cross-kind issuers and reviewers'
		);
	}
}

function reviewAssignmentIssuanceLockPath(target: FamilyAffinityTarget): string {
	if (target.namespace === 'bridge') {
		return `${FAMILY_AFFINITY_ROOT}/review/bridge/assignments/locks/${target.currentClassId}/${target.affinity}/candidate-v${target.version}.lock`;
	}
	return `${FAMILY_AFFINITY_ROOT}/review/assignments/locks/${target.familyId}/${target.formId}/${target.affinity}/candidate-v${target.version}.lock`;
}

async function acquireReviewAssignmentIssuanceLock(
	repositoryRoot: string,
	target: FamilyAffinityTarget,
	input: { issuerId: string; kind: 'ordinary' | 'blind' },
	afterParentAnchored?: () => Promise<void>
): Promise<{ parent: AnchoredOwnedParent; bytes: Buffer }> {
	const ownedPath = reviewAssignmentIssuanceLockPath(target);
	const parent = await openAnchoredOwnedParent(repositoryRoot, ownedPath, true);
	const bytes = Buffer.from(
		stableFamilyAffinityJson({
			schemaVersion: 'family-affinity-review-issuance-lock-v1',
			targetId: target.targetId,
			coordinateId: target.coordinateId,
			candidateVersion: target.version,
			issuerId: input.issuerId,
			reviewKind: input.kind
		})
	);
	try {
		await afterParentAnchored?.();
		await verifyAnchoredOwnedParentBinding(repositoryRoot, parent);
		await writeExclusiveThroughAnchoredParent(parent, bytes);
	} catch (error) {
		await parent.handle.close().catch(() => undefined);
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(
				`Review assignment issuance lock is active or crash-stale: ${ownedPath}. Retry after the active issuance completes; remove only after controller audit.`
			);
		}
		throw error;
	}
	return { parent, bytes };
}

async function releaseReviewAssignmentIssuanceLock(
	lock: Awaited<ReturnType<typeof acquireReviewAssignmentIssuanceLock>>,
	beforeRelease?: () => Promise<void>
): Promise<void> {
	try {
		await beforeRelease?.();
		let heldFile: FileHandle;
		try {
			heldFile = await open(
				procFdPath(lock.parent.handle, lock.parent.basename),
				fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
			);
		} catch (error) {
			throw new Error(
				`Review assignment issuance lock cannot be opened through its anchored parent; manual controller audit required: ${lock.parent.ownedPath}`,
				{ cause: error }
			);
		}
		let currentBytes: Buffer;
		try {
			currentBytes = await heldFile.readFile();
		} finally {
			await heldFile.close();
		}
		if (!currentBytes.equals(lock.bytes)) {
			throw new Error(
				`Review assignment issuance lock changed while held; manual controller audit required: ${lock.parent.ownedPath}`
			);
		}
		await unlink(procFdPath(lock.parent.handle, lock.parent.basename));
	} finally {
		await lock.parent.handle.close();
	}
}

type ReviewAssignmentIssuanceTestHooks = {
	afterLockParentAnchored?: () => Promise<void>;
	afterAssignmentParentAnchored?: () => Promise<void>;
	beforeLockRelease?: () => Promise<void>;
};

async function writeReviewAssignmentExclusiveAnchored(
	repositoryRoot: string,
	ownedPath: string,
	bytes: Uint8Array,
	afterParentAnchored?: () => Promise<void>
): Promise<void> {
	const parent = await openAnchoredOwnedParent(repositoryRoot, ownedPath, true);
	try {
		await afterParentAnchored?.();
		await verifyAnchoredOwnedParentBinding(repositoryRoot, parent);
		await writeExclusiveThroughAnchoredParent(parent, bytes);
	} finally {
		await parent.handle.close();
	}
}

export async function issueReviewAssignmentExclusive(
	repositoryRoot: string,
	input: {
		callerRole: string;
		issuerId: string;
		kind: 'ordinary' | 'blind';
		reviewerId: string;
		targetPath: string;
		productionAssignmentPath: string;
		decisionVersion: number;
		manifestPath?: string;
	},
	testHooks: ReviewAssignmentIssuanceTestHooks = {}
): Promise<{ path: string; assignment: FamilyAffinityReviewAssignment }> {
	if (input.callerRole !== 'controller') {
		throw new Error('Only callerRole controller may issue review assignments');
	}
	if (input.issuerId.trim().length === 0 || input.issuerId === input.reviewerId) {
		throw new Error('Controller issuer identity must be non-empty and separate from reviewer');
	}
	const manifestPath = input.manifestPath ?? `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const live = await loadLiveReviewAttempt(
		repositoryRoot,
		input.targetPath,
		input.productionAssignmentPath,
		manifestPath
	);
	if (input.reviewerId === live.result.producerId) {
		throw new Error('Producer cannot receive a review assignment for self-approval');
	}
	if (input.issuerId === live.result.producerId) {
		throw new Error('Controller issuer identity must be separate from producer identity');
	}
	const requiresBlind = live.target.tier === 'T3' || live.target.tier === 'T5';
	if (input.kind === 'blind' && !requiresBlind) {
		throw new Error('Blind assignments are only valid for T3/T5 candidates');
	}
	if (input.decisionVersion !== live.target.version) {
		throw new Error('One immutable review assignment is permitted per active candidate version');
	}
	const permittedReceiptPath =
		input.kind === 'ordinary'
			? live.target.ownedPaths.decision
			: live.target.ownedPaths.blindReview;
	const path = familyAffinityReviewAssignmentPath(input.kind, live.target, input.decisionVersion);
	const resultSha256 = familyAffinityRawSha256(live.resultBytes);
	const manifestSha256 = familyAffinityRawSha256(live.manifestBytes);
	const issuerAttestationSha256 = familyAffinityReviewIssuerAttestationSha256({
		issuerId: input.issuerId,
		reviewerId: input.reviewerId,
		kind: input.kind,
		manifestPath,
		manifestSha256,
		target: live.target,
		targetPath: input.targetPath,
		productionAssignment: live.productionAssignment,
		productionAssignmentPath: input.productionAssignmentPath,
		result: live.result,
		resultSha256,
		decisionVersion: input.decisionVersion,
		permittedReceiptPath
	});
	const assignment = FamilyAffinityReviewAssignmentSchema.parse({
		schemaVersion: 'family-affinity-review-assignment-v1',
		issuerRole: 'controller',
		issuerId: input.issuerId,
		issuerAttestationSha256,
		reviewKind: input.kind,
		assignmentId: `${live.target.targetId}/${input.kind}-review-v${input.decisionVersion}/assignment`,
		reviewerId: input.reviewerId,
		producerId: input.kind === 'ordinary' ? live.result.producerId : null,
		producerIdentitySha256: familyAffinityProducerIdentitySha256(live.result.producerId),
		manifestPath,
		manifestSha256,
		targetId: live.target.targetId,
		targetPath: input.targetPath,
		targetSha256: familyAffinitySha256(live.target),
		productionAssignmentPath: input.productionAssignmentPath,
		productionAssignmentSha256: familyAffinitySha256(live.productionAssignment),
		coordinateId: live.target.coordinateId,
		candidateVersion: live.target.version,
		decisionVersion: input.decisionVersion,
		candidatePath: live.result.candidatePath,
		candidateSha256: live.result.candidateSha256,
		resultPath: live.result.resultPath,
		resultSha256,
		sourcePath: live.result.sourcePath,
		sourceSha256: live.result.sourceSha256,
		promptSha256: live.result.promptSha256,
		permittedReceiptPath,
		exclusiveCreateRequired: true,
		runtimeCatalogMutationForbidden: true
	});
	const issuanceLock = await acquireReviewAssignmentIssuanceLock(
		repositoryRoot,
		live.target,
		input,
		testHooks.afterLockParentAnchored
	);
	try {
		const oppositeKind = input.kind === 'ordinary' ? 'blind' : 'ordinary';
		const oppositePath = familyAffinityReviewAssignmentPath(
			oppositeKind,
			live.target,
			input.decisionVersion
		);
		const oppositeBytes = await optionalRealFile(repositoryRoot, oppositePath);
		let oppositeAssignment: FamilyAffinityReviewAssignment | undefined;
		if (oppositeBytes) {
			oppositeAssignment = validateFamilyAffinityReviewAssignmentEvidence({
				reviewAssignment: FamilyAffinityReviewAssignmentSchema.parse(
					JSON.parse(oppositeBytes.toString('utf8'))
				),
				reviewAssignmentPath: oppositePath,
				kind: oppositeKind,
				manifestPath,
				manifestSha256,
				target: live.target,
				targetPath: input.targetPath,
				productionAssignment: live.productionAssignment,
				productionAssignmentPath: input.productionAssignmentPath,
				result: live.result,
				resultSha256
			});
		}
		validateReviewAssignmentIdentityPair({
			producerId: live.result.producerId,
			...(input.kind === 'ordinary'
				? { ordinary: assignment, ...(oppositeAssignment ? { blind: oppositeAssignment } : {}) }
				: { blind: assignment, ...(oppositeAssignment ? { ordinary: oppositeAssignment } : {}) })
		});
		await writeReviewAssignmentExclusiveAnchored(
			repositoryRoot,
			path,
			Buffer.from(stableFamilyAffinityJson(assignment)),
			testHooks.afterAssignmentParentAnchored
		);
		return { path, assignment };
	} finally {
		await releaseReviewAssignmentIssuanceLock(issuanceLock, testHooks.beforeLockRelease);
	}
}

export async function createReviewReceiptExclusive(
	repositoryRoot: string,
	reviewAssignmentPath: string,
	receiptInput: unknown
): Promise<void> {
	const assignmentBytes = await requiredRealFile(repositoryRoot, reviewAssignmentPath);
	const assignment = FamilyAffinityReviewAssignmentSchema.parse(
		JSON.parse(assignmentBytes.toString('utf8'))
	);
	if (
		reviewAssignmentPath !==
		familyAffinityReviewAssignmentPath(
			assignment.reviewKind,
			FamilyAffinityTargetSchema.parse(
				JSON.parse((await requiredRealFile(repositoryRoot, assignment.targetPath)).toString('utf8'))
			),
			assignment.decisionVersion
		)
	) {
		throw new Error('Review assignment path is not controller-owned or exact');
	}
	const live = await loadLiveReviewAttempt(
		repositoryRoot,
		assignment.targetPath,
		assignment.productionAssignmentPath,
		assignment.manifestPath
	);
	validateFamilyAffinityReviewAssignmentEvidence({
		reviewAssignment: assignment,
		reviewAssignmentPath,
		kind: assignment.reviewKind,
		manifestPath: assignment.manifestPath,
		manifestSha256: familyAffinityRawSha256(live.manifestBytes),
		target: live.target,
		targetPath: assignment.targetPath,
		productionAssignment: live.productionAssignment,
		productionAssignmentPath: assignment.productionAssignmentPath,
		result: live.result,
		resultSha256: familyAffinityRawSha256(live.resultBytes)
	});
	const receipt =
		assignment.reviewKind === 'ordinary'
			? FamilyAffinityReviewReceiptSchema.parse(receiptInput)
			: FamilyAffinityBlindReviewReceiptSchema.parse(receiptInput);
	if (
		receipt.receiptType !== assignment.reviewKind ||
		receipt.reviewerId !== assignment.reviewerId ||
		receipt.targetId !== assignment.targetId ||
		receipt.targetSha256 !== assignment.targetSha256 ||
		receipt.coordinateId !== assignment.coordinateId ||
		receipt.candidateVersion !== assignment.candidateVersion ||
		receipt.decisionVersion !== assignment.decisionVersion ||
		receipt.producerIdentitySha256 !== assignment.producerIdentitySha256 ||
		(receipt.receiptType === 'ordinary' && receipt.producerId !== assignment.producerId) ||
		receipt.candidatePath !== assignment.candidatePath ||
		receipt.candidateSha256 !== assignment.candidateSha256 ||
		receipt.resultPath !== assignment.resultPath ||
		receipt.resultSha256 !== assignment.resultSha256 ||
		receipt.sourcePath !== assignment.sourcePath ||
		receipt.sourceSha256 !== assignment.sourceSha256 ||
		receipt.promptSha256 !== assignment.promptSha256
	) {
		throw new Error('Receipt exceeds or mismatches controller review assignment');
	}
	const absolute = await ensureSafeParent(repositoryRoot, assignment.permittedReceiptPath);
	await writeFile(absolute, stableFamilyAffinityJson(receipt), { flag: 'wx' });
}

type ReviewCell = {
	tier: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'bridge-only';
	formId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	coordinateId: string;
	activeVersion: number;
	state: ReviewState;
	label: string;
	candidatePath: string | null;
	candidateSha256: string | null;
	revisionRequired: boolean;
	historyAttemptCount: number;
	historyRevisionRequiredCount: number;
};

export type FamilyReviewSummary = {
	schemaVersion: 'family-affinity-family-review-v1';
	familyId: string;
	coordinateCount: 25;
	notGeneratedCount: number;
	generatedCount: number;
	approvedReviewCount: number;
	revisionRequiredCount: number;
	historicalAttemptCount: number;
	historicalRevisionRequiredCount: number;
	runtimeCount: 0;
	rows: readonly ['T1', 'T2', 'T3', 'T4', 'T5'];
	columns: typeof PRODUCTION_AFFINITIES;
	cells: ReviewCell[];
};

export type FamilyAffinityReviewCatalog = {
	schemaVersion: 'family-affinity-review-catalog-v1';
	experimentId: 'family-affinity-v1';
	familyCount: 30;
	coordinateCount: 750;
	bridgeCoordinateCount: number;
	generatedCount: number;
	approvedReviewCount: number;
	bridgeGeneratedCount: number;
	bridgeApprovedReviewCount: number;
	revisionRequiredCount: number;
	historicalAttemptCount: number;
	historicalRevisionRequiredCount: number;
	runtimeCount: 0;
	stateCeiling: 'approved-review';
	families: Array<{
		familyId: string;
		summaryPath: string;
		contactSheetPath: string;
		generatedCount: number;
		approvedReviewCount: number;
	}>;
};

export type FamilyAffinityReviewArtifacts = {
	catalog: FamilyAffinityReviewCatalog;
	families: Array<{
		familyId: string;
		summaryPath: string;
		contactSheetPath: string;
		summary: FamilyReviewSummary;
		contactSheet: Buffer;
	}>;
	digest: string;
};

const FORM_TIERS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const;
const ORDINARY_RECEIPT_PATTERN =
	/^assets\/enemies\/experiments\/family-affinity-v1\/review\/decisions\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)\/(normal|fire|earth|wind|water)\/candidate-v([1-9][0-9]*)-review-v([1-9][0-9]*)\.json$/u;
const BLIND_RECEIPT_PATTERN =
	/^assets\/enemies\/experiments\/family-affinity-v1\/review\/blind\/([a-z][a-z0-9-]*)\/([a-z][a-z0-9-]*)\/(normal|fire|earth|wind|water)\/candidate-v([1-9][0-9]*)-blind-v([1-9][0-9]*)\.json$/u;
const BRIDGE_ORDINARY_RECEIPT_PATTERN =
	/^assets\/enemies\/experiments\/family-affinity-v1\/review\/bridge\/decisions\/([a-z][a-z0-9-]*)\/(normal|fire|earth|wind|water)\/candidate-v([1-9][0-9]*)-review-v([1-9][0-9]*)\.json$/u;
const BRIDGE_BLIND_RECEIPT_PATTERN =
	/^assets\/enemies\/experiments\/family-affinity-v1\/review\/bridge\/blind\/([a-z][a-z0-9-]*)\/(normal|fire|earth|wind|water)\/candidate-v([1-9][0-9]*)-blind-v([1-9][0-9]*)\.json$/u;
const REVIEW_ASSIGNMENT_PATTERN =
	/^assets\/enemies\/experiments\/family-affinity-v1\/review\/(?:bridge\/)?assignments\/(?:decisions|blind)\/.*-assignment\.json$/u;

async function optionalRealFile(
	repositoryRoot: string,
	ownedPath: string
): Promise<Buffer | undefined> {
	const absolute = absoluteOwnedPath(repositoryRoot, ownedPath);
	const parts = relative(resolve(repositoryRoot), absolute).split(sep).filter(Boolean);
	let cursor = resolve(repositoryRoot);
	for (const [index, part] of parts.entries()) {
		cursor = join(cursor, part);
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink())
				throw new Error(`Symlinked owned path is forbidden: ${ownedPath}`);
			if (index < parts.length - 1 && !metadata.isDirectory()) {
				throw new Error(`Owned path parent must be a real directory: ${ownedPath}`);
			}
			if (index === parts.length - 1 && !metadata.isFile()) {
				throw new Error(`Owned file must be a real file: ${ownedPath}`);
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
			throw error;
		}
	}
	return await readFile(absolute);
}

async function walkFilesNoSymlinks(
	repositoryRoot: string,
	ownedDirectory: string
): Promise<string[]> {
	const absolute = absoluteOwnedPath(repositoryRoot, ownedDirectory);
	try {
		const rootMetadata = await lstat(absolute);
		if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
			throw new Error(`Review-owned directory must be real: ${ownedDirectory}`);
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	}
	const output: string[] = [];
	async function visit(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);
			if (entry.isSymbolicLink()) throw new Error(`Symlinked review path is forbidden: ${path}`);
			if (entry.isDirectory()) await visit(path);
			else if (entry.isFile())
				output.push(relative(resolve(repositoryRoot), path).split(sep).join('/'));
			else throw new Error(`Unsupported review path type: ${path}`);
		}
	}
	await visit(absolute);
	return output.sort();
}

type ValidatedReviewAttempt = {
	target: FamilyAffinityTarget;
	assignment: FamilyAffinityAssignment;
	coordinate: FamilyAffinityManifest['canonicalMatrix']['activeCoordinates'][number];
	active: boolean;
	generationFailure?: FamilyAffinityGenerationFailure;
};

async function loadValidatedReviewAttemptHistory(
	repositoryRoot: string,
	manifest: FamilyAffinityManifest
): Promise<ValidatedReviewAttempt[]> {
	const attempts: ValidatedReviewAttempt[] = [];
	const expectedTargetPaths = new Set<string>();
	const expectedAssignmentPaths = new Set<string>();
	const expectedCandidatePaths = new Set<string>();
	const expectedResultPaths = new Set<string>();
	for (const activeCoordinate of [
		...manifest.canonicalMatrix.activeCoordinates,
		...manifest.bridge.activeCoordinates
	]) {
		let previousTarget: FamilyAffinityTarget | undefined;
		let previousGenerationFailure: FamilyAffinityGenerationFailure | undefined;
		for (let version = 1; version <= activeCoordinate.activeVersion; version += 1) {
			const paths =
				activeCoordinate.namespace === 'canonical'
					? canonicalAttemptPaths(
							activeCoordinate.familyId,
							activeCoordinate.formId,
							activeCoordinate.affinity,
							version
						)
					: bridgeAttemptPaths(
							activeCoordinate.currentClassId!,
							activeCoordinate.affinity,
							version
						);
			expectedTargetPaths.add(paths.target);
			expectedAssignmentPaths.add(paths.assignment);
			expectedCandidatePaths.add(paths.candidate);
			expectedResultPaths.add(paths.result);
			const target = FamilyAffinityTargetSchema.parse(
				JSON.parse((await requiredRealFile(repositoryRoot, paths.target)).toString('utf8'))
			);
			const assignment = FamilyAffinityAssignmentSchema.parse(
				JSON.parse((await requiredRealFile(repositoryRoot, paths.assignment)).toString('utf8'))
			);
			const coordinate = {
				...activeCoordinate,
				activeVersion: version,
				targetPath: paths.target,
				targetSha256: familyAffinitySha256(target),
				assignmentPath: paths.assignment,
				assignmentSha256: familyAffinitySha256(assignment),
				status: target.status
			};
			validateFamilyAffinityAttemptCrossBinding(coordinate, target, assignment);
			const active = version === activeCoordinate.activeVersion;
			const failureBytes = await optionalRealFile(
				repositoryRoot,
				familyAffinityGenerationFailurePath(target)
			);
			const generationFailure = failureBytes
				? validateFamilyAffinityGenerationFailureEvidence({
						target,
						targetPath: paths.target,
						assignment,
						assignmentPath: paths.assignment,
						evidence: JSON.parse(failureBytes.toString('utf8'))
					})
				: undefined;
			if (active && generationFailure) {
				throw new Error(`Active attempt cannot be generation-failed: ${target.targetId}`);
			}
			if (
				active &&
				(coordinate.targetSha256 !== activeCoordinate.targetSha256 ||
					coordinate.assignmentSha256 !== activeCoordinate.assignmentSha256 ||
					coordinate.status !== activeCoordinate.status)
			) {
				throw new Error(`Active manifest attempt is stale or cross-bound: ${target.targetId}`);
			}
			if (version === 1 && target.precedingAttempt !== null) {
				throw new Error(`Initial review attempt cannot link prior history: ${target.targetId}`);
			}
			if (version > 1) {
				const preceding = target.precedingAttempt;
				if (previousGenerationFailure) {
					if (
						!previousTarget ||
						stableFamilyAffinityJson(preceding) !==
							stableFamilyAffinityJson(previousTarget.precedingAttempt)
					) {
						throw new Error(
							`Generation-failed history did not preserve last retained attempt: ${target.targetId}`
						);
					}
				} else {
					if (
						!previousTarget ||
						!preceding ||
						preceding.targetId !== previousTarget.targetId ||
						preceding.targetSha256 !== familyAffinitySha256(previousTarget) ||
						preceding.candidatePath !== previousTarget.ownedPaths.candidate ||
						preceding.resultPath !== previousTarget.ownedPaths.result ||
						preceding.reviewPath !== previousTarget.ownedPaths.decision
					) {
						throw new Error(`Review attempt history is skipped or unbound: ${target.targetId}`);
					}
					const [candidateBytes, resultBytes, receiptBytes] = await Promise.all([
						requiredRealFile(repositoryRoot, preceding.candidatePath),
						requiredRealFile(repositoryRoot, preceding.resultPath),
						requiredRealFile(repositoryRoot, preceding.reviewPath)
					]);
					if (
						familyAffinityRawSha256(candidateBytes) !== preceding.candidateSha256 ||
						familyAffinityRawSha256(resultBytes) !== preceding.resultSha256 ||
						familyAffinityRawSha256(receiptBytes) !== preceding.reviewSha256
					) {
						throw new Error(`Review attempt predecessor bytes are stale: ${target.targetId}`);
					}
				}
			}
			attempts.push({
				target,
				assignment,
				coordinate,
				active,
				...(generationFailure ? { generationFailure } : {})
			});
			previousTarget = target;
			previousGenerationFailure = generationFailure;
		}
	}
	const actualTargetPaths = [
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/targets`)),
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/bridge/targets`))
	];
	const actualAssignmentPaths = [
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/assignments`)),
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/bridge/assignments`))
	];
	const actualCandidatePaths = [
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/candidates`)),
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/bridge/candidates`))
	];
	const actualResultPaths = [
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/results`)),
		...(await walkFilesNoSymlinks(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/bridge/results`))
	];
	const expectedFailurePaths = new Set(
		attempts
			.filter(({ generationFailure }) => generationFailure !== undefined)
			.map(({ target }) => familyAffinityGenerationFailurePath(target))
	);
	const actualFailurePaths = await walkFilesNoSymlinks(
		repositoryRoot,
		`${FAMILY_AFFINITY_ROOT}/generation-failures`
	);
	for (const path of actualTargetPaths) {
		if (!expectedTargetPaths.has(path)) throw new Error(`Orphan or unbound review target: ${path}`);
	}
	for (const path of actualAssignmentPaths) {
		if (!expectedAssignmentPaths.has(path)) {
			throw new Error(`Orphan or unbound review production assignment: ${path}`);
		}
	}
	for (const path of actualCandidatePaths) {
		if (!expectedCandidatePaths.has(path)) {
			throw new Error(`Orphan or unbound review candidate: ${path}`);
		}
	}
	for (const path of actualResultPaths) {
		if (!expectedResultPaths.has(path)) throw new Error(`Orphan or unbound review result: ${path}`);
	}
	for (const path of actualFailurePaths) {
		if (!expectedFailurePaths.has(path)) {
			throw new Error(`Orphan or unbound generation-failure evidence: ${path}`);
		}
	}
	return attempts;
}

function xml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

async function renderFamilyContactSheet(
	familyId: string,
	cells: ReviewCell[],
	candidateBytesByCoordinate: ReadonlyMap<string, Buffer>
): Promise<Buffer> {
	const headerHeight = 100;
	const rowLabelWidth = 180;
	const cellWidth = 284;
	const cellHeight = 204;
	const composites: Array<{ input: Buffer; left: number; top: number }> = [];
	for (const [index, cell] of cells.entries()) {
		const column = index % 5;
		const row = Math.floor(index / 5);
		const candidate = candidateBytesByCoordinate.get(cell.coordinateId);
		if (candidate) {
			composites.push({
				input: await sharp(candidate)
					.rotate()
					.resize({
						width: cellWidth - 12,
						height: cellHeight - 42,
						fit: 'contain',
						background: '#080b10'
					})
					.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
					.toBuffer(),
				left: rowLabelWidth + column * cellWidth + 6,
				top: headerHeight + row * cellHeight + 6
			});
		}
	}
	const grid = cells
		.map((cell, index) => {
			const column = index % 5;
			const row = Math.floor(index / 5);
			const x = rowLabelWidth + column * cellWidth;
			const y = headerHeight + row * cellHeight;
			return `<g><rect x="${x + 3}" y="${y + 3}" width="${cellWidth - 6}" height="${cellHeight - 6}" rx="8" fill="${cell.label === 'NOT GENERATED' ? '#121821' : 'none'}" stroke="#4f5e70" stroke-width="2"/><text x="${x + cellWidth / 2}" y="${y + cellHeight / 2}" text-anchor="middle" fill="#e7edf4" font-size="20" font-weight="700" font-family="sans-serif">${xml(cell.label)}</text><text x="${x + 12}" y="${y + cellHeight - 15}" fill="#9cabb9" font-size="13" font-family="sans-serif">${xml(cell.formId)}</text></g>`;
		})
		.join('');
	const columnLabels = PRODUCTION_AFFINITIES.map(
		(affinity, index) =>
			`<text x="${rowLabelWidth + index * cellWidth + cellWidth / 2}" y="82" text-anchor="middle" fill="#d8e1e9" font-size="22" font-weight="700" font-family="sans-serif">${affinity.toUpperCase()}</text>`
	).join('');
	const rowLabels = FORM_TIERS.map(
		(tier, index) =>
			`<text x="90" y="${headerHeight + index * cellHeight + cellHeight / 2}" text-anchor="middle" dominant-baseline="middle" fill="#d8e1e9" font-size="28" font-weight="700" font-family="sans-serif">${tier}</text>`
	).join('');
	const overlay = Buffer.from(
		`<svg width="${FAMILY_CONTACT_SHEET_WIDTH}" height="${FAMILY_CONTACT_SHEET_HEIGHT}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="none"/><text x="24" y="36" fill="#70b7c4" font-size="16" font-weight="700" font-family="sans-serif">${xml(familyId.toUpperCase())} · FAMILY AFFINITY REVIEW</text>${columnLabels}${rowLabels}${grid}</svg>`
	);
	return sharp({
		create: {
			width: FAMILY_CONTACT_SHEET_WIDTH,
			height: FAMILY_CONTACT_SHEET_HEIGHT,
			channels: 3,
			background: '#070a0f'
		}
	})
		.composite([...composites, { input: overlay, left: 0, top: 0 }])
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

export async function buildFamilyAffinityReviewArtifacts(
	repositoryRoot: string
): Promise<FamilyAffinityReviewArtifacts> {
	const manifestPath = `${FAMILY_AFFINITY_ROOT}/manifest.json`;
	const manifestBytes = await requiredRealFile(repositoryRoot, manifestPath);
	const manifest = FamilyAffinityManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const attempts = await loadValidatedReviewAttemptHistory(repositoryRoot, manifest);
	const activeAttempts = attempts.filter(({ active }) => active);
	const targets = activeAttempts.map(({ target }) => target);
	const canonicalTargets = targets.filter(({ namespace }) => namespace === 'canonical');

	const expectedGeneratedPaths = new Set<string>([FAMILY_AFFINITY_REVIEW_CATALOG_PATH]);
	for (const familyId of [...new Set(canonicalTargets.map(({ familyId }) => familyId))]) {
		expectedGeneratedPaths.add(`${FAMILY_AFFINITY_REVIEW_ROOT}/families/${familyId}/summary.json`);
		expectedGeneratedPaths.add(
			`${FAMILY_AFFINITY_REVIEW_ROOT}/families/${familyId}/contact-sheet.png`
		);
	}
	const allReviewFiles = await walkFilesNoSymlinks(repositoryRoot, FAMILY_AFFINITY_REVIEW_ROOT);
	const receiptFiles = allReviewFiles.filter(
		(path) =>
			ORDINARY_RECEIPT_PATTERN.test(path) ||
			BLIND_RECEIPT_PATTERN.test(path) ||
			BRIDGE_ORDINARY_RECEIPT_PATTERN.test(path) ||
			BRIDGE_BLIND_RECEIPT_PATTERN.test(path)
	);
	const reviewAssignmentFiles = allReviewFiles.filter((path) =>
		REVIEW_ASSIGNMENT_PATTERN.test(path)
	);
	for (const path of allReviewFiles) {
		if (
			!expectedGeneratedPaths.has(path) &&
			!receiptFiles.includes(path) &&
			!reviewAssignmentFiles.includes(path)
		) {
			throw new Error(`Malformed or extraneous review-owned path: ${path}`);
		}
	}
	const attemptByTargetId = new Map(attempts.map((attempt) => [attempt.target.targetId, attempt]));
	const reviewAssignmentByPath = new Map<string, FamilyAffinityReviewAssignment>();
	const reviewAssignmentPairByAttempt = new Map<string, ReviewAssignmentIdentityPair>();
	for (const path of reviewAssignmentFiles) {
		const bytes = await requiredRealFile(repositoryRoot, path);
		const reviewAssignment = FamilyAffinityReviewAssignmentSchema.parse(
			JSON.parse(bytes.toString('utf8'))
		);
		const attempt = attemptByTargetId.get(reviewAssignment.targetId);
		if (!attempt) throw new Error(`Review assignment targets a non-active attempt: ${path}`);
		const { target, assignment, coordinate } = attempt;
		const expectedPath = familyAffinityReviewAssignmentPath(
			reviewAssignment.reviewKind,
			target,
			reviewAssignment.decisionVersion
		);
		if (path !== expectedPath) {
			throw new Error(`Review assignment is stale, malformed, or cross-bound: ${path}`);
		}
		const candidateBytes = await requiredRealFile(repositoryRoot, reviewAssignment.candidatePath);
		const resultBytes = await requiredRealFile(repositoryRoot, reviewAssignment.resultPath);
		const familyPacketBytes = await requiredRealFile(repositoryRoot, reviewAssignment.sourcePath);
		const evidence = validateFamilyAffinityCandidateEvidence({
			target,
			assignment,
			familyPacketBytes,
			candidateBytes,
			resultBytes
		});
		const validatedReviewAssignment = validateFamilyAffinityReviewAssignmentEvidence({
			reviewAssignment,
			reviewAssignmentPath: path,
			kind: reviewAssignment.reviewKind,
			manifestPath,
			target,
			targetPath: coordinate.targetPath,
			productionAssignment: assignment,
			productionAssignmentPath: coordinate.assignmentPath,
			result: evidence.result,
			resultSha256: evidence.resultSha256
		});
		reviewAssignmentByPath.set(path, validatedReviewAssignment);
		const attemptKey = `${target.coordinateId}/v${target.version}`;
		const pair = reviewAssignmentPairByAttempt.get(attemptKey) ?? {
			producerId: evidence.result.producerId
		};
		if (pair.producerId !== evidence.result.producerId || pair[reviewAssignment.reviewKind]) {
			throw new Error(`Duplicate or cross-bound review assignment for ${attemptKey}`);
		}
		pair[reviewAssignment.reviewKind] = validatedReviewAssignment;
		reviewAssignmentPairByAttempt.set(attemptKey, pair);
	}
	for (const pair of reviewAssignmentPairByAttempt.values()) {
		validateReviewAssignmentIdentityPair(pair);
	}

	const ordinaryByKey = new Map<
		string,
		Array<{ path: string; receipt: OrdinaryReviewReceipt; bytes: Buffer }>
	>();
	const blindByKey = new Map<
		string,
		Array<{ path: string; receipt: BlindReviewReceipt; bytes: Buffer }>
	>();
	for (const path of receiptFiles) {
		const bytes = await optionalRealFile(repositoryRoot, path);
		if (!bytes) throw new Error(`Review receipt disappeared during scan: ${path}`);
		const ordinaryMatch =
			ORDINARY_RECEIPT_PATTERN.test(path) || BRIDGE_ORDINARY_RECEIPT_PATTERN.test(path);
		const receipt = ordinaryMatch
			? FamilyAffinityReviewReceiptSchema.parse(JSON.parse(bytes.toString('utf8')))
			: FamilyAffinityBlindReviewReceiptSchema.parse(JSON.parse(bytes.toString('utf8')));
		const key = `${receipt.coordinateId}/v${receipt.candidateVersion}`;
		const bucket = ordinaryMatch ? ordinaryByKey : blindByKey;
		const values = bucket.get(key) ?? [];
		values.push({ path, receipt, bytes } as never);
		bucket.set(key, values as never);
	}
	for (const [key, receipts] of [...ordinaryByKey, ...blindByKey]) {
		if (receipts.length !== 1)
			throw new Error(`Duplicate immutable review receipt paths for ${key}`);
	}
	const attemptByKey = new Map(
		attempts.map((attempt) => [
			`${attempt.target.coordinateId}/v${attempt.target.version}`,
			attempt
		])
	);
	for (const key of new Set([...ordinaryByKey.keys(), ...blindByKey.keys()])) {
		if (!attemptByKey.has(key)) throw new Error(`Orphan or unbound review receipt: ${key}`);
	}

	const candidateBytesByCoordinate = new Map<string, Buffer>();
	const cellByCoordinate = new Map<string, ReviewCell>();
	const historicalCountsByCoordinate = new Map<string, { attempts: number; revisions: number }>();
	for (const { target, assignment, coordinate, active, generationFailure } of attempts) {
		const candidateBytes = await optionalRealFile(repositoryRoot, target.ownedPaths.candidate);
		const resultBytes = await optionalRealFile(repositoryRoot, target.ownedPaths.result);
		const key = `${target.coordinateId}/v${target.version}`;
		const ordinaryRecord = ordinaryByKey.get(key)?.[0];
		const blindRecord = blindByKey.get(key)?.[0];
		if (!candidateBytes && !resultBytes && (ordinaryRecord || blindRecord)) {
			throw new Error(`Review receipt exists without candidate/result for ${target.coordinateId}`);
		}
		if (!active && !ordinaryRecord && !generationFailure) {
			throw new Error(`Historical attempt lacks its immutable review receipt: ${target.targetId}`);
		}
		if (generationFailure && (candidateBytes || resultBytes || ordinaryRecord || blindRecord)) {
			throw new Error(
				`Generation-failed attempt cannot carry candidate/result/review evidence: ${target.targetId}`
			);
		}
		for (const record of [ordinaryRecord, blindRecord].filter(
			(value): value is NonNullable<typeof value> => Boolean(value)
		)) {
			const kind = record.receipt.receiptType;
			const expectedReceiptPath =
				kind === 'ordinary' ? target.ownedPaths.decision : target.ownedPaths.blindReview;
			if (record.path !== expectedReceiptPath) {
				throw new Error(`Receipt path is not target-owned: ${record.path}`);
			}
			const reviewAssignmentPath = familyAffinityReviewAssignmentPath(
				kind,
				target,
				record.receipt.decisionVersion
			);
			if (!reviewAssignmentFiles.includes(reviewAssignmentPath)) {
				throw new Error(`Receipt lacks controller-issued review assignment: ${record.path}`);
			}
			const reviewAssignment = reviewAssignmentByPath.get(reviewAssignmentPath)!;
			if (
				reviewAssignment.reviewKind !== kind ||
				reviewAssignment.reviewerId !== record.receipt.reviewerId ||
				reviewAssignment.targetPath !== coordinate.targetPath ||
				reviewAssignment.productionAssignmentPath !== coordinate.assignmentPath ||
				reviewAssignment.permittedReceiptPath !== record.path ||
				reviewAssignment.targetSha256 !== coordinate.targetSha256 ||
				reviewAssignment.productionAssignmentSha256 !== coordinate.assignmentSha256 ||
				reviewAssignment.candidateSha256 !== record.receipt.candidateSha256 ||
				reviewAssignment.resultSha256 !== record.receipt.resultSha256 ||
				reviewAssignment.sourceSha256 !== record.receipt.sourceSha256 ||
				reviewAssignment.promptSha256 !== record.receipt.promptSha256
			) {
				throw new Error(`Receipt is stale or exceeds controller assignment: ${record.path}`);
			}
		}
		const familyPacketBytes =
			candidateBytes || resultBytes
				? await requiredRealFile(repositoryRoot, familyAffinitySourcePacketBinding(target).path)
				: undefined;
		const evaluated = generationFailure
			? { state: 'revise' as const, revisionRequired: true, approved: false }
			: evaluateFamilyAffinityReviewAttempt({
					target,
					assignment,
					...(familyPacketBytes ? { familyPacketBytes } : {}),
					...(candidateBytes ? { candidateBytes } : {}),
					...(resultBytes ? { resultBytes } : {}),
					...(ordinaryRecord ? { ordinary: ordinaryRecord.receipt } : {}),
					...(blindRecord ? { blind: blindRecord.receipt } : {})
				});
		if (!active) {
			if (!evaluated.revisionRequired || evaluated.approved) {
				throw new Error(
					`Historical attempt is not a rejected/revise allocation source: ${target.targetId}`
				);
			}
			const counts = historicalCountsByCoordinate.get(target.coordinateId) ?? {
				attempts: 0,
				revisions: 0
			};
			counts.attempts += 1;
			counts.revisions += 1;
			historicalCountsByCoordinate.set(target.coordinateId, counts);
			continue;
		}
		if (candidateBytes) candidateBytesByCoordinate.set(target.coordinateId, candidateBytes);
		const history = historicalCountsByCoordinate.get(target.coordinateId) ?? {
			attempts: 0,
			revisions: 0
		};
		cellByCoordinate.set(target.coordinateId, {
			tier: target.tier,
			formId: target.formId,
			affinity: target.affinity,
			coordinateId: target.coordinateId,
			activeVersion: target.version,
			state: evaluated.state,
			label:
				evaluated.state === 'planned'
					? 'NOT GENERATED'
					: evaluated.state === 'approved-review'
						? 'APPROVED REVIEW'
						: evaluated.state === 'candidate'
							? 'CANDIDATE'
							: 'REVISION REQUIRED',
			candidatePath: candidateBytes ? target.ownedPaths.candidate : null,
			candidateSha256: candidateBytes ? familyAffinityRawSha256(candidateBytes) : null,
			revisionRequired: evaluated.revisionRequired,
			historyAttemptCount: history.attempts,
			historyRevisionRequiredCount: history.revisions
		});
	}

	const familyIds = [...new Set(canonicalTargets.map(({ familyId }) => familyId))];
	if (familyIds.length !== 30) throw new Error(`Expected 30 families, found ${familyIds.length}`);
	const families: FamilyAffinityReviewArtifacts['families'] = [];
	for (const familyId of familyIds) {
		const familyTargets = canonicalTargets.filter((target) => target.familyId === familyId);
		const orderedCells = FORM_TIERS.flatMap((tier) =>
			PRODUCTION_AFFINITIES.map((affinity) => {
				const target = familyTargets.find(
					(candidate) => candidate.tier === tier && candidate.affinity === affinity
				);
				if (!target) throw new Error(`Missing ${familyId}/${tier}/${affinity} review coordinate`);
				return cellByCoordinate.get(target.coordinateId)!;
			})
		);
		if (orderedCells.length !== 25) throw new Error(`Expected 25 review cells for ${familyId}`);
		const generatedCount = orderedCells.filter(({ state }) => state !== 'planned').length;
		const approvedReviewCount = orderedCells.filter(
			({ state }) => state === 'approved-review'
		).length;
		const revisionRequiredCount = orderedCells.filter(
			({ revisionRequired }) => revisionRequired
		).length;
		const historicalAttemptCount = orderedCells.reduce(
			(sum, cell) => sum + cell.historyAttemptCount,
			0
		);
		const historicalRevisionRequiredCount = orderedCells.reduce(
			(sum, cell) => sum + cell.historyRevisionRequiredCount,
			0
		);
		const summary: FamilyReviewSummary = {
			schemaVersion: 'family-affinity-family-review-v1',
			familyId,
			coordinateCount: 25,
			notGeneratedCount: 25 - generatedCount,
			generatedCount,
			approvedReviewCount,
			revisionRequiredCount,
			historicalAttemptCount,
			historicalRevisionRequiredCount,
			runtimeCount: 0,
			rows: FORM_TIERS,
			columns: PRODUCTION_AFFINITIES,
			cells: orderedCells
		};
		families.push({
			familyId,
			summaryPath: `${FAMILY_AFFINITY_REVIEW_ROOT}/families/${familyId}/summary.json`,
			contactSheetPath: `${FAMILY_AFFINITY_REVIEW_ROOT}/families/${familyId}/contact-sheet.png`,
			summary,
			contactSheet: await renderFamilyContactSheet(
				familyId,
				orderedCells,
				candidateBytesByCoordinate
			)
		});
	}
	const generatedCount = families.reduce((sum, family) => sum + family.summary.generatedCount, 0);
	const approvedReviewCount = families.reduce(
		(sum, family) => sum + family.summary.approvedReviewCount,
		0
	);
	const revisionRequiredCount = families.reduce(
		(sum, family) => sum + family.summary.revisionRequiredCount,
		0
	);
	const historicalAttemptCount = attempts.filter(({ active }) => !active).length;
	const historicalRevisionRequiredCount = [...historicalCountsByCoordinate.values()].reduce(
		(sum, counts) => sum + counts.revisions,
		0
	);
	const bridgeCells = targets
		.filter(({ namespace }) => namespace === 'bridge')
		.map(({ coordinateId }) => cellByCoordinate.get(coordinateId)!);
	const catalog: FamilyAffinityReviewCatalog = {
		schemaVersion: 'family-affinity-review-catalog-v1',
		experimentId: 'family-affinity-v1',
		familyCount: 30,
		coordinateCount: 750,
		bridgeCoordinateCount: bridgeCells.length,
		generatedCount,
		approvedReviewCount,
		bridgeGeneratedCount: bridgeCells.filter(({ state }) => state !== 'planned').length,
		bridgeApprovedReviewCount: bridgeCells.filter(({ state }) => state === 'approved-review')
			.length,
		revisionRequiredCount,
		historicalAttemptCount,
		historicalRevisionRequiredCount,
		runtimeCount: 0,
		stateCeiling: 'approved-review',
		families: families.map((family) => ({
			familyId: family.familyId,
			summaryPath: family.summaryPath,
			contactSheetPath: family.contactSheetPath,
			generatedCount: family.summary.generatedCount,
			approvedReviewCount: family.summary.approvedReviewCount
		}))
	};
	const digest = createHash('sha256')
		.update(stableFamilyAffinityJson(catalog))
		.update(
			families
				.map(
					(family) =>
						`${family.summaryPath}\0${familyAffinitySha256(family.summary)}\0${family.contactSheetPath}\0${familyAffinityRawSha256(family.contactSheet)}`
				)
				.join('\n')
		)
		.digest('hex');
	return { catalog, families, digest };
}
