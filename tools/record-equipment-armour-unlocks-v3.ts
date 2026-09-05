import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentArmourSetUnlockReceiptV3Schema,
	EquipmentArmourSourceChecksV3Schema,
	EquipmentCheckpointReceiptV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_ARMOUR_SLOTS,
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

const CHECKPOINT_2_PATH = `${EQUIPMENT_V3_ROOT}/checkpoints/checkpoint-2-roots.json`;

export function equipmentArmourUnlockPath(rank: string, setId: string): string {
	return `${EQUIPMENT_V3_ROOT}/unlocks/${rank.toLowerCase()}/${setId}.json`;
}

export async function recordEquipmentArmourUnlocksV3(input: {
	workspaceRoot: string;
	checksPath: string;
	acceptedAt: string;
	acceptedBy: string;
}) {
	const checkpoint = EquipmentCheckpointReceiptV3Schema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, CHECKPOINT_2_PATH)
	);
	if (checkpoint.checkpointId !== 'equipment-v3-checkpoint-2-roots') {
		throw new Error('Armour unlocks require the checkpoint-2 root receipt');
	}
	const checks = EquipmentArmourSourceChecksV3Schema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, input.checksPath)
	);
	const targets = buildEquipmentCandidateTargetsV3();
	const sources = targets.filter(({ artifactRole }) => artifactRole === 'set-source');
	const expectedIds = sources.map(({ targetId }) => targetId);
	if (
		checks.checks.length !== expectedIds.length ||
		expectedIds.some(
			(targetId) => !checks.checks.some((check) => check.sourceTargetId === targetId)
		)
	) {
		throw new Error('Armour checks do not cover the exact 21 full-set sources');
	}
	const checkpointSha256 = fileSha256(
		path.join(input.workspaceRoot, ...CHECKPOINT_2_PATH.split('/'))
	);
	const receipts = [];
	for (const source of sources) {
		const decision = checkpoint.decisions.find(({ subjectId }) => subjectId === source.targetId);
		if (!decision || decision.decision !== 'accept') {
			throw new Error(`Full-set source is not owner-accepted: ${source.targetId}`);
		}
		if (
			fileSha256(path.join(input.workspaceRoot, ...decision.imagePath.split('/'))) !==
			decision.imageSha256
		) {
			throw new Error(`Checkpoint source hash mismatch: ${source.targetId}`);
		}
		const check = checks.checks.find(({ sourceTargetId }) => sourceTargetId === source.targetId)!;
		const classAuditPath = `${EQUIPMENT_V3_ROOT}/reviews/class-audits/final/${source.classId}-f-to-s-v3.png`;
		const materialAuditPath = `${EQUIPMENT_V3_ROOT}/reviews/material-audits/final/${source.rank.toLowerCase()}-${source.materialId}-v3.png`;
		const children = targets
			.filter(({ dependsOnTargetId }) => dependsOnTargetId === source.targetId)
			.sort(
				(a, b) => EQUIPMENT_ARMOUR_SLOTS.indexOf(a.slot!) - EQUIPMENT_ARMOUR_SLOTS.indexOf(b.slot!)
			);
		if (
			children.length !== 4 ||
			children.some(({ slot }, index) => slot !== EQUIPMENT_ARMOUR_SLOTS[index])
		) {
			throw new Error(
				`Full-set source does not own the exact four ordered slots: ${source.targetId}`
			);
		}
		const receipt = EquipmentArmourSetUnlockReceiptV3Schema.parse({
			schemaVersion: 'equipment-armour-set-unlock-receipt-v3',
			setId: source.setId,
			sourceTargetId: source.targetId,
			sourceCandidatePath: decision.imagePath,
			sourceCandidateSha256: decision.imageSha256,
			checkpoint2Receipt: { path: CHECKPOINT_2_PATH, sha256: checkpointSha256 },
			classAudit: {
				path: classAuditPath,
				sha256: fileSha256(path.join(input.workspaceRoot, ...classAuditPath.split('/')))
			},
			materialAudit: {
				path: materialAuditPath,
				sha256: fileSha256(path.join(input.workspaceRoot, ...materialAuditPath.split('/')))
			},
			classAuditDecision: 'accept',
			materialAuditDecision: 'accept',
			emptySetCheck: check.emptySetCheck,
			fourComponentCheck: check.fourComponentCheck,
			reviewNotes: check.notes,
			acceptedAt: input.acceptedAt,
			acceptedBy: input.acceptedBy,
			unlocksTargetIds: children.map(({ targetId }) => targetId)
		});
		const receiptPath = equipmentArmourUnlockPath(source.rank, source.setId!);
		if ((await equipmentRepositoryPathState(input.workspaceRoot, receiptPath)) !== 'absent') {
			throw new Error(`Armour unlock receipt collision: ${receiptPath}`);
		}
		receipts.push({ receiptPath, receipt });
	}
	for (const { receiptPath, receipt } of receipts) {
		await exclusiveCreateEquipmentRepositoryFile(
			input.workspaceRoot,
			receiptPath,
			serializeJson(receipt)
		);
	}
	return {
		unlockReceiptCount: receipts.length,
		unlockedPieceCount: receipts.reduce(
			(count, { receipt }) => count + receipt.unlocksTargetIds.length,
			0
		),
		receiptPaths: receipts.map(({ receiptPath }) => receiptPath)
	};
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
	process.stdout.write(
		`${JSON.stringify(
			await recordEquipmentArmourUnlocksV3({
				workspaceRoot: process.cwd(),
				checksPath: option('--checks'),
				acceptedAt: option('--accepted-at'),
				acceptedBy: option('--accepted-by')
			}),
			null,
			2
		)}\n`
	);
}
