import { describe, expect, it } from 'vitest';

import { hashGameState, replayEventsStrict } from '../index.js';
import { ENGINE_REPLAY_VECTOR_CASES, actualMasterLegalActionIds } from './replay-vectors.js';

describe('versioned replay vectors', () => {
	it('covers every previously uncovered compatibility family', () => {
		expect(ENGINE_REPLAY_VECTOR_CASES.map(({ vector }) => vector.schemaVersion)).toEqual([
			5, 8, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23
		]);
	});

	it('captures the exact replay, schedule, state, and legal-action baseline', () => {
		for (const replayCase of ENGINE_REPLAY_VECTOR_CASES) {
			const { vector } = replayCase;
			expect(vector.events[0]).toMatchObject({
				eventType: 'run.initialized',
				sequence: 1,
				schemaVersion: vector.schemaVersion
			});
			expect(vector.events.map((event) => event.eventType)).toEqual(vector.expectedEventTypes);
			expect(vector.events.map((event) => event.beforeStateHash)).toEqual(
				vector.expectedBeforeHashes
			);
			expect(vector.events.map((event) => event.afterStateHash)).toEqual(
				vector.expectedAfterHashes
			);
			const replay = replayEventsStrict(vector.events);
			expect(replay.snapshot.state).toEqual(replayCase.finalState);
			expect(hashGameState(replayCase.finalState)).toBe(vector.expectedFinalStateHash);
			expect(actualMasterLegalActionIds(replayCase)).toEqual(vector.expectedLegalActionIds);
			expect(replayCase.scheduledEventIds).toEqual(vector.expectedScheduledEventIds);
			expect(replayCase.resolvedScheduledEventIds).toEqual(
				vector.expectedResolvedScheduledEventIds
			);
			expect(replayCase.canceledScheduledEventIds).toEqual(
				vector.expectedCanceledScheduledEventIds
			);
		}
	});

	it('rejects one changed payload scalar without mutating the replay input', () => {
		for (const { vector } of ENGINE_REPLAY_VECTOR_CASES) {
			const tampered = structuredClone(vector.events);
			const payload = tampered[1]!.payload as { nextVersion: number };
			payload.nextVersion += 1;
			const inputBeforeReplay = structuredClone(tampered);
			expect(() => replayEventsStrict(tampered), vector.id).toThrow();
			expect(tampered).toEqual(inputBeforeReplay);
		}
	});
});
