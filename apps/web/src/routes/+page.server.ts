import { requestIdFromHeaders } from '@summonlab/observability';

import { getWebHealth } from '$lib/server/health';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	return { health: await getWebHealth(requestIdFromHeaders(request.headers)) };
};
