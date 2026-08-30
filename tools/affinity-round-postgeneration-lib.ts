import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	ImageProductionBlindReviewSchema,
	ImageProductionCatalogSchema,
	type ImageProductionCatalog,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import {
	AffinityRoundIntegrationReceiptSchema,
	AffinityReviewRoundIdSchema,
	affinityRoundAggregatePaths,
	loadAffinityReviewRoundRegistry,
	readContainedRoundJson,
	sha256Bytes,
	type AffinityReviewRoundId,
	type AffinityReviewRoundRegistry,
	type AffinityRoundIntegrationReceipt
} from './affinity-review-round-lib.js';
import { sha256Json } from './image-production-lib.js';
import { syncAffinityReviewRound } from './sync-affinity-review-round.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);

export const AffinityRoundBlindReviewCollectionSchema = z
	.object({
		schemaVersion: z.literal('affinity-review-round-blind-reviews-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: AffinityReviewRoundIdSchema,
		integrationReceiptCanonicalSha256: Hash,
		reviewer: z.string().trim().min(1).max(100),
		updatedAt: z.iso.datetime(),
		reviews: z.array(ImageProductionBlindReviewSchema).max(24)
	})
	.strict()
	.superRefine((collection, context) => {
		for (const field of ['reviewId', 'targetId'] as const)
			if (
				new Set(collection.reviews.map((review) => review[field])).size !==
				collection.reviews.length
			)
				context.addIssue({
					code: 'custom',
					path: ['reviews'],
					message: `${field} values must be unique`
				});
		if (collection.reviews.some((review) => review.reviewer !== collection.reviewer))
			context.addIssue({
				code: 'custom',
				path: ['reviews'],
				message: 'Every review must belong to the explicit reviewer'
			});
	});
export type AffinityRoundBlindReviewCollection = z.infer<
	typeof AffinityRoundBlindReviewCollectionSchema
>;

export interface VerifiedAffinityReviewRound {
	readonly registry: AffinityReviewRoundRegistry;
	readonly catalog: ImageProductionCatalog;
	readonly receipt: AffinityRoundIntegrationReceipt;
	readonly integrationReceiptCanonicalSha256: string;
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.posix.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
	)
		throw new Error(`Unsafe repository path: ${repositoryPath}`);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error(`Path escapes: ${repositoryPath}`);
	return absolute;
}

export async function verifiedRegularBytes(
	workspaceRoot: string,
	repositoryPath: string
): Promise<Buffer> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	let cursor = path.resolve(workspaceRoot);
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	return readFile(absolute);
}

export async function loadVerifiedAffinityReviewRound(
	workspaceRoot: string,
	roundIdInput: unknown
): Promise<VerifiedAffinityReviewRound> {
	const roundId = AffinityReviewRoundIdSchema.parse(roundIdInput);
	const sync = await syncAffinityReviewRound({ workspaceRoot, roundId, mode: 'check' });
	if (!sync.inSync) throw new Error(`${roundId} integration aggregates are absent or stale.`);
	const registry = await loadAffinityReviewRoundRegistry(workspaceRoot, roundId);
	const paths = affinityRoundAggregatePaths(roundId);
	const catalog = ImageProductionCatalogSchema.parse(
		await readContainedRoundJson(workspaceRoot, paths.catalog)
	);
	const receipt = AffinityRoundIntegrationReceiptSchema.parse(
		await readContainedRoundJson(workspaceRoot, paths.receipt)
	);
	const integrationReceiptCanonicalSha256 = sha256Json(receipt);
	const expectedIds = registry.entries.map((entry) => entry.target.targetId).toSorted();
	const catalogIds = catalog.entries.map((entry) => entry.targetId).toSorted();
	const evidenceIds = receipt.evidence.map((entry) => entry.targetId).toSorted();
	if (
		catalog.entries.length !== 24 ||
		JSON.stringify(expectedIds) !== JSON.stringify(catalogIds) ||
		JSON.stringify(expectedIds) !== JSON.stringify(evidenceIds)
	)
		throw new Error(`${roundId} catalog, receipt, and registry target sets differ.`);
	for (const aggregate of receipt.aggregates) {
		const bytes = await verifiedRegularBytes(workspaceRoot, aggregate.path);
		if (
			sha256Bytes(bytes) !== aggregate.byteSha256 ||
			sha256Json(JSON.parse(bytes.toString('utf8'))) !== aggregate.canonicalSha256
		)
			throw new Error(`Integration aggregate binding differs: ${aggregate.path}`);
	}
	return { registry, catalog, receipt, integrationReceiptCanonicalSha256 };
}

export async function loadRoundBlindReviews(
	workspaceRoot: string,
	roundId: AffinityReviewRoundId,
	required = false
): Promise<AffinityRoundBlindReviewCollection | null> {
	const repositoryPath = `${affinityRoundAggregatePaths(roundId).catalog.replace(/catalog\.json$/u, '')}blind-review.json`;
	try {
		return AffinityRoundBlindReviewCollectionSchema.parse(
			await readContainedRoundJson(workspaceRoot, repositoryPath)
		);
	} catch (error) {
		if (!required && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

export function targetsById(
	registry: AffinityReviewRoundRegistry
): ReadonlyMap<string, ImageProductionTarget> {
	return new Map(registry.entries.map((entry) => [entry.target.targetId, entry.target]));
}

export function roundBlindReviewPath(roundId: AffinityReviewRoundId): string {
	return `${affinityRoundAggregatePaths(roundId).catalog.replace(/catalog\.json$/u, '')}blind-review.json`;
}
