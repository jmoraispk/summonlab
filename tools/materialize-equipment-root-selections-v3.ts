import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentCandidateRevisionPlanV3Schema,
	EquipmentProvenanceResultV3Schema,
	EquipmentRootCandidateSelectionManifestV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	canonicalSha256,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import {
	EQUIPMENT_V3_ROOT_SELECTION_PATH,
	equipmentRevisionPaths
} from './materialize-equipment-rank-first-revisions-v3.js';
import {
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export async function materializeEquipmentRootSelectionsV3(input: {
	workspaceRoot: string;
	planPath: string;
}) {
	const planValue = await readEquipmentRepositoryJson(input.workspaceRoot, input.planPath);
	const plan = EquipmentCandidateRevisionPlanV3Schema.parse(planValue);
	const selections = [];
	for (const revision of plan.revisions) {
		const paths = equipmentRevisionPaths(revision.targetId, revision.attempt);
		const resultValue = await readEquipmentRepositoryJson(input.workspaceRoot, paths.resultPath);
		const result = EquipmentProvenanceResultV3Schema.parse(resultValue);
		if (
			result.targetId !== revision.targetId ||
			result.attempt !== revision.attempt ||
			result.status !== 'succeeded' ||
			!result.output ||
			result.output.path !== paths.candidatePath
		) {
			throw new Error(`Revision result cannot be selected: ${revision.targetId}`);
		}
		const candidateSha256 = fileSha256(
			path.join(input.workspaceRoot, ...paths.candidatePath.split('/'))
		);
		if (candidateSha256 !== result.output.sha256) {
			throw new Error(`Revision candidate hash mismatch: ${revision.targetId}`);
		}
		selections.push({
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
		});
	}
	const manifest = EquipmentRootCandidateSelectionManifestV3Schema.parse({
		schemaVersion: 'equipment-root-candidate-selection-manifest-v3',
		selectionManifestId: 'equipment-v3-root-candidate-selections-v1',
		createdAt: new Date().toISOString(),
		createdBy: 'equipment-producer-audit',
		approvalStatus: 'candidate-only',
		revisionPlan: { path: input.planPath, canonicalSha256: canonicalSha256(planValue) },
		selections
	});
	await exclusiveCreateEquipmentRepositoryFile(
		input.workspaceRoot,
		EQUIPMENT_V3_ROOT_SELECTION_PATH,
		serializeJson(manifest)
	);
	return {
		selectionManifestPath: EQUIPMENT_V3_ROOT_SELECTION_PATH,
		selectionCount: selections.length
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
			await materializeEquipmentRootSelectionsV3({
				workspaceRoot: process.cwd(),
				planPath: option('--plan')
			}),
			null,
			2
		)}\n`
	);
}
