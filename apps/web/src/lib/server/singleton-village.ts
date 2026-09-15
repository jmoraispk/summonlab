import type { CampaignControlMode, CampaignRun, ClockSpeed } from '@summonlab/contracts';
import { getLatestActiveCampaignRun } from '@summonlab/database';

import { createPlayerCampaign } from './campaign';

export const SINGLETON_VILLAGE_SEED = 'hearth-01-singleton-v1';
export const SINGLETON_CONTROL_MODE: CampaignControlMode = 'wait';

export interface SingletonVillageDependencies<TCampaign> {
	readonly loadActive: () => Promise<TCampaign | null>;
	readonly create: () => Promise<TCampaign>;
}

export function createSingletonVillageResolver<TCampaign>(
	dependencies: SingletonVillageDependencies<TCampaign>
): () => Promise<TCampaign> {
	let inFlight: Promise<TCampaign> | null = null;

	return async () => {
		const active = await dependencies.loadActive();
		if (active) return active;

		inFlight ??= dependencies.create();
		const current = inFlight;
		try {
			return await current;
		} finally {
			if (inFlight === current) inFlight = null;
		}
	};
}

const runtimeResolvers = new Map<string, () => Promise<CampaignRun>>();

export function getOrCreateSingletonVillage(
	databaseUrl: string,
	clockSpeed: ClockSpeed
): Promise<CampaignRun> {
	const resolverKey = `${databaseUrl}\u0000${clockSpeed}`;
	let resolver = runtimeResolvers.get(resolverKey);
	if (!resolver) {
		resolver = createSingletonVillageResolver({
			loadActive: () => getLatestActiveCampaignRun(databaseUrl),
			create: () =>
				createPlayerCampaign({
					databaseUrl,
					campaignSeed: SINGLETON_VILLAGE_SEED,
					controlMode: SINGLETON_CONTROL_MODE,
					clockSpeed
				})
		});
		runtimeResolvers.set(resolverKey, resolver);
	}
	return resolver();
}
