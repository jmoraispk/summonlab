import { constants } from 'node:fs';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import {
	link,
	lstat,
	mkdir,
	open,
	readFile,
	readdir,
	realpath,
	rename,
	rmdir,
	unlink
} from 'node:fs/promises';
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
import { resolveDeterministicSkillIconDerivatives } from './compose-skill-icon-assets.js';

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
export const SKILL_ICON_PROMOTION_TOKEN_PATH =
	'assets/wiki/skills/icon-production-v1/.promotion-recovery-token.json' as const;
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
const StagingDirectoryPathSchema = z
	.string()
	.regex(/^assets\/wiki\/skills\/icon-production-v1\/\.promotion-staging\/[a-f0-9-]{36}$/u);
const StagingFilePathSchema = z
	.string()
	.regex(
		/^assets\/wiki\/skills\/icon-production-v1\/\.promotion-staging\/[a-f0-9-]{36}\/\d{4}\.stage$/u
	);
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

const ProcessIdentitySchema = z
	.object({ bootId: z.string().min(1), startTicks: z.string().regex(/^\d+$/u) })
	.strict();

export const SkillIconPromotionLockSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-promotion-lock-v1'),
		transactionId: TransactionTokenSchema,
		recoveryTokenHash: Sha256Schema,
		pid: z.number().int().positive(),
		processIdentity: ProcessIdentitySchema.nullable(),
		acquiredAt: z.string().datetime({ offset: true })
	})
	.strict();

export const SkillIconPromotionTokenSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-promotion-recovery-token-v1'),
		transactionId: TransactionTokenSchema,
		recoveryToken: TransactionTokenSchema,
		pid: z.number().int().positive(),
		processIdentity: ProcessIdentitySchema.nullable(),
		createdAt: z.string().datetime({ offset: true })
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
			z
				.object({
					path: ManagedOutputPathSchema,
					contentHash: Sha256Schema,
					parent: ParentFingerprintSchema,
					file: FileFingerprintSchema.nullable()
				})
				.strict()
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
		),
		staging: z
			.object({
				directoryPath: StagingDirectoryPathSchema,
				parent: ParentFingerprintSchema,
				directory: FileFingerprintSchema,
				files: z.array(
					z
						.object({
							path: StagingFilePathSchema,
							finalPath: ManagedOutputPathSchema,
							contentHash: Sha256Schema,
							file: FileFingerprintSchema
						})
						.strict()
				)
			})
			.strict()
	})
	.strict()
	.superRefine((journal, context) => {
		for (const [name, values] of [
			['job IDs', journal.jobs.map((job) => job.jobId)],
			['master paths', journal.jobs.map((job) => job.masterPath)],
			['planned paths', journal.planned.map((item) => item.path)],
			['created paths', journal.created.map((item) => item.path)],
			['shared paths', journal.shared.map((item) => item.path)],
			['staging paths', journal.staging.files.map((item) => item.path)]
		] as const) {
			if (new Set(values).size !== values.length)
				context.addIssue({ code: 'custom', message: `Promotion journal has duplicate ${name}` });
		}
		const planned = new Map(journal.planned.map((item) => [item.path, item.contentHash]));
		if (!journal.staging.directoryPath.endsWith(`/${journal.transactionId}`))
			context.addIssue({ code: 'custom', message: 'Staging directory does not match transaction' });
		for (const staged of journal.staging.files) {
			if (!staged.path.startsWith(`${journal.staging.directoryPath}/`))
				context.addIssue({ code: 'custom', message: 'Staged file escaped transaction directory' });
			if (planned.get(staged.finalPath) !== staged.contentHash)
				context.addIssue({ code: 'custom', message: 'Staged output is not exactly planned' });
		}
		for (const job of journal.jobs) {
			if (planned.get(job.masterPath) !== job.contentHash)
				context.addIssue({ code: 'custom', message: 'Journal master is not exactly planned' });
		}
		for (const created of journal.created) {
			if (planned.get(created.path) !== created.contentHash)
				context.addIssue({ code: 'custom', message: 'Created output is not exactly planned' });
			const plannedEntry = journal.planned.find((item) => item.path === created.path);
			if (
				!plannedEntry?.file ||
				plannedEntry.file.device !== created.file.device ||
				plannedEntry.file.inode !== created.file.inode
			)
				context.addIssue({
					code: 'custom',
					message: 'Created output inode is not exactly reserved in the plan'
				});
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
	readonly beforeLockWrite?: (input: {
		readonly tokenPath: string;
		readonly recoveryToken: string;
	}) => void | Promise<void>;
	readonly afterLockAcquired?: () => void | Promise<void>;
	readonly beforeMasterWrite?: (input: {
		readonly index: number;
		readonly destination: string;
	}) => void | Promise<void>;
	readonly afterMasterWrite?: (input: {
		readonly index: number;
		readonly destination: string;
	}) => void | Promise<void>;
	readonly afterOutputWriteBeforeProgress?: (input: {
		readonly path: string;
	}) => void | Promise<void>;
	readonly beforeSharedWrite?: () => void | Promise<void>;
	readonly afterSharedWrite?: (input: {
		readonly index: number;
		readonly path: string;
	}) => void | Promise<void>;
	readonly afterSharedReplaceBeforeProgress?: (input: {
		readonly path: string;
	}) => void | Promise<void>;
	readonly beforeRecoveryMutation?: () => void | Promise<void>;
	readonly afterRecoveryOutputDelete?: (input: {
		readonly index: number;
		readonly path: string;
	}) => void | Promise<void>;
	readonly afterRecoverySharedRestore?: (input: { readonly path: string }) => void | Promise<void>;
}

export interface SkillIconDerivativeBuffers {
	readonly runtime512: Buffer;
	readonly runtime256: Buffer;
	readonly runtime128: Buffer;
	readonly recognition96: Buffer;
}

export interface SkillIconDerivativeResolverInput {
	readonly root: string;
	readonly target: Extract<SkillIconTarget, { role: 'skill-art' }>;
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
type PromotionStaging = PromotionJournal['staging'];
interface PromotionAuthority {
	readonly lock: PromotionLock;
	readonly recoveryToken: string;
}

export interface PromotionCoordinatorIdentity {
	readonly pid: number;
	readonly processIdentity: { readonly bootId: string; readonly startTicks: string } | null;
}

interface AuthorityFileIdentity {
	readonly path: string;
	readonly contentHash: string;
	readonly parent: z.infer<typeof ParentFingerprintSchema>;
	readonly file: z.infer<typeof FileFingerprintSchema>;
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

async function readProcessIdentity(
	pid: number
): Promise<PromotionCoordinatorIdentity['processIdentity']> {
	try {
		const [bootId, stat] = await Promise.all([
			readFile('/proc/sys/kernel/random/boot_id', 'utf8'),
			readFile(`/proc/${pid}/stat`, 'utf8')
		]);
		const closingParenthesis = stat.lastIndexOf(')');
		const fields = stat
			.slice(closingParenthesis + 2)
			.trim()
			.split(/\s+/u);
		const startTicks = fields[19];
		if (!startTicks || !/^\d+$/u.test(startTicks)) return null;
		return { bootId: bootId.trim(), startTicks };
	} catch {
		return null;
	}
}

async function coordinatorIsLive(lock: PromotionCoordinatorIdentity): Promise<boolean> {
	try {
		process.kill(lock.pid, 0);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
		return true;
	}
	if (!lock.processIdentity) return true;
	const current = await readProcessIdentity(lock.pid);
	if (!current) return true;
	return (
		current.bootId === lock.processIdentity.bootId &&
		current.startTicks === lock.processIdentity.startTicks
	);
}

function sameProcessIdentity(
	left: PromotionCoordinatorIdentity['processIdentity'],
	right: PromotionCoordinatorIdentity['processIdentity']
): boolean {
	return (
		left === right ||
		Boolean(left && right && left.bootId === right.bootId && left.startTicks === right.startTicks)
	);
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

async function readAuthorityFileIdentity(
	root: string,
	destination: string,
	label: string
): Promise<{ readonly bytes: Buffer; readonly identity: AuthorityFileIdentity }> {
	await ensureSafeParents(root, destination, false);
	const parent = await parentFingerprint(destination);
	const metadata = await lstat(destination);
	const bytes = await readRepositoryRegular(root, destination, label);
	return {
		bytes,
		identity: {
			path: destination,
			contentHash: sha256(bytes),
			parent,
			file: { device: metadata.dev, inode: metadata.ino }
		}
	};
}

async function writeAuthorityFileExclusive(
	root: string,
	destination: string,
	bytes: Buffer,
	mode: number,
	label: string
): Promise<AuthorityFileIdentity> {
	await ensureSafeParents(root, destination, true);
	const parent = await parentFingerprint(destination);
	const handle = await open(
		destination,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
		mode
	);
	try {
		await handle.writeFile(bytes);
		await handle.sync();
	} catch (error) {
		throw new Error(`${label} write failed; partial authority state may require cleanup`, {
			cause: error
		});
	} finally {
		await handle.close();
	}
	await syncDirectory(path.dirname(destination));
	const current = await readAuthorityFileIdentity(root, destination, label);
	if (!current.bytes.equals(bytes) || !sameParentFingerprint(parent, current.identity.parent))
		throw new Error(`${label} identity changed during creation`);
	const permissions = (await lstat(destination)).mode & 0o777;
	if (permissions !== mode)
		throw new Error(`${label} permissions changed during creation: ${permissions.toString(8)}`);
	return current.identity;
}

async function removeAuthorityFile(identity: AuthorityFileIdentity): Promise<void> {
	const currentParent = await parentFingerprint(identity.path);
	if (!sameParentFingerprint(currentParent, identity.parent))
		throw new Error(`Authority parent identity changed; cleanup required: ${identity.path}`);
	const metadata = await lstat(identity.path);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== identity.file.device ||
		metadata.ino !== identity.file.inode
	)
		throw new Error(`Authority file identity changed; cleanup required: ${identity.path}`);
	const handle = await open(identity.path, constants.O_RDONLY | constants.O_NOFOLLOW);
	let bytes: Buffer;
	try {
		const opened = await handle.stat();
		if (opened.dev !== identity.file.device || opened.ino !== identity.file.inode)
			throw new Error(`Authority file changed while opening; cleanup required: ${identity.path}`);
		bytes = await handle.readFile();
	} finally {
		await handle.close();
	}
	if (sha256(bytes) !== identity.contentHash)
		throw new Error(`Authority file hash changed; cleanup required: ${identity.path}`);
	const immediatelyBefore = await lstat(identity.path);
	if (
		immediatelyBefore.isSymbolicLink() ||
		!immediatelyBefore.isFile() ||
		immediatelyBefore.dev !== identity.file.device ||
		immediatelyBefore.ino !== identity.file.inode ||
		!sameParentFingerprint(await parentFingerprint(identity.path), identity.parent)
	)
		throw new Error(`Authority file changed before unlink; cleanup required: ${identity.path}`);
	await unlink(identity.path);
	await syncDirectory(path.dirname(identity.path));
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
		const derivatives = await resolveSkillDerivatives(
			root,
			target as Extract<SkillIconTarget, { role: 'skill-art' }>,
			candidateBytes,
			derivativeResolver ?? resolveDeterministicSkillIconDerivatives
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
	const destinationParent = await parentFingerprint(destination);
	const before = await metadataOrNull(destination);
	if (before?.isSymbolicLink() || (before && !before.isFile()))
		throw new Error(`Shared JSON destination identity is unsafe: ${destination}`);
	const temporary = `${destination}.stage-${process.pid}-${randomUUID()}.tmp`;
	const handle = await open(temporary, 'wx');
	const temporaryParent = await parentFingerprint(temporary);
	let temporaryMetadata: Awaited<ReturnType<typeof handle.stat>>;
	try {
		await handle.writeFile(bytes);
		await handle.sync();
		temporaryMetadata = await handle.stat();
	} finally {
		await handle.close();
	}
	const temporaryIdentity: AuthorityFileIdentity = {
		path: temporary,
		contentHash: sha256(bytes),
		parent: temporaryParent,
		file: { device: temporaryMetadata.dev, inode: temporaryMetadata.ino }
	};
	try {
		await ensureSafeParents(root, destination, false);
		const immediatelyBefore = await metadataOrNull(destination);
		if (immediatelyBefore?.isSymbolicLink() || (immediatelyBefore && !immediatelyBefore.isFile()))
			throw new Error(`Shared JSON destination identity changed before rename: ${destination}`);
		if (
			!sameParentFingerprint(await parentFingerprint(destination), destinationParent) ||
			Boolean(before) !== Boolean(immediatelyBefore) ||
			(before &&
				immediatelyBefore &&
				(before.dev !== immediatelyBefore.dev || before.ino !== immediatelyBefore.ino))
		)
			throw new Error(`Shared JSON destination changed before rename: ${destination}`);
		await rename(temporary, destination);
		await syncDirectory(path.dirname(destination));
		await ensureSafeParents(root, destination, false);
		if (!sameParentFingerprint(await parentFingerprint(destination), destinationParent))
			throw new Error(`Shared JSON parent changed during rename: ${destination}`);
		const committed = await readRepositoryRegular(root, destination, 'Committed shared JSON');
		if (!committed.equals(bytes))
			throw new Error(`Shared JSON destination identity changed during rename: ${destination}`);
	} catch (error) {
		let cleanupError: unknown;
		try {
			if (await metadataOrNull(temporary)) await removeAuthorityFile(temporaryIdentity);
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

async function removeAuthorizedJournal(
	root: string,
	transactionId: string,
	recoveryToken: string
): Promise<void> {
	const destination = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	const current = await readAuthorityFileIdentity(root, destination, 'Promotion journal');
	const journal = parseTransactionJson(
		SkillIconPromotionJournalSchema,
		current.bytes,
		'promotion journal'
	);
	if (
		journal.transactionId !== transactionId ||
		journal.recoveryTokenHash !== sha256(Buffer.from(recoveryToken))
	)
		throw new Error('Promotion journal authority changed; cleanup required');
	assertJournalAuthorization(journal, recoveryToken);
	await removeAuthorityFile(current.identity);
}

function stagingDirectoryPath(transactionId: string): string {
	return `assets/wiki/skills/icon-production-v1/.promotion-staging/${transactionId}`;
}

async function createPromotionStaging(
	root: string,
	transactionId: string
): Promise<PromotionStaging> {
	const directoryPath = StagingDirectoryPathSchema.parse(stagingDirectoryPath(transactionId));
	const destination = path.resolve(root, directoryPath);
	await ensureSafeParents(root, destination, true);
	const parent = await parentFingerprint(destination);
	await mkdir(destination, { mode: 0o700 });
	await syncDirectory(path.dirname(destination));
	const metadata = await lstat(destination);
	if (!metadata.isDirectory() || metadata.isSymbolicLink())
		throw new Error('Promotion staging authority is not a real directory');
	if (!sameParentFingerprint(await parentFingerprint(destination), parent))
		throw new Error('Promotion staging parent changed during creation');
	return {
		directoryPath,
		parent,
		directory: { device: metadata.dev, inode: metadata.ino },
		files: []
	};
}

async function assertPromotionStagingDirectory(
	root: string,
	staging: PromotionStaging
): Promise<void> {
	const directory = path.resolve(root, staging.directoryPath);
	await ensureSafeParents(root, directory, false);
	const metadata = await lstat(directory);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isDirectory() ||
		metadata.dev !== staging.directory.device ||
		metadata.ino !== staging.directory.inode ||
		!sameParentFingerprint(await parentFingerprint(directory), staging.parent)
	)
		throw new Error('Promotion staging directory identity changed; cleanup required');
}

async function cleanupPromotionStaging(root: string, staging: PromotionStaging): Promise<void> {
	const directory = path.resolve(root, staging.directoryPath);
	const directoryMetadata = await metadataOrNull(directory);
	if (!directoryMetadata) return;
	await ensureSafeParents(root, directory, false);
	if (
		directoryMetadata.isSymbolicLink() ||
		!directoryMetadata.isDirectory() ||
		directoryMetadata.dev !== staging.directory.device ||
		directoryMetadata.ino !== staging.directory.inode ||
		!sameParentFingerprint(await parentFingerprint(directory), staging.parent)
	)
		throw new Error('Promotion staging directory identity changed; cleanup required');
	const tracked = new Map(staging.files.map((item) => [path.basename(item.path), item]));
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const staged = tracked.get(entry.name);
		const stagedPath = path.join(directory, entry.name);
		if (!/^\d{4}\.stage$/u.test(entry.name) || entry.isSymbolicLink() || !entry.isFile())
			throw new Error(`Unexpected promotion staging entry; cleanup required: ${entry.name}`);
		const metadata = await lstat(stagedPath);
		if (staged) {
			if (metadata.dev !== staged.file.device || metadata.ino !== staged.file.inode)
				throw new Error(`Staged output inode changed; cleanup required: ${staged.path}`);
		} else if (metadata.size !== 0) {
			throw new Error(`Untracked staging bytes require cleanup: ${entry.name}`);
		}
		const immediatelyBefore = await lstat(stagedPath);
		const currentDirectory = await lstat(directory);
		if (
			immediatelyBefore.dev !== metadata.dev ||
			immediatelyBefore.ino !== metadata.ino ||
			currentDirectory.dev !== staging.directory.device ||
			currentDirectory.ino !== staging.directory.inode
		)
			throw new Error(`Staged output changed before unlink: ${entry.name}`);
		await unlink(stagedPath);
	}
	await syncDirectory(directory);
	const finalDirectory = await lstat(directory);
	if (
		finalDirectory.dev !== staging.directory.device ||
		finalDirectory.ino !== staging.directory.inode ||
		(await readdir(directory)).length !== 0
	)
		throw new Error('Promotion staging directory changed before removal');
	await rmdir(directory);
	await syncDirectory(path.dirname(directory));
}

async function preflightPromotionStaging(root: string, staging: PromotionStaging): Promise<void> {
	const directory = path.resolve(root, staging.directoryPath);
	const metadata = await metadataOrNull(directory);
	if (!metadata) return;
	await ensureSafeParents(root, directory, false);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isDirectory() ||
		metadata.dev !== staging.directory.device ||
		metadata.ino !== staging.directory.inode ||
		!sameParentFingerprint(await parentFingerprint(directory), staging.parent)
	)
		throw new Error('Promotion staging directory identity changed; cleanup required');
	const tracked = new Map(staging.files.map((item) => [path.basename(item.path), item]));
	for (const entry of await readdir(directory, { withFileTypes: true })) {
		const filePath = path.join(directory, entry.name);
		const file = await lstat(filePath);
		const expected = tracked.get(entry.name);
		if (!/^\d{4}\.stage$/u.test(entry.name) || entry.isSymbolicLink() || !entry.isFile())
			throw new Error(`Unexpected promotion staging entry; cleanup required: ${entry.name}`);
		if (expected) {
			if (file.dev !== expected.file.device || file.ino !== expected.file.inode)
				throw new Error(`Staged output inode changed; cleanup required: ${expected.path}`);
		} else if (file.size !== 0) {
			throw new Error(`Untracked staging bytes require cleanup: ${entry.name}`);
		}
	}
}

async function cleanupEmptyUnjournaledStaging(root: string, transactionId: string): Promise<void> {
	const directory = path.resolve(root, stagingDirectoryPath(transactionId));
	const metadata = await metadataOrNull(directory);
	if (!metadata) return;
	await ensureSafeParents(root, directory, false);
	const parent = await parentFingerprint(directory);
	if (metadata.isSymbolicLink() || !metadata.isDirectory() || (metadata.mode & 0o777) !== 0o700)
		throw new Error('Unjournaled staging authority is unsafe; cleanup required');
	if ((await readdir(directory)).length !== 0)
		throw new Error('Unjournaled staging authority is not empty; cleanup required');
	const immediatelyBefore = await lstat(directory);
	if (
		immediatelyBefore.dev !== metadata.dev ||
		immediatelyBefore.ino !== metadata.ino ||
		!sameParentFingerprint(await parentFingerprint(directory), parent)
	)
		throw new Error('Unjournaled staging authority changed before cleanup');
	await rmdir(directory);
	await syncDirectory(path.dirname(directory));
}

async function writeOwnedOutput(
	root: string,
	relativePath: string,
	bytes: Buffer,
	staging: PromotionStaging,
	stageIndex: number,
	afterReservation: (
		planned: PromotionJournal['planned'][number],
		staged: PromotionStaging['files'][number]
	) => Promise<void>,
	afterWrite?: (input: { readonly path: string }) => void | Promise<void>
): Promise<PromotionJournal['created'][number]> {
	ManagedOutputPathSchema.parse(relativePath);
	const destination = path.resolve(root, relativePath);
	await ensureSafeParents(root, destination, true);
	const parent = await parentFingerprint(destination);
	const stagePath = StagingFilePathSchema.parse(
		`${staging.directoryPath}/${String(stageIndex).padStart(4, '0')}.stage`
	);
	const stageDestination = path.resolve(root, stagePath);
	await assertPromotionStagingDirectory(root, staging);
	const handle = await open(
		stageDestination,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
		0o644
	);
	const metadata = await handle.stat();
	const file = { device: metadata.dev, inode: metadata.ino };
	try {
		await afterReservation(
			{ path: relativePath, contentHash: sha256(bytes), parent, file },
			{ path: stagePath, finalPath: relativePath, contentHash: sha256(bytes), file }
		);
		await handle.writeFile(bytes);
		await handle.sync();
	} finally {
		await handle.close();
	}
	await syncDirectory(path.dirname(stageDestination));
	const stagedBytes = await readRepositoryRegular(
		root,
		stageDestination,
		`Staged promotion output ${relativePath}`
	);
	if (!stagedBytes.equals(bytes)) throw new Error(`Staged output bytes changed: ${relativePath}`);
	await assertPromotionStagingDirectory(root, staging);
	const stagedMetadata = await lstat(stageDestination);
	if (stagedMetadata.dev !== file.device || stagedMetadata.ino !== file.inode)
		throw new Error(`Staged output inode changed before link: ${relativePath}`);
	if (!sameParentFingerprint(await parentFingerprint(destination), parent))
		throw new Error(`Promotion output parent changed before link: ${relativePath}`);
	await link(stageDestination, destination);
	await syncDirectory(path.dirname(destination));
	const finalMetadata = await lstat(destination);
	if (finalMetadata.dev !== file.device || finalMetadata.ino !== file.inode)
		throw new Error(`Promotion output inode changed during link: ${relativePath}`);
	await afterWrite?.({ path: relativePath });
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
		file
	};
}

async function assertCompletedOutputs(root: string, journal: PromotionJournal): Promise<void> {
	const created = new Map(journal.created.map((item) => [item.path, item]));
	if (created.size !== journal.planned.length)
		throw new Error('Promotion cannot commit before every planned output is complete');
	for (const planned of journal.planned) {
		const complete = created.get(planned.path);
		if (!planned.file || !complete)
			throw new Error(`Promotion output lacks completed ownership: ${planned.path}`);
		const destination = path.resolve(root, planned.path);
		if (!sameParentFingerprint(await parentFingerprint(destination), planned.parent))
			throw new Error(`Promotion output parent changed before commit: ${planned.path}`);
		const metadata = await lstat(destination);
		if (
			metadata.isSymbolicLink() ||
			!metadata.isFile() ||
			metadata.dev !== planned.file.device ||
			metadata.ino !== planned.file.inode
		)
			throw new Error(`Promotion output inode changed before commit: ${planned.path}`);
		const bytes = await readRepositoryRegular(
			root,
			destination,
			`Completed output ${planned.path}`
		);
		if (sha256(bytes) !== planned.contentHash)
			throw new Error(`Promotion output hash changed before commit: ${planned.path}`);
	}
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
	if (hash === item.before.contentHash) return 'before';
	if (
		hash === item.afterHash &&
		(!item.afterFile ||
			(metadata.dev === item.afterFile.device && metadata.ino === item.afterFile.inode))
	)
		return 'after';
	throw new Error(`Shared state hash changed; cleanup required: ${item.path}`);
}

async function rollbackJournal(
	root: string,
	journal: PromotionJournal,
	testHooks?: PromotionTestHooks
): Promise<void> {
	const createdByPath = new Map(journal.created.map((item) => [item.path, item]));
	const outputs: { planned: PromotionJournal['planned'][number]; exists: boolean }[] = [];
	for (const planned of journal.planned) {
		const destination = path.resolve(root, planned.path);
		const metadata = await metadataOrNull(destination);
		if (!metadata) {
			outputs.push({ planned, exists: false });
			continue;
		}
		await ensureSafeParents(root, destination, false);
		if (!sameParentFingerprint(await parentFingerprint(destination), planned.parent))
			throw new Error(`Planned output parent identity changed; cleanup required: ${planned.path}`);
		if (metadata.isSymbolicLink() || !metadata.isFile())
			throw new Error(`Planned output identity is unsafe: ${planned.path}`);
		if (
			!planned.file ||
			metadata.dev !== planned.file.device ||
			metadata.ino !== planned.file.inode
		)
			throw new Error(`Planned output inode changed; cleanup required: ${planned.path}`);
		const created = createdByPath.get(planned.path);
		const bytes = await readRepositoryRegular(root, destination, `Recovery output ${planned.path}`);
		if (created && sha256(bytes) !== planned.contentHash)
			throw new Error(`Completed output hash changed; cleanup required: ${planned.path}`);
		if (created && (metadata.dev !== created.file.device || metadata.ino !== created.file.inode))
			throw new Error(`Created output inode changed; cleanup required: ${planned.path}`);
		outputs.push({ planned, exists: true });
	}
	const sharedStates = await Promise.all(
		journal.shared.map(async (item) => ({ item, state: await assertSharedIdentity(root, item) }))
	);
	await preflightPromotionStaging(root, journal.staging);
	await testHooks?.beforeRecoveryMutation?.();
	for (const { item, state } of sharedStates) {
		if (state === 'before') continue;
		if ((await assertSharedIdentity(root, item)) !== 'after')
			throw new Error(`Shared state changed during recovery: ${item.path}`);
		await atomicJsonReplace(
			root,
			path.resolve(root, item.path),
			Buffer.from(item.before.bytesBase64, 'base64')
		);
		await testHooks?.afterRecoverySharedRestore?.({ path: item.path });
	}
	for (const [index, output] of [...outputs].reverse().entries()) {
		if (!output.exists) continue;
		const destination = path.resolve(root, output.planned.path);
		const current = await metadataOrNull(destination);
		if (!current) continue;
		if (!sameParentFingerprint(await parentFingerprint(destination), output.planned.parent))
			throw new Error(`Planned output parent changed during recovery: ${output.planned.path}`);
		if (
			!output.planned.file ||
			current.dev !== output.planned.file.device ||
			current.ino !== output.planned.file.inode
		)
			throw new Error(`Planned output inode changed during recovery: ${output.planned.path}`);
		const created = createdByPath.get(output.planned.path);
		const bytes = await readRepositoryRegular(
			root,
			destination,
			`Recovery output ${output.planned.path}`
		);
		if (created && sha256(bytes) !== output.planned.contentHash)
			throw new Error(`Completed output changed during recovery: ${output.planned.path}`);
		if (created && (current.dev !== created.file.device || current.ino !== created.file.inode))
			throw new Error(`Created output inode changed during recovery: ${output.planned.path}`);
		const immediatelyBefore = await lstat(destination);
		if (
			immediatelyBefore.isSymbolicLink() ||
			!immediatelyBefore.isFile() ||
			immediatelyBefore.dev !== output.planned.file.device ||
			immediatelyBefore.ino !== output.planned.file.inode ||
			!sameParentFingerprint(await parentFingerprint(destination), output.planned.parent)
		)
			throw new Error(`Planned output changed before unlink: ${output.planned.path}`);
		await unlink(destination);
		await syncDirectory(path.dirname(destination));
		await testHooks?.afterRecoveryOutputDelete?.({ index, path: output.planned.path });
	}
	await cleanupPromotionStaging(root, journal.staging);
}

export async function recoverSkillIconPromotion(options: {
	readonly root?: string;
	readonly transactionToken: string;
	readonly isCoordinatorLive?: (
		identity: PromotionCoordinatorIdentity
	) => boolean | Promise<boolean>;
	readonly testHooks?: PromotionTestHooks;
}): Promise<void> {
	const root = path.resolve(options.root ?? process.cwd());
	const tokenPath = path.resolve(root, SKILL_ICON_PROMOTION_TOKEN_PATH);
	const lockPath = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	const journalPath = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	const token = TransactionTokenSchema.parse(options.transactionToken);
	if (!(await metadataOrNull(tokenPath)))
		throw new Error('Recovery requires the durable promotion token file');
	const tokenAuthority = await readAuthorityFileIdentity(
		root,
		tokenPath,
		'Promotion recovery token'
	);
	if (((await lstat(tokenPath)).mode & 0o777) !== 0o600)
		throw new Error('Promotion recovery token permissions are unsafe; cleanup required');
	const tokenRecord = parseTransactionJson(
		SkillIconPromotionTokenSchema,
		tokenAuthority.bytes,
		'promotion recovery token'
	);
	if (tokenRecord.recoveryToken !== token)
		throw new Error('Recovery token does not authorize this promotion transaction');
	const lockMetadata = await metadataOrNull(lockPath);
	const journalMetadata = await metadataOrNull(journalPath);
	if (!lockMetadata) {
		if (journalMetadata)
			throw new Error('Promotion journal exists without its transaction lock; cleanup required');
		const tokenOwnerIsLive = await (options.isCoordinatorLive ?? coordinatorIsLive)({
			pid: tokenRecord.pid,
			processIdentity: tokenRecord.processIdentity
		});
		if (tokenOwnerIsLive)
			throw new Error('Recovery refused because a live coordinator owns the pre-lock token');
		await removeAuthorityFile(tokenAuthority.identity);
		return;
	}
	const lockAuthority = await readAuthorityFileIdentity(root, lockPath, 'Coordinator lock');
	const lock = parseTransactionJson(
		SkillIconPromotionLockSchema,
		lockAuthority.bytes,
		'promotion lock'
	);
	if (
		lock.transactionId !== tokenRecord.transactionId ||
		lock.recoveryTokenHash !== sha256(Buffer.from(token)) ||
		lock.pid !== tokenRecord.pid ||
		!sameProcessIdentity(lock.processIdentity, tokenRecord.processIdentity)
	)
		throw new Error('Recovery token and lock transaction authority do not match');
	const isLive = await (options.isCoordinatorLive ?? coordinatorIsLive)({
		pid: lock.pid,
		processIdentity: lock.processIdentity
	});
	if (isLive) throw new Error('Recovery refused because a live coordinator owns the promotion');
	if (journalMetadata) {
		const journalAuthority = await readAuthorityFileIdentity(
			root,
			journalPath,
			'Promotion journal'
		);
		const journal = parseTransactionJson(
			SkillIconPromotionJournalSchema,
			journalAuthority.bytes,
			'promotion journal'
		);
		if (
			journal.transactionId !== lock.transactionId ||
			journal.recoveryTokenHash !== lock.recoveryTokenHash
		)
			throw new Error('Lock and journal transaction authority do not match');
		assertJournalAuthorization(journal, token);
		await rollbackJournal(root, journal, options.testHooks);
		await removeAuthorityFile(journalAuthority.identity);
	} else await cleanupEmptyUnjournaledStaging(root, lock.transactionId);
	await removeAuthorityFile(lockAuthority.identity);
	await removeAuthorityFile(tokenAuthority.identity);
}

async function withCoordinatorLock<T>(
	root: string,
	testHooks: PromotionTestHooks | undefined,
	operation: (authority: PromotionAuthority) => Promise<T>
): Promise<T> {
	const tokenPath = path.resolve(root, SKILL_ICON_PROMOTION_TOKEN_PATH);
	const lockPath = path.resolve(root, SKILL_ICON_PROMOTION_LOCK_PATH);
	const journalPath = path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH);
	await ensureSafeParents(root, lockPath, true);
	if (await metadataOrNull(tokenPath)) {
		parseTransactionJson(
			SkillIconPromotionTokenSchema,
			await readRepositoryRegular(root, tokenPath, 'promotion recovery token'),
			'promotion recovery token'
		);
		throw new Error(
			'Existing promotion recovery token blocks promotion; explicit token-bound recovery is required'
		);
	}
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
	const processIdentity = await readProcessIdentity(process.pid);
	const authority: PromotionAuthority = {
		recoveryToken,
		lock: {
			schemaVersion: 'skill-icon-promotion-lock-v1',
			transactionId: randomUUID(),
			recoveryTokenHash: sha256(Buffer.from(recoveryToken)),
			pid: process.pid,
			processIdentity,
			acquiredAt: new Date().toISOString()
		}
	};
	const tokenBytes = journalBytes({
		schemaVersion: 'skill-icon-promotion-recovery-token-v1',
		transactionId: authority.lock.transactionId,
		recoveryToken,
		pid: authority.lock.pid,
		processIdentity: authority.lock.processIdentity,
		createdAt: authority.lock.acquiredAt
	});
	let tokenIdentity: AuthorityFileIdentity;
	try {
		tokenIdentity = await writeAuthorityFileExclusive(
			root,
			tokenPath,
			tokenBytes,
			0o600,
			'Promotion recovery token'
		);
	} catch (error) {
		throw new Error(
			`Promotion recovery-token initialization failed; recovery token ${recoveryToken}`,
			{ cause: error }
		);
	}
	let lockIdentity: AuthorityFileIdentity;
	try {
		await testHooks?.beforeLockWrite?.({ tokenPath, recoveryToken });
		lockIdentity = await writeAuthorityFileExclusive(
			root,
			lockPath,
			journalBytes(authority.lock),
			0o600,
			'Promotion coordinator lock'
		);
	} catch (error) {
		// The durable token is intentionally retained. This covers process death and partial lock
		// creation without guessing whether a pathname is still owned by this transaction.
		throw new Error(
			`Promotion lock initialization failed; explicit cleanup requires recovery token ${recoveryToken}`,
			{ cause: error }
		);
	}
	if (await metadataOrNull(journalPath)) {
		throw new Error(
			`A promotion journal appeared after lock acquisition; lock retained for recovery token ${authority.recoveryToken}`
		);
	}
	let result: T;
	try {
		await testHooks?.afterLockAcquired?.();
		result = await operation(authority);
		if (await metadataOrNull(journalPath))
			throw new Error('Promotion returned while its durable journal still exists');
	} catch (error) {
		if (await metadataOrNull(journalPath))
			throw new Error(
				`Promotion failed with durable recovery state retained; recovery token ${authority.recoveryToken}`,
				{ cause: error }
			);
		try {
			await cleanupEmptyUnjournaledStaging(root, authority.lock.transactionId);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				`Promotion failed and staging cleanup requires recovery token ${recoveryToken}`,
				{ cause: cleanupError }
			);
		}
		try {
			await removeAuthorityFile(lockIdentity);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				`Promotion failed and authority cleanup requires recovery token ${recoveryToken}`,
				{ cause: cleanupError }
			);
		}
		try {
			await removeAuthorityFile(tokenIdentity);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				`Promotion failed and token cleanup requires recovery token ${recoveryToken}`,
				{ cause: cleanupError }
			);
		}
		throw error;
	}
	try {
		await removeAuthorityFile(lockIdentity);
		await removeAuthorityFile(tokenIdentity);
	} catch (error) {
		throw new Error(
			`Promotion committed but authority cleanup requires recovery token ${recoveryToken}`,
			{ cause: error }
		);
	}
	return result;
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
	const plannedSpecs = prepared.flatMap((item) => {
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
	const planned = await Promise.all(
		plannedSpecs.map(async (item) => {
			const destination = path.resolve(root, item.path);
			await ensureSafeParents(root, destination, true);
			return { ...item, parent: await parentFingerprint(destination), file: null };
		})
	);
	const staging = await createPromotionStaging(root, authority.lock.transactionId);

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
		shared,
		staging
	};
	try {
		await writeJournal(root, journal, true, authority.recoveryToken);
	} catch (error) {
		if (!(await metadataOrNull(path.resolve(root, SKILL_ICON_PROMOTION_JOURNAL_PATH))))
			await cleanupPromotionStaging(root, staging);
		throw error;
	}
	const records: SkillIconAssetRecord[] = [];
	try {
		const recordReservation = async (
			reservation: PromotionJournal['planned'][number],
			staged: PromotionStaging['files'][number]
		): Promise<void> => {
			journal = {
				...journal,
				phase: 'outputs-writing',
				planned: journal.planned.map((item) =>
					item.path === reservation.path ? reservation : item
				),
				staging: { ...journal.staging, files: [...journal.staging.files, staged] }
			};
			await writeJournal(root, journal, false, authority.recoveryToken);
		};
		let stageIndex = 0;
		for (const [index, item] of prepared.entries()) {
			await ensureSafeParents(root, item.destination, true);
			await testHooks?.beforeMasterWrite?.({ index, destination: item.destination });
			await ensureSafeParents(root, item.destination, false);
			const master = await writeOwnedOutput(
				root,
				item.record.approvedMaster.path,
				item.bytes,
				staging,
				stageIndex++,
				recordReservation,
				testHooks?.afterOutputWriteBeforeProgress
			);
			journal = {
				...journal,
				phase: 'outputs-writing',
				created: [...journal.created, master]
			};
			await writeJournal(root, journal, false, authority.recoveryToken);
			await testHooks?.afterMasterWrite?.({ index, destination: item.destination });
			for (const output of item.additionalOutputs) {
				const createdOutput = await writeOwnedOutput(
					root,
					output.asset.path,
					output.bytes,
					staging,
					stageIndex++,
					recordReservation,
					testHooks?.afterOutputWriteBeforeProgress
				);
				journal = { ...journal, created: [...journal.created, createdOutput] };
				await writeJournal(root, journal, false, authority.recoveryToken);
			}

			const receiptPath = `${SKILL_ICON_PROMOTION_RECEIPT_ROOT}/${item.record.jobId}.json`;
			const receiptBytes = receiptBytesByJob.get(item.record.jobId)!;
			const receipt = await writeOwnedOutput(
				root,
				receiptPath,
				receiptBytes,
				staging,
				stageIndex++,
				recordReservation,
				testHooks?.afterOutputWriteBeforeProgress
			);
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
			await testHooks?.afterSharedReplaceBeforeProgress?.({
				path: SKILL_ICON_VISUAL_SPECS_PATH
			});
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
			await testHooks?.afterSharedReplaceBeforeProgress?.({ path: SKILL_ICON_CATALOG_PATH });
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
		await assertCompletedOutputs(root, journal);
		await cleanupPromotionStaging(root, journal.staging);
		await removeAuthorizedJournal(root, authority.lock.transactionId, authority.recoveryToken);
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
			await removeAuthorizedJournal(root, authority.lock.transactionId, authority.recoveryToken);
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

export async function runSkillIconPromotionCli(
	args: readonly string[],
	options: { readonly root?: string } = {}
): Promise<SkillIconAssetRecord | readonly SkillIconAssetRecord[]> {
	const request = parsePromotionCliRequest(args);
	if (request.mode === 'directory') {
		return promoteReviewedSkillIconOutputs({
			reviewDirectory: request.reviewDirectory,
			...(options.root ? { root: options.root } : {})
		});
	}
	return promoteSkillIconOutput({
		jobId: request.jobId,
		reviewPath: request.reviewPath,
		...(options.root ? { root: options.root } : {})
	});
}

async function runCli(args: readonly string[]): Promise<void> {
	process.stdout.write(`${JSON.stringify(await runSkillIconPromotionCli(args), null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
