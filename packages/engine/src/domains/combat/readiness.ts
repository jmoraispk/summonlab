import {
	CombatLegalActionSchema,
	CombatRulesV1Schema,
	ReadinessCombatStateV1Schema,
	type CombatLegalAction,
	type CombatResult,
	type CombatRulesV1,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import type { ZodError } from 'zod';

import { healthRegeneration, manaRegeneration } from './capability.js';
import {
	appendReadinessEmittedEventIds,
	finalizeReadinessCombatIfTerminal,
	finalizeReadinessCombatOutcome,
	recordReadinessOutcomeDamage,
	synchronizeReadinessOutcomeEvidence
} from './outcome.js';

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

export type ReadinessActionCostResult =
	| Readonly<{ kind: 'applied'; state: ReadinessCombatStateV1 }>
	| Extract<ReadyCohortAdvance, { kind: 'combat-result' }>;

type ReadinessSafetyReason = Exclude<
	NonNullable<CombatResult['safetyStop']>['reason'],
	'provider-budget'
>;

function safeAdd(left: number, right: number): number | null {
	if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return null;
	const sum = left + right;
	return Number.isSafeInteger(sum) ? sum : null;
}

function safeMultiply(left: number, right: number): number | null {
	if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) return null;
	const product = BigInt(left) * BigInt(right);
	return product <= BigInt(Number.MAX_SAFE_INTEGER) && product >= BigInt(Number.MIN_SAFE_INTEGER)
		? Number(product)
		: null;
}

function hasConsistentReadinessProjection(
	state: ReadinessCombatStateV1,
	rules: CombatRulesV1
): boolean {
	return Object.values(state.combatants).every(
		(combatant) =>
			combatant.readiness.value ===
			Math.min(rules.readiness.threshold, combatant.readiness.exactNumerator)
	);
}

function readyActorIds(state: ReadinessCombatStateV1, rules: CombatRulesV1): string[] {
	return Object.values(state.combatants)
		.filter(
			(combatant) =>
				combatant.active &&
				!combatant.downed &&
				combatant.readiness.exactNumerator >= rules.readiness.threshold &&
				combatant.readiness.recoveryUntilTick <= state.tick
		)
		.map((combatant) => combatant.combatantId)
		.sort((left, right) => left.localeCompare(right));
}

function safetyResult(
	state: ReadinessCombatStateV1,
	reason: ReadinessSafetyReason
): Extract<ReadyCohortAdvance, { kind: 'combat-result' }> {
	const safetyStop = {
		safetyStopVersion: 'combat-safety-stop-v1' as const,
		reason,
		disposition: 'diagnostic' as const,
		...state.safety
	};
	const finalized = finalizeReadinessCombatOutcome({
		state,
		safetyStop
	});
	return { kind: 'combat-result', ...finalized };
}

function ordinaryTerminalResult(
	state: ReadinessCombatStateV1
): Extract<ReadyCohortAdvance, { kind: 'combat-result' }> | null {
	const finalized = finalizeReadinessCombatIfTerminal(state);
	return finalized ? { kind: 'combat-result', ...finalized } : null;
}

function actorContextFailureResult(
	state: ReadinessCombatStateV1,
	validationError: ZodError<ReadinessCombatStateV1>
): Extract<ReadyCohortAdvance, { kind: 'combat-result' }> {
	const isActorContextOnlyFailure =
		validationError.issues.length > 0 &&
		validationError.issues.every((issue) => issue.path[0] === 'actorContexts');
	if (!isActorContextOnlyFailure) throw validationError;

	// Completing the state exempts it from live actor-context requirements. Parsing inside
	// safetyResult then proves every remaining canonical field before returning the typed stop.
	return safetyResult({ ...state, actorContexts: {} }, 'invalid-state');
}

function applyScheduledEffect(
	state: ReadinessCombatStateV1,
	scheduled: ReadinessCombatStateV1['scheduledEffects'][number]
): boolean {
	for (const effect of scheduled.effects) {
		const combatant = state.combatants[effect.combatantId];
		if (!combatant) return false;
		if (effect.kind === 'resource') {
			const resource = combatant.resources[effect.resource];
			if (resource.current !== effect.before || effect.after > resource.maximum) {
				return false;
			}
			resource.current = effect.after;
			if (effect.resource === 'health' && effect.delta < 0) {
				recordReadinessOutcomeDamage(state, effect.combatantId, -effect.delta);
			}
			if (effect.resource === 'health' && effect.delta < 0) {
				combatant.lastDamagedAtTick = state.tick;
			}
		} else if (effect.kind === 'position') {
			if (combatant.position.x !== effect.before.x || combatant.position.y !== effect.before.y) {
				return false;
			}
			const destinationIsBlocked = state.terrain.blockedTiles.some(
				(position) => position.x === effect.after.x && position.y === effect.after.y
			);
			const destinationIsOccupied = Object.values(state.combatants).some(
				(other) =>
					other.combatantId !== combatant.combatantId &&
					other.position.x === effect.after.x &&
					other.position.y === effect.after.y
			);
			if (
				effect.after.x >= state.terrain.width ||
				effect.after.y >= state.terrain.height ||
				destinationIsBlocked ||
				destinationIsOccupied
			) {
				return false;
			}
			combatant.position = effect.after;
		} else if (effect.kind === 'condition') {
			const conditionIndex = combatant.conditions.findIndex(
				(condition) => condition.conditionId === effect.condition.conditionId
			);
			if (effect.operation === 'applied') {
				if (conditionIndex !== -1) {
					return false;
				}
				combatant.conditions.push(effect.condition);
			} else {
				if (conditionIndex === -1) {
					return false;
				}
				combatant.conditions.splice(conditionIndex, 1);
			}
		} else {
			recordReadinessOutcomeDamage(state, effect.combatantId, combatant.resources.health.current);
			if (combatant.resources.health.current > 0) combatant.lastDamagedAtTick = state.tick;
			combatant.resources.health.current = 0;
			combatant.downed = true;
			combatant.active = false;
		}
	}
	return true;
}

type ScheduledEffectsResolution =
	| Readonly<{ kind: 'applied'; state: ReadinessCombatStateV1 }>
	| Readonly<{
			kind: 'safety-stop';
			reason: 'emitted-events' | 'arithmetic-overflow' | 'invalid-scheduled-effect';
	  }>;

function resolveDueScheduledEffects(
	state: ReadinessCombatStateV1,
	rules: CombatRulesV1
): ScheduledEffectsResolution {
	const candidate = ReadinessCombatStateV1Schema.parse(state);
	const due = candidate.scheduledEffects
		.filter((effect) => effect.resolvesAtTick <= state.tick)
		.sort(
			(left, right) =>
				left.resolvesAtTick - right.resolvesAtTick ||
				left.scheduledEffectId.localeCompare(right.scheduledEffectId)
		);
	const nextEventsEmitted = safeAdd(candidate.safety.eventsEmitted, due.length);
	if (nextEventsEmitted === null) return { kind: 'safety-stop', reason: 'arithmetic-overflow' };
	if (nextEventsEmitted > rules.readiness.safety.maximumEventsEmitted) {
		return { kind: 'safety-stop', reason: 'emitted-events' };
	}
	for (const effect of due) {
		if (!applyScheduledEffect(candidate, effect)) {
			return { kind: 'safety-stop', reason: 'invalid-scheduled-effect' };
		}
	}
	if (due.length > 0) {
		const dueIds = new Set(due.map((effect) => effect.scheduledEffectId));
		candidate.scheduledEffects = candidate.scheduledEffects.filter(
			(effect) => !dueIds.has(effect.scheduledEffectId)
		);
		candidate.safety.eventsEmitted = nextEventsEmitted;
		appendReadinessEmittedEventIds(
			candidate,
			due.map((effect) => effect.scheduledEffectId)
		);
		synchronizeReadinessOutcomeEvidence(candidate);
	}
	const parsed = ReadinessCombatStateV1Schema.safeParse(candidate);
	return parsed.success
		? { kind: 'applied', state: parsed.data }
		: { kind: 'safety-stop', reason: 'invalid-scheduled-effect' };
}

function regenerateAndAccumulate(state: ReadinessCombatStateV1, rules: CombatRulesV1): boolean {
	for (const combatant of Object.values(state.combatants)) {
		combatant.conditions = combatant.conditions.filter(
			(condition) => condition.expiresAtTick === null || condition.expiresAtTick > state.tick
		);
		if (!combatant.active || combatant.downed) continue;
		const healthRecoveryBase = safeAdd(
			rules.health.safeRestRegenerationBase,
			Math.floor(combatant.attributes.vitality / rules.health.safeRestRegenerationVitalityDivisor)
		);
		const manaSaturationDenominator = safeAdd(
			combatant.attributes.spirit,
			rules.mana.regenerationSaturationConstant
		);
		const manaBonusNumerator = safeMultiply(
			rules.mana.regenerationSpiritBonus,
			combatant.attributes.spirit
		);
		if (
			healthRecoveryBase === null ||
			manaSaturationDenominator === null ||
			manaBonusNumerator === null
		) {
			return false;
		}
		const manaSpiritBonus = Number(
			(BigInt(manaBonusNumerator) + BigInt(manaSaturationDenominator) / 2n) /
				BigInt(manaSaturationDenominator)
		);
		if (safeAdd(rules.mana.regenerationBase, manaSpiritBonus) === null) return false;

		const ticksSinceDamage =
			combatant.lastDamagedAtTick === null ? null : state.tick - combatant.lastDamagedAtTick;
		if (combatant.resources.health.current > 0) {
			const recovery = healthRegeneration(
				combatant.attributes.vitality,
				{ mode: 'combat', downed: false, ticksSinceDamage, injuryRepair: false },
				rules
			);
			const health = safeAdd(combatant.resources.health.current, recovery);
			if (health === null) return false;
			combatant.resources.health.current = Math.min(combatant.resources.health.maximum, health);
		}
		const manaRecovery = manaRegeneration(
			combatant.attributes.spirit,
			{ mode: 'combat', downed: false, ticksSinceDamage, injuryRepair: false },
			rules
		);
		const mana = safeAdd(combatant.resources.mana.current, manaRecovery);
		if (mana === null) return false;
		combatant.resources.mana.current = Math.min(combatant.resources.mana.maximum, mana);

		if (state.tick < combatant.readiness.recoveryUntilTick) continue;
		const agilityGain = safeMultiply(
			combatant.attributes.agility,
			rules.readiness.agilityGainPerTick
		);
		if (agilityGain === null) return false;
		const gain = safeAdd(rules.readiness.baseGainPerTick, agilityGain);
		if (gain === null) return false;
		const exactNumerator = safeAdd(combatant.readiness.exactNumerator, gain);
		if (exactNumerator === null) return false;
		combatant.readiness.exactNumerator = exactNumerator;
		combatant.readiness.value = Math.min(rules.readiness.threshold, exactNumerator);
	}
	synchronizeReadinessOutcomeEvidence(state);
	return true;
}

/**
 * Advances canonical combat time to exactly one logical-tick readiness cohort.
 * Task 3 owns conversion of this private boundary into frozen snapshots and actor views.
 */
export function advanceUntilReadyCohort(
	stateInput: ReadinessCombatStateV1,
	rulesInput: CombatRulesV1
): ReadyCohortAdvance {
	const rules = CombatRulesV1Schema.parse(rulesInput);
	const parsedInput = ReadinessCombatStateV1Schema.safeParse(stateInput);
	if (!parsedInput.success) return actorContextFailureResult(stateInput, parsedInput.error);
	let state = parsedInput.data;
	if (state.status === 'complete') {
		if (!state.result) throw new Error('Complete readiness combat state is missing its result');
		return { kind: 'combat-result', state, result: state.result };
	}
	if (!hasConsistentReadinessProjection(state, rules)) {
		return safetyResult(state, 'invalid-state');
	}

	for (;;) {
		const currentTickEffects = resolveDueScheduledEffects(state, rules);
		if (currentTickEffects.kind === 'safety-stop') {
			return safetyResult(state, currentTickEffects.reason);
		}
		state = currentTickEffects.state;
		const currentTerminal = ordinaryTerminalResult(state);
		if (currentTerminal) return currentTerminal;
		const ready = readyActorIds(state, rules);
		if (ready.length > 0) return { kind: 'decision-window', state, readyActorIds: ready };

		const canProgress =
			Object.values(state.combatants).some((combatant) => combatant.active && !combatant.downed) ||
			state.scheduledEffects.length > 0;
		if (!canProgress) {
			if (state.safety.noProgressCycles >= rules.readiness.safety.maximumNoProgressCycles) {
				return safetyResult(state, 'no-progress-cycles');
			}
			const noProgressCycles = safeAdd(state.safety.noProgressCycles, 1);
			if (noProgressCycles === null) return safetyResult(state, 'arithmetic-overflow');
			state.safety.noProgressCycles = noProgressCycles;
			if (state.safety.noProgressCycles >= rules.readiness.safety.maximumNoProgressCycles) {
				return safetyResult(state, 'no-progress-cycles');
			}
			continue;
		}

		if (state.safety.ticksAdvanced >= rules.readiness.safety.maximumTicksAdvanced) {
			return safetyResult(state, 'total-ticks');
		}
		const nextTick = safeAdd(state.tick, 1);
		const nextTicksAdvanced = safeAdd(state.safety.ticksAdvanced, 1);
		if (nextTick === null || nextTicksAdvanced === null) {
			return safetyResult(state, 'arithmetic-overflow');
		}
		const beforeTick = state;
		let candidate = ReadinessCombatStateV1Schema.parse(state);
		candidate.tick = nextTick;
		candidate.safety.ticksAdvanced = nextTicksAdvanced;
		candidate.safety.noProgressCycles = 0;

		const scheduled = resolveDueScheduledEffects(candidate, rules);
		if (scheduled.kind === 'safety-stop') {
			return safetyResult(beforeTick, scheduled.reason);
		}
		candidate = scheduled.state;
		const advancedTerminal = ordinaryTerminalResult(candidate);
		if (advancedTerminal) return advancedTerminal;
		if (!regenerateAndAccumulate(candidate, rules)) {
			return safetyResult(beforeTick, 'arithmetic-overflow');
		}
		const parsedCandidate = ReadinessCombatStateV1Schema.safeParse(candidate);
		if (!parsedCandidate.success || !hasConsistentReadinessProjection(candidate, rules)) {
			return safetyResult(beforeTick, 'invalid-state');
		}
		state = parsedCandidate.data;
	}
}

/** Applies the readiness threshold and authored recovery only after a legal action is chosen. */
export function applyReadinessActionCost(
	stateInput: ReadinessCombatStateV1,
	actorId: string,
	actionInput: CombatLegalAction,
	rulesInput: CombatRulesV1
): ReadinessActionCostResult {
	const state = ReadinessCombatStateV1Schema.parse(stateInput);
	const terminalResult = state.result;
	if (state.status === 'complete' && terminalResult !== null) {
		return { kind: 'combat-result', state, result: terminalResult };
	}
	const rules = CombatRulesV1Schema.parse(rulesInput);
	const action = CombatLegalActionSchema.parse(actionInput);
	if (!hasConsistentReadinessProjection(state, rules)) {
		return safetyResult(state, 'invalid-state');
	}
	const actor = state.combatants[actorId];
	if (!actor || !actor.active || actor.downed) return safetyResult(state, 'invalid-state');
	if (
		actor.readiness.exactNumerator < rules.readiness.threshold ||
		actor.readiness.recoveryUntilTick > state.tick
	) {
		return safetyResult(state, 'invalid-state');
	}
	const recoveryUntilTick = safeAdd(state.tick, action.recoveryTicks);
	if (recoveryUntilTick === null) return safetyResult(state, 'arithmetic-overflow');
	const exactNumerator = actor.readiness.exactNumerator - rules.readiness.threshold;
	actor.readiness.exactNumerator = Math.max(0, exactNumerator);
	actor.readiness.value = Math.min(rules.readiness.threshold, actor.readiness.exactNumerator);
	actor.readiness.recoveryUntilTick = recoveryUntilTick;
	const parsed = ReadinessCombatStateV1Schema.safeParse(state);
	return parsed.success
		? { kind: 'applied', state: parsed.data }
		: safetyResult(stateInput, 'invalid-state');
}
