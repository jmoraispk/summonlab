import { describe, expect, it } from 'vitest';

import {
	planLegacyAffinityRetirement,
	RETIREMENT_RECURSIVE_ROOTS,
	type RetirementFile
} from './retire-legacy-enemy-affinities-lib.js';

const jsonFile = (path: string, value: unknown): RetirementFile => ({
	path,
	content: `${JSON.stringify(value, null, 2)}\n`
});

describe('legacy enemy affinity retirement', () => {
	it('has exactly the five authorized recursive roots', () => {
		expect(RETIREMENT_RECURSIVE_ROOTS).toEqual([
			'assets/enemies/experiments/affinity-workflow-v1',
			'assets/enemies/experiments/affinity-expansion-v1',
			'apps/web/static/wiki-media/monsters',
			'apps/web/src/routes/forge/enemies/affinity-workflow',
			'apps/web/src/routes/forge/enemies/affinity-expansion'
		]);
	});

	it('uses parsed affinity fields and structured paths instead of deleting prose matches', () => {
		const root = 'assets/enemies/experiments/affinity-workflow-v1';
		const plan = planLegacyAffinityRetirement([
			jsonFile(`${root}/targets/wolf/wood.json`, {
				targetId: 'wolf-wood',
				affinity: 'wood',
				candidatePath: `${root}/candidates/wolf/wood-v1.png`
			}),
			{ path: `${root}/candidates/wolf/wood-v1.png`, content: null },
			jsonFile(`${root}/targets/wolf/fire.json`, {
				targetId: 'wolf-fire',
				affinity: 'fire',
				note: 'The shield has wood grain and metal rivets.'
			})
		]);

		expect(plan.deletions.map((entry) => entry.path)).toEqual([
			`${root}/candidates/wolf/wood-v1.png`,
			`${root}/targets/wolf/wood.json`
		]);
		expect(plan.deletions.map((entry) => entry.path)).not.toContain(
			`${root}/targets/wolf/fire.json`
		);
	});

	it('removes legacy entries from aggregate JSON and deletes contaminated contact sheets', () => {
		const root = 'assets/enemies/experiments/affinity-expansion-v1';
		const catalog = `${root}/review/catalog.json`;
		const plan = planLegacyAffinityRetirement([
			jsonFile(`${root}/targets/wolf/metal.json`, {
				targetId: 'wolf-metal',
				affinity: 'metal',
				candidatePath: `${root}/candidates/wolf/metal-v1.png`
			}),
			{ path: `${root}/candidates/wolf/metal-v1.png`, content: null },
			jsonFile(catalog, {
				affinities: ['normal', 'metal', 'fire'],
				entries: [
					{ targetId: 'wolf-metal', affinity: 'metal' },
					{ targetId: 'wolf-fire', affinity: 'fire' }
				],
				targetCount: 2
			}),
			{ path: `${root}/review/contact-sheet.png`, content: null }
		]);

		expect(plan.deletions).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: `${root}/review/contact-sheet.png`, kind: 'composite' }),
				expect.objectContaining({ path: `${root}/targets/wolf/metal.json`, kind: 'legacy-json' })
			])
		);
		const rewrite = plan.rewrites.find((entry) => entry.path === catalog);
		expect(JSON.parse(rewrite?.content ?? '{}')).toMatchObject({
			affinities: ['normal', 'fire'],
			entries: [{ targetId: 'wolf-fire', affinity: 'fire' }],
			targetCount: 1
		});
		expect(plan.danglingReferences).toEqual([]);
	});

	it('reports references that would dangle after deletion', () => {
		const root = 'assets/enemies/experiments/affinity-workflow-v1';
		const plan = planLegacyAffinityRetirement([
			jsonFile(`${root}/targets/wolf/wood.json`, {
				targetId: 'wolf-wood',
				affinity: 'wood'
			}),
			{
				path: 'docs/wiki/systems/visuals.md',
				content: 'Still points to target `wolf-wood`.'
			}
		]);

		expect(plan.danglingReferences).toEqual([
			expect.objectContaining({ path: 'docs/wiki/systems/visuals.md', reference: 'wolf-wood' })
		]);
	});

	it('recalculates manifest counts and drops the obsolete six-affinity baseline hash', () => {
		const root = 'assets/enemies/experiments/affinity-expansion-v1';
		const manifest = `${root}/manifest.json`;
		const plan = planLegacyAffinityRetirement([
			jsonFile(`${root}/targets/wolf/wood.json`, { affinity: 'wood' }),
			jsonFile(`${root}/targets/wolf/metal.json`, { affinity: 'metal' }),
			jsonFile(manifest, {
				affinities: ['normal', 'wood', 'fire', 'metal', 'water', 'wind'],
				species: [
					{
						speciesId: 'wolf',
						targetCount: 6,
						targetPaths: [
							`${root}/targets/wolf/normal.json`,
							`${root}/targets/wolf/wood.json`,
							`${root}/targets/wolf/fire.json`,
							`${root}/targets/wolf/metal.json`,
							`${root}/targets/wolf/water.json`,
							`${root}/targets/wolf/wind.json`
						]
					}
				],
				counts: {
					species: 1,
					affinitiesPerSpecies: 6,
					targets: 6,
					assignments: 6,
					ownedOutputPaths: 12,
					maximumProviderCallsWithOneRetry: 12
				},
				baselineGuard: { targetCount: 6, definitionHash: 'old-six-affinity-hash' }
			})
		]);

		const rewrite = plan.rewrites.find((entry) => entry.path === manifest);
		expect(JSON.parse(rewrite?.content ?? '{}')).toMatchObject({
			affinities: ['normal', 'fire', 'water', 'wind'],
			species: [{ speciesId: 'wolf', targetCount: 4 }],
			counts: {
				species: 1,
				affinitiesPerSpecies: 4,
				targets: 4,
				assignments: 4,
				ownedOutputPaths: 8,
				maximumProviderCallsWithOneRetry: 8
			}
		});
		expect(JSON.parse(rewrite?.content ?? '{}')).not.toHaveProperty('baselineGuard');
	});

	it('refuses every deletion or rewrite outside the recursive and exact-file allowlists', () => {
		const plan = planLegacyAffinityRetirement([
			jsonFile('packages/content/src/wood.json', { affinity: 'wood' }),
			jsonFile('../outside/metal.json', { affinity: 'metal' })
		]);

		expect(plan.deletions).toEqual([]);
		expect(plan.rewrites).toEqual([]);
		expect(plan.escapedPaths).toEqual(['../outside/metal.json', 'packages/content/src/wood.json']);
	});
});
