import type {
	CombatModeId,
	CombatResolvedEvent,
	CombatSafetyStop,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import { CombatResultSchema } from '@summonlab/contracts';
import { COMBAT_CONTENT_BINDING, COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../../hash.js';
import { adaptV26LegacyCombatOutcome } from '../../orchestration/combat-claims.js';
import {
	emitCombatOutcome,
	finalizeReadinessCombatOutcome,
	type CombatTermination
} from './outcome.js';

const ID = {
	attempt: '61000000-0000-4000-8000-000000000001',
	hero: '61000000-0000-4000-8000-000000000002',
	monster: '61000000-0000-4000-8000-000000000003',
	window: '61000000-0000-4000-8000-000000000004',
	action: '61000000-0000-4000-8000-000000000005',
	event: '61000000-0000-4000-8000-000000000006'
} as const;

function combatant(
	combatantId: string,
	teamId: 'party' | 'enemy',
	health: number,
	downed = false
): ReadinessCombatStateV1['combatants'][string] {
	return {
		combatantId,
		combatantKind: teamId === 'party' ? 'hero' : 'monster',
		teamId,
		position: { x: teamId === 'party' ? 1 : 2, y: 1 },
		facing: teamId === 'party' ? 'east' : 'west',
		resources: {
			health: { current: health, maximum: 100 },
			mana: { current: 7, maximum: 20 }
		},
		lastDamagedAtTick: health < 100 ? 8 : null,
		attributes: { might: 20, vitality: 20, agility: 20, spirit: 20 },
		armour: 0,
		resistances: {},
		readiness: { value: 0, exactNumerator: 0, recoveryUntilTick: 0 },
		conditions: [],
		cooldowns: {},
		downed,
		active: !downed
	};
}

function practiceEvent(
	publicIntent = 'I will recover everyone after this hit.'
): CombatResolvedEvent {
	const originalIntent = {
		windowId: ID.window,
		attemptId: ID.attempt,
		tick: 8,
		actorId: ID.hero,
		snapshotHash: 'a'.repeat(64),
		actorViewHash: 'b'.repeat(64),
		legalActionSetHash: 'c'.repeat(64),
		actionId: 'cross-cut',
		actionInstanceId: ID.action,
		actionKind: 'attack' as const,
		skillId: 'combat-skill-basic-sword-strike' as const,
		target: { kind: 'entity' as const, combatantId: ID.monster },
		fallbackId: null,
		publicIntent
	};
	return {
		eventVersion: 'combat-resolved-event-v1',
		eventId: ID.event,
		attemptId: ID.attempt,
		windowId: ID.window,
		tick: 8,
		actorId: ID.hero,
		actionId: 'cross-cut',
		snapshotHash: 'a'.repeat(64),
		actorViewHash: 'b'.repeat(64),
		legalActionSetHash: 'c'.repeat(64),
		originalIntent,
		conflictingEventId: null,
		fallbackApplied: null,
		refundApplied: null,
		finalOutcome: 'applied',
		effects: []
	};
}

const safetyStop: CombatSafetyStop = {
	safetyStopVersion: 'combat-safety-stop-v1',
	reason: 'total-ticks',
	disposition: 'forced-retreat',
	ticksAdvanced: 10,
	eventsEmitted: 1,
	noProgressCycles: 0
};

function termination(outcome: CombatTermination['kind']): CombatTermination {
	return outcome === 'safety-stop' ? { kind: outcome, safetyStop } : { kind: outcome };
}

function emit(modeId: CombatModeId, outcome: CombatTermination['kind'], downed = false) {
	return emitCombatOutcome({
		attemptId: ID.attempt,
		modeId,
		rulesVersion:
			modeId === 'legacy-auto-v1' ? 'legacy-auto-rules-v1' : COMBAT_RULES_V1.rulesVersion,
		endedAtTick: 8,
		termination: termination(outcome),
		partyHeroIds: [ID.hero],
		engineDamageTakenByHeroId: { [ID.hero]: downed ? 100 : 40 },
		finalCombatants: {
			[ID.hero]: combatant(ID.hero, 'party', downed ? 0 : 75, downed),
			[ID.monster]: combatant(ID.monster, 'enemy', 0, true)
		},
		resolvedEvents: [practiceEvent()],
		engineRecoveredCombatantIds:
			downed && (outcome === 'victory' || outcome === 'extraction') ? [ID.hero] : [],
		securedLoot: [{ ownerId: ID.hero, lootId: 'iron-ore', quantity: 2 }],
		objectiveStates: [{ objectiveId: 'floor-01-core', completed: outcome === 'victory' }],
		decisiveEventIds: [ID.event]
	});
}

function activeState(downed = false): ReadinessCombatStateV1 {
	const hero = { ...combatant(ID.hero, 'party', downed ? 0 : 75, downed), active: false };
	const monster = {
		...combatant(ID.monster, 'enemy', downed ? 100 : 0, !downed),
		active: false
	};
	const combatants = { [ID.hero]: hero, [ID.monster]: monster };
	return {
		stateVersion: 'readiness-combat-state-v1',
		seed: 'd'.repeat(64),
		attemptId: ID.attempt,
		tick: 8,
		combatants,
		actorContexts: {},
		terrain: { width: 8, height: 8, blockedTiles: [], features: [] },
		visibleTelegraphs: [],
		scheduledEffects: [],
		safety: { ticksAdvanced: 8, eventsEmitted: 1, noProgressCycles: 0 },
		outcomeEvidence: {
			evidenceVersion: 'readiness-outcome-evidence-v1',
			attemptId: ID.attempt,
			partyHeroes: {
				[ID.hero]: {
					startingHealth: 100,
					startingMana: 20,
					currentHealth: hero.resources.health.current,
					currentMana: hero.resources.mana.current,
					damageTaken: downed ? 100 : 40,
					downed
				}
			},
			resolvedEvents: [practiceEvent()],
			emittedEventIds: [ID.event],
			eventsEmitted: 1,
			engineRecoveredCombatantIds: [],
			securedLoot: [],
			objectiveStates: [],
			terminalDirective: null,
			authoredDeadline: null
		},
		status: 'active',
		result: null
	};
}

describe('common combat outcomes', () => {
	it('adapts a bound legacy terminal only at the V26 orchestration boundary', () => {
		const result = adaptV26LegacyCombatOutcome({
			combatModeBinding: {
				modeId: 'legacy-auto-v1',
				rulesVersion: 'legacy-auto-rules-v1',
				contentHash: COMBAT_CONTENT_BINDING.contentHash,
				boundAt: '2000-01-01T00:00:00.000Z'
			},
			attemptId: ID.attempt,
			endedAtTick: 8,
			termination: { kind: 'retreat' },
			partyHeroIds: [ID.hero],
			engineDamageTakenByHeroId: { [ID.hero]: 40 },
			finalCombatants: {
				[ID.hero]: combatant(ID.hero, 'party', 75),
				[ID.monster]: combatant(ID.monster, 'enemy', 0, true)
			},
			resolvedEvents: [practiceEvent()],
			engineRecoveredCombatantIds: [],
			securedLoot: [],
			objectiveStates: [],
			decisiveEventIds: [ID.event]
		});

		expect(result).toMatchObject({
			modeId: 'legacy-auto-v1',
			rulesVersion: 'legacy-auto-rules-v1',
			outcome: 'retreat'
		});
		expect(result.claims).not.toHaveLength(0);
	});
	it.each([
		['victory', false],
		['party-downed', true]
	] as const)('finalizes canonical %s state through the common manifest', (outcome, downed) => {
		const finalized = finalizeReadinessCombatOutcome({ state: activeState(downed) });

		expect(finalized.state.status).toBe('complete');
		expect(finalized.state.result).toStrictEqual(finalized.result);
		expect(finalized.result.outcome).toBe(outcome);
		expect(finalized.result.claims.map((claim) => claim.claimType)).toContain('attempt-outcome');
	});
	it.each(['victory', 'extraction', 'retreat', 'party-downed', 'deadline', 'safety-stop'] as const)(
		'emits a strict common result for %s in both combat modes',
		(outcome) => {
			const legacy = emit('legacy-auto-v1', outcome, outcome === 'party-downed');
			const readiness = emit('agent-readiness-v1', outcome, outcome === 'party-downed');

			expect(CombatResultSchema.parse(legacy)).toStrictEqual(legacy);
			expect(CombatResultSchema.parse(readiness)).toStrictEqual(readiness);
			expect(legacy.outcome).toBe(outcome);
			expect(readiness.outcome).toBe(outcome);
			expect(legacy.claims.map((claim) => claim.claimType)).toStrictEqual(
				readiness.claims.map((claim) => claim.claimType)
			);
			expect(legacy.safetyStop).toStrictEqual(outcome === 'safety-stop' ? safetyStop : null);
			expect(
				CombatResultSchema.safeParse({ ...legacy, rulesVersion: 'combat-rules-v1' }).success
			).toBe(false);
			expect(
				CombatResultSchema.safeParse({ ...readiness, rulesVersion: 'legacy-auto-rules-v1' }).success
			).toBe(false);
		}
	);

	it('emits every owner claim deterministically and preserves practice on retreat', () => {
		const first = emit('agent-readiness-v1', 'retreat');
		const second = emit('agent-readiness-v1', 'retreat');

		expect(second).toStrictEqual(first);
		expect(new Set(first.claims.map((claim) => claim.idempotencyKey)).size).toBe(
			first.claims.length
		);
		expect(first.claims).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ claimType: 'final-resource', resource: 'health', value: 75 }),
				expect.objectContaining({ claimType: 'final-resource', resource: 'mana', value: 7 }),
				expect.objectContaining({ claimType: 'harm', damageTaken: 40, downed: false }),
				expect.objectContaining({
					claimType: 'skill-practice',
					skillId: 'combat-skill-basic-sword-strike',
					practiceEvidence: 1
				}),
				expect.objectContaining({ claimType: 'loot', lootId: 'iron-ore', quantity: 2 }),
				expect.objectContaining({
					claimType: 'objective',
					objectiveId: 'floor-01-core',
					completed: false
				}),
				expect.objectContaining({ claimType: 'attempt-outcome', outcome: 'retreat' })
			])
		);
		expect(first.traceHash).toHaveLength(64);
	});

	it.each(['victory', 'extraction'] as const)(
		'emits only an engine-evidenced recovery floor after %s and ignores provider prose',
		(outcome) => {
			const recovered = emit('agent-readiness-v1', outcome, true);
			const recovery = recovered.claims.find((claim) => claim.claimType === 'recovery');
			expect(recovery).toMatchObject({
				claimType: 'recovery',
				heroId: ID.hero,
				minimumSafeHealth: COMBAT_RULES_V1.health.minimumSafeHealth
			});

			const withoutEngineEvidence = emitCombatOutcome({
				attemptId: ID.attempt,
				modeId: 'agent-readiness-v1',
				rulesVersion: COMBAT_RULES_V1.rulesVersion,
				endedAtTick: 8,
				termination: { kind: outcome },
				partyHeroIds: [ID.hero],
				engineDamageTakenByHeroId: { [ID.hero]: 100 },
				finalCombatants: { [ID.hero]: combatant(ID.hero, 'party', 0, true) },
				resolvedEvents: [practiceEvent('I died, then revived at full health.')],
				engineRecoveredCombatantIds: [],
				securedLoot: [],
				objectiveStates: [],
				decisiveEventIds: [ID.event]
			});
			expect(withoutEngineEvidence.claims.some((claim) => claim.claimType === 'recovery')).toBe(
				false
			);
			expect(hashCanonical(withoutEngineEvidence.finalCombatants)).toBe(
				hashCanonical({ [ID.hero]: combatant(ID.hero, 'party', 0, true) })
			);
		}
	);
});
