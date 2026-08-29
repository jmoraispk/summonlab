import { createHash } from 'node:crypto';

import {
	ImageProductionAssignmentSchema,
	ImageProductionAttemptSchema,
	ImageProductionBlindReviewSchema,
	ImageProductionCatalogSchema,
	ImageProductionConcurrencyStageSchema,
	ImageProductionEvaluationSchema,
	ImageProductionResultSchema,
	ImageProductionRubricFindingSchema,
	ImageProductionTargetSchema,
	type ImageProductionAssignment,
	type ImageProductionCatalog,
	type ImageProductionEvaluation,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import {
	AFFINITY_WORKFLOW_VERSION,
	AFFINITY_IDS,
	AFFINITY_SPECIES_IDS,
	ALL_AFFINITY_TARGETS,
	BASE_AFFINITY_TARGETS,
	ELEMENTAL_REGRESSION_TARGETS,
	GOBLIN_AFFINITY_AUDIT_60,
	GOBLIN_AFFINITY_AUDIT_600
} from '../packages/content/src/index.js';
import { z } from 'zod';

export const AFFINITY_EXPERIMENT_ROOT = 'assets/enemies/experiments/affinity-workflow-v1' as const;
export const AFFINITY_EXPORT_TIMESTAMP = '2026-08-29T16:00:00.000Z' as const;

export const ImageProductionBlindReviewCollectionSchema = z
	.object({
		schemaVersion: z.literal('image-production-blind-reviews-v1'),
		experimentId: z.literal(AFFINITY_WORKFLOW_VERSION),
		updatedAt: z.string().datetime({ offset: true }),
		reviews: z.array(ImageProductionBlindReviewSchema)
	})
	.strict()
	.superRefine((collection, context) => {
		const reviewIds = collection.reviews.map((review) => review.reviewId);
		if (new Set(reviewIds).size !== reviewIds.length) {
			context.addIssue({ code: 'custom', message: 'Blind review IDs must be unique' });
		}
		const targetIds = collection.reviews.map((review) => review.targetId);
		if (new Set(targetIds).size !== targetIds.length) {
			context.addIssue({
				code: 'custom',
				message: 'The aggregate stores at most one current blind review per target'
			});
		}
	});

export type ImageProductionBlindReviewCollection = z.infer<
	typeof ImageProductionBlindReviewCollectionSchema
>;

export interface AffinityWorkflowExportArtifact {
	readonly path: string;
	readonly value: unknown;
	readonly ownership: 'generated' | 'orchestrator-aggregate';
}

export interface AffinityWorkflowExportBundle {
	readonly targets: readonly ImageProductionTarget[];
	readonly assignments: readonly ImageProductionAssignment[];
	readonly catalog: ImageProductionCatalog;
	readonly blindReviews: ImageProductionBlindReviewCollection;
	readonly evaluation: ImageProductionEvaluation;
	readonly artifacts: readonly AffinityWorkflowExportArtifact[];
}

export function canonicalJson(value: unknown): string {
	if (value === null || typeof value !== 'object') return JSON.stringify(value);
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
		.join(',')}}`;
}

export function sha256Json(value: unknown): string {
	return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function targetArtifactPath(target: ImageProductionTarget): string {
	return target.cohort === 'regression'
		? `${AFFINITY_EXPERIMENT_ROOT}/targets/regression/${target.speciesId}/${target.affinity}-v2.json`
		: `${AFFINITY_EXPERIMENT_ROOT}/targets/${target.speciesId}/${target.affinity}.json`;
}

export function assignmentArtifactPath(target: ImageProductionTarget): string {
	return target.cohort === 'regression'
		? `${AFFINITY_EXPERIMENT_ROOT}/assignments/regression/${target.speciesId}/${target.affinity}-v2.json`
		: `${AFFINITY_EXPERIMENT_ROOT}/assignments/${target.speciesId}/${target.affinity}.json`;
}

export function createImageProductionAssignments(
	targets: readonly ImageProductionTarget[]
): readonly ImageProductionAssignment[] {
	const forbiddenSharedPaths = [
		`${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json`,
		`${AFFINITY_EXPERIMENT_ROOT}/review/blind-review.json`,
		`${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json`,
		`${AFFINITY_EXPERIMENT_ROOT}/review/contact-sheet.png`,
		`${AFFINITY_EXPERIMENT_ROOT}/generation-record.md`
	];
	return targets.map((target) =>
		ImageProductionAssignmentSchema.parse({
			schemaVersion: 'image-production-assignment-v1',
			assignmentId: `assignment-${target.targetId}`,
			targetId: target.targetId,
			skillVersion: 'summonlab-image-production-v1',
			assignedAt: AFFINITY_EXPORT_TIMESTAMP,
			dryRun: false,
			retryCeiling: 1,
			permittedOutputs: target.output,
			forbiddenSharedPaths,
			completionContract: {
				oneTargetOneImage: true,
				structuredResultRequired: true,
				sharedFilesMustRemainUntouched: true,
				selfPromotionForbidden: true
			}
		})
	);
}

export interface AffinityWorkflowDefinitionSummary {
	readonly targetCount: 54;
	readonly assignmentCount: 54;
	readonly baseTargetCount: 48;
	readonly controlledTargetCount: 24;
	readonly breadthTargetCount: 24;
	readonly regressionTargetCount: 6;
	readonly uniqueOutputCount: 108;
}

export function validateAffinityWorkflowDefinitions(
	targetInputs: readonly unknown[],
	assignmentInputs: readonly unknown[]
): AffinityWorkflowDefinitionSummary {
	const targets = targetInputs.map((target) => ImageProductionTargetSchema.parse(target));
	const assignments = assignmentInputs.map((assignment) =>
		ImageProductionAssignmentSchema.parse(assignment)
	);
	if (targets.length !== 54) throw new Error(`Expected 54 targets, found ${targets.length}`);
	if (assignments.length !== 54) {
		throw new Error(`Expected 54 assignments, found ${assignments.length}`);
	}
	const targetIds = new Set(targets.map((target) => target.targetId));
	const assignmentIds = new Set(assignments.map((assignment) => assignment.assignmentId));
	if (targetIds.size !== targets.length) throw new Error('Target IDs must be unique');
	if (assignmentIds.size !== assignments.length) throw new Error('Assignment IDs must be unique');
	const expectedTargetsById = new Map(
		[...BASE_AFFINITY_TARGETS, ...ELEMENTAL_REGRESSION_TARGETS].map((target) => [
			target.targetId,
			target
		])
	);
	for (const target of targets) {
		const expected = expectedTargetsById.get(target.targetId);
		if (!expected || canonicalJson(target) !== canonicalJson(expected)) {
			throw new Error(`Target does not match its immutable definition: ${target.targetId}`);
		}
	}
	const baseTargets = targets.filter((target) => target.cohort !== 'regression');
	const regressionTargets = targets.filter((target) => target.cohort === 'regression');
	for (const speciesId of AFFINITY_SPECIES_IDS) {
		for (const affinity of AFFINITY_IDS) {
			const matches = baseTargets.filter(
				(target) => target.speciesId === speciesId && target.affinity === affinity
			);
			if (matches.length !== 1) {
				throw new Error(
					`Expected one target for ${speciesId}/${affinity}; found ${matches.length}`
				);
			}
		}
	}
	for (const affinity of AFFINITY_IDS) {
		const matches = regressionTargets.filter(
			(target) => target.speciesId === 'elemental' && target.affinity === affinity
		);
		if (matches.length !== 1) {
			throw new Error(
				`Expected one Elemental regression target for ${affinity}; found ${matches.length}`
			);
		}
		const target = matches[0]!;
		if (target.targetId !== `${AFFINITY_WORKFLOW_VERSION}-elemental-${affinity}-v2`) {
			throw new Error(`Unexpected Elemental regression target ID: ${target.targetId}`);
		}
		if (target.promptProtocol !== 'safe-frame-v3' || target.authoringProtocol !== 'semantic-v2') {
			throw new Error(
				`Elemental regression target must use safe-frame-v3 and semantic-v2: ${target.targetId}`
			);
		}
	}
	if (regressionTargets.some((target) => target.speciesId !== 'elemental')) {
		throw new Error('Only the six explicit Elemental v2 targets may use the regression cohort');
	}
	const assignmentsByTarget = new Map(
		assignments.map((assignment) => [assignment.targetId, assignment])
	);
	const outputPaths: string[] = [];
	for (const target of targets) {
		const assignment = assignmentsByTarget.get(target.targetId);
		if (!assignment) throw new Error(`Missing assignment for ${target.targetId}`);
		if (
			assignment.permittedOutputs.candidatePath !== target.output.candidatePath ||
			assignment.permittedOutputs.resultPath !== target.output.resultPath
		) {
			throw new Error(`Assignment output mismatch for ${target.targetId}`);
		}
		outputPaths.push(target.output.candidatePath, target.output.resultPath);
	}
	if (assignmentsByTarget.size !== targets.length) {
		throw new Error('Assignments contain duplicate or unknown target IDs');
	}
	if (new Set(outputPaths).size !== outputPaths.length) {
		throw new Error('Every candidate and result path must be collision-free');
	}
	const controlledTargetCount = targets.filter((target) => target.cohort === 'controlled').length;
	const breadthTargetCount = targets.filter((target) => target.cohort === 'breadth').length;
	const regressionTargetCount = regressionTargets.length;
	if (
		baseTargets.length !== 48 ||
		controlledTargetCount !== 24 ||
		breadthTargetCount !== 24 ||
		regressionTargetCount !== 6
	) {
		throw new Error(
			`Expected 48 base (24 controlled, 24 breadth) and 6 regression targets; found ${baseTargets.length} base (${controlledTargetCount} controlled, ${breadthTargetCount} breadth) and ${regressionTargetCount} regression`
		);
	}
	return {
		targetCount: 54,
		assignmentCount: 54,
		baseTargetCount: 48,
		controlledTargetCount: 24,
		breadthTargetCount: 24,
		regressionTargetCount: 6,
		uniqueOutputCount: 108
	};
}

function jsonSchema(schema: z.ZodType, id: string): Record<string, unknown> {
	return {
		$id: `https://summonlab.local/schemas/${id}.json`,
		...z.toJSONSchema(schema, { target: 'draft-2020-12' })
	};
}

export function createImageProductionSchemaArtifacts(): readonly AffinityWorkflowExportArtifact[] {
	const schemas = [
		['target', ImageProductionTargetSchema],
		['assignment', ImageProductionAssignmentSchema],
		['attempt', ImageProductionAttemptSchema],
		['result', ImageProductionResultSchema],
		['rubric-finding', ImageProductionRubricFindingSchema],
		['catalog', ImageProductionCatalogSchema],
		['blind-review-collection', ImageProductionBlindReviewCollectionSchema],
		['concurrency-stage', ImageProductionConcurrencyStageSchema],
		['evaluation', ImageProductionEvaluationSchema]
	] as const;
	return schemas.map(([name, schema]) => ({
		path: `${AFFINITY_EXPERIMENT_ROOT}/schemas/${name}.schema.json`,
		value: jsonSchema(schema, `image-production-${name}-v1`),
		ownership: 'generated' as const
	}));
}

export function createImageProductionAggregateScaffolds(): Readonly<{
	catalog: ImageProductionCatalog;
	blindReviews: ImageProductionBlindReviewCollection;
	evaluation: ImageProductionEvaluation;
}> {
	const catalog = ImageProductionCatalogSchema.parse({
		schemaVersion: 'image-production-catalog-v1',
		experimentId: AFFINITY_WORKFLOW_VERSION,
		generatedAt: AFFINITY_EXPORT_TIMESTAMP,
		status: 'experimental-unpromoted',
		entries: []
	});
	const blindReviews = ImageProductionBlindReviewCollectionSchema.parse({
		schemaVersion: 'image-production-blind-reviews-v1',
		experimentId: AFFINITY_WORKFLOW_VERSION,
		updatedAt: AFFINITY_EXPORT_TIMESTAMP,
		reviews: []
	});
	const evaluation = ImageProductionEvaluationSchema.parse({
		schemaVersion: 'image-production-evaluation-v1',
		experimentId: AFFINITY_WORKFLOW_VERSION,
		generatedAt: AFFINITY_EXPORT_TIMESTAMP,
		catalogHash: sha256Json(catalog),
		status: 'incomplete',
		controlled: {
			targetCount: 24,
			firstAttemptCandidateCount: 0,
			speciesCorrectCount: 0,
			affinityCorrectCount: 0,
			normalUnaffiliatedCount: 0,
			acceptedMeaningfulAffinityCount: 0,
			acceptedCriticalVisualFailureCount: 0
		},
		workflow: {
			completedTargetCount: 0,
			completeProvenanceCount: 0,
			pathConflictCount: 0,
			sharedFileEditCount: 0,
			retryCeilingViolationCount: 0
		},
		blindReviews: [],
		concurrencyStages: [],
		failureClassifications: [],
		recommendedSafeConcurrency: null,
		completionNotes: ['Scaffolded before image generation; no cohort has been evaluated.']
	});
	return { catalog, blindReviews, evaluation };
}

export function createAffinityWorkflowExportBundle(): AffinityWorkflowExportBundle {
	const targets = ALL_AFFINITY_TARGETS.map((target) => ImageProductionTargetSchema.parse(target));
	const assignments = createImageProductionAssignments(targets);
	validateAffinityWorkflowDefinitions(targets, assignments);
	const { catalog, blindReviews, evaluation } = createImageProductionAggregateScaffolds();
	const artifacts: AffinityWorkflowExportArtifact[] = [
		...createImageProductionSchemaArtifacts(),
		...targets.map((target) => ({
			path: targetArtifactPath(target),
			value: target,
			ownership: 'generated' as const
		})),
		...assignments.map((assignment, index) => ({
			path: assignmentArtifactPath(targets[index]!),
			value: assignment,
			ownership: 'generated' as const
		})),
		{
			path: `${AFFINITY_EXPERIMENT_ROOT}/review/goblin-audit-60.json`,
			value: GOBLIN_AFFINITY_AUDIT_60,
			ownership: 'generated'
		},
		{
			path: `${AFFINITY_EXPERIMENT_ROOT}/review/goblin-audit-600.json`,
			value: GOBLIN_AFFINITY_AUDIT_600,
			ownership: 'generated'
		},
		{
			path: `${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json`,
			value: catalog,
			ownership: 'orchestrator-aggregate'
		},
		{
			path: `${AFFINITY_EXPERIMENT_ROOT}/review/blind-review.json`,
			value: blindReviews,
			ownership: 'orchestrator-aggregate'
		},
		{
			path: `${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json`,
			value: evaluation,
			ownership: 'orchestrator-aggregate'
		}
	];
	return { targets, assignments, catalog, blindReviews, evaluation, artifacts };
}
