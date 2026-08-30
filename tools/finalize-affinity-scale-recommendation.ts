import { randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import { AFFINITY_EXPERIMENT_ROOT } from './image-production-lib.js';
import {
	inspectSchedulerEvidence,
	type EligibleSchedulerRun,
	type SchedulerEvidenceScan
} from './check-affinity-plan-completion.js';

export const AFFINITY_SCALE_RECOMMENDATION_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/scale-recommendation.json` as const;
export const REQUIRED_SCALE_RECOMMENDATION_LEVELS = [2, 4, 6, 8, 12] as const;

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPathSchema = z.string().trim().min(1);
const ConcurrencySchema = z.union([
	z.literal(2),
	z.literal(4),
	z.literal(6),
	z.literal(8),
	z.literal(12),
	z.literal(16)
]);
const StageSchema = z.enum(['canary', 'pilot', 'controlled', 'breadth', 'load', 'scale']);
const EXPECTED_STAGE_BY_LEVEL = {
	2: 'canary',
	4: 'pilot',
	6: 'controlled',
	8: 'breadth',
	12: 'load',
	16: 'scale'
} as const;

const SourceRunSchema = z
	.object({
		runId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
		stage: StageSchema,
		effectiveConcurrency: ConcurrencySchema,
		preflightPath: RepositoryPathSchema,
		preflightCanonicalSha256: HashSchema,
		reportPath: RepositoryPathSchema,
		reportCanonicalSha256: HashSchema
	})
	.strict();

const CompletedScaleEndpointSchema = z
	.object({
		kind: z.literal('completed-scale'),
		runId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
		preflightPath: RepositoryPathSchema,
		preflightCanonicalSha256: HashSchema,
		reportPath: RepositoryPathSchema,
		reportCanonicalSha256: HashSchema
	})
	.strict();

const BlockedScaleEndpointSchema = z
	.object({
		kind: z.literal('blocked-capacity'),
		runId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
		preflightPath: RepositoryPathSchema,
		preflightCanonicalSha256: HashSchema
	})
	.strict();

export const AffinityScaleRecommendationV3Schema = z
	.object({
		schemaVersion: z.literal('affinity-scale-recommendation-v3'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('final'),
		humanDecisionAcknowledged: z.literal(true),
		recommendedSafeConcurrency: ConcurrencySchema,
		sourceEffectiveConcurrencyLevels: z.array(ConcurrencySchema),
		sourceRuns: z.array(SourceRunSchema),
		scaleEndpointSource: z.discriminatedUnion('kind', [
			CompletedScaleEndpointSchema,
			BlockedScaleEndpointSchema
		]),
		productionStrategy: z.string().trim().min(1),
		fallbackBehavior: z.string().trim().min(1)
	})
	.strict()
	.superRefine((recommendation, context) => {
		const levels = recommendation.sourceEffectiveConcurrencyLevels;
		const sortedUniqueLevels = [...new Set(levels)].sort((left, right) => left - right);
		if (JSON.stringify(levels) !== JSON.stringify(sortedUniqueLevels)) {
			context.addIssue({
				code: 'custom',
				path: ['sourceEffectiveConcurrencyLevels'],
				message: 'Source levels must be unique and sorted'
			});
		}
		const expectedLevels =
			recommendation.scaleEndpointSource.kind === 'completed-scale'
				? [...REQUIRED_SCALE_RECOMMENDATION_LEVELS, 16]
				: [...REQUIRED_SCALE_RECOMMENDATION_LEVELS];
		if (JSON.stringify(levels) !== JSON.stringify(expectedLevels)) {
			context.addIssue({
				code: 'custom',
				path: ['sourceEffectiveConcurrencyLevels'],
				message: `Source levels must be exactly ${expectedLevels.join(', ')}`
			});
		}
		if (recommendation.sourceRuns.length !== levels.length) {
			context.addIssue({
				code: 'custom',
				path: ['sourceRuns'],
				message: 'Exactly one source run is required per source level'
			});
		}
		for (const level of levels) {
			const matches = recommendation.sourceRuns.filter((run) => run.effectiveConcurrency === level);
			if (matches.length !== 1) {
				context.addIssue({
					code: 'custom',
					path: ['sourceRuns'],
					message: `Expected exactly one source run at concurrency ${level}`
				});
			}
		}
		for (const [index, run] of recommendation.sourceRuns.entries()) {
			if (EXPECTED_STAGE_BY_LEVEL[run.effectiveConcurrency] !== run.stage) {
				context.addIssue({
					code: 'custom',
					path: ['sourceRuns', index, 'stage'],
					message: `Concurrency ${run.effectiveConcurrency} must use the ${EXPECTED_STAGE_BY_LEVEL[run.effectiveConcurrency]} stage`
				});
			}
		}
		for (const [field, values] of [
			['run IDs', recommendation.sourceRuns.map((run) => run.runId)],
			['preflight paths', recommendation.sourceRuns.map((run) => run.preflightPath)],
			['report paths', recommendation.sourceRuns.map((run) => run.reportPath)]
		] as const) {
			if (new Set(values).size !== values.length) {
				context.addIssue({
					code: 'custom',
					path: ['sourceRuns'],
					message: `Source ${field} must be unique`
				});
			}
		}
		if (!levels.includes(recommendation.recommendedSafeConcurrency)) {
			context.addIssue({
				code: 'custom',
				path: ['recommendedSafeConcurrency'],
				message: 'The recommendation must be one of the measured source levels'
			});
		}
		if (
			recommendation.recommendedSafeConcurrency === 16 &&
			recommendation.scaleEndpointSource.kind !== 'completed-scale'
		) {
			context.addIssue({
				code: 'custom',
				path: ['recommendedSafeConcurrency'],
				message: 'Concurrency 16 requires an eligible completed Scale run'
			});
		}
		if (recommendation.scaleEndpointSource.kind === 'completed-scale') {
			const endpoint = recommendation.scaleEndpointSource;
			const source = recommendation.sourceRuns.find((run) => run.effectiveConcurrency === 16);
			if (
				!source ||
				source.runId !== endpoint.runId ||
				source.preflightPath !== endpoint.preflightPath ||
				source.preflightCanonicalSha256 !== endpoint.preflightCanonicalSha256 ||
				source.reportPath !== endpoint.reportPath ||
				source.reportCanonicalSha256 !== endpoint.reportCanonicalSha256
			) {
				context.addIssue({
					code: 'custom',
					path: ['scaleEndpointSource'],
					message: 'Completed Scale endpoint must exactly match the measured 16-worker source run'
				});
			}
		}
	});

export type AffinityScaleRecommendationV3 = z.infer<typeof AffinityScaleRecommendationV3Schema>;

type ScaleEndpoint = AffinityScaleRecommendationV3['scaleEndpointSource'];

export interface AffinityScaleRecommendationReadiness {
	readonly schemaVersion: 'affinity-scale-recommendation-readiness-v1';
	readonly experimentId: 'affinity-workflow-v1';
	readonly ready: boolean;
	readonly requiredEffectiveConcurrencyLevels: readonly number[];
	readonly eligibleEffectiveConcurrencyLevels: readonly number[];
	readonly selectedSourceRuns: readonly EligibleSchedulerRun[];
	readonly scaleEndpointSource: ScaleEndpoint | null;
	readonly blockers: readonly string[];
}

function sortedRuns(runs: readonly EligibleSchedulerRun[]): EligibleSchedulerRun[] {
	return [...runs].sort(
		(left, right) =>
			left.effectiveConcurrency - right.effectiveConcurrency ||
			left.runId.localeCompare(right.runId)
	);
}

function completedEndpoint(run: EligibleSchedulerRun): ScaleEndpoint {
	return {
		kind: 'completed-scale',
		runId: run.runId,
		preflightPath: run.preflightPath,
		preflightCanonicalSha256: run.preflightCanonicalSha256,
		reportPath: run.reportPath,
		reportCanonicalSha256: run.reportCanonicalSha256
	};
}

/** Builds readiness only from evidence already accepted by the completion checker's strict scan. */
export function buildAffinityScaleRecommendationReadiness(
	evidence: SchedulerEvidenceScan
): AffinityScaleRecommendationReadiness {
	const blockers: string[] = [];
	const eligibleRuns = sortedRuns(evidence.eligibleRuns);
	const eligibleLevels = [...new Set(eligibleRuns.map((run) => run.effectiveConcurrency))].sort(
		(left, right) => left - right
	);
	for (const level of REQUIRED_SCALE_RECOMMENDATION_LEVELS) {
		if (!eligibleLevels.includes(level)) blockers.push(`missing-effective-level:${level}`);
	}
	for (const run of eligibleRuns) {
		const expectedStage =
			EXPECTED_STAGE_BY_LEVEL[run.effectiveConcurrency as keyof typeof EXPECTED_STAGE_BY_LEVEL];
		if (!expectedStage) blockers.push(`unexpected-effective-level:${run.effectiveConcurrency}`);
		else if (run.stage !== expectedStage)
			blockers.push(`stage-level-mismatch:${run.runId}:${run.stage}:${run.effectiveConcurrency}`);
	}
	const completedScale = eligibleRuns.find(
		(run) => run.stage === 'scale' && run.effectiveConcurrency === 16
	);
	const eligibleLoadRunIds = new Set(
		eligibleRuns
			.filter((run) => run.stage === 'load' && run.effectiveConcurrency === 12)
			.map((run) => run.runId)
	);
	const blockedScaleCandidates = [...evidence.blockedScalePreflights].sort((left, right) =>
		left.runId.localeCompare(right.runId)
	);
	const blockedScale = blockedScaleCandidates.find((preflight) =>
		preflight.prerequisiteRunIds.some((runId) => eligibleLoadRunIds.has(runId))
	);
	if (blockedScaleCandidates.length > 0 && !blockedScale) {
		blockers.push('blocked-scale-endpoint-missing-eligible-load-prerequisite');
	}
	const scaleEndpointSource: ScaleEndpoint | null = completedScale
		? completedEndpoint(completedScale)
		: blockedScale
			? {
					kind: 'blocked-capacity',
					runId: blockedScale.runId,
					preflightPath: blockedScale.preflightPath,
					preflightCanonicalSha256: blockedScale.preflightCanonicalSha256
				}
			: null;
	if (!scaleEndpointSource) blockers.push('missing-scale-endpoint');
	const expectedLevels = completedScale
		? [...REQUIRED_SCALE_RECOMMENDATION_LEVELS, 16]
		: [...REQUIRED_SCALE_RECOMMENDATION_LEVELS];
	for (const level of eligibleLevels) {
		if (!expectedLevels.includes(level as (typeof expectedLevels)[number]))
			blockers.push(`unexpected-effective-level:${level}`);
	}
	const selectedSourceRuns = expectedLevels
		.map((level) => eligibleRuns.find((run) => run.effectiveConcurrency === level))
		.filter((run): run is EligibleSchedulerRun => run !== undefined);
	return {
		schemaVersion: 'affinity-scale-recommendation-readiness-v1',
		experimentId: 'affinity-workflow-v1',
		ready: blockers.length === 0 && selectedSourceRuns.length === expectedLevels.length,
		requiredEffectiveConcurrencyLevels: REQUIRED_SCALE_RECOMMENDATION_LEVELS,
		eligibleEffectiveConcurrencyLevels: eligibleLevels,
		selectedSourceRuns,
		scaleEndpointSource,
		blockers: [...new Set(blockers)]
	};
}

export interface AffinityScaleRecommendationDecision {
	readonly recommendedSafeConcurrency: number;
	readonly humanDecisionAcknowledged: boolean;
	readonly productionStrategy: string;
	readonly fallbackBehavior: string;
}

export function buildAffinityScaleRecommendation(
	readiness: AffinityScaleRecommendationReadiness,
	decision: AffinityScaleRecommendationDecision
): AffinityScaleRecommendationV3 {
	if (!readiness.ready || !readiness.scaleEndpointSource) {
		throw new Error(`Scale recommendation is not ready: ${readiness.blockers.join(', ')}`);
	}
	if (!decision.humanDecisionAcknowledged) {
		throw new Error(
			'Writing a final recommendation requires explicit human decision acknowledgment.'
		);
	}
	return AffinityScaleRecommendationV3Schema.parse({
		schemaVersion: 'affinity-scale-recommendation-v3',
		experimentId: 'affinity-workflow-v1',
		status: 'final',
		humanDecisionAcknowledged: decision.humanDecisionAcknowledged,
		recommendedSafeConcurrency: decision.recommendedSafeConcurrency,
		sourceEffectiveConcurrencyLevels: readiness.selectedSourceRuns.map(
			(run) => run.effectiveConcurrency
		),
		sourceRuns: readiness.selectedSourceRuns,
		scaleEndpointSource: readiness.scaleEndpointSource,
		productionStrategy: decision.productionStrategy,
		fallbackBehavior: decision.fallbackBehavior
	});
}

function recommendationEvidenceBlockers(
	recommendation: AffinityScaleRecommendationV3,
	evidence: SchedulerEvidenceScan
): string[] {
	const blockers: string[] = [];
	for (const source of recommendation.sourceRuns) {
		const bound = evidence.eligibleRuns.some(
			(run) =>
				run.runId === source.runId &&
				run.stage === source.stage &&
				run.effectiveConcurrency === source.effectiveConcurrency &&
				run.preflightPath === source.preflightPath &&
				run.preflightCanonicalSha256 === source.preflightCanonicalSha256 &&
				run.reportPath === source.reportPath &&
				run.reportCanonicalSha256 === source.reportCanonicalSha256
		);
		if (!bound) blockers.push(`source-run-not-eligible-or-stale:${source.runId}`);
	}
	const endpoint = recommendation.scaleEndpointSource;
	const endpointBound =
		endpoint.kind === 'completed-scale'
			? evidence.eligibleRuns.some(
					(run) =>
						run.stage === 'scale' &&
						run.effectiveConcurrency === 16 &&
						run.runId === endpoint.runId &&
						run.preflightPath === endpoint.preflightPath &&
						run.preflightCanonicalSha256 === endpoint.preflightCanonicalSha256 &&
						run.reportPath === endpoint.reportPath &&
						run.reportCanonicalSha256 === endpoint.reportCanonicalSha256
				)
			: evidence.blockedScalePreflights.some(
					(preflight) =>
						preflight.runId === endpoint.runId &&
						preflight.preflightPath === endpoint.preflightPath &&
						preflight.preflightCanonicalSha256 === endpoint.preflightCanonicalSha256
				);
	if (!endpointBound) blockers.push('scale-endpoint-not-eligible-or-stale');
	return blockers;
}

async function readExistingRecommendation(filePath: string): Promise<unknown | null> {
	try {
		const metadata = await lstat(filePath);
		if (!metadata.isFile() || metadata.isSymbolicLink()) {
			throw new Error('Scale recommendation output must be a regular, non-symlink file.');
		}
		const text = await readFile(filePath, 'utf8');
		try {
			return JSON.parse(text) as unknown;
		} catch {
			return text;
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

async function writeJsonNoOverwriteOrIdempotent(
	filePath: string,
	value: unknown
): Promise<'written' | 'idempotent'> {
	const serialized = `${JSON.stringify(value, null, '\t')}\n`;
	const existing = await readExistingRecommendation(filePath);
	if (existing !== null) {
		if (JSON.stringify(existing) === JSON.stringify(value)) return 'idempotent';
		throw new Error(
			'Scale recommendation already exists with different content; refusing to overwrite.'
		);
	}
	await mkdir(path.dirname(filePath), { recursive: true });
	const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, serialized, { encoding: 'utf8', flag: 'wx' });
		try {
			await link(temporary, filePath);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			const raced = await readExistingRecommendation(filePath);
			if (raced === null || JSON.stringify(raced) !== JSON.stringify(value)) {
				throw new Error(
					'Scale recommendation was created concurrently with different content; refusing to overwrite.',
					{ cause: error }
				);
			}
			return 'idempotent';
		}
		return 'written';
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}

export interface FinalizeAffinityScaleRecommendationOptions {
	readonly workspaceRoot?: string;
	readonly mode?: 'check' | 'write';
	readonly decision?: AffinityScaleRecommendationDecision;
	/** Test and integration seam; production callers should allow the strict workspace scan. */
	readonly schedulerEvidence?: SchedulerEvidenceScan;
}

export interface FinalizeAffinityScaleRecommendationReport {
	readonly schemaVersion: 'affinity-scale-recommendation-finalization-v1';
	readonly mode: 'check' | 'write';
	readonly outputPath: typeof AFFINITY_SCALE_RECOMMENDATION_PATH;
	readonly readyForHumanDecision: boolean;
	readonly artifactPresent: boolean;
	readonly artifactValid: boolean;
	readonly inSync: boolean;
	readonly written: boolean;
	readonly idempotent: boolean;
	readonly blockers: readonly string[];
	readonly readiness: AffinityScaleRecommendationReadiness;
}

export async function finalizeAffinityScaleRecommendation(
	options: FinalizeAffinityScaleRecommendationOptions = {}
): Promise<FinalizeAffinityScaleRecommendationReport> {
	const workspaceRoot = options.workspaceRoot ?? process.cwd();
	const mode = options.mode ?? 'check';
	const evidence = options.schedulerEvidence ?? (await inspectSchedulerEvidence(workspaceRoot));
	const readiness = buildAffinityScaleRecommendationReadiness(evidence);
	const outputFile = path.resolve(workspaceRoot, AFFINITY_SCALE_RECOMMENDATION_PATH);
	const existingInput = await readExistingRecommendation(outputFile);
	const existing = AffinityScaleRecommendationV3Schema.safeParse(existingInput);
	const blockers = [...readiness.blockers];
	if (existingInput !== null && !existing.success) blockers.push('existing-artifact-invalid');
	if (existing.success) blockers.push(...recommendationEvidenceBlockers(existing.data, evidence));

	let desired: AffinityScaleRecommendationV3 | null = null;
	if (mode === 'write') {
		if (!options.decision?.humanDecisionAcknowledged)
			blockers.push('human-decision-not-acknowledged');
		if (!options.decision) blockers.push('missing-recommendation-decision');
		if (readiness.ready && options.decision?.humanDecisionAcknowledged) {
			const parsed = AffinityScaleRecommendationV3Schema.safeParse({
				schemaVersion: 'affinity-scale-recommendation-v3',
				experimentId: 'affinity-workflow-v1',
				status: 'final',
				humanDecisionAcknowledged: true,
				recommendedSafeConcurrency: options.decision.recommendedSafeConcurrency,
				sourceEffectiveConcurrencyLevels: readiness.selectedSourceRuns.map(
					(run) => run.effectiveConcurrency
				),
				sourceRuns: readiness.selectedSourceRuns,
				scaleEndpointSource: readiness.scaleEndpointSource,
				productionStrategy: options.decision.productionStrategy,
				fallbackBehavior: options.decision.fallbackBehavior
			});
			if (parsed.success) desired = parsed.data;
			else
				blockers.push(
					...parsed.error.issues.map((issue) => `invalid-decision:${issue.path.join('.')}`)
				);
		}
	}

	let written = false;
	let idempotent = false;
	if (mode === 'write' && blockers.length === 0 && desired) {
		try {
			const result = await writeJsonNoOverwriteOrIdempotent(outputFile, desired);
			written = result === 'written';
			idempotent = result === 'idempotent';
		} catch (error) {
			blockers.push(
				error instanceof Error ? error.message : 'Failed to write the scale recommendation.'
			);
		}
	}
	const artifactPresent = existingInput !== null || written;
	const artifactValid =
		written ||
		(existing.success && recommendationEvidenceBlockers(existing.data, evidence).length === 0);
	return {
		schemaVersion: 'affinity-scale-recommendation-finalization-v1',
		mode,
		outputPath: AFFINITY_SCALE_RECOMMENDATION_PATH,
		readyForHumanDecision: readiness.ready,
		artifactPresent,
		artifactValid,
		inSync: readiness.ready && artifactValid && blockers.length === 0,
		written,
		idempotent,
		blockers: [...new Set(blockers)],
		readiness
	};
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const args = process.argv.slice(2);
	const mode = args.includes('--write') ? 'write' : 'check';
	const recommended = option(args, '--recommended');
	const productionStrategy = option(args, '--production-strategy');
	const fallbackBehavior = option(args, '--fallback-behavior');
	const decision =
		mode === 'write'
			? {
					recommendedSafeConcurrency: Number(recommended),
					humanDecisionAcknowledged: args.includes('--acknowledge-human-decision'),
					productionStrategy: productionStrategy ?? '',
					fallbackBehavior: fallbackBehavior ?? ''
				}
			: undefined;
	const report = await finalizeAffinityScaleRecommendation({
		mode,
		...(decision ? { decision } : {})
	});
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (!report.inSync) process.exitCode = 1;
}
