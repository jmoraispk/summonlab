import { generateSummonableCharacterDraft } from '@summonlab/characters';
import { EngineGameStateV25Schema } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { createBootstrapEngine } from '../../orchestration/bootstrap.js';
import { applyCommand } from '../../orchestration/apply-command.js';
import { deterministicUuid } from '../../hash.js';
import {
	assertMissionPartyReady,
	missionHeroReadiness,
	missionPreparationReadiness
} from './lifecycle.js';

async function fixture() {
	const draft = await generateSummonableCharacterDraft(
		{
			seed: 'mission-readiness-v25',
			generationVersion: 'human-v6',
			cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
		},
		{ capabilityEntropy: '6'.repeat(64) }
	);
	const state = createBootstrapEngine({
		runId: deterministicUuid('mission-readiness-v25-run'),
		seed: 'mission-readiness-v25-engine',
		draft
	}).snapshot.state;
	if (state.schemaVersion !== 25) throw new Error('Expected engine-v25 fixture');
	return { state, heroId: draft.manifest.characterId };
}

describe('mission party readiness', () => {
	it('uses one readiness owner for assertion and public-facing reason codes', async () => {
		const { state, heroId } = await fixture();

		expect(missionHeroReadiness(state, heroId)).toStrictEqual({
			heroId,
			ready: true,
			reason: 'ready'
		});
		expect(missionPreparationReadiness(state, [heroId])).toStrictEqual({
			ready: true,
			reason: 'ready',
			blockedHeroId: null
		});
		expect(() => assertMissionPartyReady(state, [heroId])).not.toThrow();

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
		expect(missionHeroReadiness(away, heroId)).toStrictEqual({
			heroId,
			ready: false,
			reason: 'away-from-threshold'
		});
		expect(missionPreparationReadiness(away, [heroId])).toStrictEqual({
			ready: false,
			reason: 'away-from-threshold',
			blockedHeroId: heroId
		});
		expect(() => assertMissionPartyReady(away, [heroId])).toThrow('mission.party');

		const wrongGateNode = EngineGameStateV25Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[heroId]: {
					...state.heroes[heroId]!,
					locationNodeId: 'gate-rail',
					firstArrivalCompleted: true
				}
			}
		});
		expect(missionHeroReadiness(wrongGateNode, heroId).reason).toBe('away-from-threshold');
	});

	it('distinguishes every conflicting hero precondition without calling an action ready', async () => {
		const { state, heroId } = await fixture();
		const activityId = deterministicUuid('mission-readiness-activity');
		const scheduleId = deterministicUuid('mission-readiness-schedule');
		const busy = EngineGameStateV25Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[heroId]: {
					...state.heroes[heroId]!,
					currentActivity: {
						activityId,
						scheduledEventId: scheduleId,
						kind: 'rest',
						startedAt: state.simulatedAt,
						completesAt: '2000-01-01T01:00:00.000Z'
					}
				}
			}
		});

		expect(missionHeroReadiness(busy, heroId)).toStrictEqual({
			heroId,
			ready: false,
			reason: 'active-activity'
		});
		expect(missionHeroReadiness(state, deterministicUuid('missing-readiness-hero'))).toMatchObject({
			ready: false,
			reason: 'hero-not-found'
		});
	});

	it('records a v25 Master readiness request through legal replayable travel', async () => {
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
		const commandId = deterministicUuid('mission-readiness-return-command');
		const returning = applyCommand(away, {
			commandId,
			runId: away.runId,
			actorId: heroId,
			expectedVersion: away.version,
			correlationId: commandId,
			source: {
				source: 'system',
				timing: null,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'hero.start.travel',
			targetNodeId: 'gate-dais',
			requestContext: 'mission-readiness'
		});

		expect(returning.events[0]).toMatchObject({
			eventType: 'hero.travel.started',
			actorId: heroId,
			source: { source: 'system', timing: null },
			payload: {
				requestContext: 'mission-readiness',
				summary: expect.stringContaining("At the Master's request")
			}
		});
		expect(returning.scheduled).toHaveLength(1);
		const arrival = returning.scheduled[0]!;
		const advanceId = deterministicUuid('mission-readiness-return-advance');
		const arrived = applyCommand(returning.state, {
			commandId: advanceId,
			runId: returning.state.runId,
			actorId: returning.state.master.masterId,
			expectedVersion: returning.state.version,
			correlationId: commandId,
			source: {
				source: 'system',
				timing: null,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'simulation.advance',
			targetGameTime: arrival.dueGameTime
		});
		expect(arrived.state.heroes[heroId]).toMatchObject({
			location: 'summoning-gate',
			locationNodeId: 'gate-dais',
			currentTravel: null
		});
		if (arrived.state.schemaVersion !== 25) throw new Error('Expected arrived v25 state');
		expect(missionPreparationReadiness(arrived.state, [heroId]).ready).toBe(true);
	});
});
