import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CITY_MODES, cityModeHref, parseCityMode } from './city';

function productionSources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return productionSources(path);
		if (!['.svelte', '.ts'].includes(extname(entry.name))) return [];
		if (entry.name.endsWith('.spec.ts') || entry.name.endsWith('.e2e.ts')) return [];
		return [path];
	});
}

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
			existsSync(`${repositoryRoot}/apps/web/src/routes/onboarding/[runId]/+page.server.ts`)
		).toBe(false);
		expect(existsSync(`${repositoryRoot}/apps/web/src/routes/play/[runId]/+page.server.ts`)).toBe(
			false
		);
	});

	it('keeps CityScreen as the sole player Village renderer', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		for (const retiredPath of [
			'apps/web/src/lib/components/campaign/SingletonOnboarding.svelte',
			'apps/web/src/routes/onboarding/[runId]/+page.server.ts',
			'apps/web/src/routes/summon/[runId]/+page.server.ts',
			'apps/web/src/routes/summon/[runId]/+page.svelte',
			'apps/web/src/routes/living-village-lab/opening/+page.svelte',
			'apps/web/src/routes/living-village-lab/opening/WeaponGlyph.svelte',
			'apps/web/src/routes/living-village-lab/opening/heroes.ts',
			'apps/web/src/routes/living-village-lab/opening/opening.e2e.ts',
			'apps/web/src/routes/living-village-lab/summon/+page.svelte',
			'apps/web/src/routes/living-village-lab/summon/fixtures.ts',
			'apps/web/src/routes/living-village-lab/summon/summon.e2e.ts',
			'apps/web/src/lib/components/living-village/summon/HeroDossier.svelte',
			'apps/web/src/lib/components/living-village/summon/RatesPanel.svelte',
			'apps/web/src/lib/components/living-village/summon/ResultPresentation.svelte',
			'apps/web/src/lib/components/living-village/summon/RevealStage.svelte',
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

		const stalePatterns = [
			'SingletonOnboarding',
			'/living-village-lab/opening',
			'/living-village-lab/summon',
			'/onboarding/[runId]',
			'/summon/[runId]'
		];
		const sourceRoot = `${repositoryRoot}/apps/web/src`;
		const staleSources = productionSources(sourceRoot).filter((path) => {
			const source = readFileSync(path, 'utf8');
			return stalePatterns.some((pattern) => source.includes(pattern));
		});
		expect(staleSources).toEqual([]);
	});

	it('removes every parallel Tower, combat, and mission player route', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		for (const retiredPath of [
			'apps/web/src/routes/living-village-lab',
			'apps/web/src/routes/mission-lab',
			'apps/web/src/routes/mission/[runId]',
			'apps/web/src/routes/settlement-lab',
			'apps/web/src/routes/summon/[runId]',
			'apps/web/src/routes/onboarding/[runId]'
		]) {
			expect(existsSync(`${repositoryRoot}/${retiredPath}`), retiredPath).toBe(false);
		}
	});

	it('keeps surviving player transitions off the retired play route', () => {
		const repositoryRoot = fileURLToPath(new URL('../../../..', import.meta.url));
		const sources = ['apps/web/src/routes/replay/[runId]/+page.svelte'].map((path) =>
			readFileSync(`${repositoryRoot}/${path}`, 'utf8')
		);
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
