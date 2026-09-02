import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import {
	EquipmentImageAssignmentSchema,
	EquipmentImageTargetSchema,
	EquipmentRunActivationSchema,
	EquipmentRunEventRequestSchema,
	EquipmentRunEventSchema,
	EquipmentRunPlanSchema,
	EQUIPMENT_PRODUCTION_ROOT,
	type EquipmentRunActivation,
	type EquipmentRunEvent,
	type EquipmentRunEventRequest,
	type EquipmentRunPlan
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';
import { readEquipmentRepositoryJson } from './equipment-image-result.js';
import {
	replayEquipmentRunJournal,
	type EquipmentRunJournalContext,
	type EquipmentRunJournalState
} from './equipment-image-run-journal.js';
import { buildEquipmentRunPlan } from './equipment-image-run-readiness.js';

const DEFAULT_STALE_LOCK_AFTER_MS = 5 * 60 * 1_000;
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 2_000;
const LOCK_RETRY_INTERVAL_MS = 10;

interface FileIdentity {
	readonly device: number;
	readonly inode: number;
}

interface JournalLockEvidence {
	readonly ownerId: string;
	readonly processId: number;
	readonly acquiredAt: string;
}

export interface EquipmentRunRecorderTestHooks {
	readonly afterStaleMainLockRemoved?: () => void | Promise<void>;
	readonly beforePacketResolution?: (input: {
		readonly index: number;
		readonly targetId: string;
	}) => void | Promise<void>;
	readonly afterEventFileCreated?: (input: {
		readonly event: EquipmentRunEvent;
		readonly eventPath: string;
	}) => void | Promise<void>;
}

interface RecorderLockOptions {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly lockOwnerId: string;
	readonly processId?: number;
	readonly now?: () => Date;
	readonly staleLockAfterMs?: number;
	readonly lockWaitTimeoutMs?: number;
	readonly testHooks?: EquipmentRunRecorderTestHooks;
}

export interface RecordEquipmentRunEventOptions extends RecorderLockOptions {
	readonly request: unknown;
	readonly recordedAt: string;
}

export interface ClaimNextEquipmentJobsOptions extends RecorderLockOptions {
	readonly availableWorkerSlots: number;
	readonly epochId: string;
	readonly actor: string;
	readonly requestedAt: string;
	readonly recordedAt: string;
	readonly unrelatedTaskMetadata?: unknown;
}

export interface EquipmentJobClaim {
	readonly claimId: string;
	readonly workerId: string;
	readonly targetId: string;
	readonly targetPath: string;
	readonly targetCanonicalSha256: string;
	readonly assignmentPath: string;
	readonly assignmentCanonicalSha256: string;
	readonly eventPath: string;
	readonly event: EquipmentRunEvent;
}

interface VerifiedRunEvidence {
	readonly plan: EquipmentRunPlan;
	readonly activation: EquipmentRunActivation;
	readonly planCanonicalSha256: string;
	readonly activationCanonicalSha256: string;
	readonly context: EquipmentRunJournalContext;
}

function runPaths(runId: string) {
	const runDirectory = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${runId}`;
	return {
		runDirectory,
		planPath: `${runDirectory}/plan.json`,
		activationPath: `${runDirectory}/activation.json`,
		eventsDirectory: `${runDirectory}/events`,
		lockPath: `${runDirectory}/.journal.lock`,
		recoveryGuardPath: `${runDirectory}/.journal-lock-recovery.guard`
	};
}

function repositoryAbsolute(workspaceRoot: string, repositoryPath: string): string {
	if (
		path.posix.isAbsolute(repositoryPath) ||
		repositoryPath.includes('\\') ||
		repositoryPath
			.split('/')
			.some((component) => component === '' || component === '.' || component === '..')
	) {
		throw new Error(`Invalid repository-relative POSIX path: ${repositoryPath}`);
	}
	const root = path.resolve(workspaceRoot);
	const absolute = path.resolve(root, ...repositoryPath.split('/'));
	if (absolute === root || !absolute.startsWith(`${root}${path.sep}`)) {
		throw new Error(`Repository path escapes the workspace root: ${repositoryPath}`);
	}
	return absolute;
}

async function pathStateWithoutFollowing(
	workspaceRoot: string,
	repositoryPath: string
): Promise<'absent' | 'file' | 'directory'> {
	const root = path.resolve(workspaceRoot);
	const rootMetadata = await lstat(root);
	if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
		throw new Error('Workspace root must be a real directory, not a symbolic link');
	}
	let cursor = root;
	for (const [index, component] of repositoryPath.split('/').entries()) {
		cursor = path.join(cursor, component);
		const metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (metadata === null) return 'absent';
		if (metadata.isSymbolicLink()) {
			throw new Error(`Equipment journal paths refuse symbolic links: ${repositoryPath}`);
		}
		const final = index === repositoryPath.split('/').length - 1;
		if (!final && !metadata.isDirectory()) {
			throw new Error(`Equipment journal ancestor must be a directory: ${repositoryPath}`);
		}
		if (final) {
			if (metadata.isFile()) return 'file';
			if (metadata.isDirectory()) return 'directory';
			throw new Error(`Equipment journal path has an unsupported file type: ${repositoryPath}`);
		}
	}
	return 'absent';
}

async function ensureRealDirectory(workspaceRoot: string, repositoryPath: string): Promise<void> {
	const state = await pathStateWithoutFollowing(workspaceRoot, repositoryPath);
	if (state === 'directory') return;
	if (state !== 'absent')
		throw new Error(`Equipment journal directory is not a directory: ${repositoryPath}`);
	try {
		await mkdir(repositoryAbsolute(workspaceRoot, repositoryPath));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
	}
	if ((await pathStateWithoutFollowing(workspaceRoot, repositoryPath)) !== 'directory') {
		throw new Error(`Equipment journal directory was replaced or redirected: ${repositoryPath}`);
	}
}

function parseLockEvidence(value: unknown): JournalLockEvidence {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Equipment journal lock evidence is invalid');
	}
	const record = value as Record<string, unknown>;
	if (
		Object.keys(record).sort().join(',') !== 'acquiredAt,ownerId,processId' ||
		typeof record.ownerId !== 'string' ||
		record.ownerId.trim().length === 0 ||
		typeof record.processId !== 'number' ||
		!Number.isSafeInteger(record.processId) ||
		record.processId <= 0 ||
		typeof record.acquiredAt !== 'string' ||
		!Number.isFinite(Date.parse(record.acquiredAt))
	) {
		throw new Error('Equipment journal lock evidence is invalid');
	}
	return {
		ownerId: record.ownerId,
		processId: record.processId,
		acquiredAt: record.acquiredAt
	};
}

function isProcessAlive(processId: number): boolean {
	try {
		process.kill(processId, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== 'ESRCH';
	}
}

async function readLock(
	workspaceRoot: string,
	lockPath: string
): Promise<{ evidence: JournalLockEvidence; identity: FileIdentity } | null> {
	const state = await pathStateWithoutFollowing(workspaceRoot, lockPath);
	if (state === 'absent') return null;
	if (state !== 'file') {
		throw new Error('Equipment journal lock collision is not a regular file');
	}
	const handle = await open(
		repositoryAbsolute(workspaceRoot, lockPath),
		fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
	).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (handle === null) return null;
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile()) throw new Error('Equipment journal lock must be a regular file');
		const contents = await handle.readFile('utf8');
		let parsed: unknown;
		try {
			parsed = JSON.parse(contents) as unknown;
		} catch (error) {
			throw new Error('Equipment journal lock evidence is invalid JSON', { cause: error });
		}
		return {
			evidence: parseLockEvidence(parsed),
			identity: { device: metadata.dev, inode: metadata.ino }
		};
	} finally {
		await handle.close();
	}
}

function lockIsStale(evidence: JournalLockEvidence, now: Date, staleLockAfterMs: number): boolean {
	return (
		now.getTime() - Date.parse(evidence.acquiredAt) >= staleLockAfterMs &&
		!isProcessAlive(evidence.processId)
	);
}

async function waitForLockRetry(input: {
	readonly waitStartedAt: number;
	readonly lockWaitTimeoutMs: number;
	readonly timeoutMessage: string;
}): Promise<void> {
	if (Date.now() - input.waitStartedAt >= input.lockWaitTimeoutMs) {
		throw new Error(input.timeoutMessage);
	}
	await new Promise<void>((resolve) => {
		setTimeout(resolve, LOCK_RETRY_INTERVAL_MS);
	});
}

async function createOwnedLockFile(input: {
	readonly workspaceRoot: string;
	readonly repositoryPath: string;
	readonly evidence: JournalLockEvidence;
}): Promise<{ identity: FileIdentity; path: string } | null> {
	let handle;
	try {
		handle = await open(repositoryAbsolute(input.workspaceRoot, input.repositoryPath), 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null;
		throw error;
	}
	const metadata = await handle.stat();
	const identity = { device: metadata.dev, inode: metadata.ino };
	try {
		await handle.writeFile(`${JSON.stringify(input.evidence, null, '\t')}\n`, 'utf8');
		await handle.sync();
		await handle.close();
		return { identity, path: input.repositoryPath };
	} catch (error) {
		await handle.close().catch(() => undefined);
		if (!(await unlinkIfIdentityMatches(input.workspaceRoot, input.repositoryPath, identity))) {
			throw new Error(`Owned Equipment lock could not be safely cleaned: ${input.repositoryPath}`, {
				cause: error
			});
		}
		throw error;
	}
}

async function recoverStaleMainLock(input: {
	readonly options: RecorderLockOptions;
	readonly paths: ReturnType<typeof runPaths>;
	readonly evidence: JournalLockEvidence;
	readonly staleLockAfterMs: number;
}): Promise<boolean> {
	if (
		(await pathStateWithoutFollowing(input.options.workspaceRoot, input.paths.runDirectory)) !==
		'directory'
	) {
		throw new Error('Equipment run directory must be a verified real directory');
	}
	const guard = await createOwnedLockFile({
		workspaceRoot: input.options.workspaceRoot,
		repositoryPath: input.paths.recoveryGuardPath,
		evidence: input.evidence
	});
	if (guard === null) return false;
	let recoverySucceeded = false;
	let recoveryError: unknown;
	try {
		const current = await readLock(input.options.workspaceRoot, input.paths.lockPath);
		if (
			current !== null &&
			lockIsStale(current.evidence, input.options.now?.() ?? new Date(), input.staleLockAfterMs)
		) {
			if (
				!(await unlinkIfIdentityMatches(
					input.options.workspaceRoot,
					input.paths.lockPath,
					current.identity
				))
			) {
				throw new Error('Stale Equipment journal lock changed during guarded recovery');
			}
			await input.options.testHooks?.afterStaleMainLockRemoved?.();
		}
		recoverySucceeded = true;
	} catch (error) {
		recoveryError = error;
	}
	if (!(await unlinkIfIdentityMatches(input.options.workspaceRoot, guard.path, guard.identity))) {
		throw new Error('Equipment journal recovery guard changed before owned release', {
			cause: recoveryError
		});
	}
	if (!recoverySucceeded) throw recoveryError;
	return true;
}

async function unlinkIfIdentityMatches(
	workspaceRoot: string,
	repositoryPath: string,
	identity: FileIdentity
): Promise<boolean> {
	const metadata = await lstat(repositoryAbsolute(workspaceRoot, repositoryPath)).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	);
	if (
		metadata === null ||
		metadata.isSymbolicLink() ||
		!metadata.isFile() ||
		metadata.dev !== identity.device ||
		metadata.ino !== identity.inode
	) {
		return false;
	}
	await unlink(repositoryAbsolute(workspaceRoot, repositoryPath));
	return true;
}

async function acquireRunLock(options: RecorderLockOptions): Promise<{
	readonly identity: FileIdentity;
	readonly lockPath: string;
}> {
	const paths = runPaths(options.runId);
	const processId = options.processId ?? process.pid;
	const now = options.now ?? (() => new Date());
	const staleLockAfterMs = options.staleLockAfterMs ?? DEFAULT_STALE_LOCK_AFTER_MS;
	const lockWaitTimeoutMs = options.lockWaitTimeoutMs ?? DEFAULT_LOCK_WAIT_TIMEOUT_MS;
	if (staleLockAfterMs < 0 || lockWaitTimeoutMs < 0) {
		throw new Error('Equipment journal lock durations must be nonnegative');
	}
	const waitStartedAt = Date.now();
	while (true) {
		if (
			(await pathStateWithoutFollowing(options.workspaceRoot, paths.runDirectory)) !== 'directory'
		) {
			throw new Error('Equipment run directory must be a verified real directory');
		}
		const guardState = await pathStateWithoutFollowing(
			options.workspaceRoot,
			paths.recoveryGuardPath
		);
		if (guardState !== 'absent') {
			if (guardState !== 'file') {
				throw new Error('Equipment journal recovery guard must be a regular file');
			}
			await waitForLockRetry({
				waitStartedAt,
				lockWaitTimeoutMs,
				timeoutMessage: 'Equipment journal recovery guard requires operator resolution'
			});
			continue;
		}
		const owned = await createOwnedLockFile({
			workspaceRoot: options.workspaceRoot,
			repositoryPath: paths.lockPath,
			evidence: {
				ownerId: options.lockOwnerId,
				processId,
				acquiredAt: now().toISOString()
			}
		});
		if (owned !== null) return { identity: owned.identity, lockPath: owned.path };

		let existing;
		try {
			existing = await readLock(options.workspaceRoot, paths.lockPath);
		} catch (error) {
			await waitForLockRetry({
				waitStartedAt,
				lockWaitTimeoutMs,
				timeoutMessage: `Equipment journal lock could not be verified: ${error instanceof Error ? error.message : String(error)}`
			});
			continue;
		}
		if (existing === null) continue;
		if (lockIsStale(existing.evidence, now(), staleLockAfterMs)) {
			if (
				await recoverStaleMainLock({
					options,
					paths,
					evidence: {
						ownerId: options.lockOwnerId,
						processId,
						acquiredAt: now().toISOString()
					},
					staleLockAfterMs
				})
			) {
				continue;
			}
		}
		await waitForLockRetry({
			waitStartedAt,
			lockWaitTimeoutMs,
			timeoutMessage: `Live Equipment journal lock is owned by ${existing.evidence.ownerId} (process ${existing.evidence.processId})`
		});
	}
}

export function buildEquipmentRunJournalContext(
	plan: EquipmentRunPlan,
	activation: EquipmentRunActivation
): EquipmentRunJournalContext {
	const planCanonicalSha256 = canonicalJsonSha256(plan);
	if (
		activation.runId !== plan.runId ||
		activation.runPlanCanonicalSha256 !== planCanonicalSha256
	) {
		throw new Error('Run activation does not hash-bind the immutable Equipment run plan');
	}
	return {
		runId: plan.runId,
		runPlanCanonicalSha256: planCanonicalSha256,
		maximumConcurrency: plan.maximumConcurrency,
		productionPriorityTargetIds: plan.targetIds,
		initiallyReadyTargetIds: plan.rootPackets.map(({ targetId }) => targetId),
		reviewGates: plan.reviewGates.map(({ gateId, sourceTargetId, unlocksTargetIds }) => ({
			gateId,
			sourceTargetId,
			unlocksTargetIds
		}))
	};
}

async function loadVerifiedRunEvidence(
	workspaceRoot: string,
	runId: string
): Promise<VerifiedRunEvidence> {
	const paths = runPaths(runId);
	const plan = EquipmentRunPlanSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, paths.planPath)
	);
	if (plan.runId !== runId) throw new Error('Persisted immutable plan belongs to another run');
	const expectedPlan = await buildEquipmentRunPlan({
		workspaceRoot,
		runId,
		createdAt: plan.createdAt
	});
	const planCanonicalSha256 = canonicalJsonSha256(plan);
	if (planCanonicalSha256 !== canonicalJsonSha256(expectedPlan)) {
		throw new Error('Persisted immutable Equipment run plan changed or is stale');
	}
	const activation = EquipmentRunActivationSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, paths.activationPath)
	);
	const context = buildEquipmentRunJournalContext(plan, activation);
	return {
		plan,
		activation,
		planCanonicalSha256,
		activationCanonicalSha256: canonicalJsonSha256(activation),
		context
	};
}

async function assertRunEvidenceUnchanged(
	workspaceRoot: string,
	evidence: VerifiedRunEvidence
): Promise<void> {
	const paths = runPaths(evidence.plan.runId);
	const plan = EquipmentRunPlanSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, paths.planPath)
	);
	const activation = EquipmentRunActivationSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, paths.activationPath)
	);
	if (
		canonicalJsonSha256(plan) !== evidence.planCanonicalSha256 ||
		canonicalJsonSha256(activation) !== evidence.activationCanonicalSha256 ||
		activation.runId !== plan.runId ||
		activation.runPlanCanonicalSha256 !== canonicalJsonSha256(plan)
	) {
		throw new Error('Immutable Equipment run plan or activation changed under the journal lock');
	}
}

function eventFileName(event: EquipmentRunEvent): string {
	return `${String(event.sequence).padStart(6, '0')}-${event.request.eventId}.json`;
}

async function readEvents(
	workspaceRoot: string,
	evidence: VerifiedRunEvidence
): Promise<EquipmentRunEvent[]> {
	const paths = runPaths(evidence.plan.runId);
	const state = await pathStateWithoutFollowing(workspaceRoot, paths.eventsDirectory);
	if (state === 'absent') return [];
	if (state !== 'directory') throw new Error('Equipment event journal is not a directory');
	const names = (await readdir(repositoryAbsolute(workspaceRoot, paths.eventsDirectory))).sort();
	const events: EquipmentRunEvent[] = [];
	for (const name of names) {
		const match = /^(\d{6})-([a-z][a-z0-9-]{1,119})\.json$/u.exec(name);
		if (match === null) throw new Error(`Unexpected Equipment journal entry: ${name}`);
		const repositoryPath = `${paths.eventsDirectory}/${name}`;
		const event = EquipmentRunEventSchema.parse(
			await readEquipmentRepositoryJson(workspaceRoot, repositoryPath)
		);
		if (Number(match[1]) !== event.sequence || match[2] !== event.request.eventId) {
			throw new Error(`Equipment event filename does not bind its event: ${name}`);
		}
		events.push(event);
	}
	return replayEquipmentRunJournal(evidence.context, events).orderedEvents.slice();
}

async function exclusiveCreateEvent(input: {
	readonly workspaceRoot: string;
	readonly eventsDirectory: string;
	readonly event: EquipmentRunEvent;
	readonly testHooks?: EquipmentRunRecorderTestHooks | undefined;
}): Promise<string> {
	await ensureRealDirectory(input.workspaceRoot, input.eventsDirectory);
	const eventPath = `${input.eventsDirectory}/${eventFileName(input.event)}`;
	let handle;
	try {
		handle = await open(repositoryAbsolute(input.workspaceRoot, eventPath), 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`Exclusive Equipment event creation collided: ${eventPath}`, {
				cause: error
			});
		}
		throw error;
	}
	const metadata = await handle.stat();
	const identity = { device: metadata.dev, inode: metadata.ino };
	try {
		await input.testHooks?.afterEventFileCreated?.({ event: input.event, eventPath });
		await handle.writeFile(`${JSON.stringify(input.event, null, '\t')}\n`, 'utf8');
		await handle.sync();
		await handle.close();
	} catch (error) {
		await handle.close().catch(() => undefined);
		if (!(await unlinkIfIdentityMatches(input.workspaceRoot, eventPath, identity))) {
			throw new Error(`Incomplete Equipment event could not be safely cleaned: ${eventPath}`, {
				cause: error
			});
		}
		throw error;
	}
	return eventPath;
}

async function appendEventUnderLock(input: {
	readonly workspaceRoot: string;
	readonly evidence: VerifiedRunEvidence;
	readonly request: unknown;
	readonly recordedAt: string;
	readonly testHooks?: EquipmentRunRecorderTestHooks | undefined;
}): Promise<{ event: EquipmentRunEvent; eventPath: string; state: EquipmentRunJournalState }> {
	await assertRunEvidenceUnchanged(input.workspaceRoot, input.evidence);
	const currentEvents = await readEvents(input.workspaceRoot, input.evidence);
	const request = EquipmentRunEventRequestSchema.parse(input.request);
	const previous = currentEvents.at(-1);
	const event = EquipmentRunEventSchema.parse({
		schemaVersion: 'equipment-production-event-v1',
		sequence: currentEvents.length + 1,
		previousEventCanonicalSha256: previous === undefined ? null : canonicalJsonSha256(previous),
		recordedAt: input.recordedAt,
		request
	});
	replayEquipmentRunJournal(input.evidence.context, [...currentEvents, event]);
	const eventPath = await exclusiveCreateEvent({
		workspaceRoot: input.workspaceRoot,
		eventsDirectory: runPaths(input.evidence.plan.runId).eventsDirectory,
		event,
		testHooks: input.testHooks
	});
	await assertRunEvidenceUnchanged(input.workspaceRoot, input.evidence);
	const persistedEvents = await readEvents(input.workspaceRoot, input.evidence);
	const state = replayEquipmentRunJournal(input.evidence.context, persistedEvents);
	if (canonicalJsonSha256(state.orderedEvents.at(-1)) !== canonicalJsonSha256(event)) {
		throw new Error('Persisted Equipment event does not match the append that created it');
	}
	return { event, eventPath, state };
}

async function withRunLock<T>(
	options: RecorderLockOptions,
	action: (evidence: VerifiedRunEvidence) => Promise<T>
): Promise<T> {
	const lock = await acquireRunLock(options);
	try {
		const evidence = await loadVerifiedRunEvidence(options.workspaceRoot, options.runId);
		return await action(evidence);
	} finally {
		await unlinkIfIdentityMatches(options.workspaceRoot, lock.lockPath, lock.identity);
	}
}

export async function recordEquipmentRunEvent(
	options: RecordEquipmentRunEventOptions
): Promise<{ event: EquipmentRunEvent; eventPath: string; state: EquipmentRunJournalState }> {
	return withRunLock(options, async (evidence) =>
		appendEventUnderLock({
			workspaceRoot: options.workspaceRoot,
			evidence,
			request: options.request,
			recordedAt: options.recordedAt,
			testHooks: options.testHooks
		})
	);
}

function packetPathForCandidate(
	candidatePath: string,
	directory: 'targets' | 'assignments'
): string {
	const prefix = `${EQUIPMENT_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(prefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid Equipment candidate reservation: ${candidatePath}`);
	}
	return `${EQUIPMENT_PRODUCTION_ROOT}/${directory}/${candidatePath.slice(prefix.length, -4)}.json`;
}

async function resolvePacket(
	workspaceRoot: string,
	plan: EquipmentRunPlan,
	targetId: string
): Promise<{
	readonly targetPath: string;
	readonly targetCanonicalSha256: string;
	readonly assignmentPath: string;
	readonly assignmentCanonicalSha256: string;
}> {
	const rootPacket = plan.rootPackets.find((packet) => packet.targetId === targetId);
	if (rootPacket !== undefined) {
		const [target, assignment] = await Promise.all([
			readEquipmentRepositoryJson(workspaceRoot, rootPacket.targetPath),
			readEquipmentRepositoryJson(workspaceRoot, rootPacket.assignmentPath)
		]);
		if (
			canonicalJsonSha256(EquipmentImageTargetSchema.parse(target)) !==
				rootPacket.targetCanonicalSha256 ||
			canonicalJsonSha256(EquipmentImageAssignmentSchema.parse(assignment)) !==
				rootPacket.assignmentCanonicalSha256
		) {
			throw new Error(`Root Equipment packet changed after activation: ${targetId}`);
		}
		return rootPacket;
	}
	const targetIndex = plan.targetIds.indexOf(targetId);
	const candidatePath = plan.reservedPaths.candidates[targetIndex];
	if (targetIndex < 0 || candidatePath === undefined) {
		throw new Error(`No packet reservation exists for Equipment target: ${targetId}`);
	}
	const targetPath = packetPathForCandidate(candidatePath, 'targets');
	const assignmentPath = packetPathForCandidate(candidatePath, 'assignments');
	const target = EquipmentImageTargetSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, targetPath)
	);
	const assignment = EquipmentImageAssignmentSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, assignmentPath)
	);
	if (target.targetId !== targetId || assignment.targetId !== targetId) {
		throw new Error(`Materialized Equipment child packet identity is stale: ${targetId}`);
	}
	return {
		targetPath,
		targetCanonicalSha256: canonicalJsonSha256(target),
		assignmentPath,
		assignmentCanonicalSha256: canonicalJsonSha256(assignment)
	};
}

type EquipmentPacketBinding = Awaited<ReturnType<typeof resolvePacket>>;
type EquipmentClaimRequest = Extract<EquipmentRunEventRequest, { kind: 'job-claimed' }>;

interface PlannedEquipmentClaim {
	readonly sequence: number;
	readonly request: EquipmentClaimRequest;
	readonly packet: EquipmentPacketBinding;
}

async function reconstructDurableClaimPrefix(input: {
	readonly workspaceRoot: string;
	readonly evidence: VerifiedRunEvidence;
	readonly plannedClaims: readonly PlannedEquipmentClaim[];
	readonly recordedAt: string;
}): Promise<EquipmentJobClaim[]> {
	await assertRunEvidenceUnchanged(input.workspaceRoot, input.evidence);
	const persistedEvents = await readEvents(input.workspaceRoot, input.evidence);
	const state = replayEquipmentRunJournal(input.evidence.context, persistedEvents);
	const durablePrefix: EquipmentJobClaim[] = [];
	let missingPrefixMember = false;
	for (const planned of input.plannedClaims) {
		const event = state.orderedEvents.find(
			({ request }) => request.eventId === planned.request.eventId
		);
		if (event === undefined) {
			missingPrefixMember = true;
			continue;
		}
		if (missingPrefixMember) {
			throw new Error('Durable Equipment claim events are not an exact invocation prefix');
		}
		if (
			event.sequence !== planned.sequence ||
			event.recordedAt !== input.recordedAt ||
			canonicalJsonSha256(event.request) !== canonicalJsonSha256(planned.request)
		) {
			throw new Error('Durable Equipment claim cannot be exactly reconstructed');
		}
		const currentPacket = await resolvePacket(
			input.workspaceRoot,
			input.evidence.plan,
			planned.request.targetId
		);
		if (canonicalJsonSha256(currentPacket) !== canonicalJsonSha256(planned.packet)) {
			throw new Error('Durable Equipment claim packet binding changed during reconstruction');
		}
		durablePrefix.push({
			claimId: planned.request.claimId,
			workerId: planned.request.workerId,
			targetId: planned.request.targetId,
			...planned.packet,
			eventPath: `${runPaths(input.evidence.plan.runId).eventsDirectory}/${eventFileName(event)}`,
			event
		});
	}
	return durablePrefix;
}

export async function claimNextEquipmentJobs(
	options: ClaimNextEquipmentJobsOptions
): Promise<EquipmentJobClaim[]> {
	if (!Number.isSafeInteger(options.availableWorkerSlots) || options.availableWorkerSlots < 0) {
		throw new Error('availableWorkerSlots must be a nonnegative safe integer');
	}
	return withRunLock(options, async (evidence) => {
		const events = await readEvents(options.workspaceRoot, evidence);
		const state = replayEquipmentRunJournal(evidence.context, events);
		const claimCount = Math.max(
			0,
			Math.min(
				16 - state.activeWorkerIds.size,
				options.availableWorkerSlots,
				state.readyUnclaimedTargetIds.length
			)
		);
		const targetIds = state.readyUnclaimedTargetIds.slice(0, claimCount);
		const firstClaimSequence = events.length + (state.runStarted ? 1 : 2);
		const plannedClaims: PlannedEquipmentClaim[] = [];
		for (const [index, targetId] of targetIds.entries()) {
			await options.testHooks?.beforePacketResolution?.({ index, targetId });
			const sequence = firstClaimSequence + index;
			const request = EquipmentRunEventRequestSchema.parse({
				schemaVersion: 'equipment-production-event-request-v1',
				eventId: `job-claimed-${sequence}`,
				runId: options.runId,
				requestedAt: options.requestedAt,
				actor: options.actor,
				kind: 'job-claimed',
				epochId: options.epochId,
				claimId: `claim-${targetId}-${sequence}`,
				targetId,
				workerId: `equipment-worker-${sequence}`
			});
			if (request.kind !== 'job-claimed') throw new Error('Expected a parsed job-claimed request');
			plannedClaims.push({
				sequence,
				request,
				packet: await resolvePacket(options.workspaceRoot, evidence.plan, targetId)
			});
		}
		if (!state.runStarted) {
			await appendEventUnderLock({
				workspaceRoot: options.workspaceRoot,
				evidence,
				request: {
					schemaVersion: 'equipment-production-event-request-v1',
					eventId: `run-started-${options.epochId}`,
					runId: options.runId,
					requestedAt: options.requestedAt,
					actor: options.actor,
					kind: 'run-started',
					epochId: options.epochId
				},
				recordedAt: options.recordedAt,
				testHooks: options.testHooks
			});
		}
		const claims: EquipmentJobClaim[] = [];
		for (const planned of plannedClaims) {
			try {
				const appended = await appendEventUnderLock({
					workspaceRoot: options.workspaceRoot,
					evidence,
					request: planned.request,
					recordedAt: options.recordedAt,
					testHooks: options.testHooks
				});
				claims.push({
					claimId: planned.request.claimId,
					workerId: planned.request.workerId,
					targetId: planned.request.targetId,
					...planned.packet,
					eventPath: appended.eventPath,
					event: appended.event
				});
			} catch (error) {
				const durablePrefix = await reconstructDurableClaimPrefix({
					workspaceRoot: options.workspaceRoot,
					evidence,
					plannedClaims,
					recordedAt: options.recordedAt
				});
				if (durablePrefix.length === 0) throw error;
				return durablePrefix;
			}
		}
		return claims;
	});
}
