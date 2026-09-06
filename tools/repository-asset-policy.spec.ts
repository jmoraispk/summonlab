import { describe, expect, it } from 'vitest';

import {
	expectedApprovedHeroVisualPath,
	findApprovedHeroPathViolations,
	findRepositoryAssetPathViolations
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
});
