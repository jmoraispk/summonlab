import { constants } from 'node:fs';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { lstat, mkdir, open, readdir, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import {
	SkillIconAssignmentSchema,
	SkillIconExecutionSchema,
	SkillIconRecordSchema,
	SkillIconResultSchema,
	SkillIconReviewSchema,
	SkillIconTargetSchema,
	type SkillIconAsset,
	type SkillIconReview,
	type SkillIconRole,
	type SkillIconTarget
} from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_CATALOG_PATH,
	SKILL_ICON_MOTIF_SOURCE_PATH,
	SKILL_ICON_VISUAL_SPECS_PATH,
	exportSkillIconProduction
} from './export-skill-icon-production.js';
import { loadSkillIconGeometry } from './export-skill-icon-geometry.js';
import {
	buildSkillIconCatalog,
	loadCanonicalSkillRows,
	parseAcceptedMotifMap,
	type SkillIconVisualSpecs
} from './skill-icon-production-lib.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

export interface SkillIconAssetRecord {
	readonly jobId: string;
	readonly role: SkillIconRole;
	readonly skillTargetId: string | null;
	readonly candidate: SkillIconAsset;
	readonly approvedMaster: SkillIconAsset;
	readonly resultPath: string;
	readonly reviewPath: string;
	readonly resultContentHash: string;
	readonly reviewContentHash: string;
	readonly review: SkillIconReview;
	readonly transactionId: string;
	readonly promotionReceipt: { readonly path: string; readonly contentHash: string };
}

export const SKILL_ICON_PROMOTION_LOCK_PATH =
	'assets/wiki/skills/icon-production-v1/.promotion.lock' as const;
export const SKILL_ICON_PROMOTION_JOURNAL_PATH =
	'assets/wiki/skills/icon-production-v1/.promotion-transaction.json' as const;
export const SKILL_ICON_PROMOTION_RECEIPT_ROOT =
	'assets/wiki/skills/icon-production-v1/promotion-receipts' as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const TransactionTokenSchema = z.string().uuid();
const JobIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u);
const MasterPathSchema = z
	.string()
	.regex(
		/^assets\/wiki\/skills\/icon-production-v1\/masters\/(?:frames|backing|calibration|icons)\/[a-z0-9-]+\.png$/u
	);
const ManagedOutputPathSchema = z.string().superRefine((value, context) => {
	if (
		!MasterPathSchema.safeParse(value).success &&
		!/^assets\/wiki\/skills\/icon-production-v1\/promotion-receipts\/[a-z0-9-]+\.json$/u.test(
			value
		) &&
		!/^assets\/wiki\/skills\/icon-production-v1\/review\/recognition\/[a-z0-9-]+\.png$/u.test(
			value
		) &&
		!/^apps\/web\/static\/skill-icons\/v1\/(?:512|256|128)\/[a-z0-9-]+\.webp$/u.test(value)
	) {
		context.addIssue({ code: 'custom', message: 'Output path is outside promotion authority' });
	}
});
const ParentFingerprintSchema = z
	.object({ realPath: z.string().min(1), device: z.number().int(), inode: z.number().int() })
	.strict();
const FileFingerprintSchema = z
	.object({ device: z.number().int(), inode: z.number().int() })
	.strict();
const SnapshotSchema = z
	.object({ bytesBase64: z.string(), contentHash: Sha256Schema })
	.strict()
	.superRefine((snapshot, context) => {
		const bytes = Buffer.from(snapshot.bytesBase64, 'base64');
		if (bytes.toString('base64') !== snapshot.bytesBase64)
			context.addIssue({
				code: 'custom',
				path: ['bytesBase64'],
				message: 'Invalid base64 snapshot'
			});
		if (createHash('sha256').update(bytes).digest('hex') !== snapshot.contentHash)
			context.addIssue({
				code: 'custom',
				path: ['contentHash'],
				message: 'Snapshot hash mismatch'
			});
	});

export const SkillIconPromotionLockSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-promotion-lock-v1'),
		transactionId: TransactionTokenSchema,
		recoveryTokenHash: Sha256Schema,
		pid: z.number().int().positive(),
		acquiredAt: z.string().datetime({ offset: true })
	})
	.strict();

export const SkillIconPromotionJournalSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-promotion-transaction-v1'),
		transactionId: TransactionTokenSchema,
		recoveryTokenHash: Sha256Schema,
		authorizationTag: Sha256Schema,
		phase: z.enum(['prepared', 'outputs-writing', 'shared-writing']),
		jobs: z
			.array(
				z
					.object({ jobId: JobIdSchema, masterPath: MasterPathSchema, contentHash: Sha256Schema })
					.strict()
			)
			.min(1),
		planned: z.array(
			z.object({ path: ManagedOutputPathSchema, contentHash: Sha256Schema }).strict()
		),
		created: z.array(
			z
				.object({
					path: ManagedOutputPathSchema,
					contentHash: Sha256Schema,
					parent: ParentFingerprintSchema,
					file: FileFingerprintSchema
				})
				.strict()
		),
		shared: z.array(
			z
				.object({
					path: z.enum([SKILL_ICON_VISUAL_SPECS_PATH, SKILL_ICON_CATALOG_PATH]),
					before: SnapshotSchema,
					afterHash: Sha256Schema,
					parent: ParentFingerprintSchema,
					beforeFile: FileFingerprintSchema,
					afterFile: FileFingerprintSchema.nullable()
				})
				.strict()
		)
	})
	.strict()
	.superRefine((journal, context) => {
		for (const [name, values] of [
			['job IDs', journal.jobs.map((job) => job.jobId)],
			['master paths', journal.jobs.map((job) => job.masterPath)],
			['planned paths', journal.planned.map((item) => item.path)],
			['created paths', journal.created.map((item) => item.path)],
			['shared paths', journal.shared.map((item) => item.path)]
		] as const) {
			if (new Set(values).size !== values.length)
				context.addIssue({ code: 'custom', message: `Promotion journal has duplicate ${name}` });
		}
		const planned = new Map(journal.planned.map((item) => [item.path, item.contentHash]));
		for (const job of journal.jobs) {
			if (planned.get(job.masterPath) !== job.contentHash)
				context.addIssue({ code: 'custom', message: 'Journal master is not exactly planned' });
		}
		for (const created of journal.created) {
			if (planned.get(created.path) !== created.contentHash)
				context.addIssue({ code: 'custom', message: 'Created output is not exactly planned' });
		}
	});

export const SkillIconPromotionReceiptSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-promotion-receipt-v1'),
		transactionId: TransactionTokenSchema,
		jobId: JobIdSchema,
		role: z.enum(['rarity-frame', 'backing', 'calibration-plate', 'skill-art']),
		ownerReviewer: z.string().trim().min(1).max(160),
		review: z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict(),
		result: z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict(),
		candidate: z.object({ path: z.string().min(1), contentHash: Sha256Schema }).strict(),
		master: z.object({ path: MasterPathSchema, contentHash: Sha256Schema }).strict()
	})
	.strict();

export interface PromotionTestHooks {
	readonly afterLockAcquired?: () => void | Promise<void>;
	readonly beforeMasterWrite?: (input: {
		readonly index: number;
		readonly destination: string;
	}) => void | Promise<void>;
	readonly afterMasterWrite?: (input: {
		readonly index: number;
		readonly destination: string;
	}) => void | Promise<void>;
	readonly beforeSharedWrite?: () => void | Promise<void>;
	readonly afterSharedWrite?: (input: {
		readonly index: number;
		readonly path: string;
	}) => void | Promise<void>;
	readonly beforeRecoveryMutation?: () => void | Promise<void>;
}

export interface SkillIconDerivativeBuffers {
	readonly runtime512: Buffer;
	readonly runtime256: Buffer;
	readonly runtime128: Buffer;
	readonly recognition96: Buffer;
}

export interface SkillIconDerivativeResolverInput {
	readonly root: string;
	readonly target: SkillIconTarget;
	readonly candidate: { readonly bytes: Buffer; readonly contentHash: string };
	readonly references: readonly {
		readonly path: string;
		readonly contentHash: string;
		readonly bytes: Buffer;
	}[];
}

export type SkillIconDerivativeResolver = (
	input: SkillIconDerivativeResolverInput
) => Promise<SkillIconDerivativeBuffers>;

export interface PromotionOptions {
	readonly jobId: string;
	readonly reviewPath: string;
	readonly root?: string;
	readonly derivativeResolver?: SkillIconDerivativeResolver;
	readonly testHooks?: PromotionTestHooks;
}

interface PreparedPromotion {
	readonly record: Omit<SkillIconAssetRecord, 'transactionId' | 'promotionReceipt'>;
	readonly bytes: Buffer;
	readonly destination: string;
	readonly visualState: Record<string, unknown> | null;
	readonly additionalOutputs: readonly { readonly asset: SkillIconAsset; readonly bytes: Buffer }[];
}

type PromotionLock = z.infer<typeof SkillIconPromotionLockSchema>;
type PromotionJournal = z.infer<typeof SkillIconPromotionJournalSchema>;
interface PromotionAuthority {
	readonly lock: PromotionLock;
	readonly recoveryToken: string;
}

function inside(parent: string, child: string): boolean {
	const relative = path.relative(parent, child);
	return (
		relative === '' ||
		(!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
	);
}

async function metadataOrNull(filePath: string) {
	return lstat(filePath).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
}

function repositoryPath(
	root: string,
	input: string,
	allowedRoot: string
): { relative: string; absolute: string } {
	const absolute = path.isAbsolute(input) ? path.resolve(input) : path.resolve(root, input);
	const authority = path.resolve(root, allowedRoot);
	if (!inside(authority, absolute) || absolute === authority)
		throw new Error(`Path escaped ${allowedRoot}: ${input}`);
	return { relative: path.relative(root, absolute).split(path.sep).join('/'), absolute };
}

async function readRegular(filePath: string, description: string): Promise<Buffer> {
	const handle = await open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ELOOP') throw new Error(`${description} cannot be a symbolic link`);
			throw error;
		}
	);
	try {
		if (!(await handle.stat()).isFile()) throw new Error(`${description} must be a regular file`);
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

async function assertSafeExistingPath(
	root: string,
	filePath: string,
	description: string
): Promise<void> {
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	if (!inside(root, filePath) || filePath === root)
		throw new Error(`${description} escaped workspace root`);
	const realRoot = await realpath(root);
	let cursor = root;
	const segments = path.relative(root, filePath).split(path.sep);
	for (const [index, segment] of segments.entries()) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`${description} path cannot contain a symbolic link: ${cursor}`);
		if (index < segments.length - 1 && !metadata.isDirectory())
			throw new Error(`${description} ancestor is not a directory: ${cursor}`);
	}
	if (!inside(realRoot, await realpath(path.dirname(filePath))))
		throw new Error(`${description} parent escaped real workspace root`);
}

async function readRepositoryRegular(
	root: string,
	filePath: string,
	description: string
): Promise<Buffer> {
	await assertSafeExistingPath(root, filePath, description);
	return readRegular(filePath, description);
}

async function ensureSafeParents(
	root: string,
	destination: string,
	create: boolean
): Promise<void> {
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	const realRoot = await realpath(root);
	const relativeParent = path.relative(root, path.dirname(destination));
	if (!inside(root, destination) || destination === root)
		throw new Error('Master destination escaped workspace root');
	let cursor = root;
	for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
		cursor = path.join(cursor, segment);
		let metadata = await metadataOrNull(cursor);
		if (!metadata) {
			if (!create) break;
			await mkdir(cursor).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink())
			throw new Error(`Master parent cannot be a symbolic link: ${cursor}`);
		if (!metadata.isDirectory()) throw new Error(`Master parent is not a directory: ${cursor}`);
		if (!inside(realRoot, await realpath(cursor)))
			throw new Error(`Master parent escaped real workspace root: ${cursor}`);
	}
}

async function syncDirectory(directory: string): Promise<void> {
	const handle = await open(
		directory,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function parseTransactionJson<T>(schema: z.ZodType<T>, bytes: Buffer, label: string): T {
	try {
		return schema.parse(JSON.parse(bytes.toString('utf8')));
	} catch (error) {
		throw new Error(`Invalid ${label}; transaction state is fail-closed`, { cause: error });
	}
}

async function parentFingerprint(
	destination: string
): Promise<z.infer<typeof ParentFingerprintSchema>> {
	const parent = path.dirname(destination);
	const [realPath, metadata] = await Promise.all([realpath(parent), lstat(parent)]);
	if (metadata.isSymbolicLink() || !metadata.isDirectory())
		throw new Error(`Promotion parent identity is unsafe: ${parent}`);
	return { realPath, device: metadata.dev, inode: metadata.ino };
}

function sameParentFingerprint(
	left: z.infer<typeof ParentFingerprintSchema>,
	right: z.infer<typeof ParentFingerprintSchema>
): boolean {
	return (
		left.realPath === right.realPath && left.device === right.device && left.inode === right.inode
	);
}

async function fileFingerprint(
	destination: string
): Promise<z.infer<typeof FileFingerprintSchema>> {
	const metadata = await lstat(destination);
	if (metadata.isSymbolicLink() || !metadata.isFile())
		throw new Error(`Promotion file identity is unsafe: ${destination}`);
	return { device: metadata.dev, inode: metadata.ino };
}

function scopeForRole(role: SkillIconRole): 'references' | 'calibration' | 'icons' {
	return role === 'skill-art'
		? 'icons'
		: role === 'calibration-plate'
			? 'calibration'
			: 'references';
}

function masterPathFor(target: ReturnType<typeof SkillIconTargetSchema.parse>): string {
	if (target.role === 'rarity-frame')
		return `assets/wiki/skills/icon-production-v1/masters/frames/${target.rarity.toLowerCase()}.png`;
	if (target.role === 'backing')
		return `assets/wiki/skills/icon-production-v1/masters/backing/${target.jobId.replace(/-v\d+$/u, '')}.png`;
	if (target.role === 'calibration-plate')
		return `assets/wiki/skills/icon-production-v1/masters/calibration/${target.motifFamily.replaceAll('.', '-')}.png`;
	return `assets/wiki/skills/icon-production-v1/masters/icons/${target.skillTargetId.replaceAll(':', '-')}.png`;
}

async function assertSkillCandidateProvenance(
	root: string,
	target: ReturnType<typeof SkillIconTargetSchema.parse>,
	resultHash: string,
	record: PreparedPromotion['record']
): Promise<Record<string, unknown>> {
	if (target.role !== 'skill-art') throw new Error('Internal role mismatch');
	const visualBytes = await readRepositoryRegular(
		root,
		path.resolve(root, SKILL_ICON_VISUAL_SPECS_PATH),
		'Visual specs'
	);
	const visual = JSON.parse(visualBytes.toString('utf8')) as {
		records?: Record<string, unknown>[];
	};
	const current = visual.records?.find((item) => item.targetId === target.skillTargetId) as
		| {
				status?: unknown;
				producerResult?: { jobId?: unknown; path?: unknown; contentHash?: unknown };
				assets?: { candidate?: { path?: unknown; contentHash?: unknown } };
		  }
		| undefined;
	if (!current || current.status !== 'candidate')
		throw new Error(`Skill ${target.skillTargetId} must be in candidate state before promotion`);
	if (
		current.producerResult?.jobId !== record.jobId ||
		current.producerResult.path !== record.resultPath ||
		current.producerResult.contentHash !== resultHash
	)
		throw new Error(`Candidate visual record result evidence hash does not match ${record.jobId}`);
	if (
		current.assets?.candidate?.path !== record.candidate.path ||
		current.assets.candidate.contentHash !== record.candidate.contentHash
	)
		throw new Error(`Candidate visual record asset evidence does not match ${record.jobId}`);
	return current;
}

async function derivativeAsset(
	bytes: Buffer,
	path: string,
	mediaType: 'image/png' | 'image/webp',
	size: number
): Promise<SkillIconAsset> {
	const metadata = await sharp(bytes).metadata();
	const expectedFormat = mediaType === 'image/png' ? 'png' : 'webp';
	if (
		metadata.width !== size ||
		metadata.height !== size ||
		metadata.format !== expectedFormat ||
		!metadata.hasAlpha
	)
		throw new Error(`Derivative resolver returned invalid ${size}x${size} ${expectedFormat} bytes`);
	return {
		path,
		mediaType,
		width: size,
		height: size,
		bytes: bytes.byteLength,
		alphaMode: 'rgba',
		contentHash: sha256(bytes)
	};
}

async function resolveSkillDerivatives(
	root: string,
	target: Extract<SkillIconTarget, { role: 'skill-art' }>,
	candidateBytes: Buffer,
	resolver: SkillIconDerivativeResolver
): Promise<{
	readonly assets: {
		readonly runtime512: SkillIconAsset;
		readonly runtime256: SkillIconAsset;
		readonly runtime128: SkillIconAsset;
		readonly recognition96: SkillIconAsset;
	};
	readonly outputs: readonly { readonly asset: SkillIconAsset; readonly bytes: Buffer }[];
}> {
	const references = await Promise.all(
		target.references.map(async (reference) => {
			const bytes = await readRepositoryRegular(
				root,
				path.resolve(root, reference.path),
				`Derivative reference ${reference.path}`
			);
			if (sha256(bytes) !== reference.contentHash)
				throw new Error(`Derivative reference hash mismatch: ${reference.path}`);
			return { path: reference.path, contentHash: reference.contentHash, bytes };
		})
	);
	const buffers = await resolver({
		root,
		target,
		candidate: { bytes: candidateBytes, contentHash: sha256(candidateBytes) },
		references
	});
	const slug = target.skillTargetId.replaceAll(':', '-');
	const entries = [
		[
			'runtime512',
			buffers.runtime512,
			`apps/web/static/skill-icons/v1/512/${slug}.webp`,
			'image/webp',
			512
		],
		[
			'runtime256',
			buffers.runtime256,
			`apps/web/static/skill-icons/v1/256/${slug}.webp`,
			'image/webp',
			256
		],
		[
			'runtime128',
			buffers.runtime128,
			`apps/web/static/skill-icons/v1/128/${slug}.webp`,
			'image/webp',
			128
		],
		[
			'recognition96',
			buffers.recognition96,
			`assets/wiki/skills/icon-production-v1/review/recognition/${slug}.png`,
			'image/png',
			96
		]
	] as const;
	const resolved = await Promise.all(
		entries.map(async ([name, bytes, assetPath, mediaType, size]) => ({
			name,
			bytes,
			asset: await derivativeAsset(bytes, assetPath, mediaType, size)
		}))
	);
	return {
		assets: Object.fromEntries(resolved.map((item) => [item.name, item.asset])) as {
			runtime512: SkillIconAsset;
			runtime256: SkillIconAsset;
			runtime128: SkillIconAsset;
			recognition96: SkillIconAsset;
		},
		outputs: resolved.map(({ asset, bytes }) => ({ asset, bytes }))
	};
}

async function preparePromotion(
	root: string,
	jobId: string,
	reviewInput: string,
	derivativeResolver?: SkillIconDerivativeResolver
): Promise<PreparedPromotion> {
	const reviewLocation = repositoryPath(
		root,
		reviewInput,
		'assets/wiki/skills/icon-production-v1/review/decisions'
	);
	const reviewBytes = await readRepositoryRegular(root, reviewLocation.absolute, 'Review');
	const review = SkillIconReviewSchema.parse(JSON.parse(reviewBytes.toString('utf8')));
	if (review.jobId !== jobId)
		throw new Error(`Review job ID ${review.jobId} does not match requested job ${jobId}`);
	if (review.decision !== 'accepted')
		throw new Error(`Review decision for ${jobId} must be accepted`);
	// Reviewer identity is nominal in the existing unsigned contract. Authentication belongs to
	// the coordinator boundary; this gate enforces the documented owner role and durable evidence.
	if (review.reviewerRole !== 'owner' || review.reviewer.trim().length === 0)
		throw new Error(`Accepted review for ${jobId} must name the owner as reviewer`);
	const scope = scopeForRole(review.role);
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${jobId}.json`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/${scope}/${jobId}.json`;
	const [target, assignment, resultBytes] = await Promise.all([
		readRepositoryRegular(root, path.resolve(root, targetPath), 'Target').then((bytes) =>
			SkillIconTargetSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readRepositoryRegular(root, path.resolve(root, assignmentPath), 'Assignment').then((bytes) =>
			SkillIconAssignmentSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readRepositoryRegular(root, path.resolve(root, resultPath), 'Result')
	]);
	const result = SkillIconResultSchema.parse(JSON.parse(resultBytes.toString('utf8')));
	SkillIconExecutionSchema.parse({
		schemaVersion: 'skill-icon-execution-v1',
		target,
		assignment,
		result
	});
	if (target.role !== review.role || target.skillTargetId !== review.skillTargetId)
		throw new Error('Review role/skill identity does not match target');
	if (result.status !== 'candidate' || !result.output)
		throw new Error(`Result for ${jobId} is not a promotable candidate`);
	if (result.selfPromoted !== false)
		throw new Error(`Producer result for ${jobId} must state selfPromoted false`);
	const candidateBytes = await readRepositoryRegular(
		root,
		path.resolve(root, review.candidatePath),
		'Candidate'
	);
	const hash = createHash('sha256').update(candidateBytes).digest('hex');
	if (hash !== review.candidateHash || hash !== result.output.contentHash)
		throw new Error(`Candidate hash mismatch for ${jobId}`);
	if (candidateBytes.byteLength !== result.output.bytes)
		throw new Error(`Candidate byte count mismatch for ${jobId}`);
	await assertSafeExistingPath(
		root,
		path.resolve(root, 'assets/wiki/skills/icon-production-v1/geometry.json'),
		'Geometry'
	);
	const geometry = await loadSkillIconGeometry(root);
	const inspection = await inspectSkillIconAsset(candidateBytes, target.role, geometry);
	if (
		inspection.width !== target.canvas.width ||
		inspection.height !== target.canvas.height ||
		inspection.violations.length > 0
	)
		throw new Error(
			`Candidate validation failed for ${jobId}: ${inspection.violations.join('; ')}`
		);
	const masterPath = masterPathFor(target);
	const destination = path.resolve(root, masterPath);
	if (!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/masters'), destination))
		throw new Error('Master destination escaped master authority root');
	await ensureSafeParents(root, destination, false);
	if (await metadataOrNull(destination))
		throw new Error(`Master destination already exists (collision): ${masterPath}`);
	const candidate: SkillIconAsset = {
		path: review.candidatePath,
		mediaType: 'image/png',
		width: inspection.width,
		height: inspection.height,
		bytes: candidateBytes.byteLength,
		alphaMode: inspection.alphaMode,
		contentHash: hash
	};
	const approvedMaster: SkillIconAsset = { ...candidate, path: masterPath };
	const record: PreparedPromotion['record'] = {
		jobId,
		role: target.role,
		skillTargetId: target.skillTargetId,
		candidate,
		approvedMaster,
		resultPath,
		reviewPath: reviewLocation.relative,
		resultContentHash: createHash('sha256').update(resultBytes).digest('hex'),
		reviewContentHash: createHash('sha256').update(reviewBytes).digest('hex'),
		review
	};
	let visualState: Record<string, unknown> | null = null;
	let additionalOutputs: readonly { readonly asset: SkillIconAsset; readonly bytes: Buffer }[] = [];
	if (target.role === 'skill-art') {
		const current = await assertSkillCandidateProvenance(
			root,
			target,
			record.resultContentHash,
			record
		);
		if (!derivativeResolver)
			throw new Error(
				'Skill-art promotion requires the deterministic derivative resolver supplied by Task 5'
			);
		const derivatives = await resolveSkillDerivatives(
			root,
			target as Extract<SkillIconTarget, { role: 'skill-art' }>,
			candidateBytes,
			derivativeResolver
		);
		visualState = {
			...current,
			status: 'approved',
			assets: { candidate, approvedMaster, ...derivatives.assets },
			review
		};
		const catalogBytes = await readRepositoryRegular(
			root,
			path.resolve(root, SKILL_ICON_CATALOG_PATH),
			'Skill icon catalog'
		);
		const catalog = JSON.parse(catalogBytes.toString('utf8')) as {
			records?: Record<string, unknown>[];
		};
		const canonical = catalog.records?.find((item) => item.targetId === target.skillTargetId);
		if (!canonical) throw new Error(`Catalog has no skill record ${target.skillTargetId}`);
		SkillIconRecordSchema.parse({ ...canonical, ...visualState });
		additionalOutputs = derivatives.outputs;
	}
	return {
		record,
		bytes: candidateBytes,
		destination,
		visualState,
		additionalOutputs
	};
}

async function atomicJsonReplace(root: string, destination: string, bytes: Buffer): Promise<void> {
	await ensureSafeParents(root, destination, false);
	const before = await metadataOrNull(destination);
	if (before?.isSymbolicLink() || (before && !before.isFile()))
		throw new Error(`Shared JSON destination identity is unsafe: ${destination}`);
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
	try {
		await ensureSafeParents(root, destination, false);
		const immediatelyBefore = await metadataOrNull(destination);
		if (immediatelyBefore?.isSymbolicLink() || (immediatelyBefore && !immediatelyBefore.isFile()))
			throw new Error(`Shared JSON destination identity changed before rename: ${destination}`);
		await rename(temporary, destination);
		await syncDirectory(path.dirname(destination));
		await ensureSafeParents(root, destination, false);
		const committed = await readRepositoryRegular(root, destination, 'Committed shared JSON');
		if (!committed.equals(bytes))
			throw new Error(`Shared JSON destination identity changed during rename: ${destination}`);
	} catch (error) {
		let cleanupError: unknown;
		try {
			await unlink(temporary);
		} catch (candidateCleanupError) {
			if ((candidateCleanupError as NodeJS.ErrnoException).code !== 'ENOENT') {
				cleanupError = candidateCleanupError;
			}
		}

		if (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				`Atomic JSON replacement failed and temporary cleanup was incomplete: ${destination}`,
				{ cause: error }
			);
		}
		throw error;
	}
}

function journalBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
}

function journalAuthorizationPayload(journal: PromotionJournal): Buffer {
	const payload = Object.fromEntries(
		Object.entries(journal).filter(([key]) => key !== 'authorizationTag')
	);
	return Buffer.from(JSON.stringify(payload));
}

function authorizeJournal(journal: PromotionJournal, recoveryToken: string): PromotionJournal {
	return {
		...journal,
		authorizationTag: createHmac('sha256', recoveryToken)
			.update(journalAuthorizationPayload(journal))
			.digest('hex')
	};
}

function assertJournalAuthorization(journal: PromotionJournal, recoveryToken: string): void {
	const expected = authorizeJournal(journal, recoveryToken).authorizationTag;
	if (!timingSafeEqual(Buffer.from(journal.authorizationTag, 'hex'), Buffer.from(expected, 'hex')))
		throw new Error('Promotion journal authorization tag does not match the recovery token');
}

async function writeJournal(
	root: string,
	journal: PromotionJournal,
	exclusive: boolean,
	recoveryToken: string
): Promise<void> {
	const signedJournal = SkillIconPromotionJournalSchema.parse(
		authorizeJournal(journal, recoveryToken)
	);
	const destination = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	await ensureSafeParents(root, destination, true);
	if (exclusive) {
		const handle = await open(
			destination,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600
		);
		try {
			await handle.writeFile(journalBytes(signedJournal));
			await handle.sync();
		} finally {
			await handle.close();
		}
		await syncDirectory(path.dirname(destination));
		return;
	}
	await atomicJsonReplace(root, destination, journalBytes(signedJournal));
}

async function writeOwnedOutput(
	root: string,
	relativePath: string,
	bytes: Buffer
): Promise<PromotionJournal['created'][number]> {
	ManagedOutputPathSchema.parse(relativePath);
	const destination = path.resolve(root, relativePath);
	await ensureSafeParents(root, destination, true);
	const parent = await parentFingerprint(destination);
	const handle = await open(
		destination,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
		0o644
	);
	let metadata: Awaited<ReturnType<typeof handle.stat>>;
	try {
		await handle.writeFile(bytes);
		await handle.sync();
		metadata = await handle.stat();
	} finally {
		await handle.close();
	}
	await syncDirectory(path.dirname(destination));
	if (!sameParentFingerprint(await parentFingerprint(destination), parent))
		throw new Error(`Promotion output parent changed during write: ${relativePath}`);
	const retained = await readRepositoryRegular(
		root,
		destination,
		`Promotion output ${relativePath}`
	);
	if (!retained.equals(bytes)) throw new Error(`Promotion output bytes changed: ${relativePath}`);
	return {
		path: relativePath,
		contentHash: sha256(bytes),
		parent,
		file: { device: metadata.dev, inode: metadata.ino }
	};
}

async function assertCreatedIdentity(
	root: string,
	item: PromotionJournal['created'][number]
): Promise<void> {
	const destination = path.resolve(root, item.path);
	await ensureSafeParents(root, destination, false);
	if (!sameParentFingerprint(await parentFingerprint(destination), item.parent))
		throw new Error(`Promotion output parent identity changed; cleanup required: ${item.path}`);
	const metadata = await lstat(destination);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== item.file.device ||
		metadata.ino !== item.file.inode
	)
		throw new Error(`Promotion output file identity changed; cleanup required: ${item.path}`);
	const bytes = await readRepositoryRegular(root, destination, `Recovery output ${item.path}`);
	if (sha256(bytes) !== item.contentHash)
		throw new Error(`Promotion output hash changed; cleanup required: ${item.path}`);
}

async function assertSharedIdentity(
	root: string,
	item: PromotionJournal['shared'][number]
): Promise<'before' | 'after'> {
	const destination = path.resolve(root, item.path);
	await ensureSafeParents(root, destination, false);
	if (!sameParentFingerprint(await parentFingerprint(destination), item.parent))
		throw new Error(`Shared state parent identity changed; cleanup required: ${item.path}`);
	const metadata = await lstat(destination);
	if (metadata.isSymbolicLink() || !metadata.isFile())
		throw new Error(`Shared state file identity is unsafe: ${item.path}`);
	const bytes = await readRepositoryRegular(
		root,
		destination,
		`Recovery shared state ${item.path}`
	);
	const hash = sha256(bytes);
	if (
		hash === item.before.contentHash &&
		metadata.dev === item.beforeFile.device &&
		metadata.ino === item.beforeFile.inode
	)
		return 'before';
	if (
		hash === item.afterHash &&
		item.afterFile &&
		metadata.dev === item.afterFile.device &&
		metadata.ino === item.afterFile.inode
	)
		return 'after';
	throw new Error(`Shared state hash changed; cleanup required: ${item.path}`);
}

async function rollbackJournal(
	root: string,
	journal: PromotionJournal,
	testHooks?: PromotionTestHooks
): Promise<void> {
	const createdPaths = new Set(journal.created.map((item) => item.path));
	for (const planned of journal.planned) {
		if (createdPaths.has(planned.path)) continue;
		if (await metadataOrNull(path.resolve(root, planned.path)))
			throw new Error(
				`Untracked partial promotion output requires manual cleanup: ${planned.path}`
			);
	}
	const sharedStates = await Promise.all(
		journal.shared.map(async (item) => ({ item, state: await assertSharedIdentity(root, item) }))
	);
	await Promise.all(journal.created.map((item) => assertCreatedIdentity(root, item)));
	await testHooks?.beforeRecoveryMutation?.();
	for (const item of [...journal.created].reverse()) {
		await assertCreatedIdentity(root, item);
		const destination = path.resolve(root, item.path);
		await unlink(destination);
		await syncDirectory(path.dirname(destination));
	}
	for (const { item, state } of sharedStates) {
		if (state === 'before') continue;
		if ((await assertSharedIdentity(root, item)) !== 'after')
			throw new Error(`Shared state changed during recovery: ${item.path}`);
		await atomicJsonReplace(
			root,
			path.resolve(root, item.path),
			Buffer.from(item.before.bytesBase64, 'base64')
		);
	}
}

export async function recoverSkillIconPromotion(options: {
	readonly root?: string;
	readonly transactionToken: string;
	readonly testHooks?: PromotionTestHooks;
}): Promise<void> {
	const root = path.resolve(options.root ?? process.cwd());
	const lockPath = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	const journalPath = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	const token = TransactionTokenSchema.parse(options.transactionToken);
	if (!(await metadataOrNull(lockPath))) throw new Error('Recovery requires an existing lock');
	const lock = parseTransactionJson(
		SkillIconPromotionLockSchema,
		await readRepositoryRegular(root, lockPath, 'Coordinator lock'),
		'promotion lock'
	);
	if (lock.recoveryTokenHash !== sha256(Buffer.from(token)))
		throw new Error('Recovery token does not authorize this promotion transaction');
	const journalMetadata = await metadataOrNull(journalPath);
	if (journalMetadata) {
		const journal = parseTransactionJson(
			SkillIconPromotionJournalSchema,
			await readRepositoryRegular(root, journalPath, 'Promotion journal'),
			'promotion journal'
		);
		if (
			journal.transactionId !== lock.transactionId ||
			journal.recoveryTokenHash !== lock.recoveryTokenHash
		)
			throw new Error('Lock and journal transaction authority do not match');
		assertJournalAuthorization(journal, token);
		await rollbackJournal(root, journal, options.testHooks);
		await unlink(journalPath);
		await syncDirectory(path.dirname(journalPath));
	}
	const currentLock = parseTransactionJson(
		SkillIconPromotionLockSchema,
		await readRepositoryRegular(root, lockPath, 'Coordinator lock'),
		'promotion lock'
	);
	if (
		currentLock.transactionId !== lock.transactionId ||
		currentLock.recoveryTokenHash !== lock.recoveryTokenHash
	)
		throw new Error('Coordinator lock changed during recovery');
	await unlink(lockPath);
	await syncDirectory(path.dirname(lockPath));
}

async function withCoordinatorLock<T>(
	root: string,
	testHooks: PromotionTestHooks | undefined,
	operation: (authority: PromotionAuthority) => Promise<T>
): Promise<T> {
	const lockPath = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	const journalPath = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	await ensureSafeParents(root, lockPath, true);
	if (await metadataOrNull(lockPath)) {
		parseTransactionJson(
			SkillIconPromotionLockSchema,
			await readRepositoryRegular(root, lockPath, 'promotion lock'),
			'promotion lock'
		);
		throw new Error(
			'Existing promotion lock blocks promotion; explicit token-bound recovery is required'
		);
	}
	if (await metadataOrNull(journalPath)) {
		parseTransactionJson(
			SkillIconPromotionJournalSchema,
			await readRepositoryRegular(root, journalPath, 'promotion journal'),
			'promotion journal'
		);
		throw new Error(
			'Existing promotion journal blocks promotion; explicit token-bound recovery is required'
		);
	}
	const recoveryToken = randomUUID();
	const authority: PromotionAuthority = {
		recoveryToken,
		lock: {
			schemaVersion: 'skill-icon-promotion-lock-v1',
			transactionId: randomUUID(),
			recoveryTokenHash: sha256(Buffer.from(recoveryToken)),
			pid: process.pid,
			acquiredAt: new Date().toISOString()
		}
	};
	let handle: Awaited<ReturnType<typeof open>> | undefined;
	try {
		handle = await open(
			lockPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600
		);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error('Skill-icon coordinator lock is already held', { cause: error });
		}
		throw error;
	}
	try {
		await handle.writeFile(journalBytes(authority.lock));
		await handle.sync();
	} finally {
		await handle.close();
	}
	await syncDirectory(path.dirname(lockPath));
	if (await metadataOrNull(journalPath)) {
		throw new Error(
			`A promotion journal appeared after lock acquisition; lock retained for recovery token ${authority.recoveryToken}`
		);
	}
	try {
		await testHooks?.afterLockAcquired?.();
		const result = await operation(authority);
		if (await metadataOrNull(journalPath))
			throw new Error('Promotion returned while its durable journal still exists');
		const current = parseTransactionJson(
			SkillIconPromotionLockSchema,
			await readRepositoryRegular(root, lockPath, 'Coordinator lock'),
			'promotion lock'
		);
		if (current.transactionId !== authority.lock.transactionId)
			throw new Error('Coordinator lock identity changed before release');
		await unlink(lockPath);
		await syncDirectory(path.dirname(lockPath));
		return result;
	} catch (error) {
		if (await metadataOrNull(journalPath))
			throw new Error(
				`Promotion failed with durable recovery state retained; recovery token ${authority.recoveryToken}`,
				{ cause: error }
			);
		const current = parseTransactionJson(
			SkillIconPromotionLockSchema,
			await readRepositoryRegular(root, lockPath, 'Coordinator lock'),
			'promotion lock'
		);
		if (current.transactionId !== authority.lock.transactionId)
			throw new AggregateError([error], 'Promotion failed and lock identity changed', {
				cause: error
			});
		await unlink(lockPath);
		await syncDirectory(path.dirname(lockPath));
		throw error;
	}
}

function promotionReceiptBytes(item: PreparedPromotion, authority: PromotionAuthority): Buffer {
	return journalBytes(
		SkillIconPromotionReceiptSchema.parse({
			schemaVersion: 'skill-icon-promotion-receipt-v1',
			transactionId: authority.lock.transactionId,
			jobId: item.record.jobId,
			role: item.record.role,
			ownerReviewer: item.record.review.reviewer,
			review: { path: item.record.reviewPath, contentHash: item.record.reviewContentHash },
			result: { path: item.record.resultPath, contentHash: item.record.resultContentHash },
			candidate: {
				path: item.record.candidate.path,
				contentHash: item.record.candidate.contentHash
			},
			master: {
				path: item.record.approvedMaster.path,
				contentHash: item.record.approvedMaster.contentHash
			}
		})
	);
}

async function assertPromotionEvidenceCurrent(
	root: string,
	item: PreparedPromotion
): Promise<void> {
	for (const [evidencePath, expectedHash, label] of [
		[item.record.candidate.path, item.record.candidate.contentHash, 'candidate'],
		[item.record.resultPath, item.record.resultContentHash, 'result'],
		[item.record.reviewPath, item.record.reviewContentHash, 'review']
	] as const) {
		const bytes = await readRepositoryRegular(
			root,
			path.resolve(root, evidencePath),
			`Promotion ${label} evidence`
		);
		if (sha256(bytes) !== expectedHash)
			throw new Error(`Promotion ${label} evidence changed: ${evidencePath}`);
	}
}

async function commitPromotions(
	root: string,
	prepared: readonly PreparedPromotion[],
	authority: PromotionAuthority,
	testHooks?: PromotionTestHooks
): Promise<readonly SkillIconAssetRecord[]> {
	const destinations = new Set<string>();
	const jobs = new Set<string>();
	for (const item of prepared) {
		await assertPromotionEvidenceCurrent(root, item);
		if (jobs.has(item.record.jobId))
			throw new Error(`Duplicate promotion job ${item.record.jobId}`);
		if (destinations.has(item.destination))
			throw new Error(`Duplicate master destination ${item.record.approvedMaster.path}`);
		jobs.add(item.record.jobId);
		destinations.add(item.destination);
		const receiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${item.record.jobId}.json`;
		const receiptDestination = path.resolve(root, receiptPath);
		if (destinations.has(receiptDestination))
			throw new Error(`Duplicate promotion receipt destination ${receiptPath}`);
		destinations.add(receiptDestination);
		if (await metadataOrNull(item.destination))
			throw new Error(
				`Master destination already exists (collision): ${item.record.approvedMaster.path}`
			);
		if (await metadataOrNull(receiptDestination))
			throw new Error(`Promotion receipt already exists (collision): ${receiptPath}`);
		for (const output of item.additionalOutputs) {
			ManagedOutputPathSchema.parse(output.asset.path);
			const outputDestination = path.resolve(root, output.asset.path);
			if (destinations.has(outputDestination))
				throw new Error(`Duplicate derivative destination ${output.asset.path}`);
			destinations.add(outputDestination);
			if (await metadataOrNull(outputDestination))
				throw new Error(`Derivative destination already exists (collision): ${output.asset.path}`);
		}
	}

	const visualPath = path.resolve(root, SKILL_ICON_VISUAL_SPECS_PATH);
	const originalVisual = (await metadataOrNull(visualPath))
		? await readRepositoryRegular(root, visualPath, 'Visual specs')
		: null;
	if (originalVisual && !(await exportSkillIconProduction({ root, mode: 'check' })).inSync) {
		throw new Error('Skill icon catalog must be current before promotion');
	}
	let nextVisual: Buffer | null = null;
	let nextCatalog: Buffer | null = null;
	if (prepared.some((item) => item.visualState)) {
		if (!originalVisual) throw new Error('Skill promotion requires visual specs');
		const visual = JSON.parse(originalVisual.toString('utf8')) as {
			schemaVersion: string;
			records: Record<string, unknown>[];
		};
		const replacements = new Map(
			prepared.flatMap((item) =>
				item.visualState ? [[item.record.skillTargetId, item.visualState] as const] : []
			)
		);
		visual.records = visual.records.map(
			(item) => replacements.get(item.targetId as string) ?? item
		);
		nextVisual = Buffer.from(`${JSON.stringify(visual, null, '\t')}\n`);
		const [rows, motifMarkdown] = await Promise.all([
			loadCanonicalSkillRows(root),
			readRepositoryRegular(
				root,
				path.resolve(root, SKILL_ICON_MOTIF_SOURCE_PATH),
				'Skill icon motif map source'
			).then((bytes) => bytes.toString('utf8'))
		]);
		const motifMap = parseAcceptedMotifMap(motifMarkdown, rows);
		const catalog = buildSkillIconCatalog(
			rows,
			motifMap,
			visual as unknown as SkillIconVisualSpecs
		);
		nextCatalog = Buffer.from(`${JSON.stringify(catalog, null, '\t')}\n`);
	}
	const shared: PromotionJournal['shared'] = [];
	if (nextVisual && nextCatalog) {
		if (!originalVisual) throw new Error('Skill promotion requires visual specs');
		const catalogPath = path.resolve(root, SKILL_ICON_CATALOG_PATH);
		const originalCatalog = await readRepositoryRegular(root, catalogPath, 'Skill icon catalog');
		for (const [sharedPath, before, after] of [
			[SKILL_ICON_VISUAL_SPECS_PATH, originalVisual, nextVisual],
			[SKILL_ICON_CATALOG_PATH, originalCatalog, nextCatalog]
		] as const) {
			shared.push({
				path: sharedPath,
				before: { bytesBase64: before.toString('base64'), contentHash: sha256(before) },
				afterHash: sha256(after),
				parent: await parentFingerprint(path.resolve(root, sharedPath)),
				beforeFile: await fileFingerprint(path.resolve(root, sharedPath)),
				afterFile: null
			});
		}
	}
	const receiptBytesByJob = new Map(
		prepared.map((item) => [item.record.jobId, promotionReceiptBytes(item, authority)] as const)
	);
	const planned = prepared.flatMap((item) => {
		const receiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${item.record.jobId}.json`;
		const receiptBytes = receiptBytesByJob.get(item.record.jobId)!;
		return [
			{
				path: item.record.approvedMaster.path,
				contentHash: item.record.approvedMaster.contentHash
			},
			...item.additionalOutputs.map((output) => ({
				path: output.asset.path,
				contentHash: output.asset.contentHash
			})),
			{ path: receiptPath, contentHash: sha256(receiptBytes) }
		];
	});

	let journal: PromotionJournal = {
		schemaVersion: 'skill-icon-promotion-transaction-v1',
		transactionId: authority.lock.transactionId,
		recoveryTokenHash: authority.lock.recoveryTokenHash,
		authorizationTag: '0'.repeat(64),
		phase: 'prepared',
		jobs: prepared.map((item) => ({
			jobId: item.record.jobId,
			masterPath: item.record.approvedMaster.path,
			contentHash: item.record.approvedMaster.contentHash
		})),
		planned,
		created: [],
		shared
	};
	await writeJournal(root, journal, true, authority.recoveryToken);
	const records: SkillIconAssetRecord[] = [];
	try {
		for (const [index, item] of prepared.entries()) {
			await ensureSafeParents(root, item.destination, true);
			await testHooks?.beforeMasterWrite?.({ index, destination: item.destination });
			await ensureSafeParents(root, item.destination, false);
			const master = await writeOwnedOutput(root, item.record.approvedMaster.path, item.bytes);
			journal = {
				...journal,
				phase: 'outputs-writing',
				created: [...journal.created, master]
			};
			await writeJournal(root, journal, false, authority.recoveryToken);
			await testHooks?.afterMasterWrite?.({ index, destination: item.destination });
			for (const output of item.additionalOutputs) {
				const createdOutput = await writeOwnedOutput(root, output.asset.path, output.bytes);
				journal = { ...journal, created: [...journal.created, createdOutput] };
				await writeJournal(root, journal, false, authority.recoveryToken);
			}

			const receiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${item.record.jobId}.json`;
			const receiptBytes = receiptBytesByJob.get(item.record.jobId)!;
			const receipt = await writeOwnedOutput(root, receiptPath, receiptBytes);
			journal = { ...journal, created: [...journal.created, receipt] };
			await writeJournal(root, journal, false, authority.recoveryToken);
			records.push({
				...item.record,
				transactionId: authority.lock.transactionId,
				promotionReceipt: { path: receiptPath, contentHash: sha256(receiptBytes) }
			});
		}
		if (nextVisual && nextCatalog) {
			await testHooks?.beforeSharedWrite?.();
			journal = { ...journal, phase: 'shared-writing' };
			await writeJournal(root, journal, false, authority.recoveryToken);
			await atomicJsonReplace(root, visualPath, nextVisual);
			const visualFile = await fileFingerprint(visualPath);
			journal = {
				...journal,
				shared: journal.shared.map((item, index) =>
					index === 0 ? { ...item, afterFile: visualFile } : item
				)
			};
			await writeJournal(root, journal, false, authority.recoveryToken);
			await testHooks?.afterSharedWrite?.({ index: 0, path: SKILL_ICON_VISUAL_SPECS_PATH });
			const catalogDestination = path.resolve(root, SKILL_ICON_CATALOG_PATH);
			await atomicJsonReplace(root, catalogDestination, nextCatalog);
			const catalogFile = await fileFingerprint(catalogDestination);
			journal = {
				...journal,
				shared: journal.shared.map((item, index) =>
					index === 1 ? { ...item, afterFile: catalogFile } : item
				)
			};
			await writeJournal(root, journal, false, authority.recoveryToken);
			await testHooks?.afterSharedWrite?.({ index: 1, path: SKILL_ICON_CATALOG_PATH });
		}
		await Promise.all(prepared.map((item) => assertPromotionEvidenceCurrent(root, item)));
		await unlink(path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH));
		await syncDirectory(path.resolve(root, 'assets/wiki/skills/icon-production-v1'));
		return records;
	} catch (error) {
		const rollbackFailures: unknown[] = [];
		try {
			await rollbackJournal(root, journal, testHooks);
		} catch (rollbackError) {
			rollbackFailures.push(rollbackError);
		}
		if (rollbackFailures.length > 0)
			throw new AggregateError(
				[error, ...rollbackFailures],
				'Promotion failed and rollback was incomplete',
				{ cause: error }
			);
		try {
			await unlink(path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH));
			await syncDirectory(path.resolve(root, 'assets/wiki/skills/icon-production-v1'));
		} catch (journalError) {
			if ((journalError as NodeJS.ErrnoException).code !== 'ENOENT')
				rollbackFailures.push(journalError);
		}
		if (rollbackFailures.length > 0)
			throw new AggregateError(rollbackFailures, 'Promotion journal cleanup failed', {
				cause: error
			});
		throw error;
	}
}

export async function promoteSkillIconOutput(
	options: PromotionOptions
): Promise<SkillIconAssetRecord> {
	const root = path.resolve(options.root ?? process.cwd());
	return withCoordinatorLock(root, options.testHooks, async (authority) => {
		const prepared = await preparePromotion(
			root,
			options.jobId,
			options.reviewPath,
			options.derivativeResolver
		);
		return (await commitPromotions(root, [prepared], authority, options.testHooks))[0]!;
	});
}

export async function promoteReviewedSkillIconOutputs(options: {
	readonly reviewDirectory: string;
	readonly root?: string;
	readonly derivativeResolver?: SkillIconDerivativeResolver;
	readonly testHooks?: PromotionTestHooks;
}): Promise<readonly SkillIconAssetRecord[]> {
	const root = path.resolve(options.root ?? process.cwd());
	return withCoordinatorLock(root, options.testHooks, async (authority) => {
		const directory = repositoryPath(
			root,
			options.reviewDirectory,
			'assets/wiki/skills/icon-production-v1/review/decisions'
		);
		await assertSafeExistingPath(root, directory.absolute, 'Review directory');
		const metadata = await lstat(directory.absolute);
		if (metadata.isSymbolicLink() || !metadata.isDirectory())
			throw new Error('Review directory must be a real directory');
		const entries = (await readdir(directory.absolute, { withFileTypes: true }))
			.filter((entry) => entry.name.endsWith('.json'))
			.sort((left, right) => left.name.localeCompare(right.name));
		if (entries.length === 0) throw new Error('Review directory contains no review records');
		if (entries.some((entry) => !entry.isFile() || entry.isSymbolicLink()))
			throw new Error('Review directory may contain only regular JSON review files');
		const prepared = await Promise.all(
			entries.map((entry) =>
				preparePromotion(
					root,
					entry.name.replace(/\.json$/u, ''),
					path.join(directory.relative, entry.name),
					options.derivativeResolver
				)
			)
		);
		return commitPromotions(root, prepared, authority, options.testHooks);
	});
}

function option(args: readonly string[], name: string): string | undefined {
	const index = args.indexOf(name);
	return index >= 0 ? args[index + 1] : undefined;
}

export type PromotionCliRequest =
	| {
			readonly mode: 'directory';
			readonly reviewDirectory: string;
	  }
	| {
			readonly mode: 'single';
			readonly jobId: string;
			readonly reviewPath: string;
	  };

export function parsePromotionCliRequest(args: readonly string[]): PromotionCliRequest {
	const allowed = new Set(['--review-dir', '--job', '--review']);
	const seen = new Set<string>();
	for (let index = 0; index < args.length; index += 2) {
		const flag = args[index];
		if (!flag || !allowed.has(flag) || !args[index + 1])
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		seen.add(flag);
	}
	const reviewDirectory = option(args, '--review-dir');
	const jobId = option(args, '--job');
	const reviewPath = option(args, '--review');
	if (reviewDirectory && (jobId || reviewPath))
		throw new Error('Cannot mix --review-dir with --job or --review');
	if (reviewDirectory) return { mode: 'directory', reviewDirectory };
	if (!jobId || !reviewPath)
		throw new Error('Usage: --review-dir <path> or --job <id> --review <path>');
	return { mode: 'single', jobId, reviewPath };
}

async function runCli(args: readonly string[]): Promise<void> {
	const request = parsePromotionCliRequest(args);
	if (request.mode === 'directory') {
		const records = await promoteReviewedSkillIconOutputs({
			reviewDirectory: request.reviewDirectory
		});
		process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
		return;
	}
	process.stdout.write(
		`${JSON.stringify(
			await promoteSkillIconOutput({
				jobId: request.jobId,
				reviewPath: request.reviewPath
			}),
			null,
			2
		)}\n`
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
