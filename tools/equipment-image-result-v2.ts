import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageTargetSchema,
	type EquipmentV2ImageAssignment,
	type EquipmentV2ImageResult,
	type EquipmentV2ImageTarget
} from './equipment-image-production-contract-v2.js';
import { canonicalJsonSha256V2 } from './equipment-image-profile-acceptance-v2.js';
import {
	renderEquipmentPromptV2,
	validateEquipmentResultV2
} from './equipment-image-packets-v2.js';
import { EQUIPMENT_V2_PRODUCTION_ROOT } from './equipment-material-production-v2.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

export interface EquipmentV2FindingInput {
	readonly criterionId: string;
	readonly outcome: 'pass' | 'concern' | 'fail' | 'not-applicable';
	readonly observation: string;
}

export interface BuildEquipmentImageResultEvidenceV2Input {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly status: 'candidate' | 'revise' | 'failed';
	readonly sourceOutputId: string | null;
	readonly requestStartedAt: string;
	readonly generationCompletedAt: string;
	readonly inspectionCompletedAt: string;
	readonly startedAt: string;
	readonly completedAt: string;
	readonly findings: readonly EquipmentV2FindingInput[];
}

export interface VerifyEquipmentImageResultEvidenceV2Input {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath?: string;
	readonly result: unknown;
}

export interface VerifiedEquipmentImageResultEvidenceV2 extends EquipmentV2ImageResult {
	readonly ownedPaths: readonly string[];
	readonly resultCanonicalSha256: string;
}

function sha256(bytes: string | Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function packetPathForCandidate(
	candidatePath: string,
	directory: 'targets' | 'assignments'
): string {
	const prefix = `${EQUIPMENT_V2_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(prefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid Equipment v2 candidate path: ${candidatePath}`);
	}
	return `${EQUIPMENT_V2_PRODUCTION_ROOT}/${directory}/${candidatePath.slice(prefix.length, -4)}.json`;
}

function assertPacketPaths(input: {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath?: string;
	readonly target: EquipmentV2ImageTarget;
	readonly assignment: EquipmentV2ImageAssignment;
}): void {
	const expectedTargetPath = packetPathForCandidate(input.target.output.candidatePath, 'targets');
	const expectedAssignmentPath = packetPathForCandidate(
		input.target.output.candidatePath,
		'assignments'
	);
	if (input.targetPath !== expectedTargetPath) {
		throw new Error(`Supplied target path does not match ${expectedTargetPath}`);
	}
	if (input.assignmentPath !== expectedAssignmentPath) {
		throw new Error(`Supplied assignment path does not match ${expectedAssignmentPath}`);
	}
	if (
		input.resultPath !== undefined &&
		input.resultPath !== input.target.output.provenanceResultPath
	) {
		throw new Error(
			`Supplied result path does not match ${input.target.output.provenanceResultPath}`
		);
	}
	if (
		input.assignment.targetId !== input.target.targetId ||
		canonicalJsonSha256V2(input.assignment.permittedOutputs) !==
			canonicalJsonSha256V2(input.target.output)
	) {
		throw new Error('V2 assignment does not exactly bind the target and outputs');
	}
}

async function readPacket(input: {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath?: string;
}): Promise<{
	readonly target: EquipmentV2ImageTarget;
	readonly assignment: EquipmentV2ImageAssignment;
}> {
	const [targetValue, assignmentValue] = await Promise.all([
		readEquipmentRepositoryJson(input.workspaceRoot, input.targetPath),
		readEquipmentRepositoryJson(input.workspaceRoot, input.assignmentPath)
	]);
	const target = EquipmentV2ImageTargetSchema.parse(targetValue);
	const assignment = EquipmentV2ImageAssignmentSchema.parse(assignmentValue);
	assertPacketPaths({ ...input, target, assignment });
	return { target, assignment };
}

async function candidateEvidence(
	workspaceRoot: string,
	target: EquipmentV2ImageTarget
): Promise<NonNullable<EquipmentV2ImageResult['candidate']>> {
	const bytes = await readEquipmentRepositoryFile(workspaceRoot, target.output.candidatePath);
	const metadata = await sharp(bytes).metadata();
	if (
		metadata.format !== 'png' ||
		metadata.width !== target.presentation.canvas.width ||
		metadata.height !== target.presentation.canvas.height
	) {
		throw new Error('Stored v2 candidate PNG does not exactly match the target canvas');
	}
	return {
		path: target.output.candidatePath,
		mediaType: target.presentation.canvas.mediaType,
		width: target.presentation.canvas.width,
		height: target.presentation.canvas.height,
		bytes: bytes.byteLength,
		sha256: sha256(bytes)
	};
}

async function verifyReferences(
	workspaceRoot: string,
	target: EquipmentV2ImageTarget,
	result: EquipmentV2ImageResult
): Promise<void> {
	for (const [index, reference] of target.references.entries()) {
		const bytes = await readEquipmentRepositoryFile(workspaceRoot, reference.path);
		if (
			sha256(bytes) !== reference.contentHash ||
			result.referenceInputs[index]?.contentHash !== reference.contentHash
		) {
			throw new Error(`V2 result reference byte hash mismatch: ${reference.path}`);
		}
	}
}

async function verifyCandidate(
	workspaceRoot: string,
	target: EquipmentV2ImageTarget,
	result: EquipmentV2ImageResult
): Promise<void> {
	if (result.status === 'failed') {
		if (
			(await equipmentRepositoryPathState(workspaceRoot, target.output.candidatePath)) !== 'absent'
		) {
			throw new Error('Failed v2 result cannot coexist with a candidate output');
		}
		return;
	}
	const stored = await candidateEvidence(workspaceRoot, target);
	if (
		result.candidate === null ||
		canonicalJsonSha256V2(result.candidate) !== canonicalJsonSha256V2(stored) ||
		result.candidateSha256 !== stored.sha256
	) {
		throw new Error('V2 candidate evidence does not match the stored candidate bytes');
	}
}

export async function buildEquipmentImageResultEvidenceV2(
	input: BuildEquipmentImageResultEvidenceV2Input
): Promise<EquipmentV2ImageResult> {
	const { target, assignment } = await readPacket(input);
	const candidate =
		input.status === 'failed' ? null : await candidateEvidence(input.workspaceRoot, target);
	if (input.status === 'failed') {
		if (
			(await equipmentRepositoryPathState(input.workspaceRoot, target.output.candidatePath)) !==
			'absent'
		) {
			throw new Error('Failed v2 result cannot coexist with a candidate output');
		}
	}
	const result = {
		schemaVersion: 'equipment-image-result-v2' as const,
		resultId: `result-${target.targetId}`,
		targetId: target.targetId,
		assignmentId: assignment.assignmentId,
		status: input.status,
		humanReviewLabel: {
			candidate: 'Pass' as const,
			revise: 'Check' as const,
			failed: 'No image' as const
		}[input.status],
		promptSha256: sha256(renderEquipmentPromptV2(target)),
		referenceInputs: target.references.map(({ referenceId, path, contentHash }) => ({
			referenceId,
			path,
			contentHash
		})),
		attempts: [
			{
				attemptId: `attempt-${target.targetId}`,
				attemptNumber: 1 as const,
				sourceOutputId: input.sourceOutputId,
				requestStartedAt: input.requestStartedAt,
				generationCompletedAt: input.generationCompletedAt,
				inspectionCompletedAt: input.inspectionCompletedAt
			}
		],
		findings: [...input.findings],
		candidate,
		candidateSha256: candidate?.sha256 ?? null,
		startedAt: input.startedAt,
		completedAt: input.completedAt,
		writtenOutputPaths:
			input.status === 'failed'
				? [target.output.provenanceResultPath]
				: [target.output.candidatePath, target.output.provenanceResultPath],
		noSharedFilesEdited: true as const,
		selfPromoted: false as const
	};
	return validateEquipmentResultV2({ target, assignment, result });
}

export async function verifyEquipmentImageResultEvidenceV2(
	input: VerifyEquipmentImageResultEvidenceV2Input
): Promise<VerifiedEquipmentImageResultEvidenceV2> {
	const { target, assignment } = await readPacket(input);
	const result = validateEquipmentResultV2({ target, assignment, result: input.result });
	await verifyReferences(input.workspaceRoot, target, result);
	await verifyCandidate(input.workspaceRoot, target, result);
	return {
		...result,
		ownedPaths: [...result.writtenOutputPaths],
		resultCanonicalSha256: canonicalJsonSha256V2(result)
	};
}

export async function persistEquipmentImageResultEvidenceV2(
	input: Omit<VerifyEquipmentImageResultEvidenceV2Input, 'resultPath'>
): Promise<VerifiedEquipmentImageResultEvidenceV2> {
	const verified = await verifyEquipmentImageResultEvidenceV2(input);
	const resultPath = verified.writtenOutputPaths.at(-1)!;
	const serialized = `${JSON.stringify(
		verified,
		(key, value) => (key === 'ownedPaths' || key === 'resultCanonicalSha256' ? undefined : value),
		'\t'
	)}\n`;
	await exclusiveCreateEquipmentRepositoryFile(input.workspaceRoot, resultPath, serialized);
	const persistedBytes = await readEquipmentRepositoryFile(input.workspaceRoot, resultPath);
	if (persistedBytes.toString('utf8') !== serialized) {
		throw new Error(`Persisted v2 result bytes do not match verified evidence: ${resultPath}`);
	}
	return verifyEquipmentImageResultEvidenceV2({
		...input,
		resultPath,
		result: JSON.parse(persistedBytes.toString('utf8')) as unknown
	});
}

export async function verifyPersistedEquipmentImageResultEvidenceV2(input: {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath: string;
}): Promise<VerifiedEquipmentImageResultEvidenceV2> {
	return verifyEquipmentImageResultEvidenceV2({
		...input,
		result: await readEquipmentRepositoryJson(input.workspaceRoot, input.resultPath)
	});
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
if (isCli) {
	const resultInputPath = resolve(option('--result-input'));
	const result = JSON.parse(await readFile(resultInputPath, 'utf8')) as unknown;
	const verified = await persistEquipmentImageResultEvidenceV2({
		workspaceRoot: option('--workspace-root'),
		targetPath: option('--target'),
		assignmentPath: option('--assignment'),
		result
	});
	process.stdout.write(`${JSON.stringify(verified, null, 2)}\n`);
}
