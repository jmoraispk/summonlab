import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateSummonableCompany } from '@summonlab/characters';
import type {
	CampaignControlMode,
	CampaignRun,
	CharacterDraft,
	ClockSpeed
} from '@summonlab/contracts';
import {
	getCampaignRun,
	getEngineSnapshot,
	getProofRun,
	registerCampaignRun,
	createProofRun
} from '@summonlab/database';
import { projectCampaignObjectives } from '@summonlab/engine';

export async function generateCampaignCompany(
	campaignSeed: string
): Promise<readonly [CharacterDraft, CharacterDraft, CharacterDraft]> {
	const drafts = await generateSummonableCompany(campaignSeed, 3);
	const [first, second, third] = drafts;
	if (!first || !second || !third) throw new Error('Campaign company generation was incomplete');
	return [first, second, third];
}

export async function createPlayerCampaign(input: {
	readonly databaseUrl: string;
	readonly campaignSeed: string;
	readonly controlMode: CampaignControlMode;
	readonly clockSpeed: ClockSpeed;
	readonly restartedFromRunId?: string;
}) {
	const campaignSeed = input.campaignSeed.trim();
	const heroes = await generateCampaignCompany(campaignSeed);
	const [primary, second, third] = heroes;
	const runId = randomUUID();
	await createProofRun(input.databaseUrl, {
		runId,
		draft: primary,
		engineSeed: campaignSeed,
		controlMode: input.controlMode,
		directive: 'Choose what you need before we enter the tower.',
		firstObservation: FIRST_OBSERVATION,
		choice: null,
		clockSpeed: input.clockSpeed,
		additionalHeroes: [second, third].map((draft) => ({
			heroId: draft.manifest.characterId,
			manifestHash: draft.manifestHash,
			rarityStars: draft.manifest.rarityStars,
			mind: draft.mind
		}))
	});
	return registerCampaignRun(input.databaseUrl, {
		runId,
		campaignSeed,
		controlMode: input.controlMode,
		heroes,
		...(input.restartedFromRunId ? { restartedFromRunId: input.restartedFromRunId } : {})
	});
}

export async function campaignExperienceView(databaseUrl: string, runId: string) {
	const [campaign, proof, snapshot] = await Promise.all([
		getCampaignRun(databaseUrl, runId),
		getProofRun(databaseUrl, runId),
		getEngineSnapshot(databaseUrl, runId)
	]);
	if (!campaign || !proof || !snapshot) return null;
	if (snapshot.state.schemaVersion !== 13) {
		throw new Error(`Campaign run ${runId} is not using engine-v13`);
	}
	const objectives = projectCampaignObjectives({
		campaign,
		snapshot,
		firstDestinationChosen: proof.destination !== null
	});
	const turns = Object.values(snapshot.state.society.conversationTurns);
	const turnsByHero = turns.reduce((map, turn) => {
		const current = map.get(turn.heroId);
		if (!current || turn.occurredAt.localeCompare(current.occurredAt) < 0) {
			map.set(turn.heroId, turn);
		}
		return map;
	}, new Map<string, (typeof turns)[number]>());
	return {
		campaign,
		objectives,
		stateHash: snapshot.stateHash,
		firstDestination: proof.destination,
		heroes: campaign.heroes.map((hero) => {
			const firstTurn = turnsByHero.get(hero.draft.manifest.characterId);
			return {
				...hero,
				firstReply: firstTurn
					? {
							exactText: firstTurn.response.exactText,
							publicReason: firstTurn.response.publicReason,
							sourceEventId: firstTurn.sourceEventId
						}
					: null
			};
		})
	};
}

export function campaignResumePath(campaign: CampaignRun): string {
	void campaign;
	return '/village';
}
