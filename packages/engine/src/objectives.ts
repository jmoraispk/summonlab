import {
	CampaignObjectiveProjectionSchema,
	type CampaignObjective,
	type CampaignObjectiveProjection,
	type CampaignRun,
	type EngineSnapshot
} from '@summonlab/contracts';

import { hashCanonical } from './hash.js';

export interface CampaignObjectiveInput {
	readonly campaign: CampaignRun;
	readonly snapshot: EngineSnapshot;
	readonly firstDestinationChosen: boolean;
}

export function projectCampaignObjectives(
	input: CampaignObjectiveInput
): CampaignObjectiveProjection {
	const { campaign, snapshot } = input;
	const { state } = snapshot;
	if (state.schemaVersion !== 13) {
		throw new Error(
			`Campaign objectives require engine-v13, received engine-v${state.schemaVersion}`
		);
	}
	const heroIds = campaign.heroes.map((hero) => hero.draft.manifest.characterId);
	const heardHeroIds = new Set(
		Object.values(state.society.conversationTurns).map((turn) => turn.heroId)
	);
	const heardEveryHero = heroIds.every((heroId) => heardHeroIds.has(heroId));
	const firstEmberRecovered =
		state.settlement.firstEmber.status === 'available' ||
		state.settlement.firstEmber.status === 'committed';
	const definitions: ReadonlyArray<Omit<CampaignObjective, 'status'>> = [
		{
			objectiveId: 'wake-to-the-reserve-bell',
			chapter: 'Prologue · Last reserve',
			title: 'Reach the summoning gate',
			detail: 'Hearth 01 is on reserve power. Stand, find the gate, and learn what is still alive.',
			evidence: campaign.onboardingStep >= 1 ? ['The Master answered the reserve bell.'] : []
		},
		{
			objectiveId: 'summon-the-first-company',
			chapter: 'Prologue · Strangers at the gate',
			title: 'Summon the first company',
			detail:
				'Call three adult heroes into Hearth 01. They arrive without shared memories or allegiance.',
			evidence:
				campaign.summonedHeroCount === 3
					? [`Three stable identities are bound to ${campaign.campaignSeed}.`]
					: [`${campaign.summonedHeroCount} of 3 heroes have arrived.`]
		},
		{
			objectiveId: 'hear-each-first-voice',
			chapter: 'Prologue · No borrowed loyalty',
			title: 'Hear each hero answer',
			detail: 'Ask each stranger one real question. Their first answer becomes witnessed history.',
			evidence: heardEveryHero
				? heroIds.map((heroId) => `Hero ${heroId.slice(0, 8)} answered the Master.`)
				: [`${heardHeroIds.size} of ${heroIds.length} heroes have answered.`]
		},
		{
			objectiveId: 'forge-the-starter-arms',
			chapter: 'Prologue · A company needs tools',
			title: 'Make the starter gear',
			detail:
				'Use the Forge to make a spear, a bow, and a sword with shield for the first company.',
			evidence: []
		},
		{
			objectiveId: 'recover-the-first-ember',
			chapter: 'Floor 01 · The Unlit Muster',
			title: 'Recover the First Ember',
			detail: 'Prepare a party, enter Floor 01, recover the heavy core, and bring survivors home.',
			evidence: firstEmberRecovered ? ['The First Ember crossed the extraction boundary.'] : []
		},
		{
			objectiveId: 'bind-the-first-promise',
			chapter: 'Hearth 01 · One core, three needs',
			title: 'Choose what the Ember powers',
			detail: 'Power the kitchen, dormitory, or training ground and accept the social consequence.',
			evidence:
				state.settlement.firstEmber.status === 'committed'
					? [`The Ember is committed to ${state.settlement.firstEmber.buildingId}.`]
					: []
		},
		{
			objectiveId: 'cross-the-tower-threshold',
			chapter: 'Band 01 · Floors 01–05',
			title: 'Begin the tower campaign',
			detail:
				'Prepare the company and cross a tower threshold. The hundred-floor climb starts here.',
			evidence: state.mission.attempt
				? [`Attempt ${state.mission.attempt.attemptId.slice(0, 8)} entered canonical history.`]
				: []
		}
	];
	const completion = [
		campaign.onboardingStep >= 1,
		campaign.summonedHeroCount === 3,
		heardEveryHero,
		false,
		firstEmberRecovered,
		state.settlement.firstEmber.status === 'committed',
		state.mission.attempt !== null
	];
	const activeIndex = completion.findIndex((complete) => !complete);
	const objectives = definitions.map((objective, index) => ({
		...objective,
		status: completion[index]
			? ('complete' as const)
			: index === activeIndex
				? ('current' as const)
				: ('locked' as const)
	}));
	const projectionBase = {
		projectionVersion: 'campaign-objectives-v1' as const,
		runId: campaign.runId,
		stateHash: snapshot.stateHash,
		activeObjectiveId: activeIndex < 0 ? null : objectives[activeIndex]!.objectiveId,
		completedCount: completion.filter(Boolean).length,
		objectives
	};
	return CampaignObjectiveProjectionSchema.parse({
		...projectionBase,
		projectionHash: hashCanonical(projectionBase)
	});
}
