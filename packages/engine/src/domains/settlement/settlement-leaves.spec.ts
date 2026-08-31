import { EngineGameStateV13Schema, type EngineCommand } from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { settlementForState } from '../../core/content-bindings.js';
import { IllegalActionError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { applyCommand, createBootstrapEngine, legalActions, sha256Hex } from '../../index.js';
import {
	currentTravelFor,
	routeHasCapacity,
	settlementRouteFor,
	zoneForNode
} from './navigation.js';
import { buildRoutineOutcome, createDailyPlan, resolveDailyRoutine } from './routines.js';
import {
	buildCommunicativeSociety,
	buildConversationSociety,
	buildDirectiveChange,
	buildFirstEmberReaction,
	buildFirstEmberSociety
} from './society.js';

function source() {
	return {
		source: 'scripted' as const,
		timing: 'continuous' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function manualSource() {
	return { ...source(), source: 'manual' as const, timing: 'step' as const };
}

function fixture() {
	return createBootstrapEngine({
		runId: deterministicUuid('task-7a-run'),
		seed: 'task-7a-seed',
		heroId: deterministicUuid('task-7a-hero'),
		manifestHash: sha256Hex('task-7a-manifest')
	});
}

function commandBase(
	state: ReturnType<typeof fixture>['snapshot']['state'],
	actorId: string,
	key: string
) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: source()
	};
}

function arrivedState() {
	const initial = EngineGameStateV13Schema.parse(fixture().snapshot.state);
	const heroId = Object.keys(initial.heroes)[0]!;
	return {
		heroId,
		state: EngineGameStateV13Schema.parse({
			...initial,
			version: 3,
			eventCursor: 4,
			simulatedAt: '2000-01-01T00:02:06.000Z',
			heroes: {
				...initial.heroes,
				[heroId]: {
					...initial.heroes[heroId]!,
					location: 'training-ground',
					locationNodeId: 'training-ring',
					firstArrivalCompleted: true,
					destination: 'training-ground'
				}
			}
		})
	};
}

describe('settlement leaf ownership', () => {
	it('derives the exact route and preserves route completion bytes without mutating state', () => {
		const state = EngineGameStateV13Schema.parse(fixture().snapshot.state);
		const heroId = Object.keys(state.heroes)[0]!;
		const definition = settlementForState(state);
		const before = structuredClone(state);
		const route = settlementRouteFor(state, definition, heroId, 'training-ring');

		expect(route).toStrictEqual({
			fromNodeId: 'gate-dais',
			toNodeId: 'training-ring',
			nodeIds: ['gate-dais', 'gate-court', 'courtyard-heart', 'training-entry', 'training-ring'],
			steps: [
				{
					edgeId: 'gate-dais-to-court',
					fromNodeId: 'gate-dais',
					toNodeId: 'gate-court',
					travelGameSeconds: 15
				},
				{
					edgeId: 'gate-court-to-heart',
					fromNodeId: 'gate-court',
					toNodeId: 'courtyard-heart',
					travelGameSeconds: 45
				},
				{
					edgeId: 'heart-to-training',
					fromNodeId: 'courtyard-heart',
					toNodeId: 'training-entry',
					travelGameSeconds: 52
				},
				{
					edgeId: 'training-entry-to-ring',
					fromNodeId: 'training-entry',
					toNodeId: 'training-ring',
					travelGameSeconds: 14
				}
			],
			totalTravelGameSeconds: 126,
			bottleneckCapacity: 6
		});
		expect(zoneForNode(definition, 'training-ring')).toBe('training-ground');
		expect(routeHasCapacity(state, definition, heroId, 'training-ring', route)).toBe(true);
		expect(currentTravelFor(state, heroId)).toBeNull();
		expect(state).toStrictEqual(before);

		const chosen = applyCommand(state, {
			...commandBase(state, heroId, 'choose-training'),
			commandType: 'hero.choose.destination',
			destination: 'training-ground',
			firstLine: 'Let me test what this body remembers.',
			storyBranch: 'steel-before-trust'
		});
		const traveling = applyCommand(chosen.state, {
			...commandBase(chosen.state, heroId, 'travel-training'),
			commandType: 'hero.start.travel',
			targetNodeId: 'training-ring'
		});
		expect(traveling.scheduled).toStrictEqual([
			{
				scheduledEventId: '8b7b9dd2-84a8-415c-82a3-2cf36abba03c',
				runId: '2db3083a-e8be-45bf-8b56-d01223e06b64',
				actorId: heroId,
				dueGameTime: '2000-01-01T00:02:06.000Z',
				eventKind: 'hero.travel.arrive',
				payload: {
					heroId,
					travelId: '6feef947-8131-4190-9803-1f2dbfe479b5',
					fromNodeId: 'gate-dais',
					toNodeId: 'training-ring',
					settlementContentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9'
				}
			}
		]);
		expect(hashCanonical(traveling.events[0])).toBe(
			'3d04d7fcb65db2ceb9146328442191113cd1ab4f9731e6d758f791c51008363a'
		);
		const arrived = applyCommand(traveling.state, {
			...commandBase(traveling.state, traveling.state.master.masterId, 'arrive-training'),
			commandType: 'simulation.advance',
			targetGameTime: traveling.scheduled[0]!.dueGameTime
		});
		expect(arrived.events[0]!.payload.travelOutcomes).toStrictEqual([
			{
				scheduledEventId: '8b7b9dd2-84a8-415c-82a3-2cf36abba03c',
				heroId,
				travelId: '6feef947-8131-4190-9803-1f2dbfe479b5',
				fromNodeId: 'gate-dais',
				toNodeId: 'training-ring',
				locationAfter: 'training-ground'
			}
		]);
		expect(arrived.stateHash).toBe(
			'fa1dddc1fb9a589a14f6924ff399c0787079677996bc786dc618209050595a0a'
		);
	});

	it('rejects saturated route and facility capacity with the exact legacy error precedence', () => {
		const { state, heroId } = arrivedState();
		const assigned = applyCommand(state, {
			...commandBase(state, state.master.masterId, 'assign-workshop'),
			commandType: 'settlement.assign.hero',
			heroId,
			buildingId: 'workshop',
			role: 'artisan'
		});
		if (assigned.state.schemaVersion !== 13) throw new Error('Expected engine-v13 state');
		const secondHeroId = deterministicUuid('task-7a-second-hero');
		const saturated = EngineGameStateV13Schema.parse({
			...assigned.state,
			heroes: {
				...assigned.state.heroes,
				[secondHeroId]: {
					...assigned.state.heroes[heroId]!,
					heroId: secondHeroId,
					equipment: { mainHand: null },
					assignment: null
				}
			},
			settlement: {
				...assigned.state.settlement,
				buildings: {
					...assigned.state.settlement.buildings,
					workshop: {
						...assigned.state.settlement.buildings.workshop!,
						assignmentCapacity: 1
					}
				}
			}
		});
		const command = {
			...commandBase(saturated, saturated.master.masterId, 'overfill-workshop'),
			commandType: 'settlement.assign.hero',
			heroId: secondHeroId,
			buildingId: 'workshop',
			role: 'artisan'
		} satisfies EngineCommand;
		const before = structuredClone(saturated);
		let caught: unknown;
		try {
			applyCommand(saturated, command);
		} catch (error) {
			caught = error;
		}
		expect(caught).toBeInstanceOf(IllegalActionError);
		expect(caught).toMatchObject({
			name: 'IllegalActionError',
			code: 'ILLEGAL_ACTION',
			message:
				'Action is not legal in the current state: settlement.assign.f2a1aca3-1ee8-468a-bb7b-a474009e3750.workshop',
			legalActionIds: [
				'master.inspect.gate',
				'mission.prepare',
				'settlement.unassign.c695ecaf-780f-4c02-838f-bbc94901747a',
				'settlement.assign.c695ecaf-780f-4c02-838f-bbc94901747a.summoning-gate',
				'settlement.assign.c695ecaf-780f-4c02-838f-bbc94901747a.kitchen',
				'settlement.assign.c695ecaf-780f-4c02-838f-bbc94901747a.dormitory',
				'settlement.assign.c695ecaf-780f-4c02-838f-bbc94901747a.training-ground',
				'settlement.assign.f2a1aca3-1ee8-468a-bb7b-a474009e3750.summoning-gate',
				'settlement.assign.f2a1aca3-1ee8-468a-bb7b-a474009e3750.kitchen',
				'settlement.assign.f2a1aca3-1ee8-468a-bb7b-a474009e3750.dormitory',
				'settlement.assign.f2a1aca3-1ee8-468a-bb7b-a474009e3750.training-ground',
				'simulation.damage.hero.c695ecaf-780f-4c02-838f-bbc94901747a',
				'simulation.damage.hero.f2a1aca3-1ee8-468a-bb7b-a474009e3750',
				'simulation.damage.master'
			]
		});
		expect(saturated).toStrictEqual(before);
		expect(
			legalActions(saturated, saturated.master.masterId).map((candidate) => candidate.actionId)
		).not.toContain(`settlement.assign.${secondHeroId}.workshop`);
	});

	it('derives the exact daily plan, routine resolution, outcome, and reward order', () => {
		const { state, heroId } = arrivedState();
		const commandId = deterministicUuid(`${state.runId}:plan-day:${state.version}`);
		const before = structuredClone(state);
		const dailyPlan = createDailyPlan(state, heroId, commandId);
		expect(dailyPlan.entries.map((entry) => entry.kind)).toStrictEqual([
			'checks-exits',
			'self-directed',
			'meal',
			'sleep'
		]);
		const planned = EngineGameStateV13Schema.parse({
			...state,
			heroes: { ...state.heroes, [heroId]: { ...state.heroes[heroId]!, dailyPlan } }
		});
		const resolution = resolveDailyRoutine(planned, heroId);
		expect(resolution).toStrictEqual({
			selectedPlanEntryId: '76f2aef8-f297-4bed-8aa4-c093e742769e',
			selectedKind: 'checks-exits',
			candidateScores: [
				{
					planEntryId: '76f2aef8-f297-4bed-8aa4-c093e742769e',
					kind: 'checks-exits',
					score: 71,
					eligible: true,
					reasons: ['habit strength 68', 'conscientiousness 60']
				},
				{
					planEntryId: '000de5d7-3bb7-4d06-afdf-27a4fa6c715f',
					kind: 'self-directed',
					score: 48,
					eligible: true,
					reasons: ['openness 55']
				},
				{
					planEntryId: '9ab16641-4802-498f-aac8-c6489514ad33',
					kind: 'meal',
					score: 46,
					eligible: true,
					reasons: ['hunger 20', 'food available']
				},
				{
					planEntryId: 'd46424a8-447f-4645-a572-86810e36b322',
					kind: 'sleep',
					score: 21,
					eligible: true,
					reasons: ['fatigue 15', 'health 100/100']
				}
			],
			margin: 23,
			decisionRecommended: false,
			fallbackUsed: false,
			summary: 'survey the exits led the next eligible routine by 23.'
		});
		expect(hashCanonical(resolution)).toBe(
			'3bfca9257954f623f749e59e0bcc89677e23eed3129c753131ffea3d358912e6'
		);
		const routineState = EngineGameStateV13Schema.parse({
			...planned,
			heroes: {
				...planned.heroes,
				[heroId]: {
					...planned.heroes[heroId]!,
					dailyPlan: {
						...dailyPlan,
						entries: dailyPlan.entries.map((entry) =>
							entry.planEntryId === resolution!.selectedPlanEntryId
								? { ...entry, status: 'active' as const, startedAt: state.simulatedAt }
								: entry
						)
					},
					currentRoutine: {
						routineId: 'd14f73f6-f7e9-4073-bff1-35dc596f17e5',
						scheduledEventId: 'a7424df1-b847-4009-9e09-e632f5ec1658',
						planId: dailyPlan.planId,
						planEntryId: resolution!.selectedPlanEntryId,
						kind: resolution!.selectedKind,
						resolution,
						startedAt: state.simulatedAt,
						completesAt: '2000-01-01T00:27:06.000Z'
					}
				}
			}
		});
		expect(buildRoutineOutcome(routineState, heroId)).toStrictEqual({
			scheduledEventId: 'a7424df1-b847-4009-9e09-e632f5ec1658',
			heroId,
			planId: '71a17914-8d0f-4f0e-af6e-fcdb1fc3acb8',
			planEntryId: '76f2aef8-f297-4bed-8aa4-c093e742769e',
			kind: 'checks-exits',
			needsAfter: { hunger: 23, fatigue: 18 },
			healthAfter: 100,
			habitAfter: {
				habit: 'checks-exits',
				strength: 69,
				repetitions: 1,
				satisfaction: 58,
				lastTriggeredAt: '2000-01-01T00:27:06.000Z'
			},
			rewardDeltas: [
				{ ownerId: heroId, kind: 'need', key: 'hunger', before: 20, after: 23, delta: 3 },
				{ ownerId: heroId, kind: 'need', key: 'fatigue', before: 15, after: 18, delta: 3 },
				{ ownerId: heroId, kind: 'habit', key: 'strength', before: 68, after: 69, delta: 1 },
				{ ownerId: heroId, kind: 'habit', key: 'satisfaction', before: 50, after: 58, delta: 8 }
			]
		});
		expect(state).toStrictEqual(before);
	});

	it('derives First Ember reactions, evidence, confidence, provenance, and witness order', () => {
		const state = EngineGameStateV13Schema.parse(fixture().snapshot.state);
		const hero = Object.values(state.heroes)[0]!;
		const eventId = 'd3373d03-81f5-4933-9390-c0e7fab15ad1';
		const before = structuredClone(state);
		const reaction = buildFirstEmberReaction(hero, 'training-ground', 'prepare-tower');
		expect(reaction).toStrictEqual({
			heroId: hero.heroId,
			stance: 'support',
			score: 59,
			summary: 'The hero openly supports the commitment and its stated purpose.',
			factors: [
				'physical readiness contributes 17',
				'value duty supports preparation',
				'drive survive supports tower readiness',
				'the explanation matches the chosen facility',
				'agreeableness 50 shapes willingness to accept'
			]
		});
		const society = buildFirstEmberSociety(state, eventId, 'training-ground', 'prepare-tower', [
			reaction
		]);
		expect(hashCanonical(society)).toBe(
			'699aa04908b9b95890a3858949df8088f5533945aaef0ef9715b2151bcb00b13'
		);
		const newBeliefs = Object.values(society.beliefs).filter(
			(belief) => belief.provenance.sourceEventId === eventId
		);
		expect(newBeliefs.map((belief) => belief.beliefId)).toStrictEqual([
			'2137de17-b2a5-4e54-a9ee-243e75d067d8',
			'5aabad37-4618-47e5-b89b-73dd0be116dd'
		]);
		expect(newBeliefs.map((belief) => belief.confidence)).toStrictEqual([100, 100]);
		expect(newBeliefs.map((belief) => belief.provenance)).toStrictEqual([
			{
				kind: 'observed',
				sourceEventId: eventId,
				observationId: '22f2558a-023a-42f0-824a-0bec0b33ce76',
				learnedFromId: null,
				chainDepth: 0
			},
			{
				kind: 'observed',
				sourceEventId: eventId,
				observationId: '22f2558a-023a-42f0-824a-0bec0b33ce76',
				learnedFromId: null,
				chainDepth: 0
			}
		]);
		expect(state).toStrictEqual(before);
	});

	it('derives open communication with exact deterministic witness and belief ordering', () => {
		const state = EngineGameStateV13Schema.parse(fixture().snapshot.state);
		const heroId = Object.keys(state.heroes)[0]!;
		const bystanderId = deterministicUuid('task-7a-bystander');
		const expanded = EngineGameStateV13Schema.parse({
			...state,
			heroes: {
				...state.heroes,
				[bystanderId]: {
					...state.heroes[heroId]!,
					heroId: bystanderId,
					equipment: { mainHand: null },
					assignment: null
				}
			}
		});
		const before = structuredClone(expanded);
		const resolved = buildCommunicativeSociety(expanded, 'cd197350-0d01-41f2-80c0-27cdd18a3f62', {
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'summoning-situation',
			exactText: 'You crossed the gate into Hearth 01.',
			tone: 'neutral',
			delivery: 'open'
		});
		expect(resolved.communicativeAct.witnesses).toStrictEqual([
			{
				heroId,
				role: 'intended',
				perception: 'addressed',
				observationId: '77a9fc57-421f-4694-89e4-159045dcd321',
				beliefId: 'ca9037d1-e422-4789-97bb-b11e7b367d66'
			},
			{
				heroId: bystanderId,
				role: 'bystander',
				perception: 'overheard',
				observationId: 'd028726c-c681-4852-af55-806e641ce916',
				beliefId: 'a6abe28f-56c6-4190-a2b4-b33155b56399'
			}
		]);
		expect(
			resolved.communicativeAct.witnesses.map((witness) =>
				witness.beliefId ? resolved.society.beliefs[witness.beliefId]!.confidence : null
			)
		).toStrictEqual([85, 70]);
		expect(hashCanonical(resolved.society)).toBe(
			'a22927958fd48b2cfe25b099220d5e963f9b27689f379c8de82faac5080819b1'
		);
		expect(expanded).toStrictEqual(before);
	});

	it('derives the exact conversation response and bounded social consequences', () => {
		const state = EngineGameStateV13Schema.parse(fixture().snapshot.state);
		const heroId = Object.keys(state.heroes)[0]!;
		const command = {
			...commandBase(state, state.master.masterId, 'accepted-order'),
			source: manualSource(),
			commandType: 'master.converse',
			targetHeroId: heroId,
			kind: 'order',
			exactText: 'Train at the practice ring before we enter the tower.',
			tone: 'reassuring',
			delivery: 'private',
			orderIntent: 'train'
		} satisfies EngineCommand;
		const before = structuredClone(state);
		const resolved = buildConversationSociety(
			state,
			'00e9fc79-4bcc-4143-aa55-45057affe5c7',
			command
		);
		expect(resolved.conversationTurn).toStrictEqual({
			turnId: '9f3d86d1-8c6f-4b86-8cec-cf75f50fee39',
			sourceEventId: '00e9fc79-4bcc-4143-aa55-45057affe5c7',
			communicationActId: '70e1d59f-6826-406e-919b-bf65d2e03635',
			masterId: state.master.masterId,
			heroId,
			kind: 'order',
			orderIntent: 'train',
			response: {
				exactText: 'Understood. I will train at the practice ring.',
				publicReason:
					'The accepted outcome totals 35 from authority, relationship, personality, alignment, needs, and tone.',
				orderOutcome: 'accepted',
				orderScore: {
					authority: 0,
					relationship: 0,
					personality: 2,
					alignment: 20,
					needs: 7,
					tone: 6,
					total: 35
				},
				preferenceWeight: 24
			},
			occurredAt: '2000-01-01T00:00:00.000Z'
		});
		expect(hashCanonical(resolved.society)).toBe(
			'dbb192d7df334703f2f554ebb23aa1b88fe3026e880e505285f8fd67cac4241f'
		);
		expect(state).toStrictEqual(before);
	});

	it('derives exact day-directive IDs, schedule, witness order, and society patch', () => {
		const state = EngineGameStateV13Schema.parse(fixture().snapshot.state);
		const heroId = Object.keys(state.heroes)[0]!;
		const command = {
			...commandBase(state, state.master.masterId, 'day-directive'),
			source: manualSource(),
			commandType: 'master.issue.directive',
			text: 'Prepare for the tower.',
			scope: 'day',
			recipientIds: [heroId],
			priorities: ['tower-readiness'],
			tone: 'firm',
			delivery: 'private'
		} satisfies EngineCommand;
		const before = structuredClone(state);
		const resolved = buildDirectiveChange(state, 'a25db03e-27d4-4beb-b42f-b1adfc09f88a', command);
		expect(resolved.directive).toStrictEqual({
			directiveId: '060fb9b5-8e77-40b3-9c08-8f65a88c12fd',
			runId: state.runId,
			authorId: state.master.masterId,
			text: 'Prepare for the tower.',
			scope: 'day',
			recipientIds: [heroId],
			witnessEventId: 'a25db03e-27d4-4beb-b42f-b1adfc09f88a',
			priorities: ['tower-readiness'],
			createdAt: '2000-01-01T00:00:00.000Z',
			expiresAt: '2000-01-02T00:00:00.000Z',
			revokedAt: null,
			delivery: 'private',
			status: 'active',
			witnessObservationIds: ['6aeef124-78b1-45a9-b024-9e4d1dc7b295'],
			expiryScheduledEventId: '6c400bd3-070a-4867-a679-7ca7cfc49444',
			replacesDirectiveId: null,
			replacedByDirectiveId: null,
			terminalAt: null,
			terminalEventId: null
		});
		expect(resolved.scheduledEvent).toStrictEqual({
			scheduledEventId: '6c400bd3-070a-4867-a679-7ca7cfc49444',
			runId: state.runId,
			actorId: state.master.masterId,
			dueGameTime: '2000-01-02T00:00:00.000Z',
			eventKind: 'directive.expire',
			payload: { directiveId: '060fb9b5-8e77-40b3-9c08-8f65a88c12fd' }
		});
		expect(hashCanonical(resolved.society)).toBe(
			'790ca3be69616d39d8a88b7e616a618bb6a316ffb1d45ee13f47391ac75ad6fb'
		);
		expect(state).toStrictEqual(before);
	});
});
