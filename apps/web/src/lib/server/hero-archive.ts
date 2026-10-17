import archive from '../../../../../docs/readme-gallery/hero-archive.json';

const pageSize = 24;
const collections = [
	{ id: 'all', label: 'All collections', count: 736 },
	{ id: 'approved', label: 'Approved roster', count: 200 },
	{ id: 'candidates', label: 'Historical candidates', count: 471 },
	{ id: 'studies', label: 'Earlier studies and playtests', count: 62 },
	{ id: 'prototypes', label: 'Combat prototypes', count: 3 }
];
const indexedHeroes = archive.heroes.map((hero) => ({
	hero,
	search:
		`${hero.displayName} ${hero.heroId} ${JSON.stringify(hero.identity?.hair ?? '')} ${JSON.stringify(hero.identity?.wardrobe ?? '')}`.toLowerCase()
}));

export function searchHeroArchive(params: URLSearchParams) {
	const query = (params.get('q') ?? '').trim().slice(0, 160);
	const requestedCollection = params.get('collection') ?? 'all';
	const collection = collections.some((entry) => entry.id === requestedCollection)
		? requestedCollection
		: 'all';
	const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
	const matches = indexedHeroes.filter(
		({ hero, search }) =>
			(collection === 'all' || hero.collection === collection) &&
			terms.every((term) => search.includes(term))
	);
	const pageCount = Math.max(1, Math.ceil(matches.length / pageSize));
	const requestedPage = Number(params.get('page') ?? 1);
	const page = Number.isFinite(requestedPage)
		? Math.max(1, Math.min(pageCount, Math.floor(requestedPage)))
		: 1;
	const pageHref = (number: number) => {
		const params = new URLSearchParams();
		if (query) params.set('q', query);
		if (collection !== 'all') params.set('collection', collection);
		params.set('page', String(number));
		return `?${params}`;
	};
	return {
		query,
		collection,
		collections,
		page,
		pageCount,
		total: matches.length,
		first: matches.length ? (page - 1) * pageSize + 1 : 0,
		last: Math.min(page * pageSize, matches.length),
		previousHref: page > 1 ? pageHref(page - 1) : null,
		nextHref: page < pageCount ? pageHref(page + 1) : null,
		heroes: matches.slice((page - 1) * pageSize, page * pageSize).map(({ hero }) => ({
			heroId: hero.heroId,
			displayName: hero.displayName,
			collection: hero.collection,
			status: hero.status,
			originalUrl: hero.source.imageUrl,
			thumbnail: hero.thumbnail.path,
			width: hero.thumbnail.width,
			height: hero.thumbnail.height
		}))
	};
}
