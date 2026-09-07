import {
	CombatResolvedEventSchema,
	CombatResultSchema,
	ReadinessCombatStateV1Schema,
	type CombatClaim,
	type CombatModeId,
	type CombatResolvedEvent,
	type CombatResult,
	type CombatSafetyStop,
	type ReadinessCombatOutcomeEvidenceV1,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';

import { deterministicUuid, hashCanonical } from '../../hash.js';
import { combatAftermathRulesForBinding } from '../../core/combat-aftermath-rules.js';

type CombatOutcome = CombatResult['outcome'];
type WithoutClaimIdentity<Claim> = Claim extends unknown
	? Omit<Claim, 'claimVersion' | 'claimId' | 'idempotencyKey'>
	: never;
type CombatClaimPayload = WithoutClaimIdentity<CombatClaim>;

function deepFreeze<T>(value: T): T {
	if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
		for (const child of Object.values(value)) deepFreeze(child);
		Object.freeze(value);
	}
	return value;
}

export type CombatTermination =
	| { readonly kind: Exclude<CombatOutcome, 'safety-stop'> }
	| { readonly kind: 'safety-stop'; readonly safetyStop: CombatSafetyStop };

export interface SecuredCombatLoot {
	readonly ownerId: string;
	readonly lootId: string;
	readonly quantity: number;
}

export interface CombatObjectiveState {
	readonly objectiveId: string;
	readonly completed: boolean;
}

export interface EmitCombatOutcomeInput {
	readonly attemptId: string;
	readonly modeId: CombatModeId;
	readonly rulesVersion: string;
	readonly endedAtTick: number;
	readonly termination: CombatTermination;
	readonly partyHeroIds: readonly string[];
	/** Total resolver-authored harm, not a final-minus-initial approximation that regen can hide. */
	readonly engineDamageTakenByHeroId: Readonly<Record<string, number>>;
	readonly finalCombatants: ReadinessCombatStateV1['combatants'];
	readonly resolvedEvents: readonly CombatResolvedEvent[];
	/** Engine-owned rescue/extraction evidence. Provider prose is intentionally not consulted. */
	readonly engineRecoveredCombatantIds: readonly string[];
	readonly securedLoot: readonly SecuredCombatLoot[];
	readonly objectiveStates: readonly CombatObjectiveState[];
	readonly decisiveEventIds: readonly string[];
}

export interface FinalizeReadinessCombatInput {
	readonly state: ReadinessCombatStateV1;
	readonly safetyStop?: CombatSafetyStop;
}

export type ReadinessTerminalDirective = NonNullable<
	ReadinessCombatOutcomeEvidenceV1['terminalDirective']
>;

export interface AuthorizeReadinessTerminalDirectiveInput {
	readonly state: ReadinessCombatStateV1;
	readonly directive: ReadinessTerminalDirective;
}

export function createReadinessCombatOutcomeEvidence(input: {
	readonly attemptId: string;
	readonly combatants: ReadinessCombatStateV1['combatants'];
	readonly eventsEmitted?: number;
	readonly emittedEventIds?: readonly string[];
	readonly resolvedEvents?: readonly CombatResolvedEvent[];
	readonly authoredDeadline?: ReadinessCombatOutcomeEvidenceV1['authoredDeadline'];
}): ReadinessCombatOutcomeEvidenceV1 {
	return {
		evidenceVersion: 'readiness-outcome-evidence-v1',
		attemptId: input.attemptId,
		partyHeroes: Object.fromEntries(
			Object.values(input.combatants)
				.filter((combatant) => combatant.combatantKind === 'hero' && combatant.teamId === 'party')
				.sort((left, right) => left.combatantId.localeCompare(right.combatantId))
				.map((combatant) => [
					combatant.combatantId,
					{
						startingHealth: combatant.resources.health.current,
						startingMana: combatant.resources.mana.current,
						currentHealth: combatant.resources.health.current,
						currentMana: combatant.resources.mana.current,
						damageTaken: 0,
						downed: combatant.downed
					}
				])
		),
		resolvedEvents: structuredClone([...(input.resolvedEvents ?? [])]),
		emittedEventIds: [...(input.emittedEventIds ?? [])],
		eventsEmitted: input.eventsEmitted ?? 0,
		engineRecoveredCombatantIds: [],
		securedLoot: [],
		objectiveStates: [],
		terminalDirective: null,
		authoredDeadline: input.authoredDeadline ?? null
	};
}

/** Keeps private outcome evidence synchronized with canonical party resources and downing. */
export function synchronizeReadinessOutcomeEvidence(state: ReadinessCombatStateV1): void {
	for (const [heroId, evidence] of Object.entries(state.outcomeEvidence.partyHeroes)) {
		const hero = state.combatants[heroId];
		if (!hero) throw new Error(`Readiness outcome evidence lacks party hero ${heroId}`);
		evidence.currentHealth = hero.resources.health.current;
		evidence.currentMana = hero.resources.mana.current;
		evidence.downed = hero.downed;
	}
}

export function recordReadinessOutcomeDamage(
	state: ReadinessCombatStateV1,
	heroId: string,
	damage: number
): void {
	const evidence = state.outcomeEvidence.partyHeroes[heroId];
	if (!evidence || damage === 0) return;
	const next = evidence.damageTaken + damage;
	if (!Number.isSafeInteger(next) || damage < 0) {
		throw new Error(`Readiness outcome damage evidence overflowed for ${heroId}`);
	}
	evidence.damageTaken = next;
}

export function appendReadinessResolvedEvents(
	state: ReadinessCombatStateV1,
	events: readonly CombatResolvedEvent[]
): void {
	appendReadinessEmittedEventIds(
		state,
		events.map((event) => event.eventId)
	);
	for (const event of events) {
		if (event.attemptId !== state.attemptId) {
			throw new Error(
				'Resolved combat evidence is stale, duplicated, or belongs to another attempt'
			);
		}
		state.outcomeEvidence.resolvedEvents.push(structuredClone(event));
	}
	synchronizeReadinessOutcomeEvidence(state);
}

export function appendReadinessEmittedEventIds(
	state: ReadinessCombatStateV1,
	eventIds: readonly string[]
): void {
	const knownIds = new Set(state.outcomeEvidence.emittedEventIds);
	for (const eventId of eventIds) {
		if (knownIds.has(eventId)) throw new Error('Readiness emitted event evidence is duplicated');
		knownIds.add(eventId);
		state.outcomeEvidence.emittedEventIds.push(eventId);
	}
	state.outcomeEvidence.eventsEmitted = state.safety.eventsEmitted;
}

/**
 * Consumes a mission-engine-authored directive bound to the exact active readiness state. Provider
 * output has no path to this type; command/event persistence is owned by the later V26 seam.
 */
export function authorizeReadinessTerminalDirective(
	input: AuthorizeReadinessTerminalDirectiveInput
): ReadinessCombatStateV1 {
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	if (state.status !== 'active' || state.outcomeEvidence.terminalDirective !== null) {
		throw new Error('Readiness terminal directive requires an active unrequested combat');
	}
	const directive = input.directive;
	const expectedStateHash = hashCanonical(state);
	const expectedDirectiveId = deterministicUuid(
		`${state.attemptId}:readiness-terminal:${directive.kind}:${state.tick}:${expectedStateHash}`
	);
	if (
		directive.attemptId !== state.attemptId ||
		directive.authorizedAtTick !== state.tick ||
		directive.authorizedStateHash !== expectedStateHash ||
		directive.directiveId !== expectedDirectiveId
	) {
		throw new Error('Readiness terminal directive is not bound to the canonical engine state');
	}
	const candidate = structuredClone(state);
	candidate.outcomeEvidence = {
		...candidate.outcomeEvidence,
		engineRecoveredCombatantIds: [...directive.engineRecoveredCombatantIds],
		securedLoot: structuredClone(directive.securedLoot),
		objectiveStates: structuredClone(directive.objectiveStates),
		terminalDirective: directive
	};
	return deepFreeze(ReadinessCombatStateV1Schema.parse(candidate));
}

export function readinessTerminalDirective(input: {
	readonly state: ReadinessCombatStateV1;
	readonly kind: ReadinessTerminalDirective['kind'];
	readonly engineRecoveredCombatantIds?: readonly string[];
	readonly securedLoot?: readonly SecuredCombatLoot[];
	readonly objectiveStates?: readonly CombatObjectiveState[];
}): ReadinessTerminalDirective {
	const state = ReadinessCombatStateV1Schema.parse(input.state);
	const authorizedStateHash = hashCanonical(state);
	return {
		directiveVersion: 'readiness-terminal-directive-v1',
		directiveId: deterministicUuid(
			`${state.attemptId}:readiness-terminal:${input.kind}:${state.tick}:${authorizedStateHash}`
		),
		attemptId: state.attemptId,
		kind: input.kind,
		authorizedAtTick: state.tick,
		authorizedStateHash,
		engineRecoveredCombatantIds: [...(input.engineRecoveredCombatantIds ?? [])],
		securedLoot: structuredClone([...(input.securedLoot ?? [])]),
		objectiveStates: structuredClone([...(input.objectiveStates ?? [])])
	};
}

function assertUnique(values: readonly string[], label: string): void {
	if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
}

function claim(attemptId: string, identity: string, payload: CombatClaimPayload): CombatClaim {
	const idempotencyKey = `${attemptId}:${identity}`;
	return {
		claimVersion: 'combat-claim-v1',
		claimId: deterministicUuid(`${idempotencyKey}:claim`),
		idempotencyKey,
		...payload
	} as CombatClaim;
}

function practiceClaims(input: EmitCombatOutcomeInput): CombatClaim[] {
	const party = new Set(input.partyHeroIds);
	const evidence = new Map<string, { heroId: string; skillId: string; amount: number }>();
	for (const event of input.resolvedEvents) {
		if (
			event.attemptId !== input.attemptId ||
			event.finalOutcome !== 'applied' ||
			!party.has(event.actorId) ||
			event.originalIntent.skillId === null
		) {
			continue;
		}
		const key = `${event.actorId}:${event.originalIntent.skillId}`;
		const current = evidence.get(key);
		evidence.set(key, {
			heroId: event.actorId,
			skillId: event.originalIntent.skillId,
			amount: (current?.amount ?? 0) + 1
		});
	}
	return [...evidence.values()]
		.sort(
			(left, right) =>
				left.heroId.localeCompare(right.heroId) || left.skillId.localeCompare(right.skillId)
		)
		.map(({ heroId, skillId, amount }) =>
			claim(input.attemptId, `practice:${heroId}:${skillId}`, {
				claimType: 'skill-practice',
				heroId,
				skillId,
				practiceEvidence: amount
			})
		);
}

/**
 * Converts either combat mode's terminal evidence into the one outer result boundary. Combat
 * remains combat-local here: permanent state changes happen only when owning reducers apply claims.
 */
export function emitCombatOutcome(input: EmitCombatOutcomeInput): CombatResult {
	const aftermathRules = combatAftermathRulesForBinding(input.modeId, input.rulesVersion);
	assertUnique(input.partyHeroIds, 'Party hero IDs');
	assertUnique(input.engineRecoveredCombatantIds, 'Recovered combatant IDs');
	assertUnique(input.decisiveEventIds, 'Decisive event IDs');
	assertUnique(
		input.resolvedEvents.map((event) => event.eventId),
		'Resolved event IDs'
	);
	assertUnique(
		input.securedLoot.map((loot) => `${loot.ownerId}:${loot.lootId}`),
		'Secured loot owner/item pairs'
	);
	assertUnique(
		input.objectiveStates.map((objective) => objective.objectiveId),
		'Objective IDs'
	);
	const party = new Set(input.partyHeroIds);
	for (const eventInput of input.resolvedEvents) {
		const event = CombatResolvedEventSchema.parse(eventInput);
		if (event.attemptId !== input.attemptId) {
			throw new Error('Resolved event belongs to another combat attempt');
		}
	}
	for (const heroId of input.partyHeroIds) {
		if (!input.finalCombatants[heroId]) {
			throw new Error(`Combat outcome is missing party hero ${heroId}`);
		}
		const damageTaken = input.engineDamageTakenByHeroId[heroId] ?? 0;
		if (!Number.isSafeInteger(damageTaken) || damageTaken < 0) {
			throw new Error(`Combat harm evidence is invalid for ${heroId}`);
		}
	}
	for (const heroId of input.engineRecoveredCombatantIds) {
		const combatant = input.finalCombatants[heroId];
		if (
			!party.has(heroId) ||
			!combatant?.downed ||
			!['victory', 'extraction'].includes(input.termination.kind)
		) {
			throw new Error('Recovery requires a downed party hero and a safe terminal outcome');
		}
	}

	const claims: CombatClaim[] = [];
	for (const heroId of [...input.partyHeroIds].sort((left, right) => left.localeCompare(right))) {
		const combatant = input.finalCombatants[heroId]!;
		for (const resource of ['health', 'mana'] as const) {
			claims.push(
				claim(input.attemptId, `resource:${heroId}:${resource}`, {
					claimType: 'final-resource',
					combatantId: heroId,
					resource,
					value: combatant.resources[resource].current
				})
			);
		}
		const damageTaken = input.engineDamageTakenByHeroId[heroId] ?? 0;
		if (damageTaken > 0 || combatant.downed) {
			claims.push(
				claim(input.attemptId, `harm:${heroId}`, {
					claimType: 'harm',
					heroId,
					damageTaken,
					downed: combatant.downed
				})
			);
		}
	}
	for (const heroId of [...input.engineRecoveredCombatantIds].sort((left, right) =>
		left.localeCompare(right)
	)) {
		claims.push(
			claim(input.attemptId, `recovery:${heroId}`, {
				claimType: 'recovery',
				heroId,
				minimumSafeHealth: aftermathRules.minimumSafeHealth
			})
		);
	}
	claims.push(...practiceClaims(input));
	for (const loot of [...input.securedLoot].sort(
		(left, right) =>
			left.ownerId.localeCompare(right.ownerId) || left.lootId.localeCompare(right.lootId)
	)) {
		claims.push(
			claim(input.attemptId, `loot:${loot.ownerId}:${loot.lootId}`, {
				claimType: 'loot',
				...loot
			})
		);
	}
	for (const objective of [...input.objectiveStates].sort((left, right) =>
		left.objectiveId.localeCompare(right.objectiveId)
	)) {
		claims.push(
			claim(input.attemptId, `objective:${objective.objectiveId}`, {
				claimType: 'objective',
				...objective
			})
		);
	}
	claims.push(
		claim(input.attemptId, 'attempt-outcome', {
			claimType: 'attempt-outcome',
			outcome: input.termination.kind
		})
	);

	const resultWithoutHash = {
		resultVersion: 'combat-result-v1' as const,
		resultId: deterministicUuid(
			`${input.attemptId}:combat-result:${input.modeId}:${input.endedAtTick}:${input.termination.kind}`
		),
		attemptId: input.attemptId,
		modeId: input.modeId,
		rulesVersion: input.rulesVersion,
		outcome: input.termination.kind,
		endedAtTick: input.endedAtTick,
		finalCombatants: structuredClone(input.finalCombatants),
		claimEvidence: {
			evidenceVersion: 'combat-outcome-claim-evidence-v1' as const,
			partyHeroIds: [...input.partyHeroIds],
			engineDamageTakenByHeroId: { ...input.engineDamageTakenByHeroId },
			resolvedEvents: structuredClone(input.resolvedEvents),
			engineRecoveredCombatantIds: [...input.engineRecoveredCombatantIds],
			securedLoot: structuredClone(input.securedLoot),
			objectiveStates: structuredClone(input.objectiveStates)
		},
		claims,
		decisiveEventIds: [...input.decisiveEventIds],
		safetyStop: input.termination.kind === 'safety-stop' ? input.termination.safetyStop : null
	};
	return CombatResultSchema.parse({
		...resultWithoutHash,
		traceHash: hashCanonical({ result: resultWithoutHash, resolvedEvents: input.resolvedEvents })
	});
}

/** Re-derives the complete canonical result and claim manifest from terminal engine evidence. */
export function authenticateCombatResult(
	resultInput: CombatResult,
	authorityInput: EmitCombatOutcomeInput
): CombatResult {
	const result = CombatResultSchema.parse(resultInput);
	const expected = emitCombatOutcome(authorityInput);
	if (hashCanonical(expected) !== hashCanonical(result)) {
		throw new Error('Combat result claim manifest diverged from trusted terminal authority');
	}
	return expected;
}

/** The sole readiness-kernel terminal transition for ordinary and safety outcomes. */
function readinessOrdinaryTermination(state: ReadinessCombatStateV1): CombatTermination | null {
	const partyHeroIds = Object.keys(state.outcomeEvidence.partyHeroes);
	if (partyHeroIds.every((heroId) => state.combatants[heroId]?.downed === true)) {
		return { kind: 'party-downed' };
	}
	const opponents = Object.values(state.combatants).filter(
		(combatant) => combatant.teamId !== 'party'
	);
	if (
		opponents.length > 0 &&
		opponents.every((combatant) => combatant.downed || !combatant.active)
	) {
		return { kind: 'victory' };
	}
	if (state.outcomeEvidence.terminalDirective) {
		return { kind: state.outcomeEvidence.terminalDirective.kind };
	}
	if (
		state.outcomeEvidence.authoredDeadline &&
		state.tick >= state.outcomeEvidence.authoredDeadline.deadlineTick
	) {
		return { kind: 'deadline' };
	}
	return null;
}

export function finalizeReadinessCombatIfTerminal(
	stateInput: ReadinessCombatStateV1
): ReturnType<typeof finalizeReadinessCombatOutcome> | null {
	const state = ReadinessCombatStateV1Schema.parse(stateInput);
	if (state.status !== 'active' || readinessOrdinaryTermination(state) === null) return null;
	return finalizeReadinessCombatOutcome({ state });
}

export function finalizeReadinessCombatOutcome(input: FinalizeReadinessCombatInput): Readonly<{
	state: ReadinessCombatStateV1;
	result: CombatResult;
}> {
	const state = input.safetyStop
		? structuredClone(input.state)
		: ReadinessCombatStateV1Schema.parse(input.state);
	if (state.status !== 'active' || state.result !== null) {
		throw new Error('Only an active readiness combat can be finalized');
	}
	const partyHeroIds = Object.keys(state.outcomeEvidence.partyHeroes).sort((left, right) =>
		left.localeCompare(right)
	);
	let termination: CombatTermination | null;
	if (input.safetyStop) {
		if (
			input.safetyStop.ticksAdvanced !== state.safety.ticksAdvanced ||
			input.safetyStop.eventsEmitted !== state.safety.eventsEmitted ||
			input.safetyStop.noProgressCycles !== state.safety.noProgressCycles
		) {
			throw new Error('Readiness safety stop must bind to canonical safety counters');
		}
		termination = { kind: 'safety-stop', safetyStop: input.safetyStop };
	} else termination = readinessOrdinaryTermination(state);
	if (termination === null) {
		throw new Error('Canonical readiness state has no engine-authorized terminal condition');
	}
	const damage = Object.fromEntries(
		partyHeroIds.map((heroId) => [heroId, state.outcomeEvidence.partyHeroes[heroId]!.damageTaken])
	);
	const decisiveEventIds = state.outcomeEvidence.resolvedEvents
		.filter(
			(event) =>
				event.tick === state.tick && event.effects.some((effect) => effect.kind === 'downed')
		)
		.map((event) => event.eventId);
	const result = emitCombatOutcome({
		attemptId: state.attemptId,
		modeId: 'agent-readiness-v1',
		rulesVersion: COMBAT_RULES_V1.rulesVersion,
		endedAtTick: state.tick,
		termination,
		partyHeroIds,
		engineDamageTakenByHeroId: damage,
		finalCombatants: state.combatants,
		resolvedEvents: state.outcomeEvidence.resolvedEvents,
		engineRecoveredCombatantIds: state.outcomeEvidence.engineRecoveredCombatantIds,
		securedLoot: state.outcomeEvidence.securedLoot,
		objectiveStates: state.outcomeEvidence.objectiveStates,
		decisiveEventIds
	});
	const completed = ReadinessCombatStateV1Schema.parse({
		...state,
		status: 'complete',
		result
	});
	return deepFreeze({ state: completed, result });
}
