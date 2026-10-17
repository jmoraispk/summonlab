import { searchHeroArchive } from '$lib/server/hero-archive';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => searchHeroArchive(url.searchParams);
