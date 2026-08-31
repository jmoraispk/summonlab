import {
	AuthoritativeEventSchema,
	type AuthoritativeEvent,
	type EngineCommand,
	type EngineGameState
} from '@summonlab/contracts';

import { emptyMetadata, eventBase } from '../../core/event-metadata.js';
import type { EngineCommandHandler } from '../../core/types.js';
import { IllegalActionError } from '../../errors.js';
import {
	resolveSynthesis,
	resolveSynthesisRumor,
	synthesisCommitIsAvailable,
	synthesisHeroIsReady,
	synthesisRumorIsAvailable
} from './runtime.js';

export const SYNTHESIS_COMMAND_TYPES = [
	'settlement.synthesize.hero',
	'hero.share.synthesis.rumor'
] as const;

export type SynthesisCommand = Extract<
	EngineCommand,
	{ commandType: (typeof SYNTHESIS_COMMAND_TYPES)[number] }
>;

function assertSynthesisCommandLegal(state: EngineGameState, command: SynthesisCommand): void {
	if (command.commandType === 'settlement.synthesize.hero') {
		if (
			state.schemaVersion !== 22 ||
			state.status !== 'active' ||
			state.master.lifeState !== 'alive' ||
			command.actorId !== state.master.masterId ||
			command.source.source !== 'manual' ||
			command.source.timing !== null ||
			command.source.fallbackPolicy !== null ||
			command.source.decisionJobId !== null ||
			command.sourceHeroId === command.recipientHeroId ||
			state.mission.attempt !== null ||
			!synthesisCommitIsAvailable(state)
		) {
			throw new IllegalActionError(command.commandType, []);
		}
		for (const heroId of [command.sourceHeroId, command.recipientHeroId]) {
			const hero = state.heroes[heroId];
			if (!hero || !synthesisHeroIsReady(hero)) {
				throw new IllegalActionError(command.commandType, []);
			}
		}
		return;
	}
	if (
		state.schemaVersion !== 22 ||
		state.status !== 'active' ||
		!['scripted', 'model', 'habit', 'random'].includes(command.source.source) ||
		command.source.timing !== null ||
		!synthesisRumorIsAvailable(state, command)
	) {
		throw new IllegalActionError(command.commandType, []);
	}
}

function buildSynthesisEvent(
	state: EngineGameState,
	command: SynthesisCommand
): AuthoritativeEvent {
	if (command.commandType === 'settlement.synthesize.hero') {
		if (state.schemaVersion !== 22) throw new IllegalActionError(command.commandType);
		const base = eventBase(state, command, 'hero.synthesized');
		const resolved = resolveSynthesis(state, command, base.eventId, base.sequence);
		return AuthoritativeEventSchema.parse({
			...base,
			seedCursor: state.entropyCursor,
			payload: {
				receipt: resolved.receipt,
				nextVersion: state.version + 1,
				...emptyMetadata(
					`The Master irreversibly synthesized ${command.sourceHeroId} into ${command.recipientHeroId}; knowledge remained witness-bounded.`,
					resolved.rewardDeltas
				),
				canceledScheduledEventIds: resolved.canceledScheduledEventIds
			}
		});
	}
	if (state.schemaVersion !== 22) throw new IllegalActionError(command.commandType);
	const base = eventBase(state, command, 'social.synthesis.rumor.shared');
	const resolved = resolveSynthesisRumor(state, command, base.eventId, base.sequence);
	return AuthoritativeEventSchema.parse({
		...base,
		seedCursor: state.entropyCursor,
		payload: {
			rumor: resolved.rumor,
			nextVersion: state.version + 1,
			...emptyMetadata(
				`${command.actorId} told ${command.targetHeroId} what happened in the synthesis chamber; the claim retained its source and confidence.`,
				resolved.rewardDeltas
			)
		}
	});
}

export const synthesisCommandHandler: EngineCommandHandler<SynthesisCommand> = {
	ownerId: 'synthesis',
	commandTypes: SYNTHESIS_COMMAND_TYPES,
	assertLegal: assertSynthesisCommandLegal,
	buildEvent: buildSynthesisEvent
};
