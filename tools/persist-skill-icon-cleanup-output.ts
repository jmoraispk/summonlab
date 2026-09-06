import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import { SkillIconGeometryV2Schema } from '../packages/contracts/src/index.js';
import {
	SKILL_ICON_NORMALIZER_SHARP_VERSION,
	SKILL_ICON_NORMALIZER_VIPS_VERSION,
	SKILL_ICON_PROVIDER_SIZE,
	prepareSkillIconProviderSourceV3
} from './normalize-skill-icon-provider-source.js';
import {
	CleanupRevisionPacketSchema,
	clearCleanupExterior,
	composeCleanupIcon,
	extractLegacyInterior,
	inspectCleanupComposite,
	loadCleanupRevisionPackets,
	type CleanupInspection,
	type CleanupRevisionPacket
} from './skill-icon-quality-cleanup-lib.js';

const CLEANUP_REVISION_PACKET_PATH =
	/^assets\/wiki\/skills\/icon-production-v1\/quality-cleanup-v1\/prompts\/revisions\/[a-z0-9]+(?:-[a-z0-9]+)*-v1\.json$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export interface PersistCleanupRevisionCliRequest {
	readonly packetPath: string;
	readonly sourcePath: string;
	readonly sourceHash: string;
	readonly attemptCount: 1 | 2;
	readonly fullSizeOutcome: 'pass' | 'fail';
	readonly fullSizeObservation: string;
	readonly display384Outcome: 'pass' | 'fail';
	readonly display384Observation: string;
}

export interface PersistCleanupRevisionTestHooks {
	readonly afterSourceRead?: () => void | Promise<void>;
	readonly afterDerivation?: () => void | Promise<void>;
	readonly afterStage?: () => void | Promise<void>;
	readonly afterPublish?: (index: number, repositoryPath: string) => void | Promise<void>;
	readonly beforeRollbackDetach?: (repositoryPath: string) => void | Promise<void>;
}

export interface PersistCleanupRevisionInput extends PersistCleanupRevisionCliRequest {
	readonly root?: string;
	/** @internal Test-only synchronization around authenticated transaction boundaries. */
	readonly testHooks?: PersistCleanupRevisionTestHooks;
}

const InspectionOutcomeSchema = z
	.object({ outcome: z.enum(['pass', 'fail']), observation: z.string().min(1).max(1_000) })
	.strict();
const ArtifactEvidenceSchema = z
	.object({
		path: z.string().min(1),
		mediaType: z.literal('image/png'),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
		bytes: z.number().int().positive(),
		contentHash: z.string().regex(SHA256)
	})
	.strict();
const ProviderArtifactEvidenceSchema = ArtifactEvidenceSchema.extend({
	alphaMode: z.literal('rgb')
}).strict();
const CleanupNormalizationEvidenceSchema = z
	.object({
		profile: z.literal('skill-icon-cleanup-artwork-resize-mask-v1'),
		sourceContentHash: z.string().regex(SHA256),
		decoderInputContentHash: z.string().regex(SHA256),
		containerBox: z
			.object({
				chunkType: z.literal('caBX'),
				bytes: z.number().int().positive(),
				contentHash: z.string().regex(SHA256)
			})
			.strict(),
		colorSpaceDisposition: z.literal('assigned-srgb'),
		geometryContentHash: z.string().regex(SHA256),
		outputContentHash: z.string().regex(SHA256)
	})
	.strict();

export const CleanupRevisionResultSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-quality-cleanup-revision-result-v1'),
		status: z.enum(['candidate', 'revise']),
		targetId: z.string().min(1),
		name: z.string().min(1),
		rank: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S']),
		motifFamily: z.string().min(1),
		finding: z.object({
			targetId: z.string().min(1),
			kind: z.literal('stray-ui-glyph'),
			detail: z.string().min(1),
			requiredAction: z.literal('revise-art')
		}),
		revisionPacket: z
			.object({ path: z.string().min(1), contentHash: z.string().regex(SHA256) })
			.strict(),
		cleanupManifest: CleanupRevisionPacketSchema.shape.cleanupManifest,
		sourceCandidate: CleanupRevisionPacketSchema.shape.sourceCandidate,
		currentCandidate: CleanupRevisionPacketSchema.shape.currentCandidate,
		currentResult: CleanupRevisionPacketSchema.shape.currentResult,
		exactPrompt: z.string().min(1),
		exactPromptHash: z.string().regex(SHA256),
		references: CleanupRevisionPacketSchema.shape.references,
		providerEnvelope: CleanupRevisionPacketSchema.shape.providerEnvelope,
		normalizationAuthority: CleanupRevisionPacketSchema.shape.normalizationAuthority,
		providerSource: ProviderArtifactEvidenceSchema,
		revisedInterior: ArtifactEvidenceSchema.extend({
			removedPixels: z.number().int().nonnegative(),
			removedPixelBounds: z
				.object({
					left: z.number().int().nonnegative(),
					top: z.number().int().nonnegative(),
					width: z.number().int().positive(),
					height: z.number().int().positive()
				})
				.strict()
				.nullable()
		}).strict(),
		normalization: CleanupNormalizationEvidenceSchema,
		compositionAuthority: CleanupRevisionPacketSchema.shape.compositionAuthority,
		composite: ArtifactEvidenceSchema,
		display384: ArtifactEvidenceSchema.omit({ path: true }).strict(),
		automatedInspection: z.custom<CleanupInspection>(),
		inspection: z
			.object({ fullSize: InspectionOutcomeSchema, display384: InspectionOutcomeSchema })
			.strict(),
		attemptCount: z.union([z.literal(1), z.literal(2)]),
		attemptCeiling: z.literal(2),
		transactionContentHash: z.string().regex(SHA256),
		resultPath: z.string().min(1),
		writtenOutputPaths: z.array(z.string().min(1)).length(4),
		completionContract: z
			.object({
				sharedFilesRemainUntouched: z.literal(true),
				selfPromotionForbidden: z.literal(true)
			})
			.strict()
	})
	.strict();

export type CleanupRevisionResult = z.infer<typeof CleanupRevisionResultSchema>;

function required(values: ReadonlyMap<string, string>, name: string): string {
	const value = values.get(name);
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

function observation(value: string, name: string): string {
	const normalized = value.trim();
	if (normalized.length === 0 || normalized.length > 1_000) {
		throw new Error(`${name} must contain between 1 and 1000 characters`);
	}
	return normalized;
}

function outcome(value: string, name: string): 'pass' | 'fail' {
	if (value !== 'pass' && value !== 'fail') throw new Error(`${name} must be pass or fail`);
	return value;
}

export function parsePersistCleanupRevisionCliRequest(
	args: readonly string[]
): PersistCleanupRevisionCliRequest {
	const normalizedArgs = args[0] === '--' ? args.slice(1) : [...args];
	if (normalizedArgs.includes('--')) {
		throw new Error(
			'The -- argument separator is allowed only once and only as the first argument'
		);
	}
	const allowed = new Set([
		'--packet',
		'--source',
		'--source-hash',
		'--attempt-count',
		'--full-size-outcome',
		'--full-size-observation',
		'--display-384-outcome',
		'--display-384-observation'
	]);
	const values = new Map<string, string>();
	for (let index = 0; index < normalizedArgs.length; index += 2) {
		const flag = normalizedArgs[index];
		const value = normalizedArgs[index + 1];
		if (!flag || !allowed.has(flag) || !value) {
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		}
		if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		values.set(flag, value);
	}
	const packetPath = required(values, '--packet');
	if (!CLEANUP_REVISION_PACKET_PATH.test(packetPath)) {
		throw new Error('--packet must be a canonical cleanup revision-v1 packet path');
	}
	const sourcePath = required(values, '--source');
	if (!path.isAbsolute(sourcePath)) throw new Error('--source must be an absolute path');
	const sourceHash = required(values, '--source-hash');
	if (!SHA256.test(sourceHash)) throw new Error('--source-hash must be a lowercase SHA-256 hash');
	const attemptCountValue = required(values, '--attempt-count');
	if (attemptCountValue !== '1' && attemptCountValue !== '2') {
		throw new Error('--attempt-count exceeds the one-attempt-plus-one-correction ceiling');
	}
	return {
		packetPath,
		sourcePath,
		sourceHash,
		attemptCount: Number(attemptCountValue) as 1 | 2,
		fullSizeOutcome: outcome(required(values, '--full-size-outcome'), '--full-size-outcome'),
		fullSizeObservation: observation(
			required(values, '--full-size-observation'),
			'--full-size-observation'
		),
		display384Outcome: outcome(required(values, '--display-384-outcome'), '--display-384-outcome'),
		display384Observation: observation(
			required(values, '--display-384-observation'),
			'--display-384-observation'
		)
	};
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value: unknown): Buffer {
	return Buffer.from(`${JSON.stringify(value, null, '\t')}\n`);
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

interface SafeSnapshot {
	readonly bytes: Buffer;
	readonly path: string;
	readonly parent: {
		readonly realPath: string;
		readonly device: bigint;
		readonly inode: bigint;
	};
	readonly file: {
		readonly device: bigint;
		readonly inode: bigint;
		readonly size: bigint;
		readonly mtimeNs: bigint;
		readonly ctimeNs: bigint;
	};
}

const MAX_INPUT_BYTES = 64 * 1024 * 1024;

async function readBoundedFile(
	handle: Awaited<ReturnType<typeof open>>,
	expectedSize: bigint,
	description: string
): Promise<Buffer> {
	if (expectedSize < 1n || expectedSize > BigInt(MAX_INPUT_BYTES)) {
		throw new Error(`${description} must contain 1-${MAX_INPUT_BYTES} bytes`);
	}
	const bytes = Buffer.alloc(Number(expectedSize));
	let offset = 0;
	while (offset < bytes.length) {
		const read = await handle.read(bytes, offset, bytes.length - offset, null);
		if (read.bytesRead === 0) throw new Error(`${description} changed size while reading`);
		offset += read.bytesRead;
	}
	if ((await handle.read(Buffer.alloc(1), 0, 1, null)).bytesRead !== 0) {
		throw new Error(`${description} grew while reading`);
	}
	return bytes;
}

async function readSafeAbsoluteFile(filePath: string, description: string): Promise<SafeSnapshot> {
	const absolutePath = path.resolve(filePath);
	const parentPath = path.dirname(absolutePath);
	const filesystemRoot = path.parse(absolutePath).root;
	const pathSegments = path.relative(filesystemRoot, absolutePath).split(path.sep);
	let cursor = filesystemRoot;
	for (const [index, segment] of pathSegments.entries()) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) {
			throw new Error(`${description} path cannot contain a symbolic link: ${filePath}`);
		}
		if (index < pathSegments.length - 1 && !metadata.isDirectory()) {
			throw new Error(`${description} ancestor is not a directory: ${filePath}`);
		}
	}
	const [parentBefore, parentRealPath] = await Promise.all([
		lstat(parentPath, { bigint: true }),
		realpath(parentPath)
	]);
	if (parentBefore.isSymbolicLink() || !parentBefore.isDirectory()) {
		throw new Error(`${description} parent must be a real directory`);
	}
	const handle = await open(
		absolutePath,
		constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW
	).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ELOOP') throw new Error(`${description} cannot be a symbolic link`);
		throw error;
	});
	try {
		const before = await handle.stat({ bigint: true });
		if (!before.isFile()) throw new Error(`${description} must be a regular file`);
		const bytes = await readBoundedFile(handle, before.size, description);
		const [after, named, parentAfter, realParentAfter] = await Promise.all([
			handle.stat({ bigint: true }),
			lstat(absolutePath, { bigint: true }),
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
			parentBefore.dev !== parentAfter.dev ||
			parentBefore.ino !== parentAfter.ino ||
			realParentAfter !== parentRealPath
		) {
			throw new Error(`${description} identity changed while reading`);
		}
		return {
			bytes,
			path: absolutePath,
			parent: {
				realPath: parentRealPath,
				device: parentAfter.dev,
				inode: parentAfter.ino
			},
			file: {
				device: after.dev,
				inode: after.ino,
				size: after.size,
				mtimeNs: after.mtimeNs,
				ctimeNs: after.ctimeNs
			}
		};
	} finally {
		await handle.close();
	}
}

async function readSafeRepositoryFile(
	root: string,
	repositoryPath: string,
	description: string
): Promise<SafeSnapshot> {
	if (path.isAbsolute(repositoryPath)) throw new Error(`${description} must use a repository path`);
	const absolutePath = path.resolve(root, repositoryPath);
	if (!inside(root, absolutePath) || absolutePath === root) {
		throw new Error(`${description} escaped the workspace root`);
	}
	const rootMetadata = await lstat(root);
	if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) {
		throw new Error('Workspace root must be a real directory');
	}
	const realRoot = await realpath(root);
	let cursor = root;
	const pathSegments = path.relative(root, absolutePath).split(path.sep);
	for (const [index, segment] of pathSegments.entries()) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) {
			throw new Error(`${description} path cannot contain a symbolic link: ${repositoryPath}`);
		}
		if (index < pathSegments.length - 1 && !metadata.isDirectory()) {
			throw new Error(`${description} ancestor is not a directory: ${repositoryPath}`);
		}
	}
	const snapshot = await readSafeAbsoluteFile(absolutePath, description);
	if (!inside(realRoot, snapshot.parent.realPath)) {
		throw new Error(`${description} escaped the real workspace root`);
	}
	return snapshot;
}

function sameSnapshot(left: SafeSnapshot, right: SafeSnapshot): boolean {
	return (
		left.path === right.path &&
		left.parent.realPath === right.parent.realPath &&
		left.parent.device === right.parent.device &&
		left.parent.inode === right.parent.inode &&
		left.file.device === right.file.device &&
		left.file.inode === right.file.inode &&
		left.file.size === right.file.size &&
		left.file.mtimeNs === right.file.mtimeNs &&
		left.file.ctimeNs === right.file.ctimeNs &&
		left.bytes.equals(right.bytes)
	);
}

async function assertSnapshotUnchanged(snapshot: SafeSnapshot, description: string): Promise<void> {
	const current = await readSafeAbsoluteFile(snapshot.path, description);
	if (!sameSnapshot(snapshot, current))
		throw new Error(`${description} changed during persistence`);
}

async function bindPacketAuthorities(
	root: string,
	packet: CleanupRevisionPacket,
	packetSnapshot: SafeSnapshot
): Promise<readonly { readonly description: string; readonly snapshot: SafeSnapshot }[]> {
	const requested: Array<{
		repositoryPath: string;
		contentHash: string;
		description: string;
	}> = [
		{
			repositoryPath: packet.cleanupManifest.path,
			contentHash: packet.cleanupManifest.contentHash,
			description: 'Cleanup manifest authority'
		},
		{
			repositoryPath: packet.sourceCandidate.path,
			contentHash: packet.sourceCandidate.contentHash,
			description: 'Frozen source candidate'
		},
		{
			repositoryPath: packet.currentCandidate.path,
			contentHash: packet.currentCandidate.contentHash,
			description: 'Current cleanup candidate'
		},
		{
			repositoryPath: packet.currentResult.path,
			contentHash: packet.currentResult.contentHash,
			description: 'Current cleanup result'
		},
		...Object.entries(packet.compositionAuthority).map(([name, binding]) => ({
			repositoryPath: binding.path,
			contentHash: binding.contentHash,
			description: `Cleanup composition ${name} authority`
		})),
		...packet.references.map((reference, index) => ({
			repositoryPath: reference.path,
			contentHash: reference.contentHash,
			description: `Ordered cleanup reference ${index + 1}`
		}))
	];
	const byPath = new Map<
		string,
		{ readonly contentHash: string; readonly descriptions: readonly string[] }
	>();
	for (const request of requested) {
		const prior = byPath.get(request.repositoryPath);
		if (prior && prior.contentHash !== request.contentHash) {
			throw new Error(`Conflicting cleanup authority hashes: ${request.repositoryPath}`);
		}
		byPath.set(request.repositoryPath, {
			contentHash: request.contentHash,
			descriptions: [...(prior?.descriptions ?? []), request.description]
		});
	}
	const bindings = [{ description: 'Cleanup revision packet', snapshot: packetSnapshot }];
	for (const [repositoryPath, binding] of byPath) {
		const description = binding.descriptions.join(' / ');
		const snapshot = await readSafeRepositoryFile(root, repositoryPath, description);
		if (sha256(snapshot.bytes) !== binding.contentHash) {
			throw new Error(`${description} hash changed before persistence: ${repositoryPath}`);
		}
		bindings.push({ description, snapshot });
	}
	return bindings;
}

async function assertAuthoritiesUnchanged(
	bindings: readonly { readonly description: string; readonly snapshot: SafeSnapshot }[]
): Promise<void> {
	for (const binding of bindings) {
		await assertSnapshotUnchanged(binding.snapshot, binding.description);
	}
}

interface HeldParent {
	readonly path: string;
	readonly handle: Awaited<ReturnType<typeof open>>;
	readonly realPath: string;
	readonly device: number;
	readonly inode: number;
}

interface StagedOutput {
	readonly repositoryPath: string;
	readonly destination: string;
	readonly parent: HeldParent;
	readonly temporaryPath: string;
	readonly bytes: Buffer;
	readonly device: number;
	readonly inode: number;
	installed: boolean;
}

async function ensureSafeOutputParent(root: string, destination: string): Promise<void> {
	if (!inside(root, destination) || destination === root) {
		throw new Error('Cleanup revision destination escaped the workspace root');
	}
	const realRoot = await realpath(root);
	let cursor = root;
	for (const segment of path
		.relative(root, path.dirname(destination))
		.split(path.sep)
		.filter(Boolean)) {
		cursor = path.join(cursor, segment);
		let metadata = await metadataOrNull(cursor);
		if (!metadata) {
			await mkdir(cursor).catch((error: NodeJS.ErrnoException) => {
				if (error.code !== 'EEXIST') throw error;
			});
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink()) {
			throw new Error(`Cleanup revision destination parent cannot be a symbolic link: ${cursor}`);
		}
		if (!metadata.isDirectory()) {
			throw new Error(`Cleanup revision destination parent is not a directory: ${cursor}`);
		}
		if (!inside(realRoot, await realpath(cursor))) {
			throw new Error(`Cleanup revision destination parent escaped the workspace root: ${cursor}`);
		}
	}
}

function heldChild(parent: HeldParent, name: string): string {
	if (name !== path.basename(name) || name === '.' || name === '..') {
		throw new Error(`Unsafe cleanup persistence child name: ${name}`);
	}
	return `/proc/self/fd/${parent.handle.fd}/${name}`;
}

async function openHeldParent(root: string, destination: string): Promise<HeldParent> {
	await ensureSafeOutputParent(root, destination);
	const parentPath = path.dirname(destination);
	const [expectedRealPath, expectedMetadata] = await Promise.all([
		realpath(parentPath),
		lstat(parentPath)
	]);
	const handle = await open(
		parentPath,
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		const opened = await handle.stat();
		const heldRealPath = await realpath(`/proc/self/fd/${handle.fd}`);
		if (
			!opened.isDirectory() ||
			expectedMetadata.isSymbolicLink() ||
			opened.dev !== expectedMetadata.dev ||
			opened.ino !== expectedMetadata.ino ||
			heldRealPath !== expectedRealPath ||
			!inside(await realpath(root), heldRealPath)
		) {
			throw new Error(`Cleanup persistence parent identity changed: ${parentPath}`);
		}
		return {
			path: parentPath,
			handle,
			realPath: heldRealPath,
			device: opened.dev,
			inode: opened.ino
		};
	} catch (error) {
		await handle.close();
		throw error;
	}
}

async function assertHeldParentNamed(parent: HeldParent): Promise<void> {
	const [realPathNow, metadata] = await Promise.all([realpath(parent.path), lstat(parent.path)]);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isDirectory() ||
		realPathNow !== parent.realPath ||
		metadata.dev !== parent.device ||
		metadata.ino !== parent.inode
	) {
		throw new Error(`Cleanup persistence parent identity changed: ${parent.path}`);
	}
}

async function assertAllHeldParentsNamed(outputs: readonly StagedOutput[]): Promise<void> {
	const checked = new Set<number>();
	for (const output of outputs) {
		if (checked.has(output.parent.handle.fd)) continue;
		checked.add(output.parent.handle.fd);
		await assertHeldParentNamed(output.parent);
	}
}

async function stageOutput(
	root: string,
	repositoryPath: string,
	bytes: Buffer
): Promise<StagedOutput> {
	const destination = path.resolve(root, repositoryPath);
	const parent = await openHeldParent(root, destination);
	const destinationName = path.basename(destination);
	const finalPath = heldChild(parent, destinationName);
	if (await metadataOrNull(finalPath)) {
		await parent.handle.close();
		throw new Error(
			`Cleanup revision destination already exists; refusing replacement: ${repositoryPath}`
		);
	}
	const temporaryName = `.${destinationName}.cleanup-revision-tmp-${process.pid}-${randomUUID()}`;
	const temporaryPath = heldChild(parent, temporaryName);
	let handle: Awaited<ReturnType<typeof open>> | null = null;
	try {
		handle = await open(
			temporaryPath,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o600
		);
		const opened = await handle.stat();
		if (!opened.isFile() || opened.nlink !== 1) {
			throw new Error(`Unsafe cleanup revision stage: ${repositoryPath}`);
		}
		await handle.writeFile(bytes);
		await handle.chmod(0o644);
		await handle.sync();
		await parent.handle.sync();
		return {
			repositoryPath,
			destination,
			parent,
			temporaryPath,
			bytes,
			device: opened.dev,
			inode: opened.ino,
			installed: false
		};
	} catch (error) {
		await unlink(temporaryPath).catch(() => undefined);
		await parent.handle.close().catch(() => undefined);
		throw error;
	} finally {
		await handle?.close().catch(() => undefined);
	}
}

async function assertOwnedPath(
	filePath: string,
	output: StagedOutput,
	description: string
): Promise<void> {
	const metadata = await lstat(filePath);
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== output.device ||
		metadata.ino !== output.inode
	) {
		throw new Error(`${description} identity changed: ${output.repositoryPath}`);
	}
}

async function publishStaged(output: StagedOutput): Promise<void> {
	await assertHeldParentNamed(output.parent);
	await assertOwnedPath(output.temporaryPath, output, 'Cleanup revision stage');
	const finalPath = heldChild(output.parent, path.basename(output.destination));
	await link(output.temporaryPath, finalPath);
	output.installed = true;
	await output.parent.handle.sync();
	await assertOwnedPath(finalPath, output, 'Cleanup revision output');
	await assertHeldParentNamed(output.parent);
}

async function restoreQuarantinedUnownedPath(
	quarantinePath: string,
	originalPath: string,
	output: StagedOutput
): Promise<void> {
	try {
		await link(quarantinePath, originalPath);
	} catch (error) {
		throw new Error(
			`Cleanup revision preserved an unowned rollback artifact at ${path.basename(quarantinePath)} because its original name is occupied`,
			{ cause: error }
		);
	}
	await unlink(quarantinePath);
	await output.parent.handle.sync();
}

async function removeOwnedPath(
	filePath: string,
	output: StagedOutput,
	beforeDetach?: (repositoryPath: string) => void | Promise<void>
): Promise<void> {
	const quarantinePath = heldChild(
		output.parent,
		`.${path.basename(filePath)}.cleanup-revision-rollback-${process.pid}-${randomUUID()}`
	);
	await beforeDetach?.(output.repositoryPath);
	try {
		await rename(filePath, quarantinePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
		throw error;
	}
	const metadata = await lstat(quarantinePath);
	const bytes =
		metadata.isFile() && !metadata.isSymbolicLink() ? await readFile(quarantinePath) : null;
	if (
		!metadata.isFile() ||
		metadata.isSymbolicLink() ||
		metadata.dev !== output.device ||
		metadata.ino !== output.inode ||
		!bytes?.equals(output.bytes)
	) {
		await restoreQuarantinedUnownedPath(quarantinePath, filePath, output);
		throw new Error(
			`Cleanup revision rollback refused an unowned artifact: ${output.repositoryPath}`
		);
	}
	await unlink(quarantinePath);
	await output.parent.handle.sync();
}

async function cleanupTransaction(
	outputs: readonly StagedOutput[],
	beforeDetach?: (repositoryPath: string) => void | Promise<void>
): Promise<void> {
	const errors: unknown[] = [];
	for (const output of [...outputs].reverse()) {
		const finalPath = heldChild(output.parent, path.basename(output.destination));
		if (output.installed) {
			await removeOwnedPath(finalPath, output, beforeDetach).catch((error) => errors.push(error));
		}
		await removeOwnedPath(output.temporaryPath, output).catch((error) => errors.push(error));
	}
	if (errors.length > 0) {
		throw new AggregateError(errors, 'Cleanup revision rollback refused unowned artifacts');
	}
}

function validateBoundInput(input: PersistCleanupRevisionInput): PersistCleanupRevisionCliRequest {
	return parsePersistCleanupRevisionCliRequest([
		'--packet',
		input.packetPath,
		'--source',
		input.sourcePath,
		'--source-hash',
		input.sourceHash,
		'--attempt-count',
		String(input.attemptCount),
		'--full-size-outcome',
		input.fullSizeOutcome,
		'--full-size-observation',
		input.fullSizeObservation,
		'--display-384-outcome',
		input.display384Outcome,
		'--display-384-observation',
		input.display384Observation
	]);
}

function artifactEvidence(
	pathValue: string,
	bytes: Buffer,
	width: number,
	height: number
): {
	readonly path: string;
	readonly mediaType: 'image/png';
	readonly width: number;
	readonly height: number;
	readonly bytes: number;
	readonly contentHash: string;
} {
	return {
		path: pathValue,
		mediaType: 'image/png',
		width,
		height,
		bytes: bytes.byteLength,
		contentHash: sha256(bytes)
	};
}

export async function persistCleanupRevision(
	input: PersistCleanupRevisionInput
): Promise<CleanupRevisionResult> {
	const boundInput = validateBoundInput(input);
	const root = path.resolve(input.root ?? process.cwd());
	const testHooks = input.testHooks ? { ...input.testHooks } : undefined;
	const packetSnapshot = await readSafeRepositoryFile(
		root,
		boundInput.packetPath,
		'Cleanup revision packet'
	);
	const packet = CleanupRevisionPacketSchema.parse(
		JSON.parse(packetSnapshot.bytes.toString('utf8')) as unknown
	);
	const expectedPacketPath = `assets/wiki/skills/icon-production-v1/quality-cleanup-v1/prompts/revisions/${packet.targetId.replaceAll(':', '-')}-v1.json`;
	if (boundInput.packetPath !== expectedPacketPath) {
		throw new Error('Cleanup revision packet path does not bind its target identity');
	}
	const canonicalPackets = await loadCleanupRevisionPackets(root);
	const canonical = canonicalPackets.find(
		({ path: packetPath }) => packetPath === boundInput.packetPath
	);
	if (!canonical || !packetSnapshot.bytes.equals(jsonBytes(canonical.packet))) {
		throw new Error('Cleanup revision packet is not the exact canonical immutable packet');
	}
	const authorityBindings = await bindPacketAuthorities(root, packet, packetSnapshot);
	const sourceSnapshot = await readSafeAbsoluteFile(
		boundInput.sourcePath,
		'Cleanup revision provider source'
	);
	if (sha256(sourceSnapshot.bytes) !== boundInput.sourceHash) {
		throw new Error('Cleanup revision provider source hash does not match --source-hash');
	}
	for (const repositoryPath of Object.values(packet.output)) {
		if (path.resolve(root, repositoryPath) === sourceSnapshot.path) {
			throw new Error('Cleanup revision source cannot also be a destination');
		}
	}
	await testHooks?.afterSourceRead?.();

	const geometryBytes = authorityBindings.find(
		({ snapshot }) =>
			snapshot.path === path.resolve(root, packet.compositionAuthority.geometry.path)
	)?.snapshot.bytes;
	if (!geometryBytes) throw new Error('Cleanup revision geometry authority was not bound');
	const geometry = SkillIconGeometryV2Schema.parse(
		JSON.parse(geometryBytes.toString('utf8')) as unknown
	);
	if (
		sharp.versions.sharp !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		sharp.versions.vips !== SKILL_ICON_NORMALIZER_VIPS_VERSION ||
		packet.normalizationAuthority.sharpVersion !== SKILL_ICON_NORMALIZER_SHARP_VERSION ||
		packet.normalizationAuthority.vipsVersion !== SKILL_ICON_NORMALIZER_VIPS_VERSION
	) {
		throw new Error(
			'Cleanup revision normalization requires the packet-pinned Sharp/libvips toolchain'
		);
	}
	if (
		packet.providerEnvelope.width !== SKILL_ICON_PROVIDER_SIZE ||
		packet.providerEnvelope.height !== SKILL_ICON_PROVIDER_SIZE ||
		packet.normalizationAuthority.resize.width !== geometry.canvas.width ||
		packet.normalizationAuthority.resize.height !== geometry.canvas.height
	) {
		throw new Error('Cleanup revision provider envelope does not match its geometry authority');
	}
	const preparedProvider = prepareSkillIconProviderSourceV3(sourceSnapshot.bytes);
	if (preparedProvider.source.contentHash !== boundInput.sourceHash) {
		throw new Error('Cleanup revision prepared provider hash does not match --source-hash');
	}
	const normalizedCanvas = await sharp(preparedProvider.decoderInput, {
		failOn: 'error',
		limitInputPixels: SKILL_ICON_PROVIDER_SIZE * SKILL_ICON_PROVIDER_SIZE,
		sequentialRead: true
	})
		.toColourspace('srgb')
		.removeAlpha()
		.resize(
			packet.normalizationAuthority.resize.width,
			packet.normalizationAuthority.resize.height,
			{
				fit: packet.normalizationAuthority.resize.fit,
				kernel: sharp.kernel.lanczos3,
				fastShrinkOnLoad: packet.normalizationAuthority.resize.fastShrinkOnLoad
			}
		)
		.ensureAlpha()
		.png({
			compressionLevel: packet.normalizationAuthority.encoder.compressionLevel,
			adaptiveFiltering: packet.normalizationAuthority.encoder.adaptiveFiltering,
			palette: packet.normalizationAuthority.encoder.palette,
			progressive: packet.normalizationAuthority.encoder.progressive
		})
		.toBuffer();
	const authorityBytes = (binding: { readonly path: string }): Buffer => {
		const absolutePath = path.resolve(root, binding.path);
		const bytes = authorityBindings.find(({ snapshot }) => snapshot.path === absolutePath)?.snapshot
			.bytes;
		if (!bytes) throw new Error(`Cleanup revision authority was not bound: ${binding.path}`);
		return bytes;
	};
	const backing = authorityBytes(packet.compositionAuthority.backing);
	const frame = authorityBytes(packet.compositionAuthority.frame);
	const interior = await extractLegacyInterior(normalizedCanvas, geometry);
	const composite = await clearCleanupExterior(
		await composeCleanupIcon({ backing, interior: interior.bytes, frame }),
		geometry
	);
	const automatedInspection = await inspectCleanupComposite({
		composite,
		backing,
		interior: interior.bytes,
		frame,
		geometry,
		boundLayerHashes: {
			backing: packet.compositionAuthority.backing.contentHash,
			interior: sha256(interior.bytes),
			frame: packet.compositionAuthority.frame.contentHash
		}
	});
	if (
		!automatedInspection.layerHashesMatch ||
		!automatedInspection.exactComposite ||
		!automatedInspection.protectedBandMatches ||
		!automatedInspection.exteriorTransparent
	) {
		throw new Error('Cleanup revision automated composition inspection failed');
	}
	const display384 = await sharp(composite)
		.resize(384, 384, { fit: 'fill' })
		.png({ compressionLevel: 9, adaptiveFiltering: false, palette: false })
		.toBuffer();
	await testHooks?.afterDerivation?.();

	const packetHash = sha256(packetSnapshot.bytes);
	const providerEvidence = {
		path: packet.output.providerSourcePath,
		...preparedProvider.source
	};
	const interiorEvidence = {
		...artifactEvidence(
			packet.output.revisedInteriorPath,
			interior.bytes,
			geometry.canvas.width,
			geometry.canvas.height
		),
		removedPixels: interior.removedPixels,
		removedPixelBounds: interior.removedPixelBounds
	};
	const compositeEvidence = artifactEvidence(
		packet.output.compositePath,
		composite,
		geometry.canvas.width,
		geometry.canvas.height
	);
	const display384Evidence = {
		mediaType: 'image/png' as const,
		width: 384,
		height: 384,
		bytes: display384.byteLength,
		contentHash: sha256(display384)
	};
	const inspection = {
		fullSize: {
			outcome: boundInput.fullSizeOutcome,
			observation: boundInput.fullSizeObservation
		},
		display384: {
			outcome: boundInput.display384Outcome,
			observation: boundInput.display384Observation
		}
	};
	const normalization = CleanupNormalizationEvidenceSchema.parse({
		profile: packet.normalizationAuthority.profile,
		sourceContentHash: providerEvidence.contentHash,
		decoderInputContentHash: preparedProvider.decoderInputContentHash,
		containerBox: preparedProvider.containerBox,
		colorSpaceDisposition: preparedProvider.colorSpaceDisposition,
		geometryContentHash: packet.compositionAuthority.geometry.contentHash,
		outputContentHash: interiorEvidence.contentHash
	});
	const transactionContentHash = sha256(
		jsonBytes({
			packet: packetHash,
			providerSource: providerEvidence.contentHash,
			normalization,
			revisedInterior: interiorEvidence.contentHash,
			compositionAuthority: packet.compositionAuthority,
			composite: compositeEvidence.contentHash,
			display384: display384Evidence.contentHash,
			inspection,
			attemptCount: boundInput.attemptCount,
			output: packet.output
		})
	);
	const result = CleanupRevisionResultSchema.parse({
		schemaVersion: 'skill-icon-quality-cleanup-revision-result-v1',
		status:
			boundInput.fullSizeOutcome === 'pass' && boundInput.display384Outcome === 'pass'
				? 'candidate'
				: 'revise',
		targetId: packet.targetId,
		name: packet.name,
		rank: packet.rank,
		motifFamily: packet.motifFamily,
		finding: packet.finding,
		revisionPacket: { path: boundInput.packetPath, contentHash: packetHash },
		cleanupManifest: packet.cleanupManifest,
		sourceCandidate: packet.sourceCandidate,
		currentCandidate: packet.currentCandidate,
		currentResult: packet.currentResult,
		exactPrompt: packet.exactPrompt,
		exactPromptHash: packet.exactPromptHash,
		references: packet.references,
		providerEnvelope: packet.providerEnvelope,
		normalizationAuthority: packet.normalizationAuthority,
		providerSource: providerEvidence,
		revisedInterior: interiorEvidence,
		normalization,
		compositionAuthority: packet.compositionAuthority,
		composite: compositeEvidence,
		display384: display384Evidence,
		automatedInspection,
		inspection,
		attemptCount: boundInput.attemptCount,
		attemptCeiling: packet.attempts.maximum,
		transactionContentHash,
		resultPath: packet.output.resultPath,
		writtenOutputPaths: Object.values(packet.output),
		completionContract: {
			sharedFilesRemainUntouched: true,
			selfPromotionForbidden: true
		}
	});
	const outputBytes = [
		{ repositoryPath: packet.output.providerSourcePath, bytes: sourceSnapshot.bytes },
		{ repositoryPath: packet.output.revisedInteriorPath, bytes: interior.bytes },
		{ repositoryPath: packet.output.compositePath, bytes: composite },
		{ repositoryPath: packet.output.resultPath, bytes: jsonBytes(result) }
	] as const;
	const staged: StagedOutput[] = [];
	try {
		for (const output of outputBytes) {
			staged.push(await stageOutput(root, output.repositoryPath, output.bytes));
		}
		await testHooks?.afterStage?.();
		await Promise.all([
			assertAuthoritiesUnchanged(authorityBindings),
			assertSnapshotUnchanged(sourceSnapshot, 'Cleanup revision provider source')
		]);
		for (const [index, output] of staged.entries()) {
			await publishStaged(output);
			await testHooks?.afterPublish?.(index, output.repositoryPath);
			await assertAllHeldParentsNamed(staged);
		}
		await Promise.all([
			assertAuthoritiesUnchanged(authorityBindings),
			assertSnapshotUnchanged(sourceSnapshot, 'Cleanup revision provider source')
		]);
		await assertAllHeldParentsNamed(staged);
		for (const output of staged) {
			await assertOwnedPath(
				heldChild(output.parent, path.basename(output.destination)),
				output,
				'Cleanup revision output'
			);
			const persistedBytes = await readFile(
				heldChild(output.parent, path.basename(output.destination))
			);
			if (!persistedBytes.equals(output.bytes)) {
				throw new Error(`Cleanup revision output bytes changed: ${output.repositoryPath}`);
			}
		}
		for (const output of staged) {
			await removeOwnedPath(output.temporaryPath, output);
		}
		await assertAllHeldParentsNamed(staged);
		return result;
	} catch (error) {
		try {
			await cleanupTransaction(staged, testHooks?.beforeRollbackDetach);
		} catch (cleanupError) {
			throw new AggregateError(
				[error, cleanupError],
				'Cleanup revision persistence failed and safe rollback was incomplete',
				{ cause: cleanupError }
			);
		}
		throw error;
	} finally {
		await Promise.all(staged.map(({ parent }) => parent.handle.close().catch(() => undefined)));
	}
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	let request: PersistCleanupRevisionCliRequest;
	try {
		request = parsePersistCleanupRevisionCliRequest(process.argv.slice(2));
	} catch (error) {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
		request = undefined as never;
	}
	if (request) {
		persistCleanupRevision(request)
			.then((result) => process.stdout.write(`${JSON.stringify(result)}\n`))
			.catch((error: unknown) => {
				process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
				process.exitCode = 1;
			});
	}
}
