import { createHash } from 'node:crypto';
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';
import sharp from 'sharp';

import {
	AFFINITY_EXPERIMENT_ROOT,
	assignmentArtifactPath,
	createAffinityWorkflowExportBundle,
	createImageProductionAssignments,
	sha256Json,
	targetArtifactPath,
	validateAffinityWorkflowDefinitions
} from './image-production-lib.js';
import { validateAffinityWorkflowWorkspace } from './validate-affinity-workflow.js';

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
	);
});

async function writeJson(root: string, relativePath: string, value: unknown): Promise<void> {
	const filePath = path.join(root, relativePath);
	await mkdir(path.dirname(filePath), { recursive: true });
	await writeFile(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

describe('affinity workflow export tooling', () => {
	it('builds 48 immutable base and twelve versioned regression targets with collision-free assignments', () => {
		const bundle = createAffinityWorkflowExportBundle();
		const summary = validateAffinityWorkflowDefinitions(bundle.targets, bundle.assignments);

		expect(summary).toEqual({
			targetCount: 60,
			assignmentCount: 60,
			baseTargetCount: 48,
			controlledTargetCount: 24,
			breadthTargetCount: 24,
			regressionTargetCount: 12,
			uniqueOutputCount: 120
		});
		expect(new Set(bundle.assignments.map((assignment) => assignment.assignmentId))).toHaveLength(
			60
		);
		expect(bundle.assignments.every((assignment) => assignment.retryCeiling === 1)).toBe(true);
	});

	it('uses versioned artifact namespaces for regression without moving base manifests', () => {
		const bundle = createAffinityWorkflowExportBundle();
		const base = bundle.targets.find(
			(target) =>
				target.speciesId === 'elemental' &&
				target.affinity === 'normal' &&
				target.cohort === 'controlled'
		)!;
		const regression = bundle.targets.find(
			(target) =>
				target.speciesId === 'elemental' &&
				target.affinity === 'normal' &&
				target.cohort === 'regression'
		)!;
		expect(targetArtifactPath(base)).toBe(
			`${AFFINITY_EXPERIMENT_ROOT}/targets/elemental/normal.json`
		);
		expect(assignmentArtifactPath(base)).toBe(
			`${AFFINITY_EXPERIMENT_ROOT}/assignments/elemental/normal.json`
		);
		expect(targetArtifactPath(regression)).toBe(
			`${AFFINITY_EXPERIMENT_ROOT}/targets/regression/elemental/normal-v2.json`
		);
		expect(assignmentArtifactPath(regression)).toBe(
			`${AFFINITY_EXPERIMENT_ROOT}/assignments/regression/elemental/normal-v2.json`
		);
		const fireV3 = bundle.targets.find(
			(target) => target.targetId === 'affinity-workflow-v1-elemental-fire-v3'
		)!;
		expect(targetArtifactPath(fireV3)).toBe(
			`${AFFINITY_EXPERIMENT_ROOT}/targets/regression/elemental/fire-v3.json`
		);
		expect(assignmentArtifactPath(fireV3)).toBe(
			`${AFFINITY_EXPERIMENT_ROOT}/assignments/regression/elemental/fire-v3.json`
		);
	});

	it('gives image agents only their target outputs while protecting shared aggregates', () => {
		const bundle = createAffinityWorkflowExportBundle();
		const target = bundle.targets[0]!;
		const assignment = createImageProductionAssignments([target])[0]!;

		expect(assignment.permittedOutputs).toEqual(target.output);
		expect(assignment.forbiddenSharedPaths).toContain(
			`${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json`
		);
		expect(assignment.forbiddenSharedPaths).toContain(
			`${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json`
		);
		expect(Object.values(assignment.permittedOutputs)).not.toContain(
			assignment.forbiddenSharedPaths[0]
		);
	});

	it('emits deterministic schemas, manifests, audits, and orchestrator-owned scaffolds', () => {
		const bundle = createAffinityWorkflowExportBundle();
		const generated = bundle.artifacts.filter((artifact) => artifact.ownership === 'generated');
		const aggregates = bundle.artifacts.filter(
			(artifact) => artifact.ownership === 'orchestrator-aggregate'
		);

		expect(generated.filter((artifact) => artifact.path.includes('/schemas/'))).toHaveLength(9);
		expect(generated.filter((artifact) => artifact.path.includes('/targets/'))).toHaveLength(60);
		expect(generated.filter((artifact) => artifact.path.includes('/assignments/'))).toHaveLength(
			60
		);
		expect(generated.filter((artifact) => artifact.path.includes('goblin-audit-'))).toHaveLength(2);
		expect(aggregates.map((artifact) => artifact.path).sort()).toEqual(
			[
				`${AFFINITY_EXPERIMENT_ROOT}/review/blind-review.json`,
				`${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json`,
				`${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json`
			].sort()
		);
		expect(bundle.catalog.entries).toEqual([]);
		expect(bundle.blindReviews.reviews).toEqual([]);
		expect(bundle.evaluation.status).toBe('incomplete');
		expect(bundle.evaluation.controlled.targetCount).toBe(24);
	});

	it('rejects a duplicated species-affinity target even when individual schemas remain valid', () => {
		const bundle = createAffinityWorkflowExportBundle();
		const targets = bundle.targets.map((target) => structuredClone(target));
		targets[1] = structuredClone(targets[0]!);

		expect(() =>
			validateAffinityWorkflowDefinitions(targets, createImageProductionAssignments(targets))
		).toThrow(/Target IDs must be unique/u);
	});

	it('keeps breadth outputs gated as data but still preassigns collision-free paths', () => {
		const bundle = createAffinityWorkflowExportBundle();
		const breadth = bundle.targets.filter((target) => target.cohort === 'breadth');
		const paths = breadth.flatMap((target) => [
			target.output.candidatePath,
			target.output.resultPath
		]);

		expect(breadth).toHaveLength(24);
		expect(new Set(paths)).toHaveLength(48);
		expect(paths.every((outputPath) => outputPath.startsWith(AFFINITY_EXPERIMENT_ROOT))).toBe(true);
	});

	it('validates a hash-bound partial cohort with one generated result and image', async () => {
		const root = await mkdtemp(path.join(tmpdir(), 'summonlab-affinity-validator-'));
		temporaryRoots.push(root);
		const bundle = createAffinityWorkflowExportBundle();
		for (const artifact of bundle.artifacts) await writeJson(root, artifact.path, artifact.value);
		for (const relativePath of [
			`${AFFINITY_EXPERIMENT_ROOT}/targets/goblin/normal.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/dry-runs/goblin-normal-assignment-v1.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/dry-runs/goblin-normal-envelope-preflight-v5.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/review/wave-plans/pilot-current-task-capacity-v1.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/review/wave-plans/exact-concurrency-final-and-breadth-v1.json`,
			`${AFFINITY_EXPERIMENT_ROOT}/wave-runs/pilot-current-task-capacity-v1/preflight.json`
		]) {
			const destination = path.join(root, relativePath);
			await mkdir(path.dirname(destination), { recursive: true });
			await copyFile(path.join(process.cwd(), relativePath), destination);
		}
		await cp(
			path.join(process.cwd(), 'skills/summonlab-image-production'),
			path.join(root, 'skills/summonlab-image-production'),
			{ recursive: true }
		);
		const references = new Set(
			bundle.targets.flatMap((target) => target.references.map((entry) => entry.path))
		);
		for (const reference of references) {
			const destination = path.join(root, reference);
			await mkdir(path.dirname(destination), { recursive: true });
			await copyFile(path.join(process.cwd(), reference), destination);
		}
		const referencedCandidateTargets = bundle.targets.filter((candidate) =>
			references.has(candidate.output.candidatePath)
		);
		for (const referencedTarget of referencedCandidateTargets) {
			const destination = path.join(root, referencedTarget.output.resultPath);
			await mkdir(path.dirname(destination), { recursive: true });
			await copyFile(path.join(process.cwd(), referencedTarget.output.resultPath), destination);
		}

		const target = bundle.targets.find(
			(candidate) => candidate.speciesId === 'death-knight' && candidate.affinity === 'fire'
		)!;
		const assignment = bundle.assignments.find(
			(candidate) => candidate.targetId === target.targetId
		)!;
		const image = await sharp({
			create: { width: 1536, height: 1024, channels: 3, background: '#20242b' }
		})
			.png()
			.toBuffer();
		const imageHash = createHash('sha256').update(image).digest('hex');
		await mkdir(path.dirname(path.join(root, target.output.candidatePath)), { recursive: true });
		await writeFile(path.join(root, target.output.candidatePath), image);
		const fixturePrompt = 'Fixture prompt retained exactly for validator coverage.';
		const result = {
			schemaVersion: 'image-production-result-v1' as const,
			resultId: `result-${target.targetId}`,
			targetId: target.targetId,
			assignmentId: assignment.assignmentId,
			skillVersion: assignment.skillVersion,
			status: 'candidate' as const,
			attempts: [
				{
					attemptId: `${target.targetId}-attempt-1`,
					attemptNumber: 1,
					precedingAttemptId: null,
					conclusion: 'accepted-by-producer' as const,
					exactPrompt: fixturePrompt,
					promptHash: createHash('sha256').update(fixturePrompt).digest('hex'),
					referenceInputs: target.references.map(({ path: referencePath, contentHash }) => ({
						path: referencePath,
						contentHash
					})),
					requestStartedAt: '2026-08-29T17:00:00.000Z',
					generationCompletedAt: '2026-08-29T17:00:30.000Z',
					inspectionCompletedAt: '2026-08-29T17:00:40.000Z',
					generationDurationMs: 30_000,
					inspectionDurationMs: 10_000,
					totalWallTimeMs: 40_000,
					sourceOutputId: 'fixture-output-1',
					persistence: {
						operation: 'exclusive-copy' as const,
						elapsedMs: 25,
						source: {
							path: '/tmp/fixture-output-1.png',
							mediaType: 'image/png',
							width: 1536,
							height: 1024,
							bytes: image.byteLength,
							contentHash: imageHash
						},
						retained: {
							path: target.output.candidatePath,
							mediaType: 'image/png' as const,
							width: 1536,
							height: 1024,
							bytes: image.byteLength,
							contentHash: imageHash
						}
					},
					output: {
						path: target.output.candidatePath,
						mediaType: 'image/png' as const,
						width: 1536,
						height: 1024,
						bytes: image.byteLength,
						contentHash: imageHash
					},
					findings: [
						{
							criterionId: 'complete-safe-frame',
							category: 'framing' as const,
							evaluator: 'automated' as const,
							outcome: 'pass' as const,
							observation: 'Fixture dimensions and output boundary are complete.'
						},
						{
							criterionId: 'single-finished-subject',
							category: 'canvas-completion' as const,
							evaluator: 'automated' as const,
							outcome: 'pass' as const,
							observation: 'Fixture contains one complete image across the declared canvas.'
						}
					],
					retryReason: null
				}
			],
			selectedAttemptId: `${target.targetId}-attempt-1`,
			failedCriteria: [],
			startedAt: '2026-08-29T17:00:00.000Z',
			completedAt: '2026-08-29T17:00:40.000Z',
			totalWallTimeMs: 40_000,
			writtenOutputPaths: [target.output.candidatePath, target.output.resultPath],
			noSharedFilesEdited: true as const,
			selfPromoted: false as const
		};
		await writeJson(root, target.output.resultPath, result);
		const catalog = {
			...bundle.catalog,
			entries: [
				{
					targetId: target.targetId,
					resultId: result.resultId,
					assignmentId: assignment.assignmentId,
					speciesId: target.speciesId,
					affinity: target.affinity,
					cohort: target.cohort,
					status: 'candidate' as const,
					candidatePath: target.output.candidatePath,
					candidateHash: imageHash,
					reviewState: 'pending' as const,
					promoted: false as const
				}
			]
		};
		await writeJson(root, `${AFFINITY_EXPERIMENT_ROOT}/review/catalog.json`, catalog);
		await writeJson(root, `${AFFINITY_EXPERIMENT_ROOT}/review/evaluation.json`, {
			...bundle.evaluation,
			catalogHash: sha256Json(catalog),
			controlled: { ...bundle.evaluation.controlled, firstAttemptCandidateCount: 1 },
			workflow: {
				...bundle.evaluation.workflow,
				completedTargetCount: 1,
				completeProvenanceCount: 1
			}
		});

		await expect(validateAffinityWorkflowWorkspace(root)).resolves.toMatchObject({
			targets: 60,
			assignments: 60,
			results: referencedCandidateTargets.length + 1,
			images: referencedCandidateTargets.length + 1,
			catalogEntries: 1,
			capacityPreflight: true,
			concurrencyAllocation: true,
			evaluationStatus: 'incomplete'
		});

		const planPath = `${AFFINITY_EXPERIMENT_ROOT}/review/final-controlled-rerun-plan.json`;
		const plan = JSON.parse(await readFile(path.join(root, planPath), 'utf8')) as {
			designRiskReview: {
				risks: { coordinate: string; severity: 'blocking' | 'risk' }[];
			};
		};
		const windBearRisk = plan.designRiskReview.risks.find(
			(risk) => risk.coordinate === 'cave-bear-wind-v3'
		)!;
		windBearRisk.severity = 'risk';
		await writeJson(root, planPath, plan);
		await expect(validateAffinityWorkflowWorkspace(root)).rejects.toThrow(
			'Blocking design-risk coordinates do not match the audited plan'
		);
	});
});
