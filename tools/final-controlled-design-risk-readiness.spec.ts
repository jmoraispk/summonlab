import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	AffinityWorkflowReviewListSchema,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	type AffinityWorkflowReviewRecord,
	type ImageProductionBlindReview
} from '../packages/contracts/src/index.js';
import { beforeAll, describe, expect, it } from 'vitest';

import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	sha256Json
} from './image-production-lib.js';
import {
	buildFinalControlledDesignRiskReadiness,
	buildFinalControlledExecutionSnapshot,
	reportFinalControlledDesignRiskReadiness,
	type FinalControlledDesignRiskReadinessInput
} from './final-controlled-design-risk-readiness.js';

const root = process.cwd();
const experimentRoot = path.resolve(root, AFFINITY_EXPERIMENT_ROOT);
let validInput: FinalControlledDesignRiskReadinessInput;

async function readJson(file: string): Promise<unknown> {
	return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

function reviewId(index: number, suffix = 0): string {
	return `00000000-0000-4000-800${suffix}-${String(index + 1).padStart(12, '0')}`;
}

function project(
	record: AffinityWorkflowReviewRecord,
	target: unknown
): ImageProductionBlindReview {
	const parsedTarget = ImageProductionTargetSchema.parse(target);
	return {
		reviewId: record.reviewId,
		targetId: record.targetId,
		candidateContentHash: record.candidateContentHash,
		reviewer: record.reviewer,
		reviewMode: 'blind',
		reviewedAt: record.reviewedAt,
		identifiedSpeciesId: record.identifiedSpeciesId,
		identifiedAffinity: record.identifiedAffinity,
		speciesCorrect: record.identifiedSpeciesId === parsedTarget.speciesId,
		affinityCorrect: record.identifiedAffinity === parsedTarget.affinity,
		scores: record.scores,
		verdict: record.verdict,
		note: record.note
	};
}

beforeAll(async () => {
	const plan = await readJson(path.join(experimentRoot, 'review/final-controlled-rerun-plan.json'));
	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.join(experimentRoot, 'review/catalog.json'))
	);
	const targetEntries = (plan as { targets: Array<{ speciesId: string; affinity: string }> })
		.targets;
	const targets = await Promise.all(
		targetEntries.map(({ speciesId, affinity }) =>
			readJson(path.join(experimentRoot, `targets/${speciesId}/${affinity}.json`))
		)
	);
	const results = await Promise.all(
		targets.map((target) => {
			const parsed = ImageProductionTargetSchema.parse(target);
			return readJson(path.resolve(root, parsed.output.resultPath));
		})
	);
	const targetsById = new Map(
		targets.map((target) => {
			const parsed = ImageProductionTargetSchema.parse(target);
			return [parsed.targetId, parsed] as const;
		})
	);
	const candidateEntries = catalog.entries
		.filter((entry) => entry.cohort === 'controlled' && entry.status === 'candidate')
		.toSorted((left, right) => left.targetId.localeCompare(right.targetId));
	const databaseRecords = candidateEntries.map((entry, index) => {
		const target = targetsById.get(entry.targetId)!;
		return {
			reviewId: reviewId(index),
			experimentId: 'affinity-workflow-v1' as const,
			targetId: entry.targetId,
			candidateContentHash: entry.candidateHash!,
			reviewer: 'human-reviewer',
			reviewMode: 'blind' as const,
			identifiedSpeciesId: target.speciesId,
			identifiedAffinity: target.affinity,
			scores: {
				speciesIdentity: 4,
				affinityReadability: 4,
				silhouetteAndDuty: 4,
				materialCredibility: 4,
				anatomyAndGroundContact: 4,
				affinityIntegration: 4,
				styleCohesion: 4
			},
			verdict: 'candidate' as const,
			note: `Human blind review for ${entry.targetId}.`,
			reviewedAt: `2026-08-29T22:${String(index).padStart(2, '0')}:00.000Z`
		};
	});
	const projected = databaseRecords.map((record) =>
		project(record, targetsById.get(record.targetId))
	);
	validInput = {
		reviewer: 'human-reviewer',
		plan,
		catalog,
		targets,
		results,
		blindReviewCollection: ImageProductionBlindReviewCollectionSchema.parse({
			schemaVersion: 'image-production-blind-reviews-v1',
			experimentId: 'affinity-workflow-v1',
			updatedAt: databaseRecords.at(-1)!.reviewedAt,
			reviews: projected
		}),
		databaseReviewList: AffinityWorkflowReviewListSchema.parse({
			experimentId: 'affinity-workflow-v1',
			reviews: databaseRecords,
			latestByTargetReviewer: databaseRecords
		}),
		currentWorkspaceValid: true,
		plannedPathsAbsent: true
	};
});

describe('final-controlled design-risk readiness', () => {
	it('derives all current bindings only from an exact DB-authentic 21/3 inventory', () => {
		const report = buildFinalControlledDesignRiskReadiness(validInput);
		expect(report.status).toBe('ready');
		expect(report.blockers).toEqual([]);
		expect(report.counts).toEqual({
			targetCount: 24,
			resultCount: 24,
			candidateCount: 21,
			reviseCount: 3,
			exportedBlindReviewCount: 21,
			databaseLatestBlindReviewCount: 21
		});
		const targets = validInput.targets!.map((target) => ImageProductionTargetSchema.parse(target));
		const results = validInput.results!.map((result) => ImageProductionResultSchema.parse(result));
		expect(report.evidenceBindings).toMatchObject({
			planCanonicalSha256: sha256Json(validInput.plan),
			catalogCanonicalSha256: sha256Json(validInput.catalog),
			executionSnapshotCanonicalSha256: sha256Json(
				buildFinalControlledExecutionSnapshot(targets, results)
			),
			blindReviewCollectionCanonicalSha256: sha256Json(validInput.blindReviewCollection),
			sourceAuditCanonicalSha256: sha256Json(
				(validInput.plan as { designRiskReview: unknown }).designRiskReview
			)
		});
	});

	it('rejects a source-audit risk identity that drifts from the exact 16-risk contract', () => {
		const plan = structuredClone(validInput.plan) as {
			designRiskReview: { risks: Array<{ riskId: string }> };
		};
		plan.designRiskReview.risks[0]!.riskId = 'drifted-human-risk';
		const report = buildFinalControlledDesignRiskReadiness({ ...validInput, plan });
		expect(report.status).toBe('blocked');
		expect(report.evidenceBindings).toBeNull();
		expect(report.blockers.map((entry) => entry.code)).toContain('source-audit-risk-set-mismatch');
	});

	it('rejects a stale non-latest exported record even when its target and hash are current', () => {
		const database = AffinityWorkflowReviewListSchema.parse(validInput.databaseReviewList);
		const current = database.latestByTargetReviewer[0]!;
		const older = {
			...current,
			reviewId: reviewId(0, 1),
			reviewedAt: '2026-08-29T20:00:00.000Z'
		};
		const collection = ImageProductionBlindReviewCollectionSchema.parse(
			validInput.blindReviewCollection
		);
		const report = buildFinalControlledDesignRiskReadiness({
			...validInput,
			blindReviewCollection: {
				...collection,
				reviews: [
					project(
						older,
						validInput.targets!.find(
							(target) => ImageProductionTargetSchema.parse(target).targetId === older.targetId
						)
					),
					...collection.reviews.slice(1)
				]
			},
			databaseReviewList: AffinityWorkflowReviewListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				reviews: [older, ...database.reviews],
				latestByTargetReviewer: database.latestByTargetReviewer
			})
		});
		expect(report.status).toBe('blocked');
		expect(report.evidenceBindings).toBeNull();
		expect(report.blockers.map((entry) => entry.code)).toContain(
			'blind-review-database-binding-mismatch'
		);
	});

	it('rejects api-unverified evidence instead of substituting it for a missing blind review', () => {
		const database = AffinityWorkflowReviewListSchema.parse(validInput.databaseReviewList);
		const removed = database.reviews[0]!;
		const apiRecord = {
			...removed,
			reviewId: reviewId(0, 2),
			reviewMode: 'api-unverified' as const
		};
		const remaining = database.reviews.slice(1);
		const report = buildFinalControlledDesignRiskReadiness({
			...validInput,
			databaseReviewList: AffinityWorkflowReviewListSchema.parse({
				experimentId: 'affinity-workflow-v1',
				reviews: [apiRecord, ...remaining],
				latestByTargetReviewer: [apiRecord, ...remaining]
			})
		});
		expect(report.status).toBe('blocked');
		expect(report.blockers.map((entry) => entry.code)).toEqual(
			expect.arrayContaining([
				'api-unverified-review-not-eligible',
				'database-latest-blind-review-inventory-mismatch'
			])
		);
	});

	it('rejects wrong-reviewer, stale-hash, and revise-target substitutions', () => {
		const collection = ImageProductionBlindReviewCollectionSchema.parse(
			validInput.blindReviewCollection
		);
		const catalog = ImageProductionCatalogSchema.parse(validInput.catalog);
		const revise = catalog.entries.find(
			(entry) => entry.cohort === 'controlled' && entry.status === 'revise'
		)!;
		for (const replacement of [
			{ ...collection.reviews[0]!, reviewer: 'another-human' },
			{ ...collection.reviews[0]!, candidateContentHash: 'f'.repeat(64) },
			{
				...collection.reviews[0]!,
				targetId: revise.targetId,
				candidateContentHash: revise.candidateHash!
			}
		]) {
			const report = buildFinalControlledDesignRiskReadiness({
				...validInput,
				blindReviewCollection: {
					...collection,
					reviews: [replacement, ...collection.reviews.slice(1)]
				}
			});
			expect(report.status).toBe('blocked');
			expect(report.evidenceBindings).toBeNull();
		}
	});

	it('reports missing actor, collection, and database as blockers without bindings', () => {
		const report = buildFinalControlledDesignRiskReadiness({
			...validInput,
			reviewer: undefined,
			blindReviewCollection: undefined,
			databaseReviewList: undefined
		});
		expect(report.status).toBe('blocked');
		expect(report.evidenceBindings).toBeNull();
		expect(report.blockers.map((entry) => entry.code)).toEqual(
			expect.arrayContaining([
				'reviewer-required',
				'blind-review-collection-missing',
				'database-reviews-unavailable'
			])
		);
	});

	it('rejects inventory drift, an invalid workspace, and final-path collisions', () => {
		const catalog = ImageProductionCatalogSchema.parse(validInput.catalog);
		const candidateIndex = catalog.entries.findIndex(
			(entry) => entry.cohort === 'controlled' && entry.status === 'candidate'
		);
		const changed = [...catalog.entries];
		changed[candidateIndex] = { ...changed[candidateIndex]!, status: 'revise' };
		const report = buildFinalControlledDesignRiskReadiness({
			...validInput,
			catalog: { ...catalog, entries: changed },
			currentWorkspaceValid: false,
			plannedPathsAbsent: false
		});
		expect(report.status).toBe('blocked');
		expect(report.blockers.map((entry) => entry.code)).toEqual(
			expect.arrayContaining([
				'baseline-status-inventory-mismatch',
				'workspace-invalid',
				'final-path-collision'
			])
		);
	});

	it('reports a database failure from the current reporter without changing review evidence', async () => {
		const reviewPath = path.join(experimentRoot, 'review/blind-review.json');
		const before = await readFile(reviewPath);
		const report = await reportFinalControlledDesignRiskReadiness('human-reviewer', root, {
			loadDatabaseReviews: async () => {
				throw new Error('simulated database outage');
			}
		});
		expect(report.status).toBe('blocked');
		expect(report.blockers.map((entry) => entry.code)).toContain('database-reviews-unavailable');
		expect(JSON.stringify(report)).not.toContain('simulated database outage');
		expect(await readFile(reviewPath)).toEqual(before);
	});
});
