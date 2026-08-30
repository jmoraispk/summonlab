import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionEvaluationSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionCatalogEntry,
	type ImageProductionResult,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import {
	GOBLIN_AFFINITY_AUDIT_60,
	GOBLIN_AFFINITY_AUDIT_600
} from '../packages/content/src/index.js';
import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	canonicalJson,
	createAffinityWorkflowExportBundle,
	sha256Json,
	validateAffinityWorkflowDefinitions
} from './image-production-lib.js';
import {
	AFFINITY_CONTACT_SHEET_HEIGHT,
	AFFINITY_CONTACT_SHEET_PATH,
	AFFINITY_CONTACT_SHEET_WIDTH
} from './export-affinity-contact-sheet.js';
import {
	FinalControlledRerunPlanSchema,
	buildFinalControlledRerunBundle,
	summarizeUnresolvedDesignRisks
} from './prepare-final-controlled-rerun.js';
import {
	AffinityWaveAllocationSpecSchema,
	AffinityWavePlanSchema,
	AffinityWavePreflightSchema,
	nextDispatchDecision
} from './affinity-wave-scheduler-lib.js';
import sharp from 'sharp';
import { z } from 'zod';

const GoblinAuditSchema = z
	.object({
		version: z.literal('goblin-affinity-audit-v1'),
		seed: z.string().min(1),
		sampleSize: z.union([z.literal(60), z.literal(600)]),
		coverage: z.array(
			z
				.object({
					axis: z.string().min(1),
					expectedValues: z.number().int().positive(),
					observedValues: z.number().int().positive(),
					minimumCount: z.number().int().nonnegative(),
					requiredMinimumCount: z.number().int().positive(),
					passed: z.boolean()
				})
				.strict()
		),
		correlations: z.array(
			z
				.object({
					leftAxis: z.literal('affinityId'),
					rightAxis: z.string().min(1),
					biasCorrectedCramersV: z.number().nonnegative(),
					maximumAllowed: z.number().positive(),
					passed: z.boolean()
				})
				.strict()
		),
		gates: z
			.object({
				coveragePassed: z.literal(true),
				correlationPassed: z.literal(true),
				passed: z.literal(true)
			})
			.strict()
	})
	.strict();

export function canonicalGoblinAuditMatches(input: unknown, sampleSize: 60 | 600): boolean {
	const parsed = GoblinAuditSchema.safeParse(input);
	if (!parsed.success || parsed.data.sampleSize !== sampleSize) return false;
	const expected = sampleSize === 60 ? GOBLIN_AFFINITY_AUDIT_60 : GOBLIN_AFFINITY_AUDIT_600;
	return canonicalJson(parsed.data) === canonicalJson(expected);
}

const DryRunEvidenceSchema = z
	.object({
		schemaVersion: z.literal('image-production-dry-run-evidence-v2'),
		dryRunId: z.literal('affinity-workflow-v1-goblin-normal-envelope-preflight-v4'),
		experimentId: z.literal('affinity-workflow-v1'),
		workflow: z.literal('summonlab-image-production'),
		executor: z.literal('fresh-bounded-subagent'),
		skill: z
			.object({
				installedPath: z.literal('/home/joao/.codex/skills/summonlab-image-production'),
				resolvedRepositoryPath: z.literal('skills/summonlab-image-production'),
				digestAlgorithm: z.literal('sha256-framed-source-tree-v2'),
				fileCount: z.number().int().positive(),
				contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
			})
			.strict(),
		target: z
			.object({
				path: z.string().min(1),
				targetId: z.literal('affinity-workflow-v1-goblin-normal'),
				contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
			})
			.strict(),
		assignment: z
			.object({
				path: z.string().min(1),
				assignmentId: z.literal('dry-run-assignment-affinity-workflow-v1-goblin-normal'),
				contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
				dryRun: z.literal(true),
				retryCeiling: z.literal(0)
			})
			.strict(),
		preflight: z
			.object({
				validator: z.literal('skills/summonlab-image-production/scripts/validate_target.py'),
				status: z.literal('pass'),
				report: z.record(z.string(), z.unknown()),
				referenceCount: z.number().int().positive(),
				referencesPresentAndHashMatched: z.literal(true),
				pathsContainedAndNormalized: z.literal(true),
				targetAssignmentIdsMatch: z.literal(true),
				outputsAbsent: z.literal(true)
			})
			.strict(),
		canonicalPrompt: z
			.object({
				renderer: z.literal('skills/summonlab-image-production/scripts/render_prompt.py'),
				protocol: z.literal('safe-frame-v4'),
				byteLength: z.number().int().positive(),
				contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
				terminalLineFeed: z.boolean(),
				submittedToGenerator: z.literal(false)
			})
			.strict(),
		references: z.array(
			z
				.object({
					path: z.string().min(1),
					contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
					width: z.number().int().positive(),
					height: z.number().int().positive(),
					inspectedAtOriginalDetail: z.literal(true)
				})
				.strict()
		),
		ownedOutputs: z
			.object({
				candidatePath: z.string().min(1),
				resultPath: z.string().min(1),
				candidateCreated: z.literal(false),
				resultCreated: z.literal(false)
			})
			.strict(),
		completion: z
			.object({
				generationCallCount: z.literal(0),
				persistenceCallCount: z.literal(0),
				filesEditedByExecutor: z.literal(0),
				sharedFilesEdited: z.literal(false),
				selfPromoted: z.literal(false),
				status: z.literal('pass')
			})
			.strict(),
		recordedAt: z.iso.datetime()
	})
	.strict();

const execFileAsync = promisify(execFile);

async function hashFramedTree(root: string): Promise<{ fileCount: number; contentHash: string }> {
	const files = (await listFiles(root)).filter(
		(file) => !file.includes(`${path.sep}__pycache__${path.sep}`) && !file.endsWith('.pyc')
	);
	const hash = createHash('sha256');
	for (const file of files) {
		const relative = path.relative(root, file).split(path.sep).join('/');
		const bytes = await readFile(file);
		const byteLength = Buffer.alloc(8);
		byteLength.writeBigUInt64BE(BigInt(bytes.byteLength));
		hash.update(relative);
		hash.update('\0');
		hash.update(byteLength);
		hash.update(bytes);
	}
	return { fileCount: files.length, contentHash: hash.digest('hex') };
}

async function listFiles(root: string): Promise<string[]> {
	const files: string[] = [];
	for (const entry of await readdir(root, { withFileTypes: true }).catch(() => [])) {
		const filePath = path.join(root, entry.name);
		if (entry.isDirectory()) files.push(...(await listFiles(filePath)));
		else files.push(filePath);
	}
	return files.sort();
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function assertExactPaths(
	actual: readonly string[],
	expected: ReadonlySet<string>,
	label: string
): void {
	const actualSet = new Set(actual);
	const missing = [...expected].find((expectedPath) => !actualSet.has(expectedPath));
	if (missing) throw new Error(`Missing ${label}: ${missing}`);
	const unexpected = actual.find((actualPath) => !expected.has(actualPath));
	if (unexpected) throw new Error(`Unexpected ${label}: ${unexpected}`);
}

function selectedOutput(result: ImageProductionResult) {
	return result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output;
}

function latestOutput(result: ImageProductionResult) {
	return [...result.attempts].reverse().find((attempt) => attempt.output)?.output ?? null;
}

async function verifyImage(
	workspaceRoot: string,
	output: NonNullable<ReturnType<typeof latestOutput>>
): Promise<void> {
	const bytes = await readFile(path.resolve(workspaceRoot, output.path));
	if (bytes.byteLength !== output.bytes)
		throw new Error(`Image byte count changed: ${output.path}`);
	if (sha256(bytes) !== output.contentHash) throw new Error(`Image hash changed: ${output.path}`);
	const metadata = await sharp(bytes).metadata();
	const mediaType =
		metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
	if (
		metadata.width !== output.width ||
		metadata.height !== output.height ||
		mediaType !== output.mediaType
	) {
		throw new Error(`Image metadata does not match its result record: ${output.path}`);
	}
}

function verifyCatalogEntry(
	entry: ImageProductionCatalogEntry,
	target: ImageProductionTarget,
	result: ImageProductionResult
): void {
	if (
		entry.targetId !== target.targetId ||
		entry.resultId !== result.resultId ||
		entry.assignmentId !== result.assignmentId ||
		entry.speciesId !== target.speciesId ||
		entry.affinity !== target.affinity ||
		entry.cohort !== target.cohort ||
		entry.status !== result.status
	) {
		throw new Error(`Catalog entry does not match its target/result: ${entry.targetId}`);
	}
	const output = selectedOutput(result);
	if (result.status === 'candidate') {
		if (entry.candidatePath !== output?.path || entry.candidateHash !== output.contentHash) {
			throw new Error(`Catalog candidate provenance is stale: ${entry.targetId}`);
		}
	}
}

export interface AffinityWorkflowValidationSummary {
	readonly targets: number;
	readonly assignments: number;
	readonly references: number;
	readonly results: number;
	readonly images: number;
	readonly catalogEntries: number;
	readonly blindReviews: number;
	readonly controlledContactSheet: boolean;
	readonly dryRunEvidence: boolean;
	readonly finalControlledRerunPlan: boolean;
	readonly capacityPreflight: boolean;
	readonly concurrencyAllocation: boolean;
	readonly evaluationStatus: 'incomplete' | 'passed' | 'failed';
}

export async function validateAffinityWorkflowWorkspace(
	workspaceRoot = process.cwd()
): Promise<AffinityWorkflowValidationSummary> {
	const exportBundle = createAffinityWorkflowExportBundle();
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const expectedTargetPaths = new Set(
		exportBundle.artifacts
			.filter((artifact) => artifact.path.includes('/targets/'))
			.map((artifact) => path.resolve(workspaceRoot, artifact.path))
	);
	const expectedAssignmentPaths = new Set(
		exportBundle.artifacts
			.filter((artifact) => artifact.path.includes('/assignments/'))
			.map((artifact) => path.resolve(workspaceRoot, artifact.path))
	);
	const targetFiles = await listFiles(path.join(experimentRoot, 'targets'));
	const assignmentFiles = await listFiles(path.join(experimentRoot, 'assignments'));
	assertExactPaths(targetFiles, expectedTargetPaths, 'target manifest');
	assertExactPaths(assignmentFiles, expectedAssignmentPaths, 'assignment manifest');
	const targets = await Promise.all(
		targetFiles.map(async (file) => ImageProductionTargetSchema.parse(await readJson(file)))
	);
	const assignments = await Promise.all(
		assignmentFiles.map(async (file) => ImageProductionAssignmentSchema.parse(await readJson(file)))
	);
	validateAffinityWorkflowDefinitions(targets, assignments);
	const targetsById = new Map(targets.map((target) => [target.targetId, target]));
	const assignmentsById = new Map(
		assignments.map((assignment) => [assignment.assignmentId, assignment])
	);
	let dryRunEvidence = false;
	if (targets.length === 60) {
		const evidence = DryRunEvidenceSchema.parse(
			await readJson(path.join(experimentRoot, 'dry-runs/goblin-normal-envelope-preflight-v4.json'))
		);
		const installedSkillRoot = path.resolve(evidence.skill.installedPath);
		const repositorySkillRoot = path.resolve(workspaceRoot, evidence.skill.resolvedRepositoryPath);
		const dryAssignment = ImageProductionAssignmentSchema.parse(
			await readJson(path.resolve(workspaceRoot, evidence.assignment.path))
		);
		const [installedSkillDigest, repositorySkillDigest] = await Promise.all([
			hashFramedTree(installedSkillRoot),
			hashFramedTree(repositorySkillRoot)
		]);
		const outputsAbsent = await Promise.all(
			[evidence.ownedOutputs.candidatePath, evidence.ownedOutputs.resultPath].map((relative) =>
				readFile(path.resolve(workspaceRoot, relative)).then(
					() => false,
					() => true
				)
			)
		);
		if (outputsAbsent[0] !== outputsAbsent[1]) {
			throw new Error('Dry-run-owned production outputs are only partially present.');
		}
		// The preflight validator is intentionally collision-sensitive. Re-run it while the job is
		// unstarted; after production, preserve its hash-bound historical report and let the strict
		// result/candidate validation below prove the completed execution.
		const validatorReport = outputsAbsent.every(Boolean)
			? (JSON.parse(
					(
						await execFileAsync(
							'python3',
							[
								path.resolve(workspaceRoot, evidence.preflight.validator),
								path.resolve(workspaceRoot, evidence.target.path),
								path.resolve(workspaceRoot, evidence.assignment.path),
								workspaceRoot
							],
							{ encoding: 'utf8' }
						)
					).stdout
				) as unknown)
			: evidence.preflight.report;
		const prompt = await execFileAsync(
			'python3',
			[
				path.resolve(workspaceRoot, evidence.canonicalPrompt.renderer),
				path.resolve(workspaceRoot, evidence.target.path)
			],
			{ encoding: 'buffer' }
		);
		const promptBytes = Buffer.from(prompt.stdout);
		const referencesCurrent = await Promise.all(
			evidence.references.map(async (reference) => {
				const bytes = await readFile(path.resolve(workspaceRoot, reference.path));
				const metadata = await sharp(bytes).metadata();
				return (
					sha256(bytes) === reference.contentHash &&
					metadata.width === reference.width &&
					metadata.height === reference.height
				);
			})
		);
		if (
			sha256(await readFile(path.resolve(workspaceRoot, evidence.target.path))) !==
				evidence.target.contentHash ||
			sha256(await readFile(path.resolve(workspaceRoot, evidence.assignment.path))) !==
				evidence.assignment.contentHash ||
			dryAssignment.dryRun !== true ||
			dryAssignment.targetId !== evidence.target.targetId ||
			dryAssignment.permittedOutputs.candidatePath !== evidence.ownedOutputs.candidatePath ||
			dryAssignment.permittedOutputs.resultPath !== evidence.ownedOutputs.resultPath ||
			installedSkillDigest.fileCount !== evidence.skill.fileCount ||
			installedSkillDigest.contentHash !== evidence.skill.contentHash ||
			canonicalJson(installedSkillDigest) !== canonicalJson(repositorySkillDigest) ||
			canonicalJson(validatorReport) !== canonicalJson(evidence.preflight.report) ||
			promptBytes.byteLength !== evidence.canonicalPrompt.byteLength ||
			sha256(promptBytes) !== evidence.canonicalPrompt.contentHash ||
			(promptBytes.at(-1) === 10) !== evidence.canonicalPrompt.terminalLineFeed ||
			referencesCurrent.some((current) => !current) ||
			evidence.preflight.referenceCount !== evidence.references.length
		) {
			throw new Error('Fresh-agent dry-run evidence is stale or cannot be reproduced.');
		}
		dryRunEvidence = true;
	}
	let finalControlledRerunPlan = false;
	let capacityPreflight = false;
	let concurrencyAllocation = false;
	if (targets.length === 60) {
		const plan = FinalControlledRerunPlanSchema.parse(
			await readJson(path.join(experimentRoot, 'review/final-controlled-rerun-plan.json'))
		);
		buildFinalControlledRerunBundle(plan, targets);
		const designRisks = summarizeUnresolvedDesignRisks(plan);
		if (
			designRisks.unresolvedBlockingRiskCount !== 8 ||
			designRisks.unresolvedBlockingCoordinateCount !== 8 ||
			designRisks.unresolvedNonblockingRiskCount !== 8
		) {
			throw new Error(
				'Final controlled rerun plan must retain all audited pending design risks before activation.'
			);
		}
		const targetKeys = plan.targets.map((target) => target.key);
		const waveKeys = plan.fallbackExecution.waves.flat();
		const coordinates = plan.targets.map((target) => `${target.speciesId}:${target.affinity}`);
		if (
			new Set(targetKeys).size !== 24 ||
			new Set(waveKeys).size !== 24 ||
			new Set(coordinates).size !== 24 ||
			!targetKeys.every((key) => waveKeys.includes(key))
		) {
			throw new Error(
				'Final controlled rerun plan must schedule 24 unique coordinates exactly once.'
			);
		}
		for (const target of plan.targets) {
			for (const template of Object.values(plan.plannedPathTemplates)) {
				const plannedPath = template
					.replace('{speciesId}', target.speciesId)
					.replace('{affinity}', target.affinity)
					.replace('{version}', target.version);
				try {
					await readFile(path.resolve(workspaceRoot, plannedPath));
					throw new Error(`Planned final controlled output already exists: ${plannedPath}`);
				} catch (error) {
					if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
				}
			}
		}
		finalControlledRerunPlan = true;

		const capacityPlan = AffinityWavePlanSchema.parse(
			await readJson(
				path.join(experimentRoot, 'review/wave-plans/pilot-current-task-capacity-v1.json')
			)
		);
		const preflight = AffinityWavePreflightSchema.parse(
			await readJson(
				path.join(experimentRoot, 'wave-runs/pilot-current-task-capacity-v1/preflight.json')
			)
		);
		const expectedCapacityEvidence = {
			runId: 'pilot-current-task-capacity-v1',
			stage: 'pilot',
			requestedConcurrency: 4,
			availableAgentSlots: 4,
			reservedOrchestratorSlots: 1,
			admittedWorkerCapacity: 3,
			exactConcurrencyReady: false,
			status: 'blocked-capacity'
		} as const;
		for (const [field, expected] of Object.entries(expectedCapacityEvidence)) {
			if (preflight[field as keyof typeof preflight] !== expected) {
				throw new Error(`Capacity preflight ${field} no longer matches the observed pilot.`);
			}
		}
		if (
			capacityPlan.runId !== preflight.runId ||
			capacityPlan.stage !== preflight.stage ||
			capacityPlan.requestedConcurrency !== preflight.requestedConcurrency ||
			capacityPlan.runDirectory !== preflight.runDirectory ||
			capacityPlan.jobs.length !== preflight.jobs.length ||
			preflight.collisionPaths.length !== 0
		) {
			throw new Error('Capacity preflight no longer matches its scheduler plan.');
		}
		for (const [index, job] of capacityPlan.jobs.entries()) {
			const resolvedJob = preflight.jobs[index];
			if (
				resolvedJob?.targetPath !== job.targetPath ||
				resolvedJob.assignmentPath !== job.assignmentPath
			) {
				throw new Error('Capacity preflight job order or manifest binding changed.');
			}
		}
		const stopDecision = nextDispatchDecision(preflight, []);
		if (
			!stopDecision.stop ||
			stopDecision.reason !== 'capacity-preflight-blocked' ||
			stopDecision.launchTargetIds.length !== 0
		) {
			throw new Error('Capacity preflight must stop before dispatching any image job.');
		}
		const runFiles = await listFiles(path.resolve(workspaceRoot, preflight.runDirectory));
		assertExactPaths(
			runFiles,
			new Set([path.resolve(workspaceRoot, preflight.runDirectory, 'preflight.json')]),
			'capacity preflight artifact'
		);
		capacityPreflight = true;

		const allocation = AffinityWaveAllocationSpecSchema.parse(
			await readJson(
				path.join(experimentRoot, 'review/wave-plans/exact-concurrency-final-and-breadth-v1.json')
			)
		);
		if (
			allocation.allocationId !== 'exact-concurrency-final-and-breadth-v1' ||
			allocation.status !== 'gated' ||
			allocation.executable !== false ||
			allocation.futureSentinelCount !== 14
		) {
			throw new Error('Exact-concurrency allocation must remain gated and non-executable.');
		}
		concurrencyAllocation = true;
	}
	const references = new Map<string, string>();
	for (const target of targets) {
		for (const reference of target.references) {
			const previousHash = references.get(reference.path);
			if (previousHash && previousHash !== reference.contentHash) {
				throw new Error(`Conflicting declared hashes for reference ${reference.path}`);
			}
			references.set(reference.path, reference.contentHash);
		}
	}
	for (const [referencePath, expectedHash] of references) {
		const bytes = await readFile(path.resolve(workspaceRoot, referencePath));
		if (sha256(bytes) !== expectedHash) throw new Error(`Reference hash changed: ${referencePath}`);
	}

	const allowedResultPaths = new Set(
		targets.map((target) => path.resolve(workspaceRoot, target.output.resultPath))
	);
	const resultFiles = await listFiles(path.join(experimentRoot, 'results'));
	const unexpectedResult = resultFiles.find((file) => !allowedResultPaths.has(file));
	if (unexpectedResult) throw new Error(`Unexpected result record: ${unexpectedResult}`);
	const results: ImageProductionResult[] = [];
	for (const resultFile of resultFiles) {
		const result = ImageProductionResultSchema.parse(await readJson(resultFile));
		const target = targetsById.get(result.targetId);
		const assignment = assignmentsById.get(result.assignmentId);
		if (!target || !assignment)
			throw new Error(`Result has unknown target or assignment: ${resultFile}`);
		if (path.resolve(workspaceRoot, target.output.resultPath) !== resultFile) {
			throw new Error(`Result is stored at the wrong path: ${resultFile}`);
		}
		validateImageProductionExecution({ target, assignment, result });
		results.push(result);
	}
	const resultsById = new Map(results.map((result) => [result.resultId, result]));
	const resultsByTargetId = new Map(results.map((result) => [result.targetId, result]));
	if (resultsById.size !== results.length || resultsByTargetId.size !== results.length) {
		throw new Error('Result and target IDs must be unique across partial results');
	}

	const candidateFiles = await listFiles(path.join(experimentRoot, 'candidates'));
	const allowedCandidatePaths = new Set(
		targets.map((target) => path.resolve(workspaceRoot, target.output.candidatePath))
	);
	const unexpectedCandidate = candidateFiles.find((file) => !allowedCandidatePaths.has(file));
	if (unexpectedCandidate) throw new Error(`Unexpected candidate image: ${unexpectedCandidate}`);
	for (const candidateFile of candidateFiles) {
		const target = targets.find(
			(candidate) => path.resolve(workspaceRoot, candidate.output.candidatePath) === candidateFile
		);
		const result = target ? resultsByTargetId.get(target.targetId) : undefined;
		const output = result ? latestOutput(result) : null;
		if (
			!target ||
			!result ||
			!output ||
			path.resolve(workspaceRoot, output.path) !== candidateFile
		) {
			throw new Error(`Candidate image has no matching result provenance: ${candidateFile}`);
		}
		await verifyImage(workspaceRoot, output);
	}
	for (const result of results) {
		const output = latestOutput(result);
		if (output && !candidateFiles.includes(path.resolve(workspaceRoot, output.path))) {
			throw new Error(`Result output image is missing: ${output.path}`);
		}
	}

	const catalog = ImageProductionCatalogSchema.parse(
		await readJson(path.join(experimentRoot, 'review/catalog.json'))
	);
	if (catalog.experimentId !== exportBundle.catalog.experimentId) {
		throw new Error('Catalog belongs to the wrong experiment');
	}
	for (const entry of catalog.entries) {
		const target = targetsById.get(entry.targetId);
		const result = resultsById.get(entry.resultId);
		if (!target || !result)
			throw new Error(`Catalog entry has no target/result: ${entry.targetId}`);
		verifyCatalogEntry(entry, target, result);
	}

	const blindReviews = ImageProductionBlindReviewCollectionSchema.parse(
		await readJson(path.join(experimentRoot, 'review/blind-review.json'))
	);
	for (const review of blindReviews.reviews) {
		const target = targetsById.get(review.targetId);
		const entry = catalog.entries.find((candidate) => candidate.targetId === review.targetId);
		if (!target || !entry || entry.status !== 'candidate') {
			throw new Error(`Blind review has no cataloged candidate: ${review.targetId}`);
		}
		if (
			review.speciesCorrect !== (review.identifiedSpeciesId === target.speciesId) ||
			review.affinityCorrect !== (review.identifiedAffinity === target.affinity)
		) {
			throw new Error(`Blind review correctness flags are stale: ${review.reviewId}`);
		}
	}

	const evaluation = ImageProductionEvaluationSchema.parse(
		await readJson(path.join(experimentRoot, 'review/evaluation.json'))
	);
	if (evaluation.catalogHash !== sha256Json(catalog)) {
		throw new Error('Evaluation catalog hash is stale');
	}
	if (canonicalJson(evaluation.blindReviews) !== canonicalJson(blindReviews.reviews)) {
		throw new Error('Evaluation blind reviews do not match the review aggregate');
	}
	const catalogedResults = catalog.entries.map((entry) => resultsById.get(entry.resultId)!);
	const controlledResults = catalogedResults.filter(
		(result) => targetsById.get(result.targetId)?.cohort === 'controlled'
	);
	let controlledContactSheet = false;
	if (controlledResults.length === 24) {
		const contactSheetPath = path.resolve(workspaceRoot, AFFINITY_CONTACT_SHEET_PATH);
		const contactSheet = await sharp(await readFile(contactSheetPath)).metadata();
		if (
			contactSheet.format !== 'png' ||
			contactSheet.width !== AFFINITY_CONTACT_SHEET_WIDTH ||
			contactSheet.height !== AFFINITY_CONTACT_SHEET_HEIGHT
		) {
			throw new Error('Controlled contact sheet must be the deterministic 1920×1080 PNG.');
		}
		controlledContactSheet = true;
	}
	const controlledReviews = blindReviews.reviews.filter(
		(review) => targetsById.get(review.targetId)?.cohort === 'controlled'
	);
	const firstAttemptCandidateCount = controlledResults.filter(
		(result) =>
			result.status === 'candidate' && result.selectedAttemptId === result.attempts[0]?.attemptId
	).length;
	const speciesCorrectCount = controlledReviews.filter((review) => review.speciesCorrect).length;
	const affinityCorrectCount = controlledReviews.filter((review) => review.affinityCorrect).length;
	const normalUnaffiliatedCount = controlledReviews.filter(
		(review) => review.affinityCorrect && targetsById.get(review.targetId)?.affinity === 'normal'
	).length;
	const acceptedMeaningfulAffinityCount = catalog.entries.filter((entry) => {
		const target = targetsById.get(entry.targetId);
		return (
			target?.cohort === 'controlled' &&
			target.affinity !== 'normal' &&
			entry.reviewState === 'accepted'
		);
	}).length;
	const acceptedCriticalVisualFailureCount = catalog.entries.filter((entry) => {
		if (entry.reviewState !== 'accepted') return false;
		const result = resultsById.get(entry.resultId);
		const attempt = result?.attempts.find(
			(candidate) => candidate.attemptId === result.selectedAttemptId
		);
		return (
			attempt?.findings.some(
				(finding) =>
					finding.outcome === 'fail' &&
					['anatomy', 'canvas-completion', 'framing', 'silhouette'].includes(finding.category)
			) ?? false
		);
	}).length;
	const expectedControlled = {
		targetCount: 24,
		firstAttemptCandidateCount,
		speciesCorrectCount,
		affinityCorrectCount,
		normalUnaffiliatedCount,
		acceptedMeaningfulAffinityCount,
		acceptedCriticalVisualFailureCount
	};
	if (canonicalJson(evaluation.controlled) !== canonicalJson(expectedControlled)) {
		throw new Error('Evaluation controlled counters are stale');
	}
	if (
		evaluation.workflow.completedTargetCount !== catalog.entries.length ||
		evaluation.workflow.completeProvenanceCount !== catalog.entries.length
	) {
		throw new Error('Evaluation workflow completion counters are stale');
	}

	for (const [sampleSize, filename] of [
		[60, 'goblin-audit-60.json'],
		[600, 'goblin-audit-600.json']
	] as const) {
		const audit = GoblinAuditSchema.parse(
			await readJson(path.join(experimentRoot, 'review', filename))
		);
		if (!canonicalGoblinAuditMatches(audit, sampleSize)) {
			throw new Error(`Goblin audit ${filename} is not the exact deterministic audit`);
		}
	}

	const schemaFiles = await listFiles(path.join(experimentRoot, 'schemas'));
	const expectedSchemaPaths = new Set(
		exportBundle.artifacts
			.filter((artifact) => artifact.path.includes('/schemas/'))
			.map((artifact) => path.resolve(workspaceRoot, artifact.path))
	);
	assertExactPaths(schemaFiles, expectedSchemaPaths, 'JSON schema');
	await Promise.all(schemaFiles.map((file) => readJson(file)));

	return {
		targets: targets.length,
		assignments: assignments.length,
		references: references.size,
		results: results.length,
		images: candidateFiles.length,
		catalogEntries: catalog.entries.length,
		blindReviews: blindReviews.reviews.length,
		controlledContactSheet,
		dryRunEvidence,
		finalControlledRerunPlan,
		capacityPreflight,
		concurrencyAllocation,
		evaluationStatus: evaluation.status
	};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const summary = await validateAffinityWorkflowWorkspace();
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}
