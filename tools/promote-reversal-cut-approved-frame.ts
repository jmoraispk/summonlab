import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

const REVIEW_COMPLETION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v6/completion.json';
const PRIOR_ACTIVATION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/activation.json';
const FRAME_FEEDBACK_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4/owner-frame-feedback.json';
const RUN_ROOT = 'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v7';
const OWNER_REVIEW_PATH = `${RUN_ROOT}/owner-review.json`;
const ACTIVATION_PATH = `${RUN_ROOT}/activation.json`;
const COMPOSITE_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/masters/composites/martial-blade-reversal-cut.png';
const RECOGNITION_MASTER_PATH =
	'assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-reversal-cut.png';
const RUNTIME_PATHS = {
	512: 'apps/web/static/skill-icons/v1/512/martial-blade-reversal-cut.webp',
	256: 'apps/web/static/skill-icons/v1/256/martial-blade-reversal-cut.webp',
	128: 'apps/web/static/skill-icons/v1/128/martial-blade-reversal-cut.webp'
} as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const RelativePathSchema = z
	.string()
	.min(1)
	.refine(
		(value) => !path.isAbsolute(value) && !value.split('/').includes('..'),
		'Expected a safe workspace-relative path'
	);
const BoundFileSchema = z.object({ path: RelativePathSchema, contentHash: Sha256Schema });
const ImageAssetSchema = BoundFileSchema.extend({
	mediaType: z.enum(['image/png', 'image/webp']),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	alphaMode: z.enum(['rgb', 'rgba']),
	bytes: z.number().int().positive()
});
const ReviewCompletionSchema = z.object({
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
	outputs: z.object({
		frame: ImageAssetSchema,
		composite: ImageAssetSchema,
		recognition: ImageAssetSchema
	}),
	promotionStatus: z.literal('pending-owner-review'),
	runtimeUpdated: z.literal(false),
	selfPromoted: z.literal(false)
});
const PriorActivationSchema = z.object({
	activationId: z.literal('martial-blade-reversal-cut-activation-v2'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('approved-runtime'),
	compositeMaster: ImageAssetSchema,
	runtime: z.tuple([ImageAssetSchema, ImageAssetSchema, ImageAssetSchema]),
	recognition: ImageAssetSchema,
	selfPromoted: z.literal(false)
});
const FrameFeedbackSchema = z.object({
	targetId: z.literal('martial:blade:reversal-cut'),
	reviewerRole: z.literal('owner'),
	decision: z.literal('revise'),
	rejectedActivation: BoundFileSchema,
	rejectedComposite: BoundFileSchema
});

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function binding(pathname: string, bytes: Buffer) {
	return { path: pathname, contentHash: sha256(bytes) };
}

function asset(
	pathname: string,
	bytes: Buffer,
	mediaType: 'image/png' | 'image/webp',
	size: number
) {
	return {
		...binding(pathname, bytes),
		mediaType,
		width: size,
		height: size,
		alphaMode: 'rgba' as const,
		bytes: bytes.byteLength
	};
}

async function readBound(root: string, value: z.infer<typeof BoundFileSchema>): Promise<Buffer> {
	const bytes = await readFile(path.join(root, value.path));
	if (sha256(bytes) !== value.contentHash) throw new Error(`Bound input changed: ${value.path}`);
	return bytes;
}

async function renderRuntime(composite: Buffer, size: 512 | 256 | 128): Promise<Buffer> {
	return sharp(composite, { failOn: 'error' })
		.resize(size, size, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.ensureAlpha()
		.webp({ lossless: true, quality: 100, alphaQuality: 100, effort: 6 })
		.toBuffer();
}

interface PlannedOutput {
	readonly path: string;
	readonly bytes: Buffer;
	readonly replacedHash?: string;
}

async function writeAuthorized(root: string, output: PlannedOutput): Promise<boolean> {
	const destination = path.join(root, output.path);
	const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (current?.equals(output.bytes)) return false;
	if (current && sha256(current) !== output.replacedHash) {
		throw new Error(`Refusing to replace unbound runtime output ${output.path}`);
	}
	if (!current && output.replacedHash) {
		throw new Error(`Expected superseded runtime output is missing: ${output.path}`);
	}
	await mkdir(path.dirname(destination), { recursive: true });
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}`;
	try {
		await writeFile(temporary, output.bytes, { flag: 'wx' });
		await rename(temporary, destination);
	} catch (error) {
		await unlink(temporary).catch(() => undefined);
		throw error;
	}
	return true;
}

export async function promoteApprovedReversalCutFrame(options: {
	readonly root?: string;
	readonly mode: 'check' | 'write';
}): Promise<{
	readonly current: boolean;
	readonly written: readonly string[];
	readonly activationHash: string;
}> {
	const root = path.resolve(options.root ?? process.cwd());
	const [completionBytes, priorActivationBytes, frameFeedbackBytes] = await Promise.all([
		readFile(path.join(root, REVIEW_COMPLETION_PATH)),
		readFile(path.join(root, PRIOR_ACTIVATION_PATH)),
		readFile(path.join(root, FRAME_FEEDBACK_PATH))
	]);
	const completion = ReviewCompletionSchema.parse(JSON.parse(completionBytes.toString('utf8')));
	const priorActivation = PriorActivationSchema.parse(
		JSON.parse(priorActivationBytes.toString('utf8'))
	);
	const frameFeedback = FrameFeedbackSchema.parse(JSON.parse(frameFeedbackBytes.toString('utf8')));
	if (
		frameFeedback.rejectedActivation.path !== PRIOR_ACTIVATION_PATH ||
		frameFeedback.rejectedActivation.contentHash !== sha256(priorActivationBytes) ||
		frameFeedback.rejectedComposite.path !== priorActivation.compositeMaster.path ||
		frameFeedback.rejectedComposite.contentHash !== priorActivation.compositeMaster.contentHash
	) {
		throw new Error('Owner frame feedback does not bind the superseded runtime activation');
	}
	const [visualApproval, source, geometry, art, backing, frame, composite, recognition] =
		await Promise.all([
			readBound(root, completion.visualApproval),
			readBound(root, completion.authorities.source),
			readBound(root, completion.authorities.geometry),
			readBound(root, completion.authorities.approvedArtMaster),
			readBound(root, completion.authorities.backing),
			readBound(root, completion.outputs.frame),
			readBound(root, completion.outputs.composite),
			readBound(root, completion.outputs.recognition)
		]);
	void source;
	void geometry;
	void art;
	void backing;
	const [compositeMetadata, recognitionMetadata] = await Promise.all([
		sharp(composite).metadata(),
		sharp(recognition).metadata()
	]);
	if (
		compositeMetadata.format !== 'png' ||
		compositeMetadata.width !== 1024 ||
		compositeMetadata.height !== 1024 ||
		!compositeMetadata.hasAlpha ||
		recognitionMetadata.format !== 'png' ||
		recognitionMetadata.width !== 96 ||
		recognitionMetadata.height !== 96 ||
		!recognitionMetadata.hasAlpha
	) {
		throw new Error('Approved composite or recognition image has an invalid runtime envelope');
	}
	const [runtime512, runtime256, runtime128] = await Promise.all([
		renderRuntime(composite, 512),
		renderRuntime(composite, 256),
		renderRuntime(composite, 128)
	]);
	const review = {
		schemaVersion: 'skill-icon-composite-owner-review-v1',
		reviewId: 'reversal-cut-framed-composite-review-v1',
		targetId: completion.targetId,
		reviewer: 'project-owner',
		reviewerRole: 'owner',
		decision: 'accepted',
		reviewedAt: '2026-09-05T02:01:55.000Z',
		observation: 'approved',
		reviewedCompletion: binding(REVIEW_COMPLETION_PATH, completionBytes),
		visualApproval: binding(completion.visualApproval.path, visualApproval),
		approvedFrame: binding(completion.outputs.frame.path, frame),
		approvedCandidate: binding(completion.outputs.composite.path, composite),
		approvedRecognition: binding(completion.outputs.recognition.path, recognition),
		promotionScope: ['composite-master', 'runtime-size-ladder', 'recognition-master']
	};
	const reviewBytes = jsonBytes(review);
	const activation = {
		schemaVersion: 'skill-icon-approved-frame-activation-v1',
		activationId: 'martial-blade-reversal-cut-activation-v3',
		targetId: completion.targetId,
		status: 'approved-runtime',
		ownerReview: binding(OWNER_REVIEW_PATH, reviewBytes),
		approvedFrameReview: binding(REVIEW_COMPLETION_PATH, completionBytes),
		supersededActivation: binding(PRIOR_ACTIVATION_PATH, priorActivationBytes),
		approvedArtMaster: completion.authorities.approvedArtMaster,
		frameLayer: completion.outputs.frame,
		compositeMaster: asset(COMPOSITE_MASTER_PATH, composite, 'image/png', 1024),
		runtime: [
			asset(RUNTIME_PATHS[512], runtime512, 'image/webp', 512),
			asset(RUNTIME_PATHS[256], runtime256, 'image/webp', 256),
			asset(RUNTIME_PATHS[128], runtime128, 'image/webp', 128)
		],
		recognition: asset(RECOGNITION_MASTER_PATH, recognition, 'image/png', 96),
		runtimeUpdated: true,
		selfPromoted: false
	};
	const activationBytes = jsonBytes(activation);
	const priorRuntimeByPath = new Map(
		priorActivation.runtime.map((runtime) => [runtime.path, runtime.contentHash])
	);
	const priorRuntimeHash = (pathname: string): string => {
		const contentHash = priorRuntimeByPath.get(pathname);
		if (!contentHash) {
			throw new Error(`Superseded activation is missing runtime binding ${pathname}`);
		}
		return contentHash;
	};
	const outputs: PlannedOutput[] = [
		{
			path: COMPOSITE_MASTER_PATH,
			bytes: composite,
			replacedHash: priorActivation.compositeMaster.contentHash
		},
		{
			path: RUNTIME_PATHS[512],
			bytes: runtime512,
			replacedHash: priorRuntimeHash(RUNTIME_PATHS[512])
		},
		{
			path: RUNTIME_PATHS[256],
			bytes: runtime256,
			replacedHash: priorRuntimeHash(RUNTIME_PATHS[256])
		},
		{
			path: RUNTIME_PATHS[128],
			bytes: runtime128,
			replacedHash: priorRuntimeHash(RUNTIME_PATHS[128])
		},
		{
			path: RECOGNITION_MASTER_PATH,
			bytes: recognition,
			replacedHash: priorActivation.recognition.contentHash
		},
		{ path: OWNER_REVIEW_PATH, bytes: reviewBytes },
		{ path: ACTIVATION_PATH, bytes: activationBytes }
	];
	const written: string[] = [];
	for (const output of outputs) {
		const current = await readFile(path.join(root, output.path)).catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			}
		);
		if (options.mode === 'check') {
			if (!current?.equals(output.bytes)) {
				return { current: false, written, activationHash: sha256(activationBytes) };
			}
		} else if (await writeAuthorized(root, output)) {
			written.push(output.path);
		}
	}
	return { current: true, written, activationHash: sha256(activationBytes) };
}

const mode = process.argv[2];
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	if (mode !== '--write' && mode !== '--check') {
		throw new Error('Usage: tsx tools/promote-reversal-cut-approved-frame.ts --write|--check');
	}
	promoteApprovedReversalCutFrame({ mode: mode === '--write' ? 'write' : 'check' })
		.then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
