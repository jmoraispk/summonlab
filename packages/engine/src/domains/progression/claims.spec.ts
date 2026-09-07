import type { CombatResolvedEvent, ReadinessCombatStateV1 } from '@summonlab/contracts';
import { COMBAT_RULES_V1 } from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../../hash.js';
import { healthRegeneration } from '../combat/capability.js';
import { emitCombatOutcome } from '../combat/outcome.js';
import {
	createCombatMissionClaimProjection,
	missionAttemptTransitionForCombatResult
} from '../mission/lifecycle.js';
import { transitionCombatResultClaims } from '../../orchestration/combat-claims.js';
import { createCombatProgressionClaimProjection } from './claims.js';

const ID = {
	attempt: '62000000-0000-4000-8000-000000000001',
	hero: '62000000-0000-4000-8000-000000000002',
	monster: '62000000-0000-4000-8000-000000000003',
	window: '62000000-0000-4000-8000-000000000004',
	action: '62000000-0000-4000-8000-000000000005',
	event: '62000000-0000-4000-8000-000000000006'
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
			mana: { current: 5, maximum: 20 }
		},
		lastDamagedAtTick: health < 100 ? 3 : null,
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

function practiceEvent(): CombatResolvedEvent {
	const originalIntent = {
		windowId: ID.window,
		attemptId: ID.attempt,
		tick: 3,
		actorId: ID.hero,
		snapshotHash: 'a'.repeat(64),
		actorViewHash: 'b'.repeat(64),
		legalActionSetHash: 'c'.repeat(64),
		actionId: 'cross-cut',
		actionInstanceId: ID.action,
		actionKind: 'attack' as const,
		skillId: 'combat-skill-basic-sword-strike' as const,
		target: { kind: 'entity' as const, combatantId: ID.monster },
		fallbackId: null
	};
	return {
		eventVersion: 'combat-resolved-event-v1',
		eventId: ID.event,
		attemptId: ID.attempt,
		windowId: ID.window,
		tick: 3,
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

function result(
	outcome: 'victory' | 'extraction' | 'retreat' | 'party-downed' | 'deadline',
	options: { downed?: boolean; recovered?: boolean } = {}
) {
	const downed = options.downed ?? false;
	return emitCombatOutcome(
		{
			attemptId: ID.attempt,
			modeId: 'agent-readiness-v1',
			rulesVersion: COMBAT_RULES_V1.rulesVersion,
			endedAtTick: 3,
			termination: { kind: outcome },
			partyHeroIds: [ID.hero],
			engineDamageTakenByHeroId: { [ID.hero]: downed ? 100 : 30 },
			finalCombatants: {
				[ID.hero]: combatant(ID.hero, 'party', downed ? 0 : 70, downed),
				[ID.monster]: combatant(ID.monster, 'enemy', 0, true)
			},
			resolvedEvents: [practiceEvent()],
			engineRecoveredCombatantIds: options.recovered ? [ID.hero] : [],
			securedLoot: [{ ownerId: ID.hero, lootId: 'iron-ore', quantity: 2 }],
			objectiveStates: [{ objectiveId: 'recover-core', completed: outcome === 'victory' }],
			decisiveEventIds: [ID.event]
		},
		COMBAT_RULES_V1
	);
}

describe('combat claim process managers', () => {
	it('projects the exact canonical pre-combat resources without fabricating full recovery', () => {
		const projection = createCombatMissionClaimProjection({
			[ID.hero]: {
				health: 65,
				mana: 4,
				maximumHealth: 100,
				maximumMana: 20,
				downed: false,
				lost: false,
				injuryIds: ['old-strain']
			}
		});
		expect(projection.combatants[ID.hero]).toMatchObject({ health: 65, mana: 4 });
	});

	it('applies each claim through its owner and keeps injury evidence during recovery', () => {
		const mission = createCombatMissionClaimProjection({
			[ID.hero]: {
				health: 100,
				mana: 20,
				maximumHealth: 100,
				maximumMana: 20,
				downed: false,
				lost: false,
				injuryIds: ['injury-from-combat']
			}
		});
		const progression = createCombatProgressionClaimProjection();
		const applied = transitionCombatResultClaims(
			{ mission, progression },
			result('victory', { downed: true, recovered: true })
		);

		expect(applied.mission.combatants[ID.hero]).toStrictEqual({
			health: 1,
			mana: 5,
			maximumHealth: 100,
			maximumMana: 20,
			downed: false,
			lost: false,
			injuryIds: ['injury-from-combat']
		});
		expect(applied.mission.loot[ID.hero]).toStrictEqual({ 'iron-ore': 2 });
		expect(applied.mission.objectives).toStrictEqual({ 'recover-core': true });
		expect(applied.mission.attempts[ID.attempt]).toMatchObject({
			outcome: 'victory',
			modeId: 'agent-readiness-v1'
		});
		expect(applied.progression.practiceEvidence[ID.hero]?.['combat-skill-basic-sword-strike']).toBe(
			1
		);
		expect(Object.keys(applied.mission.receipts).length).toBeGreaterThan(0);
		expect(Object.keys(applied.progression.receipts)).toHaveLength(1);
		expect(
			Object.values(applied.progression.receipts).every(
				(receipt) => receipt.inputHash.length === 64 && receipt.claimHash.length === 64
			)
		).toBe(true);
	});

	it('returns original receipts and never applies progression or loot twice', () => {
		const initial = {
			mission: createCombatMissionClaimProjection({
				[ID.hero]: {
					health: 100,
					mana: 20,
					maximumHealth: 100,
					maximumMana: 20,
					downed: false,
					lost: false,
					injuryIds: []
				}
			}),
			progression: createCombatProgressionClaimProjection()
		};
		const combatResult = result('retreat');
		const first = transitionCombatResultClaims(initial, combatResult);
		const second = transitionCombatResultClaims(first, combatResult);

		expect(second).toStrictEqual(first);
		expect(hashCanonical(second)).toBe(hashCanonical(first));
		expect(second.mission.loot[ID.hero]).toStrictEqual({ 'iron-ore': 2 });
		expect(second.progression.practiceEvidence[ID.hero]?.['combat-skill-basic-sword-strike']).toBe(
			1
		);
	});

	it('rejects a forged recovery amount instead of turning text or claims into healing authority', () => {
		const input = {
			mission: createCombatMissionClaimProjection({
				[ID.hero]: {
					health: 100,
					mana: 20,
					maximumHealth: 100,
					maximumMana: 20,
					downed: false,
					lost: false,
					injuryIds: []
				}
			}),
			progression: createCombatProgressionClaimProjection()
		};
		const valid = result('extraction', { downed: true, recovered: true });
		const forged = {
			...valid,
			claims: valid.claims.map((claim) =>
				claim.claimType === 'recovery' ? { ...claim, minimumSafeHealth: 50 } : claim
			)
		};
		expect(() => transitionCombatResultClaims(input, forged)).toThrow(/recovery/iu);
		expect(input.mission.combatants[ID.hero]?.health).toBe(100);
	});

	it('preserves retreat practice and loses an unrecovered downed hero only in aftermath', () => {
		const initial = {
			mission: createCombatMissionClaimProjection({
				[ID.hero]: {
					health: 100,
					mana: 20,
					maximumHealth: 100,
					maximumMana: 20,
					downed: false,
					lost: false,
					injuryIds: ['critical-wound']
				}
			}),
			progression: createCombatProgressionClaimProjection()
		};
		const applied = transitionCombatResultClaims(
			initial,
			result('retreat', { downed: true, recovered: false })
		);

		expect(applied.mission.combatants[ID.hero]).toMatchObject({
			health: 0,
			downed: true,
			lost: true,
			injuryIds: ['critical-wound']
		});
		expect(applied.progression.practiceEvidence[ID.hero]?.['combat-skill-basic-sword-strike']).toBe(
			1
		);
		expect(
			healthRegeneration(
				100,
				{ mode: 'safe-rest', downed: true, ticksSinceDamage: null, injuryRepair: false },
				COMBAT_RULES_V1
			)
		).toBe(0);
	});

	it('maps authored failures separately from engine safety and never calls downing recovery', () => {
		expect(missionAttemptTransitionForCombatResult(result('deadline'))).toStrictEqual({
			status: 'failure',
			outcome: 'failure',
			cause: 'deadline',
			authoredFailure: true
		});
		const safetyResult = emitCombatOutcome(
			{
				attemptId: ID.attempt,
				modeId: 'agent-readiness-v1',
				rulesVersion: COMBAT_RULES_V1.rulesVersion,
				endedAtTick: 3,
				termination: {
					kind: 'safety-stop',
					safetyStop: {
						safetyStopVersion: 'combat-safety-stop-v1',
						reason: 'no-progress-cycles',
						disposition: 'forced-retreat',
						ticksAdvanced: 3,
						eventsEmitted: 1,
						noProgressCycles: 3
					}
				},
				partyHeroIds: [ID.hero],
				engineDamageTakenByHeroId: { [ID.hero]: 30 },
				finalCombatants: { [ID.hero]: combatant(ID.hero, 'party', 70) },
				resolvedEvents: [],
				engineRecoveredCombatantIds: [],
				securedLoot: [],
				objectiveStates: [],
				decisiveEventIds: []
			},
			COMBAT_RULES_V1
		);
		expect(missionAttemptTransitionForCombatResult(safetyResult)).toStrictEqual({
			status: 'retreat',
			outcome: 'retreat',
			cause: 'safety-stop',
			authoredFailure: false
		});
	});
});
