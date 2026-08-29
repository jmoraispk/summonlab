import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionEvaluationSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	createAffinityWorkflowExportBundle
} from './image-production-lib.js';
import {
	buildAffinityReviewState,
	scanAffinityReviewWorkspace,
	syncAffinityReviewWorkspace,
	type ValidatedImageProductionExecution
} from './sync-affinity-review.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
}

async function createPartialWorkspace(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-review-sync-'));
	temporaryRoots.push(root);
	const bundle = createAffinityWorkflowExportBundle();
	for (const artifact of bundle.artifacts) {
		await writeJson(path.join(root, artifact.path), artifact.value);
	}
	const result = ImageProductionResultSchema.parse(
		await readJson(
			path.join(process.cwd(), AFFINITY_EXPERIMENT_ROOT, 'results/death-knight-fire-v1.json')
		)
	);
	const resultPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'results/death-knight-fire-v1.json');
	await writeJson(resultPath, result);
	const output = result.attempts.find(
		(attempt) => attempt.attemptId === result.selectedAttemptId
	)?.output;
	if (!output) throw new Error('Death Knight fixture has no selected output.');
	const candidatePath = path.join(root, output.path);
	await mkdir(path.dirname(candidatePath), { recursive: true });
	await copyFile(path.join(process.cwd(), output.path), candidatePath);
	return root;
}

async function currentDeathKnightFireExecution(): Promise<ValidatedImageProductionExecution> {
	const root = process.cwd();
	return {
		target: ImageProductionTargetSchema.parse(
			await readJson(path.join(root, AFFINITY_EXPERIMENT_ROOT, 'targets/death-knight/fire.json'))
		),
		assignment: ImageProductionAssignmentSchema.parse(
			await readJson(
				path.join(root, AFFINITY_EXPERIMENT_ROOT, 'assignments/death-knight/fire.json')
			)
		),
		result: ImageProductionResultSchema.parse(
			await readJson(path.join(root, AFFINITY_EXPERIMENT_ROOT, 'results/death-knight-fire-v1.json'))
		)
	};
}

function priorAggregates() {
	const bundle = createAffinityWorkflowExportBundle();
	return {
		priorCatalog: bundle.catalog,
		priorEvaluation: ImageProductionEvaluationSchema.parse({
			...bundle.evaluation,
			concurrencyStages: [
				{
					stage: 'canary',
					plannedParallelJobs: 2,
					effectiveParallelJobs: 2,
					targetCount: 2,
					candidateCount: 2,
					reviseCount: 0,
					failedCount: 0,
					throttleCount: 0,
					timeoutCount: 0,
					retryCount: 1,
					generationMedianMs: 30_000,
					generationP90Ms: 35_000,
					generationP95Ms: 35_000,
					slowestCompletionMs: 40_000,
					waveWallTimeMs: 45_000,
					summedJobTimeMs: 80_000,
					effectiveSpeedup: 1.77,
					parallelEfficiency: 0.88,
					queueDelayMs: 0,
					visualCandidateRate: 1,
					provenanceCompletenessRate: 1,
					missingResultCount: 0,
					duplicateIdCount: 0,
					pathConflictCount: 0,
					integrationErrorCount: 0
				}
			],
			failureClassifications: [
				{
					failureId: 'generator-variance-example',
					targetId: null,
					layer: 'generator-variance',
					description: 'Existing classification must survive synchronization.',
					resolution: null
				}
			],
			recommendedSafeConcurrency: 2,
			completionNotes: ['Human-authored completion note.']
		})
	};
}

describe('affinity review synchronization', () => {
	it('builds a deterministic pending-review catalog without self-approval', async () => {
		const execution = await currentDeathKnightFireExecution();
		const { priorCatalog, priorEvaluation } = priorAggregates();
		const blindReviews = ImageProductionBlindReviewCollectionSchema.parse({
			schemaVersion: 'image-production-blind-reviews-v1',
			experimentId: 'affinity-workflow-v1',
			updatedAt: '2026-08-29T16:00:00.000Z',
			reviews: []
		});

		const first = buildAffinityReviewState({
			executions: [execution],
			blindReviews,
			priorCatalog,
			priorEvaluation
		});
		const second = buildAffinityReviewState({
			executions: [execution],
			blindReviews,
			priorCatalog,
			priorEvaluation
		});

		expect(first).toEqual(second);
		expect(first.catalog.entries).toHaveLength(1);
		expect(first.catalog.entries[0]).toMatchObject({
			targetId: execution.target.targetId,
			status: execution.result.status,
			reviewState: 'pending',
			promoted: false
		});
		expect(first.evaluation.workflow).toMatchObject({
			completedTargetCount: 1,
			completeProvenanceCount: 1,
			pathConflictCount: 0
		});
		expect(first.evaluation.concurrencyStages).toEqual(priorEvaluation.concurrencyStages);
		expect(first.evaluation.failureClassifications).toEqual(priorEvaluation.failureClassifications);
		expect(first.evaluation.completionNotes).toEqual(priorEvaluation.completionNotes);
	});

	it('uses an explicit human blind verdict, preserving the review in evaluation', async () => {
		const execution = await currentDeathKnightFireExecution();
		const { priorCatalog, priorEvaluation } = priorAggregates();
		const review = {
			reviewId: 'd30f4759-e41e-4e6b-8acc-df35bc98f033',
			targetId: execution.target.targetId,
			candidateContentHash: execution.result.attempts.find(
				(attempt) => attempt.attemptId === execution.result.selectedAttemptId
			)!.output!.contentHash,
			reviewer: 'human-reviewer',
			reviewedAt: '2026-08-29T18:00:00.000Z',
			identifiedSpeciesId: 'death-knight' as const,
			identifiedAffinity: 'fire' as const,
			speciesCorrect: true,
			affinityCorrect: true,
			scores: {
				speciesIdentity: 5,
				affinityReadability: 5,
				silhouetteAndDuty: 4,
				materialCredibility: 4,
				anatomyAndGroundContact: 4,
				affinityIntegration: 5,
				styleCohesion: 4
			},
			verdict: 'candidate' as const,
			note: 'Human reviewer accepts this candidate for the controlled cohort.'
		};
		const blindReviews = ImageProductionBlindReviewCollectionSchema.parse({
			schemaVersion: 'image-production-blind-reviews-v1',
			experimentId: 'affinity-workflow-v1',
			updatedAt: review.reviewedAt,
			reviews: [review]
		});

		const state = buildAffinityReviewState({
			executions: [execution],
			blindReviews,
			priorCatalog,
			priorEvaluation
		});

		expect(state.catalog.entries[0]?.reviewState).toBe('accepted');
		expect(state.evaluation.blindReviews).toEqual([review]);
		expect(state.evaluation.controlled.speciesCorrectCount).toBe(1);
		expect(state.evaluation.controlled.affinityCorrectCount).toBe(1);
		expect(state.evaluation.controlled.acceptedMeaningfulAffinityCount).toBe(1);
	});

	it('scans a partial cohort strictly without treating missing results as errors', async () => {
		const root = await createPartialWorkspace();
		const scan = await scanAffinityReviewWorkspace(root);

		expect(scan.issues).toEqual([]);
		expect(scan.executions).toHaveLength(1);
		expect(scan.executions.length + scan.missingResultTargetIds.length).toBe(54);
		expect(scan.executions.every(({ target, result }) => target.targetId === result.targetId)).toBe(
			true
		);
	});

	it('updates only orchestrator aggregates and refuses writes when an orphan appears', async () => {
		const root = await createPartialWorkspace();
		const evaluationPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/evaluation.json');
		const staleEvaluation = ImageProductionEvaluationSchema.parse(await readJson(evaluationPath));
		await writeFile(
			evaluationPath,
			`${JSON.stringify({ ...staleEvaluation, catalogHash: '0'.repeat(64) }, null, '\t')}\n`,
			'utf8'
		);

		const written = await syncAffinityReviewWorkspace(root, 'write');
		expect(written.written).toBe(true);
		expect(written.inSync).toBe(true);
		expect(written.issueCount).toBe(0);
		const syncedCatalog = ImageProductionCatalogSchema.parse(
			await readJson(path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/catalog.json'))
		);
		expect(syncedCatalog.entries).toHaveLength(written.executionCount);

		const orphanPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'candidates/orphan.png');
		await writeFile(orphanPath, Buffer.from('not an image'));
		const catalogBefore = await readFile(
			path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/catalog.json'),
			'utf8'
		);
		const refused = await syncAffinityReviewWorkspace(root, 'write');
		const catalogAfter = await readFile(
			path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/catalog.json'),
			'utf8'
		);

		expect(refused.written).toBe(false);
		expect(refused.issueCount).toBe(1);
		expect(refused.pathConflictCount).toBe(0);
		expect(refused.integrationErrorCount).toBe(1);
		expect(refused.issues[0]).toMatchObject({
			kind: 'orphan-artifact',
			path: `${AFFINITY_EXPERIMENT_ROOT}/candidates/orphan.png`
		});
		expect(catalogAfter).toBe(catalogBefore);
	});
});
