import { createHash } from 'node:crypto';

import sharp from 'sharp';

import {
	EQUIPMENT_PRODUCTION_ROOT,
	EquipmentImageAssignmentSchema,
	EquipmentImageResultSchema,
	EquipmentImageTargetSchema,
	EquipmentVisualProfileAcceptanceSchema,
	EquipmentVisualProfileSchema,
	type EquipmentImageAssignment,
	type EquipmentImageResult,
	type EquipmentImageTarget
} from './equipment-image-production-contract.js';
import {
	EQUIPMENT_PROFILE_ACCEPTANCE_PATH,
	canonicalJsonSha256,
	renderEquipmentPrompt
} from './equipment-image-packets.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

const PROFILE_PATH = `${EQUIPMENT_PRODUCTION_ROOT}/visual-profile/profile.json` as const;

export interface VerifyEquipmentImageResultInput {
	readonly workspaceRoot: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath?: string;
	readonly result: unknown;
}

export interface VerifiedEquipmentImageResult extends EquipmentImageResult {
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
	const prefix = `${EQUIPMENT_PRODUCTION_ROOT}/candidates/`;
	if (!candidatePath.startsWith(prefix) || !candidatePath.endsWith('.png')) {
		throw new Error(`Invalid Equipment candidate path: ${candidatePath}`);
	}
	return `${EQUIPMENT_PRODUCTION_ROOT}/${directory}/${candidatePath.slice(prefix.length, -4)}.json`;
}

function sameJson(left: unknown, right: unknown): boolean {
	return canonicalJsonSha256(left) === canonicalJsonSha256(right);
}

function assertPacketBindings(input: {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath?: string;
	readonly target: EquipmentImageTarget;
	readonly assignment: EquipmentImageAssignment;
	readonly result: EquipmentImageResult;
}): void {
	const expectedTargetPath = packetPathForCandidate(input.target.output.candidatePath, 'targets');
	const expectedAssignmentPath = packetPathForCandidate(
		input.target.output.candidatePath,
		'assignments'
	);
	if (input.targetPath !== expectedTargetPath) {
		throw new Error(`Supplied target path does not match the packet path: ${expectedTargetPath}`);
	}
	if (input.assignmentPath !== expectedAssignmentPath) {
		throw new Error(
			`Supplied assignment path does not match the packet path: ${expectedAssignmentPath}`
		);
	}
	if (input.resultPath !== undefined && input.resultPath !== input.target.output.resultPath) {
		throw new Error(
			`Supplied result path does not match the packet path: ${input.target.output.resultPath}`
		);
	}
	if (input.assignment.targetId !== input.target.targetId) {
		throw new Error('Assignment target ID does not match the target ID');
	}
	if (!sameJson(input.assignment.permittedOutputs, input.target.output)) {
		throw new Error('Assignment permitted outputs do not exactly match target outputs');
	}
	if (
		input.result.targetId !== input.target.targetId ||
		input.result.assignmentId !== input.assignment.assignmentId
	) {
		throw new Error('Result identity or ID does not match the target and assignment IDs');
	}
}

function assertResultSemantics(
	target: EquipmentImageTarget,
	assignment: EquipmentImageAssignment,
	result: EquipmentImageResult
): readonly string[] {
	const expectedPromptSha256 = sha256(renderEquipmentPrompt(target));
	if (result.promptSha256 !== expectedPromptSha256) {
		throw new Error(`Result prompt SHA-256 does not match the canonical rendered prompt`);
	}
	const expectedReferenceInputs = target.references.map(({ path: referencePath, contentHash }) => ({
		path: referencePath,
		contentHash
	}));
	if (!sameJson(result.referenceInputs, expectedReferenceInputs)) {
		throw new Error('Result reference provenance does not preserve exact ordered references');
	}

	const attempt = result.attempts[0]!;
	if (
		Date.parse(attempt.requestStartedAt) < Date.parse(result.startedAt) ||
		Date.parse(attempt.inspectionCompletedAt) > Date.parse(result.completedAt)
	) {
		throw new Error('Result timestamps must chronologically bound the single generation attempt');
	}
	if (result.status !== 'failed' && attempt.sourceOutputId === null) {
		throw new Error('A candidate-bearing attempt requires its source output ID');
	}

	const expectedFindingIds = target.acceptanceCriteria.map(({ criterionId }) => criterionId);
	const findingIds = result.findings.map(({ criterionId }) => criterionId);
	const findingIdSet = new Set(findingIds);
	if (
		findingIds.length !== expectedFindingIds.length ||
		findingIdSet.size !== findingIds.length ||
		expectedFindingIds.some((criterionId) => !findingIdSet.has(criterionId))
	) {
		throw new Error('Result findings must cover every required criterion exactly once');
	}
	if (result.status === 'candidate' && result.findings.some(({ outcome }) => outcome !== 'pass')) {
		throw new Error('Candidate status requires every required objective criterion to pass');
	}
	if (result.status === 'failed' && result.findings.every(({ outcome }) => outcome === 'pass')) {
		throw new Error('Failed status requires declared failure findings');
	}

	const expectedOwnedPaths =
		result.status === 'failed'
			? [assignment.permittedOutputs.resultPath]
			: [assignment.permittedOutputs.candidatePath, assignment.permittedOutputs.resultPath];
	if (!sameJson(result.writtenOutputPaths, expectedOwnedPaths)) {
		throw new Error('Result ownership must equal the assignment-owned paths written by its status');
	}
	return expectedOwnedPaths;
}

async function verifyProfileAndReferences(
	workspaceRoot: string,
	target: EquipmentImageTarget,
	result: EquipmentImageResult
): Promise<void> {
	const [unparsedProfile, unparsedAcceptance] = await Promise.all([
		readEquipmentRepositoryJson(workspaceRoot, PROFILE_PATH),
		readEquipmentRepositoryJson(workspaceRoot, EQUIPMENT_PROFILE_ACCEPTANCE_PATH)
	]);
	const profile = EquipmentVisualProfileSchema.parse(unparsedProfile);
	const acceptance = EquipmentVisualProfileAcceptanceSchema.parse(unparsedAcceptance);
	if (
		target.profileId !== profile.profileId ||
		target.profileCanonicalSha256 !== canonicalJsonSha256(profile) ||
		acceptance.profilePath !== PROFILE_PATH ||
		acceptance.profileId !== profile.profileId ||
		acceptance.profileCanonicalSha256 !== canonicalJsonSha256(profile) ||
		target.profileAcceptanceCanonicalSha256 !== canonicalJsonSha256(acceptance)
	) {
		throw new Error('Target does not bind the accepted Equipment visual profile');
	}
	const targetReferenceKeys = new Set(
		target.references.map(
			({ path: referencePath, contentHash }) => `${referencePath}:${contentHash}`
		)
	);
	for (const reference of profile.references) {
		if (!targetReferenceKeys.has(`${reference.path}:${reference.contentHash}`)) {
			throw new Error('Target references omit accepted profile reference provenance');
		}
	}
	for (const [index, reference] of target.references.entries()) {
		const bytes = await readEquipmentRepositoryFile(workspaceRoot, reference.path);
		if (
			sha256(bytes) !== reference.contentHash ||
			result.referenceInputs[index]?.contentHash !== reference.contentHash
		) {
			throw new Error(`Reference byte hash mismatch: ${reference.path}`);
		}
	}
}

async function verifyCandidate(
	workspaceRoot: string,
	target: EquipmentImageTarget,
	result: EquipmentImageResult
): Promise<void> {
	if (result.status === 'failed') {
		if (
			(await equipmentRepositoryPathState(workspaceRoot, target.output.candidatePath)) !== 'absent'
		) {
			throw new Error('Failed result cannot coexist with a candidate output');
		}
		return;
	}
	const candidate = result.candidate!;
	if (
		candidate.path !== target.output.candidatePath ||
		candidate.width !== target.presentation.canvas.width ||
		candidate.height !== target.presentation.canvas.height ||
		candidate.mediaType !== target.presentation.canvas.mediaType
	) {
		throw new Error('Candidate persistence receipt does not match the target output canvas');
	}
	const bytes = await readEquipmentRepositoryFile(workspaceRoot, candidate.path);
	const metadata = await sharp(bytes).metadata();
	if (
		metadata.format !== 'png' ||
		metadata.width !== target.presentation.canvas.width ||
		metadata.height !== target.presentation.canvas.height
	) {
		throw new Error('Stored candidate PNG does not match the target canvas');
	}
	const storedSha256 = sha256(bytes);
	if (
		candidate.bytes !== bytes.byteLength ||
		candidate.sha256 !== storedSha256 ||
		result.candidateSha256 !== storedSha256
	) {
		throw new Error('Candidate persistence receipt does not match the stored candidate bytes');
	}
}

export async function verifyEquipmentImageResult(
	input: VerifyEquipmentImageResultInput
): Promise<VerifiedEquipmentImageResult> {
	const [unparsedTarget, unparsedAssignment] = await Promise.all([
		readEquipmentRepositoryJson(input.workspaceRoot, input.targetPath),
		readEquipmentRepositoryJson(input.workspaceRoot, input.assignmentPath)
	]);
	const target = EquipmentImageTargetSchema.parse(unparsedTarget);
	const assignment = EquipmentImageAssignmentSchema.parse(unparsedAssignment);
	if (!sameJson(assignment.permittedOutputs, target.output)) {
		throw new Error('Assignment permitted outputs do not exactly match target outputs');
	}
	if (input.result !== null && typeof input.result === 'object') {
		const rawResult = input.result as Record<string, unknown>;
		const expectedOwnedPaths =
			rawResult.status === 'failed'
				? [assignment.permittedOutputs.resultPath]
				: [assignment.permittedOutputs.candidatePath, assignment.permittedOutputs.resultPath];
		if (!sameJson(rawResult.writtenOutputPaths, expectedOwnedPaths)) {
			throw new Error(
				'Result ownership must equal the assignment-owned paths written by its status'
			);
		}
	}
	const result = EquipmentImageResultSchema.parse(input.result);
	assertPacketBindings({
		targetPath: input.targetPath,
		assignmentPath: input.assignmentPath,
		...(input.resultPath === undefined ? {} : { resultPath: input.resultPath }),
		target,
		assignment,
		result
	});
	const ownedPaths = assertResultSemantics(target, assignment, result);
	await verifyProfileAndReferences(input.workspaceRoot, target, result);
	await verifyCandidate(input.workspaceRoot, target, result);
	return { ...result, ownedPaths, resultCanonicalSha256: canonicalJsonSha256(result) };
}

export async function persistEquipmentImageResult(
	input: Omit<VerifyEquipmentImageResultInput, 'resultPath'>
): Promise<VerifiedEquipmentImageResult> {
	const verifiedBeforeWrite = await verifyEquipmentImageResult(input);
	const resultPath = verifiedBeforeWrite.writtenOutputPaths.at(-1)!;
	const serialized = `${JSON.stringify(input.result, null, '\t')}\n`;
	await exclusiveCreateEquipmentRepositoryFile(input.workspaceRoot, resultPath, serialized);
	const persistedBytes = await readEquipmentRepositoryFile(input.workspaceRoot, resultPath);
	if (persistedBytes.toString('utf8') !== serialized) {
		throw new Error(
			`Persisted Equipment result bytes do not match the verified result: ${resultPath}`
		);
	}
	return verifyEquipmentImageResult({
		...input,
		resultPath,
		result: JSON.parse(persistedBytes.toString('utf8')) as unknown
	});
}
