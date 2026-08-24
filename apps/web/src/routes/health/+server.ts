import { requestIdFromHeaders, REQUEST_ID_HEADER } from '@summonlab/observability';
import { json } from '@sveltejs/kit';

import { getWebHealth } from '$lib/server/health';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request }) => {
	const requestId = requestIdFromHeaders(request.headers);
	const health = await getWebHealth(requestId);

	return json(health, {
		status: health.status === 'ok' ? 200 : 503,
		headers: { [REQUEST_ID_HEADER]: requestId }
	});
};
