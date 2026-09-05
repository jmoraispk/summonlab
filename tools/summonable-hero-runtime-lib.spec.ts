import { resolve } from 'node:path';

import { SummonableHeroCatalogSchema } from '../packages/contracts/src/index.js';
import { describe, expect, it } from 'vitest';

import catalogSource from '../assets/heroes/approved/summonable-roster-v1/catalog.json';
import {
	planSummonableHeroRuntime,
	verifyApprovedHeroSource
} from './summonable-hero-runtime-lib.js';

const workspaceRoot = resolve(import.meta.dirname, '..');
const catalog = SummonableHeroCatalogSchema.parse(catalogSource);

describe('summonable hero runtime export', () => {
	it('plans one lazy summon and combat-chibi asset for all 200 heroes', () => {
		const plan = planSummonableHeroRuntime(catalog);

		expect(plan).toHaveLength(400);
		expect(plan.filter((entry) => entry.usage === 'summon')).toHaveLength(200);
		expect(plan.filter((entry) => entry.usage === 'combat-chibi')).toHaveLength(200);
		expect(new Set(plan.map((entry) => entry.alias)).size).toBe(400);
	});

	it('rejects a source whose approved content hash no longer matches', async () => {
		const source = catalog.entries[0]!.visuals.summon;
		await expect(
			verifyApprovedHeroSource(workspaceRoot, { ...source, contentHash: 'f'.repeat(64) })
		).rejects.toThrow(/Approved source changed before runtime export/u);
	});
});
