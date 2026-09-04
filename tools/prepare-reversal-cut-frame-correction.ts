import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import { AnySkillIconGeometrySchema } from '../packages/contracts/src/index.js';
import {
	extractReversalCutFrameLayer,
	renderReversalCutRuntimeIconFromLayers
} from './activate-reversal-cut-runtime-icon.js';

const RUN_ROOT = 'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v4';
const FEEDBACK_PATH = `${RUN_ROOT}/owner-frame-feedback.json`;
const CORRECTION_PATH = `${RUN_ROOT}/correction.json`;
const BACKING_PATH = `${RUN_ROOT}/presentation/charcoal-backing.png`;
const FRAME_PATH = `${RUN_ROOT}/presentation/rarity-frame-a.png`;
const COMPOSITE_PATH = `${RUN_ROOT}/candidates/martial-blade-reversal-cut-framed-v1.png`;
const RECOGNITION_PATH = `${RUN_ROOT}/review/martial-blade-reversal-cut-framed-96.png`;
const PRIOR_ACTIVATION_PATH =
	'assets/wiki/skills/icon-production-v2/runs/reversal-cut-v3/activation.json';
const MASS_MANIFEST_PATH = 'assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json';
const FRAME_SOURCE_PATH =
	'assets/wiki/skills/icon-production-v1/mass-production-v1/icons/martial-blade-void-cut.png';
const GEOMETRY_PATH = 'assets/wiki/skills/icon-production-v1/geometry-v2.json';

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const BoundFileSchema = z.object({ path: z.string().min(1), contentHash: Sha256Schema });
const FeedbackSchema = z.object({
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
const PriorActivationSchema = z.object({
	activationId: z.literal('martial-blade-reversal-cut-activation-v2'),
	targetId: z.literal('martial:blade:reversal-cut'),
	status: z.literal('approved-runtime'),
	approvedArtMaster: BoundFileSchema,
	compositeMaster: BoundFileSchema,
	selfPromoted: z.literal(false)
});
const MassManifestSchema = z.object({
	runId: z.literal('full-catalog-v1'),
	completionState: z.literal('complete'),
	authorities: z.object({
		frameSheet: BoundFileSchema,
		geometry: BoundFileSchema
	}),
	skills: z.array(
		z.object({
			targetId: z.string(),
			rarity: z.string(),
			finalImagePath: z.string(),
			finalImageHash: Sha256Schema,
			status: z.string()
		})
	)
});

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function binding(pathname: string, bytes: Buffer) {
	return { path: pathname, contentHash: sha256(bytes) };
}

function imageBinding(pathname: string, bytes: Buffer, size: 1024 | 96) {
	return {
		...binding(pathname, bytes),
		mediaType: 'image/png',
		width: size,
		height: size,
		alphaMode: 'rgba',
		bytes: bytes.byteLength
	};
}

async function readBound(root: string, value: z.infer<typeof BoundFileSchema>): Promise<Buffer> {
	if (path.isAbsolute(value.path) || value.path.split('/').includes('..')) {
		throw new Error(`Unsafe frame-correction authority path ${value.path}`);
	}
	const bytes = await readFile(path.join(root, value.path));
	if (sha256(bytes) !== value.contentHash) {
		throw new Error(`Frame-correction authority changed: ${value.path}`);
	}
	return bytes;
}

async function renderBacking(): Promise<Buffer> {
	return sharp(
		Buffer.from(`<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
			<defs><radialGradient id="backing"><stop stop-color="#25282b"/><stop offset=".7" stop-color="#111315"/><stop offset="1" stop-color="#08090b"/></radialGradient></defs>
			<path d="M512 107 858 310 858 714 512 917 166 714 166 310Z" fill="url(#backing)"/>
		</svg>`)
	)
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
}

export async function prepareReversalCutFrameCorrection(options: {
	readonly root?: string;
	readonly mode: 'check' | 'write';
}): Promise<{
	readonly current: boolean;
	readonly written: readonly string[];
	readonly correctionHash: string;
}> {
	if (options.mode === 'write') {
		throw new Error(
			'Decommissioned: a complete skill icon cannot be used to regenerate a reusable rarity frame'
		);
	}
	const root = path.resolve(options.root ?? process.cwd());
	const [feedbackBytes, priorActivationBytes, manifestBytes, geometryBytes] = await Promise.all([
		readFile(path.join(root, FEEDBACK_PATH)),
		readFile(path.join(root, PRIOR_ACTIVATION_PATH)),
		readFile(path.join(root, MASS_MANIFEST_PATH)),
		readFile(path.join(root, GEOMETRY_PATH))
	]);
	const feedback = FeedbackSchema.parse(JSON.parse(feedbackBytes.toString('utf8')));
	const prior = PriorActivationSchema.parse(JSON.parse(priorActivationBytes.toString('utf8')));
	const manifest = MassManifestSchema.parse(JSON.parse(manifestBytes.toString('utf8')));
	const geometry = AnySkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
	if (
		feedback.rejectedActivation.path !== PRIOR_ACTIVATION_PATH ||
		feedback.rejectedActivation.contentHash !== sha256(priorActivationBytes) ||
		feedback.rejectedComposite.path !== prior.compositeMaster.path ||
		feedback.rejectedComposite.contentHash !== prior.compositeMaster.contentHash ||
		feedback.requiredFrameAuthority.path !== manifest.authorities.frameSheet.path ||
		feedback.requiredFrameAuthority.contentHash !== manifest.authorities.frameSheet.contentHash ||
		manifest.authorities.geometry.path !== GEOMETRY_PATH ||
		manifest.authorities.geometry.contentHash !== sha256(geometryBytes)
	) {
		throw new Error('Owner frame feedback does not bind the rejected output and current authority');
	}
	await Promise.all([
		readBound(root, feedback.rejectedComposite),
		readBound(root, feedback.requiredFrameAuthority)
	]);
	const exemplar = manifest.skills.find((skill) => skill.targetId === 'martial:blade:void-cut');
	if (
		!exemplar ||
		exemplar.rarity !== 'A' ||
		exemplar.status !== 'candidate' ||
		exemplar.finalImagePath !== FRAME_SOURCE_PATH
	) {
		throw new Error('The full-catalog A-rank Blade frame exemplar is unavailable');
	}
	const [art, frameSource] = await Promise.all([
		readBound(root, prior.approvedArtMaster),
		readFile(path.join(root, FRAME_SOURCE_PATH))
	]);
	if (sha256(frameSource) !== exemplar.finalImageHash) {
		throw new Error('A-rank Blade frame exemplar changed from the full-catalog manifest');
	}
	const [backing, frame] = await Promise.all([
		renderBacking(),
		extractReversalCutFrameLayer(frameSource, geometry)
	]);
	const [composite, recognition] = await Promise.all([
		renderReversalCutRuntimeIconFromLayers(backing, art, frame, 1024),
		renderReversalCutRuntimeIconFromLayers(backing, art, frame, 96)
	]);
	const correction = {
		schemaVersion: 'skill-icon-frame-correction-v1',
		correctionId: 'martial-blade-reversal-cut-frame-correction-v1',
		targetId: feedback.targetId,
		status: 'candidate',
		feedback: binding(FEEDBACK_PATH, feedbackBytes),
		priorActivation: binding(PRIOR_ACTIVATION_PATH, priorActivationBytes),
		approvedArtMaster: prior.approvedArtMaster,
		frameAuthority: {
			approvedSheet: feedback.requiredFrameAuthority,
			massManifest: binding(MASS_MANIFEST_PATH, manifestBytes),
			geometry: binding(GEOMETRY_PATH, geometryBytes),
			exemplar: binding(FRAME_SOURCE_PATH, frameSource),
			extractionProfile: 'full-catalog-a-frame-outer-layer-v1'
		},
		outputs: {
			backing: imageBinding(BACKING_PATH, backing, 1024),
			frame: imageBinding(FRAME_PATH, frame, 1024),
			composite: imageBinding(COMPOSITE_PATH, composite, 1024),
			recognition: imageBinding(RECOGNITION_PATH, recognition, 96)
		},
		promotionStatus: 'pending-owner-review',
		runtimeUpdated: false,
		selfPromoted: false
	};
	const correctionBytes = Buffer.from(`${JSON.stringify(correction, null, '\t')}\n`);
	const outputs = [
		{ path: BACKING_PATH, bytes: backing },
		{ path: FRAME_PATH, bytes: frame },
		{ path: COMPOSITE_PATH, bytes: composite },
		{ path: RECOGNITION_PATH, bytes: recognition },
		{ path: CORRECTION_PATH, bytes: correctionBytes }
	];
	const written: string[] = [];
	for (const output of outputs) {
		const destination = path.join(root, output.path);
		const current = await readFile(destination).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (!current?.equals(output.bytes)) {
			return { current: false, written, correctionHash: sha256(correctionBytes) };
		}
	}
	return { current: true, written, correctionHash: sha256(correctionBytes) };
}

const mode = process.argv[2];
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	if (mode !== '--write' && mode !== '--check') {
		throw new Error('Usage: tsx tools/prepare-reversal-cut-frame-correction.ts --write|--check');
	}
	prepareReversalCutFrameCorrection({ mode: mode === '--write' ? 'write' : 'check' })
		.then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
		.catch((error: unknown) => {
			process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
			process.exitCode = 1;
		});
}
