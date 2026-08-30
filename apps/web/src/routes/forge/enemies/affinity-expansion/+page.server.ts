import { loadAffinityExpansionGallery } from '$lib/server/affinity-expansion-gallery.js';

import type { PageServerLoad } from './$types';

export const load = (async () => loadAffinityExpansionGallery()) satisfies PageServerLoad;
