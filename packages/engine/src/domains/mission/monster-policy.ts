import {
	MissionMonsterIntentSchema,
	type EngineGameStateV13,
	type EngineGameStateV14,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type EngineGameStateV23,
	type EntropyDraw,
	type MissionMonsterIntent,
	type MissionMonsterState,
	type MissionPackage
} from '@summonlab/contracts';
import { MONSTER_POLICY_CATALOG, monsterPolicy } from '@summonlab/content';

import { missionContentForState } from '../../core/content-bindings.js';
import { createEntropyCursor, drawInteger } from '../../entropy.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid } from '../../hash.js';

export type MissionCombatAttempt = NonNullable<EngineGameStateV14['mission']['attempt']>;
export type MissionCombatArena = MissionCombatAttempt['turnState']['arena'];

export function verifiedMonsterPolicyBinding(attempt: MissionCombatAttempt): void {
	if (
		attempt.turnState.policyBinding.contentVersion !== MONSTER_POLICY_CATALOG.contentVersion ||
		attempt.turnState.policyBinding.contentHash !== MONSTER_POLICY_CATALOG.contentHash
	) {
		throw new ReplayIntegrityError(
			'Monster policy binding is unavailable',
			attempt.turnState.roundNumber
		);
	}
}

function openDutyStep(
	mission: MissionPackage,
	fromNodeId: string,
	toNodeId: string
): string | null {
	if (fromNodeId === toNodeId) return fromNodeId;
	const pending: Array<{ nodeId: string; firstStep: string | null }> = [
		{ nodeId: fromNodeId, firstStep: null }
	];
	const visited = new Set<string>();
	while (pending.length > 0) {
		const current = pending.shift()!;
		if (visited.has(current.nodeId)) continue;
		visited.add(current.nodeId);
		const neighbors = mission.arena.edges
			.filter((edge) => edge.access.kind === 'open')
			.flatMap((edge) => {
				if (edge.fromNodeId === current.nodeId) return [edge.toNodeId];
				if (edge.bidirectional && edge.toNodeId === current.nodeId) return [edge.fromNodeId];
				return [];
			})
			.sort((left, right) => left.localeCompare(right));
		for (const neighbor of neighbors) {
			const firstStep = current.firstStep ?? neighbor;
			if (neighbor === toNodeId) return firstStep;
			if (!visited.has(neighbor)) pending.push({ nodeId: neighbor, firstStep });
		}
	}
	return null;
}

function prioritizedPartyAtNode(
	party: MissionCombatAttempt['party'],
	positions: Readonly<Record<string, string>>,
	nodeId: string,
	carrierId: string | null
): string | null {
	return (
		party.memberIds
			.filter((actorId) => positions[actorId] === nodeId)
			.sort((left, right) => {
				const leftPriority = left === carrierId ? 0 : left === party.masterId ? 1 : 2;
				const rightPriority = right === carrierId ? 0 : right === party.masterId ? 1 : 2;
				return leftPriority - rightPriority || left.localeCompare(right);
			})[0] ?? null
	);
}

export type MonsterIntentScenario = {
	readonly mission: MissionPackage | null;
	readonly monster: MissionMonsterState;
	readonly dutyNodeId: string;
	readonly objectiveNodeId: string;
	readonly objectiveStatus: MissionCombatAttempt['turnState']['objective']['status'];
	readonly objectiveCarrierId: string | null;
	readonly party: MissionCombatAttempt['party'];
	readonly partyPositions: Readonly<Record<string, string>>;
	readonly arena: MissionCombatArena;
};

function holdIntent(scenario: MonsterIntentScenario, telegraph: string): MissionMonsterIntent {
	return MissionMonsterIntentSchema.parse({
		monsterId: scenario.monster.monsterId,
		policyId: scenario.monster.policyId,
		actionId: `monster.hold.${scenario.monster.monsterId}`,
		kind: 'hold',
		fromNodeId: scenario.monster.nodeId,
		toNodeId: scenario.monster.nodeId,
		targetId: null,
		telegraph,
		anticipatedEffect: 'Maintains its authored duty without gaining hidden knowledge.'
	});
}

function strikeIntent(
	scenario: MonsterIntentScenario,
	targetId: string,
	kind: 'strike' | 'furnace-surge' | 'defend-control',
	telegraph: string,
	toNodeId = scenario.monster.nodeId
): MissionMonsterIntent {
	const power = monsterPolicy(scenario.monster.policyId).strikePower;
	return MissionMonsterIntentSchema.parse({
		monsterId: scenario.monster.monsterId,
		policyId: scenario.monster.policyId,
		actionId: `monster.${kind}.${scenario.monster.monsterId}.${targetId}`,
		kind,
		fromNodeId: scenario.monster.nodeId,
		toNodeId,
		targetId,
		telegraph,
		anticipatedEffect: `Threatens ${power} mission guard before defense reduction.`
	});
}

function moveIntent(
	scenario: MonsterIntentScenario,
	toNodeId: string,
	telegraph: string
): MissionMonsterIntent {
	return MissionMonsterIntentSchema.parse({
		monsterId: scenario.monster.monsterId,
		policyId: scenario.monster.policyId,
		actionId: `monster.move.${scenario.monster.monsterId}`,
		kind: 'move',
		fromNodeId: scenario.monster.nodeId,
		toNodeId,
		targetId: null,
		telegraph,
		anticipatedEffect: 'Moves one open authored edge; concealed party routes remain unknown.'
	});
}

export function resolveMonsterPolicyIntent(scenario: MonsterIntentScenario): MissionMonsterIntent {
	const definition = monsterPolicy(scenario.monster.policyId);
	const localTarget = prioritizedPartyAtNode(
		scenario.party,
		scenario.partyPositions,
		scenario.monster.nodeId,
		scenario.objectiveCarrierId
	);

	if (definition.behavior === 'guard-duty-node') {
		if (localTarget) {
			return strikeIntent(
				scenario,
				localTarget,
				'strike',
				`${scenario.monster.label} lowers a hooked blade toward the intruder in its court.`
			);
		}
		if (scenario.monster.nodeId !== scenario.dutyNodeId && scenario.mission) {
			const step = openDutyStep(scenario.mission, scenario.monster.nodeId, scenario.dutyNodeId);
			if (step) return moveIntent(scenario, step, `${scenario.monster.label} returns to its post.`);
		}
		return holdIntent(scenario, `${scenario.monster.label} watches the Chain Court lanes.`);
	}

	if (definition.behavior === 'protect-objective') {
		if (localTarget) {
			if (scenario.monster.alertState === 'duty' && scenario.objectiveStatus === 'available') {
				return MissionMonsterIntentSchema.parse({
					monsterId: scenario.monster.monsterId,
					policyId: scenario.monster.policyId,
					actionId: `monster.alarm.${scenario.monster.monsterId}`,
					kind: 'alarm',
					fromNodeId: scenario.monster.nodeId,
					toNodeId: scenario.monster.nodeId,
					targetId: localTarget,
					telegraph: `${scenario.monster.label} reaches for the cradle alarm chain.`,
					anticipatedEffect: 'Becomes alarmed and makes its next defense explicit.'
				});
			}
			return strikeIntent(
				scenario,
				localTarget,
				'strike',
				`${scenario.monster.label} squares itself between the company and the ember cradle.`
			);
		}
		if (scenario.objectiveCarrierId && scenario.mission) {
			const carrierNode = scenario.partyPositions[scenario.objectiveCarrierId];
			const step = carrierNode
				? openDutyStep(scenario.mission, scenario.monster.nodeId, carrierNode)
				: null;
			if (step && step !== scenario.monster.nodeId) {
				return moveIntent(
					scenario,
					step,
					`${scenario.monster.label} pursues the visible ember carrier.`
				);
			}
		}
		return holdIntent(scenario, `${scenario.monster.label} keeps both hands on the ember cradle.`);
	}

	const coolingTarget =
		scenario.arena.coolingControlExposed && scenario.arena.coolingControlNodeId
			? prioritizedPartyAtNode(
					scenario.party,
					scenario.partyPositions,
					scenario.arena.coolingControlNodeId,
					null
				)
			: null;
	if (coolingTarget) {
		return strikeIntent(
			scenario,
			coolingTarget,
			'defend-control',
			`${scenario.monster.label} turns from the front line to defend the exposed cooling control.`,
			scenario.arena.coolingControlNodeId!
		);
	}
	if (localTarget) {
		return strikeIntent(
			scenario,
			localTarget,
			scenario.arena.furnaceState === 'lit' ? 'furnace-surge' : 'strike',
			scenario.arena.furnaceState === 'lit'
				? `${scenario.monster.label} vents furnace pressure before bringing its hammer down.`
				: `${scenario.monster.label} raises its hammer without the furnace shielding it.`
		);
	}
	return holdIntent(scenario, `${scenario.monster.label} guards the living foundry.`);
}

export function monsterArmorReduction(
	policyId: string,
	furnaceState: MissionCombatArena['furnaceState']
): number {
	const armor = monsterPolicy(policyId).armor;
	if (armor.kind === 'none') return armor.reduction;
	return furnaceState === 'lit'
		? armor.litReduction
		: furnaceState === 'cooling'
			? armor.coolingReduction
			: armor.quenchedReduction;
}

export function deriveMonsterIntents(
	mission: MissionPackage,
	attempt: MissionCombatAttempt,
	monsters: Readonly<Record<string, MissionMonsterState>>,
	positions: Readonly<Record<string, string>>,
	objective = attempt.turnState.objective,
	arena = attempt.turnState.arena
): MissionMonsterIntent[] {
	verifiedMonsterPolicyBinding(attempt);
	const objectiveNodeId = mission.objectives.find(
		(candidate) => candidate.objectiveId === objective.objectiveId
	)!.targetNodeIds[0]!;
	return Object.values(monsters)
		.filter((monster) => monster.status === 'active')
		.sort((left, right) => left.monsterId.localeCompare(right.monsterId))
		.map((monster) => {
			const duty = mission.monsterDuties.find(
				(candidate) => candidate.dutySlotId === monster.dutySlotId
			);
			if (!duty)
				throw new ReplayIntegrityError(
					'Monster duty is unavailable',
					attempt.turnState.roundNumber
				);
			return resolveMonsterPolicyIntent({
				mission,
				monster,
				dutyNodeId: duty.spawnNodeId,
				objectiveNodeId,
				objectiveStatus: objective.status,
				objectiveCarrierId: objective.carrierId,
				party: attempt.party,
				partyPositions: positions,
				arena
			});
		});
}

export function spawnMissionCombatants(
	state:
		| EngineGameStateV13
		| EngineGameStateV14
		| EngineGameStateV16
		| EngineGameStateV17
		| EngineGameStateV18
		| EngineGameStateV19
		| EngineGameStateV20
		| EngineGameStateV21
		| EngineGameStateV23,
	attempt: MissionCombatAttempt,
	positions: Readonly<Record<string, string>>,
	entropyInput: ReturnType<typeof createEntropyCursor>,
	entropyDraws: EntropyDraw[]
): {
	readonly monsters: Record<string, MissionMonsterState>;
	readonly threatIntents: MissionMonsterIntent[];
	readonly entropy: ReturnType<typeof createEntropyCursor>;
} {
	verifiedMonsterPolicyBinding(attempt);
	const mission = missionContentForState(state);
	let entropy = entropyInput;
	const monsters: Record<string, MissionMonsterState> = {};
	for (const duty of mission.monsterDuties) {
		if (duty.activation.kind !== 'on-deployment') continue;
		const purpose = `${duty.dutySlotId}-count`;
		if (!mission.encounterSeedRules.namedPurposes.includes(purpose)) {
			throw new ReplayIntegrityError(
				`Monster count entropy is undeclared: ${purpose}`,
				state.eventCursor
			);
		}
		const count = drawInteger(entropy, purpose, duty.count.min, duty.count.max);
		entropy = count.next;
		entropyDraws.push(count.draw);
		const policy = monsterPolicy(duty.policyId);
		for (let ordinal = 1; ordinal <= count.draw.value; ordinal += 1) {
			const monsterId = deterministicUuid(
				`${attempt.attemptId}:${duty.dutySlotId}:${ordinal}:monster`
			);
			monsters[monsterId] = {
				monsterId,
				dutySlotId: duty.dutySlotId,
				policyId: duty.policyId,
				label: `${policy.entityLabel} ${String(ordinal).padStart(2, '0')}`,
				ordinal,
				nodeId: duty.spawnNodeId,
				status: 'active',
				vitality: policy.maximumVitality,
				maximumVitality: policy.maximumVitality,
				alertState: 'duty',
				defeatedOnRound: null,
				lastActionId: null
			};
		}
	}
	return {
		monsters,
		threatIntents: deriveMonsterIntents(mission, attempt, monsters, positions),
		entropy
	};
}
