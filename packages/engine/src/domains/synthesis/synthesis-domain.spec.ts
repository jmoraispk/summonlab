import { generateSummonableCharacterDraft, listSummonableHeroDrafts } from '@summonlab/characters';
import {
	EngineCommandSchema,
	EngineGameStateV22Schema,
	EngineGameStateV27Schema,
	type AuthoritativeEvent,
	type EngineGameStateV22,
	type EngineGameStateV27
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { IllegalActionError, ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';
import { applyCommand, createBootstrapEngine, hashGameState, legalActions } from '../../index.js';
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

const vectorIds = {
	runId: '27000000-0000-4000-8000-000000000001',
	sourceHeroId: '27000000-0000-4000-8000-000000000002',
	recipientHeroId: '27000000-0000-4000-8000-000000000003',
	witnessHeroId: '27000000-0000-4000-8000-000000000004',
	listenerHeroId: '27000000-0000-4000-8000-000000000005'
} as const;

const FROZEN_PROGRESSION_BEFORE = {
	stars: 1,
	level: 1,
	experience: 0,
	skills: { swordFighting: { rank: 0, experience: 0 } }
} as const;
const FROZEN_PROGRESSION_AFTER = {
	stars: 1,
	level: 5,
	experience: 40,
	skills: { swordFighting: { rank: 0, experience: 0 } }
} as const;

const FROZEN_PRIVATE_COMMAND = {
	commandId: 'c0e7c9d2-2f00-42d2-b26c-12bc7627cdd2',
	runId: vectorIds.runId,
	actorId: 'ef5cbacc-8c4b-4694-84dc-80377744321d',
	expectedVersion: 0,
	correlationId: 'b23042d3-1854-41ef-9fc0-da6d97717be5',
	source: {
		source: 'manual',
		timing: null,
		fallbackPolicy: null,
		directiveIds: [] as string[],
		decisionJobId: null
	},
	commandType: 'settlement.synthesize.hero',
	sourceHeroId: vectorIds.sourceHeroId,
	recipientHeroId: vectorIds.recipientHeroId,
	visibility: 'private',
	warningVersion: 'synthesis-warning-v1',
	confirmedIrreversible: true,
	rationale: 'Prepare the company for the next tower threshold.'
} as const;

const FROZEN_PRIVATE_RECEIPT = {
	receiptVersion: 'synthesis-receipt-v1',
	receiptId: '8f9decfd-1229-40a8-bc8a-9584cfc5c3c4',
	sourceEventId: '73b17e9f-6767-4199-bb1f-8f19e105f73f',
	masterId: 'ef5cbacc-8c4b-4694-84dc-80377744321d',
	sourceHeroId: vectorIds.sourceHeroId,
	recipientHeroId: vectorIds.recipientHeroId,
	visibility: 'private',
	warningVersion: 'synthesis-warning-v1',
	confirmedIrreversible: true,
	rationale: 'Prepare the company for the next tower threshold.',
	committedAt: '2000-01-01T00:00:00.000Z',
	essenceExperience: 40,
	sourceProgression: FROZEN_PROGRESSION_BEFORE,
	recipientProgressionBefore: FROZEN_PROGRESSION_BEFORE,
	recipientProgressionAfter: FROZEN_PROGRESSION_AFTER,
	socialConsequences: [
		{
			heroId: vectorIds.recipientHeroId,
			knowledge: 'participant',
			observationId: 'ea40184e-db4d-476a-b0e4-1dcf7e87f236',
			beliefId: '7f7d501c-ea7e-48f9-b157-0757da9fc59b',
			relationshipId: 'b61434d2-413c-4db1-b9d6-1c92d18fde6b',
			confidence: 100,
			relationshipDeltas: {
				trust: -4,
				respect: 2,
				fear: 7,
				affection: 0,
				resentment: 7,
				debt: 12
			}
		},
		{
			heroId: vectorIds.witnessHeroId,
			knowledge: 'absence',
			observationId: '2f5bea6e-689e-4e6b-b6b0-650bc9f31fda',
			beliefId: 'd14db827-e4ec-4fb9-b7c7-61e7587d38ca',
			relationshipId: '4c4a12f7-c30d-403b-92d5-1e8088ac72ee',
			confidence: 35,
			relationshipDeltas: {
				trust: -3,
				respect: -1,
				fear: 3,
				affection: 0,
				resentment: 2,
				debt: 0
			}
		},
		{
			heroId: vectorIds.listenerHeroId,
			knowledge: 'absence',
			observationId: 'bbd7b12e-42b0-4f43-bdd4-f6d4380fa88b',
			beliefId: '77008c86-f7cf-43cf-8da4-6f8d88b7206f',
			relationshipId: 'e2e376ae-4123-4548-b728-5408a92e3c5c',
			confidence: 35,
			relationshipDeltas: {
				trust: -3,
				respect: -1,
				fear: 3,
				affection: 0,
				resentment: 2,
				debt: 0
			}
		}
	]
} as const;

const FROZEN_PRIVATE_EVENT = {
	eventId: '73b17e9f-6767-4199-bb1f-8f19e105f73f',
	runId: vectorIds.runId,
	sequence: 2,
	schemaVersion: 22,
	gameTime: '2000-01-01T00:00:00.000Z',
	eventType: 'hero.synthesized',
	actorId: FROZEN_PRIVATE_COMMAND.actorId,
	commandId: FROZEN_PRIVATE_COMMAND.commandId,
	causationId: null,
	correlationId: FROZEN_PRIVATE_COMMAND.correlationId,
	source: FROZEN_PRIVATE_COMMAND.source,
	seedCursor: 0,
	beforeStateHash: '292cc5268b48f723ba1fa049056da1bb3af7ed66a80ab7034a674e57c5300cc2',
	afterStateHash: '3df8ef7fd97ddd5e71bd032cacea39b2cb319343bf9e6ac2e3a745cbffaa6dc9',
	contentVersion: 'engine-v22',
	payload: {
		receipt: FROZEN_PRIVATE_RECEIPT,
		nextVersion: 1,
		summary:
			'The Master irreversibly synthesized 27000000-0000-4000-8000-000000000002 into 27000000-0000-4000-8000-000000000003; knowledge remained witness-bounded.',
		rewardDeltas: [
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'experience',
				key: 'hero',
				before: 0,
				after: 40,
				delta: 40
			},
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'level',
				key: 'hero',
				before: 1,
				after: 5,
				delta: 4
			},
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'relationship',
				key: 'trust',
				before: 0,
				after: -4,
				delta: -4
			},
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'relationship',
				key: 'respect',
				before: 0,
				after: 2,
				delta: 2
			},
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 0,
				after: 7,
				delta: 7
			},
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 0,
				after: 7,
				delta: 7
			},
			{
				ownerId: vectorIds.recipientHeroId,
				kind: 'relationship',
				key: 'debt',
				before: 0,
				after: 12,
				delta: 12
			},
			{
				ownerId: vectorIds.witnessHeroId,
				kind: 'relationship',
				key: 'trust',
				before: 0,
				after: -3,
				delta: -3
			},
			{
				ownerId: vectorIds.witnessHeroId,
				kind: 'relationship',
				key: 'respect',
				before: 0,
				after: -1,
				delta: -1
			},
			{
				ownerId: vectorIds.witnessHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 0,
				after: 3,
				delta: 3
			},
			{
				ownerId: vectorIds.witnessHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 0,
				after: 2,
				delta: 2
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'trust',
				before: 0,
				after: -3,
				delta: -3
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'respect',
				before: 0,
				after: -1,
				delta: -1
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 0,
				after: 3,
				delta: 3
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 0,
				after: 2,
				delta: 2
			}
		],
		resolvedScheduledEventIds: [],
		canceledScheduledEventIds: [],
		entropyDraws: []
	}
} as const satisfies AuthoritativeEvent;

const FROZEN_RUMOR_COMMAND = {
	commandId: 'de5a4799-08bc-41ed-a89d-09df2da5966c',
	runId: vectorIds.runId,
	actorId: vectorIds.recipientHeroId,
	expectedVersion: 1,
	correlationId: '272c284d-a1e9-4d76-81cf-253499498a68',
	source: {
		source: 'scripted',
		timing: null,
		fallbackPolicy: null,
		directiveIds: [] as string[],
		decisionJobId: null
	},
	commandType: 'hero.share.synthesis.rumor',
	receiptId: FROZEN_PRIVATE_RECEIPT.receiptId,
	targetHeroId: vectorIds.listenerHeroId
} as const;

const FROZEN_RUMOR_RECORD = {
	rumorVersion: 'synthesis-rumor-v1',
	rumorId: 'bc79933b-c262-4145-b4f9-5d1d25714aad',
	receiptId: FROZEN_PRIVATE_RECEIPT.receiptId,
	sourceEventId: '3947ebf3-97d5-4f85-875a-0d7b5bb154cb',
	originObservationId: 'ea40184e-db4d-476a-b0e4-1dcf7e87f236',
	speakerHeroId: vectorIds.recipientHeroId,
	listenerHeroId: vectorIds.listenerHeroId,
	observationId: '7cd19aef-f9d6-4def-a02a-f17e9a5e315f',
	beliefId: 'a6971952-3e35-4ce7-a26a-c84136249f9f',
	relationshipId: 'e2e376ae-4123-4548-b728-5408a92e3c5c',
	confidence: 85,
	chainDepth: 1,
	relationshipDeltas: {
		trust: -6,
		respect: -2,
		fear: 8,
		affection: 0,
		resentment: 7,
		debt: 0
	},
	sharedAt: '2000-01-01T00:00:00.000Z'
} as const;

const FROZEN_RUMOR_EVENT = {
	eventId: '3947ebf3-97d5-4f85-875a-0d7b5bb154cb',
	runId: vectorIds.runId,
	sequence: 3,
	schemaVersion: 22,
	gameTime: '2000-01-01T00:00:00.000Z',
	eventType: 'social.synthesis.rumor.shared',
	actorId: vectorIds.recipientHeroId,
	commandId: FROZEN_RUMOR_COMMAND.commandId,
	causationId: null,
	correlationId: FROZEN_RUMOR_COMMAND.correlationId,
	source: FROZEN_RUMOR_COMMAND.source,
	seedCursor: 0,
	beforeStateHash: FROZEN_PRIVATE_EVENT.afterStateHash,
	afterStateHash: '03a2a7db83837473089a26715dc2177a83343036adb561ddfb0b0acaabb78bda',
	contentVersion: 'engine-v22',
	payload: {
		rumor: FROZEN_RUMOR_RECORD,
		nextVersion: 2,
		summary:
			'27000000-0000-4000-8000-000000000003 told 27000000-0000-4000-8000-000000000005 what happened in the synthesis chamber; the claim retained its source and confidence.',
		rewardDeltas: [
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'trust',
				before: -3,
				after: -9,
				delta: -6
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'respect',
				before: -1,
				after: -3,
				delta: -2
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 3,
				after: 11,
				delta: 8
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'affection',
				before: 0,
				after: 0,
				delta: 0
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 2,
				after: 9,
				delta: 7
			},
			{
				ownerId: vectorIds.listenerHeroId,
				kind: 'relationship',
				key: 'debt',
				before: 0,
				after: 0,
				delta: 0
			}
		],
		resolvedScheduledEventIds: [],
		canceledScheduledEventIds: [],
		entropyDraws: []
	}
} as const satisfies AuthoritativeEvent;

const FROZEN_RUMOR_OBSERVATION = {
	observationId: FROZEN_RUMOR_RECORD.observationId,
	sourceEventId: FROZEN_RUMOR_EVENT.eventId,
	observerHeroId: vectorIds.listenerHeroId,
	observedAt: '2000-01-01T00:00:00.000Z',
	kind: 'synthesis-rumor',
	synthesisReceiptId: FROZEN_PRIVATE_RECEIPT.receiptId,
	summary:
		'27000000-0000-4000-8000-000000000003 told me the Master synthesized 27000000-0000-4000-8000-000000000002 into 27000000-0000-4000-8000-000000000003.',
	subjectIds: [vectorIds.sourceHeroId, vectorIds.recipientHeroId]
} as const;

const FROZEN_RUMOR_BELIEF = {
	beliefId: FROZEN_RUMOR_RECORD.beliefId,
	holderHeroId: vectorIds.listenerHeroId,
	subjectId: vectorIds.sourceHeroId,
	predicate: 'was-synthesized-into',
	object: { kind: 'entity', entityId: vectorIds.recipientHeroId },
	confidence: 85,
	status: 'held',
	learnedAt: '2000-01-01T00:00:00.000Z',
	provenance: {
		kind: 'told',
		sourceEventId: FROZEN_RUMOR_EVENT.eventId,
		observationId: FROZEN_RUMOR_RECORD.observationId,
		learnedFromId: vectorIds.recipientHeroId,
		chainDepth: 1
	}
} as const;

const FROZEN_RUMOR_RELATIONSHIP = {
	relationshipId: FROZEN_RUMOR_RECORD.relationshipId,
	fromHeroId: vectorIds.listenerHeroId,
	toEntityId: FROZEN_PRIVATE_COMMAND.actorId,
	dimensions: { trust: -9, respect: -3, fear: 11, affection: 0, resentment: 9, debt: 0 },
	updatedAt: '2000-01-01T00:00:00.000Z',
	lastSourceEventId: FROZEN_RUMOR_EVENT.eventId,
	evidence: [
		{
			sourceEventId: FROZEN_PRIVATE_EVENT.eventId,
			observationId: 'bbd7b12e-42b0-4f43-bdd4-f6d4380fa88b',
			summary:
				'27000000-0000-4000-8000-000000000002 entered the summoning chamber and did not return; I do not know what happened inside.',
			deltas: { trust: -3, respect: -1, fear: 3, affection: 0, resentment: 2, debt: 0 }
		},
		{
			sourceEventId: FROZEN_RUMOR_EVENT.eventId,
			observationId: FROZEN_RUMOR_RECORD.observationId,
			summary: FROZEN_RUMOR_OBSERVATION.summary,
			deltas: FROZEN_RUMOR_RECORD.relationshipDeltas
		}
	]
} as const;

const openIds = {
	runId: '22000000-0000-4000-8000-000000000001',
	sourceHeroId: '22000000-0000-4000-8000-000000000002',
	recipientHeroId: '22000000-0000-4000-8000-000000000003',
	witnessHeroId: '22000000-0000-4000-8000-000000000004',
	listenerHeroId: '22000000-0000-4000-8000-000000000005'
} as const;

const FROZEN_OPEN_COMMAND = {
	commandId: '22000000-0000-4000-8000-000000000010',
	runId: openIds.runId,
	actorId: '4fd2a69a-c4bf-47c1-a411-a9519e3bc778',
	expectedVersion: 0,
	correlationId: '22000000-0000-4000-8000-000000000011',
	source: {
		source: 'manual',
		timing: null,
		fallbackPolicy: null,
		directiveIds: [] as string[],
		decisionJobId: null
	},
	commandType: 'settlement.synthesize.hero',
	sourceHeroId: openIds.sourceHeroId,
	recipientHeroId: openIds.recipientHeroId,
	visibility: 'open',
	warningVersion: 'synthesis-warning-v1',
	confirmedIrreversible: true,
	rationale: 'Convert one summon into bounded essence before the next tower attempt.'
} as const;

const FROZEN_OPEN_RECEIPT = {
	receiptVersion: 'synthesis-receipt-v1',
	receiptId: 'ab5baef7-f139-4f34-be5e-b38dff4235d0',
	sourceEventId: 'f6a1c85c-5d70-4358-ab86-6de53614dca5',
	masterId: FROZEN_OPEN_COMMAND.actorId,
	sourceHeroId: openIds.sourceHeroId,
	recipientHeroId: openIds.recipientHeroId,
	visibility: 'open',
	warningVersion: 'synthesis-warning-v1',
	confirmedIrreversible: true,
	rationale: FROZEN_OPEN_COMMAND.rationale,
	committedAt: '2000-01-01T00:00:00.000Z',
	essenceExperience: 40,
	sourceProgression: FROZEN_PROGRESSION_BEFORE,
	recipientProgressionBefore: FROZEN_PROGRESSION_BEFORE,
	recipientProgressionAfter: FROZEN_PROGRESSION_AFTER,
	socialConsequences: [
		{
			heroId: openIds.recipientHeroId,
			knowledge: 'participant',
			observationId: 'e4b244be-4faf-46da-aaa1-df7c865bfd81',
			beliefId: 'e88d722f-198a-4cca-bf78-7a5f03c92ede',
			relationshipId: '3827ec35-5f83-4ea4-b5e0-805f34967502',
			confidence: 100,
			relationshipDeltas: {
				trust: -4,
				respect: 2,
				fear: 7,
				affection: 0,
				resentment: 7,
				debt: 12
			}
		},
		{
			heroId: openIds.witnessHeroId,
			knowledge: 'witness',
			observationId: '70e47c4d-4113-475f-8f5f-b947fcf053c9',
			beliefId: '994d27fe-99b9-4672-a158-cbeae580c0c9',
			relationshipId: 'd3b88bef-680b-46c1-a87c-19d37b66723f',
			confidence: 100,
			relationshipDeltas: {
				trust: -10,
				respect: -4,
				fear: 14,
				affection: -2,
				resentment: 12,
				debt: 0
			}
		},
		{
			heroId: openIds.listenerHeroId,
			knowledge: 'witness',
			observationId: '62509196-cf65-4ac4-b3ed-cf1a45cd4d2b',
			beliefId: '796c28c8-080e-4a5c-b67f-023da6c330a2',
			relationshipId: '7ed6ceb8-b882-4cc1-ae2c-e6049331b5c3',
			confidence: 100,
			relationshipDeltas: {
				trust: -10,
				respect: -4,
				fear: 14,
				affection: -2,
				resentment: 12,
				debt: 0
			}
		}
	]
} as const;

const FROZEN_OPEN_EVENT = {
	eventId: FROZEN_OPEN_RECEIPT.sourceEventId,
	runId: openIds.runId,
	sequence: 2,
	schemaVersion: 22,
	gameTime: '2000-01-01T00:00:00.000Z',
	eventType: 'hero.synthesized',
	actorId: FROZEN_OPEN_COMMAND.actorId,
	commandId: FROZEN_OPEN_COMMAND.commandId,
	causationId: null,
	correlationId: FROZEN_OPEN_COMMAND.correlationId,
	source: FROZEN_OPEN_COMMAND.source,
	seedCursor: 0,
	beforeStateHash: '0f7eff8e469d5f1aeaf5b0d80389632f49296e70b712ea3e6707b5ea8a63c60e',
	afterStateHash: 'b61d9bfc687ef7bb1d2d947572b302418525aee4ab3f22694c64178755b9b832',
	contentVersion: 'engine-v22',
	payload: {
		receipt: FROZEN_OPEN_RECEIPT,
		nextVersion: 1,
		summary:
			'The Master irreversibly synthesized 22000000-0000-4000-8000-000000000002 into 22000000-0000-4000-8000-000000000003; knowledge remained witness-bounded.',
		rewardDeltas: [
			{
				ownerId: openIds.recipientHeroId,
				kind: 'experience',
				key: 'hero',
				before: 0,
				after: 40,
				delta: 40
			},
			{
				ownerId: openIds.recipientHeroId,
				kind: 'level',
				key: 'hero',
				before: 1,
				after: 5,
				delta: 4
			},
			{
				ownerId: openIds.recipientHeroId,
				kind: 'relationship',
				key: 'trust',
				before: 0,
				after: -4,
				delta: -4
			},
			{
				ownerId: openIds.recipientHeroId,
				kind: 'relationship',
				key: 'respect',
				before: 0,
				after: 2,
				delta: 2
			},
			{
				ownerId: openIds.recipientHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 0,
				after: 7,
				delta: 7
			},
			{
				ownerId: openIds.recipientHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 0,
				after: 7,
				delta: 7
			},
			{
				ownerId: openIds.recipientHeroId,
				kind: 'relationship',
				key: 'debt',
				before: 0,
				after: 12,
				delta: 12
			},
			{
				ownerId: openIds.witnessHeroId,
				kind: 'relationship',
				key: 'trust',
				before: 0,
				after: -10,
				delta: -10
			},
			{
				ownerId: openIds.witnessHeroId,
				kind: 'relationship',
				key: 'respect',
				before: 0,
				after: -4,
				delta: -4
			},
			{
				ownerId: openIds.witnessHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 0,
				after: 14,
				delta: 14
			},
			{
				ownerId: openIds.witnessHeroId,
				kind: 'relationship',
				key: 'affection',
				before: 0,
				after: -2,
				delta: -2
			},
			{
				ownerId: openIds.witnessHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 0,
				after: 12,
				delta: 12
			},
			{
				ownerId: openIds.listenerHeroId,
				kind: 'relationship',
				key: 'trust',
				before: 0,
				after: -10,
				delta: -10
			},
			{
				ownerId: openIds.listenerHeroId,
				kind: 'relationship',
				key: 'respect',
				before: 0,
				after: -4,
				delta: -4
			},
			{
				ownerId: openIds.listenerHeroId,
				kind: 'relationship',
				key: 'fear',
				before: 0,
				after: 14,
				delta: 14
			},
			{
				ownerId: openIds.listenerHeroId,
				kind: 'relationship',
				key: 'affection',
				before: 0,
				after: -2,
				delta: -2
			},
			{
				ownerId: openIds.listenerHeroId,
				kind: 'relationship',
				key: 'resentment',
				before: 0,
				after: 12,
				delta: 12
			}
		],
		resolvedScheduledEventIds: [],
		canceledScheduledEventIds: [],
		entropyDraws: []
	}
} as const satisfies AuthoritativeEvent;

function vectorCheckpoint(): EngineGameStateV22 {
	const state = createBootstrapEngine({
		runId: vectorIds.runId,
		seed: 'phase-7-synthesis-evidence',
		heroId: vectorIds.sourceHeroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableSynthesis: true,
			additionalHeroes: [
				{ heroId: vectorIds.recipientHeroId, manifestHash: '2'.repeat(64) },
				{ heroId: vectorIds.witnessHeroId, manifestHash: '3'.repeat(64) },
				{ heroId: vectorIds.listenerHeroId, manifestHash: '4'.repeat(64) }
			]
		}
	}).snapshot.state;
	return EngineGameStateV22Schema.parse(state);
}

function privateState(): EngineGameStateV22 {
	return EngineGameStateV22Schema.parse(
		synthesisEventReducer.reduce(vectorCheckpoint(), FROZEN_PRIVATE_EVENT)
	);
}

function openCheckpoint(): EngineGameStateV22 {
	const state = createBootstrapEngine({
		runId: openIds.runId,
		seed: 'synthesis-runtime-proof',
		heroId: openIds.sourceHeroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario: {
			initialMissionId: 'tower-floor-01',
			availableMissionIds: ['tower-floor-01'],
			enableSynthesis: true,
			additionalHeroes: [
				{ heroId: openIds.recipientHeroId, manifestHash: '2'.repeat(64), rarityStars: 1 },
				{ heroId: openIds.witnessHeroId, manifestHash: '3'.repeat(64), rarityStars: 1 },
				{ heroId: openIds.listenerHeroId, manifestHash: '4'.repeat(64), rarityStars: 1 }
			]
		}
	}).snapshot.state;
	return EngineGameStateV22Schema.parse(state);
}

function captureError(operation: () => unknown): unknown {
	try {
		operation();
		return null;
	} catch (error) {
		return error;
	}
}

function expectIllegalActionError(error: unknown, actionId: string): void {
	expect(error).toBeInstanceOf(IllegalActionError);
	if (!(error instanceof IllegalActionError)) throw new Error('Expected IllegalActionError');
	expect(error.name).toBe('IllegalActionError');
	expect(error.message).toBe(`Action is not legal in the current state: ${actionId}`);
	expect(error.code).toBe('ILLEGAL_ACTION');
	expect(error.legalActionIds).toStrictEqual([]);
}

function expectReplayIntegrityError(error: unknown, message: string, sequence: number): void {
	expect(error).toBeInstanceOf(ReplayIntegrityError);
	if (!(error instanceof ReplayIntegrityError)) throw new Error('Expected ReplayIntegrityError');
	expect(error.name).toBe('ReplayIntegrityError');
	expect(error.message).toBe(message);
	expect(error.sequence).toBe(sequence);
	expect('code' in error).toBe(false);
}

describe('synthesis domain ownership', () => {
	it('owns the exact ordered v22 synthesis command and event discriminators', () => {
		expect(synthesisCommandHandler.ownerId).toBe('synthesis');
		expect(synthesisCommandHandler.commandTypes).toStrictEqual(EXPECTED_SYNTHESIS_COMMAND_TYPES);
		expect(synthesisEventReducer.ownerId).toBe('synthesis');
		expect(synthesisEventReducer.eventTypes).toStrictEqual(EXPECTED_SYNTHESIS_EVENT_TYPES);
	});

	it('builds the complete frozen pre-extraction private event and state artifact', () => {
		const state = vectorCheckpoint();
		const command = EngineCommandSchema.parse(FROZEN_PRIVATE_COMMAND) as SynthesisCommand;
		const before = structuredClone(state);

		expect(hashGameState(state)).toBe(FROZEN_PRIVATE_EVENT.beforeStateHash);
		synthesisCommandHandler.assertLegal(state, command);
		const built = synthesisCommandHandler.buildEvent(state, command);
		const reduced = synthesisEventReducer.reduce(state, built);

		expect({ ...built, afterStateHash: hashGameState(reduced) }).toStrictEqual(
			FROZEN_PRIVATE_EVENT
		);
		expect(hashGameState(reduced)).toBe(FROZEN_PRIVATE_EVENT.afterStateHash);
		expect(EngineGameStateV22Schema.parse(reduced).synthesis).toStrictEqual({
			contentVersion: 'synthesis-v1',
			receipts: { [FROZEN_PRIVATE_RECEIPT.receiptId]: FROZEN_PRIVATE_RECEIPT },
			rumors: {}
		});
		expect(state).toStrictEqual(before);
	});

	it('routes v27 synthesis essence through the shared progression owner', async () => {
		const recipes = listSummonableHeroDrafts();
		const primaryRecipe = recipes[0];
		const sourceRecipe = recipes[1];
		if (!primaryRecipe || !sourceRecipe) throw new Error('Expected two approved summonable drafts');
		const recipientDraft = await generateSummonableCharacterDraft(primaryRecipe.recipe, {
			capabilityEntropy: '1'.repeat(64)
		});
		const sourceDraft = await generateSummonableCharacterDraft(sourceRecipe.recipe, {
			capabilityEntropy: '2'.repeat(64)
		});
		const bootstrapped = createBootstrapEngine({
			runId: deterministicUuid('synthesis-v27-run'),
			seed: 'synthesis-v27-seed',
			draft: recipientDraft,
			additionalHeroes: [{ draft: sourceDraft }]
		}).snapshot.state;
		if (bootstrapped.schemaVersion !== 27) throw new Error('Expected engine-v27 state');
		const recipientId = recipientDraft.manifest.characterId;
		const sourceId = sourceDraft.manifest.characterId;
		const recipient = bootstrapped.heroes[recipientId]!;
		const state: EngineGameStateV27 = EngineGameStateV27Schema.parse({
			...bootstrapped,
			heroes: {
				...bootstrapped.heroes,
				[recipientId]: {
					...recipient,
					health: Math.floor(recipient.maxHealth / 2),
					progression: { ...recipient.progression, level: 99, experience: 985 }
				}
			}
		});
		const command = EngineCommandSchema.parse({
			commandId: deterministicUuid('synthesis-v27-command'),
			runId: state.runId,
			actorId: state.master.masterId,
			expectedVersion: state.version,
			correlationId: deterministicUuid('synthesis-v27-correlation'),
			source: {
				source: 'manual',
				timing: null,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			},
			commandType: 'settlement.synthesize.hero',
			sourceHeroId: sourceId,
			recipientHeroId: recipientId,
			visibility: 'private',
			warningVersion: 'synthesis-warning-v1',
			confirmedIrreversible: true,
			rationale: 'Verify shared v27 progression accounting.'
		});

		const result = applyCommand(state, command);
		if (result.state.schemaVersion !== 27) throw new Error('Expected engine-v27 result');
		const after = result.state.heroes[recipientId]!;
		const receipt = Object.values(result.state.synthesis.receipts)[0]!;

		expect(receipt.receiptVersion).toBe('synthesis-receipt-v2');
		if (receipt.receiptVersion !== 'synthesis-receipt-v2') throw new Error('Expected v2 receipt');
		expect(receipt.experienceReceipt.claim.sourceKind).toBe('synthesis');
		expect(receipt.experienceReceipt.levelBefore).toBe(99);
		expect(receipt.experienceReceipt.levelAfter).toBeGreaterThanOrEqual(100);
		expect(receipt.experienceReceipt.pointsGranted).toBe(
			(receipt.experienceReceipt.levelAfter - 99) * recipient.progression.stars
		);
		expect(after.progression).toStrictEqual(receipt.recipientProgressionAfter);
		expect(after.health).toBe(state.heroes[recipientId]!.health);
		expect(after.maxHealth).toBeGreaterThan(state.heroes[recipientId]!.maxHealth);
		expect(result.state.heroes[sourceId]!.lifeState).toBe('synthesized');
	});

	it('builds the complete frozen pre-extraction rumor event and provenance state', () => {
		const state = privateState();
		const command = EngineCommandSchema.parse(FROZEN_RUMOR_COMMAND) as SynthesisCommand;
		const before = structuredClone(state);

		synthesisCommandHandler.assertLegal(state, command);
		const built = synthesisCommandHandler.buildEvent(state, command);
		const reduced = EngineGameStateV22Schema.parse(synthesisEventReducer.reduce(state, built));

		expect({ ...built, afterStateHash: hashGameState(reduced) }).toStrictEqual(FROZEN_RUMOR_EVENT);
		expect(hashGameState(reduced)).toBe(FROZEN_RUMOR_EVENT.afterStateHash);
		expect(reduced.synthesis).toStrictEqual({
			contentVersion: 'synthesis-v1',
			receipts: { [FROZEN_PRIVATE_RECEIPT.receiptId]: FROZEN_PRIVATE_RECEIPT },
			rumors: { [FROZEN_RUMOR_RECORD.rumorId]: FROZEN_RUMOR_RECORD }
		});
		expect(reduced.society.observations[FROZEN_RUMOR_RECORD.observationId]).toStrictEqual(
			FROZEN_RUMOR_OBSERVATION
		);
		expect(reduced.society.beliefs[FROZEN_RUMOR_RECORD.beliefId]).toStrictEqual(
			FROZEN_RUMOR_BELIEF
		);
		expect(reduced.society.relationships[FROZEN_RUMOR_RECORD.relationshipId]).toStrictEqual(
			FROZEN_RUMOR_RELATIONSHIP
		);
		expect(state).toStrictEqual(before);
	});

	it('builds the complete frozen pre-extraction open event and witness order', () => {
		const state = openCheckpoint();
		const command = EngineCommandSchema.parse(FROZEN_OPEN_COMMAND) as SynthesisCommand;
		const before = structuredClone(state);

		expect(hashGameState(state)).toBe(FROZEN_OPEN_EVENT.beforeStateHash);
		synthesisCommandHandler.assertLegal(state, command);
		const built = synthesisCommandHandler.buildEvent(state, command);
		const reduced = EngineGameStateV22Schema.parse(synthesisEventReducer.reduce(state, built));

		expect({ ...built, afterStateHash: hashGameState(reduced) }).toStrictEqual(FROZEN_OPEN_EVENT);
		expect(hashGameState(reduced)).toBe(FROZEN_OPEN_EVENT.afterStateHash);
		expect(reduced.synthesis).toStrictEqual({
			contentVersion: 'synthesis-v1',
			receipts: { [FROZEN_OPEN_RECEIPT.receiptId]: FROZEN_OPEN_RECEIPT },
			rumors: {}
		});
		expect(
			FROZEN_OPEN_RECEIPT.socialConsequences.map(({ heroId, knowledge }) => ({
				heroId,
				knowledge
			}))
		).toStrictEqual([
			{ heroId: openIds.recipientHeroId, knowledge: 'participant' },
			{ heroId: openIds.witnessHeroId, knowledge: 'witness' },
			{ heroId: openIds.listenerHeroId, knowledge: 'witness' }
		]);
		expect(state).toStrictEqual(before);
	});

	it('rejects a self-targeted rumor with the frozen IllegalActionError contract', () => {
		const state = privateState();
		const command = EngineCommandSchema.parse({
			...FROZEN_RUMOR_COMMAND,
			targetHeroId: FROZEN_RUMOR_COMMAND.actorId
		}) as SynthesisCommand;
		const before = structuredClone(state);

		expectIllegalActionError(
			captureError(() => synthesisCommandHandler.assertLegal(state, command)),
			command.commandType
		);
		expect(state).toStrictEqual(before);
	});

	it('rejects a tampered rumor with the frozen ReplayIntegrityError contract', () => {
		const state = privateState();
		const tampered = structuredClone(FROZEN_RUMOR_EVENT) as AuthoritativeEvent;
		const payload = tampered.payload as { rumor: { confidence: number } };
		payload.rumor.confidence -= 1;
		const before = structuredClone(state);

		expectReplayIntegrityError(
			captureError(() => synthesisEventReducer.reduce(state, tampered)),
			'Synthesis rumor payload diverged',
			3
		);
		expect(state).toStrictEqual(before);
	});

	it('preserves Master-first actor dispatch when a v22 hero is keyed by the Master ID', () => {
		const state = privateState();
		const receipt = state.synthesis.receipts[FROZEN_RUMOR_COMMAND.receiptId]!;
		const participant = receipt.socialConsequences.find(
			(consequence) => consequence.knowledge === 'participant'
		)!;
		const masterId = state.master.masterId;
		const observationId = '27000000-0000-4000-8000-000000000030';
		const beliefId = '27000000-0000-4000-8000-000000000031';
		const relationshipId = '27000000-0000-4000-8000-000000000032';
		const participantObservation = state.society.observations[participant.observationId]!;
		const participantBelief = state.society.beliefs[participant.beliefId]!;
		const participantRelationship = state.society.relationships[participant.relationshipId]!;
		const adversarialState = EngineGameStateV22Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[masterId]: {
					...state.heroes[FROZEN_RUMOR_COMMAND.actorId],
					heroId: masterId,
					equipment: { mainHand: null }
				}
			},
			society: {
				...state.society,
				observations: {
					...state.society.observations,
					[observationId]: {
						...participantObservation,
						observationId,
						observerHeroId: masterId
					}
				},
				beliefs: {
					...state.society.beliefs,
					[beliefId]: {
						...participantBelief,
						beliefId,
						holderHeroId: masterId,
						provenance: { ...participantBelief.provenance, observationId }
					}
				},
				relationships: {
					...state.society.relationships,
					[relationshipId]: {
						...participantRelationship,
						relationshipId,
						fromHeroId: masterId,
						evidence: participantRelationship.evidence.map((evidence) => ({
							...evidence,
							observationId
						}))
					}
				}
			},
			synthesis: {
				...state.synthesis,
				receipts: {
					...state.synthesis.receipts,
					[receipt.receiptId]: {
						...receipt,
						socialConsequences: [
							...receipt.socialConsequences,
							{
								...participant,
								heroId: masterId,
								observationId,
								beliefId,
								relationshipId
							}
						]
					}
				}
			}
		});
		const command = EngineCommandSchema.parse({
			...FROZEN_RUMOR_COMMAND,
			commandId: '27000000-0000-4000-8000-000000000020',
			correlationId: '27000000-0000-4000-8000-000000000021',
			actorId: masterId
		}) as SynthesisCommand;
		if (command.commandType !== 'hero.share.synthesis.rumor') {
			throw new Error('Expected synthesis rumor command');
		}
		const requiredActionId = `synthesis.rumor.share.${command.receiptId.slice(-8)}.${command.targetHeroId.slice(-8)}`;
		const before = structuredClone(adversarialState);

		expect(legalActions(adversarialState, masterId).map((action) => action.actionId)).not.toContain(
			requiredActionId
		);
		for (const operation of [
			() => synthesisCommandHandler.assertLegal(adversarialState, command),
			() => applyCommand(adversarialState, command)
		]) {
			expectIllegalActionError(captureError(operation), command.commandType);
		}
		expect(adversarialState).toStrictEqual(before);
	});
});
