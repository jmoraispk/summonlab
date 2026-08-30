import { describe, expect, it } from 'vitest';

import {
	AffinityWaveEventRequestV3Schema,
	AffinityWaveEventV3Schema,
	buildAffinityWaveEventV3,
	replayAffinityWaveJournalV3,
	type AffinityWaveEventRequestV3,
	type AffinityWaveEventV3,
	type AffinityWaveJournalContextV3
} from './affinity-wave-journal-v3.js';

const HASH = 'a'.repeat(64);
const RUN_ID = 'scale-sixteen-v3';
const RECORDED_AT = '2026-08-30T01:00:00.000Z';

function target(index: number): string {
	return `target-${String(index).padStart(2, '0')}`;
}

function context(count = 16, admittedWorkerCapacity = count): AffinityWaveJournalContextV3 {
	return {
		runId: RUN_ID,
		preflightCanonicalSha256: HASH,
		targetIds: Array.from({ length: count }, (_, index) => target(index + 1)),
		admittedWorkerCapacity,
		technicalFailureLimit: 3
	};
}

function request(
	eventId: string,
	kind: AffinityWaveEventRequestV3['kind'],
	extra: Record<string, unknown> = {}
): AffinityWaveEventRequestV3 {
	return AffinityWaveEventRequestV3Schema.parse({
		schemaVersion: 'affinity-wave-event-request-v3',
		eventId,
		runId: RUN_ID,
		kind,
		...extra
	});
}

function build(
	journalContext: AffinityWaveJournalContextV3,
	events: readonly AffinityWaveEventV3[],
	eventRequest: AffinityWaveEventRequestV3,
	recordedAt = RECORDED_AT
): AffinityWaveEventV3 {
	return buildAffinityWaveEventV3(journalContext, events, eventRequest, {
		now: () => recordedAt
	});
}

function append(
	journalContext: AffinityWaveJournalContextV3,
	events: AffinityWaveEventV3[],
	eventRequest: AffinityWaveEventRequestV3,
	recordedAt = RECORDED_AT
): AffinityWaveEventV3 {
	const event = build(journalContext, events, eventRequest, recordedAt);
	events.push(event);
	return event;
}

describe('affinity wave journal v3', () => {
	it('separates operator requests from recorder-owned persisted evidence', () => {
		const journalContext = context(1);
		const operatorRequest = request('wave-started', 'wave-started', {
			observedAt: '2026-08-30T00:59:59.000Z'
		});
		expect(AffinityWaveEventV3Schema.safeParse(operatorRequest).success).toBe(false);
		const event = build(journalContext, [], operatorRequest);
		expect(event).toEqual({
			schemaVersion: 'affinity-wave-event-v3',
			eventId: 'wave-started',
			runId: RUN_ID,
			kind: 'wave-started',
			observedAt: '2026-08-30T00:59:59.000Z',
			sequence: 0,
			recordedAt: RECORDED_AT,
			preflightCanonicalSha256: HASH
		});
		expect(AffinityWaveEventRequestV3Schema.safeParse(event).success).toBe(false);
	});

	it('counts starts rather than claims for sixteen claimed and twelve admitted workers', () => {
		const journalContext = context();
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		for (let index = 1; index <= 16; index += 1)
			append(
				journalContext,
				events,
				request(`claim-${index}`, 'job-claimed', { targetId: target(index) })
			);
		let state = replayAffinityWaveJournalV3(journalContext, events);
		expect(state.peakActiveWorkerCount).toBe(0);
		expect(state.distinctStartedWorkerIds.size).toBe(0);
		for (let index = 1; index <= 12; index += 1)
			append(
				journalContext,
				events,
				request(`start-${index}`, 'worker-started', {
					targetId: target(index),
					workerId: `worker-${index}`
				})
			);
		state = replayAffinityWaveJournalV3(journalContext, [...events].reverse());
		expect(state.claims.size).toBe(16);
		expect(state.starts.size).toBe(12);
		expect(state.activeTargetIds.size).toBe(12);
		expect(state.peakActiveWorkerCount).toBe(12);
		expect(state.distinctStartedWorkerIds.size).toBe(12);
	});

	it('allows a pre-admission capacity failure from a claim only', () => {
		const journalContext = context(2);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		append(journalContext, events, request('claim-one', 'job-claimed', { targetId: target(1) }));
		append(
			journalContext,
			events,
			request('capacity-one', 'job-failed', {
				targetId: target(1),
				workerId: null,
				failureKind: 'capacity',
				detail: 'Agent admission was refused.'
			})
		);
		expect(replayAffinityWaveJournalV3(journalContext, events).technicalFailureCount).toBe(1);

		const invalid = [...events.slice(0, 1)];
		expect(() =>
			build(
				journalContext,
				invalid,
				request('capacity-without-claim', 'job-failed', {
					targetId: target(2),
					workerId: null,
					failureKind: 'capacity',
					detail: 'No claim exists.'
				})
			)
		).toThrow(/no claim/u);
		expect(() =>
			build(
				journalContext,
				events.slice(0, 2),
				request('throttle-before-start', 'job-failed', {
					targetId: target(1),
					workerId: null,
					failureKind: 'provider-throttle',
					detail: 'Provider refused the call.'
				})
			)
		).toThrow(/requires a started worker/u);
	});

	it('requires terminal worker identity to match the admitted worker', () => {
		const journalContext = context(1);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		append(journalContext, events, request('claim-one', 'job-claimed', { targetId: target(1) }));
		append(
			journalContext,
			events,
			request('start-one', 'worker-started', {
				targetId: target(1),
				workerId: 'worker-one'
			})
		);
		expect(() =>
			build(
				journalContext,
				events,
				request('finish-wrong-worker', 'job-finished', {
					targetId: target(1),
					workerId: 'worker-two'
				})
			)
		).toThrow(/changed worker identity/u);
		expect(() =>
			build(
				journalContext,
				events,
				request('failure-wrong-worker', 'job-failed', {
					targetId: target(1),
					workerId: 'worker-two',
					failureKind: 'timeout',
					detail: 'Timed out.'
				})
			)
		).toThrow(/changed worker identity/u);
	});

	it('enforces unique targets, active workers, and admitted capacity', () => {
		const journalContext = context(2, 1);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		append(journalContext, events, request('claim-one', 'job-claimed', { targetId: target(1) }));
		append(journalContext, events, request('claim-two', 'job-claimed', { targetId: target(2) }));
		expect(() =>
			build(
				journalContext,
				events,
				request('duplicate-claim', 'job-claimed', { targetId: target(1) })
			)
		).toThrow(/claimed only once/u);
		append(
			journalContext,
			events,
			request('start-one', 'worker-started', {
				targetId: target(1),
				workerId: 'shared-worker'
			})
		);
		expect(() =>
			build(
				journalContext,
				events,
				request('same-worker-two', 'worker-started', {
					targetId: target(2),
					workerId: 'shared-worker'
				})
			)
		).toThrow(/already active/u);
		expect(() =>
			build(
				journalContext,
				events,
				request('capacity-two', 'worker-started', {
					targetId: target(2),
					workerId: 'other-worker'
				})
			)
		).toThrow(/exceed admitted/u);
		expect(() =>
			build(
				journalContext,
				events,
				request('unknown-claim', 'job-claimed', { targetId: 'target-99' })
			)
		).toThrow(/not in the wave/u);
	});

	it('triggers technical stop at three and permits only terminal cleanup afterward', () => {
		const journalContext = context(4);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		for (let index = 1; index <= 4; index += 1)
			append(
				journalContext,
				events,
				request(`claim-${index}`, 'job-claimed', { targetId: target(index) })
			);
		for (let index = 1; index <= 3; index += 1)
			append(
				journalContext,
				events,
				request(`capacity-${index}`, 'job-failed', {
					targetId: target(index),
					workerId: null,
					failureKind: 'capacity',
					detail: 'Agent admission refused.'
				})
			);
		const state = replayAffinityWaveJournalV3(journalContext, events);
		expect(state.technicalFailureCount).toBe(3);
		expect(state.technicalStopTriggered).toBe(true);
		expect(() =>
			build(
				journalContext,
				events,
				request('start-after-stop', 'worker-started', {
					targetId: target(4),
					workerId: 'worker-four'
				})
			)
		).toThrow(/after technical stop/u);
		append(journalContext, events, request('wave-finished', 'wave-finished'));
		expect(replayAffinityWaveJournalV3(journalContext, events).waveFinished).toBe(true);
	});

	it('combines throttle, timeout, and malformed-output pressure at the same stop limit', () => {
		const journalContext = context(3);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		for (let index = 1; index <= 3; index += 1) {
			append(
				journalContext,
				events,
				request(`claim-${index}`, 'job-claimed', { targetId: target(index) })
			);
			append(
				journalContext,
				events,
				request(`start-${index}`, 'worker-started', {
					targetId: target(index),
					workerId: `worker-${index}`
				})
			);
		}
		for (const [index, failureKind] of (
			['provider-throttle', 'timeout', 'malformed-output'] as const
		).entries())
			append(
				journalContext,
				events,
				request(`failure-${index + 1}`, 'job-failed', {
					targetId: target(index + 1),
					workerId: `worker-${index + 1}`,
					failureKind,
					detail: `Technical failure: ${failureKind}.`
				})
			);
		const state = replayAffinityWaveJournalV3(journalContext, events);
		expect(state.technicalFailureCount).toBe(3);
		expect(state.technicalStopTriggered).toBe(true);
	});

	it('does not count other failures toward the technical stop', () => {
		const journalContext = context(1);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		append(journalContext, events, request('claim-one', 'job-claimed', { targetId: target(1) }));
		append(
			journalContext,
			events,
			request('start-one', 'worker-started', {
				targetId: target(1),
				workerId: 'worker-one'
			})
		);
		append(
			journalContext,
			events,
			request('other-failure', 'job-failed', {
				targetId: target(1),
				workerId: 'worker-one',
				failureKind: 'other',
				detail: 'Nontechnical producer rejection.'
			})
		);
		const state = replayAffinityWaveJournalV3(journalContext, events);
		expect(state.technicalFailureCount).toBe(0);
		expect(state.technicalStopTriggered).toBe(false);
	});

	it('allows finish only when all targets are terminal or stop has triggered', () => {
		const journalContext = context(2);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		expect(() =>
			build(journalContext, events, request('premature-finish', 'wave-finished'))
		).toThrow(/every target terminal or a technical stop/u);
		for (let index = 1; index <= 2; index += 1) {
			append(
				journalContext,
				events,
				request(`claim-${index}`, 'job-claimed', { targetId: target(index) })
			);
			append(
				journalContext,
				events,
				request(`start-${index}`, 'worker-started', {
					targetId: target(index),
					workerId: `worker-${index}`
				})
			);
			append(
				journalContext,
				events,
				request(`finish-${index}`, 'job-finished', {
					targetId: target(index),
					workerId: `worker-${index}`
				})
			);
		}
		append(journalContext, events, request('wave-finished', 'wave-finished'));
		const state = replayAffinityWaveJournalV3(journalContext, events);
		expect(state.waveFinished).toBe(true);
		expect(state.terminal.size).toBe(2);
	});

	it('cannot finish a stopped wave until all admitted workers are terminal', () => {
		const journalContext = context(4);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		for (let index = 1; index <= 4; index += 1)
			append(
				journalContext,
				events,
				request(`claim-${index}`, 'job-claimed', { targetId: target(index) })
			);
		append(
			journalContext,
			events,
			request('start-four', 'worker-started', {
				targetId: target(4),
				workerId: 'worker-four'
			})
		);
		for (let index = 1; index <= 3; index += 1)
			append(
				journalContext,
				events,
				request(`capacity-${index}`, 'job-failed', {
					targetId: target(index),
					workerId: null,
					failureKind: 'capacity',
					detail: 'Admission refused.'
				})
			);
		expect(() =>
			build(journalContext, events, request('finish-with-active', 'wave-finished'))
		).toThrow(/workers remain active/u);
		append(
			journalContext,
			events,
			request('finish-four', 'job-finished', {
				targetId: target(4),
				workerId: 'worker-four'
			})
		);
		append(journalContext, events, request('wave-finished', 'wave-finished'));
		expect(replayAffinityWaveJournalV3(journalContext, events).waveFinished).toBe(true);
	});

	it('uses sequence for deterministic same-time worker reuse', () => {
		const journalContext = context(2, 1);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		append(journalContext, events, request('claim-one', 'job-claimed', { targetId: target(1) }));
		append(journalContext, events, request('claim-two', 'job-claimed', { targetId: target(2) }));
		append(
			journalContext,
			events,
			request('start-one', 'worker-started', {
				targetId: target(1),
				workerId: 'shared-worker'
			})
		);
		append(
			journalContext,
			events,
			request('finish-one', 'job-finished', {
				targetId: target(1),
				workerId: 'shared-worker'
			})
		);
		append(
			journalContext,
			events,
			request('start-two', 'worker-started', {
				targetId: target(2),
				workerId: 'shared-worker'
			})
		);
		const state = replayAffinityWaveJournalV3(journalContext, [...events].reverse());
		expect(state.peakActiveWorkerCount).toBe(1);
		expect(state.distinctStartedWorkerIds.size).toBe(1);

		const reordered = [...events];
		[reordered[4], reordered[5]] = [reordered[5]!, reordered[4]!];
		reordered[4] = { ...reordered[4]!, sequence: 4 };
		reordered[5] = { ...reordered[5]!, sequence: 5 };
		expect(() => replayAffinityWaveJournalV3(journalContext, reordered)).toThrow(/already active/u);
	});

	it('requires a unique contiguous sequence and exact preflight binding', () => {
		const journalContext = context(1);
		const first = build(journalContext, [], request('wave-started', 'wave-started'));
		expect(() => replayAffinityWaveJournalV3(journalContext, [{ ...first, sequence: 1 }])).toThrow(
			/contiguous/u
		);
		expect(() =>
			replayAffinityWaveJournalV3(journalContext, [first, { ...first, sequence: 1 }])
		).toThrow(/IDs must be unique/u);
		expect(() =>
			replayAffinityWaveJournalV3(journalContext, [
				first,
				{
					...first,
					eventId: 'different-event-id',
					sequence: 0
				}
			])
		).toThrow(/unique, contiguous/u);
		expect(() =>
			replayAffinityWaveJournalV3(journalContext, [
				{ ...first, preflightCanonicalSha256: 'b'.repeat(64) }
			])
		).toThrow(/preflight hash/u);
	});

	it('treats recordedAt as authoritative while preserving out-of-order observations', () => {
		const journalContext = context(1);
		const events: AffinityWaveEventV3[] = [];
		append(
			journalContext,
			events,
			request('wave-started', 'wave-started', {
				observedAt: '2026-08-30T00:59:58.000Z'
			}),
			'2026-08-30T01:00:00.000Z'
		);
		append(
			journalContext,
			events,
			request('claim-one', 'job-claimed', {
				targetId: target(1),
				observedAt: '2026-08-30T00:59:57.000Z'
			}),
			'2026-08-30T01:00:01.000Z'
		);
		expect(replayAffinityWaveJournalV3(journalContext, events).claims.size).toBe(1);
		expect(() =>
			build(
				journalContext,
				events,
				request('start-one', 'worker-started', {
					targetId: target(1),
					workerId: 'worker-one'
				}),
				'2026-08-30T00:59:59.000Z'
			)
		).toThrow(/Recorder-authoritative/u);
	});

	it('rejects events before start and after finish', () => {
		const journalContext = context(1);
		expect(() =>
			build(
				journalContext,
				[],
				request('claim-before-start', 'job-claimed', { targetId: target(1) })
			)
		).toThrow(/preceding wave-started/u);
		const events: AffinityWaveEventV3[] = [];
		append(journalContext, events, request('wave-started', 'wave-started'));
		append(journalContext, events, request('claim-one', 'job-claimed', { targetId: target(1) }));
		append(
			journalContext,
			events,
			request('capacity-one', 'job-failed', {
				targetId: target(1),
				workerId: null,
				failureKind: 'capacity',
				detail: 'Admission refused.'
			})
		);
		append(journalContext, events, request('wave-finished', 'wave-finished'));
		expect(() => build(journalContext, events, request('second-finish', 'wave-finished'))).toThrow(
			/after wave-finished/u
		);
	});
});
