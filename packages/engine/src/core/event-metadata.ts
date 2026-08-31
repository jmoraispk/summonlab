import {
	DirectiveInfluenceRecordSchema,
	EntropyDrawSchema,
	RewardDeltaSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState,
	type EntropyDraw,
	type RewardDelta
} from '@summonlab/contracts';
import { z } from 'zod';

import { deterministicUuid, EMPTY_STATE_HASH } from '../hash.js';
import { hashParsedGameState } from './state.js';

export const RewardDeltasSchema = z.array(RewardDeltaSchema);
export const EmptyMetadataSchema = z.object({
	summary: z.string().min(1).max(1_000),
	rewardDeltas: RewardDeltasSchema,
	resolvedScheduledEventIds: z.array(z.string().uuid()),
	canceledScheduledEventIds: z.array(z.string().uuid()),
	entropyDraws: z.array(EntropyDrawSchema),
	directiveInfluences: z.array(DirectiveInfluenceRecordSchema).max(16).optional(),
	expiredDirectiveIds: z.array(z.string().uuid()).max(256).optional()
});

export function systemSource() {
	return {
		source: 'system' as const,
		timing: null,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

export function emptyMetadata(summary: string, rewardDeltas: readonly RewardDelta[] = []) {
	return {
		summary,
		rewardDeltas,
		resolvedScheduledEventIds: [] as string[],
		canceledScheduledEventIds: [] as string[],
		entropyDraws: [] as EntropyDraw[]
	};
}

export function eventBase(state: EngineGameState, command: EngineCommand, eventType: string) {
	const sequence = state.eventCursor + 1;
	return {
		eventId: deterministicUuid(`${command.commandId}:${sequence}:${eventType}`),
		runId: state.runId,
		sequence,
		schemaVersion: state.schemaVersion,
		gameTime: state.simulatedAt,
		eventType,
		actorId: command.actorId,
		commandId: command.commandId,
		causationId: null,
		correlationId: command.correlationId,
		source: command.source,
		beforeStateHash: hashParsedGameState(state),
		afterStateHash: EMPTY_STATE_HASH,
		contentVersion: state.contentVersion
	};
}

export function metadataIds(
	event: AuthoritativeEvent,
	key: 'resolvedScheduledEventIds' | 'canceledScheduledEventIds'
): string[] {
	const payload = event.payload as Record<string, unknown>;
	return z.array(z.string().uuid()).parse(payload[key] ?? []);
}

export function entropyDrawsFromEvent(event: AuthoritativeEvent): readonly EntropyDraw[] {
	const payload = event.payload as Record<string, unknown>;
	return z.array(EntropyDrawSchema).parse(payload.entropyDraws ?? []);
}
