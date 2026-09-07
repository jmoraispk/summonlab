import { getConfig } from '@summonlab/config';
import { EngineCursorGapSchema } from '@summonlab/contracts';
import {
	EngineCursorGapError,
	catchUpRun,
	getReturnRecap,
	getSimulationClock
} from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectReturnRecapForPublic } from '$lib/server/public-engine-presentation';

import type { RequestHandler } from './$types';

function parseCursor(value: string | null): number | null {
	if (value === null || !/^\d+$/u.test(value)) return value === null ? 0 : null;
	const cursor = Number(value);
	return Number.isSafeInteger(cursor) ? cursor : null;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const afterCursor = parseCursor(url.searchParams.get('after'));
	if (afterCursor === null) {
		return json({ message: 'The recap cursor must be a nonnegative integer.' }, { status: 400 });
	}
	const config = getConfig();
	try {
		const clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => null);
		if (clock && clock.backlogGameMinutes >= 1) {
			await catchUpRun(config.databaseUrl, params.runId, { owner: 'recap-reconnect' });
		}
		const recap = await getReturnRecap(config.databaseUrl, params.runId, afterCursor);
		if (!recap) return json({ message: 'Engine run not found.' }, { status: 404 });
		return json(projectReturnRecapForPublic(recap), {
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		if (error instanceof EngineCursorGapError) {
			return json(
				EngineCursorGapSchema.parse({
					runId: error.runId,
					requestedAfter: error.requestedAfter,
					latestCursor: error.latestCursor,
					reason: error.reason
				}),
				{ status: 409 }
			);
		}
		console.error('Return recap failed', error);
		return json({ message: 'The return recap could not be built.' }, { status: 500 });
	}
};
