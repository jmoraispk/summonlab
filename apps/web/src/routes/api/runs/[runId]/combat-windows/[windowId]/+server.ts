import { getConfig } from '@summonlab/config';
import {
	applyCombatDecisionWindowBatch,
	getCombatDecisionWindow,
	refreshCombatDecisionWindow
} from '@summonlab/database';
import { json } from '@sveltejs/kit';

import { projectCombatWindowStatus } from '$lib/server/combat-window-presentation';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const config = getConfig();
	try {
		const found = await getCombatDecisionWindow(config.databaseUrl, params.windowId);
		if (!found || found.runId !== params.runId) {
			return json({ message: 'Combat decision window not found.' }, { status: 404 });
		}
		const refreshed = await refreshCombatDecisionWindow(config.databaseUrl, params.windowId);
		if (refreshed.status !== 'ready' || !refreshed.batch) {
			return json(projectCombatWindowStatus(refreshed));
		}
		const applied = await applyCombatDecisionWindowBatch(
			config.databaseUrl,
			params.windowId,
			refreshed.batch
		);
		return json(projectCombatWindowStatus(applied.window));
	} catch (error) {
		console.error('Combat decision window refresh failed', error);
		return json({ message: 'The combat decision status could not be refreshed.' }, { status: 500 });
	}
};
