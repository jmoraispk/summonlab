import { randomUUID } from 'node:crypto';
import { readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
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

import {
	AFFINITY_EXPERIMENT_ROOT,
	AFFINITY_EXPORT_TIMESTAMP,
	ImageProductionBlindReviewCollectionSchema,
	type ImageProductionBlindReviewCollection
} from './image-production-lib.js';

const EXPERIMENT_ID = 'affinity-workflow-v1' as const;
const CATALOG_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json` as const;
const BLIND_REVIEW_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/blind-review.json` as const;
const TARGETS_PATH = `${AFFINITY_EXPERIMENT_ROOT}/targets` as const;

export type AffinityReviewEvidenceMode = 'check' | 'write';

export interface AffinityReviewEvidenceCliOptions {
	readonly mode: AffinityReviewEvidenceMode;
	readonly reviewer: string;
}

export interface AffinityReviewEvidenceExportReport {
	readonly mode: AffinityReviewEvidenceMode;
	readonly reviewer: string;
	readonly selectedReviewCount: number;
	readonly written: boolean;
	readonly inSync: boolean;
	readonly outputPath: typeof BLIND_REVIEW_PATH;
}

export type AffinityReviewListLoader = (
	databaseUrl: string,
	experimentId: typeof EXPERIMENT_ID
) => Promise<AffinityWorkflowReviewList>;

export class AffinityReviewEvidenceBindingError extends Error {
	public readonly code = 'AFFINITY_REVIEW_EVIDENCE_BINDING_ERROR';

	public constructor(message: string) {
		super(message);
		this.name = 'AffinityReviewEvidenceBindingError';
	}
}

function jsonText(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

function newestReviewedAt(reviews: readonly { reviewedAt: string }[]): string {
	if (reviews.length === 0) return AFFINITY_EXPORT_TIMESTAMP;
	return reviews.reduce(
		(latest, review) =>
			Date.parse(review.reviewedAt) > Date.parse(latest) ? review.reviewedAt : latest,
		reviews[0]!.reviewedAt
	);
}

/**
 * Selects one reviewer's latest record per target and binds it to current,
 * unpromoted candidate evidence. Correctness is derived from target truth,
 * never trusted from a client or database record.
 */
export function buildAffinityBlindReviewEvidence(input: {
	readonly reviewer: string;
	readonly reviewList: AffinityWorkflowReviewList;
	readonly catalog: ImageProductionCatalog;
	readonly targets: readonly ImageProductionTarget[];
}): ImageProductionBlindReviewCollection {
	const reviewer = input.reviewer.trim();
	if (reviewer.length === 0) throw new Error('Reviewer must not be blank.');
	const reviewList = AffinityWorkflowReviewListSchema.parse(input.reviewList);
	const catalog = ImageProductionCatalogSchema.parse(input.catalog);
	const targets = input.targets.map((target) => ImageProductionTargetSchema.parse(target));
	if (reviewList.experimentId !== EXPERIMENT_ID || catalog.experimentId !== EXPERIMENT_ID) {
		throw new AffinityReviewEvidenceBindingError(
			'Review history and catalog must belong to affinity-workflow-v1.'
		);
	}

	const targetsById = new Map<string, ImageProductionTarget>();
	for (const target of targets) {
		if (target.experimentId !== EXPERIMENT_ID) {
			throw new AffinityReviewEvidenceBindingError(
				`Target ${target.targetId} belongs to another experiment.`
			);
		}
		if (targetsById.has(target.targetId)) {
			throw new AffinityReviewEvidenceBindingError(`Duplicate target truth: ${target.targetId}.`);
		}
		targetsById.set(target.targetId, target);
	}
	const catalogByTarget = new Map(catalog.entries.map((entry) => [entry.targetId, entry]));
	const selected = reviewList.latestByTargetReviewer
		.filter((review) => review.reviewer === reviewer && review.reviewMode === 'blind')
		.sort((left, right) => left.targetId.localeCompare(right.targetId));

	const reviews = selected.map((review) => {
		const target = targetsById.get(review.targetId);
		if (!target) {
			throw new AffinityReviewEvidenceBindingError(
				`Review ${review.reviewId} references unknown target ${review.targetId}.`
			);
		}
		const candidate = catalogByTarget.get(review.targetId);
		if (
			!candidate ||
			candidate.status !== 'candidate' ||
			candidate.candidateHash === null ||
			candidate.candidatePath === null
		) {
			throw new AffinityReviewEvidenceBindingError(
				`Review ${review.reviewId} references target ${review.targetId}, which is not a current candidate.`
			);
		}
		if (candidate.speciesId !== target.speciesId || candidate.affinity !== target.affinity) {
			throw new AffinityReviewEvidenceBindingError(
				`Catalog identity for ${review.targetId} does not match immutable target truth.`
			);
		}
		if (candidate.candidateHash !== review.candidateContentHash) {
			throw new AffinityReviewEvidenceBindingError(
				`Review ${review.reviewId} is stale for ${review.targetId}: its candidate hash is not current.`
			);
		}
		return {
			reviewId: review.reviewId,
			targetId: review.targetId,
			candidateContentHash: review.candidateContentHash,
			reviewer: review.reviewer,
			reviewMode: review.reviewMode,
			reviewedAt: review.reviewedAt,
			identifiedSpeciesId: review.identifiedSpeciesId,
			identifiedAffinity: review.identifiedAffinity,
			speciesCorrect: review.identifiedSpeciesId === target.speciesId,
			affinityCorrect: review.identifiedAffinity === target.affinity,
			scores: review.scores,
			verdict: review.verdict,
			note: review.note
		};
	});

	return ImageProductionBlindReviewCollectionSchema.parse({
		schemaVersion: 'image-production-blind-reviews-v1',
		experimentId: EXPERIMENT_ID,
		updatedAt: newestReviewedAt(reviews),
		reviews
	});
}

async function listJsonFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const paths = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(root, entry.name);
			if (entry.isDirectory()) return listJsonFiles(entryPath);
			return entry.isFile() && entry.name.endsWith('.json') ? [entryPath] : [];
		})
	);
	return paths.flat().sort((left, right) => left.localeCompare(right));
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

async function readCurrentEvidenceContext(workspaceRoot: string): Promise<{
	readonly catalog: ImageProductionCatalog;
	readonly targets: readonly ImageProductionTarget[];
}> {
	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.resolve(workspaceRoot, CATALOG_PATH))
	);
	const targetFiles = await listJsonFiles(path.resolve(workspaceRoot, TARGETS_PATH));
	if (targetFiles.length === 0)
		throw new Error('No affinity workflow target manifests were found.');
	const targets = await Promise.all(
		targetFiles.map(async (targetPath) =>
			ImageProductionTargetSchema.parse(await readJson(targetPath))
		)
	);
	return { catalog, targets };
}

async function atomicWriteBlindReview(destination: string, value: unknown): Promise<void> {
	const temporary = `${destination}.export-${process.pid}-${randomUUID()}.tmp`;
	try {
		await writeFile(temporary, jsonText(value), { encoding: 'utf8', flag: 'wx' });
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
}

export async function exportAffinityReviewEvidence(input: {
	readonly workspaceRoot?: string;
	readonly databaseUrl: string;
	readonly reviewer: string;
	readonly mode: AffinityReviewEvidenceMode;
	readonly loadReviews?: AffinityReviewListLoader;
}): Promise<AffinityReviewEvidenceExportReport> {
	const workspaceRoot = path.resolve(input.workspaceRoot ?? process.cwd());
	const reviewer = input.reviewer.trim();
	if (reviewer.length === 0) throw new Error('An explicit non-blank --reviewer is required.');
	const loadReviews =
		input.loadReviews ??
		((databaseUrl, experimentId) => listAffinityWorkflowReviews(databaseUrl, experimentId));

	let reviewList: AffinityWorkflowReviewList;
	try {
		reviewList = AffinityWorkflowReviewListSchema.parse(
			await loadReviews(input.databaseUrl, EXPERIMENT_ID)
		);
	} catch (error) {
		throw new Error(
			`Affinity review database is unavailable or returned invalid evidence; ${BLIND_REVIEW_PATH} was not changed: ${error instanceof Error ? error.message : String(error)}`,
			{ cause: error }
		);
	}

	const { catalog, targets } = await readCurrentEvidenceContext(workspaceRoot);
	const evidence = buildAffinityBlindReviewEvidence({ reviewer, reviewList, catalog, targets });
	const outputPath = path.resolve(workspaceRoot, BLIND_REVIEW_PATH);
	const expected = jsonText(evidence);
	const current = await readFile(outputPath, 'utf8').catch(() => null);
	if (input.mode === 'write' && evidence.reviews.length === 0 && current !== null) {
		const currentEvidence = ImageProductionBlindReviewCollectionSchema.parse(JSON.parse(current));
		if (currentEvidence.reviews.length > 0) {
			throw new Error(
				`Reviewer ${reviewer} has no current reviews; refusing to erase ${currentEvidence.reviews.length} existing review records.`
			);
		}
	}
	const alreadyInSync = current === expected;
	let written = false;
	if (input.mode === 'write' && !alreadyInSync) {
		await atomicWriteBlindReview(outputPath, evidence);
		written = true;
	}
	return {
		mode: input.mode,
		reviewer,
		selectedReviewCount: evidence.reviews.length,
		written,
		inSync: alreadyInSync || written,
		outputPath: BLIND_REVIEW_PATH
	};
}

export function parseAffinityReviewEvidenceArgs(
	args: readonly string[]
): AffinityReviewEvidenceCliOptions {
	let mode: AffinityReviewEvidenceMode | undefined;
	let reviewer: string | undefined;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === '--check' || argument === '--write') {
			if (mode) throw new Error('Specify exactly one of --check or --write.');
			mode = argument === '--write' ? 'write' : 'check';
			continue;
		}
		if (argument === '--reviewer') {
			if (reviewer !== undefined) throw new Error('Specify --reviewer exactly once.');
			reviewer = args[index + 1]?.trim();
			index += 1;
			if (!reviewer || reviewer.startsWith('--')) {
				throw new Error('An explicit non-blank --reviewer <name> is required.');
			}
			continue;
		}
		throw new Error(`Unknown argument: ${argument ?? ''}`);
	}
	if (!mode) throw new Error('Specify exactly one of --check or --write.');
	if (!reviewer) throw new Error('An explicit non-blank --reviewer <name> is required.');
	return { mode, reviewer };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const options = parseAffinityReviewEvidenceArgs(process.argv.slice(2));
		const report = await exportAffinityReviewEvidence({
			databaseUrl: getConfig().databaseUrl,
			reviewer: options.reviewer,
			mode: options.mode
		});
		process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
		if (options.mode === 'check' && !report.inSync) process.exitCode = 1;
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	}
}
