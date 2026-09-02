import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

import sharp from 'sharp';
import { z } from 'zod';

import {
	FAMILY_AFFINITY_ROOT,
	FamilyAffinityManifestSchema,
	FamilyAffinityTargetSchema,
	PRODUCTION_AFFINITIES,
	familyAffinitySha256,
	stableFamilyAffinityJson,
	type FamilyAffinityTarget
} from './family-affinity-production-lib.js';

export const FAMILY_AFFINITY_REVIEW_ROOT = `${FAMILY_AFFINITY_ROOT}/review` as const;
export const FAMILY_AFFINITY_REVIEW_CATALOG_PATH =
	`${FAMILY_AFFINITY_REVIEW_ROOT}/catalog.json` as const;
export const FAMILY_CONTACT_SHEET_WIDTH = 1600 as const;
export const FAMILY_CONTACT_SHEET_HEIGHT = 1200 as const;

const RequiredTextSchema = z.string().trim().min(1);
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const OwnedPathSchema = z
	.string()
	.regex(/^assets\/enemies\/experiments\/family-affinity-v1\//u)
	.refine((path) => !path.includes('..'), 'Owned paths cannot traverse directories');
const DecisionSchema = z.enum(['approved-review', 'rejected', 'revise']);
const RubricDimensionSchema = z
	.object({ verdict: z.enum(['pass', 'fail']), notes: RequiredTextSchema })
	.strict();
const RubricSchema = z
	.object({
		identity: RubricDimensionSchema,
		tier: RubricDimensionSchema,
		archetype: RubricDimensionSchema,
		anatomy: RubricDimensionSchema,
		affinity: RubricDimensionSchema,
		counterplay: RubricDimensionSchema,
		framing: RubricDimensionSchema,
		finish: RubricDimensionSchema
	})
	.strict();

export const FamilyAffinityCandidateResultSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-candidate-result-v1'),
		targetId: RequiredTextSchema,
		targetSha256: Sha256Schema,
		coordinateId: RequiredTextSchema,
		candidateVersion: z.number().int().positive(),
		producerId: RequiredTextSchema,
		candidatePath: OwnedPathSchema,
		candidateSha256: Sha256Schema,
		resultPath: OwnedPathSchema,
		sourceSha256: Sha256Schema,
		promptSha256: Sha256Schema,
		state: z.literal('candidate'),
		runtimeCatalogMutationForbidden: z.literal(true)
	})
	.strict();

const CommonReceiptShape = {
	targetId: RequiredTextSchema,
	targetSha256: Sha256Schema,
	coordinateId: RequiredTextSchema,
	candidateVersion: z.number().int().positive(),
	decisionVersion: z.number().int().positive(),
	producerId: RequiredTextSchema,
	reviewerId: RequiredTextSchema,
	candidatePath: OwnedPathSchema,
	candidateSha256: Sha256Schema,
	resultPath: OwnedPathSchema,
	resultSha256: Sha256Schema,
	sourceSha256: Sha256Schema,
	promptSha256: Sha256Schema,
	decision: DecisionSchema,
	rubric: RubricSchema,
	runtimeCatalogMutationForbidden: z.literal(true)
} as const;

export const OrdinaryReviewReceiptSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-review-decision-v1'),
		receiptType: z.literal('ordinary'),
		...CommonReceiptShape
	})
	.strict()
	.superRefine((receipt, context) => {
		if (receipt.reviewerId === receipt.producerId) {
			context.addIssue({ code: 'custom', message: 'Producer self-approval is forbidden' });
		}
		if (
			receipt.decision === 'approved-review' &&
			Object.values(receipt.rubric).some(({ verdict }) => verdict !== 'pass')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Approved-review requires every rubric dimension to pass'
			});
		}
	});

export const BlindReviewReceiptSchema = z
	.object({
		schemaVersion: z.literal('family-affinity-blind-review-v1'),
		receiptType: z.literal('blind'),
		...CommonReceiptShape,
		blindToProducerIdentity: z.literal(true),
		blindToOrdinaryDecision: z.literal(true)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (receipt.reviewerId === receipt.producerId) {
			context.addIssue({ code: 'custom', message: 'Producer self-approval is forbidden' });
		}
		if (
			receipt.decision === 'approved-review' &&
			Object.values(receipt.rubric).some(({ verdict }) => verdict !== 'pass')
		) {
			context.addIssue({
				code: 'custom',
				message: 'Approved-review requires every rubric dimension to pass'
			});
		}
	});

export type FamilyAffinityCandidateResult = z.infer<typeof FamilyAffinityCandidateResultSchema>;
export type OrdinaryReviewReceipt = z.infer<typeof OrdinaryReviewReceiptSchema>;
export type BlindReviewReceipt = z.infer<typeof BlindReviewReceiptSchema>;
export type ReviewDecision = z.infer<typeof DecisionSchema>;
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

function rawSha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function requireReceiptBinding(
	target: FamilyAffinityTarget,
	result: FamilyAffinityCandidateResult,
	receipt: OrdinaryReviewReceipt | BlindReviewReceipt
): void {
	const targetSha256 = familyAffinitySha256(target);
	const resultSha256 = familyAffinitySha256(result);
	const exactBindings =
		receipt.targetId === target.targetId &&
		receipt.targetSha256 === targetSha256 &&
		receipt.coordinateId === target.coordinateId &&
		receipt.candidateVersion === target.version &&
		receipt.producerId === result.producerId &&
		receipt.candidatePath === result.candidatePath &&
		receipt.candidateSha256 === result.candidateSha256 &&
		receipt.resultPath === result.resultPath &&
		receipt.resultSha256 === resultSha256 &&
		receipt.sourceSha256 === result.sourceSha256 &&
		receipt.promptSha256 === result.promptSha256;
	if (!exactBindings) throw new Error('Review receipt version/hash binding is stale or mismatched');
	if (receipt.reviewerId === result.producerId)
		throw new Error('Producer self-approval is forbidden');
}

export function evaluateFamilyAffinityReviewAttempt(input: {
	target: unknown;
	candidateBytes?: Uint8Array;
	result?: unknown;
	resultBytes?: Uint8Array;
	ordinary?: unknown;
	blind?: unknown;
}): { state: ReviewState; revisionRequired: boolean; approved: boolean } {
	const target = FamilyAffinityTargetSchema.parse(input.target);
	if (
		!input.candidateBytes &&
		!input.result &&
		!input.resultBytes &&
		!input.ordinary &&
		!input.blind
	) {
		return { state: 'planned', revisionRequired: false, approved: false };
	}
	if (!input.result || !input.resultBytes)
		throw new Error('Candidate requires an immutable result receipt');
	if (!input.candidateBytes) throw new Error('Result receipt requires candidate bytes');
	if (target.status !== 'planned')
		throw new Error('Only a planned production target may enter candidate state');
	validateReviewTransition('planned', 'candidate');

	let parsedResultBytes: unknown;
	try {
		parsedResultBytes = JSON.parse(Buffer.from(input.resultBytes).toString('utf8'));
	} catch {
		throw new Error('Result receipt bytes are malformed');
	}
	const result = FamilyAffinityCandidateResultSchema.parse(input.result);
	const resultFromBytes = FamilyAffinityCandidateResultSchema.parse(parsedResultBytes);
	if (familyAffinitySha256(resultFromBytes) !== familyAffinitySha256(result)) {
		throw new Error('Result receipt bytes are stale or mismatched');
	}
	if (
		result.targetId !== target.targetId ||
		result.targetSha256 !== familyAffinitySha256(target) ||
		result.coordinateId !== target.coordinateId ||
		result.candidateVersion !== target.version ||
		result.candidatePath !== target.ownedPaths.candidate ||
		result.resultPath !== target.ownedPaths.result ||
		result.sourceSha256 !== target.sources.familyPacketSha256
	) {
		throw new Error('Candidate result receipt is stale or cross-bound');
	}
	if (result.candidateSha256 !== rawSha256(input.candidateBytes)) {
		throw new Error('Candidate hash mismatch');
	}
	if (!input.ordinary) return { state: 'candidate', revisionRequired: false, approved: false };
	const ordinary = OrdinaryReviewReceiptSchema.parse(input.ordinary);
	requireReceiptBinding(target, result, ordinary);

	const requiresBlind = target.tier === 'T3' || target.tier === 'T5';
	let blind: BlindReviewReceipt | undefined;
	if (input.blind) {
		blind = BlindReviewReceiptSchema.parse(input.blind);
		requireReceiptBinding(target, result, blind);
		if (!requiresBlind)
			throw new Error('Blind receipts are owned only by T3/T5 candidate versions');
		if (blind.reviewerId === ordinary.reviewerId) {
			throw new Error('Blind reviewer must be independent from the ordinary reviewer');
		}
		if (blind.decision !== ordinary.decision) {
			throw new Error('Ordinary and blind review decisions disagree');
		}
	}
	if (requiresBlind && !blind)
		throw new Error('T3/T5 candidate version requires a blind review receipt');
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
			await mkdir(cursor);
		}
	}
	return absolute;
}

function assertExactReceiptPath(
	ownedPath: string,
	receipt: OrdinaryReviewReceipt | BlindReviewReceipt
): void {
	const [familyId, formId, affinity] = receipt.coordinateId.split('/');
	if (!familyId || !formId || !PRODUCTION_AFFINITIES.includes(affinity as never)) {
		throw new Error('Review receipt coordinate is malformed');
	}
	const expected = reviewReceiptPath(
		receipt.receiptType,
		familyId,
		formId,
		affinity as (typeof PRODUCTION_AFFINITIES)[number],
		receipt.candidateVersion,
		receipt.decisionVersion
	);
	if (ownedPath !== expected) throw new Error(`Expected exact review receipt path ${expected}`);
}

export async function createReviewReceiptExclusive(
	repositoryRoot: string,
	ownedPath: string,
	receiptInput: unknown
): Promise<void> {
	const discriminator = (receiptInput as { receiptType?: unknown })?.receiptType;
	const receipt =
		discriminator === 'ordinary'
			? OrdinaryReviewReceiptSchema.parse(receiptInput)
			: BlindReviewReceiptSchema.parse(receiptInput);
	assertExactReceiptPath(ownedPath, receipt);
	const absolute = await ensureSafeParent(repositoryRoot, ownedPath);
	await writeFile(absolute, stableFamilyAffinityJson(receipt), { flag: 'wx' });
}

type ReviewCell = {
	tier: 'T1' | 'T2' | 'T3' | 'T4' | 'T5';
	formId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	coordinateId: string;
	activeVersion: number;
	state: ReviewState;
	label: string;
	candidatePath: string | null;
	candidateSha256: string | null;
	revisionRequired: boolean;
};

export type FamilyReviewSummary = {
	schemaVersion: 'family-affinity-family-review-v1';
	familyId: string;
	coordinateCount: 25;
	notGeneratedCount: number;
	generatedCount: number;
	approvedReviewCount: number;
	revisionRequiredCount: number;
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
	generatedCount: number;
	approvedReviewCount: number;
	revisionRequiredCount: number;
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
	const manifest = FamilyAffinityManifestSchema.parse(
		JSON.parse(
			await readFile(
				absoluteOwnedPath(repositoryRoot, `${FAMILY_AFFINITY_ROOT}/manifest.json`),
				'utf8'
			)
		)
	);
	if (manifest.bridge.activeCoordinates.length !== 0) {
		throw new Error('Task 8 initial review export expects no materialized bridge coordinates');
	}

	const targets = await Promise.all(
		manifest.canonicalMatrix.activeCoordinates.map(async (coordinate) => {
			const bytes = await optionalRealFile(repositoryRoot, coordinate.targetPath);
			if (!bytes) throw new Error(`Missing active target: ${coordinate.targetPath}`);
			const target = FamilyAffinityTargetSchema.parse(JSON.parse(bytes.toString('utf8')));
			if (familyAffinitySha256(target) !== coordinate.targetSha256) {
				throw new Error(`Active target hash mismatch: ${coordinate.targetPath}`);
			}
			return target;
		})
	);

	const expectedGeneratedPaths = new Set<string>([FAMILY_AFFINITY_REVIEW_CATALOG_PATH]);
	for (const familyId of [...new Set(targets.map(({ familyId }) => familyId))]) {
		expectedGeneratedPaths.add(`${FAMILY_AFFINITY_REVIEW_ROOT}/families/${familyId}/summary.json`);
		expectedGeneratedPaths.add(
			`${FAMILY_AFFINITY_REVIEW_ROOT}/families/${familyId}/contact-sheet.png`
		);
	}
	const allReviewFiles = await walkFilesNoSymlinks(repositoryRoot, FAMILY_AFFINITY_REVIEW_ROOT);
	const receiptFiles = allReviewFiles.filter(
		(path) => ORDINARY_RECEIPT_PATTERN.test(path) || BLIND_RECEIPT_PATTERN.test(path)
	);
	for (const path of allReviewFiles) {
		if (!expectedGeneratedPaths.has(path) && !receiptFiles.includes(path)) {
			throw new Error(`Malformed or extraneous review-owned path: ${path}`);
		}
	}

	const ordinaryByKey = new Map<string, OrdinaryReviewReceipt[]>();
	const blindByKey = new Map<string, BlindReviewReceipt[]>();
	for (const path of receiptFiles) {
		const bytes = await optionalRealFile(repositoryRoot, path);
		if (!bytes) throw new Error(`Review receipt disappeared during scan: ${path}`);
		const ordinaryMatch = path.match(ORDINARY_RECEIPT_PATTERN);
		const blindMatch = path.match(BLIND_RECEIPT_PATTERN);
		const receipt = ordinaryMatch
			? OrdinaryReviewReceiptSchema.parse(JSON.parse(bytes.toString('utf8')))
			: BlindReviewReceiptSchema.parse(JSON.parse(bytes.toString('utf8')));
		assertExactReceiptPath(path, receipt);
		const key = `${receipt.coordinateId}/v${receipt.candidateVersion}`;
		const bucket = ordinaryMatch ? ordinaryByKey : blindByKey;
		const values = bucket.get(key) ?? [];
		values.push(receipt as never);
		bucket.set(key, values as never);
	}
	for (const [key, receipts] of [...ordinaryByKey, ...blindByKey]) {
		if (receipts.length !== 1)
			throw new Error(`Duplicate immutable review receipt paths for ${key}`);
	}

	const candidateBytesByCoordinate = new Map<string, Buffer>();
	const cellByCoordinate = new Map<string, ReviewCell>();
	for (const target of targets) {
		const candidateBytes = await optionalRealFile(repositoryRoot, target.ownedPaths.candidate);
		const resultBytes = await optionalRealFile(repositoryRoot, target.ownedPaths.result);
		const key = `${target.coordinateId}/v${target.version}`;
		const ordinary = ordinaryByKey.get(key)?.[0];
		const blind = blindByKey.get(key)?.[0];
		if (!candidateBytes && !resultBytes && (ordinary || blind)) {
			throw new Error(`Review receipt exists without candidate/result for ${target.coordinateId}`);
		}
		const result = resultBytes
			? FamilyAffinityCandidateResultSchema.parse(JSON.parse(resultBytes.toString('utf8')))
			: undefined;
		const evaluated = evaluateFamilyAffinityReviewAttempt({
			target,
			...(candidateBytes ? { candidateBytes } : {}),
			...(result ? { result } : {}),
			...(resultBytes ? { resultBytes } : {}),
			...(ordinary ? { ordinary } : {}),
			...(blind ? { blind } : {})
		});
		if (candidateBytes) candidateBytesByCoordinate.set(target.coordinateId, candidateBytes);
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
			candidateSha256: candidateBytes ? rawSha256(candidateBytes) : null,
			revisionRequired: evaluated.revisionRequired
		});
	}

	const familyIds = [...new Set(targets.map(({ familyId }) => familyId))];
	if (familyIds.length !== 30) throw new Error(`Expected 30 families, found ${familyIds.length}`);
	const families: FamilyAffinityReviewArtifacts['families'] = [];
	for (const familyId of familyIds) {
		const familyTargets = targets.filter((target) => target.familyId === familyId);
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
		const summary: FamilyReviewSummary = {
			schemaVersion: 'family-affinity-family-review-v1',
			familyId,
			coordinateCount: 25,
			notGeneratedCount: 25 - generatedCount,
			generatedCount,
			approvedReviewCount,
			revisionRequiredCount,
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
	const catalog: FamilyAffinityReviewCatalog = {
		schemaVersion: 'family-affinity-review-catalog-v1',
		experimentId: 'family-affinity-v1',
		familyCount: 30,
		coordinateCount: 750,
		generatedCount,
		approvedReviewCount,
		revisionRequiredCount,
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
						`${family.summaryPath}\0${familyAffinitySha256(family.summary)}\0${family.contactSheetPath}\0${rawSha256(family.contactSheet)}`
				)
				.join('\n')
		)
		.digest('hex');
	return { catalog, families, digest };
}
