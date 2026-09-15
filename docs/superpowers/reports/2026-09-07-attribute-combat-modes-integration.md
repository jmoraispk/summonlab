# Attribute and Combat Modes Integration Report

Date: 2026-09-07

Status: **implemented and mechanically qualified for operator evaluation; legacy remains the beta
default; owner promotion and full hostile balance remain outstanding**

Current progression and naming are superseded by
[ADR 0073](../../decisions/0073-awakening-and-multi-path-progression.md); the combat-mode
qualification remains valid.

## Integrated outcome

`engine-v26` closes the mechanical gap between the four-attribute character foundation and the
agent-readiness resolver without changing historical V1–V25 rules or replay bytes.

- Strength, Agility, Vitality, and Magic remain the only visible combat attributes.
- Mission assembly derives intrinsic attributes from the generated capability plus the complete
  append-only growth-receipt chain, then applies only modifiers valid for the requested effective
  scope.
- V26 heroes persist combat proficiency tags and per-skill mastery independently from attributes.
- Readiness legal actions are derived from the exact equipped instances, combat equipment profiles,
  load tolerance, intrinsic Strength gates, Armor Training, skill delivery tags, trained delivery
  tags, and current per-skill mastery step.
- Equipped-item grants project named Cut, Pierce, Impact, Burn, Frost, Shock, and Arcane resistances
  in readiness combat. The typed receipt pipeline also reserves passive-skill and physiology sources
  for explicitly authored integrations. Vitality grants no mitigation or armor eligibility, and
  universal poise remains absent.
- Authenticated readiness skill use produces idempotent practice claims. Applied practice advances
  the matching persisted mastery, capped at 100, and the next attempt consumes the new step.

## Release-mode boundary

Both supported modes are operator-owned configuration. Players receive no mode selector, provider
selector, or low-level action/target/choice-batch field.

| Mode | Current role | Immutable attempt binding |
| --- | --- | --- |
| `legacy-auto-v1` | beta default | `legacy-auto-rules-v1` plus `1abef40c18eb97d4c1694c674f9b4917f286053e6d810d5b4282760f2ab4c2a7` |
| `agent-readiness-v1` | internal operator evaluation | `agent-readiness-rules-v2` plus `e78ed494f1ac78f6b0efca0574248425a1bb1148d54fd39161db600964e8919e` |

Preparation materializes the selected tuple onto the attempt. A later deployment-configuration
change affects only future attempts. Historical readiness V1 attempts remain readable only with
their exact V1 rules/content pair; the runtime does not substitute V2.

## Timing, collisions, and authority

Readiness advances in logical ticks. Every active actor that becomes ready on tick `T` joins one
cohort and chooses against the same frozen snapshot. The window is never widened to collect more
calls, and provider latency does not advance simulation time.

The engine orders the validated cohort by exact readiness, authored reaction priority, and a
purpose-keyed tie-break. It revalidates each action against progressively resolved state. A moved or
downed target, claimed tile, or other collision follows only the action's authored and selected
fallback/refund policy. No provider is re-queried. Providers select intent; the engine alone resolves
movement, hit/miss, critical, damage, mitigation, resistance, status, downing, death, and terminal
outcome.

Readiness V2 adds executable deterministic damaging monster strikes against eligible party targets
while retaining an authored Hold choice. A provider selects among the frozen legal choices. The
qualification harness exercises the attack path; this proves real hostile resolution, not finished
hostile policy diversity or balance.

## Durable decision boundary

One durable combat-window row owns the full cohort. It records run, attempt, tick, snapshot hash,
expected run version, and expected event cursor. Exactly one `decision-job-v3` child is stored per
ready actor with its actor-view hash, legal-action hash, and exact engine-precomputed fallback.

Workers may finish independently and out of order. A response can enter the batch only when its
window, attempt, tick, actor, snapshot, view, legal set, action instance, target, and optional
fallback all match. The batch is assembled only after the full cohort has a valid provider result or
an exhausted deterministic fallback.

Mutating paths lock the authoritative run before the window and actor jobs. When the run version or
cursor is stale, the transaction atomically terminalizes the in-progress attempt ledger, durably
marks the whole window and its jobs stale, and then rejects the late completion. Exact batch
application is compare-and-swap guarded, advances one authoritative engine event, and returns the
persisted receipt on an exact retry.

## Common result and atomic claims

Readiness and V26 legacy terminal paths both emit `combat-result-v1`. The result includes every final
party and hostile combatant, final resources, harm/recovery and practice evidence, objectives,
loot/extraction claims, decisive events, trace hash, and the exact persisted mode/rules/content
identity. The accepted outcomes include explicit `death`; a downed Master resolves to death before a
later enemy defeat can be interpreted as victory.

The V26 legacy adapter does not change frozen round resolution. At terminal resolution it constructs
the common result, authenticates it against the attempt binding, derives and verifies the complete
owner-specific idempotent claim projection against the frozen side effects, and records the result
plus cross-owner claim checkpoint atomically with the terminal event. Partial receipt sets and
checkpoint-free claim replays fail closed.

## Evidence posture

The checked `docs/evidence/agent-readiness-v1.json` binds `agent-readiness-rules-v2` hash
`21d1dbf74dff606fda8b727566787579c9584234ea9aeee0a26ecbae80a8a80e` and aggregate content hash
`e78ed494f1ac78f6b0efca0574248425a1bb1148d54fd39161db600964e8919e`. Its qualification-profile
hash is `4a3a2858d1d5d9575e2aeb38a9cc5437e8e22b3795b32b2babacc9087bf8bac1`, replay-result hash is
`dc599786a23e8fc9a8a8b73e9af6a0619f443dd93be201d704cbc22a379526b5`, and artifact SHA-256 is
`6cf931fb87e8e986a18c7572b9d3399be0632cf5b11dc2d861978d95ca72a452`.

It records 10,000 seeded trials, 20,000 modeled provider failures, 40,000 applied fallback
selections, and 400 complete encounters through 3,707 encounter resolver calls. There are zero
safety stops, no-progress stops, regeneration stalemates, nondeterministic replays, or unclassified
cancellations. Aggregate applied damage is 5,117, incoming party damage is 844, passive Health
recovery is 471, and recovery appears in 172 encounters. P95 tick/event counts are `991/31`,
`635/21`, `398/14`, and `229/8` at levels 10, 40, 70, and 99.

The independent `docs/evidence/combat-balance-v1.json` legacy artifact remains byte-stable at
SHA-256 `d0b2814acfdca17dcede952f7015a46399e5902b2834cf4607e87e37978eabac`. The current V2 evidence
qualifies mechanical operator evaluation; it does not claim readiness promotion, a player-visible
mode choice, full hostile balance, broad hostile tactics, final armor magnitudes, or a
release-default change.

## Governing records

- [Accepted design](../specs/2026-09-06-attributes-and-combat-modes-design.md)
- [Agent-readiness implementation plan](../plans/2026-09-06-agent-readiness-combat.md)
- [ADR 0072](../../decisions/0072-four-attributes-and-operator-owned-combat-modes.md)
- [Operative combat wiki](../../wiki/systems/summoning-progression-combat.md)
