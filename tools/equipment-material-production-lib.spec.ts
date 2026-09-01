import { describe, expect, it } from 'vitest';

import {
	buildEquipmentMaterialAllocationPlan,
	buildEquipmentMaterialProductionManifest
} from './equipment-material-production-lib.js';

describe('Equipment material production manifest', () => {
	it('builds the approved 161-target matrix with collision-safe armour dependencies', () => {
		const manifest = buildEquipmentMaterialProductionManifest();

		expect(manifest.schemaVersion).toBe('equipment-material-production-manifest-v1');
		expect(manifest.productionId).toBe('material-equipment-v1');
		expect(manifest.status).toBe('planning');
		expect(manifest.armourPieceOrder).toEqual(['head', 'torso', 'legs', 'boots']);
		expect(manifest.summary).toEqual({
			materialCount: 28,
			targetCount: 161,
			isolatedItemImageCount: 140,
			fullSetConsistencyImageCount: 21,
			imagesPerRank: 23,
			imageCountByMaterialFamily: {
				metal: 77,
				wood: 14,
				'hide-scale': 35,
				'cloth-fibre': 35
			}
		});
		expect(manifest.materials).toHaveLength(28);
		expect(manifest.targets).toHaveLength(161);

		const targetIds = manifest.targets.map((target) => target.targetId);
		const candidatePaths = manifest.targets.map((target) => target.output.candidatePath);
		const resultPaths = manifest.targets.map((target) => target.output.provenanceResultPath);
		const reviewPaths = manifest.targets.map((target) => target.output.reviewEvidencePath);
		expect(new Set(targetIds).size).toBe(161);
		expect(new Set(candidatePaths).size).toBe(161);
		expect(new Set(resultPaths).size).toBe(161);
		expect(new Set(reviewPaths).size).toBe(161);
		expect(
			[...candidatePaths, ...resultPaths, ...reviewPaths].every((value) =>
				value.startsWith('assets/equipment/experiments/material-equipment-v1/')
			)
		).toBe(true);
		expect(manifest.targets.every((target) => target.status === 'planned')).toBe(true);

		const setSources = manifest.targets.filter((target) => target.artifactRole === 'set-source');
		expect(setSources).toHaveLength(21);
		for (const source of setSources) {
			const sourceIndex = manifest.targets.findIndex(
				(candidate) => candidate.targetId === source.targetId
			);
			const sequence = manifest.targets.slice(sourceIndex, sourceIndex + 5);
			expect(sequence.map((target) => target.artifactRole)).toEqual([
				'set-source',
				'item',
				'item',
				'item',
				'item'
			]);
			expect(sequence.map((target) => target.slot)).toEqual([
				null,
				'head',
				'torso',
				'legs',
				'boots'
			]);
			expect(sequence.slice(1).map((target) => target.dependsOnTargetId)).toEqual([
				source.targetId,
				source.targetId,
				source.targetId,
				source.targetId
			]);
			expect(sequence.every((target) => target.setId === source.setId)).toBe(true);
			expect(sequence.every((target) => target.materialId === source.materialId)).toBe(true);
		}

		expect(manifest.lifecycle).toEqual({
			pieceGenerationRequiresReviewedSetSource: true,
			candidateDoesNotMeanApproved: true,
			approvedAndRuntimePathsReserved: false
		});
	});

	it('encodes one non-executable allocation across all 161 jobs', () => {
		const plan = buildEquipmentMaterialAllocationPlan();

		expect(plan.schemaVersion).toBe('equipment-material-allocation-plan-v1');
		expect(plan.planId).toBe('material-equipment-v1-full-production-allocation');
		expect(plan.artifactRole).toBe('non-executable-allocation-template');
		expect(plan.status).toBe('gated');
		expect(plan.schedulerIntent).toEqual({
			mode: 'dependency-aware-ready-queue',
			logicalProductionRunCount: 1,
			configuredMaximumConcurrency: 16,
			reservedOrchestratorSlots: 1,
			admissionFormula:
				'max(0, min(configuredMaximumConcurrency, effectiveTaskSlots - reservedOrchestratorSlots))',
			capacityProbeCeilings: [2, 4, 8, 12, 16],
			technicalFailureCircuitBreaker: {
				failureCountPerEpoch: 3,
				action: 'stop-new-starts-drain-active-resume-with-backoff',
				synchronousRetry: false
			}
		});
		expect(plan.summary).toEqual({
			jobCount: 161,
			initiallyReadyJobCount: 77,
			armourPieceJobCount: 84,
			armourReviewGateCount: 21
		});
		expect(plan.jobs).toHaveLength(161);
		expect(plan.reviewGates).toHaveLength(21);

		const sword = plan.jobs.find((job) => job.targetId === 'material-equipment-v1-copper-sword-v1');
		expect(sword).toMatchObject({
			phase: 'independent',
			prerequisiteReviewGateId: null,
			permittedOutputs: {
				candidatePath:
					'assets/equipment/experiments/material-equipment-v1/candidates/f/copper/sword-v1.png',
				provenanceResultPath:
					'assets/equipment/experiments/material-equipment-v1/results/f/copper/sword-v1.json'
			}
		});

		const head = plan.jobs.find(
			(job) => job.targetId === 'material-equipment-v1-copper-heavy-armour-head-v1'
		);
		expect(head).toMatchObject({
			phase: 'armour-piece',
			consistencySourceTargetId: 'material-equipment-v1-copper-heavy-armour-full-set-v1',
			executionEnvelopeMaterialization: 'after-review-receipt-hash-is-known',
			prerequisiteReviewGateId: 'material-equipment-v1-copper-heavy-armour-full-set-v1-review-pass'
		});
		expect(plan.reviewGates[0]).toEqual({
			gateId: 'material-equipment-v1-copper-heavy-armour-full-set-v1-review-pass',
			sourceTargetId: 'material-equipment-v1-copper-heavy-armour-full-set-v1',
			initialStatus: 'pending',
			acceptanceRequirement: 'human-accepted-hash-bound-source-receipt',
			fileExistenceDoesNotPass: true,
			receiptSchemaRequiredBeforeActivation: 'equipment-armour-source-review-receipt-v1',
			evidencePath:
				'assets/equipment/experiments/material-equipment-v1/reviews/f/copper/heavy-armour-full-set-v1.json',
			unlocksTargetIds: [
				'material-equipment-v1-copper-heavy-armour-head-v1',
				'material-equipment-v1-copper-heavy-armour-torso-v1',
				'material-equipment-v1-copper-heavy-armour-legs-v1',
				'material-equipment-v1-copper-heavy-armour-boots-v1'
			]
		});

		const jobIds = plan.jobs.map((job) => job.jobId);
		const ownedPaths = plan.jobs.flatMap((job) => [
			...Object.values(job.permittedOutputs),
			job.reviewEvidencePath
		]);
		expect(new Set(jobIds).size).toBe(161);
		expect(new Set(ownedPaths).size).toBe(483);
		expect(plan.jobs.every((job) => job.synchronousRetryCeiling === 0)).toBe(true);
		expect(plan.ownership).toMatchObject({
			workerOwnedOutputKinds: ['candidate', 'provenance-result'],
			reviewerOwnedOutputKinds: ['review-evidence'],
			exclusiveCreateRequired: true
		});
		expect(plan.activation).toEqual({
			includedInTemplate: false,
			requiresSeparateHashBoundAuthorization: true,
			requiresRunSpecificImmutableCopy: true,
			prerequisites: [
				'approved-equipment-visual-profile',
				'equipment-job-runner-with-strict-schema-reader',
				'equipment-armour-source-review-receipt-schema',
				'run-specific-immutable-plan-and-journal',
				'provider-capacity-verification'
			]
		});
	});
});
