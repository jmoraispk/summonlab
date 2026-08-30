import { getWikiNavigation, getWikiPageCount } from '$lib/server/wiki';

import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = () => ({
	navigation: getWikiNavigation(),
	pageCount: getWikiPageCount()
});
