import { describe, expect, it } from 'vitest';
import { searchHeroArchive } from './hero-archive';
import { load } from '../../routes/wiki/heroes/+page.server';

describe('public hero archive', () => {
	it('can prerender the complete search index without reading a request URL', async () => {
		const data = await load({
			get url(): URL {
				throw new Error('Static archive data cannot depend on a request URL');
			}
		} as Parameters<typeof load>[0]);
		expect(data).toHaveProperty('index.length', 736);
		expect(data).toHaveProperty('initial.heroes.length', 24);
		expect(data).toHaveProperty('initial.pageCount', 31);
		expect(JSON.stringify(data)).not.toMatch(/identitySignature|sha256|targetGitBlob/);
	});
	it('keeps all 736 identities separate from the 200 approved roster', () => {
		const all = searchHeroArchive(new URLSearchParams());
		expect(all.total).toBe(736);
		expect(all.heroes).toHaveLength(24);
		expect(all.pageCount).toBe(31);
		expect(searchHeroArchive(new URLSearchParams('collection=approved')).total).toBe(200);
		expect(searchHeroArchive(new URLSearchParams('collection=candidates')).total).toBe(471);
		expect(searchHeroArchive(new URLSearchParams('collection=studies')).total).toBe(62);
		expect(searchHeroArchive(new URLSearchParams('collection=prototypes')).total).toBe(3);
	});

	it('finds real names and recorded hair or wardrobe descriptions', () => {
		for (const term of ['Eirar', 'Valu']) {
			const result = searchHeroArchive(new URLSearchParams({ q: term }));
			expect(result.heroes.some((hero) => hero.displayName.startsWith(term))).toBe(true);
		}
		expect(searchHeroArchive(new URLSearchParams('q=locs')).total).toBeGreaterThan(0);
		expect(searchHeroArchive(new URLSearchParams('q=patchwork')).total).toBeGreaterThan(0);
		expect(searchHeroArchive(new URLSearchParams('q=impossibleunknownhero')).total).toBe(0);
	});

	it('preserves filters in page links and bounds invalid page input', () => {
		const page = searchHeroArchive(new URLSearchParams('collection=candidates&q=locs&page=2'));
		expect(page.page).toBe(2);
		expect(page.previousHref).toContain('collection=candidates');
		expect(page.previousHref).toContain('q=locs');
		expect(searchHeroArchive(new URLSearchParams('page=-4')).page).toBe(1);
		expect(searchHeroArchive(new URLSearchParams('page=999999')).page).toBe(31);
		expect(searchHeroArchive(new URLSearchParams('page=NaN&collection=invalid')).total).toBe(736);
	});

	it('sends only visible card data to clients, with current approved image bindings', () => {
		const page = searchHeroArchive(new URLSearchParams('collection=approved'));
		expect(
			page.heroes.every((hero) => hero.originalUrl.includes('/runtime/summonable-heroes-v1/'))
		).toBe(true);
		expect(JSON.stringify(page)).not.toContain('identitySignature');
		expect(JSON.stringify(page)).not.toContain('sha256');
		expect(JSON.stringify(page)).not.toContain('targetGitBlob');
	});
});
