import type {
	CombatResolvedEvent,
	CombatResult,
	ReadinessCombatStateV1
} from '@summonlab/contracts';
import {
	AGENT_READINESS_CONTENT_BINDING_V2,
	AGENT_READINESS_RULES_V2_VERSION,
	COMBAT_CONTENT_BINDING,
	COMBAT_RULES_V1
} from '@summonlab/content';
import { describe, expect, it } from 'vitest';

import { deterministicUuid, hashCanonical } from '../../hash.js';
import { healthRegeneration } from '../combat/capability.js';
import { emitCombatOutcome } from '../combat/outcome.js';
import type { EmitCombatOutcomeInput } from '../combat/outcome.js';
import {
	createCombatMissionClaimProjection,
	missionAttemptTransitionForCombatResult
} from '../mission/lifecycle.js';
import {
	transitionCombatResultClaims,
	type CombatClaimTransitionInput
} from '../../orchestration/combat-claims.js';
import { createCombatProgressionClaimProjection } from './claims.js';

const ID = {
	attempt: '62000000-0000-4000-8000-000000000001',
	hero: '62000000-0000-4000-8000-000000000002',
	monster: '62000000-0000-4000-8000-000000000003',
	window: '62000000-0000-4000-8000-000000000004',
	action: '62000000-0000-4000-8000-000000000005',
	event: '62000000-0000-4000-8000-000000000006'
} as const;

const READINESS_BINDING = {
	modeId: 'agent-readiness-v1' as const,
	rulesVersion: AGENT_READINESS_RULES_V2_VERSION,
	contentHash: AGENT_READINESS_CONTENT_BINDING_V2.contentHash,
	boundAt: '2000-01-01T00:00:00.000Z'
};

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
	return emitCombatOutcome({
		attemptId: ID.attempt,
		combatModeBinding: READINESS_BINDING,
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
	});
}

function authorityFor(combatResult: CombatResult): EmitCombatOutcomeInput {
	return {
		attemptId: combatResult.attemptId,
		combatModeBinding: {
			modeId: combatResult.modeId,
			rulesVersion: combatResult.rulesVersion,
			contentHash: combatResult.contentHash
		},
		endedAtTick: combatResult.endedAtTick,
		termination:
			combatResult.outcome === 'safety-stop'
				? { kind: 'safety-stop', safetyStop: combatResult.safetyStop! }
				: { kind: combatResult.outcome },
		partyHeroIds: combatResult.claimEvidence.partyHeroIds,
		engineDamageTakenByHeroId: combatResult.claimEvidence.engineDamageTakenByHeroId,
		finalCombatants: combatResult.finalCombatants,
		resolvedEvents: combatResult.claimEvidence.resolvedEvents,
		engineRecoveredCombatantIds: combatResult.claimEvidence.engineRecoveredCombatantIds,
		securedLoot: combatResult.claimEvidence.securedLoot,
		objectiveStates: combatResult.claimEvidence.objectiveStates,
		decisiveEventIds: combatResult.decisiveEventIds
	};
}

function applyResultClaims(
	input: CombatClaimTransitionInput,
	combatResult: CombatResult,
	authoritativeResult: CombatResult = combatResult
) {
	return transitionCombatResultClaims(
		input,
		combatResult,
		authorityFor(authoritativeResult),
		READINESS_BINDING
	);
}

describe('combat claim process managers', () => {
	it('rejects a self-consistent forged result that diverges from trusted terminal evidence', () => {
		const trusted = result('retreat');
		const authority = authorityFor(trusted);
		const forged = emitCombatOutcome({
			...authority,
			securedLoot: [{ ownerId: ID.hero, lootId: 'iron-ore', quantity: 99 }]
		});
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

		expect(() => transitionCombatResultClaims(input, forged, authority, READINESS_BINDING)).toThrow(
			/authority/iu
		);
	});

	it('rejects a self-consistent result whose authority drifts from the persisted attempt binding', () => {
		const trusted = result('retreat');
		const authority = authorityFor(trusted);
		const wrongAttemptBinding = {
			modeId: 'legacy-auto-v1' as const,
			rulesVersion: 'legacy-auto-rules-v1',
			contentHash: COMBAT_CONTENT_BINDING.contentHash,
			boundAt: READINESS_BINDING.boundAt
		};
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

		expect(() =>
			transitionCombatResultClaims(input, trusted, authority, wrongAttemptBinding)
		).toThrow(/attempt binding/iu);
	});
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
		const applied = applyResultClaims(
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
		const first = applyResultClaims(initial, combatResult);
		const second = applyResultClaims(first, combatResult);

		expect(second).toStrictEqual(first);
		expect(hashCanonical(second)).toBe(hashCanonical(first));
		expect(second.mission.loot[ID.hero]).toStrictEqual({ 'iron-ore': 2 });
		expect(second.progression.practiceEvidence[ID.hero]?.['combat-skill-basic-sword-strike']).toBe(
			1
		);
	});

	it('rejects a duplicate whose receipts remain valid but whose owner effects were rolled back', () => {
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
		const applied = applyResultClaims(initial, combatResult);
		const rolledBack = {
			...applied,
			mission: {
				...applied.mission,
				harm: {},
				loot: {},
				objectives: {},
				attempts: {}
			},
			progression: {
				...applied.progression,
				practiceEvidence: {}
			}
		};
		const before = hashCanonical(rolledBack);

		expect(() => applyResultClaims(rolledBack, combatResult)).toThrow(/checkpoint|atomic/iu);
		expect(hashCanonical(rolledBack)).toBe(before);
	});

	it.each([
		['pre-transition mission hash', 'beforeMissionHash'],
		['post-transition progression hash', 'afterProgressionHash'],
		['canonical result hash', 'resultHash'],
		['claim manifest hash', 'claimManifestHash'],
		['authority hash', 'authorityHash']
	] as const)('rejects a checkpoint with the wrong %s', (_label, field) => {
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
		const applied = applyResultClaims(initial, combatResult);
		const poisoned = {
			...applied,
			checkpoint: { ...applied.checkpoint, [field]: 'f'.repeat(64) }
		};

		expect(() => applyResultClaims(poisoned, combatResult)).toThrow(/checkpoint/iu);
	});

	it('rejects a poisoned deterministic receipt before considering any claim applied', () => {
		const combatResult = result('retreat');
		const first = applyResultClaims(
			{
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
			},
			combatResult
		);
		const [key, receipt] = Object.entries(first.mission.receipts)[0]!;
		const poisoned = {
			mission: {
				...first.mission,
				receipts: {
					...first.mission.receipts,
					[key]: { ...receipt, receiptId: '62000000-0000-4000-8000-000000000099' }
				}
			},
			progression: first.progression
		};
		const before = hashCanonical(poisoned);

		expect(() => applyResultClaims(poisoned, combatResult)).toThrow(/receipt/iu);
		expect(hashCanonical(poisoned)).toBe(before);
	});

	it('strictly validates the entire projection including an unrelated poisoned receipt', () => {
		const combatResult = result('retreat');
		const applied = applyResultClaims(
			{
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
			},
			combatResult
		);
		const receipt = Object.values(applied.mission.receipts)[0]!;
		const poisoned = {
			mission: {
				...applied.mission,
				receipts: {
					...applied.mission.receipts,
					'unrelated-poison': {
						...receipt,
						idempotencyKey: 'unrelated-poison',
						claimHash: 'f'.repeat(64),
						receiptId: deterministicUuid(
							`unrelated-poison:receipt:${receipt.owner}:${receipt.inputHash}`
						)
					}
				}
			},
			progression: applied.progression
		} as unknown as CombatClaimTransitionInput;

		expect(() => applyResultClaims(poisoned, combatResult)).toThrow(/projection|receipt/iu);
	});

	it('rejects a partially persisted claim set instead of completing half an atomic transition', () => {
		const combatResult = result('retreat');
		const applied = applyResultClaims(
			{
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
			},
			combatResult
		);
		const missionReceipts = Object.fromEntries(Object.entries(applied.mission.receipts).slice(1));
		const partial = {
			mission: { ...applied.mission, receipts: missionReceipts },
			progression: applied.progression
		};
		const before = hashCanonical(partial);

		expect(() => applyResultClaims(partial, combatResult)).toThrow(/partial|atomic/iu);
		expect(hashCanonical(partial)).toBe(before);
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
		expect(() => applyResultClaims(input, forged, valid)).toThrow(/manifest|recovery/iu);
		expect(input.mission.combatants[ID.hero]?.health).toBe(100);
	});

	it.each([
		['loot quantity', 'loot', { quantity: 99 }],
		['practice amount', 'skill-practice', { practiceEvidence: 99 }],
		['objective state', 'objective', { completed: true }],
		['harm amount', 'harm', { damageTaken: 99 }],
		['claim identity', 'loot', { claimId: '62000000-0000-4000-8000-000000000099' }],
		['idempotency identity', 'loot', { idempotencyKey: `${ID.attempt}:forged-loot` }]
	] as const)('rejects a forged %s before either owner changes', (_label, claimType, patch) => {
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
		const before = hashCanonical(initial);
		const valid = result('retreat');
		const forged = {
			...valid,
			claims: valid.claims.map((claim) =>
				claim.claimType === claimType ? { ...claim, ...patch } : claim
			)
		} as CombatResult;

		expect(() => applyResultClaims(initial, forged, valid)).toThrow(/manifest|claim/iu);
		expect(hashCanonical(initial)).toBe(before);
	});

	it('rejects missing and duplicated claim identities instead of partially applying a manifest', () => {
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
		const valid = result('retreat');
		const missing = {
			...valid,
			claims: valid.claims.filter((claim) => claim.claimType !== 'skill-practice')
		};
		const duplicatedId = {
			...valid,
			claims: valid.claims.map((claim, index) =>
				index === 1 ? { ...claim, claimId: valid.claims[0]!.claimId } : claim
			)
		};

		expect(() => applyResultClaims(initial, missing, valid)).toThrow(/manifest|claim/iu);
		expect(() => applyResultClaims(initial, duplicatedId, valid)).toThrow(/manifest|claim/iu);
	});

	it('rejects recovery reordered before final resources and leaves both owner inputs untouched', () => {
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
		const before = hashCanonical(initial);
		const valid = result('victory', { downed: true, recovered: true });
		const recovery = valid.claims.find((claim) => claim.claimType === 'recovery')!;
		const reordered = {
			...valid,
			claims: [recovery, ...valid.claims.filter((claim) => claim !== recovery)]
		};

		expect(() => applyResultClaims(initial, reordered, valid)).toThrow(/manifest|order/iu);
		expect(hashCanonical(initial)).toBe(before);
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
		const applied = applyResultClaims(
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
		const safetyResult = emitCombatOutcome({
			attemptId: ID.attempt,
			combatModeBinding: READINESS_BINDING,
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
		});
		expect(missionAttemptTransitionForCombatResult(safetyResult)).toStrictEqual({
			status: 'retreat',
			outcome: 'retreat',
			cause: 'safety-stop',
			authoredFailure: false
		});
	});
});
