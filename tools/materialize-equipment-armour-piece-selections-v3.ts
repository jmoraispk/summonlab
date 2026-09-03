import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentArmourPieceCandidateSelectionManifestV3Schema,
	EquipmentArmourPieceRevisionPlanV3Schema,
	EquipmentCandidateRevisionAssignmentV3Schema,
	EquipmentProvenanceResultV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	canonicalSha256,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import { equipmentRevisionPaths } from './materialize-equipment-rank-first-revisions-v3.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export const EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH = `${EQUIPMENT_V3_ROOT}/reviews/selections/armour-pieces-v1.json`;

interface ArmourPieceSelection {
	readonly targetId: string;
	readonly selectedAttempt: number;
	readonly candidatePath: string;
	readonly candidateSha256: string;
	readonly assignmentPath: string;
	readonly assignmentSha256: string;
	readonly resultPath: string;
	readonly resultSha256: string;
	readonly reason: string;
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

async function validateSelectionEvidence(
	workspaceRoot: string,
	selection: ArmourPieceSelection,
	expectedRevision?: {
		readonly classification: string;
		readonly correction: string;
	}
) {
	const paths = equipmentRevisionPaths(selection.targetId, selection.selectedAttempt);
	if (
		selection.candidatePath !== paths.candidatePath ||
		selection.assignmentPath !== paths.assignmentPath ||
		selection.resultPath !== paths.resultPath
	) {
		throw new Error(`Armour-piece selection paths are not attempt-scoped: ${selection.targetId}`);
	}
	for (const [repositoryPath, expectedSha256] of [
		[selection.candidatePath, selection.candidateSha256],
		[selection.assignmentPath, selection.assignmentSha256],
		[selection.resultPath, selection.resultSha256]
	] as const) {
		if (fileSha256(path.join(workspaceRoot, ...repositoryPath.split('/'))) !== expectedSha256) {
			throw new Error(`Armour-piece selection evidence hash mismatch: ${selection.targetId}`);
		}
	}
	const assignment = EquipmentCandidateRevisionAssignmentV3Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, selection.assignmentPath)
	);
	const result = EquipmentProvenanceResultV3Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, selection.resultPath)
	);
	if (
		assignment.targetId !== selection.targetId ||
		assignment.attempt !== selection.selectedAttempt ||
		assignment.permittedOutputs.candidatePath !== selection.candidatePath ||
		assignment.permittedOutputs.resultPath !== selection.resultPath ||
		result.targetId !== selection.targetId ||
		result.assignmentId !== assignment.assignmentId ||
		result.attempt !== selection.selectedAttempt ||
		result.status !== 'succeeded' ||
		!result.output ||
		result.output.path !== selection.candidatePath ||
		result.output.sha256 !== selection.candidateSha256 ||
		result.promptSha256 !== assignment.promptSha256
	) {
		throw new Error(`Armour-piece revision result cannot be selected: ${selection.targetId}`);
	}
	if (
		expectedRevision &&
		(assignment.classification !== expectedRevision.classification ||
			assignment.correction !== expectedRevision.correction)
	) {
		throw new Error(`Armour-piece selection revision-plan drift: ${selection.targetId}`);
	}
	return { assignment, result };
}

export async function resolveEquipmentArmourPieceCandidatesV3(workspaceRoot: string) {
	const pieces = buildEquipmentCandidateTargetsV3().filter(
		({ artifactRole }) => artifactRole === 'armour-piece'
	);
	const selectionState = await equipmentRepositoryPathState(
		workspaceRoot,
		EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH
	);
	if (selectionState === 'absent') {
		return {
			manifest: null,
			selections: new Map<string, ArmourPieceSelection>(),
			candidatePaths: new Map(
				pieces.map((target) => [target.targetId, target.output.candidatePath])
			)
		};
	}
	if (selectionState !== 'file') {
		throw new Error('Armour-piece selection manifest is not a regular file');
	}
	const manifest = EquipmentArmourPieceCandidateSelectionManifestV3Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH)
	);
	const planValue = await readEquipmentRepositoryJson(workspaceRoot, manifest.revisionPlan.path);
	if (canonicalSha256(planValue) !== manifest.revisionPlan.canonicalSha256) {
		throw new Error('Armour-piece selection revision-plan hash mismatch');
	}
	const plan = EquipmentArmourPieceRevisionPlanV3Schema.parse(planValue);
	const revisions = new Map(plan.revisions.map((revision) => [revision.targetId, revision]));
	if (
		manifest.selections.length !== plan.revisions.length ||
		manifest.selections.some((selection) => {
			const revision = revisions.get(selection.targetId);
			return !revision || revision.attempt !== selection.selectedAttempt;
		})
	) {
		throw new Error('Armour-piece selections must cover the exact revision plan');
	}
	const pieceIds = new Set(pieces.map(({ targetId }) => targetId));
	for (const selection of manifest.selections) {
		if (!pieceIds.has(selection.targetId)) {
			throw new Error(`Armour-piece selection target is not a piece: ${selection.targetId}`);
		}
		await validateSelectionEvidence(workspaceRoot, selection, revisions.get(selection.targetId));
	}
	const selections = new Map(
		manifest.selections.map((selection) => [selection.targetId, selection])
	);
	return {
		manifest,
		selections,
		candidatePaths: new Map(
			pieces.map((target) => [
				target.targetId,
				selections.get(target.targetId)?.candidatePath ?? target.output.candidatePath
			])
		)
	};
}

export async function materializeEquipmentArmourPieceSelectionsV3(input: {
	workspaceRoot: string;
	planPath: string;
}) {
	const planValue = await readEquipmentRepositoryJson(input.workspaceRoot, input.planPath);
	const plan = EquipmentArmourPieceRevisionPlanV3Schema.parse(planValue);
	const pieces = new Set(
		buildEquipmentCandidateTargetsV3()
			.filter(({ artifactRole }) => artifactRole === 'armour-piece')
			.map(({ targetId }) => targetId)
	);
	const selections = [];
	for (const revision of plan.revisions) {
		if (!pieces.has(revision.targetId)) {
			throw new Error(`Selection plan target is not an Armour piece: ${revision.targetId}`);
		}
		const paths = equipmentRevisionPaths(revision.targetId, revision.attempt);
		const candidateSha256 = fileSha256(
			path.join(input.workspaceRoot, ...paths.candidatePath.split('/'))
		);
		const selection = {
			targetId: revision.targetId,
			selectedAttempt: revision.attempt,
			candidatePath: paths.candidatePath,
			candidateSha256,
			assignmentPath: paths.assignmentPath,
			assignmentSha256: fileSha256(
				path.join(input.workspaceRoot, ...paths.assignmentPath.split('/'))
			),
			resultPath: paths.resultPath,
			resultSha256: fileSha256(path.join(input.workspaceRoot, ...paths.resultPath.split('/'))),
			reason: `${revision.classification}: ${revision.correction}`
		};
		await validateSelectionEvidence(input.workspaceRoot, selection, revision);
		selections.push(selection);
	}
	const manifest = EquipmentArmourPieceCandidateSelectionManifestV3Schema.parse({
		schemaVersion: 'equipment-armour-piece-candidate-selection-manifest-v3',
		selectionManifestId: 'equipment-v3-armour-piece-candidate-selections-v1',
		createdAt: new Date().toISOString(),
		createdBy: 'equipment-armour-piece-audit',
		approvalStatus: 'candidate-only',
		revisionPlan: { path: input.planPath, canonicalSha256: canonicalSha256(planValue) },
		selections
	});
	if (
		(await equipmentRepositoryPathState(
			input.workspaceRoot,
			EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH
		)) !== 'absent'
	) {
		throw new Error(
			`Armour-piece selection manifest collision: ${EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH}`
		);
	}
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH,
		serializeJson(manifest)
	);
	return {
		selectionManifestPath: EQUIPMENT_V3_ARMOUR_PIECE_SELECTION_PATH,
		selectionCount: selections.length
	};
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	process.stdout.write(
		`${JSON.stringify(
			await materializeEquipmentArmourPieceSelectionsV3({
				workspaceRoot: process.cwd(),
				planPath: option('--plan')
			}),
			null,
			2
		)}\n`
	);
}
