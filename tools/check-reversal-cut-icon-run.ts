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
const INDIVIDUAL_ATTEMPT_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v2/individual-attempt-v1.json';
const ACTIVATION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/activation.json';
const OWNER_REVIEW_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/owner-review.json';
const FRAME_CORRECTION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/correction.json';
const FRAME_FEEDBACK_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/owner-frame-feedback.json';
const APPROVED_FRAME_COMPLETION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/completion.json';
const APPROVED_FRAME_OWNER_REVIEW_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/owner-review.json';
const APPROVED_FRAME_ACTIVATION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7/activation.json';

const ActivationAssetSchema = BoundFileSchema.extend({
	mediaType: z.enum(['image/png', 'image/webp']),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	alphaMode: z.literal('rgba'),
	bytes: z.number().int().positive()
});

const ActivationSchema = z.object({
	schemaVersion: z.literal('skill-icon-accepted-source-activation-v1'),
	activationId: z.literal('martial-blade-reversal-cut-activation-v2'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('approved-runtime'),
	review: BoundFileSchema,
	providerSource: BoundFileSchema.extend({
		mediaType: z.literal('image/png'),
		width: z.literal(1254),
		height: z.literal(1254),
		alphaMode: z.literal('rgb'),
		bytes: z.number().int().positive()
	}),
	candidate: ActivationAssetSchema,
	approvedArtMaster: ActivationAssetSchema,
	compositeMaster: ActivationAssetSchema,
	runtime: z.tuple([ActivationAssetSchema, ActivationAssetSchema, ActivationAssetSchema]),
	recognition: ActivationAssetSchema,
	selfPromoted: z.literal(false)
});

const FrameCorrectionSchema = z.object({
	schemaVersion: z.literal('skill-icon-frame-correction-v1'),
	correctionId: z.literal('martial-blade-reversal-cut-frame-correction-v1'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('candidate'),
	feedback: BoundFileSchema,
	priorActivation: BoundFileSchema,
	approvedArtMaster: BoundFileSchema,
	frameAuthority: z.object({
		approvedSheet: BoundFileSchema,
		massManifest: BoundFileSchema,
		geometry: BoundFileSchema,
		exemplar: BoundFileSchema,
		extractionProfile: z.literal('full-catalog-a-frame-outer-layer-v1')
	}),
	outputs: z.object({
		backing: ActivationAssetSchema,
		frame: ActivationAssetSchema,
		composite: ActivationAssetSchema,
		recognition: ActivationAssetSchema
	}),
	promotionStatus: z.literal('pending-owner-review'),
	runtimeUpdated: z.literal(false),
	selfPromoted: z.literal(false)
});

const FrameFeedbackSchema = z.object({
	schemaVersion: z.literal('skill-icon-frame-feedback-v1'),
	feedbackId: z.literal('reversal-cut-frame-feedback-v1'),
	targetId: z.literal('martial:blade:reversal-cut'),
	reviewerRole: z.literal('owner'),
	decision: z.literal('revise'),
	observation: z.literal('The skill frame is wrong.'),
	rejectedActivation: BoundFileSchema,
	rejectedComposite: BoundFileSchema,
	requiredFrameAuthority: BoundFileSchema
});

const ApprovedFrameCompletionSchema = z.object({
	schemaVersion: z.literal('skill-icon-approved-frame-review-v1'),
	runId: z.literal('reversal-cut-v6'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('candidate'),
	visualApproval: BoundFileSchema,
	authorities: z.object({
		source: BoundFileSchema,
		geometry: BoundFileSchema,
		approvedArtMaster: BoundFileSchema,
		backing: BoundFileSchema
	}),
	registration: z.object({
		profile: z.literal('owner-selected-a-frame-centered-scale-mask-v1'),
		scale: z.literal(1.14),
		canvas: z.tuple([z.literal(1024), z.literal(1024)]),
		matte: z.literal('#00FF00'),
		normalizationProfile: z.literal('skill-icon-green-key-role-mask-v3'),
		geometryDisposition: z.literal('canonical-role-mask-applied-after-centered-registration')
	}),
	inspection: z.object({
		contentHash: z.string().regex(/^[a-f0-9]{64}$/u),
		violations: z.array(z.string()).length(0)
	}),
	outputs: z.object({
		frame: ActivationAssetSchema,
		composite: ActivationAssetSchema,
		recognition: ActivationAssetSchema
	}),
	promotionStatus: z.literal('pending-owner-review'),
	runtimeUpdated: z.literal(false),
	selfPromoted: z.literal(false),
	supersedes: z.literal(
		'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/correction.json'
	)
});

const ApprovedFrameVisualReviewSchema = z.object({
	schemaVersion: z.literal('skill-icon-frame-visual-approval-v1'),
	approvalId: z.literal('reversal-cut-a-frame-visual-approval-v1'),
	targetId: z.literal('martial:blade:reversal-cut'),
	reviewerRole: z.literal('owner'),
	decision: z.literal('accepted'),
	acceptedSource: ActivationAssetSchema.extend({
		width: z.literal(1254),
		height: z.literal(1254),
		alphaMode: z.literal('rgb')
	})
});

const ApprovedFrameOwnerReviewSchema = z.object({
	schemaVersion: z.literal('skill-icon-composite-owner-review-v1'),
	reviewId: z.literal('reversal-cut-framed-composite-review-v1'),
	targetId: z.literal('martial:blade:reversal-cut'),
	reviewerRole: z.literal('owner'),
	decision: z.literal('accepted'),
	reviewedCompletion: BoundFileSchema,
	visualApproval: BoundFileSchema,
	approvedFrame: BoundFileSchema,
	approvedCandidate: BoundFileSchema,
	approvedRecognition: BoundFileSchema,
	promotionScope: z.tuple([
		z.literal('composite-master'),
		z.literal('runtime-size-ladder'),
		z.literal('recognition-master')
	])
});

const ApprovedFrameActivationSchema = z.object({
	schemaVersion: z.literal('skill-icon-approved-frame-activation-v1'),
	activationId: z.literal('martial-blade-reversal-cut-activation-v3'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('approved-runtime'),
	ownerReview: BoundFileSchema,
	approvedFrameReview: BoundFileSchema,
	supersededActivation: BoundFileSchema,
	approvedArtMaster: BoundFileSchema,
	frameLayer: ActivationAssetSchema,
	compositeMaster: ActivationAssetSchema,
	runtime: z.tuple([ActivationAssetSchema, ActivationAssetSchema, ActivationAssetSchema]),
	recognition: ActivationAssetSchema,
	runtimeUpdated: z.literal(true),
	selfPromoted: z.literal(false)
});

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
	readonly individualStatus: 'failed-provider-envelope';
	readonly individualJobId: 'martial-blade-reversal-cut-v1';
	readonly individualAttemptCount: 2;
	readonly previousActivationStatus: 'rejected-frame';
	readonly previousActivationId: 'martial-blade-reversal-cut-activation-v2';
	readonly activationStatus: 'approved-runtime';
	readonly activationId: 'martial-blade-reversal-cut-activation-v3';
	readonly correctionStatus: 'superseded';
	readonly correctionId: 'martial-blade-reversal-cut-frame-correction-v1';
	readonly frameCandidateStatus: 'candidate';
	readonly frameCandidateRunId: 'reversal-cut-v6';
	readonly frameVisualDecision: 'accepted';
	readonly framePromotionStatus: 'approved-runtime';
	readonly approvedFrameHash: string;
	readonly runtimeUpdated: true;
	readonly runtimeSizes: readonly [512, 256, 128];
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
	const activationBytes = await readFile(path.join(root, ACTIVATION_PATH));
	const activation = ActivationSchema.parse(JSON.parse(activationBytes.toString('utf8')));
	const correction = FrameCorrectionSchema.parse(
		JSON.parse(await readFile(path.join(root, FRAME_CORRECTION_PATH), 'utf8'))
	);
	const approvedFrameBytes = await readFile(path.join(root, APPROVED_FRAME_COMPLETION_PATH));
	const approvedFrame = ApprovedFrameCompletionSchema.parse(
		JSON.parse(approvedFrameBytes.toString('utf8'))
	);
	const approvedActivationBytes = await readFile(path.join(root, APPROVED_FRAME_ACTIVATION_PATH));
	const approvedActivation = ApprovedFrameActivationSchema.parse(
		JSON.parse(approvedActivationBytes.toString('utf8'))
	);
	const receipt = SkillIconPromotionReceiptSchema.parse(
		JSON.parse(await readFile(path.join(root, PROMOTION_RECEIPT_PATH), 'utf8'))
	);
	const masterBytes = await readFile(path.join(root, CALIBRATION_MASTER_PATH));
	const individualAttempt = z
		.object({
			schemaVersion: z.literal('skill-icon-additive-individual-attempt-v1'),
			runId: z.literal('reversal-cut-v2'),
			jobId: z.literal('martial-blade-reversal-cut-v1'),
			status: z.literal('failed-provider-envelope'),
			attemptCount: z.literal(2),
			target: BoundFileSchema,
			assignment: BoundFileSchema,
			result: BoundFileSchema,
			catalog: BoundFileSchema,
			lineageAuthority: BoundFileSchema,
			providerObservations: z
				.array(
					z.object({
						attempt: z.number().int().min(1).max(2),
						mediaType: z.literal('image/png'),
						width: z.literal(1254),
						height: z.literal(1254),
						alphaMode: z.literal('rgb'),
						bytes: z.number().int().positive(),
						contentHash: z.string().regex(/^[a-f0-9]{64}$/u)
					})
				)
				.length(2),
			candidatePath: z.null(),
			ownerFeedbackRequestedOn: z.literal('corrected visual design only')
		})
		.strict()
		.parse(JSON.parse(await readFile(path.join(root, INDIVIDUAL_ATTEMPT_PATH), 'utf8')));
	const [individualTarget, individualAssignment, individualResult] = await Promise.all([
		readBound(root, individualAttempt.target).then((bytes) =>
			AnySkillIconTargetSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readBound(root, individualAttempt.assignment).then((bytes) =>
			AnySkillIconAssignmentSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readBound(root, individualAttempt.result).then((bytes) =>
			AnySkillIconResultSchema.parse(JSON.parse(bytes.toString('utf8')))
		)
	]);
	await readBound(root, individualAttempt.catalog);
	await readBound(root, individualAttempt.lineageAuthority);
	const [ownerReviewBytes] = await Promise.all([
		readBound(root, activation.review),
		readBound(root, activation.providerSource),
		readBound(root, activation.candidate),
		readBound(root, activation.approvedArtMaster)
	]);
	if (
		activation.review.path !== OWNER_REVIEW_PATH ||
		activation.review.contentHash !== sha256(ownerReviewBytes)
	) {
		throw new Error('Runtime activation does not bind the accepted owner review');
	}
	if (activation.runtime.map(({ width }) => width).join(',') !== '512,256,128') {
		throw new Error('Runtime activation does not publish the required size ladder');
	}
	const [frameFeedbackBytes] = await Promise.all([
		readBound(root, correction.feedback),
		readBound(root, correction.approvedArtMaster),
		readBound(root, correction.frameAuthority.approvedSheet),
		readBound(root, correction.frameAuthority.massManifest),
		readBound(root, correction.frameAuthority.geometry),
		readBound(root, correction.frameAuthority.exemplar),
		readBound(root, correction.outputs.backing),
		readBound(root, correction.outputs.frame),
		readBound(root, correction.outputs.composite),
		readBound(root, correction.outputs.recognition)
	]);
	const frameFeedback = FrameFeedbackSchema.parse(JSON.parse(frameFeedbackBytes.toString('utf8')));
	const [approvedFrameReviewBytes] = await Promise.all([
		readBound(root, approvedFrame.visualApproval),
		readBound(root, approvedFrame.authorities.source),
		readBound(root, approvedFrame.authorities.geometry),
		readBound(root, approvedFrame.authorities.approvedArtMaster),
		readBound(root, approvedFrame.authorities.backing),
		readBound(root, approvedFrame.outputs.frame),
		readBound(root, approvedFrame.outputs.composite),
		readBound(root, approvedFrame.outputs.recognition)
	]);
	const approvedFrameReview = ApprovedFrameVisualReviewSchema.parse(
		JSON.parse(approvedFrameReviewBytes.toString('utf8'))
	);
	const [approvedOwnerReviewBytes] = await Promise.all([
		readBound(root, approvedActivation.ownerReview),
		readBound(root, approvedActivation.approvedFrameReview),
		readBound(root, approvedActivation.supersededActivation),
		readBound(root, approvedActivation.approvedArtMaster),
		readBound(root, approvedActivation.frameLayer),
		readBound(root, approvedActivation.compositeMaster),
		...approvedActivation.runtime.map((runtime) => readBound(root, runtime)),
		readBound(root, approvedActivation.recognition)
	]);
	const approvedOwnerReview = ApprovedFrameOwnerReviewSchema.parse(
		JSON.parse(approvedOwnerReviewBytes.toString('utf8'))
	);
	if (
		approvedFrameReview.targetId !== approvedFrame.targetId ||
		approvedFrameReview.acceptedSource.path !== approvedFrame.authorities.source.path ||
		approvedFrameReview.acceptedSource.contentHash !==
			approvedFrame.authorities.source.contentHash ||
		approvedFrame.inspection.contentHash !== approvedFrame.outputs.frame.contentHash ||
		approvedFrame.supersedes !== FRAME_CORRECTION_PATH
	) {
		throw new Error(
			'Approved A-frame review does not bind its source, output, and superseded correction'
		);
	}
	if (
		approvedActivation.ownerReview.path !== APPROVED_FRAME_OWNER_REVIEW_PATH ||
		approvedActivation.approvedFrameReview.path !== APPROVED_FRAME_COMPLETION_PATH ||
		approvedActivation.approvedFrameReview.contentHash !== sha256(approvedFrameBytes) ||
		approvedActivation.supersededActivation.path !== ACTIVATION_PATH ||
		approvedActivation.supersededActivation.contentHash !== sha256(activationBytes) ||
		approvedActivation.frameLayer.contentHash !== approvedFrame.outputs.frame.contentHash ||
		approvedOwnerReview.reviewedCompletion.contentHash !== sha256(approvedFrameBytes) ||
		approvedOwnerReview.approvedCandidate.contentHash !==
			approvedActivation.compositeMaster.contentHash ||
		approvedOwnerReview.approvedFrame.contentHash !== approvedActivation.frameLayer.contentHash ||
		approvedOwnerReview.approvedRecognition.contentHash !==
			approvedActivation.recognition.contentHash ||
		approvedActivation.runtime.map(({ width }) => width).join(',') !== '512,256,128'
	) {
		throw new Error(
			'Approved A-frame activation does not bind the owner review and runtime outputs'
		);
	}
	if (
		correction.feedback.path !== FRAME_FEEDBACK_PATH ||
		correction.priorActivation.path !== ACTIVATION_PATH ||
		correction.priorActivation.contentHash !== sha256(activationBytes) ||
		frameFeedback.rejectedActivation.path !== ACTIVATION_PATH ||
		frameFeedback.rejectedActivation.contentHash !== sha256(activationBytes) ||
		frameFeedback.rejectedComposite.path !== activation.compositeMaster.path ||
		frameFeedback.rejectedComposite.contentHash !== activation.compositeMaster.contentHash ||
		frameFeedback.requiredFrameAuthority.path !== correction.frameAuthority.approvedSheet.path ||
		frameFeedback.requiredFrameAuthority.contentHash !==
			correction.frameAuthority.approvedSheet.contentHash
	) {
		throw new Error('Frame correction does not supersede the rejected presentation authority');
	}
	if (
		individualTarget.jobId !== individualAttempt.jobId ||
		individualAssignment.jobId !== individualAttempt.jobId ||
		individualResult.jobId !== individualAttempt.jobId ||
		individualResult.status !== 'failed' ||
		individualResult.output !== null ||
		individualResult.failureReason?.kind !== 'validation'
	)
		throw new Error('Individual attempt evidence does not bind the failed provider envelope');

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
		individualStatus: individualAttempt.status,
		individualJobId: individualAttempt.jobId,
		individualAttemptCount: individualAttempt.attemptCount,
		previousActivationStatus: 'rejected-frame',
		previousActivationId: activation.activationId,
		activationStatus: approvedActivation.status,
		activationId: approvedActivation.activationId,
		correctionStatus: 'superseded',
		correctionId: correction.correctionId,
		frameCandidateStatus: approvedFrame.status,
		frameCandidateRunId: approvedFrame.runId,
		frameVisualDecision: approvedFrameReview.decision,
		framePromotionStatus: approvedActivation.status,
		approvedFrameHash: approvedFrame.outputs.frame.contentHash,
		runtimeUpdated: approvedActivation.runtimeUpdated,
		runtimeSizes: [512, 256, 128]
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
