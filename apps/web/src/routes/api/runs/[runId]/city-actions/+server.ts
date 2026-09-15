import { randomUUID } from 'node:crypto';

import { getConfig } from '@summonlab/config';
import { CityActionRequestSchema } from '@summonlab/contracts';
import {
	IdempotencyConflictError,
	StaleRunVersionError,
	commitEngineCommand,
	getCampaignRun,
	getEngineSnapshot
} from '@summonlab/database';
import { IllegalActionError } from '@summonlab/engine';
import { json } from '@sveltejs/kit';

import { cityActionCommand } from '$lib/server/city-actions';
import { campaignHeroIsSummoned } from '$lib/server/campaign';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const parsed = CityActionRequestSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return json(
			{ message: 'Choose a valid resident action from the current City state.' },
			{ status: 400 }
		);
	}

	try {
		const config = getConfig();
		const [snapshot, campaign] = await Promise.all([
			getEngineSnapshot(config.databaseUrl, params.runId),
			getCampaignRun(config.databaseUrl, params.runId)
		]);
		if (!snapshot) return json({ message: 'Engine run not found.' }, { status: 404 });
		if (campaign && !campaignHeroIsSummoned(campaign, parsed.data.heroId)) {
			return json({ message: 'The requested hero has not been summoned.' }, { status: 409 });
		}
		const command = cityActionCommand(snapshot, parsed.data, randomUUID());
		const committed = await commitEngineCommand(config.databaseUrl, command);
		const hero = committed.snapshot.state.heroes[parsed.data.heroId];
		return json(
			{
				runId: committed.snapshot.state.runId,
				version: committed.snapshot.state.version,
				eventCursor: committed.snapshot.state.eventCursor,
				heroId: parsed.data.heroId,
				assignment: hero && 'assignment' in hero ? hero.assignment : null
			},
			{ headers: { 'cache-control': 'no-store' } }
		);
	} catch (error) {
		if (
			error instanceof StaleRunVersionError ||
			error instanceof IdempotencyConflictError ||
			error instanceof IllegalActionError
		) {
			return json(
				{
					code: error.code,
					message: error.message,
					...(error instanceof IllegalActionError ? { legalActionIds: error.legalActionIds } : {})
				},
				{ status: 409 }
			);
		}
		const message =
			error instanceof Error ? error.message : 'The City action could not be recorded.';
		const status = message.includes('does not belong') ? 404 : 409;
		return json({ message }, { status });
	}
};
