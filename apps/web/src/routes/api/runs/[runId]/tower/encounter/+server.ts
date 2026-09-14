import { getConfig } from '@summonlab/config';
import { getExplorationAttempt, settleExplorationEncounter } from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { resolveTowerEncounter, type TowerCombatMode } from '$lib/server/tower-encounter';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as {
		attemptId?: string;
		expectedVersion?: number;
		mode?: TowerCombatMode;
	} | null;
	if (
		!body?.attemptId ||
		!Number.isInteger(body.expectedVersion) ||
		(body.mode !== 'turn-based' && body.mode !== 'automated')
	) {
		return json({ message: 'Choose turn-based or automated combat.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const attempt = await getExplorationAttempt(config.databaseUrl, body.attemptId);
		if (!attempt || attempt.state.runId !== params.runId || !attempt.activeEncounter) {
			return json({ message: 'Active Tower encounter not found.' }, { status: 404 });
		}
		const receipt = resolveTowerEncounter({
			...attempt.activeEncounter,
			mode: body.mode
		});
		const settled = await settleExplorationEncounter(config.databaseUrl, {
			attemptId: body.attemptId,
			expectedVersion: body.expectedVersion!,
			receipt
		});
		return json(
			{ ...settled, summary: receipt.summary },
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The encounter could not settle.' },
			{ status: 409 }
		);
	}
};
