import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	FamilyAffinityBlindReviewReceiptSchema,
	FamilyAffinityManifestSchema,
	FamilyAffinityReviewAssignmentSchema,
	FamilyAffinityReviewReceiptSchema,
	FamilyAffinityTargetSchema,
	familyAffinityReviewAssignmentPath,
	type FamilyAffinityReviewAssignment,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';
import { createReviewReceiptExclusive } from './family-affinity-review-lib.js';

const PRODUCTION_ROOT = 'assets/enemies/experiments/family-affinity-v1';
const MANIFEST_PATH = `${PRODUCTION_ROOT}/manifest.json`;
const EVIDENCE_ROOT = 'docs/evidence/enemy-normal-anchor-review-v1';
const RECONCILIATION_PATH = `${EVIDENCE_ROOT}/blind-reconciliation.json`;
const OWNER_ACCEPTANCE_PATH = 'docs/evidence/enemy-image-review-gallery-v1/owner-acceptance.md';
const GALLERY_PATH = 'docs/evidence/enemy-image-review-gallery-v1/index.html';
const OWNER_REVIEWER_ID = 'summonlab-owner-joao';
const BLIND_REVIEWER_ID = 'codex-independent-blind-reviewer';

type Mode = 'check' | 'write';
type SourceDimension = { status: 'pass' | 'revise'; note: string };
type RubricDimension = { verdict: 'pass' | 'fail'; notes: string };
type BlindVerdict = {
	token: string;
	perceivedFamilyOrCreature: string;
	perceivedTier: string;
	perceivedCombatRole: string;
	identityConfidence: string;
	anatomy: SourceDimension;
	neutralAffinity: SourceDimension;
	visibleCounterplayCue: SourceDimension;
	framing: SourceDimension;
	finish: SourceDimension;
	overallVerdict: 'approved-review' | 'revise';
};
type BlindVerdictFile = {
	schemaVersion: 'enemy-normal-blind-verdicts-v1';
	wave: string;
	reviewerId: string;
	reviews: BlindVerdict[];
};
type BlindMapEntry = {
	token: string;
	coordinateId: string;
	targetPath: string;
	candidatePath: string;
	candidateSha256: string;
};
type BlindMap = {
	schemaVersion: 'family-affinity-normal-blind-map-v1';
	waveId: string;
	entries: BlindMapEntry[];
};
type SemanticDimension = { status: 'pass' | 'revise'; note: string };
type ReconciliationEntry = {
	token: string;
	coordinateId: string;
	identity: SemanticDimension;
	archetype: SemanticDimension;
};
type Reconciliation = {
	schemaVersion: 'enemy-normal-blind-reconciliation-v1';
	reviewerId: string;
	policy: {
		identity: string;
		tier: string;
		archetype: string;
		decision: string;
	};
	entries: ReconciliationEntry[];
};

type PlannedReceipt = {
	kind: 'ordinary' | 'blind';
	coordinateId: string;
	assignmentPath: string;
	permittedReceiptPath: string;
	receipt: unknown;
};

function parseArgs(args: string[]): Mode {
	const modes = args.filter((argument) => argument === '--check' || argument === '--write');
	const unknown = args.filter((argument) => argument !== '--check' && argument !== '--write');
	if (unknown.length > 0) throw new Error(`Unknown argument(s): ${unknown.join(', ')}`);
	if (modes.length !== 1) throw new Error('Specify exactly one of --check or --write.');
	return modes[0] === '--write' ? 'write' : 'check';
}

async function readJson<T>(repositoryRoot: string, ownedPath: string): Promise<T> {
	return JSON.parse(await readFile(resolve(repositoryRoot, ownedPath), 'utf8')) as T;
}

async function exists(repositoryRoot: string, ownedPath: string): Promise<boolean> {
	try {
		await access(resolve(repositoryRoot, ownedPath));
		return true;
	} catch {
		return false;
	}
}

function sha256(bytes: Uint8Array | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function requiredText(value: unknown, context: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`${context} must be non-empty text`);
	}
	return value;
}

function validateSourceDimension(value: SourceDimension, context: string): SourceDimension {
	if (!value || (value.status !== 'pass' && value.status !== 'revise')) {
		throw new Error(`${context}.status must be pass or revise`);
	}
	requiredText(value.note, `${context}.note`);
	return value;
}

function rubricFromSource(value: SourceDimension): RubricDimension {
	return { verdict: value.status === 'pass' ? 'pass' : 'fail', notes: value.note };
}

function rubricFromSemantic(value: SemanticDimension): RubricDimension {
	return { verdict: value.status === 'pass' ? 'pass' : 'fail', notes: value.note };
}

function commonReceiptFields(assignment: FamilyAffinityReviewAssignment) {
	return {
		targetId: assignment.targetId,
		targetSha256: assignment.targetSha256,
		coordinateId: assignment.coordinateId,
		candidateVersion: assignment.candidateVersion,
		decisionVersion: assignment.decisionVersion,
		reviewerId: assignment.reviewerId,
		producerIdentitySha256: assignment.producerIdentitySha256,
		candidatePath: assignment.candidatePath,
		candidateSha256: assignment.candidateSha256,
		resultPath: assignment.resultPath,
		resultSha256: assignment.resultSha256,
		sourcePath: assignment.sourcePath,
		sourceSha256: assignment.sourceSha256,
		promptSha256: assignment.promptSha256,
		runtimeCatalogMutationForbidden: true as const
	};
}

async function loadAssignment(
	repositoryRoot: string,
	target: FamilyAffinityTarget,
	kind: 'ordinary' | 'blind'
): Promise<{ path: string; assignment: FamilyAffinityReviewAssignment }> {
	const path = familyAffinityReviewAssignmentPath(kind, target, target.version);
	const assignment = FamilyAffinityReviewAssignmentSchema.parse(
		await readJson(repositoryRoot, path)
	);
	if (
		assignment.reviewKind !== kind ||
		assignment.targetPath !== targetPathFor(target) ||
		assignment.coordinateId !== target.coordinateId ||
		assignment.candidateVersion !== target.version ||
		assignment.decisionVersion !== target.version
	) {
		throw new Error(`Review assignment is not bound to current target: ${path}`);
	}
	return { path, assignment };
}

function targetPathFor(target: FamilyAffinityTarget): string {
	return target.namespace === 'canonical'
		? `${PRODUCTION_ROOT}/targets/${target.familyId}/${target.formId}/${target.affinity}/target-v${target.version}.json`
		: `${PRODUCTION_ROOT}/bridge/targets/${target.currentClassId}/${target.affinity}/target-v${target.version}.json`;
}

async function inspectExistingReceipt(
	repositoryRoot: string,
	assignment: FamilyAffinityReviewAssignment
): Promise<boolean> {
	if (!(await exists(repositoryRoot, assignment.permittedReceiptPath))) return false;
	const raw = await readJson(repositoryRoot, assignment.permittedReceiptPath);
	const receipt =
		assignment.reviewKind === 'ordinary'
			? FamilyAffinityReviewReceiptSchema.parse(raw)
			: FamilyAffinityBlindReviewReceiptSchema.parse(raw);
	if (
		receipt.receiptType !== assignment.reviewKind ||
		receipt.coordinateId !== assignment.coordinateId ||
		receipt.candidateVersion !== assignment.candidateVersion ||
		receipt.decisionVersion !== assignment.decisionVersion ||
		receipt.reviewerId !== assignment.reviewerId ||
		receipt.candidateSha256 !== assignment.candidateSha256 ||
		receipt.resultSha256 !== assignment.resultSha256
	) {
		throw new Error(
			`Existing immutable receipt mismatches assignment: ${assignment.permittedReceiptPath}`
		);
	}
	return true;
}

async function validateOwnerAcceptance(repositoryRoot: string, generatedNormalCount: number) {
	const acceptance = await readFile(resolve(repositoryRoot, OWNER_ACCEPTANCE_PATH), 'utf8');
	const galleryBytes = await readFile(resolve(repositoryRoot, GALLERY_PATH));
	const expectedHash = acceptance.match(/Gallery SHA-256: `([a-f0-9]{64})`/u)?.[1];
	const canonicalCount = Number(
		acceptance.match(/Active canonical candidates reviewed: (\d+)/u)?.[1]
	);
	if (!expectedHash || sha256(galleryBytes) !== expectedHash) {
		throw new Error('Owner acceptance is not bound to the current consolidated gallery bytes');
	}
	if (canonicalCount !== 166) {
		throw new Error(`Owner acceptance canonical count changed: ${canonicalCount}`);
	}
	if (generatedNormalCount !== 150) {
		throw new Error(
			`Expected 150 current canonical Normal candidates, found ${generatedNormalCount}`
		);
	}
	return { expectedHash, canonicalCount };
}

async function loadBlindSources(repositoryRoot: string) {
	const maps = new Map<string, BlindMapEntry>();
	const verdicts = new Map<string, BlindVerdict>();
	for (let wave = 1; wave <= 6; wave += 1) {
		const map = await readJson<BlindMap>(
			repositoryRoot,
			`${EVIDENCE_ROOT}/wave-a${wave}-blind-map.json`
		);
		const verdictFile = await readJson<BlindVerdictFile>(
			repositoryRoot,
			`${EVIDENCE_ROOT}/wave-a${wave}-blind-verdicts.json`
		);
		if (map.schemaVersion !== 'family-affinity-normal-blind-map-v1' || map.waveId !== `a${wave}`) {
			throw new Error(`Malformed blind map for wave a${wave}`);
		}
		if (
			verdictFile.schemaVersion !== 'enemy-normal-blind-verdicts-v1' ||
			verdictFile.wave.toLowerCase() !== `a${wave}` ||
			verdictFile.reviewerId !== BLIND_REVIEWER_ID
		) {
			throw new Error(`Malformed blind verdict file for wave a${wave}`);
		}
		if (map.entries.length !== 10 || verdictFile.reviews.length !== 10) {
			throw new Error(`Wave a${wave} must contain exactly ten map entries and ten verdicts`);
		}
		for (const entry of map.entries) {
			if (maps.has(entry.token)) throw new Error(`Duplicate blind token: ${entry.token}`);
			maps.set(entry.token, entry);
		}
		for (const review of verdictFile.reviews) {
			if (verdicts.has(review.token)) throw new Error(`Duplicate blind verdict: ${review.token}`);
			validateSourceDimension(review.anatomy, `${review.token}.anatomy`);
			validateSourceDimension(review.neutralAffinity, `${review.token}.neutralAffinity`);
			validateSourceDimension(
				review.visibleCounterplayCue,
				`${review.token}.visibleCounterplayCue`
			);
			validateSourceDimension(review.framing, `${review.token}.framing`);
			validateSourceDimension(review.finish, `${review.token}.finish`);
			verdicts.set(review.token, review);
		}
	}
	if (maps.size !== 60 || verdicts.size !== 60) {
		throw new Error(
			`Expected 60 unique blind map/verdict tokens, found ${maps.size}/${verdicts.size}`
		);
	}
	return { maps, verdicts };
}

function validateReconciliation(raw: Reconciliation): Reconciliation {
	if (
		raw.schemaVersion !== 'enemy-normal-blind-reconciliation-v1' ||
		raw.reviewerId !== BLIND_REVIEWER_ID ||
		raw.entries.length !== 60
	) {
		throw new Error('Blind reconciliation must bind the reviewer and exactly 60 tokens');
	}
	const tokens = new Set<string>();
	const coordinates = new Set<string>();
	for (const entry of raw.entries) {
		if (tokens.has(entry.token) || coordinates.has(entry.coordinateId)) {
			throw new Error(`Duplicate reconciliation token or coordinate: ${entry.token}`);
		}
		tokens.add(entry.token);
		coordinates.add(entry.coordinateId);
		for (const [name, dimension] of [
			['identity', entry.identity],
			['archetype', entry.archetype]
		] as const) {
			if (dimension.status !== 'pass' && dimension.status !== 'revise') {
				throw new Error(`${entry.token}.${name}.status must be pass or revise`);
			}
			requiredText(dimension.note, `${entry.token}.${name}.note`);
		}
	}
	return raw;
}

async function planReceipts(repositoryRoot: string) {
	const manifest = FamilyAffinityManifestSchema.parse(
		await readJson(repositoryRoot, MANIFEST_PATH)
	);
	const normalCoordinates = manifest.canonicalMatrix.activeCoordinates.filter((coordinate) =>
		coordinate.coordinateId.endsWith('/normal')
	);
	const targets = new Map<string, FamilyAffinityTarget>();
	for (const coordinate of normalCoordinates) {
		const target = FamilyAffinityTargetSchema.parse(
			await readJson(repositoryRoot, coordinate.targetPath)
		);
		if (
			target.namespace !== 'canonical' ||
			target.affinity !== 'normal' ||
			target.coordinateId !== coordinate.coordinateId ||
			target.version !== coordinate.activeVersion ||
			targetPathFor(target) !== coordinate.targetPath ||
			!(await exists(repositoryRoot, target.ownedPaths.candidate)) ||
			!(await exists(repositoryRoot, target.ownedPaths.result))
		) {
			throw new Error(
				`Current Normal candidate is incomplete or cross-bound: ${coordinate.coordinateId}`
			);
		}
		targets.set(target.coordinateId, target);
	}
	const ownerEvidence = await validateOwnerAcceptance(repositoryRoot, targets.size);
	const { maps, verdicts } = await loadBlindSources(repositoryRoot);
	const reconciliation = validateReconciliation(
		await readJson<Reconciliation>(repositoryRoot, RECONCILIATION_PATH)
	);
	const reconciliationByToken = new Map(
		reconciliation.entries.map((entry) => [entry.token, entry] as const)
	);

	const planned: PlannedReceipt[] = [];
	let existingOrdinary = 0;
	let existingBlind = 0;
	let missingBlindAssignments = 0;
	let blindApproved = 0;
	let blindRevise = 0;
	const ownerNote =
		'Owner accepted every active image in the SHA-256-bound consolidated gallery on 2026-09-03 and directed that the images remain in the repository.';
	const ownerRubric = Object.fromEntries(
		[
			'identity',
			'tier',
			'archetype',
			'anatomy',
			'affinity',
			'counterplay',
			'framing',
			'finish'
		].map((name) => [name, { verdict: 'pass', notes: ownerNote }])
	);

	for (const target of targets.values()) {
		const { path, assignment } = await loadAssignment(repositoryRoot, target, 'ordinary');
		if (assignment.reviewerId !== OWNER_REVIEWER_ID || assignment.producerId === null) {
			throw new Error(`Ordinary assignment has unexpected reviewer or producer binding: ${path}`);
		}
		if (await inspectExistingReceipt(repositoryRoot, assignment)) {
			existingOrdinary += 1;
			continue;
		}
		const receipt = FamilyAffinityReviewReceiptSchema.parse({
			schemaVersion: 'family-affinity-review-decision-v1',
			receiptType: 'ordinary',
			producerId: assignment.producerId,
			...commonReceiptFields(assignment),
			decision: 'approved-review',
			rubric: ownerRubric
		});
		planned.push({
			kind: 'ordinary',
			coordinateId: target.coordinateId,
			assignmentPath: path,
			permittedReceiptPath: assignment.permittedReceiptPath,
			receipt
		});
	}

	for (const [token, mapEntry] of maps) {
		const verdict = verdicts.get(token);
		const resolved = reconciliationByToken.get(token);
		if (!verdict || !resolved) throw new Error(`Missing verdict or reconciliation for ${token}`);
		if (resolved.coordinateId !== mapEntry.coordinateId) {
			throw new Error(`Reconciliation coordinate mismatch for ${token}`);
		}
		const target = targets.get(mapEntry.coordinateId);
		if (!target || (target.tier !== 'T3' && target.tier !== 'T5')) {
			throw new Error(`Blind map does not resolve to a current T3/T5 Normal target: ${token}`);
		}
		if (
			mapEntry.targetPath !== targetPathFor(target) ||
			mapEntry.candidatePath !== target.ownedPaths.candidate ||
			mapEntry.candidateSha256 !==
				sha256(await readFile(resolve(repositoryRoot, mapEntry.candidatePath)))
		) {
			throw new Error(`Blind map candidate binding mismatch for ${token}`);
		}
		const expectedBlindAssignmentPath = familyAffinityReviewAssignmentPath(
			'blind',
			target,
			target.version
		);
		if (!(await exists(repositoryRoot, expectedBlindAssignmentPath))) {
			missingBlindAssignments += 1;
			continue;
		}
		const { path, assignment } = await loadAssignment(repositoryRoot, target, 'blind');
		if (assignment.reviewerId !== BLIND_REVIEWER_ID) {
			throw new Error(`Blind assignment has unexpected reviewer: ${path}`);
		}
		if (await inspectExistingReceipt(repositoryRoot, assignment)) {
			existingBlind += 1;
			continue;
		}
		const tierPass = verdict.perceivedTier.trim().toUpperCase() === target.tier;
		const rubric = {
			identity: rubricFromSemantic(resolved.identity),
			tier: {
				verdict: tierPass ? ('pass' as const) : ('fail' as const),
				notes: tierPass
					? `Blind reviewer perceived ${verdict.perceivedTier}; exact intended tier is ${target.tier}.`
					: `Blind reviewer perceived ${verdict.perceivedTier}, not exact intended tier ${target.tier}.`
			},
			archetype: rubricFromSemantic(resolved.archetype),
			anatomy: rubricFromSource(verdict.anatomy),
			affinity: rubricFromSource(verdict.neutralAffinity),
			counterplay: rubricFromSource(verdict.visibleCounterplayCue),
			framing: rubricFromSource(verdict.framing),
			finish: rubricFromSource(verdict.finish)
		};
		const decision = Object.values(rubric).every((dimension) => dimension.verdict === 'pass')
			? 'approved-review'
			: 'revise';
		if (decision === 'approved-review') blindApproved += 1;
		else blindRevise += 1;
		const receipt = FamilyAffinityBlindReviewReceiptSchema.parse({
			schemaVersion: 'family-affinity-blind-review-v1',
			receiptType: 'blind',
			...commonReceiptFields(assignment),
			decision,
			rubric,
			blindToProducerIdentity: true,
			blindToOrdinaryDecision: true
		});
		planned.push({
			kind: 'blind',
			coordinateId: target.coordinateId,
			assignmentPath: path,
			permittedReceiptPath: assignment.permittedReceiptPath,
			receipt
		});
	}

	if (reconciliationByToken.size !== maps.size) {
		throw new Error('Blind reconciliation contains a token not present in the controller maps');
	}
	return {
		planned,
		summary: {
			ownerGallerySha256: ownerEvidence.expectedHash,
			currentNormalCandidates: targets.size,
			existingOrdinaryReceipts: existingOrdinary,
			plannedOrdinaryReceipts: planned.filter((entry) => entry.kind === 'ordinary').length,
			existingBlindReceipts: existingBlind,
			plannedBlindReceipts: planned.filter((entry) => entry.kind === 'blind').length,
			plannedBlindApproved: blindApproved,
			plannedBlindRevise: blindRevise,
			missingBlindAssignments,
			integrityMismatches: missingBlindAssignments,
			runtimeMutations: 0
		}
	};
}

export async function runEnemyNormalAnchorReviewRecorder(
	repositoryRoot: string,
	mode: Mode
): Promise<string> {
	const { planned, summary } = await planReceipts(repositoryRoot);
	if (mode === 'write') {
		if (summary.integrityMismatches !== 0) {
			throw new Error(
				`Refusing partial write with ${summary.integrityMismatches} integrity mismatch(es)`
			);
		}
		for (const entry of planned) {
			await createReviewReceiptExclusive(repositoryRoot, entry.assignmentPath, entry.receipt);
		}
	}
	return `${JSON.stringify({ mode, ...summary, receiptsWritten: mode === 'write' ? planned.length : 0 }, null, 2)}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
	runEnemyNormalAnchorReviewRecorder(process.cwd(), parseArgs(process.argv.slice(2)))
		.then((output) => process.stdout.write(output))
		.catch((error: unknown) => {
			process.stderr.write(
				`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
			);
			process.exitCode = 1;
		});
}
