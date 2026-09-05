import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSummonableHeroCatalog } from './summonable-hero-roster-lib.js';

const workspaceRoot = resolve(import.meta.dirname, '..');

describe('summonable hero roster promotion', () => {
	it('promotes all 200 selected identities and applies exactly nineteen v3 chibi overrides', async () => {
		const catalog = await buildSummonableHeroCatalog(workspaceRoot);

		expect(catalog.entries).toHaveLength(200);
		expect(new Set(catalog.entries.map((entry) => entry.heroId)).size).toBe(200);
		expect(new Set(catalog.entries.map((entry) => entry.displayName)).size).toBe(200);
		expect(
			catalog.entries.filter((entry) => entry.draft.manifest.genderPresentation === 'feminine')
		).toHaveLength(100);
		expect(
			catalog.entries.filter((entry) => entry.draft.manifest.genderPresentation === 'masculine')
		).toHaveLength(100);
		expect(catalog.entries.every((entry) => entry.draft.manifest.rarityStars === 1)).toBe(true);
		expect(
			catalog.entries.every((entry) => entry.draft.manifest.generationVersion === 'human-v6')
		).toBe(true);
		expect(
			catalog.entries.filter((entry) =>
				entry.visuals.combatChibi.file.includes('five-head-chibi-revisions-001')
			)
		).toHaveLength(19);
		expect(
			catalog.entries.filter((entry) =>
				entry.visuals.combatChibi.file.includes('five-head-chibi-regeneration-001')
			)
		).toHaveLength(181);
	});

	it('binds Coro Reshi to both approved v3 corrections', async () => {
		const catalog = await buildSummonableHeroCatalog(workspaceRoot);
		const coro = catalog.entries.find((entry) => entry.heroId === 'coro-reshi');

		expect(coro?.visuals.summon.file).toBe(
			'assets/heroes/experiments/five-head-chibi-revisions-001/heroes/coro-reshi/summon/provider-source-v2.png'
		);
		expect(coro?.visuals.combatChibi.file).toBe(
			'assets/heroes/experiments/five-head-chibi-revisions-001/heroes/coro-reshi/chibi/candidate-v3.png'
		);
	});
});
