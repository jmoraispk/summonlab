import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	EquipmentCandidateAssignmentV3Schema,
	EquipmentCandidateTargetV3Schema,
	EquipmentDirectionAssignmentV3Schema,
	EquipmentDirectionResultV3Schema,
	EquipmentDirectionTargetV3Schema,
	EquipmentProvenanceResultV3Schema
} from './equipment-rank-first-contract-v3.js';
import {
	EQUIPMENT_V3_ROOT,
	canonicalSha256,
	fileSha256,
	serializeJson
} from './equipment-rank-first-production-v3.js';
import {
	equipmentRepositoryPathState,
	exclusiveCreateEquipmentRepositoryFile,
	readEquipmentRepositoryJson
} from './equipment-repository-io.js';

interface PersistOptions {
	readonly workspaceRoot: string;
	readonly kind: 'direction' | 'candidate';
	readonly sourcePath: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly attempt: number;
	readonly startedAt: string;
	readonly completedAt: string;
	readonly provider: string;
	readonly model: string;
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function mediaTypeFor(format: string): 'image/png' | 'image/webp' | 'image/jpeg' {
	if (format === 'png') return 'image/png';
	if (format === 'webp') return 'image/webp';
	if (format === 'jpeg') return 'image/jpeg';
	throw new Error(`Unsupported generated format: ${format}`);
}

async function normalizeImage(
	sourcePath: string,
	width: number,
	height: number,
	allowLetterbox = false
) {
	const source = await readFile(sourcePath);
	const metadata = await sharp(source).metadata();
	if (!metadata.width || !metadata.height || !metadata.format)
		throw new Error('Generated source has incomplete image metadata');
	if (!['png', 'webp', 'jpeg'].includes(metadata.format))
		throw new Error(`Unsupported generated format: ${metadata.format}`);
	const aspectError =
		Math.abs(metadata.width * height - width * metadata.height) / (width * metadata.height);
	if (aspectError > (allowLetterbox ? 0.51 : 0.01))
		throw new Error(
			`Generated source ${metadata.width}x${metadata.height} does not match required aspect ${width}x${height}`
		);
	const exact = metadata.width === width && metadata.height === height && metadata.format === 'png';
	const retained = exact
		? source
		: await sharp(source)
				.resize(width, height, {
					fit: allowLetterbox ? 'contain' : 'fill',
					background: '#070b12',
					kernel: sharp.kernel.lanczos3
				})
				.png({ compressionLevel: 9 })
				.toBuffer();
	const retainedMetadata = await sharp(retained).metadata();
	if (
		retainedMetadata.format !== 'png' ||
		retainedMetadata.width !== width ||
		retainedMetadata.height !== height
	)
		throw new Error('Normalized output does not satisfy its contract');
	return {
		source,
		retained,
		metadata,
		operation: exact ? 'exclusive-copy' : 'exclusive-normalize'
	} as const;
}

function assertReferenceHashes(
	workspaceRoot: string,
	references: readonly { path: string; sha256: string }[]
): void {
	for (const reference of references) {
		const actual = fileSha256(path.join(workspaceRoot, ...reference.path.split('/')));
		if (actual !== reference.sha256) throw new Error(`Reference hash mismatch: ${reference.path}`);
	}
}

async function assertAbsent(workspaceRoot: string, paths: readonly string[]): Promise<void> {
	for (const repositoryPath of paths) {
		if (!repositoryPath.startsWith(`${EQUIPMENT_V3_ROOT}/`))
			throw new Error(`Output escapes Equipment v3: ${repositoryPath}`);
		if ((await equipmentRepositoryPathState(workspaceRoot, repositoryPath)) !== 'absent')
			throw new Error(`Collision: ${repositoryPath} already exists`);
	}
}

export async function persistEquipmentRankFirstOutputV3(options: PersistOptions) {
	if (!Number.isInteger(options.attempt) || options.attempt < 1)
		throw new Error('Attempt must be a positive integer');
	if (new Date(options.completedAt).getTime() < new Date(options.startedAt).getTime())
		throw new Error('completedAt precedes startedAt');
	const targetValue = await readEquipmentRepositoryJson(options.workspaceRoot, options.targetPath);
	const assignmentValue = await readEquipmentRepositoryJson(
		options.workspaceRoot,
		options.assignmentPath
	);
	if (options.kind === 'direction') {
		const target = EquipmentDirectionTargetV3Schema.parse(targetValue);
		const assignment = EquipmentDirectionAssignmentV3Schema.parse(assignmentValue);
		if (assignment.directionId !== target.directionId)
			throw new Error('Direction target/assignment mismatch');
		if (
			assignment.permittedOutputs.candidatePath !== target.candidatePath ||
			assignment.permittedOutputs.resultPath !== target.resultPath
		)
			throw new Error('Direction outputs are not assignment-owned');
		if (sha256(Buffer.from(assignment.prompt)) !== assignment.promptSha256)
			throw new Error('Direction prompt hash mismatch');
		assertReferenceHashes(options.workspaceRoot, assignment.references);
		await assertAbsent(options.workspaceRoot, [target.candidatePath, target.resultPath]);
		const image = await normalizeImage(options.sourcePath, target.width, target.height, true);
		const result = EquipmentDirectionResultV3Schema.parse({
			schemaVersion: 'equipment-class-direction-result-v3',
			resultId: `result-${target.directionId}-attempt-${options.attempt}`,
			directionId: target.directionId,
			assignmentId: assignment.assignmentId,
			attempt: options.attempt,
			status: 'succeeded',
			startedAt: options.startedAt,
			completedAt: options.completedAt,
			provider: options.provider,
			model: options.model,
			promptSha256: assignment.promptSha256,
			references: assignment.references,
			output: {
				path: target.candidatePath,
				sha256: sha256(image.retained),
				bytes: image.retained.byteLength,
				width: target.width,
				height: target.height,
				mediaType: 'image/png'
			},
			error: null
		});
		await exclusiveCreateEquipmentRepositoryFile(
			options.workspaceRoot,
			target.candidatePath,
			image.retained
		);
		await exclusiveCreateEquipmentRepositoryFile(
			options.workspaceRoot,
			target.resultPath,
			serializeJson(result)
		);
		return { kind: options.kind, operation: image.operation, result };
	}

	const target = EquipmentCandidateTargetV3Schema.parse(targetValue);
	const assignment = EquipmentCandidateAssignmentV3Schema.parse(assignmentValue);
	if (assignment.targetId !== target.targetId)
		throw new Error('Candidate target/assignment mismatch');
	if (
		assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
		assignment.permittedOutputs.resultPath !== target.output.provenanceResultPath
	)
		throw new Error('Candidate outputs are not assignment-owned');
	if (sha256(Buffer.from(assignment.prompt)) !== assignment.promptSha256)
		throw new Error('Candidate prompt hash mismatch');
	if (
		canonicalSha256(
			await readEquipmentRepositoryJson(options.workspaceRoot, assignment.materialBrief.path)
		) === assignment.materialBrief.canonicalSha256
	) {
		throw new Error('Material brief hash must bind the brief payload, not its schema wrapper');
	}
	const briefValue = (await readEquipmentRepositoryJson(
		options.workspaceRoot,
		assignment.materialBrief.path
	)) as Record<string, unknown>;
	const { schemaVersion: _schemaVersion, ...briefPayload } = briefValue;
	if (canonicalSha256(briefPayload) !== assignment.materialBrief.canonicalSha256)
		throw new Error('Material brief hash mismatch');
	const references = [
		assignment.classDirection,
		assignment.finishReference,
		...(assignment.consistencySource ? [assignment.consistencySource] : [])
	];
	assertReferenceHashes(options.workspaceRoot, references);
	await assertAbsent(options.workspaceRoot, [
		target.output.candidatePath,
		target.output.provenanceResultPath
	]);
	const image = await normalizeImage(
		options.sourcePath,
		target.width,
		target.height,
		target.artifactRole === 'set-source'
	);
	const result = EquipmentProvenanceResultV3Schema.parse({
		schemaVersion: 'equipment-rank-first-provenance-result-v3',
		resultId: `result-${target.targetId}-attempt-${options.attempt}`,
		targetId: target.targetId,
		assignmentId: assignment.assignmentId,
		attempt: options.attempt,
		status: 'succeeded',
		startedAt: options.startedAt,
		completedAt: options.completedAt,
		provider: options.provider,
		model: options.model,
		promptSha256: assignment.promptSha256,
		references,
		source: {
			path: path.resolve(options.sourcePath),
			sha256: sha256(image.source),
			bytes: image.source.byteLength,
			width: image.metadata.width,
			height: image.metadata.height,
			mediaType: mediaTypeFor(image.metadata.format)
		},
		persistenceOperation: image.operation,
		output: {
			path: target.output.candidatePath,
			sha256: sha256(image.retained),
			bytes: image.retained.byteLength,
			width: target.width,
			height: target.height,
			mediaType: 'image/png'
		},
		error: null
	});
	await exclusiveCreateEquipmentRepositoryFile(
		options.workspaceRoot,
		target.output.candidatePath,
		image.retained
	);
	await exclusiveCreateEquipmentRepositoryFile(
		options.workspaceRoot,
		target.output.provenanceResultPath,
		serializeJson(result)
	);
	return { kind: options.kind, operation: image.operation, result };
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
	const completedAt = option('--completed-at');
	const output = await persistEquipmentRankFirstOutputV3({
		workspaceRoot: process.cwd(),
		kind: option('--kind') as PersistOptions['kind'],
		sourcePath: option('--source'),
		targetPath: option('--target'),
		assignmentPath: option('--assignment'),
		attempt: Number(option('--attempt')),
		startedAt: option('--started-at'),
		completedAt,
		provider: option('--provider'),
		model: option('--model')
	});
	process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}
