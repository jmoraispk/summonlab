import { createHash, randomUUID } from 'node:crypto';
import { link, lstat, mkdir, open, readFile, rename, rm, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import { z } from 'zod';

import {
	prepareCurrentConcurrencySentinels,
	type PreparedConcurrencySentinels
} from './concurrency-sentinel-readiness.js';
import { AFFINITY_EXPERIMENT_ROOT, sha256Json } from './image-production-lib.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPath = z.string().min(1);
const LOCK_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/.concurrency-sentinel-activation.lock`;
const TRANSACTION_ROOT = `${AFFINITY_EXPERIMENT_ROOT}/review/concurrency-sentinel-activation-transaction`;
export const CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/concurrency-sentinel-activation-receipt.json` as const;

export const ConcurrencySentinelActivationArtifactSchema = z
	.object({
		kind: z.enum(['target', 'assignment']),
		livePath: RepositoryPath,
		canonicalSha256: Hash,
		byteSha256: Hash
	})
	.strict();

export const ConcurrencySentinelActivationReceiptSchema = z
	.object({
		schemaVersion: z.literal('affinity-concurrency-sentinel-activation-receipt-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		activationId: z.string().regex(/^concurrency-sentinels-[a-f0-9]{16}$/u),
		status: z.literal('complete'),
		completedAt: z.iso.datetime(),
		actor: z.string().min(1),
		bindings: z
			.object({
				allocationCanonicalSha256: Hash,
				finalControlledIntegrationReceiptCanonicalSha256: Hash,
				finalControlledEvaluationReceiptCanonicalSha256: Hash,
				acceptedRulesCanonicalSha256: Hash,
				repositorySkillTreeSha256: Hash,
				installedSkillTreeSha256: Hash,
				sourceSetCanonicalSha256: Hash,
				sentinelBundleCanonicalSha256: Hash,
				assignedAt: z.iso.datetime()
			})
			.strict(),
		targetCount: z.literal(14),
		assignmentCount: z.literal(14),
		artifactCount: z.literal(28),
		artifactSetSha256: Hash,
		artifacts: z.array(ConcurrencySentinelActivationArtifactSchema).length(28)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (new Set(receipt.artifacts.map((artifact) => artifact.livePath)).size !== 28)
			context.addIssue({ code: 'custom', path: ['artifacts'], message: 'Paths must be unique' });
		if (receipt.artifacts.filter((artifact) => artifact.kind === 'target').length !== 14)
			context.addIssue({ code: 'custom', path: ['artifacts'], message: 'Expected 14 targets' });
		if (receipt.artifacts.filter((artifact) => artifact.kind === 'assignment').length !== 14)
			context.addIssue({ code: 'custom', path: ['artifacts'], message: 'Expected 14 assignments' });
	});

export type ConcurrencySentinelActivationReceipt = z.infer<
	typeof ConcurrencySentinelActivationReceiptSchema
>;

const IntentSchema = z
	.object({
		schemaVersion: z.literal('affinity-concurrency-sentinel-activation-intent-v1'),
		artifacts: z.array(
			ConcurrencySentinelActivationArtifactSchema.extend({ payloadPath: RepositoryPath }).strict()
		),
		publishedPaths: z.array(RepositoryPath)
	})
	.strict();

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

async function assertNoSymlinkAncestor(workspaceRoot: string, repositoryPath: string) {
	const root = path.resolve(workspaceRoot);
	let cursor = root;
	for (const segment of path
		.dirname(repositoryPath)
		.split('/')
		.filter((value) => value !== '.')) {
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

function byteHash(value: string | Buffer): string {
	return createHash('sha256').update(value).digest('hex');
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

async function exists(absolute: string): Promise<boolean> {
	try {
		await lstat(absolute);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

async function syncDirectory(directoryPath: string): Promise<void> {
	const directory = await open(directoryPath, 'r');
	await directory.sync();
	await directory.close();
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
		const ownerPid = Number((await readFile(absolute, 'utf8')).split(':')[0]);
		let alive = Number.isSafeInteger(ownerPid) && ownerPid > 0;
		if (alive) {
			try {
				process.kill(ownerPid, 0);
			} catch (probe) {
				if ((probe as NodeJS.ErrnoException).code === 'ESRCH') alive = false;
				else throw probe;
			}
		}
		if (alive) throw new Error('Another concurrency-sentinel activation owns the lock.');
		await unlink(absolute);
		handle = await open(absolute, 'wx');
	}
	await handle.writeFile(`${token}\n`);
	await handle.sync();
	await handle.close();
	return async () => {
		if ((await readFile(absolute, 'utf8').catch(() => '')).trim() === token) await unlink(absolute);
	};
}

function assertReady(prepared: PreparedConcurrencySentinels) {
	if (prepared.report.status !== 'ready' || !prepared.bundle)
		throw new Error(`Sentinel activation is unauthorized: ${prepared.report.blockers.join(', ')}`);
	const required = [
		prepared.report.allocationCanonicalSha256,
		prepared.report.finalControlledIntegrationReceiptCanonicalSha256,
		prepared.report.finalControlledEvaluationReceiptCanonicalSha256,
		prepared.report.acceptedRulesCanonicalSha256,
		prepared.report.repositorySkillTreeSha256,
		prepared.report.installedSkillTreeSha256,
		prepared.report.sourceSetCanonicalSha256,
		prepared.report.sentinelBundleCanonicalSha256,
		prepared.report.assignedAt
	];
	if (required.some((value) => !value)) throw new Error('Ready sentinel report has null bindings.');
}

async function preparedArtifacts(prepared: PreparedConcurrencySentinels) {
	assertReady(prepared);
	return Promise.all(
		prepared.bundle!.artifacts.map(async (artifact) => {
			const text = await formattedJson(artifact.livePath, artifact.value);
			return {
				kind: artifact.kind,
				livePath: artifact.livePath,
				canonicalSha256: sha256Json(artifact.value),
				byteSha256: byteHash(text),
				text
			};
		})
	);
}

export async function verifyConcurrencySentinelActivationReceipt(
	workspaceRoot = process.cwd()
): Promise<{ valid: boolean; receipt?: ConcurrencySentinelActivationReceipt; issues: string[] }> {
	const issues: string[] = [];
	let receipt: ConcurrencySentinelActivationReceipt;
	try {
		await assertNoSymlinkAncestor(workspaceRoot, CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH);
		const absolute = resolveRepositoryPath(
			workspaceRoot,
			CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH
		);
		const metadata = await lstat(absolute);
		if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('not a regular file');
		receipt = ConcurrencySentinelActivationReceiptSchema.parse(
			JSON.parse(await readFile(absolute, 'utf8'))
		);
	} catch (error) {
		return { valid: false, issues: [`Receipt unavailable or invalid: ${String(error)}`] };
	}
	if (sha256Json(receipt.artifacts) !== receipt.artifactSetSha256)
		issues.push('Receipt artifact-set hash is invalid.');
	for (const artifact of receipt.artifacts) {
		try {
			await assertNoSymlinkAncestor(workspaceRoot, artifact.livePath);
			const absolute = resolveRepositoryPath(workspaceRoot, artifact.livePath);
			const metadata = await lstat(absolute);
			if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('not a regular file');
			const bytes = await readFile(absolute);
			if (byteHash(bytes) !== artifact.byteSha256) throw new Error('byte hash differs');
			const value: unknown = JSON.parse(bytes.toString('utf8'));
			if (sha256Json(value) !== artifact.canonicalSha256) throw new Error('canonical hash differs');
			if (artifact.kind === 'target') ImageProductionTargetSchema.parse(value);
			else ImageProductionAssignmentSchema.parse(value);
		} catch (error) {
			issues.push(`${artifact.livePath}: ${String(error)}`);
		}
	}
	return { valid: issues.length === 0, receipt, issues };
}

async function rollback(
	workspaceRoot: string,
	artifacts: readonly { livePath: string; byteSha256: string }[],
	published: ReadonlySet<string>
) {
	for (const artifact of artifacts) {
		if (!published.has(artifact.livePath)) continue;
		const absolute = resolveRepositoryPath(workspaceRoot, artifact.livePath);
		if (!(await exists(absolute))) continue;
		const metadata = await lstat(absolute);
		if (
			!metadata.isFile() ||
			metadata.isSymbolicLink() ||
			byteHash(await readFile(absolute)) !== artifact.byteSha256
		)
			throw new Error(`Rollback refuses drifted transaction path: ${artifact.livePath}`);
		await unlink(absolute);
	}
}

async function recoverTransaction(workspaceRoot: string) {
	const root = resolveRepositoryPath(workspaceRoot, TRANSACTION_ROOT);
	if (!(await exists(root))) return;
	const metadata = await lstat(root);
	if (!metadata.isDirectory() || metadata.isSymbolicLink())
		throw new Error('Sentinel transaction root must be a regular directory.');
	const intent = IntentSchema.parse(
		JSON.parse(await readFile(path.join(root, 'intent.json'), 'utf8'))
	);
	await rollback(workspaceRoot, intent.artifacts, new Set(intent.publishedPaths));
	await rm(root, { recursive: true });
}

export interface ActivateConcurrencySentinelsOptions {
	readonly workspaceRoot?: string;
	readonly actor: string;
	readonly acknowledgeLiveSentinelActivation: boolean;
	readonly loadPrepared?: (
		workspaceRoot: string,
		allowExistingOwnedPaths: boolean
	) => Promise<PreparedConcurrencySentinels>;
	readonly now?: () => string;
	readonly failAfterPublished?: number;
}

export async function activateConcurrencySentinels(options: ActivateConcurrencySentinelsOptions) {
	if (!options.acknowledgeLiveSentinelActivation)
		throw new Error('Explicit --acknowledge-live-sentinel-activation is required.');
	const actor = options.actor.trim();
	if (!actor) throw new Error('A non-empty --actor is required.');
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const loadPrepared =
		options.loadPrepared ??
		((root: string, allowExistingOwnedPaths: boolean) =>
			prepareCurrentConcurrencySentinels({
				workspaceRoot: root,
				actor,
				allowExistingOwnedPaths
			}));
	const receiptAbsolute = resolveRepositoryPath(
		workspaceRoot,
		CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH
	);
	if (await exists(receiptAbsolute)) {
		const prepared = await loadPrepared(workspaceRoot, true);
		assertReady(prepared);
		const verification = await verifyConcurrencySentinelActivationReceipt(workspaceRoot);
		if (!verification.valid || !verification.receipt)
			throw new Error(`Existing sentinel receipt is invalid: ${verification.issues.join('; ')}`);
		const report = prepared.report;
		const expected = {
			allocationCanonicalSha256: report.allocationCanonicalSha256!,
			finalControlledIntegrationReceiptCanonicalSha256:
				report.finalControlledIntegrationReceiptCanonicalSha256!,
			finalControlledEvaluationReceiptCanonicalSha256:
				report.finalControlledEvaluationReceiptCanonicalSha256!,
			acceptedRulesCanonicalSha256: report.acceptedRulesCanonicalSha256!,
			repositorySkillTreeSha256: report.repositorySkillTreeSha256!,
			installedSkillTreeSha256: report.installedSkillTreeSha256!,
			sourceSetCanonicalSha256: report.sourceSetCanonicalSha256!,
			sentinelBundleCanonicalSha256: report.sentinelBundleCanonicalSha256!,
			assignedAt: report.assignedAt!
		};
		if (sha256Json(verification.receipt.bindings) !== sha256Json(expected))
			throw new Error('Existing sentinel receipt is stale against current evidence.');
		return { status: 'already-activated' as const, receipt: verification.receipt };
	}
	assertReady(await loadPrepared(workspaceRoot, false));
	const release = await acquireLock(workspaceRoot);
	try {
		await recoverTransaction(workspaceRoot);
		const prepared = await loadPrepared(workspaceRoot, false);
		assertReady(prepared);
		const artifacts = await preparedArtifacts(prepared);
		const transactionRoot = resolveRepositoryPath(workspaceRoot, TRANSACTION_ROOT);
		const payloadRoot = path.join(transactionRoot, 'payload');
		await mkdir(transactionRoot, { recursive: false });
		await mkdir(payloadRoot, { recursive: false });
		const intent = {
			schemaVersion: 'affinity-concurrency-sentinel-activation-intent-v1' as const,
			artifacts: artifacts.map((artifact, index) => ({
				kind: artifact.kind,
				livePath: artifact.livePath,
				canonicalSha256: artifact.canonicalSha256,
				byteSha256: artifact.byteSha256,
				payloadPath: `${TRANSACTION_ROOT}/payload/${String(index).padStart(2, '0')}.json`
			})),
			publishedPaths: [] as string[]
		};
		for (const [index, artifact] of artifacts.entries()) {
			const handle = await open(
				path.join(payloadRoot, `${String(index).padStart(2, '0')}.json`),
				'wx'
			);
			await handle.writeFile(artifact.text);
			await handle.sync();
			await handle.close();
		}
		await syncDirectory(payloadRoot);
		await writeJournal(path.join(transactionRoot, 'intent.json'), intent);
		try {
			for (const [index, artifact] of artifacts.entries()) {
				await assertNoSymlinkAncestor(workspaceRoot, artifact.livePath);
				const destination = resolveRepositoryPath(workspaceRoot, artifact.livePath);
				await mkdir(path.dirname(destination), { recursive: true });
				const source = path.join(payloadRoot, `${String(index).padStart(2, '0')}.json`);
				await link(source, destination);
				intent.publishedPaths.push(artifact.livePath);
				await writeJournal(path.join(transactionRoot, 'intent.json'), intent);
				if (options.failAfterPublished === index + 1)
					throw new Error(`Injected sentinel activation failure after ${index + 1} artifacts.`);
			}
			const report = prepared.report;
			const receiptArtifacts = artifacts
				.map(({ text: _text, ...artifact }) => artifact)
				.toSorted((left, right) => left.livePath.localeCompare(right.livePath));
			const artifactSetSha256 = sha256Json(receiptArtifacts);
			const receipt = ConcurrencySentinelActivationReceiptSchema.parse({
				schemaVersion: 'affinity-concurrency-sentinel-activation-receipt-v1',
				experimentId: 'affinity-workflow-v1',
				activationId: `concurrency-sentinels-${artifactSetSha256.slice(0, 16)}`,
				status: 'complete',
				completedAt: options.now?.() ?? new Date().toISOString(),
				actor,
				bindings: {
					allocationCanonicalSha256: report.allocationCanonicalSha256,
					finalControlledIntegrationReceiptCanonicalSha256:
						report.finalControlledIntegrationReceiptCanonicalSha256,
					finalControlledEvaluationReceiptCanonicalSha256:
						report.finalControlledEvaluationReceiptCanonicalSha256,
					acceptedRulesCanonicalSha256: report.acceptedRulesCanonicalSha256,
					repositorySkillTreeSha256: report.repositorySkillTreeSha256,
					installedSkillTreeSha256: report.installedSkillTreeSha256,
					sourceSetCanonicalSha256: report.sourceSetCanonicalSha256,
					sentinelBundleCanonicalSha256: report.sentinelBundleCanonicalSha256,
					assignedAt: report.assignedAt
				},
				targetCount: 14,
				assignmentCount: 14,
				artifactCount: 28,
				artifactSetSha256,
				artifacts: receiptArtifacts
			});
			const receiptText = await formattedJson(
				CONCURRENCY_SENTINEL_ACTIVATION_RECEIPT_PATH,
				receipt
			);
			const temporary = path.join(transactionRoot, 'receipt.json');
			const handle = await open(temporary, 'wx');
			await handle.writeFile(receiptText);
			await handle.sync();
			await handle.close();
			await link(temporary, receiptAbsolute);
			await syncDirectory(path.dirname(receiptAbsolute));
			await rm(transactionRoot, { recursive: true });
			return { status: 'activated' as const, receipt };
		} catch (error) {
			if (!(await exists(receiptAbsolute))) {
				await rollback(workspaceRoot, intent.artifacts, new Set(intent.publishedPaths));
				await rm(transactionRoot, { recursive: true });
			}
			throw error;
		}
	} finally {
		await release();
	}
}

export function parseActivateConcurrencySentinelArgs(args: readonly string[]) {
	let actor: string | null = null;
	let acknowledge = false;
	let separatorSeen = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index]!;
		if (argument === '--') {
			if (separatorSeen) throw new Error('Specify at most one -- argument separator.');
			separatorSeen = true;
			continue;
		}
		if (argument === '--acknowledge-live-sentinel-activation') {
			if (acknowledge) throw new Error('Specify activation acknowledgment exactly once.');
			acknowledge = true;
			continue;
		}
		if (argument === '--actor') {
			if (actor !== null) throw new Error('Specify --actor exactly once.');
			actor = args[index + 1]?.trim() || null;
			if (!actor || actor.startsWith('--')) throw new Error('Specify --actor <name>.');
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${argument}`);
	}
	return { actor, acknowledge };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	try {
		const parsed = parseActivateConcurrencySentinelArgs(process.argv.slice(2));
		const summary = await activateConcurrencySentinels({
			actor: parsed.actor ?? '',
			acknowledgeLiveSentinelActivation: parsed.acknowledge
		});
		process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
	} catch (error) {
		console.error(error);
		process.exitCode = 1;
	}
}
