import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CITY_MODES, cityModeHref, parseCityMode } from './city';

describe('City navigation', () => {
	it('mounts every player campaign stage on the canonical Village route', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		const canonicalRoute = `${repositoryRoot}/apps/web/src/routes/(city)/[mode=city]/+page.svelte`;
		const canonicalServer = `${repositoryRoot}/apps/web/src/routes/(city)/[mode=city]/+page.server.ts`;
		expect(existsSync(canonicalRoute), canonicalRoute).toBe(true);
		expect(existsSync(canonicalServer), canonicalServer).toBe(true);
		if (!existsSync(canonicalRoute) || !existsSync(canonicalServer)) return;

		const canonicalSource = readFileSync(canonicalRoute, 'utf8');
		expect(canonicalSource).toContain('SingletonCampaign');
		expect(canonicalSource).not.toContain('SingletonOnboarding');
		expect(canonicalSource).not.toContain('data.stage');
		expect(existsSync(`${repositoryRoot}/apps/web/src/routes/play/[runId]/+page.svelte`)).toBe(
			false
		);
		expect(
			existsSync(`${repositoryRoot}/apps/web/src/routes/onboarding/[runId]/+page.svelte`)
		).toBe(false);
		expect(
			readFileSync(`${repositoryRoot}/apps/web/src/routes/play/[runId]/+page.server.ts`, 'utf8')
		).toContain("redirect(308, '/village')");
		expect(
			readFileSync(
				`${repositoryRoot}/apps/web/src/routes/onboarding/[runId]/+page.server.ts`,
				'utf8'
			)
		).toContain("redirect(308, '/village')");
	});

	it('keeps CityScreen as the sole player Village renderer', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		for (const retiredPath of [
			'apps/web/src/routes/settlement-lab/+page.svelte',
			'apps/web/src/routes/settlement-lab/+page.server.ts',
			'apps/web/src/routes/settlement-lab.e2e.ts',
			'apps/web/src/lib/components/HearthScene.svelte',
			'apps/web/src/routes/living-village-lab/village/+page.svelte',
			'apps/web/src/routes/living-village-lab/village/+page.server.ts',
			'apps/web/src/routes/living-village-lab/village/village.e2e.ts',
			'apps/web/src/lib/components/city/city-screen.fixture.ts',
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

	it('keeps surviving player transitions off the retired play route', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		const sources = [
			'apps/web/src/routes/summon/[runId]/+page.svelte',
			'apps/web/src/routes/replay/[runId]/+page.svelte'
		].map((path) => readFileSync(`${repositoryRoot}/${path}`, 'utf8'));
		for (const source of sources) expect(source).not.toContain("resolve('/play/[runId]'");
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
		expect(CITY_MODES.map(({ id }) => cityModeHref(id))).toEqual([
			'/village',
			'/residents',
			'/tower',
			'/inventory',
			'/missions'
		]);
		expect(cityModeHref('tower')).toBe('/tower');
	});

	it.each(['village', 'residents', 'tower', 'inventory', 'missions'] as const)(
		'accepts %s as a City mode',
		(mode) => expect(parseCityMode(mode)).toBe(mode)
	);

	it.each([null, '', 'prototype', 'VILLAGE'])('falls back from %s to Village', (mode) => {
		expect(parseCityMode(mode)).toBe('village');
	});
});
