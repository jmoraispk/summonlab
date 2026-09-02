import { describe, expect, it } from 'vitest';

import catalog from '../../../../../docs/wiki/catalog.json';

import { getMonsterVisualDatabase, getMonsterVisualEntry } from './monster-database';
import { getWikiAsset, getWikiNavigation, getWikiPage, getWikiPageCount } from './wiki';

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

	it('publishes one visual database page per canonical monster identity', () => {
		const monsters = getMonsterVisualDatabase();

		expect(monsters).toHaveLength(40);
		expect(monsters.every((monster) => monster.variants.length === 4)).toBe(true);
		expect(monsters.every((monster) => monster.variants[0]?.affinity === 'normal')).toBe(true);
		expect(getWikiPage('creatures/monsters/death-knight')?.wikiId).toBe('monster.death-knight');
		expect(
			getMonsterVisualEntry('monster.death-knight')?.variants.map((entry) => entry.affinity)
		).toEqual(['normal', 'fire', 'wind', 'water']);
		expect(
			getWikiNavigation().find((entry) => entry.href === '/wiki/creatures/monsters/death-knight')
		).toMatchObject({ section: 'Creatures', group: 'Monsters', pageType: 'monster-entry' });
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
