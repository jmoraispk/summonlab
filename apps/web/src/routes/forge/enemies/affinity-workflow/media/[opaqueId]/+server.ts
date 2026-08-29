import { readFile } from 'node:fs/promises';
import { error } from '@sveltejs/kit';

import {
	ControlledRoundUnavailableError,
	findVerifiedMediaByOpaqueId,
	parseAffinityReviewScope,
	parseControlledRoundId
} from '../../affinity-review';

import type { RequestHandler } from './$types';

export const GET = (async ({ params, url }) => {
	let controlledRound: ReturnType<typeof parseControlledRoundId>;
	let scope: ReturnType<typeof parseAffinityReviewScope>;
	try {
		controlledRound = parseControlledRoundId(url.searchParams.get('round'));
		scope = parseAffinityReviewScope(url.searchParams.get('scope'));
	} catch {
		error(400, 'Unknown affinity review scope or controlled round.');
	}
	let candidate;
	try {
		candidate = await findVerifiedMediaByOpaqueId(params.opaqueId, controlledRound, scope);
	} catch (bindingError) {
		if (bindingError instanceof ControlledRoundUnavailableError) {
			error(404, 'Verified experiment candidate not found.');
		}
		throw bindingError;
	}
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
