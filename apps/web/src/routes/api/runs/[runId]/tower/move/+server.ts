import { getConfig } from '@summonlab/config';
import { TOWER_FLOOR_01_EXPLORATION } from '@summonlab/content';
import { EngineGameStateV13Schema } from '@summonlab/contracts';
import {
	beginExplorationEncounter,
	commitExplorationTravel,
	getCampaignRun,
	getEngineSnapshot,
	getExplorationAttempt
} from '@summonlab/database';
import { applyExplorationTravel, planExplorationTravel } from '@summonlab/engine/exploration';
import { json } from '@sveltejs/kit';

import { buildTowerEncounterRequest } from '$lib/server/tower-encounter-request';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
	const body = (await request.json().catch(() => null)) as {
		attemptId?: string;
		expectedVersion?: number;
		destinationTileId?: string;
	} | null;
	if (!body?.attemptId || !Number.isInteger(body.expectedVersion) || !body.destinationTileId) {
		return json({ message: 'Choose a revealed Tower destination.' }, { status: 400 });
	}
	try {
		const config = getConfig();
		const current = await getExplorationAttempt(config.databaseUrl, body.attemptId);
		if (!current || current.state.runId !== params.runId) {
			return json({ message: 'Exploration attempt not found.' }, { status: 404 });
		}
		const travel = planExplorationTravel(
			TOWER_FLOOR_01_EXPLORATION,
			current.state,
			body.destinationTileId
		);
		const next = applyExplorationTravel(
			TOWER_FLOOR_01_EXPLORATION,
			current.state,
			travel.pathTileIds
		);
		let persisted = await commitExplorationTravel(config.databaseUrl, {
			attemptId: body.attemptId,
			expectedVersion: body.expectedVersion!,
			nextState: next,
			pathTileIds: travel.pathTileIds
		});
		const tile = TOWER_FLOOR_01_EXPLORATION.tiles.find(
			(candidate) => candidate.tileId === persisted.state.positionTileId
		);
		if (
			tile?.interaction?.kind === 'encounter' &&
			!persisted.state.resolvedInteractionTileIds.includes(tile.tileId)
		) {
			const [campaign, engine] = await Promise.all([
				getCampaignRun(config.databaseUrl, params.runId),
				getEngineSnapshot(config.databaseUrl, params.runId)
			]);
			if (!campaign || !engine || engine.state.schemaVersion !== 13) {
				throw new Error('The campaign party is unavailable for this encounter.');
			}
			const campaignState = EngineGameStateV13Schema.parse(engine.state);
			const heroes = persisted.state.partyHeroIds.map((heroId) => {
				const campaignHero = campaign.heroes.find(
					(candidate) => candidate.draft.manifest.characterId === heroId
				);
				const stateHero = campaignState.heroes[heroId];
				if (!campaignHero || !stateHero || stateHero.lifeState !== 'active') {
					throw new Error(`The Tower party no longer contains combat-capable hero ${heroId}.`);
				}
				return {
					heroId,
					manifestHash: campaignHero.draft.manifestHash,
					artKey: campaignHero.draft.manifest.artKey,
					displayName: campaignHero.draft.manifest.displayName,
					health: stateHero.health,
					maximumHealth: stateHero.maxHealth,
					level: stateHero.progression.level,
					equipment: stateHero.equipment
				};
			});
			const encounterRequest = buildTowerEncounterRequest({
				attempt: persisted.state,
				heroes,
				dutySlotId: tile.interaction.dutySlotId,
				observedGameTime: campaignState.simulatedAt
			});
			persisted = await beginExplorationEncounter(config.databaseUrl, {
				attemptId: body.attemptId,
				expectedVersion: persisted.state.version,
				request: encounterRequest
			});
		}
		return json({ attempt: persisted, travel }, { headers: { 'cache-control': 'no-store' } });
	} catch (error) {
		return json(
			{ message: error instanceof Error ? error.message : 'The company could not move.' },
			{ status: 409 }
		);
	}
};
