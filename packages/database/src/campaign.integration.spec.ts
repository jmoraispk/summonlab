import { randomUUID } from 'node:crypto';

import { FIRST_OBSERVATION, generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import type { EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { advanceCampaignOnboarding, getCampaignRun, registerCampaignRun } from './campaign.js';
import { commitEngineCommand, getEngineReplay, getEngineSnapshot } from './engine.js';
import { createProofRun } from './proof.js';

const databaseUrl = process.env.TEST_DATABASE_URL;
const run = databaseUrl ? it : it.skip;

describe('campaign persistence', () => {
	run('persists onboarding and restarts without destroying the prior replay', async () => {
		if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required');
		const testDatabaseUrl = databaseUrl;
		const seed = `campaign-${randomUUID()}`;
		const drafts = await Promise.all(
			['ember', 'vow', 'lark'].map((role) =>
				generateCharacterDraft(recipeFromSeed(`${seed}:${role}`))
			)
		);
		const [primary, second, third] = drafts;
		if (!primary || !second || !third) throw new Error('Expected three campaign drafts');
		const heroes = [primary, second, third] as const;

		async function createRun(runId: string) {
			await createProofRun(testDatabaseUrl, {
				runId,
				draft: heroes[0],
				engineSeed: seed,
				controlMode: 'wait',
				directive: 'Choose what you need before we enter the tower.',
				firstObservation: FIRST_OBSERVATION,
				choice: null,
				additionalHeroes: [heroes[1], heroes[2]].map((draft) => ({
					heroId: draft.manifest.characterId,
					manifestHash: draft.manifestHash,
					rarityStars: draft.manifest.rarityStars,
					mind: draft.mind
				}))
			});
		}

		const firstRunId = randomUUID();
		await createRun(firstRunId);
		await registerCampaignRun(databaseUrl, {
			runId: firstRunId,
			campaignSeed: seed,
			controlMode: 'wait',
			heroes
		});
		expect((await advanceCampaignOnboarding(databaseUrl, firstRunId, 1)).onboardingStep).toBe(1);
		expect((await advanceCampaignOnboarding(databaseUrl, firstRunId, 2)).onboardingStep).toBe(2);
		await expect(advanceCampaignOnboarding(databaseUrl, firstRunId, 3)).rejects.toThrow(
			'Each summoned hero must answer'
		);

		for (const [index, draft] of heroes.entries()) {
			const snapshot = await getEngineSnapshot(databaseUrl, firstRunId);
			if (!snapshot) throw new Error('Campaign engine snapshot disappeared');
			const commandId = randomUUID();
			const command: EngineCommand = {
				commandId,
				runId: firstRunId,
				actorId: snapshot.state.master.masterId,
				expectedVersion: snapshot.state.version,
				correlationId: commandId,
				source: {
					source: 'manual',
					timing: 'step',
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				},
				commandType: 'master.converse',
				targetHeroId: draft.manifest.characterId,
				kind: 'ask',
				exactText: `What do you need before the tower, summon ${index + 1}?`,
				tone: 'reassuring',
				delivery: 'private',
				orderIntent: null
			};
			await commitEngineCommand(databaseUrl, command);
		}
		expect((await advanceCampaignOnboarding(databaseUrl, firstRunId, 3)).onboardingStep).toBe(3);

		const secondRunId = randomUUID();
		await createRun(secondRunId);
		const restarted = await registerCampaignRun(databaseUrl, {
			runId: secondRunId,
			campaignSeed: seed,
			controlMode: 'countdown',
			heroes,
			restartedFromRunId: firstRunId
		});
		expect(restarted).toMatchObject({
			runId: secondRunId,
			restartedFromRunId: firstRunId,
			lifecycle: 'active',
			onboardingStep: 0
		});
		expect(await getCampaignRun(databaseUrl, firstRunId)).toMatchObject({
			lifecycle: 'superseded',
			onboardingStep: 3
		});
		const replay = await getEngineReplay(databaseUrl, firstRunId);
		expect(replay?.verified).toBe(true);
		expect(replay?.hashMatchesPersistedSnapshot).toBe(true);
	});
});
