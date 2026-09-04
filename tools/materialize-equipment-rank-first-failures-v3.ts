import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCandidateRevisionAssignmentV3Schema,
	EquipmentProvenanceResultV3Schema,
	EquipmentWithheldCallAuditV1Schema
} from './equipment-rank-first-contract-v3.js';
import {
	buildEquipmentCandidateTargetsV3,
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

export async function materializeEquipmentRankFirstFailuresV3(input: {
	workspaceRoot: string;
	auditPath: string;
}) {
	const audit = EquipmentWithheldCallAuditV1Schema.parse(
		await readEquipmentRepositoryJson(input.workspaceRoot, input.auditPath)
	);
	const targets = new Map(
		buildEquipmentCandidateTargetsV3().map((target) => [target.targetId, target])
	);
	const groups = new Map<string, (typeof audit.calls)[number][]>();
	for (const call of audit.calls) {
		const key = `${call.targetId}:${call.attempt}`;
		groups.set(key, [...(groups.get(key) ?? []), call]);
	}
	const packets = [];
	let verifiedSucceeded = 0;
	let verifiedFailed = 0;
	for (const [key, calls] of [...groups.entries()].sort(([left], [right]) =>
		left.localeCompare(right)
	)) {
		const { targetId, attempt } = calls[0]!;
		const target = targets.get(targetId);
		if (!target || target.artifactRole !== 'armour-piece') {
			throw new Error(`Withheld call target is not an Armour piece: ${targetId}`);
		}
		for (const call of calls) {
			if (
				call.targetId !== targetId ||
				call.attempt !== attempt ||
				fileSha256(call.sourcePath) !== call.sourceSha256
			) {
				throw new Error(`Withheld call evidence mismatch: ${key}`);
			}
		}
		const assignmentPath =
			attempt === 1
				? target.output.assignmentPath
				: equipmentRevisionPaths(targetId, attempt).assignmentPath;
		const assignmentValue = await readEquipmentRepositoryJson(input.workspaceRoot, assignmentPath);
		const assignment =
			attempt === 1
				? EquipmentCandidateAssignmentV3Schema.parse(assignmentValue)
				: EquipmentCandidateRevisionAssignmentV3Schema.parse(assignmentValue);
		const isRevision =
			assignment.schemaVersion === 'equipment-rank-first-revision-assignment-v3';
		if (
			assignment.targetId !== targetId ||
			(isRevision && assignment.attempt !== attempt) ||
			(!isRevision && attempt !== 1)
		) {
			throw new Error(`Withheld call assignment mismatch: ${key}`);
		}
		const references = isRevision
			? assignment.references
			: [
					assignment.classDirection,
					assignment.finishReference,
					...(assignment.consistencySource ? [assignment.consistencySource] : [])
				];
		for (const reference of references) {
			if (
				fileSha256(path.join(input.workspaceRoot, ...reference.path.split('/'))) !==
				reference.sha256
			) {
				throw new Error(`Withheld call reference hash mismatch: ${reference.path}`);
			}
		}
		const candidatePath = assignment.permittedOutputs.candidatePath;
		const resultPath = assignment.permittedOutputs.resultPath;
		const [candidateState, resultState] = await Promise.all([
			equipmentRepositoryPathState(input.workspaceRoot, candidatePath),
			equipmentRepositoryPathState(input.workspaceRoot, resultPath)
		]);
		if (candidateState === 'directory' || resultState === 'directory') {
			throw new Error(`Withheld call output path is a directory: ${key}`);
		}
		if (resultState === 'file') {
			const result = EquipmentProvenanceResultV3Schema.parse(
				await readEquipmentRepositoryJson(input.workspaceRoot, resultPath)
			);
			if (
				result.targetId !== targetId ||
				result.assignmentId !== assignment.assignmentId ||
				result.attempt !== attempt ||
				result.promptSha256 !== assignment.promptSha256 ||
				(result.status === 'succeeded') !== (candidateState === 'file')
			) {
				throw new Error(`Existing terminal result mismatch: ${key}`);
			}
			if (result.status === 'succeeded') verifiedSucceeded += 1;
			else verifiedFailed += 1;
			continue;
		}
		if (candidateState !== 'absent') {
			throw new Error(`Failed attempt has a candidate but no result: ${key}`);
		}
		const metadata = await Promise.all(calls.map((call) => stat(call.sourcePath)));
		const startedAt = new Date(
			Math.min(...metadata.map((entry) => entry.birthtimeMs || entry.mtimeMs))
		).toISOString();
		const completedAt = new Date(Math.max(...metadata.map((entry) => entry.mtimeMs))).toISOString();
		const result = EquipmentProvenanceResultV3Schema.parse({
			schemaVersion: 'equipment-rank-first-provenance-result-v3',
			resultId: `result-${targetId}-attempt-${attempt}`,
			targetId,
			assignmentId: assignment.assignmentId,
			attempt,
			status: 'failed',
			startedAt,
			completedAt,
			provider: audit.provider,
			model: audit.model,
			promptSha256: assignment.promptSha256,
			references,
			source: null,
			persistenceOperation: null,
			output: null,
			error: {
				kind: 'visual-contract-rejection',
				message: `All ${calls.length} provider call(s) violated the four-piece Armour boundary; immutable source paths and hashes are recorded in ${input.auditPath}.`
			}
		});
		packets.push({ resultPath, result });
	}
	for (const packet of packets) {
		await exclusiveCreateEquipmentRepositoryFile(
			input.workspaceRoot,
			packet.resultPath,
			serializeJson(packet.result)
		);
	}
	return {
		auditPath: input.auditPath,
		callCount: audit.calls.length,
		attemptGroupCount: groups.size,
		createdFailedResults: packets.length,
		verifiedSucceededResults: verifiedSucceeded,
		verifiedFailedResults: verifiedFailed
	};
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	process.stdout.write(
		`${JSON.stringify(
			await materializeEquipmentRankFirstFailuresV3({
				workspaceRoot: process.cwd(),
				auditPath: option('--audit')
			}),
			null,
			2
		)}\n`
	);
}
