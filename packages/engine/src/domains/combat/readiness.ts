import {
	CombatLegalActionSchema,
	CombatResultSchema,
	CombatRulesV1Schema,
	ReadinessCombatStateV1Schema,
	type CombatLegalAction,
	type CombatResult,
	type CombatRulesV1,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';

import { deterministicUuid, hashCanonical } from '../../hash.js';
import { healthRegeneration, manaRegeneration } from './capability.js';

export type ReadyCohortAdvance =
	| Readonly<{
			kind: 'decision-window';
			state: ReadinessCombatStateV1;
			readyActorIds: readonly string[];
	  }>
	| Readonly<{
			kind: 'combat-result';
			state: ReadinessCombatStateV1;
			result: CombatResult;
	  }>;

function readyActorIds(state: ReadinessCombatStateV1, rules: CombatRulesV1): string[] {
	return Object.values(state.combatants)
		.filter(
			(combatant) =>
				combatant.active &&
				!combatant.downed &&
				combatant.readiness.value >= rules.readiness.threshold &&
				combatant.readiness.recoveryUntilTick <= state.tick
		)
		.map((combatant) => combatant.combatantId)
		.sort((left, right) => left.localeCompare(right));
}

function safetyResult(
	state: ReadinessCombatStateV1,
	reason: 'total-ticks' | 'emitted-events' | 'no-progress-cycles'
): ReadyCohortAdvance {
	const safetyStop = {
		safetyStopVersion: 'combat-safety-stop-v1' as const,
		reason,
		disposition: 'diagnostic' as const,
		...state.safety
	};
	const resultWithoutHash = {
		resultVersion: 'combat-result-v1' as const,
		resultId: deterministicUuid(
			`${state.attemptId}:readiness-safety-stop:${reason}:${state.tick}:${hashCanonical(state.safety)}`
		),
		attemptId: state.attemptId,
		modeId: 'agent-readiness-v1' as const,
		rulesVersion: 'combat-rules-v1' as const,
		outcome: 'safety-stop' as const,
		endedAtTick: state.tick,
		finalCombatants: state.combatants,
		claims: [],
		decisiveEventIds: [],
		safetyStop
	};
	const result = CombatResultSchema.parse({
		...resultWithoutHash,
		traceHash: hashCanonical(resultWithoutHash)
	});
	const completed = ReadinessCombatStateV1Schema.parse({
		...state,
		status: 'complete',
		result
	});
	return { kind: 'combat-result', state: completed, result };
}

function requireCombatant(state: ReadinessCombatStateV1, combatantId: string) {
	const combatant = state.combatants[combatantId];
	if (!combatant)
		throw new Error(`Scheduled combat effect references unknown combatant ${combatantId}`);
	return combatant;
}

function applyScheduledEffect(
	state: ReadinessCombatStateV1,
	scheduled: ReadinessCombatStateV1['scheduledEffects'][number]
): void {
	for (const effect of scheduled.effects) {
		const combatant = requireCombatant(state, effect.combatantId);
		if (effect.kind === 'resource') {
			const resource = combatant.resources[effect.resource];
			if (resource.current !== effect.before || effect.after > resource.maximum) {
				throw new Error(
					`Scheduled resource effect ${scheduled.scheduledEffectId} does not bind to combat state`
				);
			}
			resource.current = effect.after;
			if (effect.resource === 'health' && effect.delta < 0) {
				combatant.lastDamagedAtTick = state.tick;
			}
		} else if (effect.kind === 'position') {
			if (combatant.position.x !== effect.before.x || combatant.position.y !== effect.before.y) {
				throw new Error(
					`Scheduled position effect ${scheduled.scheduledEffectId} does not bind to combat state`
				);
			}
			combatant.position = effect.after;
		} else if (effect.kind === 'condition') {
			const conditionIndex = combatant.conditions.findIndex(
				(condition) => condition.conditionId === effect.condition.conditionId
			);
			if (effect.operation === 'applied') {
				if (conditionIndex !== -1) {
					throw new Error(
						`Scheduled condition effect ${scheduled.scheduledEffectId} duplicates a condition`
					);
				}
				combatant.conditions.push(effect.condition);
			} else {
				if (conditionIndex === -1) {
					throw new Error(
						`Scheduled condition effect ${scheduled.scheduledEffectId} removes a missing condition`
					);
				}
				combatant.conditions.splice(conditionIndex, 1);
			}
		} else {
			combatant.resources.health.current = 0;
			combatant.downed = true;
			combatant.active = false;
		}
	}
}

function resolveDueScheduledEffects(
	state: ReadinessCombatStateV1,
	rules: CombatRulesV1
): ReadyCohortAdvance | null {
	const due = state.scheduledEffects
		.filter((effect) => effect.resolvesAtTick <= state.tick)
		.sort(
			(left, right) =>
				left.resolvesAtTick - right.resolvesAtTick ||
				left.scheduledEffectId.localeCompare(right.scheduledEffectId)
		);
	if (state.safety.eventsEmitted + due.length > rules.readiness.safety.maximumEventsEmitted) {
		return safetyResult(state, 'emitted-events');
	}
	for (const effect of due) applyScheduledEffect(state, effect);
	if (due.length > 0) {
		const dueIds = new Set(due.map((effect) => effect.scheduledEffectId));
		state.scheduledEffects = state.scheduledEffects.filter(
			(effect) => !dueIds.has(effect.scheduledEffectId)
		);
		state.safety.eventsEmitted += due.length;
	}
	return null;
}

function regenerateAndAccumulate(state: ReadinessCombatStateV1, rules: CombatRulesV1): void {
	for (const combatant of Object.values(state.combatants)) {
		combatant.conditions = combatant.conditions.filter(
			(condition) => condition.expiresAtTick === null || condition.expiresAtTick > state.tick
		);
		if (!combatant.active || combatant.downed) continue;

		const ticksSinceDamage =
			combatant.lastDamagedAtTick === null ? null : state.tick - combatant.lastDamagedAtTick;
		if (combatant.resources.health.current > 0) {
			combatant.resources.health.current = Math.min(
				combatant.resources.health.maximum,
				combatant.resources.health.current +
					healthRegeneration(
						combatant.attributes.vitality,
						{ mode: 'combat', downed: false, ticksSinceDamage, injuryRepair: false },
						rules
					)
			);
		}
		combatant.resources.mana.current = Math.min(
			combatant.resources.mana.maximum,
			combatant.resources.mana.current +
				manaRegeneration(
					combatant.attributes.spirit,
					{ mode: 'combat', downed: false, ticksSinceDamage, injuryRepair: false },
					rules
				)
		);

		if (state.tick < combatant.readiness.recoveryUntilTick) continue;
		const gain =
			rules.readiness.baseGainPerTick +
			combatant.attributes.agility * rules.readiness.agilityGainPerTick;
		const exactNumerator = combatant.readiness.exactNumerator + gain;
		if (!Number.isSafeInteger(exactNumerator)) {
			throw new Error(
				`Readiness numerator exceeded safe integer range for ${combatant.combatantId}`
			);
		}
		combatant.readiness.exactNumerator = exactNumerator;
		combatant.readiness.value = Math.min(rules.readiness.threshold, exactNumerator);
	}
}

/**
 * Advances canonical combat time to exactly one logical-tick readiness cohort.
 * Task 3 owns conversion of this private boundary into frozen snapshots and actor views.
 */
export function advanceUntilReadyCohort(
	stateInput: ReadinessCombatStateV1,
	rulesInput: CombatRulesV1
): ReadyCohortAdvance {
	const state = ReadinessCombatStateV1Schema.parse(stateInput);
	const rules = CombatRulesV1Schema.parse(rulesInput);
	if (state.status === 'complete') {
		if (!state.result) throw new Error('Complete readiness combat state is missing its result');
		return { kind: 'combat-result', state, result: state.result };
	}

	for (;;) {
		const currentTickStop = resolveDueScheduledEffects(state, rules);
		if (currentTickStop) return currentTickStop;
		const ready = readyActorIds(state, rules);
		if (ready.length > 0) return { kind: 'decision-window', state, readyActorIds: ready };

		const canProgress =
			Object.values(state.combatants).some((combatant) => combatant.active && !combatant.downed) ||
			state.scheduledEffects.length > 0;
		if (!canProgress) {
			state.safety.noProgressCycles += 1;
			if (state.safety.noProgressCycles >= rules.readiness.safety.maximumNoProgressCycles) {
				return safetyResult(state, 'no-progress-cycles');
			}
			continue;
		}

		if (state.safety.ticksAdvanced >= rules.readiness.safety.maximumTicksAdvanced) {
			return safetyResult(state, 'total-ticks');
		}
		state.tick += 1;
		state.safety.ticksAdvanced += 1;
		state.safety.noProgressCycles = 0;

		const stopped = resolveDueScheduledEffects(state, rules);
		if (stopped) return stopped;
		regenerateAndAccumulate(state, rules);
	}
}

/** Applies the readiness threshold and authored recovery only after a legal action is chosen. */
export function applyReadinessActionCost(
	stateInput: ReadinessCombatStateV1,
	actorId: string,
	actionInput: CombatLegalAction,
	rulesInput: CombatRulesV1
): ReadinessCombatStateV1 {
	const state = ReadinessCombatStateV1Schema.parse(stateInput);
	const rules = CombatRulesV1Schema.parse(rulesInput);
	const action = CombatLegalActionSchema.parse(actionInput);
	const actor = state.combatants[actorId];
	if (!actor || !actor.active || actor.downed)
		throw new Error('Only an active actor can pay readiness');
	if (
		actor.readiness.value < rules.readiness.threshold ||
		actor.readiness.recoveryUntilTick > state.tick
	) {
		throw new Error('Actor is not ready to pay an action cost');
	}
	const exactNumerator = actor.readiness.exactNumerator - rules.readiness.threshold;
	actor.readiness.exactNumerator = Math.max(0, exactNumerator);
	actor.readiness.value = Math.min(rules.readiness.threshold, actor.readiness.exactNumerator);
	actor.readiness.recoveryUntilTick = state.tick + action.recoveryTicks;
	return ReadinessCombatStateV1Schema.parse(state);
}
