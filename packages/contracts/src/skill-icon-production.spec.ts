import { describe, expect, it } from 'vitest';

import {
	SkillIconAssignmentSchema,
	SkillIconCatalogSchema,
	SkillIconGeometrySchema,
	SkillIconMasterySchema,
	SkillIconRaritySchema,
	SkillIconRecordSchema,
	SkillIconResultSchema,
	SkillIconReviewSchema,
	SkillIconTargetSchema,
	SkillIconVisualSpecSchema
} from './index.js';

const hash = 'a'.repeat(64);
const candidatePath =
	'assets/wiki/skills/icon-production-v1/candidates/icons/martial-blade-horizontal-slash-v1.png';
const resultPath =
	'assets/wiki/skills/icon-production-v1/results/icons/martial-blade-horizontal-slash-v1.json';

const visualSpec = {
	dominantSubject: 'One polished sword cutting laterally through the center',
	supportingCue: 'One thin horizontal pressure wake',
	semanticPalette: ['polished steel', 'pale cyan-white air'],
	composition: 'Single centered emblem with a clear silhouette and negative space.',
	exclusions: ['No text', 'No rarity materials', 'No narrative scenery']
};

const candidateAsset = {
	path: candidatePath,
	mediaType: 'image/png' as const,
	width: 1024,
	height: 1024,
	bytes: 1_000_000,
	alphaMode: 'rgba' as const,
	contentHash: hash
};

const review = {
	schemaVersion: 'skill-icon-review-v1' as const,
	reviewId: 'review-martial-blade-horizontal-slash-v1',
	jobId: 'martial-blade-horizontal-slash-v1',
	role: 'skill-art' as const,
	skillTargetId: 'martial:blade:horizontal-slash',
	candidatePath,
	candidateHash: hash,
	reviewer: 'Skills visual owner',
	reviewerRole: 'owner' as const,
	decision: 'accepted' as const,
	rationale: 'Readable at recognition size and coherent with the family.',
	findings: [
		{
			criterion: 'recognition',
			outcome: 'pass' as const,
			observation: 'The lateral sword cut remains immediately recognizable at 96 pixels.'
		}
	],
	reviewedAt: '2026-09-01T18:00:00.000Z'
};

const commonRecord = {
	targetId: 'martial:blade:horizontal-slash',
	domain: 'Martial' as const,
	family: 'Blade',
	name: 'Horizontal Slash',
	labels: [{ namespace: 'Equipment' as const, value: 'Sword' }],
	rarity: 'F' as const,
	type: 'A',
	requires: 'Swordsmanship Novice',
	effect: 'A controlled lateral sword cut.',
	mapEntryId: 'blade.sweeping-cut',
	motifFamily: 'blade.sweeping-cut',
	primaryVisualParent: null
};

const mappedRecord = {
	...commonRecord,
	status: 'mapped' as const,
	visualSpec: null,
	assets: null,
	review: null
};

const approvedRecord = {
	...commonRecord,
	status: 'approved' as const,
	visualSpec,
	assets: {
		candidate: candidateAsset,
		approvedMaster: {
			...candidateAsset,
			path: 'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-horizontal-slash.png'
		},
		runtime512: {
			...candidateAsset,
			path: 'apps/web/static/skill-icons/v1/512/martial-blade-horizontal-slash.webp',
			mediaType: 'image/webp' as const,
			width: 512,
			height: 512
		},
		runtime256: {
			...candidateAsset,
			path: 'apps/web/static/skill-icons/v1/256/martial-blade-horizontal-slash.webp',
			mediaType: 'image/webp' as const,
			width: 256,
			height: 256
		},
		runtime128: {
			...candidateAsset,
			path: 'apps/web/static/skill-icons/v1/128/martial-blade-horizontal-slash.webp',
			mediaType: 'image/webp' as const,
			width: 128,
			height: 128
		},
		recognition96: {
			...candidateAsset,
			path: 'assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-horizontal-slash.png',
			width: 96,
			height: 96
		}
	},
	review
};

function skillTarget() {
	return {
		schemaVersion: 'skill-icon-target-v1' as const,
		jobId: 'martial-blade-horizontal-slash-v1',
		role: 'skill-art' as const,
		skillTargetId: 'martial:blade:horizontal-slash',
		motifFamily: null,
		rarity: null,
		exactPrompt: 'Paint one polished sword cutting laterally through the center.',
		references: [
			{
				path: 'assets/wiki/skills/icon-production-v1/references/geometry-guide.png',
				purpose: 'Shared registration and safe-zone authority.',
				contentHash: hash
			}
		],
		canvas: { width: 1024, height: 1024, mediaType: 'image/png' as const },
		output: { candidatePath, resultPath }
	};
}

describe('skill-icon production contracts', () => {
	it('enforces the staged lifecycle without silent incompleteness', () => {
		expect(SkillIconRecordSchema.parse(mappedRecord)).toMatchObject({
			status: 'mapped',
			visualSpec: null,
			assets: null
		});
		expect(
			SkillIconRecordSchema.safeParse({
				...mappedRecord,
				status: 'authored',
				visualSpec: null
			}).success
		).toBe(false);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: { ...approvedRecord.assets, runtime128: undefined }
			}).success
		).toBe(false);

		expect(
			SkillIconRecordSchema.safeParse({
				...mappedRecord,
				status: 'candidate',
				visualSpec,
				assets: { candidate: candidateAsset },
				review: null
			}).success
		).toBe(true);
		expect(SkillIconRecordSchema.safeParse(approvedRecord).success).toBe(true);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				review: { ...review, decision: 'revise' }
			}).success
		).toBe(false);
		expect(SkillIconReviewSchema.safeParse({ ...review, reviewerRole: 'producer' }).success).toBe(
			false
		);
	});

	it('accepts only canonical rarity and mastery values', () => {
		for (const rarity of ['F', 'E', 'D', 'C', 'B', 'A', 'S']) {
			expect(SkillIconRaritySchema.safeParse(rarity).success).toBe(true);
		}
		expect(SkillIconRaritySchema.safeParse('SS').success).toBe(false);

		for (const mastery of ['Novice', 'Intermediate', 'Expert', 'Master']) {
			expect(SkillIconMasterySchema.safeParse(mastery).success).toBe(true);
		}
		expect(SkillIconMasterySchema.safeParse('Grandmaster').success).toBe(false);
	});

	it('requires repository-relative POSIX paths and lowercase SHA-256 hashes', () => {
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					candidate: { ...candidateAsset, path: '/tmp/candidate.png' }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					candidate: { ...candidateAsset, path: 'assets\\candidate.png' }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					candidate: { ...candidateAsset, contentHash: hash.toUpperCase() }
				}
			}).success
		).toBe(false);
	});

	it('requires standalone records to omit motif lineage', () => {
		const standalone = {
			...mappedRecord,
			mapEntryId: 'body.presence',
			motifFamily: null,
			primaryVisualParent: null
		};
		expect(SkillIconRecordSchema.safeParse(standalone).success).toBe(true);
		expect(
			SkillIconRecordSchema.safeParse({
				...standalone,
				primaryVisualParent: 'martial:body:footing'
			}).success
		).toBe(false);
	});

	it('enforces role-specific target identity and exactly one owned output pair', () => {
		expect(SkillIconTargetSchema.safeParse(skillTarget()).success).toBe(true);
		expect(SkillIconTargetSchema.safeParse({ ...skillTarget(), skillTargetId: null }).success).toBe(
			false
		);
		expect(
			SkillIconTargetSchema.safeParse({ ...skillTarget(), motifFamily: 'blade.sweeping-cut' })
				.success
		).toBe(false);

		const calibration = {
			...skillTarget(),
			jobId: 'blade-sweeping-cut-calibration-v1',
			role: 'calibration-plate' as const,
			skillTargetId: null,
			motifFamily: 'blade.sweeping-cut'
		};
		expect(SkillIconTargetSchema.safeParse(calibration).success).toBe(true);
		expect(SkillIconTargetSchema.safeParse({ ...calibration, motifFamily: null }).success).toBe(
			false
		);

		for (const role of ['rarity-frame', 'backing'] as const) {
			const target = {
				...skillTarget(),
				jobId: `${role}-v1`,
				role,
				skillTargetId: null,
				motifFamily: null,
				rarity: role === 'rarity-frame' ? ('F' as const) : null
			};
			expect(SkillIconTargetSchema.safeParse(target).success).toBe(true);
		}

		expect(
			SkillIconTargetSchema.safeParse({
				...skillTarget(),
				output: { candidatePath, resultPath: candidatePath }
			}).success
		).toBe(false);
	});

	it('validates all versioned top-level contracts', () => {
		expect(
			SkillIconGeometrySchema.safeParse({
				schemaVersion: 'skill-icon-geometry-v1',
				canvas: { width: 1024, height: 1024 },
				center: { x: 512, y: 512 },
				aperturePoints: [
					[0.5, 0.078125],
					[0.8828125, 0.296875],
					[0.8828125, 0.703125],
					[0.5, 0.921875],
					[0.1171875, 0.703125],
					[0.1171875, 0.296875]
				],
				subjectSafePercent: 64,
				effectSafePercent: 72,
				rarityMedallionExclusion: [
					[0.41015625, 0],
					[0.58984375, 0],
					[0.58984375, 0.21484375],
					[0.41015625, 0.21484375]
				],
				runtimeSizes: [512, 256, 128],
				recognitionSize: 96
			}).success
		).toBe(true);
		expect(SkillIconVisualSpecSchema.safeParse(visualSpec).success).toBe(true);
		expect(
			SkillIconCatalogSchema.safeParse({
				schemaVersion: 'skill-icon-catalog-v1',
				records: [mappedRecord]
			}).success
		).toBe(true);
		expect(SkillIconReviewSchema.safeParse(review).success).toBe(true);
	});

	it('keeps assignments and results bounded to one candidate and result path', () => {
		const assignment = {
			schemaVersion: 'skill-icon-assignment-v1' as const,
			assignmentId: 'assignment-martial-blade-horizontal-slash-v1',
			jobId: 'martial-blade-horizontal-slash-v1',
			targetPath:
				'assets/wiki/skills/icon-production-v1/targets/icons/martial-blade-horizontal-slash-v1.json',
			skillVersion: 'summonlab-skill-icon-production-v1',
			assignedAt: '2026-09-01T17:00:00.000Z',
			retryCeiling: 1,
			permittedOutputs: { candidatePath, resultPath },
			forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
			completionContract: {
				oneTargetOneImage: true,
				structuredResultRequired: true,
				sharedFilesMustRemainUntouched: true,
				selfPromotionForbidden: true
			}
		};
		expect(SkillIconAssignmentSchema.safeParse(assignment).success).toBe(true);

		const result = {
			schemaVersion: 'skill-icon-result-v1' as const,
			resultId: 'result-martial-blade-horizontal-slash-v1',
			jobId: 'martial-blade-horizontal-slash-v1',
			assignmentId: assignment.assignmentId,
			status: 'candidate' as const,
			exactPrompt: skillTarget().exactPrompt,
			promptHash: hash,
			referenceInputs: skillTarget().references.map(({ path, contentHash }) => ({
				path,
				contentHash
			})),
			output: candidateAsset,
			resultPath,
			findings: [
				{
					category: 'geometry' as const,
					evaluator: 'automated' as const,
					outcome: 'pass' as const,
					observation: 'Canvas and safe zones pass.'
				}
			],
			startedAt: '2026-09-01T17:01:00.000Z',
			completedAt: '2026-09-01T17:02:00.000Z',
			totalWallTimeMs: 60_000,
			writtenOutputPaths: [candidatePath, resultPath],
			noSharedFilesEdited: true,
			selfPromoted: false
		};
		expect(SkillIconResultSchema.safeParse(result).success).toBe(true);
		expect(
			SkillIconResultSchema.safeParse({
				...result,
				writtenOutputPaths: [...result.writtenOutputPaths, 'assets/wiki/shared.json']
			}).success
		).toBe(false);
	});
});
