import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { lstat, mkdir, open, unlink } from 'node:fs/promises';
import path from 'node:path';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentImageAssignmentSchema,
	EquipmentImageTargetSchema,
	EquipmentRunActivationSchema,
	EquipmentRunPlanSchema,
	EquipmentRunReadinessReportSchema,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema,
	type EquipmentRunActivation,
	type EquipmentRunPlan,
	type EquipmentRunReadinessReport
} from './equipment-image-production-contract.js';
import {
	EQUIPMENT_PROFILE_ACCEPTANCE_PATH,
	buildRootEquipmentPackets,
	canonicalJsonSha256
} from './equipment-image-packets.js';
import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';

export const DEFAULT_EQUIPMENT_RUN_ID = 'material-equipment-v1-run-001' as const;

const MANIFEST_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/manifest.json` as const;
const ALLOCATION_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/allocation-plan.json` as const;
const PROFILE_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json` as const;

const VERSIONS = {
	contract: 'equipment-image-production-contract-v1',
	renderer: 'equipment-image-prompt-v1',
	verifier: 'equipment-image-result-verifier-v1',
	persistence: 'equipment-image-persistence-v1',
	journal: 'equipment-production-journal-v1'
} as const;

type EquipmentManifest = ReturnType<typeof buildEquipmentMaterialProductionManifest>;
type EquipmentAllocation = ReturnType<typeof buildEquipmentMaterialAllocationPlan>;

interface FileIdentity {
	readonly device: number;
	readonly inode: number;
}

interface ActivationEvidenceResult {
	readonly state: 'absent' | 'valid' | 'invalid';
	readonly blockers: Array<{ code: string; message: string; path?: string }>;
}

export interface BuildEquipmentRunPlanInput {
	readonly workspaceRoot: string;
	readonly runId: string;
	readonly createdAt: string;
}

export interface ReportEquipmentRunReadinessInput extends BuildEquipmentRunPlanInput {
	readonly checkedAt: string;
}

export interface ActivateEquipmentRunInput extends BuildEquipmentRunPlanInput {
	readonly activatedAt: string;
	readonly activatedBy: string;
}

export interface EquipmentRunActivationResult {
	readonly runId: string;
	readonly planPath: string;
	readonly activationPath: string;
	readonly runPlanCanonicalSha256: string;
	readonly writesPerformed: 2;
}

function runPaths(runId: string) {
	const runDirectory = `${EQUIPMENT_PRODUCTION_ROOT}/runs/${runId}`;
	return {
		runsDirectory: `${EQUIPMENT_PRODUCTION_ROOT}/runs`,
		runDirectory,
		planPath: `${runDirectory}/plan.json`,
		activationPath: `${runDirectory}/activation.json`,
		lockPath: `${EQUIPMENT_PRODUCTION_ROOT}/runs/.${runId}.activation.lock`
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
	repositoryAbsolute(workspaceRoot, repositoryPath);

	let cursor = root;
	const components = repositoryPath.split('/');
	for (const [index, component] of components.entries()) {
		cursor = path.join(cursor, component);
		const metadata = await lstat(cursor).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		});
		if (metadata === null) return 'absent';
		if (metadata.isSymbolicLink()) {
			throw new Error(`Equipment repository artifacts refuse symbolic links: ${repositoryPath}`);
		}
		const final = index === components.length - 1;
		if (!final && !metadata.isDirectory()) {
			throw new Error(`Equipment repository path component is not a directory: ${repositoryPath}`);
		}
		if (final) {
			if (metadata.isFile()) return 'file';
			if (metadata.isDirectory()) return 'directory';
			throw new Error(`Equipment repository artifact must be a regular file: ${repositoryPath}`);
		}
	}
	return 'absent';
}

async function readRegularRepositoryFile(
	workspaceRoot: string,
	repositoryPath: string
): Promise<Buffer> {
	const state = await pathStateWithoutFollowing(workspaceRoot, repositoryPath);
	if (state !== 'file') {
		throw new Error(`Equipment repository artifact is missing or not a file: ${repositoryPath}`);
	}
	const handle = await open(
		repositoryAbsolute(workspaceRoot, repositoryPath),
		fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW
	);
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile()) {
			throw new Error(`Equipment repository artifact must be a regular file: ${repositoryPath}`);
		}
		return await handle.readFile();
	} finally {
		await handle.close();
	}
}

async function readRepositoryJson(workspaceRoot: string, repositoryPath: string): Promise<unknown> {
	const bytes = await readRegularRepositoryFile(workspaceRoot, repositoryPath);
	try {
		return JSON.parse(bytes.toString('utf8')) as unknown;
	} catch (error) {
		throw new Error(`Invalid JSON in Equipment repository artifact: ${repositoryPath}`, {
			cause: error
		});
	}
}

function assertCanonicalMatch(label: string, actual: unknown, expected: unknown): void {
	if (canonicalJsonSha256(actual) !== canonicalJsonSha256(expected)) {
		throw new Error(`${label} is stale or does not match its deterministic Equipment exporter`);
	}
}

function packetPathForCandidate(
	candidatePath: string,
	directory: 'targets' | 'assignments'
): string {
	const prefix = `${EQUIPMENT_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(prefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid reserved Equipment candidate path: ${candidatePath}`);
	}
	return `${EQUIPMENT_PRODUCTION_ROOT}/${directory}/${candidatePath.slice(prefix.length, -4)}.json`;
}

async function readAndVerifyStaticArtifacts(workspaceRoot: string): Promise<{
	manifest: EquipmentManifest;
	allocation: EquipmentAllocation;
	profile: ReturnType<typeof EquipmentVisualProfileSchema.parse>;
	acceptance: ReturnType<typeof EquipmentVisualProfileAcceptanceSchema.parse>;
}> {
	const [manifestValue, allocationValue, profileValue, acceptanceValue] = await Promise.all([
		readRepositoryJson(workspaceRoot, MANIFEST_PATH),
		readRepositoryJson(workspaceRoot, ALLOCATION_PATH),
		readRepositoryJson(workspaceRoot, PROFILE_PATH),
		readRepositoryJson(workspaceRoot, EQUIPMENT_PROFILE_ACCEPTANCE_PATH)
	]);
	const expectedManifest = buildEquipmentMaterialProductionManifest();
	const expectedAllocation = buildEquipmentMaterialAllocationPlan();
	assertCanonicalMatch('Manifest', manifestValue, expectedManifest);
	assertCanonicalMatch('Allocation plan', allocationValue, expectedAllocation);

	const profile = EquipmentVisualProfileSchema.parse(profileValue);
	const acceptance = EquipmentVisualProfileAcceptanceSchema.parse(acceptanceValue);
	if (
		acceptance.profileId !== profile.profileId ||
		acceptance.profilePath !== PROFILE_PATH ||
		acceptance.profileCanonicalSha256 !== canonicalJsonSha256(profile)
	) {
		throw new Error('Profile acceptance is stale or does not hash-bind the accepted profile');
	}
	for (const reference of profile.references) {
		const bytes = await readRegularRepositoryFile(workspaceRoot, reference.path);
		const byteHash = createHash('sha256').update(bytes).digest('hex');
		if (byteHash !== reference.contentHash) {
			throw new Error(`Accepted profile reference hash is stale: ${reference.path}`);
		}
	}
	return {
		manifest: manifestValue as EquipmentManifest,
		allocation: allocationValue as EquipmentAllocation,
		profile,
		acceptance
	};
}

export async function buildEquipmentRunPlan(
	input: BuildEquipmentRunPlanInput
): Promise<EquipmentRunPlan> {
	const { manifest, allocation, profile, acceptance } = await readAndVerifyStaticArtifacts(
		input.workspaceRoot
	);
	const expectedPackets = buildRootEquipmentPackets({
		manifest,
		allocation,
		profile,
		acceptance
	});
	const rootPackets = await Promise.all(
		expectedPackets.map(async (expectedPacket) => {
			const [targetValue, assignmentValue] = await Promise.all([
				readRepositoryJson(input.workspaceRoot, expectedPacket.targetPath),
				readRepositoryJson(input.workspaceRoot, expectedPacket.assignmentPath)
			]);
			const target = EquipmentImageTargetSchema.parse(targetValue);
			const assignment = EquipmentImageAssignmentSchema.parse(assignmentValue);
			assertCanonicalMatch(
				`Target packet ${expectedPacket.targetPath}`,
				target,
				expectedPacket.target
			);
			assertCanonicalMatch(
				`Assignment packet ${expectedPacket.assignmentPath}`,
				assignment,
				expectedPacket.assignment
			);
			return {
				targetId: target.targetId,
				targetPath: expectedPacket.targetPath,
				targetCanonicalSha256: canonicalJsonSha256(target),
				assignmentPath: expectedPacket.assignmentPath,
				assignmentCanonicalSha256: canonicalJsonSha256(assignment)
			};
		})
	);

	const unmaterializedReviewGatedTargetIds = manifest.targets
		.filter(({ dependsOnTargetId }) => dependsOnTargetId !== null)
		.map(({ targetId }) => targetId);

	const paths = runPaths(input.runId);
	return EquipmentRunPlanSchema.parse({
		schemaVersion: 'equipment-production-run-plan-v1',
		runId: input.runId,
		productionId: manifest.productionId,
		createdAt: input.createdAt,
		maximumConcurrency: 16,
		boundArtifacts: {
			manifestCanonicalSha256: canonicalJsonSha256(manifest),
			allocationCanonicalSha256: canonicalJsonSha256(allocation),
			profileCanonicalSha256: canonicalJsonSha256(profile),
			profileAcceptanceCanonicalSha256: canonicalJsonSha256(acceptance)
		},
		versions: VERSIONS,
		targetIds: manifest.targets.map(({ targetId }) => targetId),
		rootPackets,
		reviewGates: allocation.reviewGates.map((gate) => ({
			gateId: gate.gateId,
			sourceTargetId: gate.sourceTargetId,
			unlocksTargetIds: gate.unlocksTargetIds,
			reviewPath: gate.evidencePath
		})),
		unmaterializedReviewGatedTargetIds,
		reservedPaths: {
			candidates: manifest.targets.map(({ output }) => output.candidatePath),
			results: manifest.targets.map(({ output }) => output.provenanceResultPath),
			reviews: allocation.reviewGates.map(({ evidencePath }) => evidencePath),
			runArtifacts: [paths.planPath, paths.activationPath]
		}
	});
}

async function verifyOutputReservations(
	workspaceRoot: string,
	plan: EquipmentRunPlan
): Promise<Array<{ code: string; message: string; path?: string }>> {
	const blockers: Array<{ code: string; message: string; path?: string }> = [];
	for (let index = 0; index < plan.reservedPaths.candidates.length; index += 1) {
		const candidatePath = plan.reservedPaths.candidates[index]!;
		const resultPath = plan.reservedPaths.results[index]!;
		try {
			const [candidateState, resultState] = await Promise.all([
				pathStateWithoutFollowing(workspaceRoot, candidatePath),
				pathStateWithoutFollowing(workspaceRoot, resultPath)
			]);
			const candidateExists = candidateState !== 'absent';
			const resultExists = resultState !== 'absent';
			if (candidateExists || resultExists) {
				blockers.push({
					code: candidateExists === resultExists ? 'unexpected-output' : 'partial-output',
					message:
						candidateExists === resultExists
							? `Unexpected candidate/result output pair already exists for ${plan.targetIds[index]}`
							: `Partial candidate/result output exists for ${plan.targetIds[index]}`,
					path: candidateExists ? candidatePath : resultPath
				});
			}
		} catch (error) {
			blockers.push({
				code: 'unsafe-output-path',
				message: error instanceof Error ? error.message : String(error),
				path: candidatePath
			});
		}
	}
	return blockers;
}

async function verifyPreActivationChildPacketAbsence(
	workspaceRoot: string,
	plan: EquipmentRunPlan
): Promise<Array<{ code: string; message: string; path?: string }>> {
	const candidateByTargetId = new Map(
		plan.targetIds.map(
			(targetId, index) => [targetId, plan.reservedPaths.candidates[index]!] as const
		)
	);
	const blockers: Array<{ code: string; message: string; path?: string }> = [];
	for (const targetId of plan.unmaterializedReviewGatedTargetIds) {
		const candidatePath = candidateByTargetId.get(targetId);
		if (candidatePath === undefined) {
			blockers.push({
				code: 'premature-child-packet',
				message: `Review-gated child has no deterministic candidate reservation: ${targetId}`
			});
			continue;
		}
		for (const repositoryPath of [
			packetPathForCandidate(candidatePath, 'targets'),
			packetPathForCandidate(candidatePath, 'assignments')
		]) {
			try {
				if ((await pathStateWithoutFollowing(workspaceRoot, repositoryPath)) !== 'absent') {
					blockers.push({
						code: 'premature-child-packet',
						message: `Pre-activation review-gated child packet evidence must be absent: ${repositoryPath}`,
						path: repositoryPath
					});
				}
			} catch (error) {
				blockers.push({
					code: 'premature-child-packet',
					message: error instanceof Error ? error.message : String(error),
					path: repositoryPath
				});
			}
		}
	}
	return blockers;
}

async function verifyActivationEvidence(input: {
	readonly workspaceRoot: string;
	readonly expectedPlan: EquipmentRunPlan;
}): Promise<ActivationEvidenceResult> {
	const paths = runPaths(input.expectedPlan.runId);
	let planState: Awaited<ReturnType<typeof pathStateWithoutFollowing>>;
	let activationState: Awaited<ReturnType<typeof pathStateWithoutFollowing>>;
	try {
		[planState, activationState] = await Promise.all([
			pathStateWithoutFollowing(input.workspaceRoot, paths.planPath),
			pathStateWithoutFollowing(input.workspaceRoot, paths.activationPath)
		]);
	} catch (error) {
		return {
			state: 'invalid',
			blockers: [
				{
					code: 'invalid-activation',
					message: error instanceof Error ? error.message : String(error),
					path: paths.runDirectory
				}
			]
		};
	}
	const planExists = planState !== 'absent';
	const activationExists = activationState !== 'absent';
	if (!planExists && !activationExists) return { state: 'absent', blockers: [] };
	if (planExists !== activationExists) {
		return {
			state: 'invalid',
			blockers: [
				{
					code: 'incomplete-activation',
					message:
						'Incomplete activation: immutable plan and matching receipt must either both exist or both be absent',
					path: paths.runDirectory
				}
			]
		};
	}

	try {
		const persistedPlan = EquipmentRunPlanSchema.parse(
			await readRepositoryJson(input.workspaceRoot, paths.planPath)
		);
		const expectedWithPersistedTime = EquipmentRunPlanSchema.parse({
			...input.expectedPlan,
			createdAt: persistedPlan.createdAt
		});
		assertCanonicalMatch('Persisted immutable run plan', persistedPlan, expectedWithPersistedTime);
		const activation = EquipmentRunActivationSchema.parse(
			await readRepositoryJson(input.workspaceRoot, paths.activationPath)
		);
		if (
			activation.runId !== persistedPlan.runId ||
			activation.runPlanCanonicalSha256 !== canonicalJsonSha256(persistedPlan)
		) {
			throw new Error('Run activation receipt does not hash-bind the persisted immutable plan');
		}
		return { state: 'valid', blockers: [] };
	} catch (error) {
		return {
			state: 'invalid',
			blockers: [
				{
					code: 'invalid-activation',
					message: error instanceof Error ? error.message : String(error),
					path: paths.runDirectory
				}
			]
		};
	}
}

export async function reportEquipmentRunReadiness(
	input: ReportEquipmentRunReadinessInput
): Promise<EquipmentRunReadinessReport> {
	let plan: EquipmentRunPlan;
	try {
		plan = await buildEquipmentRunPlan(input);
	} catch (error) {
		return EquipmentRunReadinessReportSchema.parse({
			schemaVersion: 'equipment-production-run-readiness-report-v1',
			runId: input.runId,
			checkedAt: input.checkedAt,
			status: 'blocked',
			writesPerformed: 0,
			summary: {
				totalJobs: 161,
				materializedRootJobs: 77,
				gatedPieceJobs: 84,
				armourReviewGates: 21,
				maximumConcurrency: 16
			},
			blockers: [
				{
					code: 'static-artifact-invalid',
					message: error instanceof Error ? error.message : String(error)
				}
			]
		});
	}
	const activationEvidence = await verifyActivationEvidence({
		workspaceRoot: input.workspaceRoot,
		expectedPlan: plan
	});
	const blockers = [
		...(await verifyOutputReservations(input.workspaceRoot, plan)),
		...activationEvidence.blockers,
		...(activationEvidence.state !== 'valid'
			? await verifyPreActivationChildPacketAbsence(input.workspaceRoot, plan)
			: [])
	];
	return EquipmentRunReadinessReportSchema.parse({
		schemaVersion: 'equipment-production-run-readiness-report-v1',
		runId: input.runId,
		checkedAt: input.checkedAt,
		status: blockers.length === 0 ? 'ready' : 'blocked',
		writesPerformed: 0,
		summary: {
			totalJobs: 161,
			materializedRootJobs: 77,
			gatedPieceJobs: 84,
			armourReviewGates: 21,
			maximumConcurrency: 16
		},
		blockers
	});
}

async function ensureRealDirectory(workspaceRoot: string, repositoryPath: string): Promise<void> {
	const state = await pathStateWithoutFollowing(workspaceRoot, repositoryPath);
	if (state === 'directory') return;
	if (state !== 'absent') throw new Error(`Run path is not a directory: ${repositoryPath}`);
	try {
		await mkdir(repositoryAbsolute(workspaceRoot, repositoryPath));
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
	}
	if ((await pathStateWithoutFollowing(workspaceRoot, repositoryPath)) !== 'directory') {
		throw new Error(`Run directory creation was replaced or redirected: ${repositoryPath}`);
	}
}

async function exclusiveCreate(
	workspaceRoot: string,
	repositoryPath: string,
	contents: string
): Promise<void> {
	let handle;
	try {
		handle = await open(repositoryAbsolute(workspaceRoot, repositoryPath), 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`Exclusive-create collision: ${repositoryPath}`, { cause: error });
		}
		throw error;
	}
	try {
		await handle.writeFile(contents, 'utf8');
		await handle.sync();
	} finally {
		await handle.close();
	}
}

function serializeJson(value: unknown): string {
	return `${JSON.stringify(value, null, '\t')}\n`;
}

async function verifyPersistedRunPlan(
	workspaceRoot: string,
	planPath: string,
	expectedHash: string
): Promise<void> {
	const persisted = EquipmentRunPlanSchema.parse(await readRepositoryJson(workspaceRoot, planPath));
	if (canonicalJsonSha256(persisted) !== expectedHash) {
		throw new Error('Persisted immutable run plan hash does not match the expected plan');
	}
}

async function releaseOwnedLock(
	workspaceRoot: string,
	lockPath: string,
	identity: FileIdentity
): Promise<void> {
	const absolute = repositoryAbsolute(workspaceRoot, lockPath);
	const metadata = await lstat(absolute).catch((error: NodeJS.ErrnoException) => {
		if (error.code === 'ENOENT') return null;
		throw error;
	});
	if (
		metadata !== null &&
		!metadata.isSymbolicLink() &&
		metadata.isFile() &&
		metadata.dev === identity.device &&
		metadata.ino === identity.inode
	) {
		await unlink(absolute);
	}
}

export async function activateEquipmentRun(
	input: ActivateEquipmentRunInput
): Promise<EquipmentRunActivationResult> {
	const paths = runPaths(input.runId);
	const initialReadiness = await reportEquipmentRunReadiness({
		workspaceRoot: input.workspaceRoot,
		runId: input.runId,
		createdAt: input.createdAt,
		checkedAt: input.activatedAt
	});
	if (initialReadiness.status !== 'ready') {
		throw new Error(
			`Run activation refused by readiness: ${initialReadiness.blockers
				.map(({ message }) => message)
				.join('; ')}`
		);
	}
	await ensureRealDirectory(input.workspaceRoot, EQUIPMENT_PRODUCTION_ROOT);
	await ensureRealDirectory(input.workspaceRoot, paths.runsDirectory);

	let lockHandle;
	try {
		lockHandle = await open(repositoryAbsolute(input.workspaceRoot, paths.lockPath), 'wx');
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
			throw new Error(`Activation lock collision: ${paths.lockPath}`, { cause: error });
		}
		throw error;
	}
	const lockMetadata = await lockHandle.stat();
	const lockIdentity = { device: lockMetadata.dev, inode: lockMetadata.ino };
	try {
		await lockHandle.writeFile(
			serializeJson({
				runId: input.runId,
				activatedBy: input.activatedBy,
				acquiredAt: input.activatedAt
			}),
			'utf8'
		);
		await lockHandle.sync();
		await lockHandle.close();
		lockHandle = undefined;

		const readiness = await reportEquipmentRunReadiness({
			workspaceRoot: input.workspaceRoot,
			runId: input.runId,
			createdAt: input.createdAt,
			checkedAt: input.activatedAt
		});
		if (readiness.status !== 'ready') {
			throw new Error(
				`Run activation refused by readiness: ${readiness.blockers.map(({ message }) => message).join('; ')}`
			);
		}

		const runPlan = await buildEquipmentRunPlan(input);
		const expectedHash = canonicalJsonSha256(runPlan);
		await ensureRealDirectory(input.workspaceRoot, paths.runDirectory);
		await exclusiveCreate(input.workspaceRoot, paths.planPath, serializeJson(runPlan));
		await verifyPersistedRunPlan(input.workspaceRoot, paths.planPath, expectedHash);

		const activation: EquipmentRunActivation = EquipmentRunActivationSchema.parse({
			schemaVersion: 'equipment-production-run-activation-v1',
			activationId: `${input.runId}-activation`,
			runId: input.runId,
			runPlanCanonicalSha256: expectedHash,
			activatedAt: input.activatedAt,
			activatedBy: input.activatedBy
		});
		await exclusiveCreate(input.workspaceRoot, paths.activationPath, serializeJson(activation));
		return {
			runId: input.runId,
			planPath: paths.planPath,
			activationPath: paths.activationPath,
			runPlanCanonicalSha256: expectedHash,
			writesPerformed: 2
		};
	} finally {
		if (lockHandle !== undefined) await lockHandle.close();
		await releaseOwnedLock(input.workspaceRoot, paths.lockPath, lockIdentity);
	}
}
