import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
	AnySkillIconTargetSchema,
	SkillIconReprocessAssignmentSchema,
	SkillIconReprocessExecutionSchema,
	SkillIconReprocessOriginExecutionSchema,
	SkillIconReprocessResultSchema,
	SkillIconReprocessTargetSchema
} from '../packages/contracts/src/index.js';

export const SkillIconReferenceTargetSchema = z.union([
	AnySkillIconTargetSchema,
	SkillIconReprocessTargetSchema
]);
export type SkillIconReferenceTarget = z.infer<typeof SkillIconReferenceTargetSchema>;
export type SkillIconReprocessTarget = z.infer<typeof SkillIconReprocessTargetSchema>;
export type SkillIconReprocessAssignment = z.infer<typeof SkillIconReprocessAssignmentSchema>;
export type SkillIconReprocessResult = z.infer<typeof SkillIconReprocessResultSchema>;

export function isSkillIconReprocessTarget(
	target: SkillIconReferenceTarget
): target is SkillIconReprocessTarget {
	return target.schemaVersion === 'skill-icon-reprocess-target-v1';
}

export function canonicalSkillIconReferencePaths(target: SkillIconReferenceTarget): {
	readonly targetPath: string;
	readonly assignmentPath: string;
	readonly resultPath: string;
	readonly candidatePath: string;
} {
	return {
		targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${target.jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${target.jobId}.json`,
		resultPath: `assets/wiki/skills/icon-production-v1/results/references/${target.jobId}.json`,
		candidatePath: `assets/wiki/skills/icon-production-v1/candidates/references/${target.jobId}.png`
	};
}

function sha256(bytes: Buffer): string {
	return createHash('sha256').update(bytes).digest('hex');
}

function sameJson(left: unknown, right: unknown): boolean {
	return JSON.stringify(left) === JSON.stringify(right);
}

export interface SkillIconReprocessExecutionBytes {
	readonly targetPath: string;
	readonly targetBytes: Buffer;
	readonly assignmentPath: string;
	readonly assignmentBytes: Buffer;
	readonly resultPath: string;
	readonly resultBytes: Buffer;
	readonly originTargetBytes: Buffer;
	readonly originAssignmentBytes: Buffer;
	readonly originResultBytes: Buffer;
	readonly originCandidatePresent: boolean;
}

/**
 * Validates every byte-bound authority needed to consume a reprocessed candidate.
 * Callers must obtain the supplied bytes through their own repository-safe read boundary.
 */
export function assertSkillIconReprocessExecutionBytes(
	input: SkillIconReprocessExecutionBytes
): z.infer<typeof SkillIconReprocessExecutionSchema> {
	const target = SkillIconReprocessTargetSchema.parse(
		JSON.parse(input.targetBytes.toString('utf8')) as unknown
	);
	const assignment = SkillIconReprocessAssignmentSchema.parse(
		JSON.parse(input.assignmentBytes.toString('utf8')) as unknown
	);
	const result = SkillIconReprocessResultSchema.parse(
		JSON.parse(input.resultBytes.toString('utf8')) as unknown
	);
	const origin = SkillIconReprocessOriginExecutionSchema.parse({
		target: JSON.parse(input.originTargetBytes.toString('utf8')) as unknown,
		assignment: JSON.parse(input.originAssignmentBytes.toString('utf8')) as unknown,
		result: JSON.parse(input.originResultBytes.toString('utf8')) as unknown
	});
	const execution = SkillIconReprocessExecutionSchema.parse({
		schemaVersion: 'skill-icon-reprocess-execution-v1',
		target,
		assignment,
		result,
		origin
	});
	const canonical = canonicalSkillIconReferencePaths(target);
	if (
		input.targetPath !== canonical.targetPath ||
		input.assignmentPath !== canonical.assignmentPath ||
		input.resultPath !== canonical.resultPath
	) {
		throw new Error(`Reprocess authority paths are not canonical for ${target.jobId}`);
	}
	if (
		assignment.targetContentHash !== sha256(input.targetBytes) ||
		result.targetContentHash !== sha256(input.targetBytes) ||
		result.assignmentContentHash !== sha256(input.assignmentBytes)
	) {
		throw new Error(`Reprocess current authority hashes changed for ${target.jobId}`);
	}
	if (
		target.originAuthority.target.contentHash !== sha256(input.originTargetBytes) ||
		target.originAuthority.assignment.contentHash !== sha256(input.originAssignmentBytes) ||
		target.originAuthority.result.contentHash !== sha256(input.originResultBytes)
	) {
		throw new Error(`Reprocess origin authority hashes changed for ${target.jobId}`);
	}
	if (
		!sameJson(target.originAuthority, result.originAuthority) ||
		!sameJson(target.processingAuthority, result.processingAuthority)
	) {
		throw new Error(`Reprocess result authority differs from target ${target.jobId}`);
	}
	if (
		origin.target.jobId === target.jobId ||
		origin.target.logicalIdentity !== target.logicalIdentity ||
		origin.target.revision >= target.revision ||
		origin.target.role !== target.role ||
		origin.target.rarity !== target.rarity
	) {
		throw new Error(
			`Reprocess origin identity is not an older matching execution for ${target.jobId}`
		);
	}
	if (input.originCandidatePresent) {
		throw new Error(`Reprocess origin candidate must be absent for ${target.jobId}`);
	}
	return execution;
}
