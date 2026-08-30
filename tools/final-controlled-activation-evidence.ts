import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import { AFFINITY_EXPERIMENT_ROOT, sha256Json } from './image-production-lib.js';

const Hash = z.string().regex(/^[a-f0-9]{64}$/u);
const RepositoryPath = z.string().min(1);

export const FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-activation-receipt.json` as const;

export const FinalControlledActivationArtifactSchema = z
	.object({
		kind: z.enum(['target', 'assignment']),
		livePath: RepositoryPath,
		canonicalSha256: Hash,
		byteSha256: Hash,
		source: z.enum(['derived', 'staged'])
	})
	.strict();

export const FinalControlledActivationReceiptSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-activation-receipt-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		activationId: z.string().regex(/^final-controlled-[a-f0-9]{16}$/u),
		status: z.literal('complete'),
		completedAt: z.iso.datetime(),
		bindings: z
			.object({
				planCanonicalSha256: Hash,
				resolutionLedgerCanonicalSha256: Hash,
				blindReviewCanonicalSha256: Hash,
				catalogCanonicalSha256: Hash,
				executionSnapshotSha256: Hash
			})
			.strict(),
		targetCount: z.literal(24),
		assignmentCount: z.literal(24),
		artifactCount: z.literal(48),
		artifactSetSha256: Hash,
		artifacts: z.array(FinalControlledActivationArtifactSchema).length(48)
	})
	.strict()
	.superRefine((receipt, context) => {
		if (new Set(receipt.artifacts.map((artifact) => artifact.livePath)).size !== 48)
			context.addIssue({ code: 'custom', path: ['artifacts'], message: 'Paths must be unique' });
		if (receipt.artifacts.filter((artifact) => artifact.kind === 'target').length !== 24)
			context.addIssue({ code: 'custom', path: ['artifacts'], message: 'Expected 24 targets' });
		if (receipt.artifacts.filter((artifact) => artifact.kind === 'assignment').length !== 24)
			context.addIssue({ code: 'custom', path: ['artifacts'], message: 'Expected 24 assignments' });
	});

export type FinalControlledActivationReceipt = z.infer<
	typeof FinalControlledActivationReceiptSchema
>;

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

export async function verifyFinalControlledActivationArtifacts(
	workspaceRoot: string,
	artifacts: FinalControlledActivationReceipt['artifacts']
): Promise<string[]> {
	const issues: string[] = [];
	for (const artifact of artifacts) {
		try {
			await assertNoSymlinkAncestor(workspaceRoot, artifact.livePath);
			const absolute = resolveRepositoryPath(workspaceRoot, artifact.livePath);
			const metadata = await lstat(absolute);
			if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('not a regular file');
			const bytes = await readFile(absolute);
			if (createHash('sha256').update(bytes).digest('hex') !== artifact.byteSha256)
				throw new Error('byte hash differs');
			const value: unknown = JSON.parse(bytes.toString('utf8'));
			if (sha256Json(value) !== artifact.canonicalSha256) throw new Error('canonical hash differs');
			if (artifact.kind === 'target') ImageProductionTargetSchema.parse(value);
			else ImageProductionAssignmentSchema.parse(value);
		} catch (error) {
			issues.push(
				`${artifact.livePath}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	return issues;
}

export async function verifyFinalControlledActivationReceipt(
	workspaceRoot = process.cwd(),
	expectedPlanCanonicalSha256?: string
): Promise<{ valid: boolean; receipt?: FinalControlledActivationReceipt; issues: string[] }> {
	const issues: string[] = [];
	let receipt: FinalControlledActivationReceipt;
	try {
		await assertNoSymlinkAncestor(workspaceRoot, FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH);
		const receiptPath = resolveRepositoryPath(
			workspaceRoot,
			FINAL_CONTROLLED_ACTIVATION_RECEIPT_PATH
		);
		const metadata = await lstat(receiptPath);
		if (!metadata.isFile() || metadata.isSymbolicLink())
			throw new Error('Receipt is not a regular file');
		receipt = FinalControlledActivationReceiptSchema.parse(
			JSON.parse(await readFile(receiptPath, 'utf8'))
		);
	} catch (error) {
		return {
			valid: false,
			issues: [
				`Activation receipt unavailable or invalid: ${error instanceof Error ? error.message : String(error)}`
			]
		};
	}
	if (
		expectedPlanCanonicalSha256 &&
		receipt.bindings.planCanonicalSha256 !== expectedPlanCanonicalSha256
	)
		issues.push('Activation receipt is bound to a different final-controlled plan.');
	if (sha256Json(receipt.artifacts) !== receipt.artifactSetSha256)
		issues.push('Activation receipt artifact-set hash is invalid.');
	issues.push(
		...(await verifyFinalControlledActivationArtifacts(workspaceRoot, receipt.artifacts))
	);
	return { valid: issues.length === 0, receipt, issues };
}
