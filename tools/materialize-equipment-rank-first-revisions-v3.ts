import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCandidateRevisionAssignmentV3Schema,
	EquipmentCandidateRevisionPlanV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	canonicalSha256,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export const EQUIPMENT_V3_ROOT_SELECTION_PATH =
	`${EQUIPMENT_V3_ROOT}/reviews/selections/root-audit-v1.json`;

export function equipmentRevisionPaths(targetId: string, attempt: number) {
	const prefix = `${EQUIPMENT_V3_ROOT}/revisions/${targetId}/attempt-${attempt}`;
	return {
		assignmentPath: `${prefix}/assignment.json`,
		promptPath: `${prefix}/prompt.txt`,
		candidatePath: `${prefix}/candidate.png`,
		resultPath: `${prefix}/result.json`
	} as const;
}

export async function materializeEquipmentRankFirstRevisionsV3(input: {
	workspaceRoot: string;
	planPath: string;
}) {
	const planValue = await readEquipmentRepositoryJson(input.workspaceRoot, input.planPath);
	const plan = EquipmentCandidateRevisionPlanV3Schema.parse(planValue);
	for (const auditPath of [...plan.classAuditBasis, ...plan.materialAuditBasis]) {
		fileSha256(path.join(input.workspaceRoot, ...auditPath.split('/')));
	}
	const targets = new Map(buildEquipmentCandidateTargetsV3().map((target) => [target.targetId, target]));
	const packets = [];
	for (const revision of plan.revisions) {
		const target = targets.get(revision.targetId);
		if (!target || target.dependsOnTargetId !== null) {
			throw new Error(`Revision plan target is not a root: ${revision.targetId}`);
		}
		const baseAssignmentValue = await readEquipmentRepositoryJson(
			input.workspaceRoot,
			target.output.assignmentPath
		);
		const baseAssignment = EquipmentCandidateAssignmentV3Schema.parse(baseAssignmentValue);
		const revisionSource = {
			path: target.output.candidatePath,
			sha256: fileSha256(
				path.join(input.workspaceRoot, ...target.output.candidatePath.split('/'))
			),
			purpose:
				'First-pass candidate retained as immutable evidence; correct only the stated audit issue.'
		};
		const references = [
			baseAssignment.classDirection,
			baseAssignment.finishReference,
			...(baseAssignment.consistencySource ? [baseAssignment.consistencySource] : []),
			revisionSource
		];
		const prompt = `${baseAssignment.prompt}

REVISION PASS ${revision.attempt}. The attached first-pass candidate is immutable evidence, not an output template. Preserve its successful material identity, finish, framing, pose, and class recognition while correcting this exact audited issue: ${revision.correction}

Return one new dedicated candidate only. Do not make unrelated redesigns, add extra objects, add text, or imitate recognizable copyrighted geometry.`;
		const paths = equipmentRevisionPaths(target.targetId, revision.attempt);
		const assignment = EquipmentCandidateRevisionAssignmentV3Schema.parse({
			schemaVersion: 'equipment-rank-first-revision-assignment-v3',
			assignmentId: `revision-assignment-${target.targetId}-attempt-${revision.attempt}`,
			targetId: target.targetId,
			attempt: revision.attempt,
			immutable: true,
			baseAssignment: {
				path: target.output.assignmentPath,
				canonicalSha256: canonicalSha256(baseAssignmentValue)
			},
			materialBrief: baseAssignment.materialBrief,
			revisionSource,
			references,
			classification: revision.classification,
			correction: revision.correction,
			prompt,
			promptSha256: createHash('sha256').update(prompt).digest('hex'),
			permittedOutputs: {
				candidatePath: paths.candidatePath,
				resultPath: paths.resultPath
			},
			forbiddenActions: [
				'overwrite the first-pass candidate or result',
				'write outside the attempt-scoped Equipment v3 revision directory',
				'promote a candidate to approved or runtime state',
				'edit shared catalogs, engine contracts, or another visual domain'
			]
		});
		for (const repositoryPath of [
			paths.assignmentPath,
			paths.promptPath,
			paths.candidatePath,
			paths.resultPath
		]) {
			if ((await equipmentRepositoryPathState(input.workspaceRoot, repositoryPath)) !== 'absent') {
				throw new Error(`Revision path collision: ${repositoryPath}`);
			}
		}
		packets.push({ target, revision, assignment, paths });
	}
	for (const packet of packets) {
		await exclusiveCreateEquipmentRepositoryFile(
			input.workspaceRoot,
			packet.paths.assignmentPath,
			serializeJson(packet.assignment)
		);
		await exclusiveCreateEquipmentRepositoryFile(
			input.workspaceRoot,
			packet.paths.promptPath,
			`${packet.assignment.prompt}\n`
		);
	}
	return {
		revisionPlanId: plan.revisionPlanId,
		assignmentCount: packets.length,
		assignments: packets.map(({ target, revision, paths }) => ({
			targetId: target.targetId,
			attempt: revision.attempt,
			...paths
		}))
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
			await materializeEquipmentRankFirstRevisionsV3({
				workspaceRoot: process.cwd(),
				planPath: option('--plan')
			}),
			null,
			2
		)}\n`
	);
}
