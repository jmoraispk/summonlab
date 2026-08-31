import {
	AuthoritativeEventSchema,
	EngineGameStateSchema,
	EngineSnapshotSchema,
	EntropyDrawSchema,
	type AuthoritativeEvent
} from '@summonlab/contracts';
import { z } from 'zod';

import { RewardDeltasSchema, entropyDrawsFromEvent } from '../core/event-metadata.js';
import { hashParsedGameState } from '../core/state.js';
import type { ReplayCheck, ReplayResult } from '../core/types.js';
import { ReplayIntegrityError } from '../errors.js';
import { EMPTY_STATE_HASH } from '../hash.js';
import { eventDeltas, eventSummary } from '../journal.js';
import { reduceParsedEvent } from './reduction.js';

const InitializedPayloadSchema = z
	.object({
		initialState: EngineGameStateSchema,
		entropyDraws: z.array(EntropyDrawSchema),
		summary: z.string().optional(),
		rewardDeltas: RewardDeltasSchema.optional(),
		resolvedScheduledEventIds: z.array(z.string().uuid()).optional(),
		canceledScheduledEventIds: z.array(z.string().uuid()).optional()
	})
	.strict();

function replayCheck(
	event: AuthoritativeEvent,
	computedStateHash: string,
	verified: boolean
): ReplayCheck {
	return {
		sequence: event.sequence,
		gameTime: event.gameTime,
		eventType: event.eventType,
		actorId: event.actorId,
		source: event.source,
		summary: eventSummary(event),
		beforeStateHash: event.beforeStateHash,
		afterStateHash: event.afterStateHash,
		computedStateHash,
		verified,
		entropyDraws: entropyDrawsFromEvent(event),
		deltas: eventDeltas(event)
	};
}

export function replayEvents(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	if (eventInputs.length === 0) throw new ReplayIntegrityError('Replay has no bootstrap event', 0);
	const events = eventInputs.map((event) => AuthoritativeEventSchema.parse(event));
	const first = events[0];
	if (!first || first.sequence !== 1 || first.eventType !== 'run.initialized') {
		throw new ReplayIntegrityError(
			'Replay must begin with run.initialized at sequence 1',
			first?.sequence ?? 0
		);
	}
	const initialized = InitializedPayloadSchema.parse(first.payload);
	let state = initialized.initialState;
	let computedHash = hashParsedGameState(state);
	const checks: ReplayCheck[] = [
		replayCheck(
			first,
			computedHash,
			first.beforeStateHash === EMPTY_STATE_HASH && first.afterStateHash === computedHash
		)
	];
	for (const event of events.slice(1)) {
		const beforeHash = hashParsedGameState(state);
		state = reduceParsedEvent(state, event);
		computedHash = hashParsedGameState(state);
		checks.push(
			replayCheck(
				event,
				computedHash,
				event.beforeStateHash === beforeHash && event.afterStateHash === computedHash
			)
		);
	}
	return {
		snapshot: EngineSnapshotSchema.parse({ state, stateHash: computedHash }),
		checks,
		verified: checks.every((check) => check.verified)
	};
}

export function replayEventsStrict(eventInputs: readonly AuthoritativeEvent[]): ReplayResult {
	const replay = replayEvents(eventInputs);
	const failed = replay.checks.find((check) => !check.verified);
	if (failed) throw new ReplayIntegrityError('Replay state hash mismatch', failed.sequence);
	return replay;
}
