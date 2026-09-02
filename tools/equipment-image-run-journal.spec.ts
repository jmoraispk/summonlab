import { describe, expect, it } from 'vitest';

import type {
	EquipmentRunEvent,
	EquipmentRunEventRequest
} from './equipment-image-production-contract.js';
import { canonicalJsonSha256 } from './equipment-image-packets.js';
import {
	replayEquipmentRunJournal,
	type EquipmentRunJournalContext
} from './equipment-image-run-journal.js';

const RUN_ID = 'material-equipment-v1-run-001';
const HASH = 'a'.repeat(64);
const TARGET_IDS = ['target-one', 'target-two', 'target-three', 'target-four'] as const;
const GATED_TARGET_IDS = ['piece-head', 'piece-torso', 'piece-legs', 'piece-boots'] as const;

const context: EquipmentRunJournalContext = {
	runId: RUN_ID,
	runPlanCanonicalSha256: HASH,
	maximumConcurrency: 16,
	productionPriorityTargetIds: [...TARGET_IDS, ...GATED_TARGET_IDS],
	initiallyReadyTargetIds: [...TARGET_IDS],
	reviewGates: [
		{
			gateId: 'gate-one',
			sourceTargetId: TARGET_IDS[0],
			unlocksTargetIds: [...GATED_TARGET_IDS]
		}
	]
};

function request(
	kind: EquipmentRunEventRequest['kind'],
	eventId: string,
	fields: Record<string, unknown> = {}
): EquipmentRunEventRequest {
	return {
		schemaVersion: 'equipment-production-event-request-v1',
		eventId,
		runId: RUN_ID,
		requestedAt: `2026-09-01T23:${String(Number(eventId.match(/\d+/u)?.[0] ?? 0)).padStart(2, '0')}:00.000Z`,
		actor: 'root-orchestrator',
		kind,
		...fields
	} as EquipmentRunEventRequest;
}

function journal(requests: readonly EquipmentRunEventRequest[]): EquipmentRunEvent[] {
	const events: EquipmentRunEvent[] = [];
	for (const [index, eventRequest] of requests.entries()) {
		const previous = events.at(-1);
		events.push({
			schemaVersion: 'equipment-production-event-v1',
			sequence: index + 1,
			previousEventCanonicalSha256: previous === undefined ? null : canonicalJsonSha256(previous),
			recordedAt: `2026-09-02T00:${String(index).padStart(2, '0')}:00.000Z`,
			request: eventRequest
		});
	}
	return events;
}

const runStarted = () => request('run-started', 'event-01', { epochId: 'epoch-one' });
const claimed = (targetId: string = TARGET_IDS[0], workerId = 'worker-one', eventId = 'event-02') =>
	request('job-claimed', eventId, {
		epochId: 'epoch-one',
		claimId: `claim-${eventId}`,
		targetId,
		workerId
	});
const started = (
	targetId: string = TARGET_IDS[0],
	workerId = 'worker-one',
	eventId = 'event-03',
	claimId = 'claim-event-02'
) => request('worker-started', eventId, { claimId, targetId, workerId });
const terminal = (
	targetId: string = TARGET_IDS[0],
	workerId = 'worker-one',
	eventId = 'event-04',
	status: 'candidate' | 'revise' | 'failed' = 'candidate'
) =>
	request('job-terminal', eventId, {
		targetId,
		workerId,
		status,
		resultCanonicalSha256: status === 'failed' ? null : HASH,
		failureKind: status === 'failed' ? 'provider-throttle' : null
	});

describe('Equipment run journal replay', () => {
	it('derives legal claim, start, terminal, ready, and peak worker state', () => {
		const state = replayEquipmentRunJournal(
			context,
			journal([runStarted(), claimed(), started(), terminal()])
		);

		expect(state.terminal.size).toBe(1);
		expect(state.activeWorkerIds.size).toBe(0);
		expect(state.claimedTargetIds.size).toBe(0);
		expect(state.readyUnclaimedTargetIds).toEqual(TARGET_IDS.slice(1));
		expect(state.peakActiveWorkerCount).toBe(1);
		expect([...state.peakActiveWorkerIds]).toEqual(['worker-one']);
	});

	it('requires an exact live claim before a worker starts', () => {
		expect(() => replayEquipmentRunJournal(context, journal([runStarted(), started()]))).toThrow(
			/claim/iu
		);
	});

	it('releases only a pre-start claim and makes the target reclaimable', () => {
		const release = request('claim-released', 'event-03', {
			claimId: 'claim-event-02',
			targetId: TARGET_IDS[0],
			workerId: 'worker-one',
			reason: 'worker admission was refused'
		});
		const released = replayEquipmentRunJournal(
			context,
			journal([runStarted(), claimed(), release])
		);
		expect(released.reclaimableTargetIds).toContain(TARGET_IDS[0]);
		expect(released.readyUnclaimedTargetIds[0]).toBe(TARGET_IDS[0]);
		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([
					runStarted(),
					claimed(),
					release,
					started(TARGET_IDS[0], 'worker-one', 'event-04')
				])
			)
		).toThrow(/claim/iu);

		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([
					runStarted(),
					claimed(),
					started(),
					request('claim-released', 'event-04', {
						claimId: 'claim-event-02',
						targetId: TARGET_IDS[0],
						workerId: 'worker-one',
						reason: 'elapsed time'
					})
				])
			)
		).toThrow(/started|active/iu);
	});

	it('rejects duplicate event IDs, gaps, wrong hash links, and cross-run requests', () => {
		const duplicateIds = journal([runStarted(), claimed(TARGET_IDS[0], 'worker-one', 'event-01')]);
		expect(() => replayEquipmentRunJournal(context, duplicateIds)).toThrow(/event IDs.*unique/iu);

		const gap = journal([runStarted(), claimed()]);
		gap[1] = { ...gap[1]!, sequence: 3 };
		expect(() => replayEquipmentRunJournal(context, gap)).toThrow(/contiguous/iu);

		const brokenHash = journal([runStarted(), claimed()]);
		brokenHash[1] = { ...brokenHash[1]!, previousEventCanonicalSha256: HASH };
		expect(() => replayEquipmentRunJournal(context, brokenHash)).toThrow(/previous event/iu);

		const wrongRun = journal([runStarted(), claimed()]);
		wrongRun[1] = {
			...wrongRun[1]!,
			request: { ...wrongRun[1]!.request, runId: 'material-equipment-v1-run-002' }
		};
		expect(() => replayEquipmentRunJournal(context, wrongRun)).toThrow(/another run/iu);
	});

	it('rejects future requests but accepts older concurrent-origin request times', () => {
		const futureRequest = request('run-started', 'event-01', { epochId: 'epoch-one' });
		futureRequest.requestedAt = '2026-09-03T00:00:00.000Z';
		expect(() => replayEquipmentRunJournal(context, journal([futureRequest]))).toThrow(
			/requestedAt.*recordedAt|request.*future/iu
		);

		const olderClaim = claimed();
		olderClaim.requestedAt = '2026-09-01T20:00:00.000Z';
		expect(() =>
			replayEquipmentRunJournal(context, journal([runStarted(), olderClaim]))
		).not.toThrow();
	});

	it('rejects changing worker identity and two active jobs for one worker', () => {
		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([runStarted(), claimed(), started(TARGET_IDS[0], 'worker-two')])
			)
		).toThrow(/worker identity/iu);

		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([
					runStarted(),
					claimed(),
					started(),
					claimed(TARGET_IDS[1], 'worker-one', 'event-04'),
					started(TARGET_IDS[1], 'worker-one', 'event-05', 'claim-event-04')
				])
			)
		).toThrow(/already active/iu);
	});

	it('rejects terminal events without starts and target lifecycle events after terminal', () => {
		expect(() =>
			replayEquipmentRunJournal(context, journal([runStarted(), claimed(), terminal()]))
		).toThrow(/started worker/iu);
		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([
					runStarted(),
					claimed(),
					started(),
					terminal(),
					claimed(TARGET_IDS[0], 'worker-two', 'event-05')
				])
			)
		).toThrow(/terminal/iu);
	});

	it('unlocks accepted gate children in stable production priority', () => {
		const state = replayEquipmentRunJournal(
			context,
			journal([
				runStarted(),
				claimed(),
				started(),
				terminal(),
				request('armour-source-reviewed', 'event-05', {
					gateId: 'gate-one',
					sourceTargetId: TARGET_IDS[0],
					decision: 'accepted',
					receiptCanonicalSha256: HASH
				})
			])
		);
		expect([...state.acceptedGateIds]).toEqual(['gate-one']);
		expect(state.readyUnclaimedTargetIds).toEqual([...TARGET_IDS.slice(1), ...GATED_TARGET_IDS]);
	});

	it('enforces pause after exactly three technical failures and resumes a new epoch', () => {
		const requests: EquipmentRunEventRequest[] = [runStarted()];
		for (const [index, targetId] of TARGET_IDS.entries()) {
			const ordinal = index * 2 + 2;
			requests.push(
				claimed(targetId, `worker-${index + 1}`, `event-${String(ordinal).padStart(2, '0')}`),
				started(
					targetId,
					`worker-${index + 1}`,
					`event-${String(ordinal + 1).padStart(2, '0')}`,
					`claim-event-${String(ordinal).padStart(2, '0')}`
				)
			);
		}
		for (const [index, targetId] of TARGET_IDS.slice(0, 3).entries()) {
			requests.push(
				terminal(
					targetId,
					`worker-${index + 1}`,
					`event-${String(index + 10).padStart(2, '0')}`,
					'failed'
				)
			);
		}
		const threeFailures = replayEquipmentRunJournal(context, journal(requests));
		expect(threeFailures.technicalFailureCount).toBe(3);
		expect(threeFailures.circuitBreakerPauseRequired).toBe(true);

		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([...requests, terminal(TARGET_IDS[3], 'worker-4', 'event-13', 'failed')])
			)
		).toThrow(/epoch-paused/iu);

		const paused = request('epoch-paused', 'event-13', {
			epochId: 'epoch-one',
			technicalFailureCount: 3,
			reason: 'three technical failures'
		});
		expect(() =>
			replayEquipmentRunJournal(
				context,
				journal([...requests, paused, claimed(GATED_TARGET_IDS[0], 'worker-five', 'event-14')])
			)
		).toThrow(/paused/iu);

		const resumed = replayEquipmentRunJournal(
			context,
			journal([
				...requests,
				paused,
				terminal(TARGET_IDS[3], 'worker-4', 'event-14', 'failed'),
				request('epoch-resumed', 'event-15', {
					previousEpochId: 'epoch-one',
					epochId: 'epoch-two',
					reason: 'operator reviewed provider health'
				})
			])
		);
		expect(resumed.pausedEpochId).toBeNull();
		expect(resumed.currentEpochId).toBe('epoch-two');
		expect(resumed.technicalFailureCount).toBe(0);
	});
});
