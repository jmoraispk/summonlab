import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
	BASE_AFFINITIES,
	DUAL_AFFINITIES,
	OVERCOMING_EDGES,
	validateAffinityWiki
} from './affinity-wiki-contract.js';

const roots: string[] = [];

async function fixture(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'affinity-wiki-contract-'));
	roots.push(root);
	for (const [relativePath, source] of Object.entries(files)) {
		const filePath = path.join(root, relativePath);
		await mkdir(path.dirname(filePath), { recursive: true });
		await writeFile(filePath, source);
	}
	return root;
}

afterEach(async () => {
	await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

const canonicalAffinityPage = `# Affinities

Wiki ID: \`mechanics.progression.affinities\`

## 2.2 The four affinities

| Affinity | Status |
| --- | --- |
| Fire | Burn |
| Earth | Weight |
| Wind | Lacerate |
| Water | Chill |

## 2.4 The cycle

Overcoming: Earth → Water → Fire → Wind → Earth.

## 2.10 Dual affinities

| Dual | From | Status |
| --- | --- | --- |
| Mist | Water ✕ Fire | Shroud |
| Lightning | Fire ✕ Wind | Shock |
| Sand | Wind ✕ Earth | Abrade |
| Rot | Earth ✕ Water | Decay |
| Magma | Fire ✕ Earth | Melt |
| Ice | Water ✕ Wind | Freeze |
`;

const catalog = (entries: unknown[]) =>
	JSON.stringify({ schemaVersion: 'summonlab-wiki-catalog-v1', entries }, null, 2);

const canonicalEntry = {
	wikiId: 'mechanics.progression.affinities',
	path: 'docs/wiki/mechanics/progression/affinities.md',
	pageType: 'mechanic'
};

describe('active wiki affinity contract', () => {
	it('publishes exactly four bases and six duals with one cycle', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage
		});

		expect(BASE_AFFINITIES).toEqual(['Fire', 'Earth', 'Wind', 'Water']);
		expect(DUAL_AFFINITIES).toEqual([
			{ name: 'Mist', parents: ['Water', 'Fire'], status: 'Shroud' },
			{ name: 'Lightning', parents: ['Fire', 'Wind'], status: 'Shock' },
			{ name: 'Sand', parents: ['Wind', 'Earth'], status: 'Abrade' },
			{ name: 'Rot', parents: ['Earth', 'Water'], status: 'Decay' },
			{ name: 'Magma', parents: ['Fire', 'Earth'], status: 'Melt' },
			{ name: 'Ice', parents: ['Water', 'Wind'], status: 'Freeze' }
		]);
		expect(OVERCOMING_EDGES).toEqual([
			['Earth', 'Water'],
			['Water', 'Fire'],
			['Fire', 'Wind'],
			['Wind', 'Earth']
		]);
		expect(await validateAffinityWiki(root)).toEqual([]);
	});

	it('reports retired terms and current Wood or Metal affinity presentation', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([
				canonicalEntry,
				{
					wikiId: 'affinity.wood',
					path: 'docs/wiki/mechanics/affinities/wood.md',
					pageType: 'affinity'
				},
				{
					wikiId: 'monster.example',
					path: 'docs/wiki/creatures/monsters/example.md',
					pageType: 'monster-entry'
				}
			]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'docs/wiki/mechanics/affinities/wood.md': '# Wood affinity',
			'docs/wiki/creatures/monsters/example.md':
				'The Wood image is a current affinity variant. Metal affinity remains current.',
			'apps/web/src/lib/components/wiki/Example.svelte':
				'<p>Resonance and five base affinities; Wind is derived from Metal.</p>'
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'apps/web/src/lib/components/wiki/Example.svelte: rendered wiki content uses retired term "Resonance".',
			'apps/web/src/lib/components/wiki/Example.svelte: rendered wiki content claims five base affinities.',
			'apps/web/src/lib/components/wiki/Example.svelte: rendered wiki content presents Wind as derived.',
			'docs/wiki/catalog.json: affinity catalog entry "affinity.wood" publishes retired affinity Wood.',
			'docs/wiki/mechanics/affinities/wood.md: rendered wiki content presents "Wood affinity" as current.',
			'docs/wiki/creatures/monsters/example.md: rendered wiki content presents "Metal affinity" as current.',
			'docs/wiki/creatures/monsters/example.md: monster page presents Wood or Metal imagery as a current affinity variant.'
		]);
	});

	it('does not mistake Svelte derived identifiers for a derived-Wind claim', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'apps/web/src/lib/components/wiki/AffinityIcon.svelte':
				'<script>const windName = "wind-current"; const icon = $derived(windName);</script>'
		});

		expect(await validateAffinityWiki(root)).toEqual([]);
	});

	it('reports canonical table and overcoming-cycle changes', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage
				.replace('| Water | Chill |', '| Wood | Bind |')
				.replace('| Ice | Water ✕ Wind | Freeze |', '| Steam | Water ✕ Wind | Scald |')
				.replace('Earth → Water → Fire → Wind → Earth', 'Earth → Fire → Water → Wind → Earth')
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'docs/wiki/mechanics/progression/affinities.md: canonical base table must contain exactly Fire, Earth, Wind, Water; found Fire, Earth, Wind, Wood.',
			'docs/wiki/mechanics/progression/affinities.md: canonical dual table must contain exactly Mist, Lightning, Sand, Rot, Magma, Ice; found Mist, Lightning, Sand, Rot, Magma, Steam.',
			'docs/wiki/mechanics/progression/affinities.md: overcoming cycle must contain exactly Earth>Water, Water>Fire, Fire>Wind, Wind>Earth; found Earth>Fire, Fire>Water, Water>Wind, Wind>Earth.'
		]);
	});

	it('reports changed dual parents and statuses in the canonical dual table', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage
				.replace('Water ✕ Fire | Shroud', 'Fire ✕ Water | Drench')
				.replace('Water ✕ Wind | Freeze', 'Water ✕ Earth | Freeze')
		});

		expect(await validateAffinityWiki(root)).toContain(
			'docs/wiki/mechanics/progression/affinities.md: canonical dual definitions must match Mist (Water × Fire, Shroud), Lightning (Fire × Wind, Shock), Sand (Wind × Earth, Abrade), Rot (Earth × Water, Decay), Magma (Fire × Earth, Melt), Ice (Water × Wind, Freeze); found Mist (Fire × Water, Drench), Lightning (Fire × Wind, Shock), Sand (Wind × Earth, Abrade), Rot (Earth × Water, Decay), Magma (Fire × Earth, Melt), Ice (Water × Earth, Freeze).'
		);
	});

	it('reports absent, malformed, and incomplete canonical catalog structure', async () => {
		const missingCatalog = await fixture({});
		expect(await validateAffinityWiki(missingCatalog)).toEqual([
			'docs/wiki/catalog.json: required wiki catalog is missing.'
		]);

		const malformedCatalog = await fixture({ 'docs/wiki/catalog.json': '{' });
		expect(await validateAffinityWiki(malformedCatalog)).toEqual([
			'docs/wiki/catalog.json: required wiki catalog contains malformed JSON.'
		]);

		const missingCanonicalEntry = await fixture({
			'docs/wiki/catalog.json': catalog([])
		});
		expect(await validateAffinityWiki(missingCanonicalEntry)).toEqual([
			'docs/wiki/catalog.json: required canonical affinity entry "mechanics.progression.affinities" is missing.'
		]);

		const missingCanonicalPage = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry])
		});
		expect(await validateAffinityWiki(missingCanonicalPage)).toEqual([
			'docs/wiki/mechanics/progression/affinities.md: required canonical affinity page is missing.'
		]);
	});

	it('checks present affinity diagrams without requiring production SVGs before they ship', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg':
				'<svg><path data-overcomes="Earth>Fire" /></svg>',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg':
				'<svg><rect data-kind="base" /><rect data-kind="dual" /></svg>'
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: data-overcomes edges must contain exactly Earth>Water, Water>Fire, Fire>Wind, Wind>Earth; found Earth>Fire.',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg: affinity matrix must contain exactly four data-kind="base" cells and six data-kind="dual" cells; found 1 base and 1 dual.'
		]);
	});

	it('permits immutable source wording only when its migration target is current', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json': JSON.stringify([
				{ sourceId: 'legacy:1', effect: 'Reduced Resonance' }
			]),
			'docs/wiki/mechanics/skills/migration-v2.json': JSON.stringify({
				records: [
					{
						sourceId: 'legacy:1',
						target: { replacementEffect: 'Reduced affinity rank' }
					}
				]
			})
		});

		expect(await validateAffinityWiki(root)).toEqual([]);
	});

	it('names the immutable skill-source exception when its target retains retired wording', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json': JSON.stringify([
				{ sourceId: 'legacy:1', requires: 'Wood affinity Rank I' }
			]),
			'docs/wiki/mechanics/skills/migration-v2.json': JSON.stringify({
				records: [{ sourceId: 'legacy:1', target: { labels: [{ value: 'Wood' }] } }]
			})
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json: immutable skill-source exception for legacy:1 is invalid because its migration target retains "Wood affinity".'
		]);
	});

	it('rejects Resonance in a migration target even when it also mentions affinity rank', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json': JSON.stringify([
				{ sourceId: 'legacy:1', effect: 'Reduced Resonance' }
			]),
			'docs/wiki/mechanics/skills/migration-v2.json': JSON.stringify({
				records: [
					{
						sourceId: 'legacy:1',
						target: { replacementEffect: 'Reduced Resonance at affinity rank' }
					}
				]
			})
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json: immutable skill-source exception for legacy:1 is invalid because its migration target retains "Resonance".'
		]);
	});

	it('allows current Resonant terminology in a non-rendered migration target', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'docs/wiki/mechanics/skills/legacy-skill-inventory-v1.json': JSON.stringify([
				{ sourceId: 'legacy:1', effect: 'Reduced Resonance' }
			]),
			'docs/wiki/mechanics/skills/migration-v2.json': JSON.stringify({
				records: [
					{
						sourceId: 'legacy:1',
						target: { replacementEffect: 'Resonant threshold' }
					}
				]
			})
		});

		expect(await validateAffinityWiki(root)).toEqual([]);
	});
});
