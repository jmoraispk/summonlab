import { getConfig } from '@summonlab/config';
import {
	catchUpRun,
	getEngineEventHead,
	getEngineSnapshot,
	getProofRun,
	getSimulationClock
} from '@summonlab/database';
import { HEARTH_01_DEFINITION, loadHearth01Scene } from '@summonlab/content';
import { RuntimeVisualManifestSchema } from '@summonlab/contracts';
import { projectSettlementPresentation } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import runtimeVisualManifestSource from '../../../../static/runtime/visual-catalog-v1/manifest.json';

import { campaignExperienceView } from '$lib/server/campaign';

import type { PageServerLoad } from './$types';

const runtimeVisualManifest = RuntimeVisualManifestSchema.parse(runtimeVisualManifestSource);

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const snapshot = await getProofRun(config.databaseUrl, params.runId).catch(() => null);
	if (!snapshot) error(404, 'This proof run could not be found. Is the local database running?');
	if (!snapshot.destination) error(409, 'This hero has not made a first choice yet.');
	let clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => null);
	if (snapshot.arrived) {
		if (clock && clock.backlogGameMinutes >= 1) {
			await catchUpRun(config.databaseUrl, params.runId, { owner: 'play-reconnect' }).catch(
				() => null
			);
			clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => clock);
		}
	}
	const eventHead = await getEngineEventHead(config.databaseUrl, params.runId).catch(() => null);
	if (!eventHead) error(404, 'This run has no authoritative event cursor.');
	const engineSnapshot = await getEngineSnapshot(config.databaseUrl, params.runId).catch(
		() => null
	);
	const presentation =
		engineSnapshot && clock
			? projectSettlementPresentation(engineSnapshot, HEARTH_01_DEFINITION, clock.projectedGameTime)
			: null;
	const campaignView = await campaignExperienceView(config.databaseUrl, params.runId).catch(
		() => null
	);
	const heroPortrait = runtimeVisualManifest.bundles
		.flatMap((bundle) => bundle.assets)
		.find(
			(asset) => asset.sourceAssetKey === snapshot.manifest.artKey && asset.usage === 'dialogue'
		);
	return {
		snapshot,
		clock,
		eventHead,
		presentation,
		campaignView,
		heroPortrait: heroPortrait
			? {
					publicPath: heroPortrait.publicPath,
					width: heroPortrait.width,
					height: heroPortrait.height
				}
			: null,
		scene: await loadHearth01Scene()
	};
};
