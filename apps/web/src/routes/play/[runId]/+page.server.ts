import { getConfig } from '@summonlab/config';
import {
	catchUpRun,
	getEngineEventHead,
	getEngineSnapshot,
	getProofRun,
	getSimulationClock
} from '@summonlab/database';
import { HEARTH_01_DEFINITION, loadHearth01Scene } from '@summonlab/content';
import { projectSettlementPresentation } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import { campaignExperienceView } from '$lib/server/campaign';
import { projectEquipmentWorkshop } from '$lib/server/equipment-runtime';
import { runtimePortraitFor } from '$lib/server/runtime-portraits';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const config = getConfig();
	const snapshot = await getProofRun(config.databaseUrl, params.runId).catch(() => null);
	if (!snapshot) error(404, 'This proof run could not be found. Is the local database running?');
	let engineSnapshot = await getEngineSnapshot(config.databaseUrl, params.runId).catch(() => null);
	const equipmentHistory = engineSnapshot?.state.schemaVersion === 24;
	if (!snapshot.destination && !equipmentHistory) {
		error(409, 'This hero has not made a first choice yet.');
	}
	let clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => null);
	if (snapshot.arrived || equipmentHistory) {
		if (clock && clock.backlogGameMinutes >= 1) {
			await catchUpRun(config.databaseUrl, params.runId, { owner: 'play-reconnect' }).catch(
				() => null
			);
			clock = await getSimulationClock(config.databaseUrl, params.runId).catch(() => clock);
			engineSnapshot = await getEngineSnapshot(config.databaseUrl, params.runId).catch(
				() => engineSnapshot
			);
		}
	}
	const eventHead = await getEngineEventHead(config.databaseUrl, params.runId).catch(() => null);
	if (!eventHead) error(404, 'This run has no authoritative event cursor.');
	const presentation =
		engineSnapshot && clock && engineSnapshot.state.schemaVersion <= 13
			? projectSettlementPresentation(engineSnapshot, HEARTH_01_DEFINITION, clock.projectedGameTime)
			: null;
	const equipment =
		engineSnapshot?.state.schemaVersion === 24
			? projectEquipmentWorkshop(engineSnapshot, snapshot.manifest.characterId)
			: null;
	const campaignView = await campaignExperienceView(config.databaseUrl, params.runId).catch(
		() => null
	);
	const heroPortrait = runtimePortraitFor(
		snapshot.manifestHash,
		snapshot.manifest.artKey,
		'dialogue'
	);
	return {
		snapshot,
		clock,
		eventHead,
		presentation,
		equipment,
		campaignView,
		heroPortrait,
		scene: await loadHearth01Scene()
	};
};
