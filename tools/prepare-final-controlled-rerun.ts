import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema,
	type ImageProductionAcceptanceCriterion,
	type ImageProductionAssignment,
	type ImageProductionTarget
} from '../packages/contracts/src/index.js';
import { format } from 'prettier';
import { z } from 'zod';

import {
	AFFINITY_EXPERIMENT_ROOT,
	canonicalJson,
	createAffinityWorkflowExportBundle,
	createImageProductionAssignments
} from './image-production-lib.js';

const SPECIES = ['death-knight', 'elemental', 'gray-wolf', 'cave-bear'] as const;
const AFFINITIES = ['normal', 'wood', 'fire', 'metal', 'water', 'wind'] as const;
const PLAN_PATH = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`;
const PREVIEW_PREFIX = 'affinity-final-controlled-rerun-';
export const REQUIRED_BLOCKING_DESIGN_RISK_COORDINATES = [
	'death-knight-normal-v4',
	'death-knight-wood-v4',
	'death-knight-fire-v4',
	'death-knight-water-v4',
	'death-knight-wind-v4',
	'cave-bear-normal-v3',
	'cave-bear-wood-v3',
	'cave-bear-wind-v3'
] as const;
export const REQUIRED_NONBLOCKING_DESIGN_RISK_COORDINATES = [
	'death-knight-metal-v4',
	'elemental-normal-v4',
	'elemental-water-v4',
	'elemental-wind-v4',
	'gray-wolf-normal-v3',
	'elemental-wood-v4',
	'gray-wolf-wood-v3',
	'gray-wolf-water-v3'
] as const;
const DESIGN_RISK_COORDINATES = [
	...REQUIRED_BLOCKING_DESIGN_RISK_COORDINATES,
	...REQUIRED_NONBLOCKING_DESIGN_RISK_COORDINATES
] as const;

export const FinalControlledRerunPlanSchema = z
	.object({
		schemaVersion: z.literal('affinity-final-controlled-rerun-plan-v1'),
		experimentId: z.literal('affinity-workflow-v1'),
		status: z.literal('awaiting-informative-v1-blind-review'),
		purpose: z.string().min(1),
		targetCount: z.literal(24),
		promptProtocol: z.literal('safe-frame-v4'),
		authoringProtocol: z.literal('semantic-v2'),
		retryCeiling: z.literal(1),
		speciesVersions: z
			.object({
				'death-knight': z.literal('v4'),
				elemental: z.literal('v4'),
				'gray-wolf': z.literal('v3'),
				'cave-bear': z.literal('v3')
			})
			.strict(),
		entryGate: z
			.object({
				requiresInformativeV1BlindReview: z.literal(true),
				requiresCurrentWorkspaceValid: z.literal(true),
				requiresAllPlannedOutputsAbsent: z.literal(true),
				doesNotAuthorizeBreadth: z.literal(true)
			})
			.strict(),
		designRiskReview: z
			.object({
				status: z.literal('pending-informative-v1-blind-review'),
				activationPolicy: z
					.object({
						requiresAllBlockingRisksResolved: z.literal(true),
						prohibitsActivationWhileBlockingRiskPending: z.literal(true)
					})
					.strict(),
				risks: z
					.array(
						z
							.object({
								riskId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
								coordinate: z.enum(DESIGN_RISK_COORDINATES),
								sourceTargetId: z.string().regex(/^[a-z][a-z0-9-]{1,79}$/u),
								severity: z.enum(['blocking', 'risk']),
								concern: z.string().trim().min(1),
								requiredResolution: z.string().trim().min(1),
								status: z.literal('pending-informative-v1-blind-review')
							})
							.strict()
					)
					.length(16)
			})
			.strict(),
		fallbackExecution: z
			.object({
				activeTaskTotalSlots: z.literal(4),
				reservedOrchestratorSlots: z.literal(1),
				effectiveImageWorkers: z.literal(3),
				waveCount: z.literal(8),
				waves: z.array(z.array(z.string().min(1)).length(3)).length(8)
			})
			.strict(),
		targets: z
			.array(
				z
					.object({
						key: z.string().min(1),
						speciesId: z.enum(SPECIES),
						affinity: z.enum(AFFINITIES),
						version: z.enum(['v3', 'v4'])
					})
					.strict()
			)
			.length(24),
		plannedPathTemplates: z
			.object({
				target: z.literal(
					'assets/enemies/experiments/affinity-workflow-v1/targets/final-controlled/{speciesId}/{affinity}-{version}.json'
				),
				assignment: z.literal(
					'assets/enemies/experiments/affinity-workflow-v1/assignments/final-controlled/{speciesId}/{affinity}-{version}.json'
				),
				candidate: z.literal(
					'assets/enemies/experiments/affinity-workflow-v1/candidates/final-controlled/{speciesId}/{affinity}-{version}.png'
				),
				result: z.literal(
					'assets/enemies/experiments/affinity-workflow-v1/results/final-controlled/{speciesId}-{affinity}-{version}.json'
				)
			})
			.strict(),
		successGate: z
			.object({
				requiredCompletedTargets: z.literal(24),
				requiredFirstAttemptCandidates: z.literal(20),
				requiredSpeciesRecognitions: z.literal(23),
				requiredAffinityRecognitions: z.literal(20),
				requiredNormalUnaffiliatedRecognitions: z.literal(4),
				requiredAcceptedMeaningfulAffinities: z.literal(20),
				maximumAcceptedCriticalVisualFailures: z.literal(0),
				requiresZeroWorkflowViolations: z.literal(true)
			})
			.strict()
	})
	.strict();

export type FinalControlledRerunPlan = z.infer<typeof FinalControlledRerunPlanSchema>;

export interface FinalControlledRerunArtifact {
	readonly kind: 'target' | 'assignment';
	readonly livePath: string;
	readonly value: ImageProductionTarget | ImageProductionAssignment;
}

export interface FinalControlledRerunBundle {
	readonly plan: FinalControlledRerunPlan;
	readonly targets: readonly ImageProductionTarget[];
	readonly assignments: readonly ImageProductionAssignment[];
	readonly sourceTargetIds: Readonly<Record<string, string>>;
	readonly artifacts: readonly FinalControlledRerunArtifact[];
	readonly plannedPaths: readonly string[];
}

export interface UnresolvedDesignRiskSummary {
	readonly unresolvedBlockingRiskCount: number;
	readonly unresolvedBlockingCoordinateCount: number;
	readonly unresolvedNonblockingRiskCount: number;
}

export function summarizeUnresolvedDesignRisks(
	plan: FinalControlledRerunPlan
): UnresolvedDesignRiskSummary {
	const blocking = plan.designRiskReview.risks.filter(
		(risk) => risk.severity === 'blocking' && risk.status === 'pending-informative-v1-blind-review'
	);
	return {
		unresolvedBlockingRiskCount: blocking.length,
		unresolvedBlockingCoordinateCount: new Set(blocking.map((risk) => risk.coordinate)).size,
		unresolvedNonblockingRiskCount: plan.designRiskReview.risks.filter(
			(risk) => risk.severity === 'risk' && risk.status === 'pending-informative-v1-blind-review'
		).length
	};
}

/** Mandatory guard for any future live-manifest activation path; preview preparation must not call it. */
export function assertBlockingDesignRisksResolvedForActivation(
	plan: FinalControlledRerunPlan
): void {
	const summary = summarizeUnresolvedDesignRisks(plan);
	if (
		plan.designRiskReview.activationPolicy.requiresAllBlockingRisksResolved &&
		summary.unresolvedBlockingRiskCount > 0
	) {
		throw new Error(
			`Final-controlled activation is forbidden while ${summary.unresolvedBlockingRiskCount} blocking design risks remain unresolved.`
		);
	}
}

function assertExactCoordinateSet(
	actual: readonly string[],
	expected: readonly string[],
	label: string
): void {
	if (
		actual.length !== expected.length ||
		actual.some((coordinate) => !expected.includes(coordinate))
	) {
		throw new Error(`${label} design-risk coordinates do not match the audited plan.`);
	}
}

function applyTemplate(
	template: string,
	target: FinalControlledRerunPlan['targets'][number]
): string {
	return template
		.replace('{speciesId}', target.speciesId)
		.replace('{affinity}', target.affinity)
		.replace('{version}', target.version);
}

function versionOf(targetId: string): number {
	return Number(targetId.match(/-v(\d+)$/u)?.[1] ?? 1);
}

function sourceScore(target: ImageProductionTarget): number {
	const protocolScore = {
		'canonical-v1': 0,
		'safe-frame-v2': 10,
		'safe-frame-v3': 20,
		'safe-frame-v4': 30
	}[target.promptProtocol];
	return (
		(target.authoringProtocol === 'semantic-v2' ? 1_000 : 0) +
		protocolScore +
		versionOf(target.targetId)
	);
}

function selectSourceTarget(
	sources: readonly ImageProductionTarget[],
	speciesId: FinalControlledRerunPlan['targets'][number]['speciesId'],
	affinity: FinalControlledRerunPlan['targets'][number]['affinity']
): ImageProductionTarget {
	const matches = sources
		.filter((target) => target.speciesId === speciesId && target.affinity === affinity)
		.toSorted((left, right) => {
			const score = sourceScore(right) - sourceScore(left);
			return score === 0 ? right.targetId.localeCompare(left.targetId) : score;
		});
	if (matches.length === 0)
		throw new Error(`No source target exists for ${speciesId}/${affinity}.`);
	return matches[0]!;
}

function semanticCriteria(
	source: ImageProductionTarget,
	affinity: FinalControlledRerunPlan['targets'][number]['affinity']
): readonly ImageProductionAcceptanceCriterion[] {
	const criteria = new Map(
		source.acceptanceCriteria.map((criterion) => [criterion.criterionId, criterion])
	);
	const additions: ImageProductionAcceptanceCriterion[] = [
		{
			criterionId: 'protocol-provenance',
			kind: 'objective',
			description:
				'The first submitted prompt exactly matches the declared canonical renderer and all retained source provenance is complete.',
			required: true
		},
		{
			criterionId: 'manifest-fidelity',
			kind: 'objective',
			description:
				'Every identity, anatomy, duty, equipment, reference-purpose, and prohibited-trait invariant is visibly satisfied.',
			required: true
		},
		{
			criterionId:
				affinity === 'normal' ? 'normal-unaffiliated-fidelity' : 'affinity-construction-fidelity',
			kind: 'objective',
			description:
				affinity === 'normal'
					? 'The subject reads as explicitly unaffiliated, without accidental elemental materials, glow, anatomy, or wake.'
					: 'The declared affinity visibly changes at least two listed construction dimensions rather than acting as a color or effect overlay.',
			required: true
		}
	];
	if (affinity !== 'normal') {
		additions.push({
			criterionId: 'visible-counterplay-cue',
			kind: 'objective',
			description:
				'The target-declared weak point or counterplay state is visibly readable in this still image.',
			required: true
		});
	}
	for (const criterion of additions) {
		if (!criteria.has(criterion.criterionId)) criteria.set(criterion.criterionId, criterion);
	}
	return [...criteria.values()];
}

export function buildFinalControlledRerunBundle(
	planInput: unknown,
	sourceInputs: readonly unknown[] = createAffinityWorkflowExportBundle().targets
): FinalControlledRerunBundle {
	const plan = FinalControlledRerunPlanSchema.parse(planInput);
	const sources = sourceInputs.map((target) => ImageProductionTargetSchema.parse(target));
	const keys = plan.targets.map((target) => target.key);
	const coordinates = plan.targets.map((target) => `${target.speciesId}:${target.affinity}`);
	const waves = plan.fallbackExecution.waves.flat();
	if (
		new Set(keys).size !== 24 ||
		new Set(coordinates).size !== 24 ||
		new Set(waves).size !== 24 ||
		!keys.every((key) => waves.includes(key))
	) {
		throw new Error('The plan must schedule 24 unique controlled coordinates exactly once.');
	}
	for (const target of plan.targets) {
		if (
			target.key !== `${target.speciesId}-${target.affinity}-${target.version}` ||
			target.version !== plan.speciesVersions[target.speciesId]
		) {
			throw new Error(`Plan target key/version mismatch: ${target.key}.`);
		}
	}
	const riskIds = plan.designRiskReview.risks.map((risk) => risk.riskId);
	const riskCoordinates = plan.designRiskReview.risks.map((risk) => risk.coordinate);
	if (
		new Set(riskIds).size !== riskIds.length ||
		new Set(riskCoordinates).size !== riskCoordinates.length
	) {
		throw new Error('Final-controlled design-risk IDs and coordinates must be unique.');
	}
	assertExactCoordinateSet(
		plan.designRiskReview.risks
			.filter((risk) => risk.severity === 'blocking')
			.map((risk) => risk.coordinate),
		REQUIRED_BLOCKING_DESIGN_RISK_COORDINATES,
		'Blocking'
	);
	assertExactCoordinateSet(
		plan.designRiskReview.risks
			.filter((risk) => risk.severity === 'risk')
			.map((risk) => risk.coordinate),
		REQUIRED_NONBLOCKING_DESIGN_RISK_COORDINATES,
		'Nonblocking'
	);

	const sourceTargetIds: Record<string, string> = {};
	const targets = plan.targets.map((planned) => {
		const source = selectSourceTarget(sources, planned.speciesId, planned.affinity);
		sourceTargetIds[planned.key] = source.targetId;
		const targetId = `${plan.experimentId}-${planned.key}`;
		return ImageProductionTargetSchema.parse({
			...source,
			targetId,
			assetId: targetId,
			promptProtocol: plan.promptProtocol,
			authoringProtocol: plan.authoringProtocol,
			cohort: 'controlled',
			acceptanceCriteria: semanticCriteria(source, planned.affinity),
			output: {
				candidatePath: applyTemplate(plan.plannedPathTemplates.candidate, planned),
				resultPath: applyTemplate(plan.plannedPathTemplates.result, planned)
			}
		});
	});
	const assignments = createImageProductionAssignments(targets).map((assignment) => {
		if (assignment.retryCeiling !== plan.retryCeiling || assignment.dryRun) {
			throw new Error(`Unsafe assignment policy for ${assignment.targetId}.`);
		}
		return ImageProductionAssignmentSchema.parse({
			...assignment,
			forbiddenSharedPaths: [...assignment.forbiddenSharedPaths, PLAN_PATH]
		});
	});
	for (const risk of plan.designRiskReview.risks) {
		if (sourceTargetIds[risk.coordinate] !== risk.sourceTargetId) {
			throw new Error(
				`Design-risk source target is stale for ${risk.coordinate}: expected ${sourceTargetIds[risk.coordinate]}, found ${risk.sourceTargetId}.`
			);
		}
	}
	const artifacts: FinalControlledRerunArtifact[] = plan.targets.flatMap((planned, index) => [
		{
			kind: 'target',
			livePath: applyTemplate(plan.plannedPathTemplates.target, planned),
			value: targets[index]!
		},
		{
			kind: 'assignment',
			livePath: applyTemplate(plan.plannedPathTemplates.assignment, planned),
			value: assignments[index]!
		}
	]);
	const plannedPaths = plan.targets.flatMap((target) =>
		Object.values(plan.plannedPathTemplates).map((template) => applyTemplate(template, target))
	);
	const ownedPaths = targets.flatMap((target) => [
		target.output.candidatePath,
		target.output.resultPath
	]);
	if (
		new Set(plannedPaths).size !== 96 ||
		new Set(ownedPaths).size !== 48 ||
		artifacts.some((artifact) => !plannedPaths.includes(artifact.livePath))
	) {
		throw new Error('Final controlled rerun paths are not collision-free.');
	}
	return { plan, targets, assignments, sourceTargetIds, artifacts, plannedPaths };
}

export async function readFinalControlledRerunBundle(
	workspaceRoot = process.cwd()
): Promise<FinalControlledRerunBundle> {
	const plan: unknown = JSON.parse(await readFile(path.resolve(workspaceRoot, PLAN_PATH), 'utf8'));
	return buildFinalControlledRerunBundle(plan);
}

export async function assertPlannedPathsAbsent(
	bundle: FinalControlledRerunBundle,
	workspaceRoot = process.cwd()
): Promise<void> {
	for (const plannedPath of bundle.plannedPaths) {
		const exists = await readFile(path.resolve(workspaceRoot, plannedPath)).then(
			() => true,
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return false;
				throw error;
			}
		);
		if (exists) throw new Error(`Planned final-controlled path already exists: ${plannedPath}`);
	}
}

function inside(child: string, parent: string): boolean {
	const relative = path.relative(parent, child);
	return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function assertSafePreviewRoot(previewRoot: string, workspaceRoot = process.cwd()): string {
	const resolved = path.resolve(previewRoot);
	const allowedParents = [path.resolve(tmpdir()), path.resolve(workspaceRoot, '.tmp')];
	if (
		!path.basename(resolved).startsWith(PREVIEW_PREFIX) ||
		!allowedParents.some((parent) => inside(resolved, parent))
	) {
		throw new Error(
			`Preview root must be a dedicated ${PREVIEW_PREFIX}* directory beneath the system temporary directory or ${path.resolve(workspaceRoot, '.tmp')}.`
		);
	}
	const experimentRoot = path.resolve(workspaceRoot, AFFINITY_EXPERIMENT_ROOT);
	if (resolved === experimentRoot || inside(resolved, experimentRoot)) {
		throw new Error('Preview export may not write into the live affinity experiment.');
	}
	return resolved;
}

async function jsonText(filePath: string, value: unknown): Promise<string> {
	return format(JSON.stringify(value), {
		filepath: filePath,
		parser: 'json',
		useTabs: true,
		printWidth: 100,
		trailingComma: 'none'
	});
}

export interface FinalControlledPreviewSummary {
	readonly mode: 'check' | 'preview';
	readonly targetCount: 24;
	readonly assignmentCount: 24;
	readonly manifestCount: 48;
	readonly plannedPathCount: 96;
	readonly previewRoot: string | null;
	readonly preparationOnly: true;
	readonly activationAuthorized: false;
	readonly unresolvedBlockingRiskCount: number;
	readonly unresolvedBlockingCoordinateCount: number;
	readonly unresolvedNonblockingRiskCount: number;
	readonly imageGenerationAvailable: false;
	readonly liveExperimentWrites: false;
	readonly artifacts: readonly {
		readonly kind: 'target' | 'assignment';
		readonly livePath: string;
		readonly previewPath: string | null;
		readonly canonicalSha256: string;
	}[];
}

export async function prepareFinalControlledRerun(
	options: Readonly<{
		workspaceRoot?: string;
		previewRoot?: string;
		acknowledgeNoGeneration?: boolean;
	}> = {}
): Promise<FinalControlledPreviewSummary> {
	const workspaceRoot = path.resolve(options.workspaceRoot ?? process.cwd());
	const bundle = await readFinalControlledRerunBundle(workspaceRoot);
	const riskSummary = summarizeUnresolvedDesignRisks(bundle.plan);
	if (riskSummary.unresolvedBlockingRiskCount === 0) {
		throw new Error(
			'Awaiting-review preparation must retain its audited unresolved blocking design risks.'
		);
	}
	await assertPlannedPathsAbsent(bundle, workspaceRoot);
	const previewRoot = options.previewRoot
		? assertSafePreviewRoot(options.previewRoot, workspaceRoot)
		: null;
	if (previewRoot && options.acknowledgeNoGeneration !== true) {
		throw new Error('Preview export requires --acknowledge-no-generation.');
	}
	const summaries: FinalControlledPreviewSummary['artifacts'][number][] = [];
	for (const artifact of bundle.artifacts) {
		const canonicalSha256 = createHash('sha256')
			.update(canonicalJson(artifact.value))
			.digest('hex');
		let previewPath: string | null = null;
		if (previewRoot) {
			const relative = path.relative(`${AFFINITY_EXPERIMENT_ROOT}`, artifact.livePath);
			previewPath = path.resolve(previewRoot, relative);
			const expected = await jsonText(previewPath, artifact.value);
			const current = await readFile(previewPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') return null;
				throw error;
			});
			if (current !== null && current !== expected) {
				throw new Error(`Refusing to overwrite stale preview manifest: ${previewPath}`);
			}
			if (current === null) {
				await mkdir(path.dirname(previewPath), { recursive: true });
				await writeFile(previewPath, expected, { encoding: 'utf8', flag: 'wx' });
			}
		}
		summaries.push({
			kind: artifact.kind,
			livePath: artifact.livePath,
			previewPath,
			canonicalSha256
		});
	}
	return {
		mode: previewRoot ? 'preview' : 'check',
		targetCount: 24,
		assignmentCount: 24,
		manifestCount: 48,
		plannedPathCount: 96,
		previewRoot,
		preparationOnly: true,
		activationAuthorized: false,
		...riskSummary,
		imageGenerationAvailable: false,
		liveExperimentWrites: false,
		artifacts: summaries
	};
}

function argumentValue(name: string): string | undefined {
	const index = process.argv.indexOf(name);
	return index === -1 ? undefined : process.argv[index + 1];
}

async function main(): Promise<void> {
	const allowed = new Set(['--check', '--preview-dir', '--acknowledge-no-generation']);
	for (let index = 2; index < process.argv.length; index += 1) {
		const argument = process.argv[index]!;
		if (argument === '--preview-dir') {
			index += 1;
			continue;
		}
		if (!allowed.has(argument)) throw new Error(`Unknown argument: ${argument}`);
	}
	const previewRoot = argumentValue('--preview-dir');
	if (process.argv.includes('--check') && previewRoot) {
		throw new Error('--check and --preview-dir are mutually exclusive.');
	}
	const summary = await prepareFinalControlledRerun({
		...(previewRoot ? { previewRoot } : {}),
		acknowledgeNoGeneration: process.argv.includes('--acknowledge-no-generation')
	});
	process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main();
}
