import { describe, expect, it } from 'vitest';

import summonableCatalogSource from '../../../../../assets/heroes/approved/summonable-roster-v1/catalog.json';

import { runtimePortraitFor } from './runtime-portraits';

describe('runtime portraits', () => {
	it('resolves all three owner-playtest heroes by immutable manifest hash', () => {
		for (const manifestHash of [
			'bbfaca18f7d862f64ea32650bac4ab50b8c1e8dff60148fdcf893ca37e17e363',
			'26a73e9c2e40dfbb6a57867f55e30a7901ad5efb3cdd960672230389d63ab7c0',
			'c0620c4cce21741173249b0a3987324de57e6a677b7b544c0eb38151adf8dc99'
		]) {
			expect(runtimePortraitFor(manifestHash, null, 'summon')?.publicPath).toMatch(
				/^\/runtime\/visual-catalog-v1\/hero-.+\/summon\.[a-f0-9]{12}\.webp$/u
			);
			expect(runtimePortraitFor(manifestHash, null, 'dialogue')?.publicPath).toContain(
				'/dialogue.'
			);
			expect(runtimePortraitFor(manifestHash, null, 'roster')?.publicPath).toContain('/roster.');
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
});
