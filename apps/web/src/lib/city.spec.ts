import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CITY_MODES, cityModeHref, parseCityMode } from './city';

describe('City navigation', () => {
	it('is the sole owner of the player Village renderer and five-mode navigation', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		const playerRoute = readFileSync(
			`${repositoryRoot}/apps/web/src/routes/play/[runId]/+page.svelte`,
			'utf8'
		);
		const previewRoute = readFileSync(
			`${repositoryRoot}/apps/web/src/routes/living-village-lab/village/+page.svelte`,
			'utf8'
		);
		expect(playerRoute).toContain("from '$lib/components/city/CityScreen.svelte'");
		expect(playerRoute).not.toContain('LivingHearthScene');
		expect(previewRoute).toContain("from '$lib/components/city/CityScreen.svelte'");
		expect(previewRoute).not.toContain('VillageViewport');
		for (const retiredPath of [
			'apps/web/src/lib/components/LivingHearthScene.svelte',
			'apps/web/src/lib/components/living-village/village/VillageViewport.svelte',
			'apps/web/src/lib/components/living-village/village/VillageHeroDrawer.svelte',
			'apps/web/src/lib/components/living-village/village/VillageSummary.svelte',
			'apps/web/src/lib/components/village-shell/VillageModeNav.svelte',
			'apps/web/src/lib/village-shell.ts'
		]) {
			expect(existsSync(`${repositoryRoot}/${retiredPath}`), retiredPath).toBe(false);
		}
	});

	it('builds the five approved campaign destinations in product order', () => {
		expect(CITY_MODES.map((mode) => mode.id)).toEqual([
			'village',
			'residents',
			'tower',
			'inventory',
			'missions'
		]);
		expect(CITY_MODES.map((mode) => mode.label)).toEqual([
			'Village',
			'Residents',
			'Tower',
			'Inventory',
			'Missions'
		]);
		expect(cityModeHref('run with spaces', 'village')).toBe('/play/run%20with%20spaces');
		expect(cityModeHref('run with spaces', 'tower')).toBe('/play/run%20with%20spaces?mode=tower');
	});

	it.each(['village', 'residents', 'tower', 'inventory', 'missions'] as const)(
		'accepts %s as a City mode',
		(mode) => expect(parseCityMode(mode)).toBe(mode)
	);

	it.each([null, '', 'prototype', 'VILLAGE'])('falls back from %s to Village', (mode) => {
		expect(parseCityMode(mode)).toBe('village');
	});
});
