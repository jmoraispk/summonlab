import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
	ImageProductionAssignmentSchema,
	ImageProductionCatalogSchema,
	ImageProductionEvaluationSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution
} from './image-production.js';

const hash = 'a'.repeat(64);
const candidatePath =
	'assets/enemies/experiments/affinity-workflow-v1/candidates/elemental/fire-v1.png';
const resultPath = 'assets/enemies/experiments/affinity-workflow-v1/results/elemental-fire-v1.json';

function validTarget() {
	return {
		schemaVersion: 'image-production-target-v1' as const,
		targetId: 'elemental-fire-v1',
		assetId: 'elemental-fire-v1',
		packId: 'pack-2',
		experimentId: 'affinity-workflow-v1',
		promptProtocol: 'safe-frame-v3' as const,
		authoringProtocol: 'semantic-v2' as const,
		cohort: 'controlled' as const,
		speciesId: 'elemental' as const,
		chassisId: 'bound-vanguard-elemental' as const,
		affinity: 'fire' as const,
		affinityDesign: {
			alteredDimensions: ['material', 'attack-telegraph'] as const,
			expression: 'Heat-blackened plates surround a body built from controlled flame.',
			counterplayCue: 'The pale binding core is exposed between combustion cycles.'
		},
		threat: {
			presentationTier: 'elite' as const,
			referenceGrade: 4 as const,
			canonicalGrade: null
		},
		battlefieldDutyId: 'line-breaker',
		constructionMode: 'substance-bodied' as const,
		identityInvariants: ['Readable combat body', 'Concentrated binding core'],
		anatomyInvariants: ['Grounded locomotion', 'Load-bearing elemental limbs'],
		permittedTransformations: ['Flame may replace the neutral stone body'],
		prohibitedTraits: ['No uniform orange silhouette'],
		references: [
			{
				path: 'assets/enemies/review/pack-2/elementals-v1.png',
				purpose: 'Pack 2 elemental identity and material rendering only.',
				contentHash: hash
			}
		],
		presentation: {
			styleContract: 'Pack 2 realistic dark fantasy with restrained local emission.',
			medium: 'realistic raster character concept',
			background: 'charcoal-to-midnight backdrop above a cracked stone floor',
			lighting: 'directional neutral studio light with local fire bounce',
			composition: 'one entire creature with every extremity visible',
			canvas: {
				width: 1536,
				height: 1024,
				mediaType: 'image/png' as const,
				safeMarginPercent: 8
			},
			negativePrompt: ['No text', 'No blank canvas bands']
		},
		acceptanceCriteria: [
			{
				criterionId: 'full-frame',
				kind: 'objective' as const,
				description: 'The complete silhouette has a safe margin.',
				required: true
			},
			{
				criterionId: 'affinity-review',
				kind: 'human-review' as const,
				description: 'A blind reviewer recognizes Fire rather than a palette swap.',
				required: true
			}
		],
		output: { candidatePath, resultPath }
	};
}

function validAssignment(retryCeiling = 1) {
	return {
		schemaVersion: 'image-production-assignment-v1' as const,
		assignmentId: 'assignment-elemental-fire-v1',
		targetId: 'elemental-fire-v1',
		skillVersion: 'summonlab-image-production-v1',
		assignedAt: '2026-08-29T16:00:00.000Z',
		dryRun: false,
		retryCeiling,
		permittedOutputs: { candidatePath, resultPath },
		forbiddenSharedPaths: [
			'assets/enemies/experiments/affinity-workflow-v1/review/evaluation.json'
		],
		completionContract: {
			oneTargetOneImage: true as const,
			structuredResultRequired: true as const,
			sharedFilesMustRemainUntouched: true as const,
			selfPromotionForbidden: true as const
		}
	};
}

function attempt(attemptNumber: number, accepted: boolean) {
	const minute = String(attemptNumber).padStart(2, '0');
	const exactPrompt = 'Generate the declared full-body Fire elemental target.';
	return {
		attemptId: `elemental-fire-v1-attempt-${attemptNumber}`,
		attemptNumber,
		precedingAttemptId:
			attemptNumber === 1 ? null : `elemental-fire-v1-attempt-${attemptNumber - 1}`,
		conclusion: accepted ? ('accepted-by-producer' as const) : ('rejected-by-producer' as const),
		exactPrompt,
		promptHash: createHash('sha256').update(exactPrompt).digest('hex'),
		referenceInputs: [
			{ path: 'assets/enemies/review/pack-2/elementals-v1.png', contentHash: hash }
		],
		requestStartedAt: `2026-08-29T16:${minute}:00.000Z`,
		generationCompletedAt: `2026-08-29T16:${minute}:30.000Z`,
		inspectionCompletedAt: `2026-08-29T16:${minute}:40.000Z`,
		generationDurationMs: 30_000,
		inspectionDurationMs: 10_000,
		totalWallTimeMs: 40_000,
		sourceOutputId: `source-${attemptNumber}`,
		persistence: {
			operation: 'exclusive-copy' as const,
			elapsedMs: 25,
			source: {
				path: `/tmp/source-${attemptNumber}.png`,
				mediaType: 'image/png',
				width: 1536,
				height: 1024,
				bytes: 1_000_000,
				contentHash: hash
			},
			retained: {
				path: candidatePath,
				mediaType: 'image/png' as const,
				width: 1536,
				height: 1024,
				bytes: 1_000_000,
				contentHash: hash
			}
		},
		output: {
			path: candidatePath,
			mediaType: 'image/png' as const,
			width: 1536,
			height: 1024,
			bytes: 1_000_000,
			contentHash: hash
		},
		findings: [
			{
				criterionId: 'full-frame',
				category: 'framing' as const,
				evaluator: 'producer' as const,
				outcome: accepted ? ('pass' as const) : ('fail' as const),
				observation: accepted ? 'All extremities are visible.' : 'The first attempt crops one foot.'
			},
			{
				criterionId: 'affinity-review',
				category: 'affinity' as const,
				evaluator: 'producer' as const,
				outcome: 'not-applicable' as const,
				observation: 'Blind affinity recognition remains pending human review.'
			}
		],
		retryReason: accepted ? null : 'Regenerate with a wider camera and explicit safe margin.'
	};
}

function validResult() {
	return {
		schemaVersion: 'image-production-result-v1' as const,
		resultId: 'result-elemental-fire-v1',
		targetId: 'elemental-fire-v1',
		assignmentId: 'assignment-elemental-fire-v1',
		skillVersion: 'summonlab-image-production-v1',
		status: 'candidate' as const,
		attempts: [attempt(1, false), attempt(2, true)],
		selectedAttemptId: 'elemental-fire-v1-attempt-2',
		failedCriteria: [],
		startedAt: '2026-08-29T16:01:00.000Z',
		completedAt: '2026-08-29T16:02:40.000Z',
		totalWallTimeMs: 100_000,
		writtenOutputPaths: [candidatePath, resultPath],
		noSharedFilesEdited: true as const,
		selfPromoted: false as const
	};
}

describe('image-production contracts', () => {
	it('models experiment threat separately from nullable canonical grade', () => {
		const target = ImageProductionTargetSchema.parse(validTarget());

		expect(target.speciesId).toBe('elemental');
		expect(target.chassisId).toBe('bound-vanguard-elemental');
		expect(target.threat).toEqual({
			presentationTier: 'elite',
			referenceGrade: 4,
			canonicalGrade: null
		});
	});

	it('requires the established chassis for elementals and forbids it on other species', () => {
		const { chassisId, ...withoutChassis } = validTarget();
		expect(chassisId).toBe('bound-vanguard-elemental');
		expect(ImageProductionTargetSchema.safeParse(withoutChassis).success).toBe(false);

		const deathKnight = {
			...validTarget(),
			speciesId: 'death-knight',
			constructionMode: 'armored-undead'
		};
		expect(ImageProductionTargetSchema.safeParse(deathKnight).success).toBe(false);
	});

	it('requires non-Normal affinities to alter at least two visual dimensions', () => {
		const target = {
			...validTarget(),
			affinityDesign: { ...validTarget().affinityDesign, alteredDimensions: ['material'] }
		};

		expect(ImageProductionTargetSchema.safeParse(target).success).toBe(false);
	});

	it('keeps attempt count open in the result schema but enforces the assignment ceiling', () => {
		const result = validResult();
		expect(ImageProductionResultSchema.safeParse(result).success).toBe(true);
		expect(
			validateImageProductionExecution({
				target: validTarget(),
				assignment: validAssignment(1),
				result
			}).result.attempts
		).toHaveLength(2);
		expect(() =>
			validateImageProductionExecution({
				target: validTarget(),
				assignment: validAssignment(0),
				result
			})
		).toThrow(/maximum of 1 attempts/u);
	});

	it('requires classified provider failures only for terminal failed results', () => {
		const failedAttempt = {
			...attempt(1, false),
			conclusion: 'provider-failure' as const,
			failureKind: 'capacity' as const,
			sourceOutputId: null,
			persistence: null,
			output: null,
			retryReason: null
		};
		const failed = {
			...validResult(),
			status: 'failed' as const,
			attempts: [failedAttempt],
			selectedAttemptId: null,
			failedCriteria: ['full-frame'],
			writtenOutputPaths: [resultPath]
		};

		expect(ImageProductionResultSchema.safeParse(failed).success).toBe(true);
		const unclassifiedAttempt: Record<string, unknown> = { ...failedAttempt };
		delete unclassifiedAttempt.failureKind;
		expect(
			ImageProductionResultSchema.safeParse({ ...failed, attempts: [unclassifiedAttempt] }).success
		).toBe(false);
	});

	it('preserves legacy nonterminal failures and forbids failure kinds on other conclusions', () => {
		const providerFailure = {
			...attempt(1, false),
			conclusion: 'provider-failure' as const,
			sourceOutputId: null,
			persistence: null,
			output: null,
			retryReason: null
		};
		const legacyRevise = {
			...validResult(),
			status: 'revise' as const,
			attempts: [providerFailure, attempt(2, false)],
			selectedAttemptId: null,
			failedCriteria: ['full-frame']
		};

		expect(ImageProductionResultSchema.safeParse(legacyRevise).success).toBe(true);
		expect(
			ImageProductionResultSchema.safeParse({
				...validResult(),
				attempts: [{ ...attempt(1, false), failureKind: 'capacity' }, attempt(2, true)]
			}).success
		).toBe(false);
	});

	it('rejects writes and generated dimensions outside the assignment contract', () => {
		const result = validResult();
		result.writtenOutputPaths.push(
			'assets/enemies/experiments/affinity-workflow-v1/results/not-owned.json'
		);
		result.attempts[1]!.output!.width = 1024;

		expect(() =>
			validateImageProductionExecution({
				target: validTarget(),
				assignment: validAssignment(),
				result
			})
		).toThrow();
	});

	it('keeps aggregate catalogs unique and candidates unpromoted', () => {
		const entry = {
			targetId: 'elemental-fire-v1',
			resultId: 'result-elemental-fire-v1',
			assignmentId: 'assignment-elemental-fire-v1',
			speciesId: 'elemental' as const,
			affinity: 'fire' as const,
			cohort: 'controlled' as const,
			status: 'candidate' as const,
			candidatePath,
			candidateHash: hash,
			reviewState: 'pending' as const,
			promoted: false as const
		};
		const catalog = {
			schemaVersion: 'image-production-catalog-v1' as const,
			experimentId: 'affinity-workflow-v1',
			generatedAt: '2026-08-29T17:00:00.000Z',
			status: 'experimental-unpromoted' as const,
			entries: [entry, entry]
		};

		expect(ImageProductionCatalogSchema.safeParse(catalog).success).toBe(false);
	});

	it('does not allow a passing evaluation below the documented gates', () => {
		const evaluation = {
			schemaVersion: 'image-production-evaluation-v1' as const,
			experimentId: 'affinity-workflow-v1',
			generatedAt: '2026-08-29T18:00:00.000Z',
			catalogHash: hash,
			status: 'passed' as const,
			controlled: {
				targetCount: 24 as const,
				firstAttemptCandidateCount: 20,
				speciesCorrectCount: 23,
				affinityCorrectCount: 20,
				normalUnaffiliatedCount: 4,
				acceptedMeaningfulAffinityCount: 19,
				acceptedCriticalVisualFailureCount: 0
			},
			workflow: {
				completedTargetCount: 24,
				completeProvenanceCount: 24,
				pathConflictCount: 0,
				sharedFileEditCount: 0,
				retryCeilingViolationCount: 0
			},
			blindReviews: [],
			concurrencyStages: [],
			failureClassifications: [],
			recommendedSafeConcurrency: null,
			completionNotes: []
		};

		expect(ImageProductionEvaluationSchema.safeParse(evaluation).success).toBe(false);
	});

	it('rejects undeclared properties at the contract boundary', () => {
		expect(
			ImageProductionAssignmentSchema.safeParse({ ...validAssignment(), surprise: true }).success
		).toBe(false);
	});
});
