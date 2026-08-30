import { createHash } from 'node:crypto';

import { z } from 'zod';

import { EntityIdSchema, IsoDateTimeSchema, StateHashSchema } from './shared.js';

const SlugSchema = z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u);
const NonEmptyTextSchema = z.string().trim().min(1);
const RepositoryPathSchema = z
	.string()
	.min(1)
	.max(500)
	.refine((value) => !value.startsWith('/') && !value.includes('\\'), {
		message: 'Expected a repository-relative POSIX path'
	})
	.refine((value) => value.split('/').every((segment) => segment !== '' && segment !== '..'), {
		message: 'Repository paths cannot contain empty or parent-directory segments'
	});
const CandidateImagePathSchema = RepositoryPathSchema.regex(/\.(?:png|webp)$/u).refine(
	(value) => value.startsWith('assets/enemies/experiments/'),
	{ message: 'Candidate images must remain under assets/enemies/experiments' }
);
const JsonPathSchema = RepositoryPathSchema.regex(/\.json$/u).refine(
	(value) =>
		value.startsWith('assets/enemies/experiments/') && value.split('/').includes('results'),
	{ message: 'Result records must remain in an experiment results directory' }
);

export const ImageProductionSpeciesSchema = z.enum([
	'death-knight',
	'elemental',
	'grey-wolf',
	'cave-bear',
	'goblin',
	'tunnel-boar',
	'cave-drake',
	'tower-basilisk'
]);

export const ImageProductionAffinitySchema = z.enum([
	'normal',
	'wood',
	'fire',
	'metal',
	'water',
	'wind'
]);

export const ImageProductionThreatSchema = z
	.object({
		presentationTier: z.literal('elite'),
		referenceGrade: z.literal(4),
		canonicalGrade: z.number().int().min(1).max(10).nullable()
	})
	.strict();

export const ImageProductionReferenceSchema = z
	.object({
		path: RepositoryPathSchema,
		purpose: NonEmptyTextSchema.max(500),
		contentHash: StateHashSchema
	})
	.strict();

export const ImageProductionAcceptanceCriterionSchema = z
	.object({
		criterionId: SlugSchema,
		kind: z.enum(['objective', 'human-review']),
		description: NonEmptyTextSchema.max(500),
		required: z.boolean()
	})
	.strict();

export const GoblinVariationSchema = z
	.object({
		seed: z.string().min(1).max(120),
		battlefieldDuty: z.enum(['skirmisher', 'archer', 'hexweaver', 'chieftain', 'guard', 'scout']),
		stature: z.enum(['short', 'average', 'tall']),
		build: z.enum(['wiry', 'lean', 'sturdy', 'broad']),
		adultAgeBand: z.enum(['young-adult', 'adult', 'weathered', 'elder']),
		face: z
			.object({
				shape: NonEmptyTextSchema.max(80),
				nose: NonEmptyTextSchema.max(80),
				jaw: NonEmptyTextSchema.max(80),
				brow: NonEmptyTextSchema.max(80),
				ears: NonEmptyTextSchema.max(80),
				scarsOrAsymmetry: NonEmptyTextSchema.max(160)
			})
			.strict(),
		skinPalette: NonEmptyTextSchema.max(160),
		localizedMarkings: NonEmptyTextSchema.max(160),
		clothingSilhouette: NonEmptyTextSchema.max(160),
		clothingLayers: z.array(NonEmptyTextSchema.max(120)).min(1).max(12),
		materialCondition: NonEmptyTextSchema.max(160),
		footwear: NonEmptyTextSchema.max(120),
		headwear: NonEmptyTextSchema.max(120),
		armorCoverage: NonEmptyTextSchema.max(160),
		handedness: z.enum(['left', 'right', 'ambidextrous']),
		weaponOrFocus: NonEmptyTextSchema.max(160),
		posture: NonEmptyTextSchema.max(160),
		equipmentAnchors: z.array(NonEmptyTextSchema.max(120)).min(1).max(12),
		affinityExpression: NonEmptyTextSchema.max(300),
		counterplayCue: NonEmptyTextSchema.max(300)
	})
	.strict();

export const ImageProductionTargetSchema = z
	.object({
		schemaVersion: z.literal('image-production-target-v1'),
		targetId: SlugSchema,
		assetId: SlugSchema,
		packId: SlugSchema,
		experimentId: SlugSchema,
		promptProtocol: z.enum(['canonical-v1', 'safe-frame-v2', 'safe-frame-v3', 'safe-frame-v4']),
		authoringProtocol: z.enum(['basic-v1', 'semantic-v2']),
		cohort: z.enum(['controlled', 'breadth', 'regression']),
		speciesId: ImageProductionSpeciesSchema,
		chassisId: z.literal('bound-vanguard-elemental').optional(),
		affinity: ImageProductionAffinitySchema,
		affinityDesign: z
			.object({
				alteredDimensions: z
					.array(
						z.enum([
							'material',
							'silhouette',
							'motion',
							'anatomy',
							'equipment',
							'attack-telegraph',
							'environmental-wake',
							'exposed-counterplay'
						])
					)
					.max(8),
				expression: NonEmptyTextSchema.max(1_000),
				counterplayCue: NonEmptyTextSchema.max(500)
			})
			.strict(),
		threat: ImageProductionThreatSchema,
		battlefieldDutyId: SlugSchema,
		constructionMode: z.enum([
			'armored-undead',
			'substance-bodied',
			'organic-quadruped',
			'humanoid-enemy',
			'draconic-quadruped',
			'six-legged-reptile'
		]),
		identityInvariants: z.array(NonEmptyTextSchema.max(300)).min(2).max(20),
		anatomyInvariants: z.array(NonEmptyTextSchema.max(300)).min(2).max(20),
		permittedTransformations: z.array(NonEmptyTextSchema.max(300)).min(1).max(20),
		prohibitedTraits: z.array(NonEmptyTextSchema.max(300)).min(1).max(30),
		goblinVariation: GoblinVariationSchema.optional(),
		references: z.array(ImageProductionReferenceSchema).min(1).max(20),
		presentation: z
			.object({
				styleContract: NonEmptyTextSchema.max(2_000),
				medium: NonEmptyTextSchema.max(200),
				background: NonEmptyTextSchema.max(500),
				lighting: NonEmptyTextSchema.max(500),
				composition: NonEmptyTextSchema.max(1_000),
				canvas: z
					.object({
						width: z.number().int().min(512).max(8_192),
						height: z.number().int().min(512).max(8_192),
						mediaType: z.enum(['image/png', 'image/webp']),
						safeMarginPercent: z.number().min(0).max(40)
					})
					.strict(),
				negativePrompt: z.array(NonEmptyTextSchema.max(300)).min(1).max(30)
			})
			.strict(),
		acceptanceCriteria: z.array(ImageProductionAcceptanceCriterionSchema).min(1).max(40),
		output: z
			.object({
				candidatePath: CandidateImagePathSchema,
				resultPath: JsonPathSchema
			})
			.strict()
	})
	.strict()
	.superRefine((target, context) => {
		if (target.speciesId === 'elemental' && target.chassisId !== 'bound-vanguard-elemental') {
			context.addIssue({
				code: 'custom',
				path: ['chassisId'],
				message: 'Elemental targets require the bound-vanguard-elemental chassis'
			});
		}
		if (target.speciesId !== 'elemental' && target.chassisId !== undefined) {
			context.addIssue({
				code: 'custom',
				path: ['chassisId'],
				message: 'Only elemental targets declare an elemental chassis'
			});
		}
		if ((target.speciesId === 'goblin') !== (target.goblinVariation !== undefined)) {
			context.addIssue({
				code: 'custom',
				path: ['goblinVariation'],
				message: 'Goblin variation is required for goblins and forbidden for other species'
			});
		}
		const expectedConstructionMode = {
			'death-knight': 'armored-undead',
			elemental: 'substance-bodied',
			'grey-wolf': 'organic-quadruped',
			'cave-bear': 'organic-quadruped',
			goblin: 'humanoid-enemy',
			'tunnel-boar': 'organic-quadruped',
			'cave-drake': 'draconic-quadruped',
			'tower-basilisk': 'six-legged-reptile'
		} as const;
		if (target.constructionMode !== expectedConstructionMode[target.speciesId]) {
			context.addIssue({
				code: 'custom',
				path: ['constructionMode'],
				message: `${target.speciesId} requires ${expectedConstructionMode[target.speciesId]} construction`
			});
		}
		if (target.affinity !== 'normal' && new Set(target.affinityDesign.alteredDimensions).size < 2) {
			context.addIssue({
				code: 'custom',
				path: ['affinityDesign', 'alteredDimensions'],
				message: 'Elemental affinities must alter at least two meaningful visual dimensions'
			});
		}
		if (
			new Set(target.affinityDesign.alteredDimensions).size !==
			target.affinityDesign.alteredDimensions.length
		) {
			context.addIssue({
				code: 'custom',
				path: ['affinityDesign', 'alteredDimensions'],
				message: 'Altered visual dimensions must be unique'
			});
		}
		const criterionIds = target.acceptanceCriteria.map((criterion) => criterion.criterionId);
		if (new Set(criterionIds).size !== criterionIds.length) {
			context.addIssue({ code: 'custom', message: 'Acceptance criterion IDs must be unique' });
		}
		for (const kind of ['objective', 'human-review'] as const) {
			if (!target.acceptanceCriteria.some((criterion) => criterion.kind === kind)) {
				context.addIssue({
					code: 'custom',
					message: `Targets require at least one ${kind} acceptance criterion`
				});
			}
		}
	});

export const ImageProductionAssignmentSchema = z
	.object({
		schemaVersion: z.literal('image-production-assignment-v1'),
		assignmentId: SlugSchema,
		targetId: SlugSchema,
		skillVersion: z.string().min(1).max(80),
		assignedAt: IsoDateTimeSchema,
		dryRun: z.boolean(),
		retryCeiling: z.number().int().min(0).max(1),
		permittedOutputs: z
			.object({
				candidatePath: CandidateImagePathSchema,
				resultPath: JsonPathSchema
			})
			.strict(),
		forbiddenSharedPaths: z.array(RepositoryPathSchema).min(1).max(100),
		completionContract: z
			.object({
				oneTargetOneImage: z.literal(true),
				structuredResultRequired: z.literal(true),
				sharedFilesMustRemainUntouched: z.literal(true),
				selfPromotionForbidden: z.literal(true)
			})
			.strict()
	})
	.strict()
	.superRefine((assignment, context) => {
		const owned = new Set(Object.values(assignment.permittedOutputs));
		for (const forbiddenPath of assignment.forbiddenSharedPaths) {
			if (owned.has(forbiddenPath)) {
				context.addIssue({
					code: 'custom',
					path: ['forbiddenSharedPaths'],
					message: `Owned output cannot also be forbidden: ${forbiddenPath}`
				});
			}
		}
	});

export const ImageProductionRubricFindingSchema = z
	.object({
		criterionId: SlugSchema,
		category: z.enum([
			'identity',
			'species-cue-strength',
			'anatomy',
			'canvas-completion',
			'framing',
			'subject-count',
			'affinity',
			'affinity-cue-strength',
			'affinity-integration',
			'counterplay',
			'prohibited-trait',
			'constraint-safety',
			'silhouette',
			'material',
			'battlefield-duty',
			'style',
			'style-cohesion',
			'manifest-fidelity',
			'prompt-provenance',
			'exact-source-persistence',
			'provenance',
			'output-ownership'
		]),
		evaluator: z.enum(['producer', 'automated', 'human']),
		outcome: z.enum(['pass', 'concern', 'fail', 'not-applicable']),
		observation: NonEmptyTextSchema.max(1_000)
	})
	.strict();

export const ImageProductionOutputSchema = z
	.object({
		path: CandidateImagePathSchema,
		mediaType: z.enum(['image/png', 'image/webp']),
		width: z.number().int().positive().max(8_192),
		height: z.number().int().positive().max(8_192),
		bytes: z.number().int().positive(),
		contentHash: StateHashSchema
	})
	.strict();

export const ImageProductionPersistenceSchema = z
	.object({
		operation: z.enum([
			'exclusive-copy',
			'exclusive-normalize-format',
			'exclusive-resize-near-match'
		]),
		elapsedMs: z.number().int().positive(),
		source: z
			.object({
				path: z.string().min(1).max(1_000),
				mediaType: z.string().min(1).max(100),
				width: z.number().int().positive().max(8_192),
				height: z.number().int().positive().max(8_192),
				bytes: z.number().int().positive(),
				contentHash: StateHashSchema
			})
			.strict(),
		retained: ImageProductionOutputSchema
	})
	.strict();

export const ImageProductionFailureKindSchema = z.enum([
	'capacity',
	'provider-throttle',
	'timeout',
	'malformed-output',
	'persistence',
	'other'
]);

export const ImageProductionAttemptSchema = z
	.object({
		attemptId: SlugSchema,
		attemptNumber: z.number().int().positive(),
		precedingAttemptId: SlugSchema.nullable(),
		conclusion: z.enum(['accepted-by-producer', 'rejected-by-producer', 'provider-failure']),
		failureKind: ImageProductionFailureKindSchema.optional(),
		exactPrompt: z.string().min(1).max(30_000),
		promptHash: StateHashSchema,
		referenceInputs: z
			.array(z.object({ path: RepositoryPathSchema, contentHash: StateHashSchema }).strict())
			.min(1)
			.max(20),
		correctionReferenceInput: z
			.object({
				path: z.string().min(1).max(1_000),
				contentHash: StateHashSchema
			})
			.strict()
			.nullable()
			.optional(),
		requestStartedAt: IsoDateTimeSchema,
		generationCompletedAt: IsoDateTimeSchema,
		inspectionCompletedAt: IsoDateTimeSchema,
		generationDurationMs: z.number().int().nonnegative(),
		inspectionDurationMs: z.number().int().nonnegative(),
		totalWallTimeMs: z.number().int().nonnegative(),
		sourceOutputId: z.string().min(1).max(300).nullable(),
		persistence: ImageProductionPersistenceSchema.nullable(),
		output: ImageProductionOutputSchema.nullable(),
		findings: z.array(ImageProductionRubricFindingSchema).min(1).max(100),
		retryReason: NonEmptyTextSchema.max(1_000).nullable()
	})
	.strict()
	.superRefine((attempt, context) => {
		const started = Date.parse(attempt.requestStartedAt);
		const generated = Date.parse(attempt.generationCompletedAt);
		const inspected = Date.parse(attempt.inspectionCompletedAt);
		if (generated < started || inspected < generated) {
			context.addIssue({ code: 'custom', message: 'Attempt timestamps must be chronological' });
		}
		if (attempt.attemptNumber === 1 && attempt.precedingAttemptId !== null) {
			context.addIssue({ code: 'custom', message: 'The first attempt cannot have a predecessor' });
		}
		if (attempt.attemptNumber > 1 && attempt.precedingAttemptId === null) {
			context.addIssue({
				code: 'custom',
				message: 'Corrective attempts must identify their predecessor'
			});
		}
		if (attempt.output !== null && attempt.sourceOutputId === null) {
			context.addIssue({
				code: 'custom',
				message: 'Every returned image requires a source output ID'
			});
		}
		if (attempt.output !== null && attempt.persistence === null) {
			context.addIssue({
				code: 'custom',
				message: 'Every retained output requires a persistence receipt'
			});
		}
		if (attempt.output === null && attempt.persistence !== null) {
			context.addIssue({
				code: 'custom',
				message: 'An attempt without an output cannot claim a persistence receipt'
			});
		}
		if (
			attempt.output !== null &&
			attempt.persistence !== null &&
			JSON.stringify(attempt.output) !== JSON.stringify(attempt.persistence.retained)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Attempt output must exactly match the retained persistence receipt'
			});
		}
		if (attempt.conclusion === 'accepted-by-producer' && attempt.output === null) {
			context.addIssue({ code: 'custom', message: 'Accepted attempts require an output' });
		}
		if (attempt.conclusion === 'rejected-by-producer' && attempt.retryReason === null) {
			context.addIssue({ code: 'custom', message: 'Rejected attempts require a retry reason' });
		}
		if (attempt.conclusion === 'provider-failure' && attempt.output !== null) {
			context.addIssue({ code: 'custom', message: 'Provider failures cannot claim an output' });
		}
		if (attempt.conclusion !== 'provider-failure' && attempt.failureKind !== undefined) {
			context.addIssue({
				code: 'custom',
				path: ['failureKind'],
				message: 'Only provider-failure attempts may declare a failure kind'
			});
		}
		if (attempt.totalWallTimeMs < attempt.generationDurationMs + attempt.inspectionDurationMs) {
			context.addIssue({
				code: 'custom',
				message: 'Attempt wall time cannot be shorter than generation plus inspection time'
			});
		}
		if (createHash('sha256').update(attempt.exactPrompt).digest('hex') !== attempt.promptHash) {
			context.addIssue({ code: 'custom', message: 'Prompt hash must match the exact prompt' });
		}
	});

export const ImageProductionResultSchema = z
	.object({
		schemaVersion: z.literal('image-production-result-v1'),
		resultId: SlugSchema,
		targetId: SlugSchema,
		assignmentId: SlugSchema,
		skillVersion: z.string().min(1).max(80),
		status: z.enum(['candidate', 'revise', 'failed']),
		attempts: z.array(ImageProductionAttemptSchema).min(1),
		selectedAttemptId: SlugSchema.nullable(),
		failedCriteria: z.array(SlugSchema).max(100),
		startedAt: IsoDateTimeSchema,
		completedAt: IsoDateTimeSchema,
		totalWallTimeMs: z.number().int().nonnegative(),
		writtenOutputPaths: z.array(RepositoryPathSchema).min(1).max(20),
		noSharedFilesEdited: z.literal(true),
		selfPromoted: z.literal(false)
	})
	.strict()
	.superRefine((result, context) => {
		const attemptIds = result.attempts.map((attempt) => attempt.attemptId);
		if (new Set(attemptIds).size !== attemptIds.length) {
			context.addIssue({ code: 'custom', message: 'Attempt IDs must be unique' });
		}
		for (const [index, attempt] of result.attempts.entries()) {
			if (attempt.attemptNumber !== index + 1) {
				context.addIssue({
					code: 'custom',
					message: 'Attempt numbers must be contiguous and ordered'
				});
			}
			if (index > 0 && attempt.precedingAttemptId !== result.attempts[index - 1]?.attemptId) {
				context.addIssue({
					code: 'custom',
					message: 'Each retry must link to the preceding attempt'
				});
			}
			if (
				result.status === 'failed' &&
				attempt.conclusion === 'provider-failure' &&
				attempt.failureKind === undefined
			) {
				context.addIssue({
					code: 'custom',
					path: ['attempts', index, 'failureKind'],
					message: 'Terminal failed results must classify every provider failure'
				});
			}
		}
		const selected = result.attempts.find(
			(attempt) => attempt.attemptId === result.selectedAttemptId
		);
		if (result.status === 'candidate' && selected?.conclusion !== 'accepted-by-producer') {
			context.addIssue({
				code: 'custom',
				message: 'Candidate results require a selected producer-accepted attempt'
			});
		}
		if (result.status !== 'candidate' && result.selectedAttemptId !== null) {
			context.addIssue({ code: 'custom', message: 'Only candidate results select an attempt' });
		}
		if (Date.parse(result.completedAt) < Date.parse(result.startedAt)) {
			context.addIssue({ code: 'custom', message: 'Result timestamps must be chronological' });
		}
		if (
			Math.abs(
				Date.parse(result.completedAt) - Date.parse(result.startedAt) - result.totalWallTimeMs
			) > 2
		) {
			context.addIssue({ code: 'custom', message: 'Result wall time must match its timestamps' });
		}
	});

export const ImageProductionCatalogEntrySchema = z
	.object({
		targetId: SlugSchema,
		resultId: SlugSchema,
		assignmentId: SlugSchema,
		speciesId: ImageProductionSpeciesSchema,
		affinity: ImageProductionAffinitySchema,
		cohort: z.enum(['controlled', 'breadth', 'regression']),
		status: z.enum(['candidate', 'revise', 'failed']),
		candidatePath: CandidateImagePathSchema.nullable(),
		candidateHash: StateHashSchema.nullable(),
		reviewState: z.enum(['pending', 'accepted', 'revise', 'rejected']),
		promoted: z.literal(false)
	})
	.strict()
	.superRefine((entry, context) => {
		if ((entry.candidatePath === null) !== (entry.candidateHash === null)) {
			context.addIssue({ code: 'custom', message: 'Candidate path and hash must appear together' });
		}
		if (entry.status === 'candidate' && entry.candidatePath === null) {
			context.addIssue({ code: 'custom', message: 'Candidate catalog entries require an image' });
		}
		if (entry.status !== 'candidate' && entry.reviewState === 'accepted') {
			context.addIssue({ code: 'custom', message: 'Only candidates can receive human acceptance' });
		}
	});

export const ImageProductionCatalogSchema = z
	.object({
		schemaVersion: z.literal('image-production-catalog-v1'),
		experimentId: SlugSchema,
		generatedAt: IsoDateTimeSchema,
		status: z.literal('experimental-unpromoted'),
		entries: z.array(ImageProductionCatalogEntrySchema)
	})
	.strict()
	.superRefine((catalog, context) => {
		for (const field of ['targetId', 'resultId', 'assignmentId'] as const) {
			const values = catalog.entries.map((entry) => entry[field]);
			if (new Set(values).size !== values.length) {
				context.addIssue({ code: 'custom', message: `Catalog ${field} values must be unique` });
			}
		}
	});

export const ImageProductionBlindReviewSchema = z
	.object({
		reviewId: EntityIdSchema,
		targetId: SlugSchema,
		candidateContentHash: StateHashSchema,
		reviewer: z.string().trim().min(1).max(100),
		reviewMode: z.literal('blind'),
		reviewedAt: IsoDateTimeSchema,
		identifiedSpeciesId: ImageProductionSpeciesSchema,
		identifiedAffinity: ImageProductionAffinitySchema,
		speciesCorrect: z.boolean(),
		affinityCorrect: z.boolean(),
		scores: z
			.object({
				speciesIdentity: z.number().int().min(1).max(5),
				affinityReadability: z.number().int().min(1).max(5),
				silhouetteAndDuty: z.number().int().min(1).max(5),
				materialCredibility: z.number().int().min(1).max(5),
				anatomyAndGroundContact: z.number().int().min(1).max(5),
				affinityIntegration: z.number().int().min(1).max(5),
				styleCohesion: z.number().int().min(1).max(5)
			})
			.strict(),
		verdict: z.enum(['candidate', 'revise']),
		note: NonEmptyTextSchema.max(1_000)
	})
	.strict();

export const ImageProductionConcurrencyStageSchema = z
	.object({
		stage: z.enum(['canary', 'pilot', 'controlled', 'breadth', 'load', 'scale']),
		plannedParallelJobs: z.union([
			z.literal(2),
			z.literal(4),
			z.literal(6),
			z.literal(8),
			z.literal(12),
			z.literal(16)
		]),
		effectiveParallelJobs: z.number().int().positive().max(16),
		targetCount: z.number().int().positive(),
		candidateCount: z.number().int().nonnegative(),
		reviseCount: z.number().int().nonnegative(),
		failedCount: z.number().int().nonnegative(),
		throttleCount: z.number().int().nonnegative(),
		timeoutCount: z.number().int().nonnegative(),
		retryCount: z.number().int().nonnegative(),
		generationMedianMs: z.number().nonnegative(),
		generationP90Ms: z.number().nonnegative().nullable(),
		generationP95Ms: z.number().nonnegative().nullable(),
		slowestCompletionMs: z.number().nonnegative(),
		waveWallTimeMs: z.number().positive(),
		summedJobTimeMs: z.number().positive(),
		effectiveSpeedup: z.number().positive(),
		parallelEfficiency: z.number().positive(),
		queueDelayMs: z.number().nonnegative().nullable(),
		visualCandidateRate: z.number().min(0).max(1),
		provenanceCompletenessRate: z.number().min(0).max(1),
		missingResultCount: z.number().int().nonnegative(),
		duplicateIdCount: z.number().int().nonnegative(),
		pathConflictCount: z.number().int().nonnegative(),
		integrationErrorCount: z.number().int().nonnegative()
	})
	.strict()
	.superRefine((stage, context) => {
		if (stage.candidateCount + stage.reviseCount + stage.failedCount !== stage.targetCount) {
			context.addIssue({
				code: 'custom',
				message: 'Concurrency outcome counts must total targets'
			});
		}
		if (stage.effectiveParallelJobs > stage.plannedParallelJobs) {
			context.addIssue({
				code: 'custom',
				message: 'Effective parallel jobs cannot exceed the planned ceiling'
			});
		}
	});

export const ImageProductionEvaluationSchema = z
	.object({
		schemaVersion: z.literal('image-production-evaluation-v1'),
		experimentId: SlugSchema,
		generatedAt: IsoDateTimeSchema,
		catalogHash: StateHashSchema,
		status: z.enum(['incomplete', 'passed', 'failed']),
		controlled: z
			.object({
				targetCount: z.literal(24),
				firstAttemptCandidateCount: z.number().int().min(0).max(24),
				speciesCorrectCount: z.number().int().min(0).max(24),
				affinityCorrectCount: z.number().int().min(0).max(24),
				normalUnaffiliatedCount: z.number().int().min(0).max(4),
				acceptedMeaningfulAffinityCount: z.number().int().min(0).max(20),
				acceptedCriticalVisualFailureCount: z.number().int().min(0).max(24)
			})
			.strict(),
		workflow: z
			.object({
				completedTargetCount: z.number().int().nonnegative(),
				completeProvenanceCount: z.number().int().nonnegative(),
				pathConflictCount: z.number().int().nonnegative(),
				sharedFileEditCount: z.number().int().nonnegative(),
				retryCeilingViolationCount: z.number().int().nonnegative()
			})
			.strict(),
		blindReviews: z.array(ImageProductionBlindReviewSchema),
		concurrencyStages: z.array(ImageProductionConcurrencyStageSchema),
		failureClassifications: z.array(
			z
				.object({
					failureId: SlugSchema,
					targetId: SlugSchema.nullable(),
					layer: z.enum([
						'skill',
						'execution-contract',
						'species-grammar',
						'affinity-grammar',
						'target',
						'generator-variance',
						'manifest-generator',
						'orchestrator',
						'scheduler',
						'integration'
					]),
					description: NonEmptyTextSchema.max(1_000),
					resolution: NonEmptyTextSchema.max(1_000).nullable()
				})
				.strict()
		),
		recommendedSafeConcurrency: z.number().int().min(1).max(16).nullable(),
		completionNotes: z.array(NonEmptyTextSchema.max(1_000))
	})
	.strict()
	.superRefine((evaluation, context) => {
		const controlledPassed =
			evaluation.controlled.firstAttemptCandidateCount >= 20 &&
			evaluation.controlled.speciesCorrectCount >= 23 &&
			evaluation.controlled.affinityCorrectCount >= 20 &&
			evaluation.controlled.normalUnaffiliatedCount === 4 &&
			evaluation.controlled.acceptedMeaningfulAffinityCount === 20 &&
			evaluation.controlled.acceptedCriticalVisualFailureCount === 0 &&
			evaluation.workflow.pathConflictCount === 0 &&
			evaluation.workflow.sharedFileEditCount === 0 &&
			evaluation.workflow.retryCeilingViolationCount === 0 &&
			evaluation.workflow.completedTargetCount === evaluation.workflow.completeProvenanceCount;
		if (evaluation.status === 'passed' && !controlledPassed) {
			context.addIssue({
				code: 'custom',
				message: 'Passed evaluations must satisfy controlled visual and workflow thresholds'
			});
		}
	});

export const ImageProductionExecutionSchema = z
	.object({
		target: ImageProductionTargetSchema,
		assignment: ImageProductionAssignmentSchema,
		result: ImageProductionResultSchema
	})
	.strict()
	.superRefine(({ target, assignment, result }, context) => {
		if (assignment.targetId !== target.targetId || result.targetId !== target.targetId) {
			context.addIssue({ code: 'custom', message: 'Target IDs must agree across the execution' });
		}
		if (result.assignmentId !== assignment.assignmentId) {
			context.addIssue({
				code: 'custom',
				message: 'Result assignment ID does not match its envelope'
			});
		}
		if (result.skillVersion !== assignment.skillVersion) {
			context.addIssue({
				code: 'custom',
				message: 'Result skill version does not match its envelope'
			});
		}
		if (
			assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
			assignment.permittedOutputs.resultPath !== target.output.resultPath
		) {
			context.addIssue({
				code: 'custom',
				message: 'Target and assignment output paths must agree'
			});
		}
		const maximumAttempts = 1 + assignment.retryCeiling;
		if (result.attempts.length > maximumAttempts) {
			context.addIssue({
				code: 'custom',
				path: ['result', 'attempts'],
				message: `Result exceeds its assignment maximum of ${maximumAttempts} attempts`
			});
		}
		const allowedPaths = new Set(Object.values(assignment.permittedOutputs));
		for (const path of result.writtenOutputPaths) {
			if (!allowedPaths.has(path)) {
				context.addIssue({
					code: 'custom',
					message: `Result wrote outside its assignment: ${path}`
				});
			}
		}
		if (!result.writtenOutputPaths.includes(assignment.permittedOutputs.resultPath)) {
			context.addIssue({ code: 'custom', message: 'Every execution must write its result record' });
		}
		if (
			result.status === 'candidate' &&
			!result.writtenOutputPaths.includes(assignment.permittedOutputs.candidatePath)
		) {
			context.addIssue({
				code: 'custom',
				message: 'Candidate executions must record their image output'
			});
		}
		const targetCriterionIds = new Set(
			target.acceptanceCriteria.map((criterion) => criterion.criterionId)
		);
		for (const criterionId of result.failedCriteria) {
			if (!targetCriterionIds.has(criterionId)) {
				context.addIssue({ code: 'custom', message: `Unknown failed criterion: ${criterionId}` });
			}
		}
		const targetReferences = new Map(
			target.references.map((reference) => [reference.path, reference.contentHash])
		);
		for (const attempt of result.attempts) {
			if (attempt.attemptNumber === 1 && attempt.correctionReferenceInput != null) {
				context.addIssue({
					code: 'custom',
					message: 'The first attempt cannot use a generated-image correction reference'
				});
			}
			if (attempt.output && attempt.output.path !== assignment.permittedOutputs.candidatePath) {
				context.addIssue({
					code: 'custom',
					message: `Attempt output is outside its assignment: ${attempt.output.path}`
				});
			}
			if (
				attempt.output &&
				(attempt.output.width !== target.presentation.canvas.width ||
					attempt.output.height !== target.presentation.canvas.height ||
					attempt.output.mediaType !== target.presentation.canvas.mediaType)
			) {
				context.addIssue({
					code: 'custom',
					message: 'Attempt output does not match the target canvas'
				});
			}
			for (const reference of attempt.referenceInputs) {
				if (targetReferences.get(reference.path) !== reference.contentHash) {
					context.addIssue({
						code: 'custom',
						message: `Attempt used an undeclared or stale reference: ${reference.path}`
					});
				}
			}
			if (
				JSON.stringify(attempt.referenceInputs) !==
				JSON.stringify(target.references.map(({ path, contentHash }) => ({ path, contentHash })))
			) {
				context.addIssue({
					code: 'custom',
					message: 'Every attempt must attach all declared references in manifest order'
				});
			}
		}
		const selected = result.attempts.find(
			(attempt) => attempt.attemptId === result.selectedAttemptId
		);
		if (result.status === 'candidate' && selected) {
			if (result.failedCriteria.length > 0) {
				context.addIssue({ code: 'custom', message: 'Candidates cannot retain failed criteria' });
			}
			if (selected.findings.some((finding) => finding.outcome === 'fail')) {
				context.addIssue({ code: 'custom', message: 'Candidates cannot select a failing attempt' });
			}
			const requiredObjectiveCriteria = target.acceptanceCriteria
				.filter((criterion) => criterion.required && criterion.kind === 'objective')
				.map((criterion) => criterion.criterionId);
			for (const criterionId of requiredObjectiveCriteria) {
				if (
					!selected.findings.some(
						(finding) =>
							finding.criterionId === criterionId &&
							finding.outcome === 'pass' &&
							finding.evaluator !== 'human'
					)
				) {
					context.addIssue({
						code: 'custom',
						message: `Candidate did not pass required objective criterion: ${criterionId}`
					});
				}
			}
		}
		if (result.status === 'revise') {
			if (result.failedCriteria.length === 0) {
				context.addIssue({ code: 'custom', message: 'Revise results require failed criteria' });
			}
			if (!result.attempts.some((attempt) => attempt.output !== null)) {
				context.addIssue({ code: 'custom', message: 'Revise results require a review image' });
			}
		}
	});

export function validateImageProductionExecution(input: unknown): ImageProductionExecution {
	return ImageProductionExecutionSchema.parse(input);
}

export type ImageProductionAcceptanceCriterion = z.infer<
	typeof ImageProductionAcceptanceCriterionSchema
>;
export type ImageProductionAffinity = z.infer<typeof ImageProductionAffinitySchema>;
export type ImageProductionAssignment = z.infer<typeof ImageProductionAssignmentSchema>;
export type ImageProductionAttempt = z.infer<typeof ImageProductionAttemptSchema>;
export type ImageProductionPersistence = z.infer<typeof ImageProductionPersistenceSchema>;
export type ImageProductionBlindReview = z.infer<typeof ImageProductionBlindReviewSchema>;
export type ImageProductionCatalog = z.infer<typeof ImageProductionCatalogSchema>;
export type ImageProductionCatalogEntry = z.infer<typeof ImageProductionCatalogEntrySchema>;
export type ImageProductionConcurrencyStage = z.infer<typeof ImageProductionConcurrencyStageSchema>;
export type ImageProductionEvaluation = z.infer<typeof ImageProductionEvaluationSchema>;
export type ImageProductionExecution = z.infer<typeof ImageProductionExecutionSchema>;
export type ImageProductionOutput = z.infer<typeof ImageProductionOutputSchema>;
export type ImageProductionReference = z.infer<typeof ImageProductionReferenceSchema>;
export type ImageProductionResult = z.infer<typeof ImageProductionResultSchema>;
export type ImageProductionRubricFinding = z.infer<typeof ImageProductionRubricFindingSchema>;
export type ImageProductionSpecies = z.infer<typeof ImageProductionSpeciesSchema>;
export type ImageProductionTarget = z.infer<typeof ImageProductionTargetSchema>;
export type ImageProductionThreat = z.infer<typeof ImageProductionThreatSchema>;
