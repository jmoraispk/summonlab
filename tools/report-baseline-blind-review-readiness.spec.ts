import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	AffinityWorkflowReviewListSchema,
	ImageProductionCatalogSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import { AFFINITY_EXPERIMENT_ROOT } from './image-production-lib.js';
import {
	BASELINE_TARGET_IDS,
	buildBaselineBlindReviewReadiness
} from './report-baseline-blind-review-readiness.js';

async function fixture() {
	const root = path.resolve(AFFINITY_EXPERIMENT_ROOT);
	const catalog = ImageProductionCatalogSchema.parse(
		JSON.parse(await readFile(path.join(root, 'review/catalog.json'), 'utf8'))
	);
	const targets = await Promise.all(
		BASELINE_TARGET_IDS.map((targetId) => {
			const coordinate = targetId.replace('affinity-workflow-v1-', '').split('-');
			const affinity = coordinate.pop()!;
			const species = coordinate.join('-');
			return readFile(path.join(root, `targets/${species}/${affinity}.json`), 'utf8').then((text) =>
				ImageProductionTargetSchema.parse(JSON.parse(text))
			);
		})
	);
	const candidates = catalog.entries.filter(
		(entry) => BASELINE_TARGET_IDS.includes(entry.targetId) && entry.status === 'candidate'
	);
	const reviews = candidates.map((entry, index) => ({
		reviewId: `00000000-0000-4000-8${String(index).padStart(3, '0')}-000000000000`,
		experimentId: 'affinity-workflow-v1' as const,
		targetId: entry.targetId,
		candidateContentHash: entry.candidateHash!,
		reviewer: 'human-primary',
		reviewMode: 'blind' as const,
		identifiedSpeciesId: entry.speciesId,
		identifiedAffinity: entry.affinity,
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
		note: 'Completed human blind review.',
		reviewedAt: '2026-08-29T20:00:00.000Z'
	}));
	const reviewList = AffinityWorkflowReviewListSchema.parse({
		experimentId: 'affinity-workflow-v1',
		reviews,
		latestByTargetReviewer: reviews
	});
	return { catalog, targets, reviewList };
}

describe('baseline blind review readiness', () => {
	it('reports a synthetic exact 21-current-hash reviewer set as ready', async () => {
		const input = await fixture();
		const report = buildBaselineBlindReviewReadiness({ reviewer: 'human-primary', ...input });
		expect(report.ready).toBe(true);
		expect(report).toMatchObject({
			candidateCount: 21,
			reviseCount: 3,
			reviewedCurrentCandidateCount: 21,
			remainingCount: 0
		});
		expect(report.handoffCommands[0]).toContain("--reviewer 'human-primary'");
	});

	it('reports missing, wrong-reviewer, and stale hashes without writing evidence', async () => {
		const input = await fixture();
		const missing = structuredClone(input.reviewList);
		missing.reviews.pop();
		missing.latestByTargetReviewer.pop();
		let report = buildBaselineBlindReviewReadiness({
			reviewer: 'human-primary',
			...input,
			reviewList: missing
		});
		expect(report.ready).toBe(false);
		expect(report.remainingCount).toBe(1);
		report = buildBaselineBlindReviewReadiness({ reviewer: 'someone-else', ...input });
		expect(report.reviewedCurrentCandidateCount).toBe(0);
		expect(report.remainingCount).toBe(21);
		const stale = structuredClone(input.reviewList);
		stale.reviews[0]!.candidateContentHash = 'f'.repeat(64);
		stale.latestByTargetReviewer[0]!.candidateContentHash = 'f'.repeat(64);
		report = buildBaselineBlindReviewReadiness({
			reviewer: 'human-primary',
			...input,
			reviewList: stale
		});
		expect(report.staleTargetIds).toHaveLength(1);
		expect(report.ready).toBe(false);
	});

	it('ignores another reviewer and nonbaseline records', async () => {
		const input = await fixture();
		const extra = {
			...input.reviewList.reviews[0]!,
			reviewId: '99999999-9999-4999-8999-999999999999',
			reviewer: 'other-human'
		};
		const reviewList = AffinityWorkflowReviewListSchema.parse({
			experimentId: 'affinity-workflow-v1',
			reviews: [...input.reviewList.reviews, extra],
			latestByTargetReviewer: [...input.reviewList.latestByTargetReviewer, extra]
		});
		const report = buildBaselineBlindReviewReadiness({
			reviewer: 'human-primary',
			...input,
			reviewList
		});
		expect(report.ready).toBe(true);
		expect(report.reviewedCurrentCandidateCount).toBe(21);
	});
});
