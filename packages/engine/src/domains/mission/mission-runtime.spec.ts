import {
	EngineGameStateV12Schema,
	EngineGameStateV13Schema,
	EngineGameStateV15Schema,
	type EngineCommand,
	type EngineGameState,
	type EntropyDraw
} from '@summonlab/contracts';
import { describe, expect, it } from 'vitest';

import { createEntropyCursor } from '../../entropy.js';
import { applyCommand, createBootstrapEngine } from '../../engine.js';
import { deterministicUuid, hashCanonical, sha256Hex } from '../../hash.js';
import { missionContentForState } from '../../core/content-bindings.js';
import { retreatMissionAttempt } from './lifecycle.js';

import {
	monsterArmorReduction,
	deriveMonsterIntents,
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

describe('mission runtime ownership', () => {
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

	it('freezes spawn and combat receipts, initiative order, entropy, and immutable inputs', () => {
		const { preDeploy, deployed, combatChoices, combatEventId } = combatOracleStates();
		expect(hashCanonical(preDeploy)).toBe(
			'b300cc6b4b9d65d8f19706643f27ab16375f7476c9c1a54e09c1d4a8f23ecf8d'
		);
		const positions = Object.fromEntries(
			preDeploy.mission.attempt!.party.memberIds.map((actorId) => [
				actorId,
				preDeploy.mission.attempt!.entryNodeId
			])
		);
		const draws: EntropyDraw[] = [];
		const frozenPreDeploy = deepFreeze(structuredClone(preDeploy));
		const spawned = spawnMissionCombatants(
			frozenPreDeploy,
			frozenPreDeploy.mission.attempt!,
			positions,
			createEntropyCursor(frozenPreDeploy.seed, frozenPreDeploy.entropyCursor),
			draws
		);
		expect(hashCanonical(spawned)).toBe(
			'fbfb60cb6d406c3a822ec35786e804a711f7acb1e1871be50f94fcdd21b51c5e'
		);
		expect(draws).toStrictEqual([
			{ purpose: 'goblin-chain-watch-count', cursor: 0, minimum: 2, maximum: 3, value: 2 },
			{ purpose: 'goblin-ember-hauler-count', cursor: 1, minimum: 1, maximum: 1, value: 1 }
		]);

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
			const { deployed, combatEventId } = combatOracleStates();
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
			attempt.turnState.currentThreatIntents = deriveMonsterIntents(
				missionContentForState(deployed),
				attempt,
				attempt.turnState.monsters,
				attempt.positions
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
			expect(receipt.round.effects).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ targetKind: 'monster', targetId: monster.monsterId }),
					expect.objectContaining({ targetKind: 'party', targetId })
				])
			);
			expect(receipt.round.monsterActions).toEqual(
				expect.arrayContaining([expect.objectContaining({ kind: 'strike', targetId })])
			);
			expect(state.mission.attempt!.positions[targetId]).toBe('chain-court');
		}
	);

	it('freezes the legacy round receipt and party initiative tie ordering', () => {
		const { state, choices } = legacyTurnOracleState();
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
		const oracle = legacyTurnOracleState();
		const masterId = oracle.state.master.masterId;
		const heroId = Object.keys(oracle.state.heroes)[0]!;
		const tiedState = deepFreeze({ ...structuredClone(oracle.state), seed: 'tie-12' });
		const tied = resolveMissionTurn(tiedState, [
			manualChoice(masterId, 'mission.hold'),
			scriptedChoice(heroId, 'mission.hold')
		]);
		expect(tied.round.actions.map((action) => action.initiative)).toStrictEqual([135, 135]);
		expect(tied.round.initiativeOrder).toStrictEqual([heroId, masterId]);
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
		const { state, choices } = portalTurnOracleState();
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
		const { state } = portalTurnOracleState();
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
		expect(retreated.attempt).toMatchObject({
			status: 'retreat',
			outcome: 'retreat',
			endedAt: '2000-01-01T00:00:00.000Z',
			turnState: { portal: { cargo: { [masterId]: { amount: 0 } } } }
		});
	});

	it('credits exact extraction cargo and returns the immutable aftermath patch', () => {
		const state = portalExtractionOracleState();
		const masterId = state.master.masterId;
		const heroId = Object.keys(state.heroes)[0]!;
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
		expect(extracted.mission.attempt).toMatchObject({
			status: 'success',
			outcome: 'success',
			turnState: {
				portal: {
					extractedAmount: 6,
					extractionCredited: true,
					cargo: { [masterId]: { amount: 0 }, [heroId]: { amount: 0 } }
				}
			}
		});
		expect(frozen.mission.attempt!.turnState.portal.cargo[masterId]!.amount).toBe(2);
	});
});

function deepFreeze<T>(value: T): T {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value)) deepFreeze(child);
	}
	return value;
}

function manualSource() {
	return {
		source: 'manual' as const,
		timing: 'step' as const,
		fallbackPolicy: null,
		directiveIds: [],
		decisionJobId: null
	};
}

function command(
	state: EngineGameState,
	actorId: string,
	key: string,
	body: object
): EngineCommand {
	const commandId = deterministicUuid(`${state.runId}:${key}:${state.version}`);
	return {
		commandId,
		runId: state.runId,
		actorId,
		expectedVersion: state.version,
		correlationId: commandId,
		source: manualSource(),
		...body
	} as unknown as EngineCommand;
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

function combatOracleStates() {
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid('task-9a-v13-run'),
		seed: 'task-9a-v13-seed',
		heroId: deterministicUuid('task-9a-v13-hero'),
		manifestHash: sha256Hex('task-9a-v13-manifest')
	});
	let state = EngineGameStateV13Schema.parse(bootstrap.snapshot.state);
	const masterId = state.master.masterId;
	const heroId = Object.keys(state.heroes)[0]!;
	state = EngineGameStateV13Schema.parse(
		applyCommand(
			state,
			command(state, masterId, 'prepare', { commandType: 'mission.prepare', heroIds: [heroId] })
		).state
	);
	const preDeploy = state;
	state = EngineGameStateV13Schema.parse(
		applyCommand(state, command(state, masterId, 'deploy', { commandType: 'mission.deploy' })).state
	);
	const combatChoices = [
		manualChoice(masterId, 'mission.hold'),
		scriptedChoice(heroId, 'mission.hold')
	];
	return {
		preDeploy,
		deployed: state,
		combatChoices,
		combatEventId: deterministicUuid(`${state.runId}:combat:${state.version}`)
	};
}

function legacyTurnOracleState() {
	const base = createBootstrapEngine({
		runId: deterministicUuid('task-9a-v13-run'),
		seed: 'task-9a-v13-seed',
		heroId: deterministicUuid('task-9a-v13-hero'),
		manifestHash: sha256Hex('task-9a-v13-manifest')
	});
	let state = EngineGameStateV12Schema.parse({
		...base.snapshot.state,
		schemaVersion: 12,
		contentVersion: 'engine-v12'
	});
	const masterId = state.master.masterId;
	const heroId = Object.keys(state.heroes)[0]!;
	state = EngineGameStateV12Schema.parse(
		applyCommand(
			state,
			command(state, masterId, 'v12-prepare', {
				commandType: 'mission.prepare',
				heroIds: [heroId]
			})
		).state
	);
	state = EngineGameStateV12Schema.parse(
		applyCommand(state, command(state, masterId, 'v12-deploy', { commandType: 'mission.deploy' }))
			.state
	);
	return {
		state,
		choices: [
			manualChoice(masterId, 'mission.move.threshold-to-oath-hall'),
			scriptedChoice(heroId, 'mission.hold')
		]
	};
}

function portalTurnOracleState(withHero = false) {
	const bootstrap = createBootstrapEngine({
		runId: deterministicUuid('task-9a-portal-run'),
		seed: 'task-9a-portal-seed',
		heroId: deterministicUuid('task-9a-portal-hero'),
		manifestHash: sha256Hex('task-9a-portal-manifest'),
		developmentMissionScenario: {
			initialMissionId: 'iron-moon',
			availableMissionIds: ['iron-moon']
		}
	});
	let state = EngineGameStateV15Schema.parse(bootstrap.snapshot.state);
	const masterId = state.master.masterId;
	state = EngineGameStateV15Schema.parse(
		applyCommand(
			state,
			command(state, masterId, 'portal-prepare', {
				commandType: 'mission.prepare',
				heroIds: withHero ? [Object.keys(state.heroes)[0]!] : [],
				missionId: 'iron-moon'
			})
		).state
	);
	state = EngineGameStateV15Schema.parse(
		applyCommand(
			state,
			command(state, masterId, 'portal-deploy', { commandType: 'mission.deploy' })
		).state
	);
	return { state, choices: [manualChoice(masterId, 'mission.move.gate-to-shelf')] };
}

function portalExtractionOracleState() {
	let { state } = portalTurnOracleState(true);
	const masterId = state.master.masterId;
	const heroId = Object.keys(state.heroes)[0]!;
	for (const [masterAction, heroAction] of [
		['mission.move.gate-to-shelf', 'mission.move.gate-to-shelf'],
		['mission.move.shelf-to-pale-vein', 'mission.move.shelf-to-crater-heart'],
		['mission.mine.pale-vein-deposit', 'mission.mine.crater-heart-deposit'],
		['mission.mine.pale-vein-deposit', 'mission.mine.crater-heart-deposit'],
		['mission.move.shelf-to-pale-vein', 'mission.move.shelf-to-crater-heart'],
		['mission.move.gate-to-shelf', 'mission.move.gate-to-shelf']
	] as const) {
		const receipt = resolvePortalMissionTurn(state, [
			manualChoice(masterId, masterAction),
			scriptedChoice(heroId, heroAction)
		]);
		state = EngineGameStateV15Schema.parse({
			...state,
			mission: receipt.mission,
			entropyCursor: receipt.entropyCursor
		});
	}
	return state;
}
