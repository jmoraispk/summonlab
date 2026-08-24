import type { ActionSource, AuthoritativeEvent, ReturnRecapCounts } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { projectReturnRecap } from './recap.js';

const source: ActionSource = {
	source: 'habit',
	timing: 'continuous',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function event(
	sequence: number,
	eventType: string,
	payload: Record<string, unknown>
): AuthoritativeEvent {
	return {
		eventId: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
		runId: '00000000-0000-4000-8000-000000000099',
		sequence,
		schemaVersion: 5,
		gameTime: `2000-01-01T0${sequence}:00:00.000Z`,
		eventType,
		actorId: '00000000-0000-4000-8000-000000000010',
		commandId: `00000000-0000-4000-9000-${String(sequence).padStart(12, '0')}`,
		causationId: null,
		correlationId: `00000000-0000-4000-a000-${String(sequence).padStart(12, '0')}`,
		source,
		seedCursor: 0,
		beforeStateHash: 'a'.repeat(64),
		afterStateHash: 'b'.repeat(64),
		contentVersion: 'engine-v5',
		payload
	};
}

const counts: ReturnRecapCounts = {
	plansCreated: 1,
	routinesCompleted: 4,
	activitiesCompleted: 1,
	travelArrivals: 0,
	failures: 0,
	clockSyncs: 1
};

describe('return recap projection', () => {
	it('condenses authoritative activity while retaining exact cursors and deltas', () => {
		const recap = projectReturnRecap({
			runId: '00000000-0000-4000-8000-000000000099',
			fromCursor: 1,
			toCursor: 12,
			fromGameTime: '2000-01-01T00:00:00.000Z',
			toGameTime: '2000-01-01T06:00:00.000Z',
			candidateEvents: [
				event(2, 'hero.daily.plan.created', { summary: 'A four-part day was planned.' }),
				event(3, 'simulation.advanced', {
					summary: 'One daily routine resolved.',
					rewardDeltas: [
						{
							ownerId: '00000000-0000-4000-8000-000000000010',
							kind: 'experience',
							key: 'hero',
							before: 0,
							after: 8,
							delta: 8
						}
					]
				})
			],
			aggregate: {
				eventCount: 11,
				counts,
				deltas: [
					{
						ownerId: '00000000-0000-4000-8000-000000000010',
						kind: 'experience',
						key: 'hero',
						delta: 8
					}
				]
			}
		});

		expect(recap).toMatchObject({
			headline: 'A full settlement day unfolded.',
			spanGameMinutes: 360,
			eventCount: 11,
			omittedEventCount: 9,
			counts,
			deltas: [{ kind: 'experience', key: 'hero', delta: 8 }]
		});
		expect(recap.highlights.map((highlight) => highlight.replayCursor)).toEqual([2, 3]);
		expect(recap.summary).toContain('4 routines completed');
	});

	it('reports an unchanged settlement without inventing activity', () => {
		const recap = projectReturnRecap({
			runId: '00000000-0000-4000-8000-000000000099',
			fromCursor: 12,
			toCursor: 12,
			fromGameTime: '2000-01-01T06:00:00.000Z',
			toGameTime: '2000-01-01T06:00:00.000Z',
			candidateEvents: [],
			aggregate: {
				eventCount: 0,
				counts: {
					...counts,
					plansCreated: 0,
					routinesCompleted: 0,
					activitiesCompleted: 0,
					clockSyncs: 0
				},
				deltas: []
			}
		});
		expect(recap.headline).toBe('Hearth 01 held its course.');
		expect(recap.highlights).toEqual([]);
	});

	it('keeps repeated clock resolutions from crowding out distinct changes', () => {
		const candidates = [2, 3, 4, 5, 6, 7].map((sequence) =>
			event(sequence, 'simulation.advanced', { summary: 'One daily routine resolved.' })
		);
		candidates.push(
			event(8, 'hero.daily.plan.created', { summary: 'A new day was planned.' }),
			event(9, 'hero.routine.started', { summary: 'A new routine began.' })
		);
		const recap = projectReturnRecap({
			runId: '00000000-0000-4000-8000-000000000099',
			fromCursor: 1,
			toCursor: 9,
			fromGameTime: '2000-01-01T00:00:00.000Z',
			toGameTime: '2000-01-01T09:00:00.000Z',
			candidateEvents: candidates,
			aggregate: { eventCount: 8, counts, deltas: [] }
		});
		const titles = recap.highlights.map((highlight) => highlight.title);
		expect(titles.filter((title) => title === 'simulation advanced')).toHaveLength(2);
		expect(titles).toContain('hero daily plan created');
		expect(titles).toContain('hero routine started');
	});
});
