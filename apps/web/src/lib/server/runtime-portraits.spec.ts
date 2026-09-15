import { describe, expect, it } from 'vitest';

import summonableCatalogSource from '../../../../../assets/heroes/approved/summonable-roster-v1/catalog.json';

import { runtimeCombatBindingFor, runtimePortraitFor } from './runtime-portraits';

describe('runtime portraits', () => {
	it('resolves canonical heroes by immutable manifest hash', () => {
		for (const hero of summonableCatalogSource.entries.slice(0, 3)) {
			const expected = new RegExp(
				`^/runtime/summonable-heroes-v1/${hero.heroId}/summon\\.[a-f0-9]{12}\\.webp$`,
				'u'
			);
			expect(runtimePortraitFor(hero.draft.manifestHash, null, 'summon')?.publicPath).toMatch(
				expected
			);
			expect(runtimePortraitFor(hero.draft.manifestHash, null, 'dialogue')?.publicPath).toMatch(
				expected
			);
			expect(runtimePortraitFor(hero.draft.manifestHash, null, 'roster')?.publicPath).toMatch(
				expected
			);
		}
	});

	it('keeps the deterministic rig fallback for unillustrated manifests', () => {
		expect(runtimePortraitFor('f'.repeat(64), null, 'summon')).toBeNull();
	});

	it('resolves both approved summon and combat-chibi art for a summonable hero', () => {
		const hero = summonableCatalogSource.entries[0]!;
		const summon = runtimePortraitFor(
			hero.draft.manifestHash,
			hero.draft.manifest.artKey,
			'summon'
		);
		const combatChibi = runtimePortraitFor(
			hero.draft.manifestHash,
			hero.draft.manifest.artKey,
			'combat-chibi'
		);

		expect(summon?.publicPath).toContain(`/summonable-heroes-v1/${hero.heroId}/summon.`);
		expect(combatChibi?.publicPath).toContain(`/summonable-heroes-v1/${hero.heroId}/combat-chibi.`);
		expect(
			runtimePortraitFor(hero.draft.manifestHash, hero.draft.manifest.artKey, 'village-cutout')
		).toBeNull();
	});

	it('resolves the approved combat chibi with its hash and approval identity', () => {
		const hero = summonableCatalogSource.entries[0]!;
		const binding = runtimeCombatBindingFor(hero.draft.manifestHash, hero.draft.manifest.artKey);

		expect(binding).toMatchObject({
			approvalStatus: 'approved',
			contentHash: expect.stringMatching(/^[a-f0-9]{64}$/u)
		});
		expect(binding?.source).toContain('/combat-chibi.');
	});

	it('resolves the three approved current-company Village cutouts', () => {
		for (const heroId of ['yaso-dreno', 'oren-sorin', 'joror-pelleth']) {
			const hero = summonableCatalogSource.entries.find((entry) => entry.heroId === heroId)!;
			expect(
				runtimePortraitFor(hero.draft.manifestHash, hero.draft.manifest.artKey, 'village-cutout')
					?.publicPath
			).toMatch(
				/^\/runtime\/summonable-heroes-v1\/(?:yaso-dreno|oren-sorin|joror-pelleth)\/village-cutout\.[a-f0-9]{12}\.webp$/u
			);
		}
	});
});
