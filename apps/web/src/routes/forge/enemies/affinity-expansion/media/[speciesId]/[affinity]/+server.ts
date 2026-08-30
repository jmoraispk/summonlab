import { error } from '@sveltejs/kit';

import { loadAffinityExpansionMedia } from '$lib/server/affinity-expansion-gallery.js';

import type { RequestHandler } from './$types';

export const GET = (async ({ params }) => {
	const candidate = await loadAffinityExpansionMedia(params.speciesId, params.affinity);
	if (!candidate) error(404, 'Verified expansion candidate not found.');
	return new Response(candidate.bytes, {
		headers: {
			'cache-control': 'private, no-store',
			'content-type': 'image/png',
			etag: `"${candidate.contentHash}"`,
			'x-content-type-options': 'nosniff',
			'x-image-production-status': candidate.status
		}
	});
}) satisfies RequestHandler;
