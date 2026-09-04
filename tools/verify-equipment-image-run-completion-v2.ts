import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { EquipmentV2ImageTargetSchema } from './equipment-image-production-contract-v2.js';
import { verifyPersistedEquipmentImageResultEvidenceV2 } from './equipment-image-result-v2.js';
import {
	EquipmentV2RunPlanSchema,
	EQUIPMENT_V2_RUN_PLAN_PATH
} from './equipment-image-run-activation-v2.js';
import {
	equipmentV2TerminalJournalPath,
	verifyPersistedEquipmentV2TerminalJournalEntry
} from './equipment-image-terminal-journal-v2.js';
import {
	equipmentRepositoryPathState,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export async function verifyEquipmentImageRunCompletionV2(input: {
	readonly workspaceRoot: string;
	readonly runId: string;
}) {
	const plan = EquipmentV2RunPlanSchema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_RUN_PLAN_PATH(input.runId))
	);
	const statuses = { candidate: 0, revise: 0, failed: 0 };
	const failedTargetIds: string[] = [];
	for (const binding of plan.rootPackets) {
		const target = EquipmentV2ImageTargetSchema.parse(
			await readEquipmentRepositoryJson(input.workspaceRoot, binding.targetPath)
		);
		const resultPath = target.output.provenanceResultPath;
		const result = await verifyPersistedEquipmentImageResultEvidenceV2({
			workspaceRoot: input.workspaceRoot,
			targetPath: binding.targetPath,
			assignmentPath: binding.assignmentPath,
			resultPath
		});
		statuses[result.status] += 1;
		if (result.status === 'failed') failedTargetIds.push(result.targetId);
		await verifyPersistedEquipmentV2TerminalJournalEntry({
			workspaceRoot: input.workspaceRoot,
			targetPath: binding.targetPath,
			assignmentPath: binding.assignmentPath,
			resultPath,
			journalPath: equipmentV2TerminalJournalPath(input.runId, binding.targetId),
			runId: input.runId
		});
	}
	for (const targetId of plan.gatedChildTargetIds) {
		const index = plan.targetIds.indexOf(targetId);
		const candidatePath = plan.reservedPaths.candidates[index]!;
		for (const packetPath of [
			candidatePath.replace('/candidates/', '/targets/').replace(/\.png$/u, '.json'),
			candidatePath.replace('/candidates/', '/assignments/').replace(/\.png$/u, '.json')
		]) {
			if ((await equipmentRepositoryPathState(input.workspaceRoot, packetPath)) !== 'absent') {
				throw new Error(`Gated child packet unexpectedly exists: ${packetPath}`);
			}
		}
	}
	for (const reviewPath of plan.reservedPaths.reviews) {
		if ((await equipmentRepositoryPathState(input.workspaceRoot, reviewPath)) !== 'absent') {
			throw new Error(`Human review evidence unexpectedly exists: ${reviewPath}`);
		}
	}
	return {
		runId: input.runId,
		rootTargets: plan.rootPackets.length,
		verifiedResults: plan.rootPackets.length,
		verifiedTerminalReceipts: plan.rootPackets.length,
		imageFiles: statuses.candidate + statuses.revise,
		statuses,
		failedTargetIds,
		gatedChildrenRemaining: plan.gatedChildTargetIds.length,
		humanReviewsWritten: 0
	};
}

function option(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : undefined;
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	const runId = option('--run-id') ?? 'material-equipment-v2-run-001';
	const report = await verifyEquipmentImageRunCompletionV2({
		workspaceRoot: option('--workspace-root') ?? process.cwd(),
		runId
	});
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
