import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SkillIconReprocessAssignmentSchema,
	SkillIconReprocessResultSchema,
	SkillIconReprocessTargetSchema
} from '../packages/contracts/src/index.js';
import { assertSkillIconReprocessExecutionBytes } from './skill-icon-reprocess-consumer-lib.js';

const originTargetPath =
	'assets/wiki/skills/icon-production-v1/targets/references/rarity-frame-f-v3.json';
const originAssignmentPath =
	'assets/wiki/skills/icon-production-v1/assignments/references/rarity-frame-f-v3.json';
const originResultPath =
	'assets/wiki/skills/icon-production-v1/results/references/rarity-frame-f-v3.json';
const [originTargetBytes, originAssignmentBytes, originResultBytes] = await Promise.all([
	readFile(originTargetPath),
	readFile(originAssignmentPath),
	readFile(originResultPath)
]);
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const providerSourceHash = JSON.parse(originResultBytes.toString('utf8')).normalization
	.providerSource.contentHash as string;

function fixture() {
	const jobId = 'rarity-frame-f-v5';
	const targetPath = `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`;
	const assignmentPath = `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`;
	const resultPath = `assets/wiki/skills/icon-production-v1/results/references/${jobId}.json`;
	const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/references/${jobId}.png`;
	const originAuthority = {
		target: { path: originTargetPath, contentHash: sha256(originTargetBytes) },
		assignment: { path: originAssignmentPath, contentHash: sha256(originAssignmentBytes) },
		result: { path: originResultPath, contentHash: sha256(originResultBytes) },
		providerSourceHash
	};
	const processingAuthority = {
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
	const target = SkillIconReprocessTargetSchema.parse({
		schemaVersion: 'skill-icon-reprocess-target-v1',
		jobId,
		logicalIdentity: 'rarity-frame-f',
		revision: 5,
		role: 'rarity-frame',
		rarity: 'F',
		sourceMode: 'reuse-prior-provider-source',
		originAuthority,
		processingAuthority,
		output: { candidatePath, resultPath }
	});
	const targetBytes = Buffer.from(JSON.stringify(target));
	const assignment = SkillIconReprocessAssignmentSchema.parse({
		schemaVersion: 'skill-icon-reprocess-assignment-v1',
		assignmentId: `assignment-${jobId}`,
		jobId,
		logicalIdentity: target.logicalIdentity,
		revision: target.revision,
		role: target.role,
		rarity: target.rarity,
		targetPath,
		targetContentHash: sha256(targetBytes),
		assignmentPath,
		toolVersion: 'summonlab-skill-icon-reprocess-v1',
		sourceMode: target.sourceMode,
		generationAttemptLimit: 0,
		normalizationTransactionLimit: 1,
		permittedOutputs: target.output,
		completionContract: {
			coordinatorOnly: true,
			structuredResultRequired: true,
			sharedFilesMustRemainUntouched: true,
			selfPromotionForbidden: true
		}
	});
	const assignmentBytes = Buffer.from(JSON.stringify(assignment));
	const outputHash = 'e'.repeat(64);
	const result = SkillIconReprocessResultSchema.parse({
		schemaVersion: 'skill-icon-reprocess-result-v1',
		resultId: `result-${jobId}`,
		jobId,
		logicalIdentity: target.logicalIdentity,
		revision: target.revision,
		role: target.role,
		rarity: target.rarity,
		assignmentId: assignment.assignmentId,
		targetPath,
		targetContentHash: sha256(targetBytes),
		assignmentPath,
		assignmentContentHash: sha256(assignmentBytes),
		status: 'candidate',
		sourceMode: target.sourceMode,
		originAuthority,
		processingAuthority,
		generationAttemptCount: 0,
		normalizationTransactionCount: 1,
		normalization: {
			profile: processingAuthority.profile,
			outcome: 'completed',
			geometryHash: processingAuthority.geometry.contentHash,
			providerSource: {
				mediaType: 'image/png',
				width: 1254,
				height: 1254,
				bytes: 1_452_253,
				alphaMode: 'rgb',
				contentHash: providerSourceHash
			},
			sourceContentHash: providerSourceHash,
			decoderInputContentHash: 'a'.repeat(64),
			containerBox: { chunkType: 'caBX', bytes: 8, contentHash: 'b'.repeat(64) },
			colorSpaceDisposition: 'assigned-srgb',
			outputContentHash: outputHash
		},
		output: {
			path: candidatePath,
			mediaType: 'image/png',
			width: 1024,
			height: 1024,
			bytes: 1234,
			alphaMode: 'rgba',
			contentHash: outputHash
		},
		resultPath,
		inspections: [
			{ inspection: 'full-size', outcome: 'pass', observation: 'Full size passes.' },
			{ inspection: 'recognition-96', outcome: 'pass', observation: 'Recognition passes.' }
		],
		startedAt: '2026-09-03T12:00:00.000Z',
		completedAt: '2026-09-03T12:00:01.000Z',
		totalWallTimeMs: 1000,
		writtenOutputPaths: [candidatePath, resultPath],
		noSharedFilesEdited: true,
		selfPromoted: false
	});
	return {
		targetPath,
		targetBytes,
		assignmentPath,
		assignmentBytes,
		resultPath,
		resultBytes: Buffer.from(JSON.stringify(result)),
		originTargetBytes,
		originAssignmentBytes,
		originResultBytes,
		originCandidatePresent: false
	};
}

describe('reprocess consumer authority', () => {
	it('accepts an exact byte-bound ordinary failed origin', () => {
		expect(() => assertSkillIconReprocessExecutionBytes(fixture())).not.toThrow();
	});

	it.each([
		[
			'target',
			(value: ReturnType<typeof fixture>) => ({
				...value,
				targetBytes: Buffer.concat([value.targetBytes, Buffer.from(' ')])
			})
		],
		[
			'assignment',
			(value: ReturnType<typeof fixture>) => ({
				...value,
				assignmentBytes: Buffer.concat([value.assignmentBytes, Buffer.from(' ')])
			})
		],
		[
			'origin result',
			(value: ReturnType<typeof fixture>) => ({
				...value,
				originResultBytes: Buffer.concat([value.originResultBytes, Buffer.from(' ')])
			})
		]
	])('rejects changed %s bytes', (_label, mutate) => {
		expect(() => assertSkillIconReprocessExecutionBytes(mutate(fixture()))).toThrow();
	});

	it('rejects an origin candidate appearing after the failed execution', () => {
		expect(() =>
			assertSkillIconReprocessExecutionBytes({ ...fixture(), originCandidatePresent: true })
		).toThrow(/origin candidate must be absent/iu);
	});

	it('rejects prompt/reference laundering and a reprocess origin', () => {
		const value = fixture();
		const result = JSON.parse(value.resultBytes.toString('utf8')) as Record<string, unknown>;
		expect(() =>
			assertSkillIconReprocessExecutionBytes({
				...value,
				resultBytes: Buffer.from(JSON.stringify({ ...result, exactPrompt: 'Not generated.' }))
			})
		).toThrow();
		expect(() =>
			assertSkillIconReprocessExecutionBytes({ ...value, originTargetBytes: value.targetBytes })
		).toThrow();
	});
});
