import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentArmourPieceRevisionPlanV3Schema,
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCandidateRevisionAssignmentV3Schema
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

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

export async function materializeEquipmentArmourPieceRevisionsV3(input: {
	workspaceRoot: string;
	planPath: string;
}) {
	const planValue = await readEquipmentRepositoryJson(input.workspaceRoot, input.planPath);
	const plan = EquipmentArmourPieceRevisionPlanV3Schema.parse(planValue);
	for (const reviewPath of plan.reviewBasis) {
		fileSha256(path.join(input.workspaceRoot, ...reviewPath.split('/')));
	}
	const targets = new Map(
		buildEquipmentCandidateTargetsV3().map((target) => [target.targetId, target])
	);
	const packets = [];
	for (const revision of plan.revisions) {
		const target = targets.get(revision.targetId);
		if (!target || target.artifactRole !== 'armour-piece' || !target.dependsOnTargetId) {
			throw new Error(`Revision plan target is not an Armour piece: ${revision.targetId}`);
		}
		const sourceTarget = targets.get(target.dependsOnTargetId);
		if (
			!sourceTarget ||
			sourceTarget.artifactRole !== 'set-source' ||
			sourceTarget.setId !== target.setId
		) {
			throw new Error(`Armour-piece dependency is not its full-set source: ${revision.targetId}`);
		}
		const baseAssignmentValue = await readEquipmentRepositoryJson(
			input.workspaceRoot,
			target.output.assignmentPath
		);
		const baseAssignment = EquipmentCandidateAssignmentV3Schema.parse(baseAssignmentValue);
		if (
			baseAssignment.targetId !== target.targetId ||
			baseAssignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
			baseAssignment.permittedOutputs.resultPath !== target.output.provenanceResultPath ||
			!baseAssignment.consistencySource
		) {
			throw new Error(`Armour-piece base assignment mismatch: ${revision.targetId}`);
		}
		const fullSetRevisionPrefix = `${EQUIPMENT_V3_ROOT}/revisions/${sourceTarget.targetId}/`;
		if (
			baseAssignment.consistencySource.path !== sourceTarget.output.candidatePath &&
			(!baseAssignment.consistencySource.path.startsWith(fullSetRevisionPrefix) ||
				!baseAssignment.consistencySource.path.endsWith('/candidate.png'))
		) {
			throw new Error(`Armour-piece consistency source is not its full set: ${revision.targetId}`);
		}
		if (
			createHash('sha256').update(baseAssignment.prompt).digest('hex') !==
			baseAssignment.promptSha256
		) {
			throw new Error(`Armour-piece base prompt hash mismatch: ${revision.targetId}`);
		}
		for (const reference of [
			baseAssignment.classDirection,
			baseAssignment.finishReference,
			baseAssignment.consistencySource
		]) {
			if (
				fileSha256(path.join(input.workspaceRoot, ...reference.path.split('/'))) !==
				reference.sha256
			) {
				throw new Error(`Armour-piece base reference hash mismatch: ${reference.path}`);
			}
		}
		const baseCandidateState = await equipmentRepositoryPathState(
			input.workspaceRoot,
			target.output.candidatePath
		);
		if (baseCandidateState === 'directory') {
			throw new Error(`Armour-piece base candidate is not a file: ${target.output.candidatePath}`);
		}
		const hasBaseCandidate = baseCandidateState === 'file';
		const revisionSource = hasBaseCandidate
			? {
					path: target.output.candidatePath,
					sha256: fileSha256(
						path.join(input.workspaceRoot, ...target.output.candidatePath.split('/'))
					),
					purpose:
						'First-pass Armour-piece candidate retained as immutable evidence; correct only the stated review issue.'
				}
			: {
					...baseAssignment.consistencySource,
					purpose:
						'Base Armour-piece candidate is absent; reconstruct the corrected piece from the owner-accepted full set.'
				};
		const references = [
			baseAssignment.consistencySource,
			...(hasBaseCandidate ? [revisionSource] : []),
			baseAssignment.classDirection,
			baseAssignment.finishReference
		];
		const sourceInstruction = hasBaseCandidate
			? 'The attached first-pass piece candidate is immutable evidence. Preserve every successful source-faithful trait while changing only the audited defect.'
			: 'No first-pass piece candidate exists. Reconstruct the corrected piece directly from the attached owner-accepted full set, preserving its exact slot boundary and all source-faithful traits.';
		const prompt = `${baseAssignment.prompt}

REVISION PASS ${revision.attempt}. ${sourceInstruction}

Correct this exact audited issue: ${revision.correction}

The owner-accepted full set remains the first and authoritative reference. Return one new isolated ${target.slot} candidate only. Do not make unrelated redesigns, add another Armour slot, add a body or mannequin, add text, or imitate recognizable copyrighted geometry.`;
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
				'overwrite the first-pass Armour-piece candidate or result',
				'write outside the attempt-scoped Equipment v3 revision directory',
				'change another Armour slot or the owner-accepted full-set source',
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
				throw new Error(`Armour-piece revision path collision: ${repositoryPath}`);
			}
		}
		packets.push({ target, revision, assignment, paths, hasBaseCandidate });
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
		assignments: packets.map(({ target, revision, paths, hasBaseCandidate }) => ({
			targetId: target.targetId,
			attempt: revision.attempt,
			revisionSource: hasBaseCandidate ? 'base-candidate' : 'full-set',
			...paths
		}))
	};
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	process.stdout.write(
		`${JSON.stringify(
			await materializeEquipmentArmourPieceRevisionsV3({
				workspaceRoot: process.cwd(),
				planPath: option('--plan')
			}),
			null,
			2
		)}\n`
	);
}
