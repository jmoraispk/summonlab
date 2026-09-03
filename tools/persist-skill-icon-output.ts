import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readFile, readdir, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { z } from 'zod';

import {
	AnySkillIconAssignmentSchema,
	AnySkillIconExecutionSchema,
	AnySkillIconGeometrySchema,
	AnySkillIconResultSchema,
	AnySkillIconTargetSchema,
	SKILL_ICON_SUPERSESSION_REASON,
	SkillIconAssignmentV2Schema,
	SkillIconAssignmentPathSchema,
	SkillIconCandidatePathSchema,
	SkillIconGeometrySchema,
	SkillIconGeometryV2Schema,
	SkillIconRoleSchema,
	SkillIconResultSchema,
	SkillIconResultV2Schema,
	SkillIconTargetV2Schema,
	SkillIconTargetPathSchema,
	type AnySkillIconAssignment,
	type AnySkillIconTarget,
	type AnySkillIconGeometry,
	type SkillIconRole
} from '../packages/contracts/src/index.js';
import { IsoDateTimeSchema, StateHashSchema } from '../packages/contracts/src/shared.js';
import { SKILL_ICON_GEOMETRY_PATH } from './export-skill-icon-geometry.js';
import {
	inspectSkillIconAsset,
	type SkillIconAssetInspection
} from './validate-skill-icon-assets.js';
import {
	normalizeSkillIconProviderSource,
	readSkillIconProviderSourceOnce,
	SKILL_ICON_NORMALIZATION_PROFILE_V1,
	SKILL_ICON_NORMALIZATION_PROFILE_V2,
	SKILL_ICON_NORMALIZATION_PROFILE_V3,
	type SkillIconProviderSourceEvidence
} from './normalize-skill-icon-provider-source.js';
import {
	assertSkillIconSupersedingRevision,
	skillIconScopeForRole
} from './skill-icon-revision-lib.js';

interface PersistSkillIconOutputCommonOptions {
	readonly sourcePath: string;
	readonly candidatePath: string;
	readonly expectedRole: SkillIconRole;
	readonly geometry: AnySkillIconGeometry;
	readonly geometrySourceBytes?: Buffer;
}

export interface PersistSkillIconOutputOptions extends PersistSkillIconOutputCommonOptions {
	readonly expectedSourceHash: string;
}

export interface PersistSkillIconOutputDependencies {
	readonly now?: () => Date;
	readonly testHooks?: {
		readonly afterAuthorityRead?: () => void | Promise<void>;
	};
}

export interface PersistSkillIconOutputBoundOptions extends PersistSkillIconOutputCommonOptions {
	readonly root?: string;
	readonly target: AnySkillIconTarget;
	readonly assignment: AnySkillIconAssignment;
	readonly receivedAt: string;
	readonly expectedSourceHash?: string;
	readonly testHooks?: {
		readonly afterTokenStageOpen?: () => void | Promise<void>;
		readonly afterTokenStageComplete?: () => void | Promise<void>;
		readonly afterTokenInstall?: () => void | Promise<void>;
		readonly afterLockInstall?: () => void | Promise<void>;
		readonly afterSourceRead?: () => void | Promise<void>;
		readonly afterNormalization?: () => void | Promise<void>;
		readonly beforeCandidateWrite?: () => void | Promise<void>;
		readonly afterCandidateOpen?: () => void | Promise<void>;
		readonly afterCandidateInstall?: () => void | Promise<void>;
		readonly afterOutputStagesComplete?: () => void | Promise<void>;
		readonly beforeResultWrite?: () => void | Promise<void>;
		readonly afterResultOpen?: () => void | Promise<void>;
		readonly afterResultInstall?: () => void | Promise<void>;
		readonly afterJournalRemoval?: () => void | Promise<void>;
	};
}

export interface SkillIconAssetReceipt {
	readonly schemaVersion: 'skill-icon-asset-receipt-v1';
	readonly jobId: string;
	readonly role: SkillIconRole;
	readonly receivedAt: string;
	readonly source: (SkillIconAssetInspection | SkillIconProviderSourceEvidence) & {
		readonly path: string;
	};
	readonly retained: SkillIconAssetInspection & { readonly path: string };
	readonly result: { readonly path: string; readonly contentHash: string };
}

export interface PersistSkillIconSupersededResultTestHooks {
	readonly afterAuthorityRead?: () => void | Promise<void>;
	readonly afterTokenInstall?: () => void | Promise<void>;
	readonly afterLockInstall?: () => void | Promise<void>;
	readonly afterIntentInstall?: () => void | Promise<void>;
	readonly afterResultOpen?: () => void | Promise<void>;
	readonly afterOutputStageComplete?: () => void | Promise<void>;
	readonly afterJournalInstall?: () => void | Promise<void>;
	readonly afterResultInstall?: () => void | Promise<void>;
	readonly afterJournalRemoval?: () => void | Promise<void>;
	readonly afterIntentRemoval?: () => void | Promise<void>;
}

export interface PersistSkillIconSupersededResultOptions {
	readonly root?: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly supersedingTargetPath: string;
	readonly supersedingAssignmentPath: string;
	readonly completedAt: string;
	readonly reason: typeof SKILL_ICON_SUPERSESSION_REASON;
	readonly testHooks?: PersistSkillIconSupersededResultTestHooks;
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

async function ensureSafeParents(root: string, destination: string): Promise<void> {
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	const realRoot = await realpath(root);
	if (!inside(root, destination) || destination === root)
		throw new Error('Candidate output escaped the workspace root');
	const relativeParent = path.relative(root, path.dirname(destination));
	let cursor = root;
	for (const segment of relativeParent.split(path.sep).filter(Boolean)) {
		cursor = path.join(cursor, segment);
		let metadata = await metadataOrNull(cursor);
		if (!metadata) {
			await mkdir(cursor).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink())
			throw new Error(`Candidate parent cannot be a symbolic link: ${cursor}`);
		if (!metadata.isDirectory()) throw new Error(`Candidate parent is not a directory: ${cursor}`);
		if (!inside(realRoot, await realpath(cursor)))
			throw new Error(`Candidate parent escaped the real workspace root: ${cursor}`);
	}
}

interface OwnedPersistedFile {
	readonly path: string;
	readonly parent: { readonly realPath: string; readonly device: number; readonly inode: number };
	readonly file: { readonly device: number; readonly inode: number };
}

interface HeldPersistenceParent {
	readonly path: string;
	readonly handle: Awaited<ReturnType<typeof open>>;
	readonly fingerprint: OwnedPersistedFile['parent'];
}

interface StagedPersistedFile {
	readonly path: string;
	readonly accessPath: string;
	readonly file: OwnedPersistedFile['file'];
}

function stagedSiblingName(destinationName: string, suffix: string): string {
	return `${destinationName.startsWith('.') ? '' : '.'}${destinationName}.skill-icon-tmp-${suffix}`;
}

async function assertStagedPathOwned(staged: StagedPersistedFile): Promise<void> {
	const metadata = await metadataOrNull(staged.accessPath);
	if (!metadata) throw new Error(`Staged persistence path disappeared`);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== staged.file.device ||
		metadata.ino !== staged.file.inode
	)
		throw new Error(`Staged persistence path identity changed; cleanup required`);
}

async function unlinkStagedIfOwned(staged: StagedPersistedFile): Promise<void> {
	const metadata = await metadataOrNull(staged.accessPath);
	if (!metadata) return;
	await assertStagedPathOwned(staged);
	await unlink(staged.accessPath);
}

function heldChildPath(parent: HeldPersistenceParent, name: string): string {
	if (name !== path.basename(name) || name === '.' || name === '..')
		throw new Error(`Unsafe persistence child name: ${name}`);
	return `/proc/self/fd/${parent.handle.fd}/${name}`;
}

async function openHeldPersistenceParent(
	root: string,
	destination: string
): Promise<HeldPersistenceParent> {
	await ensureSafeParents(root, destination);
	const parentPath = path.dirname(destination);
	const expected = await persistenceParentFingerprint(destination);
	const handle = await open(
		parentPath,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		const opened = await handle.stat();
		const heldRealPath = await realpath(`/proc/self/fd/${handle.fd}`);
		const realRoot = await realpath(root);
		if (
			!opened.isDirectory() ||
			opened.dev !== expected.device ||
			opened.ino !== expected.inode ||
			heldRealPath !== expected.realPath ||
			!inside(realRoot, heldRealPath)
		)
			throw new Error(`Persistence parent identity changed while opening: ${parentPath}`);
		return { path: parentPath, handle, fingerprint: expected };
	} catch (error) {
		await handle.close();
		throw error;
	}
}

async function assertHeldParentStillNamed(parent: HeldPersistenceParent): Promise<void> {
	const current = await persistenceParentFingerprint(path.join(parent.path, '.identity'));
	if (
		current.realPath !== parent.fingerprint.realPath ||
		current.device !== parent.fingerprint.device ||
		current.inode !== parent.fingerprint.inode
	)
		throw new Error(`Persistence parent identity changed: ${parent.path}`);
}

async function stageCompleteSibling(
	parent: HeldPersistenceParent,
	destinationName: string,
	bytes: Buffer,
	afterOpen?: () => void | Promise<void>,
	finalMode = 0o644,
	temporarySuffix = `${process.pid}-${randomUUID()}`
): Promise<StagedPersistedFile> {
	const temporaryName = stagedSiblingName(destinationName, temporarySuffix);
	const accessPath = heldChildPath(parent, temporaryName);
	const handle = await open(
		accessPath,
		constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
		0o600
	);
	let staged: StagedPersistedFile | undefined;
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile() || metadata.nlink !== 1)
			throw new Error(`Unsafe staged persistence file: ${temporaryName}`);
		staged = {
			path: path.join(parent.path, temporaryName),
			accessPath,
			file: { device: metadata.dev, inode: metadata.ino }
		};
		await afterOpen?.();
		await handle.writeFile(bytes);
		await handle.chmod(finalMode);
		await handle.sync();
		await parent.handle.sync();
		return staged;
	} catch (error) {
		if (staged) {
			try {
				await unlinkStagedIfOwned(staged);
			} catch (cleanupError) {
				throw new AggregateError(
					[error, cleanupError],
					'Staging failed and cleanup was refused because ownership changed',
					{ cause: cleanupError }
				);
			}
		}
		throw error;
	} finally {
		await handle.close().catch(() => undefined);
	}
}

async function publishStagedNoReplace(
	parent: HeldPersistenceParent,
	destination: string,
	staged: StagedPersistedFile
): Promise<OwnedPersistedFile> {
	const finalAccessPath = heldChildPath(parent, path.basename(destination));
	await assertHeldParentStillNamed(parent);
	await assertStagedPathOwned(staged);
	await link(staged.accessPath, finalAccessPath);
	await parent.handle.sync();
	const finalMetadata = await lstat(finalAccessPath);
	if (
		finalMetadata.isSymbolicLink() ||
		!finalMetadata.isFile() ||
		finalMetadata.dev !== staged.file.device ||
		finalMetadata.ino !== staged.file.inode
	)
		throw new Error(`Installed persistence file identity mismatch: ${destination}`);
	await assertHeldParentStillNamed(parent);
	return { path: destination, parent: parent.fingerprint, file: staged.file };
}

async function installStagedNoReplace(
	parent: HeldPersistenceParent,
	destination: string,
	staged: StagedPersistedFile
): Promise<OwnedPersistedFile> {
	const finalAccessPath = heldChildPath(parent, path.basename(destination));
	try {
		await assertHeldParentStillNamed(parent);
		await assertStagedPathOwned(staged);
		// A hard link is an atomic, no-replace publication on Linux. The final name is
		// never observable until the complete, fsynced inode is ready.
		await link(staged.accessPath, finalAccessPath);
		const finalMetadata = await lstat(finalAccessPath);
		if (
			finalMetadata.isSymbolicLink() ||
			!finalMetadata.isFile() ||
			finalMetadata.dev !== staged.file.device ||
			finalMetadata.ino !== staged.file.inode
		)
			throw new Error(`Installed persistence file identity mismatch: ${destination}`);
		await unlinkStagedIfOwned(staged);
		await parent.handle.sync();
		await assertHeldParentStillNamed(parent);
		return {
			path: destination,
			parent: parent.fingerprint,
			file: staged.file
		};
	} catch (error) {
		const installed = await metadataOrNull(finalAccessPath);
		if (
			installed?.isFile() &&
			!installed.isSymbolicLink() &&
			installed.dev === staged.file.device &&
			installed.ino === staged.file.inode
		)
			await unlink(finalAccessPath).catch(() => undefined);
		try {
			await unlinkStagedIfOwned(staged);
		} catch {
			// Preserve an unowned replacement for explicit operator cleanup.
		}
		await parent.handle.sync().catch(() => undefined);
		throw error;
	}
}

async function removeOwnedPersistedFileHeld(
	parent: HeldPersistenceParent,
	owned: OwnedPersistedFile,
	expectedBytes?: Buffer
): Promise<void> {
	const accessPath = heldChildPath(parent, path.basename(owned.path));
	const metadata = await metadataOrNull(accessPath);
	if (!metadata) return;
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== owned.file.device ||
		metadata.ino !== owned.file.inode
	)
		throw new Error(`Persistence file identity changed; cleanup required: ${owned.path}`);
	if (expectedBytes) {
		const handle = await open(
			accessPath,
			constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW
		);
		try {
			const opened = await handle.stat({ bigint: true });
			if (
				!opened.isFile() ||
				opened.dev !== BigInt(owned.file.device) ||
				opened.ino !== BigInt(owned.file.inode)
			)
				throw new Error(`Persistence file identity changed while opening: ${owned.path}`);
			const bytes = await readBoundedRegularFile(handle, opened.size, 'Owned persistence file');
			if (!bytes.equals(expectedBytes))
				throw new Error(`Persistence file bytes changed; cleanup required: ${owned.path}`);
		} finally {
			await handle.close();
		}
	}
	await unlink(accessPath);
	await parent.handle.sync();
}

interface SafePacketSnapshot {
	readonly bytes: Buffer;
	readonly parent: {
		readonly realPath: string;
		readonly device: string;
		readonly inode: string;
	};
	readonly file: {
		readonly device: string;
		readonly inode: string;
		readonly size: string;
		readonly mtimeNs: string;
		readonly ctimeNs: string;
	};
}

const MAX_SAFE_PACKET_BYTES = 64 * 1024 * 1024;

async function readBoundedRegularFile(
	handle: Awaited<ReturnType<typeof open>>,
	expectedSize: bigint,
	description: string
): Promise<Buffer> {
	if (expectedSize < 0n || expectedSize > BigInt(MAX_SAFE_PACKET_BYTES))
		throw new Error(`${description} exceeds the ${MAX_SAFE_PACKET_BYTES}-byte safety limit`);
	const bytes = Buffer.alloc(Number(expectedSize));
	let offset = 0;
	while (offset < bytes.length) {
		const read = await handle.read(bytes, offset, bytes.length - offset, null);
		if (read.bytesRead === 0) throw new Error(`${description} changed size while reading`);
		offset += read.bytesRead;
	}
	const trailing = await handle.read(Buffer.alloc(1), 0, 1, null);
	if (trailing.bytesRead !== 0) throw new Error(`${description} grew while reading`);
	return bytes;
}

interface BoundTargetReference {
	readonly path: string;
	readonly contentHash: string;
	readonly description: string;
	readonly snapshot: Omit<SafePacketSnapshot, 'bytes'>;
}

function bindSafePacket(
	path: string,
	description: string,
	snapshot: SafePacketSnapshot
): BoundTargetReference {
	const { bytes, ...identity } = snapshot;
	return {
		path,
		description,
		contentHash: createHash('sha256').update(bytes).digest('hex'),
		snapshot: identity
	};
}

function sameSafePacketIdentity(
	left: Omit<SafePacketSnapshot, 'bytes'>,
	right: Omit<SafePacketSnapshot, 'bytes'>
): boolean {
	return (
		left.parent.realPath === right.parent.realPath &&
		left.parent.device === right.parent.device &&
		left.parent.inode === right.parent.inode &&
		left.file.device === right.file.device &&
		left.file.inode === right.file.inode &&
		left.file.size === right.file.size &&
		left.file.mtimeNs === right.file.mtimeNs &&
		left.file.ctimeNs === right.file.ctimeNs
	);
}

async function bindTargetReferences(
	root: string,
	target: AnySkillIconTarget
): Promise<readonly BoundTargetReference[]> {
	const bindings: BoundTargetReference[] = [];
	for (const reference of target.references) {
		const { bytes, ...snapshot } = await readSafePacketSnapshot(
			root,
			reference.path,
			`Target reference ${reference.path}`
		);
		const contentHash = createHash('sha256').update(bytes).digest('hex');
		if (contentHash !== reference.contentHash)
			throw new Error(`Target reference hash changed before persistence: ${reference.path}`);
		bindings.push({
			path: reference.path,
			description: `Target reference ${reference.path}`,
			contentHash,
			snapshot
		});
	}
	return bindings;
}

async function assertTargetReferencesStillBound(
	root: string,
	bindings: readonly BoundTargetReference[]
): Promise<void> {
	for (const binding of bindings) {
		const { bytes, ...snapshot } = await readSafePacketSnapshot(
			root,
			binding.path,
			binding.description
		);
		const contentHash = createHash('sha256').update(bytes).digest('hex');
		if (contentHash !== binding.contentHash || !sameSafePacketIdentity(binding.snapshot, snapshot))
			throw new Error(`${binding.description} changed during persistence`);
	}
}

async function persistenceParentFingerprint(
	destination: string
): Promise<OwnedPersistedFile['parent']> {
	const parent = path.dirname(destination);
	const [realPath, metadata] = await Promise.all([realpath(parent), lstat(parent)]);
	if (metadata.isSymbolicLink() || !metadata.isDirectory())
		throw new Error(`Persistence parent identity is unsafe: ${parent}`);
	return { realPath, device: metadata.dev, inode: metadata.ino };
}

async function assertOwnedPersistedFile(
	owned: OwnedPersistedFile,
	expectedBytes: Buffer,
	description: string
): Promise<void> {
	const parent = await persistenceParentFingerprint(owned.path);
	const metadata = await lstat(owned.path);
	if (
		parent.realPath !== owned.parent.realPath ||
		parent.device !== owned.parent.device ||
		parent.inode !== owned.parent.inode ||
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== owned.file.device ||
		metadata.ino !== owned.file.inode
	)
		throw new Error(`${description} identity changed during persistence`);
	const handle = await open(owned.path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const opened = await handle.stat();
		if (opened.dev !== owned.file.device || opened.ino !== owned.file.inode)
			throw new Error(`${description} identity changed while opening`);
		const bytes = await handle.readFile();
		if (!bytes.equals(expectedBytes))
			throw new Error(`${description} bytes changed during persistence`);
	} finally {
		await handle.close();
	}
}

async function readSafePacketSnapshot(
	root: string,
	relativePath: string,
	description: string
): Promise<SafePacketSnapshot> {
	const absolute = path.resolve(root, relativePath);
	if (!inside(root, absolute) || absolute === root)
		throw new Error(`${description} escaped workspace root`);
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory())
		throw new Error('Workspace root must be a real directory');
	const realRoot = await realpath(root);
	let cursor = root;
	const segments = path.relative(root, absolute).split(path.sep);
	for (const [index, segment] of segments.entries()) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink())
			throw new Error(`${description} path cannot contain a symbolic link: ${cursor}`);
		if (index < segments.length - 1 && !metadata.isDirectory())
			throw new Error(`${description} ancestor is not a directory: ${cursor}`);
	}
	const parentPath = path.dirname(absolute);
	const parentRealPath = await realpath(parentPath);
	const parentBefore = await lstat(parentPath, { bigint: true });
	if (
		parentBefore.isSymbolicLink() ||
		!parentBefore.isDirectory() ||
		!inside(realRoot, parentRealPath)
	)
		throw new Error(`${description} parent escaped real workspace root`);
	const handle = await open(
		absolute,
		constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW
	);
	try {
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) throw new Error(`${description} must be a regular file`);
		const bytes = await readBoundedRegularFile(handle, before.size, description);
		const [after, named, parentAfter, parentRealPathAfter] = await Promise.all([
			handle.stat({ bigint: true }),
			lstat(absolute, { bigint: true }),
			lstat(parentPath, { bigint: true }),
			realpath(parentPath)
		]);
		if (
			!after.isFile() ||
			named.isSymbolicLink() ||
			!named.isFile() ||
			before.dev !== after.dev ||
			before.ino !== after.ino ||
			before.size !== after.size ||
			before.mtimeNs !== after.mtimeNs ||
			before.ctimeNs !== after.ctimeNs ||
			after.dev !== named.dev ||
			after.ino !== named.ino ||
			after.size !== named.size ||
			after.mtimeNs !== named.mtimeNs ||
			after.ctimeNs !== named.ctimeNs ||
			parentAfter.isSymbolicLink() ||
			!parentAfter.isDirectory() ||
			parentBefore.dev !== parentAfter.dev ||
			parentBefore.ino !== parentAfter.ino ||
			parentRealPathAfter !== parentRealPath
		)
			throw new Error(`${description} identity changed while reading`);
		return {
			bytes,
			parent: {
				realPath: parentRealPath,
				device: parentAfter.dev.toString(),
				inode: parentAfter.ino.toString()
			},
			file: {
				device: after.dev.toString(),
				inode: after.ino.toString(),
				size: after.size.toString(),
				mtimeNs: after.mtimeNs.toString(),
				ctimeNs: after.ctimeNs.toString()
			}
		};
	} finally {
		await handle.close();
	}
}

async function readSafePacket(
	root: string,
	relativePath: string,
	description: string
): Promise<Buffer> {
	return (await readSafePacketSnapshot(root, relativePath, description)).bytes;
}

export const SKILL_ICON_PERSISTENCE_TOKEN_PATH =
	'assets/wiki/skills/icon-production-v1/.persistence-recovery-token.json' as const;
export const SKILL_ICON_PERSISTENCE_LOCK_PATH =
	'assets/wiki/skills/icon-production-v1/.persistence.lock' as const;
export const SKILL_ICON_PERSISTENCE_JOURNAL_PATH =
	'assets/wiki/skills/icon-production-v1/.persistence-transaction.json' as const;

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const TransactionIdSchema = z.string().uuid();
const ProcessIdentitySchema = z
	.object({ bootId: z.string().min(1), startTicks: z.string().regex(/^\d+$/u) })
	.strict();
const PersistenceParentSchema = z
	.object({ realPath: z.string().min(1), device: z.number().int(), inode: z.number().int() })
	.strict();
const PersistenceFileSchema = z
	.object({ device: z.number().int(), inode: z.number().int() })
	.strict();
const PersistenceCandidatePathSchema = z
	.string()
	.regex(
		/^assets\/wiki\/skills\/icon-production-v1\/candidates\/(?:references|calibration|icons)\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.png$/u
	);
const PersistenceResultPathSchema = z
	.string()
	.regex(
		/^assets\/wiki\/skills\/icon-production-v1\/results\/(?:references|calibration|icons)\/[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.json$/u
	);
export function skillIconSupersessionIntentPath(resultPath: string): string {
	PersistenceResultPathSchema.parse(resultPath);
	return `${path.dirname(resultPath)}/.${path.basename(resultPath)}.skill-icon-supersession-intent.json`;
}
export const SkillIconSupersessionIntentSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-supersession-intent-v1'),
		transactionId: TransactionIdSchema,
		recoveryTokenHash: Sha256Schema,
		resultPath: PersistenceResultPathSchema,
		pid: z.number().int().positive(),
		processIdentity: ProcessIdentitySchema.nullable(),
		createdAt: z.string().datetime({ offset: true })
	})
	.strict();
const PersistenceSupersessionIntentPathSchema = z
	.string()
	.regex(
		/^assets\/wiki\/skills\/icon-production-v1\/results\/(?:references|calibration|icons)\/\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\.json\.skill-icon-supersession-intent\.json$/u
	);
const PersistencePlanSchema = z
	.object({
		kind: z.enum(['candidate', 'result']),
		path: z.string().min(1),
		stagedPath: z.string().min(1),
		contentHash: Sha256Schema
	})
	.strict()
	.superRefine((output, context) => {
		const schema =
			output.kind === 'candidate' ? PersistenceCandidatePathSchema : PersistenceResultPathSchema;
		if (!schema.safeParse(output.path).success)
			context.addIssue({ code: 'custom', message: `Invalid ${output.kind} output path` });
	});
const PersistenceOutputSchema = z
	.object({
		kind: z.enum(['candidate', 'result']),
		path: z.string().min(1),
		stagedPath: z.string().min(1),
		contentHash: Sha256Schema,
		parent: PersistenceParentSchema,
		file: PersistenceFileSchema
	})
	.strict()
	.superRefine((output, context) => {
		const schema =
			output.kind === 'candidate' ? PersistenceCandidatePathSchema : PersistenceResultPathSchema;
		if (!schema.safeParse(output.path).success)
			context.addIssue({ code: 'custom', message: `Invalid ${output.kind} output path` });
	});

const PersistenceSupersessionIntentPlanSchema = z
	.object({
		path: PersistenceSupersessionIntentPathSchema,
		stagedPath: z.string().min(1),
		contentHash: Sha256Schema,
		parent: PersistenceParentSchema,
		file: PersistenceFileSchema
	})
	.strict();

const PersistenceTokenSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-persistence-recovery-token-v1'),
		transactionId: TransactionIdSchema,
		recoveryToken: TransactionIdSchema,
		pid: z.number().int().positive(),
		processIdentity: ProcessIdentitySchema.nullable(),
		createdAt: z.string().datetime({ offset: true }),
		outputs: z.array(PersistencePlanSchema).min(1).max(2),
		supersessionIntent: PersistenceSupersessionIntentPlanSchema.nullable().optional()
	})
	.strict()
	.superRefine((token, context) => {
		if (new Set(token.outputs.map((output) => output.kind)).size !== token.outputs.length)
			context.addIssue({
				code: 'custom',
				message: 'Persistence token output kinds must be unique'
			});
		if (token.outputs.length === 1 && token.outputs[0]?.kind !== 'result')
			context.addIssue({
				code: 'custom',
				message: 'A single-output persistence transaction must contain only a result'
			});
		if ((token.outputs.length === 1) !== (token.supersessionIntent != null))
			context.addIssue({
				code: 'custom',
				message: 'Result-only persistence requires one bound supersession intent'
			});
		if (token.supersessionIntent) {
			const result = token.outputs[0];
			const expectedIntentPath = result ? skillIconSupersessionIntentPath(result.path) : '';
			if (
				token.supersessionIntent.path !== expectedIntentPath ||
				path.dirname(token.supersessionIntent.path) !==
					path.dirname(token.supersessionIntent.stagedPath) ||
				path.basename(token.supersessionIntent.stagedPath) !==
					`${path.basename(token.supersessionIntent.path)}.skill-icon-tmp-intent-${token.transactionId}`
			)
				context.addIssue({
					code: 'custom',
					message: 'Supersession intent plan does not bind the result transaction'
				});
		}
		for (const output of token.outputs) {
			if (
				path.dirname(output.path) !== path.dirname(output.stagedPath) ||
				path.basename(output.stagedPath) !==
					`.${path.basename(output.path)}.skill-icon-tmp-transaction-${token.transactionId}`
			)
				context.addIssue({ code: 'custom', message: 'Persistence token staging path mismatch' });
		}
	});

const PersistenceLockSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-persistence-lock-v1'),
		transactionId: TransactionIdSchema,
		recoveryTokenHash: Sha256Schema,
		pid: z.number().int().positive(),
		processIdentity: ProcessIdentitySchema.nullable(),
		acquiredAt: z.string().datetime({ offset: true })
	})
	.strict();

export const SkillIconPersistenceJournalSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-persistence-transaction-v1'),
		transactionId: TransactionIdSchema,
		recoveryTokenHash: Sha256Schema,
		authorizationTag: Sha256Schema,
		jobId: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u),
		outputs: z.array(PersistenceOutputSchema).min(1).max(2)
	})
	.strict()
	.superRefine((journal, context) => {
		if (new Set(journal.outputs.map((output) => output.kind)).size !== journal.outputs.length)
			context.addIssue({
				code: 'custom',
				message: 'Persistence journal output kinds must be unique'
			});
		if (journal.outputs.length === 1 && journal.outputs[0]?.kind !== 'result')
			context.addIssue({
				code: 'custom',
				message: 'A single-output persistence journal must contain only a result'
			});
		for (const output of journal.outputs) {
			const expectedStagePrefix = `.${path.basename(output.path)}.skill-icon-tmp-`;
			if (
				path.dirname(output.stagedPath) !== path.dirname(output.path) ||
				!path.basename(output.stagedPath).startsWith(expectedStagePrefix)
			)
				context.addIssue({ code: 'custom', message: `Invalid ${output.kind} staging path` });
		}
	});

type PersistenceJournal = z.infer<typeof SkillIconPersistenceJournalSchema>;
type PersistenceToken = z.infer<typeof PersistenceTokenSchema>;
type PersistenceLock = z.infer<typeof PersistenceLockSchema>;
type ProcessIdentity = z.infer<typeof ProcessIdentitySchema> | null;

interface PersistenceAuthority {
	readonly recoveryToken: string;
	readonly token: PersistenceToken;
	readonly tokenBinding: BoundTargetReference;
	readonly lock: PersistenceLock;
	readonly lockBinding: BoundTargetReference;
	readonly supersessionIntent?: {
		readonly record: z.infer<typeof SkillIconSupersessionIntentSchema>;
		readonly binding: BoundTargetReference;
	};
}

interface PersistenceAuthorityTestHooks {
	readonly afterTokenStageOpen?: () => void | Promise<void>;
	readonly afterTokenStageComplete?: () => void | Promise<void>;
	readonly afterTokenInstall?: () => void | Promise<void>;
	readonly afterLockInstall?: () => void | Promise<void>;
	readonly afterIntentInstall?: () => void | Promise<void>;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function transactionBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
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

async function readProcessIdentity(pid: number): Promise<ProcessIdentity> {
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
		return startTicks && /^\d+$/u.test(startTicks) ? { bootId: bootId.trim(), startTicks } : null;
	} catch {
		return null;
	}
}

function sameProcessIdentity(left: ProcessIdentity, right: ProcessIdentity): boolean {
	return (
		left === right ||
		Boolean(left && right && left.bootId === right.bootId && left.startTicks === right.startTicks)
	);
}

async function coordinatorIsLive(
	lock: Pick<PersistenceLock, 'pid' | 'processIdentity'>
): Promise<boolean> {
	try {
		process.kill(lock.pid, 0);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
		return true;
	}
	if (!lock.processIdentity) return true;
	const current = await readProcessIdentity(lock.pid);
	return current === null || sameProcessIdentity(current, lock.processIdentity);
}

function parseTransactionJson<T>(schema: z.ZodType<T>, bytes: Buffer, label: string): T {
	try {
		return schema.parse(JSON.parse(bytes.toString('utf8')));
	} catch (error) {
		throw new Error(`Invalid ${label}; persistence state is fail-closed`, { cause: error });
	}
}

function journalAuthorizationPayload(journal: PersistenceJournal): Buffer {
	return Buffer.from(
		JSON.stringify(
			Object.fromEntries(Object.entries(journal).filter(([key]) => key !== 'authorizationTag'))
		)
	);
}

function authorizeJournal(journal: PersistenceJournal, recoveryToken: string): PersistenceJournal {
	return {
		...journal,
		authorizationTag: createHmac('sha256', recoveryToken)
			.update(journalAuthorizationPayload(journal))
			.digest('hex')
	};
}

function assertJournalAuthorization(journal: PersistenceJournal, recoveryToken: string): void {
	const expected = authorizeJournal(journal, recoveryToken).authorizationTag;
	if (!timingSafeEqual(Buffer.from(journal.authorizationTag, 'hex'), Buffer.from(expected, 'hex')))
		throw new Error('Persistence journal authorization tag does not match its recovery token');
}

async function readAuthorityBinding(
	root: string,
	relativePath: string,
	description: string
): Promise<BoundTargetReference> {
	return bindSafePacket(
		relativePath,
		description,
		await readSafePacketSnapshot(root, relativePath, description)
	);
}

async function writeAuthorityExclusive(
	root: string,
	relativePath: string,
	bytes: Buffer,
	mode: number,
	description: string,
	transactionId: string,
	pid: number,
	afterStageOpen?: () => void | Promise<void>,
	afterStageComplete?: () => void | Promise<void>
): Promise<BoundTargetReference> {
	const destination = path.resolve(root, relativePath);
	await ensureSafeParents(root, destination);
	const parent = await openHeldPersistenceParent(root, destination);
	try {
		const staged = await stageCompleteSibling(
			parent,
			path.basename(destination),
			bytes,
			afterStageOpen,
			mode,
			`authority-${transactionId}-${pid}`
		);
		await afterStageComplete?.();
		const created = await installStagedNoReplace(parent, destination, staged);
		const permissions = (await lstat(destination)).mode & 0o777;
		if (permissions !== mode) {
			await removeOwnedPersistedFileHeld(parent, created, bytes);
			throw new Error(`${description} permissions changed during creation`);
		}
		const binding = await readAuthorityBinding(root, relativePath, description);
		if (binding.contentHash !== sha256(bytes))
			throw new Error(`${description} changed during creation`);
		return binding;
	} finally {
		await parent.handle.close();
	}
}

async function removeAuthorityBinding(root: string, binding: BoundTargetReference): Promise<void> {
	const current = await readAuthorityBinding(root, binding.path, binding.description);
	if (
		current.contentHash !== binding.contentHash ||
		!sameSafePacketIdentity(current.snapshot, binding.snapshot)
	)
		throw new Error(`${binding.description} identity changed; cleanup required`);
	const absolute = path.resolve(root, binding.path);
	const stagePrefix = stagedSiblingName(path.basename(absolute), '');
	for (const name of await readdir(path.dirname(absolute))) {
		if (!name.startsWith(stagePrefix)) continue;
		const stagedPath = path.join(path.dirname(absolute), name);
		const staged = await lstat(stagedPath);
		if (
			!staged.isSymbolicLink() &&
			staged.isFile() &&
			staged.dev.toString() === binding.snapshot.file.device &&
			staged.ino.toString() === binding.snapshot.file.inode
		)
			await unlink(stagedPath);
	}
	await unlink(absolute);
	await syncDirectory(path.dirname(absolute));
}

async function acquirePersistenceAuthority(
	root: string,
	plannedOutputs:
		| readonly [
				{ readonly kind: 'candidate'; readonly path: string; readonly contentHash: string },
				{ readonly kind: 'result'; readonly path: string; readonly contentHash: string }
		  ]
		| readonly [{ readonly kind: 'result'; readonly path: string; readonly contentHash: string }],
	testHooks?: PersistenceAuthorityTestHooks
): Promise<PersistenceAuthority> {
	const transactionId = randomUUID();
	const recoveryToken = randomUUID();
	const recoveryTokenHash = sha256(Buffer.from(recoveryToken));
	const processIdentity = await readProcessIdentity(process.pid);
	const createdAt = new Date().toISOString();
	const outputs = plannedOutputs.map((output) => ({
		...output,
		stagedPath: `${path.dirname(output.path)}/.${path.basename(output.path)}.skill-icon-tmp-transaction-${transactionId}`
	}));
	let intentParent: HeldPersistenceParent | undefined;
	let stagedIntent: StagedPersistedFile | undefined;
	let intentOwnership: OwnedPersistedFile | undefined;
	let intentRecord: z.infer<typeof SkillIconSupersessionIntentSchema> | undefined;
	let intentBytes: Buffer | undefined;
	if (plannedOutputs.length === 1) {
		const intentPath = skillIconSupersessionIntentPath(plannedOutputs[0].path);
		const intentDestination = path.resolve(root, intentPath);
		await ensureSafeParents(root, intentDestination);
		intentParent = await openHeldPersistenceParent(root, intentDestination);
		intentRecord = SkillIconSupersessionIntentSchema.parse({
			schemaVersion: 'skill-icon-supersession-intent-v1',
			transactionId,
			recoveryTokenHash,
			resultPath: plannedOutputs[0].path,
			pid: process.pid,
			processIdentity,
			createdAt
		});
		intentBytes = transactionBytes(intentRecord);
		stagedIntent = await stageCompleteSibling(
			intentParent,
			path.basename(intentDestination),
			intentBytes,
			undefined,
			0o600,
			`intent-${transactionId}`
		);
	}
	const token = PersistenceTokenSchema.parse({
		schemaVersion: 'skill-icon-persistence-recovery-token-v1',
		transactionId,
		recoveryToken,
		pid: process.pid,
		processIdentity,
		createdAt,
		outputs,
		...(intentParent && stagedIntent && intentRecord && intentBytes
			? {
					supersessionIntent: {
						path: skillIconSupersessionIntentPath(intentRecord.resultPath),
						stagedPath: path.relative(root, stagedIntent.path).split(path.sep).join('/'),
						contentHash: sha256(intentBytes),
						parent: intentParent.fingerprint,
						file: stagedIntent.file
					}
				}
			: {})
	});
	let tokenBinding: BoundTargetReference | undefined;
	let lockBinding: BoundTargetReference | undefined;
	try {
		tokenBinding = await writeAuthorityExclusive(
			root,
			SKILL_ICON_PERSISTENCE_TOKEN_PATH,
			transactionBytes(token),
			0o600,
			'Persistence recovery token',
			transactionId,
			process.pid,
			testHooks?.afterTokenStageOpen,
			testHooks?.afterTokenStageComplete
		);
		await testHooks?.afterTokenInstall?.();
		const lock = PersistenceLockSchema.parse({
			schemaVersion: 'skill-icon-persistence-lock-v1',
			transactionId,
			recoveryTokenHash,
			pid: process.pid,
			processIdentity,
			acquiredAt: createdAt
		});
		lockBinding = await writeAuthorityExclusive(
			root,
			SKILL_ICON_PERSISTENCE_LOCK_PATH,
			transactionBytes(lock),
			0o600,
			'Persistence coordinator lock',
			transactionId,
			process.pid
		);
		await testHooks?.afterLockInstall?.();
		let supersessionIntent: PersistenceAuthority['supersessionIntent'];
		if (intentParent && stagedIntent && intentRecord && intentBytes && token.supersessionIntent) {
			intentOwnership = await installStagedNoReplace(
				intentParent,
				path.resolve(root, token.supersessionIntent.path),
				stagedIntent
			);
			const intentMetadata = await lstat(path.resolve(root, token.supersessionIntent.path));
			if ((intentMetadata.mode & 0o777) !== 0o600)
				throw new Error('Supersession intent permissions changed during creation');
			const binding = await readAuthorityBinding(
				root,
				token.supersessionIntent.path,
				'Supersession intent'
			);
			if (binding.contentHash !== sha256(intentBytes))
				throw new Error('Supersession intent changed during creation');
			supersessionIntent = { record: intentRecord, binding };
			await testHooks?.afterIntentInstall?.();
		}
		return {
			recoveryToken,
			token,
			tokenBinding,
			lock,
			lockBinding,
			...(supersessionIntent === undefined ? {} : { supersessionIntent })
		};
	} catch (error) {
		const cleanupFailures: unknown[] = [];
		if (intentParent && intentOwnership && intentBytes) {
			try {
				await removeOwnedPersistedFileHeld(intentParent, intentOwnership, intentBytes);
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
			}
		} else if (stagedIntent) {
			try {
				await unlinkStagedIfOwned(stagedIntent);
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
			}
		}
		for (const binding of [lockBinding, tokenBinding]) {
			if (!binding) continue;
			try {
				await removeAuthorityBinding(root, binding);
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
			}
		}
		if (cleanupFailures.length > 0)
			throw new AggregateError(
				[error, ...cleanupFailures],
				'Persistence authority acquisition failed and cleanup was incomplete',
				{ cause: error }
			);
		throw error;
	} finally {
		await intentParent?.handle.close().catch(() => undefined);
	}
}

async function removeOwnedJournalPath(
	root: string,
	output: PersistenceJournal['outputs'][number],
	kind: 'final' | 'staged'
): Promise<void> {
	const relativePath = kind === 'final' ? output.path : output.stagedPath;
	const absolute = path.resolve(root, relativePath);
	const metadata = await metadataOrNull(absolute);
	if (!metadata) return;
	const parent = await persistenceParentFingerprint(absolute);
	if (
		parent.realPath !== output.parent.realPath ||
		parent.device !== output.parent.device ||
		parent.inode !== output.parent.inode ||
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== output.file.device ||
		metadata.ino !== output.file.inode
	)
		throw new Error(`Foreign ${output.kind} ${kind} path blocks persistence recovery`);
	const bytes = await readSafePacket(root, relativePath, `Recovery ${output.kind} ${kind}`);
	if (sha256(bytes) !== output.contentHash)
		throw new Error(`Changed ${output.kind} ${kind} bytes block persistence recovery`);
	const heldParent = await openHeldPersistenceParent(root, absolute);
	try {
		await removeOwnedPersistedFileHeld(heldParent, {
			path: absolute,
			parent: output.parent,
			file: output.file
		});
	} finally {
		await heldParent.handle.close();
	}
}

async function rollbackPersistenceJournal(
	root: string,
	journal: PersistenceJournal
): Promise<void> {
	// Preflight every extant name before mutating any. Recovery must never partially
	// roll back owned output because a later pathname was replaced by a foreign inode.
	for (const output of journal.outputs) {
		for (const kind of ['final', 'staged'] as const) {
			const relativePath = kind === 'final' ? output.path : output.stagedPath;
			const absolute = path.resolve(root, relativePath);
			const metadata = await metadataOrNull(absolute);
			if (!metadata) continue;
			const parent = await persistenceParentFingerprint(absolute);
			if (
				parent.realPath !== output.parent.realPath ||
				parent.device !== output.parent.device ||
				parent.inode !== output.parent.inode ||
				metadata.isSymbolicLink() ||
				!metadata.isFile() ||
				metadata.dev !== output.file.device ||
				metadata.ino !== output.file.inode
			)
				throw new Error(`Foreign ${output.kind} ${kind} path blocks persistence recovery`);
			const bytes = await readSafePacket(root, relativePath, `Recovery ${output.kind} ${kind}`);
			if (sha256(bytes) !== output.contentHash)
				throw new Error(`Changed ${output.kind} ${kind} bytes block persistence recovery`);
		}
	}
	for (const output of [...journal.outputs].reverse()) {
		await removeOwnedJournalPath(root, output, 'final');
		await removeOwnedJournalPath(root, output, 'staged');
	}
}

async function tokenIntentExtantPaths(
	root: string,
	plan: z.infer<typeof PersistenceSupersessionIntentPlanSchema>
): Promise<readonly string[]> {
	const extant: string[] = [];
	for (const relativePath of [plan.path, plan.stagedPath]) {
		const absolute = path.resolve(root, relativePath);
		const metadata = await metadataOrNull(absolute);
		if (!metadata) continue;
		const parent = await persistenceParentFingerprint(absolute);
		if (
			parent.realPath !== plan.parent.realPath ||
			parent.device !== plan.parent.device ||
			parent.inode !== plan.parent.inode ||
			metadata.isSymbolicLink() ||
			!metadata.isFile() ||
			metadata.dev !== plan.file.device ||
			metadata.ino !== plan.file.inode ||
			(metadata.mode & 0o777) !== 0o600
		)
			throw new Error('Foreign supersession intent path blocks persistence recovery');
		const bytes = await readSafePacket(root, relativePath, 'Recovery supersession intent');
		if (sha256(bytes) !== plan.contentHash)
			throw new Error('Changed supersession intent bytes block persistence recovery');
		extant.push(relativePath);
	}
	if (extant.length === 0)
		throw new Error('Bound supersession intent disappeared; persistence recovery is fail-closed');
	return extant;
}

async function assertTokenIntentBinding(root: string, token: PersistenceToken): Promise<void> {
	const plan = token.supersessionIntent;
	if (!plan) return;
	const paths = await tokenIntentExtantPaths(root, plan);
	const bytes = await readSafePacket(root, paths[0]!, 'Recovery supersession intent');
	const intent = parseTransactionJson(
		SkillIconSupersessionIntentSchema,
		bytes,
		'supersession intent'
	);
	if (
		intent.transactionId !== token.transactionId ||
		intent.recoveryTokenHash !== sha256(Buffer.from(token.recoveryToken)) ||
		intent.resultPath !== token.outputs[0]?.path ||
		intent.pid !== token.pid ||
		!sameProcessIdentity(intent.processIdentity, token.processIdentity)
	)
		throw new Error('Supersession intent and recovery token do not describe one transaction');
}

async function tokenIntentHasAnyName(root: string, token: PersistenceToken): Promise<boolean> {
	const plan = token.supersessionIntent;
	if (!plan) return false;
	return Boolean(
		(await metadataOrNull(path.resolve(root, plan.path))) ||
		(await metadataOrNull(path.resolve(root, plan.stagedPath)))
	);
}

async function tokenHasExactCommittedResult(
	root: string,
	token: PersistenceToken
): Promise<boolean> {
	if (token.outputs.length !== 1 || token.outputs[0]?.kind !== 'result') return false;
	const planned = token.outputs[0];
	const absolute = path.resolve(root, planned.path);
	const metadata = await metadataOrNull(absolute);
	if (!metadata) return false;
	if (metadata.isSymbolicLink() || !metadata.isFile())
		throw new Error('Committed superseded result path is not a regular file');
	const bytes = await readSafePacket(root, planned.path, 'Committed superseded result');
	if (sha256(bytes) !== planned.contentHash)
		throw new Error('Changed committed superseded result blocks persistence recovery');
	return true;
}

async function removeTokenIntentBinding(root: string, token: PersistenceToken): Promise<void> {
	const plan = token.supersessionIntent;
	if (!plan) return;
	const paths = await tokenIntentExtantPaths(root, plan);
	const parent = await openHeldPersistenceParent(root, path.resolve(root, plan.path));
	try {
		for (const relativePath of paths) {
			const expectedBytes = await readSafePacket(
				root,
				relativePath,
				'Recovery supersession intent'
			);
			if (sha256(expectedBytes) !== plan.contentHash)
				throw new Error('Changed supersession intent bytes block persistence recovery');
			await removeOwnedPersistedFileHeld(
				parent,
				{
					path: path.resolve(root, relativePath),
					parent: plan.parent,
					file: plan.file
				},
				expectedBytes
			);
		}
	} finally {
		await parent.handle.close();
	}
}

async function cleanupDeadOrphanedTokenStages(root: string): Promise<void> {
	const tokenDestination = path.resolve(root, SKILL_ICON_PERSISTENCE_TOKEN_PATH);
	if (await metadataOrNull(tokenDestination)) return;
	const escaped = path.basename(tokenDestination).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	const pattern = new RegExp(`^${escaped}\\.skill-icon-tmp-authority-([a-f0-9-]{36})-(\\d+)$`, 'u');
	for (const name of await readdir(path.dirname(tokenDestination))) {
		const match = pattern.exec(name);
		if (!match?.[1] || !match[2]) continue;
		if (!TransactionIdSchema.safeParse(match[1]).success) continue;
		const pid = Number(match[2]);
		if (!Number.isSafeInteger(pid) || pid <= 0) continue;
		const stagePath = path.join(path.dirname(tokenDestination), name);
		const metadata = await lstat(stagePath);
		if (metadata.isSymbolicLink() || !metadata.isFile() || (metadata.mode & 0o777) !== 0o600)
			continue;
		let snapshot: SafePacketSnapshot;
		try {
			snapshot = await readSafePacketSnapshot(
				root,
				path.relative(root, stagePath).split(path.sep).join('/'),
				'Orphaned persistence token stage'
			);
		} catch {
			continue;
		}
		let parsed: ReturnType<typeof PersistenceTokenSchema.safeParse>;
		try {
			parsed = PersistenceTokenSchema.safeParse(JSON.parse(snapshot.bytes.toString('utf8')));
		} catch {
			continue;
		}
		if (!parsed.success || parsed.data.transactionId !== match[1] || parsed.data.pid !== pid)
			continue;
		if (await coordinatorIsLive(parsed.data))
			throw new Error('A live coordinator owns an unpublished persistence token stage');
		const relativeStage = path.relative(root, stagePath).split(path.sep).join('/');
		await removeAuthorityBinding(
			root,
			bindSafePacket(relativeStage, 'Orphaned persistence token stage', snapshot)
		);
	}
}

async function recoverStalePersistence(root: string): Promise<void> {
	await cleanupDeadOrphanedTokenStages(root);
	const [tokenMetadata, lockMetadata, journalMetadata] = await Promise.all([
		metadataOrNull(path.resolve(root, SKILL_ICON_PERSISTENCE_TOKEN_PATH)),
		metadataOrNull(path.resolve(root, SKILL_ICON_PERSISTENCE_LOCK_PATH)),
		metadataOrNull(path.resolve(root, SKILL_ICON_PERSISTENCE_JOURNAL_PATH))
	]);
	if (!tokenMetadata && !lockMetadata && !journalMetadata) return;
	if (!tokenMetadata)
		throw new Error('Persistence lock or journal exists without its recovery token');
	const tokenBinding = await readAuthorityBinding(
		root,
		SKILL_ICON_PERSISTENCE_TOKEN_PATH,
		'Persistence recovery token'
	);
	if ((tokenMetadata.mode & 0o777) !== 0o600)
		throw new Error('Persistence recovery token permissions are unsafe; cleanup required');
	const token = parseTransactionJson(
		PersistenceTokenSchema,
		await readSafePacket(root, tokenBinding.path, tokenBinding.description),
		'persistence recovery token'
	);
	let committedWithoutIntent = false;
	if (token.supersessionIntent) {
		if (await tokenIntentHasAnyName(root, token)) await assertTokenIntentBinding(root, token);
		else if (!journalMetadata && (await tokenHasExactCommittedResult(root, token)))
			committedWithoutIntent = true;
		else
			throw new Error(
				'Bound supersession intent disappeared before result commit; persistence recovery is fail-closed'
			);
	}
	if (!lockMetadata) {
		if (journalMetadata) throw new Error('Persistence journal exists without its coordinator lock');
		if (await coordinatorIsLive(token))
			throw new Error('A live coordinator owns the persistence recovery token');
		if (!committedWithoutIntent) await removeTokenIntentBinding(root, token);
		await removeAuthorityBinding(root, tokenBinding);
		return;
	}
	const lockBinding = await readAuthorityBinding(
		root,
		SKILL_ICON_PERSISTENCE_LOCK_PATH,
		'Persistence coordinator lock'
	);
	if ((lockMetadata.mode & 0o777) !== 0o600)
		throw new Error('Persistence coordinator lock permissions are unsafe; cleanup required');
	const lock = parseTransactionJson(
		PersistenceLockSchema,
		await readSafePacket(root, lockBinding.path, lockBinding.description),
		'persistence lock'
	);
	if (
		token.transactionId !== lock.transactionId ||
		lock.recoveryTokenHash !== sha256(Buffer.from(token.recoveryToken)) ||
		token.pid !== lock.pid ||
		!sameProcessIdentity(token.processIdentity, lock.processIdentity)
	)
		throw new Error('Persistence recovery token and lock do not describe one transaction');
	if (!journalMetadata) {
		// No final output is ever published before the signed journal. This state is
		// either pre-journal setup or post-commit authority residue. Pre-journal stages
		// have no durable inode binding, so even identical bytes cannot authorize their
		// deletion. UUID-scoped stages are ignored and deliberately preserved; the retry
		// uses a new UUID and remains nonblocking.
		if (await coordinatorIsLive(lock))
			throw new Error('Another live coordinator owns skill-icon persistence');
		if (!committedWithoutIntent) await removeTokenIntentBinding(root, token);
		await removeAuthorityBinding(root, lockBinding);
		await removeAuthorityBinding(root, tokenBinding);
		return;
	}
	const journalBinding = await readAuthorityBinding(
		root,
		SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
		'Persistence journal'
	);
	if ((journalMetadata.mode & 0o777) !== 0o600)
		throw new Error('Persistence journal permissions are unsafe; cleanup required');
	const journal = parseTransactionJson(
		SkillIconPersistenceJournalSchema,
		await readSafePacket(root, journalBinding.path, journalBinding.description),
		'persistence journal'
	);
	if (
		token.transactionId !== journal.transactionId ||
		journal.recoveryTokenHash !== lock.recoveryTokenHash ||
		journal.recoveryTokenHash !== sha256(Buffer.from(token.recoveryToken))
	)
		throw new Error('Persistence recovery authorities do not describe one transaction');
	for (const planned of token.outputs) {
		const recorded = journal.outputs.find((output) => output.kind === planned.kind);
		if (
			!recorded ||
			recorded.path !== planned.path ||
			recorded.stagedPath !== planned.stagedPath ||
			recorded.contentHash !== planned.contentHash
		)
			throw new Error('Persistence token and journal output plans do not match');
	}
	assertJournalAuthorization(journal, token.recoveryToken);
	if (await coordinatorIsLive(lock))
		throw new Error('Another live coordinator owns skill-icon persistence');
	await rollbackPersistenceJournal(root, journal);
	await removeTokenIntentBinding(root, token);
	await removeAuthorityBinding(root, journalBinding);
	await removeAuthorityBinding(root, lockBinding);
	await removeAuthorityBinding(root, tokenBinding);
}

function assertPacketBinding(
	target: AnySkillIconTarget,
	assignment: AnySkillIconAssignment,
	candidatePath: string,
	expectedRole: SkillIconRole
): void {
	if (
		(target.schemaVersion === 'skill-icon-target-v1') !==
		(assignment.schemaVersion === 'skill-icon-assignment-v1')
	)
		throw new Error('Target and assignment protocol versions do not match');
	if (target.role !== expectedRole)
		throw new Error(`Target role ${target.role} does not match expected role ${expectedRole}`);
	if (target.jobId !== assignment.jobId || assignment.assignmentId !== `assignment-${target.jobId}`)
		throw new Error('Target and assignment job identity mismatch');
	if (
		target.output.candidatePath !== candidatePath ||
		assignment.permittedOutputs.candidatePath !== candidatePath ||
		assignment.permittedOutputs.resultPath !== target.output.resultPath
	)
		throw new Error('Candidate/result paths do not match the explicit target and assignment grant');
	const scope =
		expectedRole === 'skill-art'
			? 'icons'
			: expectedRole === 'calibration-plate'
				? 'calibration'
				: 'references';
	const expectedTargetPath = `assets/wiki/skills/icon-production-v1/targets/${scope}/${target.jobId}.json`;
	const expectedAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/${scope}/${target.jobId}.json`;
	if (
		assignment.targetPath !== expectedTargetPath ||
		assignment.assignmentPath !== expectedAssignmentPath
	)
		throw new Error('Assignment paths do not match target identity and role');
}

function geometryPathForTarget(target: AnySkillIconTarget): string {
	return target.schemaVersion === 'skill-icon-target-v2'
		? target.normalization.geometry.path
		: SKILL_ICON_GEOMETRY_PATH;
}

function parseGeometryForTarget(
	target: AnySkillIconTarget,
	geometrySourceBytes: Buffer
): AnySkillIconGeometry {
	const source = JSON.parse(geometrySourceBytes.toString('utf8')) as unknown;
	return target.schemaVersion === 'skill-icon-target-v2' &&
		target.normalization.profile === SKILL_ICON_NORMALIZATION_PROFILE_V3
		? SkillIconGeometryV2Schema.parse(source)
		: SkillIconGeometrySchema.parse(source);
}

async function persistSkillIconOutputBoundWithAuthorities(
	options: PersistSkillIconOutputBoundOptions,
	authorityBindings: readonly BoundTargetReference[]
): Promise<SkillIconAssetReceipt> {
	// Caller-owned values remain mutable across await boundaries. Parse/deep-clone
	// structured values and capture scalars/callbacks before the first await.
	const sourcePath = options.sourcePath;
	if (!path.isAbsolute(sourcePath)) throw new Error('Source path must be absolute');
	const suppliedGeometrySourceBytes = options.geometrySourceBytes;
	const geometrySourceBytes = suppliedGeometrySourceBytes
		? Buffer.from(suppliedGeometrySourceBytes)
		: undefined;
	const geometry = AnySkillIconGeometrySchema.parse(options.geometry);
	const expectedRole = SkillIconRoleSchema.parse(options.expectedRole);
	const receivedAt = IsoDateTimeSchema.parse(options.receivedAt);
	const suppliedExpectedSourceHash = options.expectedSourceHash;
	const expectedSourceHash =
		suppliedExpectedSourceHash === undefined
			? undefined
			: StateHashSchema.parse(suppliedExpectedSourceHash);
	const root = path.resolve(options.root ?? process.cwd());
	const candidatePath = SkillIconCandidatePathSchema.parse(options.candidatePath);
	const target = AnySkillIconTargetSchema.parse(options.target);
	const assignment = AnySkillIconAssignmentSchema.parse(options.assignment);
	const suppliedTestHooks = options.testHooks;
	const testHooks = suppliedTestHooks ? { ...suppliedTestHooks } : undefined;
	const authorityReferenceBindings = authorityBindings.map((binding) => ({
		path: binding.path,
		contentHash: binding.contentHash,
		description: binding.description,
		snapshot: {
			parent: { ...binding.snapshot.parent },
			file: { ...binding.snapshot.file }
		}
	}));
	assertPacketBinding(target, assignment, candidatePath, expectedRole);
	const isV2 = target.schemaVersion === 'skill-icon-target-v2';
	if (isV2) {
		SkillIconTargetV2Schema.parse(target);
		const assignmentV2 = SkillIconAssignmentV2Schema.parse(assignment);
		if (!expectedSourceHash)
			throw new Error('V2 persistence requires the expected provider source hash');
		if (!geometrySourceBytes)
			throw new Error('V2 persistence requires the raw geometry authority bytes');
		const geometryHash = createHash('sha256').update(geometrySourceBytes).digest('hex');
		if (geometryHash !== target.normalization.geometry.contentHash)
			throw new Error('Raw geometry authority hash does not match the V2 target');
		const parsedGeometry = parseGeometryForTarget(target, geometrySourceBytes);
		if (JSON.stringify(parsedGeometry) !== JSON.stringify(geometry))
			throw new Error('Parsed geometry and raw geometry authority bytes disagree');
		if (target.normalization.profile !== assignmentV2.normalization.profile)
			throw new Error('V2 target and assignment normalization profiles do not match');
		const expectedSkillVersion = {
			[SKILL_ICON_NORMALIZATION_PROFILE_V1]: 'summonlab-skill-icon-production-v2',
			[SKILL_ICON_NORMALIZATION_PROFILE_V2]: 'summonlab-skill-icon-production-v3',
			[SKILL_ICON_NORMALIZATION_PROFILE_V3]: 'summonlab-skill-icon-production-v4'
		}[target.normalization.profile];
		if (assignmentV2.skillVersion !== expectedSkillVersion)
			throw new Error(
				`Normalization profile ${target.normalization.profile} requires ${expectedSkillVersion}`
			);
	}
	const destination = path.resolve(root, candidatePath);
	const resultDestination = path.resolve(root, target.output.resultPath);
	if (!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/candidates'), destination))
		throw new Error('Candidate output must remain inside the skill-icon candidates directory');
	if (
		!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/results'), resultDestination)
	)
		throw new Error('Result output must remain inside the skill-icon results directory');
	if (path.resolve(sourcePath) === destination)
		throw new Error('Source and candidate paths must differ');

	const sourceBytes = await readSkillIconProviderSourceOnce(sourcePath, testHooks?.afterSourceRead);
	const sourceContentHash = createHash('sha256').update(sourceBytes).digest('hex');
	if (expectedSourceHash && expectedSourceHash !== sourceContentHash)
		throw new Error('Source/candidate hash mismatch against expected source hash');
	const normalized = isV2
		? await normalizeSkillIconProviderSource(
				sourceBytes,
				expectedRole,
				geometrySourceBytes!,
				target.normalization.profile
			)
		: null;
	await testHooks?.afterNormalization?.();
	const candidateBytes = normalized?.bytes ?? sourceBytes;
	const inspection = await inspectSkillIconAsset(candidateBytes, expectedRole, geometry);
	if (inspection.width !== target.canvas.width || inspection.height !== target.canvas.height)
		throw new Error(
			`Source dimensions ${inspection.width}×${inspection.height} do not match target ${target.canvas.width}×${target.canvas.height}`
		);
	if (inspection.mediaType !== target.canvas.mediaType)
		throw new Error(`Source must be a PNG (${target.canvas.mediaType})`);
	if (inspection.violations.length > 0)
		throw new Error(`Skill icon asset validation failed: ${inspection.violations.join('; ')}`);

	const output = {
		path: candidatePath,
		mediaType: 'image/png' as const,
		width: inspection.width,
		height: inspection.height,
		bytes: inspection.bytes,
		alphaMode: inspection.alphaMode,
		contentHash: inspection.contentHash
	};
	const resultCommon = {
		resultId: `result-${target.jobId}`,
		jobId: target.jobId,
		assignmentId: assignment.assignmentId,
		status: 'candidate',
		exactPrompt: target.exactPrompt,
		promptHash: createHash('sha256').update(target.exactPrompt).digest('hex'),
		referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
		output,
		resultPath: target.output.resultPath,
		findings: [
			{
				category: 'geometry',
				evaluator: 'automated',
				outcome: 'pass',
				observation: `${expectedRole} dimensions, media type, alpha, and geometry checks passed.`
			},
			{
				category: isV2 ? 'deterministic-normalization' : 'exact-source-persistence',
				evaluator: 'producer',
				outcome: 'pass',
				observation: isV2
					? 'The exact provider bytes were normalized by the packet-authorized deterministic profile.'
					: 'The declared provider bytes were retained without transformation.'
			}
		],
		startedAt: receivedAt,
		completedAt: receivedAt,
		totalWallTimeMs: 0,
		writtenOutputPaths: [candidatePath, target.output.resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	} as const;
	const result = isV2
		? SkillIconResultV2Schema.parse({
				schemaVersion: 'skill-icon-result-v2',
				logicalIdentity: target.logicalIdentity,
				revision: target.revision,
				normalization: {
					...normalized!.normalization,
					outcome: 'completed',
					providerSource: normalized!.source
				},
				...resultCommon
			})
		: SkillIconResultSchema.parse({
				schemaVersion: 'skill-icon-result-v1',
				...resultCommon
			});
	const resultBytes = transactionBytes(result);

	await ensureSafeParents(root, destination);
	await ensureSafeParents(root, resultDestination);
	await recoverStalePersistence(root);
	await testHooks?.beforeCandidateWrite?.();
	const authority = await acquirePersistenceAuthority(
		root,
		[
			{ kind: 'candidate', path: candidatePath, contentHash: sha256(candidateBytes) },
			{ kind: 'result', path: target.output.resultPath, contentHash: sha256(resultBytes) }
		],
		testHooks
	);
	let candidateParent: HeldPersistenceParent | undefined;
	let resultParent: HeldPersistenceParent | undefined;
	let stagedCandidate: StagedPersistedFile | undefined;
	let stagedResult: StagedPersistedFile | undefined;
	let candidateOwnership: OwnedPersistedFile | undefined;
	let resultOwnership: OwnedPersistedFile | undefined;
	let journal: PersistenceJournal | undefined;
	let journalBinding: BoundTargetReference | undefined;
	try {
		if (await metadataOrNull(destination))
			throw new Error(`Candidate output already exists (collision): ${candidatePath}`);
		if (await metadataOrNull(resultDestination))
			throw new Error(`Result output already exists (collision): ${target.output.resultPath}`);
		candidateParent = await openHeldPersistenceParent(root, destination);
		resultParent = await openHeldPersistenceParent(root, resultDestination);
		// This is deliberately the final read-only operation before any output bytes
		// are staged. Every packet reference must still be a regular, hash-bound file.
		const referenceBindings = await bindTargetReferences(root, target);
		stagedCandidate = await stageCompleteSibling(
			candidateParent,
			path.basename(destination),
			candidateBytes,
			testHooks?.afterCandidateOpen,
			0o644,
			`transaction-${authority.lock.transactionId}`
		);
		stagedResult = await stageCompleteSibling(
			resultParent,
			path.basename(resultDestination),
			resultBytes,
			testHooks?.afterResultOpen,
			0o644,
			`transaction-${authority.lock.transactionId}`
		);
		await testHooks?.afterOutputStagesComplete?.();
		const unsignedJournal = SkillIconPersistenceJournalSchema.parse({
			schemaVersion: 'skill-icon-persistence-transaction-v1',
			transactionId: authority.lock.transactionId,
			recoveryTokenHash: authority.lock.recoveryTokenHash,
			authorizationTag: '0'.repeat(64),
			jobId: target.jobId,
			outputs: [
				{
					kind: 'candidate',
					path: candidatePath,
					stagedPath: path.relative(root, stagedCandidate.path).split(path.sep).join('/'),
					contentHash: sha256(candidateBytes),
					parent: candidateParent.fingerprint,
					file: stagedCandidate.file
				},
				{
					kind: 'result',
					path: target.output.resultPath,
					stagedPath: path.relative(root, stagedResult.path).split(path.sep).join('/'),
					contentHash: sha256(resultBytes),
					parent: resultParent.fingerprint,
					file: stagedResult.file
				}
			]
		});
		journal = SkillIconPersistenceJournalSchema.parse(
			authorizeJournal(unsignedJournal, authority.recoveryToken)
		);
		journalBinding = await writeAuthorityExclusive(
			root,
			SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
			transactionBytes(journal),
			0o600,
			'Persistence journal',
			authority.lock.transactionId,
			authority.lock.pid
		);
		candidateOwnership = await publishStagedNoReplace(
			candidateParent,
			destination,
			stagedCandidate
		);
		await testHooks?.afterCandidateInstall?.();
		await testHooks?.beforeResultWrite?.();
		await assertOwnedPersistedFile(candidateOwnership, candidateBytes, 'Candidate');
		resultOwnership = await publishStagedNoReplace(resultParent, resultDestination, stagedResult);
		await testHooks?.afterResultInstall?.();
		const retainedResult = await readSafePacket(root, target.output.resultPath, 'Retained result');
		if (!retainedResult.equals(resultBytes))
			throw new Error('Result bytes changed during persistence');
		await assertOwnedPersistedFile(candidateOwnership, candidateBytes, 'Candidate');
		await assertOwnedPersistedFile(resultOwnership, resultBytes, 'Result');
		await assertTargetReferencesStillBound(root, referenceBindings);
		await assertTargetReferencesStillBound(root, authorityReferenceBindings);
		await unlinkStagedIfOwned(stagedCandidate);
		await candidateParent.handle.sync();
		await unlinkStagedIfOwned(stagedResult);
		await resultParent.handle.sync();
		await removeAuthorityBinding(root, journalBinding);
		journalBinding = undefined;
		await testHooks?.afterJournalRemoval?.();
		await removeAuthorityBinding(root, authority.lockBinding);
		await removeAuthorityBinding(root, authority.tokenBinding);
		return {
			schemaVersion: 'skill-icon-asset-receipt-v1',
			jobId: target.jobId,
			role: expectedRole,
			receivedAt,
			source: { path: sourcePath, ...(normalized?.source ?? inspection) },
			retained: { path: candidatePath, ...inspection },
			result: {
				path: target.output.resultPath,
				contentHash: createHash('sha256').update(resultBytes).digest('hex')
			}
		};
	} catch (error) {
		const cleanupFailures: unknown[] = [];
		if (journal && journalBinding) {
			try {
				await rollbackPersistenceJournal(root, journal);
				for (const [parent, owned, bytes] of [
					[candidateParent, candidateOwnership, candidateBytes],
					[resultParent, resultOwnership, resultBytes],
					[
						candidateParent,
						stagedCandidate && candidateParent
							? {
									path: stagedCandidate.path,
									parent: candidateParent.fingerprint,
									file: stagedCandidate.file
								}
							: undefined,
						candidateBytes
					],
					[
						resultParent,
						stagedResult && resultParent
							? {
									path: stagedResult.path,
									parent: resultParent.fingerprint,
									file: stagedResult.file
								}
							: undefined,
						resultBytes
					]
				] as const) {
					if (parent && owned) await removeOwnedPersistedFileHeld(parent, owned, bytes);
				}
				await removeAuthorityBinding(root, journalBinding);
				journalBinding = undefined;
			} catch (cleanupError) {
				// In-process parent handles remain authoritative even if a pathname ancestor
				// was swapped. Use them to clean exact hash+inode-owned names, but retain the
				// journal if any foreign or mutated name prevents a complete rollback.
				const heldCleanupFailures: unknown[] = [];
				for (const [parent, owned, bytes] of [
					[candidateParent, candidateOwnership, candidateBytes],
					[resultParent, resultOwnership, resultBytes]
				] as const) {
					if (!parent || !owned) continue;
					try {
						await removeOwnedPersistedFileHeld(parent, owned, bytes);
					} catch (heldCleanupError) {
						heldCleanupFailures.push(heldCleanupError);
					}
				}
				for (const [parent, staged, bytes] of [
					[candidateParent, stagedCandidate, candidateBytes],
					[resultParent, stagedResult, resultBytes]
				] as const) {
					if (!parent || !staged) continue;
					try {
						await removeOwnedPersistedFileHeld(
							parent,
							{ path: staged.path, parent: parent.fingerprint, file: staged.file },
							bytes
						);
					} catch (heldCleanupError) {
						heldCleanupFailures.push(heldCleanupError);
					}
				}
				if (heldCleanupFailures.length === 0) {
					await removeAuthorityBinding(root, journalBinding!);
					journalBinding = undefined;
				} else cleanupFailures.push(cleanupError, ...heldCleanupFailures);
			}
		} else {
			for (const staged of [stagedCandidate, stagedResult]) {
				if (!staged) continue;
				try {
					await unlinkStagedIfOwned(staged);
				} catch (cleanupError) {
					cleanupFailures.push(cleanupError);
				}
			}
		}
		if (!journalBinding) {
			for (const binding of [authority.lockBinding, authority.tokenBinding]) {
				try {
					await removeAuthorityBinding(root, binding);
				} catch (cleanupError) {
					cleanupFailures.push(cleanupError);
				}
			}
		}
		if (cleanupFailures.length > 0)
			throw new AggregateError(
				[error, ...cleanupFailures],
				'Persistence failed and rollback was incomplete',
				{ cause: error }
			);
		throw error;
	} finally {
		for (const parent of [candidateParent, resultParent]) {
			if (parent) await parent.handle.close().catch(() => undefined);
		}
	}
}

export async function persistSkillIconOutputBound(
	options: PersistSkillIconOutputBoundOptions
): Promise<SkillIconAssetReceipt> {
	return persistSkillIconOutputBoundWithAuthorities(options, []);
}

function failedResultTransactionPaths(resultPath: string): readonly [string, string] {
	const directory = path.dirname(resultPath);
	const filename = path.basename(resultPath);
	return [
		`${directory}/.${filename}.failed-result-owner.json`,
		`${directory}/.${filename}.failed-result-stage`
	];
}

async function assertNoFailedResultTransactionArtifacts(
	root: string,
	resultPath: string
): Promise<void> {
	for (const relativePath of failedResultTransactionPaths(resultPath)) {
		if (await metadataOrNull(path.resolve(root, relativePath)))
			throw new Error(`Python failed-result transaction blocks supersession: ${relativePath}`);
	}
}

async function persistCoordinatorResultOnly(
	root: string,
	jobId: string,
	resultPath: string,
	resultBytes: Buffer,
	candidatePath: string,
	authorityBindings: readonly BoundTargetReference[],
	testHooks?: PersistSkillIconSupersededResultTestHooks
): Promise<{ readonly path: string; readonly contentHash: string }> {
	const resultDestination = path.resolve(root, resultPath);
	const candidateDestination = path.resolve(root, candidatePath);
	if (
		!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/results'), resultDestination)
	)
		throw new Error('Superseded result must remain inside the skill-icon results directory');
	if (
		!inside(
			path.resolve(root, 'assets/wiki/skills/icon-production-v1/candidates'),
			candidateDestination
		)
	)
		throw new Error('Superseded candidate proof escaped the skill-icon candidates directory');
	await ensureSafeParents(root, resultDestination);
	await recoverStalePersistence(root);
	const authority = await acquirePersistenceAuthority(
		root,
		[{ kind: 'result', path: resultPath, contentHash: sha256(resultBytes) }],
		{
			...(testHooks?.afterTokenInstall === undefined
				? {}
				: { afterTokenInstall: testHooks.afterTokenInstall }),
			...(testHooks?.afterLockInstall === undefined
				? {}
				: { afterLockInstall: testHooks.afterLockInstall }),
			...(testHooks?.afterIntentInstall === undefined
				? {}
				: { afterIntentInstall: testHooks.afterIntentInstall })
		}
	);
	let resultParent: HeldPersistenceParent | undefined;
	let stagedResult: StagedPersistedFile | undefined;
	let resultOwnership: OwnedPersistedFile | undefined;
	let journal: PersistenceJournal | undefined;
	let journalBinding: BoundTargetReference | undefined;
	let intentBinding = authority.supersessionIntent?.binding;
	let committed = false;
	const assertIntentStillBound = async () => {
		if (!intentBinding)
			throw new Error('Result-only transaction lost its supersession intent authority');
		await assertTargetReferencesStillBound(root, [intentBinding]);
	};
	try {
		await assertIntentStillBound();
		await assertNoFailedResultTransactionArtifacts(root, resultPath);
		if (await metadataOrNull(candidateDestination))
			throw new Error(`Superseded packet already has candidate output: ${candidatePath}`);
		if (await metadataOrNull(resultDestination))
			throw new Error(`Result output already exists (collision): ${resultPath}`);
		resultParent = await openHeldPersistenceParent(root, resultDestination);
		await assertTargetReferencesStillBound(root, authorityBindings);
		stagedResult = await stageCompleteSibling(
			resultParent,
			path.basename(resultDestination),
			resultBytes,
			testHooks?.afterResultOpen,
			0o644,
			`transaction-${authority.lock.transactionId}`
		);
		await testHooks?.afterOutputStageComplete?.();
		await assertTargetReferencesStillBound(root, authorityBindings);
		await assertNoFailedResultTransactionArtifacts(root, resultPath);
		if (await metadataOrNull(candidateDestination))
			throw new Error(`Candidate appeared while superseding packet: ${candidatePath}`);
		const unsignedJournal = SkillIconPersistenceJournalSchema.parse({
			schemaVersion: 'skill-icon-persistence-transaction-v1',
			transactionId: authority.lock.transactionId,
			recoveryTokenHash: authority.lock.recoveryTokenHash,
			authorizationTag: '0'.repeat(64),
			jobId,
			outputs: [
				{
					kind: 'result',
					path: resultPath,
					stagedPath: path.relative(root, stagedResult.path).split(path.sep).join('/'),
					contentHash: sha256(resultBytes),
					parent: resultParent.fingerprint,
					file: stagedResult.file
				}
			]
		});
		journal = SkillIconPersistenceJournalSchema.parse(
			authorizeJournal(unsignedJournal, authority.recoveryToken)
		);
		journalBinding = await writeAuthorityExclusive(
			root,
			SKILL_ICON_PERSISTENCE_JOURNAL_PATH,
			transactionBytes(journal),
			0o600,
			'Persistence journal',
			authority.lock.transactionId,
			authority.lock.pid
		);
		await testHooks?.afterJournalInstall?.();
		await assertTargetReferencesStillBound(root, authorityBindings);
		await assertIntentStillBound();
		await assertNoFailedResultTransactionArtifacts(root, resultPath);
		if (await metadataOrNull(candidateDestination))
			throw new Error(`Candidate appeared while superseding packet: ${candidatePath}`);
		await assertNoFailedResultTransactionArtifacts(root, resultPath);
		resultOwnership = await publishStagedNoReplace(resultParent, resultDestination, stagedResult);
		await testHooks?.afterResultInstall?.();
		await assertOwnedPersistedFile(resultOwnership, resultBytes, 'Superseded result');
		await assertTargetReferencesStillBound(root, authorityBindings);
		await assertIntentStillBound();
		await assertNoFailedResultTransactionArtifacts(root, resultPath);
		if (await metadataOrNull(candidateDestination))
			throw new Error(`Candidate appeared while superseding packet: ${candidatePath}`);
		await unlinkStagedIfOwned(stagedResult);
		await resultParent.handle.sync();
		await assertIntentStillBound();
		await removeAuthorityBinding(root, journalBinding);
		journalBinding = undefined;
		committed = true;
		await testHooks?.afterJournalRemoval?.();
		if (!intentBinding)
			throw new Error('Result-only transaction lost its supersession intent authority');
		await removeAuthorityBinding(root, intentBinding);
		intentBinding = undefined;
		await testHooks?.afterIntentRemoval?.();
		await removeAuthorityBinding(root, authority.lockBinding);
		await removeAuthorityBinding(root, authority.tokenBinding);
		return { path: resultPath, contentHash: sha256(resultBytes) };
	} catch (error) {
		const cleanupFailures: unknown[] = [];
		if (committed) {
			if (intentBinding) {
				try {
					await removeAuthorityBinding(root, intentBinding);
					intentBinding = undefined;
				} catch (cleanupError) {
					cleanupFailures.push(cleanupError);
				}
			}
		} else if (journal && journalBinding) {
			try {
				await rollbackPersistenceJournal(root, journal);
				if (!intentBinding)
					throw new Error('Result-only rollback lost its supersession intent authority', {
						cause: error
					});
				await removeAuthorityBinding(root, intentBinding);
				intentBinding = undefined;
				await removeAuthorityBinding(root, journalBinding);
				journalBinding = undefined;
			} catch (cleanupError) {
				const heldCleanupFailures: unknown[] = [];
				if (resultParent && resultOwnership) {
					try {
						await removeOwnedPersistedFileHeld(resultParent, resultOwnership, resultBytes);
					} catch (heldCleanupError) {
						heldCleanupFailures.push(heldCleanupError);
					}
				}
				if (resultParent && stagedResult) {
					try {
						await removeOwnedPersistedFileHeld(
							resultParent,
							{
								path: stagedResult.path,
								parent: resultParent.fingerprint,
								file: stagedResult.file
							},
							resultBytes
						);
					} catch (heldCleanupError) {
						heldCleanupFailures.push(heldCleanupError);
					}
				}
				if (heldCleanupFailures.length === 0 && intentBinding) {
					try {
						await removeAuthorityBinding(root, intentBinding);
						intentBinding = undefined;
					} catch (heldCleanupError) {
						heldCleanupFailures.push(heldCleanupError);
					}
				}
				if (heldCleanupFailures.length === 0) {
					await removeAuthorityBinding(root, journalBinding!);
					journalBinding = undefined;
				} else cleanupFailures.push(cleanupError, ...heldCleanupFailures);
			}
		} else if (stagedResult) {
			try {
				await unlinkStagedIfOwned(stagedResult);
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
			}
		}
		if (!committed && !journalBinding && intentBinding) {
			try {
				await removeAuthorityBinding(root, intentBinding);
				intentBinding = undefined;
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
			}
		}
		if (!journalBinding && !intentBinding) {
			for (const binding of [authority.lockBinding, authority.tokenBinding]) {
				try {
					await removeAuthorityBinding(root, binding);
				} catch (cleanupError) {
					cleanupFailures.push(cleanupError);
				}
			}
		}
		if (cleanupFailures.length > 0)
			throw new AggregateError(
				[error, ...cleanupFailures],
				'Superseded-result persistence failed and rollback was incomplete',
				{ cause: error }
			);
		throw error;
	} finally {
		await resultParent?.handle.close().catch(() => undefined);
	}
}

function canonicalPacketPaths(target: AnySkillIconTarget): {
	readonly targetPath: string;
	readonly assignmentPath: string;
} {
	const scope = skillIconScopeForRole(target.role);
	return {
		targetPath: `assets/wiki/skills/icon-production-v1/targets/${scope}/${target.jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/${scope}/${target.jobId}.json`
	};
}

/**
 * Coordinator-only retirement of an output-free V2 packet. The production CLI
 * intentionally has no route to this helper: a producer may report an attempt,
 * but cannot declare its own assignment superseded.
 */
export async function persistSkillIconSupersededResult(
	options: PersistSkillIconSupersededResultOptions
): Promise<ReturnType<typeof AnySkillIconResultSchema.parse>> {
	const root = path.resolve(options.root ?? process.cwd());
	const completedAt = IsoDateTimeSchema.parse(options.completedAt);
	if (options.reason !== SKILL_ICON_SUPERSESSION_REASON)
		throw new Error(`Supersession requires exact reason ${SKILL_ICON_SUPERSESSION_REASON}`);
	const targetPath = SkillIconTargetPathSchema.parse(options.targetPath);
	const assignmentPath = SkillIconAssignmentPathSchema.parse(options.assignmentPath);
	const supersedingTargetPath = SkillIconTargetPathSchema.parse(options.supersedingTargetPath);
	const supersedingAssignmentPath = SkillIconAssignmentPathSchema.parse(
		options.supersedingAssignmentPath
	);
	if (targetPath === supersedingTargetPath || assignmentPath === supersedingAssignmentPath)
		throw new Error('Superseding authority must be a distinct higher packet');

	const [targetSnapshot, assignmentSnapshot, higherTargetSnapshot, higherAssignmentSnapshot] =
		await Promise.all([
			readSafePacketSnapshot(root, targetPath, 'Superseded target packet'),
			readSafePacketSnapshot(root, assignmentPath, 'Superseded assignment packet'),
			readSafePacketSnapshot(root, supersedingTargetPath, 'Superseding target packet'),
			readSafePacketSnapshot(root, supersedingAssignmentPath, 'Superseding assignment packet')
		]);
	const target = SkillIconTargetV2Schema.parse(JSON.parse(targetSnapshot.bytes.toString('utf8')));
	const assignment = SkillIconAssignmentV2Schema.parse(
		JSON.parse(assignmentSnapshot.bytes.toString('utf8'))
	);
	const supersedingTarget = SkillIconTargetV2Schema.parse(
		JSON.parse(higherTargetSnapshot.bytes.toString('utf8'))
	);
	const supersedingAssignment = SkillIconAssignmentV2Schema.parse(
		JSON.parse(higherAssignmentSnapshot.bytes.toString('utf8'))
	);
	const currentCanonical = canonicalPacketPaths(target);
	const higherCanonical = canonicalPacketPaths(supersedingTarget);
	if (
		targetPath !== currentCanonical.targetPath ||
		assignmentPath !== currentCanonical.assignmentPath ||
		assignment.targetPath !== targetPath ||
		assignment.assignmentPath !== assignmentPath
	)
		throw new Error('Superseded target and assignment paths are not canonical for their job');
	if (
		supersedingTargetPath !== higherCanonical.targetPath ||
		supersedingAssignmentPath !== higherCanonical.assignmentPath ||
		supersedingAssignment.targetPath !== supersedingTargetPath ||
		supersedingAssignment.assignmentPath !== supersedingAssignmentPath
	)
		throw new Error('Superseding target and assignment paths are not canonical for their job');
	assertPacketBinding(target, assignment, target.output.candidatePath, target.role);
	assertPacketBinding(
		supersedingTarget,
		supersedingAssignment,
		supersedingTarget.output.candidatePath,
		supersedingTarget.role
	);
	assertSkillIconSupersedingRevision(target, supersedingTarget);
	await recoverStalePersistence(root);
	const candidateDestination = path.resolve(root, target.output.candidatePath);
	const resultDestination = path.resolve(root, target.output.resultPath);
	if ((await metadataOrNull(candidateDestination)) || (await metadataOrNull(resultDestination)))
		throw new Error('Only output-free unattempted packets can be superseded');
	await options.testHooks?.afterAuthorityRead?.();

	const authorityBindings = [
		bindSafePacket(targetPath, 'Superseded target packet', targetSnapshot),
		bindSafePacket(assignmentPath, 'Superseded assignment packet', assignmentSnapshot),
		bindSafePacket(supersedingTargetPath, 'Superseding target packet', higherTargetSnapshot),
		bindSafePacket(
			supersedingAssignmentPath,
			'Superseding assignment packet',
			higherAssignmentSnapshot
		)
	];
	const normalization =
		target.normalization.profile === 'skill-icon-green-key-role-mask-v1'
			? {
					profile: target.normalization.profile,
					outcome: 'not-run' as const,
					geometryHash: target.normalization.geometry.contentHash,
					providerSource: null,
					sourceContentHash: null,
					outputContentHash: null
				}
			: {
					profile: target.normalization.profile,
					outcome: 'not-run' as const,
					geometryHash: target.normalization.geometry.contentHash,
					providerSource: null,
					sourceContentHash: null,
					decoderInputContentHash: null,
					containerBox: null,
					colorSpaceDisposition: null,
					outputContentHash: null
				};
	const result = AnySkillIconResultSchema.parse({
		schemaVersion: 'skill-icon-result-v2',
		resultId: `result-${target.jobId}`,
		jobId: target.jobId,
		logicalIdentity: target.logicalIdentity,
		revision: target.revision,
		role: target.role,
		assignmentId: assignment.assignmentId,
		status: 'superseded',
		attemptCount: 0,
		supersessionReason: options.reason,
		supersedingAuthority: {
			targetPath: supersedingTargetPath,
			targetContentHash: sha256(higherTargetSnapshot.bytes),
			assignmentPath: supersedingAssignmentPath,
			assignmentContentHash: sha256(higherAssignmentSnapshot.bytes),
			jobId: supersedingTarget.jobId,
			logicalIdentity: supersedingTarget.logicalIdentity,
			revision: supersedingTarget.revision,
			role: supersedingTarget.role
		},
		exactPrompt: target.exactPrompt,
		promptHash: sha256(Buffer.from(target.exactPrompt)),
		referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
		normalization,
		output: null,
		resultPath: target.output.resultPath,
		findings: [],
		startedAt: completedAt,
		completedAt,
		totalWallTimeMs: 0,
		writtenOutputPaths: [target.output.resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	});
	AnySkillIconExecutionSchema.parse({
		schemaVersion: 'skill-icon-execution-v2',
		target,
		assignment,
		result
	});
	const resultBytes = transactionBytes(result);
	await persistCoordinatorResultOnly(
		root,
		target.jobId,
		target.output.resultPath,
		resultBytes,
		target.output.candidatePath,
		authorityBindings,
		options.testHooks
	);
	return result;
}

function packetPathsForCandidate(candidatePath: string): {
	readonly targetPath: string;
	readonly assignmentPath: string;
} {
	const match =
		/^assets\/wiki\/skills\/icon-production-v1\/candidates\/(references|calibration|icons)\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\.png$/u.exec(
			candidatePath
		);
	if (!match?.[1] || !match[2])
		throw new Error('Candidate path cannot identify one target/assignment packet');
	return {
		targetPath: `assets/wiki/skills/icon-production-v1/targets/${match[1]}/${match[2]}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/${match[1]}/${match[2]}.json`
	};
}

export async function persistSkillIconOutput(
	options: PersistSkillIconOutputOptions,
	dependencies: PersistSkillIconOutputDependencies = {}
): Promise<SkillIconAssetReceipt> {
	// This public wrapper awaits packet authorities before delegating, so it must not
	// retain any live caller-owned request object across that await.
	const root = process.cwd();
	const sourcePath = options.sourcePath;
	if (!path.isAbsolute(sourcePath)) throw new Error('Source path must be absolute');
	const candidatePath = SkillIconCandidatePathSchema.parse(options.candidatePath);
	const expectedRole = SkillIconRoleSchema.parse(options.expectedRole);
	const geometry = AnySkillIconGeometrySchema.parse(options.geometry);
	const expectedSourceHash = StateHashSchema.parse(options.expectedSourceHash);
	const afterAuthorityRead = dependencies.testHooks?.afterAuthorityRead;
	const now = dependencies.now;
	const { targetPath, assignmentPath } = packetPathsForCandidate(candidatePath);
	const [targetSnapshot, assignmentSnapshot] = await Promise.all([
		readSafePacketSnapshot(root, targetPath, 'Target'),
		readSafePacketSnapshot(root, assignmentPath, 'Assignment')
	]);
	const target = AnySkillIconTargetSchema.parse(JSON.parse(targetSnapshot.bytes.toString('utf8')));
	const assignment = AnySkillIconAssignmentSchema.parse(
		JSON.parse(assignmentSnapshot.bytes.toString('utf8'))
	);
	const geometryPath = geometryPathForTarget(target);
	const geometrySnapshot =
		target.schemaVersion === 'skill-icon-target-v2'
			? await readSafePacketSnapshot(root, geometryPath, 'Geometry')
			: undefined;
	await afterAuthorityRead?.();
	const receivedAt = (now?.() ?? new Date()).toISOString();
	return persistSkillIconOutputBoundWithAuthorities(
		{
			root,
			sourcePath,
			candidatePath,
			expectedRole,
			geometry,
			expectedSourceHash,
			target,
			assignment,
			receivedAt,
			...(geometrySnapshot === undefined ? {} : { geometrySourceBytes: geometrySnapshot.bytes })
		},
		[
			bindSafePacket(targetPath, 'Target packet', targetSnapshot),
			bindSafePacket(assignmentPath, 'Assignment packet', assignmentSnapshot),
			...(geometrySnapshot === undefined
				? []
				: [bindSafePacket(geometryPath, 'Geometry authority', geometrySnapshot)])
		]
	);
}

function option(args: readonly string[], name: string): string {
	const index = args.indexOf(name);
	const value = index >= 0 ? args[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

export interface PersistSkillIconCliRequest {
	readonly sourcePath: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly receivedAt?: string;
	readonly expectedSourceHash?: string;
}

export function parsePersistSkillIconCliRequest(
	args: readonly string[]
): PersistSkillIconCliRequest {
	const allowed = new Set([
		'--source',
		'--target',
		'--assignment',
		'--received-at',
		'--source-hash'
	]);
	const seen = new Set<string>();
	for (let index = 0; index < args.length; index += 2) {
		const flag = args[index];
		if (!flag || !allowed.has(flag) || !args[index + 1])
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		if (seen.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		seen.add(flag);
	}
	const request = {
		sourcePath: option(args, '--source'),
		targetPath: SkillIconTargetPathSchema.parse(option(args, '--target')),
		assignmentPath: SkillIconAssignmentPathSchema.parse(option(args, '--assignment'))
	};
	const receivedAt = seen.has('--received-at')
		? IsoDateTimeSchema.parse(option(args, '--received-at'))
		: undefined;
	const expectedSourceHash = seen.has('--source-hash')
		? StateHashSchema.parse(option(args, '--source-hash'))
		: undefined;
	return {
		...request,
		...(receivedAt === undefined ? {} : { receivedAt }),
		...(expectedSourceHash === undefined ? {} : { expectedSourceHash })
	};
}

async function runCli(args: readonly string[]): Promise<void> {
	const root = process.cwd();
	const request = parsePersistSkillIconCliRequest(args);
	const { targetPath, assignmentPath } = request;
	const [targetSnapshot, assignmentSnapshot] = await Promise.all([
		readSafePacketSnapshot(root, targetPath, 'Target'),
		readSafePacketSnapshot(root, assignmentPath, 'Assignment')
	]);
	const target = AnySkillIconTargetSchema.parse(JSON.parse(targetSnapshot.bytes.toString('utf8')));
	const assignment = AnySkillIconAssignmentSchema.parse(
		JSON.parse(assignmentSnapshot.bytes.toString('utf8'))
	);
	const geometryPath = geometryPathForTarget(target);
	const geometrySnapshot = await readSafePacketSnapshot(root, geometryPath, 'Geometry');
	const geometryBytes = geometrySnapshot.bytes;
	const geometry = parseGeometryForTarget(target, geometryBytes);
	if (assignment.targetPath !== targetPath || assignment.assignmentPath !== assignmentPath)
		throw new Error('CLI target/assignment arguments do not match packet paths');
	const receipt = await persistSkillIconOutputBoundWithAuthorities(
		{
			root,
			sourcePath: request.sourcePath,
			candidatePath: target.output.candidatePath,
			expectedRole: target.role,
			geometry,
			target,
			assignment,
			receivedAt: request.receivedAt ?? new Date().toISOString(),
			...(target.schemaVersion === 'skill-icon-target-v2'
				? { geometrySourceBytes: geometryBytes }
				: {}),
			...(request.expectedSourceHash === undefined
				? {}
				: { expectedSourceHash: request.expectedSourceHash })
		},
		[
			bindSafePacket(targetPath, 'Target packet', targetSnapshot),
			bindSafePacket(assignmentPath, 'Assignment packet', assignmentSnapshot),
			bindSafePacket(geometryPath, 'Geometry authority', geometrySnapshot)
		]
	);
	process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
