import archive from '../../../../../docs/readme-gallery/hero-archive.json';
import { searchHeroArchive as searchIndex, type HeroArchiveEntry } from '$lib/hero-archive';

const index: HeroArchiveEntry[] = archive.heroes.map((hero) => ({
	heroId: hero.heroId,
	displayName: hero.displayName,
	collection: hero.collection,
	status: hero.status,
	// Only originals whose bytes are still in the site's static files are linked; the commits that held
	// the historical candidates and studies are gone from GitHub, so those keep only their thumbnails.
	originalPath: ('keptPath' in hero.source ? hero.source.keptPath : undefined) ?? null,
	thumbnail: hero.thumbnail.path,
	width: hero.thumbnail.width,
	height: hero.thumbnail.height,
	search:
		`${hero.displayName} ${hero.heroId} ${JSON.stringify(hero.identity?.hair ?? '')} ${JSON.stringify(hero.identity?.wardrobe ?? '')}`.toLowerCase()
}));

export function searchHeroArchive(params: URLSearchParams) {
	return searchIndex(index, params);
}

export function getHeroArchiveData() {
	return { index, initial: searchHeroArchive(new URLSearchParams()) };
}
