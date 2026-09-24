import { describe, expect, it } from 'vitest';

import {
	expectedApprovedHeroVisualPath,
	findApprovedHeroPathViolations,
	findRetainedEnemyPackPathViolations,
	findRepositoryAssetPathViolations,
	findSkillPngLfsViolations,
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
				'assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-gray-wolf/normal-v1.png',
				'assets/equipment/experiments/material-equipment-v1/candidates/f/bronze/sword-v1.png',
				'assets/equipment/experiments/material-equipment-v1/manifest.json',
				'assets/equipment/experiments/material-equipment-v2/candidates/f/bronze/sword-v2.png',
				'assets/equipment/experiments/material-equipment-v3/candidates/f/bronze/sword-v3.png',
				'assets/equipment/experiments/material-equipment-v3/revisions/material-equipment-v3-bronze-axe-v3/attempt-2/candidate.png',
				'assets/equipment/experiments/material-equipment-v3/reviews/checkpoint-3-final/index.html',
				'assets/equipment/experiments/two-handed-greatsword-v1/candidates/f/bronze/greatsword-v1.png',
				'assets/equipment/experiments/two-handed-greatsword-v1/direction/revisions/greatsword-metal-ranks-v2-attempt-1.png',
				'assets/equipment/experiments/two-handed-greatsword-v1/reviews/items/index.html',
				'docs/evidence/enemy-image-review-gallery-v1/index.html',
				'docs/evidence/enemy-image-review-gallery-v1/owner-acceptance.md'
			])
		).toEqual([
			'Family-affinity bridge raster must not be tracked: assets/enemies/experiments/family-affinity-v1/bridge/candidates/cave-bear/earth-v2.png',
			'Fauna experiment candidate raster must not be tracked: assets/enemies/experiments/fauna-family-v1/candidates/wolves/wolf-gray-wolf/normal-v1.png',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v1/candidates/f/bronze/sword-v1.png',
			'Superseded Equipment campaign path must not be tracked: assets/equipment/experiments/material-equipment-v1/manifest.json',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v2/candidates/f/bronze/sword-v2.png',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v3/candidates/f/bronze/sword-v3.png',
			'Equipment production raster must not be tracked: assets/equipment/experiments/material-equipment-v3/revisions/material-equipment-v3-bronze-axe-v3/attempt-2/candidate.png',
			'Equipment review artifact must not be tracked: assets/equipment/experiments/material-equipment-v3/reviews/checkpoint-3-final/index.html',
			'Greatsword candidate raster must not be tracked: assets/equipment/experiments/two-handed-greatsword-v1/candidates/f/bronze/greatsword-v1.png',
			'Greatsword superseded direction raster must not be tracked: assets/equipment/experiments/two-handed-greatsword-v1/direction/revisions/greatsword-metal-ranks-v2-attempt-1.png',
			'Greatsword review artifact must not be tracked: assets/equipment/experiments/two-handed-greatsword-v1/reviews/items/index.html',
			'Standalone family-affinity review gallery must not be tracked: docs/evidence/enemy-image-review-gallery-v1/index.html'
		]);
	});

	it('rejects retired hero Forge, experiment, and superseded animation paths', () => {
		expect(
			findRepositoryAssetPathViolations([
				'assets/heroes/visuals/forge-v1/kavi-garo-anchor-v1.webp',
				'assets/heroes/visuals/forge-v2/catalog.json',
				'assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png',
				'assets/heroes/visuals/catalog.json',
				'assets/heroes/visuals/hearth-roster-pair-v1.png',
				'assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/asha-motion-sheet-source-v1.png',
				'apps/web/static/runtime/visual-catalog-v1/manifest.json',
				'apps/web/src/routes/forge/pack-2/+page.svelte',
				'apps/web/src/routes/visual-lab/+page.svelte',
				'apps/web/src/routes/forge/enemies/+page.svelte'
			])
		).toEqual([
			'Retired hero visual path must not be tracked: assets/heroes/visuals/forge-v1/kavi-garo-anchor-v1.webp',
			'Retired hero visual path must not be tracked: assets/heroes/visuals/forge-v2/catalog.json',
			'Retired hero visual path must not be tracked: assets/heroes/visuals/owner-playtest-v1/dara-zev-anchor-v1.png',
			'Retired hero visual path must not be tracked: assets/heroes/visuals/catalog.json',
			'Retired hero visual path must not be tracked: assets/heroes/visuals/hearth-roster-pair-v1.png',
			'Superseded hero animation sheet must not be tracked: assets/heroes/visuals/realtime-combat-study-v1/animation-canary-v1/asha/asha-motion-sheet-source-v1.png',
			'Retired hero runtime catalog must not be tracked: apps/web/static/runtime/visual-catalog-v1/manifest.json',
			'Retired hero review route must not be tracked: apps/web/src/routes/forge/pack-2/+page.svelte',
			'Retired hero review route must not be tracked: apps/web/src/routes/visual-lab/+page.svelte'
		]);
	});

	it('requires every tracked skill PNG to use Git LFS', () => {
		expect(
			findSkillPngLfsViolations(
				[
					'assets/wiki/skills/icon-production-v2/interiors/blade.png',
					'assets/wiki/skills/icon-production-v2/frames/contact-sheet.png',
					'assets/wiki/skills/icon-production-v2/catalog.json',
					'assets/wiki/monsters/goblin.png'
				],
				new Map([
					['assets/wiki/skills/icon-production-v2/interiors/blade.png', 'lfs'],
					['assets/wiki/skills/icon-production-v2/frames/contact-sheet.png', 'unspecified']
				])
			)
		).toEqual([
			'Skill PNG is not covered by Git LFS: assets/wiki/skills/icon-production-v2/frames/contact-sheet.png'
		]);
	});

	it('rejects retired skill raster and standalone runtime namespaces', () => {
		expect(
			findRepositoryAssetPathViolations([
				'assets/wiki/skills/icon-production-v2/interiors/martial-blade-measured-cut.png',
				'assets/wiki/skills/icon-production-v2/frames/rarity-frame-f.png',
				'assets/wiki/skills/icon-production-v2/frame-shape-authority.png',
				'assets/wiki/skills/icon-production-v2/review/contact-sheet.png',
				'assets/wiki/skills/rarity-frame-v6/review/old.png',
				'apps/web/static/skill-icons/v1/512/old.webp'
			])
		).toEqual([
			'Non-canonical skill raster must not be tracked: assets/wiki/skills/icon-production-v2/review/contact-sheet.png',
			'Non-canonical skill raster must not be tracked: assets/wiki/skills/rarity-frame-v6/review/old.png',
			'Retired standalone skill runtime must not be tracked: apps/web/static/skill-icons/v1/512/old.webp'
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
			retainedHeroVisualImageCount: 71,
			retainedHeroVisualBytes: 126_735_389,
			approvedFaunaImageCount: 200,
			approvedFaunaBytes: 560_162_021,
			approvedEquipmentImageCount: 168,
			approvedEquipmentBytes: 229_920_937,
			retainedFamilyAffinityImageCount: 750,
			retainedFamilyAffinityBytes: 2_078_754_623
		});
	}, 120_000);
});
