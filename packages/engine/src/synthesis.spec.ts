import {
	EngineCommandSchema,
	type ActionSource,
	type EngineGameStateV22
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	IllegalActionError,
	applyCommand,
	createBootstrapEngine,
	legalActions,
	replayEventsStrict
} from './index.js';

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
const scriptedSource: ActionSource = {
	source: 'scripted',
	timing: null,
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function checkpoint() {
	const bootstrap = createBootstrapEngine({
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
	});
	if (bootstrap.snapshot.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
	return { bootstrap, state: bootstrap.snapshot.state };
}

function synthesisCommand(state: EngineGameStateV22, visibility: 'private' | 'open') {
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
		visibility,
		warningVersion: 'synthesis-warning-v1',
		confirmedIrreversible: true,
		rationale: 'Convert one summon into bounded essence before the next tower attempt.'
	});
}

describe('synthesis transactions', () => {
	it('commits irreversible growth, private absence beliefs, and a sourced rumor chain', () => {
		const { bootstrap, state } = checkpoint();
		expect(legalActions(state, state.master.masterId).map((entry) => entry.actionId)).toContain(
			'settlement.synthesis.commit'
		);
		const synthesized = applyCommand(state, synthesisCommand(state, 'private'));
		if (synthesized.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
		const receipt = Object.values(synthesized.state.synthesis.receipts)[0]!;
		expect(synthesized.events[0]?.eventType).toBe('hero.synthesized');
		expect(synthesized.state.heroes[sourceHeroId]).toMatchObject({
			lifeState: 'synthesized',
			health: 0,
			equipment: { mainHand: null },
			assignment: null,
			currentActivity: null,
			currentTravel: null,
			currentRoutine: null
		});
		expect(synthesized.state.heroes[recipientHeroId]?.progression).toMatchObject({
			experience: 40,
			level: 5
		});
		expect(receipt.socialConsequences).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ heroId: recipientHeroId, knowledge: 'participant' }),
				expect.objectContaining({ heroId: witnessHeroId, knowledge: 'absence', confidence: 35 }),
				expect.objectContaining({ heroId: listenerHeroId, knowledge: 'absence', confidence: 35 })
			])
		);

		const rumorAction = legalActions(synthesized.state, recipientHeroId).find((entry) =>
			entry.targetIds.includes(listenerHeroId)
		);
		expect(rumorAction?.tags).toContain('provenance');
		const rumorCommand = EngineCommandSchema.parse({
			commandId: '22000000-0000-4000-8000-000000000012',
			runId,
			actorId: recipientHeroId,
			expectedVersion: synthesized.state.version,
			correlationId: '22000000-0000-4000-8000-000000000013',
			source: scriptedSource,
			commandType: 'hero.share.synthesis.rumor',
			receiptId: receipt.receiptId,
			targetHeroId: listenerHeroId
		});
		const rumored = applyCommand(synthesized.state, rumorCommand);
		if (rumored.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
		const rumor = Object.values(rumored.state.synthesis.rumors)[0]!;
		const belief = rumored.state.society.beliefs[rumor.beliefId]!;
		expect(rumor).toMatchObject({
			speakerHeroId: recipientHeroId,
			listenerHeroId,
			confidence: 85,
			chainDepth: 1
		});
		expect(belief.provenance).toMatchObject({
			kind: 'told',
			learnedFromId: recipientHeroId,
			chainDepth: 1
		});
		const replay = replayEventsStrict([bootstrap.event, ...synthesized.events, ...rumored.events]);
		expect(replay.verified).toBe(true);
		expect(replay.snapshot.state).toEqual(rumored.state);
	});

	it('makes every co-located bystander an eyewitness only when the chamber is open', () => {
		const { state } = checkpoint();
		const committed = applyCommand(state, synthesisCommand(state, 'open'));
		if (committed.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
		const receipt = Object.values(committed.state.synthesis.receipts)[0]!;
		expect(
			receipt.socialConsequences.filter((entry) => entry.knowledge === 'witness')
		).toHaveLength(2);
		expect(legalActions(committed.state, recipientHeroId)).toEqual(
			expect.not.arrayContaining([
				expect.objectContaining({ tags: expect.arrayContaining(['rumor']) })
			])
		);
	});

	it('rejects an unconfirmed, self-targeted, or terminal-source synthesis', () => {
		const { state } = checkpoint();
		expect(() =>
			EngineCommandSchema.parse({
				...synthesisCommand(state, 'private'),
				confirmedIrreversible: false
			})
		).toThrow();
		expect(() =>
			applyCommand(
				state,
				EngineCommandSchema.parse({
					...synthesisCommand(state, 'private'),
					recipientHeroId: sourceHeroId
				})
			)
		).toThrow(IllegalActionError);
		const once = applyCommand(state, synthesisCommand(state, 'private'));
		if (once.state.schemaVersion !== 22) throw new Error('Expected engine-v22');
		const onceState = once.state;
		expect(() =>
			applyCommand(
				onceState,
				EngineCommandSchema.parse({
					...synthesisCommand(onceState, 'private'),
					expectedVersion: onceState.version,
					recipientHeroId: witnessHeroId
				})
			)
		).toThrow(IllegalActionError);
	});
});
