import { randomUUID } from 'node:crypto';
import { link, mkdir, open, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	AffinityWorkflowReviewListSchema,
	ImageProductionResultSchema,
	type AffinityWorkflowReviewList,
	type ImageProductionResult
} from '../packages/contracts/src/index.js';
import { listAffinityWorkflowReviews } from '../packages/database/src/index.js';
import { format } from 'prettier';
import { z } from 'zod';

import {
	AffinityRoundBlindReviewCollectionSchema,
	acquireAffinityRoundReviewEvidenceLock,
	loadRoundBlindReviews,
	loadVerifiedAffinityReviewRound,
	verifiedRegularBytes
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityReviewRoundIdSchema,
	affinityRoundRoot,
	sha256Bytes,
	type AffinityReviewRoundId
} from './affinity-review-round-lib.js';
import {
	verifyAffinityRoundReviewDatabaseAuthenticity,
	type RoundReviewListLoader
} from './export-affinity-round-review-evidence.js';
import { sha256Json } from './image-production-lib.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);

export const AffinityRoundFinalEvaluationSchema = z
	.object({
		schemaVersion: z.literal('affinity-review-round-final-evaluation-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: AffinityReviewRoundIdSchema,
		status: z.literal('passed'),
		finalizedAt: z.iso.datetime(),
		integrationReceiptCanonicalSha256: Hash,
		blindReviewCanonicalSha256: Hash,
		criteria: z
			.object({
				reviewCount: z.literal(24),
				firstAttemptCandidateCount: z.number().int().min(0).max(24),
				speciesCorrectCount: z.number().int().min(0).max(24),
				affinityCorrectCount: z.number().int().min(0).max(24),
				normalUnaffiliatedCount: z.number().int().min(0).max(4),
				acceptedMeaningfulAffinityCount: z.number().int().min(0).max(20),
				acceptedCriticalVisualFailureCount: z.number().int().min(0).max(24),
				representedSpeciesCount: z.number().int().min(0).max(8),
				acceptedUnusualAnatomyCount: z.number().int().min(0).max(24),
				workflowViolationCount: z.literal(0)
			})
			.strict()
	})
	.strict()
	.superRefine((evaluation, context) => {
		const controlledPass =
			evaluation.criteria.firstAttemptCandidateCount >= 20 &&
			evaluation.criteria.speciesCorrectCount >= 23 &&
			evaluation.criteria.affinityCorrectCount >= 20 &&
			evaluation.criteria.normalUnaffiliatedCount === 4 &&
			evaluation.criteria.acceptedMeaningfulAffinityCount === 20 &&
			evaluation.criteria.acceptedCriticalVisualFailureCount === 0;
		const breadthPass =
			evaluation.criteria.representedSpeciesCount === 4 &&
			evaluation.criteria.acceptedUnusualAnatomyCount >= 1;
		if (evaluation.roundId === 'breadth-v1' ? !breadthPass : !controlledPass)
			context.addIssue({
				code: 'custom',
				path: ['criteria'],
				message: 'Round pass gate is not met'
			});
	});

export const AffinityRoundFinalEvaluationReceiptSchema = z
	.object({
		schemaVersion: z.literal('affinity-review-round-final-evaluation-receipt-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		roundId: AffinityReviewRoundIdSchema,
		status: z.literal('complete'),
		completedAt: z.iso.datetime(),
		integrationReceiptCanonicalSha256: Hash,
		blindReviewCanonicalSha256: Hash,
		evaluationPath: z.string().min(1),
		evaluationCanonicalSha256: Hash,
		evaluationByteSha256: Hash
	})
	.strict();

function selectedHasCriticalFailure(result: ImageProductionResult): boolean {
	const selected = result.attempts.find(
		(attempt) => attempt.attemptId === result.selectedAttemptId
	);
	return (
		selected?.findings.some(
			(finding) =>
				finding.outcome === 'fail' &&
				['anatomy', 'canvas-completion', 'framing', 'silhouette'].includes(finding.category)
		) ?? false
	);
}

export interface RoundFinalizationDerivation {
	readonly eligible: boolean;
	readonly blockers: readonly string[];
	readonly evaluation: z.infer<typeof AffinityRoundFinalEvaluationSchema> | null;
}

export type AffinityRoundFinalCriteria = z.infer<
	typeof AffinityRoundFinalEvaluationSchema
>['criteria'];

export interface AffinityRoundFinalizationDependencies {
	readonly databaseUrl?: string;
	readonly loadReviews?: RoundReviewListLoader;
}

export function roundFinalizationBlockers(
	roundId: AffinityReviewRoundId,
	criteria: AffinityRoundFinalCriteria
): string[] {
	const blockers: string[] = [];
	if (roundId === 'breadth-v1') {
		if (criteria.representedSpeciesCount !== 4) blockers.push('requires-four-breadth-species');
		if (criteria.acceptedUnusualAnatomyCount < 1)
			blockers.push('requires-human-accepted-unusual-anatomy');
	} else {
		if (criteria.firstAttemptCandidateCount < 20)
			blockers.push('first-attempt-candidate-threshold');
		if (criteria.speciesCorrectCount < 23) blockers.push('species-recognition-threshold');
		if (criteria.affinityCorrectCount < 20) blockers.push('affinity-recognition-threshold');
		if (criteria.normalUnaffiliatedCount !== 4) blockers.push('normal-unaffiliated-threshold');
		if (criteria.acceptedMeaningfulAffinityCount !== 20)
			blockers.push('meaningful-affinity-acceptance-threshold');
		if (criteria.acceptedCriticalVisualFailureCount !== 0)
			blockers.push('accepted-critical-visual-failure');
	}
	return blockers;
}

export async function deriveAffinityRoundFinalEvaluation(
	workspaceRoot: string,
	roundId: AffinityReviewRoundId,
	dependencies: AffinityRoundFinalizationDependencies = {}
): Promise<RoundFinalizationDerivation> {
	const round = await loadVerifiedAffinityReviewRound(workspaceRoot, roundId);
	const reviews = await loadRoundBlindReviews(workspaceRoot, roundId, true);
	if (!reviews) throw new Error(`${roundId} blind review evidence is missing.`);
	AffinityRoundBlindReviewCollectionSchema.parse(reviews);
	const blockers: string[] = [];
	if (reviews.integrationReceiptCanonicalSha256 !== round.integrationReceiptCanonicalSha256)
		blockers.push('blind-review-integration-binding-mismatch');
	let databaseReviews: AffinityWorkflowReviewList | null = null;
	try {
		databaseReviews = AffinityWorkflowReviewListSchema.parse(
			await (dependencies.loadReviews ?? listAffinityWorkflowReviews)(
				dependencies.databaseUrl ?? getConfig().databaseUrl,
				'affinity-workflow-v1'
			)
		);
	} catch {
		blockers.push('authoritative-review-database-unavailable');
	}
	if (databaseReviews) {
		const authenticity = verifyAffinityRoundReviewDatabaseAuthenticity({
			roundId,
			exported: reviews,
			reviewList: databaseReviews,
			verifiedRound: round
		});
		if (!authenticity.valid)
			blockers.push(
				authenticity.expected
					? 'authoritative-review-projection-mismatch'
					: 'authoritative-review-database-invalid'
			);
	}
	const targets = new Map(
		round.registry.entries.map((entry) => [entry.target.targetId, entry.target])
	);
	const catalog = new Map(round.catalog.entries.map((entry) => [entry.targetId, entry]));
	const reviewByTarget = new Map(reviews.reviews.map((review) => [review.targetId, review]));
	if (
		reviews.reviews.length !== 24 ||
		new Set(reviews.reviews.map((review) => review.targetId)).size !== 24 ||
		[...targets.keys()].some((targetId) => !reviewByTarget.has(targetId))
	)
		blockers.push('requires-24-exact-current-blind-reviews');
	for (const review of reviews.reviews) {
		const target = targets.get(review.targetId);
		const entry = catalog.get(review.targetId);
		if (
			!target ||
			!entry ||
			entry.status !== 'candidate' ||
			entry.candidateHash !== review.candidateContentHash ||
			review.speciesCorrect !== (review.identifiedSpeciesId === target.speciesId) ||
			review.affinityCorrect !== (review.identifiedAffinity === target.affinity)
		)
			blockers.push(`stale-or-invalid-review:${review.targetId}`);
	}
	const results = new Map<string, ImageProductionResult>();
	for (const entry of round.registry.entries) {
		const result = ImageProductionResultSchema.parse(
			JSON.parse(
				(await verifiedRegularBytes(workspaceRoot, entry.target.output.resultPath)).toString('utf8')
			)
		);
		results.set(entry.target.targetId, result);
	}
	const accepted = reviews.reviews.filter((review) => review.verdict === 'candidate');
	const criteria = {
		reviewCount: 24 as const,
		firstAttemptCandidateCount: [...results.values()].filter(
			(result) =>
				result.status === 'candidate' && result.selectedAttemptId === result.attempts[0]?.attemptId
		).length,
		speciesCorrectCount: reviews.reviews.filter((review) => review.speciesCorrect).length,
		affinityCorrectCount: reviews.reviews.filter((review) => review.affinityCorrect).length,
		normalUnaffiliatedCount: reviews.reviews.filter(
			(review) => review.affinityCorrect && targets.get(review.targetId)?.affinity === 'normal'
		).length,
		acceptedMeaningfulAffinityCount: accepted.filter(
			(review) => targets.get(review.targetId)?.affinity !== 'normal'
		).length,
		acceptedCriticalVisualFailureCount: accepted.filter((review) =>
			selectedHasCriticalFailure(results.get(review.targetId)!)
		).length,
		representedSpeciesCount: new Set(round.registry.entries.map((entry) => entry.target.speciesId))
			.size,
		acceptedUnusualAnatomyCount: accepted.filter((review) =>
			['cave-drake', 'tower-basilisk'].includes(targets.get(review.targetId)?.speciesId ?? '')
		).length,
		workflowViolationCount: 0 as const
	};
	blockers.push(...roundFinalizationBlockers(roundId, criteria));
	const uniqueBlockers = [...new Set(blockers)];
	if (uniqueBlockers.length > 0)
		return { eligible: false, blockers: uniqueBlockers, evaluation: null };
	return {
		eligible: true,
		blockers: [],
		evaluation: AffinityRoundFinalEvaluationSchema.parse({
			schemaVersion: 'affinity-review-round-final-evaluation-v1',
			experimentId: 'affinity-workflow-v1',
			roundId,
			status: 'passed',
			finalizedAt: reviews.updatedAt,
			integrationReceiptCanonicalSha256: round.integrationReceiptCanonicalSha256,
			blindReviewCanonicalSha256: sha256Json(reviews),
			criteria
		})
	};
}

async function formattedJson(file: string, value: unknown): Promise<string> {
	return format(JSON.stringify(value), {
		filepath: file,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

async function durableTemp(destination: string, text: string): Promise<string> {
	const temporary = `${destination}.finalize-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	await handle.writeFile(text);
	await handle.sync();
	await handle.close();
	return temporary;
}

async function publishExclusiveOrExact(
	temporary: string,
	destination: string,
	expected: string
): Promise<boolean> {
	try {
		await link(temporary, destination);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		if ((await readFile(destination, 'utf8')) !== expected)
			throw new Error(`Existing finalized evaluation artifact differs: ${destination}`, {
				cause: error
			});
		return false;
	}
}

export interface AffinityRoundFinalizationReport {
	readonly mode: 'check' | 'write';
	readonly roundId: AffinityReviewRoundId;
	readonly eligible: boolean;
	readonly blockers: readonly string[];
	readonly evaluationPath: string;
	readonly receiptPath: string;
	readonly inSync: boolean;
	readonly written: boolean;
}

export async function finalizeAffinityRoundEvaluation(options: {
	readonly workspaceRoot?: string;
	readonly roundId: AffinityReviewRoundId;
	readonly mode: 'check' | 'write';
	readonly acknowledgeHumanReview?: boolean;
	readonly databaseUrl?: string;
	readonly loadReviews?: RoundReviewListLoader;
}): Promise<AffinityRoundFinalizationReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const roundId = AffinityReviewRoundIdSchema.parse(options.roundId);
	const root = affinityRoundRoot(roundId);
	const evaluationPath = `${root}/final-evaluation.json`;
	const receiptPath = `${root}/final-evaluation-receipt.json`;
	const dependencies = {
		...(options.databaseUrl ? { databaseUrl: options.databaseUrl } : {}),
		...(options.loadReviews ? { loadReviews: options.loadReviews } : {})
	};
	const derived = await deriveAffinityRoundFinalEvaluation(workspaceRoot, roundId, dependencies);
	if (!derived.eligible || !derived.evaluation)
		return {
			mode: options.mode,
			roundId,
			eligible: false,
			blockers: derived.blockers,
			evaluationPath,
			receiptPath,
			inSync: false,
			written: false
		};
	let evaluationText = await formattedJson(evaluationPath, derived.evaluation);
	let receipt = AffinityRoundFinalEvaluationReceiptSchema.parse({
		schemaVersion: 'affinity-review-round-final-evaluation-receipt-v1',
		experimentId: 'affinity-workflow-v1',
		roundId,
		status: 'complete',
		completedAt: derived.evaluation.finalizedAt,
		integrationReceiptCanonicalSha256: derived.evaluation.integrationReceiptCanonicalSha256,
		blindReviewCanonicalSha256: derived.evaluation.blindReviewCanonicalSha256,
		evaluationPath,
		evaluationCanonicalSha256: sha256Json(derived.evaluation),
		evaluationByteSha256: sha256Bytes(evaluationText)
	});
	let receiptText = await formattedJson(receiptPath, receipt);
	const evaluationDestination = path.resolve(workspaceRoot, evaluationPath);
	const receiptDestination = path.resolve(workspaceRoot, receiptPath);
	const currentEvaluation = await readFile(evaluationDestination, 'utf8').catch(() => null);
	const currentReceipt = await readFile(receiptDestination, 'utf8').catch(() => null);
	const inSync = currentEvaluation === evaluationText && currentReceipt === receiptText;
	let written = false;
	if (options.mode === 'write' && !inSync) {
		if (!options.acknowledgeHumanReview)
			throw new Error('Explicit --acknowledge-human-review is required to finalize a round.');
		const release = await acquireAffinityRoundReviewEvidenceLock(workspaceRoot, roundId);
		try {
			const underLock = await deriveAffinityRoundFinalEvaluation(
				workspaceRoot,
				roundId,
				dependencies
			);
			if (!underLock.eligible || !underLock.evaluation)
				return {
					mode: options.mode,
					roundId,
					eligible: false,
					blockers: underLock.blockers,
					evaluationPath,
					receiptPath,
					inSync: false,
					written: false
				};
			const lockedEvaluation = underLock.evaluation;
			if (sha256Json(lockedEvaluation) !== sha256Json(derived.evaluation))
				throw new Error('Authoritative round review evidence changed during finalization.');
			evaluationText = await formattedJson(evaluationPath, lockedEvaluation);
			receipt = AffinityRoundFinalEvaluationReceiptSchema.parse({
				...receipt,
				completedAt: lockedEvaluation.finalizedAt,
				blindReviewCanonicalSha256: lockedEvaluation.blindReviewCanonicalSha256,
				evaluationCanonicalSha256: sha256Json(lockedEvaluation),
				evaluationByteSha256: sha256Bytes(evaluationText)
			});
			receiptText = await formattedJson(receiptPath, receipt);
			await mkdir(path.dirname(evaluationDestination), { recursive: true });
			const evaluationTemporary = await durableTemp(evaluationDestination, evaluationText);
			const receiptTemporary = await durableTemp(receiptDestination, receiptText);
			let evaluationOwned = false;
			try {
				evaluationOwned = await publishExclusiveOrExact(
					evaluationTemporary,
					evaluationDestination,
					evaluationText
				);
				await publishExclusiveOrExact(receiptTemporary, receiptDestination, receiptText);
				written = true;
			} catch (error) {
				const committedReceipt = await readFile(receiptDestination, 'utf8').catch(() => null);
				if (evaluationOwned && committedReceipt !== receiptText)
					await unlink(evaluationDestination);
				throw error;
			} finally {
				await Promise.all([
					unlink(evaluationTemporary).catch(() => undefined),
					unlink(receiptTemporary).catch(() => undefined)
				]);
			}
		} finally {
			await release();
		}
	}
	return {
		mode: options.mode,
		roundId,
		eligible: true,
		blockers: [],
		evaluationPath,
		receiptPath,
		inSync: inSync || written,
		written
	};
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const args = process.argv.slice(2);
	const roundAt = args.indexOf('--round');
	finalizeAffinityRoundEvaluation({
		roundId: AffinityReviewRoundIdSchema.parse(args[roundAt + 1]),
		mode: args.includes('--write') ? 'write' : 'check',
		acknowledgeHumanReview: args.includes('--acknowledge-human-review')
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
