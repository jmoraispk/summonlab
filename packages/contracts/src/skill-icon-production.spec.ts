import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	SkillIconAssignmentSchema,
	SkillIconAssignmentPathSchema,
	SkillIconCandidatePathSchema,
	SkillIconCalibrationMasterAssetSchema,
	SkillIconCatalogSchema,
	SkillIconExecutionSchema,
	SkillIconGeometrySchema,
	SkillIconMasterPathSchema,
	SkillIconMasterySchema,
	SkillIconRaritySchema,
	SkillIconRecordSchema,
	SkillIconRecognitionPathSchema,
	SkillIconReferencePathSchema,
	SkillIconRepositoryPathSchema,
	SkillIconResultSchema,
	SkillIconResultPathSchema,
	SkillIconReviewSchema,
	SkillIconRuntimePathSchema,
	SkillIconTargetSchema,
	SkillIconTargetPathSchema,
	SkillIconVisualSpecSchema
} from './index.js';

const hash = 'a'.repeat(64);
const resultHash = 'b'.repeat(64);
const jobId = 'martial-blade-horizontal-slash-v1';
const candidatePath = `assets/wiki/skills/icon-production-v1/candidates/icons/${jobId}.png`;
const resultPath = `assets/wiki/skills/icon-production-v1/results/icons/${jobId}.json`;

function ownedPaths(scope: 'references' | 'calibration' | 'icons', ownedJobId: string) {
	return {
		candidatePath: `assets/wiki/skills/icon-production-v1/candidates/${scope}/${ownedJobId}.png`,
		resultPath: `assets/wiki/skills/icon-production-v1/results/${scope}/${ownedJobId}.json`
	};
}

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

const producerFindings = [
	{
		category: 'geometry' as const,
		evaluator: 'automated' as const,
		outcome: 'pass' as const,
		observation: 'Canvas and safe zones pass.'
	},
	{
		category: 'manifest-fidelity' as const,
		evaluator: 'producer' as const,
		outcome: 'pass' as const,
		observation: 'The generated image matches the declared target.'
	}
];

const producerResult = {
	jobId,
	status: 'candidate' as const,
	path: resultPath,
	contentHash: resultHash,
	findings: producerFindings
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
	producerResult,
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

function assignment() {
	return {
		schemaVersion: 'skill-icon-assignment-v1' as const,
		assignmentId: 'assignment-martial-blade-horizontal-slash-v1',
		jobId,
		targetPath: `assets/wiki/skills/icon-production-v1/targets/icons/${jobId}.json`,
		assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/icons/${jobId}.json`,
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
}

function result() {
	const exactPrompt = skillTarget().exactPrompt;
	return {
		schemaVersion: 'skill-icon-result-v1' as const,
		resultId: 'result-martial-blade-horizontal-slash-v1',
		jobId,
		assignmentId: assignment().assignmentId,
		status: 'candidate' as const,
		exactPrompt,
		promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
		referenceInputs: skillTarget().references.map(({ path, contentHash }) => ({
			path,
			contentHash
		})),
		output: candidateAsset,
		resultPath,
		findings: producerFindings,
		startedAt: '2026-09-01T17:01:00.000Z',
		completedAt: '2026-09-01T17:02:00.000Z',
		totalWallTimeMs: 60_000,
		writtenOutputPaths: [candidatePath, resultPath] as const,
		noSharedFilesEdited: true as const,
		selfPromoted: false as const
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
				producerResult,
				assets: { candidate: candidateAsset },
				review: null
			}).success
		).toBe(true);
		expect(
			SkillIconRecordSchema.safeParse({
				...mappedRecord,
				status: 'candidate',
				visualSpec,
				assets: { candidate: candidateAsset },
				review: null
			}).success
		).toBe(false);
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
		expect(
			SkillIconRepositoryPathSchema.safeParse(
				'assets/wiki/skills/icon-production-v1/references/guide.png\n../../package.json'
			).success
		).toBe(false);
	});

	it('allowlists only image references from production and rarity authority roots', () => {
		for (const path of [
			'assets/wiki/skills/icon-production-v1/references/geometry-guide.svg',
			'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-horizontal-slash.png',
			'assets/wiki/skills/rarity-frame-v1/references/option-c.webp',
			'assets/wiki/skills/rarity-frame-v1/sources/option-c.png'
		]) {
			expect(SkillIconReferencePathSchema.safeParse(path).success).toBe(true);
		}
		for (const path of [
			'.git/config',
			'.env',
			'packages/contracts/src/index.ts',
			'assets/wiki/skills/icon-production-v1/references/geometry.json',
			'assets/wiki/skills/icon-production-v1/references/guide.png\n.env'
		]) {
			expect(SkillIconReferencePathSchema.safeParse(path).success).toBe(false);
		}

		const duplicate = skillTarget().references[0];
		expect(
			SkillIconTargetSchema.safeParse({
				...skillTarget(),
				references: [duplicate, { ...duplicate, purpose: 'Duplicate alias.' }]
			}).success
		).toBe(false);
	});

	it('requires an explicit recognition pass for accepted skill-art review', () => {
		expect(
			SkillIconReviewSchema.safeParse({
				...review,
				findings: [
					{
						criterion: 'recognition',
						outcome: 'not-applicable',
						observation: 'Recognition was not assessed.'
					}
				]
			}).success
		).toBe(false);
	});

	it('binds accepted masters and owner review to the exact produced candidate', () => {
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					approvedMaster: {
						...approvedRecord.assets.approvedMaster,
						contentHash: 'c'.repeat(64)
					}
				}
			}).success
		).toBe(false);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					approvedMaster: { ...approvedRecord.assets.approvedMaster, bytes: 999_999 }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				review: { ...review, candidateHash: 'c'.repeat(64) }
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
			motifFamily: 'blade.sweeping-cut',
			canvas: { width: 2048, height: 1024, mediaType: 'image/png' as const },
			output: ownedPaths('calibration', 'blade-sweeping-cut-calibration-v1')
		};
		expect(SkillIconTargetSchema.safeParse(calibration).success).toBe(true);
		expect(SkillIconTargetSchema.safeParse({ ...calibration, motifFamily: null }).success).toBe(
			false
		);

		for (const role of ['rarity-frame', 'backing'] as const) {
			const roleJobId = `${role}-v1`;
			const target = {
				...skillTarget(),
				jobId: roleJobId,
				role,
				skillTargetId: null,
				motifFamily: null,
				rarity: role === 'rarity-frame' ? ('F' as const) : null,
				output: ownedPaths('references', roleJobId)
			};
			expect(SkillIconTargetSchema.safeParse(target).success).toBe(true);
		}

		expect(
			SkillIconTargetSchema.safeParse({
				...skillTarget(),
				canvas: { width: 1, height: 8192, mediaType: 'image/png' }
			}).success
		).toBe(false);

		expect(
			SkillIconTargetSchema.safeParse({
				...skillTarget(),
				output: { candidatePath, resultPath: candidatePath }
			}).success
		).toBe(false);
	});

	it('uses collision-safe path namespaces and exact standalone derivative contracts', () => {
		expect(SkillIconCandidatePathSchema.safeParse(candidatePath).success).toBe(true);
		expect(
			SkillIconMasterPathSchema.safeParse(
				'assets/wiki/skills/icon-production-v1/masters/icons/martial-blade-horizontal-slash.png'
			).success
		).toBe(true);
		expect(
			SkillIconRuntimePathSchema.safeParse(
				'apps/web/static/skill-icons/v1/512/martial-blade-horizontal-slash.webp'
			).success
		).toBe(true);
		expect(
			SkillIconRecognitionPathSchema.safeParse(
				'assets/wiki/skills/icon-production-v1/review/recognition/martial-blade-horizontal-slash.png'
			).success
		).toBe(true);
		expect(
			SkillIconTargetPathSchema.safeParse(
				`assets/wiki/skills/icon-production-v1/targets/icons/${jobId}.json`
			).success
		).toBe(true);
		expect(
			SkillIconAssignmentPathSchema.safeParse(
				`assets/wiki/skills/icon-production-v1/assignments/icons/${jobId}.json`
			).success
		).toBe(true);
		expect(SkillIconResultPathSchema.safeParse(resultPath).success).toBe(true);
		expect(
			SkillIconTargetPathSchema.safeParse(
				`assets/wiki/skills/icon-production-v1/targets/icons/${jobId}.json/package.json`
			).success
		).toBe(false);

		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					candidate: { ...candidateAsset, alphaMode: 'grayscale-alpha' }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				assets: {
					...approvedRecord.assets,
					runtime512: {
						...approvedRecord.assets.runtime512,
						path: 'apps/web/static/skill-icons/v1/256/martial-blade-horizontal-slash.webp'
					}
				}
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
		expect(SkillIconAssignmentSchema.safeParse(assignment()).success).toBe(true);
		expect(SkillIconResultSchema.safeParse(result()).success).toBe(true);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				writtenOutputPaths: [...result().writtenOutputPaths, 'assets/wiki/shared.json']
			}).success
		).toBe(false);
	});

	it('requires candidate producer and automated passes while preserving honest failures', () => {
		const automatedGeometryFail = {
			category: 'geometry' as const,
			evaluator: 'automated' as const,
			outcome: 'fail' as const,
			observation: 'Visible pixels escape the effect-safe region.'
		};
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				findings: [...producerFindings, automatedGeometryFail]
			}).success
		).toBe(false);
		for (const findings of [[producerFindings[0]], [producerFindings[1]]]) {
			expect(SkillIconResultSchema.safeParse({ ...result(), findings }).success).toBe(false);
		}
		expect(
			SkillIconRecordSchema.safeParse({
				...approvedRecord,
				status: 'candidate',
				assets: { candidate: candidateAsset },
				producerResult: {
					...producerResult,
					findings: [...producerFindings, automatedGeometryFail]
				},
				review: null
			}).success
		).toBe(false);

		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'revise',
				findings: [automatedGeometryFail]
			}).success
		).toBe(true);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'failed',
				output: null,
				findings: [automatedGeometryFail],
				writtenOutputPaths: [resultPath]
			}).success
		).toBe(true);
	});

	it('preserves exact prompt whitespace and hashes the original bytes', () => {
		const exactPrompt = '  Paint one polished sword.\n';
		const target = { ...skillTarget(), exactPrompt };
		const produced = {
			...result(),
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex')
		};
		const parsed = SkillIconExecutionSchema.safeParse({
			schemaVersion: 'skill-icon-execution-v1',
			target,
			assignment: assignment(),
			result: produced
		});
		expect(parsed.success).toBe(true);
		if (parsed.success) expect(parsed.data.result.exactPrompt).toBe(exactPrompt);

		expect(
			SkillIconResultSchema.safeParse({
				...produced,
				promptHash: createHash('sha256').update(exactPrompt.trim()).digest('hex')
			}).success
		).toBe(false);
	});

	it('binds target, assignment, and result as one exact execution', () => {
		const execution = {
			schemaVersion: 'skill-icon-execution-v1' as const,
			target: skillTarget(),
			assignment: assignment(),
			result: result()
		};
		expect(SkillIconExecutionSchema.safeParse(execution).success).toBe(true);
		expect(
			SkillIconExecutionSchema.safeParse({
				...execution,
				result: { ...result(), jobId: 'martial-blade-other-job-v1' }
			}).success
		).toBe(false);
		expect(
			SkillIconExecutionSchema.safeParse({
				...execution,
				result: { ...result(), exactPrompt: 'A different prompt.' }
			}).success
		).toBe(false);
		expect(
			SkillIconExecutionSchema.safeParse({
				...execution,
				result: {
					...result(),
					referenceInputs: [{ ...result().referenceInputs[0], contentHash: 'c'.repeat(64) }]
				}
			}).success
		).toBe(false);
		expect(
			SkillIconExecutionSchema.safeParse({
				...execution,
				result: {
					...result(),
					output: { ...candidateAsset, width: 2048 }
				}
			}).success
		).toBe(false);
	});

	it('allows explicitly sized RGB calibration results only through calibration targets', () => {
		const calibrationJobId = 'blade-sweeping-cut-calibration-v1';
		const paths = ownedPaths('calibration', calibrationJobId);
		const target = {
			...skillTarget(),
			jobId: calibrationJobId,
			role: 'calibration-plate' as const,
			skillTargetId: null,
			motifFamily: 'blade.sweeping-cut',
			canvas: { width: 2048, height: 1024, mediaType: 'image/png' as const },
			output: paths
		};
		const assigned = {
			...assignment(),
			assignmentId: 'assignment-blade-sweeping-cut-calibration-v1',
			jobId: calibrationJobId,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/calibration/${calibrationJobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/calibration/${calibrationJobId}.json`,
			permittedOutputs: paths
		};
		const exactPrompt = target.exactPrompt;
		const produced = {
			...result(),
			resultId: 'result-blade-sweeping-cut-calibration-v1',
			jobId: calibrationJobId,
			assignmentId: assigned.assignmentId,
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
			output: {
				...candidateAsset,
				path: paths.candidatePath,
				width: 2048,
				height: 1024,
				alphaMode: 'rgb' as const
			},
			resultPath: paths.resultPath,
			writtenOutputPaths: [paths.candidatePath, paths.resultPath] as const
		};
		expect(
			SkillIconCalibrationMasterAssetSchema.safeParse({
				...produced.output,
				path: `assets/wiki/skills/icon-production-v1/masters/calibration/${calibrationJobId}.png`
			}).success
		).toBe(true);
		expect(
			SkillIconExecutionSchema.safeParse({
				schemaVersion: 'skill-icon-execution-v1',
				target,
				assignment: assigned,
				result: produced
			}).success
		).toBe(true);
	});
});
