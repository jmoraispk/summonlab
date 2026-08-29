import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
	AffinityWorkflowReviewListSchema,
	ImageProductionCatalogSchema,
	ImageProductionTargetSchema,
	type AffinityWorkflowReviewList,
	type ImageProductionCatalog,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { afterEach, describe, expect, it } from 'vitest';

import {
	AFFINITY_EXPERIMENT_ROOT,
	AFFINITY_EXPORT_TIMESTAMP,
	ImageProductionBlindReviewCollectionSchema,
	createAffinityWorkflowExportBundle
} from './image-production-lib.js';
import {
	AffinityReviewEvidenceBindingError,
	buildAffinityBlindReviewEvidence,
	exportAffinityReviewEvidence,
	parseAffinityReviewEvidenceArgs
} from './export-affinity-review-evidence.js';

const HASH = 'a'.repeat(64);
const NEW_HASH = 'b'.repeat(64);
const TARGET_ID = 'affinity-workflow-v1-death-knight-fire';
const REVIEWER = 'human-primary';
const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

function target(): ImageProductionTarget {
	const current = createAffinityWorkflowExportBundle().targets.find(
		(entry) => entry.targetId === TARGET_ID
	);
	if (!current) throw new Error(`Missing target fixture: ${TARGET_ID}`);
	return ImageProductionTargetSchema.parse(current);
}

function catalog(overrides: Record<string, unknown> = {}): ImageProductionCatalog {
	return ImageProductionCatalogSchema.parse({
		schemaVersion: 'image-production-catalog-v1',
		experimentId: 'affinity-workflow-v1',
		generatedAt: '2026-08-29T17:00:00.000Z',
		status: 'experimental-unpromoted',
		entries: [
			{
				targetId: TARGET_ID,
				resultId: 'result-affinity-workflow-v1-death-knight-fire-v1',
				assignmentId: 'assignment-affinity-workflow-v1-death-knight-fire',
				speciesId: 'death-knight',
				affinity: 'fire',
				cohort: 'controlled',
				status: 'candidate',
				candidatePath: `${AFFINITY_EXPERIMENT_ROOT}/candidates/death-knight/fire-v1.png`,
				candidateHash: NEW_HASH,
				reviewState: 'pending',
				promoted: false,
				...overrides
			}
		]
	});
}

function review(overrides: Record<string, unknown> = {}) {
	return {
		reviewId: '44444444-4444-4444-8444-444444444444',
		experimentId: 'affinity-workflow-v1' as const,
		targetId: TARGET_ID,
		candidateContentHash: NEW_HASH,
		reviewer: REVIEWER,
		reviewMode: 'blind' as const,
		identifiedSpeciesId: 'death-knight' as const,
		identifiedAffinity: 'water' as const,
		scores: {
			speciesIdentity: 5,
			affinityReadability: 3,
			silhouetteAndDuty: 4,
			materialCredibility: 4,
			anatomyAndGroundContact: 5,
			affinityIntegration: 3,
			styleCohesion: 4
		},
		verdict: 'revise' as const,
		note: 'Species is clear, but this reads as water rather than fire.',
		reviewedAt: '2026-08-29T18:00:00.000Z',
		...overrides
	};
}

function reviewList(): AffinityWorkflowReviewList {
	const older = review({
		reviewId: '11111111-1111-4111-8111-111111111111',
		candidateContentHash: HASH,
		reviewedAt: '2026-08-29T17:00:00.000Z'
	});
	const latest = review();
	const otherReviewer = review({
		reviewId: '22222222-2222-4222-8222-222222222222',
		reviewer: 'human-secondary'
	});
	return AffinityWorkflowReviewListSchema.parse({
		experimentId: 'affinity-workflow-v1',
		reviews: [older, latest, otherReviewer],
		latestByTargetReviewer: [latest, otherReviewer]
	});
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value, null, '\t')}\n`, 'utf8');
}

async function fixtureWorkspace(): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'summonlab-review-evidence-'));
	temporaryRoots.push(root);
	await writeJson(path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/catalog.json'), catalog());
	await writeJson(
		path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/blind-review.json'),
		ImageProductionBlindReviewCollectionSchema.parse({
			schemaVersion: 'image-production-blind-reviews-v1',
			experimentId: 'affinity-workflow-v1',
			updatedAt: AFFINITY_EXPORT_TIMESTAMP,
			reviews: []
		})
	);
	await writeJson(path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/evaluation.json'), {
		sentinel: 'evaluation-must-not-change'
	});
	await writeJson(
		path.join(root, AFFINITY_EXPERIMENT_ROOT, 'targets/death-knight/fire.json'),
		target()
	);
	return root;
}

describe('affinity review evidence export', () => {
	it('selects only the named reviewer latest record and derives correctness from target truth', () => {
		const result = buildAffinityBlindReviewEvidence({
			reviewer: REVIEWER,
			reviewList: reviewList(),
			catalog: catalog(),
			targets: [target()]
		});

		expect(result.reviews).toHaveLength(1);
		expect(result.updatedAt).toBe('2026-08-29T18:00:00.000Z');
		expect(result.reviews[0]).toEqual({
			reviewId: '44444444-4444-4444-8444-444444444444',
			targetId: TARGET_ID,
			candidateContentHash: NEW_HASH,
			reviewer: REVIEWER,
			reviewMode: 'blind',
			reviewedAt: '2026-08-29T18:00:00.000Z',
			identifiedSpeciesId: 'death-knight',
			identifiedAffinity: 'water',
			speciesCorrect: true,
			affinityCorrect: false,
			scores: review().scores,
			verdict: 'revise',
			note: 'Species is clear, but this reads as water rather than fire.'
		});
	});

	it('excludes labeled, API, and legacy-unverified records from blind evidence', () => {
		const unverified = review({ reviewMode: 'api-unverified' });
		const result = buildAffinityBlindReviewEvidence({
			reviewer: REVIEWER,
			reviewList: AffinityWorkflowReviewListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				reviews: [unverified],
				latestByTargetReviewer: [unverified]
			}),
			catalog: catalog(),
			targets: [target()]
		});
		expect(result.reviews).toEqual([]);
	});

	it.each([
		{
			name: 'unknown target',
			reviewListValue: () => {
				const unknown = review({ targetId: 'affinity-workflow-v1-unknown-fire' });
				return AffinityWorkflowReviewListSchema.parse({
					experimentId: 'affinity-workflow-v1',
					reviews: [unknown],
					latestByTargetReviewer: [unknown]
				});
			},
			catalogValue: () => catalog(),
			message: /unknown target/u
		},
		{
			name: 'noncandidate target',
			reviewListValue: reviewList,
			catalogValue: () => catalog({ status: 'revise', reviewState: 'revise' }),
			message: /not a current candidate/u
		},
		{
			name: 'stale candidate hash',
			reviewListValue: reviewList,
			catalogValue: () => catalog({ candidateHash: HASH }),
			message: /is stale/u
		}
	])('rejects a $name record', ({ reviewListValue, catalogValue, message }) => {
		expect(() =>
			buildAffinityBlindReviewEvidence({
				reviewer: REVIEWER,
				reviewList: reviewListValue(),
				catalog: catalogValue(),
				targets: [target()]
			})
		).toThrow(AffinityReviewEvidenceBindingError);
		expect(() =>
			buildAffinityBlindReviewEvidence({
				reviewer: REVIEWER,
				reviewList: reviewListValue(),
				catalog: catalogValue(),
				targets: [target()]
			})
		).toThrow(message);
	});

	it('detects drift in check mode and atomically writes only blind-review.json', async () => {
		const root = await fixtureWorkspace();
		const catalogPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/catalog.json');
		const evaluationPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/evaluation.json');
		const catalogBefore = await readFile(catalogPath, 'utf8');
		const evaluationBefore = await readFile(evaluationPath, 'utf8');
		const loadReviews = async () => reviewList();

		const checked = await exportAffinityReviewEvidence({
			workspaceRoot: root,
			databaseUrl: 'postgresql://unused',
			reviewer: REVIEWER,
			mode: 'check',
			loadReviews
		});
		expect(checked).toMatchObject({ inSync: false, written: false, selectedReviewCount: 1 });

		const written = await exportAffinityReviewEvidence({
			workspaceRoot: root,
			databaseUrl: 'postgresql://unused',
			reviewer: REVIEWER,
			mode: 'write',
			loadReviews
		});
		expect(written).toMatchObject({ inSync: true, written: true, selectedReviewCount: 1 });
		expect(await readFile(catalogPath, 'utf8')).toBe(catalogBefore);
		expect(await readFile(evaluationPath, 'utf8')).toBe(evaluationBefore);
		const aggregate = ImageProductionBlindReviewCollectionSchema.parse(
			JSON.parse(
				await readFile(
					path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/blind-review.json'),
					'utf8'
				)
			) as unknown
		);
		expect(aggregate.reviews).toHaveLength(1);

		const rechecked = await exportAffinityReviewEvidence({
			workspaceRoot: root,
			databaseUrl: 'postgresql://unused',
			reviewer: REVIEWER,
			mode: 'check',
			loadReviews
		});
		expect(rechecked).toMatchObject({ inSync: true, written: false });
	});

	it('fails closed when the database is unavailable and preserves the aggregate', async () => {
		const root = await fixtureWorkspace();
		const blindReviewPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/blind-review.json');
		const before = await readFile(blindReviewPath, 'utf8');

		await expect(
			exportAffinityReviewEvidence({
				workspaceRoot: root,
				databaseUrl: 'postgresql://unavailable',
				reviewer: REVIEWER,
				mode: 'write',
				loadReviews: async () => {
					throw new Error('connection refused');
				}
			})
		).rejects.toThrow(/database is unavailable.*was not changed.*connection refused/u);
		expect(await readFile(blindReviewPath, 'utf8')).toBe(before);
	});

	it('refuses to erase existing evidence when the selected reviewer has no reviews', async () => {
		const root = await fixtureWorkspace();
		const blindReviewPath = path.join(root, AFFINITY_EXPERIMENT_ROOT, 'review/blind-review.json');
		await exportAffinityReviewEvidence({
			workspaceRoot: root,
			databaseUrl: 'postgresql://unused',
			reviewer: REVIEWER,
			mode: 'write',
			loadReviews: async () => reviewList()
		});
		const before = await readFile(blindReviewPath, 'utf8');

		await expect(
			exportAffinityReviewEvidence({
				workspaceRoot: root,
				databaseUrl: 'postgresql://unused',
				reviewer: 'reviewer-with-no-evidence',
				mode: 'write',
				loadReviews: async () =>
					AffinityWorkflowReviewListSchema.parse({
						experimentId: 'affinity-workflow-v1',
						reviews: [],
						latestByTargetReviewer: []
					})
			})
		).rejects.toThrow(/refusing to erase/u);
		expect(await readFile(blindReviewPath, 'utf8')).toBe(before);
	});

	it('requires one explicit mode and a named reviewer', () => {
		expect(parseAffinityReviewEvidenceArgs(['--check', '--reviewer', REVIEWER])).toEqual({
			mode: 'check',
			reviewer: REVIEWER
		});
		expect(() => parseAffinityReviewEvidenceArgs(['--check'])).toThrow(/--reviewer/u);
		expect(() =>
			parseAffinityReviewEvidenceArgs(['--check', '--write', '--reviewer', REVIEWER])
		).toThrow(/exactly one/u);
		expect(() =>
			parseAffinityReviewEvidenceArgs(['--check', '--reviewer', REVIEWER, '--unexpected'])
		).toThrow(/Unknown argument/u);
	});
});
