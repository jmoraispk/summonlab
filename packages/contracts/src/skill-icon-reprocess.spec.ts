import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SKILL_ICON_REPROCESS_SOURCE_MODE,
	SKILL_ICON_REPROCESS_TOOL_VERSION,
	SkillIconReprocessAssignmentSchema,
	SkillIconReprocessExecutionSchema,
	SkillIconReprocessOriginExecutionSchema,
	SkillIconReprocessResultSchema,
	SkillIconReprocessTargetSchema
} from './index.js';

describe('skill icon provider-source reprocess contracts', () => {
	const originJobId = 'rarity-frame-f-v3';
	const jobId = 'rarity-frame-f-v5';
	const sourceHash = 'c9e3d8d2d482ab9e08ab598de2fe10189d0390477ec5a5a1b98d505bc4106073';
	const candidateHash = '9'.repeat(64);
	const targetContentHash = '1'.repeat(64);
	const assignmentContentHash = '2'.repeat(64);
	const originPaths = {
		target: `assets/wiki/skills/icon-production-v1/targets/references/${originJobId}.json`,
		assignment: `assets/wiki/skills/icon-production-v1/assignments/references/${originJobId}.json`,
		result: `assets/wiki/skills/icon-production-v1/results/references/${originJobId}.json`
	};
	const output = {
		candidatePath: `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`,
		resultPath: `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`
	};

	function repoBytes(path: string) {
		return readFileSync(new URL(`../../../${path}`, import.meta.url));
	}

	function repoJson(path: string) {
		return JSON.parse(repoBytes(path).toString('utf8')) as Record<string, unknown>;
	}

	function originAuthority() {
		const bound = (path: string) => ({
			path,
			contentHash: createHash('sha256').update(repoBytes(path)).digest('hex')
		});
		return {
			target: bound(originPaths.target),
			assignment: bound(originPaths.assignment),
			result: bound(originPaths.result),
			providerSourceHash: sourceHash
		};
	}

	function processingAuthority() {
		return {
			profile: 'skill-icon-green-key-role-mask-v3' as const,
			geometry: {
				path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
			},
			guide: {
				path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
				contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
				purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE
			}
		};
	}

	function target() {
		return {
			schemaVersion: 'skill-icon-reprocess-target-v1' as const,
			jobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 5,
			role: 'rarity-frame' as const,
			rarity: 'F' as const,
			sourceMode: SKILL_ICON_REPROCESS_SOURCE_MODE,
			originAuthority: originAuthority(),
			processingAuthority: processingAuthority(),
			output
		};
	}

	function assignment() {
		return {
			schemaVersion: 'skill-icon-reprocess-assignment-v1' as const,
			assignmentId: `assignment-${jobId}`,
			jobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 5,
			role: 'rarity-frame' as const,
			rarity: 'F' as const,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
			targetContentHash,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
			toolVersion: SKILL_ICON_REPROCESS_TOOL_VERSION,
			sourceMode: SKILL_ICON_REPROCESS_SOURCE_MODE,
			generationAttemptLimit: 0 as const,
			normalizationTransactionLimit: 1 as const,
			permittedOutputs: output,
			completionContract: {
				coordinatorOnly: true as const,
				structuredResultRequired: true as const,
				sharedFilesMustRemainUntouched: true as const,
				selfPromotionForbidden: true as const
			}
		};
	}

	function normalization(outcome: 'completed' | 'failed' = 'completed') {
		return {
			profile: 'skill-icon-green-key-role-mask-v3' as const,
			outcome,
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
			providerSource: {
				mediaType: 'image/png' as const,
				width: 1254 as const,
				height: 1254 as const,
				bytes: 1_452_253,
				alphaMode: 'rgb' as const,
				contentHash: sourceHash
			},
			sourceContentHash: sourceHash,
			decoderInputContentHash: '3'.repeat(64),
			containerBox: { chunkType: 'caBX' as const, bytes: 24, contentHash: '4'.repeat(64) },
			colorSpaceDisposition: 'assigned-srgb' as const,
			outputContentHash: outcome === 'completed' ? candidateHash : null
		};
	}

	function candidateResult() {
		return {
			schemaVersion: 'skill-icon-reprocess-result-v1' as const,
			resultId: `result-${jobId}`,
			jobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 5,
			role: 'rarity-frame' as const,
			rarity: 'F' as const,
			assignmentId: `assignment-${jobId}`,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
			targetContentHash,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
			assignmentContentHash,
			sourceMode: SKILL_ICON_REPROCESS_SOURCE_MODE,
			originAuthority: originAuthority(),
			processingAuthority: processingAuthority(),
			generationAttemptCount: 0 as const,
			normalizationTransactionCount: 1 as const,
			normalization: normalization(),
			status: 'candidate' as const,
			output: {
				path: output.candidatePath,
				mediaType: 'image/png' as const,
				width: 1024,
				height: 1024,
				bytes: 572_562,
				alphaMode: 'rgba' as const,
				contentHash: candidateHash
			},
			resultPath: output.resultPath,
			inspections: [
				{ inspection: 'full-size' as const, outcome: 'pass' as const, observation: 'Passed.' },
				{
					inspection: 'recognition-96' as const,
					outcome: 'pass' as const,
					observation: 'Passed.'
				}
			] as const,
			startedAt: '2026-09-03T12:00:00.000Z',
			completedAt: '2026-09-03T12:00:00.250Z',
			totalWallTimeMs: 250,
			writtenOutputPaths: [output.candidatePath, output.resultPath] as const,
			noSharedFilesEdited: true as const,
			selfPromoted: false as const
		};
	}

	function origin() {
		return {
			target: repoJson(originPaths.target),
			assignment: repoJson(originPaths.assignment),
			result: repoJson(originPaths.result)
		};
	}

	it('accepts a zero-generation one-normalization execution without prompt claims', () => {
		const value = {
			schemaVersion: 'skill-icon-reprocess-execution-v1' as const,
			target: target(),
			assignment: assignment(),
			result: candidateResult(),
			origin: origin()
		};
		expect(SkillIconReprocessTargetSchema.safeParse(value.target).success).toBe(true);
		expect(SkillIconReprocessAssignmentSchema.safeParse(value.assignment).success).toBe(true);
		expect(SkillIconReprocessResultSchema.safeParse(value.result).success).toBe(true);
		expect(SkillIconReprocessOriginExecutionSchema.safeParse(value.origin).success).toBe(true);
		expect(SkillIconReprocessExecutionSchema.safeParse(value).success).toBe(true);
		for (const claim of [{ exactPrompt: 'Forbidden.' }, { referenceInputs: [] }]) {
			expect(SkillIconReprocessTargetSchema.safeParse({ ...value.target, ...claim }).success).toBe(
				false
			);
			expect(SkillIconReprocessResultSchema.safeParse({ ...value.result, ...claim }).success).toBe(
				false
			);
		}
	});

	it('rejects non-coordinator tools, calls, transactions, and extra outputs', () => {
		const value = assignment();
		for (const invalid of [
			{ ...value, toolVersion: 'summonlab-skill-icon-production-v4' },
			{ ...value, generationAttemptLimit: 1 },
			{ ...value, normalizationTransactionLimit: 2 },
			{ ...value, role: 'backing' },
			{
				...value,
				permittedOutputs: { ...value.permittedOutputs, thirdPath: 'forbidden' }
			}
		]) {
			expect(SkillIconReprocessAssignmentSchema.safeParse(invalid).success).toBe(false);
		}
	});

	it('requires one strictly older canonical origin path set', () => {
		const value = target();
		for (const invalid of [
			{ ...value, role: 'backing', rarity: null },
			{
				...value,
				revision: 3,
				jobId: 'rarity-frame-f-v3',
				output: {
					candidatePath:
						'assets/wiki/skills/icon-production-v1/candidates/references/rarity-frame-f-v3.png',
					resultPath:
						'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-f-v3.json'
				}
			},
			{
				...value,
				originAuthority: {
					...value.originAuthority,
					assignment: {
						...value.originAuthority.assignment,
						path: 'assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-e-v3.json'
					}
				}
			}
		]) {
			expect(SkillIconReprocessTargetSchema.safeParse(invalid).success).toBe(false);
		}
		expect(
			SkillIconReprocessResultSchema.safeParse({
				...candidateResult(),
				role: 'backing',
				rarity: null
			}).success
		).toBe(false);
	});

	it('permits only truthful post-preflight failures and ordered inspections', () => {
		const candidate = candidateResult();
		const failed = {
			...candidate,
			status: 'failed' as const,
			normalization: normalization('failed'),
			output: null,
			failureReason: { kind: 'validation' as const, message: 'Normalization rejected source.' },
			inspections: [
				{ ...candidate.inspections[0], outcome: 'not-run' as const },
				{ ...candidate.inspections[1], outcome: 'not-run' as const }
			] as const,
			writtenOutputPaths: [output.resultPath] as const
		};
		expect(SkillIconReprocessResultSchema.safeParse(failed).success).toBe(true);
		const fullSizeFailed = {
			...failed,
			normalization: normalization(),
			inspections: [
				{ ...candidate.inspections[0], outcome: 'fail' as const },
				{ ...candidate.inspections[1], outcome: 'not-run' as const }
			] as const
		};
		const recognitionFailed = {
			...fullSizeFailed,
			inspections: [
				candidate.inspections[0],
				{ ...candidate.inspections[1], outcome: 'fail' as const }
			] as const
		};
		const persistenceFailed = {
			...fullSizeFailed,
			failureReason: { kind: 'persistence' as const, message: 'Candidate publication failed.' },
			inspections: candidate.inspections
		};
		expect(SkillIconReprocessResultSchema.safeParse(fullSizeFailed).success).toBe(true);
		expect(SkillIconReprocessResultSchema.safeParse(recognitionFailed).success).toBe(true);
		expect(SkillIconReprocessResultSchema.safeParse(persistenceFailed).success).toBe(true);
		for (const kind of [
			'provider-failure',
			'provider-throttle',
			'timeout',
			'malformed-output',
			'persistence',
			'other'
		] as const) {
			expect(
				SkillIconReprocessResultSchema.safeParse({
					...failed,
					failureReason: { kind, message: 'Impossible zero-generation failure kind.' }
				}).success
			).toBe(false);
		}
		for (const kind of [
			'provider-failure',
			'provider-throttle',
			'timeout',
			'malformed-output',
			'persistence',
			'other'
		] as const) {
			expect(
				SkillIconReprocessResultSchema.safeParse({
					...fullSizeFailed,
					failureReason: { kind, message: 'Inspection failure must be validation.' }
				}).success
			).toBe(false);
		}
		const notRun = {
			profile: 'skill-icon-green-key-role-mask-v3',
			outcome: 'not-run',
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
			providerSource: null,
			sourceContentHash: null,
			decoderInputContentHash: null,
			containerBox: null,
			colorSpaceDisposition: null,
			outputContentHash: null
		};
		for (const invalid of [
			{ ...failed, normalization: notRun },
			{ ...failed, generationAttemptCount: 1 },
			{ ...failed, normalizationTransactionCount: 0 },
			{
				...failed,
				normalization: {
					...failed.normalization,
					providerSource: { ...failed.normalization.providerSource, width: 1024 }
				}
			},
			{ ...failed, inspections: candidate.inspections },
			{ ...fullSizeFailed, inspections: candidate.inspections },
			{
				...recognitionFailed,
				inspections: [
					{ ...candidate.inspections[0], outcome: 'not-run' },
					recognitionFailed.inspections[1]
				]
			},
			{ ...candidate, totalWallTimeMs: 249 }
		]) {
			expect(SkillIconReprocessResultSchema.safeParse(invalid).success).toBe(false);
		}
	});

	it('rejects authority laundering, reprocess chains, and non-older origins', () => {
		const value = {
			schemaVersion: 'skill-icon-reprocess-execution-v1' as const,
			target: target(),
			assignment: assignment(),
			result: candidateResult(),
			origin: origin()
		};
		for (const invalid of [
			{
				...value,
				result: {
					...value.result,
					originAuthority: { ...value.result.originAuthority, providerSourceHash: '8'.repeat(64) }
				}
			},
			{
				...value,
				origin: { ...value.origin, target: { ...value.origin.target, revision: 5, jobId } }
			},
			{
				...value,
				origin: { ...value.origin, target: { ...value.origin.target, rarity: 'E' } }
			},
			{
				...value,
				origin: {
					...value.origin,
					target: { ...value.origin.target, schemaVersion: 'skill-icon-reprocess-target-v1' }
				}
			}
		]) {
			expect(SkillIconReprocessExecutionSchema.safeParse(invalid).success).toBe(false);
		}
	});
});
