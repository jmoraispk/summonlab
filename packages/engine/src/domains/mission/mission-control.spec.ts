import {
	EngineGameStateV11Schema,
	EngineGameStateV13Schema,
	EngineGameStateV15Schema,
	EngineGameStateV18Schema,
	EngineGameStateV20Schema,
	EngineGameStateV21Schema,
	EngineGameStateV22Schema,
	MasterControlStateSchema,
	type ActionSource,
	type EngineGameState,
	type EngineGameStateV20,
	type MasterControlState
} from '@summonlab/contracts';
import { IRON_MOON_MISSION, TOWER_BAND_01_RUNTIME_PACKAGES } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import {
	missionLegalActions,
	missionTurnLegalActions,
	normalizedMissionTurnChoices
} from './actions.js';
import {
	cancelMissionPreparation,
	completeMissionExtraction,
	deployMissionAttempt,
	openMissionExtraction,
	prepareMissionAttempt,
	retreatMissionAttempt,
	reviseMissionParty
} from './lifecycle.js';
import {
	applyMasterSafetyStop,
	assertFallbackReady,
	configureMasterFallback,
	configureMasterTimingV2,
	endMasterDecisionV2,
	isIrreversibleMasterAction,
	masterDecisionWindow,
	masterDecisionWindowV2,
	masterFallbackActionSource,
	masterFallbackMissionChoice,
	masterFallbackSafetyStopReason,
	masterFallbackSafetySource,
	resolveMasterDecision,
	resolveMasterDecisionV2,
	selectMasterFallback
} from './master-control.js';
import {
	IllegalActionError,
	applyCommand,
	createBootstrapEngine,
	deterministicUuid,
	hashCanonical,
	legalActions,
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

function fallbackTimingVariant(
	state: ReturnType<typeof fallbackFixture>,
	timing: 'wait' | 'countdown' | 'step' | 'continuous'
): EngineGameStateV20 {
	const expiresAt = timing === 'countdown' ? '2032-01-01T00:00:07.000Z' : null;
	const fallback = { ...state.masterControl.fallback, safetyStops: noSafety };
	return EngineGameStateV20Schema.parse({
		...state,
		masterControl: {
			...state.masterControl,
			timing,
			fallback,
			consecutiveFallbacks: 0,
			activeDecision: {
				...state.masterControl.activeDecision!,
				timing,
				expiresAt,
				fallback
			}
		}
	});
}

function unsupportedPreparedFixture(schemaVersion: 21 | 22) {
	const runId = deterministicUuid(`review-v${schemaVersion}-run`);
	const heroId = deterministicUuid(`review-v${schemaVersion}-hero`);
	const missionScenario = {
		initialMissionId: 'tower-floor-01',
		availableMissionIds: ['tower-floor-01']
	} as const;
	const base = createBootstrapEngine({
		runId,
		seed: `review-v${schemaVersion}`,
		heroId,
		manifestHash: '1'.repeat(64),
		developmentMissionScenario:
			schemaVersion === 21
				? { ...missionScenario, enableStoryPatch: true }
				: { ...missionScenario, enableSynthesis: true }
	}).snapshot.state;
	const v20 = EngineGameStateV20Schema.parse(
		createBootstrapEngine({
			runId,
			seed: `review-v${schemaVersion}`,
			heroId,
			manifestHash: '1'.repeat(64),
			developmentMissionScenario: { ...missionScenario, enableMasterFallback: true }
		}).snapshot.state
	);
	const mission = prepareMissionAttempt(
		v20,
		deterministicUuid(`review-v${schemaVersion}-prepare`),
		[heroId]
	);
	const state =
		schemaVersion === 21
			? EngineGameStateV21Schema.parse({ ...base, mission })
			: EngineGameStateV22Schema.parse({ ...base, mission });
	return { heroId, state };
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
		[
			21,
			[
				'master.inspect.gate',
				'story.patch.apply',
				'simulation.damage.hero.b79af899-bc22-4a08-95e1-b4663afd8270',
				'simulation.damage.master'
			]
		],
		[
			22,
			[
				'master.inspect.gate',
				'simulation.damage.hero.a2e108f0-e28a-4773-a57e-2efd693c1720',
				'simulation.damage.master'
			]
		]
	] as const)(
		'preserves V%s settlement and story actions for an adversarial preparing mission shape',
		(schemaVersion, masterActionIds) => {
			const { heroId, state } = unsupportedPreparedFixture(schemaVersion);
			const frozen = deepFreeze(state);
			const beforeHash = hashCanonical(frozen);
			expect(legalActions(frozen, frozen.master.masterId).map((entry) => entry.actionId)).toEqual(
				masterActionIds
			);
			expect(legalActions(frozen, heroId).map((entry) => entry.actionId)).toEqual([
				'hero.choose.kitchen',
				'hero.choose.training-ground'
			]);
			expect(hashCanonical(frozen)).toBe(beforeHash);
		}
	);

	it('preserves supported-version preparation and deployment suppression', () => {
		const initial = bootstrapFixture().snapshot.state;
		const heroId = '7bff1551-74fc-4924-aeec-605a2b6dedfb';
		const prepared = commit(initial, 'prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId]
		}).state;
		expect(legalActions(prepared, prepared.master.masterId).map((entry) => entry.actionId)).toEqual(
			['mission.revise.party', 'mission.deploy', 'mission.cancel']
		);
		expect(legalActions(prepared, heroId)).toEqual([]);

		const deployed = commit(prepared, 'deploy', { commandType: 'mission.deploy' }).state;
		expect(legalActions(deployed, deployed.master.masterId).map((entry) => entry.actionId)).toEqual(
			['mission.hold', 'mission.move.threshold-to-oath-hall', 'mission.retreat']
		);
		expect(legalActions(deployed, heroId).map((entry) => entry.actionId)).toEqual([
			'mission.hold',
			'mission.move.threshold-to-oath-hall'
		]);
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

		const deployment = commit(prepared, 'deploy', { commandType: 'mission.deploy' });
		const deployed = EngineGameStateV13Schema.parse(deployment.state);
		expect(deployment.stateHash).toBe(
			'6ec2b425877399ec9865b4208958254f4d17b0d0d51900635a7ce0cd9786abb4'
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

	it('opens and completes legacy extraction with exact extraction and aftermath action order', () => {
		const modern = bootstrapFixture().snapshot.state;
		const initial = EngineGameStateV11Schema.parse({
			...modern,
			schemaVersion: 11,
			contentVersion: 'engine-v11'
		});
		const heroId = '7bff1551-74fc-4924-aeec-605a2b6dedfb';
		const preparedMission = prepareMissionAttempt(
			initial,
			deterministicUuid('task8-review-v11-prepare'),
			[heroId]
		);
		const prepared = EngineGameStateV11Schema.parse({ ...initial, mission: preparedMission });
		const deployedMission = deployMissionAttempt(
			prepared,
			(_state, _attempt, _positions, entropy) => ({
				monsters: {},
				threatIntents: [],
				entropy
			})
		).mission;
		const deployed = EngineGameStateV11Schema.parse({ ...prepared, mission: deployedMission });
		const openedMission = openMissionExtraction(deepFreeze(deployed), ['recover-first-ember']);
		const extraction = EngineGameStateV11Schema.parse({ ...deployed, mission: openedMission });
		expect(openedMission.attempt).toMatchObject({
			status: 'extraction',
			completedObjectiveIds: ['recover-first-ember'],
			extractionOpenedAt: '2000-01-01T00:00:00.000Z'
		});
		expect(
			missionLegalActions(extraction, extraction.master.masterId).map((entry) => entry.actionId)
		).toEqual(['mission.extract', 'mission.retreat']);

		const completed = completeMissionExtraction(deepFreeze(extraction));
		expect(completed.attempt).toMatchObject({
			status: 'success',
			outcome: 'success',
			endedAt: '2000-01-01T00:00:00.000Z'
		});
		expect(
			missionLegalActions(
				EngineGameStateV11Schema.parse({ ...extraction, mission: completed }),
				extraction.master.masterId
			)
		).toEqual([]);
	});

	it('preserves exact modern aftermath action order after extraction success', () => {
		const runId = deterministicUuid('task8-review-aftermath-run');
		const heroId = deterministicUuid('task8-review-aftermath-hero');
		const initial = EngineGameStateV18Schema.parse(
			createBootstrapEngine({
				runId,
				seed: 'task8-review-aftermath-seed',
				heroId,
				manifestHash: sha256Hex('task8-review-aftermath-manifest'),
				developmentMissionScenario: {
					initialMissionId: 'tower-floor-01',
					availableMissionIds: ['tower-floor-01'],
					enableAttemptAftermath: true
				}
			}).snapshot.state
		);
		const prepared = EngineGameStateV18Schema.parse(
			commit(initial, 'review-aftermath-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-01'
			}).state
		);
		const deployed = EngineGameStateV18Schema.parse(
			commit(prepared, 'review-aftermath-deploy', { commandType: 'mission.deploy' }).state
		);
		const objectiveId = deployed.mission.attempt!.turnState.objective.objectiveId;
		const extraction = EngineGameStateV18Schema.parse({
			...deployed,
			mission: {
				...deployed.mission,
				attempt: {
					...deployed.mission.attempt!,
					status: 'extraction',
					completedObjectiveIds: [objectiveId],
					extractionOpenedAt: deployed.simulatedAt,
					turnState: {
						...deployed.mission.attempt!.turnState,
						objective: {
							...deployed.mission.attempt!.turnState.objective,
							status: 'delivered',
							carrierId: null,
							recoveredOnRound: 1,
							deliveredOnRound: 1
						}
					}
				}
			}
		});
		const succeeded = EngineGameStateV18Schema.parse({
			...extraction,
			mission: completeMissionExtraction(extraction)
		});
		expect(
			legalActions(succeeded, succeeded.master.masterId).map((entry) => entry.actionId)
		).toEqual([
			'master.inspect.gate',
			'mission.prepare',
			`settlement.assign.${heroId}.summoning-gate`,
			`settlement.assign.${heroId}.kitchen`,
			`settlement.assign.${heroId}.dormitory`,
			`settlement.assign.${heroId}.training-ground`,
			`settlement.assign.${heroId}.workshop`,
			`social.communicate.${heroId}`,
			`social.converse.${heroId}`,
			'social.directive.issue',
			`simulation.damage.hero.${heroId}`,
			'simulation.damage.master'
		]);
	});

	it('invokes and preserves the V15 cargo-loss callback result and error seam', () => {
		const runId = deterministicUuid('task8-review-portal-run');
		const heroId = deterministicUuid('task8-review-portal-hero');
		const initial = EngineGameStateV15Schema.parse(
			createBootstrapEngine({
				runId,
				seed: 'task8-review-portal-seed',
				heroId,
				manifestHash: sha256Hex('task8-review-portal-manifest'),
				developmentMissionScenario: {
					initialMissionId: IRON_MOON_MISSION.missionId,
					availableMissionIds: [IRON_MOON_MISSION.missionId]
				}
			}).snapshot.state
		);
		const prepared = EngineGameStateV15Schema.parse(
			commit(initial, 'review-portal-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: IRON_MOON_MISSION.missionId
			}).state
		);
		const deployed = EngineGameStateV15Schema.parse(
			commit(prepared, 'review-portal-deploy', { commandType: 'mission.deploy' }).state
		);
		const calls: unknown[][] = [];
		const retreated = retreatMissionAttempt(
			deepFreeze(deployed),
			(attempt, portal, roundNumber, positions) => {
				calls.push([attempt.attemptId, portal.portalId, roundNumber, positions]);
				return { ...portal, portalId: 'fixture-portal' };
			}
		);
		expect(calls).toEqual([
			[
				deployed.mission.attempt!.attemptId,
				deployed.mission.attempt!.turnState.portal.portalId,
				1,
				undefined
			]
		]);
		expect(retreated.attempt).toMatchObject({
			status: 'retreat',
			outcome: 'retreat',
			turnState: { portal: { portalId: 'fixture-portal' } }
		});
		expect(() => retreatMissionAttempt(deployed)).toThrowError(
			'Portal retreat requires cargo-loss derivation'
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

	it('keeps the accepted future Town Master ruleset outside the authored embodied inventory', () => {
		const authoredMissions = [...TOWER_BAND_01_RUNTIME_PACKAGES, IRON_MOON_MISSION];
		expect(authoredMissions.map((mission) => mission.missionId)).toEqual([
			'tower-floor-01',
			'tower-floor-02',
			'tower-floor-03',
			'tower-floor-04',
			'tower-floor-05',
			'iron-moon'
		]);
		expect(authoredMissions.every((mission) => mission.deployment.masterRequired === true)).toBe(
			true
		);
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
		['wait-before', 'wait', '2032-01-01T00:00:01.999Z', 'manual', false],
		['wait-exact', 'wait', '2032-01-01T00:00:02.000Z', 'manual', true],
		['wait-after', 'wait', '2032-01-01T00:00:02.001Z', 'manual', true],
		['countdown-manual-before', 'countdown', '2032-01-01T00:00:06.999Z', 'manual', true],
		['countdown-manual-exact', 'countdown', '2032-01-01T00:00:07.000Z', 'manual', false],
		['countdown-manual-after', 'countdown', '2032-01-01T00:00:07.001Z', 'manual', false],
		['countdown-fallback-before', 'countdown', '2032-01-01T00:00:06.999Z', 'countdown', false],
		['countdown-fallback-exact', 'countdown', '2032-01-01T00:00:07.000Z', 'countdown', true],
		['countdown-fallback-after', 'countdown', '2032-01-01T00:00:07.001Z', 'countdown', true],
		['step-before', 'step', '2032-01-01T00:00:01.999Z', 'step', false],
		['step-exact', 'step', '2032-01-01T00:00:02.000Z', 'step', true],
		['step-after', 'step', '2032-01-01T00:00:02.001Z', 'step', true],
		['continuous-before', 'continuous', '2032-01-01T00:00:01.999Z', 'continuous', false],
		['continuous-exact', 'continuous', '2032-01-01T00:00:02.000Z', 'continuous', true],
		['continuous-after', 'continuous', '2032-01-01T00:00:02.001Z', 'continuous', true]
	] as const)(
		'enforces the independent V2 timeout boundary %s',
		(_label, timing, resolvedAt, sourceName, valid) => {
			const state = deepFreeze(fallbackTimingVariant(fallbackFixture(), timing));
			const beforeHash = hashCanonical(state);
			const source: ActionSource =
				sourceName === 'manual'
					? decisionSource('manual', timing)
					: {
							source: sourceName,
							timing,
							fallbackPolicy: 'directed',
							directiveIds: ['29aa660e-f9ad-46f8-8cca-782eb618df79'],
							decisionJobId: null
						};
			const resolve = () =>
				resolveMasterDecisionV2(
					state,
					'v2-boundary-next',
					'89813ab6-ebbe-467d-b326-491c66a9d81c',
					resolvedAt,
					'mission.hold',
					source,
					false
				);
			if (!valid) {
				expect(resolve).toThrowError(
					'Action is not legal in the current state: mission.resolve.turn'
				);
			} else {
				const result = resolve();
				expect(result.resolution).toMatchObject({
					resolvedAt,
					outcome: sourceName === 'manual' ? 'manual' : 'fallback',
					expiryOutcome:
						timing === 'countdown'
							? sourceName === 'manual'
								? 'manual-before-expiry'
								: 'expired-to-fallback'
							: sourceName === 'manual'
								? 'not-applicable'
								: 'immediate-fallback',
					resolvedActionId: 'mission.hold'
				});
				expect(result.resolution.fallbackSelection?.selectedActionId ?? null).toBe(
					sourceName === 'manual' ? null : 'mission.hold'
				);
				expect(result.control.timing).toBe(timing === 'step' ? 'wait' : timing);
				expect(result.control.consecutiveFallbacks).toBe(sourceName === 'manual' ? 0 : 1);
			}
			expect(hashCanonical(state)).toBe(beforeHash);
		}
	);

	it('freezes V2 source/action mismatch precedence and fallback selection mismatch', () => {
		const stopped = deepFreeze(fallbackFixture());
		const beforeHash = hashCanonical(stopped);
		expect(() =>
			resolveMasterDecisionV2(
				stopped,
				'v2-wrong-source',
				'89813ab6-ebbe-467d-b326-491c66a9d81c',
				'2032-01-01T00:00:02.000Z',
				'mission.move.threshold-to-oath-hall',
				decisionSource('manual', 'continuous'),
				false
			)
		).toThrowError('Action is not legal in the current state: mission.resolve.turn');

		const noStop = deepFreeze(fallbackTimingVariant(stopped, 'continuous'));
		expect(() =>
			resolveMasterDecisionV2(
				noStop,
				'v2-wrong-selection',
				'89813ab6-ebbe-467d-b326-491c66a9d81c',
				'2032-01-01T00:00:02.000Z',
				'mission.move.threshold-to-oath-hall',
				masterFallbackActionSource(noStop),
				false
			)
		).toThrowError('Action is not legal in the current state: mission.resolve.turn');
		expect(hashCanonical(stopped)).toBe(beforeHash);
	});

	it('freezes V2 Step reversion, reopening, and consecutive fallback updates', () => {
		const step = fallbackTimingVariant(fallbackFixture(), 'step');
		const stepped = resolveMasterDecisionV2(
			step,
			'v2-step-next',
			'89813ab6-ebbe-467d-b326-491c66a9d81c',
			'2032-01-01T00:00:02.000Z',
			'mission.hold',
			masterFallbackActionSource(step),
			true
		);
		expect(hashCanonical(stepped)).toBe(
			'c022d203e2502748291bbeed88e3dc90bb538894ce05405945c90bb4c79988d5'
		);
		expect(stepped.control).toMatchObject({
			timing: 'wait',
			revision: 3,
			decisionOrdinal: 2,
			consecutiveFallbacks: 1,
			activeDecision: {
				decisionId: '680403c8-0640-45ef-98d7-c97a9418ef9d',
				timing: 'wait'
			}
		});

		const continuous = fallbackTimingVariant(fallbackFixture(), 'continuous');
		const first = resolveMasterDecisionV2(
			continuous,
			'v2-continuous-next',
			'89813ab6-ebbe-467d-b326-491c66a9d81c',
			'2032-01-01T00:00:02.000Z',
			'mission.hold',
			masterFallbackActionSource(continuous),
			true
		);
		const reopened = EngineGameStateV20Schema.parse({
			...continuous,
			masterControl: first.control
		});
		const second = resolveMasterDecisionV2(
			reopened,
			'v2-continuous-next-2',
			first.control.activeDecision!.decisionId,
			'2032-01-01T00:00:02.001Z',
			'mission.hold',
			masterFallbackActionSource(reopened),
			false
		);
		expect(second.control.consecutiveFallbacks).toBe(2);
		expect(second.control.decisionOrdinal).toBe(2);
	});

	it('freezes V2 window, timing/fallback configuration, pause, and end ownership', () => {
		const base = deepFreeze(fallbackFixture());
		const beforeHash = hashCanonical(base);
		const closed = { ...base.masterControl, activeDecision: null };
		const reopened = masterDecisionWindowV2(closed, 'v2-owned-window', '2032-01-01T00:00:03.000Z');
		expect(reopened.activeDecision).toMatchObject({
			decisionId: 'a9be52fa-4f84-414d-8611-71d30b2a1774',
			ordinal: 2,
			timing: 'continuous',
			openedAt: '2032-01-01T00:00:03.000Z',
			expiresAt: null,
			fallback: base.masterControl.fallback
		});

		const timing = configureMasterTimingV2(
			base.masterControl,
			'v2-configure-timing',
			'countdown',
			9,
			'2032-01-01T00:00:03.000Z',
			manualSource
		);
		expect(hashCanonical(timing)).toBe(
			'73ae6e511a3fecae363aa8feebae19d78c04b6ce1a4ef4b1b9881d94f07dec11'
		);
		expect(timing).toMatchObject({
			paused: { outcome: 'paused', expiryOutcome: 'paused' },
			control: {
				timing: 'countdown',
				countdownSeconds: 9,
				revision: 3,
				decisionOrdinal: 2,
				activeDecision: { expiresAt: '2032-01-01T00:00:12.000Z' }
			}
		});

		const fallback = configureMasterFallback(base.masterControl, {
			commandId: 'v2-configure-fallback',
			observedAt: '2032-01-01T00:00:03.000Z',
			source: manualSource,
			policy: 'random',
			directionText: 'Let the bound seed choose.',
			priorities: [],
			protectedHeroId: null,
			safetyStops: noSafety
		});
		expect(hashCanonical(fallback)).toBe(
			'dff3682054f68182d2161a896d4e569b02d0d4a99d1483e9c66f5d97daaf33e5'
		);
		expect(fallback.control).toMatchObject({
			revision: 3,
			decisionOrdinal: 2,
			consecutiveFallbacks: 0,
			fallback: {
				policy: 'random',
				directionId: '20ab4f51-44e5-416b-b209-cdd87ebd4eb4'
			}
		});

		const ended = endMasterDecisionV2(base.masterControl, manualSource);
		expect(hashCanonical(ended)).toBe(
			'e999578f30da0f8c8392ab42ae9e41fa9806e62bca3a909cf8e1c37b13f62077'
		);
		expect(ended).toMatchObject({
			resolution: { outcome: 'mission-ended', expiryOutcome: 'mission-ended' },
			control: { activeDecision: null, consecutiveFallbacks: 0 }
		});
		expect(hashCanonical(base)).toBe(beforeHash);
	});

	it('applies the exact V2 safety-stop transition and rejects mismatched evidence', () => {
		const state = deepFreeze(fallbackFixture());
		const source = masterFallbackSafetySource(state);
		const stopped = applyMasterSafetyStop(
			state,
			'v2-safety',
			'89813ab6-ebbe-467d-b326-491c66a9d81c',
			'2032-01-01T00:00:02.000Z',
			source
		);
		expect(hashCanonical(stopped)).toBe(
			'bd5d7be0e982a81853b55e09fa05914ec1cdc8981cce1c6cc45b00417c9f99e4'
		);
		expect(stopped).toMatchObject({
			resolution: {
				outcome: 'safety-stopped',
				expiryOutcome: 'safety-stopped',
				resolvedActionId: null,
				fallbackSelection: { safetyStopReason: 'master-health' }
			},
			control: {
				timing: 'wait',
				revision: 3,
				decisionOrdinal: 2,
				consecutiveFallbacks: 0,
				activeDecision: { timing: 'wait' }
			}
		});
		expect(() =>
			applyMasterSafetyStop(
				state,
				'v2-safety-error',
				'89813ab6-ebbe-467d-b326-491c66a9d81c',
				'2032-01-01T00:00:02.000Z',
				{ ...source, directiveIds: [] }
			)
		).toThrowError('Action is not legal in the current state: master.apply.safety-stop');
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
		const irreversible = {
			actionId: 'mission.deploy',
			actorId: 'a061661a-1947-47f4-9324-4849d7af75b4',
			kind: 'move' as const,
			label: 'Cross the Tower Threshold',
			description: 'Commit the exact prepared party to the hash-bound Floor 01 attempt.',
			targetIds: [],
			resourceCosts: {},
			tags: ['mission', 'deployment', 'irreversible-step']
		};
		expect(isIrreversibleMasterAction(irreversible)).toBe(true);

		const state = fallbackVariant(fallbackFixture(), {
			policy: 'directed',
			directionText: 'Advance.',
			priorities: ['focus-objective'],
			safetyStops: { ...noSafety, beforeIrreversibleAction: true }
		});
		expect(masterFallbackSafetyStopReason(state, irreversible, true, false)).toBe(
			'irreversible-action'
		);
		expect(
			masterFallbackSafetyStopReason(
				fallbackVariant(state, {
					policy: 'directed',
					directionText: 'Advance.',
					priorities: ['focus-objective'],
					safetyStops: {
						...noSafety,
						beforeIrreversibleAction: true,
						maximumConsecutiveFallbacks: 1
					},
					consecutiveFallbacks: 1
				}),
				irreversible,
				true,
				false
			)
		).toBe('fallback-limit');
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
