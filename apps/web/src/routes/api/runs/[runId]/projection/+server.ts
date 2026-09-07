import { getConfig } from '@summonlab/config';
import { HEARTH_01_DEFINITION } from '@summonlab/content';
import { catchUpRun, getEngineSnapshot, getSimulationClock } from '@summonlab/database';
import { projectSettlementPresentation } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { projectSettlementForPublic } from '$lib/server/public-world-presentation';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const config = getConfig();
	try {
		let clock = await getSimulationClock(config.databaseUrl, params.runId);
		if (!clock) return json({ message: 'Simulation clock not found.' }, { status: 404 });
		if (clock.backlogGameMinutes >= 1) {
			await catchUpRun(config.databaseUrl, params.runId, { owner: 'projection-read' });
			clock = (await getSimulationClock(config.databaseUrl, params.runId)) ?? clock;
		}
		const snapshot = await getEngineSnapshot(config.databaseUrl, params.runId);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		return json(
			projectSettlementForPublic(
				projectSettlementPresentation(snapshot, HEARTH_01_DEFINITION, clock.projectedGameTime)
			),
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		console.error('Settlement projection failed', error);
		return json({ message: 'The settlement projection could not be read.' }, { status: 500 });
	}
};
