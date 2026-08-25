import { generateCharacterDraft, recipeFromSeed } from '@summonlab/characters';
import { CampaignRunSchema, type EngineCommand, type EngineSnapshot } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	projectCampaignObjectives
} from './index.js';

describe('campaign objectives', () => {
	it('derives onboarding progress from canonical conversations and hash-binds the projection', async () => {
		const seed = 'campaign-objective-fixture';
		const drafts = await Promise.all(
			['ember', 'vow', 'lark'].map((role) =>
				generateCharacterDraft(recipeFromSeed(`${seed}:${role}`))
			)
		);
		const [primary, second, third] = drafts;
		if (!primary || !second || !third) throw new Error('Expected three deterministic drafts');
		const runId = deterministicUuid(`${seed}:run`);
		const bootstrap = createBootstrapEngine({
			runId,
			seed,
			heroId: primary.manifest.characterId,
			manifestHash: primary.manifestHash,
			rarityStars: primary.manifest.rarityStars,
			mind: primary.mind,
			additionalHeroes: [second, third].map((draft) => ({
				heroId: draft.manifest.characterId,
				manifestHash: draft.manifestHash,
				rarityStars: draft.manifest.rarityStars,
				mind: draft.mind
			}))
		});
		const campaign = CampaignRunSchema.parse({
			runId,
			campaignSeed: seed,
			controlMode: 'wait',
			lifecycle: 'active',
			engineStatus: 'active',
			onboardingStep: 2,
			restartedFromRunId: null,
			heroes: drafts.map((draft, index) => ({ ordinal: index + 1, draft })),
			createdAt: '2000-01-01T00:00:00.000Z',
			updatedAt: '2000-01-01T00:00:00.000Z'
		});

		const initial = projectCampaignObjectives({
			campaign,
			snapshot: bootstrap.snapshot,
			firstDestinationChosen: false
		});
		expect(initial.completedCount).toBe(2);
		expect(initial.activeObjectiveId).toBe('hear-each-first-voice');
		expect(
			projectCampaignObjectives({
				campaign,
				snapshot: bootstrap.snapshot,
				firstDestinationChosen: false
			}).projectionHash
		).toBe(initial.projectionHash);

		let snapshot: EngineSnapshot = bootstrap.snapshot;
		for (const [index, draft] of drafts.entries()) {
			const commandId = deterministicUuid(`${runId}:first-question:${index}`);
			const command: EngineCommand = {
				commandId,
				runId,
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
				exactText: 'What do you need to understand before deciding what comes next?',
				tone: 'reassuring',
				delivery: 'private',
				orderIntent: null
			};
			const committed = applyCommand(snapshot.state, command);
			snapshot = { state: committed.state, stateHash: committed.stateHash };
		}

		const heard = projectCampaignObjectives({
			campaign,
			snapshot,
			firstDestinationChosen: false
		});
		expect(heard.completedCount).toBe(3);
		expect(heard.activeObjectiveId).toBe('follow-the-first-choice');
		expect(heard.objectives[2]?.evidence).toHaveLength(3);
		expect(Object.keys(snapshot.state.heroes)).toHaveLength(3);
	});
});
