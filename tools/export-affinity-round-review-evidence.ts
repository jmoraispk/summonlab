import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	AffinityWorkflowReviewListSchema,
	type AffinityWorkflowReviewList,
	type ImageProductionBlindReview
} from '../packages/contracts/src/index.js';
import { listAffinityWorkflowReviews } from '../packages/database/src/index.js';

import {
	AffinityRoundBlindReviewCollectionSchema,
	loadVerifiedAffinityReviewRound,
	roundBlindReviewPath,
	targetsById,
	type AffinityRoundBlindReviewCollection
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityReviewRoundIdSchema,
	type AffinityReviewRoundId
} from './affinity-review-round-lib.js';

export type RoundReviewListLoader = (
	databaseUrl: string,
	experimentId: 'affinity-workflow-v1'
) => Promise<AffinityWorkflowReviewList>;

function newestTimestamp(reviews: readonly { reviewedAt: string }[], fallback: string): string {
	return (
		reviews
			.map((review) => review.reviewedAt)
			.toSorted((left, right) => Date.parse(left) - Date.parse(right))
			.at(-1) ?? fallback
	);
}

export function buildAffinityRoundBlindReviewEvidence(input: {
	readonly roundId: AffinityReviewRoundId;
	readonly reviewer: string;
	readonly reviewList: unknown;
	readonly verifiedRound: Awaited<ReturnType<typeof loadVerifiedAffinityReviewRound>>;
}): AffinityRoundBlindReviewCollection {
	const reviewer = input.reviewer.trim();
	if (!reviewer) throw new Error('An explicit non-blank reviewer is required.');
	const reviewList = AffinityWorkflowReviewListSchema.parse(input.reviewList);
	const targets = targetsById(input.verifiedRound.registry);
	const catalog = new Map(
		input.verifiedRound.catalog.entries.map((entry) => [entry.targetId, entry])
	);
	const reviews: ImageProductionBlindReview[] = reviewList.latestByTargetReviewer
		.filter(
			(review) =>
				review.reviewer === reviewer &&
				review.reviewMode === 'blind' &&
				targets.has(review.targetId)
		)
		.map((review) => {
			const target = targets.get(review.targetId)!;
			const candidate = catalog.get(review.targetId);
			if (
				!candidate ||
				candidate.status !== 'candidate' ||
				candidate.candidateHash === null ||
				candidate.candidatePath === null
			)
				throw new Error(`Review target is not a current candidate: ${review.targetId}`);
			if (candidate.candidateHash !== review.candidateContentHash)
				throw new Error(`Review candidate hash is stale: ${review.targetId}`);
			return {
				reviewId: review.reviewId,
				targetId: review.targetId,
				candidateContentHash: review.candidateContentHash,
				reviewer,
				reviewMode: 'blind' as const,
				reviewedAt: review.reviewedAt,
				identifiedSpeciesId: review.identifiedSpeciesId,
				identifiedAffinity: review.identifiedAffinity,
				speciesCorrect: review.identifiedSpeciesId === target.speciesId,
				affinityCorrect: review.identifiedAffinity === target.affinity,
				scores: review.scores,
				verdict: review.verdict,
				note: review.note
			};
		})
		.toSorted((left, right) => left.targetId.localeCompare(right.targetId));
	return AffinityRoundBlindReviewCollectionSchema.parse({
		schemaVersion: 'affinity-review-round-blind-reviews-v1',
		experimentId: 'affinity-workflow-v1',
		roundId: input.roundId,
		integrationReceiptCanonicalSha256: input.verifiedRound.integrationReceiptCanonicalSha256,
		reviewer,
		updatedAt: newestTimestamp(reviews, input.verifiedRound.receipt.completedAt),
		reviews
	});
}

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function assertMonotonicReplacement(
	prior: AffinityRoundBlindReviewCollection,
	next: AffinityRoundBlindReviewCollection
): void {
	if (
		prior.roundId !== next.roundId ||
		prior.reviewer !== next.reviewer ||
		prior.integrationReceiptCanonicalSha256 !== next.integrationReceiptCanonicalSha256
	)
		throw new Error('Existing round review evidence belongs to a different immutable context.');
	const nextByTarget = new Map(next.reviews.map((review) => [review.targetId, review]));
	for (const review of prior.reviews)
		if (JSON.stringify(nextByTarget.get(review.targetId)) !== JSON.stringify(review))
			throw new Error(`Round review evidence cannot delete or mutate ${review.targetId}.`);
}

async function acquireReviewLock(destination: string): Promise<() => Promise<void>> {
	const lockPath = `${destination}.lock`;
	let handle;
	try {
		handle = await open(lockPath, 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		const ownerPid = Number((await readFile(lockPath, 'utf8')).trim());
		let alive = Number.isSafeInteger(ownerPid) && ownerPid > 0;
		if (alive)
			try {
				process.kill(ownerPid, 0);
			} catch (probeError) {
				if ((probeError as NodeJS.ErrnoException).code === 'ESRCH') alive = false;
				else throw probeError;
			}
		if (alive) throw new Error('Another round review export owns the lock.', { cause: error });
		await unlink(lockPath);
		handle = await open(lockPath, 'wx');
	}
	await handle.writeFile(`${process.pid}\n`);
	await handle.sync();
	await handle.close();
	return async () => unlink(lockPath);
}

export interface AffinityRoundReviewEvidenceReport {
	readonly mode: 'check' | 'write';
	readonly roundId: AffinityReviewRoundId;
	readonly reviewer: string;
	readonly reviewCount: number;
	readonly outputPath: string;
	readonly inSync: boolean;
	readonly written: boolean;
}

export async function exportAffinityRoundReviewEvidence(input: {
	readonly workspaceRoot?: string;
	readonly databaseUrl: string;
	readonly roundId: AffinityReviewRoundId;
	readonly reviewer: string;
	readonly mode: 'check' | 'write';
	readonly loadReviews?: RoundReviewListLoader;
}): Promise<AffinityRoundReviewEvidenceReport> {
	const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
	const roundId = AffinityReviewRoundIdSchema.parse(input.roundId);
	const verifiedRound = await loadVerifiedAffinityReviewRound(workspaceRoot, roundId);
	const loadReviews = input.loadReviews ?? listAffinityWorkflowReviews;
	const reviewList = await loadReviews(input.databaseUrl, 'affinity-workflow-v1');
	const evidence = buildAffinityRoundBlindReviewEvidence({
		roundId,
		reviewer: input.reviewer,
		reviewList,
		verifiedRound
	});
	const outputPath = roundBlindReviewPath(roundId);
	const destination = path.resolve(workspaceRoot, outputPath);
	const expected = jsonText(evidence);
	const current = await readFile(destination, 'utf8').catch((error) => {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	});
	const inSync = current === expected;
	let written = false;
	let becameInSync = false;
	if (input.mode === 'write' && !inSync) {
		await mkdir(path.dirname(destination), { recursive: true });
		const release = await acquireReviewLock(destination);
		try {
			const underLock = await readFile(destination, 'utf8').catch((error) => {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
				throw error;
			});
			becameInSync = underLock === expected;
			if (underLock !== expected) {
				if (underLock !== null)
					assertMonotonicReplacement(
						AffinityRoundBlindReviewCollectionSchema.parse(JSON.parse(underLock)),
						evidence
					);
				const temporary = `${destination}.review-${process.pid}-${randomUUID()}.tmp`;
				try {
					await writeFile(temporary, expected, { flag: 'wx' });
					await rename(temporary, destination);
					written = true;
				} finally {
					await unlink(temporary).catch(() => undefined);
				}
			}
		} finally {
			await release();
		}
	}
	return {
		mode: input.mode,
		roundId,
		reviewer: evidence.reviewer,
		reviewCount: evidence.reviews.length,
		outputPath,
		inSync: inSync || becameInSync || written,
		written
	};
}

function parseArgs(args: readonly string[]): {
	roundId: AffinityReviewRoundId;
	reviewer: string;
	mode: 'check' | 'write';
} {
	const roundAt = args.indexOf('--round');
	const reviewerAt = args.indexOf('--reviewer');
	return {
		roundId: AffinityReviewRoundIdSchema.parse(args[roundAt + 1]),
		reviewer: args[reviewerAt + 1]?.trim() ?? '',
		mode: args.includes('--write') ? 'write' : 'check'
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const options = parseArgs(process.argv.slice(2));
	exportAffinityRoundReviewEvidence({
		...options,
		databaseUrl: getConfig().databaseUrl
	})
		.then((report) => {
			process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			if (!report.inSync) process.exitCode = 1;
		})
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		});
}
