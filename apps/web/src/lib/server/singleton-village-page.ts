import { HEARTH_01_DEFINITION, loadHearth01Scene } from '@summonlab/content';
import type { CampaignRun } from '@summonlab/contracts';
import {
	catchUpRun,
	getEngineEventHead,
	getEngineSnapshot,
	getProofRun,
	getSimulationClock
} from '@summonlab/database';
import { projectSettlementPresentation } from '@summonlab/engine';
import { error } from '@sveltejs/kit';

import type { CityMode, CityResidentSource } from '$lib/city';

import { campaignExperienceView } from './campaign';
import { projectCityView } from './city';
import { projectEquipmentWorkshop } from './equipment-runtime';
import { runtimePortraitFor } from './runtime-portraits';

async function loadCampaignPage(databaseUrl: string, campaign: CampaignRun, mode: CityMode) {
	const snapshot = await getProofRun(databaseUrl, campaign.runId).catch(() => null);
	if (!snapshot) error(404, 'This proof run could not be found. Is the local database running?');
	let engineSnapshot = await getEngineSnapshot(databaseUrl, campaign.runId).catch(() => null);
	const equipmentHistory = engineSnapshot?.state.schemaVersion === 24;
	let clock = await getSimulationClock(databaseUrl, campaign.runId).catch(() => null);
	if (snapshot.arrived || equipmentHistory) {
		if (clock && clock.backlogGameMinutes >= 1) {
			await catchUpRun(databaseUrl, campaign.runId, { owner: 'play-reconnect' }).catch(() => null);
			clock = await getSimulationClock(databaseUrl, campaign.runId).catch(() => clock);
			engineSnapshot = await getEngineSnapshot(databaseUrl, campaign.runId).catch(
				() => engineSnapshot
			);
		}
	}
	const eventHead = await getEngineEventHead(databaseUrl, campaign.runId).catch(() => null);
	if (!eventHead) error(404, 'This run has no authoritative event cursor.');
	const presentation =
		engineSnapshot && clock && engineSnapshot.state.schemaVersion <= 13
			? projectSettlementPresentation(engineSnapshot, HEARTH_01_DEFINITION, clock.projectedGameTime)
			: null;
	const equipment =
		engineSnapshot?.state.schemaVersion === 24
			? projectEquipmentWorkshop(engineSnapshot, snapshot.manifest.characterId)
			: null;
	const campaignView = await campaignExperienceView(databaseUrl, campaign.runId).catch(() => null);
	if (engineSnapshot?.state.schemaVersion === 13) {
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
	const citySummonHeroes = campaignView
		? campaignView.heroes.map((hero) => {
				const summonArt = runtimePortraitFor(
					hero.draft.manifestHash,
					hero.draft.manifest.artKey,
					'summon'
				);
				if (!summonArt) {
					error(503, `${hero.draft.manifest.displayName} has no approved summon portrait.`);
				}
				return {
					heroId: hero.draft.manifest.characterId,
					ordinal: hero.ordinal as 1 | 2 | 3,
					name: hero.draft.manifest.displayName,
					rarityStars: hero.draft.manifest.rarityStars,
					adultAge: hero.draft.manifest.adultAge,
					heightCm: hero.draft.manifest.heightCm,
					bodyBuild: hero.draft.manifest.bodyBuild,
					voice: hero.draft.manifest.voice.cadence,
					role: hero.draft.manifest.visualRole ?? 'resident',
					primaryValue: hero.draft.mind.primaryValue,
					primaryDrive: hero.draft.mind.primaryDrive,
					socialStyle: hero.draft.mind.socialStyle,
					stressResponse: hero.draft.mind.stressResponse,
					dailyHabit: hero.draft.mind.dailyHabit,
					summonArt,
					rosterArt: runtimePortraitFor(
						hero.draft.manifestHash,
						hero.draft.manifest.artKey,
						'roster'
					),
					firstReply: hero.firstReply
						? {
								exactText: hero.firstReply.exactText,
								publicReason: hero.firstReply.publicReason
							}
						: null
				};
			})
		: [];
	const cityResidents: readonly CityResidentSource[] =
		campaignView && cityState
			? campaignView.heroes.slice(0, campaign.summonedHeroCount).map((hero) => {
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
						mode,
						scene,
						presentation,
						residents: cityResidents,
						campaign,
						summonHeroes: citySummonHeroes,
						visibleHeroIds: campaign.heroes
							.slice(0, campaign.summonedHeroCount)
							.map((hero) => hero.draft.manifest.characterId),
						objectives: campaignView.objectives,
						inventory: equipment,
						eventCue: null
					})
				: null,
		heroPortrait,
		scene
	};
}

export type CampaignPageData = Awaited<ReturnType<typeof loadCampaignPage>>;

export async function loadSingletonVillagePage(input: {
	readonly databaseUrl: string;
	readonly campaign: CampaignRun;
	readonly mode: CityMode;
}): Promise<CampaignPageData> {
	return loadCampaignPage(input.databaseUrl, input.campaign, input.mode);
}
