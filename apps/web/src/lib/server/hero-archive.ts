import archive from '../../../../../docs/readme-gallery/hero-archive.json';
import { searchHeroArchive as searchIndex, type HeroArchiveEntry } from '$lib/hero-archive';

const index: HeroArchiveEntry[] = archive.heroes.map((hero) => ({
	heroId: hero.heroId,
	displayName: hero.displayName,
	collection: hero.collection,
	status: hero.status,
	originalUrl: hero.source.imageUrl,
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
