import {
	EngineCommandSchema,
	SynthesisReceiptSchema,
	SynthesisRumorRecordSchema,
	type AuthoritativeEvent,
	type EngineGameState
} from '@summonlab/contracts';
import { z } from 'zod';

import { EmptyMetadataSchema } from '../../core/event-metadata.js';
import type { EngineEventReducer } from '../../core/types.js';
import { ReplayIntegrityError } from '../../errors.js';
import { hashCanonical } from '../../hash.js';
import {
	resolveSynthesis,
	resolveSynthesisRumor,
	type ShareSynthesisRumorCommand,
	type SynthesizeHeroCommand
} from './runtime.js';

const SynthesisCommittedPayloadSchema = EmptyMetadataSchema.extend({
	receipt: SynthesisReceiptSchema,
	nextVersion: z.number().int().positive()
}).strict();

const SynthesisRumorSharedPayloadSchema = EmptyMetadataSchema.extend({
	rumor: SynthesisRumorRecordSchema,
	nextVersion: z.number().int().positive()
}).strict();

export const SYNTHESIS_EVENT_TYPES = ['hero.synthesized', 'social.synthesis.rumor.shared'] as const;

function reduceSynthesisEvent(state: EngineGameState, event: AuthoritativeEvent): EngineGameState {
	if (event.eventType === 'hero.synthesized') {
		if (
			state.schemaVersion !== 22 ||
			event.actorId !== state.master.masterId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			event.source.source !== 'manual'
		) {
			throw new ReplayIntegrityError('Synthesis precondition failed', event.sequence);
		}
		const payload = SynthesisCommittedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Synthesis version diverged', event.sequence);
		}
		const command = EngineCommandSchema.parse({
			commandId: event.commandId,
			runId: event.runId,
			actorId: event.actorId,
			expectedVersion: state.version,
			correlationId: event.correlationId,
			source: event.source,
			commandType: 'settlement.synthesize.hero',
			sourceHeroId: payload.receipt.sourceHeroId,
			recipientHeroId: payload.receipt.recipientHeroId,
			visibility: payload.receipt.visibility,
			warningVersion: payload.receipt.warningVersion,
			confirmedIrreversible: payload.receipt.confirmedIrreversible,
			rationale: payload.receipt.rationale
		}) as SynthesizeHeroCommand;
		let resolved;
		try {
			resolved = resolveSynthesis(state, command, event.eventId, event.sequence);
		} catch {
			throw new ReplayIntegrityError('Synthesis could not be recomputed', event.sequence);
		}
		if (
			hashCanonical(resolved.receipt) !== hashCanonical(payload.receipt) ||
			hashCanonical(resolved.rewardDeltas) !== hashCanonical(payload.rewardDeltas) ||
			hashCanonical(resolved.canceledScheduledEventIds) !==
				hashCanonical(payload.canceledScheduledEventIds)
		) {
			throw new ReplayIntegrityError('Synthesis payload diverged', event.sequence);
		}
		return resolved.state;
	}
	if (event.eventType === 'social.synthesis.rumor.shared') {
		if (
			state.schemaVersion !== 22 ||
			!event.actorId ||
			event.gameTime !== state.simulatedAt ||
			event.seedCursor !== state.entropyCursor ||
			!['scripted', 'model', 'habit', 'random'].includes(event.source.source)
		) {
			throw new ReplayIntegrityError('Synthesis rumor precondition failed', event.sequence);
		}
		const payload = SynthesisRumorSharedPayloadSchema.parse(event.payload);
		if (payload.nextVersion !== state.version + 1 || payload.entropyDraws.length !== 0) {
			throw new ReplayIntegrityError('Synthesis rumor version diverged', event.sequence);
		}
		const command = EngineCommandSchema.parse({
			commandId: event.commandId,
			runId: event.runId,
			actorId: event.actorId,
			expectedVersion: state.version,
			correlationId: event.correlationId,
			source: event.source,
			commandType: 'hero.share.synthesis.rumor',
			receiptId: payload.rumor.receiptId,
			targetHeroId: payload.rumor.listenerHeroId
		}) as ShareSynthesisRumorCommand;
		let resolved;
		try {
			resolved = resolveSynthesisRumor(state, command, event.eventId, event.sequence);
		} catch {
			throw new ReplayIntegrityError('Synthesis rumor could not be recomputed', event.sequence);
		}
		if (
			hashCanonical(resolved.rumor) !== hashCanonical(payload.rumor) ||
			hashCanonical(resolved.rewardDeltas) !== hashCanonical(payload.rewardDeltas)
		) {
			throw new ReplayIntegrityError('Synthesis rumor payload diverged', event.sequence);
		}
		return resolved.state;
	}
	throw new ReplayIntegrityError('Synthesis event discriminator is not owned', event.sequence);
}

export const synthesisEventReducer: EngineEventReducer = {
	ownerId: 'synthesis',
	eventTypes: SYNTHESIS_EVENT_TYPES,
	reduce: reduceSynthesisEvent
};
