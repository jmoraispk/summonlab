import {
	MasterControlStateSchema,
	EngineGameStateV20Schema,
	EngineGameStateV13Schema,
	type ActionSource,
	type EngineGameState,
	type MasterControlState
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import {
	missionLegalActions,
	missionTurnLegalActions,
	normalizedMissionTurnChoices
} from './actions.js';
import {
	cancelMissionPreparation,
	deployMissionAttempt,
	prepareMissionAttempt,
	retreatMissionAttempt,
	reviseMissionParty
} from './lifecycle.js';
import {
	assertFallbackReady,
	isIrreversibleMasterAction,
	masterDecisionWindow,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetySource,
	resolveMasterDecision,
	selectMasterFallback
} from './master-control.js';
import {
	IllegalActionError,
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	sha256Hex
} from '../../index.js';

const manualSource: ActionSource = {
	source: 'manual',
	timing: 'step',
	fallbackPolicy: null,
	directiveIds: [],
	decisionJobId: null
};

function bootstrapFixture() {
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid('task8-run'),
		seed: 'task8-seed',
		heroId: deterministicUuid('task8-hero'),
		manifestHash: sha256Hex('task8-manifest')
	});
	return {
		...bootstrap,
		snapshot: {
			...bootstrap.snapshot,
			state: EngineGameStateV13Schema.parse(bootstrap.snapshot.state)
		}
	};
}

function commit(state: EngineGameState, key: string, body: object) {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return applyCommand(state, {
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: manualSource,
		...body
	} as never);
}

function control(timing: MasterControlState['timing']): MasterControlState {
	return MasterControlStateSchema.parse({
		timing,
		countdownSeconds: 5,
		revision: 0,
		decisionOrdinal: 0,
		activeDecision: null,
		lastResolution: null
	});
}

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

function decisionSource(
	source: 'manual' | 'countdown' | 'step' | 'continuous',
	timing: 'wait' | 'countdown' | 'step' | 'continuous'
): ActionSource {
	return { ...manualSource, source, timing };
}

const noSafety = {
	beforeIrreversibleAction: false,
	masterHealthThreshold: null,
	whenUnclassified: false,
	maximumConsecutiveFallbacks: null
} as const;

function fallbackFixture() {
	const runId = deterministicUuid('master-fallback-report-run');
	const heroId = deterministicUuid('master-fallback-report-hero');
	let state = EngineGameStateV20Schema.parse(
		createBootstrapEngine({
			runId,
			seed: 'master-fallback-report-seed',
			heroId,
			manifestHash: sha256Hex('master-fallback-report-manifest'),
			developmentMissionScenario: {
				initialMissionId: 'tower-floor-01',
				availableMissionIds: ['tower-floor-01'],
				enableMasterFallback: true
			}
		}).snapshot.state
	);
	const apply = (key: string, body: object, source: ActionSource = manualSource) => {
		const commandId = deterministicUuid(`${runId}:${key}:${state.version}`);
		state = EngineGameStateV20Schema.parse(
			applyCommand(state, {
				commandId,
				runId,
				actorId: state.master.masterId,
				expectedVersion: state.version,
				correlationId: commandId,
				source,
				...body
			} as never).state
		);
	};
	apply('prepare', {
		commandType: 'mission.prepare',
		heroIds: [heroId],
		missionId: 'tower-floor-01'
	});
	apply('deploy', { commandType: 'mission.deploy' });
	apply('health-config', {
		commandType: 'master.configure.fallback',
		policy: 'directed',
		directionText: 'Advance the objective while protecting the company.',
		priorities: ['focus-objective', 'protect-self', 'protect-party'],
		protectedHeroId: null,
		safetyStops: { ...noSafety, masterHealthThreshold: 100 },
		observedAt: '2032-01-01T00:00:00.000Z'
	});
	apply('health-timing', {
		commandType: 'master.configure.timing',
		timing: 'continuous',
		countdownSeconds: 5,
		observedAt: '2032-01-01T00:00:01.000Z'
	});
	apply('health-open', {
		commandType: 'master.open.decision',
		observedAt: '2032-01-01T00:00:02.000Z'
	});
	return state;
}

function fallbackVariant(
	state: ReturnType<typeof fallbackFixture>,
	input: {
		policy: 'directed' | 'random';
		directionText: string;
		priorities: readonly (
			'protect-self' | 'protect-party' | 'focus-objective' | 'seek-secrets' | 'conserve-resources'
		)[];
		safetyStops:
			| typeof noSafety
			| {
					beforeIrreversibleAction: boolean;
					masterHealthThreshold: number | null;
					whenUnclassified: boolean;
					maximumConsecutiveFallbacks: number | null;
			  };
		consecutiveFallbacks?: number;
	}
) {
	const fallback = {
		...state.masterControl.fallback,
		policy: input.policy,
		directionText: input.directionText,
		priorities: [...input.priorities],
		safetyStops: input.safetyStops
	};
	return EngineGameStateV20Schema.parse({
		...state,
		masterControl: {
			...state.masterControl,
			fallback,
			consecutiveFallbacks: input.consecutiveFallbacks ?? 0,
			activeDecision: { ...state.masterControl.activeDecision!, fallback }
		}
	});
}

describe('mission control ownership', () => {
	it('owns the mission-control leaf seams', () => {
		expect(
			[
				missionLegalActions,
				missionTurnLegalActions,
				prepareMissionAttempt,
				retreatMissionAttempt,
				masterDecisionWindow,
				selectMasterFallback
			].every((owner) => typeof owner === 'function')
		).toBe(true);
	});

	it.each([
		['wait', null],
		['countdown', '2030-01-01T00:00:05.000Z'],
		['step', null],
		['continuous', null]
	] as const)('opens the frozen %s decision window', (timing, expiresAt) => {
		const input = deepFreeze(control(timing));
		expect(masterDecisionWindow(input, 'task8-window', '2030-01-01T00:00:00.000Z')).toEqual({
			timing,
			countdownSeconds: 5,
			revision: 0,
			decisionOrdinal: 1,
			activeDecision: {
				decisionId: '0c9bbd45-ce3d-4a35-8642-8e3a3e04cedb',
				ordinal: 1,
				timing,
				openedAt: '2030-01-01T00:00:00.000Z',
				expiresAt
			},
			lastResolution: null
		});
		expect(input.activeDecision).toBeNull();
	});

	it.each([
		['wait-before', 'wait', '2029-12-31T23:59:59.999Z', 'manual', false, null],
		['wait-exact', 'wait', '2030-01-01T00:00:00.000Z', 'manual', true, 'not-applicable'],
		['wait-after', 'wait', '2030-01-01T00:00:00.001Z', 'manual', true, 'not-applicable'],
		[
			'countdown-manual-before',
			'countdown',
			'2030-01-01T00:00:04.999Z',
			'manual',
			true,
			'manual-before-expiry'
		],
		['countdown-manual-exact', 'countdown', '2030-01-01T00:00:05.000Z', 'manual', false, null],
		['countdown-manual-after', 'countdown', '2030-01-01T00:00:05.001Z', 'manual', false, null],
		[
			'countdown-fallback-before',
			'countdown',
			'2030-01-01T00:00:04.999Z',
			'countdown',
			false,
			null
		],
		[
			'countdown-fallback-exact',
			'countdown',
			'2030-01-01T00:00:05.000Z',
			'countdown',
			true,
			'expired-to-fallback'
		],
		[
			'countdown-fallback-after',
			'countdown',
			'2030-01-01T00:00:05.001Z',
			'countdown',
			true,
			'expired-to-fallback'
		],
		['step-before', 'step', '2029-12-31T23:59:59.999Z', 'step', false, null],
		['step-exact', 'step', '2030-01-01T00:00:00.000Z', 'step', true, 'immediate-fallback'],
		['step-after', 'step', '2030-01-01T00:00:00.001Z', 'step', true, 'immediate-fallback'],
		['continuous-before', 'continuous', '2029-12-31T23:59:59.999Z', 'continuous', false, null],
		[
			'continuous-exact',
			'continuous',
			'2030-01-01T00:00:00.000Z',
			'continuous',
			true,
			'immediate-fallback'
		],
		[
			'continuous-after',
			'continuous',
			'2030-01-01T00:00:00.001Z',
			'continuous',
			true,
			'immediate-fallback'
		]
	] as const)(
		'enforces the frozen timeout boundary %s',
		(_name, timing, resolvedAt, source, valid, expiryOutcome) => {
			const opened = deepFreeze(
				masterDecisionWindow(control(timing), 'task8-window', '2030-01-01T00:00:00.000Z')
			);
			const resolve = () =>
				resolveMasterDecision(
					opened,
					'task8-next',
					'0c9bbd45-ce3d-4a35-8642-8e3a3e04cedb',
					resolvedAt,
					'mission.hold',
					decisionSource(source, timing),
					false
				);
			if (!valid) {
				expect(resolve).toThrow(IllegalActionError);
				expect(opened.activeDecision?.decisionId).toBe('0c9bbd45-ce3d-4a35-8642-8e3a3e04cedb');
				return;
			}
			const result = resolve();
			expect(result.resolution).toMatchObject({
				resolvedAt,
				expiryOutcome,
				outcome: source === 'manual' ? 'manual' : 'fallback',
				resolvedActionId: 'mission.hold'
			});
			expect(result.control.timing).toBe(timing === 'step' ? 'wait' : timing);
		}
	);

	it('derives frozen preparation, deployment, retreat, and action order', () => {
		const initial = bootstrapFixture().snapshot.state;
		const heroId = '7bff1551-74fc-4924-aeec-605a2b6dedfb';
		const preparedMission = prepareMissionAttempt(
			deepFreeze(initial),
			deterministicUuid(`${initial.runId}:prepare:${initial.version}`),
			[heroId]
		);
		expect(hashCanonical(preparedMission)).toBe(
			'a8cbccb2c97c9713335c7f992cdab401d9059c1cd483e8c7a7caea631541227e'
		);

		const prepared = commit(initial, 'prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId]
		}).state;
		expect(
			missionLegalActions(prepared, prepared.master.masterId).map(
				(a: { actionId: string }) => a.actionId
			)
		).toEqual(['mission.revise.party', 'mission.deploy', 'mission.cancel']);

		const deployed = EngineGameStateV13Schema.parse(
			commit(prepared, 'deploy', { commandType: 'mission.deploy' }).state
		);
		expect(
			missionLegalActions(deployed, deployed.master.masterId).map(
				(a: { actionId: string }) => a.actionId
			)
		).toEqual(['mission.hold', 'mission.move.threshold-to-oath-hall', 'mission.retreat']);
		expect(
			missionTurnLegalActions(deployed, heroId).map((a: { actionId: string }) => a.actionId)
		).toEqual(['mission.hold', 'mission.move.threshold-to-oath-hall']);
		expect(hashCanonical(retreatMissionAttempt(deepFreeze(deployed)))).toBe(
			'121de2d02b38ff36ee3d854d122e8e0eccc2e0a18864735078525e6ec46a7bb3'
		);
	});

	it('derives revision, cancellation, explicit-entropy deployment, and normalized choices', () => {
		const initial = bootstrapFixture().snapshot.state;
		const heroId = '7bff1551-74fc-4924-aeec-605a2b6dedfb';
		const prepared = EngineGameStateV13Schema.parse(
			commit(initial, 'prepare', { commandType: 'mission.prepare', heroIds: [heroId] }).state
		);
		const revised = reviseMissionParty(deepFreeze(prepared), []);
		expect(revised.attempt?.party).toEqual({
			masterId: 'a061661a-1947-47f4-9324-4849d7af75b4',
			heroIds: [],
			memberIds: ['a061661a-1947-47f4-9324-4849d7af75b4']
		});
		const revisedState = EngineGameStateV13Schema.parse({ ...prepared, mission: revised });
		expect(cancelMissionPreparation(deepFreeze(revisedState)).attempt).toMatchObject({
			status: 'canceled',
			outcome: 'canceled',
			endedAt: '2000-01-01T00:00:00.000Z'
		});

		const deployment = deployMissionAttempt(prepared, (_state, _attempt, _positions, entropy) => ({
			monsters: {},
			threatIntents: [],
			entropy
		}));
		expect(deployment).toMatchObject({
			entropyCursor: 0,
			entropyDraws: [],
			mission: {
				attempt: {
					status: 'deployed',
					positions: {
						'a061661a-1947-47f4-9324-4849d7af75b4': 'tower-threshold',
						'7bff1551-74fc-4924-aeec-605a2b6dedfb': 'tower-threshold'
					},
					deployedAt: '2000-01-01T00:00:00.000Z'
				}
			}
		});

		const deployed = EngineGameStateV13Schema.parse({
			...prepared,
			mission: deployment.mission
		});
		const masterChoice = {
			actorId: deployed.master.masterId,
			actionId: 'mission.hold',
			source: 'manual' as const,
			policyId: null,
			packetHash: null,
			legalActionHash: null,
			policyResultHash: null,
			publicIntent: 'The Master chose to hold.'
		};
		const heroChoice = {
			actorId: heroId,
			actionId: 'mission.hold',
			source: 'scripted' as const,
			policyId: 'scripted-personality-v1',
			packetHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
			legalActionHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
			policyResultHash: 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
			publicIntent: 'The hero held position.'
		};
		const reversed = deepFreeze([heroChoice, masterChoice]);
		expect(
			normalizedMissionTurnChoices(deployed, reversed).map((choice) => choice.actorId)
		).toEqual([deployed.master.masterId, heroId]);
		expect(reversed.map((choice) => choice.actorId)).toEqual([heroId, deployed.master.masterId]);
		expect(() => normalizedMissionTurnChoices(deployed, [masterChoice])).toThrow(
			IllegalActionError
		);
	});

	it('rejects invalid lifecycle input without mutation', () => {
		const initial = deepFreeze(bootstrapFixture().snapshot.state);
		expect(() => retreatMissionAttempt(initial)).toThrow(IllegalActionError);
		expect(hashCanonical(initial.mission)).toBe(
			'8a21117eb2e66be715bb1581138550e802e0bab1d1c316cb4b2a163f3fb9f446'
		);
	});

	it('keeps the future Town Master boundary outside legacy embodied mission state', () => {
		const initial = bootstrapFixture().snapshot.state;
		expect(initial.mission.attempt).toBeNull();
		const prepared = prepareMissionAttempt(
			initial,
			deterministicUuid(`${initial.runId}:prepare:${initial.version}`),
			[]
		);
		expect(prepared.attempt?.party).toEqual({
			masterId: 'a061661a-1947-47f4-9324-4849d7af75b4',
			heroIds: [],
			memberIds: ['a061661a-1947-47f4-9324-4849d7af75b4']
		});
	});

	it('freezes directed and seeded-random fallback selections', () => {
		const directedState = deepFreeze(fallbackFixture());
		const directed = selectMasterFallback(directedState);
		expect(directed).toMatchObject({
			policy: 'directed',
			policyId: 'master-directed-v1',
			classification: 'classified',
			selectedActionId: 'mission.hold',
			packetHash: '33a836223b201181b0036d2550b54006b27f5ba5ead9bc2df6087f77e78a236b',
			legalActionHash: '1870ba4ae0151d6d6815ad1bffeb6cedb99f31a47e2224ad50188865fd755f39',
			policyResultHash: 'eb0e1b2fb64648e7b0150809da9603f9dcac303be5795739aeb43d9c7989a8a1',
			safetyStopReason: 'master-health'
		});
		expect(selectMasterFallback(directedState)).toEqual(directed);
		expect(masterFallbackActionSource(directedState)).toEqual({
			source: 'continuous',
			timing: 'continuous',
			fallbackPolicy: 'directed',
			directiveIds: [directedState.masterControl.fallback.directionId],
			decisionJobId: null
		});
		expect(masterFallbackSafetySource(directedState).source).toBe('system');
		expect(() => masterFallbackMissionChoice(directedState)).toThrow(IllegalActionError);

		const randomState = fallbackVariant(directedState, {
			policy: 'random',
			directionText: 'Let the seed choose among the current legal actions.',
			priorities: [],
			safetyStops: noSafety
		});
		const random = selectMasterFallback(randomState);
		expect(random).toMatchObject({
			policy: 'random',
			policyId: 'master-random-v1',
			classification: 'classified',
			selectedActionId: 'mission.move.threshold-to-oath-hall',
			safetyStopReason: null
		});
		expect(random.consideredActionIds).toEqual([
			'mission.hold',
			'mission.move.threshold-to-oath-hall'
		]);
		expect(selectMasterFallback(randomState)).toEqual(random);
	});

	it.each([
		[
			'fallback-limit',
			'Dance beautifully.',
			[],
			{
				beforeIrreversibleAction: true,
				masterHealthThreshold: 100,
				whenUnclassified: true,
				maximumConsecutiveFallbacks: 1
			},
			1
		],
		[
			'master-health',
			'Dance beautifully.',
			[],
			{
				beforeIrreversibleAction: true,
				masterHealthThreshold: 100,
				whenUnclassified: true,
				maximumConsecutiveFallbacks: null
			},
			0
		],
		['unclassified-state', 'Dance beautifully.', [], { ...noSafety, whenUnclassified: true }, 0],
		[null, 'Dance beautifully.', [], noSafety, 0]
	] as const)(
		'applies the frozen safety precedence for %s',
		(reason, directionText, priorities, safetyStops, consecutiveFallbacks) => {
			const state = fallbackVariant(fallbackFixture(), {
				policy: 'directed',
				directionText,
				priorities,
				safetyStops,
				consecutiveFallbacks
			});
			const selection = selectMasterFallback(deepFreeze(state));
			expect(selection.classification).toBe('unclassified');
			expect(selection.safetyStopReason).toBe(reason);
		}
	);

	it('classifies irreversible action safety without inventing a Town Master body', () => {
		expect(
			isIrreversibleMasterAction({
				actionId: 'mission.deploy',
				actorId: 'a061661a-1947-47f4-9324-4849d7af75b4',
				kind: 'move',
				label: 'Cross the Tower Threshold',
				description: 'Commit the exact prepared party to the hash-bound Floor 01 attempt.',
				targetIds: [],
				resourceCosts: {},
				tags: ['mission', 'deployment', 'irreversible-step']
			})
		).toBe(true);
	});

	it.each([
		['before', '2032-01-01T00:00:06.999Z', true],
		['exact', '2032-01-01T00:00:07.000Z', false],
		['after', '2032-01-01T00:00:07.001Z', false]
	] as const)('enforces countdown fallback readiness %s expiry', (_label, observedAt, rejects) => {
		const base = fallbackFixture();
		const countdown = EngineGameStateV20Schema.parse({
			...base,
			masterControl: {
				...base.masterControl,
				timing: 'countdown',
				activeDecision: {
					...base.masterControl.activeDecision!,
					timing: 'countdown',
					expiresAt: '2032-01-01T00:00:07.000Z'
				}
			}
		});
		const assertion = () => assertFallbackReady(countdown.masterControl, observedAt);
		if (rejects) expect(assertion).toThrow(IllegalActionError);
		else expect(assertion).not.toThrow();
	});
});
