import { describe, expect, it } from 'vitest';

import catalog from '../../../../../docs/wiki/catalog.json';
import monsterIndex from '../../../../../docs/wiki/creatures/monsters/visual-index.json';

import {
	getLegacyMonsterWikiRedirect,
	getLegacyMonsterWikiRoutes,
	getMonsterProductionDatabase,
	getMonsterProductionEntry,
	getMonsterVisualDatabase,
	getMonsterVisualEntry,
	parseMonsterVisualIndexV2,
	type MonsterAffinity,
	type MonsterProductionStatus,
	type MonsterTier
} from './monster-database';
import { getWikiAsset, getWikiNavigation, getWikiPage, getWikiPageCount } from './wiki';
import { load as loadWikiPage } from '../../routes/wiki/[...slug]/+page.server';

function thrownRouteResult(slug: string): { status: number; location?: string } {
	try {
		loadWikiPage({ params: { slug } } as Parameters<typeof loadWikiPage>[0]);
	} catch (error) {
		return error as { status: number; location?: string };
	}
	throw new Error(`Expected ${slug} to throw a route result`);
}

describe('online wiki registry', () => {
	it('publishes every public catalog route from canonical Markdown', () => {
		const navigation = getWikiNavigation();

		expect(getWikiPageCount()).toBe(catalog.entries.length);
		expect(navigation.length).toBeGreaterThan(40);
		for (const entry of navigation) {
			expect(getWikiPage(entry.href.replace(/^\/wiki\//u, ''))?.title).toBe(entry.title);
		}
	});

	it('publishes the Elemental catalog and retires obsolete skill routes', () => {
		expect(getWikiPage('mechanics/skills/magical-elemental')?.wikiId).toBe(
			'skills.magical-elemental'
		);
		expect(getWikiPage('mechanics/skills/magical-evocation')).toBeNull();
		expect(getWikiPage('mechanics/skills/martial-universal')).toBeNull();
	});

	it('bundles the accepted affinity diagrams for local wiki rendering', () => {
		for (const assetPath of [
			'assets/enemies/wiki/affinities/reference/element-cycle-v2.svg',
			'assets/enemies/wiki/affinities/reference/affinity-matrix-v2.svg'
		]) {
			expect(getWikiAsset(assetPath)).toMatch(/^(?:data:image\/svg\+xml|\/)/u);
		}

		expect(getWikiPage('mechanics/progression/affinities')?.html).not.toContain(
			'github.com/jmoraispk/summonlab/blob/main/assets/enemies/wiki/affinities/reference'
		);
	});

	it('publishes one planned production record per canonical monster form', () => {
		const monsters = getMonsterProductionDatabase();
		const typedTier: MonsterTier = monsters[0]!.tier;
		const typedAffinity: MonsterAffinity = monsters[0]!.variants[0]!.affinity;
		const typedStatus: MonsterProductionStatus = monsters[0]!.variants[0]!.status;

		expect(monsters).toHaveLength(150);
		expect([typedTier, typedAffinity, typedStatus]).toEqual(['T1', 'normal', 'planned']);
		expect(monsters.every((monster) => monster.variants.length === 5)).toBe(true);
		expect(monsters.every((monster) => monster.variants[0]?.affinity === 'normal')).toBe(true);
		expect(monsters.every((monster) => monster.floorSlot === null)).toBe(true);
		expect(getWikiPage('creatures/monsters/goblin-runt')?.wikiId).toBe('monster.goblin-runt');
		expect(
			getMonsterProductionEntry('monster.goblin-runt')?.variants.map((entry) => entry.affinity)
		).toEqual(['normal', 'fire', 'earth', 'wind', 'water']);
		expect(getMonsterVisualDatabase()).toBeNull();
		expect(getMonsterVisualEntry('monster.goblin-runt')).toBeNull();
		expect(
			getWikiNavigation().find((entry) => entry.href === '/wiki/creatures/monsters/goblin-runt')
		).toMatchObject({ section: 'Creatures', group: 'Monsters', pageType: 'monster-entry' });
	});

	it('parses the current monster production presentation states', () => {
		const parsed = parseMonsterVisualIndexV2(monsterIndex);
		const statuses = new Set(
			parsed.monsters.flatMap((monster) =>
				monster.variants.map((variant) => variant.presentationStatus)
			)
		);

		expect([...statuses].sort()).toEqual([
			'approved-review',
			'blocked-on-anchor',
			'candidate-only'
		]);
	});

	it('rejects invalid v2 literal values at the JSON server boundary', () => {
		const invalid = structuredClone(monsterIndex) as unknown as {
			monsters: Array<{ tier: string }>;
		};
		invalid.monsters[0]!.tier = 'T6';
		expect(() => parseMonsterVisualIndexV2(invalid)).toThrow(/tier.*T6|invalid.*tier/iu);
	});

	it('rejects unvalidated nested v2 fields at the JSON server boundary', () => {
		const invalid = structuredClone(monsterIndex) as unknown as {
			families: Array<{ floorSlot: unknown }>;
			reconciliation: {
				entries: Array<{ candidateReuseByAffinity: Record<string, unknown> }>;
			};
		};
		invalid.families[0]!.floorSlot = 1;
		invalid.reconciliation.entries[0]!.candidateReuseByAffinity.normal = 'false';
		expect(() => parseMonsterVisualIndexV2(invalid)).toThrow(/families.*floorSlot/iu);
	});

	it('routes all forty legacy monster URLs without loops', () => {
		const routes = getLegacyMonsterWikiRoutes();
		expect(routes).toHaveLength(40);
		expect(new Set(routes.map(({ currentClassId }) => currentClassId))).toHaveLength(40);
		for (const route of routes) {
			expect(getLegacyMonsterWikiRedirect(route.currentClassId)).toBe(route.destination);
			expect(route.destination).not.toBe(`/wiki/creatures/monsters/${route.currentClassId}`);
		}
		expect(getLegacyMonsterWikiRedirect('not-a-monster')).toBeNull();
	});

	it.each([
		['hill-giant', '/wiki/creatures/monsters/giant-hill-giant'],
		['goblin-chieftain', '/wiki/creatures/monsters/goblin-warboss'],
		['death-knight', '/wiki/creatures/monsters#current-class-reconciliation'],
		['grey-wolf', '/wiki/creatures/monsters#current-class-reconciliation']
	])('returns a permanent redirect for legacy %s', (currentClassId, destination) => {
		expect(thrownRouteResult(`creatures/monsters/${currentClassId}`)).toMatchObject({
			status: 308,
			location: destination
		});
	});

	it('keeps a truly unknown monster URL as a 404', () => {
		expect(thrownRouteResult('creatures/monsters/not-a-monster')).toMatchObject({ status: 404 });
	});

	it('exposes the visual packet and supplied progression cap table', () => {
		expect(
			getWikiNavigation().some((entry) => entry.href === '/wiki/art/living-village-heroes')
		).toBe(true);

		const progression = getWikiPage('mechanics/progression');
		expect(progression?.html).toContain('<td align="right">6★</td>');
		expect(progression?.html).toContain('<td align="right">70</td>');
		expect(progression?.html).toContain('<td align="right">7★</td>');
		expect(progression?.html).toContain('<td align="right">99</td>');
	});

	it('provides folder hierarchy for collapsible navigation', () => {
		const progression = getWikiNavigation().find(
			(entry) => entry.href === '/wiki/mechanics/progression'
		);
		expect(progression).toMatchObject({ section: 'Mechanics', group: 'Progression' });
	});

	it('provides title-free body HTML for promoted canonical headings', () => {
		const skills = getWikiPage('mechanics/skills');

		expect(skills?.html).toMatch(/^<h1 id="skills">Skills<\/h1>/);
		expect(skills?.bodyHtml).not.toContain('<h1');
		expect(skills?.bodyHtml).toContain('Skills define what a hero can do');
	});

	it('publishes the fixed six-person Living Village roster', () => {
		const packet = getWikiPage('art/living-village-heroes');
		expect(packet?.html).toContain('complete prototype face pool');
		for (const name of [
			'Dara Zev',
			'Mara Vey',
			'Jori Daro',
			'Kira Toren',
			'Iven Orra',
			'Remy Nahl'
		]) {
			expect(packet?.html).toContain(name);
		}
	});

	it('publishes the collision-safe Living Village parallel plan', () => {
		const plan = getWikiPage('roadmap/living-village-parallel-plan');
		expect(plan?.html).toContain('one coordinator plus three screen-owning agents');
		expect(plan?.html).toContain('/living-village-lab');
		expect(plan?.html).toContain('/living-village-lab/village');
		expect(plan?.html).toContain('/living-village-lab/summon');
		expect(plan?.html).toContain('/living-village-lab/tower');
		expect(plan?.html).not.toContain('/living-village-lab/hero-activity');
		expect(plan?.html).toContain('Summon ×10 + 1 bonus');
		expect(plan?.html).toContain('remaining-Health return threshold');
	});

	it('keeps hero inspection in the Village and publishes bounded species hunts', () => {
		const milestone = getWikiPage('milestones/living-village');
		expect(milestone?.html).toContain('Village and Roster are one persistent world surface');
		expect(milestone?.html).toContain('Species hunts and automatic return');
		expect(milestone?.html).toContain('species materials');
	});
});
