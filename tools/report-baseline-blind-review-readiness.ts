import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { getConfig } from '../packages/config/src/index.js';
import {
	AffinityWorkflowReviewListSchema,
	ImageProductionCatalogSchema,
	ImageProductionTargetSchema,
	type AffinityWorkflowReviewList,
	type ImageProductionCatalog,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { listAffinityWorkflowReviews } from '../packages/database/src/index.js';
import { AFFINITY_EXPERIMENT_ROOT } from './image-production-lib.js';

const SPECIES = ['death-knight', 'elemental', 'gray-wolf', 'cave-bear'] as const;
const AFFINITIES = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
export const BASELINE_TARGET_IDS = SPECIES.flatMap((species) =>
	AFFINITIES.map((affinity) => `affinity-workflow-v1-${species}-${affinity}`)
).toSorted();

function shellQuote(value: string): string {
	return `'${value.replaceAll("'", `'\\''`)}'`;
}

export interface BaselineBlindReviewReadinessReport {
	readonly schemaVersion: 'baseline-blind-review-readiness-v1';
	readonly reviewer: string;
	readonly ready: boolean;
	readonly candidateCount: number;
	readonly reviseCount: number;
	readonly reviewedCurrentCandidateCount: number;
	readonly remainingCount: number;
	readonly missingTargetIds: readonly string[];
	readonly staleTargetIds: readonly string[];
	readonly blockers: readonly string[];
	readonly handoffCommands: readonly string[];
}

export function buildBaselineBlindReviewReadiness(input: {
	readonly reviewer: string;
	readonly reviewList: AffinityWorkflowReviewList;
	readonly catalog: ImageProductionCatalog;
	readonly targets: readonly ImageProductionTarget[];
}): BaselineBlindReviewReadinessReport {
	const reviewer = input.reviewer.trim();
	if (!reviewer) throw new Error('Reviewer must not be blank.');
	const reviewList = AffinityWorkflowReviewListSchema.parse(input.reviewList);
	const catalog = ImageProductionCatalogSchema.parse(input.catalog);
	const targets = input.targets.map((target) => ImageProductionTargetSchema.parse(target));
	const targetById = new Map(targets.map((target) => [target.targetId, target]));
	const entries = catalog.entries.filter((entry) => BASELINE_TARGET_IDS.includes(entry.targetId));
	const candidateEntries = entries.filter((entry) => entry.status === 'candidate');
	const reviseEntries = entries.filter((entry) => entry.status === 'revise');
	const reviews = reviewList.latestByTargetReviewer.filter(
		(review) =>
			review.reviewer === reviewer &&
			review.reviewMode === 'blind' &&
			BASELINE_TARGET_IDS.includes(review.targetId)
	);
	const staleTargetIds = reviews
		.filter((review) => {
			const entry = candidateEntries.find((candidate) => candidate.targetId === review.targetId);
			return !entry || entry.candidateHash !== review.candidateContentHash;
		})
		.map((review) => review.targetId)
		.toSorted();
	const reviewed = new Set(
		reviews
			.filter((review) => {
				const entry = candidateEntries.find((candidate) => candidate.targetId === review.targetId);
				const target = targetById.get(review.targetId);
				return (
					entry?.candidateHash === review.candidateContentHash &&
					target?.cohort === 'controlled' &&
					entry.speciesId === target.speciesId &&
					entry.affinity === target.affinity
				);
			})
			.map((review) => review.targetId)
	);
	const missingTargetIds = candidateEntries
		.map((entry) => entry.targetId)
		.filter((targetId) => !reviewed.has(targetId))
		.toSorted();
	const blockers: string[] = [];
	if (entries.length !== 24 || candidateEntries.length !== 21 || reviseEntries.length !== 3)
		blockers.push(
			`Baseline inventory must be exactly 24 targets, 21 candidates, and 3 revise results; found ${entries.length}/${candidateEntries.length}/${reviseEntries.length}.`
		);
	if (missingTargetIds.length)
		blockers.push(`${missingTargetIds.length} current baseline candidates remain unreviewed.`);
	if (staleTargetIds.length)
		blockers.push(`${staleTargetIds.length} baseline reviews are stale or noncandidate-bound.`);
	const quotedReviewer = shellQuote(reviewer);
	return {
		schemaVersion: 'baseline-blind-review-readiness-v1',
		reviewer,
		ready: blockers.length === 0,
		candidateCount: candidateEntries.length,
		reviseCount: reviseEntries.length,
		reviewedCurrentCandidateCount: reviewed.size,
		remainingCount: missingTargetIds.length,
		missingTargetIds,
		staleTargetIds,
		blockers,
		handoffCommands: [
			`pnpm export:affinity-review-evidence --reviewer ${quotedReviewer}`,
			'pnpm sync:affinity-review',
			'pnpm report:affinity-final-controlled-activation'
		]
	};
}

async function listJsonFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	return (
		await Promise.all(
			entries.map((entry) =>
				entry.isDirectory()
					? listJsonFiles(path.join(root, entry.name))
					: entry.isFile() && entry.name.endsWith('.json')
						? [path.join(root, entry.name)]
						: []
			)
		)
	).flat();
}

export async function reportBaselineBlindReviewReadiness(
	reviewer: string,
	workspaceRoot = process.cwd()
): Promise<BaselineBlindReviewReadinessReport> {
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const catalog = ImageProductionCatalogSchema.parse(
		JSON.parse(await readFile(path.join(experimentRoot, 'review/catalog.json'), 'utf8'))
	);
	const targetFiles = await listJsonFiles(path.join(experimentRoot, 'targets'));
	const targets = await Promise.all(
		targetFiles.map(async (file) =>
			ImageProductionTargetSchema.parse(JSON.parse(await readFile(file, 'utf8')))
		)
	);
	const reviews = await listAffinityWorkflowReviews(
		getConfig().databaseUrl,
		'affinity-workflow-v1'
	);
	return buildBaselineBlindReviewReadiness({ reviewer, reviewList: reviews, catalog, targets });
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const index = process.argv.indexOf('--reviewer');
	const reviewer = index >= 0 ? process.argv[index + 1] : undefined;
	if (!reviewer) {
		process.stderr.write('Usage: pnpm report:baseline-blind-review --reviewer <name>\n');
		process.exitCode = 1;
	} else {
		try {
			const report = await reportBaselineBlindReviewReadiness(reviewer);
			process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			if (!report.ready) process.exitCode = 1;
		} catch (error) {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		}
	}
}
