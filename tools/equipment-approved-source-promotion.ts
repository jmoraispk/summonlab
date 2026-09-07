import { createHash } from 'node:crypto';
import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

import {
	EQUIPMENT_APPROVED_MANIFEST_PATH,
	EQUIPMENT_APPROVED_RECEIPT_PATH,
	EQUIPMENT_APPROVED_ROOT,
	EquipmentApprovedPromotionPlanV1Schema,
	EquipmentApprovedPromotionReceiptV1Schema,
	EquipmentApprovedSourceManifestV1Schema,
	type EquipmentApprovedSourceRecordV1
} from './equipment-approved-source-contract.js';
import {
	EquipmentCandidatePromotionProposalV3Schema,
	EquipmentCheckpointReceiptV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	buildEquipmentV3Manifest,
	canonicalJson,
	canonicalSha256
} from './equipment-rank-first-production-v3.js';
import {
	equipmentRepositoryPathState,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

type CanonicalJsonReference = { readonly path: string; readonly canonicalSha256: string };

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
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

async function readCanonicalReference(
	workspaceRoot: string,
	reference: CanonicalJsonReference,
	label: string
): Promise<unknown> {
	const value = await readEquipmentRepositoryJson(workspaceRoot, reference.path);
	if (canonicalSha256(value) !== reference.canonicalSha256) {
		throw new Error(`${label} canonical hash mismatch: ${reference.path}`);
	}
	return value;
}

function assertAcceptedCheckpoint(input: {
	label: string;
	receipt: ReturnType<typeof EquipmentCheckpointReceiptV3Schema.parse>;
	expectedId: string;
	expectedCount: number;
	manifestCanonicalSha256: string;
}): void {
	if (
		input.receipt.checkpointId !== input.expectedId ||
		input.receipt.manifestCanonicalSha256 !== input.manifestCanonicalSha256 ||
		input.receipt.decisions.length !== input.expectedCount ||
		input.receipt.summary.accept !== input.expectedCount ||
		input.receipt.summary.revise !== 0 ||
		input.receipt.summary.defer !== 0 ||
		input.receipt.decisions.some(({ decision }) => decision !== 'accept')
	) {
		throw new Error(`${input.label} checkpoint is not the exact accepted receipt`);
	}
}

function assertRecordMatchesTarget(
	record: EquipmentApprovedSourceRecordV1,
	target: ReturnType<typeof buildEquipmentV3Manifest>['targets'][number]
): void {
	const expectedRole = target.artifactRole === 'set-source' ? 'armour-set-reference' : 'item';
	if (
		record.targetId !== target.targetId ||
		record.role !== expectedRole ||
		record.rank !== target.rank ||
		record.materialId !== target.materialId ||
		record.equipmentClass !== target.classId ||
		record.artifactId !== target.artifactId ||
		record.slot !== target.slot ||
		record.assetKey !== approvedAssetKey(target) ||
		record.approved.path !== approvedPath(target) ||
		record.approved.width !== target.width ||
		record.approved.height !== target.height
	) {
		throw new Error(`Approved Equipment record differs from target: ${target.targetId}`);
	}
}

async function collectManagedFiles(
	workspaceRoot: string,
	repositoryPath: string
): Promise<string[]> {
	const absolute = path.join(workspaceRoot, ...repositoryPath.split('/'));
	const state = await equipmentRepositoryPathState(workspaceRoot, repositoryPath);
	if (state === 'absent') return [];
	if (state !== 'directory') {
		throw new Error(`Managed approved path is not a directory: ${repositoryPath}`);
	}
	const files: string[] = [];
	async function walk(directory: string, prefix: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const childAbsolute = path.join(directory, entry.name);
			const childPath = `${prefix}/${entry.name}`;
			const metadata = await lstat(childAbsolute);
			if (metadata.isSymbolicLink()) {
				throw new Error(`Managed approved path refuses symlink: ${childPath}`);
			}
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
	const allowedFiles = new Set(['manifest.json', 'integration-report.json']);
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
	await assertApprovedRootLayout(workspaceRoot);
	const manifestValue = await readEquipmentRepositoryJson(
		workspaceRoot,
		EQUIPMENT_APPROVED_MANIFEST_PATH
	);
	const manifest = EquipmentApprovedSourceManifestV1Schema.parse(manifestValue);
	const receipt = EquipmentApprovedPromotionReceiptV1Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_APPROVED_RECEIPT_PATH)
	);
	if (
		receipt.approvedManifest.path !== EQUIPMENT_APPROVED_MANIFEST_PATH ||
		receipt.approvedManifest.canonicalSha256 !== canonicalSha256(manifestValue) ||
		canonicalJson(receipt.sourceProposal) !== canonicalJson(manifest.sourceProposal) ||
		canonicalJson(receipt.summary) !== canonicalJson(manifest.summary)
	) {
		throw new Error('Approved Equipment manifest/receipt binding mismatch');
	}

	const sourceManifestValue = await readCanonicalReference(
		workspaceRoot,
		manifest.sourceManifest,
		'Equipment v3 source manifest'
	);
	const expectedManifest = buildEquipmentV3Manifest();
	if (canonicalJson(sourceManifestValue) !== canonicalJson(expectedManifest)) {
		throw new Error('Equipment v3 source manifest differs from its deterministic contract');
	}
	const manifestCanonicalSha256 = canonicalSha256(sourceManifestValue);
	if (receipt.checkpoints.roots.path === receipt.checkpoints.armourPieces.path) {
		throw new Error('Equipment owner checkpoints must be distinct');
	}

	const proposal = EquipmentCandidatePromotionProposalV3Schema.parse(
		await readCanonicalReference(
			workspaceRoot,
			manifest.sourceProposal,
			'Equipment promotion proposal'
		)
	);
	const checkpoints = {
		directions: EquipmentCheckpointReceiptV3Schema.parse(
			await readCanonicalReference(
				workspaceRoot,
				receipt.checkpoints.directions,
				'Equipment directions checkpoint'
			)
		),
		roots: EquipmentCheckpointReceiptV3Schema.parse(
			await readCanonicalReference(
				workspaceRoot,
				receipt.checkpoints.roots,
				'Equipment roots checkpoint'
			)
		),
		armourPieces: EquipmentCheckpointReceiptV3Schema.parse(
			await readCanonicalReference(
				workspaceRoot,
				receipt.checkpoints.armourPieces,
				'Equipment armour checkpoint'
			)
		)
	};
	assertAcceptedCheckpoint({
		label: 'Directions',
		receipt: checkpoints.directions,
		expectedId: 'equipment-v3-checkpoint-1-directions',
		expectedCount: 4,
		manifestCanonicalSha256
	});
	assertAcceptedCheckpoint({
		label: 'Roots',
		receipt: checkpoints.roots,
		expectedId: 'equipment-v3-checkpoint-2-roots',
		expectedCount: 77,
		manifestCanonicalSha256
	});
	assertAcceptedCheckpoint({
		label: 'Armour pieces',
		receipt: checkpoints.armourPieces,
		expectedId: 'equipment-v3-checkpoint-3-armour-pieces',
		expectedCount: 84,
		manifestCanonicalSha256
	});
	if (
		proposal.entries.length !== 161 ||
		proposal.checkpoint3.path !== receipt.checkpoints.armourPieces.path ||
		proposal.checkpoint3.canonicalSha256 !== receipt.checkpoints.armourPieces.canonicalSha256
	) {
		throw new Error('Equipment promotion proposal/checkpoint binding mismatch');
	}

	const targetById = new Map(expectedManifest.targets.map((target) => [target.targetId, target]));
	const proposalById = new Map(proposal.entries.map((entry) => [entry.targetId, entry]));
	const rootDecisions = new Map(
		checkpoints.roots.decisions.map((decision) => [decision.subjectId, decision])
	);
	const armourDecisions = new Map(
		checkpoints.armourPieces.decisions.map((decision) => [decision.subjectId, decision])
	);
	let retiredCandidateCount = 0;
	for (const record of manifest.records) {
		const target = targetById.get(record.targetId);
		const selected = proposalById.get(record.targetId);
		if (!target || !selected) {
			throw new Error(
				`Approved Equipment target is missing from frozen provenance: ${record.targetId}`
			);
		}
		assertRecordMatchesTarget(record, target);
		const checkpointReference =
			target.artifactRole === 'armour-piece'
				? receipt.checkpoints.armourPieces
				: receipt.checkpoints.roots;
		const decision =
			target.artifactRole === 'armour-piece'
				? armourDecisions.get(record.targetId)
				: rootDecisions.get(record.targetId);
		if (
			selected.candidatePath !== record.candidate.path ||
			selected.candidateSha256 !== record.candidate.sha256 ||
			record.checkpoint.path !== checkpointReference.path ||
			record.checkpoint.canonicalSha256 !== checkpointReference.canonicalSha256 ||
			!decision ||
			decision.decision !== 'accept' ||
			decision.imagePath !== record.candidate.path ||
			decision.imageSha256 !== record.candidate.sha256
		) {
			throw new Error(`Approved Equipment selection binding mismatch: ${record.targetId}`);
		}
		if ((await equipmentRepositoryPathState(workspaceRoot, record.candidate.path)) !== 'absent') {
			throw new Error(`Retired Equipment candidate is still present: ${record.candidate.path}`);
		}
		retiredCandidateCount += 1;
		const bytes = await readEquipmentRepositoryFile(workspaceRoot, record.approved.path);
		const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
		if (
			bytes.byteLength !== record.approved.bytes ||
			sha256(bytes) !== record.approved.sha256 ||
			metadata.format !== 'png' ||
			metadata.width !== record.approved.width ||
			metadata.height !== record.approved.height
		) {
			throw new Error(`Approved Equipment source mismatch: ${record.assetKey}`);
		}
	}

	const historicalPlan = EquipmentApprovedPromotionPlanV1Schema.parse({
		schemaVersion: 'equipment-approved-promotion-plan-v1',
		planId: 'material-equipment-v1-approved-promotion-v1',
		authorization: receipt.authorization,
		sourceProposal: manifest.sourceProposal,
		sourceManifest: manifest.sourceManifest,
		checkpoints: receipt.checkpoints,
		summary: manifest.summary,
		entries: manifest.records
	});
	if (canonicalSha256(historicalPlan) !== receipt.planCanonicalSha256) {
		throw new Error('Historical Equipment promotion plan hash mismatch');
	}

	const expected = new Set([
		...manifest.records.map(({ approved }) => approved.path),
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
		planCanonicalSha256: receipt.planCanonicalSha256,
		manifestCanonicalSha256: canonicalSha256(manifestValue),
		verified: manifest.summary.total,
		...manifest.summary,
		retiredCandidateCount,
		unexpectedFiles: 0
	};
}
