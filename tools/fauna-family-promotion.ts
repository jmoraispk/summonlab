import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	FAUNA_FAMILY_ROOT,
	FamilyAffinityAssignmentSchema,
	FamilyAffinityResultSchema,
	FamilyAffinityTargetSchema,
	FaunaFamilyManifestSchema,
	PRODUCTION_AFFINITIES,
	familyAffinityRawSha256,
	familyAffinitySha256,
	familyAffinitySourcePacketBinding,
	stableFamilyAffinityJson,
	validateFamilyAffinityCandidateEvidence
} from './family-affinity-production-lib.js';

export const FAUNA_APPROVED_ROOT = 'assets/enemies/approved/fauna-family-v1' as const;
export const FAUNA_APPROVED_MANIFEST_PATH = `${FAUNA_APPROVED_ROOT}/manifest.json` as const;
export const FAUNA_OWNER_APPROVAL_PATH =
	`${FAUNA_APPROVED_ROOT}/receipts/promotion-v1.json` as const;
export const FAUNA_RUNTIME_ROOT = 'assets/enemies/runtime/fauna-family-v1' as const;
export const FAUNA_RUNTIME_CATALOG_PATH = `${FAUNA_RUNTIME_ROOT}/catalog.json` as const;
export const FAUNA_RUNTIME_RECEIPT_PATH = `${FAUNA_RUNTIME_ROOT}/receipt-v1.json` as const;
export const FAUNA_OWNER_ACCEPTANCE_PATH =
	'docs/evidence/fauna-family-v1/owner-acceptance.md' as const;

const CANDIDATE_HANDOFF_COMMIT = '677426c4b4f59d4c9ff37f578aef17e9410ab5c9' as const;
const OWNER_APPROVAL_DATE = '2026-09-04' as const;
const RUNTIME_WIDTH = 960;
const RUNTIME_HEIGHT = 768;

type InventoryCoordinate = {
	coordinateId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	activeVersion: number;
	target: { path: string; sha256: string };
	assignment: { path: string; sha256: string };
	candidate: { path: string; sha256: string };
	provenance: { path: string; sha256: string };
};

type Inventory = {
	schemaVersion: 'fauna-family-candidate-inventory-v1';
	experimentId: 'fauna-family-v1';
	stateCeiling: 'candidate-only';
	counts: {
		familyCount: 8;
		formCount: 40;
		coordinateCount: 200;
		candidateCount: 200;
		resultCount: 200;
	};
	families: Array<{
		familyId: string;
		displayName: string;
		sourceRaceNumber: number;
		forms: Array<{
			formId: string;
			displayName: string;
			tier: string;
			coordinates: InventoryCoordinate[];
		}>;
	}>;
};

type ApprovedRecord = {
	assetKey: string;
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	activeVersion: number;
	target: { path: string; sha256: string };
	assignment: { path: string; sha256: string };
	candidate: { path: string; sha256: string };
	provenance: { path: string; sha256: string };
	approved: {
		path: string;
		sha256: string;
		bytes: number;
		width: number;
		height: number;
		format: 'png';
	};
};

type RuntimeRecord = {
	assetKey: string;
	coordinateId: string;
	familyId: string;
	formId: string;
	affinity: (typeof PRODUCTION_AFFINITIES)[number];
	source: { path: string; sha256: string };
	runtime: {
		path: string;
		publicUrl: string;
		sha256: string;
		bytes: number;
		width: number;
		height: number;
		format: 'webp';
	};
};

export type FaunaPromotionSummary = {
	familyCount: 8;
	formCount: 40;
	coordinateCount: 200;
	approvedCount: 200;
	runtimeCount: 200;
};

type PromotionArtifact = { path: string; bytes: Buffer };

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function repositoryPath(repositoryRoot: string, path: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, path);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Fauna promotion path escapes repository: ${path}`);
	}
	return absolute;
}

async function readRealFile(repositoryRoot: string, path: string): Promise<Buffer> {
	const root = resolve(repositoryRoot);
	const absolute = repositoryPath(root, path);
	let cursor = root;
	for (const part of relative(root, absolute).split(sep).filter(Boolean)) {
		cursor = resolve(cursor, part);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) {
			throw new Error(`Fauna promotion source cannot be a symlink: ${path}`);
		}
	}
	return readFile(absolute);
}

function approvedPath(familyId: string, formId: string, affinity: string): string {
	return `${FAUNA_APPROVED_ROOT}/sources/${familyId}/${formId}/${affinity}.png`;
}

function assetKey(familyId: string, formId: string, affinity: string): string {
	return `enemy-fauna-v1-${familyId}-${formId}-${affinity}`;
}

function runtimePath(familyId: string, formId: string, affinity: string, digest: string): string {
	return `apps/web/static/runtime/enemies/fauna-family-v1/${familyId}/${formId}/${affinity}.${digest.slice(0, 12)}.webp`;
}

function runtimeUrl(path: string): string {
	return `/${path.replace('apps/web/static/', '')}`;
}

function approvalAuthorization() {
	return {
		approvedBy: 'owner',
		approvedOn: OWNER_APPROVAL_DATE,
		scope: 'all 200 fauna-family-v1 candidates',
		instruction: 'All approved. Wire them up, update the wiki, and then merge back to main.',
		candidateHandoffCommit: CANDIDATE_HANDOFF_COMMIT
	} as const;
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(stableFamilyAffinityJson(value));
}

async function buildPromotionArtifacts(repositoryRootInput: string): Promise<{
	artifacts: PromotionArtifact[];
	summary: FaunaPromotionSummary;
}> {
	const repositoryRoot = resolve(repositoryRootInput);
	const inventoryPath = `${FAUNA_FAMILY_ROOT}/inventory.json`;
	const [inventoryBytes, sourceManifestBytes] = await Promise.all([
		readRealFile(repositoryRoot, inventoryPath),
		readRealFile(repositoryRoot, `${FAUNA_FAMILY_ROOT}/manifest.json`)
	]);
	const ownerAcceptanceBytes = await readRealFile(repositoryRoot, FAUNA_OWNER_ACCEPTANCE_PATH);
	const inventory = JSON.parse(inventoryBytes.toString('utf8')) as Inventory;
	const sourceManifest = FaunaFamilyManifestSchema.parse(
		JSON.parse(sourceManifestBytes.toString('utf8'))
	);
	if (
		inventory.schemaVersion !== 'fauna-family-candidate-inventory-v1' ||
		inventory.experimentId !== 'fauna-family-v1' ||
		inventory.stateCeiling !== 'candidate-only' ||
		inventory.counts.familyCount !== 8 ||
		inventory.counts.formCount !== 40 ||
		inventory.counts.coordinateCount !== 200 ||
		inventory.counts.candidateCount !== 200 ||
		inventory.counts.resultCount !== 200
	) {
		throw new Error('Fauna promotion requires the complete 200-coordinate candidate inventory');
	}
	if (sourceManifest.status !== 'candidate-matrix-complete') {
		throw new Error('Fauna promotion requires the complete candidate handoff manifest');
	}

	const approvedRecords: ApprovedRecord[] = [];
	const runtimeRecords: RuntimeRecord[] = [];
	const imageArtifacts: PromotionArtifact[] = [];
	for (const family of inventory.families) {
		for (const form of family.forms) {
			for (const coordinate of form.coordinates) {
				const [targetBytes, assignmentBytes, candidateBytes, resultBytes] = await Promise.all([
					readRealFile(repositoryRoot, coordinate.target.path),
					readRealFile(repositoryRoot, coordinate.assignment.path),
					readRealFile(repositoryRoot, coordinate.candidate.path),
					readRealFile(repositoryRoot, coordinate.provenance.path)
				]);
				const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
				const assignment = FamilyAffinityAssignmentSchema.parse(
					JSON.parse(assignmentBytes.toString('utf8'))
				);
				const result = FamilyAffinityResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
				const source = familyAffinitySourcePacketBinding(target);
				const sourceBytes = await readRealFile(repositoryRoot, source.path);
				validateFamilyAffinityCandidateEvidence({
					target,
					assignment,
					familyPacketBytes: sourceBytes,
					candidateBytes,
					resultBytes
				});
				if (result.producerId === 'owner') {
					throw new Error(`Fauna producer cannot self-approve: ${coordinate.coordinateId}`);
				}
				if (
					familyAffinitySha256(target) !== coordinate.target.sha256 ||
					familyAffinitySha256(assignment) !== coordinate.assignment.sha256 ||
					familyAffinityRawSha256(candidateBytes) !== coordinate.candidate.sha256 ||
					familyAffinityRawSha256(resultBytes) !== coordinate.provenance.sha256 ||
					target.coordinateId !== coordinate.coordinateId ||
					assignment.coordinateId !== coordinate.coordinateId
				) {
					throw new Error(`Fauna candidate evidence drift: ${coordinate.coordinateId}`);
				}
				const metadata = await sharp(candidateBytes, { failOn: 'error' }).metadata();
				if (
					metadata.format !== 'png' ||
					metadata.width === undefined ||
					metadata.height === undefined ||
					metadata.width < 1024 ||
					metadata.height < 1024
				) {
					throw new Error(`Fauna candidate format drift: ${coordinate.coordinateId}`);
				}
				const approvedAssetPath = approvedPath(family.familyId, form.formId, coordinate.affinity);
				const runtimeBytes = await sharp(candidateBytes)
					.resize(RUNTIME_WIDTH, RUNTIME_HEIGHT, {
						fit: 'contain',
						background: { r: 8, g: 11, b: 15, alpha: 1 }
					})
					.webp({ quality: 88, effort: 4 })
					.toBuffer();
				const runtimeSha256 = sha256(runtimeBytes);
				const runtimeAssetPath = runtimePath(
					family.familyId,
					form.formId,
					coordinate.affinity,
					runtimeSha256
				);
				const coordinateAssetKey = assetKey(family.familyId, form.formId, coordinate.affinity);
				approvedRecords.push({
					assetKey: coordinateAssetKey,
					coordinateId: coordinate.coordinateId,
					familyId: family.familyId,
					formId: form.formId,
					affinity: coordinate.affinity,
					activeVersion: coordinate.activeVersion,
					target: coordinate.target,
					assignment: coordinate.assignment,
					candidate: coordinate.candidate,
					provenance: coordinate.provenance,
					approved: {
						path: approvedAssetPath,
						sha256: coordinate.candidate.sha256,
						bytes: candidateBytes.byteLength,
						width: metadata.width,
						height: metadata.height,
						format: 'png'
					}
				});
				runtimeRecords.push({
					assetKey: coordinateAssetKey,
					coordinateId: coordinate.coordinateId,
					familyId: family.familyId,
					formId: form.formId,
					affinity: coordinate.affinity,
					source: { path: approvedAssetPath, sha256: coordinate.candidate.sha256 },
					runtime: {
						path: runtimeAssetPath,
						publicUrl: runtimeUrl(runtimeAssetPath),
						sha256: runtimeSha256,
						bytes: runtimeBytes.byteLength,
						width: RUNTIME_WIDTH,
						height: RUNTIME_HEIGHT,
						format: 'webp'
					}
				});
				imageArtifacts.push(
					{ path: approvedAssetPath, bytes: candidateBytes },
					{ path: runtimeAssetPath, bytes: runtimeBytes }
				);
			}
		}
	}
	if (
		approvedRecords.length !== 200 ||
		runtimeRecords.length !== 200 ||
		new Set(approvedRecords.map(({ coordinateId }) => coordinateId)).size !== 200 ||
		new Set(approvedRecords.map(({ assetKey }) => assetKey)).size !== 200 ||
		new Set(approvedRecords.map(({ approved }) => approved.path)).size !== 200 ||
		new Set(runtimeRecords.map(({ runtime }) => runtime.path)).size !== 200
	) {
		throw new Error('Fauna promotion did not resolve exactly 200 unique coordinates');
	}

	const summary: FaunaPromotionSummary = {
		familyCount: 8,
		formCount: 40,
		coordinateCount: 200,
		approvedCount: 200,
		runtimeCount: 200
	};
	const approvedManifest = {
		schemaVersion: 'fauna-family-approved-manifest-v1',
		catalogId: 'fauna-family-v1',
		authorization: approvalAuthorization(),
		source: {
			inventoryPath,
			inventorySha256: sha256(inventoryBytes),
			manifestPath: `${FAUNA_FAMILY_ROOT}/manifest.json`,
			manifestSha256: sha256(sourceManifestBytes)
		},
		summary,
		records: approvedRecords
	};
	const approvedManifestBytes = jsonBytes(approvedManifest);
	const ownerApprovalReceipt = {
		schemaVersion: 'fauna-family-owner-approval-receipt-v1',
		receiptId: 'fauna-family-v1-owner-approval-v1',
		authorization: approvalAuthorization(),
		approvedManifest: {
			path: FAUNA_APPROVED_MANIFEST_PATH,
			sha256: sha256(approvedManifestBytes)
		},
		ownerAcceptance: {
			path: FAUNA_OWNER_ACCEPTANCE_PATH,
			sha256: sha256(ownerAcceptanceBytes)
		},
		repository: {
			branch: 'codex/enemies-affinity-wiki',
			basisCommit: CANDIDATE_HANDOFF_COMMIT
		},
		summary
	};
	const ownerApprovalBytes = jsonBytes(ownerApprovalReceipt);
	const runtimeCatalog = {
		schemaVersion: 'fauna-family-runtime-catalog-v1',
		catalogId: 'fauna-family-v1',
		approvedManifest: {
			path: FAUNA_APPROVED_MANIFEST_PATH,
			sha256: sha256(approvedManifestBytes)
		},
		ownerApproval: { path: FAUNA_OWNER_APPROVAL_PATH, sha256: sha256(ownerApprovalBytes) },
		summary,
		records: runtimeRecords
	};
	const runtimeCatalogBytes = jsonBytes(runtimeCatalog);
	const runtimeReceipt = {
		schemaVersion: 'fauna-family-runtime-promotion-receipt-v1',
		receiptId: 'fauna-family-v1-runtime-v1',
		ownerApproval: { path: FAUNA_OWNER_APPROVAL_PATH, sha256: sha256(ownerApprovalBytes) },
		approvedManifest: {
			path: FAUNA_APPROVED_MANIFEST_PATH,
			sha256: sha256(approvedManifestBytes)
		},
		runtimeCatalog: { path: FAUNA_RUNTIME_CATALOG_PATH, sha256: sha256(runtimeCatalogBytes) },
		summary
	};
	return {
		summary,
		artifacts: [
			...imageArtifacts,
			{ path: FAUNA_APPROVED_MANIFEST_PATH, bytes: approvedManifestBytes },
			{ path: FAUNA_OWNER_APPROVAL_PATH, bytes: ownerApprovalBytes },
			{ path: FAUNA_RUNTIME_CATALOG_PATH, bytes: runtimeCatalogBytes },
			{ path: FAUNA_RUNTIME_RECEIPT_PATH, bytes: jsonBytes(runtimeReceipt) }
		]
	};
}

async function writeCollisionSafe(
	repositoryRoot: string,
	artifact: PromotionArtifact
): Promise<void> {
	const absolute = repositoryPath(repositoryRoot, artifact.path);
	await mkdir(dirname(absolute), { recursive: true });
	try {
		await writeFile(absolute, artifact.bytes, { flag: 'wx' });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		const existing = await readRealFile(repositoryRoot, artifact.path);
		if (!existing.equals(artifact.bytes)) {
			throw new Error(`Fauna promotion collision: ${artifact.path}`);
		}
	}
}

export async function promoteFaunaFamilyAssets(
	repositoryRoot: string
): Promise<FaunaPromotionSummary> {
	const promotion = await buildPromotionArtifacts(repositoryRoot);
	for (const artifact of promotion.artifacts) {
		await writeCollisionSafe(repositoryRoot, artifact);
	}
	return promotion.summary;
}

export async function validateFaunaFamilyPromotion(
	repositoryRoot: string
): Promise<FaunaPromotionSummary> {
	const promotion = await buildPromotionArtifacts(repositoryRoot);
	for (const artifact of promotion.artifacts) {
		const actual = await readRealFile(repositoryRoot, artifact.path);
		if (!actual.equals(artifact.bytes)) {
			throw new Error(`Fauna promotion artifact is stale: ${artifact.path}`);
		}
	}
	return promotion.summary;
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check) throw new Error('Pass exactly one of --write or --check');
	const summary = write
		? await promoteFaunaFamilyAssets(process.cwd())
		: await validateFaunaFamilyPromotion(process.cwd());
	console.log(
		`${write ? 'Promoted' : 'Validated'} ${summary.approvedCount} approved fauna sources and ${summary.runtimeCount} runtime derivatives.`
	);
}
