import { randomUUID } from 'node:crypto';
import { lstat, link, mkdir, open, readFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionCatalog,
	type ImageProductionCatalogEntry,
	type ImageProductionOutput,
	type ImageProductionResult
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import sharp from 'sharp';

import {
	AffinityRoundEvaluationSchema,
	AffinityRoundIntegrationReceiptSchema,
	AffinityReviewRoundIdSchema,
	affinityRoundAggregatePaths,
	canonicalRegistryProjection,
	loadAffinityReviewRoundRegistry,
	readContainedRoundJson,
	sha256Bytes,
	type AffinityReviewRoundId,
	type AffinityRoundEvaluation,
	type AffinityRoundIntegrationReceipt,
	type AffinityReviewRoundRegistry
} from './affinity-review-round-lib.js';
import { canonicalJson, sha256Json } from './image-production-lib.js';

interface ValidatedRoundExecution {
	readonly entry: AffinityReviewRoundRegistry['entries'][number];
	readonly result: ImageProductionResult;
	readonly output: ImageProductionOutput | null;
	readonly candidateByteSha256: string | null;
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.posix.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
	)
		throw new Error(`Unsafe repository path: ${repositoryPath}`);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, repositoryPath);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error(`Path escapes: ${repositoryPath}`);
	return absolute;
}

async function existsStrict(absolute: string): Promise<boolean> {
	try {
		await lstat(absolute);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function assertContainedRegularFile(
	workspaceRoot: string,
	repositoryPath: string
): Promise<string> {
	const absolute = resolveRepositoryPath(workspaceRoot, repositoryPath);
	let cursor = path.resolve(workspaceRoot);
	for (const segment of repositoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${repositoryPath}`);
	}
	const metadata = await lstat(absolute);
	if (!metadata.isFile()) throw new Error(`Expected regular file: ${repositoryPath}`);
	return absolute;
}

async function listJsonFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	});
	return (
		await Promise.all(
			entries.map(async (entry) => {
				const child = path.join(root, entry.name);
				if (entry.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${child}`);
				if (entry.isDirectory()) return listJsonFiles(child);
				return entry.isFile() && entry.name.endsWith('.json') ? [child] : [];
			})
		)
	).flat();
}

async function listDirectFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	});
	return entries.flatMap((entry) => {
		if (entry.isSymbolicLink())
			throw new Error(`Symlink is forbidden: ${path.join(root, entry.name)}`);
		return entry.isFile() ? [path.join(root, entry.name)] : [];
	});
}

function retainedOutput(result: ImageProductionResult): ImageProductionOutput | null {
	if (result.status === 'candidate')
		return (
			result.attempts.find((attempt) => attempt.attemptId === result.selectedAttemptId)?.output ??
			null
		);
	return [...result.attempts].reverse().find((attempt) => attempt.output)?.output ?? null;
}

async function verifyOutput(
	workspaceRoot: string,
	targetPath: string,
	output: ImageProductionOutput
): Promise<string> {
	if (output.path !== targetPath) throw new Error(`Retained output is not at ${targetPath}.`);
	const absolute = await assertContainedRegularFile(workspaceRoot, output.path);
	const bytes = await readFile(absolute);
	const hash = sha256Bytes(bytes);
	if (hash !== output.contentHash || bytes.byteLength !== output.bytes)
		throw new Error(`Candidate byte provenance differs: ${output.path}`);
	const image = await sharp(bytes).metadata();
	const mediaType =
		image.format === 'png' ? 'image/png' : image.format === 'webp' ? 'image/webp' : null;
	if (
		image.width !== output.width ||
		image.height !== output.height ||
		mediaType !== output.mediaType
	)
		throw new Error(`Candidate byte provenance differs: ${output.path}`);
	return hash;
}

function roundNamespacePrefixes(registry: AffinityReviewRoundRegistry): string[] {
	if (registry.roundId === 'final-controlled-v1')
		return [
			'assets/enemies/experiments/affinity-workflow-v1/targets/final-controlled',
			'assets/enemies/experiments/affinity-workflow-v1/assignments/final-controlled',
			'assets/enemies/experiments/affinity-workflow-v1/results/final-controlled'
		];
	const roots = ['targets', 'assignments'];
	return roots.flatMap((kind) =>
		[...new Set(registry.entries.map((entry) => entry.target.speciesId))].map(
			(species) => `assets/enemies/experiments/affinity-workflow-v1/${kind}/${species}`
		)
	);
}

async function assertExactManifestNamespaces(
	workspaceRoot: string,
	registry: AffinityReviewRoundRegistry
): Promise<void> {
	// Base manifests share the canonical targets/assignments trees with regression and later rounds.
	// Their exact expected files are compared below, while global identity/path isolation detects
	// collisions. Only final-controlled owns a dedicated namespace that may be exact-enumerated.
	if (registry.roundId !== 'final-controlled-v1') return;
	const expected = new Set(
		registry.entries.flatMap((entry) => [entry.targetPath, entry.assignmentPath])
	);
	for (const prefix of roundNamespacePrefixes(registry)) {
		for (const absolute of await listJsonFiles(resolveRepositoryPath(workspaceRoot, prefix))) {
			const relative = path.relative(workspaceRoot, absolute).split(path.sep).join('/');
			if (
				(relative.includes('/targets/') || relative.includes('/assignments/')) &&
				!expected.has(relative)
			)
				throw new Error(`Extra manifest in ${registry.roundId}: ${relative}`);
		}
	}
}

async function assertGlobalIdentityAndPathIsolation(
	workspaceRoot: string,
	registry: AffinityReviewRoundRegistry
): Promise<void> {
	const experimentRoot = resolveRepositoryPath(
		workspaceRoot,
		'assets/enemies/experiments/affinity-workflow-v1'
	);
	const targetFiles = await listJsonFiles(path.join(experimentRoot, 'targets'));
	const assignmentFiles = await listJsonFiles(path.join(experimentRoot, 'assignments'));
	const resultFiles = await listJsonFiles(path.join(experimentRoot, 'results'));
	const targetIds = new Map<string, string>();
	const outputPaths = new Map<string, string>();
	for (const file of targetFiles) {
		const value = await readContainedRoundJson(
			workspaceRoot,
			path.relative(workspaceRoot, file).split(path.sep).join('/')
		);
		const parsed = ImageProductionTargetSchema.safeParse(value);
		if (!parsed.success) throw new Error(`Invalid target artifact: ${file}`);
		const prior = targetIds.get(parsed.data.targetId);
		if (prior) throw new Error(`Duplicate target ID across rounds: ${parsed.data.targetId}`);
		targetIds.set(parsed.data.targetId, file);
		for (const owned of Object.values(parsed.data.output)) {
			const owner = outputPaths.get(owned);
			if (owner) throw new Error(`Owned output path collision across rounds: ${owned}`);
			outputPaths.set(owned, parsed.data.targetId);
		}
	}
	const assignmentIds = new Set<string>();
	const assignmentTargets = new Set<string>();
	for (const file of assignmentFiles) {
		const value = await readContainedRoundJson(
			workspaceRoot,
			path.relative(workspaceRoot, file).split(path.sep).join('/')
		);
		const parsed = ImageProductionAssignmentSchema.safeParse(value);
		if (!parsed.success) throw new Error(`Invalid assignment artifact: ${file}`);
		if (assignmentIds.has(parsed.data.assignmentId))
			throw new Error(`Duplicate assignment ID across rounds: ${parsed.data.assignmentId}`);
		if (assignmentTargets.has(parsed.data.targetId))
			throw new Error(`Multiple assignments target ${parsed.data.targetId}`);
		assignmentIds.add(parsed.data.assignmentId);
		assignmentTargets.add(parsed.data.targetId);
	}
	for (const entry of registry.entries) {
		if (!targetIds.has(entry.target.targetId) || !assignmentTargets.has(entry.target.targetId))
			throw new Error(`Registry identity is missing from workspace: ${entry.target.targetId}`);
	}
	const resultIds = new Set<string>();
	const resultTargets = new Set<string>();
	for (const file of resultFiles) {
		const value = await readContainedRoundJson(
			workspaceRoot,
			path.relative(workspaceRoot, file).split(path.sep).join('/')
		);
		const parsed = ImageProductionResultSchema.safeParse(value);
		if (!parsed.success) throw new Error(`Invalid result artifact: ${file}`);
		if (resultIds.has(parsed.data.resultId))
			throw new Error(`Duplicate result ID across rounds: ${parsed.data.resultId}`);
		if (resultTargets.has(parsed.data.targetId))
			throw new Error(`Multiple results target ${parsed.data.targetId}`);
		resultIds.add(parsed.data.resultId);
		resultTargets.add(parsed.data.targetId);
	}
}

async function assertExactOutputNamespaces(
	workspaceRoot: string,
	registry: AffinityReviewRoundRegistry,
	executions: readonly ValidatedRoundExecution[]
): Promise<void> {
	const expectedResults = new Set(registry.entries.map((entry) => entry.target.output.resultPath));
	const expectedCandidates = new Set(
		executions.flatMap((execution) =>
			execution.output ? [execution.entry.target.output.candidatePath] : []
		)
	);
	const species = new Set(registry.entries.map((entry) => entry.target.speciesId));
	if (registry.roundId === 'final-controlled-v1') {
		for (const [kind, expected] of [
			['results/final-controlled', expectedResults],
			['candidates/final-controlled', expectedCandidates]
		] as const) {
			const root = resolveRepositoryPath(
				workspaceRoot,
				`assets/enemies/experiments/affinity-workflow-v1/${kind}`
			);
			const files = kind.startsWith('results')
				? await listJsonFiles(root)
				: await listAllRegularFiles(root);
			for (const file of files) {
				const relative = path.relative(workspaceRoot, file).split(path.sep).join('/');
				if (!expected.has(relative))
					throw new Error(`Extra ${registry.roundId} output: ${relative}`);
			}
		}
		return;
	}
	const experimentRoot = 'assets/enemies/experiments/affinity-workflow-v1';
	const directResults = await listDirectFiles(
		resolveRepositoryPath(workspaceRoot, `${experimentRoot}/results`)
	);
	for (const file of directResults) {
		if (!file.endsWith('.json')) continue;
		const basename = path.basename(file);
		if (![...species].some((speciesId) => basename.startsWith(`${speciesId}-`))) continue;
		const relative = path.relative(workspaceRoot, file).split(path.sep).join('/');
		if (!expectedResults.has(relative))
			throw new Error(`Extra ${registry.roundId} result: ${relative}`);
	}
	for (const speciesId of species) {
		const candidateRoot = resolveRepositoryPath(
			workspaceRoot,
			`${experimentRoot}/candidates/${speciesId}`
		);
		for (const file of await listDirectFiles(candidateRoot)) {
			const relative = path.relative(workspaceRoot, file).split(path.sep).join('/');
			if (!expectedCandidates.has(relative))
				throw new Error(`Extra ${registry.roundId} candidate: ${relative}`);
		}
	}
}

async function listAllRegularFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
		throw error;
	});
	return (
		await Promise.all(
			entries.map(async (entry) => {
				const child = path.join(root, entry.name);
				if (entry.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${child}`);
				return entry.isDirectory() ? listAllRegularFiles(child) : entry.isFile() ? [child] : [];
			})
		)
	).flat();
}

async function validateRoundExecutions(
	workspaceRoot: string,
	registry: AffinityReviewRoundRegistry
): Promise<ValidatedRoundExecution[]> {
	await assertExactManifestNamespaces(workspaceRoot, registry);
	await assertGlobalIdentityAndPathIsolation(workspaceRoot, registry);
	const executions: ValidatedRoundExecution[] = [];
	for (const entry of registry.entries) {
		const actualTarget = await readContainedRoundJson(workspaceRoot, entry.targetPath);
		const actualAssignment = await readContainedRoundJson(workspaceRoot, entry.assignmentPath);
		if (
			canonicalJson(actualTarget) !== canonicalJson(entry.target) ||
			canonicalJson(actualAssignment) !== canonicalJson(entry.assignment)
		)
			throw new Error(`Manifest drift: ${entry.target.targetId}`);
		const result = ImageProductionResultSchema.parse(
			await readContainedRoundJson(workspaceRoot, entry.target.output.resultPath)
		);
		validateImageProductionExecution({
			target: entry.target,
			assignment: entry.assignment,
			result
		});
		if (!result.noSharedFilesEdited)
			throw new Error(`Shared-file edit claimed by ${entry.target.targetId}.`);
		if (result.attempts.length > entry.assignment.retryCeiling + 1)
			throw new Error(`Retry ceiling exceeded by ${entry.target.targetId}.`);
		const output = retainedOutput(result);
		const candidateByteSha256 = output
			? await verifyOutput(workspaceRoot, entry.target.output.candidatePath, output)
			: null;
		const candidateExists = await existsStrict(
			resolveRepositoryPath(workspaceRoot, entry.target.output.candidatePath)
		);
		if (candidateExists !== (output !== null))
			throw new Error(`Candidate/result presence differs: ${entry.target.targetId}`);
		executions.push({ entry, result, output, candidateByteSha256 });
	}
	await assertExactOutputNamespaces(workspaceRoot, registry, executions);
	return executions;
}

function catalogEntry(execution: ValidatedRoundExecution): ImageProductionCatalogEntry {
	return {
		targetId: execution.entry.target.targetId,
		resultId: execution.result.resultId,
		assignmentId: execution.entry.assignment.assignmentId,
		speciesId: execution.entry.target.speciesId,
		affinity: execution.entry.target.affinity,
		cohort: execution.entry.target.cohort,
		status: execution.result.status,
		candidatePath: execution.output?.path ?? null,
		candidateHash: execution.output?.contentHash ?? null,
		reviewState: 'pending',
		promoted: false
	};
}

async function jsonText(repositoryPath: string, value: unknown): Promise<string> {
	return format(JSON.stringify(value), {
		filepath: repositoryPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

function latestCompletedAt(executions: readonly ValidatedRoundExecution[]): string {
	return executions
		.map((execution) => execution.result.completedAt)
		.toSorted((left, right) => Date.parse(left) - Date.parse(right))
		.at(-1)!;
}

async function buildRoundAggregates(
	registry: AffinityReviewRoundRegistry,
	executions: readonly ValidatedRoundExecution[]
): Promise<{
	catalog: ImageProductionCatalog;
	evaluation: AffinityRoundEvaluation;
	receipt: AffinityRoundIntegrationReceipt;
	texts: { catalog: string; evaluation: string; receipt: string };
}> {
	const generatedAt = latestCompletedAt(executions);
	const catalog = ImageProductionCatalogSchema.parse({
		schemaVersion: 'image-production-catalog-v1',
		experimentId: registry.experimentId,
		generatedAt,
		status: 'experimental-unpromoted',
		entries: executions.map(catalogEntry)
	});
	const counts = {
		targets: 24 as const,
		results: 24 as const,
		candidates: executions.filter(({ result }) => result.status === 'candidate').length,
		revise: executions.filter(({ result }) => result.status === 'revise').length,
		failed: executions.filter(({ result }) => result.status === 'failed').length,
		firstAttemptCandidates: executions.filter(
			({ result }) =>
				result.status === 'candidate' && result.selectedAttemptId === result.attempts[0]?.attemptId
		).length
	};
	const evaluation = AffinityRoundEvaluationSchema.parse({
		schemaVersion: 'affinity-review-round-evaluation-v1',
		experimentId: registry.experimentId,
		roundId: registry.roundId,
		generatedAt,
		status: 'incomplete',
		catalogCanonicalSha256: sha256Json(catalog),
		counts,
		workflow: {
			completeProvenanceCount: 24,
			pathConflictCount: 0,
			sharedFileEditCount: 0,
			retryCeilingViolationCount: 0
		},
		activationReceiptCanonicalSha256: registry.activationReceiptCanonicalSha256
	});
	const paths = affinityRoundAggregatePaths(registry.roundId);
	const catalogText = await jsonText(paths.catalog, catalog);
	const evaluationText = await jsonText(paths.evaluation, evaluation);
	const evidence = executions
		.map((execution) => ({
			targetId: execution.entry.target.targetId,
			targetPath: execution.entry.targetPath,
			targetCanonicalSha256: sha256Json(execution.entry.target),
			assignmentId: execution.entry.assignment.assignmentId,
			assignmentPath: execution.entry.assignmentPath,
			assignmentCanonicalSha256: sha256Json(execution.entry.assignment),
			resultId: execution.result.resultId,
			resultPath: execution.entry.target.output.resultPath,
			resultCanonicalSha256: sha256Json(execution.result),
			candidatePath: execution.output?.path ?? null,
			candidateByteSha256: execution.candidateByteSha256
		}))
		.toSorted((left, right) => left.targetId.localeCompare(right.targetId));
	const aggregates = [
		{
			kind: 'catalog' as const,
			path: paths.catalog,
			canonicalSha256: sha256Json(catalog),
			byteSha256: sha256Bytes(catalogText)
		},
		{
			kind: 'evaluation' as const,
			path: paths.evaluation,
			canonicalSha256: sha256Json(evaluation),
			byteSha256: sha256Bytes(evaluationText)
		}
	];
	const receipt = AffinityRoundIntegrationReceiptSchema.parse({
		schemaVersion: 'affinity-review-round-integration-receipt-v1',
		experimentId: registry.experimentId,
		roundId: registry.roundId,
		status: 'complete',
		completedAt: generatedAt,
		registryCanonicalSha256: sha256Json(canonicalRegistryProjection(registry)),
		activationReceiptCanonicalSha256: registry.activationReceiptCanonicalSha256,
		evidenceSetCanonicalSha256: sha256Json(evidence),
		evidence,
		aggregates
	});
	return {
		catalog,
		evaluation,
		receipt,
		texts: {
			catalog: catalogText,
			evaluation: evaluationText,
			receipt: await jsonText(paths.receipt, receipt)
		}
	};
}

async function verifyExistingReceipt(
	workspaceRoot: string,
	roundId: AffinityReviewRoundId
): Promise<AffinityRoundIntegrationReceipt | null> {
	const paths = affinityRoundAggregatePaths(roundId);
	const absolute = resolveRepositoryPath(workspaceRoot, paths.receipt);
	if (!(await existsStrict(absolute))) return null;
	const receipt = AffinityRoundIntegrationReceiptSchema.parse(
		await readContainedRoundJson(workspaceRoot, paths.receipt)
	);
	if (receipt.roundId !== roundId)
		throw new Error(`Integration receipt belongs to ${receipt.roundId}, not ${roundId}.`);
	const expectedAggregates = [
		`catalog\0${paths.catalog}`,
		`evaluation\0${paths.evaluation}`
	].sort();
	const actualAggregates = receipt.aggregates
		.map((aggregate) => `${aggregate.kind}\0${aggregate.path}`)
		.sort();
	if (canonicalJson(expectedAggregates) !== canonicalJson(actualAggregates))
		throw new Error(`Integration receipt aggregate paths are not exact for ${roundId}.`);
	for (const aggregate of receipt.aggregates) {
		const bytes = await readFile(resolveRepositoryPath(workspaceRoot, aggregate.path));
		if (sha256Bytes(bytes) !== aggregate.byteSha256)
			throw new Error(`Receipt-bound aggregate drift: ${aggregate.path}`);
		if (sha256Json(JSON.parse(bytes.toString('utf8'))) !== aggregate.canonicalSha256)
			throw new Error(`Receipt-bound aggregate canonical drift: ${aggregate.path}`);
	}
	return receipt;
}

async function durableTemp(file: string, text: string): Promise<string> {
	const temporary = `${file}.round-sync-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	await handle.writeFile(text);
	await handle.sync();
	await handle.close();
	return temporary;
}

async function publishExclusiveOrExact(
	temporary: string,
	destination: string,
	expectedText: string
): Promise<boolean> {
	try {
		await link(temporary, destination);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		const current = await readFile(destination, 'utf8');
		if (current !== expectedText)
			throw new Error(`Concurrent aggregate publication differs: ${destination}`, {
				cause: error
			});
		return false;
	}
}

async function rollbackPublishedFile(destination: string, expectedText: string): Promise<void> {
	const current = await readFile(destination, 'utf8').catch((error) => {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw error;
	});
	if (current === null) return;
	if (current !== expectedText)
		throw new Error(`Rollback refuses drifted aggregate: ${destination}`);
	await unlink(destination);
}

export interface AffinityRoundSyncReport {
	readonly mode: 'check' | 'write';
	readonly roundId: AffinityReviewRoundId;
	readonly status: 'complete';
	readonly targetCount: 24;
	readonly resultCount: 24;
	readonly candidateCount: number;
	readonly receiptPath: string;
	readonly inSync: boolean;
	readonly written: boolean;
}

export async function syncAffinityReviewRound(options: {
	readonly workspaceRoot?: string;
	readonly roundId: AffinityReviewRoundId;
	readonly mode: 'check' | 'write';
}): Promise<AffinityRoundSyncReport> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const roundId = AffinityReviewRoundIdSchema.parse(options.roundId);
	const registry = await loadAffinityReviewRoundRegistry(workspaceRoot, roundId);
	const executions = await validateRoundExecutions(workspaceRoot, registry);
	const built = await buildRoundAggregates(registry, executions);
	const existingReceipt = await verifyExistingReceipt(workspaceRoot, roundId);
	const paths = affinityRoundAggregatePaths(roundId);
	const current = await Promise.all(
		([paths.catalog, paths.evaluation, paths.receipt] as const).map((repositoryPath) =>
			readFile(resolveRepositoryPath(workspaceRoot, repositoryPath), 'utf8').catch((error) => {
				if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
				throw error;
			})
		)
	);
	const expected = [built.texts.catalog, built.texts.evaluation, built.texts.receipt];
	const inSync = current.every((value, index) => value === expected[index]);
	let written = false;
	if (options.mode === 'write' && !inSync) {
		if (existingReceipt) throw new Error(`Existing ${roundId} integration receipt differs.`);
		for (const [index, value] of current.slice(0, 2).entries()) {
			if (value !== null && value !== expected[index])
				throw new Error(`Unreceipted aggregate drift: ${[paths.catalog, paths.evaluation][index]}`);
		}
		const roundRoot = resolveRepositoryPath(workspaceRoot, path.posix.dirname(paths.catalog));
		await mkdir(roundRoot, { recursive: true });
		const catalogDestination = resolveRepositoryPath(workspaceRoot, paths.catalog);
		const evaluationDestination = resolveRepositoryPath(workspaceRoot, paths.evaluation);
		const receiptDestination = resolveRepositoryPath(workspaceRoot, paths.receipt);
		const catalogTemporary = await durableTemp(catalogDestination, built.texts.catalog);
		const evaluationTemporary = await durableTemp(evaluationDestination, built.texts.evaluation);
		const receiptTemporary = await durableTemp(receiptDestination, built.texts.receipt);
		const owned: Array<{ destination: string; text: string }> = [];
		try {
			if (await publishExclusiveOrExact(catalogTemporary, catalogDestination, built.texts.catalog))
				owned.push({ destination: catalogDestination, text: built.texts.catalog });
			if (
				await publishExclusiveOrExact(
					evaluationTemporary,
					evaluationDestination,
					built.texts.evaluation
				)
			)
				owned.push({ destination: evaluationDestination, text: built.texts.evaluation });
			await publishExclusiveOrExact(receiptTemporary, receiptDestination, built.texts.receipt);
			written = true;
		} catch (error) {
			const committedReceipt = await readFile(receiptDestination, 'utf8').catch((readError) => {
				if ((readError as NodeJS.ErrnoException).code === 'ENOENT') return null;
				throw readError;
			});
			if (committedReceipt !== built.texts.receipt)
				for (const artifact of owned.toReversed())
					await rollbackPublishedFile(artifact.destination, artifact.text);
			throw error;
		} finally {
			await Promise.all([
				unlink(catalogTemporary).catch(() => undefined),
				unlink(evaluationTemporary).catch(() => undefined),
				unlink(receiptTemporary).catch(() => undefined)
			]);
		}
	}
	return {
		mode: options.mode,
		roundId,
		status: 'complete',
		targetCount: 24,
		resultCount: 24,
		candidateCount: executions.filter(({ result }) => result.status === 'candidate').length,
		receiptPath: paths.receipt,
		inSync: inSync || written,
		written
	};
}

function parseArgs(args: readonly string[]): {
	roundId: AffinityReviewRoundId;
	mode: 'check' | 'write';
} {
	const roundIndex = args.indexOf('--round');
	const roundId = AffinityReviewRoundIdSchema.parse(args[roundIndex + 1]);
	const mode = args.includes('--write') ? 'write' : 'check';
	return { roundId, mode };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	syncAffinityReviewRound({ ...parseArgs(process.argv.slice(2)) })
		.then((report) => {
			process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
			if (!report.inSync) process.exitCode = 1;
		})
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		});
}
