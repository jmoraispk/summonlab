import { createHash } from 'node:crypto';
import { lstat, readFile, stat } from 'node:fs/promises';
import { relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

import {
	FamilyAffinityAssignmentSchema,
	FamilyAffinityResultSchema,
	FamilyAffinityTargetSchema,
	familyAffinityRawSha256,
	familyAffinitySha256
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

type HashReference = { readonly path: string; readonly sha256: string };

type ApprovedRecord = {
	readonly assetKey: string;
	readonly coordinateId: string;
	readonly familyId: string;
	readonly formId: string;
	readonly affinity: string;
	readonly activeVersion: number;
	readonly target: HashReference;
	readonly assignment: HashReference;
	readonly candidate: HashReference;
	readonly provenance: HashReference;
	readonly approved: HashReference & {
		readonly bytes: number;
		readonly width: number;
		readonly height: number;
		readonly format: 'png';
	};
};

type RuntimeRecord = {
	readonly assetKey: string;
	readonly coordinateId: string;
	readonly familyId: string;
	readonly formId: string;
	readonly affinity: string;
	readonly source: HashReference;
	readonly runtime: HashReference & {
		readonly publicUrl: string;
		readonly bytes: number;
		readonly width: number;
		readonly height: number;
		readonly format: 'webp';
	};
};

type PromotionCounts = {
	readonly familyCount: 8;
	readonly formCount: 40;
	readonly coordinateCount: 200;
	readonly approvedCount: 200;
	readonly runtimeCount: 200;
};

type ApprovedManifest = {
	readonly schemaVersion: 'fauna-family-approved-manifest-v1';
	readonly catalogId: 'fauna-family-v1';
	readonly source: {
		readonly inventoryPath: string;
		readonly inventorySha256: string;
		readonly manifestPath: string;
		readonly manifestSha256: string;
	};
	readonly summary: PromotionCounts;
	readonly records: readonly ApprovedRecord[];
};

type OwnerApprovalReceipt = {
	readonly schemaVersion: 'fauna-family-owner-approval-receipt-v1';
	readonly approvedManifest: HashReference;
	readonly ownerAcceptance: HashReference;
	readonly summary: PromotionCounts;
};

type RuntimeCatalog = {
	readonly schemaVersion: 'fauna-family-runtime-catalog-v1';
	readonly catalogId: 'fauna-family-v1';
	readonly approvedManifest: HashReference;
	readonly ownerApproval: HashReference;
	readonly summary: PromotionCounts;
	readonly records: readonly RuntimeRecord[];
};

type RuntimeReceipt = {
	readonly schemaVersion: 'fauna-family-runtime-promotion-receipt-v1';
	readonly approvedManifest: HashReference;
	readonly ownerApproval: HashReference;
	readonly runtimeCatalog: HashReference;
	readonly summary: PromotionCounts;
};

export type FaunaPromotionSummary = PromotionCounts & {
	readonly approvedBytes: number;
	readonly retiredCandidateCount: 200;
};

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function repositoryPath(repositoryRoot: string, path: string): string {
	const root = resolve(repositoryRoot);
	const absolute = resolve(root, path);
	if (!absolute.startsWith(`${root}${sep}`)) {
		throw new Error(`Fauna validation path escapes repository: ${path}`);
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
			throw new Error(`Fauna retained asset cannot be a symlink: ${path}`);
		}
	}
	return readFile(absolute);
}

async function pathExists(repositoryRoot: string, path: string): Promise<boolean> {
	try {
		await lstat(repositoryPath(repositoryRoot, path));
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

function exactCounts(summary: PromotionCounts): boolean {
	return (
		summary.familyCount === 8 &&
		summary.formCount === 40 &&
		summary.coordinateCount === 200 &&
		summary.approvedCount === 200 &&
		summary.runtimeCount === 200
	);
}

function assertHashReference(
	label: string,
	reference: HashReference,
	expectedPath: string,
	bytes: Uint8Array
): void {
	if (reference.path !== expectedPath || reference.sha256 !== sha256(bytes)) {
		throw new Error(`Fauna ${label} hash binding is stale`);
	}
}

export async function validateFaunaFamilyPromotion(
	repositoryRootInput: string
): Promise<FaunaPromotionSummary> {
	const repositoryRoot = resolve(repositoryRootInput);
	const [approvedManifestBytes, ownerApprovalBytes, runtimeCatalogBytes, runtimeReceiptBytes] =
		await Promise.all([
			readRealFile(repositoryRoot, FAUNA_APPROVED_MANIFEST_PATH),
			readRealFile(repositoryRoot, FAUNA_OWNER_APPROVAL_PATH),
			readRealFile(repositoryRoot, FAUNA_RUNTIME_CATALOG_PATH),
			readRealFile(repositoryRoot, FAUNA_RUNTIME_RECEIPT_PATH)
		]);
	const approvedManifest = JSON.parse(approvedManifestBytes.toString('utf8')) as ApprovedManifest;
	const ownerApproval = JSON.parse(ownerApprovalBytes.toString('utf8')) as OwnerApprovalReceipt;
	const runtimeCatalog = JSON.parse(runtimeCatalogBytes.toString('utf8')) as RuntimeCatalog;
	const runtimeReceipt = JSON.parse(runtimeReceiptBytes.toString('utf8')) as RuntimeReceipt;
	if (
		approvedManifest.schemaVersion !== 'fauna-family-approved-manifest-v1' ||
		approvedManifest.catalogId !== 'fauna-family-v1' ||
		ownerApproval.schemaVersion !== 'fauna-family-owner-approval-receipt-v1' ||
		runtimeCatalog.schemaVersion !== 'fauna-family-runtime-catalog-v1' ||
		runtimeCatalog.catalogId !== 'fauna-family-v1' ||
		runtimeReceipt.schemaVersion !== 'fauna-family-runtime-promotion-receipt-v1' ||
		!exactCounts(approvedManifest.summary) ||
		!exactCounts(ownerApproval.summary) ||
		!exactCounts(runtimeCatalog.summary) ||
		!exactCounts(runtimeReceipt.summary)
	) {
		throw new Error('Fauna retained promotion catalogs have invalid identity or counts');
	}
	const [inventoryBytes, sourceManifestBytes, ownerAcceptanceBytes] = await Promise.all([
		readRealFile(repositoryRoot, approvedManifest.source.inventoryPath),
		readRealFile(repositoryRoot, approvedManifest.source.manifestPath),
		readRealFile(repositoryRoot, FAUNA_OWNER_ACCEPTANCE_PATH)
	]);
	if (
		approvedManifest.source.inventorySha256 !== sha256(inventoryBytes) ||
		approvedManifest.source.manifestSha256 !== sha256(sourceManifestBytes)
	) {
		throw new Error('Fauna approval source metadata has drifted');
	}
	assertHashReference(
		'owner approval manifest',
		ownerApproval.approvedManifest,
		FAUNA_APPROVED_MANIFEST_PATH,
		approvedManifestBytes
	);
	assertHashReference(
		'owner acceptance',
		ownerApproval.ownerAcceptance,
		FAUNA_OWNER_ACCEPTANCE_PATH,
		ownerAcceptanceBytes
	);
	assertHashReference(
		'runtime approved manifest',
		runtimeCatalog.approvedManifest,
		FAUNA_APPROVED_MANIFEST_PATH,
		approvedManifestBytes
	);
	assertHashReference(
		'runtime owner approval',
		runtimeCatalog.ownerApproval,
		FAUNA_OWNER_APPROVAL_PATH,
		ownerApprovalBytes
	);
	assertHashReference(
		'receipt approved manifest',
		runtimeReceipt.approvedManifest,
		FAUNA_APPROVED_MANIFEST_PATH,
		approvedManifestBytes
	);
	assertHashReference(
		'receipt owner approval',
		runtimeReceipt.ownerApproval,
		FAUNA_OWNER_APPROVAL_PATH,
		ownerApprovalBytes
	);
	assertHashReference(
		'receipt runtime catalog',
		runtimeReceipt.runtimeCatalog,
		FAUNA_RUNTIME_CATALOG_PATH,
		runtimeCatalogBytes
	);
	if (approvedManifest.records.length !== 200 || runtimeCatalog.records.length !== 200) {
		throw new Error('Fauna retained promotion requires exactly 200 approved and runtime records');
	}
	const runtimeByCoordinate = new Map(
		runtimeCatalog.records.map((record) => [record.coordinateId, record])
	);
	if (runtimeByCoordinate.size !== 200) {
		throw new Error('Fauna runtime catalog contains duplicate coordinates');
	}
	const coordinateIds = new Set<string>();
	const assetKeys = new Set<string>();
	const approvedPaths = new Set<string>();
	let approvedBytes = 0;
	for (const record of approvedManifest.records) {
		if (
			coordinateIds.has(record.coordinateId) ||
			assetKeys.has(record.assetKey) ||
			approvedPaths.has(record.approved.path)
		) {
			throw new Error(
				`Fauna retained promotion contains duplicate identity: ${record.coordinateId}`
			);
		}
		coordinateIds.add(record.coordinateId);
		assetKeys.add(record.assetKey);
		approvedPaths.add(record.approved.path);
		const expectedApprovedPath = `${FAUNA_APPROVED_ROOT}/sources/${record.familyId}/${record.formId}/${record.affinity}.png`;
		if (
			record.approved.path !== expectedApprovedPath ||
			record.approved.format !== 'png' ||
			record.candidate.sha256 !== record.approved.sha256 ||
			!record.candidate.path.startsWith('assets/enemies/experiments/fauna-family-v1/candidates/') ||
			(await pathExists(repositoryRoot, record.candidate.path))
		) {
			throw new Error(`Fauna candidate retirement is invalid: ${record.coordinateId}`);
		}
		const [targetBytes, assignmentBytes, provenanceBytes, approvedSourceBytes] = await Promise.all([
			readRealFile(repositoryRoot, record.target.path),
			readRealFile(repositoryRoot, record.assignment.path),
			readRealFile(repositoryRoot, record.provenance.path),
			readRealFile(repositoryRoot, record.approved.path)
		]);
		const target = FamilyAffinityTargetSchema.parse(JSON.parse(targetBytes.toString('utf8')));
		const assignment = FamilyAffinityAssignmentSchema.parse(
			JSON.parse(assignmentBytes.toString('utf8'))
		);
		FamilyAffinityResultSchema.parse(JSON.parse(provenanceBytes.toString('utf8')));
		if (
			familyAffinitySha256(target) !== record.target.sha256 ||
			familyAffinitySha256(assignment) !== record.assignment.sha256 ||
			familyAffinityRawSha256(provenanceBytes) !== record.provenance.sha256 ||
			target.coordinateId !== record.coordinateId ||
			assignment.coordinateId !== record.coordinateId ||
			sha256(approvedSourceBytes) !== record.approved.sha256 ||
			approvedSourceBytes.byteLength !== record.approved.bytes
		) {
			throw new Error(`Fauna approved provenance has drifted: ${record.coordinateId}`);
		}
		const approvedMetadata = await sharp(approvedSourceBytes, { failOn: 'error' }).metadata();
		if (
			approvedMetadata.format !== record.approved.format ||
			approvedMetadata.width !== record.approved.width ||
			approvedMetadata.height !== record.approved.height
		) {
			throw new Error(`Fauna approved source dimensions have drifted: ${record.coordinateId}`);
		}
		approvedBytes += (await stat(repositoryPath(repositoryRoot, record.approved.path))).size;
		const runtime = runtimeByCoordinate.get(record.coordinateId);
		if (
			!runtime ||
			runtime.assetKey !== record.assetKey ||
			runtime.familyId !== record.familyId ||
			runtime.formId !== record.formId ||
			runtime.affinity !== record.affinity ||
			runtime.source.path !== record.approved.path ||
			runtime.source.sha256 !== record.approved.sha256
		) {
			throw new Error(`Fauna runtime source binding has drifted: ${record.coordinateId}`);
		}
		const runtimeBytes = await readRealFile(repositoryRoot, runtime.runtime.path);
		const runtimeMetadata = await sharp(runtimeBytes, { failOn: 'error' }).metadata();
		if (
			sha256(runtimeBytes) !== runtime.runtime.sha256 ||
			runtimeBytes.byteLength !== runtime.runtime.bytes ||
			runtimeMetadata.format !== runtime.runtime.format ||
			runtimeMetadata.width !== runtime.runtime.width ||
			runtimeMetadata.height !== runtime.runtime.height
		) {
			throw new Error(`Fauna runtime derivative has drifted: ${record.coordinateId}`);
		}
	}
	return {
		...approvedManifest.summary,
		approvedBytes,
		retiredCandidateCount: 200
	};
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	if (!process.argv.includes('--check') || process.argv.includes('--write')) {
		throw new Error('The promoted fauna catalog is immutable; pass --check');
	}
	const summary = await validateFaunaFamilyPromotion(process.cwd());
	console.log(
		`Validated ${summary.approvedCount} approved fauna sources, ${summary.runtimeCount} runtime derivatives, and ${summary.retiredCandidateCount} retired candidate rasters.`
	);
}
