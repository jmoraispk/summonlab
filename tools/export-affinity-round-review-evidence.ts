import { randomUUID } from 'node:crypto';
import { link, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
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
	acquireAffinityRoundReviewEvidenceLock,
	loadVerifiedAffinityReviewRound,
	roundBlindReviewPath,
	targetsById,
	type AffinityRoundBlindReviewCollection
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityReviewRoundIdSchema,
	affinityRoundRoot,
	type AffinityReviewRoundId
} from './affinity-review-round-lib.js';
import { canonicalJson, sha256Json } from './image-production-lib.js';

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

function assertReplacementContext(
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
		if (!nextByTarget.has(review.targetId))
			throw new Error(`Current DB projection cannot delete exported target ${review.targetId}.`);
}

export function affinityRoundBlindReviewHistoryPath(
	roundId: AffinityReviewRoundId,
	canonicalSha256: string
): string {
	if (!/^[a-f0-9]{64}$/u.test(canonicalSha256))
		throw new Error('Blind-review history requires a canonical SHA-256.');
	return `${affinityRoundRoot(roundId)}/blind-review-history/${canonicalSha256}.json`;
}

async function archivePriorEvidence(input: {
	readonly workspaceRoot: string;
	readonly roundId: AffinityReviewRoundId;
	readonly prior: AffinityRoundBlindReviewCollection;
	readonly priorText: string;
}): Promise<string> {
	const archivePath = affinityRoundBlindReviewHistoryPath(input.roundId, sha256Json(input.prior));
	const destination = path.resolve(input.workspaceRoot, archivePath);
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.archive-${process.pid}-${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, input.priorText, { flag: 'wx' });
		await link(temporary, destination);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		const existing = await readFile(destination, 'utf8');
		if (existing !== input.priorText)
			throw new Error(`Conflicting archived review evidence: ${archivePath}`, { cause: error });
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
	return archivePath;
}

export function verifyAffinityRoundReviewDatabaseAuthenticity(input: {
	readonly roundId: AffinityReviewRoundId;
	readonly exported: AffinityRoundBlindReviewCollection;
	readonly reviewList: unknown;
	readonly verifiedRound: Awaited<ReturnType<typeof loadVerifiedAffinityReviewRound>>;
}): { readonly valid: boolean; readonly expected: AffinityRoundBlindReviewCollection | null } {
	let expected: AffinityRoundBlindReviewCollection;
	try {
		expected = buildAffinityRoundBlindReviewEvidence({
			roundId: input.roundId,
			reviewer: input.exported.reviewer,
			reviewList: input.reviewList,
			verifiedRound: input.verifiedRound
		});
	} catch {
		return { valid: false, expected: null };
	}
	return {
		valid: canonicalJson(expected) === canonicalJson(input.exported),
		expected
	};
}

export interface AffinityRoundReviewEvidenceReport {
	readonly mode: 'check' | 'write';
	readonly roundId: AffinityReviewRoundId;
	readonly reviewer: string;
	readonly reviewCount: number;
	readonly outputPath: string;
	readonly inSync: boolean;
	readonly written: boolean;
	readonly archivedPriorPath: string | null;
	readonly frozen: boolean;
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
	const finalReceiptPath = path.resolve(
		workspaceRoot,
		`${affinityRoundRoot(roundId)}/final-evaluation-receipt.json`
	);
	const frozen = await readFile(finalReceiptPath).then(
		() => true,
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return false;
			throw error;
		}
	);
	let written = false;
	let becameInSync = false;
	let archivedPriorPath: string | null = null;
	if (input.mode === 'write' && !inSync) {
		await mkdir(path.dirname(destination), { recursive: true });
		const release = await acquireAffinityRoundReviewEvidenceLock(workspaceRoot, roundId);
		try {
			const frozenUnderLock = await readFile(finalReceiptPath).then(
				() => true,
				(error: NodeJS.ErrnoException) => {
					if (error.code === 'ENOENT') return false;
					throw error;
				}
			);
			if (frozenUnderLock)
				throw new Error(
					`Round ${roundId} review evidence is frozen by its final evaluation receipt.`
				);
			const underLock = await readFile(destination, 'utf8').catch((error) => {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
				throw error;
			});
			becameInSync = underLock === expected;
			if (underLock !== expected) {
				if (underLock !== null) {
					const prior = AffinityRoundBlindReviewCollectionSchema.parse(JSON.parse(underLock));
					assertReplacementContext(prior, evidence);
					archivedPriorPath = await archivePriorEvidence({
						workspaceRoot,
						roundId,
						prior,
						priorText: underLock
					});
				}
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
		written,
		archivedPriorPath,
		frozen
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
