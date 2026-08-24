import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { CatchUpRequestSchema } from '@summonlab/contracts';
import { catchUpRun } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const config = getConfig();
	const parsed = CatchUpRequestSchema.safeParse(await request.json().catch(() => ({})));
	if (!parsed.success) {
		return json(
			{ message: 'The catch-up request is invalid.', issues: parsed.error.issues },
			{ status: 400 }
		);
	}
	if (parsed.data.wallTime && !config.devRoutesEnabled) {
		return json(
			{ message: 'Injected wall time is available only in development.' },
			{ status: 403 }
		);
	}
	try {
		const report = await catchUpRun(config.databaseUrl, params.runId, {
			...(parsed.data.wallTime ? { wallTime: parsed.data.wallTime } : {}),
			owner: `web:${randomUUID()}`
		});
		return json(report, {
			status: report.result === 'lease_busy' ? 409 : 200,
			headers: { 'cache-control': 'no-store' }
		});
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'Catch-up could not be completed.' },
			{ status: 500 }
		);
	}
};
