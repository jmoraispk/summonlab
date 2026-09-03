import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises';
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

export interface PersistSkillIconOutputOptions {
	readonly sourcePath: string;
	readonly candidatePath: string;
	readonly expectedRole: SkillIconRole;
	readonly geometry: SkillIconGeometry;
	readonly geometrySourceBytes?: Buffer;
}

export interface PersistSkillIconOutputDependencies {
	readonly now?: () => Date;
}

export interface PersistSkillIconOutputBoundOptions extends PersistSkillIconOutputOptions {
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

async function persistenceParentFingerprint(
	destination: string
): Promise<OwnedPersistedFile['parent']> {
	const parent = path.dirname(destination);
	const [realPath, metadata] = await Promise.all([realpath(parent), lstat(parent)]);
	if (metadata.isSymbolicLink() || !metadata.isDirectory())
		throw new Error(`Persistence parent identity is unsafe: ${parent}`);
	return { realPath, device: metadata.dev, inode: metadata.ino };
}

async function removeOwnedPersistedFile(owned: OwnedPersistedFile): Promise<void> {
	const currentParent = await persistenceParentFingerprint(owned.path);
	if (
		currentParent.realPath !== owned.parent.realPath ||
		currentParent.device !== owned.parent.device ||
		currentParent.inode !== owned.parent.inode
	)
		throw new Error(`Persistence parent identity changed; cleanup required: ${owned.path}`);
	const metadata = await metadataOrNull(owned.path);
	if (!metadata) return;
	if (
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== owned.file.device ||
		metadata.ino !== owned.file.inode
	)
		throw new Error(`Persistence file identity changed; cleanup required: ${owned.path}`);
	const handle = await open(owned.path, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		const opened = await handle.stat();
		if (opened.dev !== owned.file.device || opened.ino !== owned.file.inode)
			throw new Error(`Persistence file changed while opening; cleanup required: ${owned.path}`);
	} finally {
		await handle.close();
	}
	const immediatelyBefore = await lstat(owned.path);
	const parentImmediatelyBefore = await persistenceParentFingerprint(owned.path);
	if (
		immediatelyBefore.isSymbolicLink() ||
		!immediatelyBefore.isFile() ||
		immediatelyBefore.dev !== owned.file.device ||
		immediatelyBefore.ino !== owned.file.inode ||
		parentImmediatelyBefore.realPath !== owned.parent.realPath ||
		parentImmediatelyBefore.device !== owned.parent.device ||
		parentImmediatelyBefore.inode !== owned.parent.inode
	)
		throw new Error(`Persistence file changed before unlink; cleanup required: ${owned.path}`);
	await unlink(owned.path);
	const parentHandle = await open(
		path.dirname(owned.path),
		constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
	);
	try {
		await parentHandle.sync();
	} finally {
		await parentHandle.close();
	}
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

async function readSafePacket(
	root: string,
	relativePath: string,
	description: string
): Promise<Buffer> {
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
	if (!inside(realRoot, await realpath(path.dirname(absolute))))
		throw new Error(`${description} parent escaped real workspace root`);
	const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		if (!(await handle.stat()).isFile()) throw new Error(`${description} must be a regular file`);
		return await handle.readFile();
	} finally {
		await handle.close();
	}
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

export async function persistSkillIconOutputBound(
	options: PersistSkillIconOutputBoundOptions
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
	await ensureSafeParents(root, destination);
	let destinationHandle: Awaited<ReturnType<typeof open>> | undefined;
	let resultHandle: Awaited<ReturnType<typeof open>> | undefined;
	let candidateOwnership: OwnedPersistedFile | undefined;
	let resultOwnership: OwnedPersistedFile | undefined;
	try {
		const candidateParent = await persistenceParentFingerprint(destination);
		destinationHandle = await open(
			destination,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o644
		);
		const candidateFile = await destinationHandle.stat();
		candidateOwnership = {
			path: destination,
			parent: candidateParent,
			file: { device: candidateFile.dev, inode: candidateFile.ino }
		};
		await options.testHooks?.afterCandidateOpen?.();
		await destinationHandle.writeFile(candidateBytes);
		await destinationHandle.sync();
		await destinationHandle.close();
		destinationHandle = undefined;
		await ensureSafeParents(root, destination);
		const retainedParent = await persistenceParentFingerprint(destination);
		if (
			retainedParent.realPath !== candidateParent.realPath ||
			retainedParent.device !== candidateParent.device ||
			retainedParent.inode !== candidateParent.inode
		)
			throw new Error(`Candidate parent identity changed during persistence: ${candidatePath}`);
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
		await ensureSafeParents(root, resultDestination);
		const resultParent = await persistenceParentFingerprint(resultDestination);
		resultHandle = await open(
			resultDestination,
			constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
			0o644
		);
		const resultFile = await resultHandle.stat();
		resultOwnership = {
			path: resultDestination,
			parent: resultParent,
			file: { device: resultFile.dev, inode: resultFile.ino }
		};
		await options.testHooks?.afterResultOpen?.();
		await resultHandle.writeFile(resultBytes);
		await resultHandle.sync();
		await resultHandle.close();
		resultHandle = undefined;
		await ensureSafeParents(root, resultDestination);
		const retainedResultParent = await persistenceParentFingerprint(resultDestination);
		if (
			retainedResultParent.realPath !== resultParent.realPath ||
			retainedResultParent.device !== resultParent.device ||
			retainedResultParent.inode !== resultParent.inode
		)
			throw new Error(
				`Result parent identity changed during persistence: ${target.output.resultPath}`
			);
		const retainedResult = await readSafePacket(root, target.output.resultPath, 'Retained result');
		if (!retainedResult.equals(resultBytes))
			throw new Error('Result bytes changed during persistence');
		await assertOwnedPersistedFile(candidateOwnership, candidateBytes, 'Candidate');
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
		for (const handle of [destinationHandle, resultHandle]) {
			if (!handle) continue;
			try {
				await handle.close();
			} catch (cleanupError) {
				cleanupFailures.push(cleanupError);
			}
		}
		for (const owned of [candidateOwnership, resultOwnership]) {
			if (!owned) continue;
			try {
				await removeOwnedPersistedFile(owned);
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
	}
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
	const [target, assignment] = await Promise.all([
		readSafePacket(root, targetPath, 'Target').then((bytes) =>
			AnySkillIconTargetSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readSafePacket(root, assignmentPath, 'Assignment').then((bytes) =>
			AnySkillIconAssignmentSchema.parse(JSON.parse(bytes.toString('utf8')))
		)
	]);
	const geometrySourceBytes =
		target.schemaVersion === 'skill-icon-target-v2'
			? await readSafePacket(root, SKILL_ICON_GEOMETRY_PATH, 'Geometry')
			: undefined;
	const receivedAt = (dependencies.now?.() ?? new Date()).toISOString();
	return persistSkillIconOutputBound({
		...options,
		root,
		target,
		assignment,
		receivedAt,
		...(geometrySourceBytes === undefined ? {} : { geometrySourceBytes })
	});
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
	const [target, assignment, geometryBytes] = await Promise.all([
		readSafePacket(root, targetPath, 'Target').then((bytes) =>
			AnySkillIconTargetSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readSafePacket(root, assignmentPath, 'Assignment').then((bytes) =>
			AnySkillIconAssignmentSchema.parse(JSON.parse(bytes.toString('utf8')))
		),
		readSafePacket(root, SKILL_ICON_GEOMETRY_PATH, 'Geometry')
	]);
	const geometry = SkillIconGeometrySchema.parse(JSON.parse(geometryBytes.toString('utf8')));
	if (assignment.targetPath !== targetPath || assignment.assignmentPath !== assignmentPath)
		throw new Error('CLI target/assignment arguments do not match packet paths');
	const receipt = await persistSkillIconOutputBound({
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
	});
	process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
