import { randomUUID } from 'node:crypto';
import {
	link,
	lstat,
	mkdir,
	open,
	readdir,
	realpath,
	rename,
	unlink,
	type FileHandle
} from 'node:fs/promises';
import path from 'node:path';

import {
	AffinityWavePreflightV2Schema,
	canonicalJsonSha256,
	verifyCurrentWavePreflight,
	type AffinityWavePreflight
} from './affinity-wave-scheduler-lib.js';
import {
	AffinityWaveEventV3Schema,
	buildAffinityWaveEventV3,
	replayAffinityWaveJournalV3,
	type AffinityWaveEventV3,
	type AffinityWaveEventV3Clock,
	type AffinityWaveJournalContextV3
} from './affinity-wave-journal-v3.js';

const LOCK_NAME = '.journal-v3.lock';
const EVENT_DIRECTORY_NAME = 'events-v3';
const DEFAULT_LOCK_ACQUIRE_TIMEOUT_MS = 30_000;
const DEFAULT_STALE_LOCK_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 20;
const HASH_PATTERN = /^[a-f0-9]{64}$/u;

type PreflightV2 = Extract<AffinityWavePreflight, { schemaVersion: 'affinity-wave-preflight-v2' }>;

interface FileIdentity {
	readonly device: number;
	readonly inode: number;
}

interface LoadedPreflight {
	readonly preflight: PreflightV2;
	readonly canonicalSha256: string;
	readonly context: AffinityWaveJournalContextV3;
}

interface LockOwner {
	readonly schemaVersion: 'affinity-wave-journal-v3-lock-v1';
	readonly ownerId: string;
	readonly pid: number;
	readonly acquiredAt: string;
}

interface OwnedLock {
	readonly release: () => Promise<void>;
	readonly assertHealthy: () => void;
}

export interface AffinityWaveEventV3RecorderOptions {
	/** Reject a current preflight that differs from the caller's previously verified snapshot. */
	readonly expectedPreflightCanonicalSha256?: string;
	/** Recorder-authoritative clock; intended for deterministic tests. */
	readonly clock?: AffinityWaveEventV3Clock;
	readonly lockAcquireTimeoutMs?: number;
	readonly staleLockTimeoutMs?: number;
	readonly lockRetryDelayMs?: number;
	/** Dependency seam for isolated tests; production callers must use the default verifier. */
	readonly verifyCurrentPreflight?: typeof verifyCurrentWavePreflight;
}

function repositoryPath(workspaceRoot: string, value: string): string {
	if (
		path.posix.isAbsolute(value) ||
		value.includes('\\') ||
		value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
	)
		throw new Error(`Unsafe repository path: ${value}`);
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, value);
	if (!absolute.startsWith(`${root}${path.sep}`))
		throw new Error(`Repository path escapes workspace: ${value}`);
	return absolute;
}

async function assertWorkspaceRoot(workspaceRoot: string): Promise<string> {
	const root = path.resolve(workspaceRoot);
	const metadata = await lstat(root);
	if (metadata.isSymbolicLink() || !metadata.isDirectory())
		throw new Error('Workspace root must be a real directory, not a symbolic link');
	return root;
}

async function ensureSafeDirectory(workspaceRoot: string, directoryPath: string): Promise<string> {
	const root = await assertWorkspaceRoot(workspaceRoot);
	repositoryPath(root, directoryPath);
	let cursor = root;
	for (const segment of directoryPath.split('/')) {
		cursor = path.join(cursor, segment);
		let metadata;
		try {
			metadata = await lstat(cursor);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			try {
				await mkdir(cursor);
			} catch (mkdirError) {
				if ((mkdirError as NodeJS.ErrnoException).code !== 'EEXIST') throw mkdirError;
			}
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink())
			throw new Error(`Symlink is forbidden in repository path: ${directoryPath}`);
		if (!metadata.isDirectory())
			throw new Error(`Repository path component is not a directory: ${directoryPath}`);
	}
	return cursor;
}

async function readSafeRegularFile(workspaceRoot: string, filePath: string): Promise<Buffer> {
	const root = await assertWorkspaceRoot(workspaceRoot);
	const absolute = repositoryPath(root, filePath);
	let cursor = root;
	for (const segment of filePath.split('/')) {
		cursor = path.join(cursor, segment);
		const metadata = await lstat(cursor);
		if (metadata.isSymbolicLink()) throw new Error(`Symlink is forbidden: ${filePath}`);
		if (cursor !== absolute && !metadata.isDirectory())
			throw new Error(`Repository path ancestor is not a directory: ${filePath}`);
	}
	const metadata = await lstat(absolute);
	if (metadata.isSymbolicLink() || !metadata.isFile())
		throw new Error(`Expected a regular file: ${filePath}`);
	const [realRoot, realFile] = await Promise.all([realpath(root), realpath(absolute)]);
	if (!realFile.startsWith(`${realRoot}${path.sep}`))
		throw new Error(`Repository file resolves outside the workspace: ${filePath}`);
	const handle = await open(absolute, 'r');
	try {
		const openedMetadata = await handle.stat();
		const currentMetadata = await lstat(absolute);
		if (
			openedMetadata.isSymbolicLink() ||
			!openedMetadata.isFile() ||
			currentMetadata.isSymbolicLink() ||
			!sameIdentity(identityOf(openedMetadata), identityOf(currentMetadata))
		)
			throw new Error(`Repository file changed while it was opened: ${filePath}`);
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

function eventDirectory(preflight: PreflightV2): string {
	return `${preflight.runDirectory}/${EVENT_DIRECTORY_NAME}`;
}

function eventFileName(event: Pick<AffinityWaveEventV3, 'sequence' | 'eventId'>): string {
	return `${String(event.sequence).padStart(6, '0')}-${event.eventId}.json`;
}

async function loadCurrentPreflight(
	workspaceRoot: string,
	preflightPath: string,
	expectedCanonicalSha256?: string,
	verifyPreflight: typeof verifyCurrentWavePreflight = verifyCurrentWavePreflight
): Promise<LoadedPreflight> {
	if (expectedCanonicalSha256 !== undefined && !HASH_PATTERN.test(expectedCanonicalSha256))
		throw new Error('Expected preflight canonical hash must be a lowercase SHA-256 digest');
	const bytes = await readSafeRegularFile(workspaceRoot, preflightPath);
	const preflight = AffinityWavePreflightV2Schema.parse(JSON.parse(bytes.toString('utf8')));
	const verified = await verifyPreflight(workspaceRoot, preflight);
	if (verified.schemaVersion !== 'affinity-wave-preflight-v2')
		throw new Error('Event-v3 recording requires a verified v2 preflight');
	const canonicalPath = `${preflight.runDirectory}/preflight.json`;
	if (preflightPath !== canonicalPath)
		throw new Error(`Preflight must be read from its canonical path ${canonicalPath}`);
	if (preflight.status !== 'ready')
		throw new Error(`Wave events require a ready preflight; found ${preflight.status}`);
	if (preflight.admittedWorkerCapacity < 1)
		throw new Error('Wave event journal requires positive admitted worker capacity');
	const canonicalSha256 = canonicalJsonSha256(verified);
	if (expectedCanonicalSha256 !== undefined && expectedCanonicalSha256 !== canonicalSha256)
		throw new Error('Current preflight canonical hash differs from the expected snapshot');
	const context: AffinityWaveJournalContextV3 = {
		runId: verified.runId,
		preflightCanonicalSha256: canonicalSha256,
		targetIds: verified.jobs.map((job) => job.targetId),
		admittedWorkerCapacity: verified.admittedWorkerCapacity,
		technicalFailureLimit: verified.stopRules.capacityFailureLimit
	};
	return { preflight: verified, canonicalSha256, context };
}

async function readJournal(
	workspaceRoot: string,
	loaded: LoadedPreflight
): Promise<AffinityWaveEventV3[]> {
	const directoryPath = eventDirectory(loaded.preflight);
	const absoluteDirectory = await ensureSafeDirectory(workspaceRoot, directoryPath);
	const entries = (await readdir(absoluteDirectory, { withFileTypes: true })).sort((left, right) =>
		left.name.localeCompare(right.name)
	);
	const events: AffinityWaveEventV3[] = [];
	for (const entry of entries) {
		if (entry.isSymbolicLink())
			throw new Error(`Symlink is forbidden in wave event journal: ${entry.name}`);
		if (!entry.name.endsWith('.json')) continue;
		if (!entry.isFile()) throw new Error(`Wave event entry is not a regular file: ${entry.name}`);
		const entryPath = `${directoryPath}/${entry.name}`;
		const event = AffinityWaveEventV3Schema.parse(
			JSON.parse((await readSafeRegularFile(workspaceRoot, entryPath)).toString('utf8'))
		);
		if (entry.name !== eventFileName(event))
			throw new Error(
				`Wave event filename does not match its recorder-owned identity: ${entry.name}`
			);
		events.push(event);
	}
	return replayAffinityWaveJournalV3(loaded.context, events).ordered.slice();
}

function identityOf(metadata: { dev: number; ino: number }): FileIdentity {
	return { device: metadata.dev, inode: metadata.ino };
}

function sameIdentity(left: FileIdentity, right: FileIdentity): boolean {
	return left.device === right.device && left.inode === right.inode;
}

async function restoreMovedForeignFile(movedPath: string, originalPath: string): Promise<void> {
	try {
		await link(movedPath, originalPath);
		await unlink(movedPath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
	}
}

async function moveAndUnlinkOwned(
	filePath: string,
	expectedIdentity: FileIdentity,
	label: string
): Promise<void> {
	const movedPath = `${filePath}.${label}-${randomUUID()}`;
	await rename(filePath, movedPath);
	const movedIdentity = identityOf(await lstat(movedPath));
	if (!sameIdentity(movedIdentity, expectedIdentity)) {
		await restoreMovedForeignFile(movedPath, filePath);
		throw new Error(`${label} ownership changed before cleanup`);
	}
	await unlink(movedPath);
}

async function processIsAlive(pid: number): Promise<boolean> {
	if (!Number.isSafeInteger(pid) || pid < 1) return false;
	try {
		process.kill(pid, 0);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
		if ((error as NodeJS.ErrnoException).code === 'EPERM') return true;
		throw error;
	}
}

function positiveDuration(value: number | undefined, fallback: number, label: string): number {
	const resolved = value ?? fallback;
	if (!Number.isFinite(resolved) || resolved <= 0) throw new Error(`${label} must be positive`);
	return resolved;
}

async function inspectExistingLock(
	lockPath: string,
	staleAfterMs: number
): Promise<{
	readonly stale: boolean;
	readonly identity: FileIdentity;
}> {
	const pathMetadata = await lstat(lockPath);
	if (pathMetadata.isSymbolicLink() || !pathMetadata.isFile())
		throw new Error('Wave journal lock must be a regular, non-symlink file');
	const handle = await open(lockPath, 'r');
	try {
		const handleMetadata = await handle.stat();
		const identity = identityOf(handleMetadata);
		if (!sameIdentity(identity, identityOf(pathMetadata)))
			throw new Error('Wave journal lock changed while it was inspected');
		let owner: LockOwner | undefined;
		try {
			owner = JSON.parse(await handle.readFile('utf8')) as LockOwner;
		} catch {
			owner = undefined;
		}
		const expired = Date.now() - handleMetadata.mtimeMs >= staleAfterMs;
		const ownerDead = owner === undefined ? false : !(await processIsAlive(owner.pid));
		return { stale: expired || ownerDead, identity };
	} finally {
		await handle.close();
	}
}

async function acquireRunLock(
	workspaceRoot: string,
	directoryPath: string,
	options: AffinityWaveEventV3RecorderOptions
): Promise<OwnedLock> {
	const directory = await ensureSafeDirectory(workspaceRoot, directoryPath);
	const lockPath = path.join(directory, LOCK_NAME);
	const acquireTimeoutMs = positiveDuration(
		options.lockAcquireTimeoutMs,
		DEFAULT_LOCK_ACQUIRE_TIMEOUT_MS,
		'lockAcquireTimeoutMs'
	);
	const staleAfterMs = positiveDuration(
		options.staleLockTimeoutMs,
		DEFAULT_STALE_LOCK_TIMEOUT_MS,
		'staleLockTimeoutMs'
	);
	const retryDelayMs = positiveDuration(
		options.lockRetryDelayMs,
		DEFAULT_LOCK_RETRY_DELAY_MS,
		'lockRetryDelayMs'
	);
	const deadline = Date.now() + acquireTimeoutMs;
	const owner: LockOwner = {
		schemaVersion: 'affinity-wave-journal-v3-lock-v1',
		ownerId: randomUUID(),
		pid: process.pid,
		acquiredAt: new Date().toISOString()
	};
	for (;;) {
		let handle: FileHandle | undefined;
		let createdIdentity: FileIdentity | undefined;
		try {
			await ensureSafeDirectory(workspaceRoot, directoryPath);
			handle = await open(lockPath, 'wx');
			createdIdentity = identityOf(await handle.stat());
			await handle.writeFile(`${JSON.stringify(owner)}\n`, 'utf8');
			await handle.sync();
			const identity = createdIdentity;
			let heartbeatError: unknown;
			const heartbeatIntervalMs = Math.max(10, Math.floor(staleAfterMs / 3));
			const heartbeat = setInterval(() => {
				const now = new Date();
				void handle?.utimes(now, now).catch((error: unknown) => {
					heartbeatError = error;
				});
			}, heartbeatIntervalMs);
			heartbeat.unref();
			return {
				assertHealthy: () => {
					if (heartbeatError !== undefined)
						throw new Error('Wave journal lock heartbeat failed', { cause: heartbeatError });
				},
				release: async () => {
					clearInterval(heartbeat);
					await handle?.close();
					handle = undefined;
					await moveAndUnlinkOwned(lockPath, identity, 'lock-release');
				}
			};
		} catch (error) {
			await handle?.close().catch(() => undefined);
			if (createdIdentity)
				await moveAndUnlinkOwned(lockPath, createdIdentity, 'failed-lock').catch(() => undefined);
			if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
		}

		try {
			const existing = await inspectExistingLock(lockPath, staleAfterMs);
			if (existing.stale) {
				await moveAndUnlinkOwned(lockPath, existing.identity, 'stale-lock');
				continue;
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
			continue;
		}
		if (Date.now() >= deadline) throw new Error('Timed out waiting for the wave journal lock');
		await new Promise<void>((resolve) => setTimeout(resolve, retryDelayMs));
	}
}

async function writeEventExclusive(
	workspaceRoot: string,
	repositoryEventPath: string,
	event: AffinityWaveEventV3
): Promise<FileIdentity> {
	const absolute = repositoryPath(workspaceRoot, repositoryEventPath);
	let handle: FileHandle | undefined;
	let identity: FileIdentity | undefined;
	try {
		handle = await open(absolute, 'wx');
		identity = identityOf(await handle.stat());
		await handle.writeFile(`${JSON.stringify(event, null, '\t')}\n`, 'utf8');
		await handle.sync();
		await handle.close();
		handle = undefined;
		return identity;
	} catch (error) {
		await handle?.close().catch(() => undefined);
		if (identity)
			await moveAndUnlinkOwned(absolute, identity, 'failed-event').catch(() => undefined);
		throw error;
	}
}

/**
 * Appends one recorder-owned v3 event to the current v2 preflight's isolated journal.
 * The returned path is repository-relative and is never overwritten.
 */
export async function recordAffinityWaveEventV3(
	workspaceRoot: string,
	preflightPath: string,
	requestInput: unknown,
	options: AffinityWaveEventV3RecorderOptions = {}
): Promise<string> {
	await assertWorkspaceRoot(workspaceRoot);
	repositoryPath(workspaceRoot, preflightPath);
	const initial = await loadCurrentPreflight(
		workspaceRoot,
		preflightPath,
		options.expectedPreflightCanonicalSha256,
		options.verifyCurrentPreflight
	);
	const directoryPath = eventDirectory(initial.preflight);
	const lock = await acquireRunLock(workspaceRoot, directoryPath, options);
	try {
		const loaded = await loadCurrentPreflight(
			workspaceRoot,
			preflightPath,
			options.expectedPreflightCanonicalSha256 ?? initial.canonicalSha256,
			options.verifyCurrentPreflight
		);
		const prior = await readJournal(workspaceRoot, loaded);
		const event = buildAffinityWaveEventV3(
			loaded.context,
			prior,
			requestInput,
			options.clock ?? { now: () => new Date() }
		);
		const eventPath = `${directoryPath}/${eventFileName(event)}`;
		lock.assertHealthy();
		const identity = await writeEventExclusive(workspaceRoot, eventPath, event);
		try {
			const current = await loadCurrentPreflight(
				workspaceRoot,
				preflightPath,
				loaded.canonicalSha256,
				options.verifyCurrentPreflight
			);
			if (eventDirectory(current.preflight) !== directoryPath)
				throw new Error('Current preflight changed its event journal directory');
			const validated = await readJournal(workspaceRoot, current);
			const persisted = validated[event.sequence];
			if (!persisted || canonicalJsonSha256(persisted) !== canonicalJsonSha256(event))
				throw new Error('Postwrite validation did not recover the transaction event');
			lock.assertHealthy();
			return eventPath;
		} catch (error) {
			await moveAndUnlinkOwned(
				repositoryPath(workspaceRoot, eventPath),
				identity,
				'event-rollback'
			);
			throw error;
		}
	} finally {
		await lock.release();
	}
}

export async function readAffinityWaveEventsV3(
	workspaceRoot: string,
	preflightPath: string,
	options: Pick<AffinityWaveEventV3RecorderOptions, 'verifyCurrentPreflight'> = {}
): Promise<readonly AffinityWaveEventV3[]> {
	const loaded = await loadCurrentPreflight(
		workspaceRoot,
		preflightPath,
		undefined,
		options.verifyCurrentPreflight
	);
	return readJournal(workspaceRoot, loaded);
}
