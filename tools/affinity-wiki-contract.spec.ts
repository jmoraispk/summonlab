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

const validCycleSvg = `<svg role="img"><title>Affinity overcoming cycle</title><desc>Earth>Water, Water>Fire, Fire>Wind, Wind>Earth.</desc><path data-overcomes="Earth>Water" /><path data-overcomes="Water>Fire" /><path data-overcomes="Fire>Wind" /><path data-overcomes="Wind>Earth" /></svg>`;

const validMatrixSvg = `<svg role="img"><title>Affinity pairing matrix</title><desc>Four base affinities and six dual affinities, for ten total affinities.</desc><rect data-kind="base" data-name="Earth" /><rect data-kind="dual" data-name="Rot" data-parents="Earth|Water" data-status="Decay" /><rect data-kind="dual" data-name="Magma" data-parents="Fire|Earth" data-status="Melt" /><rect data-kind="base" data-name="Water" /><rect data-kind="dual" data-name="Mist" data-parents="Water|Fire" data-status="Shroud" /><rect data-kind="dual" data-name="Ice" data-parents="Water|Wind" data-status="Freeze" /><rect data-kind="base" data-name="Fire" /><rect data-kind="dual" data-name="Lightning" data-parents="Fire|Wind" data-status="Shock" /><rect data-kind="base" data-name="Wind" /><rect data-kind="dual" data-name="Sand" data-parents="Wind|Earth" data-status="Abrade" /></svg>`;

const suppliedCycleSvg = `<svg role="img"><title>Four-element ring with dual affinities</title><desc>Water, fire, wind and earth on a ring, with arrows showing what each overcomes.</desc><text>Fire Wind Earth Water Mist Lightning Sand Rot Magma Ice</text></svg>`;
const suppliedMatrixSvg = `<svg role="img"><title>Affinity pairing matrix, ten affinities</title><desc>A four by four grid with four base affinities and six dual affinities.</desc><text>Water Fire Wind Earth Mist Ice Rot Lightning Magma Sand</text></svg>`;
const suppliedDiagramProvenance = JSON.stringify({
	schemaVersion: 'summonlab-affinity-diagram-provenance-v1',
	status: 'approved-supplied-layout',
	promotions: [
		{
			referenceInput: '/attachments/element_cycle.svg',
			output: 'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg',
			sha256: '2493dbc7859b0b72c10900470f1456adff406f857db8f6b3d4005abdc84a8a74'
		},
		{
			referenceInput: '/attachments/affinity_matrix.svg',
			output: 'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg',
			sha256: '96ee38228ebfa3941fd8fbad17815cccae6ffc085c0372380e6d59489f1bd121'
		}
	]
});

const requiredDiagramFixtures = {
	'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg': validCycleSvg,
	'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg': validMatrixSvg
};

async function fixture(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(path.join(tmpdir(), 'affinity-wiki-contract-'));
	roots.push(root);
	for (const [relativePath, source] of Object.entries({ ...requiredDiagramFixtures, ...files })) {
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

| Affinity | Color | Character | Status | Behavior |
| :--- | ---: | :---: | --- | ---: |
| Fire | Vermilion | Expansion | Burn | Damage over time |
| Earth | Ocher-brown | Stability | Weight | Reduces poise |
| Wind | Pale green-gray | Motion | Lacerate | Cutting damage |
| Water | Deep blue | Flow | Chill | Reduces attack speed |

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
	it('accepts byte-identical approved supplied diagrams without private metadata', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg': suppliedCycleSvg,
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg': suppliedMatrixSvg,
			'assets/enemies/wiki/affinities/reference/provenance.json': suppliedDiagramProvenance
		});

		expect(await validateAffinityWiki(root)).toEqual([]);
	});

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
				.replace(
					'| Water | Deep blue | Flow | Chill | Reduces attack speed |',
					'| Wood | Green | Growth | Bind | Restrains movement |'
				)
				.replace('| Ice | Water ✕ Wind | Freeze |', '| Steam | Water ✕ Wind | Scald |')
				.replace('Earth → Water → Fire → Wind → Earth', 'Earth → Fire → Water → Wind → Earth')
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'docs/wiki/mechanics/progression/affinities.md: canonical base table must contain exactly Fire, Earth, Wind, Water; found Fire, Earth, Wind, Wood.',
			'docs/wiki/mechanics/progression/affinities.md: canonical dual table must contain exactly Mist, Lightning, Sand, Rot, Magma, Ice; found Mist, Lightning, Sand, Rot, Magma, Steam.',
			'docs/wiki/mechanics/progression/affinities.md: overcoming cycle must contain exactly Earth>Water, Water>Fire, Fire>Wind, Wind>Earth; found Earth>Fire, Fire>Water, Water>Wind, Wind>Earth.'
		]);
	});

	it('does not let another affinity table fill a missing Section 2.2 base row', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': `${canonicalAffinityPage.replace(
				'| Water | Deep blue | Flow | Chill | Reduces attack speed |\n',
				''
			)}
## Appendix

| Affinity | Color | Character | Status | Behavior |
| --- | --- | --- | --- | --- |
| Water | Deep blue | Flow | Chill | Reduces attack speed |
`
		});

		expect(await validateAffinityWiki(root)).toContain(
			'docs/wiki/mechanics/progression/affinities.md: canonical base table must contain exactly Fire, Earth, Wind, Water; found Fire, Earth, Wind.'
		);
	});

	it('reports changed base statuses in the Section 2.2 table', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage.replace(
				'| Fire | Vermilion | Expansion | Burn | Damage over time |',
				'| Fire | Vermilion | Expansion | Scorch | Damage over time |'
			)
		});

		expect(await validateAffinityWiki(root)).toContain(
			'docs/wiki/mechanics/progression/affinities.md: canonical base definitions must match Fire (Burn), Earth (Weight), Wind (Lacerate), Water (Chill); found Fire (Scorch), Earth (Weight), Wind (Lacerate), Water (Chill).'
		);
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

	it('requires both complete affinity diagrams', async () => {
		const missingCycle = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg': '',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg': ''
		});
		expect(await validateAffinityWiki(missingCycle)).toEqual([
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: required affinity overcoming-cycle SVG is missing.',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg: required affinity matrix SVG is missing.'
		]);

		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg':
				'<svg><path data-overcomes="Earth>Fire" /><path data-overcomes="Water>Fire" /><path data-overcomes="Fire>Wind" /><path data-overcomes="Wind>Earth" /></svg>',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg':
				'<svg><rect data-kind="base" /><rect data-kind="base" /><rect data-kind="base" /><rect data-kind="base" /><rect data-kind="dual" /><rect data-kind="dual" /><rect data-kind="dual" /><rect data-kind="dual" /><rect data-kind="dual" /><rect data-kind="dual" /></svg>'
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: data-overcomes edges must contain exactly Earth>Water, Water>Fire, Fire>Wind, Wind>Earth; found Earth>Fire, Water>Fire, Fire>Wind, Wind>Earth.',
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: accessible SVG must declare role="img".',
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: accessible title must be "Affinity overcoming cycle"; found none.',
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: accessible description must state Earth>Water, Water>Fire, Fire>Wind, Wind>Earth verbatim.',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg: matrix cells must name exactly Fire, Earth, Wind, Water, Mist, Lightning, Sand, Rot, Magma, Ice; found none.',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg: dual cells must declare exact data-parents and data-status metadata; found none.'
		]);
	});

	it('rejects a duplicate cycle edge that replaces a required edge', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg': validCycleSvg.replace(
				'data-overcomes="Wind>Earth"',
				'data-overcomes="Earth>Water"'
			)
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg: data-overcomes edges must contain exactly Earth>Water, Water>Fire, Fire>Wind, Wind>Earth; found Earth>Water, Water>Fire, Fire>Wind, Earth>Water.'
		]);
	});

	it('rejects a duplicate base cell name that replaces a required base', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg': validMatrixSvg.replace(
				'data-name="Wind"',
				'data-name="Earth"'
			)
		});

		expect(await validateAffinityWiki(root)).toEqual([
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg: matrix cells must name exactly Fire, Earth, Wind, Water, Mist, Lightning, Sand, Rot, Magma, Ice; found Earth, Rot, Magma, Water, Mist, Ice, Fire, Lightning, Earth, Sand.'
		]);
	});

	it('rejects a duplicate dual cell name that replaces a required dual', async () => {
		const root = await fixture({
			'docs/wiki/catalog.json': catalog([canonicalEntry]),
			'docs/wiki/mechanics/progression/affinities.md': canonicalAffinityPage,
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg': validMatrixSvg.replace(
				'data-name="Sand"',
				'data-name="Rot"'
			)
		});

		expect(await validateAffinityWiki(root)).toContain(
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg: matrix cells must name exactly Fire, Earth, Wind, Water, Mist, Lightning, Sand, Rot, Magma, Ice; found Earth, Rot, Magma, Water, Mist, Ice, Fire, Lightning, Wind, Rot.'
		);
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

	it('permits immutable source wording when the current replacement effect is ledger metadata', async () => {
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
						target: { domain: 'Magical', family: 'Enchantment', skill: 'Current Effect' },
						replacementEffect: 'Reduced affinity rank'
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
