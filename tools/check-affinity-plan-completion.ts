import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, realpath, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionResultSchema,
	ImageProductionTargetSchema,
	validateImageProductionExecution,
	type ImageProductionBlindReview,
	type ImageProductionOutput,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { z } from 'zod';

import { loadAffinityReviewData } from '../apps/web/src/routes/forge/enemies/affinity-workflow/affinity-review.js';
import {
	AFFINITY_EXPERIMENT_ROOT,
	ImageProductionBlindReviewCollectionSchema,
	createAffinityWorkflowExportBundle
} from './image-production-lib.js';
import { buildAffinityGateReadiness } from './report-affinity-gate-readiness.js';
import {
	scanAffinityReviewWorkspace,
	type AffinityReviewSyncIssue,
	type ValidatedImageProductionExecution
} from './sync-affinity-review.js';
import { validateAffinityWorkflowWorkspace } from './validate-affinity-workflow.js';
import sharp from 'sharp';

const REQUIRED_CONCURRENCY_LEVELS = [2, 4, 6, 8, 12] as const;
const REQUIRED_SKILL_FILES = [
	'SKILL.md',
	'agents/openai.yaml',
	'references/affinity-grammar.md',
	'references/result-schema.md',
	'references/review-rubric.md',
	'references/species-grammar.md',
	'references/target-schema.md',
	'scripts/render_prompt.py',
	'scripts/validate_target.py',
	'scripts/verify_result.py'
] as const;
const REQUIRED_FORGE_FILES = [
	'apps/web/src/routes/forge/enemies/affinity-workflow/+page.server.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow/+page.svelte',
	'apps/web/src/routes/forge/enemies/affinity-workflow/affinity-review.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow/affinity-review.spec.ts',
	'apps/web/src/routes/forge/enemies/affinity-workflow.e2e.ts',
	'apps/web/src/routes/api/dev/affinity-reviews/+server.ts'
] as const;
const BREADTH_CONTACT_SHEET_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/breadth-contact-sheet.png` as const;
const ACCEPTED_RULES_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/accepted-later-pack-visual-rules.json` as const;
const SCALE_RECOMMENDATION_PATH =
	`${AFFINITY_EXPERIMENT_ROOT}/review/scale-recommendation.json` as const;

const FinalControlledRerunPlanSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-rerun-plan-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		targets: z
			.array(
				z
					.object({
						key: z.string().min(1),
						speciesId: z.string().min(1),
						affinity: z.string().min(1),
						version: z.string().min(1)
					})
					.passthrough()
			)
			.length(24),
		plannedPathTemplates: z
			.object({
				target: z.string().min(1),
				assignment: z.string().min(1),
				candidate: z.string().min(1),
				result: z.string().min(1)
			})
			.strict()
	})
	.passthrough();

const AcceptedLaterPackRulesSchema = z
	.object({
		schemaVersion: z.literal('affinity-accepted-later-pack-visual-rules-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('accepted'),
		acceptedBy: z.string().trim().min(1),
		acceptedAt: z.iso.datetime(),
		sourceEvaluationCatalogHash: z.string().regex(/^[a-f0-9]{64}$/u),
		sourceBlindReviewCount: z.number().int().min(24),
		rules: z.array(z.string().trim().min(1)).min(1)
	})
	.strict();

const ScaleRecommendationSchema = z
	.object({
		schemaVersion: z.literal('affinity-scale-recommendation-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('final'),
		recommendedSafeConcurrency: z.number().int().min(1).max(16),
		sourceEffectiveConcurrencyLevels: z.array(z.number().int().min(1).max(16)),
		productionStrategy: z.string().trim().min(1),
		fallbackBehavior: z.string().trim().min(1)
	})
	.strict();

export type AffinityPlanCompletionSectionId =
	| 'skillAndDryRun'
	| 'controlledFinalRerun'
	| 'humanBlindEvidence'
	| 'goblinAudits'
	| 'breadthAndUnusualAnatomy'
	| 'concurrencyLadder'
	| 'forgeEvidence'
	| 'acceptedLaterPackRules'
	| 'scaleRecommendation';

export type AffinityPlanBlockerClass = 'implementable' | 'human' | 'capacity' | 'gated';

export interface AffinityPlanCompletionEvidence {
	readonly workspaceValid: boolean;
	readonly skillAndDryRun: {
		readonly requiredFileCount: number;
		readonly presentFileCount: number;
		readonly installedSkillMatchesRepository: boolean;
		readonly dryRunValidated: boolean;
	};
	readonly controlledFinalRerun: {
		readonly planValidated: boolean;
		readonly targetManifestCount: number;
		readonly assignmentCount: number;
		readonly resultCount: number;
		readonly candidateImageCount: number;
		readonly gateSatisfied: boolean;
		readonly evaluationPassed: boolean;
	};
	readonly humanBlindEvidence: {
		readonly eligibleBlindReviewCount: number;
		readonly speciesThresholdSatisfied: boolean;
		readonly affinityThresholdSatisfied: boolean;
		readonly normalThresholdSatisfied: boolean;
		readonly meaningfulAcceptanceThresholdSatisfied: boolean;
		readonly criticalFailureThresholdSatisfied: boolean;
	};
	readonly goblinAudits: {
		readonly audit60Passed: boolean;
		readonly audit600Passed: boolean;
	};
	readonly breadthAndUnusualAnatomy: {
		readonly targetManifestCount: number;
		readonly resultCount: number;
		readonly reviewedResultCount: number;
		readonly representedSpeciesCount: number;
		readonly unusualCandidateCount: number;
		readonly breadthContactSheetPresent: boolean;
	};
	readonly concurrencyLadder: {
		readonly effectiveLevels: readonly number[];
		readonly requiredLevels: readonly number[];
		readonly recommendedSafeConcurrency: number | null;
		readonly scaleEndpointEvidenced: boolean;
	};
	readonly forgeEvidence: {
		readonly requiredFileCount: number;
		readonly presentFileCount: number;
		readonly labeledProjectionValid: boolean;
		readonly blindProjectionStripped: boolean;
	};
	readonly acceptedLaterPackRules: {
		readonly artifactPresent: boolean;
		readonly acceptedArtifactValid: boolean;
		readonly sourceBlindReviewCount: number;
	};
	readonly scaleRecommendation: {
		readonly artifactPresent: boolean;
		readonly finalArtifactValid: boolean;
		readonly sourceEffectiveConcurrencyLevels: readonly number[];
	};
}

export interface AffinityPlanCompletionSection {
	readonly complete: boolean;
	readonly evidence: Readonly<Record<string, unknown>>;
	readonly blockers: readonly string[];
	readonly blockerClasses: readonly AffinityPlanBlockerClass[];
}

export interface AffinityPlanCompletionReport {
	readonly schemaVersion: 'affinity-image-production-plan-completion-v1';
	readonly experimentId: 'affinity-workflow-v1';
	readonly planPath: 'docs/image-production-skill-and-affinity-test-plan.md';
	readonly status: 'complete' | 'incomplete';
	readonly workspaceValid: boolean;
	readonly sections: Readonly<
		Record<AffinityPlanCompletionSectionId, AffinityPlanCompletionSection>
	>;
	readonly incompleteSections: readonly AffinityPlanCompletionSectionId[];
	readonly blockerSummary: Readonly<Record<AffinityPlanBlockerClass, readonly string[]>>;
}

export interface FinalControlledGateEvidenceInput {
	readonly planValidated: boolean;
	readonly targets: readonly ImageProductionTarget[];
	readonly assignmentCount: number;
	readonly executions: readonly ValidatedImageProductionExecution[];
	readonly verifiedImageCount: number;
	readonly blindReviews: readonly ImageProductionBlindReview[];
	readonly validationIssues?: readonly string[];
}

export interface FinalControlledGateEvidence {
	readonly controlledFinalRerun: AffinityPlanCompletionEvidence['controlledFinalRerun'];
	readonly humanBlindEvidence: AffinityPlanCompletionEvidence['humanBlindEvidence'];
}

export interface CrossCohortIdSets {
	readonly baseTargetIds: readonly string[];
	readonly baseAssignmentIds: readonly string[];
	readonly baseResultIds: readonly string[];
	readonly finalTargetIds: readonly string[];
	readonly finalAssignmentIds: readonly string[];
	readonly finalResultIds: readonly string[];
}

/** Report every final ID that collides with immutable base evidence, grouped by identity kind. */
export function findFinalControlledCrossCohortIdConflicts(input: CrossCohortIdSets): string[] {
	const conflicts: string[] = [];
	for (const [label, baseValues, finalValues] of [
		['target', input.baseTargetIds, input.finalTargetIds],
		['assignment', input.baseAssignmentIds, input.finalAssignmentIds],
		['result', input.baseResultIds, input.finalResultIds]
	] as const) {
		const base = new Set(baseValues);
		for (const value of new Set(finalValues)) {
			if (base.has(value)) conflicts.push(`${label}:${value}`);
		}
	}
	return conflicts.sort((left, right) => left.localeCompare(right));
}

export function baseWorkspaceIssuesExcludingValidatedFinalPaths(
	issues: readonly AffinityReviewSyncIssue[],
	finalPlannedPaths: ReadonlySet<string>
): readonly AffinityReviewSyncIssue[] {
	return issues.filter(
		(issue) => !(issue.kind === 'orphan-artifact' && finalPlannedPaths.has(issue.path))
	);
}

export function compositeAffinityWorkspaceIsValid(input: {
	readonly baseProjectionValidated: boolean;
	readonly scanIssues: readonly AffinityReviewSyncIssue[];
	readonly finalPlannedPaths: ReadonlySet<string>;
	readonly finalValidationIssues: readonly string[];
}): boolean {
	return (
		input.baseProjectionValidated &&
		baseWorkspaceIssuesExcludingValidatedFinalPaths(input.scanIssues, input.finalPlannedPaths)
			.length === 0 &&
		input.finalValidationIssues.length === 0
	);
}

/** Derive final-cohort gates without consulting or inheriting the immutable v1 evaluation. */
export function buildFinalControlledGateEvidence(
	input: FinalControlledGateEvidenceInput
): FinalControlledGateEvidence {
	const validationIssues = input.validationIssues ?? [];
	const readiness = buildAffinityGateReadiness({
		experimentId: 'affinity-workflow-v1',
		controlledTargets: input.targets,
		executions: input.executions,
		blindReviews: input.blindReviews
	});
	const valid = validationIssues.length === 0;
	const criteria = readiness.criteria;
	return {
		controlledFinalRerun: {
			planValidated: input.planValidated,
			targetManifestCount: input.targets.length,
			assignmentCount: input.assignmentCount,
			resultCount: input.executions.length,
			candidateImageCount: input.verifiedImageCount,
			gateSatisfied: valid && readiness.gate.currentlySatisfied,
			evaluationPassed: valid && readiness.gate.currentlySatisfied
		},
		humanBlindEvidence: {
			eligibleBlindReviewCount: readiness.reviewEvidence.eligibleBlindRecordCount,
			speciesThresholdSatisfied: valid && criteria.speciesCorrectBlindReviews.satisfied,
			affinityThresholdSatisfied: valid && criteria.affinityCorrectBlindReviews.satisfied,
			normalThresholdSatisfied: valid && criteria.normalUnaffiliatedBlindReviews.satisfied,
			meaningfulAcceptanceThresholdSatisfied:
				valid && criteria.acceptedMeaningfulNonNormal.satisfied,
			criticalFailureThresholdSatisfied: valid && criteria.acceptedCriticalVisualFailures.satisfied
		}
	};
}

function section(
	complete: boolean,
	evidence: Readonly<Record<string, unknown>>,
	blockers: readonly string[],
	blockerClasses: readonly AffinityPlanBlockerClass[]
): AffinityPlanCompletionSection {
	return {
		complete,
		evidence,
		blockers: complete ? [] : blockers,
		blockerClasses: complete ? [] : [...new Set(blockerClasses)]
	};
}

/** Pure plan-level finalizer. It accepts measured evidence only; plans and prose are not outcomes. */
export function buildAffinityPlanCompletionReport(
	evidence: AffinityPlanCompletionEvidence
): AffinityPlanCompletionReport {
	const skillComplete =
		evidence.skillAndDryRun.presentFileCount === evidence.skillAndDryRun.requiredFileCount &&
		evidence.skillAndDryRun.installedSkillMatchesRepository &&
		evidence.skillAndDryRun.dryRunValidated;
	const controlledComplete =
		evidence.controlledFinalRerun.planValidated &&
		evidence.controlledFinalRerun.targetManifestCount === 24 &&
		evidence.controlledFinalRerun.assignmentCount === 24 &&
		evidence.controlledFinalRerun.resultCount === 24 &&
		evidence.controlledFinalRerun.candidateImageCount === 24 &&
		evidence.controlledFinalRerun.gateSatisfied &&
		evidence.controlledFinalRerun.evaluationPassed;
	const humanComplete =
		evidence.humanBlindEvidence.eligibleBlindReviewCount >= 24 &&
		evidence.humanBlindEvidence.speciesThresholdSatisfied &&
		evidence.humanBlindEvidence.affinityThresholdSatisfied &&
		evidence.humanBlindEvidence.normalThresholdSatisfied &&
		evidence.humanBlindEvidence.meaningfulAcceptanceThresholdSatisfied &&
		evidence.humanBlindEvidence.criticalFailureThresholdSatisfied;
	const goblinComplete =
		evidence.goblinAudits.audit60Passed && evidence.goblinAudits.audit600Passed;
	const breadthComplete =
		evidence.breadthAndUnusualAnatomy.targetManifestCount === 24 &&
		evidence.breadthAndUnusualAnatomy.resultCount === 24 &&
		evidence.breadthAndUnusualAnatomy.reviewedResultCount === 24 &&
		evidence.breadthAndUnusualAnatomy.representedSpeciesCount === 4 &&
		evidence.breadthAndUnusualAnatomy.unusualCandidateCount >= 1 &&
		evidence.breadthAndUnusualAnatomy.breadthContactSheetPresent;
	const measuredLevels = new Set(evidence.concurrencyLadder.effectiveLevels);
	const concurrencyComplete =
		evidence.concurrencyLadder.requiredLevels.every((level) => measuredLevels.has(level)) &&
		evidence.concurrencyLadder.recommendedSafeConcurrency !== null &&
		evidence.concurrencyLadder.scaleEndpointEvidenced;
	const forgeComplete =
		evidence.forgeEvidence.presentFileCount === evidence.forgeEvidence.requiredFileCount &&
		evidence.forgeEvidence.labeledProjectionValid &&
		evidence.forgeEvidence.blindProjectionStripped;
	const laterPackRulesComplete =
		evidence.acceptedLaterPackRules.artifactPresent &&
		evidence.acceptedLaterPackRules.acceptedArtifactValid &&
		evidence.acceptedLaterPackRules.sourceBlindReviewCount >= 24;
	const scaleRecommendationComplete =
		evidence.scaleRecommendation.artifactPresent &&
		evidence.scaleRecommendation.finalArtifactValid &&
		evidence.concurrencyLadder.requiredLevels.every((level) =>
			evidence.scaleRecommendation.sourceEffectiveConcurrencyLevels.includes(level)
		);

	const sections = {
		skillAndDryRun: section(
			skillComplete,
			evidence.skillAndDryRun,
			[
				'The repository skill, installed skill, and hash-bound fresh-agent dry run must all validate.'
			],
			['implementable']
		),
		controlledFinalRerun: section(
			controlledComplete,
			evidence.controlledFinalRerun,
			[
				'A planned rerun is not execution evidence: all 24 final-protocol manifests, assignments, images, and results must exist and the controlled evaluation must pass.'
			],
			['human', 'gated', 'implementable']
		),
		humanBlindEvidence: section(
			humanComplete,
			evidence.humanBlindEvidence,
			[
				'Twenty-four eligible hash-bound blind reviews must satisfy species, affinity, Normal, meaningful-acceptance, and critical-failure thresholds.'
			],
			['human']
		),
		goblinAudits: section(
			goblinComplete,
			evidence.goblinAudits,
			['Both deterministic 60- and 600-manifest Goblin independence audits must pass.'],
			['implementable']
		),
		breadthAndUnusualAnatomy: section(
			breadthComplete,
			evidence.breadthAndUnusualAnatomy,
			[
				'All 24 breadth targets need bounded results and review states, all four breadth species must be represented, an unusual drake or basilisk must pass, and a breadth contact sheet must exist.'
			],
			['gated', 'human', 'implementable']
		),
		concurrencyLadder: section(
			concurrencyComplete,
			evidence.concurrencyLadder,
			[
				'Effective 2-, 4-, 6-, 8-, and 12-worker stages must be measured, with a final recommendation and either a 16-worker result or explicit lower-capacity endpoint evidence.'
			],
			['capacity', 'implementable']
		),
		forgeEvidence: section(
			forgeComplete,
			evidence.forgeEvidence,
			[
				'The Forge implementation and executable labeled/blind projections must expose review evidence while stripping blind semantics.'
			],
			['implementable']
		),
		acceptedLaterPackRules: section(
			laterPackRulesComplete,
			evidence.acceptedLaterPackRules,
			[
				`Provisional prose is insufficient; ${ACCEPTED_RULES_PATH} must contain an explicitly accepted, review-bound rules artifact.`
			],
			['human', 'implementable']
		),
		scaleRecommendation: section(
			scaleRecommendationComplete,
			evidence.scaleRecommendation,
			[
				`Preliminary timing prose is insufficient; ${SCALE_RECOMMENDATION_PATH} must be final and cite every required measured concurrency level.`
			],
			['capacity', 'implementable']
		)
	} satisfies Record<AffinityPlanCompletionSectionId, AffinityPlanCompletionSection>;
	const entries = Object.entries(sections) as Array<
		[AffinityPlanCompletionSectionId, AffinityPlanCompletionSection]
	>;
	const incompleteSections = entries
		.filter(([, value]) => !value.complete)
		.map(([sectionId]) => sectionId);
	const blockerSummary: Record<AffinityPlanBlockerClass, string[]> = {
		implementable: [],
		human: [],
		capacity: [],
		gated: []
	};
	for (const [sectionId, value] of entries) {
		for (const blockerClass of value.blockerClasses) {
			blockerSummary[blockerClass].push(sectionId);
		}
	}
	if (!evidence.workspaceValid) blockerSummary.implementable.unshift('workspace-invalid');

	return {
		schemaVersion: 'affinity-image-production-plan-completion-v1',
		experimentId: 'affinity-workflow-v1',
		planPath: 'docs/image-production-skill-and-affinity-test-plan.md',
		status: evidence.workspaceValid && incompleteSections.length === 0 ? 'complete' : 'incomplete',
		workspaceValid: evidence.workspaceValid,
		sections,
		incompleteSections,
		blockerSummary
	};
}

async function fileExists(filePath: string): Promise<boolean> {
	return stat(filePath)
		.then((metadata) => metadata.isFile() && metadata.size > 0)
		.catch(() => false);
}

async function listFiles(root: string): Promise<string[]> {
	const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
	const nested = await Promise.all(
		entries.map(async (entry) => {
			const entryPath = path.join(root, entry.name);
			return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
		})
	);
	return nested.flat().sort((left, right) => left.localeCompare(right));
}

async function linkProjectedFile(
	workspaceRoot: string,
	projectionRoot: string,
	repositoryPath: string
): Promise<void> {
	const source = path.resolve(workspaceRoot, repositoryPath);
	const destination = path.resolve(projectionRoot, repositoryPath);
	await mkdir(path.dirname(destination), { recursive: true });
	if (!(await fileExists(destination))) await symlink(source, destination, 'file');
}

async function validateBaseWorkspaceProjection(
	workspaceRoot: string,
	excludedRepositoryPaths: ReadonlySet<string>
): Promise<Awaited<ReturnType<typeof validateAffinityWorkflowWorkspace>> | null> {
	const projectionRoot = await mkdtemp(path.join(tmpdir(), 'summonlab-affinity-base-'));
	try {
		const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
		for (const absolutePath of await listFiles(experimentRoot)) {
			const repositoryPath = path.relative(workspaceRoot, absolutePath).split(path.sep).join('/');
			if (!excludedRepositoryPaths.has(repositoryPath)) {
				await linkProjectedFile(workspaceRoot, projectionRoot, repositoryPath);
			}
		}
		const bundle = createAffinityWorkflowExportBundle();
		for (const referencePath of new Set(
			bundle.targets.flatMap((target) => target.references.map((reference) => reference.path))
		)) {
			await linkProjectedFile(workspaceRoot, projectionRoot, referencePath);
		}
		return await validateAffinityWorkflowWorkspace(projectionRoot);
	} catch {
		return null;
	} finally {
		await rm(projectionRoot, { recursive: true, force: true });
	}
}

async function readJson(filePath: string): Promise<unknown> {
	return JSON.parse(await readFile(filePath, 'utf8')) as unknown;
}

function renderPlannedPath(
	template: string,
	target: z.infer<typeof FinalControlledRerunPlanSchema>['targets'][number]
): string {
	return template
		.replace('{speciesId}', target.speciesId)
		.replace('{affinity}', target.affinity)
		.replace('{version}', target.version);
}

function retainedOutput(
	execution: ValidatedImageProductionExecution
): ImageProductionOutput | null {
	if (execution.result.status === 'candidate') {
		return (
			execution.result.attempts.find(
				(attempt) => attempt.attemptId === execution.result.selectedAttemptId
			)?.output ?? null
		);
	}
	return [...execution.result.attempts].reverse().find((attempt) => attempt.output)?.output ?? null;
}

async function verifyFinalImage(
	workspaceRoot: string,
	expectedPath: string,
	execution: ValidatedImageProductionExecution
): Promise<void> {
	const output = retainedOutput(execution);
	if (!output || output.path !== expectedPath) {
		throw new Error(`Final result does not retain its planned image: ${expectedPath}`);
	}
	const bytes = await readFile(path.resolve(workspaceRoot, output.path));
	const metadata = await sharp(bytes).metadata();
	const mediaType =
		metadata.format === 'png' ? 'image/png' : metadata.format === 'webp' ? 'image/webp' : null;
	if (
		bytes.byteLength !== output.bytes ||
		createHash('sha256').update(bytes).digest('hex') !== output.contentHash ||
		metadata.width !== output.width ||
		metadata.height !== output.height ||
		mediaType !== output.mediaType
	) {
		throw new Error(
			`Final image bytes or metadata do not match result provenance: ${expectedPath}`
		);
	}
}

function finalPlanIsStructurallyValid(
	plan: z.infer<typeof FinalControlledRerunPlanSchema>
): boolean {
	const keys = plan.targets.map((target) => target.key);
	const coordinates = plan.targets.map((target) => `${target.speciesId}:${target.affinity}`);
	const allPaths = plan.targets.flatMap((target) =>
		Object.values(plan.plannedPathTemplates).map((template) => renderPlannedPath(template, target))
	);
	return (
		new Set(keys).size === 24 && new Set(coordinates).size === 24 && new Set(allPaths).size === 96
	);
}

async function inspectFinalControlledExecutionEvidence(input: {
	readonly workspaceRoot: string;
	readonly plan: z.infer<typeof FinalControlledRerunPlanSchema> | null;
	readonly blindReviews: readonly ImageProductionBlindReview[];
	readonly baseTargetIds: readonly string[];
	readonly baseAssignmentIds: readonly string[];
	readonly baseResultIds: readonly string[];
}): Promise<{
	readonly gateEvidence: FinalControlledGateEvidence;
	readonly validationIssues: readonly string[];
	readonly plannedPaths: ReadonlySet<string>;
}> {
	if (!input.plan) {
		const validationIssues = ['Final controlled rerun plan is missing or invalid.'];
		return {
			gateEvidence: buildFinalControlledGateEvidence({
				planValidated: false,
				targets: [],
				assignmentCount: 0,
				executions: [],
				verifiedImageCount: 0,
				blindReviews: input.blindReviews,
				validationIssues
			}),
			validationIssues,
			plannedPaths: new Set()
		};
	}
	const plannedPaths = new Set(
		input.plan.targets.flatMap((target) =>
			Object.values(input.plan!.plannedPathTemplates).map((template) =>
				renderPlannedPath(template, target)
			)
		)
	);
	const targets: ImageProductionTarget[] = [];
	const executions: ValidatedImageProductionExecution[] = [];
	const validationIssues: string[] = [];
	const assignmentIds: string[] = [];
	const resultIds: string[] = [];
	let assignmentCount = 0;
	let verifiedImageCount = 0;
	for (const planned of input.plan.targets) {
		const targetPath = renderPlannedPath(input.plan.plannedPathTemplates.target, planned);
		const assignmentPath = renderPlannedPath(input.plan.plannedPathTemplates.assignment, planned);
		const resultPath = renderPlannedPath(input.plan.plannedPathTemplates.result, planned);
		const candidatePath = renderPlannedPath(input.plan.plannedPathTemplates.candidate, planned);
		const coordinatePaths = [targetPath, assignmentPath, resultPath, candidatePath];
		const pathPresence = await Promise.all(
			coordinatePaths.map(async (repositoryPath) => ({
				repositoryPath,
				present: await fileExists(path.resolve(input.workspaceRoot, repositoryPath))
			}))
		);
		const presentPaths = pathPresence.filter((entry) => entry.present);
		if (presentPaths.length === 0) continue;
		if (presentPaths.length !== coordinatePaths.length) {
			validationIssues.push(
				`${planned.key}: partial final-controlled coordinate; present ${presentPaths.length}/4 planned artifacts.`
			);
		}
		try {
			const target = ImageProductionTargetSchema.parse(
				await readJson(path.resolve(input.workspaceRoot, targetPath))
			);
			if (
				target.cohort !== 'controlled' ||
				target.speciesId !== planned.speciesId ||
				target.affinity !== planned.affinity ||
				target.output.candidatePath !== candidatePath ||
				target.output.resultPath !== resultPath
			) {
				throw new Error('Target identity, cohort, coordinate, or owned outputs differ from plan.');
			}
			targets.push(target);
			const assignment = ImageProductionAssignmentSchema.parse(
				await readJson(path.resolve(input.workspaceRoot, assignmentPath))
			);
			if (
				assignment.targetId !== target.targetId ||
				assignment.permittedOutputs.candidatePath !== candidatePath ||
				assignment.permittedOutputs.resultPath !== resultPath
			) {
				throw new Error('Assignment is not bound to the planned target and outputs.');
			}
			assignmentCount += 1;
			assignmentIds.push(assignment.assignmentId);
			const result = ImageProductionResultSchema.parse(
				await readJson(path.resolve(input.workspaceRoot, resultPath))
			);
			validateImageProductionExecution({ target, assignment, result });
			const execution = { target, assignment, result };
			executions.push(execution);
			resultIds.push(result.resultId);
			await verifyFinalImage(input.workspaceRoot, candidatePath, execution);
			verifiedImageCount += 1;
		} catch (error) {
			validationIssues.push(
				`${planned.key}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	for (const [label, values] of [
		['target IDs', targets.map((target) => target.targetId)],
		['assignment IDs', assignmentIds],
		['result IDs', resultIds]
	] as const) {
		if (new Set(values).size !== values.length) {
			validationIssues.push(`Final controlled ${label} are not unique.`);
		}
	}
	for (const conflict of findFinalControlledCrossCohortIdConflicts({
		baseTargetIds: input.baseTargetIds,
		baseAssignmentIds: input.baseAssignmentIds,
		baseResultIds: input.baseResultIds,
		finalTargetIds: targets.map((target) => target.targetId),
		finalAssignmentIds: assignmentIds,
		finalResultIds: resultIds
	})) {
		validationIssues.push(`Final controlled ID collides with immutable base evidence: ${conflict}`);
	}
	return {
		gateEvidence: buildFinalControlledGateEvidence({
			planValidated: finalPlanIsStructurallyValid(input.plan),
			targets,
			assignmentCount,
			executions,
			verifiedImageCount,
			blindReviews: input.blindReviews,
			validationIssues
		}),
		validationIssues,
		plannedPaths
	};
}

async function optionalAcceptedRules(workspaceRoot: string) {
	const filePath = path.resolve(workspaceRoot, ACCEPTED_RULES_PATH);
	const artifactPresent = await fileExists(filePath);
	if (!artifactPresent)
		return { artifactPresent, acceptedArtifactValid: false, sourceBlindReviewCount: 0 };
	const parsed = AcceptedLaterPackRulesSchema.safeParse(await readJson(filePath).catch(() => null));
	return {
		artifactPresent,
		acceptedArtifactValid: parsed.success,
		sourceBlindReviewCount: parsed.success ? parsed.data.sourceBlindReviewCount : 0
	};
}

async function optionalScaleRecommendation(workspaceRoot: string) {
	const filePath = path.resolve(workspaceRoot, SCALE_RECOMMENDATION_PATH);
	const artifactPresent = await fileExists(filePath);
	if (!artifactPresent)
		return {
			artifactPresent,
			finalArtifactValid: false,
			sourceEffectiveConcurrencyLevels: [] as number[]
		};
	const parsed = ScaleRecommendationSchema.safeParse(await readJson(filePath).catch(() => null));
	return {
		artifactPresent,
		finalArtifactValid: parsed.success,
		sourceEffectiveConcurrencyLevels: parsed.success
			? parsed.data.sourceEffectiveConcurrencyLevels
			: []
	};
}

export async function inspectAffinityPlanCompletionEvidence(
	workspaceRoot = process.cwd()
): Promise<AffinityPlanCompletionEvidence> {
	const exportBundle = createAffinityWorkflowExportBundle();
	const scan = await scanAffinityReviewWorkspace(workspaceRoot);
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	const repoSkillRoot = path.resolve(workspaceRoot, 'skills/summonlab-image-production');
	const installedSkillRoot = '/home/joao/.codex/skills/summonlab-image-production';
	const presentSkillFiles = (
		await Promise.all(
			REQUIRED_SKILL_FILES.map((relativePath) => fileExists(path.join(repoSkillRoot, relativePath)))
		)
	).filter(Boolean).length;
	const installedSkillMatchesRepository = await Promise.all([
		realpath(repoSkillRoot).catch(() => null),
		realpath(installedSkillRoot).catch(() => null)
	]).then(([repository, installed]) => repository !== null && repository === installed);

	const finalPlanPath = path.join(experimentRoot, 'review/final-controlled-rerun-plan.json');
	const finalPlan = FinalControlledRerunPlanSchema.safeParse(
		await readJson(finalPlanPath).catch(() => null)
	);
	const blindReviewCollection = ImageProductionBlindReviewCollectionSchema.safeParse(
		await readJson(path.join(experimentRoot, 'review/blind-review.json')).catch(() => null)
	);
	const baseTargetIds = exportBundle.targets.map((target) => target.targetId);
	const baseTargetIdSet = new Set(baseTargetIds);
	const finalControlled = await inspectFinalControlledExecutionEvidence({
		workspaceRoot,
		plan: finalPlan.success ? finalPlan.data : null,
		blindReviews: blindReviewCollection.success ? blindReviewCollection.data.reviews : [],
		baseTargetIds,
		baseAssignmentIds: exportBundle.assignments.map((assignment) => assignment.assignmentId),
		baseResultIds: scan.executions
			.filter(({ target }) => baseTargetIdSet.has(target.targetId))
			.map(({ result }) => result.resultId)
	});
	const validation = await validateBaseWorkspaceProjection(
		workspaceRoot,
		finalControlled.plannedPaths
	);
	const workspaceValid = compositeAffinityWorkspaceIsValid({
		baseProjectionValidated: validation !== null,
		scanIssues: scan.issues,
		finalPlannedPaths: finalControlled.plannedPaths,
		finalValidationIssues: finalControlled.validationIssues
	});

	const auditPassed = async (sampleSize: 60 | 600): Promise<boolean> => {
		const value = (await readJson(
			path.join(experimentRoot, `review/goblin-audit-${sampleSize}.json`)
		).catch(() => null)) as { sampleSize?: unknown; gates?: { passed?: unknown } } | null;
		return value?.sampleSize === sampleSize && value.gates?.passed === true && validation !== null;
	};

	const breadthTargets = scan.executions.filter(({ target }) => target.cohort === 'breadth');
	const breadthCatalogEntries = scan.catalog.entries.filter((entry) => entry.cohort === 'breadth');
	const breadthSpecies = new Set(breadthTargets.map(({ target }) => target.speciesId));
	const unusualCandidates = breadthTargets.filter(
		({ target, result }) =>
			['cave-drake', 'tower-basilisk'].includes(target.speciesId) && result.status === 'candidate'
	);
	const effectiveLevels = [
		...new Set(scan.evaluation.concurrencyStages.map((stage) => stage.effectiveParallelJobs))
	].sort((left, right) => left - right);
	const scaleEndpointEvidenced =
		effectiveLevels.includes(16) ||
		(scan.evaluation.recommendedSafeConcurrency !== null &&
			scan.evaluation.failureClassifications.some(
				(failure) => failure.layer === 'scheduler' && failure.resolution !== null
			));

	const presentForgeFiles = (
		await Promise.all(
			REQUIRED_FORGE_FILES.map((relativePath) =>
				fileExists(path.resolve(workspaceRoot, relativePath))
			)
		)
	).filter(Boolean).length;
	const [labeledForge, blindForge] = await Promise.all([
		loadAffinityReviewData(false, []),
		loadAffinityReviewData(true, [], 'controlled')
	]);
	const labeledCells = labeledForge.rows.flatMap((row) => row.cells);
	const blindCells = blindForge.rows.flatMap((row) => row.cells);
	const labeledProjectionValid =
		labeledCells.length === 84 &&
		labeledCells.some((cell) => cell.status === 'candidate' && cell.metadata !== null) &&
		labeledCells.some((cell) => cell.status === 'pending');
	const blindProjectionStripped =
		blindCells.length === 24 &&
		blindCells.every((cell) => cell.labels === null && cell.metadata === null) &&
		blindCells.filter((cell) => cell.status === 'candidate').length === 21;

	const acceptedLaterPackRules = await optionalAcceptedRules(workspaceRoot);
	const scaleRecommendation = await optionalScaleRecommendation(workspaceRoot);

	return {
		workspaceValid,
		skillAndDryRun: {
			requiredFileCount: REQUIRED_SKILL_FILES.length,
			presentFileCount: presentSkillFiles,
			installedSkillMatchesRepository,
			dryRunValidated: validation?.dryRunEvidence ?? false
		},
		controlledFinalRerun: finalControlled.gateEvidence.controlledFinalRerun,
		humanBlindEvidence: finalControlled.gateEvidence.humanBlindEvidence,
		goblinAudits: {
			audit60Passed: await auditPassed(60),
			audit600Passed: await auditPassed(600)
		},
		breadthAndUnusualAnatomy: {
			targetManifestCount: exportBundle.targets.filter((target) => target.cohort === 'breadth')
				.length,
			resultCount: breadthTargets.length,
			reviewedResultCount: breadthCatalogEntries.filter((entry) => entry.reviewState !== 'pending')
				.length,
			representedSpeciesCount: breadthSpecies.size,
			unusualCandidateCount: unusualCandidates.length,
			breadthContactSheetPresent: await fileExists(
				path.resolve(workspaceRoot, BREADTH_CONTACT_SHEET_PATH)
			)
		},
		concurrencyLadder: {
			effectiveLevels,
			requiredLevels: REQUIRED_CONCURRENCY_LEVELS,
			recommendedSafeConcurrency: scan.evaluation.recommendedSafeConcurrency,
			scaleEndpointEvidenced
		},
		forgeEvidence: {
			requiredFileCount: REQUIRED_FORGE_FILES.length,
			presentFileCount: presentForgeFiles,
			labeledProjectionValid,
			blindProjectionStripped
		},
		acceptedLaterPackRules,
		scaleRecommendation
	};
}

export async function checkAffinityPlanCompletion(
	workspaceRoot = process.cwd()
): Promise<AffinityPlanCompletionReport> {
	return buildAffinityPlanCompletionReport(
		await inspectAffinityPlanCompletionEvidence(workspaceRoot)
	);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
	const report = await checkAffinityPlanCompletion(process.cwd());
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
	if (report.status !== 'complete') process.exitCode = 1;
}
