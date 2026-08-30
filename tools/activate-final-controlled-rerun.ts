import { createHash, randomUUID } from 'node:crypto';
import { lstat, link, mkdir, open, readFile, rename, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema,
	type ImageProductionAssignment,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import { z } from 'zod';

import {
	AFFINITY_EXPERIMENT_ROOT,
	createImageProductionAssignments,
	sha256Json
} from './image-production-lib.js';
import {
	buildFinalControlledRerunBundle,
	type FinalControlledRerunPlan
} from './prepare-final-controlled-rerun.js';
import {
	FinalControlledDesignRiskResolutionCollectionSchema,
	RESOLUTION_PATH,
	buildFinalControlledActivationReadiness,
	loadCurrentActivationReadinessInput,
	type ActivationReadinessInput
} from './report-final-controlled-activation-readiness.js';
import {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	FinalControlledActivationArtifactSchema,
	FinalControlledActivationReceiptSchema,
	verifyFinalControlledActivationArtifacts,
	verifyFinalControlledActivationReceipt,
	type FinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';

export {
	FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH,
	FinalControlledActivationReceiptSchema,
	verifyFinalControlledActivationReceipt,
	type FinalControlledActivationReceipt
} from './final-controlled-activation-evidence.js';

const RepositoryPath = z.string().min(1);
const PLAN_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`;
const LOCK_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/.final-controlled-activation.lock`;
const TRANSACTION_ROOT = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-activation-transaction`;

interface PreparedArtifact {
	readonly kind: 'target' | 'assignment';
	readonly livePath: string;
	readonly value: ImageProductionTarget | ImageProductionAssignment;
	readonly text: string;
	readonly canonicalSha256: string;
	readonly byteSha256: string;
	readonly source: 'derived' | 'staged';
}

const IntentSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-activation-intent-v1'),
		activationId: z.string(),
		artifacts: z.array(
			FinalControlledActivationArtifactSchema.extend({ payloadPath: RepositoryPath }).strict()
		),
		publishedPaths: z.array(RepositoryPath)
	})
	.strict();

function byteHash(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
}

function resolveRepositoryPath(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath.split('/').some((segment) => ['', '.', '..'].includes(segment))
	)
		throw new Error(`Unsafe repository path: ${repositoryPath}`);
	const root = path.resolve(workspaceRoot);
	const resolved = path.resolve(root, repositoryPath);
	if (!resolved.startsWith(`${root}${path.sep}`))
		throw new Error(`Repository path escapes workspace: ${repositoryPath}`);
	return resolved;
}

async function assertNoSymlinkAncestor(
	workspaceRoot: string,
	repositoryPath: string
): Promise<void> {
	const root = path.resolve(workspaceRoot);
	const relativeParent = path.dirname(repositoryPath);
	let cursor = root;
	for (const segment of relativeParent.split('/').filter((value) => value !== '.')) {
		cursor = path.join(cursor, segment);
		try {
			const metadata = await lstat(cursor);
			if (metadata.isSymbolicLink() || !metadata.isDirectory())
				throw new Error(`Unsafe destination ancestor: ${path.relative(root, cursor)}`);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
			throw error;
		}
	}
}

async function formattedJson(repositoryPath: string, value: unknown): Promise<string> {
	return format(JSON.stringify(value), {
		filepath: repositoryPath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

function templatePath(
	template: string,
	target: FinalControlledRerunPlan['targets'][number]
): string {
	return template
		.replace('{speciesId}', target.speciesId)
		.replace('{affinity}', target.affinity)
		.replace('{version}', target.version);
}

async function prepareArtifacts(input: ActivationReadinessInput): Promise<{
	artifacts: PreparedArtifact[];
	receiptBase: Omit<FinalControlledActivationReceipt, 'completedAt' | 'status'>;
	plannedPaths: readonly string[];
}> {
	const plan = buildFinalControlledRerunBundle(input.plan).plan;
	const derived = buildFinalControlledRerunBundle(plan);
	const ledger = FinalControlledDesignRiskResolutionCollectionSchema.parse(input.resolutions);
	const resolutionByCoordinate = new Map(ledger.resolutions.map((item) => [item.coordinate, item]));
	const targets = plan.targets.map((coordinate, index) => {
		const resolution = resolutionByCoordinate.get(coordinate.key);
		if (!resolution?.stagedTarget) return derived.targets[index]!;
		return ImageProductionTargetSchema.parse(input.staged?.[resolution.stagedTarget.path]?.target);
	});
	const assignments = createImageProductionAssignments(targets).map((assignment) =>
		ImageProductionAssignmentSchema.parse({
			...assignment,
			forbiddenSharedPaths: [
				...assignment.forbiddenSharedPaths,
				PLAN_PATH,
				RESOLUTION_PATH,
				FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH
			]
		})
	);
	const artifacts: PreparedArtifact[] = [];
	for (const [index, coordinate] of plan.targets.entries()) {
		const resolution = resolutionByCoordinate.get(coordinate.key);
		for (const [kind, livePath, value] of [
			['target', templatePath(plan.plannedPathTemplates.target, coordinate), targets[index]],
			[
				'assignment',
				templatePath(plan.plannedPathTemplates.assignment, coordinate),
				assignments[index]
			]
		] as const) {
			if (!value) throw new Error(`Missing ${kind} for ${coordinate.key}`);
			const text = await formattedJson(livePath, value);
			artifacts.push({
				kind,
				livePath,
				value,
				text,
				canonicalSha256: sha256Json(value),
				byteSha256: byteHash(text),
				source: kind === 'target' && resolution?.stagedTarget ? 'staged' : 'derived'
			});
		}
	}
	const receiptArtifacts = artifacts
		.map(({ kind, livePath, canonicalSha256, byteSha256, source }) => ({
			kind,
			livePath,
			canonicalSha256,
			byteSha256,
			source
		}))
		.toSorted((left, right) => left.livePath.localeCompare(right.livePath));
	const artifactSetSha256 = sha256Json(receiptArtifacts);
	return {
		artifacts,
		plannedPaths: derived.plannedPaths,
		receiptBase: {
			schemaVersion: 'affinity-final-controlled-activation-receipt-v1',
			experimentId: 'affinity-workflow-v1',
			activationId: `final-controlled-${artifactSetSha256.slice(0, 16)}`,
			bindings: {
				planCanonicalSha256: sha256Json(plan),
				resolutionLedgerCanonicalSha256: sha256Json(ledger),
				blindReviewCanonicalSha256: sha256Json(input.blindReviews),
				catalogCanonicalSha256: sha256Json(input.catalog),
				executionSnapshotSha256: ledger.executionSnapshotHash
			},
			targetCount: 24,
			assignmentCount: 24,
			artifactCount: 48,
			artifactSetSha256,
			artifacts: receiptArtifacts
		}
	};
}

async function pathExistsStrict(absolute: string): Promise<boolean> {
	try {
		await lstat(absolute);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function acquireLock(workspaceRoot: string): Promise<() => Promise<void>> {
	const absolute = resolveRepositoryPath(workspaceRoot, LOCK_PATH);
	await assertNoSymlinkAncestor(workspaceRoot, LOCK_PATH);
	await mkdir(path.dirname(absolute), { recursive: true });
	const token = `${process.pid}:${randomUUID()}`;
	let handle;
	try {
		handle = await open(absolute, 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		const owner = await readFile(absolute, 'utf8');
		const ownerPid = Number(owner.split(':')[0]);
		let ownerAlive = Number.isSafeInteger(ownerPid) && ownerPid > 0;
		if (ownerAlive) {
			try {
				process.kill(ownerPid, 0);
			} catch (probeError) {
				if ((probeError as NodeJS.ErrnoException).code === 'ESRCH') ownerAlive = false;
				else throw probeError;
			}
		}
		if (ownerAlive)
			throw new Error('Another final-controlled activation owns the lock.', { cause: error });
		await unlink(absolute);
		handle = await open(absolute, 'wx');
	}
	await handle.writeFile(`${token}\n`);
	await handle.sync();
	await handle.close();
	return async () => {
		const current = await readFile(absolute, 'utf8').catch(() => '');
		if (current.trim() === token) await unlink(absolute);
	};
}

async function writeJournal(file: string, value: unknown): Promise<void> {
	const temporary = `${file}.tmp-${process.pid}`;
	const handle = await open(temporary, 'wx');
	await handle.writeFile(await formattedJson(file, value));
	await handle.sync();
	await handle.close();
	await rename(temporary, file);
	await syncDirectory(path.dirname(file));
}

async function syncDirectory(directoryPath: string): Promise<void> {
	const directory = await open(directoryPath, 'r');
	await directory.sync();
	await directory.close();
}

async function rollbackOwnedArtifacts(
	workspaceRoot: string,
	artifacts: readonly { livePath: string; byteSha256: string; payloadPath?: string }[],
	publishedPaths: ReadonlySet<string>
): Promise<void> {
	for (const artifact of artifacts) {
		const absolute = resolveRepositoryPath(workspaceRoot, artifact.livePath);
		if (!(await pathExistsStrict(absolute))) continue;
		let transactionOwned = publishedPaths.has(artifact.livePath);
		if (!transactionOwned && artifact.payloadPath) {
			const payload = resolveRepositoryPath(workspaceRoot, artifact.payloadPath);
			if (await pathExistsStrict(payload)) {
				const [destinationMetadata, payloadMetadata] = await Promise.all([
					lstat(absolute),
					lstat(payload)
				]);
				transactionOwned =
					destinationMetadata.dev === payloadMetadata.dev &&
					destinationMetadata.ino === payloadMetadata.ino;
			}
		}
		if (!transactionOwned) continue;
		const metadata = await lstat(absolute);
		if (!metadata.isFile() || metadata.isSymbolicLink())
			throw new Error(`Rollback refuses non-file transaction path: ${artifact.livePath}`);
		if (byteHash(await readFile(absolute)) !== artifact.byteSha256)
			throw new Error(`Rollback refuses drifted transaction path: ${artifact.livePath}`);
		await unlink(absolute);
	}
}

async function recoverIncompleteTransaction(workspaceRoot: string): Promise<void> {
	const root = resolveRepositoryPath(workspaceRoot, TRANSACTION_ROOT);
	if (!(await pathExistsStrict(root))) return;
	const rootMetadata = await lstat(root);
	if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink())
		throw new Error('Activation transaction root must be a regular directory.');
	await assertNoSymlinkAncestor(workspaceRoot, `${TRANSACTION_ROOT}/intent.json`);
	const intentPath = path.join(root, 'intent.json');
	const intent = IntentSchema.parse(JSON.parse(await readFile(intentPath, 'utf8')));
	await rollbackOwnedArtifacts(workspaceRoot, intent.artifacts, new Set(intent.publishedPaths));
	await rm(root, { recursive: true });
}

export interface ActivateFinalControlledOptions {
	readonly workspaceRoot?: string;
	readonly acknowledgeLiveManifestActivation: boolean;
	/** Tests may inject a complete evidence snapshot; authorization is still recomputed twice. */
	readonly loadInput?: (workspaceRoot: string) => Promise<ActivationReadinessInput>;
	readonly now?: () => string;
	readonly failAfterPublished?: number;
}

export interface FinalControlledActivationSummary {
	readonly status: 'activated' | 'already-activated';
	readonly receipt: FinalControlledActivationReceipt;
}

export async function activateFinalControlledRerun(
	options: ActivateFinalControlledOptions
): Promise<FinalControlledActivationSummary> {
	if (!options.acknowledgeLiveManifestActivation)
		throw new Error('Explicit --acknowledge-live-manifest-activation is required.');
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const loadInput = options.loadInput ?? loadCurrentActivationReadinessInput;
	if (
		await pathExistsStrict(
			resolveRepositoryPath(workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH)
		)
	) {
		const current = await loadInput(workspaceRoot);
		const currentPlan = buildFinalControlledRerunBundle(current.plan).plan;
		const existing = await verifyFinalControlledActivationReceipt(
			workspaceRoot,
			sha256Json(currentPlan)
		);
		if (existing.valid && existing.receipt)
			return { status: 'already-activated', receipt: existing.receipt };
		throw new Error(`Existing activation receipt is invalid: ${existing.issues.join('; ')}`);
	}
	const preliminary = await loadInput(workspaceRoot);
	const preliminaryReport = buildFinalControlledActivationReadiness(preliminary);
	if (!preliminaryReport.authorized)
		throw new Error(
			`Activation is unauthorized: ${preliminaryReport.blockers.map((b) => b.code).join(', ')}`
		);
	const release = await acquireLock(workspaceRoot);
	try {
		await recoverIncompleteTransaction(workspaceRoot);
		const input = await loadInput(workspaceRoot);
		const readiness = buildFinalControlledActivationReadiness(input);
		if (!readiness.authorized)
			throw new Error(
				`Activation became unauthorized: ${readiness.blockers.map((b) => b.code).join(', ')}`
			);
		const prepared = await prepareArtifacts(input);
		for (const repositoryPath of prepared.plannedPaths) {
			await assertNoSymlinkAncestor(workspaceRoot, repositoryPath);
			if (await pathExistsStrict(resolveRepositoryPath(workspaceRoot, repositoryPath)))
				throw new Error(`Planned final-controlled path already exists: ${repositoryPath}`);
		}
		const transactionRoot = resolveRepositoryPath(workspaceRoot, TRANSACTION_ROOT);
		const payloadRoot = path.join(transactionRoot, 'payload');
		await mkdir(transactionRoot, { recursive: false });
		await mkdir(payloadRoot, { recursive: false });
		const intent = {
			schemaVersion: 'affinity-final-controlled-activation-intent-v1' as const,
			activationId: prepared.receiptBase.activationId,
			artifacts: prepared.artifacts.map((artifact, index) => ({
				kind: artifact.kind,
				livePath: artifact.livePath,
				canonicalSha256: artifact.canonicalSha256,
				byteSha256: artifact.byteSha256,
				source: artifact.source,
				payloadPath: `${TRANSACTION_ROOT}/payload/${String(index).padStart(2, '0')}.json`
			})),
			publishedPaths: [] as string[]
		};
		for (const [index, artifact] of prepared.artifacts.entries()) {
			const payload = await open(
				path.join(payloadRoot, `${String(index).padStart(2, '0')}.json`),
				'wx'
			);
			await payload.writeFile(artifact.text);
			await payload.sync();
			await payload.close();
		}
		await syncDirectory(payloadRoot);
		const intentPath = path.join(transactionRoot, 'intent.json');
		await writeJournal(intentPath, intent);
		try {
			for (const [index, artifact] of prepared.artifacts.entries()) {
				await assertNoSymlinkAncestor(workspaceRoot, artifact.livePath);
				const destination = resolveRepositoryPath(workspaceRoot, artifact.livePath);
				await mkdir(path.dirname(destination), { recursive: true });
				await link(path.join(payloadRoot, `${String(index).padStart(2, '0')}.json`), destination);
				intent.publishedPaths.push(artifact.livePath);
				await writeJournal(intentPath, intent);
				if (options.failAfterPublished === index + 1)
					throw new Error(`Injected activation failure after ${index + 1} artifacts.`);
			}
			const receipt = FinalControlledActivationReceiptSchema.parse({
				...prepared.receiptBase,
				status: 'complete',
				completedAt: options.now?.() ?? new Date().toISOString()
			});
			const artifactIssues = await verifyFinalControlledActivationArtifacts(
				workspaceRoot,
				receipt.artifacts
			);
			if (artifactIssues.length > 0)
				throw new Error(`Pre-commit artifact verification failed: ${artifactIssues.join('; ')}`);
			for (const directory of new Set(
				prepared.artifacts.map((artifact) =>
					path.dirname(resolveRepositoryPath(workspaceRoot, artifact.livePath))
				)
			))
				await syncDirectory(directory);
			const receiptText = await formattedJson(FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH, receipt);
			const receiptTemporary = path.join(transactionRoot, 'receipt.json');
			const receiptHandle = await open(receiptTemporary, 'wx');
			await receiptHandle.writeFile(receiptText);
			await receiptHandle.sync();
			await receiptHandle.close();
			await link(
				receiptTemporary,
				resolveRepositoryPath(workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH)
			);
			await syncDirectory(
				path.dirname(resolveRepositoryPath(workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH))
			);
			await rm(transactionRoot, { recursive: true });
			return { status: 'activated', receipt };
		} catch (error) {
			if (
				!(await pathExistsStrict(
					resolveRepositoryPath(workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH)
				))
			) {
				await rollbackOwnedArtifacts(
					workspaceRoot,
					intent.artifacts,
					new Set(intent.publishedPaths)
				);
				await rm(transactionRoot, { recursive: true });
			}
			throw error;
		}
	} finally {
		await release();
	}
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
	const acknowledge = process.argv.includes('--acknowledge-live-manifest-activation');
	activateFinalControlledRerun({ acknowledgeLiveManifestActivation: acknowledge })
		.then((summary) => process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`))
		.catch((error) => {
			console.error(error);
			process.exitCode = 1;
		});
}
