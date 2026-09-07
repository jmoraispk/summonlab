import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateSummonableCompany } from '@summonlab/characters';
import type {
	CampaignControlMode,
	CampaignHero,
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

import { projectProofManifestForPublic } from './proof-presentation';
import { hashPublicProjection } from './public-projection-hash';

function words(value: string): string {
	return value.replaceAll('-', ' ');
}

function publicDemeanor(draft: CharacterDraft) {
	return {
		summary: `${draft.manifest.displayName} presents as ${words(draft.mind.socialStyle)} and appears guided by ${words(draft.mind.primaryValue)}.`,
		dailyRhythm: `Often ${words(draft.mind.dailyHabit)}.`,
		underPressure: `Tends to ${words(draft.mind.stressResponse)} under pressure.`,
		drive: `Seems driven to ${words(draft.mind.primaryDrive)}.`
	};
}

export function projectCampaignRunForPublic(campaign: CampaignRun) {
	return {
		runId: campaign.runId,
		controlMode: campaign.controlMode,
		lifecycle: campaign.lifecycle,
		engineStatus: campaign.engineStatus,
		onboardingStep: campaign.onboardingStep,
		restartedFromRunId: campaign.restartedFromRunId,
		heroes: campaign.heroes.map((hero) => ({
			ordinal: hero.ordinal,
			...projectProofManifestForPublic(hero.draft.manifest)
		})),
		createdAt: campaign.createdAt,
		updatedAt: campaign.updatedAt
	};
}

export type PublicCampaignRun = ReturnType<typeof projectCampaignRunForPublic>;

export function projectCampaignHeroForPublic(
	hero: CampaignHero,
	firstReply: null | {
		readonly exactText: string;
		readonly publicReason: string;
		readonly sourceEventId: string;
	}
) {
	return {
		ordinal: hero.ordinal,
		...projectProofManifestForPublic(hero.draft.manifest),
		demeanor: publicDemeanor(hero.draft),
		firstReply
	};
}

export function projectCampaignObjectivesForPublic(
	objectives: ReturnType<typeof projectCampaignObjectives>
) {
	const projection = {
		projectionVersion: objectives.projectionVersion,
		runId: objectives.runId,
		activeObjectiveId: objectives.activeObjectiveId,
		completedCount: objectives.completedCount,
		objectives: objectives.objectives.map((objective) => ({
			objectiveId: objective.objectiveId,
			chapter: objective.chapter,
			title: objective.title,
			detail: objective.detail,
			status: objective.status,
			evidence: [...objective.evidence]
		}))
	};
	return {
		...projection,
		publicProjectionHash: hashPublicProjection('campaign-objectives', projection)
	};
}

export type PublicCampaignObjectives = ReturnType<typeof projectCampaignObjectivesForPublic>;

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
	const objectives = projectCampaignObjectivesForPublic(
		projectCampaignObjectives({
			campaign,
			snapshot,
			firstDestinationChosen: proof.destination !== null
		})
	);
	const turns = Object.values(snapshot.state.society.conversationTurns);
	const turnsByHero = turns.reduce((map, turn) => {
		const current = map.get(turn.heroId);
		if (!current || turn.occurredAt.localeCompare(current.occurredAt) < 0) {
			map.set(turn.heroId, turn);
		}
		return map;
	}, new Map<string, (typeof turns)[number]>());
	return {
		campaign: projectCampaignRunForPublic(campaign),
		objectives,
		firstDestination: proof.destination,
		heroes: campaign.heroes.map((hero) => {
			const firstTurn = turnsByHero.get(hero.draft.manifest.characterId);
			return projectCampaignHeroForPublic(
				hero,
				firstTurn
					? {
							exactText: firstTurn.response.exactText,
							publicReason: firstTurn.response.publicReason,
							sourceEventId: firstTurn.sourceEventId
						}
					: null
			);
		})
	};
}

export function campaignResumePath(campaign: CampaignRun): string {
	return campaign.onboardingStep < 3 ? `/onboarding/${campaign.runId}` : `/play/${campaign.runId}`;
}
