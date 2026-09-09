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

import { parseCityMode, type CityResidentSource } from '$lib/city';
import { campaignExperienceView } from '$lib/server/campaign';
import { projectCityView } from '$lib/server/city';
import { projectEquipmentWorkshop } from '$lib/server/equipment-runtime';
import { runtimePortraitFor } from '$lib/server/runtime-portraits';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
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
	if (snapshot.arrived && engineSnapshot?.state.schemaVersion === 13) {
		if (!presentation || !campaignView) {
			error(503, 'The authoritative City projection is temporarily unavailable.');
		}
	}
	const heroPortrait = runtimePortraitFor(
		snapshot.manifestHash,
		snapshot.manifest.artKey,
		'dialogue'
	);
	const scene = await loadHearth01Scene();
	const cityState = engineSnapshot?.state.schemaVersion === 13 ? engineSnapshot.state : null;
	const cityResidents: readonly CityResidentSource[] =
		campaignView && cityState
			? campaignView.heroes.map((hero) => {
					const heroId = hero.draft.manifest.characterId;
					const stateHero = cityState.heroes[heroId];
					return {
						heroId,
						ordinal: hero.ordinal,
						name: hero.draft.manifest.displayName,
						rarityStars: hero.draft.manifest.rarityStars,
						pronouns: hero.draft.manifest.pronouns,
						role: hero.draft.manifest.visualRole ?? 'resident',
						firstReply: hero.firstReply?.exactText ?? null,
						health: stateHero ? { current: stateHero.health, maximum: stateHero.maxHealth } : null,
						level: stateHero?.progression.level ?? null,
						detailRows: stateHero
							? [
									{ label: 'Hunger', value: `${stateHero.needs.hunger} / 100` },
									{ label: 'Fatigue', value: `${stateHero.needs.fatigue} / 100` },
									{
										label: 'Sword rank',
										value: String(stateHero.progression.skills.swordFighting.rank)
									}
								]
							: [],
						portrait: runtimePortraitFor(
							hero.draft.manifestHash,
							hero.draft.manifest.artKey,
							'roster'
						),
						sceneArt: runtimePortraitFor(
							hero.draft.manifestHash,
							hero.draft.manifest.artKey,
							'village-cutout'
						)
					};
				})
			: [];
	return {
		snapshot,
		clock,
		eventHead,
		presentation,
		equipment,
		campaignView,
		city:
			campaignView && presentation && cityState
				? projectCityView({
						mode: parseCityMode(url.searchParams.get('mode')),
						scene,
						presentation,
						residents: cityResidents,
						objectives: campaignView.objectives,
						inventory: equipment,
						eventCue: null
					})
				: null,
		heroPortrait,
		scene
	};
};
