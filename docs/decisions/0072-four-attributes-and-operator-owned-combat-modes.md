# 0072 — Four combat attributes and operator-owned combat modes

**Status:** Accepted

**Date:** 2026-09-06

## Context

The prior progression proposal placed physical power, durability, speed, precision, magical output,
learning, morale, control, and resistance across six attributes. Several attributes then owned too
many unrelated outcomes: Vitality combined Health and mitigation, Spirit combined magic with morale
and control, and learned accuracy or comprehension appeared as innate combat stats. Universal poise
also created a second durability bar without a clear need.

Combat development has a second transition. The intended tactical mode lets each hero independently
select one engine-supplied legal intent from a frozen readiness window, while deterministic engine
code resolves collisions and consequences. That mode is now implemented and mechanically qualified
for operator evaluation. The automatic round resolver remains valuable for a beta, but it must not
become a player preference or silently mutate as the new mode is developed.

## Decision

### Four combat-first attributes

New `character-v2` state uses four visible intrinsic attributes on a `1..100`
scale:

| Attribute | Owns | Explicit exclusions |
| --- | --- | --- |
| Might | physical magnitude, carrying, equipment-load tolerance, authored heavy-item requirements | accuracy, critical chance, general mitigation, action cadence |
| Vitality | maximum Health, modest natural Health regeneration | armour mitigation, blanket resistance, poise, armour eligibility |
| Agility | readiness, movement, evasion, bounded relative speed in hit contests | learned accuracy, critical chance, unrestricted extra actions |
| Spirit | magical magnitude, maximum Mana, modest saturating Mana regeneration | morale, learning, control duration, mental resistance, decision quality |

Dexterity and Intellect are retired as attributes for new canonical mechanics. Learned precision,
knowledge, analysis, crafting quality, and identification belong to skills, practice, evidence, and
the relevant domain learning score. Personality, history, relationships, morale, motivation, and
condition remain separate human layers.

Persistent growth and situational effects are distinct. Generated capability plus typed permanent
receipts forms the intrinsic value. Equipment, effects, and conditions may change only the effective
attribute scopes they explicitly name. The initial new-growth rule grants one freely allocated point
for each level gained. `engine-v26` derives mission attributes from the complete growth-receipt chain
and persists combat proficiency tags plus per-skill mastery separately from those attributes.

Health and Mana remain the only universal resource bars. General mitigation comes from armour after
penetration and is capped at 7,499 basis points by `combat-rules-v1`. Authored Cut, Pierce, Impact,
Burn, Frost, Shock, and Arcane resistance receipts stack under a separate 7,500-basis-point cap.
There is no universal poise; content may opt into an explicit visible Break meter.

Learning profiles remain hidden by default and are generated independently from combat attributes
and stars. A general cognitive factor is bounded to `0.90..1.10` and applies only to
comprehension-heavy practice. Five independent hidden domain scores—martial, magical, crafting,
survival, and social—contribute separately. Neither layer changes model reasoning or action quality,
and player-facing projections omit them.

### Operator-owned versioned modes

The operator selects the release combat mode through configuration. Players have no selector and
cannot submit a mode, actor action, target, choice batch, or policy to current combat. Every prepared
attempt stores an immutable binding containing mode ID, mode-rules version, combat-content hash, and
binding timestamp. Changing the release default affects only future attempts.

`legacy-auto-v1` remains the beta release default. The player may press **Continue battle**, after
which a seeded automatic policy chooses
legal party actions and the deterministic engine resolves them. No hero model or independent model
referee participates. Its exact immutable tuple is `legacy-auto-v1` / `legacy-auto-rules-v1` /
`1abef40c18eb97d4c1694c674f9b4917f286053e6d810d5b4282760f2ab4c2a7`.

`agent-readiness-v1` is implemented and may be selected by the operator for internal evaluation. It
uses one-tick readiness cohorts, one canonical frozen snapshot per cohort, filtered per-actor views,
concurrent intent collection, and deterministic ordered arbitration. It is not player-selectable,
and technical qualification does not change the release default. Promotion still requires a
separate deliberate operator configuration change.

Current evaluation attempts use `agent-readiness-rules-v2` with aggregate content hash
`e78ed494f1ac78f6b0efca0574248425a1bb1148d54fd39161db600964e8919e`. This immutable aggregate adds
V2 hostile actions to the combat skill and equipment-profile catalogs. Monsters receive an
executable deterministic damaging strike against an eligible party target plus an authored Hold
choice; their provider selects among those frozen legal actions. Historical readiness V1 attempts
remain loadable only under their exact V1 rules/content binding.

Every readiness cohort persists one complete combat-window record and exactly one
`decision-job-v3` per ready actor. Window, job, result, and batch authority includes attempt ID,
tick, snapshot, actor-view, and legal-action hashes. Workers may finish out of order, but a batch is
assembled only for the complete cohort. Exhausted provider work uses the exact engine-precomputed
first legal action, canonical target, and supplied fallback.

Mutations lock the authoritative run before the window and actor jobs. A moved run version/cursor
atomically terminalizes the in-progress attempt ledger and durably marks the window and all jobs
stale before the late completion is rejected. Exact batch application is compare-and-swap guarded
and idempotent.

Readiness combat evaluates natural Health and Mana recovery on one calibrated 100-tick pulse
cadence. Health also retains its post-damage delay and never revives a downed actor. Qualification
found that per-tick integer recovery erased low-level peer damage; the pulse prevents that indefinite
combat. It remains versioned tuning rather than a timeless balance claim.

### Mission-assembly return requests

For the v25 beta, the Master may request that a living, idle hero return to the Tower Threshold for
mission assembly. This is settlement direction, not direct control of a combat action: the request
cannot choose an attack, target, policy, or later combat intent, and it cannot interrupt travel,
activity, routine, forging, or settlement duty.

The server fulfills an eligible request through the existing legal route to `gate-dais` and the
existing scheduled arrival advance in one atomic command batch. It never edits location state or
teleports the hero. The travel-start event uses the `mission-readiness` request context, a system
source, and a public summary that identifies the Master's request, so replay and public history show
why the return occurred. Future agent-readiness or idle-policy work may replace immediate compliance
with an authored compliance decision or schedule without changing this beta ownership boundary
retroactively.

## Legacy compatibility projection

New four-attribute heroes can enter `legacy-auto-v1` only through this mode-local, versioned
projection:

```text
legacy might   <- Might
legacy finesse <- Agility
legacy insight <- Spirit
legacy resolve <- Vitality
```

Values scale from `1..100` to `1..10` with integer half-up rounding and clamping. The runner builds a
v24-shaped input for an isolated legacy resolver and restores v25-only state outside that boundary.
The projection is not a character-sheet stat, a migration of historical rows, or permission to use
old aptitudes in new canonical mechanics.

## Replay and release consequences

- Every v1 through v24 schema, reducer, entropy purpose, event byte, and replay hash remains under
  its original version.
- Legacy automatic combat retains sequential entropy and its 48-round safety boundary.
- New attempts record the automatic policy and packet/legal-action/result hashes together with the
  attempt's immutable mode/rules/content binding.
- Both mode runners emit `combat-result-v1` with all final party/hostile combatants, exact
  mode/rules/content identity, typed consequences and claims, and an explicit `death` outcome.
- V26 legacy terminal events atomically carry that common result plus the complete idempotent
  cross-owner claim checkpoint; a partial receipt set cannot replay.
- A mode or behavior change requires a new version. Missing, disabled, or mismatched bindings fail
  explicitly instead of falling through to current code.
- Task 7 combat-skill and combat-equipment-profile catalogs retain separate immutable hashes and an
  aggregate combat-content binding. The historical equipment definition hash is not repurposed.
- Passing balance evidence does not promote every harness formula. Relative-Agility accuracy,
  attack cadence/variance, affinity application, production armour magnitudes, and a magical active
  remain hash-bound benchmark candidates until their owning runtime/content work lands.
- The current checked `agent-readiness-v1.json` records 10,000 distinct deterministic trials for
  the current V2 operator-evaluation binding, 20,000 modeled provider
  failures resolved by exact production deterministic fallback intents, 40,000 applied fallback
  selections across the primary and deterministic repeat resolver passes, and 400 complete minimal
  authored level-archetype encounters through 3,707 encounter resolver calls. Recovery occurs in
  172 encounters; 5,117 applied Health damage exceeds 471 passive Health recovery, while party
  members receive 844 incoming damage. Deterministic replay, classified collision fallback,
  encounter budgets, zero safety/no-progress/regeneration-stalemate stops, zero unclassified
  cancellations, and 100% legal fallback selection pass for that exact binding.
- The qualification preserves the underlying `combat-rules-v1` hash
  `13b2b27b683e4b0023a2a2c2ee4926127437db3bbf1ace91776def69ef286eff`, separately binds
  `agent-readiness-rules-v2` hash
  `21d1dbf74dff606fda8b727566787579c9584234ea9aeee0a26ecbae80a8a80e`, and binds combat-content
  hash `e78ed494f1ac78f6b0efca0574248425a1bb1148d54fd39161db600964e8919e`. Its profile hash is
  `4a3a2858d1d5d9575e2aeb38a9cc5437e8e22b3795b32b2babacc9087bf8bac1`, replay-result hash is
  `dc599786a23e8fc9a8a8b73e9af6a0619f443dd93be201d704cbc22a379526b5`, and artifact SHA-256 is
  `6cf931fb87e8e986a18c7572b9d3399be0632cf5b11dc2d861978d95ca72a452`. Encounter p95 tick/event
  counts are `991/31`, `635/21`, `398/14`, and `229/8` at levels 10, 40, 70, and 99.
- This qualification covers executable damaging hostile actions and supports continued operator
  evaluation. It does not prove full hostile policy variety or product balance, authorize release
  promotion, or change the legacy beta default. The independent legacy balance artifact remains
  unchanged at SHA-256
  `d0b2814acfdca17dcede952f7015a46399e5902b2834cf4607e87e37978eabac`.

## Supersession

This decision supersedes ADR 0063 and the linked wiki pages only where they present the six-attribute
vocabulary, Vitality mitigation/poise, Spirit morale/control/learning, Vitality-supported armour
eligibility, or player-selectable combat policy as current canon. ADR 0063's source-precedence rule
and unrelated progression decisions remain accepted. Historical executable versions remain valid
regardless of prose supersession.

The following pages carry the operative replacement:

- [Attributes](../wiki/mechanics/attributes.md)
- [Attributes and training](../wiki/mechanics/progression/attributes-and-training.md)
- [Skill framework](../wiki/mechanics/skills/framework.md)
- [Equipment](../wiki/mechanics/equipment/README.md)
- [Summoning, Progression, and Combat](../wiki/systems/summoning-progression-combat.md)

## Implementation records

- [Four-attribute legacy combat foundation](../superpowers/plans/2026-09-06-four-attribute-legacy-combat.md)
- [Agent-readiness combat implementation plan](../superpowers/plans/2026-09-06-agent-readiness-combat.md)
- [Accepted design](../superpowers/specs/2026-09-06-attributes-and-combat-modes-design.md)
- [Final integration report](../superpowers/reports/2026-09-07-attribute-combat-modes-integration.md)
