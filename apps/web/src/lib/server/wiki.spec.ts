import { describe, expect, it } from 'vitest';

import { getWikiNavigation, getWikiPage, getWikiPageCount } from './wiki';

describe('online wiki registry', () => {
	it('publishes every public catalog route from canonical Markdown', () => {
		const navigation = getWikiNavigation();

		expect(getWikiPageCount()).toBe(56);
		expect(navigation.length).toBeGreaterThan(40);
		for (const entry of navigation) {
			expect(getWikiPage(entry.href.replace(/^\/wiki\//u, ''))?.title).toBe(entry.title);
		}
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
});
