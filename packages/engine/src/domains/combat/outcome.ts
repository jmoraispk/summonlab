import {
	CombatResolvedEventSchema,
	CombatResultSchema,
	CombatRulesV1Schema,
	type CombatClaim,
	type CombatModeId,
	type CombatResolvedEvent,
	type CombatResult,
	type CombatRulesV1,
	type CombatSafetyStop,
	type ReadinessCombatStateV1
} from '@summonlab/contracts';

import { deterministicUuid, hashCanonical } from '../../hash.js';

type CombatOutcome = CombatResult['outcome'];
type WithoutClaimIdentity<Claim> = Claim extends unknown
	? Omit<Claim, 'claimVersion' | 'claimId' | 'idempotencyKey'>
	: never;
type CombatClaimPayload = WithoutClaimIdentity<CombatClaim>;

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
export function emitCombatOutcome(
	input: EmitCombatOutcomeInput,
	rules: CombatRulesV1
): CombatResult {
	const parsedRules = CombatRulesV1Schema.parse(rules);
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
				minimumSafeHealth: parsedRules.health.minimumSafeHealth
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
		claims,
		decisiveEventIds: [...input.decisiveEventIds],
		safetyStop: input.termination.kind === 'safety-stop' ? input.termination.safetyStop : null
	};
	return CombatResultSchema.parse({
		...resultWithoutHash,
		traceHash: hashCanonical({ result: resultWithoutHash, resolvedEvents: input.resolvedEvents })
	});
}
