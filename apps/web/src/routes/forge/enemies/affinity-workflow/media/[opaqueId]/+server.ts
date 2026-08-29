import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';

import { findVerifiedMediaByOpaqueId } from '../../affinity-review';

import type { RequestHandler } from './$types';

export const GET = (async ({ params }) => {
	const candidate = await findVerifiedMediaByOpaqueId(params.opaqueId);
	if (!candidate) error(404, 'Verified experiment candidate not found.');
	const bytes = await readFile(candidate.path);
	return new Response(new Uint8Array(bytes), {
		headers: {
			'cache-control': 'private, no-store',
			'content-type': 'image/png',
			'x-content-type-options': 'nosniff'
		}
	});
}) satisfies RequestHandler;
