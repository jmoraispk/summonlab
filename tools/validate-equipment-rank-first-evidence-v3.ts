import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCheckpointReceiptV3Schema,
	EquipmentDirectionResultV3Schema,
	EquipmentProvenanceResultV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_CLASSES,
	EQUIPMENT_CLASS_DIRECTIONS_V3,
	EQUIPMENT_MATERIAL_BRIEFS_V3,
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	fileSha256
} from './equipment-rank-first-production-v3.js';
import { readEquipmentRepositoryJson } from './equipment-repository-io.js';

type Phase = 'directions' | 'roots' | 'pieces' | 'closeout';

async function verifyPng(input: {
	workspaceRoot: string;
	repositoryPath: string;
	sha256?: string;
	width?: number;
	height?: number;
}) {
	const absolute = path.join(input.workspaceRoot, ...input.repositoryPath.split('/'));
	const [bytes, metadata] = await Promise.all([readFile(absolute), sharp(absolute).metadata()]);
	if (metadata.format !== 'png' || !metadata.width || !metadata.height) {
		throw new Error(`Invalid PNG evidence: ${input.repositoryPath}`);
	}
	if (input.sha256 && fileSha256(absolute) !== input.sha256) {
		throw new Error(`PNG hash mismatch: ${input.repositoryPath}`);
	}
	if (input.width && metadata.width !== input.width) {
		throw new Error(`PNG width mismatch: ${input.repositoryPath}`);
	}
	if (input.height && metadata.height !== input.height) {
		throw new Error(`PNG height mismatch: ${input.repositoryPath}`);
	}
	return { bytes: bytes.byteLength, width: metadata.width, height: metadata.height };
}

async function verifyDirections(workspaceRoot: string) {
	let generated = 0;
	let acceptedExperimental = 0;
	let revisionAttempts = 0;
	for (const direction of EQUIPMENT_CLASS_DIRECTIONS_V3) {
		if (direction.status === 'owner-accepted') {
			await verifyPng({
				workspaceRoot,
				repositoryPath: direction.imagePath,
				sha256: direction.sha256!
			});
			acceptedExperimental += 1;
			continue;
		}
		const resultPath = `${EQUIPMENT_V3_ROOT}/direction/class-progressions/${direction.classId}.result.json`;
		const result = EquipmentDirectionResultV3Schema.parse(
			await readEquipmentRepositoryJson(workspaceRoot, resultPath)
		);
		if (result.status !== 'succeeded' || !result.output) {
			throw new Error(`Direction is not successful: ${direction.classId}`);
		}
		if (result.output.path !== direction.imagePath) {
			throw new Error(`Direction result path mismatch: ${direction.classId}`);
		}
		await verifyPng({
			workspaceRoot,
			repositoryPath: direction.imagePath,
			sha256: result.output.sha256,
			width: 1536,
			height: 1024
		});
		for (const reference of result.references) {
			if (fileSha256(path.join(workspaceRoot, ...reference.path.split('/'))) !== reference.sha256) {
				throw new Error(`Direction reference hash mismatch: ${reference.path}`);
			}
		}
		generated += 1;
		revisionAttempts += Math.max(0, result.attempt - 1);
	}
	return { directionCount: 11, acceptedExperimental, generated, revisionAttempts };
}

async function verifyCandidateGroup(
	workspaceRoot: string,
	targets: ReturnType<typeof buildEquipmentCandidateTargetsV3>
) {
	let bytes = 0;
	for (const target of targets) {
		const assignment = EquipmentCandidateAssignmentV3Schema.parse(
			await readEquipmentRepositoryJson(workspaceRoot, target.output.assignmentPath)
		);
		const result = EquipmentProvenanceResultV3Schema.parse(
			await readEquipmentRepositoryJson(workspaceRoot, target.output.provenanceResultPath)
		);
		if (
			assignment.targetId !== target.targetId ||
			result.targetId !== target.targetId ||
			result.assignmentId !== assignment.assignmentId ||
			result.status !== 'succeeded' ||
			!result.output ||
			result.output.path !== target.output.candidatePath ||
			result.promptSha256 !== assignment.promptSha256
		) {
			throw new Error(`Candidate packet/result mismatch: ${target.targetId}`);
		}
		const verified = await verifyPng({
			workspaceRoot,
			repositoryPath: target.output.candidatePath,
			sha256: result.output.sha256,
			width: target.width,
			height: target.height
		});
		bytes += verified.bytes;
	}
	return { candidateCount: targets.length, bytes };
}

async function verifyRoots(workspaceRoot: string) {
	const roots = buildEquipmentCandidateTargetsV3().filter(
		({ dependsOnTargetId }) => dependsOnTargetId === null
	);
	const candidates = await verifyCandidateGroup(workspaceRoot, roots);
	for (const classId of EQUIPMENT_CLASSES) {
		await verifyPng({
			workspaceRoot,
			repositoryPath: `${EQUIPMENT_V3_ROOT}/reviews/class-audits/${classId}-f-to-s-v3.png`
		});
	}
	for (const brief of EQUIPMENT_MATERIAL_BRIEFS_V3) {
		await verifyPng({
			workspaceRoot,
			repositoryPath: `${EQUIPMENT_V3_ROOT}/reviews/material-audits/${brief.rank.toLowerCase()}-${brief.materialId}-v3.png`
		});
	}
	return { ...candidates, classAuditCount: 11, materialAuditCount: 28 };
}

async function verifyPieces(workspaceRoot: string) {
	const targets = buildEquipmentCandidateTargetsV3();
	const pieces = targets.filter(({ artifactRole }) => artifactRole === 'armour-piece');
	const candidates = await verifyCandidateGroup(workspaceRoot, pieces);
	for (const source of targets.filter(({ artifactRole }) => artifactRole === 'set-source')) {
		await verifyPng({
			workspaceRoot,
			repositoryPath: `${EQUIPMENT_V3_ROOT}/reviews/armour-piece-audits/${source.rank.toLowerCase()}-${source.setId}-v3.png`
		});
	}
	return { ...candidates, armourAuditCount: 21 };
}

async function verifyCheckpoint(workspaceRoot: string, number: 1 | 2 | 3) {
	const names = ['directions', 'roots', 'armour-pieces'] as const;
	const receipt = EquipmentCheckpointReceiptV3Schema.parse(
		await readEquipmentRepositoryJson(
			workspaceRoot,
			`${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-${number}-${names[number - 1]}.json`
		)
	);
	const expected = [4, 77, 84][number - 1]!;
	if (receipt.decisions.length !== expected) {
		throw new Error(`Checkpoint ${number} decision count drift`);
	}
	for (const decision of receipt.decisions) {
		if (
			fileSha256(path.join(workspaceRoot, ...decision.imagePath.split('/'))) !==
			decision.imageSha256
		) {
			throw new Error(`Checkpoint ${number} decision hash drift: ${decision.subjectId}`);
		}
	}
	return receipt.summary;
}

export async function validateEquipmentRankFirstEvidenceV3(input: {
	workspaceRoot: string;
	phase: Phase;
}) {
	const directions = await verifyDirections(input.workspaceRoot);
	if (input.phase === 'directions') return { phase: input.phase, directions };
	const roots = await verifyRoots(input.workspaceRoot);
	if (input.phase === 'roots') {
		return {
			phase: input.phase,
			directions,
			roots,
			checkpoint1: await verifyCheckpoint(input.workspaceRoot, 1)
		};
	}
	const pieces = await verifyPieces(input.workspaceRoot);
	if (input.phase === 'pieces') {
		return {
			phase: input.phase,
			directions,
			roots,
			pieces,
			checkpoint1: await verifyCheckpoint(input.workspaceRoot, 1),
			checkpoint2: await verifyCheckpoint(input.workspaceRoot, 2)
		};
	}
	return {
		phase: input.phase,
		directions,
		roots,
		pieces,
		checkpoint1: await verifyCheckpoint(input.workspaceRoot, 1),
		checkpoint2: await verifyCheckpoint(input.workspaceRoot, 2),
		checkpoint3: await verifyCheckpoint(input.workspaceRoot, 3),
		reconciled: {
			generatedDirectionCount: 4,
			acceptedExperimentalDirectionCount: 7,
			rootCandidateCount: 77,
			armourPieceCandidateCount: 84,
			totalGeneratedEvidenceCount: 172,
			deterministicAuditCount: 60
		}
	};
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const index = process.argv.indexOf('--phase');
	const phase = index >= 0 ? (process.argv[index + 1] as Phase) : undefined;
	if (!phase || !['directions', 'roots', 'pieces', 'closeout'].includes(phase)) {
		throw new Error('Usage: ... --phase (directions|roots|pieces|closeout)');
	}
	process.stdout.write(
		`${JSON.stringify(await validateEquipmentRankFirstEvidenceV3({ workspaceRoot: process.cwd(), phase }), null, 2)}\n`
	);
}
