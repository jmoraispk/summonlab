import { generateSummonableCharacterDraft } from '@summonlab/characters';
import { EngineGameStateV25Schema } from '@summonlab/contracts';
import { createBootstrapEngine, deterministicUuid } from '@summonlab/engine';
import { describe, expect, it } from 'vitest';

import { projectMissionReadinessForPublic } from './mission-readiness.js';

async function fixture() {
	const draft = await generateSummonableCharacterDraft(
		{
			seed: 'web-mission-readiness',
			generationVersion: 'human-v6',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		},
		{ capabilityEntropy: '5'.repeat(64) }
	);
	const state = createBootstrapEngine({
		runId: deterministicUuid('web-mission-readiness-run'),
		seed: 'web-mission-readiness-engine',
		draft
	}).snapshot.state;
	if (state.schemaVersion !== 25) throw new Error('Expected engine-v25 fixture');
	return { state, heroId: draft.manifest.characterId };
}

describe('public mission readiness', () => {
	it('projects one strict ready DTO from the engine readiness owner', async () => {
		const { state, heroId } = await fixture();

		expect(projectMissionReadinessForPublic(state, heroId)).toStrictEqual({
			canPrepare: true,
			partyReason: null,
			hero: {
				heroId,
				status: 'ready',
				reason: 'At the Tower Threshold.',
				canSelect: true,
				canRequestReturn: false
			}
		});
	});

	it('makes an idle away hero recoverable but never calls a busy hero ready', async () => {
		const { state, heroId } = await fixture();
		const away = EngineGameStateV25Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[heroId]: {
					...state.heroes[heroId]!,
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true
				}
			}
		});
		expect(projectMissionReadinessForPublic(away, heroId)).toStrictEqual({
			canPrepare: false,
			partyReason: 'Away from the Tower Threshold.',
			hero: {
				heroId,
				status: 'unavailable',
				reason: 'Away from the Tower Threshold.',
				canSelect: false,
				canRequestReturn: true
			}
		});

		const busy = EngineGameStateV25Schema.parse({
			...away,
			heroes: {
				...away.heroes,
				[heroId]: {
					...away.heroes[heroId]!,
					currentActivity: {
						activityId: deterministicUuid('web-mission-readiness-activity'),
						scheduledEventId: deterministicUuid('web-mission-readiness-schedule'),
						kind: 'rest',
						startedAt: state.simulatedAt,
						completesAt: '2000-01-01T01:00:00.000Z'
					}
				}
			}
		});
		expect(projectMissionReadinessForPublic(busy, heroId)).toMatchObject({
			canPrepare: false,
			hero: {
				status: 'unavailable',
				reason: 'Finishing another activity.',
				canSelect: false,
				canRequestReturn: false
			}
		});
	});
});
