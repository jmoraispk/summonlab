import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildEquipmentMaterialProductionManifest } from './equipment-material-production-lib.js';
import {
	EQUIPMENT_V2_ALLOCATION_PLAN_PATH,
	EQUIPMENT_V2_MANIFEST_PATH,
	EQUIPMENT_V2_PRODUCTION_ROOT,
	buildEquipmentMaterialAllocationPlanV2,
	buildEquipmentMaterialProductionManifestV2,
	serializeEquipmentMaterialAllocationPlanV2,
	serializeEquipmentMaterialProductionManifestV2
} from './equipment-material-production-v2.js';

describe('Equipment material production v2 planning', () => {
	it('builds the locked 161-target vocabulary in an isolated v2 namespace', () => {
		const manifest = buildEquipmentMaterialProductionManifestV2();

		expect(manifest.productionId).toBe('material-equipment-v2');
		expect(manifest.schemaVersion).toBe('equipment-material-production-manifest-v2');
		expect(manifest.status).toBe('planning');
		expect(manifest.summary).toMatchObject({
			materialCount: 28,
			targetCount: 161,
			isolatedItemImageCount: 140,
			fullSetConsistencyImageCount: 21,
			imagesPerRank: 23
		});
		expect(manifest.revision).toMatchObject({
			previousProductionId: 'material-equipment-v1',
			previousEvidenceIsImmutable: true,
			lockedVocabulary: ['Bronze', 'Ash', 'Hard Leather'],
			standardAxeVariant: 'single-bit',
			deferredAxeVariants: ['double-bit']
		});
		expect(
			manifest.materials
				.filter(({ rank }) => rank === 'F')
				.map(({ materialId, displayName }) => [materialId, displayName])
		).toEqual([
			['bronze', 'Bronze'],
			['ash', 'Ash'],
			['coarse-hide', 'Coarse Hide'],
			['hemp-weave', 'Hemp Weave']
		]);
		expect(manifest.materials).toContainEqual({
			materialId: 'hard-leather',
			displayName: 'Hard Leather',
			family: 'hide-scale',
			rank: 'E'
		});
		expect(manifest.materials.map(({ displayName }) => String(displayName))).not.toContain('Oak');
		expect(manifest.materials.map(({ materialId }) => String(materialId))).not.toContain('copper');
		expect(manifest.materials.map(({ materialId }) => String(materialId))).not.toContain(
			'boiled-leather'
		);

		const ids = manifest.targets.map(({ targetId }) => targetId);
		const paths = manifest.targets.flatMap(({ output }) => Object.values(output));
		expect(new Set(ids).size).toBe(161);
		expect(new Set(paths).size).toBe(483);
		expect(ids.every((id) => id.startsWith('material-equipment-v2-') && id.endsWith('-v2'))).toBe(
			true
		);
		expect(paths.every((path) => path.startsWith(`${EQUIPMENT_V2_PRODUCTION_ROOT}/`))).toBe(true);
	});

	it('preserves full-set-first dependencies and the 77/84/21 gate matrix', () => {
		const manifest = buildEquipmentMaterialProductionManifestV2();
		const allocation = buildEquipmentMaterialAllocationPlanV2();
		const sources = manifest.targets.filter(({ artifactRole }) => artifactRole === 'set-source');

		expect(sources).toHaveLength(21);
		for (const source of sources) {
			const index = manifest.targets.indexOf(source);
			const sequence = manifest.targets.slice(index, index + 5);
			expect(sequence.map(({ slot }) => slot)).toEqual([null, 'head', 'torso', 'legs', 'boots']);
			expect(
				sequence.slice(1).every(({ dependsOnTargetId }) => dependsOnTargetId === source.targetId)
			).toBe(true);
		}

		expect(allocation.summary).toEqual({
			jobCount: 161,
			initiallyReadyJobCount: 77,
			armourPieceJobCount: 84,
			armourReviewGateCount: 21
		});
		expect(allocation.artifactRole).toBe('non-executable-allocation-template');
		expect(allocation.schemaVersion).toBe('equipment-material-allocation-plan-v2');
		expect(allocation.activation).toMatchObject({
			includedInTemplate: false,
			currentRunnerCompatible: false,
			requiresSeparateHashBoundAuthorization: true
		});
		expect(allocation.ownership.root).toBe(EQUIPMENT_V2_PRODUCTION_ROOT);
		expect(allocation.ownership.forbiddenSharedPaths).toContain(
			'assets/equipment/experiments/material-equipment-v1'
		);
		expect(
			allocation.reviewGates.every(({ unlocksTargetIds }) => unlocksTargetIds.length === 4)
		).toBe(true);
	});

	it('has no target-ID or reserved-path collision with immutable v1', () => {
		const v1 = buildEquipmentMaterialProductionManifest();
		const v2 = buildEquipmentMaterialProductionManifestV2();
		const v1Ids = new Set(v1.targets.map(({ targetId }) => targetId));
		const v1Paths = new Set(v1.targets.flatMap(({ output }) => Object.values(output)));

		expect(v2.targets.some(({ targetId }) => v1Ids.has(targetId))).toBe(false);
		expect(
			v2.targets.some(({ output }) => Object.values(output).some((path) => v1Paths.has(path)))
		).toBe(false);
	});

	it('matches the checked-in deterministic artifacts exactly', () => {
		expect(readFileSync(EQUIPMENT_V2_MANIFEST_PATH, 'utf8')).toBe(
			serializeEquipmentMaterialProductionManifestV2()
		);
		expect(readFileSync(EQUIPMENT_V2_ALLOCATION_PLAN_PATH, 'utf8')).toBe(
			serializeEquipmentMaterialAllocationPlanV2()
		);
	});
});
