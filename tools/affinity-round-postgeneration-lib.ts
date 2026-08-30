import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, rename, unlink } from 'node:fs/promises';
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

/** Serialize review snapshot replacement and final-evaluation publication for one round. */
export async function acquireAffinityRoundReviewEvidenceLock(
	workspaceRoot: string,
	roundId: AffinityReviewRoundId
): Promise<() => Promise<void>> {
	const lockPath = path.resolve(workspaceRoot, `${roundBlindReviewPath(roundId)}.lock`);
	const owner = `${process.pid}:${randomUUID()}`;
	const createOwnedLock = async () => {
		const handle = await open(lockPath, 'wx');
		try {
			await handle.writeFile(`${owner}\n`);
			await handle.sync();
		} finally {
			await handle.close();
		}
	};
	try {
		await createOwnedLock();
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		const ownerPid = Number((await readFile(lockPath, 'utf8')).trim().split(':', 1)[0]);
		let alive = Number.isSafeInteger(ownerPid) && ownerPid > 0;
		if (alive)
			try {
				process.kill(ownerPid, 0);
			} catch (probeError) {
				if ((probeError as NodeJS.ErrnoException).code === 'ESRCH') alive = false;
				else throw probeError;
			}
		if (alive) throw new Error('Another round review operation owns the lock.', { cause: error });
		const stalePath = `${lockPath}.stale-${randomUUID()}`;
		try {
			await rename(lockPath, stalePath);
		} catch (renameError) {
			if ((renameError as NodeJS.ErrnoException).code === 'ENOENT')
				throw new Error('Round review lock ownership changed during stale-lock recovery.', {
					cause: renameError
				});
			throw renameError;
		}
		try {
			await createOwnedLock();
		} finally {
			await unlink(stalePath).catch(() => undefined);
		}
	}
	return async () => {
		const currentOwner = (await readFile(lockPath, 'utf8')).trim();
		if (currentOwner !== owner)
			throw new Error('Round review lock ownership changed before release.');
		await unlink(lockPath);
	};
}
