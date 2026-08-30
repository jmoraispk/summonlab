import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	verifyFinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';
import {
	AffinityReviewRoundIdSchema,
	AffinityRoundIntegrationReceiptSchema,
	affinityRoundAggregatePaths,
	affinityRoundRoot,
	loadAffinityReviewRoundRegistry,
	sha256Bytes,
	type AffinityReviewRoundId
} from './affinity-review-round-lib.js';
import {
	AffinityRoundBlindReviewCollectionSchema,
	loadVerifiedAffinityReviewRound,
	roundBlindReviewPath
} from './affinity-round-postgeneration-lib.js';
import {
	AffinityWaveDispatchGateSchema,
	canonicalJsonSha256,
	deriveBreadthCanaryPromotionEvidence,
	deriveSchedulerWavePromotionEvidence,
	type AffinityWavePromotionEvidence
} from './affinity-wave-scheduler-lib.js';
import {
	inspectSchedulerEvidence,
	type EligibleSchedulerRun,
	type SchedulerEvidenceScan
} from './check-affinity-plan-completion.js';
import {
	AffinityRoundFinalEvaluationReceiptSchema,
	AffinityRoundFinalEvaluationSchema,
	deriveAffinityRoundFinalEvaluation
} from './finalize-affinity-round-evaluation.js';
import { AFFINITY_EXPERIMENT_ROOT, sha256Json } from './image-production-lib.js';
import { FinalControlledRerunPlanSchema } from './prepare-final-controlled-rerun.js';

const HashSchema = z.string().regex(/^[a-f0-9]{64}$/u);
const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const RepositoryPathSchema = z
	.string()
	.min(1)
	.refine((value) => !path.posix.isAbsolute(value) && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine(
		(value) =>
			value.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..'),
		{ message: 'Repository paths must be contained' }
	);

const NORMAL_DRY_RUN_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/dry-runs/goblin-normal-envelope-preflight-v2.json` as const;
const FINAL_PLAN_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json` as const;

export const AffinityDispatchGateRequestSchema = z.discriminatedUnion('profile', [
	z.object({ profile: z.literal('normal-canary') }).strict(),
	z.object({ profile: z.literal('final-canary') }).strict(),
	z
		.object({
			profile: z.literal('breadth'),
			prerequisiteRunId: SlugSchema
		})
		.strict(),
	z
		.object({
			profile: z.literal('load'),
			requestedConcurrency: z.union([z.literal(4), z.literal(6), z.literal(12), z.literal(16)]),
			prerequisiteRunId: SlugSchema
		})
		.strict()
]);
export type AffinityDispatchGateRequest = z.infer<typeof AffinityDispatchGateRequestSchema>;

const DryRunEvidenceSchema = z
	.object({
		schemaVersion: z.literal('image-production-dry-run-evidence-v1'),
		dryRunId: z.literal('affinity-workflow-v1-goblin-normal-envelope-preflight-v2'),
		experimentId: z.literal('affinity-workflow-v1'),
		recordedAt: z.iso.datetime(),
		workflow: z.literal('summonlab-image-production'),
		target: z
			.object({
				path: RepositoryPathSchema,
				targetId: z.literal('affinity-workflow-v1-goblin-normal'),
				contentHash: HashSchema
			})
			.strict(),
		assignment: z
			.object({
				path: RepositoryPathSchema,
				assignmentId: z.literal('dry-run-assignment-affinity-workflow-v1-goblin-normal'),
				contentHash: HashSchema,
				dryRun: z.literal(true),
				retryCeiling: z.literal(0)
			})
			.strict(),
		preflight: z
			.object({
				validator: z.string().min(1),
				status: z.literal('pass'),
				referenceCount: z.number().int().positive(),
				referencesPresentAndHashMatched: z.literal(true),
				pathsContainedAndNormalized: z.literal(true),
				targetAssignmentIdsMatch: z.literal(true),
				outputsAbsent: z.literal(true)
			})
			.strict(),
		canonicalPrompt: z
			.object({
				renderer: z.string().min(1),
				protocol: z.literal('safe-frame-v4'),
				byteLength: z.number().int().positive(),
				contentHash: HashSchema,
				submittedToGenerator: z.literal(false)
			})
			.strict(),
		ownedOutputs: z
			.object({
				candidatePath: RepositoryPathSchema,
				resultPath: RepositoryPathSchema,
				candidateCreated: z.literal(false),
				resultCreated: z.literal(false)
			})
			.strict(),
		completion: z
			.object({
				generationCallCount: z.literal(0),
				persistenceCallCount: z.literal(0),
				sharedFilesEdited: z.literal(false),
				selfPromoted: z.literal(false),
				status: z.literal('pass')
			})
			.strict()
	})
	.strict();

export interface VerifiedDispatchEvidenceBinding {
	readonly path: string;
	readonly canonicalSha256: string;
}

export interface DerivedAffinityDispatchGateEvidence {
	readonly bindings: readonly VerifiedDispatchEvidenceBinding[];
	readonly prerequisiteRun: EligibleSchedulerRun | null;
	readonly promotionEvidence: AffinityWavePromotionEvidence | null;
}

function requestStage(request: AffinityDispatchGateRequest) {
	if (request.profile === 'normal-canary' || request.profile === 'final-canary') return 'canary';
	if (request.profile === 'breadth') return 'breadth';
	return {
		4: 'pilot',
		6: 'controlled',
		12: 'load',
		16: 'scale'
	}[request.requestedConcurrency] as 'pilot' | 'controlled' | 'load' | 'scale';
}

function expectedPredecessor(request: AffinityDispatchGateRequest): {
	readonly stage: EligibleSchedulerRun['stage'];
	readonly concurrency: number;
} | null {
	if (request.profile === 'normal-canary' || request.profile === 'final-canary') return null;
	if (request.profile === 'breadth') return { stage: 'controlled', concurrency: 6 };
	return (
		{
			4: { stage: 'canary', concurrency: 2 },
			6: { stage: 'pilot', concurrency: 4 },
			12: { stage: 'breadth', concurrency: 8 },
			16: { stage: 'load', concurrency: 12 }
		} as const
	)[request.requestedConcurrency];
}

function gateId(request: AffinityDispatchGateRequest): string {
	if (request.profile === 'normal-canary') return 'normal-canary-dispatch-v2';
	if (request.profile === 'final-canary') return 'final-controlled-canary-dispatch-v2';
	const suffix = createHash('sha256').update(request.prerequisiteRunId).digest('hex').slice(0, 12);
	return request.profile === 'breadth'
		? `breadth-after-${suffix}-dispatch-v2`
		: `load-${request.requestedConcurrency}-after-${suffix}-dispatch-v2`;
}

/** Pure gate construction; production callers receive evidence only from the strict resolver below. */
export function buildDerivedAffinityDispatchGate(
	requestInput: unknown,
	evidence: DerivedAffinityDispatchGateEvidence
) {
	const request = AffinityDispatchGateRequestSchema.parse(requestInput);
	const predecessor = expectedPredecessor(request);
	if (predecessor === null && evidence.prerequisiteRun !== null)
		throw new Error(`${request.profile} must not bind a scheduler prerequisite.`);
	if (predecessor === null && evidence.promotionEvidence !== null)
		throw new Error(`${request.profile} must not claim predecessor promotion evidence.`);
	if (predecessor !== null) {
		if (!('prerequisiteRunId' in request))
			throw new Error(`${request.profile} cannot name a scheduler prerequisite.`);
		const run = evidence.prerequisiteRun;
		if (
			!run ||
			run.runId !== request.prerequisiteRunId ||
			run.stage !== predecessor.stage ||
			run.effectiveConcurrency !== predecessor.concurrency
		)
			throw new Error(
				`${request.profile} requires an eligible ${predecessor.stage}-${predecessor.concurrency} predecessor.`
			);
		if (
			!evidence.promotionEvidence ||
			evidence.promotionEvidence.sourceRunId !== run.runId ||
			evidence.promotionEvidence.sourceStage !== run.stage ||
			evidence.promotionEvidence.sourceEffectiveConcurrency !== run.effectiveConcurrency ||
			evidence.promotionEvidence.sourceReportPath !== run.reportPath ||
			evidence.promotionEvidence.sourceReportCanonicalSha256 !== run.reportCanonicalSha256
		)
			throw new Error(
				`${request.profile} requires exact hash-bound predecessor promotion evidence.`
			);
		if ((request.profile === 'breadth') !== (evidence.promotionEvidence.breadthCanaries !== null))
			throw new Error('Only Breadth promotion requires the two exact breadth canaries.');
	}
	const bindings = [...evidence.bindings].sort((left, right) =>
		left.path.localeCompare(right.path)
	);
	if (bindings.length === 0) throw new Error('A derived dispatch gate requires verified evidence.');
	if (new Set(bindings.map((binding) => binding.path)).size !== bindings.length)
		throw new Error('Derived evidence binding paths must be unique.');
	return AffinityWaveDispatchGateSchema.parse({
		schemaVersion: 'affinity-wave-dispatch-gate-v2',
		gateId: gateId(request),
		experimentId: 'affinity-workflow-v1',
		status: 'authorized',
		authorizedStage: requestStage(request),
		qualityGateSatisfied: true,
		humanGateSatisfied: request.profile !== 'normal-canary',
		prerequisiteRunIds: evidence.prerequisiteRun ? [evidence.prerequisiteRun.runId] : [],
		derivation: request,
		promotionEvidence: evidence.promotionEvidence,
		evidenceBindings: bindings
	});
}

interface VerifiedJson<T> {
	readonly path: string;
	readonly value: T;
	readonly canonicalSha256: string;
	readonly bytes: Buffer;
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	RepositoryPathSchema.parse(repositoryPath);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error(`Repository path escapes workspace: ${repositoryPath}`);
	return absolute;
}

async function readVerifiedJson<T>(
	workspaceRoot: string,
	repositoryPath: string,
	schema: z.ZodType<T>
): Promise<VerifiedJson<T>> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	let cursor = path.resolve(workspaceRoot);
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	const bytes = await readFile(absolute);
	const value = schema.parse(JSON.parse(bytes.toString('utf8')));
	return { path: repositoryPath, value, canonicalSha256: canonicalJsonSha256(value), bytes };
}

async function readVerifiedBytes(workspaceRoot: string, repositoryPath: string): Promise<Buffer> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	let cursor = path.resolve(workspaceRoot);
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	return readFile(absolute);
}

function binding<T>(artifact: VerifiedJson<T>): VerifiedDispatchEvidenceBinding {
	return { path: artifact.path, canonicalSha256: artifact.canonicalSha256 };
}

async function verifyNormalDryRun(
	workspaceRoot: string
): Promise<VerifiedDispatchEvidenceBinding[]> {
	const dryRun = await readVerifiedJson(workspaceRoot, NORMAL_DRY_RUN_PATH, DryRunEvidenceSchema);
	const target = await readVerifiedJson(
		workspaceRoot,
		dryRun.value.target.path,
		ImageProductionTargetSchema
	);
	const assignment = await readVerifiedJson(
		workspaceRoot,
		dryRun.value.assignment.path,
		ImageProductionAssignmentSchema
	);
	if (
		sha256Bytes(target.bytes) !== dryRun.value.target.contentHash ||
		sha256Bytes(assignment.bytes) !== dryRun.value.assignment.contentHash ||
		target.value.targetId !== dryRun.value.target.targetId ||
		assignment.value.assignmentId !== dryRun.value.assignment.assignmentId ||
		assignment.value.targetId !== target.value.targetId ||
		assignment.value.dryRun !== true ||
		assignment.value.retryCeiling !== 0 ||
		assignment.value.permittedOutputs.candidatePath !== dryRun.value.ownedOutputs.candidatePath ||
		assignment.value.permittedOutputs.resultPath !== dryRun.value.ownedOutputs.resultPath
	)
		throw new Error('Normal canary dry-run bindings are stale or inconsistent.');
	for (const reference of target.value.references) {
		const bytes = await readVerifiedBytes(workspaceRoot, reference.path);
		if (sha256Bytes(bytes) !== reference.contentHash)
			throw new Error(`Normal canary reference is stale: ${reference.path}`);
	}
	return [binding(dryRun), binding(target), binding(assignment)];
}

async function verifyFinalCanaryReadiness(
	workspaceRoot: string
): Promise<VerifiedDispatchEvidenceBinding[]> {
	const plan = await readVerifiedJson(
		workspaceRoot,
		FINAL_PLAN_PATH,
		FinalControlledRerunPlanSchema
	);
	const activation = await verifyFinalControlledActivationReceipt(
		workspaceRoot,
		plan.canonicalSha256
	);
	if (!activation.valid || !activation.receipt)
		throw new Error(`Final activation is not verified: ${activation.issues.join('; ')}`);
	const receipt = await readVerifiedJson(
		workspaceRoot,
		FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
		z.unknown()
	);
	if (sha256Json(activation.receipt) !== receipt.canonicalSha256)
		throw new Error('Final activation receipt changed during verification.');
	const registry = await loadAffinityReviewRoundRegistry(workspaceRoot, 'final-controlled-v1');
	if (
		registry.entries.length !== 24 ||
		registry.activationReceiptCanonicalSha256 !== receipt.canonicalSha256
	)
		throw new Error('Final-controlled round readiness is not exact or receipt-bound.');
	return [
		binding(plan),
		binding(receipt),
		...registry.entries.flatMap((entry) => [
			{ path: entry.targetPath, canonicalSha256: sha256Json(entry.target) },
			{ path: entry.assignmentPath, canonicalSha256: sha256Json(entry.assignment) }
		])
	];
}

async function verifyPassedRound(
	workspaceRoot: string,
	roundId: AffinityReviewRoundId
): Promise<VerifiedDispatchEvidenceBinding[]> {
	AffinityReviewRoundIdSchema.parse(roundId);
	const verifiedRound = await loadVerifiedAffinityReviewRound(workspaceRoot, roundId);
	const aggregatePaths = affinityRoundAggregatePaths(roundId);
	const evaluationPath = `${affinityRoundRoot(roundId)}/final-evaluation.json`;
	const finalReceiptPath = `${affinityRoundRoot(roundId)}/final-evaluation-receipt.json`;
	const blindPath = roundBlindReviewPath(roundId);
	const [integration, blindReviews, evaluation, finalReceipt] = await Promise.all([
		readVerifiedJson(workspaceRoot, aggregatePaths.receipt, AffinityRoundIntegrationReceiptSchema),
		readVerifiedJson(workspaceRoot, blindPath, AffinityRoundBlindReviewCollectionSchema),
		readVerifiedJson(workspaceRoot, evaluationPath, AffinityRoundFinalEvaluationSchema),
		readVerifiedJson(workspaceRoot, finalReceiptPath, AffinityRoundFinalEvaluationReceiptSchema)
	]);
	const derived = await deriveAffinityRoundFinalEvaluation(workspaceRoot, roundId);
	if (
		!derived.eligible ||
		derived.evaluation === null ||
		sha256Json(derived.evaluation) !== evaluation.canonicalSha256 ||
		integration.canonicalSha256 !== verifiedRound.integrationReceiptCanonicalSha256 ||
		blindReviews.value.roundId !== roundId ||
		blindReviews.value.integrationReceiptCanonicalSha256 !== integration.canonicalSha256 ||
		evaluation.value.roundId !== roundId ||
		evaluation.value.integrationReceiptCanonicalSha256 !== integration.canonicalSha256 ||
		evaluation.value.blindReviewCanonicalSha256 !== blindReviews.canonicalSha256 ||
		finalReceipt.value.roundId !== roundId ||
		finalReceipt.value.integrationReceiptCanonicalSha256 !== integration.canonicalSha256 ||
		finalReceipt.value.blindReviewCanonicalSha256 !== blindReviews.canonicalSha256 ||
		finalReceipt.value.evaluationPath !== evaluationPath ||
		finalReceipt.value.evaluationCanonicalSha256 !== evaluation.canonicalSha256 ||
		finalReceipt.value.evaluationByteSha256 !== sha256Bytes(evaluation.bytes)
	)
		throw new Error(`${roundId} passed evaluation bindings are stale or inconsistent.`);
	return [
		binding(integration),
		binding(blindReviews),
		binding(evaluation),
		binding(finalReceipt),
		...verifiedRound.receipt.aggregates.map((aggregate) => ({
			path: aggregate.path,
			canonicalSha256: aggregate.canonicalSha256
		})),
		...verifiedRound.receipt.evidence.flatMap((entry) => [
			{ path: entry.targetPath, canonicalSha256: entry.targetCanonicalSha256 },
			{ path: entry.assignmentPath, canonicalSha256: entry.assignmentCanonicalSha256 },
			{ path: entry.resultPath, canonicalSha256: entry.resultCanonicalSha256 }
		])
	];
}

function selectPrerequisiteRun(
	request: AffinityDispatchGateRequest,
	schedulerEvidence: SchedulerEvidenceScan
): EligibleSchedulerRun | null {
	const expected = expectedPredecessor(request);
	if (expected === null) return null;
	if (!('prerequisiteRunId' in request))
		throw new Error(`${request.profile} cannot name a scheduler prerequisite.`);
	const run = schedulerEvidence.eligibleRuns.find(
		(candidate) =>
			candidate.runId === request.prerequisiteRunId &&
			candidate.stage === expected.stage &&
			candidate.effectiveConcurrency === expected.concurrency
	);
	if (!run)
		throw new Error(
			`Eligible ${expected.stage}-${expected.concurrency} prerequisite ${request.prerequisiteRunId} is unavailable.`
		);
	return run;
}

function schedulerBindings(run: EligibleSchedulerRun): VerifiedDispatchEvidenceBinding[] {
	return [
		{ path: run.preflightPath, canonicalSha256: run.preflightCanonicalSha256 },
		{ path: run.reportPath, canonicalSha256: run.reportCanonicalSha256 }
	];
}

export interface AffinityDispatchGateResolution {
	readonly request: AffinityDispatchGateRequest;
	readonly eligible: boolean;
	readonly blockers: readonly string[];
	readonly gate: z.infer<typeof AffinityWaveDispatchGateSchema> | null;
	readonly outputPath: string;
}

export async function resolveAffinityDispatchGate(
	workspaceRoot: string,
	requestInput: unknown
): Promise<AffinityDispatchGateResolution> {
	const request = AffinityDispatchGateRequestSchema.parse(requestInput);
	try {
		let bindings: VerifiedDispatchEvidenceBinding[];
		let prerequisiteRun: EligibleSchedulerRun | null = null;
		let promotionEvidence: AffinityWavePromotionEvidence | null = null;
		if (request.profile === 'normal-canary') {
			bindings = await verifyNormalDryRun(workspaceRoot);
		} else if (request.profile === 'final-canary') {
			bindings = await verifyFinalCanaryReadiness(workspaceRoot);
		} else {
			const schedulerEvidence = await inspectSchedulerEvidence(workspaceRoot);
			prerequisiteRun = selectPrerequisiteRun(request, schedulerEvidence);
			if (!prerequisiteRun) throw new Error('A non-canary gate requires a prerequisite run.');
			bindings = schedulerBindings(prerequisiteRun);
			const promotion = await deriveSchedulerWavePromotionEvidence(workspaceRoot, {
				runId: prerequisiteRun.runId,
				stage: prerequisiteRun.stage as 'canary' | 'pilot' | 'controlled' | 'breadth' | 'load',
				effectiveConcurrency: prerequisiteRun.effectiveConcurrency as 2 | 4 | 6 | 8 | 12,
				reportPath: prerequisiteRun.reportPath,
				reportCanonicalSha256: prerequisiteRun.reportCanonicalSha256
			});
			promotionEvidence = promotion.evidence;
			bindings.push(...promotion.bindings);
			if (request.profile === 'breadth') {
				bindings.push(...(await verifyPassedRound(workspaceRoot, 'final-controlled-v1')));
				const canaries = await deriveBreadthCanaryPromotionEvidence(workspaceRoot);
				bindings.push(...canaries.bindings);
				promotionEvidence = {
					...promotionEvidence,
					breadthCanaries: canaries.evidence
				};
			} else if ([4, 6].includes(request.requestedConcurrency)) {
				bindings.push(...(await verifyFinalCanaryReadiness(workspaceRoot)));
			}
		}
		const gate = buildDerivedAffinityDispatchGate(request, {
			bindings,
			prerequisiteRun,
			promotionEvidence
		});
		return {
			request,
			eligible: true,
			blockers: [],
			gate,
			outputPath: `${AFFINITY_EXPERIMENT_ROOT}/review/gates/${gate.gateId}.json`
		};
	} catch (error) {
		return {
			request,
			eligible: false,
			blockers: [error instanceof Error ? error.message : String(error)],
			gate: null,
			outputPath: `${AFFINITY_EXPERIMENT_ROOT}/review/gates/${gateId(request)}.json`
		};
	}
}

async function readCurrentText(filePath: string): Promise<string | null> {
	try {
		const metadata = await lstat(filePath);
		if (!metadata.isFile() || metadata.isSymbolicLink())
			throw new Error(`Dispatch gate output is not a regular file: ${filePath}`);
		return readFile(filePath, 'utf8');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	}
}

async function publishExclusiveOrExact(
	filePath: string,
	text: string
): Promise<'written' | 'exact'> {
	const current = await readCurrentText(filePath);
	if (current !== null) {
		if (current === text) return 'exact';
		throw new Error('Existing dispatch gate differs; refusing to overwrite.');
	}
	await mkdir(path.dirname(filePath), { recursive: true });
	const temporary = `${filePath}.tmp-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, text, { flag: 'wx' });
		try {
			await link(temporary, filePath);
			return 'written';
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			if ((await readCurrentText(filePath)) !== text)
				throw new Error('A different dispatch gate was published concurrently.', { cause: error });
			return 'exact';
		}
	} finally {
		await unlink(temporary).catch(() => undefined);
	}
}

export interface AffinityDispatchGateWriteReport extends AffinityDispatchGateResolution {
	readonly mode: 'check' | 'write';
	readonly artifactPresent: boolean;
	readonly inSync: boolean;
	readonly written: boolean;
	readonly idempotent: boolean;
}

export async function writeAffinityDispatchGate(options: {
	readonly workspaceRoot?: string;
	readonly request: unknown;
	readonly mode?: 'check' | 'write';
}): Promise<AffinityDispatchGateWriteReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const mode = options.mode ?? 'check';
	const resolution = await resolveAffinityDispatchGate(workspaceRoot, options.request);
	const destination = resolveRepositoryPath(workspaceRoot, resolution.outputPath);
	const expectedText = resolution.gate ? `${JSON.stringify(resolution.gate, null, '\t')}\n` : null;
	const current = await readCurrentText(destination);
	let inSync = expectedText !== null && current === expectedText;
	let written = false;
	let idempotent = false;
	const blockers = [...resolution.blockers];
	if (current !== null && expectedText !== current)
		blockers.push('Existing dispatch gate differs; refusing to overwrite.');
	if (mode === 'write' && resolution.eligible && expectedText !== null && blockers.length === 0) {
		const result = await publishExclusiveOrExact(destination, expectedText);
		written = result === 'written';
		idempotent = result === 'exact';
		inSync = true;
	}
	return {
		...resolution,
		eligible: resolution.eligible && blockers.length === 0,
		blockers: [...new Set(blockers)],
		mode,
		artifactPresent: current !== null || written,
		inSync,
		written,
		idempotent
	};
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

function parseCliRequest(args: readonly string[]): AffinityDispatchGateRequest {
	const profile = option(args, '--profile');
	if (profile === 'normal') return { profile: 'normal-canary' };
	if (profile === 'final') return { profile: 'final-canary' };
	if (profile === 'breadth')
		return AffinityDispatchGateRequestSchema.parse({
			profile: 'breadth',
			prerequisiteRunId: option(args, '--prerequisite-run')
		});
	if (profile === 'load')
		return AffinityDispatchGateRequestSchema.parse({
			profile: 'load',
			requestedConcurrency: Number(option(args, '--concurrency')),
			prerequisiteRunId: option(args, '--prerequisite-run')
		});
	throw new Error('Expected --profile normal|final|breadth|load.');
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const args = process.argv.slice(2);
	const report = await writeAffinityDispatchGate({
		request: parseCliRequest(args),
		mode: args.includes('--write') ? 'write' : 'check'
	});
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (!report.inSync) process.exitCode = 1;
}
