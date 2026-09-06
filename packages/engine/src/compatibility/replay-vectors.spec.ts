import { describe, expect, it } from 'vitest';

import { hashCanonical, hashGameState, replayEventsStrict } from '../index.js';
import {
	ENGINE_REPLAY_VECTOR_CASES,
	REPLAY_VECTOR_EMPTY_STATE_HASH,
	actualMasterLegalActionIds
} from './replay-vectors.js';

describe('versioned replay vectors', () => {
	it('pins the empty-state hash independently from production code', () => {
		expect(REPLAY_VECTOR_EMPTY_STATE_HASH).toBe(
			'74234e98afe7498fb5daf1f36ac2d78acc339464f950703b8c019892f982b90b'
		);
	});

	it('covers every previously uncovered compatibility family', () => {
		expect(ENGINE_REPLAY_VECTOR_CASES.map(({ vector }) => vector.schemaVersion)).toEqual([
			5, 8, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 24
		]);
	});

	it('freezes the equipment-enabled v24 two-round combat baseline', () => {
		const replayCase = ENGINE_REPLAY_VECTOR_CASES.find(
			({ vector }) => vector.id === 'v24-equipment-mission-resolution'
		);
		if (!replayCase) throw new Error('Expected the v24 combat replay vector');
		const attempt = replayCase.finalState.mission.attempt;
		if (!attempt) throw new Error('Expected the v24 combat replay to remain deployed');
		expect(replayCase.vector.expectedEventHashes).toStrictEqual([
			'3c2575e846030bf4858dd3cf5a90d199fb8fe1835c238e3e9bf38b8f8733d323',
			'c27329ce47d3356d5a5fee05abcf547460529204b52d7d6ab8c459676fe9fea6',
			'e6bc052c2659863ebf25e97d482f9a08f3f574e610037f4360800caf14c16fb3',
			'6d41833efdb8c07ab771b86152f832e58467080f58956a9592e41dba5ce88191',
			'd8ae519a899e33ff3c31a19c709b72b02f858959c4c96e2dbe76e895f26e1851'
		]);
		expect(replayCase.vector.events.map(hashCanonical)).toStrictEqual(
			replayCase.vector.expectedEventHashes
		);
		expect(replayCase.vector.expectedAfterHashes).toStrictEqual([
			'2f6397320a421dc62bc658e356105ea62b0bee4c906e7c488aba98dd3ece1785',
			'9a7c0b4bd7b20ed13f5a9b45b671564d7d701a164d8f6a32e46b7d62b6ce0658',
			'23abcd0e6b6c7a7dd37876151f435216a009be976d97d821f051264c8ccf7108',
			'bc93a8266d588348438a5d59960c42c65899cf52b25c45fc70fc0fcd7326a3f6',
			'be17653a611538c5820f595dd04b61265e94896c399dca7d05e02d5d19491d20'
		]);
		expect(replayCase.vector.expectedFinalStateHash).toBe(
			'be17653a611538c5820f595dd04b61265e94896c399dca7d05e02d5d19491d20'
		);
		expect(replayCase.finalState.entropyCursor).toBe(14);
		expect(
			replayCase.vector.events
				.filter(
					(event) =>
						event.eventType === 'mission.deployed' || event.eventType === 'mission.round.resolved'
				)
				.map((event) => (event.payload as { entropyDraws: unknown }).entropyDraws)
		).toStrictEqual([
			[
				{ purpose: 'goblin-chain-watch-count', cursor: 0, minimum: 2, maximum: 3, value: 3 },
				{ purpose: 'goblin-ember-hauler-count', cursor: 1, minimum: 1, maximum: 1, value: 1 }
			],
			[
				{ purpose: 'initiative-tie-break', cursor: 2, minimum: 0, maximum: 99, value: 56 },
				{ purpose: 'initiative-tie-break', cursor: 3, minimum: 0, maximum: 99, value: 88 },
				{ purpose: 'initiative-tie-break', cursor: 4, minimum: 0, maximum: 99, value: 76 },
				{ purpose: 'initiative-tie-break', cursor: 5, minimum: 0, maximum: 99, value: 49 },
				{ purpose: 'initiative-tie-break', cursor: 6, minimum: 0, maximum: 99, value: 22 },
				{ purpose: 'initiative-tie-break', cursor: 7, minimum: 0, maximum: 99, value: 31 }
			],
			[
				{ purpose: 'initiative-tie-break', cursor: 8, minimum: 0, maximum: 99, value: 15 },
				{ purpose: 'initiative-tie-break', cursor: 9, minimum: 0, maximum: 99, value: 21 },
				{ purpose: 'initiative-tie-break', cursor: 10, minimum: 0, maximum: 99, value: 24 },
				{ purpose: 'initiative-tie-break', cursor: 11, minimum: 0, maximum: 99, value: 90 },
				{ purpose: 'initiative-tie-break', cursor: 12, minimum: 0, maximum: 99, value: 59 },
				{ purpose: 'initiative-tie-break', cursor: 13, minimum: 0, maximum: 99, value: 40 }
			]
		]);
		expect(
			attempt.turnState.rounds.map((round) => ({
				initiativeOrder: round.initiativeOrder,
				effects: round.effects,
				partyOutcomes: round.actions.map(({ actionId, outcome }) => ({ actionId, outcome })),
				monsterOutcomes: round.monsterActions.map(({ outcome }) => outcome),
				statusAfter: round.statusAfter
			}))
		).toStrictEqual([
			{
				initiativeOrder: [
					'a767dcaf-1cf6-4f8f-b6af-865201eaa215',
					'2db6fc66-291b-4e94-a32c-0b24f4070908',
					'64aa6816-ff1a-40af-8e75-f986e4fd110b',
					'3265f390-d551-426d-bcc5-1765a7921b7c',
					'e0cbdd02-a512-4fe2-9f67-230e8d4c5440',
					'34226d2b-db27-471c-a687-896c3fd54f63'
				],
				effects: [],
				partyOutcomes: [
					{
						actionId: 'mission.move.threshold-to-oath-hall',
						outcome: 'applied'
					},
					{
						actionId: 'mission.move.threshold-to-oath-hall',
						outcome: 'applied'
					}
				],
				monsterOutcomes: ['applied', 'applied', 'applied', 'applied'],
				statusAfter: 'resolving'
			},
			{
				initiativeOrder: [
					'3265f390-d551-426d-bcc5-1765a7921b7c',
					'34226d2b-db27-471c-a687-896c3fd54f63',
					'a767dcaf-1cf6-4f8f-b6af-865201eaa215',
					'e0cbdd02-a512-4fe2-9f67-230e8d4c5440',
					'64aa6816-ff1a-40af-8e75-f986e4fd110b',
					'2db6fc66-291b-4e94-a32c-0b24f4070908'
				],
				effects: [],
				partyOutcomes: [
					{ actionId: 'mission.hold', outcome: 'applied' },
					{ actionId: 'mission.hold', outcome: 'applied' }
				],
				monsterOutcomes: ['applied', 'applied', 'applied', 'applied'],
				statusAfter: 'resolving'
			}
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
			if (vector.expectedEventHashes) {
				expect(vector.events.map(hashCanonical)).toEqual(vector.expectedEventHashes);
			}
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
