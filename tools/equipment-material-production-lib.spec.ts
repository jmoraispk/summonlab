import { describe, expect, it } from 'vitest';

import { buildEquipmentMaterialProductionManifest } from './equipment-material-production-lib.js';

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
});
