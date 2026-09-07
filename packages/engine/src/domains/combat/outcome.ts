import {
	CombatResolvedEventSchema,
	CombatResultSchema,
	ReadinessCombatStateV1Schema,
	type CombatClaim,
	type CombatModeId,
	type CombatResolvedEvent,
	type CombatResult,
	type CombatSafetyStop,
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
	readonly termination: CombatTermination;
	readonly resolvedEvents?: readonly CombatResolvedEvent[];
	readonly engineDamageTakenByHeroId?: Readonly<Record<string, number>>;
	readonly engineRecoveredCombatantIds?: readonly string[];
	readonly securedLoot?: readonly SecuredCombatLoot[];
	readonly objectiveStates?: readonly CombatObjectiveState[];
	readonly decisiveEventIds?: readonly string[];
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
export function finalizeReadinessCombatOutcome(input: FinalizeReadinessCombatInput): Readonly<{
	state: ReadinessCombatStateV1;
	result: CombatResult;
}> {
	const state = input.state;
	if (state.status !== 'active' || state.result !== null) {
		throw new Error('Only an active readiness combat can be finalized');
	}
	if (
		input.termination.kind !== 'safety-stop' &&
		[
			input.resolvedEvents,
			input.engineDamageTakenByHeroId,
			input.engineRecoveredCombatantIds,
			input.securedLoot,
			input.objectiveStates,
			input.decisiveEventIds
		].some((evidence) => evidence === undefined)
	) {
		throw new Error('Ordinary readiness completion requires explicit accumulated engine evidence');
	}
	const partyHeroIds = Object.values(state.combatants)
		.filter((combatant) => combatant.combatantKind === 'hero' && combatant.teamId === 'party')
		.map((combatant) => combatant.combatantId)
		.sort((left, right) => left.localeCompare(right));
	const damage = Object.fromEntries(
		partyHeroIds.map((heroId) => [heroId, input.engineDamageTakenByHeroId?.[heroId] ?? 0])
	);
	const result = emitCombatOutcome({
		attemptId: state.attemptId,
		modeId: 'agent-readiness-v1',
		rulesVersion: COMBAT_RULES_V1.rulesVersion,
		endedAtTick: state.tick,
		termination: input.termination,
		partyHeroIds,
		engineDamageTakenByHeroId: damage,
		finalCombatants: state.combatants,
		resolvedEvents: input.resolvedEvents ?? [],
		engineRecoveredCombatantIds: input.engineRecoveredCombatantIds ?? [],
		securedLoot: input.securedLoot ?? [],
		objectiveStates: input.objectiveStates ?? [],
		decisiveEventIds: input.decisiveEventIds ?? []
	});
	const completed = ReadinessCombatStateV1Schema.parse({
		...state,
		status: 'complete',
		result
	});
	return deepFreeze({ state: completed, result });
}
