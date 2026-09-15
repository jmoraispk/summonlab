import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateFaunaFamilyPromotion } from './fauna-family-promotion.js';
import {
	familyAffinitySha256,
	stableFamilyAffinityJson
} from './family-affinity-production-lib.js';

export const FAUNA_PROMOTION_LINEAGE_PATHS = {
	inventory: 'assets/enemies/experiments/fauna-family-v1/inventory.json',
	sourceManifest: 'assets/enemies/experiments/fauna-family-v1/manifest.json',
	approvedManifest: 'assets/enemies/approved/fauna-family-v1/manifest.json',
	ownerApproval: 'assets/enemies/approved/fauna-family-v1/receipts/promotion-v1.json',
	runtimeCatalog: 'assets/enemies/runtime/fauna-family-v1/catalog.json',
	runtimeReceipt: 'assets/enemies/runtime/fauna-family-v1/receipt-v1.json'
} as const;

interface FaunaPromotionLineageDocuments {
	readonly inventory: string;
	readonly sourceManifest: string;
	readonly approvedManifest: string;
	readonly ownerApproval: string;
	readonly runtimeCatalog: string;
	readonly runtimeReceipt: string;
}

type JsonRecord = Record<string, unknown>;

function sha256(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function parseRecord(contents: string, label: string): JsonRecord {
	const value: unknown = JSON.parse(contents);
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`Invalid fauna promotion lineage document: ${label}`);
	}
	return value as JsonRecord;
}

function requireSchema(value: JsonRecord, expected: string, label: string): void {
	if (value.schemaVersion !== expected) {
		throw new Error(`Invalid fauna promotion lineage schema: ${label}`);
	}
}

function requireReference(value: unknown, expectedPath: string, label: string): JsonRecord {
	if (
		value === null ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		(value as JsonRecord).path !== expectedPath ||
		typeof (value as JsonRecord).sha256 !== 'string'
	) {
		throw new Error(`Invalid fauna promotion lineage reference: ${label}`);
	}
	return value as JsonRecord;
}

export function resealFaunaApprovedProvenanceRecords(
	approvedManifestContents: string,
	documents: ReadonlyMap<string, string>
): string {
	const approvedManifest = parseRecord(approvedManifestContents, 'approved manifest');
	requireSchema(approvedManifest, 'fauna-family-approved-manifest-v1', 'approved manifest');
	if (!Array.isArray(approvedManifest.records)) {
		throw new Error('Invalid fauna approved provenance records');
	}
	for (const [index, value] of approvedManifest.records.entries()) {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(`Invalid fauna approved provenance record: ${index}`);
		}
		const record = value as JsonRecord;
		for (const [field, root, raw] of [
			['target', 'assets/enemies/experiments/fauna-family-v1/targets/', false],
			['assignment', 'assets/enemies/experiments/fauna-family-v1/assignments/', false],
			['provenance', 'assets/enemies/experiments/fauna-family-v1/results/', true]
		] as const) {
			const reference = record[field];
			const referencePath =
				reference !== null && typeof reference === 'object' && !Array.isArray(reference)
					? (reference as JsonRecord).path
					: undefined;
			if (
				reference === null ||
				typeof reference !== 'object' ||
				Array.isArray(reference) ||
				typeof referencePath !== 'string' ||
				!referencePath.startsWith(root) ||
				!referencePath.endsWith('.json') ||
				typeof (reference as JsonRecord).sha256 !== 'string'
			) {
				throw new Error(`Invalid fauna approved ${field} reference: ${index}`);
			}
			const repositoryPath = referencePath;
			const contents = documents.get(repositoryPath);
			if (contents === undefined) {
				throw new Error(`Missing fauna approved ${field} document: ${repositoryPath}`);
			}
			(reference as JsonRecord).sha256 = raw
				? sha256(contents)
				: familyAffinitySha256(JSON.parse(contents) as unknown);
		}
	}
	return stableFamilyAffinityJson(approvedManifest);
}

export function resealFaunaFamilyPromotionLineageDocuments(
	documents: FaunaPromotionLineageDocuments
): Pick<
	FaunaPromotionLineageDocuments,
	'approvedManifest' | 'ownerApproval' | 'runtimeCatalog' | 'runtimeReceipt'
> {
	const approvedManifest = parseRecord(documents.approvedManifest, 'approved manifest');
	const ownerApproval = parseRecord(documents.ownerApproval, 'owner approval');
	const runtimeCatalog = parseRecord(documents.runtimeCatalog, 'runtime catalog');
	const runtimeReceipt = parseRecord(documents.runtimeReceipt, 'runtime receipt');
	requireSchema(approvedManifest, 'fauna-family-approved-manifest-v1', 'approved manifest');
	requireSchema(ownerApproval, 'fauna-family-owner-approval-receipt-v1', 'owner approval');
	requireSchema(runtimeCatalog, 'fauna-family-runtime-catalog-v1', 'runtime catalog');
	requireSchema(runtimeReceipt, 'fauna-family-runtime-promotion-receipt-v1', 'runtime receipt');

	const source = approvedManifest.source;
	if (
		source === null ||
		typeof source !== 'object' ||
		Array.isArray(source) ||
		(source as JsonRecord).inventoryPath !== FAUNA_PROMOTION_LINEAGE_PATHS.inventory ||
		(source as JsonRecord).manifestPath !== FAUNA_PROMOTION_LINEAGE_PATHS.sourceManifest ||
		typeof (source as JsonRecord).inventorySha256 !== 'string' ||
		typeof (source as JsonRecord).manifestSha256 !== 'string'
	) {
		throw new Error('Invalid fauna promotion source references');
	}
	(source as JsonRecord).inventorySha256 = sha256(documents.inventory);
	(source as JsonRecord).manifestSha256 = sha256(documents.sourceManifest);
	const approvedManifestOutput = stableFamilyAffinityJson(approvedManifest);
	const approvedManifestSha256 = sha256(approvedManifestOutput);

	const approvalManifest = requireReference(
		ownerApproval.approvedManifest,
		FAUNA_PROMOTION_LINEAGE_PATHS.approvedManifest,
		'owner approval manifest'
	);
	approvalManifest.sha256 = approvedManifestSha256;
	const ownerApprovalOutput = stableFamilyAffinityJson(ownerApproval);
	const ownerApprovalSha256 = sha256(ownerApprovalOutput);

	const catalogManifest = requireReference(
		runtimeCatalog.approvedManifest,
		FAUNA_PROMOTION_LINEAGE_PATHS.approvedManifest,
		'runtime approved manifest'
	);
	const catalogApproval = requireReference(
		runtimeCatalog.ownerApproval,
		FAUNA_PROMOTION_LINEAGE_PATHS.ownerApproval,
		'runtime owner approval'
	);
	catalogManifest.sha256 = approvedManifestSha256;
	catalogApproval.sha256 = ownerApprovalSha256;
	const runtimeCatalogOutput = stableFamilyAffinityJson(runtimeCatalog);
	const runtimeCatalogSha256 = sha256(runtimeCatalogOutput);

	const receiptManifest = requireReference(
		runtimeReceipt.approvedManifest,
		FAUNA_PROMOTION_LINEAGE_PATHS.approvedManifest,
		'receipt approved manifest'
	);
	const receiptApproval = requireReference(
		runtimeReceipt.ownerApproval,
		FAUNA_PROMOTION_LINEAGE_PATHS.ownerApproval,
		'receipt owner approval'
	);
	const receiptCatalog = requireReference(
		runtimeReceipt.runtimeCatalog,
		FAUNA_PROMOTION_LINEAGE_PATHS.runtimeCatalog,
		'receipt runtime catalog'
	);
	receiptManifest.sha256 = approvedManifestSha256;
	receiptApproval.sha256 = ownerApprovalSha256;
	receiptCatalog.sha256 = runtimeCatalogSha256;

	return {
		approvedManifest: approvedManifestOutput,
		ownerApproval: ownerApprovalOutput,
		runtimeCatalog: runtimeCatalogOutput,
		runtimeReceipt: stableFamilyAffinityJson(runtimeReceipt)
	};
}

export async function resealFaunaFamilyPromotionLineage(options: {
	readonly repositoryRoot: string;
	readonly check: boolean;
}): Promise<void> {
	const read = async (key: keyof typeof FAUNA_PROMOTION_LINEAGE_PATHS): Promise<string> =>
		readFile(
			path.join(options.repositoryRoot, ...FAUNA_PROMOTION_LINEAGE_PATHS[key].split('/')),
			'utf8'
		);
	const documents = {
		inventory: await read('inventory'),
		sourceManifest: await read('sourceManifest'),
		approvedManifest: await read('approvedManifest'),
		ownerApproval: await read('ownerApproval'),
		runtimeCatalog: await read('runtimeCatalog'),
		runtimeReceipt: await read('runtimeReceipt')
	};
	const approvedManifest = parseRecord(documents.approvedManifest, 'approved manifest');
	if (!Array.isArray(approvedManifest.records)) {
		throw new Error('Invalid fauna approved provenance records');
	}
	const referencedPaths = approvedManifest.records.flatMap((value, index) => {
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(`Invalid fauna approved provenance record: ${index}`);
		}
		return ['target', 'assignment', 'provenance'].map((field) => {
			const reference = (value as JsonRecord)[field];
			if (
				reference === null ||
				typeof reference !== 'object' ||
				Array.isArray(reference) ||
				typeof (reference as JsonRecord).path !== 'string'
			) {
				throw new Error(`Invalid fauna approved ${field} reference: ${index}`);
			}
			return (reference as JsonRecord).path as string;
		});
	});
	const referencedDocuments = new Map(
		await Promise.all(
			[...new Set(referencedPaths)].map(
				async (repositoryPath) =>
					[
						repositoryPath,
						await readFile(path.join(options.repositoryRoot, ...repositoryPath.split('/')), 'utf8')
					] as const
			)
		)
	);
	const outputs = resealFaunaFamilyPromotionLineageDocuments({
		...documents,
		approvedManifest: resealFaunaApprovedProvenanceRecords(
			documents.approvedManifest,
			referencedDocuments
		)
	});
	const changed = (Object.keys(outputs) as (keyof typeof outputs)[]).filter(
		(key) => outputs[key] !== documents[key]
	);
	if (options.check && changed.length > 0) {
		throw new Error(`Fauna promotion lineage requires resealing: ${changed.join(', ')}`);
	}
	if (!options.check) {
		await Promise.all(
			changed.map((key) =>
				writeFile(
					path.join(options.repositoryRoot, ...FAUNA_PROMOTION_LINEAGE_PATHS[key].split('/')),
					outputs[key]
				)
			)
		);
	}
	await validateFaunaFamilyPromotion(options.repositoryRoot);
}

const entrypoint = process.argv[1];
if (entrypoint && import.meta.url === pathToFileURL(entrypoint).href) {
	const write = process.argv.includes('--write');
	const check = process.argv.includes('--check');
	if (write === check) throw new Error('Pass exactly one of --write or --check');
	await resealFaunaFamilyPromotionLineage({ repositoryRoot: process.cwd(), check });
	console.log(check ? 'Fauna promotion lineage is current.' : 'Resealed fauna promotion lineage.');
}
