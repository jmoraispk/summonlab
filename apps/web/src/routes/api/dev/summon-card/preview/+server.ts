import { getConfig } from '@summonlab/config';
import { SummonCardPreviewRequestSchema } from '@summonlab/contracts';
import { json } from '@sveltejs/kit';

import { buildSummonCardSpec, resolveSummonCardSubject } from '$lib/server/summon-card';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const config = getConfig();
	if (!config.devRoutesEnabled) return json({ message: 'Not found.' }, { status: 404 });
	const body = await request.json().catch(() => null);
	const parsed = SummonCardPreviewRequestSchema.safeParse(body);
	if (!parsed.success) {
		return json({ message: 'Invalid summon-card preview request.' }, { status: 400 });
	}

	try {
		const subject = await resolveSummonCardSubject(parsed.data);
		return json(
			buildSummonCardSpec(subject, parsed.data.catalogVersion, parsed.data.direction, config),
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The preview could not be built.' },
			{ status: 409 }
		);
	}
};
