import type { ActionSource, AuthoritativeEvent } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { projectPlayerJournal } from './journal.js';

const runId = '00000000-0000-4000-8000-000000000099';
const masterId = '00000000-0000-4000-8000-000000000001';
const heroId = '00000000-0000-4000-8000-000000000002';
const monsterId = '00000000-0000-4000-8000-000000000003';
const attemptId = '00000000-0000-4000-8000-000000000004';
const directionId = '00000000-0000-4000-8000-000000000005';

const systemSource: ActionSource = {
	source: 'system',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

const manualSource: ActionSource = {
	...systemSource,
	source: 'manual',
	timing: 'wait'
};

const directedSource: ActionSource = {
	...systemSource,
	source: 'directed',
	timing: 'step',
	fallbackPolicy: 'directed'
};

function event(
	sequence: number,
	eventType: string,
	payload: Record<string, unknown>,
	source: ActionSource = systemSource,
	actorId: string | null = masterId
): AuthoritativeEvent {
	return {
		eventId: `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`,
		runId,
		sequence,
		schemaVersion: 20,
		gameTime: `2000-01-0${sequence < 6 ? 1 : 2}T0${sequence}:00:00.000Z`,
		eventType,
		actorId,
		commandId: `00000000-0000-4000-a000-${String(sequence).padStart(12, '0')}`,
		causationId: null,
		correlationId: `00000000-0000-4000-b000-${String(sequence).padStart(12, '0')}`,
		source,
		seedCursor: sequence,
		beforeStateHash: String(sequence - 1)
			.repeat(64)
			.slice(0, 64),
		afterStateHash: String(sequence).repeat(64).slice(0, 64),
		contentVersion: 'engine-v20',
		payload: { summary: eventType.replaceAll('.', ' '), rewardDeltas: [], ...payload }
	};
}

function mission(status: string, roundNumber = 0, completed = false, discovered = false) {
	return {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: 'a'.repeat(64)
		},
		evidence: {},
		attemptCount: 1,
		attempt: {
			attemptId,
			ordinal: 1,
			status,
			party: { masterId, heroIds: [heroId], memberIds: [masterId, heroId] },
			knowledge: {
				discoveryIds: discovered ? ['erased-muster-oath'] : [],
				visitedNodeIds: ['tower-threshold']
			},
			completedObjectiveIds: completed ? ['recover-first-ember'] : [],
			turnState: {
				roundNumber,
				monsters: {
					[monsterId]: {
						monsterId,
						status: roundNumber > 0 ? 'defeated' : 'active'
					}
				}
			}
		}
	};
}

function fixtureEvents(): AuthoritativeEvent[] {
	return [
		event(
			1,
			'run.initialized',
			{
				initialState: {
					master: { masterId },
					heroes: { [heroId]: { heroId } },
					mission: {
						binding: {
							missionId: 'tower-floor-01',
							contentVersion: 'tower-floor-01-v1',
							contentHash: 'a'.repeat(64)
						},
						attempt: null
					}
				},
				rewardDeltas: [
					{
						ownerId: masterId,
						kind: 'resource',
						key: 'food',
						before: 0,
						after: 3,
						delta: 3
					}
				]
			},
			systemSource,
			null
		),
		event(2, 'simulation.advanced', {
			rewardDeltas: [
				{
					ownerId: heroId,
					kind: 'experience',
					key: 'hero',
					before: 8,
					after: 16,
					delta: 8
				},
				{
					ownerId: heroId,
					kind: 'level',
					key: 'hero',
					before: 1,
					after: 2,
					delta: 1
				}
			]
		}),
		event(
			3,
			'master.fallback.changed',
			{
				masterControl: {
					fallback: {
						directionId,
						directionText: 'Recover the Ember without abandoning the company.',
						priorities: ['focus-objective', 'protect-party']
					}
				}
			},
			manualSource
		),
		event(4, 'mission.preparation.started', { mission: mission('preparing') }, manualSource),
		event(5, 'mission.deployed', { mission: mission('deployed') }, manualSource),
		event(
			6,
			'mission.round.resolved',
			{
				mission: mission('extraction', 1, true, true),
				round: {
					actions: [
						{
							actorId: masterId,
							actorKind: 'master',
							actionId: 'mission.recover.first-ember',
							choiceSource: 'scripted',
							policyId: 'master-directed-v1',
							publicIntent: 'Recover the First Ember.',
							outcome: 'applied'
						},
						{
							actorId: heroId,
							actorKind: 'hero',
							actionId: 'mission.inspect.erased-muster-oath',
							choiceSource: 'scripted',
							policyId: 'personality-scripted-v1',
							publicIntent: 'Read the erased company names.',
							outcome: 'applied'
						}
					],
					monsterActions: [
						{
							monsterId,
							actionId: 'monster.hold.chain-court',
							policyId: 'chain-court-guard-v1',
							summary: 'The guard held too late.',
							outcome: 'superseded'
						}
					]
				},
				decisionResolution: {
					outcome: 'fallback',
					fallback: {
						directionId,
						directionText: 'Recover the Ember without abandoning the company.',
						priorities: ['focus-objective', 'protect-party']
					},
					fallbackSelection: {
						classification: 'classified',
						explanation: 'Recover advances the objective and preserves the party.'
					}
				},
				consequences: [
					{
						fatal: true
					}
				]
			},
			directedSource
		)
	];
}

describe('player journal projection', () => {
	it('accepts the canonical readiness choice-batch event discriminator', () => {
		const report = projectPlayerJournal([
			...fixtureEvents(),
			event(7, 'mission.combat.choice-batch.applied', {
				mission: mission('resolving', 2),
				resolvedEvents: []
			})
		]);

		expect(report.entries.at(-1)?.eventType).toBe('mission.combat.choice-batch.applied');
	});

	it('projects authoritative deltas, actions, direction, story, and party progress', () => {
		const report = projectPlayerJournal(fixtureEvents());

		expect(report).toMatchObject({
			reportVersion: 'player-journal-v1',
			entryCount: 6,
			fromCursor: 1,
			toCursor: 6,
			partyTotals: {
				attemptsStarted: 1,
				deployments: 1,
				roundsResolved: 1,
				objectivesCompleted: 1,
				discoveries: 1,
				threatsDefeated: 1,
				casualties: 1
			}
		});
		expect(report.deltaTotals).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ ownerId: masterId, kind: 'resource', key: 'food', delta: 3 }),
				expect.objectContaining({ ownerId: heroId, kind: 'experience', delta: 8 }),
				expect.objectContaining({ ownerId: heroId, kind: 'level', delta: 1 })
			])
		);
		expect(report.filterOptions).toMatchObject({
			days: [1, 2],
			missionIds: ['tower-floor-01'],
			floors: [1],
			heroIds: [heroId]
		});
		const round = report.entries.at(-1)!;
		expect(round.stateHash).toBe('6'.repeat(64));
		expect(round.facets).toEqual(
			expect.arrayContaining(['action', 'combat', 'party', 'direction', 'story', 'failure'])
		);
		expect(round.actions).toHaveLength(3);
		expect(round.actions[0]).toMatchObject({
			actorId: masterId,
			decisionSource: 'directed',
			actionId: 'mission.recover.first-ember'
		});
		expect(round.directions[0]).toMatchObject({
			directionId,
			kind: 'fallback',
			outcome: 'selected'
		});
		expect(round.storyChanges.map((change) => change.kind)).toEqual(['objective', 'discovery']);
		expect(round.replayCursor).toBe(6);
	});

	it('binds both event cursor hashes and the complete report deterministically', () => {
		const events = fixtureEvents();
		const first = projectPlayerJournal(events);
		const second = projectPlayerJournal(structuredClone(events));
		expect(second).toEqual(first);

		const changed = structuredClone(events);
		changed.at(-1)!.afterStateHash = 'f'.repeat(64);
		const changedReport = projectPlayerJournal(changed);
		expect(changedReport.eventStreamHash).not.toBe(first.eventStreamHash);
		expect(changedReport.reportHash).not.toBe(first.reportHash);
	});
});
