import {
	DailyPlanSchema,
	InjurySchema,
	MissionConsequenceRecordV3Schema,
	MissionHarmRecordSchema,
	MissionMasterHarmRecordSchema,
	MissionResolvedEffectSchema,
	MissionRoundSchema,
	MissionRoundV2Schema,
	MissionRunStateV2Schema,
	MissionRunStateV3Schema,
	MissionRunStateV4Schema,
	MissionRunStateV6Schema,
	MissionRunStateV7Schema,
	MissionRunStateV8Schema,
	MissionTurnChoiceSchema,
	SocietyStateV4Schema,
	SocietyStateV5Schema,
	type EngineGameStateV12,
	type EngineGameStateV13,
	type EngineGameStateV14,
	type EngineGameStateV15,
	type EngineGameStateV16,
	type EngineGameStateV17,
	type EngineGameStateV18,
	type EngineGameStateV19,
	type EngineGameStateV20,
	type EngineGameStateV21,
	type EngineGameStateV23,
	type EngineGameStateV24,
	type EntropyDraw,
	type MissionConsequenceRecordV3,
	type MissionConsequenceRecordV4,
	type MissionHarmRecord,
	type MissionMasterHarmRecord,
	type MissionResolvedEffect,
	type MissionRound,
	type MissionRoundV2,
	type MissionRunStateV2,
	type MissionRunStateV3,
	type MissionRunStateV4,
	type MissionRunStateV6,
	type MissionRunStateV7,
	type MissionRunStateV8,
	type MissionRunStateV9,
	type MissionTurnChoice,
	type SocietyStateV4,
	type SocietyStateV5
} from '@summonlab/contracts';
import {
	applyMissionDiscoveryAffordance,
	listLegalMissionDiscoveryAffordances,
	monsterPolicy,
	visitMissionNode
} from '@summonlab/content';

import { missionContentForState } from '../../core/content-bindings.js';
import { createEntropyCursor, drawInteger } from '../../entropy.js';
import { ReplayIntegrityError } from '../../errors.js';
import { deterministicUuid, hashCanonical } from '../../hash.js';
import { missionToolTagsForActor, normalizedMissionTurnChoices } from './actions.js';
import {
	deriveMonsterIntents,
	monsterArmorReduction,
	verifiedMonsterPolicyBinding
} from './monster-policy.js';

const MISSION_MOVE_PREFIX = 'mission.move.';
const MISSION_INSPECT_PREFIX = 'mission.inspect.';
const MISSION_RECOVER_PREFIX = 'mission.recover.';
const MISSION_ATTACK_PREFIX = 'mission.attack.';
const MISSION_COOLING_CONTROL_ACTION_ID = 'mission.control.cooling-wheel';

/**
 * These two private primitives intentionally duplicate the exact generic settlement behavior.
 * Importing settlement domain leaves from mission would violate the domain boundary.
 */
function clampSocial(value: number): number {
	return Math.min(100, Math.max(-100, value));
}

function skipUnfinishedPlan(hero: EngineGameStateV18['heroes'][string], resolvedAt: string) {
	if (!hero.dailyPlan) return null;
	return DailyPlanSchema.parse({
		...hero.dailyPlan,
		entries: hero.dailyPlan.entries.map((entry) =>
			entry.status === 'pending' || entry.status === 'active'
				? { ...entry, status: 'skipped', completedAt: resolvedAt }
				: entry
		)
	});
}

type FrozenMissionTurnEngineState =
	| EngineGameStateV12
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV15
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV23
	| EngineGameStateV24;

export function missionInitiativeBase(
	state: FrozenMissionTurnEngineState,
	actorId: string
): number {
	if (actorId === state.master.masterId) return 50;
	const hero = state.heroes[actorId]!;
	return (
		20 + hero.mind.aptitudes.finesse * 5 + hero.mind.aptitudes.resolve * 3 + hero.progression.level
	);
}

export function activeMissionEnvironmentEvents(
	state: FrozenMissionTurnEngineState,
	roundNumber: number
): string[] {
	const mission = missionContentForState(state);
	const priorRounds = state.mission.attempt?.turnState.rounds ?? [];
	return mission.environmentalEvents
		.filter((event) => {
			if (event.trigger.kind !== 'turn-interval') return false;
			const occurrenceCount = priorRounds.filter((round) =>
				round.environmentEventIds.includes(event.eventId)
			).length;
			return (
				occurrenceCount < event.maximumOccurrences &&
				roundNumber >= event.trigger.firstTurn &&
				(roundNumber - event.trigger.firstTurn) % event.trigger.everyTurns === 0
			);
		})
		.map((event) => event.eventId)
		.sort();
}

export type MissionTurnResolution = {
	readonly mission: MissionRunStateV2;
	readonly round: MissionRound;
	readonly choices: MissionTurnChoice[];
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
};

export function resolveMissionTurn(
	state: EngineGameStateV12,
	choicesInput: readonly MissionTurnChoice[]
): MissionTurnResolution {
	const choices = normalizedMissionTurnChoices(state, choicesInput);
	const currentAttempt = state.mission.attempt!;
	const roundNumber = currentAttempt.turnState.roundNumber + 1;
	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const ranked = choices
		.map((choice) => {
			const tieBreak = drawInteger(entropy, 'initiative-tie-break', 0, 99);
			entropy = tieBreak.next;
			entropyDraws.push(tieBreak.draw);
			const initiativeBase = missionInitiativeBase(state, choice.actorId);
			return {
				choice,
				initiativeBase,
				initiativeTieBreak: tieBreak.draw.value,
				initiative: initiativeBase + tieBreak.draw.value
			};
		})
		.sort(
			(left, right) =>
				right.initiative - left.initiative ||
				left.choice.actorId.localeCompare(right.choice.actorId)
		);
	const missionContent = missionContentForState(state);
	let positions = { ...currentAttempt.positions };
	let knowledge = { ...currentAttempt.knowledge };
	let objective = { ...currentAttempt.turnState.objective };
	const resolvedActions: MissionRound['actions'] = [];

	for (const entry of ranked) {
		const { choice } = entry;
		const fromNodeId = positions[choice.actorId]!;
		let toNodeId = fromNodeId;
		let discoveryIds: string[] = [];
		let objectiveTransition: 'recovered' | 'delivered' | null = null;
		let outcome: 'applied' | 'superseded' = 'applied';
		let summary: string;

		if (choice.actionId.startsWith(MISSION_MOVE_PREFIX)) {
			const edgeId = choice.actionId.slice(MISSION_MOVE_PREFIX.length);
			const edge = missionContent.arena.edges.find((candidate) => candidate.edgeId === edgeId)!;
			toNodeId =
				edge.fromNodeId === fromNodeId
					? edge.toNodeId
					: edge.bidirectional && edge.toNodeId === fromNodeId
						? edge.fromNodeId
						: fromNodeId;
			positions = { ...positions, [choice.actorId]: toNodeId };
			knowledge = visitMissionNode(missionContent, toNodeId, knowledge);
			summary = `Moved from ${fromNodeId} to ${toNodeId}.`;
		} else if (choice.actionId.startsWith(MISSION_INSPECT_PREFIX)) {
			const affordanceId = choice.actionId.slice(MISSION_INSPECT_PREFIX.length);
			const legal = listLegalMissionDiscoveryAffordances(
				missionContent,
				fromNodeId,
				knowledge
			).some((candidate) => candidate.affordanceId === affordanceId);
			if (legal) {
				const before = new Set(knowledge.discoveryIds);
				knowledge = applyMissionDiscoveryAffordance(missionContent, affordanceId, knowledge);
				discoveryIds = knowledge.discoveryIds.filter((id) => !before.has(id));
				summary = `Resolved ${affordanceId} and revealed ${discoveryIds.join(', ')}.`;
			} else {
				outcome = 'superseded';
				summary = `${affordanceId} had already been resolved earlier in initiative.`;
			}
		} else if (choice.actionId.startsWith(MISSION_RECOVER_PREFIX)) {
			if (objective.status === 'available') {
				objective = {
					...objective,
					status: 'carried',
					carrierId: choice.actorId,
					recoveredOnRound: roundNumber
				};
				objectiveTransition = 'recovered';
				summary = 'Lifted the First Ember from its cradle and became its carrier.';
			} else {
				outcome = 'superseded';
				summary = 'The First Ember was already carried when this action resolved.';
			}
		} else {
			summary = 'Held position and preserved the current formation.';
		}

		if (
			objective.status === 'carried' &&
			objective.carrierId === choice.actorId &&
			positions[choice.actorId] === currentAttempt.extractionNodeId
		) {
			objective = {
				...objective,
				status: 'delivered',
				carrierId: null,
				deliveredOnRound: roundNumber
			};
			objectiveTransition = 'delivered';
			summary += ' The carrier returned the objective to the Tower Threshold.';
		}

		resolvedActions.push({
			actorId: choice.actorId,
			actorKind: choice.actorId === currentAttempt.party.masterId ? 'master' : 'hero',
			actionId: choice.actionId,
			choiceSource: choice.source,
			policyId: choice.policyId,
			packetHash: choice.packetHash,
			legalActionHash: choice.legalActionHash,
			policyResultHash: choice.policyResultHash,
			publicIntent: choice.publicIntent,
			initiativeBase: entry.initiativeBase,
			initiativeTieBreak: entry.initiativeTieBreak,
			initiative: entry.initiative,
			outcome,
			fromNodeId,
			toNodeId,
			discoveryIds,
			objectiveTransition,
			summary
		});
	}

	const allAtThreshold = currentAttempt.party.memberIds.every(
		(actorId) => positions[actorId] === currentAttempt.extractionNodeId
	);
	const extractionReady = objective.status === 'delivered' && allAtThreshold;
	const exhausted = roundNumber >= currentAttempt.turnState.maximumRounds && !extractionReady;
	const statusAfter = extractionReady ? 'extraction' : exhausted ? 'failure' : 'resolving';
	const round = MissionRoundSchema.parse({
		roundNumber,
		stateVersion: state.version,
		environmentEventIds: activeMissionEnvironmentEvents(state, roundNumber),
		monsterActionIds: [],
		initiativeOrder: resolvedActions.map((resolved) => resolved.actorId),
		actions: resolvedActions,
		statusAfter
	});
	const completedObjectiveIds = objective.status === 'delivered' ? [objective.objectiveId] : [];
	const mission = MissionRunStateV2Schema.parse({
		...state.mission,
		attempt: {
			...currentAttempt,
			status: statusAfter,
			positions,
			knowledge,
			completedObjectiveIds,
			extractionOpenedAt: extractionReady ? state.simulatedAt : null,
			endedAt: exhausted ? state.simulatedAt : null,
			outcome: exhausted ? 'failure' : null,
			turnState: {
				...currentAttempt.turnState,
				roundNumber,
				objective,
				rounds: [...currentAttempt.turnState.rounds, round]
			}
		}
	});
	return {
		mission,
		round,
		choices,
		entropyCursor: entropy.cursor,
		entropyDraws
	};
}

export type MissionCombatTurnResolution = {
	readonly mission:
		| MissionRunStateV3
		| MissionRunStateV4
		| MissionRunStateV6
		| MissionRunStateV7
		| MissionRunStateV8;
	readonly round: MissionRoundV2;
	readonly choices: MissionTurnChoice[];
	readonly entropyCursor: number;
	readonly entropyDraws: EntropyDraw[];
	readonly consequences: (
		MissionHarmRecord | MissionMasterHarmRecord | MissionConsequenceRecordV3
	)[];
	readonly heroes: EngineGameStateV18['heroes'];
	readonly items: EngineGameStateV18['items'];
	readonly society: SocietyStateV4 | SocietyStateV5;
	readonly master: EngineGameStateV18['master'];
	readonly status: EngineGameStateV18['status'];
};

export type LegacyV24CombatResolverState = EngineGameStateV24;

export type LegacyV24CombatResolution = Omit<
	MissionCombatTurnResolution,
	'mission' | 'consequences'
> & {
	readonly mission: MissionRunStateV9;
	readonly consequences: MissionConsequenceRecordV4[];
};

type MissionCombatResolverState =
	| EngineGameStateV13
	| EngineGameStateV14
	| EngineGameStateV16
	| EngineGameStateV17
	| EngineGameStateV18
	| EngineGameStateV19
	| EngineGameStateV20
	| EngineGameStateV21
	| EngineGameStateV23
	| EngineGameStateV24;

export type LegacyV24CombatSchemas = {
	readonly mission: { parse(value: unknown): MissionRunStateV9 };
	readonly consequence: { parse(value: unknown): MissionConsequenceRecordV4 };
};

function missionAttackPower(state: MissionCombatResolverState, actorId: string): number {
	if (actorId === state.master.masterId) return 1;
	const hero = state.heroes[actorId]!;
	return (
		1 +
		Math.floor(hero.mind.aptitudes.might / 8) +
		Math.floor(hero.progression.skills.swordFighting.rank / 5)
	);
}

function resolveMissionCombatTurnCore(
	state: MissionCombatResolverState,
	choicesInput: readonly MissionTurnChoice[],
	sourceEventId: string | null,
	compatibilitySchemas: LegacyV24CombatSchemas | null
): MissionCombatTurnResolution | LegacyV24CombatResolution {
	const choices = compatibilitySchemas
		? choicesInput.map((choice) => MissionTurnChoiceSchema.parse(choice))
		: normalizedMissionTurnChoices(state, choicesInput);
	const currentAttempt = state.mission.attempt!;
	verifiedMonsterPolicyBinding(currentAttempt);
	const missionContent = missionContentForState(state);
	const roundNumber = currentAttempt.turnState.roundNumber + 1;
	const expectedThreatIntents = deriveMonsterIntents(
		missionContent,
		currentAttempt,
		currentAttempt.turnState.monsters,
		currentAttempt.positions
	);
	if (
		hashCanonical(expectedThreatIntents) !==
		hashCanonical(currentAttempt.turnState.currentThreatIntents)
	) {
		throw new ReplayIntegrityError('Monster threat telegraph diverged', state.eventCursor);
	}

	let entropy = createEntropyCursor(state.seed, state.entropyCursor);
	const entropyDraws: EntropyDraw[] = [];
	const ranked = [
		...choices.map((choice) => ({
			actorKind: 'party' as const,
			actorId: choice.actorId,
			choice,
			intent: null
		})),
		...currentAttempt.turnState.currentThreatIntents.map((intent) => ({
			actorKind: 'monster' as const,
			actorId: intent.monsterId,
			choice: null,
			intent
		}))
	]
		.map((entry) => {
			const tieBreak = drawInteger(entropy, 'initiative-tie-break', 0, 99);
			entropy = tieBreak.next;
			entropyDraws.push(tieBreak.draw);
			const initiativeBase =
				entry.actorKind === 'party'
					? missionInitiativeBase(state, entry.actorId)
					: monsterPolicy(entry.intent!.policyId).initiativeBase;
			return {
				...entry,
				initiativeBase,
				initiativeTieBreak: tieBreak.draw.value,
				initiative: initiativeBase + tieBreak.draw.value
			};
		})
		.sort(
			(left, right) =>
				right.initiative - left.initiative || left.actorId.localeCompare(right.actorId)
		);

	let positions = { ...currentAttempt.positions };
	let knowledge = { ...currentAttempt.knowledge };
	let objective = { ...currentAttempt.turnState.objective };
	let arena = { ...currentAttempt.turnState.arena };
	const missionEvidence =
		state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24
			? { ...state.mission.evidence }
			: null;
	const monsters = structuredClone(currentAttempt.turnState.monsters);
	const partyGuard = structuredClone(currentAttempt.turnState.partyGuard);
	const heroes = structuredClone(state.heroes) as EngineGameStateV18['heroes'];
	const items = structuredClone(state.items) as EngineGameStateV18['items'];
	let master = structuredClone(state.master) as EngineGameStateV18['master'];
	const parseMissionSociety = (value: unknown): SocietyStateV4 | SocietyStateV5 =>
		state.schemaVersion === 23 || state.schemaVersion === 24
			? SocietyStateV5Schema.parse(value)
			: SocietyStateV4Schema.parse(value);
	let society = parseMissionSociety(structuredClone(state.society));
	const consequences: (
		| MissionHarmRecord
		| MissionMasterHarmRecord
		| MissionConsequenceRecordV3
		| MissionConsequenceRecordV4
	)[] = [];
	const environmentEventIds = activeMissionEnvironmentEvents(state, roundNumber);
	const effects: MissionResolvedEffect[] = [];
	const resolvedPartyActions: MissionRoundV2['actions'] = [];
	const resolvedMonsterActions: MissionRoundV2['monsterActions'] = [];
	const defending = new Set<string>();
	const effect = (input: Omit<MissionResolvedEffect, 'effectId'>): MissionResolvedEffect =>
		MissionResolvedEffectSchema.parse({
			...input,
			effectId: deterministicUuid(
				`${currentAttempt.attemptId}:round:${roundNumber}:effect:${effects.length}`
			)
		});
	const applyMissionHarm = (
		sourceKind: 'monster' | 'environment',
		sourceId: string,
		targetId: string,
		amount: number
	): void => {
		if (
			(state.schemaVersion !== 16 &&
				state.schemaVersion !== 17 &&
				state.schemaVersion !== 18 &&
				state.schemaVersion !== 19 &&
				state.schemaVersion !== 20 &&
				state.schemaVersion !== 23 &&
				state.schemaVersion !== 24) ||
			amount <= 0
		)
			return;
		if (!sourceEventId) {
			throw new ReplayIntegrityError('Mission aftermath lacks a source event', state.eventCursor);
		}
		if (
			(state.schemaVersion === 17 ||
				state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23 ||
				state.schemaVersion === 24) &&
			targetId === master.masterId
		) {
			if (master.lifeState !== 'alive') return;
			const nodeId = positions[targetId]!;
			const healthBefore = master.health;
			const damage = Math.min(healthBefore, amount * (sourceKind === 'environment' ? 100 : 25));
			if (damage <= 0) return;
			const healthAfter = healthBefore - damage;
			const fatal = healthAfter === 0;
			const consequenceId = deterministicUuid(
				`${sourceEventId}:mission-master-harm:${roundNumber}:${consequences.length}`
			);
			const injury = fatal
				? null
				: InjurySchema.parse({
						injuryId: deterministicUuid(`${consequenceId}:injury`),
						kind: damage >= 50 ? 'critical' : damage >= 20 ? 'strain' : 'bruise',
						severity: damage,
						inflictedAt: state.simulatedAt
					});
			master = {
				...master,
				health: healthAfter,
				lifeState: fatal ? 'dead' : 'alive',
				injuries: injury ? [...master.injuries, injury] : master.injuries
			};
			if (fatal) {
				for (const [heroId, hero] of Object.entries(heroes)) {
					heroes[heroId] = {
						...hero,
						currentActivity: null,
						currentTravel: null,
						currentRoutine: null,
						dailyPlan: skipUnfinishedPlan(hero, state.simulatedAt)
					};
				}
			}
			const witnessHeroIds = currentAttempt.party.heroIds
				.filter((heroId) => positions[heroId] === nodeId && heroes[heroId]?.lifeState === 'active')
				.sort((left, right) => left.localeCompare(right));
			const witnesses = witnessHeroIds.map((heroId) => {
				const observationId = deterministicUuid(`${consequenceId}:${heroId}:observation`);
				const relationshipId = deterministicUuid(`${heroId}:${master.masterId}:relationship`);
				const summary = fatal
					? 'I saw the Master die after their mission guard failed. The run ended with them.'
					: 'I saw the Master wounded after their mission guard failed.';
				const deltas = fatal
					? { trust: -15, respect: -10, fear: 20, affection: 0, resentment: 5, debt: 0 }
					: { trust: 1, respect: 4, fear: 2, affection: 0, resentment: 0, debt: 0 };
				const existing = society.relationships[relationshipId];
				const dimensions = existing?.dimensions ?? {
					trust: 0,
					respect: 0,
					fear: 0,
					affection: 0,
					resentment: 0,
					debt: 0
				};
				society = parseMissionSociety({
					...society,
					observations: {
						...society.observations,
						[observationId]: {
							observationId,
							sourceEventId,
							observerHeroId: heroId,
							observedAt: state.simulatedAt,
							kind: fatal ? 'mission-death' : 'mission-injury',
							summary,
							subjectIds: [master.masterId]
						}
					},
					relationships: {
						...society.relationships,
						[relationshipId]: {
							relationshipId,
							fromHeroId: heroId,
							toEntityId: master.masterId,
							dimensions: {
								trust: clampSocial(dimensions.trust + deltas.trust),
								respect: clampSocial(dimensions.respect + deltas.respect),
								fear: clampSocial(dimensions.fear + deltas.fear),
								affection: clampSocial(dimensions.affection + deltas.affection),
								resentment: clampSocial(dimensions.resentment + deltas.resentment),
								debt: clampSocial(dimensions.debt + deltas.debt)
							},
							updatedAt: state.simulatedAt,
							lastSourceEventId: sourceEventId,
							evidence: [
								...(existing?.evidence ?? []),
								{ sourceEventId, observationId, summary, deltas }
							].slice(-64)
						}
					}
				});
				return { heroId, observationId, relationshipId };
			});
			consequences.push(
				(
					compatibilitySchemas?.consequence ??
					(state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20 ||
					state.schemaVersion === 23 ||
					state.schemaVersion === 24
						? MissionConsequenceRecordV3Schema
						: MissionMasterHarmRecordSchema)
				).parse({
					consequenceKind: 'master-harm',
					consequenceId,
					sourceEventId,
					...(state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20 ||
					state.schemaVersion === 23 ||
					state.schemaVersion === 24
						? { sourceAttemptId: currentAttempt.attemptId }
						: {}),
					sourceKind,
					sourceId,
					targetMasterId: master.masterId,
					nodeId,
					roundNumber,
					guardAfterImpact: 0,
					healthBefore,
					healthAfter,
					damage,
					injury,
					fatal,
					witnesses,
					summary: fatal
						? `The Master died at ${nodeId}; the run ended atomically.`
						: `The Master suffered ${damage} persistent damage at ${nodeId}.`
				})
			);
			return;
		}
		const hero = heroes[targetId];
		if (!hero || hero.lifeState !== 'active') return;
		const nodeId = positions[targetId]!;
		const damage = Math.min(hero.health, amount * (sourceKind === 'environment' ? 100 : 25));
		if (damage <= 0) return;
		const healthAfter = hero.health - damage;
		const fatal = healthAfter === 0;
		const consequenceId = deterministicUuid(
			`${sourceEventId}:mission-harm:${roundNumber}:${consequences.length}`
		);
		const injury = fatal
			? null
			: InjurySchema.parse({
					injuryId: deterministicUuid(`${consequenceId}:injury`),
					kind: damage >= 50 ? 'critical' : damage >= 20 ? 'strain' : 'bruise',
					severity: damage,
					inflictedAt: state.simulatedAt
				});
		const equippedItemId = hero.equipment.mainHand;
		const equippedItem = equippedItemId ? items[equippedItemId] : null;
		const itemWear =
			equippedItem && equippedItem.durability > 0
				? {
						itemId: equippedItem.itemId,
						durabilityBefore: equippedItem.durability,
						durabilityAfter: equippedItem.durability - 1
					}
				: null;
		if (itemWear && equippedItem) {
			items[equippedItem.itemId] = {
				...equippedItem,
				durability: itemWear.durabilityAfter
			};
		}
		heroes[targetId] = {
			...hero,
			health: healthAfter,
			lifeState: fatal ? 'dead' : 'active',
			injuries: injury ? [...hero.injuries, injury] : hero.injuries,
			currentActivity: fatal ? null : hero.currentActivity,
			currentTravel: fatal ? null : hero.currentTravel,
			assignment: fatal ? null : hero.assignment,
			currentRoutine: fatal ? null : hero.currentRoutine,
			dailyPlan: fatal ? skipUnfinishedPlan(hero, state.simulatedAt) : hero.dailyPlan
		};

		const witnessHeroIds = currentAttempt.party.heroIds
			.filter(
				(heroId) =>
					positions[heroId] === nodeId &&
					heroes[heroId]?.lifeState === 'active' &&
					(!fatal || heroId !== targetId)
			)
			.sort((left, right) => left.localeCompare(right));
		const witnesses = witnessHeroIds.map((heroId) => {
			const observationId = deterministicUuid(`${consequenceId}:${heroId}:observation`);
			const relationshipId = deterministicUuid(`${heroId}:${state.master.masterId}:relationship`);
			const selfWitness = heroId === targetId;
			const summary = fatal
				? 'I saw a summoned companion die after the mission guard failed.'
				: selfWitness
					? "My mission guard failed and I was wounded under the Master's command."
					: 'I saw a summoned companion wounded after the mission guard failed.';
			const deltas = fatal
				? { trust: -12, respect: -8, fear: 8, affection: 0, resentment: 16, debt: 0 }
				: selfWitness
					? { trust: -3, respect: -1, fear: 2, affection: 0, resentment: 2, debt: 0 }
					: { trust: -1, respect: -1, fear: 1, affection: 0, resentment: 1, debt: 0 };
			const existing = society.relationships[relationshipId];
			const dimensions = existing?.dimensions ?? {
				trust: 0,
				respect: 0,
				fear: 0,
				affection: 0,
				resentment: 0,
				debt: 0
			};
			society = parseMissionSociety({
				...society,
				observations: {
					...society.observations,
					[observationId]: {
						observationId,
						sourceEventId,
						observerHeroId: heroId,
						observedAt: state.simulatedAt,
						kind: fatal ? 'mission-death' : 'mission-injury',
						summary,
						subjectIds: [targetId, state.master.masterId]
					}
				},
				relationships: {
					...society.relationships,
					[relationshipId]: {
						relationshipId,
						fromHeroId: heroId,
						toEntityId: state.master.masterId,
						dimensions: {
							trust: clampSocial(dimensions.trust + deltas.trust),
							respect: clampSocial(dimensions.respect + deltas.respect),
							fear: clampSocial(dimensions.fear + deltas.fear),
							affection: clampSocial(dimensions.affection + deltas.affection),
							resentment: clampSocial(dimensions.resentment + deltas.resentment),
							debt: clampSocial(dimensions.debt + deltas.debt)
						},
						updatedAt: state.simulatedAt,
						lastSourceEventId: sourceEventId,
						evidence: [
							...(existing?.evidence ?? []),
							{ sourceEventId, observationId, summary, deltas }
						].slice(-64)
					}
				}
			});
			return { heroId, observationId, relationshipId };
		});
		consequences.push(
			(
				compatibilitySchemas?.consequence ??
				(state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23 ||
				state.schemaVersion === 24
					? MissionConsequenceRecordV3Schema
					: MissionHarmRecordSchema)
			).parse({
				consequenceId,
				sourceEventId,
				...(state.schemaVersion === 18 ||
				state.schemaVersion === 19 ||
				state.schemaVersion === 20 ||
				state.schemaVersion === 23 ||
				state.schemaVersion === 24
					? { sourceAttemptId: currentAttempt.attemptId }
					: {}),
				sourceKind,
				sourceId,
				targetHeroId: targetId,
				nodeId,
				roundNumber,
				guardAfterImpact: 0,
				healthBefore: hero.health,
				healthAfter,
				damage,
				injury,
				itemWear,
				fatal,
				witnesses,
				summary: fatal
					? `A hero died permanently at ${nodeId} after exposed ${sourceKind} harm.`
					: `A hero suffered ${damage} persistent damage at ${nodeId}; equipment wear and witnessed memory were recorded.`
			})
		);
	};
	const damageGuard = (
		sourceKind: 'monster' | 'environment',
		sourceId: string,
		targetId: string,
		amount: number,
		summary: string
	): MissionResolvedEffect => {
		const beforeState = partyGuard[targetId]!;
		const after = Math.max(0, beforeState.guard - amount);
		partyGuard[targetId] = {
			...beforeState,
			guard: after,
			status: after > 0 ? 'ready' : 'exposed',
			lastChangedOnRound: roundNumber
		};
		if (after === 0) applyMissionHarm(sourceKind, sourceId, targetId, amount);
		return effect({
			sourceKind,
			sourceId,
			targetKind: 'party',
			targetId,
			kind: 'guard-damage',
			amount,
			before: beforeState.guard,
			after,
			summary
		});
	};

	for (const eventId of environmentEventIds) {
		const hazardNodeId = eventId === 'first-ember-pulse' ? 'ember-vault' : null;
		if (!hazardNodeId) continue;
		for (const actorId of currentAttempt.party.memberIds) {
			if (positions[actorId] !== hazardNodeId) continue;
			const applied = damageGuard(
				'environment',
				eventId,
				actorId,
				1,
				eventId === 'red-slag-fall'
					? 'The Red Gallery slag fall stripped 1 mission guard beneath the vents.'
					: 'The First Ember pulse stripped 1 mission guard in the Ember Vault.'
			);
			effects.push(applied);
		}
	}

	for (const entry of ranked) {
		if (entry.actorKind === 'party') {
			const choice = entry.choice!;
			const fromNodeId = positions[choice.actorId]!;
			let toNodeId = fromNodeId;
			let targetId: string | null = null;
			let discoveryIds: string[] = [];
			let objectiveTransition: 'recovered' | 'delivered' | null = null;
			let outcome: 'applied' | 'superseded' = 'applied';
			let summary: string;
			const effectIds: string[] = [];
			const fallenActor =
				(choice.actorId === master.masterId && master.lifeState === 'dead') ||
				heroes[choice.actorId]?.lifeState === 'dead';

			if (fallenActor) {
				outcome = 'superseded';
				summary =
					choice.actorId === master.masterId
						? 'The Master died before their declared action reached initiative.'
						: 'The hero fell before their declared action reached initiative.';
			} else if (choice.actionId.startsWith(MISSION_MOVE_PREFIX)) {
				const edgeId = choice.actionId.slice(MISSION_MOVE_PREFIX.length);
				const edge = missionContent.arena.edges.find((candidate) => candidate.edgeId === edgeId)!;
				toNodeId =
					edge.fromNodeId === fromNodeId
						? edge.toNodeId
						: edge.bidirectional && edge.toNodeId === fromNodeId
							? edge.fromNodeId
							: fromNodeId;
				positions = { ...positions, [choice.actorId]: toNodeId };
				knowledge = visitMissionNode(missionContent, toNodeId, knowledge);
				summary = `Moved from ${fromNodeId} to ${toNodeId}.`;
			} else if (choice.actionId.startsWith(MISSION_INSPECT_PREFIX)) {
				const affordanceId = choice.actionId.slice(MISSION_INSPECT_PREFIX.length);
				const toolTags = missionToolTagsForActor(state, choice.actorId);
				const legal = listLegalMissionDiscoveryAffordances(
					missionContent,
					fromNodeId,
					knowledge,
					toolTags
				).some((candidate) => candidate.affordanceId === affordanceId);
				if (legal) {
					const before = new Set(knowledge.discoveryIds);
					knowledge = applyMissionDiscoveryAffordance(
						missionContent,
						affordanceId,
						knowledge,
						toolTags
					);
					discoveryIds = knowledge.discoveryIds.filter((id) => !before.has(id));
					if (
						(state.schemaVersion === 14 ||
							state.schemaVersion === 16 ||
							state.schemaVersion === 17 ||
							state.schemaVersion === 18 ||
							state.schemaVersion === 19 ||
							state.schemaVersion === 20 ||
							state.schemaVersion === 23 ||
							state.schemaVersion === 24) &&
						missionContent.missionId === 'tower-floor-04' &&
						discoveryIds.includes('foundry-maintenance-route')
					) {
						const evidenceId = deterministicUuid(
							`${currentAttempt.attemptId}:${choice.actorId}:foundry-maintenance-route`
						);
						missionEvidence![evidenceId] = {
							evidenceId,
							evidenceKey: 'foundry-maintenance-route',
							holderActorId: choice.actorId,
							sourceBinding: state.mission.binding,
							sourceAttemptId: currentAttempt.attemptId,
							discoveredOnRound: roundNumber
						};
					}
					if (
						(state.schemaVersion === 14 ||
							state.schemaVersion === 16 ||
							state.schemaVersion === 17 ||
							state.schemaVersion === 18 ||
							state.schemaVersion === 19 ||
							state.schemaVersion === 20 ||
							state.schemaVersion === 23 ||
							state.schemaVersion === 24) &&
						missionContent.missionId === 'tower-floor-05' &&
						discoveryIds.includes('foundry-maintenance-route')
					) {
						arena = { ...arena, coolingControlExposed: true };
					}
					summary = `Resolved ${affordanceId} and revealed ${discoveryIds.join(', ')}.`;
				} else {
					outcome = 'superseded';
					summary = `${affordanceId} had already been resolved earlier in initiative.`;
				}
			} else if (choice.actionId.startsWith(MISSION_RECOVER_PREFIX)) {
				if (objective.status === 'available') {
					objective = {
						...objective,
						status: 'carried',
						carrierId: choice.actorId,
						recoveredOnRound: roundNumber
					};
					objectiveTransition = 'recovered';
					summary = 'Lifted the First Ember from its cradle and became its carrier.';
				} else {
					outcome = 'superseded';
					summary = 'The First Ember was already carried when this action resolved.';
				}
			} else if (choice.actionId === MISSION_COOLING_CONTROL_ACTION_ID) {
				const before = arena.furnaceState;
				const after = before === 'lit' ? 'cooling' : before === 'cooling' ? 'quenched' : before;
				if (
					(state.schemaVersion !== 14 &&
						state.schemaVersion !== 16 &&
						state.schemaVersion !== 17 &&
						state.schemaVersion !== 18 &&
						state.schemaVersion !== 19 &&
						state.schemaVersion !== 20 &&
						state.schemaVersion !== 23 &&
						state.schemaVersion !== 24) ||
					fromNodeId !== arena.coolingControlNodeId ||
					!knowledge.discoveryIds.includes('cooling-control-weakness') ||
					after === before
				) {
					outcome = 'superseded';
					summary = 'The cooling wheel could not change the furnace in this state.';
				} else {
					arena = { ...arena, furnaceState: after };
					const applied = effect({
						sourceKind: 'party',
						sourceId: choice.actorId,
						targetKind: 'arena',
						targetId: 'foundry-furnace',
						kind: 'furnace-change',
						amount: 1,
						before: null,
						after: null,
						summary: `The cooling wheel changed the furnace from ${before} to ${after}.`
					});
					effects.push(applied);
					effectIds.push(applied.effectId);
					summary = applied.summary;
				}
			} else if (choice.actionId.startsWith(MISSION_ATTACK_PREFIX)) {
				targetId = choice.actionId.slice(MISSION_ATTACK_PREFIX.length);
				const monster = monsters[targetId];
				if (!monster || monster.status !== 'active' || monster.nodeId !== fromNodeId) {
					outcome = 'superseded';
					summary = 'The selected threat was no longer a legal co-located target.';
				} else {
					const before = monster.vitality;
					const raw = missionAttackPower(state, choice.actorId);
					const reduction = monsterArmorReduction(monster.policyId, arena.furnaceState);
					const amount = Math.min(before, Math.max(0, raw - reduction));
					const after = before - amount;
					monsters[targetId] = {
						...monster,
						vitality: after,
						status: after === 0 ? 'defeated' : 'active',
						alertState: after === 0 ? monster.alertState : 'engaged',
						defeatedOnRound: after === 0 ? roundNumber : null
					};
					const applied = effect({
						sourceKind: 'party',
						sourceId: choice.actorId,
						targetKind: 'monster',
						targetId,
						kind: 'vitality-damage',
						amount,
						before,
						after,
						summary:
							amount > 0
								? `${monster.label} lost ${amount} vitality after ${reduction} armor reduction.`
								: `${monster.label}'s armor absorbed the ${raw}-power strike.`
					});
					effects.push(applied);
					effectIds.push(applied.effectId);
					summary =
						after === 0
							? `${monster.label} was defeated by an engine-resolved strike.`
							: `${monster.label} remains active at ${after}/${monster.maximumVitality} vitality.`;
				}
			} else {
				defending.add(choice.actorId);
				summary =
					'Held position; earlier initiative reduces incoming guard damage by 1 this round.';
			}

			if (
				objective.status === 'carried' &&
				objective.carrierId === choice.actorId &&
				positions[choice.actorId] === currentAttempt.extractionNodeId
			) {
				objective = {
					...objective,
					status: 'delivered',
					carrierId: null,
					deliveredOnRound: roundNumber
				};
				objectiveTransition = 'delivered';
				summary += ' The carrier returned the objective to the Tower Threshold.';
			}

			resolvedPartyActions.push({
				actorId: choice.actorId,
				actorKind: choice.actorId === currentAttempt.party.masterId ? 'master' : 'hero',
				actionId: choice.actionId,
				choiceSource: choice.source,
				policyId: choice.policyId,
				packetHash: choice.packetHash,
				legalActionHash: choice.legalActionHash,
				policyResultHash: choice.policyResultHash,
				publicIntent: choice.publicIntent,
				initiativeBase: entry.initiativeBase,
				initiativeTieBreak: entry.initiativeTieBreak,
				initiative: entry.initiative,
				outcome,
				fromNodeId,
				toNodeId,
				targetId,
				discoveryIds,
				objectiveTransition,
				effectIds,
				summary
			});
			continue;
		}

		const intent = entry.intent!;
		const monster = monsters[intent.monsterId]!;
		const fromNodeId = monster.nodeId;
		let toNodeId = fromNodeId;
		let outcome: 'applied' | 'superseded' = 'applied';
		let summary: string;
		const effectIds: string[] = [];
		if (monster.status !== 'active') {
			outcome = 'superseded';
			summary = `${monster.label} was defeated before its telegraphed action resolved.`;
		} else if (intent.kind === 'move') {
			const legalMove = missionContent.arena.edges.some(
				(edge) =>
					edge.access.kind === 'open' &&
					((edge.fromNodeId === fromNodeId && edge.toNodeId === intent.toNodeId) ||
						(edge.bidirectional &&
							edge.toNodeId === fromNodeId &&
							edge.fromNodeId === intent.toNodeId))
			);
			if (!legalMove) {
				outcome = 'superseded';
				summary = `${monster.label} could not follow its authored duty edge.`;
			} else {
				toNodeId = intent.toNodeId;
				monsters[intent.monsterId] = {
					...monster,
					nodeId: toNodeId,
					lastActionId: intent.actionId
				};
				summary = `${monster.label} moved from ${fromNodeId} to ${toNodeId}.`;
			}
		} else if (intent.kind === 'alarm') {
			monsters[intent.monsterId] = {
				...monster,
				alertState: 'alarmed',
				lastActionId: intent.actionId
			};
			const applied = effect({
				sourceKind: 'monster',
				sourceId: intent.monsterId,
				targetKind: 'arena',
				targetId: monster.dutySlotId,
				kind: 'alarm',
				amount: 0,
				before: null,
				after: null,
				summary: `${monster.label} raised the cradle alarm and entered an alarmed duty state.`
			});
			effects.push(applied);
			effectIds.push(applied.effectId);
			summary = applied.summary;
		} else if (
			intent.kind === 'strike' ||
			intent.kind === 'furnace-surge' ||
			intent.kind === 'defend-control'
		) {
			const targetId = intent.targetId!;
			const impactNodeId = intent.kind === 'defend-control' ? intent.toNodeId : monster.nodeId;
			const interceptIsAuthored =
				intent.kind !== 'defend-control' ||
				missionContent.arena.edges.some(
					(edge) =>
						(edge.fromNodeId === monster.nodeId && edge.toNodeId === impactNodeId) ||
						(edge.bidirectional &&
							edge.toNodeId === monster.nodeId &&
							edge.fromNodeId === impactNodeId)
				);
			if (
				positions[targetId] !== impactNodeId ||
				!interceptIsAuthored ||
				((state.schemaVersion === 16 ||
					state.schemaVersion === 17 ||
					state.schemaVersion === 18 ||
					state.schemaVersion === 19 ||
					state.schemaVersion === 20 ||
					state.schemaVersion === 23 ||
					state.schemaVersion === 24) &&
					((targetId === master.masterId && master.lifeState === 'dead') ||
						heroes[targetId]?.lifeState === 'dead'))
			) {
				outcome = 'superseded';
				summary =
					(state.schemaVersion === 16 ||
						state.schemaVersion === 17 ||
						state.schemaVersion === 18 ||
						state.schemaVersion === 19 ||
						state.schemaVersion === 20 ||
						state.schemaVersion === 23 ||
						state.schemaVersion === 24) &&
					((targetId === master.masterId && master.lifeState === 'dead') ||
						heroes[targetId]?.lifeState === 'dead')
						? `${monster.label}'s target had already fallen before impact.`
						: `${monster.label}'s target left the threatened node before impact.`;
			} else {
				toNodeId = impactNodeId;
				const basePower = monsterPolicy(monster.policyId).strikePower;
				const surge = intent.kind === 'furnace-surge' && arena.furnaceState === 'lit' ? 1 : 0;
				const amount = Math.max(0, basePower + surge - (defending.has(targetId) ? 1 : 0));
				const applied = damageGuard(
					'monster',
					intent.monsterId,
					targetId,
					amount,
					`${monster.label} dealt ${amount} mission-guard damage${defending.has(targetId) ? ' after defense' : ''}.`
				);
				effects.push(applied);
				effectIds.push(applied.effectId);
				monsters[intent.monsterId] = {
					...monster,
					nodeId: toNodeId,
					alertState: 'engaged',
					lastActionId: intent.actionId
				};
				summary = applied.summary;
			}
		} else {
			monsters[intent.monsterId] = { ...monster, lastActionId: intent.actionId };
			summary = `${monster.label} held its authored duty position.`;
		}

		resolvedMonsterActions.push({
			monsterId: intent.monsterId,
			policyId: intent.policyId,
			actionId: intent.actionId,
			kind: intent.kind,
			initiativeBase: entry.initiativeBase,
			initiativeTieBreak: entry.initiativeTieBreak,
			initiative: entry.initiative,
			outcome,
			fromNodeId,
			toNodeId,
			targetId: intent.targetId,
			effectIds,
			summary
		});
	}

	if (
		(state.schemaVersion === 16 ||
			state.schemaVersion === 17 ||
			state.schemaVersion === 18 ||
			state.schemaVersion === 19 ||
			state.schemaVersion === 20 ||
			state.schemaVersion === 23 ||
			state.schemaVersion === 24) &&
		environmentEventIds.includes('red-slag-fall')
	) {
		for (const actorId of currentAttempt.party.memberIds) {
			if (positions[actorId] !== 'red-gallery') continue;
			const applied = damageGuard(
				'environment',
				'red-slag-fall',
				actorId,
				1,
				'The Red Gallery slag fall stripped 1 mission guard beneath the vents.'
			);
			effects.push(applied);
		}
	}

	const objectiveDefinition = missionContent.objectives.find(
		(candidate) => candidate.objectiveId === objective.objectiveId
	)!;
	const completionRule = objectiveDefinition.completionRule;
	if (objective.status === 'available' && completionRule.kind === 'defeat-duty') {
		const dutyMonsters = Object.values(monsters).filter(
			(monster) => monster.dutySlotId === completionRule.dutySlotId
		);
		if (dutyMonsters.length > 0 && dutyMonsters.every((monster) => monster.status === 'defeated')) {
			objective = {
				...objective,
				status: 'delivered',
				carrierId: null,
				recoveredOnRound: roundNumber,
				deliveredOnRound: roundNumber
			};
		}
	}

	const allAtThreshold = currentAttempt.party.memberIds.every(
		(actorId) => positions[actorId] === currentAttempt.extractionNodeId
	);
	const extractionReady = objective.status === 'delivered' && allAtThreshold;
	const exhausted = roundNumber >= currentAttempt.turnState.maximumRounds && !extractionReady;
	const fatal = consequences.some((consequence) => consequence.fatal);
	const masterFatal = consequences.some(
		(consequence) => 'consequenceKind' in consequence && consequence.fatal
	);
	const statusAfter = fatal
		? 'death'
		: extractionReady
			? 'extraction'
			: exhausted
				? 'failure'
				: 'resolving';
	const round = MissionRoundV2Schema.parse({
		roundVersion: 'mission-round-v2',
		roundNumber,
		stateVersion: state.version,
		environmentEventIds,
		threatIntents: currentAttempt.turnState.currentThreatIntents,
		monsterActionIds: resolvedMonsterActions.map((action) => action.actionId),
		initiativeOrder: ranked.map((entry) => entry.actorId),
		actions: resolvedPartyActions,
		monsterActions: resolvedMonsterActions,
		effects,
		statusAfter
	});
	const completedObjectiveIds = objective.status === 'delivered' ? [objective.objectiveId] : [];
	const nextThreatIntents =
		statusAfter === 'resolving'
			? deriveMonsterIntents(missionContent, currentAttempt, monsters, positions, objective, arena)
			: [];
	const missionSchema =
		compatibilitySchemas?.mission ??
		(state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24
			? MissionRunStateV8Schema
			: state.schemaVersion === 17
				? MissionRunStateV7Schema
				: state.schemaVersion === 16
					? MissionRunStateV6Schema
					: state.schemaVersion === 14
						? MissionRunStateV4Schema
						: MissionRunStateV3Schema);
	const mission = missionSchema.parse({
		...state.mission,
		...(state.schemaVersion === 14 ||
		state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24
			? { evidence: missionEvidence }
			: {}),
		...(state.schemaVersion === 16 ||
		state.schemaVersion === 17 ||
		state.schemaVersion === 18 ||
		state.schemaVersion === 19 ||
		state.schemaVersion === 20 ||
		state.schemaVersion === 23 ||
		state.schemaVersion === 24
			? {
					aftermath: {
						...state.mission.aftermath,
						consequences: [...state.mission.aftermath.consequences, ...consequences]
					}
				}
			: {}),
		attempt: {
			...currentAttempt,
			status: statusAfter,
			positions,
			knowledge,
			completedObjectiveIds,
			extractionOpenedAt: extractionReady ? state.simulatedAt : null,
			endedAt: fatal || exhausted ? state.simulatedAt : null,
			outcome: fatal ? 'death' : exhausted ? 'failure' : null,
			turnState: {
				...currentAttempt.turnState,
				roundNumber,
				objective,
				monsters,
				partyGuard,
				arena,
				currentThreatIntents: nextThreatIntents,
				rounds: [...currentAttempt.turnState.rounds, round]
			}
		}
	});
	const resolution = {
		mission,
		round,
		choices,
		entropyCursor: entropy.cursor,
		entropyDraws,
		consequences,
		heroes,
		items,
		society,
		master,
		status: masterFatal ? 'game_over' : state.status
	};
	return compatibilitySchemas
		? (resolution as LegacyV24CombatResolution)
		: (resolution as MissionCombatTurnResolution);
}

export function resolveMissionCombatTurn(
	state: MissionCombatResolverState,
	choicesInput: readonly MissionTurnChoice[],
	sourceEventId: string | null = null
): MissionCombatTurnResolution {
	return resolveMissionCombatTurnCore(
		state,
		choicesInput,
		sourceEventId,
		null
	) as MissionCombatTurnResolution;
}

export function resolveLegacyV24CombatTurn(
	state: LegacyV24CombatResolverState,
	choicesInput: readonly MissionTurnChoice[],
	sourceEventId: string | null,
	compatibilitySchemas: LegacyV24CombatSchemas
): LegacyV24CombatResolution {
	return resolveMissionCombatTurnCore(
		state,
		choicesInput,
		sourceEventId,
		compatibilitySchemas
	) as LegacyV24CombatResolution;
}
