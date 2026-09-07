import { describe, expect, it } from 'vitest';

import {
	expectedApprovedHeroVisualPath,
	findApprovedHeroPathViolations,
	findRetainedEnemyPackPathViolations,
	findRepositoryAssetPathViolations,
	validateRepositoryAssets
} from './repository-asset-policy.js';

describe('repository asset retention policy', () => {
	it('rejects tracked hero experiments and Python bytecode', () => {
		expect(
			findRepositoryAssetPathViolations([
				'assets/heroes/approved/summonable-roster-v1/catalog.json',
				'assets/heroes/experiments/run-001/candidates/hero.png',
				'tools/__pycache__/asset.cpython-312.pyc',
				'tools/build.pyc'
			])
		).toEqual([
			'Hero experiment output must not be tracked: assets/heroes/experiments/run-001/candidates/hero.png',
			'Python cache output must not be tracked: tools/__pycache__/asset.cpython-312.pyc',
			'Python cache output must not be tracked: tools/build.pyc'
		]);
	});

	it('rejects retired production rasters and standalone review galleries', () => {
		expect(
			findRepositoryAssetPathViolations([
				'assets/enemies/experiments/family-affinity-v1/bridge/candidates/cave-bear/earth-v2.png',
				'assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/normal-v1.png',
				'assets/equipment/experiments/material-equipment-v1/candidates/f/bronze/sword-v1.png',
				'assets/equipment/experiments/material-equipment-v1/manifest.json',
				'assets/equipment/experiments/material-equipment-v2/candidates/f/bronze/sword-v2.png',
				'assets/equipment/experiments/material-equipment-v3/candidates/f/bronze/sword-v3.png',
				'assets/equipment/experiments/material-equipment-v3/revisions/material-equipment-v3-bronze-axe-v3/attempt-2/candidate.png',
				'assets/equipment/experiments/material-equipment-v3/reviews/checkpoint-3-final/index.html',
				'docs/evidence/enemy-image-review-gallery-v1/index.html',
				'docs/evidence/enemy-image-review-gallery-v1/owner-acceptance.md'
			])
		).toEqual([
			'Family-affinity bridge raster must not be tracked: assets/enemies/experiments/family-affinity-v1/bridge/candidates/cave-bear/earth-v2.png',
			'Fauna experiment candidate raster must not be tracked: assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-grey-wolf/normal-v1.png',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v1/candidates/f/bronze/sword-v1.png',
			'Superseded Equipment campaign path must not be tracked: assets/equipment/experiments/material-equipment-v1/manifest.json',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v2/candidates/f/bronze/sword-v2.png',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v3/candidates/f/bronze/sword-v3.png',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v3/revisions/material-equipment-v3-bronze-axe-v3/attempt-2/candidate.png',
			'Equipment review artifact must not be tracked: assets/equipment/experiments/material-equipment-v3/reviews/checkpoint-3-final/index.html',
			'Standalone family-affinity review gallery must not be tracked: docs/evidence/enemy-image-review-gallery-v1/index.html'
		]);
	});

	it('defines stable approved paths for both hero visual roles', () => {
		expect(expectedApprovedHeroVisualPath('aear-soro', 'summon')).toBe(
			'assets/heroes/approved/summonable-roster-v1/sources/aear-soro/summon.png'
		);
		expect(expectedApprovedHeroVisualPath('aear-soro', 'combat-chibi')).toBe(
			'assets/heroes/approved/summonable-roster-v1/sources/aear-soro/combat-chibi.png'
		);
	});

	it('rejects unstable and duplicate approved hero paths', () => {
		expect(
			findApprovedHeroPathViolations([
				{
					heroId: 'aear-soro',
					summon: expectedApprovedHeroVisualPath('aear-soro', 'summon'),
					combatChibi: expectedApprovedHeroVisualPath('aear-soro', 'combat-chibi')
				},
				{
					heroId: 'kelu-grelun',
					summon: 'assets/heroes/experiments/run-001/kelu-grelun.png',
					combatChibi: expectedApprovedHeroVisualPath('aear-soro', 'combat-chibi')
				}
			])
		).toEqual([
			'Approved summon path is not canonical for kelu-grelun: assets/heroes/experiments/run-001/kelu-grelun.png',
			'Approved combat-chibi path is not canonical for kelu-grelun: assets/heroes/approved/summonable-roster-v1/sources/aear-soro/combat-chibi.png',
			'Duplicate approved hero path: assets/heroes/approved/summonable-roster-v1/sources/aear-soro/combat-chibi.png'
		]);
	});

	it('rejects incomplete or contaminated retained enemy candidate roots', () => {
		const expansionRoot = 'assets/enemies/experiments/affinity-expansion-v1/candidates';
		const workflowRoot = 'assets/enemies/experiments/affinity-workflow-v1/candidates';
		const selected = [
			`${expansionRoot}/wolf/normal-v1.png`,
			`${expansionRoot}/wolf/normal-v1.png`,
			`${workflowRoot}/bear/fire-v1.png`,
			'assets/enemies/experiments/other/candidates/slime/water-v1.png'
		];
		const tracked = [`${workflowRoot}/bear/fire-v1.png`, `${expansionRoot}/wolf/fire-v1.png`];

		expect(
			findRetainedEnemyPackPathViolations({
				candidateRoots: [expansionRoot, workflowRoot],
				selectedPaths: selected,
				trackedPngPaths: tracked
			})
		).toEqual([
			`Duplicate retained enemy candidate: ${expansionRoot}/wolf/normal-v1.png`,
			'Retained enemy candidate is outside declared roots: assets/enemies/experiments/other/candidates/slime/water-v1.png',
			`Retained enemy candidate is not tracked: ${expansionRoot}/wolf/normal-v1.png`,
			`Unselected enemy candidate must not be tracked: ${expansionRoot}/wolf/fire-v1.png`
		]);
	});

	it('protects the complete canonical family-affinity pack with Git LFS', async () => {
		await expect(validateRepositoryAssets(process.cwd())).resolves.toMatchObject({
			approvedFaunaImageCount: 200,
			approvedFaunaBytes: 560_162_021,
			approvedEquipmentImageCount: 161,
			approvedEquipmentBytes: 224_157_513,
			retainedFamilyAffinityImageCount: 750,
			retainedFamilyAffinityBytes: 2_078_754_623
		});
	}, 120_000);
});
