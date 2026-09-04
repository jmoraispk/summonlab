import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	AnySkillIconAssignmentSchema,
	AnySkillIconResultSchema,
	AnySkillIconTargetSchema,
	SkillIconReviewSchema
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import { SkillIconPromotionReceiptSchema } from './skill-icon-promotion-contract.js';

const RelativePathSchema = z
	.string()
	.min(1)
	.refine((value) => {
		return !path.isAbsolute(value) && !value.split('/').includes('..');
	}, 'Expected a workspace-relative path');

const BoundFileSchema = z.object({
	path: RelativePathSchema,
	contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
});

const ManifestSchema = z.object({
	schemaVersion: z.literal('skill-icon-additive-run-v1'),
	runId: z.literal('reversal-cut-v2'),
	canonicalAuthority: z.object({
		catalog: BoundFileSchema,
		motifMap: BoundFileSchema,
		visualSpecs: BoundFileSchema
	}),
	calibration: z.object({
		motifFamily: z.literal('blade.guard-flow'),
		cellMap: BoundFileSchema,
		target: BoundFileSchema,
		assignment: BoundFileSchema,
		exactPromptHash: z.string().regex(/^[a-f0-9]{64}$/u),
		candidatePath: RelativePathSchema,
		resultPath: RelativePathSchema
	}),
	individual: z.object({
		targetId: z.literal('martial:blade:reversal-cut'),
		status: z.literal('blocked-pending-owner-authorities')
	}),
	promotion: z.object({
		selfPromotionForbidden: z.literal(true),
		ownerReviewRequired: z.literal(true)
	})
});

const CompletionSchema = z.object({
	schemaVersion: z.literal('skill-icon-additive-run-completion-v1'),
	runId: z.literal('reversal-cut-v2'),
	manifest: BoundFileSchema,
	target: BoundFileSchema,
	assignment: BoundFileSchema,
	candidate: BoundFileSchema,
	result: BoundFileSchema,
	status: z.literal('candidate'),
	promotionStatus: z.literal('pending-owner-review'),
	individualStatus: z.literal('blocked-pending-owner-authorities')
});

const COMPLETION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2/completion.json';
const REVIEW_PATH =
	'assets/wiki/skills/icon-production-v1/review/decisions/calibration/blade-guard-flow-reversal-cut-v2.json';
const CALIBRATION_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/masters/calibration/blade-guard-flow.png';
const PROMOTION_RECEIPT_PATH =
	'assets/wiki/skills/icon-production-v1/promotion-receipts/blade-guard-flow-reversal-cut-v2.json';

function sha256(bytes: Buffer | string): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function readBound(root: string, binding: z.infer<typeof BoundFileSchema>): Promise<Buffer> {
	const bytes = await readFile(path.join(root, binding.path));
	if (sha256(bytes) !== binding.contentHash) throw new Error(`Hash mismatch for ${binding.path}`);
	return bytes;
}

export interface ReversalCutIconRunReport {
	readonly runId: 'reversal-cut-v2';
	readonly jobId: string;
	readonly status: 'candidate';
	readonly candidateHash: string;
	readonly selfPromoted: false;
	readonly ownerDecision: 'accepted';
	readonly calibrationStatus: 'approved';
	readonly individualStatus: 'blocked-pending-owner-authorities';
}

export async function checkReversalCutIconRun(root: string): Promise<ReversalCutIconRunReport> {
	const completion = CompletionSchema.parse(
		JSON.parse(await readFile(path.join(root, COMPLETION_PATH), 'utf8'))
	);
	const manifest = ManifestSchema.parse(
		JSON.parse((await readBound(root, completion.manifest)).toString('utf8'))
	);

	for (const binding of Object.values(manifest.canonicalAuthority)) await readBound(root, binding);
	await readBound(root, manifest.calibration.cellMap);

	if (
		completion.target.path !== manifest.calibration.target.path ||
		completion.target.contentHash !== manifest.calibration.target.contentHash ||
		completion.assignment.path !== manifest.calibration.assignment.path ||
		completion.assignment.contentHash !== manifest.calibration.assignment.contentHash ||
		completion.candidate.path !== manifest.calibration.candidatePath ||
		completion.result.path !== manifest.calibration.resultPath
	)
		throw new Error('Completion bindings diverge from the dispatch manifest');

	const target = AnySkillIconTargetSchema.parse(
		JSON.parse((await readBound(root, completion.target)).toString('utf8'))
	);
	const assignment = AnySkillIconAssignmentSchema.parse(
		JSON.parse((await readBound(root, completion.assignment)).toString('utf8'))
	);
	const candidate = await readBound(root, completion.candidate);
	const result = AnySkillIconResultSchema.parse(
		JSON.parse((await readBound(root, completion.result)).toString('utf8'))
	);
	const reviewBytes = await readFile(path.join(root, REVIEW_PATH));
	const review = SkillIconReviewSchema.parse(JSON.parse(reviewBytes.toString('utf8')));
	const receipt = SkillIconPromotionReceiptSchema.parse(
		JSON.parse(await readFile(path.join(root, PROMOTION_RECEIPT_PATH), 'utf8'))
	);
	const masterBytes = await readFile(path.join(root, CALIBRATION_MASTER_PATH));

	if (target.jobId !== assignment.jobId || target.jobId !== result.jobId)
		throw new Error('Target, assignment, and result job identities diverge');
	if (sha256(target.exactPrompt) !== manifest.calibration.exactPromptHash)
		throw new Error('Exact prompt hash diverges from the manifest');
	if (result.status !== 'candidate' || !result.output)
		throw new Error('Expected a retained candidate result');
	if (
		result.output.path !== completion.candidate.path ||
		result.output.contentHash !== sha256(candidate)
	)
		throw new Error('Result output does not bind the retained candidate');
	if (result.selfPromoted !== false) throw new Error('Producer result must not self-promote');
	if (
		review.jobId !== target.jobId ||
		review.candidatePath !== completion.candidate.path ||
		review.candidateHash !== completion.candidate.contentHash ||
		review.decision !== 'accepted'
	)
		throw new Error('Owner review does not accept the retained revision 2 candidate');
	if (
		receipt.jobId !== target.jobId ||
		receipt.candidate.path !== completion.candidate.path ||
		receipt.candidate.contentHash !== completion.candidate.contentHash ||
		receipt.master.path !== CALIBRATION_MASTER_PATH ||
		receipt.master.contentHash !== sha256(masterBytes) ||
		receipt.review.path !== REVIEW_PATH ||
		receipt.review.contentHash !== sha256(reviewBytes) ||
		receipt.result.path !== completion.result.path ||
		receipt.result.contentHash !== completion.result.contentHash
	)
		throw new Error('Calibration promotion receipt does not bind the accepted candidate');

	return {
		runId: completion.runId,
		jobId: target.jobId,
		status: completion.status,
		candidateHash: completion.candidate.contentHash,
		selfPromoted: false,
		ownerDecision: review.decision,
		calibrationStatus: 'approved',
		individualStatus: completion.individualStatus
	};
}

async function runCli(): Promise<void> {
	process.stdout.write(
		`${JSON.stringify(await checkReversalCutIconRun(process.cwd()), null, 2)}\n`
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli().catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
