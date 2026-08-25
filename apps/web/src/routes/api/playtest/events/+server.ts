import { getConfig } from '@summonlab/config';
import { PlaytestAnalyticsEventSchema } from '@summonlab/contracts';
import { recordPlaytestEvent } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const token = request.headers.get('x-playtest-consent');
	if (!token)
		return json({ message: 'Affirmative playtest consent is required.' }, { status: 401 });
	const parsed = PlaytestAnalyticsEventSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'Only allowlisted playtest events and properties are accepted.' },
			{ status: 400 }
		);
	}
	try {
		const receipt = await recordPlaytestEvent(getConfig().databaseUrl, token, parsed.data);
		return json(receipt, {
			status: receipt.accepted ? 201 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{
				message: 'Playtest consent is unavailable; the event was not stored.',
				detail: error instanceof Error ? error.message : 'unknown analytics persistence failure'
			},
			{ status: 403 }
		);
	}
};
