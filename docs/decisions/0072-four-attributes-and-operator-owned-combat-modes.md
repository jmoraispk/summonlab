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
code resolves collisions and consequences. That mode needs more implementation and evidence. The
current automatic round resolver remains valuable for a beta, but it must not become a player
preference or silently mutate as the new mode is developed.

## Decision

### Four combat-first attributes

New `character-v2` and `engine-v25` state uses four visible intrinsic attributes on a `1..100`
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
for each level gained.

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
cannot submit a mode, actor action, target, choice batch, or policy to v25 combat. Every prepared
attempt stores an immutable binding containing mode ID, mode-rules version, combat-content hash, and
binding timestamp. Changing the release default affects only future attempts.

`legacy-auto-v1` remains the beta release default. The player may press **Continue battle**, after
which a seeded automatic policy chooses
legal party actions and the deterministic engine resolves them. No hero model or independent model
referee participates.

`agent-readiness-v1` is implemented and may be selected by the operator for internal evaluation. It
uses one-tick readiness cohorts, one canonical frozen snapshot per cohort, filtered per-actor views,
concurrent intent collection, and deterministic ordered arbitration. It is not player-selectable,
and technical qualification does not change the release default. Promotion still requires a
separate deliberate operator configuration change.

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
- A mode or behavior change requires a new version. Missing, disabled, or mismatched bindings fail
  explicitly instead of falling through to current code.
- Task 7 combat-skill and combat-equipment-profile catalogs retain separate immutable hashes and an
  aggregate combat-content binding. The historical equipment definition hash is not repurposed.
- Passing balance evidence does not promote every harness formula. Relative-Agility accuracy,
  attack cadence/variance, affinity application, production armour magnitudes, and a magical active
  remain hash-bound benchmark candidates until their owning runtime/content work lands.
- `agent-readiness-v1.json` records 10,000 distinct deterministic trials, 20,000 modeled provider
  failures resolved by exact production deterministic fallback intents, 40,000 applied fallback
  selections across the primary and deterministic repeat resolver passes, and 400 complete minimal
  authored level-archetype encounters. Recovery occurs in 180 encounters, with 4,363 applied Health
  damage exceeding 363 passive Health recovery. Deterministic replay, classified collision fallback,
  encounter budgets, zero safety/no-progress stops, and 100% legal fallback
  selection pass. Policy-authored monsters currently hold
  rather than attack, so this qualifies the technical mode for operator evaluation without claiming
  finished hostile-AI balance.
- The qualification preserves the historical `combat-rules-v1` hash
  `13b2b27b683e4b0023a2a2c2ee4926127437db3bbf1ace91776def69ef286eff`, separately binds
  `agent-readiness-rules-v1` hash
  `eb7296798dbc911526603b1fb908cd3a7ea3661caf7d69793fc1fc0ab09cc5ba`, and binds combat-content
  hash `1abef40c18eb97d4c1694c674f9b4917f286053e6d810d5b4282760f2ab4c2a7`. Encounter p95 tick/event
  counts are `1090/35`, `715/23`, `398/14`, and `288/11` at levels 10, 40, 70, and 99.

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
