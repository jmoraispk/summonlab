import {
	AuthoritativeEventSchema,
	type ActionSource,
	type EngineCommand,
	type EngineGameState
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	IllegalActionError,
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	hashGameState,
	legalActions,
	sha256Hex
} from '../../index.js';

import { settlementLegalActions } from './actions.js';
import { SETTLEMENT_COMMAND_TYPES, settlementCommandHandler } from './commands.js';
import { SETTLEMENT_EVENT_TYPES, settlementEventReducer } from './reducer.js';

function manualSource(): ActionSource {
	return {
		source: 'manual',
		timing: 'step',
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function scriptedSource(): ActionSource {
	return { ...manualSource(), source: 'scripted', timing: 'continuous' };
}

function systemSource(): ActionSource {
	return { ...manualSource(), source: 'system', timing: null };
}

function bootstrapFor(family: string) {
	const runId = deterministicUuid(`task-7b:${family}:run`);
	const heroId = deterministicUuid(`task-7b:${family}:hero`);
	const bootstrap = createBootstrapEngine({
		runId,
		seed: `task-7b:${family}:seed`,
		heroId,
		manifestHash: sha256Hex(`task-7b:${family}:manifest`)
	});
	return { state: bootstrap.snapshot.state, heroId };
}

function command(
	state: EngineGameState,
	actorId: string,
	family: string,
	body: object,
	source: ActionSource
): EngineCommand {
	return {
		commandId: deterministicUuid(`task-7b:${family}:command:${state.version}`),
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: deterministicUuid(`task-7b:${family}:correlation:${state.version}`),
		source,
		...body
	} as EngineCommand;
}

function commit(
	state: EngineGameState,
	actorId: string,
	family: string,
	body: object,
	source: ActionSource
) {
	return applyCommand(state, command(state, actorId, family, body, source));
}

function arriveAtKitchen(state: EngineGameState, heroId: string, family: string): EngineGameState {
	const chosen = commit(
		state,
		heroId,
		`${family}-choose`,
		{
			commandType: 'hero.choose.destination',
			destination: 'kitchen',
			firstLine: 'Names before orders.',
			storyBranch: 'names-before-orders'
		},
		scriptedSource()
	);
	const traveled = commit(
		chosen.state,
		heroId,
		`${family}-travel`,
		{ commandType: 'hero.start.travel', targetNodeId: 'kitchen-table' },
		scriptedSource()
	);
	return commit(
		traveled.state,
		traveled.state.master.masterId,
		`${family}-arrive`,
		{ commandType: 'simulation.advance', targetGameTime: traveled.scheduled[0]!.dueGameTime },
		systemSource()
	).state;
}

interface FrozenSettlementOracle {
	readonly beforeStateHash: string;
	readonly eventHash: string;
	readonly eventType: string;
	readonly afterStateHash: string;
	readonly legalActionIds: readonly string[];
}

const FROZEN_ORACLES = {
	navigation: {
		beforeStateHash: '9e6cd5dc6fffadd0a49453450d4033c44b8b494fb7d10e1edd103f42657994cd',
		eventHash: 'b6d9f64eb99b1f5dd6f8abeb5066b9d49d01c9aa2f662a7b7a742a1e449e02f1',
		eventType: 'hero.travel.started',
		afterStateHash: '28b34fd351aead677d170e45e40ec92e0782c986e55f922c113f06795815655f',
		legalActionIds: []
	},
	activity: {
		beforeStateHash: '7ee8c2756683d221501047a03413f0b909a2592deca5dd05e93902a9ec3a033b',
		eventHash: '394808ea3bc5580e9b8e363d31f085c67f78821a11d521fe98476eef1ef4e00d',
		eventType: 'hero.activity.started',
		afterStateHash: 'ca496116d20f332414a005d16aec14bf0fe6ebca781e4344a2bec84dd690caa3',
		legalActionIds: []
	},
	routine: {
		beforeStateHash: '3a70a41669b5f51c2e343c0c26f03a06105c8c8e179d28124c15b05f5b0d4855',
		eventHash: '51b64d92d7320440902afc1904e2d75f7d1f7b4e0010046cfe47f97b9d324c60',
		eventType: 'hero.routine.started',
		afterStateHash: 'e8920a5296a1d3ce18a961686115b08ec944a45eb5dab7b8cdf215178aa6d955',
		legalActionIds: []
	},
	facility: {
		beforeStateHash: 'b1ce02132848cfea1e8d196145ecdd943850ddfef07b28f1c12548844ef90dc6',
		eventHash: '761a41bb38b1ce9d762304b7b05703f55f9510285acbe259285332a0f47e6380',
		eventType: 'hero.assignment.changed',
		afterStateHash: 'b73c39aa16e02c98612e15d1fdbdc5eba1a84903ee7b26665fa9ee71ea40e460',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'settlement.unassign.e3008398-c645-4bfb-af8c-f490ccc11243',
			'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.kitchen',
			'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.dormitory',
			'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.training-ground',
			'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.workshop',
			'social.communicate.e3008398-c645-4bfb-af8c-f490ccc11243',
			'social.converse.e3008398-c645-4bfb-af8c-f490ccc11243',
			'social.directive.issue',
			'simulation.damage.hero.e3008398-c645-4bfb-af8c-f490ccc11243',
			'simulation.damage.master'
		]
	},
	'first-ember': {
		beforeStateHash: '6c6de028aa6418e42c6385462660db46a2a70573e33f56089973197dec367077',
		eventHash: '412ff320ab79c3ec3e97c891b7c94ed4e11d4d1d6daa9bcfbee549361b465c98',
		eventType: 'settlement.first.ember.committed',
		afterStateHash: 'd291e5875262929ebe90c728f1f72f5e6be9f47367877742c9aec18399294db6',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'settlement.assign.c1383214-6b08-46c1-8220-7b83e9acb8a2.summoning-gate',
			'settlement.assign.c1383214-6b08-46c1-8220-7b83e9acb8a2.kitchen',
			'settlement.assign.c1383214-6b08-46c1-8220-7b83e9acb8a2.dormitory',
			'settlement.assign.c1383214-6b08-46c1-8220-7b83e9acb8a2.training-ground',
			'settlement.assign.c1383214-6b08-46c1-8220-7b83e9acb8a2.workshop',
			'social.communicate.c1383214-6b08-46c1-8220-7b83e9acb8a2',
			'social.converse.c1383214-6b08-46c1-8220-7b83e9acb8a2',
			'social.directive.issue',
			'simulation.damage.hero.c1383214-6b08-46c1-8220-7b83e9acb8a2',
			'simulation.damage.master'
		]
	},
	communication: {
		beforeStateHash: 'f1306197ef67437c1157ea1e1e02cabb847df88010c012a6bc64cd5feab96f29',
		eventHash: '906d346a32a0961366964716ccedb5bed1e7f3b1866cdd9edfc0303651aa889b',
		eventType: 'social.communicative.act.recorded',
		afterStateHash: '1c29f132bcfd676d55ec806b756931b349e770c4b5b8f1ada306954468cf4f3f',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'settlement.assign.4db1c51e-eb64-4bd1-b79c-15f56d594765.summoning-gate',
			'settlement.assign.4db1c51e-eb64-4bd1-b79c-15f56d594765.kitchen',
			'settlement.assign.4db1c51e-eb64-4bd1-b79c-15f56d594765.dormitory',
			'settlement.assign.4db1c51e-eb64-4bd1-b79c-15f56d594765.training-ground',
			'settlement.assign.4db1c51e-eb64-4bd1-b79c-15f56d594765.workshop',
			'social.communicate.4db1c51e-eb64-4bd1-b79c-15f56d594765',
			'social.converse.4db1c51e-eb64-4bd1-b79c-15f56d594765',
			'social.directive.issue',
			'simulation.damage.hero.4db1c51e-eb64-4bd1-b79c-15f56d594765',
			'simulation.damage.master'
		]
	},
	conversation: {
		beforeStateHash: '19a024ce947bbe7efc9fe6dc3aca37b6d913c0dbffa0216f101d2735043a37a0',
		eventHash: '2bddc921d2c1f642b93b92c6b969005533a12a268527be14320cba0a95487f7b',
		eventType: 'social.conversation.turn.recorded',
		afterStateHash: 'ec9126e42c10d99d0aaf12c13d7557d6307fadb4de372ffda8ed30dabc6dbc1d',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'settlement.assign.f1c21253-bcfd-474e-8498-23df1c96663a.summoning-gate',
			'settlement.assign.f1c21253-bcfd-474e-8498-23df1c96663a.kitchen',
			'settlement.assign.f1c21253-bcfd-474e-8498-23df1c96663a.dormitory',
			'settlement.assign.f1c21253-bcfd-474e-8498-23df1c96663a.training-ground',
			'settlement.assign.f1c21253-bcfd-474e-8498-23df1c96663a.workshop',
			'social.communicate.f1c21253-bcfd-474e-8498-23df1c96663a',
			'social.converse.f1c21253-bcfd-474e-8498-23df1c96663a',
			'social.directive.issue',
			'simulation.damage.hero.f1c21253-bcfd-474e-8498-23df1c96663a',
			'simulation.damage.master'
		]
	},
	directive: {
		beforeStateHash: 'b124053a1dfafc4c9ee69a532e8edc2efd1ded6ca777f869a9c9b93d0dbe33de',
		eventHash: '1545754f8cb1ecc88133450d3d65112ebcc2a5bc7758453d93270bb8746addee',
		eventType: 'social.directive.issued',
		afterStateHash: '0325264a1da036177c8364fea6d03f8bfbdff27fd792ec6f40c64c494c829ea2',
		legalActionIds: [
			'master.inspect.gate',
			'mission.prepare',
			'settlement.assign.b75b41e1-e10f-4e46-9558-0b2f82ec43fb.summoning-gate',
			'settlement.assign.b75b41e1-e10f-4e46-9558-0b2f82ec43fb.kitchen',
			'settlement.assign.b75b41e1-e10f-4e46-9558-0b2f82ec43fb.dormitory',
			'settlement.assign.b75b41e1-e10f-4e46-9558-0b2f82ec43fb.training-ground',
			'settlement.assign.b75b41e1-e10f-4e46-9558-0b2f82ec43fb.workshop',
			'social.communicate.b75b41e1-e10f-4e46-9558-0b2f82ec43fb',
			'social.converse.b75b41e1-e10f-4e46-9558-0b2f82ec43fb',
			'social.directive.issue',
			'social.directive.replace.d29afef9-79a0-464c-97d3-55789a65c717',
			'social.directive.revoke.d29afef9-79a0-464c-97d3-55789a65c717',
			'simulation.damage.hero.b75b41e1-e10f-4e46-9558-0b2f82ec43fb',
			'simulation.damage.master'
		]
	}
} as const satisfies Record<string, FrozenSettlementOracle>;

function settlementCase(family: keyof typeof FROZEN_ORACLES) {
	const { state: initial, heroId } = bootstrapFor(family);
	if (family === 'navigation') {
		const chosen = commit(
			initial,
			heroId,
			'navigation-choose',
			{
				commandType: 'hero.choose.destination',
				destination: 'kitchen',
				firstLine: 'Names before orders.',
				storyBranch: 'names-before-orders'
			},
			scriptedSource()
		);
		return {
			state: chosen.state,
			actorId: heroId,
			command: command(
				chosen.state,
				heroId,
				'navigation',
				{ commandType: 'hero.start.travel', targetNodeId: 'kitchen-table' },
				scriptedSource()
			)
		};
	}
	if (family === 'activity') {
		const state = arriveAtKitchen(initial, heroId, 'activity');
		return {
			state,
			actorId: heroId,
			command: command(
				state,
				heroId,
				'activity',
				{ commandType: 'hero.start.activity', activity: 'eat' },
				scriptedSource()
			)
		};
	}
	if (family === 'routine') {
		const arrived = arriveAtKitchen(initial, heroId, 'routine');
		const planned = commit(
			arrived,
			heroId,
			'routine-plan',
			{ commandType: 'hero.plan.day' },
			scriptedSource()
		);
		return {
			state: planned.state,
			actorId: heroId,
			command: command(
				planned.state,
				heroId,
				'routine',
				{ commandType: 'hero.start.routine' },
				scriptedSource()
			)
		};
	}
	if (family === 'facility') {
		return {
			state: initial,
			actorId: initial.master.masterId,
			command: command(
				initial,
				initial.master.masterId,
				'facility',
				{
					commandType: 'settlement.assign.hero',
					heroId,
					buildingId: 'summoning-gate',
					role: 'gate-attendant'
				},
				manualSource()
			)
		};
	}
	if (family === 'first-ember') {
		const recovered = commit(
			initial,
			initial.master.masterId,
			'first-ember-recover',
			{ commandType: 'story.recover.first.ember' },
			systemSource()
		);
		return {
			state: recovered.state,
			actorId: recovered.state.master.masterId,
			command: command(
				recovered.state,
				recovered.state.master.masterId,
				'first-ember',
				{
					commandType: 'settlement.commit.first.ember',
					buildingId: 'kitchen',
					rationale: 'feed-everyone'
				},
				manualSource()
			)
		};
	}
	const bodies = {
		communication: {
			commandType: 'master.communicate',
			targetHeroId: heroId,
			kind: 'explain',
			topic: 'master-role',
			exactText: 'I keep the gate and the settlement alive.',
			tone: 'firm',
			delivery: 'private'
		},
		conversation: {
			commandType: 'master.converse',
			targetHeroId: heroId,
			kind: 'ask',
			exactText: 'What do you remember?',
			tone: 'reassuring',
			delivery: 'private',
			orderIntent: null
		},
		directive: {
			commandType: 'master.issue.directive',
			text: 'Rest before training.',
			scope: 'until_revoked',
			recipientIds: [heroId],
			priorities: ['rest', 'training'],
			tone: 'firm',
			delivery: 'private'
		}
	} as const;
	return {
		state: initial,
		actorId: initial.master.masterId,
		command: command(initial, initial.master.masterId, family, bodies[family], manualSource())
	};
}

describe('settlement domain ownership', () => {
	it('declares the frozen ordered command and event ownership without claiming mission dispatch', () => {
		expect(SETTLEMENT_COMMAND_TYPES).toStrictEqual([
			'hero.choose.destination',
			'hero.arrive',
			'hero.start.travel',
			'settlement.assign.hero',
			'settlement.unassign.hero',
			'settlement.allocate.power',
			'story.recover.first.ember',
			'settlement.commit.first.ember',
			'master.communicate',
			'master.converse',
			'master.issue.directive',
			'master.replace.directive',
			'master.revoke.directive',
			'hero.plan.day',
			'hero.start.routine',
			'master.inspect.gate',
			'hero.start.activity',
			'hero.start.forging',
			'hero.equip.item',
			'simulation.advance',
			'simulation.sync.clock',
			'simulation.apply.damage'
		]);
		expect(SETTLEMENT_EVENT_TYPES).toStrictEqual([
			'hero.activity.started',
			'hero.arrived',
			'hero.assignment.changed',
			'hero.daily.plan.created',
			'hero.damaged',
			'hero.destination.selected',
			'hero.died',
			'hero.forging.started',
			'hero.item.equipped',
			'hero.routine.started',
			'hero.travel.started',
			'master.damaged',
			'master.died',
			'master.gate.inspected',
			'settlement.first.ember.committed',
			'settlement.power.allocated',
			'simulation.advanced',
			'simulation.clock.synced',
			'social.communicative.act.recorded',
			'social.conversation.turn.recorded',
			'social.directive.issued',
			'social.directive.replaced',
			'social.directive.revoked',
			'story.first.ember.recovered'
		]);
		expect(settlementCommandHandler).toMatchObject({
			ownerId: 'settlement',
			commandTypes: SETTLEMENT_COMMAND_TYPES
		});
		expect(settlementEventReducer).toMatchObject({
			ownerId: 'settlement',
			eventTypes: SETTLEMENT_EVENT_TYPES
		});
		expect(typeof settlementLegalActions).toBe('function');
	});

	for (const family of Object.keys(FROZEN_ORACLES) as (keyof typeof FROZEN_ORACLES)[]) {
		it(`preserves the complete ${family} command event, reduced state, hash, and action order`, () => {
			const oracle = FROZEN_ORACLES[family];
			const fixture = settlementCase(family);
			expect(hashGameState(fixture.state)).toBe(oracle.beforeStateHash);

			settlementCommandHandler.assertLegal(fixture.state, fixture.command as never);
			const draft = settlementCommandHandler.buildEvent(fixture.state, fixture.command as never);
			const state = settlementEventReducer.reduce(fixture.state, draft);
			const stateHash = hashGameState(state);
			const event = AuthoritativeEventSchema.parse({ ...draft, afterStateHash: stateHash });

			expect(event.eventType).toBe(oracle.eventType);
			expect(hashCanonical(event)).toBe(oracle.eventHash);
			expect(stateHash).toBe(oracle.afterStateHash);
			expect(legalActions(state, fixture.actorId).map((action) => action.actionId)).toStrictEqual(
				oracle.legalActionIds
			);

			const integrated = applyCommand(fixture.state, fixture.command);
			expect(integrated.events).toStrictEqual([event]);
			expect(integrated.state).toStrictEqual(state);
		});
	}

	it('preserves exact rejection precedence and leaves an illegal navigation input immutable', () => {
		const { state: initial, heroId } = bootstrapFor('navigation-rejection');
		const chosen = commit(
			initial,
			heroId,
			'navigation-rejection-choose',
			{
				commandType: 'hero.choose.destination',
				destination: 'kitchen',
				firstLine: 'Names before orders.',
				storyBranch: 'names-before-orders'
			},
			scriptedSource()
		);
		const before = structuredClone(chosen.state);
		const rejected = command(
			chosen.state,
			heroId,
			'navigation-rejection',
			{ commandType: 'hero.start.travel', targetNodeId: 'training-ring' },
			scriptedSource()
		);

		let error: unknown;
		try {
			settlementCommandHandler.assertLegal(chosen.state, rejected as never);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(IllegalActionError);
		expect(error).toMatchObject({
			name: 'IllegalActionError',
			message: 'Action is not legal in the current state: hero.travel',
			code: 'ILLEGAL_ACTION',
			legalActionIds: ['hero.travel']
		});
		expect(chosen.state).toStrictEqual(before);
	});

	it('preserves the full cross-domain legal-action order in settlement rejections', () => {
		const { state, heroId } = bootstrapFor('facility');
		const before = structuredClone(state);
		const rejected = command(
			state,
			state.master.masterId,
			'facility',
			{
				commandType: 'settlement.assign.hero',
				heroId,
				buildingId: 'summoning-gate',
				role: 'cook'
			},
			manualSource()
		);

		let error: unknown;
		try {
			applyCommand(state, rejected);
		} catch (caught) {
			error = caught;
		}
		expect(error).toBeInstanceOf(IllegalActionError);
		expect(error).toMatchObject({
			name: 'IllegalActionError',
			message:
				'Action is not legal in the current state: settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.summoning-gate',
			code: 'ILLEGAL_ACTION',
			legalActionIds: [
				'master.inspect.gate',
				'mission.prepare',
				'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.summoning-gate',
				'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.kitchen',
				'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.dormitory',
				'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.training-ground',
				'settlement.assign.e3008398-c645-4bfb-af8c-f490ccc11243.workshop',
				'social.communicate.e3008398-c645-4bfb-af8c-f490ccc11243',
				'social.converse.e3008398-c645-4bfb-af8c-f490ccc11243',
				'social.directive.issue',
				'simulation.damage.hero.e3008398-c645-4bfb-af8c-f490ccc11243',
				'simulation.damage.master'
			]
		});
		expect(state).toStrictEqual(before);
	});
});
