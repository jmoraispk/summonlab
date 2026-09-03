import { createHash } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';
import { z } from 'zod';

import {
	SKILL_ICON_REPROCESS_SOURCE_MODE,
	SKILL_ICON_REPROCESS_TOOL_VERSION,
	SkillIconAssignmentPathSchema,
	SkillIconAssignmentV2Schema,
	SkillIconGeometryV2Schema,
	SkillIconNormalizationEvidenceV3Schema,
	SkillIconReprocessAssignmentSchema,
	SkillIconReprocessExecutionSchema,
	SkillIconReprocessResultSchema,
	SkillIconReprocessTargetSchema,
	SkillIconResultPathSchema,
	SkillIconResultV2Schema,
	SkillIconTargetPathSchema,
	SkillIconTargetV2Schema,
	type SkillIconNormalizationEvidenceV3,
	type SkillIconReprocessResult
} from '../packages/contracts/src/index.js';
import { StateHashSchema } from '../packages/contracts/src/shared.js';
import {
	normalizeSkillIconProviderSource,
	preflightSkillIconProviderSourceV3,
	readSkillIconProviderSourceOnce
} from './normalize-skill-icon-provider-source.js';
import {
	acquireSkillIconReprocessAttemptIntent,
	persistSkillIconReprocessTransaction,
	readSkillIconReprocessAbsenceAuthority,
	readSkillIconReprocessAuthority,
	readSkillIconReprocessTargetInventory,
	recoverSkillIconPersistence,
	removeExistingSkillIconReprocessAttemptIntent,
	removeSkillIconReprocessAttemptIntent,
	replaceSkillIconReprocessAttemptIntent,
	type PersistSkillIconReprocessTransactionTestHooks
} from './persist-skill-icon-output.js';
import {
	canonicalSkillIconReferencePaths,
	SkillIconReferenceTargetSchema
} from './skill-icon-reprocess-consumer-lib.js';
import { resolveLatestSkillIconTargets } from './skill-icon-revision-lib.js';
import { inspectSkillIconAsset } from './validate-skill-icon-assets.js';

export interface ReprocessSkillIconProviderSourceCliRequest {
	readonly sourcePath: string;
	readonly sourceHash: string;
	readonly originTargetPath: string;
	readonly originAssignmentPath: string;
	readonly originResultPath: string;
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly fullSizeOutcome: 'pass' | 'fail';
	readonly fullSizeObservation: string;
	readonly recognitionOutcome: 'pass' | 'fail';
	readonly recognitionObservation: string;
}

export interface ReprocessSkillIconProviderSourceDependencies {
	readonly now?: () => Date;
	readonly afterSourceRead?: () => void | Promise<void>;
	readonly afterPreflight?: () => void | Promise<void>;
	readonly afterAttemptReserved?: () => void | Promise<void>;
	readonly persistenceTestHooks?: PersistSkillIconReprocessTransactionTestHooks;
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function requiredOption(values: ReadonlyMap<string, string>, name: string): string {
	const value = values.get(name);
	if (!value) throw new Error(`Missing ${name}`);
	return value;
}

export function parseReprocessSkillIconProviderSourceCliRequest(
	args: readonly string[]
): ReprocessSkillIconProviderSourceCliRequest {
	const normalizedArgs = args[0] === '--' ? args.slice(1) : args;
	if (normalizedArgs.includes('--'))
		throw new Error(
			'The -- argument separator is allowed only once and only as the first argument'
		);
	const allowed = new Set([
		'--source',
		'--source-hash',
		'--origin-target',
		'--origin-assignment',
		'--origin-result',
		'--target',
		'--assignment',
		'--full-size-outcome',
		'--full-size-observation',
		'--recognition-outcome',
		'--recognition-observation'
	]);
	const values = new Map<string, string>();
	for (let index = 0; index < normalizedArgs.length; index += 2) {
		const flag = normalizedArgs[index];
		const value = normalizedArgs[index + 1];
		if (!flag || !allowed.has(flag) || !value)
			throw new Error(`Unknown or incomplete argument: ${flag ?? '<missing>'}`);
		if (values.has(flag)) throw new Error(`Duplicate argument: ${flag}`);
		values.set(flag, value);
	}
	const sourcePath = requiredOption(values, '--source');
	if (!path.isAbsolute(sourcePath)) throw new Error('--source must be an absolute path');
	return {
		sourcePath,
		sourceHash: StateHashSchema.parse(requiredOption(values, '--source-hash')),
		originTargetPath: SkillIconTargetPathSchema.parse(requiredOption(values, '--origin-target')),
		originAssignmentPath: SkillIconAssignmentPathSchema.parse(
			requiredOption(values, '--origin-assignment')
		),
		originResultPath: SkillIconResultPathSchema.parse(requiredOption(values, '--origin-result')),
		targetPath: SkillIconTargetPathSchema.parse(requiredOption(values, '--target')),
		assignmentPath: SkillIconAssignmentPathSchema.parse(requiredOption(values, '--assignment')),
		fullSizeOutcome: z.enum(['pass', 'fail']).parse(requiredOption(values, '--full-size-outcome')),
		fullSizeObservation: z
			.string()
			.trim()
			.min(1)
			.max(1_000)
			.parse(requiredOption(values, '--full-size-observation')),
		recognitionOutcome: z
			.enum(['pass', 'fail'])
			.parse(requiredOption(values, '--recognition-outcome')),
		recognitionObservation: z
			.string()
			.trim()
			.min(1)
			.max(1_000)
			.parse(requiredOption(values, '--recognition-observation'))
	};
}

function parseJson(bytes: Buffer, label: string): unknown {
	try {
		return JSON.parse(bytes.toString('utf8')) as unknown;
	} catch (error) {
		throw new Error(`${label} is not valid JSON`, { cause: error });
	}
}

function canonicalOriginCandidatePath(originResultPath: string): string {
	return originResultPath.replace('/results/', '/candidates/').replace(/\.json$/u, '.png');
}

async function assertPathAbsent(root: string, relativePath: string, label: string): Promise<void> {
	const metadata = await lstat(path.resolve(root, relativePath)).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	);
	if (metadata) throw new Error(`${label} must be absent: ${relativePath}`);
}

function failureMessage(error: unknown): string {
	const message = error instanceof Error ? error.message : String(error);
	return `Coordinator reprocessing failed: ${message}`.slice(0, 1_000);
}

function inspectionObservation(prefix: string, violations: readonly string[]): string {
	return violations.length === 0
		? `${prefix} inspection passed.`
		: `${prefix} inspection failed: ${violations.join('; ')}`.slice(0, 1_000);
}

export function skillIconReprocessAttemptIntentPath(providerSourceHash: string): string {
	return `assets/wiki/skills/icon-production-v1/.reprocess-attempts/${StateHashSchema.parse(providerSourceHash)}.json`;
}

const SkillIconReprocessAttemptIntentSchema = z
	.object({
		schemaVersion: z.literal('skill-icon-reprocess-attempt-v1'),
		jobId: z.string().min(1),
		targetPath: SkillIconTargetPathSchema,
		targetContentHash: StateHashSchema,
		assignmentPath: SkillIconAssignmentPathSchema,
		assignmentContentHash: StateHashSchema,
		originAuthority: SkillIconReprocessTargetSchema.shape.originAuthority,
		processingAuthority: SkillIconReprocessTargetSchema.shape.processingAuthority,
		providerSourceHash: StateHashSchema,
		targetInventoryHash: StateHashSchema,
		terminalPlan: z
			.object({
				status: z.enum(['candidate', 'failed']),
				resultContentHash: StateHashSchema,
				candidateContentHash: StateHashSchema.nullable()
			})
			.strict()
			.nullable(),
		startedAt: z.string().datetime({ offset: true })
	})
	.strict();

export async function reprocessSkillIconProviderSource(
	requestInput: ReprocessSkillIconProviderSourceCliRequest,
	rootInput = process.cwd(),
	dependencies: ReprocessSkillIconProviderSourceDependencies = {}
): Promise<SkillIconReprocessResult> {
	// Own every request field and callback before the first await.
	const request = parseReprocessSkillIconProviderSourceCliRequest([
		'--source',
		requestInput.sourcePath,
		'--source-hash',
		requestInput.sourceHash,
		'--origin-target',
		requestInput.originTargetPath,
		'--origin-assignment',
		requestInput.originAssignmentPath,
		'--origin-result',
		requestInput.originResultPath,
		'--target',
		requestInput.targetPath,
		'--assignment',
		requestInput.assignmentPath,
		'--full-size-outcome',
		requestInput.fullSizeOutcome,
		'--full-size-observation',
		requestInput.fullSizeObservation,
		'--recognition-outcome',
		requestInput.recognitionOutcome,
		'--recognition-observation',
		requestInput.recognitionObservation
	]);
	const root = path.resolve(rootInput);
	const now = dependencies.now;
	const afterSourceRead = dependencies.afterSourceRead;
	const afterPreflight = dependencies.afterPreflight;
	const afterAttemptReserved = dependencies.afterAttemptReserved;
	const persistenceTestHooks = dependencies.persistenceTestHooks
		? { ...dependencies.persistenceTestHooks }
		: undefined;
	await recoverSkillIconPersistence(root);

	const inventory = await readSkillIconReprocessTargetInventory(root);
	const inventoryTargets = inventory.entries.map((entry) => {
		const target = SkillIconReferenceTargetSchema.parse(parseJson(entry.bytes, entry.path));
		if (canonicalSkillIconReferencePaths(target).targetPath !== entry.path)
			throw new Error(`Target inventory path is not canonical: ${entry.path}`);
		return { entry, target };
	});
	const latestTargets = resolveLatestSkillIconTargets(inventoryTargets.map(({ target }) => target));
	const reprocessTargets = inventoryTargets.filter(
		(entry) => entry.target.schemaVersion === 'skill-icon-reprocess-target-v1'
	);
	const inventoryTarget = reprocessTargets.find(({ entry }) => entry.path === request.targetPath);
	if (!inventoryTarget) throw new Error('Requested target is not a canonical reprocess target');
	if (inventoryTarget.target.schemaVersion !== 'skill-icon-reprocess-target-v1')
		throw new Error('Requested target is not a reprocess target');
	if (!latestTargets.some(({ target }) => target.jobId === inventoryTarget.target.jobId))
		throw new Error('Only the latest skill-icon target may be reprocessed');

	const requestedAuthorities = [
		[request.targetPath, 'Reprocess target'],
		[request.assignmentPath, 'Reprocess assignment'],
		[request.originTargetPath, 'Origin target'],
		[request.originAssignmentPath, 'Origin assignment'],
		[request.originResultPath, 'Origin result'],
		[inventoryTarget.target.processingAuthority.geometry.path, 'Reprocess geometry authority'],
		[inventoryTarget.target.processingAuthority.guide.path, 'Reprocess guide authority']
	] as const;
	const authorityFiles = await Promise.all(
		requestedAuthorities.map(async ([authorityPath, description]) => ({
			path: authorityPath,
			description,
			...(await readSkillIconReprocessAuthority(root, authorityPath, description))
		}))
	);
	const authority = (authorityPath: string) => {
		const found = authorityFiles.find((file) => file.path === authorityPath);
		if (!found) throw new Error(`Missing coordinator authority: ${authorityPath}`);
		return found;
	};
	const targetFile = authority(request.targetPath);
	const assignmentFile = authority(request.assignmentPath);
	const originTargetFile = authority(request.originTargetPath);
	const originAssignmentFile = authority(request.originAssignmentPath);
	const originResultFile = authority(request.originResultPath);
	const target = SkillIconReprocessTargetSchema.parse(
		parseJson(targetFile.bytes, 'Reprocess target')
	);
	if (target.role !== 'rarity-frame')
		throw new Error('Reprocess v1 is authorized only for rarity-frame provider sources');
	const assignment = SkillIconReprocessAssignmentSchema.parse(
		parseJson(assignmentFile.bytes, 'Reprocess assignment')
	);
	const originTarget = SkillIconTargetV2Schema.parse(
		parseJson(originTargetFile.bytes, 'Origin target')
	);
	const originAssignment = SkillIconAssignmentV2Schema.parse(
		parseJson(originAssignmentFile.bytes, 'Origin assignment')
	);
	const originResult = SkillIconResultV2Schema.parse(
		parseJson(originResultFile.bytes, 'Origin result')
	);
	if (originResult.status === 'superseded')
		throw new Error('A superseded result cannot supply provider bytes for reprocessing');
	const origin = { target: originTarget, assignment: originAssignment, result: originResult };
	const originCandidatePath = canonicalOriginCandidatePath(request.originResultPath);
	if (
		assignment.targetPath !== request.targetPath ||
		assignment.assignmentPath !== request.assignmentPath ||
		assignment.targetContentHash !== targetFile.contentHash ||
		assignment.toolVersion !== SKILL_ICON_REPROCESS_TOOL_VERSION ||
		assignment.sourceMode !== SKILL_ICON_REPROCESS_SOURCE_MODE ||
		JSON.stringify(target.output) !== JSON.stringify(assignment.permittedOutputs)
	)
		throw new Error('Reprocess target and assignment grants do not match');
	const actualOriginAuthority = {
		target: { path: request.originTargetPath, contentHash: originTargetFile.contentHash },
		assignment: {
			path: request.originAssignmentPath,
			contentHash: originAssignmentFile.contentHash
		},
		result: { path: request.originResultPath, contentHash: originResultFile.contentHash },
		providerSourceHash: request.sourceHash
	};
	if (JSON.stringify(target.originAuthority) !== JSON.stringify(actualOriginAuthority))
		throw new Error('Reprocess target does not bind the supplied origin authorities and source');
	for (const processing of [
		target.processingAuthority.geometry,
		target.processingAuthority.guide
	]) {
		if (authority(processing.path).contentHash !== processing.contentHash)
			throw new Error(`Processing authority hash mismatch: ${processing.path}`);
	}
	if (
		originResult.normalization.providerSource?.contentHash !== request.sourceHash ||
		originResult.normalization.sourceContentHash !== request.sourceHash
	)
		throw new Error('Provider source hash does not match origin result evidence');
	// Parse the entire origin execution before the one authorized normalization transaction.
	SkillIconReprocessExecutionSchema.shape.origin.parse(origin);
	const expectedOriginTargetPath = `assets/wiki/skills/icon-production-v1/targets/references/${originTarget.jobId}.json`;
	const expectedOriginAssignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${originTarget.jobId}.json`;
	const expectedOriginResultPath = `assets/wiki/skills/icon-production-v1/results/references/${originTarget.jobId}.json`;
	if (
		originTarget.logicalIdentity !== target.logicalIdentity ||
		originTarget.role !== target.role ||
		originTarget.rarity !== target.rarity ||
		originTarget.revision >= target.revision ||
		request.originTargetPath !== expectedOriginTargetPath ||
		request.originAssignmentPath !== expectedOriginAssignmentPath ||
		request.originResultPath !== expectedOriginResultPath
	)
		throw new Error('Origin authority is not the canonical older job for this reprocess target');
	const attemptIntentPath = skillIconReprocessAttemptIntentPath(request.sourceHash);
	const attemptMetadata = await lstat(path.resolve(root, attemptIntentPath)).catch(
		(error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') return null;
			throw error;
		}
	);
	if (attemptMetadata) {
		const attemptFile = await readSkillIconReprocessAuthority(
			root,
			attemptIntentPath,
			'Reprocess attempt reservation'
		);
		const attempt = SkillIconReprocessAttemptIntentSchema.parse(
			parseJson(attemptFile.bytes, 'Reprocess attempt reservation')
		);
		if (
			attempt.jobId !== target.jobId ||
			attempt.targetPath !== request.targetPath ||
			attempt.targetContentHash !== targetFile.contentHash ||
			attempt.assignmentPath !== request.assignmentPath ||
			attempt.assignmentContentHash !== assignmentFile.contentHash ||
			attempt.providerSourceHash !== request.sourceHash ||
			attempt.targetInventoryHash !== inventory.contentHash ||
			JSON.stringify(attempt.originAuthority) !== JSON.stringify(target.originAuthority) ||
			JSON.stringify(attempt.processingAuthority) !== JSON.stringify(target.processingAuthority)
		)
			throw new Error('Existing reprocess attempt does not match the requested authority');
		if (!attempt.terminalPlan)
			throw new Error(
				'A reprocess attempt is durably reserved without a terminal plan; normalization cannot be retried'
			);
		const terminalResultFile = await readSkillIconReprocessAuthority(
			root,
			target.output.resultPath,
			'Reprocess terminal result'
		).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT')
				throw new Error(
					'A reprocess attempt is durably reserved without a terminal result; normalization cannot be retried'
				);
			throw error;
		});
		const terminalResult = SkillIconReprocessResultSchema.parse(
			parseJson(terminalResultFile.bytes, 'Reprocess terminal result')
		);
		if (terminalResultFile.contentHash !== attempt.terminalPlan.resultContentHash)
			throw new Error('Terminal reprocess result bytes do not match the reserved terminal plan');
		SkillIconReprocessExecutionSchema.parse({
			schemaVersion: 'skill-icon-reprocess-execution-v1',
			target,
			assignment,
			result: terminalResult,
			origin
		});
		if (
			terminalResult.targetContentHash !== targetFile.contentHash ||
			terminalResult.assignmentContentHash !== assignmentFile.contentHash ||
			terminalResult.resultPath !== target.output.resultPath
		)
			throw new Error('Terminal reprocess result does not match current authority bytes');
		if (terminalResult.status === 'candidate') {
			if (
				attempt.terminalPlan.status !== 'candidate' ||
				attempt.terminalPlan.candidateContentHash !== terminalResult.output.contentHash
			)
				throw new Error('Terminal candidate result does not match the reserved terminal plan');
			if (terminalResult.output.path !== target.output.candidatePath)
				throw new Error('Terminal reprocess candidate path does not match the target');
			const terminalCandidate = await readSkillIconProviderSourceOnce(
				path.resolve(root, target.output.candidatePath)
			);
			if (
				sha256(terminalCandidate) !== terminalResult.output.contentHash ||
				terminalCandidate.byteLength !== terminalResult.output.bytes
			)
				throw new Error('Terminal reprocess candidate bytes do not match the result evidence');
			const terminalGeometry = SkillIconGeometryV2Schema.parse(
				parseJson(authority(target.processingAuthority.geometry.path).bytes, 'Geometry authority')
			);
			const terminalInspection = await inspectSkillIconAsset(
				terminalCandidate,
				target.role,
				terminalGeometry
			);
			if (terminalInspection.violations.length > 0)
				throw new Error('Terminal reprocess candidate failed role geometry validation');
		} else {
			if (
				attempt.terminalPlan.status !== 'failed' ||
				attempt.terminalPlan.candidateContentHash !== null
			)
				throw new Error('Terminal failed result does not match the reserved terminal plan');
			await assertPathAbsent(root, target.output.candidatePath, 'Failed reprocess candidate');
		}
		await readSkillIconReprocessAbsenceAuthority(root, originCandidatePath);
		await removeExistingSkillIconReprocessAttemptIntent(
			root,
			attemptIntentPath,
			attemptFile.contentHash
		);
		return terminalResult;
	}
	const originCandidateAbsence = await readSkillIconReprocessAbsenceAuthority(
		root,
		originCandidatePath
	);
	await Promise.all([
		assertPathAbsent(root, target.output.candidatePath, 'Reprocess candidate'),
		assertPathAbsent(root, target.output.resultPath, 'Reprocess result')
	]);
	// This is the sole source read. The returned owned Buffer is retained through
	// hashing, normalization, and evidence construction.
	const sourceBytes = await readSkillIconProviderSourceOnce(request.sourcePath, afterSourceRead);
	if (sha256(sourceBytes) !== request.sourceHash)
		throw new Error('Provider source hash does not match --source-hash');
	const providerSourceEvidence = preflightSkillIconProviderSourceV3(sourceBytes);
	await afterPreflight?.();

	const startedAt = (now?.() ?? new Date()).toISOString();
	const attemptRecord = {
		schemaVersion: 'skill-icon-reprocess-attempt-v1' as const,
		jobId: target.jobId,
		targetPath: request.targetPath,
		targetContentHash: targetFile.contentHash,
		assignmentPath: request.assignmentPath,
		assignmentContentHash: assignmentFile.contentHash,
		originAuthority: target.originAuthority,
		processingAuthority: target.processingAuthority,
		providerSourceHash: request.sourceHash,
		targetInventoryHash: inventory.contentHash,
		startedAt
	};
	let attemptIntent = await acquireSkillIconReprocessAttemptIntent(root, request.sourceHash, {
		...attemptRecord,
		terminalPlan: null
	});
	await afterAttemptReserved?.();
	for (const expected of authorityFiles) {
		const current = await readSkillIconReprocessAuthority(
			root,
			expected.path,
			expected.description
		);
		if (current.contentHash !== expected.contentHash)
			throw new Error(`${expected.description} changed before normalization`);
	}
	const currentInventory = await readSkillIconReprocessTargetInventory(root);
	if (
		currentInventory.contentHash !== inventory.contentHash ||
		JSON.stringify(currentInventory.directory) !== JSON.stringify(inventory.directory)
	)
		throw new Error('Reprocess target inventory changed before normalization');
	const currentOriginCandidateAbsence = await readSkillIconReprocessAbsenceAuthority(
		root,
		originCandidatePath
	);
	if (JSON.stringify(currentOriginCandidateAbsence) !== JSON.stringify(originCandidateAbsence))
		throw new Error('Origin candidate parent authority changed before normalization');
	await Promise.all([
		assertPathAbsent(root, target.output.candidatePath, 'Reprocess candidate'),
		assertPathAbsent(root, target.output.resultPath, 'Reprocess result')
	]);
	const geometryFile = authority(target.processingAuthority.geometry.path);
	const geometryBytes = Buffer.from(geometryFile.bytes);
	let normalization: SkillIconNormalizationEvidenceV3;
	let candidateBytes: Buffer | undefined;
	let fullSizeOutcome: 'pass' | 'fail' | 'not-run' = 'not-run';
	let recognitionOutcome: 'pass' | 'fail' | 'not-run' = 'not-run';
	let fullSizeObservation = 'Full-size inspection was not run because normalization failed.';
	let recognitionObservation =
		'Recognition-96 inspection was not run because normalization failed.';
	let failure: string | undefined;
	let normalized: Awaited<ReturnType<typeof normalizeSkillIconProviderSource>> | undefined;
	try {
		normalized = await normalizeSkillIconProviderSource(
			sourceBytes,
			target.role,
			geometryBytes,
			target.processingAuthority.profile
		);
		if (normalized.normalization.profile !== target.processingAuthority.profile)
			throw new Error('Normalizer returned evidence for an unauthorized profile');
		normalization = SkillIconNormalizationEvidenceV3Schema.parse({
			...normalized.normalization,
			outcome: 'completed',
			providerSource: normalized.source
		});
	} catch (error) {
		failure = failureMessage(error);
		normalization = {
			profile: target.processingAuthority.profile,
			outcome: 'failed',
			geometryHash: target.processingAuthority.geometry.contentHash,
			providerSource: providerSourceEvidence,
			sourceContentHash: request.sourceHash,
			decoderInputContentHash: null,
			containerBox: null,
			colorSpaceDisposition: null,
			outputContentHash: null
		};
	}
	if (normalized) {
		const geometry = SkillIconGeometryV2Schema.parse(
			parseJson(geometryBytes, 'Geometry authority')
		);
		try {
			const fullSize = await inspectSkillIconAsset(normalized.bytes, target.role, geometry);
			fullSizeOutcome = fullSize.violations.length === 0 ? request.fullSizeOutcome : 'fail';
			fullSizeObservation =
				fullSize.violations.length === 0
					? request.fullSizeObservation
					: inspectionObservation('Automated full-size', fullSize.violations);
			if (fullSizeOutcome === 'fail') failure = fullSizeObservation;
		} catch (error) {
			fullSizeOutcome = 'fail';
			fullSizeObservation = failureMessage(error);
			failure = fullSizeObservation;
		}
		if (fullSizeOutcome === 'pass') {
			try {
				const recognitionBytes = await sharp(normalized.bytes)
					.resize(96, 96, { fit: 'fill', kernel: sharp.kernel.nearest })
					.png({ progressive: false, palette: false })
					.toBuffer();
				const recognitionMetadata = await sharp(recognitionBytes).metadata();
				if (
					recognitionMetadata.format !== 'png' ||
					recognitionMetadata.width !== 96 ||
					recognitionMetadata.height !== 96 ||
					!recognitionMetadata.hasAlpha
				)
					throw new Error('Recognition derivative must be a 96×96 RGBA PNG');
				recognitionOutcome = request.recognitionOutcome;
				recognitionObservation = request.recognitionObservation;
				if (recognitionOutcome === 'fail') failure = recognitionObservation;
				else candidateBytes = normalized.bytes;
			} catch (error) {
				recognitionOutcome = 'fail';
				recognitionObservation = failureMessage(error);
				failure = recognitionObservation;
			}
		}
	}
	const completedAt = (now?.() ?? new Date()).toISOString();
	const totalWallTimeMs = Date.parse(completedAt) - Date.parse(startedAt);
	if (totalWallTimeMs < 0) throw new Error('Coordinator clock moved backwards during reprocessing');
	const common = {
		schemaVersion: 'skill-icon-reprocess-result-v1' as const,
		resultId: `result-${target.jobId}`,
		jobId: target.jobId,
		logicalIdentity: target.logicalIdentity,
		revision: target.revision,
		role: target.role,
		rarity: target.rarity,
		assignmentId: assignment.assignmentId,
		targetPath: request.targetPath,
		targetContentHash: targetFile.contentHash,
		assignmentPath: request.assignmentPath,
		assignmentContentHash: assignmentFile.contentHash,
		sourceMode: target.sourceMode,
		originAuthority: target.originAuthority,
		processingAuthority: target.processingAuthority,
		generationAttemptCount: 0 as const,
		normalizationTransactionCount: 1 as const,
		normalization,
		resultPath: target.output.resultPath,
		inspections: [
			{
				inspection: 'full-size' as const,
				outcome: fullSizeOutcome,
				observation: fullSizeObservation
			},
			{
				inspection: 'recognition-96' as const,
				outcome: recognitionOutcome,
				observation: recognitionObservation
			}
		] as const,
		startedAt,
		completedAt,
		totalWallTimeMs,
		noSharedFilesEdited: true as const,
		selfPromoted: false as const
	};
	let result = SkillIconReprocessResultSchema.parse(
		candidateBytes
			? {
					...common,
					status: 'candidate',
					output: {
						path: target.output.candidatePath,
						mediaType: 'image/png',
						width: 1024,
						height: 1024,
						bytes: candidateBytes.byteLength,
						alphaMode: 'rgba',
						contentHash: sha256(candidateBytes)
					},
					writtenOutputPaths: [target.output.candidatePath, target.output.resultPath]
				}
			: {
					...common,
					status: 'failed',
					output: null,
					failureReason: { kind: 'validation', message: failure ?? 'Reprocessing failed.' },
					writtenOutputPaths: [target.output.resultPath]
				}
	);
	SkillIconReprocessExecutionSchema.parse({
		schemaVersion: 'skill-icon-reprocess-execution-v1',
		target,
		assignment,
		result,
		origin
	});
	let resultBytes = Buffer.from(`${JSON.stringify(result, null, '\t')}\n`);
	attemptIntent = await replaceSkillIconReprocessAttemptIntent(root, attemptIntent, {
		...attemptRecord,
		terminalPlan: {
			status: result.status,
			resultContentHash: sha256(resultBytes),
			candidateContentHash: candidateBytes ? sha256(candidateBytes) : null
		}
	});
	const attemptIntentRelativePath = attemptIntent.path;
	const persistenceAuthorities = () => [
		...authorityFiles.map(({ path: authorityPath, contentHash, description }) => ({
			path: authorityPath,
			contentHash,
			description
		})),
		{
			path: attemptIntentRelativePath,
			contentHash: sha256(attemptIntent.bytes),
			description: 'Reprocess attempt reservation'
		}
	];
	const persist = async (
		persistedResult: SkillIconReprocessResult,
		persistedCandidate: Buffer | undefined,
		testHooks: PersistSkillIconReprocessTransactionTestHooks | undefined
	) =>
		persistSkillIconReprocessTransaction({
			root,
			jobId: target.jobId,
			candidatePath: target.output.candidatePath,
			requiredAbsentCandidatePath: originCandidatePath,
			...(persistedCandidate === undefined ? {} : { candidateBytes: persistedCandidate }),
			resultPath: target.output.resultPath,
			resultBytes:
				persistedResult === result
					? resultBytes
					: Buffer.from(`${JSON.stringify(persistedResult, null, '\t')}\n`),
			authorityInputs: persistenceAuthorities(),
			targetInventory: inventory,
			...(testHooks === undefined ? {} : { testHooks })
		});
	try {
		await persist(result, candidateBytes, persistenceTestHooks);
	} catch (error) {
		if (!candidateBytes) throw error;
		const committedResultMetadata = await lstat(path.resolve(root, target.output.resultPath)).catch(
			(metadataError: NodeJS.ErrnoException) => {
				if (metadataError.code === 'ENOENT') return null;
				throw metadataError;
			}
		);
		// A post-commit hook may fail after both terminal outputs are durable. Keep
		// the hash-bound candidate terminal plan for exact recovery; never rewrite
		// it as a persistence failure over an extant result namespace.
		if (committedResultMetadata) throw error;
		const persistenceCompletedAt = (now?.() ?? new Date()).toISOString();
		const persistenceWallTimeMs = Date.parse(persistenceCompletedAt) - Date.parse(startedAt);
		if (persistenceWallTimeMs < 0)
			throw new Error('Coordinator clock moved backwards during persistence failure', {
				cause: error
			});
		result = SkillIconReprocessResultSchema.parse({
			...common,
			completedAt: persistenceCompletedAt,
			totalWallTimeMs: persistenceWallTimeMs,
			status: 'failed',
			output: null,
			failureReason: { kind: 'persistence', message: failureMessage(error) },
			writtenOutputPaths: [target.output.resultPath]
		});
		SkillIconReprocessExecutionSchema.parse({
			schemaVersion: 'skill-icon-reprocess-execution-v1',
			target,
			assignment,
			result,
			origin
		});
		resultBytes = Buffer.from(`${JSON.stringify(result, null, '\t')}\n`);
		attemptIntent = await replaceSkillIconReprocessAttemptIntent(root, attemptIntent, {
			...attemptRecord,
			terminalPlan: {
				status: 'failed',
				resultContentHash: sha256(resultBytes),
				candidateContentHash: null
			}
		});
		await persist(result, undefined, undefined);
	}
	await removeSkillIconReprocessAttemptIntent(root, attemptIntent);
	return result;
}

export async function runReprocessSkillIconProviderSourceCli(
	args: readonly string[],
	root = process.cwd()
): Promise<void> {
	const result = await reprocessSkillIconProviderSource(
		parseReprocessSkillIconProviderSourceCliRequest(args),
		root
	);
	process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	runReprocessSkillIconProviderSourceCli(process.argv.slice(2)).catch((error: unknown) => {
		process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		process.exitCode = 1;
	});
}
