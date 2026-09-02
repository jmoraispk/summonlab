import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentArmourSourceReviewReceiptSchema,
	EquipmentImageAssignmentSchema,
	EquipmentImageResultSchema,
	EquipmentImageTargetSchema,
	EquipmentRunActivationSchema,
	EquipmentRunEventSchema,
	EquipmentRunPlanSchema,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema,
	type EquipmentArmourSourceReviewReceipt,
	type EquipmentImageResult,
	type EquipmentImageTarget,
	type EquipmentRunPlan
} from './equipment-image-production-contract.js';
import {
	EQUIPMENT_PROFILE_ACCEPTANCE_PATH,
	buildDependentArmourPackets,
	canonicalJsonSha256
} from './equipment-image-packets.js';
import { verifyEquipmentImageResult } from './equipment-image-result.js';
import { readEquipmentRepositoryJson } from './equipment-repository-io.js';
import { replayEquipmentRunJournal } from './equipment-image-run-journal.js';
import { buildEquipmentRunJournalContext } from './equipment-image-run-recorder.js';
import { buildEquipmentRunPlan } from './equipment-image-run-readiness.js';
import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';

const MANIFEST_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/manifest.json` as const;
const ALLOCATION_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/allocation-plan.json` as const;
const PROFILE_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json` as const;

type EquipmentManifest = ReturnType<typeof buildEquipmentMaterialProductionManifest>;

export interface BuildArmourSourceReviewReceiptInput {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly gateId: string;
	readonly decision: 'accepted' | 'rejected';
	readonly reviewer: string;
	readonly reviewedAt: string;
	readonly acknowledgedCandidateSha256: string;
}

export interface VerifyArmourSourceReviewReceiptInput {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly receipt?: unknown;
	readonly receiptPath?: string;
}

export interface VerifiedArmourSourceReviewReceipt extends EquipmentArmourSourceReviewReceipt {
	readonly receiptPath: string;
	readonly unlocksTargetIds: readonly string[];
	readonly plan: EquipmentRunPlan;
	readonly sourceTarget: EquipmentImageTarget;
	readonly sourceResult: EquipmentImageResult;
}

interface VerifiedRunReviewContext {
	readonly plan: EquipmentRunPlan;
	readonly activation: ReturnType<typeof EquipmentRunActivationSchema.parse>;
	readonly manifest: EquipmentManifest;
	readonly allocation: ReturnType<typeof buildEquipmentMaterialAllocationPlan>;
	readonly profile: ReturnType<typeof EquipmentVisualProfileSchema.parse>;
	readonly acceptance: ReturnType<typeof EquipmentVisualProfileAcceptanceSchema.parse>;
	readonly events: ReturnType<typeof EquipmentRunEventSchema.parse>[];
	readonly journalState: ReturnType<typeof replayEquipmentRunJournal>;
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

function runPaths(runId: string) {
	const runDirectory = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${runId}`;
	return {
		planPath: `${runDirectory}/plan.json`,
		activationPath: `${runDirectory}/activation.json`,
		eventsDirectory: `${runDirectory}/events`
	};
}

async function readRunEvents(
	workspaceRoot: string,
	plan: EquipmentRunPlan,
	activation: ReturnType<typeof EquipmentRunActivationSchema.parse>
): Promise<ReturnType<typeof EquipmentRunEventSchema.parse>[]> {
	const eventsDirectory = runPaths(plan.runId).eventsDirectory;
	const metadata = await lstat(repositoryAbsolute(workspaceRoot, eventsDirectory)).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	);
	if (metadata === null) return [];
	if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
		throw new Error('Equipment journal events path must be a real directory');
	}
	const events = await Promise.all(
		(await readdir(repositoryAbsolute(workspaceRoot, eventsDirectory))).map(async (name) => {
			const match = /^(\d{6})-([a-z][a-z0-9-]{1,119})\.json$/u.exec(name);
			if (match === null) throw new Error(`Unexpected Equipment journal entry: ${name}`);
			const event = EquipmentRunEventSchema.parse(
				await readEquipmentRepositoryJson(workspaceRoot, `${eventsDirectory}/${name}`)
			);
			if (event.sequence !== Number(match[1]) || event.request.eventId !== match[2]) {
				throw new Error(`Equipment event filename does not bind its event: ${name}`);
			}
			return event;
		})
	);
	return replayEquipmentRunJournal(
		buildEquipmentRunJournalContext(plan, activation),
		events
	).orderedEvents.slice();
}

async function loadVerifiedRunReviewContext(
	workspaceRoot: string,
	runId: string
): Promise<VerifiedRunReviewContext> {
	const paths = runPaths(runId);
	const plan = EquipmentRunPlanSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, paths.planPath)
	);
	if (plan.runId !== runId) throw new Error('Persisted run plan belongs to another run');
	const expectedPlan = await buildEquipmentRunPlan({
		workspaceRoot,
		runId,
		createdAt: plan.createdAt
	});
	if (canonicalJsonSha256(plan) !== canonicalJsonSha256(expectedPlan)) {
		throw new Error('Persisted run plan is stale or does not match current static evidence');
	}
	const activation = EquipmentRunActivationSchema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, paths.activationPath)
	);
	if (
		activation.runId !== runId ||
		activation.runPlanCanonicalSha256 !== canonicalJsonSha256(plan)
	) {
		throw new Error('Run activation does not hash-bind the current immutable run plan');
	}
	const [manifestValue, allocationValue, profileValue, acceptanceValue] = await Promise.all([
		readEquipmentRepositoryJson(workspaceRoot, MANIFEST_PATH),
		readEquipmentRepositoryJson(workspaceRoot, ALLOCATION_PATH),
		readEquipmentRepositoryJson(workspaceRoot, PROFILE_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_PROFILE_ACCEPTANCE_PATH)
	]);
	const manifest = manifestValue as EquipmentManifest;
	const allocation = allocationValue as ReturnType<typeof buildEquipmentMaterialAllocationPlan>;
	const profile = EquipmentVisualProfileSchema.parse(profileValue);
	const acceptance = EquipmentVisualProfileAcceptanceSchema.parse(acceptanceValue);
	if (
		canonicalJsonSha256(manifest) !==
			canonicalJsonSha256(buildEquipmentMaterialProductionManifest()) ||
		canonicalJsonSha256(allocation) !== canonicalJsonSha256(buildEquipmentMaterialAllocationPlan())
	) {
		throw new Error('Manifest or allocation plan does not match deterministic static evidence');
	}
	const events = await readRunEvents(workspaceRoot, plan, activation);
	const journalState = replayEquipmentRunJournal(
		buildEquipmentRunJournalContext(plan, activation),
		events
	);
	return { plan, activation, manifest, allocation, profile, acceptance, events, journalState };
}

async function loadVerifiedSource(input: {
	readonly workspaceRoot: string;
	readonly context: VerifiedRunReviewContext;
	readonly gateId: string;
}) {
	const gate = input.context.plan.reviewGates.find(({ gateId }) => gateId === input.gateId);
	if (gate === undefined) throw new Error(`Armour review gate is not in the run: ${input.gateId}`);
	if (gate.unlocksTargetIds.length !== 4) {
		throw new Error(`Armour review gate must declare exactly four children: ${input.gateId}`);
	}
	const sourcePacket = input.context.plan.rootPackets.find(
		({ targetId }) => targetId === gate.sourceTargetId
	);
	if (sourcePacket === undefined) {
		throw new Error(`Armour source target is not a materialized run root: ${gate.sourceTargetId}`);
	}
	const [sourceTargetValue, sourceAssignmentValue] = await Promise.all([
		readEquipmentRepositoryJson(input.workspaceRoot, sourcePacket.targetPath),
		readEquipmentRepositoryJson(input.workspaceRoot, sourcePacket.assignmentPath)
	]);
	const sourceTarget = EquipmentImageTargetSchema.parse(sourceTargetValue);
	const sourceAssignment = EquipmentImageAssignmentSchema.parse(sourceAssignmentValue);
	if (
		canonicalJsonSha256(sourceTarget) !== sourcePacket.targetCanonicalSha256 ||
		canonicalJsonSha256(sourceAssignment) !== sourcePacket.assignmentCanonicalSha256
	) {
		throw new Error('Armour source target or assignment changed after run activation');
	}
	if (
		sourceTarget.targetId !== gate.sourceTargetId ||
		sourceTarget.equipment.artifactRole !== 'set-source' ||
		sourceTarget.presentation.mode !== 'complete-armour-set' ||
		sourceTarget.consistencySource !== null
	) {
		throw new Error('Armour review source target is not the declared complete set source');
	}
	const sourceResultValue = await readEquipmentRepositoryJson(
		input.workspaceRoot,
		sourceTarget.output.resultPath
	);
	await verifyEquipmentImageResult({
		workspaceRoot: input.workspaceRoot,
		targetPath: sourcePacket.targetPath,
		assignmentPath: sourcePacket.assignmentPath,
		resultPath: sourceTarget.output.resultPath,
		result: sourceResultValue
	});
	const sourceResult = EquipmentImageResultSchema.parse(sourceResultValue);
	if (sourceResult.status !== 'candidate' || sourceResult.candidateSha256 === null) {
		throw new Error('Armour review source result must be a verified candidate');
	}
	const terminal = input.context.journalState.terminal.get(sourceTarget.targetId);
	if (
		terminal?.status !== 'candidate' ||
		terminal.resultCanonicalSha256 !== canonicalJsonSha256(sourceResult)
	) {
		throw new Error('Armour source result is not the exact journaled terminal candidate');
	}
	const terminalEvent = input.context.events.find(
		({ request }) => request.kind === 'job-terminal' && request.targetId === sourceTarget.targetId
	)!;
	const manifestChildren = input.context.manifest.targets.filter(
		({ dependsOnTargetId }) => dependsOnTargetId === sourceTarget.targetId
	);
	if (
		manifestChildren.length !== 4 ||
		manifestChildren.some(
			(child, index) =>
				child.targetId !== gate.unlocksTargetIds[index] ||
				child.slot !== (['head', 'torso', 'legs', 'boots'] as const)[index]
		)
	) {
		throw new Error('Armour gate children must be exactly Head, Torso, Legs, and Boots in order');
	}
	return { gate, sourcePacket, sourceTarget, sourceAssignment, sourceResult, terminalEvent };
}

export async function buildArmourSourceReviewReceipt(
	input: BuildArmourSourceReviewReceiptInput
): Promise<EquipmentArmourSourceReviewReceipt> {
	if (!/^[a-f0-9]{64}$/u.test(input.acknowledgedCandidateSha256)) {
		throw new Error('Acknowledged candidate SHA-256 must be 64 lowercase hexadecimal characters');
	}
	const context = await loadVerifiedRunReviewContext(input.workspaceRoot, input.runId);
	const source = await loadVerifiedSource({
		workspaceRoot: input.workspaceRoot,
		context,
		gateId: input.gateId
	});
	if (input.acknowledgedCandidateSha256 !== source.sourceResult.candidateSha256) {
		throw new Error('Acknowledged candidate hash does not match stored source candidate bytes');
	}
	const existingReview = context.journalState.reviewedGates.get(input.gateId);
	if (
		Date.parse(input.reviewedAt) < Date.parse(source.sourceResult.completedAt) ||
		Date.parse(input.reviewedAt) < Date.parse(source.terminalEvent.recordedAt)
	) {
		throw new Error(
			'Armour review timestamp is stale relative to source result and terminal evidence'
		);
	}
	const receipt = EquipmentArmourSourceReviewReceiptSchema.parse({
		schemaVersion: 'equipment-armour-source-review-receipt-v1',
		receiptId: `${source.gate.gateId}-receipt`,
		runId: input.runId,
		runPlanCanonicalSha256: canonicalJsonSha256(context.plan),
		manifestCanonicalSha256: context.plan.boundArtifacts.manifestCanonicalSha256,
		allocationCanonicalSha256: context.plan.boundArtifacts.allocationCanonicalSha256,
		profileCanonicalSha256: context.plan.boundArtifacts.profileCanonicalSha256,
		gateId: source.gate.gateId,
		sourceTargetId: source.sourceTarget.targetId,
		sourceResultCanonicalSha256: canonicalJsonSha256(source.sourceResult),
		candidateSha256: source.sourceResult.candidateSha256,
		decision: input.decision,
		reviewer: input.reviewer,
		reviewedAt: input.reviewedAt
	});
	if (
		existingReview !== undefined &&
		(existingReview.sourceTargetId !== receipt.sourceTargetId ||
			existingReview.decision !== receipt.decision ||
			existingReview.receiptCanonicalSha256 !== canonicalJsonSha256(receipt) ||
			existingReview.actor !== receipt.reviewer ||
			existingReview.requestedAt !== receipt.reviewedAt)
	) {
		throw new Error('Existing Armour review event does not bind the exact reviewer decision');
	}
	return receipt;
}

export async function verifyArmourSourceReviewReceipt(
	input: VerifyArmourSourceReviewReceiptInput
): Promise<VerifiedArmourSourceReviewReceipt> {
	if ((input.receipt === undefined) === (input.receiptPath === undefined)) {
		throw new Error('Supply exactly one Armour review receipt value or receipt path');
	}
	const receipt = EquipmentArmourSourceReviewReceiptSchema.parse(
		input.receipt ?? (await readEquipmentRepositoryJson(input.workspaceRoot, input.receiptPath!))
	);
	if (receipt.runId !== input.runId) throw new Error('Armour receipt belongs to another run');
	const context = await loadVerifiedRunReviewContext(input.workspaceRoot, input.runId);
	const source = await loadVerifiedSource({
		workspaceRoot: input.workspaceRoot,
		context,
		gateId: receipt.gateId
	});
	if (input.receiptPath !== undefined && input.receiptPath !== source.gate.reviewPath) {
		throw new Error('Armour receipt path does not match the manifest-reserved review path');
	}
	if (receipt.receiptId !== `${source.gate.gateId}-receipt`) {
		throw new Error('Armour receipt ID does not bind the exact review gate');
	}
	if (receipt.runPlanCanonicalSha256 !== canonicalJsonSha256(context.plan)) {
		throw new Error('Armour receipt run-plan hash does not match the current immutable plan');
	}
	if (
		receipt.manifestCanonicalSha256 !== context.plan.boundArtifacts.manifestCanonicalSha256 ||
		receipt.manifestCanonicalSha256 !== canonicalJsonSha256(context.manifest)
	) {
		throw new Error('Armour receipt manifest hash does not match current run evidence');
	}
	if (
		receipt.allocationCanonicalSha256 !== context.plan.boundArtifacts.allocationCanonicalSha256 ||
		receipt.allocationCanonicalSha256 !== canonicalJsonSha256(context.allocation)
	) {
		throw new Error('Armour receipt allocation hash does not match current run evidence');
	}
	if (
		receipt.profileCanonicalSha256 !== context.plan.boundArtifacts.profileCanonicalSha256 ||
		receipt.profileCanonicalSha256 !== canonicalJsonSha256(context.profile)
	) {
		throw new Error('Armour receipt profile hash does not match current run evidence');
	}
	if (receipt.sourceTargetId !== source.gate.sourceTargetId) {
		throw new Error('Armour receipt source target does not match the review gate');
	}
	if (receipt.sourceResultCanonicalSha256 !== canonicalJsonSha256(source.sourceResult)) {
		throw new Error('Armour receipt source result hash does not match verified result evidence');
	}
	if (receipt.candidateSha256 !== source.sourceResult.candidateSha256) {
		throw new Error('Armour receipt candidate hash does not match stored candidate bytes');
	}
	if (
		Date.parse(receipt.reviewedAt) < Date.parse(source.sourceResult.completedAt) ||
		Date.parse(receipt.reviewedAt) < Date.parse(source.terminalEvent.recordedAt)
	) {
		throw new Error('Armour review timestamp is stale relative to source terminal evidence');
	}
	const existingReview = context.journalState.reviewedGates.get(receipt.gateId);
	if (
		existingReview !== undefined &&
		(existingReview.sourceTargetId !== receipt.sourceTargetId ||
			existingReview.decision !== receipt.decision ||
			existingReview.receiptCanonicalSha256 !== canonicalJsonSha256(receipt) ||
			existingReview.actor !== receipt.reviewer ||
			existingReview.requestedAt !== receipt.reviewedAt)
	) {
		throw new Error('Armour receipt does not match its exact persisted reviewer event');
	}
	return {
		...receipt,
		receiptPath: source.gate.reviewPath,
		unlocksTargetIds: receipt.decision === 'accepted' ? source.gate.unlocksTargetIds : [],
		plan: context.plan,
		sourceTarget: source.sourceTarget,
		sourceResult: source.sourceResult
	};
}

export interface EquipmentArmourReviewTestHooks {
	readonly afterPacketFileCreated?: (input: {
		readonly index: number;
		readonly packetPath: string;
	}) => void | Promise<void>;
	readonly afterAllPacketFilesVerified?: () => void | Promise<void>;
	readonly beforeReviewEventCreated?: (input: {
		readonly packetPaths: readonly string[];
	}) => void | Promise<void>;
}

export interface MaterializeDependentArmourPacketsInput extends BuildArmourSourceReviewReceiptInput {
	readonly lockOwnerId: string;
	readonly processId?: number;
	readonly now?: () => Date;
	readonly staleLockAfterMs?: number;
	readonly lockWaitTimeoutMs?: number;
	readonly testHooks?: EquipmentArmourReviewTestHooks;
}

export interface MaterializedDependentArmourPackets {
	readonly decision: 'accepted' | 'rejected';
	readonly receiptPath: string;
	readonly receiptCanonicalSha256: string;
	readonly targetCount: number;
	readonly assignmentCount: number;
	readonly packetPaths: readonly string[];
	readonly eventPath: string;
	readonly writesPerformed: number;
	readonly reconciled: boolean;
}

interface FileIdentity {
	readonly device: number;
	readonly inode: number;
}

interface ReviewLockEvidence {
	readonly ownerId: string;
	readonly processId: number;
	readonly acquiredAt: string;
}

const DEFAULT_STALE_LOCK_AFTER_MS = 5 * 60 * 1_000;
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 2_000;
const LOCK_RETRY_INTERVAL_MS = 10;

async function assertRealPathPrefix(
	workspaceRoot: string,
	repositoryPath: string,
	finalMustBeDirectory = false
): Promise<void> {
	const root = path.resolve(workspaceRoot);
	const rootMetadata = await lstat(root);
	if (!rootMetadata.isDirectory() || rootMetadata.isSymbolicLink()) {
		throw new Error('Workspace root must be a real directory');
	}
	let cursor = root;
	const components = repositoryPath.split('/');
	for (const [index, component] of components.entries()) {
		cursor = path.join(cursor, component);
		const metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (metadata === null) {
			if (finalMustBeDirectory) {
				throw new Error(`Equipment review directory must already exist: ${repositoryPath}`);
			}
			return;
		}
		if (metadata.isSymbolicLink()) {
			throw new Error(`Equipment review paths refuse symbolic links: ${repositoryPath}`);
		}
		const final = index === components.length - 1;
		if ((!final || finalMustBeDirectory) && !metadata.isDirectory()) {
			throw new Error(`Equipment review path ancestor is not a directory: ${repositoryPath}`);
		}
	}
}

async function ensureRealParentDirectories(
	workspaceRoot: string,
	repositoryPath: string
): Promise<void> {
	const root = path.resolve(workspaceRoot);
	let cursor = root;
	for (const component of repositoryPath.split('/').slice(0, -1)) {
		cursor = path.join(cursor, component);
		let metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (metadata === null) {
			try {
				await mkdir(cursor);
			} catch (error) {
				if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
			}
			metadata = await lstat(cursor);
		}
		if (metadata.isSymbolicLink() || !metadata.isDirectory()) {
			throw new Error(`Equipment review parent is unsafe: ${repositoryPath}`);
		}
	}
}

async function pathExistsSafely(workspaceRoot: string, repositoryPath: string): Promise<boolean> {
	await assertRealPathPrefix(workspaceRoot, repositoryPath);
	return lstat(repositoryAbsolute(workspaceRoot, repositoryPath)).then(
		(metadata) => {
			if (metadata.isSymbolicLink() || !metadata.isFile()) {
				throw new Error(`Equipment review artifact must be a regular file: ${repositoryPath}`);
			}
			return true;
		},
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return false;
			throw error;
		}
	);
}

async function exclusiveCreateJson(
	workspaceRoot: string,
	repositoryPath: string,
	value: unknown
): Promise<FileIdentity> {
	await ensureRealParentDirectories(workspaceRoot, repositoryPath);
	let handle;
	try {
		handle = await open(repositoryAbsolute(workspaceRoot, repositoryPath), 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`Exclusive Equipment review creation collided: ${repositoryPath}`, {
				cause: error
			});
		}
		throw error;
	}
	const metadata = await handle.stat();
	try {
		await handle.writeFile(`${JSON.stringify(value, null, '\t')}\n`, 'utf8');
		await handle.sync();
		await handle.close();
	} catch (error) {
		await handle.close().catch(() => undefined);
		const identity = { device: metadata.dev, inode: metadata.ino };
		await unlinkOwnedFile(workspaceRoot, repositoryPath, identity).catch((cleanupError) => {
			throw new Error(
				`Incomplete Equipment review artifact could not be cleaned: ${repositoryPath}`,
				{
					cause: cleanupError
				}
			);
		});
		throw error;
	}
	return { device: metadata.dev, inode: metadata.ino };
}

async function unlinkOwnedFile(
	workspaceRoot: string,
	repositoryPath: string,
	identity: FileIdentity
): Promise<void> {
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
		throw new Error(`Owned Equipment review lock changed before release: ${repositoryPath}`);
	}
	await unlink(repositoryAbsolute(workspaceRoot, repositoryPath));
}

function parseReviewLockEvidence(value: unknown): ReviewLockEvidence {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error('Equipment review lock evidence is invalid');
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
		throw new Error('Equipment review lock evidence is invalid');
	}
	return {
		ownerId: record.ownerId,
		processId: record.processId,
		acquiredAt: record.acquiredAt
	};
}

function processIsAlive(processId: number): boolean {
	try {
		process.kill(processId, 0);
		return true;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code !== 'ESRCH';
	}
}

async function readReviewLock(
	workspaceRoot: string,
	lockPath: string
): Promise<{ evidence: ReviewLockEvidence; identity: FileIdentity } | null> {
	await assertRealPathPrefix(workspaceRoot, lockPath);
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
		if (!metadata.isFile()) throw new Error('Equipment review lock must be a regular file');
		let value: unknown;
		try {
			value = JSON.parse(await handle.readFile('utf8')) as unknown;
		} catch (error) {
			throw new Error('Equipment review lock is invalid JSON', { cause: error });
		}
		return {
			evidence: parseReviewLockEvidence(value),
			identity: { device: metadata.dev, inode: metadata.ino }
		};
	} finally {
		await handle.close();
	}
}

function reviewLockIsStale(
	evidence: ReviewLockEvidence,
	now: Date,
	staleLockAfterMs: number
): boolean {
	return (
		now.getTime() - Date.parse(evidence.acquiredAt) >= staleLockAfterMs &&
		!processIsAlive(evidence.processId)
	);
}

async function waitForReviewLock(input: {
	readonly waitStartedAt: number;
	readonly lockWaitTimeoutMs: number;
	readonly message: string;
}): Promise<void> {
	if (Date.now() - input.waitStartedAt >= input.lockWaitTimeoutMs) {
		throw new Error(input.message);
	}
	await new Promise<void>((resolve) => setTimeout(resolve, LOCK_RETRY_INTERVAL_MS));
}

async function acquireReviewRunLock(input: MaterializeDependentArmourPacketsInput) {
	const runDirectory = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${input.runId}`;
	await assertRealPathPrefix(input.workspaceRoot, runDirectory, true);
	const lockPath = `${runDirectory}/.journal.lock`;
	const recoveryGuardPath = `${runDirectory}/.journal-lock-recovery.guard`;
	const processId = input.processId ?? process.pid;
	const now = input.now ?? (() => new Date());
	const staleLockAfterMs = input.staleLockAfterMs ?? DEFAULT_STALE_LOCK_AFTER_MS;
	const lockWaitTimeoutMs = input.lockWaitTimeoutMs ?? DEFAULT_LOCK_WAIT_TIMEOUT_MS;
	if (
		!Number.isSafeInteger(processId) ||
		processId <= 0 ||
		staleLockAfterMs < 0 ||
		lockWaitTimeoutMs < 0
	) {
		throw new Error('Equipment review lock options are invalid');
	}
	const waitStartedAt = Date.now();
	while (true) {
		if (await pathExistsSafely(input.workspaceRoot, recoveryGuardPath)) {
			await waitForReviewLock({
				waitStartedAt,
				lockWaitTimeoutMs,
				message: 'Equipment review lock recovery guard requires operator resolution'
			});
			continue;
		}
		try {
			const identity = await exclusiveCreateJson(input.workspaceRoot, lockPath, {
				ownerId: input.lockOwnerId,
				processId,
				acquiredAt: now().toISOString()
			});
			return { lockPath, identity };
		} catch (error) {
			if (!String(error).includes('collided')) throw error;
		}
		let existing;
		try {
			existing = await readReviewLock(input.workspaceRoot, lockPath);
		} catch (error) {
			await waitForReviewLock({
				waitStartedAt,
				lockWaitTimeoutMs,
				message: `Equipment review lock could not be verified: ${error instanceof Error ? error.message : String(error)}`
			});
			continue;
		}
		if (existing === null) continue;
		if (reviewLockIsStale(existing.evidence, now(), staleLockAfterMs)) {
			let guardIdentity: FileIdentity;
			try {
				guardIdentity = await exclusiveCreateJson(input.workspaceRoot, recoveryGuardPath, {
					ownerId: input.lockOwnerId,
					processId,
					acquiredAt: now().toISOString()
				});
			} catch (error) {
				await waitForReviewLock({
					waitStartedAt,
					lockWaitTimeoutMs,
					message: `Equipment review lock recovery could not serialize: ${error instanceof Error ? error.message : String(error)}`
				});
				continue;
			}
			let recoveryError: unknown;
			try {
				const current = await readReviewLock(input.workspaceRoot, lockPath);
				if (current !== null && reviewLockIsStale(current.evidence, now(), staleLockAfterMs)) {
					await unlinkOwnedFile(input.workspaceRoot, lockPath, current.identity);
				}
			} catch (error) {
				recoveryError = error;
			}
			await unlinkOwnedFile(input.workspaceRoot, recoveryGuardPath, guardIdentity);
			if (recoveryError !== undefined) throw recoveryError;
			continue;
		}
		await waitForReviewLock({
			waitStartedAt,
			lockWaitTimeoutMs,
			message: `Live Equipment review lock is owned by ${existing.evidence.ownerId} (process ${existing.evidence.processId})`
		});
	}
}

function packetArtifacts(
	packets: ReturnType<typeof buildDependentArmourPackets>
): Array<{ repositoryPath: string; value: unknown }> {
	return packets.flatMap(({ targetPath, assignmentPath, target, assignment }) => [
		{ repositoryPath: targetPath, value: target },
		{ repositoryPath: assignmentPath, value: assignment }
	]);
}

function packetPathForCandidate(
	candidatePath: string,
	directory: 'targets' | 'assignments'
): string {
	const prefix = `${EQUIPMENT_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(prefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid Equipment child candidate reservation: ${candidatePath}`);
	}
	return `${EQUIPMENT_PRODUCTION_ROOT}/${directory}/${candidatePath.slice(prefix.length, -4)}.json`;
}

function gateReservedPaths(context: VerifiedRunReviewContext, gateId: string) {
	const gate = context.plan.reviewGates.find((candidate) => candidate.gateId === gateId);
	if (gate === undefined) throw new Error(`Armour review gate is not in the run: ${gateId}`);
	const outputs = gate.unlocksTargetIds.map((targetId) => {
		const index = context.plan.targetIds.indexOf(targetId);
		const candidatePath = context.plan.reservedPaths.candidates[index];
		const resultPath = context.plan.reservedPaths.results[index];
		if (index < 0 || candidatePath === undefined || resultPath === undefined) {
			throw new Error(`Armour child has no exact run output reservation: ${targetId}`);
		}
		return { targetId, candidatePath, resultPath };
	});
	return {
		packetPaths: outputs.flatMap(({ candidatePath }) => [
			packetPathForCandidate(candidatePath, 'targets'),
			packetPathForCandidate(candidatePath, 'assignments')
		]),
		outputPaths: outputs.flatMap(({ candidatePath, resultPath }) => [candidatePath, resultPath])
	};
}

async function verifyExactPacketArtifacts(
	workspaceRoot: string,
	artifacts: readonly { repositoryPath: string; value: unknown }[]
): Promise<void> {
	for (const artifact of artifacts) {
		const persisted = await readEquipmentRepositoryJson(workspaceRoot, artifact.repositoryPath);
		if (canonicalJsonSha256(persisted) !== canonicalJsonSha256(artifact.value)) {
			throw new Error(`Persisted Armour child packet hash is stale: ${artifact.repositoryPath}`);
		}
	}
}

async function appendReviewEventUnderLock(input: {
	readonly workspaceRoot: string;
	readonly context: VerifiedRunReviewContext;
	readonly receipt: EquipmentArmourSourceReviewReceipt;
	readonly packetPaths: readonly string[];
	readonly testHooks?: EquipmentArmourReviewTestHooks;
}): Promise<{ eventPath: string; created: boolean }> {
	const receiptCanonicalSha256 = canonicalJsonSha256(input.receipt);
	const existing = input.context.journalState.reviewedGates.get(input.receipt.gateId);
	if (existing !== undefined) {
		if (
			existing.sourceTargetId !== input.receipt.sourceTargetId ||
			existing.decision !== input.receipt.decision ||
			existing.receiptCanonicalSha256 !== receiptCanonicalSha256
		) {
			throw new Error('Armour review gate already has a different journal decision');
		}
		const event = input.context.events.find(({ request }) => request.eventId === existing.eventId)!;
		return {
			eventPath: `${runPaths(input.receipt.runId).eventsDirectory}/${String(event.sequence).padStart(6, '0')}-${event.request.eventId}.json`,
			created: false
		};
	}
	const previous = input.context.events.at(-1);
	const eventId = `${input.receipt.receiptId}-event`;
	const event = EquipmentRunEventSchema.parse({
		schemaVersion: 'equipment-production-event-v1',
		sequence: input.context.events.length + 1,
		previousEventCanonicalSha256: previous === undefined ? null : canonicalJsonSha256(previous),
		recordedAt:
			previous !== undefined &&
			Date.parse(previous.recordedAt) > Date.parse(input.receipt.reviewedAt)
				? previous.recordedAt
				: input.receipt.reviewedAt,
		request: {
			schemaVersion: 'equipment-production-event-request-v1',
			eventId,
			runId: input.receipt.runId,
			requestedAt: input.receipt.reviewedAt,
			actor: input.receipt.reviewer,
			kind: 'armour-source-reviewed',
			gateId: input.receipt.gateId,
			sourceTargetId: input.receipt.sourceTargetId,
			decision: input.receipt.decision,
			receiptCanonicalSha256
		}
	});
	replayEquipmentRunJournal(
		buildEquipmentRunJournalContext(input.context.plan, input.context.activation),
		[...input.context.events, event]
	);
	await input.testHooks?.beforeReviewEventCreated?.({ packetPaths: input.packetPaths });
	const eventPath = `${runPaths(input.receipt.runId).eventsDirectory}/${String(event.sequence).padStart(6, '0')}-${eventId}.json`;
	await exclusiveCreateJson(input.workspaceRoot, eventPath, event);
	const after = await loadVerifiedRunReviewContext(input.workspaceRoot, input.receipt.runId);
	const persisted = after.events.at(-1);
	if (
		persisted === undefined ||
		canonicalJsonSha256(persisted) !== canonicalJsonSha256(event) ||
		!after.journalState.reviewedGates.has(input.receipt.gateId)
	) {
		throw new Error('Persisted Armour review event failed exact journal replay verification');
	}
	return { eventPath, created: true };
}

export async function materializeDependentArmourPackets(
	input: MaterializeDependentArmourPacketsInput
): Promise<MaterializedDependentArmourPackets> {
	const lock = await acquireReviewRunLock(input);
	try {
		let context = await loadVerifiedRunReviewContext(input.workspaceRoot, input.runId);
		const builtReceipt = await buildArmourSourceReviewReceipt(input);
		const gate = context.plan.reviewGates.find(({ gateId }) => gateId === input.gateId)!;
		const receiptExisted = await pathExistsSafely(input.workspaceRoot, gate.reviewPath);
		const reserved = gateReservedPaths(context, input.gateId);
		const existingPacketCount = (
			await Promise.all(
				reserved.packetPaths.map((repositoryPath) =>
					pathExistsSafely(input.workspaceRoot, repositoryPath)
				)
			)
		).filter(Boolean).length;
		if (!receiptExisted && existingPacketCount !== 0) {
			throw new Error('Partial Armour child packet materialization blocks review receipt creation');
		}
		if (!context.journalState.reviewedGates.has(input.gateId)) {
			const existingOutputPaths = (
				await Promise.all(
					reserved.outputPaths.map((repositoryPath) =>
						pathExistsSafely(input.workspaceRoot, repositoryPath)
					)
				)
			).filter(Boolean);
			if (existingOutputPaths.length !== 0) {
				throw new Error('Armour child outputs must be absent before the review gate event');
			}
		}
		let writesPerformed = 0;
		if (receiptExisted) {
			const persistedReceiptValue = EquipmentArmourSourceReviewReceiptSchema.parse(
				await readEquipmentRepositoryJson(input.workspaceRoot, gate.reviewPath)
			);
			await verifyArmourSourceReviewReceipt({
				workspaceRoot: input.workspaceRoot,
				runId: input.runId,
				receiptPath: gate.reviewPath
			});
			if (canonicalJsonSha256(persistedReceiptValue) !== canonicalJsonSha256(builtReceipt)) {
				throw new Error(`Exclusive Armour review receipt collision: ${gate.reviewPath}`);
			}
		} else {
			if (context.journalState.reviewedGates.has(input.gateId)) {
				throw new Error('Armour review journal event exists without its exact receipt');
			}
			await exclusiveCreateJson(input.workspaceRoot, gate.reviewPath, builtReceipt);
			writesPerformed += 1;
		}
		const verifiedReceipt = await verifyArmourSourceReviewReceipt({
			workspaceRoot: input.workspaceRoot,
			runId: input.runId,
			receiptPath: gate.reviewPath
		});
		const persistedReceiptValue = EquipmentArmourSourceReviewReceiptSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, gate.reviewPath)
		);
		if (canonicalJsonSha256(persistedReceiptValue) !== canonicalJsonSha256(builtReceipt)) {
			throw new Error('Persisted Armour review receipt changed after exclusive creation');
		}

		const packets =
			builtReceipt.decision === 'accepted'
				? buildDependentArmourPackets({
						manifest: context.manifest,
						allocation: context.allocation,
						profile: context.profile,
						acceptance: context.acceptance,
						sourceTarget: verifiedReceipt.sourceTarget,
						receipt: builtReceipt,
						assignedAt: builtReceipt.reviewedAt
					})
				: [];
		const artifacts = packetArtifacts(packets);
		const packetPaths = artifacts.map(({ repositoryPath }) => repositoryPath);
		if (
			builtReceipt.decision === 'accepted' &&
			canonicalJsonSha256(packetPaths) !== canonicalJsonSha256(reserved.packetPaths)
		) {
			throw new Error('Built Armour child packet paths do not match exact run reservations');
		}
		if (builtReceipt.decision === 'rejected' && existingPacketCount !== 0) {
			throw new Error('Rejected Armour receipt cannot coexist with dependent packet evidence');
		}
		if (builtReceipt.decision === 'accepted') {
			if (receiptExisted) {
				if (existingPacketCount !== 8) {
					throw new Error(
						'Existing accepted receipt may reconcile only when all eight exact child packet files exist'
					);
				}
			} else {
				if (existingPacketCount !== 0) {
					throw new Error('Partial Armour child packet materialization blocks review acceptance');
				}
				for (const [index, artifact] of artifacts.entries()) {
					await exclusiveCreateJson(input.workspaceRoot, artifact.repositoryPath, artifact.value);
					writesPerformed += 1;
					await input.testHooks?.afterPacketFileCreated?.({
						index,
						packetPath: artifact.repositoryPath
					});
				}
			}
			await verifyExactPacketArtifacts(input.workspaceRoot, artifacts);
			await input.testHooks?.afterAllPacketFilesVerified?.();
		}
		context = await loadVerifiedRunReviewContext(input.workspaceRoot, input.runId);
		const appended = await appendReviewEventUnderLock({
			workspaceRoot: input.workspaceRoot,
			context,
			receipt: builtReceipt,
			packetPaths,
			...(input.testHooks === undefined ? {} : { testHooks: input.testHooks })
		});
		if (appended.created) writesPerformed += 1;
		return {
			decision: builtReceipt.decision,
			receiptPath: gate.reviewPath,
			receiptCanonicalSha256: canonicalJsonSha256(builtReceipt),
			targetCount: packets.length,
			assignmentCount: packets.length,
			packetPaths,
			eventPath: appended.eventPath,
			writesPerformed,
			reconciled: receiptExisted
		};
	} finally {
		await unlinkOwnedFile(input.workspaceRoot, lock.lockPath, lock.identity);
	}
}
