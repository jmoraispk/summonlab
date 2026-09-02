import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	EquipmentV2ImageAssignmentSchema,
	EquipmentV2ImageTargetSchema,
	EquipmentV2ProfileAcceptanceSchema,
	type EquipmentV2ImageAssignment,
	type EquipmentV2ImageTarget
} from './equipment-image-production-contract-v2.js';
import { EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH } from './equipment-image-profile-acceptance-v2.js';
import {
	EQUIPMENT_V2_VISUAL_PROFILE_PATH,
	EquipmentVisualProfileV2Schema
} from './equipment-image-profile-v2.js';
import { validateEquipmentPacketV2 } from './equipment-image-packets-v2.js';
import { assertEquipmentV2RootTargetAuthorized } from './equipment-image-run-activation-v2.js';
import {
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	EQUIPMENT_V2_MANIFEST_PATH,
	EQUIPMENT_V2_PRODUCTION_ROOT,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';
import {
	equipmentRepositoryAbsolute,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

type EquipmentV2Manifest = ReturnType<typeof buildEquipmentMaterialProductionManifestV2>;
type EquipmentV2Allocation = ReturnType<typeof buildEquipmentMaterialAllocationPlanV2>;

export interface PersistEquipmentImageProductionOutputV2Options {
	readonly workspaceRoot: string;
	readonly sourcePath: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly destinationPath: string;
}

export interface EquipmentV2CandidatePersistenceReceipt {
	readonly schemaVersion: 'equipment-candidate-persistence-receipt-v2';
	readonly targetId: string;
	readonly assignmentId: string;
	readonly operation:
		'exclusive-copy' | 'exclusive-normalize-format' | 'exclusive-resize-near-match';
	readonly elapsedMs: number;
	readonly source: {
		readonly path: string;
		readonly width: number;
		readonly height: number;
		readonly mediaType: 'image/png' | 'image/webp';
		readonly bytes: number;
		readonly sha256: string;
	};
	readonly retained: {
		readonly path: string;
		readonly width: 1024;
		readonly height: 1024 | 1536;
		readonly mediaType: 'image/png';
		readonly bytes: number;
		readonly sha256: string;
	};
}

interface NormalizedImage {
	readonly bytes: Buffer;
	readonly operation: EquipmentV2CandidatePersistenceReceipt['operation'];
	readonly sourceMetadata: {
		readonly width: number;
		readonly height: number;
		readonly mediaType: 'image/png' | 'image/webp';
	};
}

function sha256(bytes: Uint8Array): string {
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

function assertExactPacketPaths(input: {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly destinationPath: string;
	readonly target: EquipmentV2ImageTarget;
	readonly assignment: EquipmentV2ImageAssignment;
}): void {
	if (input.destinationPath !== input.target.output.candidatePath) {
		throw new Error('Destination does not exactly match the v2 target candidate path');
	}
	if (input.assignment.permittedOutputs.candidatePath !== input.destinationPath) {
		throw new Error('Destination is not reserved by the v2 assignment');
	}
	const expectedTargetPath = packetPathForCandidate(input.destinationPath, 'targets');
	const expectedAssignmentPath = packetPathForCandidate(input.destinationPath, 'assignments');
	if (input.targetPath !== expectedTargetPath) {
		throw new Error(`Supplied target path does not match ${expectedTargetPath}`);
	}
	if (input.assignmentPath !== expectedAssignmentPath) {
		throw new Error(`Supplied assignment path does not match ${expectedAssignmentPath}`);
	}
}

function mediaTypeForFormat(format: string): 'image/png' | 'image/webp' {
	if (format === 'png') return 'image/png';
	if (format === 'webp') return 'image/webp';
	throw new Error(`Unsupported source image format: ${format}`);
}

async function normalizeAndVerify(
	sourceBytes: Buffer,
	canvas: EquipmentV2ImageTarget['presentation']['canvas']
): Promise<NormalizedImage> {
	const sourceMetadata = await sharp(sourceBytes).metadata();
	if (!sourceMetadata.width || !sourceMetadata.height || !sourceMetadata.format) {
		throw new Error('Source image metadata is incomplete');
	}
	const sourceMediaType = mediaTypeForFormat(sourceMetadata.format);
	const sourceWidth = BigInt(sourceMetadata.width);
	const sourceHeight = BigInt(sourceMetadata.height);
	const declaredWidth = BigInt(canvas.width);
	const declaredHeight = BigInt(canvas.height);
	const signedAspectDelta = sourceWidth * declaredHeight - declaredWidth * sourceHeight;
	const absoluteAspectDelta = signedAspectDelta < 0n ? -signedAspectDelta : signedAspectDelta;
	if (absoluteAspectDelta * 200n > sourceHeight * declaredWidth) {
		throw new Error(
			`Source aspect ratio ${sourceMetadata.width}x${sourceMetadata.height} is not a supported near-match for ${canvas.width}x${canvas.height}`
		);
	}

	let bytes = sourceBytes;
	let operation: EquipmentV2CandidatePersistenceReceipt['operation'] = 'exclusive-copy';
	if (sourceMetadata.width !== canvas.width || sourceMetadata.height !== canvas.height) {
		operation = 'exclusive-resize-near-match';
		bytes = await sharp(sourceBytes)
			.resize(canvas.width, canvas.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
			.png({ compressionLevel: 9 })
			.toBuffer();
	} else if (sourceMetadata.format !== 'png') {
		operation = 'exclusive-normalize-format';
		bytes = await sharp(sourceBytes).png({ compressionLevel: 9 }).toBuffer();
	}

	const retainedMetadata = await sharp(bytes).metadata();
	if (
		retainedMetadata.format !== 'png' ||
		retainedMetadata.width !== canvas.width ||
		retainedMetadata.height !== canvas.height
	) {
		throw new Error('Normalized image does not satisfy the Equipment v2 output canvas');
	}
	return {
		bytes,
		operation,
		sourceMetadata: {
			width: sourceMetadata.width,
			height: sourceMetadata.height,
			mediaType: sourceMediaType
		}
	};
}

async function readPacketAndStaticInputs(input: PersistEquipmentImageProductionOutputV2Options) {
	const [
		targetValue,
		assignmentValue,
		manifestValue,
		allocationValue,
		profileValue,
		acceptanceValue
	] = await Promise.all([
		readEquipmentRepositoryJson(input.workspaceRoot, input.targetPath),
		readEquipmentRepositoryJson(input.workspaceRoot, input.assignmentPath),
		readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_MANIFEST_PATH),
		readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_ALLOCATION_PLAN_PATH),
		readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_VISUAL_PROFILE_PATH),
		readEquipmentRepositoryJson(input.workspaceRoot, EQUIPMENT_V2_PROFILE_ACCEPTANCE_PATH)
	]);
	const target = EquipmentV2ImageTargetSchema.parse(targetValue);
	const assignment = EquipmentV2ImageAssignmentSchema.parse(assignmentValue);
	const profile = EquipmentVisualProfileV2Schema.parse(profileValue);
	const acceptance = EquipmentV2ProfileAcceptanceSchema.parse(acceptanceValue);
	assertExactPacketPaths({ ...input, target, assignment });
	await validateEquipmentPacketV2({
		workspaceRoot: input.workspaceRoot,
		manifest: manifestValue as EquipmentV2Manifest,
		allocation: allocationValue as EquipmentV2Allocation,
		profile,
		acceptance,
		target,
		assignment
	});
	return { target, assignment };
}

export async function persistEquipmentImageProductionOutputV2(
	options: PersistEquipmentImageProductionOutputV2Options
): Promise<EquipmentV2CandidatePersistenceReceipt> {
	const started = performance.now();
	const workspaceRoot = resolve(options.workspaceRoot);
	if (isAbsolute(options.destinationPath) || options.destinationPath.includes('\\')) {
		throw new Error('Destination must be a repository-relative POSIX path');
	}
	const sourcePath = resolve(options.sourcePath);
	const { target, assignment } = await readPacketAndStaticInputs({ ...options, workspaceRoot });
	await assertEquipmentV2RootTargetAuthorized({
		workspaceRoot,
		targetId: target.targetId
	});
	const destinationAbsolutePath = equipmentRepositoryAbsolute(
		workspaceRoot,
		options.destinationPath
	);
	const fromWorkspace = relative(workspaceRoot, destinationAbsolutePath);
	if (fromWorkspace.startsWith('..') || isAbsolute(fromWorkspace)) {
		throw new Error('Destination must stay within the workspace');
	}
	if (sourcePath === destinationAbsolutePath) throw new Error('Source and destination must differ');

	const sourceBytes = await readFile(sourcePath);
	const normalized = await normalizeAndVerify(sourceBytes, target.presentation.canvas);
	await exclusiveCreateEquipmentRepositoryFile(
		workspaceRoot,
		options.destinationPath,
		normalized.bytes
	);

	return {
		schemaVersion: 'equipment-candidate-persistence-receipt-v2',
		targetId: target.targetId,
		assignmentId: assignment.assignmentId,
		operation: normalized.operation,
		elapsedMs: Math.max(0, Math.round(performance.now() - started)),
		source: {
			path: sourcePath,
			width: normalized.sourceMetadata.width,
			height: normalized.sourceMetadata.height,
			mediaType: normalized.sourceMetadata.mediaType,
			bytes: sourceBytes.byteLength,
			sha256: sha256(sourceBytes)
		},
		retained: {
			path: options.destinationPath,
			width: target.presentation.canvas.width,
			height: target.presentation.canvas.height,
			mediaType: target.presentation.canvas.mediaType,
			bytes: normalized.bytes.byteLength,
			sha256: sha256(normalized.bytes)
		}
	};
}

function option(name: string): string {
	const index = process.argv.indexOf(name);
	const value = index >= 0 ? process.argv[index + 1] : undefined;
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

const isCli = process.argv[1] ? fileURLToPath(import.meta.url) === resolve(process.argv[1]) : false;
if (isCli) {
	const receipt = await persistEquipmentImageProductionOutputV2({
		workspaceRoot: option('--workspace-root'),
		sourcePath: option('--source'),
		targetPath: option('--target'),
		assignmentPath: option('--assignment'),
		destinationPath: option('--destination')
	});
	process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}
