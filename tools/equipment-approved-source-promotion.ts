import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import sharp, { type Metadata } from 'sharp';

import {
	EQUIPMENT_APPROVED_MANIFEST_PATH,
	EQUIPMENT_APPROVED_RECEIPT_PATH,
	EQUIPMENT_APPROVED_ROOT,
	EQUIPMENT_PROMOTION_APPROVAL_COMMIT,
	EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256,
	EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256,
	EQUIPMENT_PROMOTION_DESIGN_PATH,
	EQUIPMENT_PROMOTION_PLAN_PATH,
	EQUIPMENT_PROMOTION_TOOL_VERSION,
	EquipmentApprovedPromotionPlanV1Schema,
	EquipmentApprovedPromotionReceiptV1Schema,
	EquipmentApprovedSourceManifestV1Schema,
	type EquipmentApprovedPromotionPlanV1,
	type EquipmentApprovedPromotionReceiptV1,
	type EquipmentApprovedSourceManifestV1,
	type EquipmentApprovedSourceRecordV1
} from './equipment-approved-source-contract.js';
import {
	EquipmentCandidatePromotionProposalV3Schema,
	EquipmentCheckpointReceiptV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_MANIFEST_PATH,
	EQUIPMENT_V3_ROOT,
	buildEquipmentV3Manifest,
	canonicalJson,
	canonicalSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';
import { resolveEquipmentCheckpointImagePathsV3 } from './record-equipment-rank-first-checkpoint-v3.js';

const execFile = promisify(execFileCallback);

export const EQUIPMENT_PROMOTION_PROPOSAL_PATH =
	`${EQUIPMENT_V3_ROOT}/reviews/proposed-promotions/candidate-promotion-v1.json` as const;
export const EQUIPMENT_CHECKPOINT_1_PATH =
	`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-1-directions.json` as const;
export const EQUIPMENT_CHECKPOINT_2_PATH =
	`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-2-roots.json` as const;
export const EQUIPMENT_CHECKPOINT_3_PATH =
	`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-3-armour-pieces.json` as const;

const CHECKPOINT_PATHS = {
	directions: EQUIPMENT_CHECKPOINT_1_PATH,
	roots: EQUIPMENT_CHECKPOINT_2_PATH,
	armourPieces: EQUIPMENT_CHECKPOINT_3_PATH
} as const;

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

async function rawFileSha256(workspaceRoot: string, repositoryPath: string): Promise<string> {
	return sha256(await readEquipmentRepositoryFile(workspaceRoot, repositoryPath));
}

async function readCheckpoint(workspaceRoot: string, repositoryPath: string) {
	const value = await readEquipmentRepositoryJson(workspaceRoot, repositoryPath);
	return {
		value: EquipmentCheckpointReceiptV3Schema.parse(value),
		canonicalSha256: canonicalSha256(value)
	};
}

function approvedPath(
	target: ReturnType<typeof buildEquipmentV3Manifest>['targets'][number]
): string {
	const rank = target.rank.toLowerCase();
	if (target.artifactRole === 'set-source') {
		return `${EQUIPMENT_APPROVED_ROOT}/armour-set-references/${rank}/${target.materialId}/${target.classId}.png`;
	}
	return `${EQUIPMENT_APPROVED_ROOT}/items/${rank}/${target.materialId}/${target.artifactId}.png`;
}

function approvedAssetKey(
	target: ReturnType<typeof buildEquipmentV3Manifest>['targets'][number]
): string {
	const suffix =
		target.artifactRole === 'set-source' ? `${target.classId}-set-reference` : target.artifactId;
	return `equipment-v1-${target.rank.toLowerCase()}-${target.materialId}-${suffix}`;
}

function assertExactAcceptedCheckpoint(input: {
	label: string;
	receipt: ReturnType<typeof EquipmentCheckpointReceiptV3Schema.parse>;
	expectedId: string;
	expectedCount: number;
	manifestCanonicalSha256: string;
}): void {
	if (input.receipt.checkpointId !== input.expectedId) {
		throw new Error(`${input.label} checkpoint ID mismatch`);
	}
	if (input.receipt.manifestCanonicalSha256 !== input.manifestCanonicalSha256) {
		throw new Error(`${input.label} checkpoint manifest hash mismatch`);
	}
	if (
		input.receipt.decisions.length !== input.expectedCount ||
		input.receipt.summary.accept !== input.expectedCount ||
		input.receipt.summary.revise !== 0 ||
		input.receipt.summary.defer !== 0 ||
		input.receipt.decisions.some(({ decision }) => decision !== 'accept')
	) {
		throw new Error(
			`${input.label} checkpoint must contain exactly ${input.expectedCount} accepts`
		);
	}
}

async function verifyCheckpointResolvers(
	workspaceRoot: string,
	checkpoint2: ReturnType<typeof EquipmentCheckpointReceiptV3Schema.parse>,
	checkpoint3: ReturnType<typeof EquipmentCheckpointReceiptV3Schema.parse>
): Promise<void> {
	for (const [checkpoint, receipt] of [
		['2', checkpoint2],
		['3', checkpoint3]
	] as const) {
		const resolved = await resolveEquipmentCheckpointImagePathsV3(workspaceRoot, checkpoint);
		for (const decision of receipt.decisions) {
			if (resolved.get(decision.subjectId) !== decision.imagePath) {
				throw new Error(`Checkpoint ${checkpoint} selected path drift: ${decision.subjectId}`);
			}
		}
	}
}

export async function buildEquipmentApprovedPromotionPlan(
	workspaceRoot = process.cwd()
): Promise<EquipmentApprovedPromotionPlanV1> {
	const manifestValue = await readEquipmentRepositoryJson(
		workspaceRoot,
		EQUIPMENT_V3_MANIFEST_PATH
	);
	const expectedManifest = buildEquipmentV3Manifest();
	if (canonicalJson(manifestValue) !== canonicalJson(expectedManifest)) {
		throw new Error('Equipment v3 manifest differs from the deterministic production manifest');
	}
	const manifestCanonicalSha256 = canonicalSha256(manifestValue);
	const proposalValue = await readEquipmentRepositoryJson(
		workspaceRoot,
		EQUIPMENT_PROMOTION_PROPOSAL_PATH
	);
	const proposal = EquipmentCandidatePromotionProposalV3Schema.parse(proposalValue);
	if (proposal.entries.length !== 161) {
		throw new Error(
			`Promotion proposal must contain exactly 161 entries, found ${proposal.entries.length}`
		);
	}
	const [checkpoint1, checkpoint2, checkpoint3] = await Promise.all([
		readCheckpoint(workspaceRoot, EQUIPMENT_CHECKPOINT_1_PATH),
		readCheckpoint(workspaceRoot, EQUIPMENT_CHECKPOINT_2_PATH),
		readCheckpoint(workspaceRoot, EQUIPMENT_CHECKPOINT_3_PATH)
	]);
	assertExactAcceptedCheckpoint({
		label: 'Directions',
		receipt: checkpoint1.value,
		expectedId: 'equipment-v3-checkpoint-1-directions',
		expectedCount: 4,
		manifestCanonicalSha256
	});
	assertExactAcceptedCheckpoint({
		label: 'Roots',
		receipt: checkpoint2.value,
		expectedId: 'equipment-v3-checkpoint-2-roots',
		expectedCount: 77,
		manifestCanonicalSha256
	});
	assertExactAcceptedCheckpoint({
		label: 'Armour pieces',
		receipt: checkpoint3.value,
		expectedId: 'equipment-v3-checkpoint-3-armour-pieces',
		expectedCount: 84,
		manifestCanonicalSha256
	});
	if (
		proposal.checkpoint3.path !== EQUIPMENT_CHECKPOINT_3_PATH ||
		proposal.checkpoint3.canonicalSha256 !== checkpoint3.canonicalSha256
	) {
		throw new Error('Promotion proposal checkpoint 3 hash or path mismatch');
	}
	await verifyCheckpointResolvers(workspaceRoot, checkpoint2.value, checkpoint3.value);

	const proposalByTarget = new Map(proposal.entries.map((entry) => [entry.targetId, entry]));
	const checkpoint2ByTarget = new Map(
		checkpoint2.value.decisions.map((decision) => [decision.subjectId, decision])
	);
	const checkpoint3ByTarget = new Map(
		checkpoint3.value.decisions.map((decision) => [decision.subjectId, decision])
	);
	const records: EquipmentApprovedSourceRecordV1[] = [];
	for (const target of expectedManifest.targets) {
		const selected = proposalByTarget.get(target.targetId);
		if (!selected) throw new Error(`Promotion proposal is missing target: ${target.targetId}`);
		const checkpointCanonicalSha256 =
			target.artifactRole === 'armour-piece'
				? checkpoint3.canonicalSha256
				: checkpoint2.canonicalSha256;
		const checkpointPath =
			target.artifactRole === 'armour-piece'
				? EQUIPMENT_CHECKPOINT_3_PATH
				: EQUIPMENT_CHECKPOINT_2_PATH;
		const decision =
			target.artifactRole === 'armour-piece'
				? checkpoint3ByTarget.get(target.targetId)
				: checkpoint2ByTarget.get(target.targetId);
		if (!decision || decision.decision !== 'accept') {
			throw new Error(`Target lacks an accepted checkpoint decision: ${target.targetId}`);
		}
		if (
			decision.imagePath !== selected.candidatePath ||
			decision.imageSha256 !== selected.candidateSha256
		) {
			throw new Error(`Proposal/checkpoint path or hash mismatch: ${target.targetId}`);
		}
		const candidateBytes = await readEquipmentRepositoryFile(workspaceRoot, selected.candidatePath);
		const candidateSha256 = sha256(candidateBytes);
		if (candidateSha256 !== selected.candidateSha256) {
			throw new Error(`Selected candidate hash mismatch: ${target.targetId}`);
		}
		let metadata: Metadata;
		try {
			metadata = await sharp(candidateBytes, { failOn: 'error' }).metadata();
		} catch (error) {
			throw new Error(`Selected candidate is not a decodable PNG: ${target.targetId}`, {
				cause: error
			});
		}
		if (
			metadata.format !== 'png' ||
			metadata.width !== target.width ||
			metadata.height !== target.height
		) {
			throw new Error(
				`Selected candidate dimensions or format mismatch: ${target.targetId}; expected ${target.width}x${target.height} PNG`
			);
		}
		const role = target.artifactRole === 'set-source' ? 'armour-set-reference' : 'item';
		records.push({
			schemaVersion: 'equipment-approved-source-record-v1',
			assetKey: approvedAssetKey(target),
			role,
			targetId: target.targetId,
			rank: target.rank,
			materialId: target.materialId,
			equipmentClass: target.classId,
			artifactId: target.artifactId,
			slot: target.slot,
			candidate: { path: selected.candidatePath, sha256: candidateSha256 },
			checkpoint: { path: checkpointPath, canonicalSha256: checkpointCanonicalSha256 },
			approvedPath: approvedPath(target),
			approved: {
				path: approvedPath(target),
				width: target.width,
				height: target.height,
				bytes: candidateBytes.byteLength,
				sha256: candidateSha256
			}
		} as EquipmentApprovedSourceRecordV1);
	}
	if (proposalByTarget.size !== records.length) {
		throw new Error('Promotion proposal contains targets outside the Equipment v3 manifest');
	}
	const totalBytes = records.reduce((total, record) => total + record.approved.bytes, 0);
	const designSha256 = await rawFileSha256(workspaceRoot, EQUIPMENT_PROMOTION_DESIGN_PATH);
	const implementationPlanSha256 = await rawFileSha256(
		workspaceRoot,
		EQUIPMENT_PROMOTION_PLAN_PATH
	);
	if (
		designSha256 !== EQUIPMENT_PROMOTION_APPROVED_DESIGN_SHA256 ||
		implementationPlanSha256 !== EQUIPMENT_PROMOTION_APPROVED_PLAN_SHA256
	) {
		throw new Error('Equipment promotion authorization documents differ from the approved commit');
	}
	return EquipmentApprovedPromotionPlanV1Schema.parse({
		schemaVersion: 'equipment-approved-promotion-plan-v1',
		planId: 'material-equipment-v1-approved-promotion-v1',
		authorization: {
			design: {
				path: EQUIPMENT_PROMOTION_DESIGN_PATH,
				sha256: designSha256
			},
			implementationPlan: {
				path: EQUIPMENT_PROMOTION_PLAN_PATH,
				sha256: implementationPlanSha256
			},
			approvalCommit: EQUIPMENT_PROMOTION_APPROVAL_COMMIT
		},
		sourceProposal: {
			path: EQUIPMENT_PROMOTION_PROPOSAL_PATH,
			canonicalSha256: canonicalSha256(proposalValue)
		},
		sourceManifest: {
			path: EQUIPMENT_V3_MANIFEST_PATH,
			canonicalSha256: manifestCanonicalSha256
		},
		checkpoints: {
			directions: {
				path: EQUIPMENT_CHECKPOINT_1_PATH,
				canonicalSha256: checkpoint1.canonicalSha256
			},
			roots: {
				path: EQUIPMENT_CHECKPOINT_2_PATH,
				canonicalSha256: checkpoint2.canonicalSha256
			},
			armourPieces: {
				path: EQUIPMENT_CHECKPOINT_3_PATH,
				canonicalSha256: checkpoint3.canonicalSha256
			}
		},
		summary: {
			total: records.length,
			items: records.filter(({ role }) => role === 'item').length,
			armourSetReferences: records.filter(({ role }) => role === 'armour-set-reference').length,
			totalBytes
		},
		entries: records
	});
}

export function equipmentApprovedPromotionPlanSha256(
	plan: EquipmentApprovedPromotionPlanV1
): string {
	return canonicalSha256(plan);
}

async function gitValue(workspaceRoot: string, args: readonly string[]): Promise<string> {
	const { stdout } = await execFile('git', ['-C', workspaceRoot, ...args]);
	return stdout.trim();
}

async function assertAuthorizedCleanRepository(workspaceRoot: string) {
	const status = await gitValue(workspaceRoot, ['status', '--porcelain']);
	if (status.length > 0) throw new Error('Approved-source promotion requires a clean worktree');
	await execFile('git', [
		'-C',
		workspaceRoot,
		'merge-base',
		'--is-ancestor',
		EQUIPMENT_PROMOTION_APPROVAL_COMMIT,
		'HEAD'
	]);
	return {
		branch: await gitValue(workspaceRoot, ['branch', '--show-current']),
		basisCommit: await gitValue(workspaceRoot, ['rev-parse', 'HEAD'])
	};
}

async function assertDestinationsAbsent(
	workspaceRoot: string,
	plan: EquipmentApprovedPromotionPlanV1
): Promise<void> {
	for (const repositoryPath of [
		...plan.entries.map(({ approved }) => approved.path),
		EQUIPMENT_APPROVED_MANIFEST_PATH,
		EQUIPMENT_APPROVED_RECEIPT_PATH
	]) {
		if ((await equipmentRepositoryPathState(workspaceRoot, repositoryPath)) !== 'absent') {
			throw new Error(`Approved-source destination collision: ${repositoryPath}`);
		}
	}
}

export async function writeEquipmentApprovedSources(input: {
	workspaceRoot?: string;
	expectedPlanSha256: string;
	createdAt: string;
	createdBy: string;
}): Promise<{
	manifest: EquipmentApprovedSourceManifestV1;
	receipt: EquipmentApprovedPromotionReceiptV1;
}> {
	const workspaceRoot = input.workspaceRoot ?? process.cwd();
	const plan = await buildEquipmentApprovedPromotionPlan(workspaceRoot);
	const planCanonicalSha256 = equipmentApprovedPromotionPlanSha256(plan);
	if (input.expectedPlanSha256 !== planCanonicalSha256) {
		throw new Error('Expected promotion plan SHA-256 does not match the rebuilt plan');
	}
	const repository = await assertAuthorizedCleanRepository(workspaceRoot);
	await assertDestinationsAbsent(workspaceRoot, plan);
	const manifest = EquipmentApprovedSourceManifestV1Schema.parse({
		schemaVersion: 'equipment-approved-source-manifest-v1',
		catalogId: 'material-equipment-v1',
		createdAt: input.createdAt,
		createdBy: input.createdBy,
		sourceProposal: plan.sourceProposal,
		sourceManifest: plan.sourceManifest,
		summary: plan.summary,
		records: plan.entries
	});
	const manifestCanonicalSha256 = canonicalSha256(manifest);
	const receipt = EquipmentApprovedPromotionReceiptV1Schema.parse({
		schemaVersion: 'equipment-approved-promotion-receipt-v1',
		receiptId: 'material-equipment-v1-approved-promotion-v1',
		createdAt: input.createdAt,
		createdBy: input.createdBy,
		toolVersion: EQUIPMENT_PROMOTION_TOOL_VERSION,
		authorization: plan.authorization,
		repository,
		planCanonicalSha256,
		approvedManifest: {
			path: EQUIPMENT_APPROVED_MANIFEST_PATH,
			canonicalSha256: manifestCanonicalSha256
		},
		sourceProposal: plan.sourceProposal,
		checkpoints: plan.checkpoints,
		summary: plan.summary
	});

	// The planner has already read, decoded, hashed, and dimension-checked every source. All
	// destinations are preflighted before this first write, then created exclusively.
	for (const record of plan.entries) {
		const bytes = await readEquipmentRepositoryFile(workspaceRoot, record.candidate.path);
		if (sha256(bytes) !== record.candidate.sha256 || bytes.byteLength !== record.approved.bytes) {
			throw new Error(`Candidate changed after preflight: ${record.targetId}`);
		}
		await exclusiveCreateEquipmentRepositoryFile(workspaceRoot, record.approved.path, bytes);
	}
	await exclusiveCreateEquipmentRepositoryFile(
		workspaceRoot,
		EQUIPMENT_APPROVED_MANIFEST_PATH,
		serializeJson(manifest)
	);
	await exclusiveCreateEquipmentRepositoryFile(
		workspaceRoot,
		EQUIPMENT_APPROVED_RECEIPT_PATH,
		serializeJson(receipt)
	);
	return { manifest, receipt };
}

async function collectManagedFiles(
	workspaceRoot: string,
	repositoryPath: string
): Promise<string[]> {
	const absolute = path.join(workspaceRoot, ...repositoryPath.split('/'));
	const state = await equipmentRepositoryPathState(workspaceRoot, repositoryPath);
	if (state === 'absent') return [];
	if (state !== 'directory')
		throw new Error(`Managed approved path is not a directory: ${repositoryPath}`);
	const files: string[] = [];
	async function walk(directory: string, prefix: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const childAbsolute = path.join(directory, entry.name);
			const childPath = `${prefix}/${entry.name}`;
			const metadata = await lstat(childAbsolute);
			if (metadata.isSymbolicLink())
				throw new Error(`Managed approved path refuses symlink: ${childPath}`);
			if (metadata.isDirectory()) await walk(childAbsolute, childPath);
			else if (metadata.isFile()) files.push(childPath);
			else throw new Error(`Unsupported managed approved file type: ${childPath}`);
		}
	}
	await walk(absolute, repositoryPath);
	return files;
}

async function assertApprovedRootLayout(workspaceRoot: string): Promise<void> {
	const state = await equipmentRepositoryPathState(workspaceRoot, EQUIPMENT_APPROVED_ROOT);
	if (state !== 'directory') throw new Error('Approved Equipment root must be a directory');
	const allowedFiles = new Set(['manifest.json']);
	const allowedDirectories = new Set(['items', 'armour-set-references', 'receipts', 'reviews']);
	const absolute = path.join(workspaceRoot, ...EQUIPMENT_APPROVED_ROOT.split('/'));
	for (const entry of await readdir(absolute, { withFileTypes: true })) {
		const metadata = await lstat(path.join(absolute, entry.name));
		if (metadata.isSymbolicLink()) {
			throw new Error(`Approved Equipment root refuses symlink: ${entry.name}`);
		}
		if (metadata.isFile() && allowedFiles.has(entry.name)) continue;
		if (metadata.isDirectory() && allowedDirectories.has(entry.name)) continue;
		throw new Error(`Unexpected approved Equipment root entry: ${entry.name}`);
	}
}

export async function checkEquipmentApprovedSources(workspaceRoot = process.cwd()) {
	const plan = await buildEquipmentApprovedPromotionPlan(workspaceRoot);
	await assertApprovedRootLayout(workspaceRoot);
	const manifestValue = await readEquipmentRepositoryJson(
		workspaceRoot,
		EQUIPMENT_APPROVED_MANIFEST_PATH
	);
	const manifest = EquipmentApprovedSourceManifestV1Schema.parse(manifestValue);
	if (
		canonicalJson(manifest.records) !== canonicalJson(plan.entries) ||
		canonicalJson(manifest.summary) !== canonicalJson(plan.summary) ||
		canonicalJson(manifest.sourceProposal) !== canonicalJson(plan.sourceProposal) ||
		canonicalJson(manifest.sourceManifest) !== canonicalJson(plan.sourceManifest)
	) {
		throw new Error('Approved-source manifest differs from the rebuilt promotion plan');
	}
	for (const record of plan.entries) {
		const bytes = await readEquipmentRepositoryFile(workspaceRoot, record.approved.path);
		if (bytes.byteLength !== record.approved.bytes || sha256(bytes) !== record.approved.sha256) {
			throw new Error(`Approved-source file differs from selected candidate: ${record.assetKey}`);
		}
	}
	const receipt = EquipmentApprovedPromotionReceiptV1Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_APPROVED_RECEIPT_PATH)
	);
	if (
		receipt.planCanonicalSha256 !== equipmentApprovedPromotionPlanSha256(plan) ||
		receipt.approvedManifest.canonicalSha256 !== canonicalSha256(manifestValue) ||
		canonicalJson(receipt.authorization) !== canonicalJson(plan.authorization) ||
		canonicalJson(receipt.checkpoints) !== canonicalJson(plan.checkpoints) ||
		canonicalJson(receipt.sourceProposal) !== canonicalJson(plan.sourceProposal) ||
		canonicalJson(receipt.summary) !== canonicalJson(plan.summary)
	) {
		throw new Error('Approved-source promotion receipt binding mismatch');
	}
	const expected = new Set([
		...plan.entries.map(({ approved }) => approved.path),
		EQUIPMENT_APPROVED_RECEIPT_PATH
	]);
	const managedFiles = (
		await Promise.all(
			['items', 'armour-set-references', 'receipts'].map((directory) =>
				collectManagedFiles(workspaceRoot, `${EQUIPMENT_APPROVED_ROOT}/${directory}`)
			)
		)
	).flat();
	const unexpected = managedFiles.filter((repositoryPath) => !expected.has(repositoryPath));
	if (unexpected.length > 0) {
		throw new Error(`Unexpected managed approved-source files: ${unexpected.join(', ')}`);
	}
	return {
		planCanonicalSha256: equipmentApprovedPromotionPlanSha256(plan),
		manifestCanonicalSha256: canonicalSha256(manifestValue),
		verified: plan.summary.total,
		...plan.summary,
		unexpectedFiles: 0
	};
}
