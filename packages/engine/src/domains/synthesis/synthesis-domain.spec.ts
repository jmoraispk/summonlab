import {
	EngineCommandSchema,
	type ActionSource,
	type AuthoritativeEvent,
	type EngineGameStateV22
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { ENGINE_REPLAY_VECTOR_CASES } from '../../compatibility/replay-vectors.js';
import { IllegalActionError, ReplayIntegrityError } from '../../errors.js';
import { createBootstrapEngine, hashGameState, replayEventsStrict } from '../../index.js';
import { type SynthesisCommand, synthesisCommandHandler } from './commands.js';
import { synthesisEventReducer } from './reducer.js';

const EXPECTED_SYNTHESIS_COMMAND_TYPES = [
	'settlement.synthesize.hero',
	'hero.share.synthesis.rumor'
] as const;
const EXPECTED_SYNTHESIS_EVENT_TYPES = [
	'hero.synthesized',
	'social.synthesis.rumor.shared'
] as const;

const runId = '22000000-0000-4000-8000-000000000001';
const sourceHeroId = '22000000-0000-4000-8000-000000000002';
const recipientHeroId = '22000000-0000-4000-8000-000000000003';
const witnessHeroId = '22000000-0000-4000-8000-000000000004';
const listenerHeroId = '22000000-0000-4000-8000-000000000005';
const manualSource: ActionSource = {
	source: 'manual',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

const EXPECTED_PRIVATE_HASH = 'af377b4ba6497be7f1225ac7252dbe0efbd9969ace635dd147e4df71a0a248da';
const EXPECTED_RUMOR_HASH = '32b3a788f1140c32d38792784ac31ce31bfcdfa91edee6641f4f76ea00d9786c';
const EXPECTED_OPEN_HASH = 'b61d9bfc687ef7bb1d2d947572b302418525aee4ab3f22694c64178755b9b832';

function vectorEvents() {
	const replayCase = ENGINE_REPLAY_VECTOR_CASES.find(
		(candidate) => candidate.vector.id === 'v22-synthesis-and-rumor'
	);
	if (!replayCase) throw new Error('Missing Checkpoint A replay vector: v22-synthesis-and-rumor');
	return replayCase.vector.events;
}

function stateBefore(eventType: (typeof EXPECTED_SYNTHESIS_EVENT_TYPES)[number]): {
	state: EngineGameStateV22;
	event: AuthoritativeEvent;
} {
	const events = vectorEvents();
	const eventIndex = events.findIndex((event) => event.eventType === eventType);
	if (eventIndex < 1) throw new Error(`Missing Checkpoint A event: ${eventType}`);
	const state = replayEventsStrict(events.slice(0, eventIndex)).snapshot.state;
	if (state.schemaVersion !== 22) throw new Error('Expected engine-v22');
	return { state, event: events[eventIndex]! };
}

function referenceCommand(state: EngineGameStateV22, event: AuthoritativeEvent): SynthesisCommand {
	const payload = event.payload as {
		receipt?: {
			sourceHeroId: string;
			recipientHeroId: string;
			visibility: 'private' | 'open';
			warningVersion: string;
			confirmedIrreversible: true;
			rationale: string;
		};
		rumor?: { receiptId: string; listenerHeroId: string };
	};
	return EngineCommandSchema.parse({
		commandId: event.commandId,
		runId: event.runId,
		actorId: event.actorId,
		expectedVersion: state.version,
		correlationId: event.correlationId,
		source: event.source,
		...(event.eventType === 'hero.synthesized'
			? {
					commandType: 'settlement.synthesize.hero',
					sourceHeroId: payload.receipt?.sourceHeroId,
					recipientHeroId: payload.receipt?.recipientHeroId,
					visibility: payload.receipt?.visibility,
					warningVersion: payload.receipt?.warningVersion,
					confirmedIrreversible: payload.receipt?.confirmedIrreversible,
					rationale: payload.receipt?.rationale
				}
			: {
					commandType: 'hero.share.synthesis.rumor',
					receiptId: payload.rumor?.receiptId,
					targetHeroId: payload.rumor?.listenerHeroId
				})
	}) as SynthesisCommand;
}

function openCheckpoint(): EngineGameStateV22 {
	const state = createBootstrapEngine({
		runId,
		seed: 'synthesis-runtime-proof',
		heroId: sourceHeroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableSynthesis: true,
			additionalHeroes: [
				{ heroId: recipientHeroId, manifestHash: '2'.repeat(64), rarityStars: 1 },
				{ heroId: witnessHeroId, manifestHash: '3'.repeat(64), rarityStars: 1 },
				{ heroId: listenerHeroId, manifestHash: '4'.repeat(64), rarityStars: 1 }
			]
		}
	}).snapshot.state;
	if (state.schemaVersion !== 22) throw new Error('Expected engine-v22');
	return state;
}

function openCommand(state: EngineGameStateV22): SynthesisCommand {
	return EngineCommandSchema.parse({
		commandId: '22000000-0000-4000-8000-000000000010',
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: '22000000-0000-4000-8000-000000000011',
		source: manualSource,
		commandType: 'settlement.synthesize.hero',
		sourceHeroId,
		recipientHeroId,
		visibility: 'open',
		warningVersion: 'synthesis-warning-v1',
		confirmedIrreversible: true,
		rationale: 'Convert one summon into bounded essence before the next tower attempt.'
	}) as SynthesisCommand;
}

describe('synthesis domain ownership', () => {
	it('exports exact ordered v22 synthesis command and event ownership', () => {
		expect(synthesisCommandHandler.ownerId).toBe('synthesis');
		expect(synthesisCommandHandler.commandTypes).toStrictEqual(EXPECTED_SYNTHESIS_COMMAND_TYPES);
		expect(synthesisEventReducer.ownerId).toBe('synthesis');
		expect(synthesisEventReducer.eventTypes).toStrictEqual(EXPECTED_SYNTHESIS_EVENT_TYPES);
	});

	it.each([
		['hero.synthesized', EXPECTED_PRIVATE_HASH],
		['social.synthesis.rumor.shared', EXPECTED_RUMOR_HASH]
	] as const)('builds and reduces the exact Checkpoint A %s transaction', (eventType, hash) => {
		const events = vectorEvents();
		const { state, event } = stateBefore(eventType);
		const command = referenceCommand(state, event);
		const before = structuredClone(state);

		synthesisCommandHandler.assertLegal(state, command);
		const built = synthesisCommandHandler.buildEvent(state, command);
		const reduced = synthesisEventReducer.reduce(state, built);
		const eventIndex = events.indexOf(event);
		const checkpoint = replayEventsStrict(events.slice(0, eventIndex + 1)).snapshot;

		expect({ ...built, afterStateHash: hashGameState(reduced) }).toStrictEqual(event);
		expect(reduced).toStrictEqual(checkpoint.state);
		expect(hashGameState(reduced)).toBe(hash);
		expect(event.afterStateHash).toBe(hash);
		expect(state).toStrictEqual(before);
	});

	it('preserves the frozen open-chamber receipt, witness ordering, and state hash', () => {
		const state = openCheckpoint();
		const before = structuredClone(state);
		const command = openCommand(state);

		synthesisCommandHandler.assertLegal(state, command);
		const event = synthesisCommandHandler.buildEvent(state, command);
		const reduced = synthesisEventReducer.reduce(state, event);
		const payload = event.payload as {
			receipt: {
				receiptId: string;
				visibility: string;
				essenceExperience: number;
				socialConsequences: readonly unknown[];
			};
		};

		expect(payload.receipt).toMatchObject({
			receiptId: 'ab5baef7-f139-4f34-be5e-b38dff4235d0',
			visibility: 'open',
			essenceExperience: 40,
			socialConsequences: [
				{
					heroId: recipientHeroId,
					knowledge: 'participant',
					observationId: 'e4b244be-4faf-46da-aaa1-df7c865bfd81',
					beliefId: 'e88d722f-198a-4cca-bf78-7a5f03c92ede',
					confidence: 100
				},
				{
					heroId: witnessHeroId,
					knowledge: 'witness',
					observationId: '70e47c4d-4113-475f-8f5f-b947fcf053c9',
					beliefId: '994d27fe-99b9-4672-a158-cbeae580c0c9',
					confidence: 100
				},
				{
					heroId: listenerHeroId,
					knowledge: 'witness',
					observationId: '62509196-cf65-4ac4-b3ed-cf1a45cd4d2b',
					beliefId: '796c28c8-080e-4a5c-b67f-023da6c330a2',
					confidence: 100
				}
			]
		});
		expect(reduced).toMatchObject({
			version: state.version + 1,
			eventCursor: state.eventCursor + 1,
			heroes: {
				[sourceHeroId]: { lifeState: 'synthesized', health: 0 },
				[recipientHeroId]: { progression: { experience: 40, level: 5 } }
			}
		});
		expect(hashGameState(reduced)).toBe(EXPECTED_OPEN_HASH);
		expect(state).toStrictEqual(before);
	});

	it('rejects a self-targeted synthesis rumor without mutating input', () => {
		const { state, event } = stateBefore('social.synthesis.rumor.shared');
		const command = referenceCommand(state, event);
		if (command.commandType !== 'hero.share.synthesis.rumor') {
			throw new Error('Expected synthesis rumor command');
		}
		const illegal = EngineCommandSchema.parse({
			...command,
			targetHeroId: command.actorId
		}) as SynthesisCommand;
		const before = structuredClone(state);

		expect(() => synthesisCommandHandler.assertLegal(state, illegal)).toThrow(IllegalActionError);
		expect(state).toStrictEqual(before);
	});

	it('rejects a tampered rumor payload without mutating input', () => {
		const { state, event } = stateBefore('social.synthesis.rumor.shared');
		const payload = structuredClone(event.payload) as {
			rumor: { confidence: number };
		};
		payload.rumor.confidence -= 1;
		const tampered = { ...event, payload } as AuthoritativeEvent;
		const before = structuredClone(state);

		expect(() => synthesisEventReducer.reduce(state, tampered)).toThrow(ReplayIntegrityError);
		expect(state).toStrictEqual(before);
	});
});
