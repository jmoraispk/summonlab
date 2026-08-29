import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
	ImageProductionAssignmentSchema,
	ImageProductionTargetSchema
} from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import {
	assertBlockingDesignRisksResolvedForActivation,
	assertSafePreviewRoot,
	buildFinalControlledRerunBundle,
	prepareFinalControlledRerun,
	readFinalControlledRerunBundle
} from './prepare-final-controlled-rerun.js';

describe('final controlled rerun preparation', () => {
	it('derives 24 final-protocol targets and collision-free assignments from the guarded plan', async () => {
		const bundle = await readFinalControlledRerunBundle();
		expect(bundle.plan.designRiskReview).toMatchObject({
			status: 'pending-informative-v1-blind-review',
			activationPolicy: {
				requiresAllBlockingRisksResolved: true,
				prohibitsActivationWhileBlockingRiskPending: true
			}
		});
		expect(bundle.plan.designRiskReview.risks).toHaveLength(16);
		expect(
			bundle.plan.designRiskReview.risks.filter((risk) => risk.severity === 'blocking')
		).toHaveLength(8);
		expect(bundle.targets).toHaveLength(24);
		expect(bundle.assignments).toHaveLength(24);
		expect(bundle.artifacts).toHaveLength(48);
		expect(new Set(bundle.plannedPaths)).toHaveLength(96);
		expect(
			new Set(bundle.targets.map((target) => `${target.speciesId}:${target.affinity}`))
		).toHaveLength(24);
		for (const target of bundle.targets) {
			expect(() => ImageProductionTargetSchema.parse(target)).not.toThrow();
			expect(target.promptProtocol).toBe('safe-frame-v4');
			expect(target.authoringProtocol).toBe('semantic-v2');
			expect(target.cohort).toBe('controlled');
			expect(target.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
				'protocol-provenance'
			);
			expect(target.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
				'manifest-fidelity'
			);
			expect(target.acceptanceCriteria.map((criterion) => criterion.criterionId)).toContain(
				target.affinity === 'normal'
					? 'normal-unaffiliated-fidelity'
					: 'affinity-construction-fidelity'
			);
		}
		for (const assignment of bundle.assignments) {
			expect(() => ImageProductionAssignmentSchema.parse(assignment)).not.toThrow();
			expect(assignment.retryCeiling).toBe(1);
			expect(assignment.dryRun).toBe(false);
			expect(assignment.forbiddenSharedPaths).toContain(
				'assets/enemies/experiments/affinity-workflow-v1/review/final-controlled-rerun-plan.json'
			);
			expect(assignment.permittedOutputs).toEqual(
				bundle.targets.find((target) => target.targetId === assignment.targetId)?.output
			);
		}
		expect(bundle.sourceTargetIds['elemental-normal-v4']).toMatch(/elemental-normal-v2$/u);
		expect(bundle.sourceTargetIds['death-knight-metal-v4']).toMatch(/death-knight-metal-v3$/u);
	});

	it('forbids any future activation while audited blocking risks remain pending', async () => {
		const plan = (await readFinalControlledRerunBundle()).plan;
		expect(() => assertBlockingDesignRisksResolvedForActivation(plan)).toThrow(
			'Final-controlled activation is forbidden while 8 blocking design risks remain unresolved'
		);
	});

	it('rejects a target version that does not match the species version', async () => {
		const plan = (await readFinalControlledRerunBundle()).plan;
		const malformed = structuredClone(plan) as unknown as {
			targets: { key: string; version: string }[];
		};
		malformed.targets[0]!.version = 'v3';
		expect(() => buildFinalControlledRerunBundle(malformed)).toThrow();
	});

	it('rejects removal or reclassification of an audited blocking design risk', async () => {
		const plan = structuredClone((await readFinalControlledRerunBundle()).plan);
		const risk = plan.designRiskReview.risks.find(
			(candidate) => candidate.coordinate === 'cave-bear-wind-v3'
		)!;
		(risk as { severity: 'blocking' | 'risk' }).severity = 'risk';
		expect(() => buildFinalControlledRerunBundle(plan)).toThrow(
			'Blocking design-risk coordinates do not match the audited plan'
		);
	});

	it('rejects stale source ownership in the plan-owned risk review', async () => {
		const plan = structuredClone((await readFinalControlledRerunBundle()).plan);
		const risk = plan.designRiskReview.risks.find(
			(candidate) => candidate.coordinate === 'death-knight-metal-v4'
		)!;
		(risk as { sourceTargetId: string }).sourceTargetId =
			'affinity-workflow-v1-death-knight-metal-v2';
		expect(() => buildFinalControlledRerunBundle(plan)).toThrow(
			'Design-risk source target is stale for death-knight-metal-v4'
		);
	});

	it('writes deterministic preview-only manifests and refuses a stale preview collision', async () => {
		const previewRoot = await mkdtemp(path.join(tmpdir(), 'affinity-final-controlled-rerun-'));
		try {
			await expect(
				prepareFinalControlledRerun({ previewRoot, acknowledgeNoGeneration: false })
			).rejects.toThrow('acknowledge-no-generation');
			const first = await prepareFinalControlledRerun({
				previewRoot,
				acknowledgeNoGeneration: true
			});
			const second = await prepareFinalControlledRerun({
				previewRoot,
				acknowledgeNoGeneration: true
			});
			expect(first.mode).toBe('preview');
			expect(first.preparationOnly).toBe(true);
			expect(first.activationAuthorized).toBe(false);
			expect(first.unresolvedBlockingRiskCount).toBe(8);
			expect(first.unresolvedBlockingCoordinateCount).toBe(8);
			expect(first.unresolvedNonblockingRiskCount).toBe(8);
			expect(first.imageGenerationAvailable).toBe(false);
			expect(first.liveExperimentWrites).toBe(false);
			expect(second.artifacts).toEqual(first.artifacts);
			const targetArtifact = first.artifacts.find((artifact) => artifact.kind === 'target')!;
			const target = ImageProductionTargetSchema.parse(
				JSON.parse(await readFile(targetArtifact.previewPath!, 'utf8'))
			);
			expect(target.promptProtocol).toBe('safe-frame-v4');
			await writeFile(targetArtifact.previewPath!, '{}\n', 'utf8');
			await expect(
				prepareFinalControlledRerun({ previewRoot, acknowledgeNoGeneration: true })
			).rejects.toThrow('Refusing to overwrite stale preview manifest');
		} finally {
			await rm(previewRoot, { recursive: true, force: true });
		}
	});

	it('rejects preview roots that could touch the live experiment or arbitrary workspace files', () => {
		expect(() =>
			assertSafePreviewRoot(
				'assets/enemies/experiments/affinity-workflow-v1/affinity-final-controlled-rerun-live'
			)
		).toThrow('Preview root must be');
		expect(() => assertSafePreviewRoot('tools/affinity-final-controlled-rerun-preview')).toThrow(
			'Preview root must be'
		);
	});
});
