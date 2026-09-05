import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
	AnySkillIconExecutionSchema,
	AnySkillIconGeometrySchema,
	SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V1_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V1_PURPOSE,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
	SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
	SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
	SKILL_ICON_SUPERSESSION_REASON,
	SkillIconAssignmentSchema,
	SkillIconAssignmentV2Schema,
	SkillIconAssignmentPathSchema,
	SkillIconCandidatePathSchema,
	SkillIconCalibrationMasterAssetSchema,
	SkillIconCatalogSchema,
	SkillIconContainerBoxEvidenceSchema,
	SkillIconExecutionSchema,
	SkillIconExecutionV2Schema,
	SkillIconGeometrySchema,
	SkillIconGeometryV2Schema,
	SkillIconMasterPathSchema,
	SkillIconMasterySchema,
	SkillIconNormalizationEvidenceSchema,
	SkillIconProviderNormalizationProfileSchema,
	SkillIconRaritySchema,
	SkillIconRecordSchema,
	SkillIconRecognitionPathSchema,
	SkillIconReferencePathSchema,
	SkillIconRepositoryPathSchema,
	SkillIconResultSchema,
	SkillIconResultV2Schema,
	SkillIconSupersededResultV2Schema,
	SkillIconResultPathSchema,
	SkillIconReviewSchema,
	SkillIconRuntimePathSchema,
	SkillIconTargetSchema,
	SkillIconTargetV2Schema,
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

function canonicalLegacyGuideReference() {
	return {
		path: SKILL_ICON_NORMALIZATION_GUIDE_V1_PATH,
		purpose: SKILL_ICON_NORMALIZATION_GUIDE_V1_PURPOSE,
		contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V1_HASH
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
			const roleJobId = role === 'rarity-frame' ? 'rarity-frame-f-v1' : 'charcoal-forged-stone-v1';
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
		const canonicalGeometryV1Bytes = readFileSync(
			new URL('../../../assets/wiki/skills/icon-production-v1/geometry.json', import.meta.url)
		);
		expect(createHash('sha256').update(canonicalGeometryV1Bytes).digest('hex')).toBe(
			SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
		);
		const geometryV1 = {
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
		};
		expect(SkillIconGeometrySchema.safeParse(geometryV1).success).toBe(true);
		const geometryV2 = {
			...geometryV1,
			schemaVersion: 'skill-icon-geometry-v2',
			outerEnvelopePoints: [
				[0.5, 0.046875],
				[0.88671875, 0.28125],
				[0.88671875, 0.71875],
				[0.5, 0.953125],
				[0.11328125, 0.71875],
				[0.11328125, 0.28125]
			],
			innerApertureScale: 0.78
		};
		expect(SkillIconGeometryV2Schema.safeParse(geometryV2).success).toBe(true);
		expect(AnySkillIconGeometrySchema.safeParse(geometryV1).success).toBe(true);
		expect(AnySkillIconGeometrySchema.safeParse(geometryV2).success).toBe(true);
		expect(SkillIconGeometrySchema.safeParse(geometryV2).success).toBe(false);
		expect(SkillIconGeometryV2Schema.safeParse(geometryV1).success).toBe(false);
		expect(
			SkillIconGeometryV2Schema.safeParse({ ...geometryV2, innerApertureScale: 0.79 }).success
		).toBe(false);
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
		expect(
			SkillIconAssignmentSchema.safeParse({
				...assignment(),
				skillVersion: 'attacker-v1'
			}).success
		).toBe(false);
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

	it('enforces coherent revise and failed result evidence', () => {
		const concern = {
			category: 'recognition' as const,
			evaluator: 'producer' as const,
			outcome: 'concern' as const,
			observation: 'The mark is not yet distinct at recognition size.'
		};
		const failure = {
			category: 'geometry' as const,
			evaluator: 'automated' as const,
			outcome: 'fail' as const,
			observation: 'The output dimensions do not match the target.'
		};

		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'revise',
				findings: [concern]
			}).success
		).toBe(true);
		expect(SkillIconResultSchema.safeParse({ ...result(), status: 'revise' }).success).toBe(false);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'revise',
				output: null,
				findings: [concern],
				writtenOutputPaths: [resultPath]
			}).success
		).toBe(false);

		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'failed',
				output: null,
				findings: [failure],
				writtenOutputPaths: [resultPath]
			}).success
		).toBe(true);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'failed',
				findings: [failure]
			}).success
		).toBe(false);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'failed',
				output: null,
				writtenOutputPaths: [resultPath]
			}).success
		).toBe(false);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				status: 'failed',
				output: null,
				writtenOutputPaths: [resultPath],
				failureReason: {
					kind: 'provider-failure',
					message: 'The provider returned no image bytes.'
				}
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
				assignment: { ...assignment(), skillVersion: 'attacker-v1' }
			}).success
		).toBe(false);
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

	it('adds a strict, cross-bound v2 provider-normalization protocol without widening v1', () => {
		const v2JobId = 'rarity-frame-f-v2';
		const v2Paths = ownedPaths('references', v2JobId);
		const exactPrompt =
			'Paint the F rarity frame over an opaque #00FF00 matte with no baked checkerboard.';
		const geometryHash = SKILL_ICON_NORMALIZATION_GEOMETRY_HASH;
		const sourceHash = 'e'.repeat(64);
		const outputHash = 'f'.repeat(64);
		const target = {
			schemaVersion: 'skill-icon-target-v2' as const,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 2,
			role: 'rarity-frame' as const,
			skillTargetId: null,
			motifFamily: null,
			rarity: 'F' as const,
			exactPrompt,
			references: [canonicalLegacyGuideReference()],
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' as const },
			output: v2Paths,
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v1' as const,
				sourceContract: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					alphaMode: 'rgb' as const,
					matteColor: '#00FF00' as const
				},
				outputContract: {
					mediaType: 'image/png' as const,
					width: 1024 as const,
					height: 1024 as const,
					alphaMode: 'rgba' as const
				},
				geometry: {
					path: 'assets/wiki/skills/icon-production-v1/geometry.json' as const,
					contentHash: geometryHash
				}
			}
		};
		const assigned = {
			schemaVersion: 'skill-icon-assignment-v2' as const,
			assignmentId: `assignment-${v2JobId}`,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 2,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${v2JobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${v2JobId}.json`,
			skillVersion: 'summonlab-skill-icon-production-v2' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v1' as const },
			assignedAt: '2026-09-02T08:00:00.000Z',
			retryCeiling: 1,
			permittedOutputs: v2Paths,
			forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
			completionContract: assignment().completionContract
		};
		const output = {
			...candidateAsset,
			path: v2Paths.candidatePath,
			contentHash: outputHash
		};
		const produced = {
			schemaVersion: 'skill-icon-result-v2' as const,
			resultId: `result-${v2JobId}`,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 2,
			assignmentId: assigned.assignmentId,
			status: 'candidate' as const,
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
			referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v1' as const,
				outcome: 'completed' as const,
				geometryHash,
				providerSource: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					bytes: 2_000_000,
					alphaMode: 'rgb' as const,
					contentHash: sourceHash
				},
				sourceContentHash: sourceHash,
				outputContentHash: outputHash
			},
			output,
			resultPath: v2Paths.resultPath,
			findings: producerFindings,
			startedAt: '2026-09-02T08:00:00.000Z',
			completedAt: '2026-09-02T08:00:00.000Z',
			totalWallTimeMs: 0,
			writtenOutputPaths: [v2Paths.candidatePath, v2Paths.resultPath] as const,
			noSharedFilesEdited: true as const,
			selfPromoted: false as const
		};
		expect(SkillIconTargetV2Schema.safeParse(target).success).toBe(true);
		for (const profile of [
			'skill-icon-green-key-role-mask-v1',
			'skill-icon-green-key-role-mask-v2'
		] as const) {
			const normalizedTarget = {
				...target,
				normalization: { ...target.normalization, profile }
			};
			expect(SkillIconTargetV2Schema.safeParse(normalizedTarget).success).toBe(true);
			for (const references of [
				[],
				[
					{
						...canonicalLegacyGuideReference(),
						contentHash: '0'.repeat(64)
					}
				],
				[
					{
						...canonicalLegacyGuideReference(),
						purpose: 'An untrusted historical guide.'
					}
				]
			]) {
				expect(SkillIconTargetV2Schema.safeParse({ ...normalizedTarget, references }).success).toBe(
					false
				);
			}
		}
		expect(SkillIconAssignmentV2Schema.safeParse(assigned).success).toBe(true);
		expect(SkillIconResultV2Schema.safeParse(produced).success).toBe(true);
		expect(
			SkillIconExecutionV2Schema.safeParse({
				schemaVersion: 'skill-icon-execution-v2',
				target,
				assignment: assigned,
				result: produced
			}).success
		).toBe(true);
		expect(SkillIconTargetSchema.safeParse(target).success).toBe(false);
		expect(SkillIconAssignmentSchema.safeParse(assigned).success).toBe(false);
		expect(SkillIconResultSchema.safeParse(produced).success).toBe(false);
		expect(
			SkillIconResultSchema.safeParse({
				...result(),
				findings: [
					{
						category: 'deterministic-normalization',
						evaluator: 'automated',
						outcome: 'pass',
						observation: 'V2-only normalization evidence.'
					}
				]
			}).success
		).toBe(false);
		expect(
			AnySkillIconExecutionSchema.safeParse({
				schemaVersion: 'skill-icon-execution-v2',
				target,
				assignment: assignment(),
				result: produced
			}).success
		).toBe(false);
		expect(
			SkillIconExecutionV2Schema.safeParse({
				schemaVersion: 'skill-icon-execution-v2',
				target,
				assignment: assigned,
				result: {
					...produced,
					normalization: { ...produced.normalization, geometryHash: '0'.repeat(64) }
				}
			}).success
		).toBe(false);
		expect(
			SkillIconResultV2Schema.safeParse({
				...produced,
				normalization: {
					...produced.normalization,
					sourceContentHash: '0'.repeat(64)
				}
			}).success
		).toBe(false);
		expect(
			SkillIconTargetV2Schema.safeParse({ ...target, logicalIdentity: 'rarity-frame-e' }).success
		).toBe(false);
		expect(
			SkillIconTargetV2Schema.safeParse({ ...target, exactPrompt: 'Paint a transparent frame.' })
				.success
		).toBe(false);
	});

	it('binds each structural normalization profile to its production skill version', () => {
		expect(
			SkillIconProviderNormalizationProfileSchema.safeParse('skill-icon-green-key-role-mask-v1')
				.success
		).toBe(true);
		expect(
			SkillIconProviderNormalizationProfileSchema.safeParse('skill-icon-green-key-role-mask-v2')
				.success
		).toBe(true);
		expect(
			SkillIconProviderNormalizationProfileSchema.safeParse('skill-icon-green-key-role-mask-v3')
				.success
		).toBe(true);
		expect(
			SkillIconProviderNormalizationProfileSchema.safeParse('skill-icon-green-key-role-mask-v4')
				.success
		).toBe(false);
		expect(
			SkillIconProviderNormalizationProfileSchema.safeParse('skill-icon-geometry-role-mask-v1')
				.success
		).toBe(true);

		const v2JobId = 'rarity-frame-f-v3';
		const v2Paths = ownedPaths('references', v2JobId);
		const v1Assignment = {
			...assignment(),
			schemaVersion: 'skill-icon-assignment-v2' as const,
			assignmentId: `assignment-${v2JobId}`,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 3,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${v2JobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${v2JobId}.json`,
			skillVersion: 'summonlab-skill-icon-production-v2' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v1' as const },
			permittedOutputs: v2Paths
		};
		expect(SkillIconAssignmentV2Schema.safeParse(v1Assignment).success).toBe(true);
		expect(
			SkillIconAssignmentV2Schema.safeParse({
				...v1Assignment,
				skillVersion: 'summonlab-skill-icon-production-v3'
			}).success
		).toBe(false);
		expect(
			SkillIconAssignmentV2Schema.safeParse({
				...v1Assignment,
				skillVersion: 'summonlab-skill-icon-production-v4'
			}).success
		).toBe(false);

		const v2Assignment = {
			...v1Assignment,
			skillVersion: 'summonlab-skill-icon-production-v3' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v2' as const }
		};
		expect(SkillIconAssignmentV2Schema.safeParse(v2Assignment).success).toBe(true);
		expect(
			SkillIconAssignmentV2Schema.safeParse({
				...v2Assignment,
				skillVersion: 'summonlab-skill-icon-production-v2'
			}).success
		).toBe(false);
		expect(
			SkillIconAssignmentV2Schema.safeParse({
				...v2Assignment,
				skillVersion: 'summonlab-skill-icon-production-v4'
			}).success
		).toBe(false);

		const v3Assignment = {
			...v1Assignment,
			skillVersion: 'summonlab-skill-icon-production-v4' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v3' as const }
		};
		expect(SkillIconAssignmentV2Schema.safeParse(v3Assignment).success).toBe(true);
		for (const skillVersion of [
			'summonlab-skill-icon-production-v2',
			'summonlab-skill-icon-production-v3',
			'summonlab-skill-icon-production-v5'
		] as const) {
			expect(SkillIconAssignmentV2Schema.safeParse({ ...v3Assignment, skillVersion }).success).toBe(
				false
			);
		}
		for (const normalization of [
			{ profile: 'skill-icon-green-key-role-mask-v1' as const },
			{ profile: 'skill-icon-green-key-role-mask-v2' as const }
		]) {
			expect(
				SkillIconAssignmentV2Schema.safeParse({ ...v3Assignment, normalization }).success
			).toBe(false);
		}

		const geometryFirstAssignment = {
			...v1Assignment,
			skillVersion: 'summonlab-skill-icon-production-v5' as const,
			normalization: { profile: 'skill-icon-geometry-role-mask-v1' as const }
		};
		expect(SkillIconAssignmentV2Schema.safeParse(geometryFirstAssignment).success).toBe(true);
		for (const skillVersion of [
			'summonlab-skill-icon-production-v2',
			'summonlab-skill-icon-production-v3',
			'summonlab-skill-icon-production-v4'
		] as const) {
			expect(
				SkillIconAssignmentV2Schema.safeParse({ ...geometryFirstAssignment, skillVersion }).success
			).toBe(false);
		}
		for (const profile of [
			'skill-icon-green-key-role-mask-v1',
			'skill-icon-green-key-role-mask-v2',
			'skill-icon-green-key-role-mask-v3'
		] as const) {
			expect(
				SkillIconAssignmentV2Schema.safeParse({
					...geometryFirstAssignment,
					normalization: { profile }
				}).success
			).toBe(false);
		}
	});

	it('requires decoder-input and caBX provenance for completed profile-v2 normalization', () => {
		const v2JobId = 'rarity-frame-f-v3';
		const paths = ownedPaths('references', v2JobId);
		const exactPrompt =
			'Paint the F rarity frame over an opaque #00FF00 matte with no baked checkerboard.';
		const target = {
			schemaVersion: 'skill-icon-target-v2' as const,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 3,
			role: 'rarity-frame' as const,
			skillTargetId: null,
			motifFamily: null,
			rarity: 'F' as const,
			exactPrompt,
			references: [canonicalLegacyGuideReference()],
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' as const },
			output: paths,
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v2' as const,
				sourceContract: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					alphaMode: 'rgb' as const,
					matteColor: '#00FF00' as const
				},
				outputContract: {
					mediaType: 'image/png' as const,
					width: 1024 as const,
					height: 1024 as const,
					alphaMode: 'rgba' as const
				},
				geometry: {
					path: 'assets/wiki/skills/icon-production-v1/geometry.json' as const,
					contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
				}
			}
		};
		const assigned = {
			schemaVersion: 'skill-icon-assignment-v2' as const,
			assignmentId: `assignment-${v2JobId}`,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 3,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${v2JobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${v2JobId}.json`,
			skillVersion: 'summonlab-skill-icon-production-v3' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v2' as const },
			assignedAt: '2026-09-02T08:00:00.000Z',
			retryCeiling: 1,
			permittedOutputs: paths,
			forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
			completionContract: assignment().completionContract
		};
		const outputHash = 'f'.repeat(64);
		const sourceHash = 'e'.repeat(64);
		const produced = {
			schemaVersion: 'skill-icon-result-v2' as const,
			resultId: `result-${v2JobId}`,
			jobId: v2JobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 3,
			assignmentId: assigned.assignmentId,
			status: 'candidate' as const,
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
			referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v2' as const,
				outcome: 'completed' as const,
				geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
				providerSource: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					bytes: 2_000_000,
					alphaMode: 'rgb' as const,
					contentHash: sourceHash
				},
				sourceContentHash: sourceHash,
				decoderInputContentHash: 'c'.repeat(64),
				containerBox: {
					chunkType: 'caBX' as const,
					bytes: 72,
					contentHash: 'd'.repeat(64)
				},
				colorSpaceDisposition: 'assigned-srgb' as const,
				outputContentHash: outputHash
			},
			output: { ...candidateAsset, path: paths.candidatePath, contentHash: outputHash },
			resultPath: paths.resultPath,
			findings: producerFindings,
			startedAt: '2026-09-02T08:00:00.000Z',
			completedAt: '2026-09-02T08:00:00.000Z',
			totalWallTimeMs: 0,
			writtenOutputPaths: [paths.candidatePath, paths.resultPath] as const,
			noSharedFilesEdited: true as const,
			selfPromoted: false as const
		};
		const execution = {
			schemaVersion: 'skill-icon-execution-v2' as const,
			target,
			assignment: assigned,
			result: produced
		};
		expect(SkillIconExecutionV2Schema.safeParse(execution).success).toBe(true);
		expect(
			SkillIconResultV2Schema.safeParse({
				...produced,
				normalization: { ...produced.normalization, decoderInputContentHash: undefined }
			}).success
		).toBe(false);
		expect(
			SkillIconResultV2Schema.safeParse({
				...produced,
				normalization: {
					...produced.normalization,
					containerBox: { ...produced.normalization.containerBox, payload: 'forbidden' }
				}
			}).success
		).toBe(false);
		for (const bytes of [8, 32_768]) {
			expect(
				SkillIconContainerBoxEvidenceSchema.safeParse({
					...produced.normalization.containerBox,
					bytes
				}).success
			).toBe(true);
		}
		for (const bytes of [7, 32_769]) {
			expect(
				SkillIconContainerBoxEvidenceSchema.safeParse({
					...produced.normalization.containerBox,
					bytes
				}).success
			).toBe(false);
		}
		expect(
			SkillIconResultV2Schema.safeParse({
				...produced,
				normalization: {
					...produced.normalization,
					providerSource: {
						...produced.normalization.providerSource,
						bytes: 64 * 1024 * 1024
					}
				}
			}).success
		).toBe(true);
		expect(
			SkillIconResultV2Schema.safeParse({
				...produced,
				normalization: {
					...produced.normalization,
					providerSource: {
						...produced.normalization.providerSource,
						bytes: 64 * 1024 * 1024 + 1
					}
				}
			}).success
		).toBe(false);
		expect(
			SkillIconExecutionV2Schema.safeParse({
				...execution,
				assignment: {
					...assigned,
					normalization: { profile: 'skill-icon-green-key-role-mask-v1' },
					skillVersion: 'summonlab-skill-icon-production-v2'
				}
			}).success
		).toBe(false);
	});

	it('models failed profile-v2 and profile-v3 derived provenance as all-or-none', () => {
		const providerSource = {
			mediaType: 'image/png' as const,
			width: 1254,
			height: 1254,
			bytes: 2_000_000,
			alphaMode: 'rgb' as const,
			contentHash: 'e'.repeat(64)
		};
		const failedBeforeEnvelope = {
			profile: 'skill-icon-green-key-role-mask-v2' as const,
			outcome: 'failed' as const,
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
			providerSource,
			sourceContentHash: providerSource.contentHash,
			decoderInputContentHash: null,
			containerBox: null,
			colorSpaceDisposition: null,
			outputContentHash: null
		};
		const failedAfterEnvelope = {
			...failedBeforeEnvelope,
			decoderInputContentHash: 'c'.repeat(64),
			containerBox: {
				chunkType: 'caBX' as const,
				bytes: 8,
				contentHash: 'd'.repeat(64)
			},
			colorSpaceDisposition: 'assigned-srgb' as const
		};
		expect(SkillIconNormalizationEvidenceSchema.safeParse(failedBeforeEnvelope).success).toBe(true);
		expect(SkillIconNormalizationEvidenceSchema.safeParse(failedAfterEnvelope).success).toBe(true);

		for (const partial of [
			{ ...failedBeforeEnvelope, decoderInputContentHash: 'c'.repeat(64) },
			{ ...failedBeforeEnvelope, containerBox: failedAfterEnvelope.containerBox },
			{ ...failedBeforeEnvelope, colorSpaceDisposition: 'assigned-srgb' },
			{ ...failedAfterEnvelope, decoderInputContentHash: null },
			{ ...failedAfterEnvelope, containerBox: null },
			{ ...failedAfterEnvelope, colorSpaceDisposition: null }
		]) {
			expect(SkillIconNormalizationEvidenceSchema.safeParse(partial).success).toBe(false);
		}

		const profileV3BeforeEnvelope = {
			...failedBeforeEnvelope,
			profile: 'skill-icon-green-key-role-mask-v3' as const,
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
		};
		const profileV3AfterEnvelope = {
			...failedAfterEnvelope,
			profile: 'skill-icon-green-key-role-mask-v3' as const,
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
		};
		expect(SkillIconNormalizationEvidenceSchema.safeParse(profileV3BeforeEnvelope).success).toBe(
			true
		);
		expect(SkillIconNormalizationEvidenceSchema.safeParse(profileV3AfterEnvelope).success).toBe(
			true
		);
		expect(
			SkillIconNormalizationEvidenceSchema.safeParse({
				...profileV3BeforeEnvelope,
				decoderInputContentHash: 'c'.repeat(64)
			}).success
		).toBe(false);
	});

	it('cross-binds geometry-v2 profiles to their raw geometry and guide authorities', () => {
		const geometryBytes = readFileSync(
			new URL(`../../../${SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH}`, import.meta.url)
		);
		const guideBytes = readFileSync(
			new URL(`../../../${SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH}`, import.meta.url)
		);
		expect(createHash('sha256').update(geometryBytes).digest('hex')).toBe(
			SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
		);
		expect(createHash('sha256').update(guideBytes).digest('hex')).toBe(
			SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
		);
		expect(
			SkillIconGeometryV2Schema.safeParse(JSON.parse(geometryBytes.toString('utf8'))).success
		).toBe(true);

		const jobId = 'rarity-frame-f-v4';
		const paths = ownedPaths('references', jobId);
		const exactPrompt =
			'Paint the F rarity frame over an opaque #00FF00 matte with no baked checkerboard.';
		const guideReference = {
			path: SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH,
			purpose: SKILL_ICON_NORMALIZATION_GUIDE_V2_PURPOSE,
			contentHash: SKILL_ICON_NORMALIZATION_GUIDE_V2_HASH
		};
		const target = {
			schemaVersion: 'skill-icon-target-v2' as const,
			jobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 4,
			role: 'rarity-frame' as const,
			skillTargetId: null,
			motifFamily: null,
			rarity: 'F' as const,
			exactPrompt,
			references: [...skillTarget().references, guideReference],
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' as const },
			output: paths,
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v3' as const,
				sourceContract: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					alphaMode: 'rgb' as const,
					matteColor: '#00FF00' as const
				},
				outputContract: {
					mediaType: 'image/png' as const,
					width: 1024 as const,
					height: 1024 as const,
					alphaMode: 'rgba' as const
				},
				geometry: {
					path: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_PATH,
					contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH
				}
			}
		};
		const assigned = {
			schemaVersion: 'skill-icon-assignment-v2' as const,
			assignmentId: `assignment-${jobId}`,
			jobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 4,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${jobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${jobId}.json`,
			skillVersion: 'summonlab-skill-icon-production-v4' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v3' as const },
			assignedAt: '2026-09-02T08:00:00.000Z',
			retryCeiling: 1,
			permittedOutputs: paths,
			forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
			completionContract: assignment().completionContract
		};
		const outputHash = 'f'.repeat(64);
		const sourceHash = 'e'.repeat(64);
		const produced = {
			schemaVersion: 'skill-icon-result-v2' as const,
			resultId: `result-${jobId}`,
			jobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 4,
			assignmentId: assigned.assignmentId,
			status: 'candidate' as const,
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
			referenceInputs: target.references.map(({ path, contentHash }) => ({ path, contentHash })),
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v3' as const,
				outcome: 'completed' as const,
				geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_V2_HASH,
				providerSource: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					bytes: 2_000_000,
					alphaMode: 'rgb' as const,
					contentHash: sourceHash
				},
				sourceContentHash: sourceHash,
				decoderInputContentHash: 'c'.repeat(64),
				containerBox: {
					chunkType: 'caBX' as const,
					bytes: 72,
					contentHash: 'd'.repeat(64)
				},
				colorSpaceDisposition: 'assigned-srgb' as const,
				outputContentHash: outputHash
			},
			output: { ...candidateAsset, path: paths.candidatePath, contentHash: outputHash },
			resultPath: paths.resultPath,
			findings: producerFindings,
			startedAt: '2026-09-02T08:00:00.000Z',
			completedAt: '2026-09-02T08:00:00.000Z',
			totalWallTimeMs: 0,
			writtenOutputPaths: [paths.candidatePath, paths.resultPath] as const,
			noSharedFilesEdited: true as const,
			selfPromoted: false as const
		};
		const execution = {
			schemaVersion: 'skill-icon-execution-v2' as const,
			target,
			assignment: assigned,
			result: produced
		};

		expect(SkillIconTargetV2Schema.safeParse(target).success).toBe(true);
		expect(SkillIconAssignmentV2Schema.safeParse(assigned).success).toBe(true);
		expect(SkillIconResultV2Schema.safeParse(produced).success).toBe(true);
		expect(SkillIconExecutionV2Schema.safeParse(execution).success).toBe(true);

		for (const normalization of [
			{
				...target.normalization,
				geometry: {
					path: 'assets/wiki/skills/icon-production-v1/geometry.json',
					contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
				}
			},
			{
				...target.normalization,
				geometry: { ...target.normalization.geometry, contentHash: '0'.repeat(64) }
			},
			{ ...target.normalization, profile: 'skill-icon-green-key-role-mask-v2' }
		]) {
			expect(SkillIconTargetV2Schema.safeParse({ ...target, normalization }).success).toBe(false);
		}

		for (const references of [
			target.references.filter((reference) => reference.path !== guideReference.path),
			target.references.map((reference) =>
				reference.path === guideReference.path
					? { ...reference, contentHash: '0'.repeat(64) }
					: reference
			),
			target.references.map((reference) =>
				reference.path === guideReference.path
					? { ...reference, purpose: 'An untrusted substitute guide.' }
					: reference
			)
		]) {
			expect(SkillIconTargetV2Schema.safeParse({ ...target, references }).success).toBe(false);
		}

		expect(
			SkillIconExecutionV2Schema.safeParse({
				...execution,
				result: {
					...produced,
					normalization: {
						...produced.normalization,
						geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
					}
				}
			}).success
		).toBe(false);
		expect(
			SkillIconExecutionV2Schema.safeParse({
				...execution,
				result: {
					...produced,
					referenceInputs: produced.referenceInputs.map((reference) =>
						reference.path === guideReference.path
							? { ...reference, contentHash: '0'.repeat(64) }
							: reference
					)
				}
			}).success
		).toBe(false);

		const geometryJobId = 'rarity-frame-f-v6';
		const geometryPaths = ownedPaths('references', geometryJobId);
		const geometryTarget = {
			...target,
			jobId: geometryJobId,
			revision: 6,
			output: geometryPaths,
			normalization: {
				...target.normalization,
				profile: 'skill-icon-geometry-role-mask-v1' as const
			}
		};
		const geometryAssignment = {
			...assigned,
			assignmentId: `assignment-${geometryJobId}`,
			jobId: geometryJobId,
			revision: 6,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${geometryJobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${geometryJobId}.json`,
			skillVersion: 'summonlab-skill-icon-production-v5' as const,
			normalization: { profile: 'skill-icon-geometry-role-mask-v1' as const },
			permittedOutputs: geometryPaths
		};
		const geometryResult = {
			...produced,
			resultId: `result-${geometryJobId}`,
			jobId: geometryJobId,
			revision: 6,
			assignmentId: geometryAssignment.assignmentId,
			normalization: {
				...produced.normalization,
				profile: 'skill-icon-geometry-role-mask-v1' as const
			},
			output: {
				...produced.output,
				path: geometryPaths.candidatePath
			},
			resultPath: geometryPaths.resultPath,
			writtenOutputPaths: [geometryPaths.candidatePath, geometryPaths.resultPath] as const
		};
		const geometryExecution = {
			schemaVersion: 'skill-icon-execution-v2' as const,
			target: geometryTarget,
			assignment: geometryAssignment,
			result: geometryResult
		};

		expect(SkillIconTargetV2Schema.safeParse(geometryTarget).success).toBe(true);
		expect(SkillIconAssignmentV2Schema.safeParse(geometryAssignment).success).toBe(true);
		expect(SkillIconResultV2Schema.safeParse(geometryResult).success).toBe(true);
		expect(SkillIconExecutionV2Schema.safeParse(geometryExecution).success).toBe(true);
		expect(
			SkillIconAssignmentV2Schema.safeParse({
				...geometryAssignment,
				skillVersion: 'summonlab-skill-icon-production-v4'
			}).success
		).toBe(false);
		expect(
			SkillIconAssignmentV2Schema.safeParse({
				...geometryAssignment,
				normalization: { profile: 'skill-icon-green-key-role-mask-v3' }
			}).success
		).toBe(false);
		expect(
			SkillIconTargetV2Schema.safeParse({
				...geometryTarget,
				normalization: {
					...geometryTarget.normalization,
					geometry: {
						path: 'assets/wiki/skills/icon-production-v1/geometry.json',
						contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
					}
				}
			}).success
		).toBe(false);
		expect(
			SkillIconTargetV2Schema.safeParse({
				...geometryTarget,
				references: geometryTarget.references.filter(
					(reference) => reference.path !== SKILL_ICON_NORMALIZATION_GUIDE_V2_PATH
				)
			}).success
		).toBe(false);
		for (const field of [
			'decoderInputContentHash',
			'containerBox',
			'colorSpaceDisposition'
		] as const) {
			const normalization = { ...geometryResult.normalization };
			delete normalization[field];
			expect(SkillIconResultV2Schema.safeParse({ ...geometryResult, normalization }).success).toBe(
				false
			);
		}
	});

	it('continues parsing every committed structural-v2 target against its raw guide bytes', () => {
		const targetDirectory = new URL(
			'../../../assets/wiki/skills/icon-production-v1/targets/references/',
			import.meta.url
		);
		let structuralV2Count = 0;
		for (const filename of readdirSync(targetDirectory).filter((entry) =>
			entry.endsWith('.json')
		)) {
			const target = JSON.parse(readFileSync(new URL(filename, targetDirectory), 'utf8')) as {
				schemaVersion?: unknown;
			};
			if (target.schemaVersion !== 'skill-icon-target-v2') continue;
			structuralV2Count += 1;
			const parsed = SkillIconTargetV2Schema.safeParse(target);
			const parsingError = parsed.success ? '' : parsed.error.message;
			expect(parsed.success, `${filename}: ${parsingError}`).toBe(true);
		}
		expect(structuralV2Count).toBe(31);
	});

	it('records an unattempted superseded packet only against stronger raw authority', () => {
		const retiredJobId = 'rarity-frame-f-v2';
		const replacementJobId = 'rarity-frame-f-v3';
		const retiredPaths = ownedPaths('references', retiredJobId);
		const exactPrompt =
			'Paint the F rarity frame over an opaque #00FF00 matte with no baked checkerboard.';
		const normalization = {
			profile: 'skill-icon-green-key-role-mask-v1' as const,
			outcome: 'not-run' as const,
			geometryHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH,
			providerSource: null,
			sourceContentHash: null,
			outputContentHash: null
		};
		const superseded = {
			schemaVersion: 'skill-icon-result-v2' as const,
			resultId: `result-${retiredJobId}`,
			jobId: retiredJobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 2,
			role: 'rarity-frame' as const,
			assignmentId: `assignment-${retiredJobId}`,
			status: 'superseded' as const,
			attemptCount: 0 as const,
			supersessionReason: SKILL_ICON_SUPERSESSION_REASON,
			supersedingAuthority: {
				targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${replacementJobId}.json`,
				targetContentHash: '1'.repeat(64),
				assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${replacementJobId}.json`,
				assignmentContentHash: '2'.repeat(64),
				jobId: replacementJobId,
				logicalIdentity: 'rarity-frame-f',
				revision: 3,
				role: 'rarity-frame' as const
			},
			exactPrompt,
			promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
			referenceInputs: [canonicalLegacyGuideReference()].map(({ path, contentHash }) => ({
				path,
				contentHash
			})),
			normalization,
			output: null,
			resultPath: retiredPaths.resultPath,
			findings: [] as const,
			startedAt: '2026-09-02T08:00:00.000Z',
			completedAt: '2026-09-02T08:00:00.000Z',
			totalWallTimeMs: 0 as const,
			writtenOutputPaths: [retiredPaths.resultPath] as const,
			noSharedFilesEdited: true as const,
			selfPromoted: false as const
		};
		expect(SkillIconSupersededResultV2Schema.safeParse(superseded).success).toBe(true);
		expect(SkillIconResultV2Schema.safeParse(superseded).success).toBe(true);
		const target = {
			schemaVersion: 'skill-icon-target-v2' as const,
			jobId: retiredJobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 2,
			role: 'rarity-frame' as const,
			skillTargetId: null,
			motifFamily: null,
			rarity: 'F' as const,
			exactPrompt,
			references: [canonicalLegacyGuideReference()],
			canvas: { width: 1024, height: 1024, mediaType: 'image/png' as const },
			output: retiredPaths,
			normalization: {
				profile: 'skill-icon-green-key-role-mask-v1' as const,
				sourceContract: {
					mediaType: 'image/png' as const,
					width: 1254 as const,
					height: 1254 as const,
					alphaMode: 'rgb' as const,
					matteColor: '#00FF00' as const
				},
				outputContract: {
					mediaType: 'image/png' as const,
					width: 1024 as const,
					height: 1024 as const,
					alphaMode: 'rgba' as const
				},
				geometry: {
					path: 'assets/wiki/skills/icon-production-v1/geometry.json' as const,
					contentHash: SKILL_ICON_NORMALIZATION_GEOMETRY_HASH
				}
			}
		};
		const assigned = {
			schemaVersion: 'skill-icon-assignment-v2' as const,
			assignmentId: `assignment-${retiredJobId}`,
			jobId: retiredJobId,
			logicalIdentity: 'rarity-frame-f',
			revision: 2,
			targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${retiredJobId}.json`,
			assignmentPath: `assets/wiki/skills/icon-production-v1/assignments/references/${retiredJobId}.json`,
			skillVersion: 'summonlab-skill-icon-production-v2' as const,
			normalization: { profile: 'skill-icon-green-key-role-mask-v1' as const },
			assignedAt: '2026-09-02T08:00:00.000Z',
			retryCeiling: 1,
			permittedOutputs: retiredPaths,
			forbiddenSharedPaths: ['assets/wiki/skills/icon-production-v1/catalog.json'],
			completionContract: assignment().completionContract
		};
		const execution = {
			schemaVersion: 'skill-icon-execution-v2' as const,
			target,
			assignment: assigned,
			result: superseded
		};
		expect(SkillIconExecutionV2Schema.safeParse(execution).success).toBe(true);
		expect(
			SkillIconExecutionV2Schema.safeParse({
				...execution,
				result: { ...superseded, role: 'backing' }
			}).success
		).toBe(false);

		for (const invalid of [
			{ ...superseded, attemptCount: 1 },
			{ ...superseded, supersessionReason: 'superseded' },
			{ ...superseded, output: candidateAsset },
			{ ...superseded, normalization: { ...normalization, outcome: 'completed' } },
			{
				...superseded,
				supersedingAuthority: { ...superseded.supersedingAuthority, revision: 2 }
			},
			{
				...superseded,
				supersedingAuthority: {
					...superseded.supersedingAuthority,
					logicalIdentity: 'rarity-frame-e'
				}
			},
			{
				...superseded,
				supersedingAuthority: { ...superseded.supersedingAuthority, role: 'backing' }
			},
			{
				...superseded,
				supersedingAuthority: {
					...superseded.supersedingAuthority,
					targetPath: `assets/wiki/skills/icon-production-v1/targets/references/${retiredJobId}.json`
				}
			},
			{
				...superseded,
				supersedingAuthority: {
					...superseded.supersedingAuthority,
					assignmentContentHash: 'not-a-raw-hash'
				}
			}
		]) {
			expect(SkillIconSupersededResultV2Schema.safeParse(invalid).success).toBe(false);
		}
	});

	it('keeps V1 frame and backing targets frozen at their historical v1 revision', () => {
		const backing = {
			...skillTarget(),
			jobId: 'charcoal-forged-stone-v1',
			role: 'backing' as const,
			skillTargetId: null,
			rarity: null,
			output: ownedPaths('references', 'charcoal-forged-stone-v1')
		};
		const frame = {
			...backing,
			jobId: 'rarity-frame-f-v1',
			role: 'rarity-frame' as const,
			rarity: 'F' as const,
			output: ownedPaths('references', 'rarity-frame-f-v1')
		};

		expect(SkillIconTargetSchema.safeParse(backing).success).toBe(true);
		expect(SkillIconTargetSchema.safeParse(frame).success).toBe(true);
		expect(
			SkillIconTargetSchema.safeParse({
				...backing,
				jobId: 'charcoal-forged-stone-v2',
				output: ownedPaths('references', 'charcoal-forged-stone-v2')
			}).success
		).toBe(false);
		expect(
			SkillIconTargetSchema.safeParse({
				...frame,
				jobId: 'rarity-frame-f-v99',
				output: ownedPaths('references', 'rarity-frame-f-v99')
			}).success
		).toBe(false);
		expect(
			SkillIconTargetSchema.safeParse({
				...backing,
				jobId: 'forged-impostor-v1',
				output: ownedPaths('references', 'forged-impostor-v1')
			}).success
		).toBe(false);
		expect(
			SkillIconTargetSchema.safeParse({
				...frame,
				jobId: 'rarity-frame-e-v1',
				output: ownedPaths('references', 'rarity-frame-e-v1')
			}).success
		).toBe(false);
	});
});
