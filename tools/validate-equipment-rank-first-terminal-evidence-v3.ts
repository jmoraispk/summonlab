import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCandidateRevisionAssignmentV3Schema,
	EquipmentProvenanceResultV3Schema,
	EquipmentWithheldCallAuditV1Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_ROOT,
	buildEquipmentCandidateTargetsV3,
	canonicalSha256,
	fileSha256
} from './equipment-rank-first-production-v3.js';
import {
	equipmentRepositoryAbsolute,
	equipmentRepositoryPathState,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export const EQUIPMENT_V3_WITHHELD_CALL_AUDIT_PATH =
	`${EQUIPMENT_V3_ROOT}/reviews/armour-piece-withheld-calls-v1.json`;

async function revisionAssignmentPaths(workspaceRoot: string): Promise<string[]> {
	const root = equipmentRepositoryAbsolute(workspaceRoot, `${EQUIPMENT_V3_ROOT}/revisions`);
	const found: string[] = [];
	async function walk(directory: string): Promise<void> {
		for (const entry of await readdir(directory, { withFileTypes: true })) {
			const child = path.join(directory, entry.name);
			if (entry.isDirectory()) await walk(child);
			else if (entry.isFile() && entry.name === 'assignment.json') {
				found.push(path.relative(workspaceRoot, child).split(path.sep).join('/'));
			}
		}
	}
	await walk(root);
	return found.sort();
}

export async function validateEquipmentRankFirstTerminalEvidenceV3(workspaceRoot: string) {
	const targets = buildEquipmentCandidateTargetsV3();
	const targetMap = new Map(targets.map((target) => [target.targetId, target]));
	const audit = EquipmentWithheldCallAuditV1Schema.parse(
		await readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_V3_WITHHELD_CALL_AUDIT_PATH)
	);
	const callGroups = new Map<string, (typeof audit.calls)[number][]>();
	for (const call of audit.calls) {
		if (fileSha256(call.sourcePath) !== call.sourceSha256) {
			throw new Error(`Withheld provider-call hash mismatch: ${call.sourcePath}`);
		}
		const key = `${call.targetId}:${call.attempt}`;
		callGroups.set(key, [...(callGroups.get(key) ?? []), call]);
	}
	const basePackets = targets.map((target) => ({
		assignmentPath: target.output.assignmentPath,
		candidatePath: target.output.candidatePath,
		resultPath: target.output.provenanceResultPath,
		attempt: 1
	}));
	const revisionPackets = await Promise.all(
		(await revisionAssignmentPaths(workspaceRoot)).map(async (assignmentPath) => {
			const assignment = EquipmentCandidateRevisionAssignmentV3Schema.parse(
				await readEquipmentRepositoryJson(workspaceRoot, assignmentPath)
			);
			return {
				assignmentPath,
				candidatePath: assignment.permittedOutputs.candidatePath,
				resultPath: assignment.permittedOutputs.resultPath,
				attempt: assignment.attempt
			};
		})
	);
	let succeeded = 0;
	let failed = 0;
	const consumedCallGroups = new Set<string>();
	for (const packet of [...basePackets, ...revisionPackets]) {
		const assignmentValue = await readEquipmentRepositoryJson(workspaceRoot, packet.assignmentPath);
		const assignment =
			packet.attempt === 1
				? EquipmentCandidateAssignmentV3Schema.parse(assignmentValue)
				: EquipmentCandidateRevisionAssignmentV3Schema.parse(assignmentValue);
		const target = targetMap.get(assignment.targetId);
		if (!target || (packet.attempt > 1 && assignment.schemaVersion !== 'equipment-rank-first-revision-assignment-v3')) {
			throw new Error(`Terminal assignment target mismatch: ${packet.assignmentPath}`);
		}
		const result = EquipmentProvenanceResultV3Schema.parse(
			await readEquipmentRepositoryJson(workspaceRoot, packet.resultPath)
		);
		const expectedReferences =
			assignment.schemaVersion === 'equipment-rank-first-revision-assignment-v3'
				? assignment.references
				: [
						assignment.classDirection,
						assignment.finishReference,
						...(assignment.consistencySource ? [assignment.consistencySource] : [])
					];
		if (
			result.targetId !== assignment.targetId ||
			result.assignmentId !== assignment.assignmentId ||
			result.attempt !== packet.attempt ||
			result.promptSha256 !== assignment.promptSha256 ||
			canonicalSha256(result.references) !== canonicalSha256(expectedReferences)
		) {
			throw new Error(`Terminal assignment/result mismatch: ${packet.resultPath}`);
		}
		for (const reference of result.references) {
			if (
				fileSha256(path.join(workspaceRoot, ...reference.path.split('/'))) !== reference.sha256
			) {
				throw new Error(`Terminal reference hash mismatch: ${reference.path}`);
			}
		}
		const candidateState = await equipmentRepositoryPathState(workspaceRoot, packet.candidatePath);
		const callKey = `${assignment.targetId}:${packet.attempt}`;
		if (result.status === 'succeeded') {
			if (!result.output || candidateState !== 'file' || result.output.path !== packet.candidatePath) {
				throw new Error(`Successful terminal result has no candidate: ${packet.resultPath}`);
			}
			const absolute = equipmentRepositoryAbsolute(workspaceRoot, packet.candidatePath);
			const [bytes, metadata] = await Promise.all([readFile(absolute), sharp(absolute).metadata()]);
			if (
				metadata.format !== 'png' ||
				metadata.width !== target.width ||
				metadata.height !== target.height ||
				bytes.byteLength !== result.output.bytes ||
				fileSha256(absolute) !== result.output.sha256
			) {
				throw new Error(`Successful terminal candidate mismatch: ${packet.candidatePath}`);
			}
			succeeded += 1;
		} else {
			if (candidateState !== 'absent' || !callGroups.has(callKey)) {
				throw new Error(`Failed terminal result lacks withheld-call evidence: ${packet.resultPath}`);
			}
			failed += 1;
		}
		if (callGroups.has(callKey)) consumedCallGroups.add(callKey);
	}
	if (consumedCallGroups.size !== callGroups.size) {
		throw new Error('Withheld-call audit contains an unbound provider-call group');
	}
	return {
		baseAssignmentCount: basePackets.length,
		revisionAssignmentCount: revisionPackets.length,
		terminalResultCount: succeeded + failed,
		succeededResultCount: succeeded,
		failedResultCount: failed,
		withheldCallCount: audit.calls.length,
		withheldAttemptGroupCount: callGroups.size
	};
}

const isCli = process.argv[1]
	? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
	: false;
if (isCli) {
	process.stdout.write(
		`${JSON.stringify(await validateEquipmentRankFirstTerminalEvidenceV3(process.cwd()), null, 2)}\n`
	);
}
