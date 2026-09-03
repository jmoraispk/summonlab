import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	AnySkillIconAssignmentSchema,
	AnySkillIconTargetSchema,
	SkillIconAssignmentSchema,
	SkillIconAssignmentV2Schema,
	SkillIconAssignmentPathSchema,
	SkillIconCandidatePathSchema,
	SkillIconGeometrySchema,
	SkillIconResultSchema,
	SkillIconResultV2Schema,
	SkillIconTargetSchema,
	SkillIconTargetV2Schema,
	SkillIconTargetPathSchema,
	type AnySkillIconAssignment,
	type AnySkillIconTarget,
	type SkillIconGeometry,
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
	SKILL_ICON_NORMALIZATION_PROFILE,
	type SkillIconProviderSourceEvidence
} from './normalize-skill-icon-provider-source.js';

interface PersistSkillIconOutputCommonOptions {
	readonly sourcePath: string;
	readonly candidatePath: string;
	readonly expectedRole: SkillIconRole;
	readonly geometry: SkillIconGeometry;
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
		readonly afterSourceRead?: () => void | Promise<void>;
		readonly afterNormalization?: () => void | Promise<void>;
		readonly beforeCandidateWrite?: () => void | Promise<void>;
		readonly afterCandidateOpen?: () => void | Promise<void>;
		readonly beforeResultWrite?: () => void | Promise<void>;
		readonly afterResultOpen?: () => void | Promise<void>;
		readonly afterResultInstall?: () => void | Promise<void>;
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
	readonly accessPath: string;
	readonly file: OwnedPersistedFile['file'];
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
	afterOpen?: () => void | Promise<void>
): Promise<StagedPersistedFile> {
	const temporaryName = `.${destinationName}.skill-icon-tmp-${process.pid}-${randomUUID()}`;
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
			accessPath,
			file: { device: metadata.dev, inode: metadata.ino }
		};
		await afterOpen?.();
		await handle.writeFile(bytes);
		await handle.chmod(0o644);
		await handle.sync();
		return staged;
	} catch (error) {
		if (staged) {
			try {
				await unlinkStagedIfOwned(staged);
			} catch (cleanupError) {
				throw new AggregateError(
					[error, cleanupError],
					'Staging failed and cleanup was refused because ownership changed',
					{ cause: error }
				);
			}
		}
		throw error;
	} finally {
		await handle.close().catch(() => undefined);
	}
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
	owned: OwnedPersistedFile
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

async function persistSkillIconOutputBoundWithAuthorities(
	options: PersistSkillIconOutputBoundOptions,
	authorityBindings: readonly BoundTargetReference[]
): Promise<SkillIconAssetReceipt> {
	if (!path.isAbsolute(options.sourcePath)) throw new Error('Source path must be absolute');
	const receivedAt = IsoDateTimeSchema.parse(options.receivedAt);
	if (options.expectedSourceHash) StateHashSchema.parse(options.expectedSourceHash);
	const root = path.resolve(options.root ?? process.cwd());
	const candidatePath = SkillIconCandidatePathSchema.parse(options.candidatePath);
	const target = AnySkillIconTargetSchema.parse(options.target);
	const assignment = AnySkillIconAssignmentSchema.parse(options.assignment);
	assertPacketBinding(target, assignment, candidatePath, options.expectedRole);
	const isV2 = target.schemaVersion === 'skill-icon-target-v2';
	if (isV2) {
		SkillIconTargetV2Schema.parse(target);
		const assignmentV2 = SkillIconAssignmentV2Schema.parse(assignment);
		if (!options.expectedSourceHash)
			throw new Error('V2 persistence requires the expected provider source hash');
		if (!options.geometrySourceBytes)
			throw new Error('V2 persistence requires the raw geometry authority bytes');
		const geometryHash = createHash('sha256').update(options.geometrySourceBytes).digest('hex');
		if (geometryHash !== target.normalization.geometry.contentHash)
			throw new Error('Raw geometry authority hash does not match the V2 target');
		const parsedGeometry = SkillIconGeometrySchema.parse(
			JSON.parse(options.geometrySourceBytes.toString('utf8'))
		);
		if (JSON.stringify(parsedGeometry) !== JSON.stringify(options.geometry))
			throw new Error('Parsed geometry and raw geometry authority bytes disagree');
		if (
			target.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE ||
			assignmentV2.normalization.profile !== SKILL_ICON_NORMALIZATION_PROFILE
		)
			throw new Error('V2 target and assignment do not authorize the normalization profile');
	}
	const destination = path.resolve(root, candidatePath);
	const resultDestination = path.resolve(root, target.output.resultPath);
	if (!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/candidates'), destination))
		throw new Error('Candidate output must remain inside the skill-icon candidates directory');
	if (
		!inside(path.resolve(root, 'assets/wiki/skills/icon-production-v1/results'), resultDestination)
	)
		throw new Error('Result output must remain inside the skill-icon results directory');
	if (path.resolve(options.sourcePath) === destination)
		throw new Error('Source and candidate paths must differ');

	const sourceBytes = await readSkillIconProviderSourceOnce(
		options.sourcePath,
		options.testHooks?.afterSourceRead
	);
	const sourceContentHash = createHash('sha256').update(sourceBytes).digest('hex');
	if (options.expectedSourceHash && options.expectedSourceHash !== sourceContentHash)
		throw new Error('Source/candidate hash mismatch against expected source hash');
	const normalized = isV2
		? await normalizeSkillIconProviderSource(
				sourceBytes,
				options.expectedRole,
				options.geometrySourceBytes!
			)
		: null;
	await options.testHooks?.afterNormalization?.();
	const candidateBytes = normalized?.bytes ?? sourceBytes;
	const inspection = await inspectSkillIconAsset(
		candidateBytes,
		options.expectedRole,
		options.geometry
	);
	if (inspection.width !== target.canvas.width || inspection.height !== target.canvas.height)
		throw new Error(
			`Source dimensions ${inspection.width}×${inspection.height} do not match target ${target.canvas.width}×${target.canvas.height}`
		);
	if (inspection.mediaType !== target.canvas.mediaType)
		throw new Error(`Source must be a PNG (${target.canvas.mediaType})`);
	if (inspection.violations.length > 0)
		throw new Error(`Skill icon asset validation failed: ${inspection.violations.join('; ')}`);

	await ensureSafeParents(root, destination);
	await ensureSafeParents(root, resultDestination);
	if (await metadataOrNull(destination))
		throw new Error(`Candidate output already exists (collision): ${candidatePath}`);
	if (await metadataOrNull(resultDestination))
		throw new Error(`Result output already exists (collision): ${target.output.resultPath}`);
	await options.testHooks?.beforeCandidateWrite?.();
	let candidateParent: HeldPersistenceParent | undefined;
	let resultParent: HeldPersistenceParent | undefined;
	let candidateOwnership: OwnedPersistedFile | undefined;
	let resultOwnership: OwnedPersistedFile | undefined;
	try {
		candidateParent = await openHeldPersistenceParent(root, destination);
		resultParent = await openHeldPersistenceParent(root, resultDestination);
		// This is deliberately the final read-only operation before any output bytes
		// are staged. Every packet reference must still be a regular, hash-bound file.
		const referenceBindings = await bindTargetReferences(root, target);
		const stagedCandidate = await stageCompleteSibling(
			candidateParent,
			path.basename(destination),
			candidateBytes,
			options.testHooks?.afterCandidateOpen
		);
		candidateOwnership = await installStagedNoReplace(
			candidateParent,
			destination,
			stagedCandidate
		);
		const retainedHandle = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
		let retainedBytes: Buffer;
		try {
			retainedBytes = await retainedHandle.readFile();
		} finally {
			await retainedHandle.close();
		}
		const retained = await inspectSkillIconAsset(
			retainedBytes,
			options.expectedRole,
			options.geometry
		);
		if (retained.contentHash !== inspection.contentHash || !retainedBytes.equals(candidateBytes))
			throw new Error('Source/candidate hash mismatch after persistence');
		const output = {
			path: candidatePath,
			mediaType: 'image/png' as const,
			width: retained.width,
			height: retained.height,
			bytes: retained.bytes,
			alphaMode: retained.alphaMode,
			contentHash: retained.contentHash
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
					observation: `${options.expectedRole} dimensions, media type, alpha, and geometry checks passed.`
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
						profile: normalized!.normalization.profile,
						outcome: 'completed',
						geometryHash: normalized!.normalization.geometryHash,
						providerSource: normalized!.source,
						sourceContentHash: normalized!.normalization.sourceContentHash,
						outputContentHash: normalized!.normalization.outputContentHash
					},
					...resultCommon
				})
			: SkillIconResultSchema.parse({
					schemaVersion: 'skill-icon-result-v1',
					...resultCommon
				});
		const resultBytes = Buffer.from(`${JSON.stringify(result, null, '\t')}\n`);
		await options.testHooks?.beforeResultWrite?.();
		await assertOwnedPersistedFile(candidateOwnership, candidateBytes, 'Candidate');
		const stagedResult = await stageCompleteSibling(
			resultParent,
			path.basename(resultDestination),
			resultBytes,
			options.testHooks?.afterResultOpen
		);
		resultOwnership = await installStagedNoReplace(resultParent, resultDestination, stagedResult);
		await options.testHooks?.afterResultInstall?.();
		const retainedResult = await readSafePacket(root, target.output.resultPath, 'Retained result');
		if (!retainedResult.equals(resultBytes))
			throw new Error('Result bytes changed during persistence');
		await assertOwnedPersistedFile(candidateOwnership, candidateBytes, 'Candidate');
		await assertOwnedPersistedFile(resultOwnership, resultBytes, 'Result');
		await assertTargetReferencesStillBound(root, referenceBindings);
		await assertTargetReferencesStillBound(root, authorityBindings);
		return {
			schemaVersion: 'skill-icon-asset-receipt-v1',
			jobId: target.jobId,
			role: options.expectedRole,
			receivedAt,
			source: { path: options.sourcePath, ...(normalized?.source ?? inspection) },
			retained: { path: candidatePath, ...retained },
			result: {
				path: target.output.resultPath,
				contentHash: createHash('sha256').update(resultBytes).digest('hex')
			}
		};
	} catch (error) {
		const cleanupFailures: unknown[] = [];
		for (const [parent, owned] of [
			[candidateParent, candidateOwnership],
			[resultParent, resultOwnership]
		] as const) {
			if (!parent || !owned) continue;
			try {
				await removeOwnedPersistedFileHeld(parent, owned);
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
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
	const root = process.cwd();
	const candidatePath = SkillIconCandidatePathSchema.parse(options.candidatePath);
	const { targetPath, assignmentPath } = packetPathsForCandidate(candidatePath);
	const [targetSnapshot, assignmentSnapshot] = await Promise.all([
		readSafePacketSnapshot(root, targetPath, 'Target'),
		readSafePacketSnapshot(root, assignmentPath, 'Assignment')
	]);
	const target = AnySkillIconTargetSchema.parse(JSON.parse(targetSnapshot.bytes.toString('utf8')));
	const assignment = AnySkillIconAssignmentSchema.parse(
		JSON.parse(assignmentSnapshot.bytes.toString('utf8'))
	);
	const geometrySnapshot =
		target.schemaVersion === 'skill-icon-target-v2'
			? await readSafePacketSnapshot(root, SKILL_ICON_GEOMETRY_PATH, 'Geometry')
			: undefined;
	await dependencies.testHooks?.afterAuthorityRead?.();
	const receivedAt = (dependencies.now?.() ?? new Date()).toISOString();
	return persistSkillIconOutputBoundWithAuthorities(
		{
			...options,
			root,
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
				: [bindSafePacket(SKILL_ICON_GEOMETRY_PATH, 'Geometry authority', geometrySnapshot)])
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
	const [targetSnapshot, assignmentSnapshot, geometrySnapshot] = await Promise.all([
		readSafePacketSnapshot(root, targetPath, 'Target'),
		readSafePacketSnapshot(root, assignmentPath, 'Assignment'),
		readSafePacketSnapshot(root, SKILL_ICON_GEOMETRY_PATH, 'Geometry')
	]);
	const target = AnySkillIconTargetSchema.parse(JSON.parse(targetSnapshot.bytes.toString('utf8')));
	const assignment = AnySkillIconAssignmentSchema.parse(
		JSON.parse(assignmentSnapshot.bytes.toString('utf8'))
	);
	const geometryBytes = geometrySnapshot.bytes;
	const geometry = SkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
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
			bindSafePacket(SKILL_ICON_GEOMETRY_PATH, 'Geometry authority', geometrySnapshot)
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
