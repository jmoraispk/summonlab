import {
	EngineGameStateV11Schema,
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV14Schema,
	EngineGameStateV15Schema,
	EngineGameStateV16Schema,
	EngineGameStateV17Schema,
	EngineGameStateV20Schema,
	EngineGameStateV23Schema,
	EngineGameStateV24Schema,
	EngineGameStateV25Schema,
	EngineGameStateV26Schema,
	CombatChoiceBatchAppliedEventSchema,
	ReadinessCombatTerminalCommittedEventSchema,
	type AuthoritativeEvent,
	type CombatChoiceBatchV1,
	type EngineCommand,
	type EngineGameState,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type EngineGameStateV25,
	type EngineGameStateV26,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EntropyDraw
} from '@summonlab/contracts';
import { generateSummonableCharacterDraft } from '@summonlab/characters';
import {
	COMBAT_CONTENT_BINDING,
	COMBAT_RULES_V1,
	EQUIPMENT_DEFINITION_CATALOG,
	TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE
} from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { createEntropyCursor } from '../../entropy.js';
import { applyCommand, createBootstrapEngine, reduceEvent } from '../../engine.js';
import { IllegalActionError, ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical, sha256Hex } from '../../hash.js';
import { missionContentForState } from '../../core/content-bindings.js';
import {
	FIRST_BAND_MISSION_COMMAND_TYPES,
	FIRST_BAND_MISSION_EVENT_TYPES,
	firstBandMissionCommandHandler,
	firstBandMissionEventReducer
} from '../../orchestration/first-band-mission-reducer.js';
import { MISSION_COMMAND_TYPES, missionCommandHandler } from './commands.js';
import { createEquipmentItem, equipEquipmentItem } from '../settlement/equipment.js';
import { retreatMissionAttempt } from './lifecycle.js';
import { createCombatModeBinding } from './combat-mode.js';
import { masterFallbackSafetySource } from './master-control.js';
import { applyCombatChoiceBatch, combatChoiceBatchHash } from '../combat/arbitration.js';
import {
	createReadinessCombatOutcomeEvidence,
	finalizeReadinessCombatOutcome
} from '../combat/outcome.js';
import { advanceUntilDecision } from '../combat/window.js';
import { finalizeReadinessMission } from '../../orchestration/readiness-terminal.js';

import {
	deriveMonsterIntents,
	monsterArmorReduction,
	resolveMonsterPolicyIntent,
	spawnMissionCombatants
} from './monster-policy.js';
import { resolveMissionCombatTurn, resolveMissionTurn } from './combat.js';
import {
	appendPortalCargoLosses,
	completePortalMissionExtraction,
	portalPressureStage,
	resolvePortalMissionTurn
} from './portal.js';
import {
	MISSION_EVENT_TYPES,
	missionEventReducer,
	reduceFirstBandMissionTransition
} from './reducer.js';

const MISSION_SCHEMA_VERSIONS = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 23] as const;

function missionVersionFixture(schemaVersion: (typeof MISSION_SCHEMA_VERSIONS)[number]) {
	const key = `task-9b-version-${schemaVersion}`;
	const developmentMissionScenario =
		schemaVersion <= 13
			? undefined
			: {
					initialMissionId: schemaVersion === 15 ? 'iron-moon' : 'tower-floor-01',
					availableMissionIds: [schemaVersion === 15 ? 'iron-moon' : 'tower-floor-01'],
					...(schemaVersion === 16 ? { enableMissionAftermath: true } : {}),
					...(schemaVersion === 17 ? { enableMasterPermadeath: true } : {}),
					...(schemaVersion === 18 ? { enableAttemptAftermath: true } : {}),
					...(schemaVersion === 19 ? { enableMasterTiming: true } : {}),
					...(schemaVersion === 20 ? { enableMasterFallback: true } : {}),
					...(schemaVersion === 23 ? { enableFirstBandArchive: true } : {})
				};
	const modern = createBootstrapEngine({
		runId: deterministicUuid(`${key}-run`),
		seed: `${key}-seed`,
		heroId: deterministicUuid(`${key}-hero`),
		manifestHash: sha256Hex(`${key}-manifest`),
		...(developmentMissionScenario ? { developmentMissionScenario } : {})
	}).snapshot.state;
	if (schemaVersion === 11) {
		return EngineGameStateV11Schema.parse({
			...modern,
			schemaVersion,
			contentVersion: 'engine-v11'
		});
	}
	if (schemaVersion === 12) {
		return EngineGameStateV12Schema.parse({
			...modern,
			schemaVersion,
			contentVersion: 'engine-v12'
		});
	}
	return modern;
}

function missionTestCommand(state: EngineGameState, key: string, body: object): EngineCommand {
	return {
		commandId: deterministicUuid(`task-9b-${key}-command`),
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: deterministicUuid(`task-9b-${key}-correlation`),
		source: {
			source: 'manual',
			timing: 'step',
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		...body
	} as unknown as EngineCommand;
}

function directlyApplyMissionCommand(state: EngineGameState, command: EngineCommand) {
	const event = firstBandMissionCommandHandler.buildEvent(state, command as never);
	const reducer = FIRST_BAND_MISSION_EVENT_TYPES.some((eventType) => eventType === event.eventType)
		? firstBandMissionEventReducer
		: missionEventReducer;
	return { event, state: reducer.reduce(state, event) };
}

function readinessV26Fixture(deployed: EngineGameStateV25): {
	readonly state: EngineGameStateV26;
	readonly batch: CombatChoiceBatchV1;
} {
	const attempt = deployed.mission.attempt;
	if (!attempt) throw new Error('Expected a deployed v25 attempt');
	const heroId = attempt.party.heroIds[0]!;
	const monsterId = deterministicUuid(`${attempt.attemptId}:readiness-monster`);
	const combatant = (
		combatantId: string,
		teamId: 'party' | 'enemy',
		readiness: number,
		x: number
	) => ({
		combatantId,
		combatantKind: teamId === 'party' ? ('hero' as const) : ('monster' as const),
		teamId,
		position: { x, y: 1 },
		facing: teamId === 'party' ? ('east' as const) : ('west' as const),
		resources: { health: { current: 100, maximum: 100 }, mana: { current: 20, maximum: 20 } },
		lastDamagedAtTick: null,
		attributes: { might: 20, vitality: 20, agility: 20, spirit: 20 },
		armour: 0,
		resistances: {},
		readiness: { value: readiness, exactNumerator: readiness, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed: false,
		active: true
	});
	const combatants = {
		[heroId]: combatant(heroId, 'party', 10_000, 1),
		[monsterId]: combatant(monsterId, 'enemy', 0, 3)
	};
	const guard = {
		actionId: 'guard-self',
		actionKind: 'guard' as const,
		skillId: null,
		publicLabel: 'Guard',
		targetContract: { kind: 'self' as const },
		reactionPriority: 0,
		recoveryTicks: 2,
		manaCost: 0,
		conflictPolicy: {
			invalidTarget: 'cancel' as const,
			occupiedDestination: 'cancel' as const,
			cancellationRefund: { mana: 'full' as const, readiness: 'full' as const }
		},
		fallbackOptions: [
			{ fallbackId: 'brace', publicLabel: 'Brace', target: { kind: 'self' as const } }
		],
		resolutionProfile: {
			profileKind: 'non-damaging' as const,
			rulesVersion: 'combat-rules-v1' as const,
			contentHash: COMBAT_CONTENT_BINDING.contentHash
		}
	};
	const readinessState = {
		stateVersion: 'readiness-combat-state-v1' as const,
		seed: sha256Hex(`${attempt.attemptId}:readiness-seed`),
		attemptId: attempt.attemptId,
		tick: 12,
		combatants,
		actorContexts: {
			[heroId]: {
				actorId: heroId,
				visibleCombatantIds: [monsterId],
				visibleTelegraphIds: [],
				observableReadinessActorIds: [],
				targetablePositions: [{ x: 1, y: 1 }],
				visibleTerrainFeatureIds: [],
				rememberedContext: [],
				doctrine: [],
				relationships: [],
				masterDirections: [],
				legalActionTemplates: [guard]
			},
			[monsterId]: {
				actorId: monsterId,
				visibleCombatantIds: [heroId],
				visibleTelegraphIds: [],
				observableReadinessActorIds: [],
				targetablePositions: [{ x: 3, y: 1 }],
				visibleTerrainFeatureIds: [],
				rememberedContext: [],
				doctrine: [],
				relationships: [],
				masterDirections: [],
				legalActionTemplates: [guard]
			}
		},
		terrain: { width: 4, height: 3, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 12, eventsEmitted: 0, noProgressCycles: 0 },
		outcomeEvidence: createReadinessCombatOutcomeEvidence({
			attemptId: attempt.attemptId,
			combatants
		}),
		status: 'active' as const,
		result: null
	};
	const state = EngineGameStateV26Schema.parse({
		...deployed,
		schemaVersion: 26,
		contentVersion: 'engine-v26',
		heroes: Object.fromEntries(
			Object.entries(deployed.heroes).map(([id, hero]) => [
				id,
				{
					...hero,
					combatTraining: {
						schemaVersion: 'hero-combat-training-v1',
						proficiencyTags: [],
						learnedSkills: [
							{
								schemaVersion: 'learned-combat-skill-v1',
								skillId: 'combat-skill-basic-sword-strike',
								mastery: 0,
								trainedDeliveryTags: ['one-handed-blade']
							}
						]
					}
				}
			])
		),
		mission: {
			...deployed.mission,
			attempt: {
				...Object.fromEntries(
					Object.entries(attempt).filter(
						([key]) => key !== 'turnState' && key !== 'combatModeBinding'
					)
				),
				combatModeBinding: createCombatModeBinding('agent-readiness-v1', attempt.preparedAt),
				combatState: { modeId: 'agent-readiness-v1', readinessState }
			}
		}
	});
	const combatState = state.mission.attempt!.combatState;
	if (combatState.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness state');
	const decision = advanceUntilDecision(combatState.readinessState, COMBAT_RULES_V1);
	if (decision.kind !== 'decision-window') throw new Error('Expected readiness decision window');
	const view = decision.views[0]!;
	const action = view.legalActions[0]!;
	const unsigned = {
		batchVersion: 'combat-choice-batch-v1' as const,
		batchId: deterministicUuid(`${decision.snapshot.windowId}:batch`),
		windowId: decision.snapshot.windowId,
		attemptId: decision.snapshot.attemptId,
		tick: decision.snapshot.tick,
		snapshotHash: decision.snapshot.snapshotHash,
		choices: [
			{
				windowId: decision.snapshot.windowId,
				attemptId: decision.snapshot.attemptId,
				tick: decision.snapshot.tick,
				actorId: view.actorId,
				snapshotHash: decision.snapshot.snapshotHash,
				actorViewHash: view.actorViewHash,
				legalActionSetHash: view.legalActionSetHash,
				actionId: action.actionId,
				actionInstanceId: action.actionInstanceId,
				actionKind: action.actionKind,
				skillId: action.skillId,
				target: { kind: 'self' as const },
				fallbackId: 'brace'
			}
		]
	};
	return { state, batch: { ...unsigned, batchHash: combatChoiceBatchHash(unsigned) } };
}

function combatBatchCommand(
	state: EngineGameStateV26,
	batch: CombatChoiceBatchV1,
	key: string
): EngineCommand {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: {
			source: 'system',
			timing: null,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		},
		commandType: 'mission.apply.combat-choice-batch',
		batch
	};
}

function readinessTerminalCommand(state: EngineGameStateV26, key: string): EngineCommand {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandType: 'mission.commit.readiness-terminal',
		commandId,
		runId: state.runId,
		actorId: state.master.masterId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: {
			source: 'system',
			timing: null,
			fallbackPolicy: null,
			directiveIds: [],
			decisionJobId: null
		}
	};
}

function deployedV24EquipmentMissionState(): EngineGameStateV24 {
	const heroId = deterministicUuid('v24-conflict-hero');
	const initial = EngineGameStateV24Schema.parse(
		createBootstrapEngine({
			runId: deterministicUuid('v24-conflict-run'),
			seed: 'v24-conflict-seed',
			heroId,
			manifestHash: sha256Hex('v24-conflict-manifest'),
			developmentEquipmentScenario: { enabled: true, materialLots: { bronze: 2, ash: 1 } }
		}).snapshot.state
	);
	const prepared = directlyApplyMissionCommand(
		initial,
		missionTestCommand(initial, 'v24-conflict-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroId],
			missionId: 'tower-floor-01'
		})
	);
	const deployed = directlyApplyMissionCommand(
		prepared.state,
		missionTestCommand(prepared.state, 'v24-conflict-deploy', { commandType: 'mission.deploy' })
	);
	return EngineGameStateV24Schema.parse(deployed.state);
}

describe('mission runtime ownership', () => {
	it('binds either current combat mode when a v26 attempt begins', async () => {
		const draft = await generateSummonableCharacterDraft(
			{
				seed: 'v26-attempt-mode-binding-character',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			{ capabilityEntropy: '9'.repeat(64) }
		);
		for (const modeId of ['legacy-auto-v1', 'agent-readiness-v1'] as const) {
			let initial = createBootstrapEngine({
				runId: deterministicUuid(`v26-attempt-mode-binding-${modeId}`),
				seed: `v26-attempt-mode-binding-${modeId}-seed`,
				draft,
				combatMode: modeId
			}).snapshot.state;
			if (initial.schemaVersion !== 26) throw new Error('Expected current v26 run');
			const heroId = Object.keys(initial.heroes)[0]!;
			if (modeId === 'agent-readiness-v1') {
				initial = EngineGameStateV26Schema.parse({
					...initial,
					heroes: {
						...initial.heroes,
						[heroId]: {
							...initial.heroes[heroId]!,
							capabilityProfile: {
								...initial.heroes[heroId]!.capabilityProfile,
								attributes: {
									...initial.heroes[heroId]!.capabilityProfile.attributes,
									might: 20
								}
							}
						}
					}
				});
			}
			const binding = createCombatModeBinding(modeId, initial.simulatedAt);
			const prepared = applyCommand(initial, {
				...missionTestCommand(initial, `v26-${modeId}-prepare`, {
					commandType: 'mission.prepare',
					heroIds: [heroId],
					combatModeBinding: binding
				})
			}).state;

			expect(prepared.schemaVersion).toBe(26);
			if (prepared.schemaVersion !== 26) throw new Error('Expected current v26 run');
			expect(prepared.mission.attempt?.combatModeBinding).toStrictEqual(binding);
			expect(prepared.mission.attempt?.combatState.modeId).toBe(modeId);
			if (modeId === 'agent-readiness-v1') {
				const combat = prepared.mission.attempt?.combatState;
				if (combat?.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness combat');
				expect(combat.readinessState).toMatchObject({
					stateVersion: 'readiness-combat-state-v1',
					attemptId: prepared.mission.attempt!.attemptId,
					status: 'active',
					result: null
				});
				const masterId = prepared.master.masterId;
				expect(
					combat.readinessState.actorContexts[heroId]?.legalActionTemplates.map(
						(action) => action.actionId
					)
				).toStrictEqual(['combat-skill-basic-sword-strike', 'guard']);
				expect(
					combat.readinessState.actorContexts[masterId]?.legalActionTemplates.map(
						(action) => action.actionId
					)
				).toStrictEqual(['guard']);
				const monsterActions = Object.values(combat.readinessState.combatants)
					.filter((combatant) => combatant.combatantKind === 'monster')
					.map((combatant) =>
						combat.readinessState.actorContexts[combatant.combatantId]!.legalActionTemplates.map(
							(action) => action.actionId
						)
					);
				expect(monsterActions).toHaveLength(3);
				expect(monsterActions.every((actions) => actions.length === 2)).toBe(true);
				expect(monsterActions.flat()).not.toContain('combat-skill-basic-sword-strike');
				expect(
					monsterActions.every(
						(actions) =>
							actions[0]?.startsWith('monster-attack-') === true &&
							actions[1]?.startsWith('monster-hold-') === true
					)
				).toBe(true);
			}
		}
	});
	it('assigns mission command and event discriminators to one domain owner', () => {
		expect(MISSION_COMMAND_TYPES).toStrictEqual([
			'master.configure.timing',
			'master.configure.fallback',
			'master.apply.safety-stop',
			'master.open.decision',
			'mission.prepare',
			'mission.revise.party',
			'mission.cancel',
			'mission.deploy',
			'mission.resolve.turn',
			'mission.advance.automatic',
			'mission.open.extraction',
			'mission.extract',
			'mission.retreat'
		]);
		expect(missionCommandHandler).toMatchObject({
			ownerId: 'mission',
			commandTypes: MISSION_COMMAND_TYPES
		});
		expect(MISSION_EVENT_TYPES).toStrictEqual([
			'master.timing.changed',
			'master.fallback.changed',
			'master.safety.stopped',
			'master.decision.opened',
			'mission.extraction.opened'
		]);
		expect(missionEventReducer).toMatchObject({
			ownerId: 'mission',
			eventTypes: MISSION_EVENT_TYPES
		});
		expect(FIRST_BAND_MISSION_EVENT_TYPES).toStrictEqual([
			'mission.preparation.started',
			'mission.party.revised',
			'mission.preparation.canceled',
			'mission.deployed',
			'mission.extracted',
			'mission.retreated',
			'mission.round.resolved',
			'mission.combat.choice-batch.applied',
			'mission.combat.readiness.terminal.committed'
		]);
		expect(firstBandMissionEventReducer).toMatchObject({
			ownerId: 'first-band-mission',
			eventTypes: FIRST_BAND_MISSION_EVENT_TYPES
		});
		expect(firstBandMissionCommandHandler).toMatchObject({
			ownerId: 'mission',
			commandTypes: FIRST_BAND_MISSION_COMMAND_TYPES
		});
		expect(missionEventReducer.eventTypes).not.toContain('mission.preparation.started');
		expect(missionEventReducer.eventTypes).not.toContain('mission.party.revised');
		expect(missionEventReducer.eventTypes).not.toContain('mission.preparation.canceled');
		expect(missionEventReducer.eventTypes).not.toContain('mission.deployed');
		expect(missionEventReducer.eventTypes).not.toContain('mission.extracted');
		expect(missionEventReducer.eventTypes).not.toContain('mission.retreated');
		expect([...missionEventReducer.eventTypes, ...firstBandMissionEventReducer.eventTypes]).toEqual(
			[
				'master.timing.changed',
				'master.fallback.changed',
				'master.safety.stopped',
				'master.decision.opened',
				'mission.extraction.opened',
				'mission.preparation.started',
				'mission.party.revised',
				'mission.preparation.canceled',
				'mission.deployed',
				'mission.extracted',
				'mission.retreated',
				'mission.round.resolved',
				'mission.combat.choice-batch.applied',
				'mission.combat.readiness.terminal.committed'
			]
		);
	});

	it('authoritatively applies one readiness cohort under the explicit outer and inner rules bindings', async () => {
		const draft = await generateSummonableCharacterDraft(
			{
				seed: 'readiness-command-character',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			{ capabilityEntropy: '7'.repeat(64) }
		);
		const initial = EngineGameStateV25Schema.parse(
			createBootstrapEngine({
				runId: deterministicUuid('readiness-command-run'),
				seed: 'readiness-command-engine',
				draft
			}).snapshot.state
		);
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...missionTestCommand(initial, 'readiness-command-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
			})
		}).state;
		const deployed = applyCommand(prepared, {
			...missionTestCommand(prepared, 'readiness-command-deploy', {
				commandType: 'mission.deploy'
			})
		}).state;
		if (deployed.schemaVersion !== 25) throw new Error('Expected deployed v25 state');
		const fixture = readinessV26Fixture(deployed);
		const command = combatBatchCommand(fixture.state, fixture.batch, 'readiness-command-apply');
		const initialCombatState = fixture.state.mission.attempt!.combatState;
		if (initialCombatState.modeId !== 'agent-readiness-v1') {
			throw new Error('Expected readiness state');
		}
		const direct = applyCombatChoiceBatch(
			initialCombatState.readinessState,
			fixture.batch,
			COMBAT_RULES_V1
		);
		const applied = applyCommand(fixture.state, command);

		expect(applied.events).toHaveLength(1);
		const event = CombatChoiceBatchAppliedEventSchema.parse(applied.events[0]);
		expect(event).toMatchObject({
			eventType: 'mission.combat.choice-batch.applied',
			actorId: fixture.state.master.masterId,
			commandId: command.commandId,
			correlationId: command.commandId,
			payload: { batch: fixture.batch, resolvedEvents: direct.events }
		});
		expect(applied.state.version).toBe(fixture.state.version + 1);
		expect(applied.state.eventCursor).toBe(fixture.state.eventCursor + 1);
		if (applied.state.schemaVersion !== 26) throw new Error('Expected v26 applied state');
		expect(applied.state.mission.attempt?.combatState).toStrictEqual({
			modeId: 'agent-readiness-v1',
			readinessState: direct.state
		});
		expect(reduceEvent(fixture.state, event)).toStrictEqual(applied.state);

		const contradictoryOuter = EngineGameStateV26Schema.parse({
			...fixture.state,
			mission: {
				...fixture.state.mission,
				attempt: {
					...fixture.state.mission.attempt!,
					combatModeBinding: {
						...fixture.state.mission.attempt!.combatModeBinding,
						rulesVersion: 'combat-rules-v1'
					}
				}
			}
		});
		expect(() => applyCommand(contradictoryOuter, command)).toThrow(IllegalActionError);

		const contradictoryInner = structuredClone(fixture.state);
		const readiness = contradictoryInner.mission.attempt!.combatState;
		if (readiness.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness state');
		readiness.readinessState.actorContexts[heroId]!.legalActionTemplates[0]!.resolutionProfile = {
			...readiness.readinessState.actorContexts[heroId]!.legalActionTemplates[0]!.resolutionProfile,
			contentHash: 'f'.repeat(64)
		};
		expect(() => applyCommand(contradictoryInner, command)).toThrow(IllegalActionError);

		const forged = structuredClone(event);
		forged.payload.resolvedEvents = [];
		expect(() => reduceEvent(fixture.state, forged)).toThrow(ReplayIntegrityError);
	});

	it('authoritatively commits pre-window readiness completion and transitions the outer mission once', async () => {
		const draft = await generateSummonableCharacterDraft(
			{
				seed: 'readiness-terminal-character',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			{ capabilityEntropy: '8'.repeat(64) }
		);
		const initial = EngineGameStateV25Schema.parse(
			createBootstrapEngine({
				runId: deterministicUuid('readiness-terminal-run'),
				seed: 'readiness-terminal-engine',
				draft
			}).snapshot.state
		);
		const heroId = Object.keys(initial.heroes)[0]!;
		const prepared = applyCommand(initial, {
			...missionTestCommand(initial, 'readiness-terminal-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				combatModeBinding: createCombatModeBinding('legacy-auto-v1', initial.simulatedAt)
			})
		}).state;
		const deployed = applyCommand(prepared, {
			...missionTestCommand(prepared, 'readiness-terminal-deploy', {
				commandType: 'mission.deploy'
			})
		}).state;
		if (deployed.schemaVersion !== 25) throw new Error('Expected deployed v25 state');
		const fixture = readinessV26Fixture(deployed);
		const terminalInput = structuredClone(fixture.state);
		terminalInput.heroes[heroId]!.combatTraining.learnedSkills[0]!.mastery = 49;
		const combatState = terminalInput.mission.attempt!.combatState;
		if (combatState.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness state');
		const enemy = Object.values(combatState.readinessState.combatants).find(
			(combatant) => combatant.teamId === 'enemy'
		)!;
		enemy.resources.health.current = 0;
		enemy.downed = true;
		enemy.active = false;
		const choice = fixture.batch.choices[0]!;
		const practiceEventId = deterministicUuid(`${choice.actionInstanceId}:practice`);
		const practiceIntent = {
			...choice,
			actionId: 'combat-skill-basic-sword-strike',
			actionKind: 'attack' as const,
			skillId: 'combat-skill-basic-sword-strike' as const,
			target: { kind: 'entity' as const, combatantId: enemy.combatantId },
			fallbackId: null
		};
		combatState.readinessState.outcomeEvidence.resolvedEvents.push({
			eventVersion: 'combat-resolved-event-v1',
			eventId: practiceEventId,
			attemptId: choice.attemptId,
			windowId: choice.windowId,
			tick: choice.tick,
			actorId: choice.actorId,
			actionId: practiceIntent.actionId,
			snapshotHash: choice.snapshotHash,
			actorViewHash: choice.actorViewHash,
			legalActionSetHash: choice.legalActionSetHash,
			originalIntent: practiceIntent,
			conflictingEventId: null,
			fallbackApplied: null,
			refundApplied: null,
			finalOutcome: 'applied',
			effects: []
		});
		combatState.readinessState.outcomeEvidence.emittedEventIds.push(practiceEventId);
		combatState.readinessState.outcomeEvidence.eventsEmitted = 1;
		combatState.readinessState.safety.eventsEmitted = 1;
		const terminal = EngineGameStateV26Schema.parse(terminalInput);
		const command = readinessTerminalCommand(terminal, 'commit');
		const applied = applyCommand(terminal, command);

		expect(applied.events).toHaveLength(1);
		const event = ReadinessCombatTerminalCommittedEventSchema.parse(applied.events[0]);
		expect(event.payload.result).toMatchObject({
			outcome: 'victory',
			attemptId: terminal.mission.attempt!.attemptId
		});
		if (applied.state.schemaVersion !== 26) throw new Error('Expected v26 applied state');
		const appliedAttempt = applied.state.mission.attempt!;
		expect(applied.state.mission.attempt).toMatchObject({ status: 'extraction', outcome: null });
		expect(applied.state.mission.attempt!.combatState).toMatchObject({
			modeId: 'agent-readiness-v1',
			readinessState: { status: 'complete', result: event.payload.result }
		});
		expect(
			applied.state.heroes[heroId]?.combatTraining.learnedSkills.find(
				(skill) => skill.skillId === 'combat-skill-basic-sword-strike'
			)?.mastery
		).toBe(50);
		const extractionReady = EngineGameStateV26Schema.parse({
			...applied.state,
			mission: {
				...applied.state.mission,
				attempt: {
					...appliedAttempt,
					completedObjectiveIds: ['recover-first-ember'],
					positions: Object.fromEntries(
						appliedAttempt.party.memberIds.map((memberId) => [
							memberId,
							appliedAttempt.extractionNodeId
						])
					)
				}
			}
		});
		const extracted = applyCommand(extractionReady, {
			...missionTestCommand(extractionReady, 'readiness-practice-extract', {
				commandType: 'mission.extract'
			})
		}).state;
		const nextPrepared = applyCommand(extracted, {
			...missionTestCommand(extracted, 'readiness-practice-next-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				combatModeBinding: createCombatModeBinding('agent-readiness-v1', extracted.simulatedAt)
			})
		}).state;
		const nextDeployed = applyCommand(nextPrepared, {
			...missionTestCommand(nextPrepared, 'readiness-practice-next-deploy', {
				commandType: 'mission.deploy'
			})
		}).state;
		if (nextDeployed.schemaVersion !== 26) throw new Error('Expected v26 state');
		const nextCombat = nextDeployed.mission.attempt!.combatState;
		if (nextCombat.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness state');
		expect(
			nextCombat.readinessState.actorContexts[heroId]?.legalActionTemplates.find(
				(action) => action.skillId === 'combat-skill-basic-sword-strike'
			)?.resolutionProfile
		).toMatchObject({ masteryStepMinimum: 50, skillAccuracyBasisPoints: 8_000 });
		expect(reduceEvent(terminal, event)).toStrictEqual(applied.state);

		expect(() =>
			applyCommand(fixture.state, readinessTerminalCommand(fixture.state, 'early'))
		).toThrow(IllegalActionError);
		const forged = structuredClone(event);
		forged.payload.result = { ...forged.payload.result, traceHash: 'f'.repeat(64) };
		expect(() => reduceEvent(terminal, forged)).toThrow(ReplayIntegrityError);
		const forgedCheckpoint = structuredClone(event);
		forgedCheckpoint.payload.claimCheckpoint = {
			...forgedCheckpoint.payload.claimCheckpoint,
			authorityHash: 'f'.repeat(64)
		};
		expect(() => reduceEvent(terminal, forgedCheckpoint)).toThrow(ReplayIntegrityError);
	});

	it.each([
		{ disposition: 'diagnostic' as const, status: 'failure', outcome: 'failure' },
		{ disposition: 'stalemate' as const, status: 'failure', outcome: 'failure' },
		{ disposition: 'forced-retreat' as const, status: 'retreat', outcome: 'retreat' }
	])(
		'preserves a $disposition readiness safety stop in the outer mission lifecycle',
		async ({ disposition, status, outcome }) => {
			const draft = await generateSummonableCharacterDraft(
				{
					seed: `readiness-${disposition}-character`,
					generationVersion: 'human-v6',
					cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
				},
				{ capabilityEntropy: '6'.repeat(64) }
			);
			const initial = createBootstrapEngine({
				runId: deterministicUuid(`readiness-${disposition}-run`),
				seed: `readiness-${disposition}-engine`,
				draft,
				combatMode: 'agent-readiness-v1'
			}).snapshot.state;
			if (initial.schemaVersion !== 26) throw new Error('Expected v26 state');
			const heroId = Object.keys(initial.heroes)[0]!;
			const prepared = applyCommand(initial, {
				...missionTestCommand(initial, `readiness-${disposition}-prepare`, {
					commandType: 'mission.prepare',
					heroIds: [heroId],
					combatModeBinding: createCombatModeBinding('agent-readiness-v1', initial.simulatedAt)
				})
			}).state;
			const deployed = applyCommand(prepared, {
				...missionTestCommand(prepared, `readiness-${disposition}-deploy`, {
					commandType: 'mission.deploy'
				})
			}).state;
			if (deployed.schemaVersion !== 26) throw new Error('Expected v26 state');
			const combat = deployed.mission.attempt!.combatState;
			if (combat.modeId !== 'agent-readiness-v1') throw new Error('Expected readiness state');
			const terminal = finalizeReadinessCombatOutcome({
				state: combat.readinessState,
				safetyStop: {
					safetyStopVersion: 'combat-safety-stop-v1',
					reason: 'no-progress-cycles',
					disposition,
					...combat.readinessState.safety
				}
			});
			const finalized = finalizeReadinessMission(
				deployed,
				terminal.state,
				deterministicUuid(`readiness-${disposition}-event`),
				terminal.authority
			).state;

			expect(finalized.mission.attempt).toMatchObject({ status, outcome });
			expect(finalized.mission.attempt?.combatState).toMatchObject({
				modeId: 'agent-readiness-v1',
				readinessState: {
					status: 'complete',
					result: { outcome: 'safety-stop', safetyStop: { disposition } }
				}
			});
		}
	);

	it('round-trips the composed handler through every mission-capable schema version', () => {
		const observedHashes = Object.fromEntries(
			MISSION_SCHEMA_VERSIONS.map((schemaVersion) => {
				const state = missionVersionFixture(schemaVersion);
				const heroId = Object.keys(state.heroes)[0]!;
				const command = missionTestCommand(state, `version-${schemaVersion}-prepare`, {
					commandType: 'mission.prepare',
					heroIds: [heroId]
				});
				const direct = directlyApplyMissionCommand(state, command);
				const integrated = applyCommand(state, command);
				expect(direct.state).toStrictEqual(integrated.state);
				expect({
					...direct.event,
					afterStateHash: integrated.events[0]!.afterStateHash
				}).toStrictEqual(integrated.events[0]);
				expect(direct.state.schemaVersion).toBe(schemaVersion);
				return [schemaVersion, hashCanonical(direct.state)];
			})
		);
		expect(observedHashes).toStrictEqual({
			11: 'a528128e9a9d1d9a59f22cdb76ad3c9f56dcc35b3a1956d919f452d59b06853a',
			12: '24e81afb5cdce02252396cf7dbee6107af44c9d81fe86fa53370af93082d4586',
			13: 'f2a27ab884091b751378a1a8c2d6aff605f81b903d7d64ce556ceee60f1511d9',
			14: 'e98d06f3a71f91af6ec7e6685a33ca6fe5de1d29eb8cd1e8747322502b968fca',
			15: '7952c17dd84922de040b38eaa689392f9ea23789df1fb81851b42ea8f0e5b6ff',
			16: '161f6cbe0a47bfdf3c1dc21ed7fdd5335ea360a1f27915b5fd3152f0916b9cd0',
			17: '059492e6185d0e11b66b1b4f8b66e04d8deabe87496478600b988bce44965daf',
			18: '7d93456ab4df6a3257b8a0b6bab20b11cece3d99d857b77525e1143ae350a66c',
			19: 'c2946a463ca69dc0105aa067c058a99524c6df67c99b6a14883db21fd1f753b9',
			20: '933b1228f05184a42e26a7311e5331725b1568dca01c30a1df2025414d235c3c',
			23: 'bde54246ae107bd94f13c3fe6a3d3de6d3edb1396701e9a66072e957a0036f23'
		});
	});

	it('maps every owned command to its fixed event discriminator', async () => {
		const initialV13 = missionVersionFixture(13);
		const heroV13 = Object.keys(initialV13.heroes)[0]!;
		const prepareV13 = missionTestCommand(initialV13, 'mapping-prepare', {
			commandType: 'mission.prepare',
			heroIds: [heroV13]
		});
		const preparedV13 = directlyApplyMissionCommand(initialV13, prepareV13).state;
		const deployV13 = missionTestCommand(preparedV13, 'mapping-deploy', {
			commandType: 'mission.deploy'
		});
		const deployedV13 = directlyApplyMissionCommand(preparedV13, deployV13).state;
		const draftV25 = await generateSummonableCharacterDraft(
			{
				seed: 'mapping-v25-character',
				generationVersion: 'human-v6',
				cursors: { identity: 0, body: 0, features: 0, styling: 0, mind: 0, rarity: 0 }
			},
			{ capabilityEntropy: '4'.repeat(64) }
		);
		const initialV25 = EngineGameStateV25Schema.parse(
			createBootstrapEngine({
				runId: deterministicUuid('mapping-v25-run'),
				seed: 'mapping-v25-engine',
				draft: draftV25
			}).snapshot.state
		);
		const heroV25 = Object.keys(initialV25.heroes)[0]!;
		const preparedV25 = directlyApplyMissionCommand(
			initialV25,
			missionTestCommand(initialV25, 'mapping-v25-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroV25],
				combatModeBinding: createCombatModeBinding('legacy-auto-v1', initialV25.simulatedAt)
			})
		).state;
		const deployedV25 = directlyApplyMissionCommand(
			preparedV25,
			missionTestCommand(preparedV25, 'mapping-v25-deploy', {
				commandType: 'mission.deploy'
			})
		).state;
		if (deployedV25.schemaVersion !== 25) throw new Error('Expected deployed v25 state');
		const readinessV26 = readinessV26Fixture(deployedV25);
		const terminalReadinessInput = structuredClone(readinessV26.state);
		const terminalReadinessCombat = terminalReadinessInput.mission.attempt!.combatState;
		if (terminalReadinessCombat.modeId !== 'agent-readiness-v1') {
			throw new Error('Expected readiness state');
		}
		const terminalEnemy = Object.values(terminalReadinessCombat.readinessState.combatants).find(
			(combatant) => combatant.teamId === 'enemy'
		)!;
		terminalEnemy.resources.health.current = 0;
		terminalEnemy.downed = true;
		terminalEnemy.active = false;
		const terminalReadinessV26 = EngineGameStateV26Schema.parse(terminalReadinessInput);

		const initialV12 = missionVersionFixture(12);
		const heroV12 = Object.keys(initialV12.heroes)[0]!;
		const preparedV12 = directlyApplyMissionCommand(
			initialV12,
			missionTestCommand(initialV12, 'mapping-v12-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroV12]
			})
		).state;
		const deployedV12 = directlyApplyMissionCommand(
			preparedV12,
			missionTestCommand(preparedV12, 'mapping-v12-deploy', {
				commandType: 'mission.deploy'
			})
		).state;

		const initialV11 = missionVersionFixture(11);
		const heroV11 = Object.keys(initialV11.heroes)[0]!;
		const preparedV11 = directlyApplyMissionCommand(
			initialV11,
			missionTestCommand(initialV11, 'mapping-v11-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroV11]
			})
		).state;
		const deployedV11 = directlyApplyMissionCommand(
			preparedV11,
			missionTestCommand(preparedV11, 'mapping-v11-deploy', {
				commandType: 'mission.deploy'
			})
		).state;
		const openExtractionV11 = missionTestCommand(deployedV11, 'mapping-open-extraction', {
			commandType: 'mission.open.extraction',
			completedObjectiveIds: ['recover-first-ember'],
			source: {
				source: 'system',
				timing: null,
				fallbackPolicy: null,
				directiveIds: [],
				decisionJobId: null
			}
		});
		const extractionV11 = directlyApplyMissionCommand(deployedV11, openExtractionV11).state;

		const initialV20 = missionVersionFixture(20);
		const heroV20 = Object.keys(initialV20.heroes)[0]!;
		const fallbackBody = {
			commandType: 'master.configure.fallback',
			policy: 'directed',
			directionText: 'Advance the objective while protecting the company.',
			priorities: ['focus-objective', 'protect-self', 'protect-party'],
			protectedHeroId: null,
			safetyStops: {
				beforeIrreversibleAction: false,
				masterHealthThreshold: 100,
				whenUnclassified: false,
				maximumConsecutiveFallbacks: null
			},
			observedAt: '2032-01-01T00:00:00.000Z'
		} as const;
		let safetyState = directlyApplyMissionCommand(
			initialV20,
			missionTestCommand(initialV20, 'mapping-v20-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroV20]
			})
		).state;
		safetyState = directlyApplyMissionCommand(
			safetyState,
			missionTestCommand(safetyState, 'mapping-v20-deploy', {
				commandType: 'mission.deploy'
			})
		).state;
		safetyState = directlyApplyMissionCommand(
			safetyState,
			missionTestCommand(safetyState, 'mapping-v20-fallback-setup', fallbackBody)
		).state;
		safetyState = directlyApplyMissionCommand(
			safetyState,
			missionTestCommand(safetyState, 'mapping-v20-timing-setup', {
				commandType: 'master.configure.timing',
				timing: 'continuous',
				countdownSeconds: 5,
				observedAt: '2032-01-01T00:00:01.000Z'
			})
		).state;
		safetyState = directlyApplyMissionCommand(
			safetyState,
			missionTestCommand(safetyState, 'mapping-v20-open-setup', {
				commandType: 'master.open.decision',
				observedAt: '2032-01-01T00:00:02.000Z'
			})
		).state;
		const activeSafetyState = EngineGameStateV20Schema.parse(safetyState);

		const cases = [
			{
				commandType: 'master.configure.timing',
				eventType: 'master.timing.changed',
				state: initialV20,
				command: missionTestCommand(initialV20, 'mapping-timing', {
					commandType: 'master.configure.timing',
					timing: 'step',
					countdownSeconds: 5,
					observedAt: '2032-01-01T00:00:00.000Z'
				})
			},
			{
				commandType: 'master.configure.fallback',
				eventType: 'master.fallback.changed',
				state: initialV20,
				command: missionTestCommand(initialV20, 'mapping-fallback', fallbackBody)
			},
			{
				commandType: 'master.apply.safety-stop',
				eventType: 'master.safety.stopped',
				state: activeSafetyState,
				command: missionTestCommand(activeSafetyState, 'mapping-safety', {
					commandType: 'master.apply.safety-stop',
					decisionId: activeSafetyState.masterControl.activeDecision!.decisionId,
					observedAt: '2032-01-01T00:00:03.000Z',
					source: masterFallbackSafetySource(activeSafetyState)
				})
			},
			{
				commandType: 'master.open.decision',
				eventType: 'master.decision.opened',
				state: initialV20,
				command: missionTestCommand(initialV20, 'mapping-open-decision', {
					commandType: 'master.open.decision',
					observedAt: '2032-01-01T00:00:00.000Z'
				})
			},
			{
				commandType: 'mission.prepare',
				eventType: 'mission.preparation.started',
				state: initialV13,
				command: prepareV13
			},
			{
				commandType: 'mission.revise.party',
				eventType: 'mission.party.revised',
				state: preparedV13,
				command: missionTestCommand(preparedV13, 'mapping-revise', {
					commandType: 'mission.revise.party',
					heroIds: [heroV13]
				})
			},
			{
				commandType: 'mission.cancel',
				eventType: 'mission.preparation.canceled',
				state: preparedV13,
				command: missionTestCommand(preparedV13, 'mapping-cancel', {
					commandType: 'mission.cancel'
				})
			},
			{
				commandType: 'mission.deploy',
				eventType: 'mission.deployed',
				state: preparedV13,
				command: deployV13
			},
			{
				commandType: 'mission.resolve.turn',
				eventType: 'mission.round.resolved',
				state: deployedV12,
				command: missionTestCommand(deployedV12, 'mapping-resolve', {
					commandType: 'mission.resolve.turn',
					choices: [
						manualChoice(deployedV12.master.masterId, 'mission.move.threshold-to-oath-hall'),
						scriptedChoice(heroV12, 'mission.hold')
					]
				})
			},
			{
				commandType: 'mission.advance.automatic',
				eventType: 'mission.round.resolved',
				state: deployedV25,
				command: missionTestCommand(deployedV25, 'mapping-v25-advance', {
					commandType: 'mission.advance.automatic'
				})
			},
			{
				commandType: 'mission.apply.combat-choice-batch',
				eventType: 'mission.combat.choice-batch.applied',
				state: readinessV26.state,
				command: combatBatchCommand(
					readinessV26.state,
					readinessV26.batch,
					'mapping-readiness-batch'
				)
			},
			{
				commandType: 'mission.commit.readiness-terminal',
				eventType: 'mission.combat.readiness.terminal.committed',
				state: terminalReadinessV26,
				command: readinessTerminalCommand(terminalReadinessV26, 'mapping-readiness-terminal')
			},
			{
				commandType: 'mission.open.extraction',
				eventType: 'mission.extraction.opened',
				state: deployedV11,
				command: openExtractionV11
			},
			{
				commandType: 'mission.extract',
				eventType: 'mission.extracted',
				state: extractionV11,
				command: missionTestCommand(extractionV11, 'mapping-extract', {
					commandType: 'mission.extract'
				})
			},
			{
				commandType: 'mission.retreat',
				eventType: 'mission.retreated',
				state: deployedV13,
				command: missionTestCommand(deployedV13, 'mapping-retreat', {
					commandType: 'mission.retreat'
				})
			}
		] as const;

		expect(cases.map(({ commandType }) => commandType)).toStrictEqual(
			FIRST_BAND_MISSION_COMMAND_TYPES
		);
		const observed = cases.map(({ commandType, eventType, state, command }) => {
			expect(command.commandType).toBe(commandType);
			const event = firstBandMissionCommandHandler.buildEvent(state, command as never);
			expect(event.eventType).toBe(eventType);
			return { commandType, eventType: event.eventType, eventHash: hashCanonical(event) };
		});
		expect(observed).toStrictEqual([
			{
				commandType: 'master.configure.timing',
				eventType: 'master.timing.changed',
				eventHash: '1fd4c6018917ebfbf6258cf4f48e57029d7548c91a9956e8fd8d205842dd5c4b'
			},
			{
				commandType: 'master.configure.fallback',
				eventType: 'master.fallback.changed',
				eventHash: '62e5d8806deebcd5e3efa502bb65f3d7d8a3b1be4f93f409a1a193a5509749c4'
			},
			{
				commandType: 'master.apply.safety-stop',
				eventType: 'master.safety.stopped',
				eventHash: '0e5f8b2687886fe689c3de9f4b068e258112c07ee87358be9cd47a9e4016922a'
			},
			{
				commandType: 'master.open.decision',
				eventType: 'master.decision.opened',
				eventHash: '8d4b764c9b96d2dbeda4916683c330c0996e64f7cacacbb357d76fcff0ac0823'
			},
			{
				commandType: 'mission.prepare',
				eventType: 'mission.preparation.started',
				eventHash: 'd1a7d8915ad6e3d33b9bb3ceb4f8a5656407d8e8c10ffc99f0481474c817d35a'
			},
			{
				commandType: 'mission.revise.party',
				eventType: 'mission.party.revised',
				eventHash: 'e36d0d2377f1ed5f482dde36939effd16a21bd7e583db96867875d5e42a082cc'
			},
			{
				commandType: 'mission.cancel',
				eventType: 'mission.preparation.canceled',
				eventHash: 'f2f09be184ef322205b6fe8f0ba0c16c79e2bd054497c35f2035f8508f7ac355'
			},
			{
				commandType: 'mission.deploy',
				eventType: 'mission.deployed',
				eventHash: 'e73d8403dc4ba6e9bd826a9946e5214db8a75ecb520603f1b742762be6104128'
			},
			{
				commandType: 'mission.resolve.turn',
				eventType: 'mission.round.resolved',
				eventHash: '94ed1a6d7127a14f36e440729af8b52131e59789d3273a0e6227332cc988d579'
			},
			{
				commandType: 'mission.advance.automatic',
				eventType: 'mission.round.resolved',
				eventHash: '266c7b6b111ee64e41062037c0632dbac763d2650ca8eccd860827ee6ff9c96e'
			},
			{
				commandType: 'mission.apply.combat-choice-batch',
				eventType: 'mission.combat.choice-batch.applied',
				eventHash: '43322fba75a137833cb140ae5f40ada4e9ba07578a1b21ab7e8834bf24b47bf2'
			},
			{
				commandType: 'mission.commit.readiness-terminal',
				eventType: 'mission.combat.readiness.terminal.committed',
				eventHash: 'ed7acb68bc3f5aff97d9770aed50c4a84e8d6ee5c0e76770871b4fb341fe2827'
			},
			{
				commandType: 'mission.open.extraction',
				eventType: 'mission.extraction.opened',
				eventHash: '1635fd8ac2509369138e8b4aa678af79af144205dd4b9201bc57adf33f45c810'
			},
			{
				commandType: 'mission.extract',
				eventType: 'mission.extracted',
				eventHash: 'c779a99c2b3c9f221ac7de4354d13fc169ec6cd23e61644efbbf43df38018272'
			},
			{
				commandType: 'mission.retreat',
				eventType: 'mission.retreated',
				eventHash: '98922c1b99170ff81642c6d74802428cf0fa1c91b827a8501ed1616c603e775e'
			}
		]);
	});

	it('loads the dedicated monster, combat, and portal owners', () => {
		expect(typeof resolveMonsterPolicyIntent).toBe('function');
		expect(typeof monsterArmorReduction).toBe('function');
		expect(typeof spawnMissionCombatants).toBe('function');
		expect(typeof resolveMissionTurn).toBe('function');
		expect(typeof resolveMissionCombatTurn).toBe('function');
		expect(typeof portalPressureStage).toBe('function');
		expect(typeof appendPortalCargoLosses).toBe('function');
		expect(typeof resolvePortalMissionTurn).toBe('function');
		expect(typeof completePortalMissionExtraction).toBe('function');
	});

	it('freezes deterministic armor, policy targeting, and the complete intent receipt', () => {
		const masterId = 'ba06da16-783e-4038-83d0-a6d1d723efcf';
		const scenario = {
			mission: null,
			monster: {
				monsterId: '02f363bd-a11e-41db-b3d8-f9715c4f25a3',
				dutySlotId: 'foundry-warden',
				policyId: 'foundry-warden-v1',
				label: 'Foundry Warden',
				ordinal: 1,
				nodeId: 'foundry-heart',
				status: 'active' as const,
				vitality: 18,
				maximumVitality: 18,
				alertState: 'duty' as const,
				defeatedOnRound: null,
				lastActionId: null
			},
			dutyNodeId: 'foundry-heart',
			objectiveNodeId: 'foundry-heart',
			objectiveStatus: 'available' as const,
			objectiveCarrierId: null,
			party: { masterId, heroIds: [], memberIds: [masterId] },
			partyPositions: { [masterId]: 'foundry-heart' },
			arena: {
				furnaceState: 'lit' as const,
				coolingControlNodeId: 'foundry-heart',
				coolingControlExposed: false
			}
		};

		expect(resolveMonsterPolicyIntent(scenario as never)).toStrictEqual({
			monsterId: '02f363bd-a11e-41db-b3d8-f9715c4f25a3',
			policyId: 'foundry-warden-v1',
			actionId:
				'monster.furnace-surge.02f363bd-a11e-41db-b3d8-f9715c4f25a3.ba06da16-783e-4038-83d0-a6d1d723efcf',
			kind: 'furnace-surge',
			fromNodeId: 'foundry-heart',
			toNodeId: 'foundry-heart',
			targetId: masterId,
			telegraph: 'Foundry Warden vents furnace pressure before bringing its hammer down.',
			anticipatedEffect: 'Threatens 3 mission guard before defense reduction.'
		});
		expect([
			monsterArmorReduction('foundry-warden-v1', 'lit'),
			monsterArmorReduction('foundry-warden-v1', 'cooling'),
			monsterArmorReduction('foundry-warden-v1', 'quenched')
		]).toStrictEqual([3, 1, 0]);
	});

	it.each([
		{
			name: 'hold',
			monster: { policyId: 'guard-chain-court-v1', label: 'Chain Watch 01', nodeId: 'chain-court' },
			positions: { '11111111-1111-4111-8111-111111111111': 'tower-threshold' },
			arena: { furnaceState: 'lit', coolingControlNodeId: null, coolingControlExposed: false },
			expected: {
				monsterId: '00000000-0000-0000-0000-000000000000',
				policyId: 'guard-chain-court-v1',
				actionId: 'monster.hold.00000000-0000-0000-0000-000000000000',
				kind: 'hold',
				fromNodeId: 'chain-court',
				toNodeId: 'chain-court',
				targetId: null,
				telegraph: 'Chain Watch 01 watches the Chain Court lanes.',
				anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
			}
		},
		{
			name: 'strike',
			monster: { policyId: 'guard-chain-court-v1', label: 'Chain Watch 01', nodeId: 'chain-court' },
			positions: { '11111111-1111-4111-8111-111111111111': 'chain-court' },
			arena: { furnaceState: 'lit', coolingControlNodeId: null, coolingControlExposed: false },
			expected: {
				monsterId: '00000000-0000-0000-0000-000000000000',
				policyId: 'guard-chain-court-v1',
				actionId:
					'monster.strike.00000000-0000-0000-0000-000000000000.11111111-1111-4111-8111-111111111111',
				kind: 'strike',
				fromNodeId: 'chain-court',
				toNodeId: 'chain-court',
				targetId: '11111111-1111-4111-8111-111111111111',
				telegraph: 'Chain Watch 01 lowers a hooked blade toward the intruder in its court.',
				anticipatedEffect: 'Threatens 1 mission guard before defense reduction.'
			}
		},
		{
			name: 'control',
			monster: {
				policyId: 'foundry-warden-v1',
				label: 'Foundry Warden 01',
				nodeId: 'foundry-heart'
			},
			positions: { '11111111-1111-4111-8111-111111111111': 'cooling-control' },
			arena: {
				furnaceState: 'lit',
				coolingControlNodeId: 'cooling-control',
				coolingControlExposed: true
			},
			expected: {
				monsterId: '00000000-0000-0000-0000-000000000000',
				policyId: 'foundry-warden-v1',
				actionId:
					'monster.defend-control.00000000-0000-0000-0000-000000000000.11111111-1111-4111-8111-111111111111',
				kind: 'defend-control',
				fromNodeId: 'foundry-heart',
				toNodeId: 'cooling-control',
				targetId: '11111111-1111-4111-8111-111111111111',
				telegraph:
					'Foundry Warden 01 turns from the front line to defend the exposed cooling control.',
				anticipatedEffect: 'Threatens 3 mission guard before defense reduction.'
			}
		}
	])('freezes the complete monster $name intent', ({ monster, positions, arena, expected }) => {
		const input = deepFreeze({
			mission: null,
			monster: {
				monsterId: '00000000-0000-0000-0000-000000000000',
				dutySlotId: 'duty',
				ordinal: 1,
				status: 'active' as const,
				vitality: 2,
				maximumVitality: 2,
				alertState: 'duty' as const,
				defeatedOnRound: null,
				lastActionId: null,
				...monster
			},
			dutyNodeId: monster.nodeId,
			objectiveNodeId: 'objective',
			objectiveStatus: 'available' as const,
			objectiveCarrierId: null,
			party: {
				masterId: '11111111-1111-4111-8111-111111111111',
				heroIds: [],
				memberIds: ['11111111-1111-4111-8111-111111111111']
			},
			partyPositions: positions,
			arena
		});
		const before = hashCanonical(input);
		expect(resolveMonsterPolicyIntent(input as never)).toStrictEqual(expected);
		expect(hashCanonical(input)).toBe(before);
	});

	it('freezes spawn and combat receipts, initiative order, entropy, and immutable inputs', () => {
		const preDeploy = structuredClone(FROZEN_V13_PRE_DEPLOY);
		const deployed = structuredClone(FROZEN_V13_DEPLOYED);
		const masterId = deployed.master.masterId;
		const heroId = Object.keys(deployed.heroes)[0]!;
		const combatChoices = [
			manualChoice(masterId, 'mission.hold'),
			scriptedChoice(heroId, 'mission.hold')
		];
		const combatEventId = '0e380325-47f9-4679-968f-dd0f0757a01a';
		expect(hashCanonical(preDeploy)).toBe(
			'b300cc6b4b9d65d8f19706643f27ab16375f7476c9c1a54e09c1d4a8f23ecf8d'
		);
		const positions = Object.fromEntries(
			preDeploy.mission.attempt!.party.memberIds.map((actorId) => [
				actorId,
				preDeploy.mission.attempt!.entryNodeId
			])
		);
		const frozenPreDeploy = deepFreeze(structuredClone(preDeploy));
		const frozenPositions = deepFreeze(structuredClone(positions));
		const frozenAttempt = deepFreeze(structuredClone(frozenPreDeploy.mission.attempt!));
		const frozenEntropy = deepFreeze(
			createEntropyCursor(frozenPreDeploy.seed, frozenPreDeploy.entropyCursor)
		);
		const spawn = spawnMissionCombatants as unknown as (
			state: typeof frozenPreDeploy,
			attempt: typeof frozenAttempt,
			partyPositions: typeof frozenPositions,
			entropy: typeof frozenEntropy
		) => {
			readonly monsters: unknown;
			readonly threatIntents: unknown;
			readonly entropy: typeof frozenEntropy;
			readonly entropyDraws: readonly EntropyDraw[];
		};
		const spawned = spawn(frozenPreDeploy, frozenAttempt, frozenPositions, frozenEntropy);
		expect(spawned).toStrictEqual({
			monsters: {
				'13db0ccf-741e-4a47-a1c8-2fe08e29a602': {
					monsterId: '13db0ccf-741e-4a47-a1c8-2fe08e29a602',
					dutySlotId: 'goblin-chain-watch',
					policyId: 'guard-chain-court-v1',
					label: 'Chain Watch 01',
					ordinal: 1,
					nodeId: 'chain-court',
					status: 'active',
					vitality: 2,
					maximumVitality: 2,
					alertState: 'duty',
					defeatedOnRound: null,
					lastActionId: null
				},
				'feb2789a-ca07-4e29-93d6-2d9c23444759': {
					monsterId: 'feb2789a-ca07-4e29-93d6-2d9c23444759',
					dutySlotId: 'goblin-chain-watch',
					policyId: 'guard-chain-court-v1',
					label: 'Chain Watch 02',
					ordinal: 2,
					nodeId: 'chain-court',
					status: 'active',
					vitality: 2,
					maximumVitality: 2,
					alertState: 'duty',
					defeatedOnRound: null,
					lastActionId: null
				},
				'7cb87c5c-a50a-48c7-a967-e165ad40c22c': {
					monsterId: '7cb87c5c-a50a-48c7-a967-e165ad40c22c',
					dutySlotId: 'goblin-ember-hauler',
					policyId: 'protect-ember-cradle-v1',
					label: 'Ember Hauler 01',
					ordinal: 1,
					nodeId: 'ember-vault',
					status: 'active',
					vitality: 1,
					maximumVitality: 1,
					alertState: 'duty',
					defeatedOnRound: null,
					lastActionId: null
				}
			},
			threatIntents: [
				{
					monsterId: '13db0ccf-741e-4a47-a1c8-2fe08e29a602',
					policyId: 'guard-chain-court-v1',
					actionId: 'monster.hold.13db0ccf-741e-4a47-a1c8-2fe08e29a602',
					kind: 'hold',
					fromNodeId: 'chain-court',
					toNodeId: 'chain-court',
					targetId: null,
					telegraph: 'Chain Watch 01 watches the Chain Court lanes.',
					anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
				},
				{
					monsterId: '7cb87c5c-a50a-48c7-a967-e165ad40c22c',
					policyId: 'protect-ember-cradle-v1',
					actionId: 'monster.hold.7cb87c5c-a50a-48c7-a967-e165ad40c22c',
					kind: 'hold',
					fromNodeId: 'ember-vault',
					toNodeId: 'ember-vault',
					targetId: null,
					telegraph: 'Ember Hauler 01 keeps both hands on the ember cradle.',
					anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
				},
				{
					monsterId: 'feb2789a-ca07-4e29-93d6-2d9c23444759',
					policyId: 'guard-chain-court-v1',
					actionId: 'monster.hold.feb2789a-ca07-4e29-93d6-2d9c23444759',
					kind: 'hold',
					fromNodeId: 'chain-court',
					toNodeId: 'chain-court',
					targetId: null,
					telegraph: 'Chain Watch 02 watches the Chain Court lanes.',
					anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
				}
			],
			entropy: { seed: 'task-9a-v13-seed', cursor: 2 },
			entropyDraws: [
				{ purpose: 'goblin-chain-watch-count', cursor: 0, minimum: 2, maximum: 3, value: 2 },
				{ purpose: 'goblin-ember-hauler-count', cursor: 1, minimum: 1, maximum: 1, value: 1 }
			]
		});
		expect(
			hashCanonical({
				monsters: spawned.monsters,
				threatIntents: spawned.threatIntents,
				entropy: spawned.entropy
			})
		).toBe('fbfb60cb6d406c3a822ec35786e804a711f7acb1e1871be50f94fcdd21b51c5e');
		expect(hashCanonical(spawned)).toBe(
			'656e4a5555eaa0250eeb8c8ce80fed4ea16eb4c5509d4ba5f5e92fbd24307f9f'
		);
		expect(hashCanonical(frozenPreDeploy)).toBe(
			'b300cc6b4b9d65d8f19706643f27ab16375f7476c9c1a54e09c1d4a8f23ecf8d'
		);
		expect(frozenAttempt).toStrictEqual(frozenPreDeploy.mission.attempt);
		expect(frozenPositions).toStrictEqual(positions);
		expect(frozenEntropy).toStrictEqual(createEntropyCursor(frozenPreDeploy.seed, 0));

		const frozenDeployed = deepFreeze(structuredClone(deployed));
		const receipt = resolveMissionCombatTurn(frozenDeployed, combatChoices, combatEventId);
		expect(hashCanonical(receipt)).toBe(
			'c093a50d340e0ba7bcbd03c3327dfdd01e3be67863499d3d74a6aae1dc24e9e0'
		);
		expect(receipt.round.initiativeOrder).toStrictEqual([
			'e58eb0a3-f79e-47db-a8e7-af511da840da',
			'837ba031-ec72-449a-804b-5682a5cbb157',
			'13db0ccf-741e-4a47-a1c8-2fe08e29a602',
			'feb2789a-ca07-4e29-93d6-2d9c23444759',
			'7cb87c5c-a50a-48c7-a967-e165ad40c22c'
		]);
		expect(receipt.entropyDraws.map((draw) => draw.value)).toStrictEqual([94, 34, 47, 7, 41]);
		expect(hashCanonical(frozenDeployed)).toBe(
			'3be8c6b2bb35ec3a319a7127faf445ad1c1ca93afdabcc22a2ba909cdb2f2b30'
		);
	});

	it.each(['master', 'hero'] as const)(
		'resolves party-to-monster and monster-to-%s target classes in the shared effect ledger',
		(targetKind) => {
			const deployed = structuredClone(FROZEN_V13_DEPLOYED);
			const combatEventId = '0e380325-47f9-4679-968f-dd0f0757a01a';
			const masterId = deployed.master.masterId;
			const heroId = Object.keys(deployed.heroes)[0]!;
			const targetId = targetKind === 'master' ? masterId : heroId;
			const otherId = targetKind === 'master' ? heroId : masterId;
			const attempt = structuredClone(deployed.mission.attempt!);
			attempt.positions = {
				...attempt.positions,
				[targetId]: 'chain-court',
				[otherId]: 'tower-threshold'
			};
			const monster = Object.values(attempt.turnState.monsters)
				.filter((candidate) => candidate.dutySlotId === 'goblin-chain-watch')
				.sort((left, right) => left.monsterId.localeCompare(right.monsterId))[0]!;
			attempt.turnState.currentThreatIntents = Object.values(attempt.turnState.monsters)
				.sort((left, right) => left.monsterId.localeCompare(right.monsterId))
				.map((candidate) =>
					candidate.dutySlotId === 'goblin-chain-watch'
						? {
								monsterId: candidate.monsterId,
								policyId: candidate.policyId,
								actionId: `monster.strike.${candidate.monsterId}.${targetId}`,
								kind: 'strike' as const,
								fromNodeId: 'chain-court',
								toNodeId: 'chain-court',
								targetId,
								telegraph: `${candidate.label} lowers a hooked blade toward the intruder in its court.`,
								anticipatedEffect: 'Threatens 1 mission guard before defense reduction.'
							}
						: {
								monsterId: candidate.monsterId,
								policyId: candidate.policyId,
								actionId: `monster.hold.${candidate.monsterId}`,
								kind: 'hold' as const,
								fromNodeId: 'ember-vault',
								toNodeId: 'ember-vault',
								targetId: null,
								telegraph: `${candidate.label} keeps both hands on the ember cradle.`,
								anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
							}
				);
			const state = deepFreeze({
				...structuredClone(deployed),
				mission: { ...structuredClone(deployed.mission), attempt }
			});
			const receipt = resolveMissionCombatTurn(
				state,
				[
					manualChoice(
						masterId,
						targetKind === 'master' ? `mission.attack.${monster.monsterId}` : 'mission.hold'
					),
					scriptedChoice(
						heroId,
						targetKind === 'hero' ? `mission.attack.${monster.monsterId}` : 'mission.hold'
					)
				],
				combatEventId
			);
			expect(
				receipt.round.effects.some(
					(effect) => effect.targetKind === 'monster' && effect.targetId === monster.monsterId
				)
			).toBe(true);
			expect(
				receipt.round.effects.some(
					(effect) => effect.targetKind === 'party' && effect.targetId === targetId
				)
			).toBe(true);
			expect(
				receipt.round.monsterActions.some(
					(action) => action.kind === 'strike' && action.targetId === targetId
				)
			).toBe(true);
			expect(hashCanonical(receipt)).toBe(
				targetKind === 'master'
					? '8d87d5aaead05689df9c12822f9c906be786081a33cddc1b5262dd349a817f03'
					: '3172d725dff9a083b2008745e4c5a9bee27af0078ea6b1fa84e7558c7be99a19'
			);
			expect(hashCanonical(receipt.mission)).toBe(
				targetKind === 'master'
					? '380145a27da1a8551c9120c3fa33e64fbe38c8d480d242280d955c58c652b0d9'
					: 'fbd852d713c5a470eeec8a1ba934e5e9b57666b26808dd5a9f122143c6292017'
			);
			expect(receipt.entropyDraws).toStrictEqual([
				{ purpose: 'initiative-tie-break', cursor: 2, minimum: 0, maximum: 99, value: 94 },
				{ purpose: 'initiative-tie-break', cursor: 3, minimum: 0, maximum: 99, value: 34 },
				{ purpose: 'initiative-tie-break', cursor: 4, minimum: 0, maximum: 99, value: 47 },
				{ purpose: 'initiative-tie-break', cursor: 5, minimum: 0, maximum: 99, value: 7 },
				{ purpose: 'initiative-tie-break', cursor: 6, minimum: 0, maximum: 99, value: 41 }
			]);
			expect(state.mission.attempt!.positions[targetId]).toBe('chain-court');
		}
	);

	it('freezes the legacy round receipt and party initiative tie ordering', () => {
		const state = structuredClone(FROZEN_V12_DEPLOYED);
		const masterId = state.master.masterId;
		const heroId = Object.keys(state.heroes)[0]!;
		const choices = [
			manualChoice(masterId, 'mission.move.threshold-to-oath-hall'),
			scriptedChoice(heroId, 'mission.hold')
		];
		const frozen = deepFreeze(structuredClone(state));
		const receipt = resolveMissionTurn(frozen, choices);
		expect(hashCanonical(receipt)).toBe(
			'6e75e2834588d0a19651ea109d71403dca6f58b9f5ce3faccb8ba6afed2127af'
		);
		expect(receipt.round.initiativeOrder).toStrictEqual([
			'837ba031-ec72-449a-804b-5682a5cbb157',
			'e58eb0a3-f79e-47db-a8e7-af511da840da'
		]);
		expect(receipt.entropyDraws.map((draw) => draw.value)).toStrictEqual([22, 76]);
		expect(hashCanonical(frozen)).toBe(
			'e5a299e5bd50af057c7acbb4753ade39b68cddabaf283be27112e6576fa7e57c'
		);
	});

	it('uses actor id as the exact final initiative tie breaker', () => {
		const state = structuredClone(FROZEN_V12_DEPLOYED);
		const masterId = state.master.masterId;
		const heroId = Object.keys(state.heroes)[0]!;
		const tiedState = deepFreeze({ ...state, seed: 'tie-12' });
		const tied = resolveMissionTurn(tiedState, [
			manualChoice(masterId, 'mission.hold'),
			scriptedChoice(heroId, 'mission.hold')
		]);
		expect(tied.round.actions.map((action) => action.initiative)).toStrictEqual([135, 135]);
		expect(tied.round.initiativeOrder).toStrictEqual([heroId, masterId]);
	});

	it('freezes same-round v24 recovery as applied for the first actor and superseded for the second', () => {
		const state = deployedV24EquipmentMissionState();
		const masterId = state.master.masterId;
		const heroId = Object.keys(state.heroes)[0]!;
		const attempt = structuredClone(state.mission.attempt!);
		attempt.positions = { [masterId]: 'ember-vault', [heroId]: 'ember-vault' };
		attempt.turnState.currentThreatIntents = deriveMonsterIntents(
			missionContentForState(state),
			attempt,
			attempt.turnState.monsters,
			attempt.positions
		);
		const input = deepFreeze(
			EngineGameStateV24Schema.parse({ ...state, mission: { ...state.mission, attempt } })
		);
		const receipt = resolveMissionCombatTurn(
			input,
			[
				manualChoice(masterId, 'mission.recover.recover-first-ember'),
				scriptedChoice(heroId, 'mission.recover.recover-first-ember')
			],
			deterministicUuid('v24-same-objective-conflict')
		);
		expect(
			receipt.round.actions.map(({ actorId, actionId, outcome, objectiveTransition }) => ({
				actorId,
				actionId,
				outcome,
				objectiveTransition
			}))
		).toStrictEqual([
			{
				actorId: masterId,
				actionId: 'mission.recover.recover-first-ember',
				outcome: 'applied',
				objectiveTransition: 'recovered'
			},
			{
				actorId: heroId,
				actionId: 'mission.recover.recover-first-ember',
				outcome: 'superseded',
				objectiveTransition: null
			}
		]);
		expect(receipt.mission.attempt!.turnState.objective).toMatchObject({
			status: 'carried',
			carrierId: masterId,
			recoveredOnRound: 1
		});
	});

	it('freezes same-round v24 movement through one edge as applied for both actors', () => {
		const state = deepFreeze(deployedV24EquipmentMissionState());
		const masterId = state.master.masterId;
		const heroId = Object.keys(state.heroes)[0]!;
		const receipt = resolveMissionCombatTurn(
			state,
			[
				manualChoice(masterId, 'mission.move.threshold-to-oath-hall'),
				scriptedChoice(heroId, 'mission.move.threshold-to-oath-hall')
			],
			deterministicUuid('v24-same-edge-conflict')
		);
		expect(
			receipt.round.actions.map(({ actorId, outcome, fromNodeId, toNodeId }) => ({
				actorId,
				outcome,
				fromNodeId,
				toNodeId
			}))
		).toStrictEqual([
			{
				actorId: masterId,
				outcome: 'applied',
				fromNodeId: 'tower-threshold',
				toNodeId: 'oath-hall'
			},
			{
				actorId: heroId,
				outcome: 'applied',
				fromNodeId: 'tower-threshold',
				toNodeId: 'oath-hall'
			}
		]);
		expect(receipt.mission.attempt!.positions).toMatchObject({
			[masterId]: 'oath-hall',
			[heroId]: 'oath-hall'
		});
	});

	it('freezes portal pressure boundaries and the complete first-round receipt', () => {
		expect([
			portalPressureStage(5, 4, 2),
			portalPressureStage(4, 4, 2),
			portalPressureStage(3, 4, 2),
			portalPressureStage(2, 4, 2),
			portalPressureStage(1, 4, 2),
			portalPressureStage(0, 4, 2)
		]).toStrictEqual(['stable', 'warning', 'warning', 'critical', 'critical', 'collapsed']);
		const state = structuredClone(FROZEN_V15_DEPLOYED);
		const choices = [manualChoice(state.master.masterId, 'mission.move.gate-to-shelf')];
		const frozen = deepFreeze(structuredClone(state));
		const receipt = resolvePortalMissionTurn(frozen, choices);
		expect(hashCanonical(receipt)).toBe(
			'afd06f7155fc70a7b8d43c2b2ea817dbbe6f18762664e0de8618ad7df6dbbd69'
		);
		expect(receipt.round.portalWindow).toStrictEqual({
			roundsRemainingBefore: 8,
			roundsRemainingAfter: 7,
			pressureBefore: 'stable',
			pressureAfter: 'stable'
		});
		expect(receipt.entropyDraws).toStrictEqual([
			{ purpose: 'initiative-tie-break', cursor: 0, minimum: 0, maximum: 99, value: 81 }
		]);
		expect(hashCanonical(frozen)).toBe(
			'83653e9d18e1fdc30b2939cfc00aafaf3174a2ea1580620459c50cdca9b87e84'
		);
	});

	it('records exact cargo loss for collapse and retreat without mutating portal inputs', () => {
		const state = structuredClone(FROZEN_V15_DEPLOYED);
		const masterId = state.master.masterId;
		const attempt = structuredClone(state.mission.attempt!);
		attempt.turnState.portal.cargo[masterId] = {
			...attempt.turnState.portal.cargo[masterId]!,
			amount: 2
		};
		const frozenAttempt = deepFreeze(structuredClone(attempt));
		const lost = appendPortalCargoLosses(frozenAttempt, frozenAttempt.turnState.portal, 8);
		expect(lost.cargo[masterId]!.amount).toBe(0);
		expect(lost.oreLedger.at(-1)).toStrictEqual({
			entryId: '8a801b01-0932-47d1-9b02-e13161945c56',
			sequence: 1,
			roundNumber: 8,
			kind: 'lost',
			actorId: masterId,
			depositId: null,
			nodeId: 'moon-gate',
			amount: 2,
			cargoBefore: 2,
			cargoAfter: 0,
			depositBefore: null,
			depositAfter: null,
			settlementBefore: null,
			settlementAfter: null
		});
		expect(frozenAttempt.turnState.portal.cargo[masterId]!.amount).toBe(2);

		const retreatState = deepFreeze({
			...structuredClone(state),
			mission: { ...structuredClone(state.mission), attempt }
		});
		const retreated = retreatMissionAttempt(retreatState, appendPortalCargoLosses);
		expect(hashCanonical(retreated)).toBe(
			'a22cb038c790f0aab727db41d62eee3594cb40823c70ff1e904cd3cecc261abf'
		);
	});

	it('credits exact extraction cargo and returns the immutable aftermath patch', () => {
		const state = structuredClone(FROZEN_V15_EXTRACTION);
		const masterId = state.master.masterId;
		const frozen = deepFreeze(structuredClone(state));
		const extracted = completePortalMissionExtraction(frozen);
		expect(extracted.resourceChanges).toStrictEqual([
			{
				resource: 'iron-ore',
				before: 2,
				after: 8,
				delta: 6,
				reason: 'Iron Moon portal extraction'
			}
		]);
		expect(hashCanonical(extracted)).toBe(
			'c7c592d5d52d67d9ac03308680999d30b800908aacd265b14f8627b48e7cab92'
		);
		expect(frozen.mission.attempt!.turnState.portal.cargo[masterId]!.amount).toBe(2);
	});

	it.each(['recover', 'deliver', 'maximum-round'] as const)(
		'freezes the complete legacy objective %s receipt and state patch',
		(kind) => {
			const state = structuredClone(FROZEN_V12_DEPLOYED);
			const attempt = structuredClone(state.mission.attempt!);
			const masterId = state.master.masterId;
			const heroId = Object.keys(state.heroes)[0]!;
			if (kind === 'recover') {
				attempt.positions = { [masterId]: 'ember-vault', [heroId]: 'tower-threshold' };
			} else if (kind === 'deliver') {
				attempt.positions = { [masterId]: 'tower-threshold', [heroId]: 'tower-threshold' };
				attempt.turnState.objective = {
					...attempt.turnState.objective,
					status: 'carried',
					carrierId: masterId,
					recoveredOnRound: 1
				};
			} else {
				attempt.turnState.roundNumber = 47;
				attempt.turnState.rounds = syntheticLegacyRounds(masterId, 47);
			}
			const input = deepFreeze({ ...state, mission: { ...state.mission, attempt } });
			const receipt = resolveMissionTurn(input, [
				manualChoice(
					masterId,
					kind === 'recover' ? 'mission.recover.recover-first-ember' : 'mission.hold'
				),
				scriptedChoice(heroId, 'mission.hold')
			]);
			expect(hashCanonical(receipt)).toBe(
				{
					recover: '7431448da04e844ac43d96b7f6c531ad4c1def9436ba554db5985815f51b0fc7',
					deliver: 'fdb77fc4738a3473934eea05bc51d6c81d7ed8fbda27fec51666e095d866d80e',
					'maximum-round': '658a9a4bd4bc9c19d6729595bd0b4932ae1db18ae621c9b3782e62de09fa6a24'
				}[kind]
			);
			expect(hashCanonical(receipt.mission)).toBe(
				{
					recover: 'da818902b45dd8e03eba0f307982a4e7e810778f0bd91722f9e7dd1c747f040c',
					deliver: '22f3ab03615c69a1986aa9b47848a82b9b28eeb0b0a7b4416b1d27b316984c1f',
					'maximum-round': '0b44e6508189c11e179e0cf8a07a41211b72571a36cff044e8be0808a5e6d49a'
				}[kind]
			);
			expect(receipt.entropyDraws).toStrictEqual([
				{ purpose: 'initiative-tie-break', cursor: 0, minimum: 0, maximum: 99, value: 22 },
				{ purpose: 'initiative-tie-break', cursor: 1, minimum: 0, maximum: 99, value: 76 }
			]);
			expect(receipt.round.statusAfter).toBe(
				kind === 'deliver' ? 'extraction' : kind === 'maximum-round' ? 'failure' : 'resolving'
			);
		}
	);

	it('freezes defeat-duty completion after the exact armored Foundry strike', () => {
		const state = structuredClone(FROZEN_V14_FOUNDRY);
		const attempt = structuredClone(state.mission.attempt!);
		const masterId = state.master.masterId;
		const heroId = Object.keys(state.heroes)[0]!;
		const warden = Object.values(attempt.turnState.monsters).find(
			(monster) => monster.dutySlotId === 'foundry-warden'
		)!;
		attempt.positions = { [masterId]: 'furnace-heart', [heroId]: 'tower-threshold' };
		attempt.turnState.arena = { ...attempt.turnState.arena, furnaceState: 'quenched' };
		attempt.turnState.monsters[warden.monsterId] = { ...warden, vitality: 1 };
		attempt.turnState.currentThreatIntents = Object.values(attempt.turnState.monsters)
			.sort((left, right) => left.monsterId.localeCompare(right.monsterId))
			.map((monster) =>
				monster.monsterId === warden.monsterId
					? {
							monsterId: monster.monsterId,
							policyId: monster.policyId,
							actionId: `monster.strike.${monster.monsterId}.${masterId}`,
							kind: 'strike' as const,
							fromNodeId: 'furnace-heart',
							toNodeId: 'furnace-heart',
							targetId: masterId,
							telegraph: `${monster.label} raises its hammer without the furnace shielding it.`,
							anticipatedEffect: 'Threatens 3 mission guard before defense reduction.'
						}
					: {
							monsterId: monster.monsterId,
							policyId: monster.policyId,
							actionId: `monster.hold.${monster.monsterId}`,
							kind: 'hold' as const,
							fromNodeId: monster.nodeId,
							toNodeId: monster.nodeId,
							targetId: null,
							telegraph: `${monster.label} watches the Chain Court lanes.`,
							anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
						}
			);
		const input = deepFreeze({ ...state, mission: { ...state.mission, attempt } });
		const receipt = resolveMissionCombatTurn(
			input,
			[
				manualChoice(masterId, `mission.attack.${warden.monsterId}`),
				scriptedChoice(heroId, 'mission.hold')
			],
			'fd1e7402-ef53-46d8-9813-29e7845dbb44'
		);
		expect(hashCanonical(receipt)).toBe(
			'a9f81a97f469516b8708c85d9be27990e65f3149edd762502dea130208f11f09'
		);
		expect(hashCanonical(receipt.mission)).toBe(
			'81daa747760169ecb3f06797651fc968f98bcbb7524f4b0de7f419778a392eaf'
		);
		expect(receipt.mission.attempt!.turnState.objective).toStrictEqual({
			objectiveId: 'defeat-the-foundry-warden',
			status: 'delivered',
			carrierId: null,
			recoveredOnRound: 1,
			deliveredOnRound: 1
		});
		expect(
			receipt.round.effects.some(
				(effect) =>
					effect.targetKind === 'monster' &&
					effect.targetId === warden.monsterId &&
					effect.kind === 'vitality-damage' &&
					effect.amount === 1 &&
					effect.before === 1 &&
					effect.after === 0
			)
		).toBe(true);
	});

	it.each([
		{
			name: 'hero',
			base: FROZEN_V16_AFTERMATH,
			target: 'hero' as const,
			sourceEventId: 'b4fc08ed-5c79-4422-a182-8e1ea0f29cd6'
		},
		{
			name: 'Master',
			base: FROZEN_V17_MASTER_AFTERMATH,
			target: 'master' as const,
			sourceEventId: 'd51dc7cd-b440-4b4a-ad84-cfaf80e2aa8a'
		}
	])(
		'freezes the complete $name defeat, environment, and aftermath receipt',
		({ base, target, sourceEventId }) => {
			const state = aftermathHazardState(base, target);
			const masterId = state.master.masterId;
			const heroId = Object.keys(state.heroes)[0]!;
			const input = deepFreeze(state);
			const before = hashCanonical(input);
			const receipt = resolveMissionCombatTurn(
				input,
				[manualChoice(masterId, 'mission.hold'), scriptedChoice(heroId, 'mission.hold')],
				sourceEventId
			);
			expect(hashCanonical(receipt)).toBe(
				target === 'master'
					? 'c0c4b040e048935810382992800843f066a893d7baed2516dc438da3e5df8fc0'
					: '293d3cc6f9ab748b70accc274f9d0cd82a8601cf0d044e281c4db75115f94cc3'
			);
			expect(hashCanonical(receipt.mission)).toBe(
				target === 'master'
					? 'ec82018845f3bea5e840a77bb7e8d2a43abb1827bc268a8e5f0175357bde8660'
					: '8f361b995b30494e6200caa2455f69a79f6ee139747e09c3d6a01b01481abffc'
			);
			expect(hashCanonical(receipt.consequences)).toBe(
				target === 'master'
					? 'ad7c452edc70e11134f18e615e30e534b91a0f23f56e5afef8003ffc69cdd649'
					: '208cac267417ceb5d372386372eea518d74050c857fde77aebc2f51808e3e8da'
			);
			expect(receipt.round.environmentEventIds).toStrictEqual(['first-ember-pulse']);
			expect(receipt.round.statusAfter).toBe('death');
			expect(receipt.status).toBe(target === 'master' ? 'game_over' : 'active');
			expect(hashCanonical(input)).toBe(before);
		}
	);

	it.each(['mine', 'quota', 'collapse'] as const)(
		'freezes the complete portal %s receipt, pressure, cargo, and ledger patch',
		(kind) => {
			const state = structuredClone(FROZEN_V15_DEPLOYED);
			const attempt = structuredClone(state.mission.attempt!);
			const masterId = state.master.masterId;
			if (kind === 'mine' || kind === 'quota') {
				attempt.positions[masterId] = 'pale-vein';
				if (kind === 'quota') attempt.turnState.objective.minedAmount = 3;
			} else {
				attempt.turnState.roundNumber = 7;
				attempt.turnState.rounds = syntheticPortalRounds(masterId, 7);
				attempt.turnState.portal.roundsRemaining = 1;
				attempt.turnState.portal.pressureStage = 'critical';
				attempt.turnState.portal.cargo[masterId] = {
					...attempt.turnState.portal.cargo[masterId]!,
					amount: 2
				};
			}
			const input = deepFreeze({ ...state, mission: { ...state.mission, attempt } });
			const receipt = resolvePortalMissionTurn(input, [
				manualChoice(
					masterId,
					kind === 'collapse' ? 'mission.hold' : 'mission.mine.pale-vein-deposit'
				)
			]);
			expect(hashCanonical(receipt)).toBe(
				{
					mine: '703e4667b392c2b9bbd3a432c23990a147d216af889ec5ad41d410cf212e0140',
					quota: '4173a3a5369666a4e0eb0e6e3111d1bb262418180ccf6662df280bad35812632',
					collapse: '65add1dcc3c1e03d824d88dbef8b51aced9a6d8f27c9713b89bf016bdd1c924e'
				}[kind]
			);
			expect(hashCanonical(receipt.mission)).toBe(
				{
					mine: '094c81afc56746cfbfc499072f9fcc9feffd6395f6f1cb476f7b14313f7e206c',
					quota: 'e8d85a0dde13235b7f923822fb5f23b8fa6f9738426501a97d7e2aadd65c3ad7',
					collapse: '6ff8c9b8a5eb63361be69c0d1355c56ef948ff0289e63a34c14e534862166138'
				}[kind]
			);
			expect(receipt.entropyDraws).toStrictEqual([
				{ purpose: 'initiative-tie-break', cursor: 0, minimum: 0, maximum: 99, value: 81 }
			]);
			expect(receipt.round.statusAfter).toBe(kind === 'collapse' ? 'failure' : 'resolving');
			expect(receipt.mission.attempt!.turnState.objective.status).toBe(
				kind === 'quota' ? 'quota-met' : 'available'
			);
		}
	);

	it('freezes full retreat and extraction patches', () => {
		const retreatState = structuredClone(FROZEN_V15_DEPLOYED);
		const masterId = retreatState.master.masterId;
		retreatState.mission.attempt!.turnState.portal.cargo[masterId] = {
			...retreatState.mission.attempt!.turnState.portal.cargo[masterId]!,
			amount: 2
		};
		const frozenRetreat = deepFreeze(retreatState);
		const retreated = retreatMissionAttempt(frozenRetreat, appendPortalCargoLosses);
		expect(hashCanonical(retreated)).toBe(
			'a22cb038c790f0aab727db41d62eee3594cb40823c70ff1e904cd3cecc261abf'
		);
		const frozenExtraction = deepFreeze(structuredClone(FROZEN_V15_EXTRACTION));
		const extracted = completePortalMissionExtraction(frozenExtraction);
		expect(hashCanonical(extracted)).toBe(
			'c7c592d5d52d67d9ac03308680999d30b800908aacd265b14f8627b48e7cab92'
		);
		expect(hashCanonical(extracted.mission)).toBe(
			'16fb4ff0f552ac1a7baa8ecd819db1d1a3946f4408efb459bf1bda83a12f0d1c'
		);
	});

	it('freezes policy binding, telegraph, source-event, and extraction rejection errors', () => {
		const bindingState = structuredClone(FROZEN_V13_PRE_DEPLOY);
		bindingState.mission.attempt!.turnState.policyBinding.contentHash = '0'.repeat(64);
		const positions = Object.fromEntries(
			bindingState.mission.attempt!.party.memberIds.map((id) => [
				id,
				bindingState.mission.attempt!.entryNodeId
			])
		);
		expectErrorShape(
			() =>
				spawnMissionCombatants(
					bindingState,
					bindingState.mission.attempt!,
					positions,
					createEntropyCursor(bindingState.seed, 0)
				),
			ReplayIntegrityError,
			{
				name: 'ReplayIntegrityError',
				message: 'Monster policy binding is unavailable',
				sequence: 0
			}
		);

		const telegraphState = structuredClone(FROZEN_V13_DEPLOYED);
		telegraphState.mission.attempt!.turnState.currentThreatIntents[0]!.telegraph = 'tampered';
		expectErrorShape(
			() =>
				resolveMissionCombatTurn(
					telegraphState,
					[
						manualChoice(telegraphState.master.masterId, 'mission.hold'),
						scriptedChoice(Object.keys(telegraphState.heroes)[0]!, 'mission.hold')
					],
					'0e380325-47f9-4679-968f-dd0f0757a01a'
				),
			ReplayIntegrityError,
			{ name: 'ReplayIntegrityError', message: 'Monster threat telegraph diverged', sequence: 3 }
		);

		const aftermathState = aftermathHazardState(FROZEN_V16_AFTERMATH, 'hero');
		expectErrorShape(
			() =>
				resolveMissionCombatTurn(aftermathState, [
					manualChoice(aftermathState.master.masterId, 'mission.hold'),
					scriptedChoice(Object.keys(aftermathState.heroes)[0]!, 'mission.hold')
				]),
			ReplayIntegrityError,
			{
				name: 'ReplayIntegrityError',
				message: 'Mission aftermath lacks a source event',
				sequence: 3
			}
		);

		expectErrorShape(
			() => completePortalMissionExtraction(FROZEN_V15_DEPLOYED),
			IllegalActionError,
			{
				name: 'IllegalActionError',
				message: 'Action is not legal in the current state: mission.extract',
				code: 'ILLEGAL_ACTION',
				legalActionIds: []
			}
		);
	});

	it('freezes v23 composite state hashes, archive recovery, precedence, and immutable inputs', () => {
		type TransitionRecord = {
			readonly before: EngineGameStateV23;
			readonly event: AuthoritativeEvent;
			readonly after: EngineGameStateV23;
		};
		const heroId = deterministicUuid('task-9b-v23-hero');
		const bootstrap = (key: string) =>
			EngineGameStateV23Schema.parse(
				createBootstrapEngine({
					runId: deterministicUuid(`task-9b-v23-${key}-run`),
					seed: `task-9b-v23-${key}-seed`,
					heroId,
					manifestHash: sha256Hex(`task-9b-v23-${key}-manifest`),
					developmentMissionScenario: {
						initialMissionId: 'tower-floor-05',
						availableMissionIds: ['tower-floor-05'],
						enableFirstBandArchive: true
					}
				}).snapshot.state
			);
		const command = (state: EngineGameStateV23, key: string, body: object) =>
			deepFreeze({
				commandId: deterministicUuid(`task-9b-v23-${key}-command`),
				runId: state.runId,
				actorId: state.master.masterId,
				expectedVersion: state.version,
				correlationId: deterministicUuid(`task-9b-v23-${key}-correlation`),
				source: {
					source: 'manual' as const,
					timing: 'step' as const,
					fallbackPolicy: null,
					directiveIds: [],
					decisionJobId: null
				},
				...body
			}) as unknown as EngineCommand;
		const commit = (state: EngineGameStateV23, nextCommand: EngineCommand): TransitionRecord => {
			const stateHash = hashCanonical(state);
			const commandHash = hashCanonical(nextCommand);
			const built = firstBandMissionCommandHandler.buildEvent(state, nextCommand as never);
			const directlyReduced = firstBandMissionEventReducer.reduce(state, built);
			const result = applyCommand(deepFreeze(state), nextCommand);
			expect(directlyReduced).toStrictEqual(result.state);
			expect({
				...built,
				afterStateHash: result.events[0]!.afterStateHash
			}).toStrictEqual(result.events[0]);
			expect(hashCanonical(state)).toBe(stateHash);
			expect(hashCanonical(nextCommand)).toBe(commandHash);
			return {
				before: state,
				event: result.events[0]!,
				after: EngineGameStateV23Schema.parse(result.state)
			};
		};

		let state = bootstrap('lifecycle');
		const prepare = commit(
			state,
			command(state, 'prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-05'
			})
		);
		state = prepare.after;
		const revise = commit(
			state,
			command(state, 'revise', { commandType: 'mission.revise.party', heroIds: [heroId] })
		);
		state = revise.after;
		const cancel = commit(state, command(state, 'cancel', { commandType: 'mission.cancel' }));
		state = cancel.after;
		state = commit(
			state,
			command(state, 'reprepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-05'
			})
		).after;
		const deploy = commit(state, command(state, 'deploy', { commandType: 'mission.deploy' }));
		const retreat = commit(
			deploy.after,
			command(deploy.after, 'retreat', { commandType: 'mission.retreat' })
		);

		let extractionState = bootstrap('extraction');
		extractionState = commit(
			extractionState,
			command(extractionState, 'extraction-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId],
				missionId: 'tower-floor-05'
			})
		).after;
		extractionState = commit(
			extractionState,
			command(extractionState, 'extraction-deploy', { commandType: 'mission.deploy' })
		).after;
		const extractionAttempt = extractionState.mission.attempt!;
		extractionState = EngineGameStateV23Schema.parse({
			...extractionState,
			mission: {
				...extractionState.mission,
				attempt: {
					...extractionAttempt,
					status: 'extraction',
					completedObjectiveIds: ['defeat-the-foundry-warden'],
					extractionOpenedAt: extractionState.simulatedAt,
					turnState: {
						...extractionAttempt.turnState,
						objective: {
							...extractionAttempt.turnState.objective,
							status: 'delivered',
							recoveredOnRound: 1,
							deliveredOnRound: 1
						}
					}
				}
			}
		});
		const extract = commit(
			extractionState,
			command(extractionState, 'extract', { commandType: 'mission.extract' })
		);

		const records = { prepare, revise, cancel, deploy, retreat, extract } as const;
		expect(
			Object.fromEntries(
				Object.entries(records).map(([transition, record]) => [
					transition,
					hashCanonical(record.after)
				])
			)
		).toStrictEqual({
			prepare: 'fcc32bbdec32fdba54fdf6f619762601e478505b1bb6ffa23afd1d1bb95acedf',
			revise: '62293b39f1ea693ff8bb6eb55289fd86f950cbc81f8b59e9edd92f259e7c6044',
			cancel: '144c9c2e69c92f4673e09f2581ec04cb688acdf5a111b2c73e1ba32d81617b5f',
			deploy: '44a54ecc88664cebb6bbe680f5de5dfbc92b8996cfa9630e2df8e817dc2a7f87',
			retreat: 'db1819814427954a9c6320e30d96598f34b43c04bf741436371efe6eaaf0c4c9',
			extract: '199438099897b2c0802fec5eb29f35ee07ee789c2d2b6ff12f130c07d6c9fcb5'
		});

		const storyMissionPrecedence: Array<{
			readonly transition: string;
			readonly consequenceValidatorFirst: boolean;
		}> = [];
		for (const [transition, record] of Object.entries(records)) {
			const payload = record.event.payload as Record<string, unknown> & {
				mission: EngineGameStateV23['mission'];
				firstBandArchive: EngineGameStateV23['firstBandArchive'];
			};
			const storyAndMissionEvent = {
				...record.event,
				payload: {
					...payload,
					mission: {
						...payload.mission,
						attempt: {
							...payload.mission.attempt!,
							preparedAt: '2000-01-01T00:00:01.000Z'
						}
					},
					firstBandArchive: {
						...payload.firstBandArchive,
						canonicalMessageHash: '0'.repeat(64)
					}
				}
			};
			let concreteConsequenceError: unknown;
			try {
				firstBandMissionEventReducer.reduce(record.before, storyAndMissionEvent);
			} catch (error) {
				concreteConsequenceError = error;
			}
			expect(concreteConsequenceError).toBeInstanceOf(ReplayIntegrityError);
			expect(concreteConsequenceError).toMatchObject({
				name: 'ReplayIntegrityError',
				message: 'First-band mission transition payload diverged',
				sequence: record.event.sequence
			});
			// Both validators preserve the same public message, so the first concrete throw site proves order.
			storyMissionPrecedence.push({
				transition,
				consequenceValidatorFirst:
					(concreteConsequenceError as Error).stack
						?.split('\n')[1]
						?.includes('reduceFirstBandMissionConsequences') === true
			});
		}
		expect(storyMissionPrecedence).toStrictEqual([
			{ transition: 'prepare', consequenceValidatorFirst: true },
			{ transition: 'revise', consequenceValidatorFirst: true },
			{ transition: 'cancel', consequenceValidatorFirst: true },
			{ transition: 'deploy', consequenceValidatorFirst: true },
			{ transition: 'retreat', consequenceValidatorFirst: true },
			{ transition: 'extract', consequenceValidatorFirst: true }
		]);

		for (const [transition, record] of Object.entries(records)) {
			const beforeHash = hashCanonical(record.before);
			const eventHash = hashCanonical(record.event);
			const reduced = firstBandMissionEventReducer.reduce(
				deepFreeze(record.before),
				deepFreeze(record.event)
			);
			expect(reduced).toStrictEqual(record.after);
			expect(hashCanonical(record.before)).toBe(beforeHash);
			expect(hashCanonical(record.event)).toBe(eventHash);
			expect(record.after.firstBandArchive.status, transition).toBe(
				transition === 'extract' ? 'recovered' : 'sealed'
			);

			const payload = record.event.payload as Record<string, unknown> & {
				mission: EngineGameStateV23['mission'];
				firstBandArchive: EngineGameStateV23['firstBandArchive'];
			};
			const missionTamper = {
				...payload,
				mission: {
					...payload.mission,
					attempt: { ...payload.mission.attempt!, preparedAt: '2000-01-01T00:00:01.000Z' }
				}
			};
			const consequenceTamper = {
				...payload,
				firstBandArchive: {
					...payload.firstBandArchive,
					canonicalMessageHash: '0'.repeat(64)
				}
			};
			const missionEvent = { ...record.event, payload: missionTamper };
			const consequenceEvent = { ...record.event, payload: consequenceTamper };
			if (transition !== 'extract') {
				expect(record.after.firstBandArchive).toStrictEqual(record.before.firstBandArchive);
			}
			expectErrorShape(
				() => firstBandMissionEventReducer.reduce(record.before, consequenceEvent),
				ReplayIntegrityError,
				{
					name: 'ReplayIntegrityError',
					message: 'First-band mission transition payload diverged',
					sequence: record.event.sequence
				}
			);
			expectErrorShape(
				() => firstBandMissionEventReducer.reduce(record.before, missionEvent),
				ReplayIntegrityError,
				{
					name: 'ReplayIntegrityError',
					message: 'First-band mission transition payload diverged',
					sequence: record.event.sequence
				}
			);
			const observedTransitions: string[] = [];
			const distinctiveConsequenceFailure = (
				_state: EngineGameStateV23 | EngineGameStateV24,
				consequence: { readonly transition: string; readonly sequence: number }
			): never => {
				observedTransitions.push(consequence.transition);
				throw new ReplayIntegrityError(
					`Distinct consequence callback: ${consequence.transition}`,
					consequence.sequence
				);
			};
			expectErrorShape(
				() =>
					reduceFirstBandMissionTransition(
						record.before,
						missionEvent,
						distinctiveConsequenceFailure
					),
				ReplayIntegrityError,
				{
					name: 'ReplayIntegrityError',
					message: `Distinct consequence callback: ${(record.event.payload as { transition: string }).transition}`,
					sequence: record.event.sequence
				}
			);
			const entropyEvent = { ...record.event, seedCursor: record.event.seedCursor + 1 };
			expectErrorShape(
				() => firstBandMissionEventReducer.reduce(record.before, entropyEvent),
				ReplayIntegrityError,
				{
					name: 'ReplayIntegrityError',
					message:
						transition === 'deploy'
							? 'First-band deployment entropy diverged'
							: 'First-band transition entropy diverged',
					sequence: record.event.sequence
				}
			);
			const storyAndEntropyEvent = {
				...consequenceEvent,
				seedCursor: entropyEvent.seedCursor
			};
			expectErrorShape(
				() =>
					reduceFirstBandMissionTransition(
						record.before,
						storyAndEntropyEvent,
						distinctiveConsequenceFailure
					),
				ReplayIntegrityError,
				{
					name: 'ReplayIntegrityError',
					message: `Distinct consequence callback: ${(record.event.payload as { transition: string }).transition}`,
					sequence: record.event.sequence
				}
			);
			expect(observedTransitions).toStrictEqual([
				(record.event.payload as { transition: string }).transition,
				(record.event.payload as { transition: string }).transition
			]);
		}
	});
});

describe('v24 authored equipment extraction drop', () => {
	it('creates one replay-stable shared-factory item for the lowest-id surviving hero', () => {
		const lowerHeroId = '31000000-0000-4000-8000-000000000001';
		const higherHeroId = '31000000-0000-4000-8000-000000000002';
		const initial = EngineGameStateV24Schema.parse(
			createBootstrapEngine({
				runId: deterministicUuid('equipment-drop-run'),
				seed: 'equipment-drop-seed',
				heroId: higherHeroId,
				manifestHash: sha256Hex('equipment-drop-higher-manifest'),
				additionalHeroes: [
					{
						heroId: lowerHeroId,
						manifestHash: sha256Hex('equipment-drop-lower-manifest')
					}
				],
				developmentMissionScenario: {
					initialMissionId: 'tower-floor-01',
					availableMissionIds: ['tower-floor-01'],
					enableFirstBandArchive: true
				},
				developmentEquipmentScenario: { enabled: true }
			}).snapshot.state
		);
		const prepared = applyCommand(
			initial,
			missionTestCommand(initial, 'equipment-drop-prepare', {
				commandType: 'mission.prepare',
				heroIds: [higherHeroId, lowerHeroId]
			})
		).state;
		const deployed = applyCommand(
			prepared,
			missionTestCommand(prepared, 'equipment-drop-deploy', {
				commandType: 'mission.deploy'
			})
		).state;
		const deployedV24 = EngineGameStateV24Schema.parse(deployed);
		const attempt = deployedV24.mission.attempt!;
		const extraction = EngineGameStateV24Schema.parse({
			...deployedV24,
			mission: {
				...deployedV24.mission,
				attempt: {
					...attempt,
					status: 'extraction',
					positions: Object.fromEntries(
						attempt.party.memberIds.map((memberId) => [memberId, attempt.extractionNodeId])
					),
					completedObjectiveIds: ['recover-first-ember'],
					extractionOpenedAt: deployedV24.simulatedAt,
					turnState: {
						...attempt.turnState,
						objective: {
							...attempt.turnState.objective,
							status: 'delivered',
							carrierId: null,
							recoveredOnRound: 1,
							deliveredOnRound: 1
						}
					}
				}
			}
		});
		const beforeItemCount = Object.keys(extraction.items).length;
		const result = applyCommand(
			extraction,
			missionTestCommand(extraction, 'equipment-drop-extract', {
				commandType: 'mission.extract'
			})
		);
		const event = result.events[0]!;
		const resultState = EngineGameStateV24Schema.parse(result.state);
		const payload = event.payload as {
			equipmentDrop: {
				fixtureContentVersion: string;
				fixtureContentHash: string;
				catalogContentVersion: string;
				catalogContentHash: string;
				recipientHeroId: string;
				item: EngineGameStateV24['items'][string];
			};
		};
		const outcome = payload.equipmentDrop;
		const dropped = outcome.item;

		expect(Object.keys(resultState.items)).toHaveLength(beforeItemCount + 1);
		expect(outcome).toMatchObject({
			fixtureContentVersion: TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE.contentVersion,
			fixtureContentHash: TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE.contentHash,
			catalogContentVersion: EQUIPMENT_DEFINITION_CATALOG.contentVersion,
			catalogContentHash: EQUIPMENT_DEFINITION_CATALOG.contentHash,
			recipientHeroId: lowerHeroId
		});
		expect(dropped).toMatchObject({
			itemId: deterministicUuid(
				`${event.eventId}:${TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE.rewardId}:equipment-drop`
			),
			definitionId: TOWER_BAND_01_EQUIPMENT_DROP_FIXTURE.definitionId,
			ownerId: lowerHeroId,
			durability: 80,
			maxDurability: 100,
			origin: {
				kind: 'dropped',
				missionId: 'tower-floor-01',
				rewardId: 'ember-hauler-bronze-dagger',
				sourceId: 'goblin-ember-hauler'
			}
		});

		const replayed = firstBandMissionEventReducer.reduce(extraction, event);
		expect(replayed).toStrictEqual(result.state);
		expect(() => firstBandMissionEventReducer.reduce(result.state, event)).toThrow(
			'Equipment mission transition version diverged'
		);
		const tampered = {
			...event,
			payload: {
				...event.payload,
				equipmentDrop: { ...outcome, fixtureContentHash: '0'.repeat(64) }
			}
		};
		expect(() => firstBandMissionEventReducer.reduce(extraction, tampered)).toThrow(
			'Equipment mission transition payload diverged'
		);

		const forged = createEquipmentItem({
			itemId: deterministicUuid('equipment-drop-forged-comparison'),
			definitionId: dropped.definitionId,
			ownerId: lowerHeroId,
			craftsmanship: { label: 'standard', bonus: 0 },
			origin: {
				kind: 'forged',
				forgeEventId: deterministicUuid('equipment-drop-forge-event'),
				crafterId: lowerHeroId
			}
		});
		expect({
			...dropped,
			itemId: forged.itemId,
			origin: forged.origin,
			durability: forged.durability
		}).toStrictEqual(forged);
		expect(dropped.durability).not.toBe(forged.durability);
		const definition = EQUIPMENT_DEFINITION_CATALOG.definitions.find(
			(candidate) => candidate.definitionId === dropped.definitionId
		)!;
		expect(definition).toMatchObject({
			materialId: 'bronze',
			materialRank: 'F',
			equipmentClass: 'dagger',
			slot: 'main-hand',
			handedness: 'one-handed',
			approvedVisualAssetKey: 'equipment-v1-f-bronze-dagger',
			runtimeCardAlias: 'equipment.equipment-v1-f-bronze-dagger.card',
			runtimeDetailAlias: 'equipment.equipment-v1-f-bronze-dagger.detail'
		});
		const equipped = equipEquipmentItem(resultState, {
			heroId: lowerHeroId,
			itemId: dropped.itemId
		});
		expect(equipped.heroes[lowerHeroId]!.equipment.mainHand).toBe(dropped.itemId);
	});
});

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

function aftermathHazardState<T extends EngineGameStateV16 | EngineGameStateV17>(
	base: T,
	target: 'hero' | 'master'
): T {
	const state = structuredClone(base);
	const attempt = structuredClone(state.mission.attempt!);
	const masterId = state.master.masterId;
	const heroId = Object.keys(state.heroes)[0]!;
	const targetId = target === 'master' ? masterId : heroId;
	const otherId = target === 'master' ? heroId : masterId;
	attempt.positions = { [targetId]: 'ember-vault', [otherId]: 'tower-threshold' };
	attempt.turnState.roundNumber = 2;
	attempt.turnState.rounds = syntheticCombatRounds(attempt, 2);
	attempt.turnState.partyGuard[targetId] = {
		...attempt.turnState.partyGuard[targetId]!,
		guard: 0,
		status: 'exposed',
		lastChangedOnRound: 2
	};
	attempt.turnState.currentThreatIntents = Object.values(attempt.turnState.monsters)
		.sort((left, right) => left.monsterId.localeCompare(right.monsterId))
		.map((monster) =>
			monster.dutySlotId === 'goblin-ember-hauler'
				? {
						monsterId: monster.monsterId,
						policyId: monster.policyId,
						actionId: `monster.alarm.${monster.monsterId}`,
						kind: 'alarm' as const,
						fromNodeId: 'ember-vault',
						toNodeId: 'ember-vault',
						targetId,
						telegraph: `${monster.label} reaches for the cradle alarm chain.`,
						anticipatedEffect: 'Becomes alarmed and makes its next defense explicit.'
					}
				: {
						monsterId: monster.monsterId,
						policyId: monster.policyId,
						actionId: `monster.hold.${monster.monsterId}`,
						kind: 'hold' as const,
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: `${monster.label} watches the Chain Court lanes.`,
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					}
		);
	return { ...state, mission: { ...state.mission, attempt } };
}

function expectErrorShape(
	run: () => unknown,
	errorType: typeof ReplayIntegrityError | typeof IllegalActionError,
	expected: Readonly<Record<string, unknown>>
): void {
	let thrown: unknown;
	try {
		run();
	} catch (error) {
		thrown = error;
	}
	expect(thrown).toBeInstanceOf(errorType);
	const record = thrown as unknown as Record<string, unknown>;
	expect(Object.fromEntries(Object.keys(expected).map((key) => [key, record[key]]))).toStrictEqual(
		expected
	);
}

function syntheticLegacyRounds(actorId: string, count: number) {
	return Array.from({ length: count }, (_, index) => ({
		roundNumber: index + 1,
		stateVersion: 2,
		environmentEventIds: [],
		monsterActionIds: [],
		initiativeOrder: [actorId],
		actions: [
			{
				actorId,
				actorKind: 'master' as const,
				actionId: 'mission.hold',
				choiceSource: 'manual' as const,
				policyId: null,
				packetHash: null,
				legalActionHash: null,
				policyResultHash: null,
				publicIntent: 'Frozen prior round.',
				initiativeBase: 50,
				initiativeTieBreak: 0,
				initiative: 50,
				outcome: 'applied' as const,
				fromNodeId: 'tower-threshold',
				toNodeId: 'tower-threshold',
				discoveryIds: [],
				objectiveTransition: null,
				summary: 'Frozen prior round.'
			}
		],
		statusAfter: 'resolving' as const
	}));
}

function syntheticCombatRounds(
	attempt: NonNullable<EngineGameStateV16['mission']['attempt']>,
	count: number
) {
	return Array.from({ length: count }, (_, roundIndex) => {
		const partyEntries = attempt.party.memberIds.map((actorId) => ({
			kind: 'party' as const,
			id: actorId,
			initiative: 99 - attempt.party.memberIds.indexOf(actorId)
		}));
		const monsterEntries = attempt.turnState.currentThreatIntents.map((intent, index) => ({
			kind: 'monster' as const,
			id: intent.monsterId,
			initiative: 90 - index,
			intent
		}));
		const ranked = [...partyEntries, ...monsterEntries].sort(
			(left, right) => right.initiative - left.initiative || left.id.localeCompare(right.id)
		);
		return {
			roundVersion: 'mission-round-v2' as const,
			roundNumber: roundIndex + 1,
			stateVersion: 2,
			environmentEventIds: [],
			threatIntents: structuredClone(attempt.turnState.currentThreatIntents),
			monsterActionIds: ranked
				.filter((entry) => entry.kind === 'monster')
				.map((entry) => entry.intent.actionId),
			initiativeOrder: ranked.map((entry) => entry.id),
			actions: ranked
				.filter((entry) => entry.kind === 'party')
				.map((entry) => ({
					actorId: entry.id,
					actorKind: entry.id === attempt.party.masterId ? ('master' as const) : ('hero' as const),
					actionId: 'mission.hold',
					choiceSource: 'manual' as const,
					policyId: null,
					packetHash: null,
					legalActionHash: null,
					policyResultHash: null,
					publicIntent: 'Frozen prior combat round.',
					initiativeBase: 0,
					initiativeTieBreak: entry.initiative,
					initiative: entry.initiative,
					outcome: 'applied' as const,
					fromNodeId: attempt.positions[entry.id]!,
					toNodeId: attempt.positions[entry.id]!,
					targetId: null,
					discoveryIds: [],
					objectiveTransition: null,
					effectIds: [],
					summary: 'Frozen prior combat round.'
				})),
			monsterActions: ranked
				.filter((entry) => entry.kind === 'monster')
				.map((entry) => ({
					monsterId: entry.id,
					policyId: entry.intent.policyId,
					actionId: entry.intent.actionId,
					kind: entry.intent.kind,
					initiativeBase: 0,
					initiativeTieBreak: entry.initiative,
					initiative: entry.initiative,
					outcome: 'applied' as const,
					fromNodeId: entry.intent.fromNodeId,
					toNodeId: entry.intent.toNodeId,
					targetId: entry.intent.targetId,
					effectIds: [],
					summary: 'Frozen prior monster round.'
				})),
			effects: [],
			statusAfter: 'resolving' as const
		};
	});
}

function syntheticPortalRounds(actorId: string, count: number) {
	const stageBefore = (remaining: number) =>
		remaining <= 2
			? ('critical' as const)
			: remaining <= 4
				? ('warning' as const)
				: ('stable' as const);
	const stage = (remaining: number) =>
		remaining === 0
			? ('collapsed' as const)
			: remaining <= 2
				? ('critical' as const)
				: remaining <= 4
					? ('warning' as const)
					: ('stable' as const);
	return Array.from({ length: count }, (_, index) => {
		const before = 8 - index;
		const after = before - 1;
		return {
			roundVersion: 'mission-round-v3' as const,
			roundNumber: index + 1,
			stateVersion: 2,
			environmentEventIds: [],
			threatIntents: [],
			monsterActionIds: [],
			initiativeOrder: [actorId],
			actions: [
				{
					actorId,
					actorKind: 'master' as const,
					actionId: 'mission.hold',
					choiceSource: 'manual' as const,
					policyId: null,
					packetHash: null,
					legalActionHash: null,
					policyResultHash: null,
					publicIntent: 'Frozen prior portal round.',
					initiativeBase: 50,
					initiativeTieBreak: 0,
					initiative: 50,
					outcome: 'applied' as const,
					fromNodeId: 'moon-gate',
					toNodeId: 'moon-gate',
					targetId: null,
					discoveryIds: [],
					objectiveTransition: null,
					effectIds: [],
					summary: 'Frozen prior portal round.'
				}
			],
			monsterActions: [],
			effects: [],
			statusAfter: 'resolving' as const,
			portalWindow: {
				roundsRemainingBefore: before,
				roundsRemainingAfter: after,
				pressureBefore: stageBefore(before),
				pressureAfter: stage(after)
			},
			oreLedgerEntryIds: []
		};
	});
}

function manualChoice(actorId: string, actionId: string) {
	return {
		actorId,
		actionId,
		source: 'manual' as const,
		policyId: null,
		packetHash: null,
		legalActionHash: null,
		policyResultHash: null,
		publicIntent: `The Master chose ${actionId}.`
	};
}

function scriptedChoice(actorId: string, actionId: string) {
	return {
		actorId,
		actionId,
		source: 'scripted' as const,
		policyId: 'scripted-personality-v1',
		packetHash: sha256Hex(`${actorId}:${actionId}:packet`),
		legalActionHash: sha256Hex(`${actorId}:${actionId}:legal`),
		policyResultHash: sha256Hex(`${actorId}:${actionId}:result`),
		publicIntent: `The hero independently chose ${actionId}.`
	};
}

const FROZEN_V13_PRE_DEPLOY = EngineGameStateV13Schema.parse({
	schemaVersion: 13,
	runId: '3a335e8a-3655-4b04-8b04-955de71eb034',
	seed: 'task-9a-v13-seed',
	contentVersion: 'engine-v13',
	status: 'active',
	version: 1,
	eventCursor: 2,
	entropyCursor: 0,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'837ba031-ec72-449a-804b-5682a5cbb157': {
			heroId: '837ba031-ec72-449a-804b-5682a5cbb157',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '28852fbe164861d0df982918f095b1bdc79ed4d298f828a22ca88cc1f54dd3aa',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: 'c6576feb-ff0e-44b8-b627-1c0479ae75c0'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: 'cc428958-fea3-481f-99bd-8ccd363aa75a',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '8f2fb192-85cb-4dbc-abc8-510a1ed4cbcd',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '18f0057a-eacd-4779-8fad-6cd111d4922f',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'c6576feb-ff0e-44b8-b627-1c0479ae75c0': {
			itemId: 'c6576feb-ff0e-44b8-b627-1c0479ae75c0',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: '837ba031-ec72-449a-804b-5682a5cbb157',
			slot: 'main-hand',
			equippedById: '837ba031-ec72-449a-804b-5682a5cbb157',
			durability: 6,
			maxDurability: 6
		},
		'55026d1f-0972-41cb-a9a0-a8f65aab6591': {
			itemId: '55026d1f-0972-41cb-a9a0-a8f65aab6591',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: '837ba031-ec72-449a-804b-5682a5cbb157',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'7663cc27-2202-4efe-ba11-47629015aab2': {
				observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
				sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				observerHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['837ba031-ec72-449a-804b-5682a5cbb157', 'e58eb0a3-f79e-47db-a8e7-af511da840da']
			}
		},
		beliefs: {
			'aade8d8d-e0fd-43f4-a509-eea72e789763': {
				beliefId: 'aade8d8d-e0fd-43f4-a509-eea72e789763',
				holderHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: '837ba031-ec72-449a-804b-5682a5cbb157',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
					observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'e6809947-8002-4020-a517-92c830ed4094': {
				beliefId: 'e6809947-8002-4020-a517-92c830ed4094',
				holderHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
					observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'b7241acf-9b17-40e4-b764-f0e998b4fe29': {
				relationshipId: 'b7241acf-9b17-40e4-b764-f0e998b4fe29',
				fromHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				toEntityId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'f4a9a2d5-c4c9-4747-a253-d4dfa47867bc': {
				authorityId: 'f4a9a2d5-c4c9-4747-a253-d4dfa47867bc',
				observerHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
		},
		attemptCount: 1,
		attempt: {
			attemptId: 'cdd73c33-63f9-48b1-a3e9-4669fa3bd034',
			ordinal: 1,
			status: 'preparing',
			party: {
				masterId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				heroIds: ['837ba031-ec72-449a-804b-5682a5cbb157'],
				memberIds: ['e58eb0a3-f79e-47db-a8e7-af511da840da', '837ba031-ec72-449a-804b-5682a5cbb157']
			},
			entryNodeId: 'tower-threshold',
			extractionNodeId: 'tower-threshold',
			positions: {},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: []
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: null,
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v2',
				maximumRounds: 48,
				roundNumber: 0,
				objective: {
					objectiveId: 'recover-first-ember',
					status: 'available',
					carrierId: null,
					recoveredOnRound: null,
					deliveredOnRound: null
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {},
				partyGuard: {
					'e58eb0a3-f79e-47db-a8e7-af511da840da': {
						actorId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					},
					'837ba031-ec72-449a-804b-5682a5cbb157': {
						actorId: '837ba031-ec72-449a-804b-5682a5cbb157',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'absent',
					coolingControlNodeId: null,
					coolingControlExposed: false
				},
				currentThreatIntents: [],
				rounds: []
			}
		}
	}
});

const FROZEN_V14_FOUNDRY = EngineGameStateV14Schema.parse({
	schemaVersion: 14,
	runId: 'e4067b80-1d71-4ccb-afc1-0fa4ec59edde',
	seed: 'task-9a-v14-seed',
	contentVersion: 'engine-v14',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 2,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: 'd5b9319c-058f-4890-9625-9f6449bab6c4',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'af0a3d53-fd61-4a15-9211-eceefbe60080': {
			heroId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '8f878a925cc7b3709fcffef050d707479a7f00407331865642e43cbee7db3888',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: 'a5426bf1-a73b-4ce0-b62f-44dfabcd6924'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: '4b2e8c50-199d-42f5-9726-d24425bedc00',
				eventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '100908b0-5340-4e7c-af67-9fcdd54d8376',
				eventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '7d9a3e80-f6e3-4187-a0ac-2d79851a172b',
				eventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'a5426bf1-a73b-4ce0-b62f-44dfabcd6924': {
			itemId: 'a5426bf1-a73b-4ce0-b62f-44dfabcd6924',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
			slot: 'main-hand',
			equippedById: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
			durability: 6,
			maxDurability: 6
		},
		'05ffbc64-95e8-4b57-aa9e-134816115a42': {
			itemId: '05ffbc64-95e8-4b57-aa9e-134816115a42',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'9722a2da-aa26-409c-8aa9-0830a2885cc8': {
				observationId: '9722a2da-aa26-409c-8aa9-0830a2885cc8',
				sourceEventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
				observerHeroId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['af0a3d53-fd61-4a15-9211-eceefbe60080', 'd5b9319c-058f-4890-9625-9f6449bab6c4']
			}
		},
		beliefs: {
			'f7f27ec8-e7ce-41f0-8fc6-5ae4040d86e2': {
				beliefId: 'f7f27ec8-e7ce-41f0-8fc6-5ae4040d86e2',
				holderHeroId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
				subjectId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
					observationId: '9722a2da-aa26-409c-8aa9-0830a2885cc8',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'b051ac06-a259-4c94-8879-c4b0b4f8810e': {
				beliefId: 'b051ac06-a259-4c94-8879-c4b0b4f8810e',
				holderHeroId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
				subjectId: 'd5b9319c-058f-4890-9625-9f6449bab6c4',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
					observationId: '9722a2da-aa26-409c-8aa9-0830a2885cc8',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'a8c3ad1a-2047-4f37-aad1-776c7763c55b': {
				relationshipId: 'a8c3ad1a-2047-4f37-aad1-776c7763c55b',
				fromHeroId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
				toEntityId: 'd5b9319c-058f-4890-9625-9f6449bab6c4',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'35f1ce78-22ab-48b0-96e0-6929c9d9c727': {
				authorityId: '35f1ce78-22ab-48b0-96e0-6929c9d9c727',
				observerHeroId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
				subjectId: 'd5b9319c-058f-4890-9625-9f6449bab6c4',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'e06f3e99-e8cd-4bf9-a542-d173dd70e36d',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-05',
			contentVersion: 'tower-floor-05-v2',
			contentHash: '1ab958c71dcbabad6c29815aa46846124cdb552357f095f5ec428fa649523ad1'
		},
		availableMissionIds: ['tower-floor-05'],
		evidence: {},
		attemptCount: 1,
		attempt: {
			attemptId: '54ddf22a-ecca-4443-bac7-a90111c87dd4',
			ordinal: 1,
			status: 'deployed',
			party: {
				masterId: 'd5b9319c-058f-4890-9625-9f6449bab6c4',
				heroIds: ['af0a3d53-fd61-4a15-9211-eceefbe60080'],
				memberIds: ['d5b9319c-058f-4890-9625-9f6449bab6c4', 'af0a3d53-fd61-4a15-9211-eceefbe60080']
			},
			entryNodeId: 'tower-threshold',
			extractionNodeId: 'tower-threshold',
			positions: {
				'd5b9319c-058f-4890-9625-9f6449bab6c4': 'tower-threshold',
				'af0a3d53-fd61-4a15-9211-eceefbe60080': 'tower-threshold'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['tower-threshold']
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v2',
				maximumRounds: 48,
				roundNumber: 0,
				objective: {
					objectiveId: 'defeat-the-foundry-warden',
					status: 'available',
					carrierId: null,
					recoveredOnRound: null,
					deliveredOnRound: null
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {
					'84829ae7-09dd-4660-bd68-35b5f9dc19d5': {
						monsterId: '84829ae7-09dd-4660-bd68-35b5f9dc19d5',
						dutySlotId: 'forge-nave-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 01',
						ordinal: 1,
						nodeId: 'forge-nave',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'89accfe2-406e-44c9-883b-cd45ed71cfd2': {
						monsterId: '89accfe2-406e-44c9-883b-cd45ed71cfd2',
						dutySlotId: 'forge-nave-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 02',
						ordinal: 2,
						nodeId: 'forge-nave',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'fd6cd55d-5782-4c7f-a99f-3f2d6463fc30': {
						monsterId: 'fd6cd55d-5782-4c7f-a99f-3f2d6463fc30',
						dutySlotId: 'foundry-warden',
						policyId: 'foundry-warden-v1',
						label: 'Foundry Warden 01',
						ordinal: 1,
						nodeId: 'furnace-heart',
						status: 'active',
						vitality: 18,
						maximumVitality: 18,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					}
				},
				partyGuard: {
					'd5b9319c-058f-4890-9625-9f6449bab6c4': {
						actorId: 'd5b9319c-058f-4890-9625-9f6449bab6c4',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					},
					'af0a3d53-fd61-4a15-9211-eceefbe60080': {
						actorId: 'af0a3d53-fd61-4a15-9211-eceefbe60080',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'lit',
					coolingControlNodeId: 'cooling-control',
					coolingControlExposed: false
				},
				currentThreatIntents: [
					{
						monsterId: '84829ae7-09dd-4660-bd68-35b5f9dc19d5',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.84829ae7-09dd-4660-bd68-35b5f9dc19d5',
						kind: 'hold',
						fromNodeId: 'forge-nave',
						toNodeId: 'forge-nave',
						targetId: null,
						telegraph: 'Chain Watch 01 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: '89accfe2-406e-44c9-883b-cd45ed71cfd2',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.89accfe2-406e-44c9-883b-cd45ed71cfd2',
						kind: 'hold',
						fromNodeId: 'forge-nave',
						toNodeId: 'forge-nave',
						targetId: null,
						telegraph: 'Chain Watch 02 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: 'fd6cd55d-5782-4c7f-a99f-3f2d6463fc30',
						policyId: 'foundry-warden-v1',
						actionId: 'monster.hold.fd6cd55d-5782-4c7f-a99f-3f2d6463fc30',
						kind: 'hold',
						fromNodeId: 'furnace-heart',
						toNodeId: 'furnace-heart',
						targetId: null,
						telegraph: 'Foundry Warden 01 guards the living foundry.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					}
				],
				rounds: []
			}
		}
	}
});

const FROZEN_V16_AFTERMATH = EngineGameStateV16Schema.parse({
	schemaVersion: 16,
	runId: 'f21f7a0e-3f3d-43ec-8d07-ba6af9f86192',
	seed: 'task-9a-v16-seed',
	contentVersion: 'engine-v16',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 2,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: '8c33df51-50a5-4db9-a626-94a6250fe177',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'95847ff6-aa10-43c3-8410-448c2188539d': {
			heroId: '95847ff6-aa10-43c3-8410-448c2188539d',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '6e30c3eea2838e3fcd1d997bf3b2387eb426a96cdeeb91eb9f57c601f628e566',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: 'd7bf9d8f-c3ed-4f36-80ff-7c3c90d0f51f'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: 'ec944741-73d5-4454-9900-c5dcb862b230',
				eventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'a75f9dd6-467c-4d11-830f-947bbe17bbbd',
				eventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'f01f0bcf-c1b4-41bb-b327-9434751baeea',
				eventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'd7bf9d8f-c3ed-4f36-80ff-7c3c90d0f51f': {
			itemId: 'd7bf9d8f-c3ed-4f36-80ff-7c3c90d0f51f',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: '95847ff6-aa10-43c3-8410-448c2188539d',
			slot: 'main-hand',
			equippedById: '95847ff6-aa10-43c3-8410-448c2188539d',
			durability: 6,
			maxDurability: 6
		},
		'e3039f80-2bbc-4207-b993-930d0ce725b8': {
			itemId: 'e3039f80-2bbc-4207-b993-930d0ce725b8',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: '95847ff6-aa10-43c3-8410-448c2188539d',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'6afa9e84-51ac-4fbd-b9b5-e73fb925541d': {
				observationId: '6afa9e84-51ac-4fbd-b9b5-e73fb925541d',
				sourceEventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
				observerHeroId: '95847ff6-aa10-43c3-8410-448c2188539d',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['95847ff6-aa10-43c3-8410-448c2188539d', '8c33df51-50a5-4db9-a626-94a6250fe177']
			}
		},
		beliefs: {
			'f80129aa-a16d-46a1-9e70-391e61c2cb27': {
				beliefId: 'f80129aa-a16d-46a1-9e70-391e61c2cb27',
				holderHeroId: '95847ff6-aa10-43c3-8410-448c2188539d',
				subjectId: '95847ff6-aa10-43c3-8410-448c2188539d',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
					observationId: '6afa9e84-51ac-4fbd-b9b5-e73fb925541d',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'8a7587ec-a136-4c6a-91ea-fd27a5b3ba7b': {
				beliefId: '8a7587ec-a136-4c6a-91ea-fd27a5b3ba7b',
				holderHeroId: '95847ff6-aa10-43c3-8410-448c2188539d',
				subjectId: '8c33df51-50a5-4db9-a626-94a6250fe177',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
					observationId: '6afa9e84-51ac-4fbd-b9b5-e73fb925541d',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'd2eb7364-8914-4523-9e95-9eee2ce92b21': {
				relationshipId: 'd2eb7364-8914-4523-9e95-9eee2ce92b21',
				fromHeroId: '95847ff6-aa10-43c3-8410-448c2188539d',
				toEntityId: '8c33df51-50a5-4db9-a626-94a6250fe177',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'bae6eae7-bb11-40c2-92d7-9f1406dc79d9': {
				authorityId: 'bae6eae7-bb11-40c2-92d7-9f1406dc79d9',
				observerHeroId: '95847ff6-aa10-43c3-8410-448c2188539d',
				subjectId: '8c33df51-50a5-4db9-a626-94a6250fe177',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '29cb3e87-b863-4a39-b6a7-fcdf1b17a3f8',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
		},
		availableMissionIds: ['tower-floor-01'],
		evidence: {},
		aftermath: {
			aftermathVersion: 'mission-aftermath-v1',
			consequences: []
		},
		attemptCount: 1,
		attempt: {
			attemptId: '60a7938e-4a72-4b2e-a7bd-493a86d64f52',
			ordinal: 1,
			status: 'deployed',
			party: {
				masterId: '8c33df51-50a5-4db9-a626-94a6250fe177',
				heroIds: ['95847ff6-aa10-43c3-8410-448c2188539d'],
				memberIds: ['8c33df51-50a5-4db9-a626-94a6250fe177', '95847ff6-aa10-43c3-8410-448c2188539d']
			},
			entryNodeId: 'tower-threshold',
			extractionNodeId: 'tower-threshold',
			positions: {
				'8c33df51-50a5-4db9-a626-94a6250fe177': 'tower-threshold',
				'95847ff6-aa10-43c3-8410-448c2188539d': 'tower-threshold'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['tower-threshold']
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v2',
				maximumRounds: 48,
				roundNumber: 0,
				objective: {
					objectiveId: 'recover-first-ember',
					status: 'available',
					carrierId: null,
					recoveredOnRound: null,
					deliveredOnRound: null
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {
					'e1984f42-1dc3-4a6f-80db-9f51f727c280': {
						monsterId: 'e1984f42-1dc3-4a6f-80db-9f51f727c280',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 01',
						ordinal: 1,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'4882d5bb-be62-4b96-b322-9bee58b91ca8': {
						monsterId: '4882d5bb-be62-4b96-b322-9bee58b91ca8',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 02',
						ordinal: 2,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'36122973-e155-4895-abc0-fc3afbc80e42': {
						monsterId: '36122973-e155-4895-abc0-fc3afbc80e42',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 03',
						ordinal: 3,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'cd152c3c-841c-41ba-9ac7-435d75e494e2': {
						monsterId: 'cd152c3c-841c-41ba-9ac7-435d75e494e2',
						dutySlotId: 'goblin-ember-hauler',
						policyId: 'protect-ember-cradle-v1',
						label: 'Ember Hauler 01',
						ordinal: 1,
						nodeId: 'ember-vault',
						status: 'active',
						vitality: 1,
						maximumVitality: 1,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					}
				},
				partyGuard: {
					'8c33df51-50a5-4db9-a626-94a6250fe177': {
						actorId: '8c33df51-50a5-4db9-a626-94a6250fe177',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					},
					'95847ff6-aa10-43c3-8410-448c2188539d': {
						actorId: '95847ff6-aa10-43c3-8410-448c2188539d',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'absent',
					coolingControlNodeId: null,
					coolingControlExposed: false
				},
				currentThreatIntents: [
					{
						monsterId: '36122973-e155-4895-abc0-fc3afbc80e42',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.36122973-e155-4895-abc0-fc3afbc80e42',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 03 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: '4882d5bb-be62-4b96-b322-9bee58b91ca8',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.4882d5bb-be62-4b96-b322-9bee58b91ca8',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 02 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: 'cd152c3c-841c-41ba-9ac7-435d75e494e2',
						policyId: 'protect-ember-cradle-v1',
						actionId: 'monster.hold.cd152c3c-841c-41ba-9ac7-435d75e494e2',
						kind: 'hold',
						fromNodeId: 'ember-vault',
						toNodeId: 'ember-vault',
						targetId: null,
						telegraph: 'Ember Hauler 01 keeps both hands on the ember cradle.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: 'e1984f42-1dc3-4a6f-80db-9f51f727c280',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.e1984f42-1dc3-4a6f-80db-9f51f727c280',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 01 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					}
				],
				rounds: []
			}
		}
	}
});

const FROZEN_V17_MASTER_AFTERMATH = EngineGameStateV17Schema.parse({
	schemaVersion: 17,
	runId: '6badbed3-de1b-4b08-b619-2f50635e541a',
	seed: 'task-9a-v17-seed',
	contentVersion: 'engine-v17',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 2,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: 'a440073c-d468-43df-8f22-29d5b101b79f',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'48a9321c-a0de-40a0-9871-50f37a644735': {
			heroId: '48a9321c-a0de-40a0-9871-50f37a644735',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: 'c5811527fa6b8e8b4ee89c5c0f5cefadc23f7fd59f105256d540a6e1b062fe85',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: '0342b147-7e5f-48f8-afab-26bd12a78053'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: '6aa92560-f97d-4da6-b8e6-580194102dad',
				eventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '2fa6bead-6beb-4d84-bebc-d3add458295f',
				eventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '5a0cefcf-e34a-4a9e-a657-81de8ea3b317',
				eventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'0342b147-7e5f-48f8-afab-26bd12a78053': {
			itemId: '0342b147-7e5f-48f8-afab-26bd12a78053',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: '48a9321c-a0de-40a0-9871-50f37a644735',
			slot: 'main-hand',
			equippedById: '48a9321c-a0de-40a0-9871-50f37a644735',
			durability: 6,
			maxDurability: 6
		},
		'c4a730e9-de6c-433c-b9d6-e57e4ecf9fe4': {
			itemId: 'c4a730e9-de6c-433c-b9d6-e57e4ecf9fe4',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: '48a9321c-a0de-40a0-9871-50f37a644735',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'9f0ceb0c-66ec-4175-87fc-0670f4d04d86': {
				observationId: '9f0ceb0c-66ec-4175-87fc-0670f4d04d86',
				sourceEventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
				observerHeroId: '48a9321c-a0de-40a0-9871-50f37a644735',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['48a9321c-a0de-40a0-9871-50f37a644735', 'a440073c-d468-43df-8f22-29d5b101b79f']
			}
		},
		beliefs: {
			'70b38566-f92a-4f1c-bfef-ce7076fc22bd': {
				beliefId: '70b38566-f92a-4f1c-bfef-ce7076fc22bd',
				holderHeroId: '48a9321c-a0de-40a0-9871-50f37a644735',
				subjectId: '48a9321c-a0de-40a0-9871-50f37a644735',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
					observationId: '9f0ceb0c-66ec-4175-87fc-0670f4d04d86',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'c7e9bd45-aca0-4fc5-93b3-aff89da50a5e': {
				beliefId: 'c7e9bd45-aca0-4fc5-93b3-aff89da50a5e',
				holderHeroId: '48a9321c-a0de-40a0-9871-50f37a644735',
				subjectId: 'a440073c-d468-43df-8f22-29d5b101b79f',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
					observationId: '9f0ceb0c-66ec-4175-87fc-0670f4d04d86',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'34579f3d-507b-4ec1-9c12-1584e994a406': {
				relationshipId: '34579f3d-507b-4ec1-9c12-1584e994a406',
				fromHeroId: '48a9321c-a0de-40a0-9871-50f37a644735',
				toEntityId: 'a440073c-d468-43df-8f22-29d5b101b79f',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'71e38712-c958-4aae-a637-aaed011f8a59': {
				authorityId: '71e38712-c958-4aae-a637-aaed011f8a59',
				observerHeroId: '48a9321c-a0de-40a0-9871-50f37a644735',
				subjectId: 'a440073c-d468-43df-8f22-29d5b101b79f',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'dc286353-4e3a-4d38-a682-1e55e5489d44',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
		},
		availableMissionIds: ['tower-floor-01'],
		evidence: {},
		aftermath: {
			aftermathVersion: 'mission-aftermath-v2',
			consequences: []
		},
		attemptCount: 1,
		attempt: {
			attemptId: 'e47dd765-44cd-4412-844e-3cb46fdbe6c7',
			ordinal: 1,
			status: 'deployed',
			party: {
				masterId: 'a440073c-d468-43df-8f22-29d5b101b79f',
				heroIds: ['48a9321c-a0de-40a0-9871-50f37a644735'],
				memberIds: ['a440073c-d468-43df-8f22-29d5b101b79f', '48a9321c-a0de-40a0-9871-50f37a644735']
			},
			entryNodeId: 'tower-threshold',
			extractionNodeId: 'tower-threshold',
			positions: {
				'a440073c-d468-43df-8f22-29d5b101b79f': 'tower-threshold',
				'48a9321c-a0de-40a0-9871-50f37a644735': 'tower-threshold'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['tower-threshold']
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v2',
				maximumRounds: 48,
				roundNumber: 0,
				objective: {
					objectiveId: 'recover-first-ember',
					status: 'available',
					carrierId: null,
					recoveredOnRound: null,
					deliveredOnRound: null
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {
					'8fc96cb5-e6f7-48bd-b95c-f9e44726a216': {
						monsterId: '8fc96cb5-e6f7-48bd-b95c-f9e44726a216',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 01',
						ordinal: 1,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'ad0931fa-890d-4489-ab5d-33c430750ec3': {
						monsterId: 'ad0931fa-890d-4489-ab5d-33c430750ec3',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 02',
						ordinal: 2,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'013c0cd8-b46d-46a0-a002-4e60f67aea42': {
						monsterId: '013c0cd8-b46d-46a0-a002-4e60f67aea42',
						dutySlotId: 'goblin-ember-hauler',
						policyId: 'protect-ember-cradle-v1',
						label: 'Ember Hauler 01',
						ordinal: 1,
						nodeId: 'ember-vault',
						status: 'active',
						vitality: 1,
						maximumVitality: 1,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					}
				},
				partyGuard: {
					'a440073c-d468-43df-8f22-29d5b101b79f': {
						actorId: 'a440073c-d468-43df-8f22-29d5b101b79f',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					},
					'48a9321c-a0de-40a0-9871-50f37a644735': {
						actorId: '48a9321c-a0de-40a0-9871-50f37a644735',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'absent',
					coolingControlNodeId: null,
					coolingControlExposed: false
				},
				currentThreatIntents: [
					{
						monsterId: '013c0cd8-b46d-46a0-a002-4e60f67aea42',
						policyId: 'protect-ember-cradle-v1',
						actionId: 'monster.hold.013c0cd8-b46d-46a0-a002-4e60f67aea42',
						kind: 'hold',
						fromNodeId: 'ember-vault',
						toNodeId: 'ember-vault',
						targetId: null,
						telegraph: 'Ember Hauler 01 keeps both hands on the ember cradle.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: '8fc96cb5-e6f7-48bd-b95c-f9e44726a216',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.8fc96cb5-e6f7-48bd-b95c-f9e44726a216',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 01 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: 'ad0931fa-890d-4489-ab5d-33c430750ec3',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.ad0931fa-890d-4489-ab5d-33c430750ec3',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 02 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					}
				],
				rounds: []
			}
		}
	}
});

const FROZEN_V13_DEPLOYED = EngineGameStateV13Schema.parse({
	schemaVersion: 13,
	runId: '3a335e8a-3655-4b04-8b04-955de71eb034',
	seed: 'task-9a-v13-seed',
	contentVersion: 'engine-v13',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 2,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'837ba031-ec72-449a-804b-5682a5cbb157': {
			heroId: '837ba031-ec72-449a-804b-5682a5cbb157',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '28852fbe164861d0df982918f095b1bdc79ed4d298f828a22ca88cc1f54dd3aa',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: 'c6576feb-ff0e-44b8-b627-1c0479ae75c0'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: 'cc428958-fea3-481f-99bd-8ccd363aa75a',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '8f2fb192-85cb-4dbc-abc8-510a1ed4cbcd',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '18f0057a-eacd-4779-8fad-6cd111d4922f',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'c6576feb-ff0e-44b8-b627-1c0479ae75c0': {
			itemId: 'c6576feb-ff0e-44b8-b627-1c0479ae75c0',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: '837ba031-ec72-449a-804b-5682a5cbb157',
			slot: 'main-hand',
			equippedById: '837ba031-ec72-449a-804b-5682a5cbb157',
			durability: 6,
			maxDurability: 6
		},
		'55026d1f-0972-41cb-a9a0-a8f65aab6591': {
			itemId: '55026d1f-0972-41cb-a9a0-a8f65aab6591',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: '837ba031-ec72-449a-804b-5682a5cbb157',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'7663cc27-2202-4efe-ba11-47629015aab2': {
				observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
				sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				observerHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['837ba031-ec72-449a-804b-5682a5cbb157', 'e58eb0a3-f79e-47db-a8e7-af511da840da']
			}
		},
		beliefs: {
			'aade8d8d-e0fd-43f4-a509-eea72e789763': {
				beliefId: 'aade8d8d-e0fd-43f4-a509-eea72e789763',
				holderHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: '837ba031-ec72-449a-804b-5682a5cbb157',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
					observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'e6809947-8002-4020-a517-92c830ed4094': {
				beliefId: 'e6809947-8002-4020-a517-92c830ed4094',
				holderHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
					observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'b7241acf-9b17-40e4-b764-f0e998b4fe29': {
				relationshipId: 'b7241acf-9b17-40e4-b764-f0e998b4fe29',
				fromHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				toEntityId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'f4a9a2d5-c4c9-4747-a253-d4dfa47867bc': {
				authorityId: 'f4a9a2d5-c4c9-4747-a253-d4dfa47867bc',
				observerHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
		},
		attemptCount: 1,
		attempt: {
			attemptId: 'cdd73c33-63f9-48b1-a3e9-4669fa3bd034',
			ordinal: 1,
			status: 'deployed',
			party: {
				masterId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				heroIds: ['837ba031-ec72-449a-804b-5682a5cbb157'],
				memberIds: ['e58eb0a3-f79e-47db-a8e7-af511da840da', '837ba031-ec72-449a-804b-5682a5cbb157']
			},
			entryNodeId: 'tower-threshold',
			extractionNodeId: 'tower-threshold',
			positions: {
				'e58eb0a3-f79e-47db-a8e7-af511da840da': 'tower-threshold',
				'837ba031-ec72-449a-804b-5682a5cbb157': 'tower-threshold'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['tower-threshold']
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v2',
				maximumRounds: 48,
				roundNumber: 0,
				objective: {
					objectiveId: 'recover-first-ember',
					status: 'available',
					carrierId: null,
					recoveredOnRound: null,
					deliveredOnRound: null
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {
					'13db0ccf-741e-4a47-a1c8-2fe08e29a602': {
						monsterId: '13db0ccf-741e-4a47-a1c8-2fe08e29a602',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 01',
						ordinal: 1,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'feb2789a-ca07-4e29-93d6-2d9c23444759': {
						monsterId: 'feb2789a-ca07-4e29-93d6-2d9c23444759',
						dutySlotId: 'goblin-chain-watch',
						policyId: 'guard-chain-court-v1',
						label: 'Chain Watch 02',
						ordinal: 2,
						nodeId: 'chain-court',
						status: 'active',
						vitality: 2,
						maximumVitality: 2,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					},
					'7cb87c5c-a50a-48c7-a967-e165ad40c22c': {
						monsterId: '7cb87c5c-a50a-48c7-a967-e165ad40c22c',
						dutySlotId: 'goblin-ember-hauler',
						policyId: 'protect-ember-cradle-v1',
						label: 'Ember Hauler 01',
						ordinal: 1,
						nodeId: 'ember-vault',
						status: 'active',
						vitality: 1,
						maximumVitality: 1,
						alertState: 'duty',
						defeatedOnRound: null,
						lastActionId: null
					}
				},
				partyGuard: {
					'e58eb0a3-f79e-47db-a8e7-af511da840da': {
						actorId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					},
					'837ba031-ec72-449a-804b-5682a5cbb157': {
						actorId: '837ba031-ec72-449a-804b-5682a5cbb157',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'absent',
					coolingControlNodeId: null,
					coolingControlExposed: false
				},
				currentThreatIntents: [
					{
						monsterId: '13db0ccf-741e-4a47-a1c8-2fe08e29a602',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.13db0ccf-741e-4a47-a1c8-2fe08e29a602',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 01 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: '7cb87c5c-a50a-48c7-a967-e165ad40c22c',
						policyId: 'protect-ember-cradle-v1',
						actionId: 'monster.hold.7cb87c5c-a50a-48c7-a967-e165ad40c22c',
						kind: 'hold',
						fromNodeId: 'ember-vault',
						toNodeId: 'ember-vault',
						targetId: null,
						telegraph: 'Ember Hauler 01 keeps both hands on the ember cradle.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					},
					{
						monsterId: 'feb2789a-ca07-4e29-93d6-2d9c23444759',
						policyId: 'guard-chain-court-v1',
						actionId: 'monster.hold.feb2789a-ca07-4e29-93d6-2d9c23444759',
						kind: 'hold',
						fromNodeId: 'chain-court',
						toNodeId: 'chain-court',
						targetId: null,
						telegraph: 'Chain Watch 02 watches the Chain Court lanes.',
						anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
					}
				],
				rounds: []
			}
		}
	}
});

const FROZEN_V12_DEPLOYED = EngineGameStateV12Schema.parse({
	schemaVersion: 12,
	runId: '3a335e8a-3655-4b04-8b04-955de71eb034',
	seed: 'task-9a-v13-seed',
	contentVersion: 'engine-v12',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 0,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'837ba031-ec72-449a-804b-5682a5cbb157': {
			heroId: '837ba031-ec72-449a-804b-5682a5cbb157',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '28852fbe164861d0df982918f095b1bdc79ed4d298f828a22ca88cc1f54dd3aa',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: 'c6576feb-ff0e-44b8-b627-1c0479ae75c0'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: 'cc428958-fea3-481f-99bd-8ccd363aa75a',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '8f2fb192-85cb-4dbc-abc8-510a1ed4cbcd',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: '18f0057a-eacd-4779-8fad-6cd111d4922f',
				eventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'c6576feb-ff0e-44b8-b627-1c0479ae75c0': {
			itemId: 'c6576feb-ff0e-44b8-b627-1c0479ae75c0',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: '837ba031-ec72-449a-804b-5682a5cbb157',
			slot: 'main-hand',
			equippedById: '837ba031-ec72-449a-804b-5682a5cbb157',
			durability: 6,
			maxDurability: 6
		},
		'55026d1f-0972-41cb-a9a0-a8f65aab6591': {
			itemId: '55026d1f-0972-41cb-a9a0-a8f65aab6591',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: '837ba031-ec72-449a-804b-5682a5cbb157',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'7663cc27-2202-4efe-ba11-47629015aab2': {
				observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
				sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				observerHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['837ba031-ec72-449a-804b-5682a5cbb157', 'e58eb0a3-f79e-47db-a8e7-af511da840da']
			}
		},
		beliefs: {
			'aade8d8d-e0fd-43f4-a509-eea72e789763': {
				beliefId: 'aade8d8d-e0fd-43f4-a509-eea72e789763',
				holderHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: '837ba031-ec72-449a-804b-5682a5cbb157',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
					observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'e6809947-8002-4020-a517-92c830ed4094': {
				beliefId: 'e6809947-8002-4020-a517-92c830ed4094',
				holderHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
					observationId: '7663cc27-2202-4efe-ba11-47629015aab2',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'b7241acf-9b17-40e4-b764-f0e998b4fe29': {
				relationshipId: 'b7241acf-9b17-40e4-b764-f0e998b4fe29',
				fromHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				toEntityId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'f4a9a2d5-c4c9-4747-a253-d4dfa47867bc': {
				authorityId: 'f4a9a2d5-c4c9-4747-a253-d4dfa47867bc',
				observerHeroId: '837ba031-ec72-449a-804b-5682a5cbb157',
				subjectId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: '731c6f2c-969d-48e9-beaf-a0d2f70baedd',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'tower-floor-01',
			contentVersion: 'tower-floor-01-v1',
			contentHash: '31f756076a3e67ad9023108400464e9a0ab9995637266b1b9f41c802d3a48b02'
		},
		attemptCount: 1,
		attempt: {
			attemptId: '3f443f7b-bd58-4ecc-9802-edb411bf121a',
			ordinal: 1,
			status: 'deployed',
			party: {
				masterId: 'e58eb0a3-f79e-47db-a8e7-af511da840da',
				heroIds: ['837ba031-ec72-449a-804b-5682a5cbb157'],
				memberIds: ['e58eb0a3-f79e-47db-a8e7-af511da840da', '837ba031-ec72-449a-804b-5682a5cbb157']
			},
			entryNodeId: 'tower-threshold',
			extractionNodeId: 'tower-threshold',
			positions: {
				'e58eb0a3-f79e-47db-a8e7-af511da840da': 'tower-threshold',
				'837ba031-ec72-449a-804b-5682a5cbb157': 'tower-threshold'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['tower-threshold']
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v1',
				maximumRounds: 48,
				roundNumber: 0,
				objective: {
					objectiveId: 'recover-first-ember',
					status: 'available',
					carrierId: null,
					recoveredOnRound: null,
					deliveredOnRound: null
				},
				rounds: []
			}
		}
	}
});

const FROZEN_V15_DEPLOYED = EngineGameStateV15Schema.parse({
	schemaVersion: 15,
	runId: '9f0a6cbe-812d-4c89-8936-9cd494c6f618',
	seed: 'task-9a-portal-seed',
	contentVersion: 'engine-v15',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 0,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'babbe78f-9c95-4b38-a124-8e0436451f47': {
			heroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '4bfb3b84791311a0ef77dba945215c46b6210cc6a5097b293085c4fc8c07c655',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: '4a18f19a-ca49-4f3c-b83e-ce4ba98b866e'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: '00076666-f2ef-49dc-93b2-09f1234b353d',
				eventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'a627b493-a7c4-4af3-9200-dea3cd9f13e4',
				eventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'c0c9c48b-71c6-4602-a6b2-9eb3e9e043cb',
				eventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'4a18f19a-ca49-4f3c-b83e-ce4ba98b866e': {
			itemId: '4a18f19a-ca49-4f3c-b83e-ce4ba98b866e',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			slot: 'main-hand',
			equippedById: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			durability: 6,
			maxDurability: 6
		},
		'9fa19b27-e4c2-4400-8334-1a56e2f16283': {
			itemId: '9fa19b27-e4c2-4400-8334-1a56e2f16283',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde': {
				observationId: '5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde',
				sourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				observerHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['babbe78f-9c95-4b38-a124-8e0436451f47', '0e624f8b-2a25-444f-86af-cfe9d5e39cc8']
			}
		},
		beliefs: {
			'a20c6774-be35-4067-bb5c-5a0ab6541c42': {
				beliefId: 'a20c6774-be35-4067-bb5c-5a0ab6541c42',
				holderHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				subjectId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
					observationId: '5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'9c1e9806-7ebc-41a4-acf9-a4c1bb99dd3c': {
				beliefId: '9c1e9806-7ebc-41a4-acf9-a4c1bb99dd3c',
				holderHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				subjectId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
					observationId: '5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'14a775a8-cbab-4109-ac86-2e21bd62b03f': {
				relationshipId: '14a775a8-cbab-4109-ac86-2e21bd62b03f',
				fromHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				toEntityId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'fe9de416-d04b-4bfb-b73b-5f6c277c1a51': {
				authorityId: 'fe9de416-d04b-4bfb-b73b-5f6c277c1a51',
				observerHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				subjectId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'iron-moon',
			contentVersion: 'iron-moon-v1',
			contentHash: 'f364cdcd75324848e4ef91fcf3d8b75103a01b897da148b8c977dc24ac710b35'
		},
		availableMissionIds: ['iron-moon'],
		evidence: {},
		attemptCount: 1,
		attempt: {
			attemptId: '564f0c4e-dad5-4478-a733-01d9d0a8f2e0',
			ordinal: 1,
			status: 'deployed',
			party: {
				masterId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				heroIds: [],
				memberIds: ['0e624f8b-2a25-444f-86af-cfe9d5e39cc8']
			},
			entryNodeId: 'moon-gate',
			extractionNodeId: 'moon-gate',
			positions: {
				'0e624f8b-2a25-444f-86af-cfe9d5e39cc8': 'moon-gate'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['moon-gate']
			},
			completedObjectiveIds: [],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: null,
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v3',
				maximumRounds: 8,
				roundNumber: 0,
				objective: {
					objectiveId: 'extract-iron-ore',
					status: 'available',
					quota: 4,
					minedAmount: 0,
					quotaReachedOnRound: null,
					deliveredOnRound: null
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {},
				partyGuard: {
					'0e624f8b-2a25-444f-86af-cfe9d5e39cc8': {
						actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'absent',
					coolingControlNodeId: null,
					coolingControlExposed: false
				},
				currentThreatIntents: [],
				portal: {
					portalVersion: 'portal-runtime-v1',
					portalId: 'iron-moon-scar',
					durationRounds: 8,
					roundsRemaining: 8,
					warningAtRemainingRounds: 4,
					criticalAtRemainingRounds: 2,
					pressureStage: 'stable',
					extractionQuota: 4,
					cargoCapacityPerActor: 4,
					deposits: {
						'pale-vein-deposit': {
							depositId: 'pale-vein-deposit',
							nodeId: 'pale-vein',
							resource: 'iron-ore',
							initialAmount: 2,
							remainingAmount: 2,
							mineAmountPerAction: 1
						},
						'crater-heart-deposit': {
							depositId: 'crater-heart-deposit',
							nodeId: 'crater-heart',
							resource: 'iron-ore',
							initialAmount: 4,
							remainingAmount: 4,
							mineAmountPerAction: 2
						},
						'buried-seam-deposit': {
							depositId: 'buried-seam-deposit',
							nodeId: 'buried-seam',
							resource: 'iron-ore',
							initialAmount: 6,
							remainingAmount: 6,
							mineAmountPerAction: 2
						}
					},
					cargo: {
						'0e624f8b-2a25-444f-86af-cfe9d5e39cc8': {
							actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							resource: 'iron-ore',
							amount: 0,
							capacity: 4
						}
					},
					oreLedger: [],
					extractedAmount: 0,
					extractionCredited: false
				},
				rounds: []
			}
		}
	}
});

const FROZEN_V15_EXTRACTION = EngineGameStateV15Schema.parse({
	schemaVersion: 15,
	runId: '9f0a6cbe-812d-4c89-8936-9cd494c6f618',
	seed: 'task-9a-portal-seed',
	contentVersion: 'engine-v15',
	status: 'active',
	version: 2,
	eventCursor: 3,
	entropyCursor: 12,
	simulatedAt: '2000-01-01T00:00:00.000Z',
	master: {
		masterId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
		lifeState: 'alive',
		location: 'summoning-gate',
		health: 100,
		maxHealth: 100,
		injuries: [],
		gateInspectionCount: 0,
		lastGateResonance: null
	},
	heroes: {
		'babbe78f-9c95-4b38-a124-8e0436451f47': {
			heroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			lifeState: 'active',
			location: 'summoning-gate',
			destination: null,
			health: 100,
			maxHealth: 100,
			manifestHash: '4bfb3b84791311a0ef77dba945215c46b6210cc6a5097b293085c4fc8c07c655',
			needs: {
				hunger: 20,
				fatigue: 15
			},
			injuries: [],
			progression: {
				stars: 1,
				level: 1,
				experience: 0,
				skills: {
					swordFighting: {
						rank: 0,
						experience: 0
					}
				}
			},
			equipment: {
				mainHand: '4a18f19a-ca49-4f3c-b83e-ce4ba98b866e'
			},
			currentActivity: null,
			locationNodeId: 'gate-dais',
			firstArrivalCompleted: false,
			currentTravel: null,
			assignment: null,
			mind: {
				personality: {
					openness: 55,
					conscientiousness: 60,
					extraversion: 45,
					agreeableness: 50,
					emotionalVolatility: 40
				},
				primaryValue: 'duty',
				primaryDrive: 'survive',
				socialStyle: 'reserved',
				stressResponse: 'prepare',
				dailyHabit: 'checks-exits',
				aptitudes: {
					might: 5,
					finesse: 5,
					insight: 5,
					resolve: 5
				}
			},
			habit: {
				habit: 'checks-exits',
				strength: 68,
				repetitions: 0,
				satisfaction: 50,
				lastTriggeredAt: null
			},
			dailyPlan: null,
			currentRoutine: null
		}
	},
	settlement: {
		resources: {
			food: 3,
			'iron-ore': 2,
			'ember-shard': 0
		},
		resourceLedger: [
			{
				entryId: '00076666-f2ef-49dc-93b2-09f1234b353d',
				eventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				resource: 'food',
				before: 0,
				after: 3,
				delta: 3,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'a627b493-a7c4-4af3-9200-dea3cd9f13e4',
				eventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				resource: 'iron-ore',
				before: 0,
				after: 2,
				delta: 2,
				reason: 'run bootstrap stock'
			},
			{
				entryId: 'c0c9c48b-71c6-4602-a6b2-9eb3e9e043cb',
				eventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				resource: 'ember-shard',
				before: 0,
				after: 0,
				delta: 0,
				reason: 'run bootstrap stock'
			}
		],
		navigation: {
			settlementId: 'hearth-01',
			contentVersion: 'hearth-01-v1',
			contentHash: '83e2d404fa3e119bc02ff6ff1f82896ea8ffb10a2661f8c7b0e858a35eeb89b9',
			activeSystemIds: ['dormitory-system', 'gate-system', 'hearth-system', 'training-system']
		},
		poweredBuildingId: null,
		buildings: {
			'summoning-gate': {
				buildingId: 'summoning-gate',
				systemId: 'gate-system',
				assignmentNodeId: 'gate-rail',
				assignmentRole: 'gate-attendant',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			kitchen: {
				buildingId: 'kitchen',
				systemId: 'hearth-system',
				assignmentNodeId: 'kitchen-hearth',
				assignmentRole: 'cook',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			dormitory: {
				buildingId: 'dormitory',
				systemId: 'dormitory-system',
				assignmentNodeId: 'dormitory-bunks',
				assignmentRole: 'resident',
				assignmentCapacity: 6,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			'training-ground': {
				buildingId: 'training-ground',
				systemId: 'training-system',
				assignmentNodeId: 'training-ring',
				assignmentRole: 'trainee',
				assignmentCapacity: 8,
				assignedHeroIds: [],
				baselinePowerState: 'reserve',
				powerState: 'reserve'
			},
			workshop: {
				buildingId: 'workshop',
				systemId: 'forge-system',
				assignmentNodeId: 'workshop-bench',
				assignmentRole: 'artisan',
				assignmentCapacity: 3,
				assignedHeroIds: [],
				baselinePowerState: 'unpowered',
				powerState: 'unpowered'
			}
		},
		firstEmber: {
			coreId: 'first-ember-core',
			status: 'unrecovered',
			recoveredFrom: null,
			recoveredAt: null,
			committedAt: null,
			buildingId: null,
			rationale: null,
			modifiers: [],
			reactions: []
		}
	},
	items: {
		'4a18f19a-ca49-4f3c-b83e-ce4ba98b866e': {
			itemId: '4a18f19a-ca49-4f3c-b83e-ce4ba98b866e',
			templateId: 'practice-blade',
			displayName: 'Gatehouse Practice Blade',
			ownerId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			slot: 'main-hand',
			equippedById: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			durability: 6,
			maxDurability: 6
		},
		'9fa19b27-e4c2-4400-8334-1a56e2f16283': {
			itemId: '9fa19b27-e4c2-4400-8334-1a56e2f16283',
			templateId: 'short-bow',
			displayName: 'Ash Short Bow',
			ownerId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
			slot: 'main-hand',
			equippedById: null,
			durability: 4,
			maxDurability: 4
		}
	},
	story: {
		envelopeId: 'first-ember-v1',
		branch: null
	},
	society: {
		contentVersion: 'society-v4',
		observations: {
			'5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde': {
				observationId: '5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde',
				sourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				observerHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				observedAt: '2000-01-01T00:00:00.000Z',
				kind: 'awakening',
				summary: 'I awakened at the summoning gate beside an unfamiliar adult.',
				subjectIds: ['babbe78f-9c95-4b38-a124-8e0436451f47', '0e624f8b-2a25-444f-86af-cfe9d5e39cc8']
			}
		},
		beliefs: {
			'a20c6774-be35-4067-bb5c-5a0ab6541c42': {
				beliefId: 'a20c6774-be35-4067-bb5c-5a0ab6541c42',
				holderHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				subjectId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				predicate: 'awakened-at',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'experienced',
					sourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
					observationId: '5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde',
					learnedFromId: null,
					chainDepth: 0
				}
			},
			'9c1e9806-7ebc-41a4-acf9-a4c1bb99dd3c': {
				beliefId: '9c1e9806-7ebc-41a4-acf9-a4c1bb99dd3c',
				holderHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				subjectId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				predicate: 'present-at-awakening',
				object: {
					kind: 'location',
					locationId: 'summoning-gate'
				},
				confidence: 100,
				status: 'held',
				learnedAt: '2000-01-01T00:00:00.000Z',
				provenance: {
					kind: 'observed',
					sourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
					observationId: '5b5f8e24-dc47-48e4-bcbc-0fa6eb93fcde',
					learnedFromId: null,
					chainDepth: 0
				}
			}
		},
		relationships: {
			'14a775a8-cbab-4109-ac86-2e21bd62b03f': {
				relationshipId: '14a775a8-cbab-4109-ac86-2e21bd62b03f',
				fromHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				toEntityId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				dimensions: {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				evidence: []
			}
		},
		promises: {},
		authority: {
			'fe9de416-d04b-4bfb-b73b-5f6c277c1a51': {
				authorityId: 'fe9de416-d04b-4bfb-b73b-5f6c277c1a51',
				observerHeroId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
				subjectId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				dimensions: {
					competence: 0,
					provision: 0,
					trust: 0,
					legitimacy: 0,
					fear: 0,
					strength: 0,
					consistency: 0
				},
				updatedAt: '2000-01-01T00:00:00.000Z',
				lastSourceEventId: 'da6b92b5-8628-4702-8754-7237a46a0e9b',
				evidence: []
			}
		},
		communicativeActs: {},
		conversationTurns: {},
		directives: {},
		directiveInfluences: {}
	},
	mission: {
		binding: {
			missionId: 'iron-moon',
			contentVersion: 'iron-moon-v1',
			contentHash: 'f364cdcd75324848e4ef91fcf3d8b75103a01b897da148b8c977dc24ac710b35'
		},
		availableMissionIds: ['iron-moon'],
		evidence: {},
		attemptCount: 1,
		attempt: {
			attemptId: '564f0c4e-dad5-4478-a733-01d9d0a8f2e0',
			ordinal: 1,
			status: 'extraction',
			party: {
				masterId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
				heroIds: ['babbe78f-9c95-4b38-a124-8e0436451f47'],
				memberIds: ['0e624f8b-2a25-444f-86af-cfe9d5e39cc8', 'babbe78f-9c95-4b38-a124-8e0436451f47']
			},
			entryNodeId: 'moon-gate',
			extractionNodeId: 'moon-gate',
			positions: {
				'0e624f8b-2a25-444f-86af-cfe9d5e39cc8': 'moon-gate',
				'babbe78f-9c95-4b38-a124-8e0436451f47': 'moon-gate'
			},
			knowledge: {
				discoveryIds: [],
				visitedNodeIds: ['crater-heart', 'moon-gate', 'pale-vein', 'windward-shelf']
			},
			completedObjectiveIds: ['extract-iron-ore'],
			preparedAt: '2000-01-01T00:00:00.000Z',
			deployedAt: '2000-01-01T00:00:00.000Z',
			extractionOpenedAt: '2000-01-01T00:00:00.000Z',
			endedAt: null,
			outcome: null,
			turnState: {
				turnVersion: 'mission-turn-v3',
				maximumRounds: 8,
				roundNumber: 6,
				objective: {
					objectiveId: 'extract-iron-ore',
					status: 'delivered',
					quota: 4,
					minedAmount: 6,
					quotaReachedOnRound: 4,
					deliveredOnRound: 6
				},
				policyBinding: {
					contentVersion: 'monster-policies-v1',
					contentHash: '5c1705e15afa8bd59d7a9cc545769044b47abd9d690eab27f3c6c2d361ee99c7'
				},
				monsters: {},
				partyGuard: {
					'0e624f8b-2a25-444f-86af-cfe9d5e39cc8': {
						actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					},
					'babbe78f-9c95-4b38-a124-8e0436451f47': {
						actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
						guard: 3,
						maximumGuard: 3,
						status: 'ready',
						lastChangedOnRound: 0
					}
				},
				arena: {
					furnaceState: 'absent',
					coolingControlNodeId: null,
					coolingControlExposed: false
				},
				currentThreatIntents: [],
				portal: {
					portalVersion: 'portal-runtime-v1',
					portalId: 'iron-moon-scar',
					durationRounds: 8,
					roundsRemaining: 2,
					warningAtRemainingRounds: 4,
					criticalAtRemainingRounds: 2,
					pressureStage: 'critical',
					extractionQuota: 4,
					cargoCapacityPerActor: 4,
					deposits: {
						'pale-vein-deposit': {
							depositId: 'pale-vein-deposit',
							nodeId: 'pale-vein',
							resource: 'iron-ore',
							initialAmount: 2,
							remainingAmount: 0,
							mineAmountPerAction: 1
						},
						'crater-heart-deposit': {
							depositId: 'crater-heart-deposit',
							nodeId: 'crater-heart',
							resource: 'iron-ore',
							initialAmount: 4,
							remainingAmount: 0,
							mineAmountPerAction: 2
						},
						'buried-seam-deposit': {
							depositId: 'buried-seam-deposit',
							nodeId: 'buried-seam',
							resource: 'iron-ore',
							initialAmount: 6,
							remainingAmount: 6,
							mineAmountPerAction: 2
						}
					},
					cargo: {
						'0e624f8b-2a25-444f-86af-cfe9d5e39cc8': {
							actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							resource: 'iron-ore',
							amount: 2,
							capacity: 4
						},
						'babbe78f-9c95-4b38-a124-8e0436451f47': {
							actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
							resource: 'iron-ore',
							amount: 4,
							capacity: 4
						}
					},
					oreLedger: [
						{
							entryId: 'de69ceee-9468-46a2-b830-59e4c24902d4',
							sequence: 1,
							roundNumber: 3,
							kind: 'mined',
							actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							depositId: 'pale-vein-deposit',
							nodeId: 'pale-vein',
							amount: 1,
							cargoBefore: 0,
							cargoAfter: 1,
							depositBefore: 2,
							depositAfter: 1,
							settlementBefore: null,
							settlementAfter: null
						},
						{
							entryId: 'e6baff10-77bd-4b33-9c67-573bde30c1e6',
							sequence: 2,
							roundNumber: 3,
							kind: 'mined',
							actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
							depositId: 'crater-heart-deposit',
							nodeId: 'crater-heart',
							amount: 2,
							cargoBefore: 0,
							cargoAfter: 2,
							depositBefore: 4,
							depositAfter: 2,
							settlementBefore: null,
							settlementAfter: null
						},
						{
							entryId: 'd8ae1aa0-89a1-4a74-a49e-67b66d51d609',
							sequence: 3,
							roundNumber: 4,
							kind: 'mined',
							actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							depositId: 'pale-vein-deposit',
							nodeId: 'pale-vein',
							amount: 1,
							cargoBefore: 1,
							cargoAfter: 2,
							depositBefore: 1,
							depositAfter: 0,
							settlementBefore: null,
							settlementAfter: null
						},
						{
							entryId: 'f0b35de5-ce7d-4dd2-9307-cb1883523f87',
							sequence: 4,
							roundNumber: 4,
							kind: 'mined',
							actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
							depositId: 'crater-heart-deposit',
							nodeId: 'crater-heart',
							amount: 2,
							cargoBefore: 2,
							cargoAfter: 4,
							depositBefore: 2,
							depositAfter: 0,
							settlementBefore: null,
							settlementAfter: null
						}
					],
					extractedAmount: 0,
					extractionCredited: false
				},
				rounds: [
					{
						roundVersion: 'mission-round-v3',
						roundNumber: 1,
						stateVersion: 2,
						environmentEventIds: [],
						threatIntents: [],
						monsterActionIds: [],
						initiativeOrder: [
							'0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							'babbe78f-9c95-4b38-a124-8e0436451f47'
						],
						actions: [
							{
								actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
								actorKind: 'master',
								actionId: 'mission.move.gate-to-shelf',
								choiceSource: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose mission.move.gate-to-shelf.',
								initiativeBase: 50,
								initiativeTieBreak: 81,
								initiative: 131,
								outcome: 'applied',
								fromNodeId: 'moon-gate',
								toNodeId: 'windward-shelf',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from moon-gate to windward-shelf with 0 ore in cargo.'
							},
							{
								actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
								actorKind: 'hero',
								actionId: 'mission.move.gate-to-shelf',
								choiceSource: 'scripted',
								policyId: 'scripted-personality-v1',
								packetHash: 'd7fe942ba032865b8708f5966020e66c3f14b03a718620fba419a6be155e00e6',
								legalActionHash: 'c0c5198dfd0050db773e7b93f931967d351ddbe04d69f9828cf30bf008d5b5c4',
								policyResultHash:
									'f6deb4718ac6c5902944670acbc2ec6fdeabcb69c76a2a0576a4b0e9f3aa30b4',
								publicIntent: 'The hero independently chose mission.move.gate-to-shelf.',
								initiativeBase: 61,
								initiativeTieBreak: 9,
								initiative: 70,
								outcome: 'applied',
								fromNodeId: 'moon-gate',
								toNodeId: 'windward-shelf',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from moon-gate to windward-shelf with 0 ore in cargo.'
							}
						],
						monsterActions: [],
						effects: [],
						statusAfter: 'resolving',
						portalWindow: {
							roundsRemainingBefore: 8,
							roundsRemainingAfter: 7,
							pressureBefore: 'stable',
							pressureAfter: 'stable'
						},
						oreLedgerEntryIds: []
					},
					{
						roundVersion: 'mission-round-v3',
						roundNumber: 2,
						stateVersion: 2,
						environmentEventIds: ['iron-wind-shear'],
						threatIntents: [],
						monsterActionIds: [],
						initiativeOrder: [
							'0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							'babbe78f-9c95-4b38-a124-8e0436451f47'
						],
						actions: [
							{
								actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
								actorKind: 'master',
								actionId: 'mission.move.shelf-to-pale-vein',
								choiceSource: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose mission.move.shelf-to-pale-vein.',
								initiativeBase: 50,
								initiativeTieBreak: 86,
								initiative: 136,
								outcome: 'applied',
								fromNodeId: 'windward-shelf',
								toNodeId: 'pale-vein',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from windward-shelf to pale-vein with 0 ore in cargo.'
							},
							{
								actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
								actorKind: 'hero',
								actionId: 'mission.move.shelf-to-crater-heart',
								choiceSource: 'scripted',
								policyId: 'scripted-personality-v1',
								packetHash: '72d2daa822551601befc3110b8f786e65e73e5813f488c42d39043b3cea93a28',
								legalActionHash: '8e4d6ed7bbc82b3ead7c0758e6980a8394bc540e194b159f426499084ef368ff',
								policyResultHash:
									'278598d379461670b80ccce6c98e1abd0b2f7c236cb7814c43f70a78a603ce65',
								publicIntent: 'The hero independently chose mission.move.shelf-to-crater-heart.',
								initiativeBase: 61,
								initiativeTieBreak: 32,
								initiative: 93,
								outcome: 'applied',
								fromNodeId: 'windward-shelf',
								toNodeId: 'crater-heart',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from windward-shelf to crater-heart with 0 ore in cargo.'
							}
						],
						monsterActions: [],
						effects: [],
						statusAfter: 'resolving',
						portalWindow: {
							roundsRemainingBefore: 7,
							roundsRemainingAfter: 6,
							pressureBefore: 'stable',
							pressureAfter: 'stable'
						},
						oreLedgerEntryIds: []
					},
					{
						roundVersion: 'mission-round-v3',
						roundNumber: 3,
						stateVersion: 2,
						environmentEventIds: [],
						threatIntents: [],
						monsterActionIds: [],
						initiativeOrder: [
							'0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							'babbe78f-9c95-4b38-a124-8e0436451f47'
						],
						actions: [
							{
								actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
								actorKind: 'master',
								actionId: 'mission.mine.pale-vein-deposit',
								choiceSource: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose mission.mine.pale-vein-deposit.',
								initiativeBase: 50,
								initiativeTieBreak: 58,
								initiative: 108,
								outcome: 'applied',
								fromNodeId: 'pale-vein',
								toNodeId: 'pale-vein',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Mined 1 iron ore from pale-vein-deposit; cargo is 1/4.'
							},
							{
								actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
								actorKind: 'hero',
								actionId: 'mission.mine.crater-heart-deposit',
								choiceSource: 'scripted',
								policyId: 'scripted-personality-v1',
								packetHash: 'd210ea26fd1840fbb713ed8f0c82b8842144394f51aed0ff244f792c4e13833b',
								legalActionHash: '9a7f9b974a7766e2e55c1435aab1ede978a22971629af34930d4cb063e2b2743',
								policyResultHash:
									'44b31df928ceb9f93f23956a44d0a32f87a33e5ee8a67073722ab16e2b860ea7',
								publicIntent: 'The hero independently chose mission.mine.crater-heart-deposit.',
								initiativeBase: 61,
								initiativeTieBreak: 18,
								initiative: 79,
								outcome: 'applied',
								fromNodeId: 'crater-heart',
								toNodeId: 'crater-heart',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Mined 2 iron ore from crater-heart-deposit; cargo is 2/4.'
							}
						],
						monsterActions: [],
						effects: [],
						statusAfter: 'resolving',
						portalWindow: {
							roundsRemainingBefore: 6,
							roundsRemainingAfter: 5,
							pressureBefore: 'stable',
							pressureAfter: 'stable'
						},
						oreLedgerEntryIds: [
							'de69ceee-9468-46a2-b830-59e4c24902d4',
							'e6baff10-77bd-4b33-9c67-573bde30c1e6'
						]
					},
					{
						roundVersion: 'mission-round-v3',
						roundNumber: 4,
						stateVersion: 2,
						environmentEventIds: ['iron-wind-shear'],
						threatIntents: [],
						monsterActionIds: [],
						initiativeOrder: [
							'0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							'babbe78f-9c95-4b38-a124-8e0436451f47'
						],
						actions: [
							{
								actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
								actorKind: 'master',
								actionId: 'mission.mine.pale-vein-deposit',
								choiceSource: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose mission.mine.pale-vein-deposit.',
								initiativeBase: 50,
								initiativeTieBreak: 26,
								initiative: 76,
								outcome: 'applied',
								fromNodeId: 'pale-vein',
								toNodeId: 'pale-vein',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: 'recovered',
								effectIds: [],
								summary: 'Mined 1 iron ore from pale-vein-deposit; cargo is 2/4.'
							},
							{
								actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
								actorKind: 'hero',
								actionId: 'mission.mine.crater-heart-deposit',
								choiceSource: 'scripted',
								policyId: 'scripted-personality-v1',
								packetHash: 'd210ea26fd1840fbb713ed8f0c82b8842144394f51aed0ff244f792c4e13833b',
								legalActionHash: '9a7f9b974a7766e2e55c1435aab1ede978a22971629af34930d4cb063e2b2743',
								policyResultHash:
									'44b31df928ceb9f93f23956a44d0a32f87a33e5ee8a67073722ab16e2b860ea7',
								publicIntent: 'The hero independently chose mission.mine.crater-heart-deposit.',
								initiativeBase: 61,
								initiativeTieBreak: 0,
								initiative: 61,
								outcome: 'applied',
								fromNodeId: 'crater-heart',
								toNodeId: 'crater-heart',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Mined 2 iron ore from crater-heart-deposit; cargo is 4/4.'
							}
						],
						monsterActions: [],
						effects: [],
						statusAfter: 'resolving',
						portalWindow: {
							roundsRemainingBefore: 5,
							roundsRemainingAfter: 4,
							pressureBefore: 'stable',
							pressureAfter: 'warning'
						},
						oreLedgerEntryIds: [
							'd8ae1aa0-89a1-4a74-a49e-67b66d51d609',
							'f0b35de5-ce7d-4dd2-9307-cb1883523f87'
						]
					},
					{
						roundVersion: 'mission-round-v3',
						roundNumber: 5,
						stateVersion: 2,
						environmentEventIds: [],
						threatIntents: [],
						monsterActionIds: [],
						initiativeOrder: [
							'0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
							'babbe78f-9c95-4b38-a124-8e0436451f47'
						],
						actions: [
							{
								actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
								actorKind: 'master',
								actionId: 'mission.move.shelf-to-pale-vein',
								choiceSource: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose mission.move.shelf-to-pale-vein.',
								initiativeBase: 50,
								initiativeTieBreak: 58,
								initiative: 108,
								outcome: 'applied',
								fromNodeId: 'pale-vein',
								toNodeId: 'windward-shelf',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from pale-vein to windward-shelf with 2 ore in cargo.'
							},
							{
								actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
								actorKind: 'hero',
								actionId: 'mission.move.shelf-to-crater-heart',
								choiceSource: 'scripted',
								policyId: 'scripted-personality-v1',
								packetHash: '72d2daa822551601befc3110b8f786e65e73e5813f488c42d39043b3cea93a28',
								legalActionHash: '8e4d6ed7bbc82b3ead7c0758e6980a8394bc540e194b159f426499084ef368ff',
								policyResultHash:
									'278598d379461670b80ccce6c98e1abd0b2f7c236cb7814c43f70a78a603ce65',
								publicIntent: 'The hero independently chose mission.move.shelf-to-crater-heart.',
								initiativeBase: 61,
								initiativeTieBreak: 45,
								initiative: 106,
								outcome: 'applied',
								fromNodeId: 'crater-heart',
								toNodeId: 'windward-shelf',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from crater-heart to windward-shelf with 4 ore in cargo.'
							}
						],
						monsterActions: [],
						effects: [],
						statusAfter: 'resolving',
						portalWindow: {
							roundsRemainingBefore: 4,
							roundsRemainingAfter: 3,
							pressureBefore: 'warning',
							pressureAfter: 'warning'
						},
						oreLedgerEntryIds: []
					},
					{
						roundVersion: 'mission-round-v3',
						roundNumber: 6,
						stateVersion: 2,
						environmentEventIds: ['iron-wind-shear'],
						threatIntents: [],
						monsterActionIds: [],
						initiativeOrder: [
							'babbe78f-9c95-4b38-a124-8e0436451f47',
							'0e624f8b-2a25-444f-86af-cfe9d5e39cc8'
						],
						actions: [
							{
								actorId: 'babbe78f-9c95-4b38-a124-8e0436451f47',
								actorKind: 'hero',
								actionId: 'mission.move.gate-to-shelf',
								choiceSource: 'scripted',
								policyId: 'scripted-personality-v1',
								packetHash: 'd7fe942ba032865b8708f5966020e66c3f14b03a718620fba419a6be155e00e6',
								legalActionHash: 'c0c5198dfd0050db773e7b93f931967d351ddbe04d69f9828cf30bf008d5b5c4',
								policyResultHash:
									'f6deb4718ac6c5902944670acbc2ec6fdeabcb69c76a2a0576a4b0e9f3aa30b4',
								publicIntent: 'The hero independently chose mission.move.gate-to-shelf.',
								initiativeBase: 61,
								initiativeTieBreak: 67,
								initiative: 128,
								outcome: 'applied',
								fromNodeId: 'windward-shelf',
								toNodeId: 'moon-gate',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from windward-shelf to moon-gate with 4 ore in cargo.'
							},
							{
								actorId: '0e624f8b-2a25-444f-86af-cfe9d5e39cc8',
								actorKind: 'master',
								actionId: 'mission.move.gate-to-shelf',
								choiceSource: 'manual',
								policyId: null,
								packetHash: null,
								legalActionHash: null,
								policyResultHash: null,
								publicIntent: 'The Master chose mission.move.gate-to-shelf.',
								initiativeBase: 50,
								initiativeTieBreak: 36,
								initiative: 86,
								outcome: 'applied',
								fromNodeId: 'windward-shelf',
								toNodeId: 'moon-gate',
								targetId: null,
								discoveryIds: [],
								objectiveTransition: null,
								effectIds: [],
								summary: 'Moved from windward-shelf to moon-gate with 2 ore in cargo.'
							}
						],
						monsterActions: [],
						effects: [],
						statusAfter: 'extraction',
						portalWindow: {
							roundsRemainingBefore: 3,
							roundsRemainingAfter: 2,
							pressureBefore: 'warning',
							pressureAfter: 'critical'
						},
						oreLedgerEntryIds: []
					}
				]
			}
		}
	}
});
