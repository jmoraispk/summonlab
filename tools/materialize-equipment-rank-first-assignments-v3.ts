import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentArmourSetUnlockReceiptV3Schema,
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCheckpointReceiptV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_CLASS_DIRECTIONS_V3,
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateAssignmentV3,
	buildEquipmentCandidateTargetsV3,
	fileSha256,
	serializeJson,
	type AcceptedReferenceV3,
	type EquipmentClass
} from './equipment-rank-first-production-v3.js';
import {
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

const CHECKPOINT_1_PATH = `${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-1-directions.json`;

async function acceptedDirections(
	workspaceRoot: string
): Promise<Map<EquipmentClass, AcceptedReferenceV3>> {
	const receipt = EquipmentCheckpointReceiptV3Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, CHECKPOINT_1_PATH)
	);
	if (
		receipt.checkpointId !== 'equipment-v3-checkpoint-1-directions' ||
		receipt.decisions.some(({ decision }) => decision !== 'accept')
	)
		throw new Error('All four checkpoint-1 directions must be owner-accepted');
	const references = new Map<EquipmentClass, AcceptedReferenceV3>();
	for (const direction of EQUIPMENT_CLASS_DIRECTIONS_V3) {
		if (direction.status === 'owner-accepted') {
			references.set(direction.classId, {
				path: direction.imagePath,
				sha256: direction.sha256!,
				purpose: direction.acceptanceScope
			});
			continue;
		}
		const decision = receipt.decisions.find(
			({ subjectId }) => subjectId === `equipment-v3-${direction.classId}-rank-progression`
		);
		if (!decision || decision.imagePath !== direction.imagePath)
			throw new Error(`Checkpoint-1 path mismatch for ${direction.classId}`);
		if (
			fileSha256(path.join(workspaceRoot, ...decision.imagePath.split('/'))) !==
			decision.imageSha256
		)
			throw new Error(`Checkpoint-1 hash mismatch for ${direction.classId}`);
		references.set(direction.classId, {
			path: decision.imagePath,
			sha256: decision.imageSha256,
			purpose: direction.acceptanceScope
		});
	}
	return references;
}

async function writeAssignment(
	workspaceRoot: string,
	target: ReturnType<typeof buildEquipmentCandidateTargetsV3>[number],
	assignment: ReturnType<typeof buildEquipmentCandidateAssignmentV3>
) {
	EquipmentCandidateAssignmentV3Schema.parse(assignment);
	await exclusiveCreateEquipmentRepositoryFile(
		workspaceRoot,
		target.output.assignmentPath,
		serializeJson(assignment)
	);
	await exclusiveCreateEquipmentRepositoryFile(
		workspaceRoot,
		target.output.promptPath,
		`${assignment.prompt}\n`
	);
}

export async function materializeEquipmentRootAssignmentsV3(workspaceRoot: string) {
	const directions = await acceptedDirections(workspaceRoot);
	const roots = buildEquipmentCandidateTargetsV3().filter(
		({ dependsOnTargetId }) => dependsOnTargetId === null
	);
	for (const target of roots) {
		const classDirection = directions.get(target.classId);
		if (!classDirection) throw new Error(`No accepted direction for ${target.classId}`);
		await writeAssignment(
			workspaceRoot,
			target,
			buildEquipmentCandidateAssignmentV3({ target, classDirection })
		);
	}
	return { assignmentCount: roots.length, promptCount: roots.length };
}

export async function materializeEquipmentArmourPieceAssignmentsV3(input: {
	workspaceRoot: string;
	unlockReceiptPath: string;
}) {
	const unlock = EquipmentArmourSetUnlockReceiptV3Schema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, input.unlockReceiptPath)
	);
	const directions = await acceptedDirections(input.workspaceRoot);
	const targets = buildEquipmentCandidateTargetsV3();
	const source = targets.find(({ targetId }) => targetId === unlock.sourceTargetId);
	if (!source || source.artifactRole !== 'set-source' || source.setId !== unlock.setId)
		throw new Error('Unlock receipt does not identify a v3 full-set source');
	if (
		source.output.candidatePath !== unlock.sourceCandidatePath ||
		fileSha256(path.join(input.workspaceRoot, ...unlock.sourceCandidatePath.split('/'))) !==
			unlock.sourceCandidateSha256
	)
		throw new Error('Unlock source path/hash mismatch');
	const children = targets.filter(({ dependsOnTargetId }) => dependsOnTargetId === source.targetId);
	if (children.map(({ targetId }) => targetId).some((id) => !unlock.unlocksTargetIds.includes(id)))
		throw new Error('Unlock receipt does not cover the exact four children');
	const classDirection = directions.get(source.classId);
	if (!classDirection) throw new Error(`No accepted direction for ${source.classId}`);
	const consistencySource = {
		path: unlock.sourceCandidatePath,
		sha256: unlock.sourceCandidateSha256,
		purpose: 'Owner-accepted full Armour set; authoritative source for piece reconstruction.'
	};
	for (const target of children)
		await writeAssignment(
			input.workspaceRoot,
			target,
			buildEquipmentCandidateAssignmentV3({ target, classDirection, consistencySource })
		);
	return { setId: source.setId, assignmentCount: children.length, promptCount: children.length };
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const command = process.argv[2];
	const output =
		command === 'roots'
			? await materializeEquipmentRootAssignmentsV3(process.cwd())
			: command === 'armour-set'
				? await materializeEquipmentArmourPieceAssignmentsV3({
						workspaceRoot: process.cwd(),
						unlockReceiptPath: option('--unlock-receipt')
					})
				: (() => {
						throw new Error('Usage: ... (roots|armour-set --unlock-receipt PATH)');
					})();
	process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
