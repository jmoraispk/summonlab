import { copyFile, link, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
	AffinityWorkflowReviewListSchema,
	ImageProductionResultSchema,
	type AffinityWorkflowReviewList
} from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	AffinityRoundBlindReviewCollectionSchema,
	loadVerifiedAffinityReviewRound,
	roundBlindReviewPath
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityRoundContactSheetManifestSchema,
	exportAffinityRoundContactSheet
} from './export-affinity-round-contact-sheet.js';
import {
	buildAffinityRoundBlindReviewEvidence,
	exportAffinityRoundReviewEvidence
} from './export-affinity-round-review-evidence.js';
import {
	deriveAffinityRoundFinalEvaluation,
	finalizeAffinityRoundEvaluation,
	roundFinalizationBlockers,
	type AffinityRoundFinalCriteria
} from './finalize-affinity-round-evaluation.js';
import {
	affinityRoundAggregatePaths,
	affinityRoundRoot,
	loadAffinityReviewRoundRegistry
} from './affinity-review-round-lib.js';
import { syncAffinityReviewRound } from './sync-affinity-review-round.js';

const REPOSITORY_ROOT = path.resolve('.');
const REVIEWER = 'round-human-primary';
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

async function copyArtifact(root: string, repositoryPath: string): Promise<void> {
	const source = path.resolve(REPOSITORY_ROOT, repositoryPath);
	const destination = path.resolve(root, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	await link(source, destination).catch(async (error: NodeJS.ErrnoException) => {
		if (error.code !== 'EXDEV') throw error;
		await copyFile(source, destination);
	});
}

async function completeBaselineRound(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-round-postgeneration-'));
	temporaryRoots.push(root);
	const registry = await loadAffinityReviewRoundRegistry(root, 'baseline-v1');
	for (const entry of registry.entries) {
		await copyArtifact(root, entry.targetPath);
		await copyArtifact(root, entry.assignmentPath);
		await copyArtifact(root, entry.target.output.resultPath);
		const result = ImageProductionResultSchema.parse(
			JSON.parse(
				await readFile(path.resolve(REPOSITORY_ROOT, entry.target.output.resultPath), 'utf8')
			)
		);
		const output =
			result.status === 'candidate'
				? result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output
				: [...result.attempts].reverse().find((attempt) => attempt.output)?.output;
		if (output) await copyArtifact(root, output.path);
	}
	await syncAffinityReviewRound({ workspaceRoot: root, roundId: 'baseline-v1', mode: 'write' });
	return root;
}

async function currentCandidateReviews(root: string): Promise<AffinityWorkflowReviewList> {
	const round = await loadVerifiedAffinityReviewRound(root, 'baseline-v1');
	const targets = new Map(
		round.registry.entries.map((entry) => [entry.target.targetId, entry.target])
	);
	const reviews = round.catalog.entries
		.filter((entry) => entry.status === 'candidate' && entry.candidateHash)
		.map((entry, index) => {
			const target = targets.get(entry.targetId)!;
			return {
				reviewId: `00000000-0000-4000-8${String(index).padStart(3, '0')}-000000000000`,
				experimentId: 'affinity-workflow-v1' as const,
				targetId: entry.targetId,
				candidateContentHash: entry.candidateHash!,
				reviewer: REVIEWER,
				reviewMode: 'blind' as const,
				identifiedSpeciesId: target.speciesId,
				identifiedAffinity: target.affinity,
				scores: {
					speciesIdentity: 5,
					affinityReadability: 5,
					silhouetteAndDuty: 5,
					materialCredibility: 5,
					anatomyAndGroundContact: 5,
					affinityIntegration: 5,
					styleCohesion: 5
				},
				verdict: 'candidate' as const,
				note: 'Current-hash blind round review.',
				reviewedAt: `2026-08-29T22:${String(index).padStart(2, '0')}:00.000Z`
			};
		});
	return AffinityWorkflowReviewListSchema.parse({
		experimentId: 'affinity-workflow-v1',
		reviews,
		latestByTargetReviewer: reviews
	});
}

describe('round post-generation evidence', () => {
	it('exports only one explicit reviewer and binds exact current round candidates', async () => {
		const root = await completeBaselineRound();
		const reviewList = await currentCandidateReviews(root);
		const report = await exportAffinityRoundReviewEvidence({
			workspaceRoot: root,
			databaseUrl: 'unused',
			roundId: 'baseline-v1',
			reviewer: REVIEWER,
			mode: 'write',
			loadReviews: async () => reviewList
		});
		expect(report.reviewCount).toBe(21);
		expect(report.written).toBe(true);
		const evidence = AffinityRoundBlindReviewCollectionSchema.parse(
			JSON.parse(await readFile(path.resolve(root, roundBlindReviewPath('baseline-v1')), 'utf8'))
		);
		expect(evidence.reviews).toHaveLength(21);
		expect(evidence.reviews.every((review) => review.reviewer === REVIEWER)).toBe(true);
		expect(
			evidence.reviews.every((review) => review.speciesCorrect && review.affinityCorrect)
		).toBe(true);
		const round = await loadVerifiedAffinityReviewRound(root, 'baseline-v1');
		const stale = structuredClone(reviewList);
		stale.latestByTargetReviewer[0]!.candidateContentHash = 'f'.repeat(64);
		stale.reviews[0]!.candidateContentHash = 'f'.repeat(64);
		expect(() =>
			buildAffinityRoundBlindReviewEvidence({
				roundId: 'baseline-v1',
				reviewer: REVIEWER,
				reviewList: stale,
				verifiedRound: round
			})
		).toThrow('stale');

		const replaced = {
			...reviewList.latestByTargetReviewer[0]!,
			reviewId: '99999999-9999-4999-8999-999999999999',
			note: 'A later mutation of already exported evidence.',
			reviewedAt: '2026-08-30T00:00:00.000Z'
		};
		const replacementList = AffinityWorkflowReviewListSchema.parse({
			experimentId: 'affinity-workflow-v1',
			reviews: [...reviewList.reviews, replaced],
			latestByTargetReviewer: reviewList.latestByTargetReviewer.map((review, index) =>
				index === 0 ? replaced : review
			)
		});
		await expect(
			exportAffinityRoundReviewEvidence({
				workspaceRoot: root,
				databaseUrl: 'unused',
				roundId: 'baseline-v1',
				reviewer: REVIEWER,
				mode: 'write',
				loadReviews: async () => replacementList
			})
		).rejects.toThrow('cannot delete or mutate');
	});

	it('renders a deterministic opaque 24-image sheet with a receipt-bound sidecar', async () => {
		const root = await completeBaselineRound();
		const first = await exportAffinityRoundContactSheet({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'write'
		});
		expect(first.written).toBe(true);
		const manifest = AffinityRoundContactSheetManifestSchema.parse(
			JSON.parse(await readFile(path.resolve(root, first.manifestPath), 'utf8'))
		);
		expect(manifest.orderedSources).toHaveLength(24);
		expect(manifest.orderedSources.map((source) => source.opaqueLabel)).toEqual(
			Array.from({ length: 24 }, (_, index) => `S${String(index + 1).padStart(2, '0')}`)
		);
		const second = await exportAffinityRoundContactSheet({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'check'
		});
		expect(second.inSync).toBe(true);
		expect(second.imageByteSha256).toBe(first.imageByteSha256);

		const manifestPath = path.resolve(root, first.manifestPath);
		const originalManifestText = await readFile(manifestPath, 'utf8');
		const reordered = structuredClone(manifest);
		[reordered.orderedSources[0], reordered.orderedSources[1]] = [
			reordered.orderedSources[1]!,
			reordered.orderedSources[0]!
		];
		await writeFile(manifestPath, `${JSON.stringify(reordered, null, '\t')}\n`);
		expect(
			(
				await exportAffinityRoundContactSheet({
					workspaceRoot: root,
					roundId: 'baseline-v1',
					mode: 'check'
				})
			).inSync
		).toBe(false);

		await writeFile(manifestPath, originalManifestText);
		const stale = structuredClone(manifest);
		stale.orderedSources[0]!.resultCanonicalSha256 = 'f'.repeat(64);
		await writeFile(manifestPath, `${JSON.stringify(stale, null, '\t')}\n`);
		expect(
			(
				await exportAffinityRoundContactSheet({
					workspaceRoot: root,
					roundId: 'baseline-v1',
					mode: 'check'
				})
			).inSync
		).toBe(false);
	});

	it('keeps finalization blocked without 24 exact reviews and enforces round-specific gates', async () => {
		const root = await completeBaselineRound();
		const reviewList = await currentCandidateReviews(root);
		await exportAffinityRoundReviewEvidence({
			workspaceRoot: root,
			databaseUrl: 'unused',
			roundId: 'baseline-v1',
			reviewer: REVIEWER,
			mode: 'write',
			loadReviews: async () => reviewList
		});
		const derived = await deriveAffinityRoundFinalEvaluation(root, 'baseline-v1');
		expect(derived.eligible).toBe(false);
		expect(derived.blockers).toContain('requires-24-exact-current-blind-reviews');
		const finalized = await finalizeAffinityRoundEvaluation({
			workspaceRoot: root,
			roundId: 'baseline-v1',
			mode: 'write',
			acknowledgeHumanReview: true
		});
		expect(finalized.written).toBe(false);
		const finalPath = path.resolve(root, affinityRoundRoot('baseline-v1'), 'final-evaluation.json');
		await expect(readFile(finalPath)).rejects.toMatchObject({ code: 'ENOENT' });

		const controlledPass: AffinityRoundFinalCriteria = {
			reviewCount: 24,
			firstAttemptCandidateCount: 20,
			speciesCorrectCount: 23,
			affinityCorrectCount: 20,
			normalUnaffiliatedCount: 4,
			acceptedMeaningfulAffinityCount: 20,
			acceptedCriticalVisualFailureCount: 0,
			representedSpeciesCount: 4,
			acceptedUnusualAnatomyCount: 0,
			workflowViolationCount: 0
		};
		expect(roundFinalizationBlockers('final-controlled-v1', controlledPass)).toEqual([]);
		expect(roundFinalizationBlockers('breadth-v1', controlledPass)).toContain(
			'requires-human-accepted-unusual-anatomy'
		);
		expect(
			roundFinalizationBlockers('breadth-v1', {
				...controlledPass,
				acceptedUnusualAnatomyCount: 1
			})
		).toEqual([]);
	});

	it('current final and Breadth post-generation checks fail without creating artifacts', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-round-empty-'));
		temporaryRoots.push(root);
		await expect(
			exportAffinityRoundContactSheet({ workspaceRoot: root, roundId: 'breadth-v1', mode: 'check' })
		).rejects.toThrow();
		await expect(
			exportAffinityRoundReviewEvidence({
				workspaceRoot: root,
				databaseUrl: 'unused',
				roundId: 'final-controlled-v1',
				reviewer: REVIEWER,
				mode: 'check',
				loadReviews: async () =>
					AffinityWorkflowReviewListSchema.parse({
						experimentId: 'affinity-workflow-v1',
						reviews: [],
						latestByTargetReviewer: []
					})
			})
		).rejects.toThrow();
		const breadthPaths = affinityRoundAggregatePaths('breadth-v1');
		await expect(readFile(path.resolve(root, breadthPaths.catalog))).rejects.toMatchObject({
			code: 'ENOENT'
		});
	});
});
