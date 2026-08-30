# Progression, skills, and promotion

Status: **supplied target curve authoritative; mechanics require progression-v2**

Primary owner: hero capability and skill catalog

## Player promise

Heroes grow through practice, teaching, work, missions, facilities, and hard choices. A high level
means reliable accumulated development; skills and party composition determine what that power can
actually accomplish.

## Owns

- XP, level, star cap, attributes, growth choices, and promotion state;
- skill discovery, learning, mastery, unlimited passive ownership, and one active stance;
- effective-power/readiness inputs;
- skill definitions, fusion recipes/templates, and balance budgets.

## Does not own

- the event that won a mission or completed training;
- resource balances and debit/credit;
- summon odds or synthesis source termination;
- mission difficulty, story outcome, or hero personality.

## Rank and level curve

Use a table, not `rank × 10`:

```text
1★ 10 · 2★ 20 · 3★ 30 · 4★ 40 · 5★ 50 · 6★ 70 · 7★ 99
```

The tower and UI consume a versioned `EffectivePowerProjection`. Difficulty rises continuously
rather than at rank walls. Current calibration anchors are:

| Hero progression | Expected tower reach with sound systems |
| --- | --- |
| 4★, near level 40 | approximately Floors 40–45 |
| 6★, near level 70 | late-campaign specialization and final promotion preparation |
| 7★, level 99 | approximately Floors 85–90; build quality carries the final push |

These are balancing targets, not locks. Skill coverage, party roles, equipment, knowledge,
cohesion, recovery, motivation, and player-designed training systems can move performance around the
anchor. A badly designed company can underperform its levels; a coherent one can outperform them.
Level 99 is the authored ceiling. Floor 100 and postgame growth come from mastery, skill breadth and
merging, affinities, equipment, party systems, and other horizontal progression. Old receipts retain
the cap table and balance version they used.

Promotion uses tower evidence, portal/neighbor resources, achievements, facilities, and time.
Synthesis essence may accelerate a path but must always have a non-synthesis alternative.

## Skill lattice

Skills are typed combinations of domain, operation, delivery, aspects, effects, costs, and
tradeoffs. A hero may know a recipe without having learned its inputs, learn a skill without high
mastery, retain unlimited passive skills, maintain only one active stance, and teach only bounded
portions of demonstrated mastery.

Two Master-10 skills may merge into a Novice-1 result when the hero has the recipe and catalyst.
Both inputs are consumed. The result's tier and effect budget come from authored compatibility and
recipe rules rather than input count alone, and it preserves recognizable mechanics from both
inputs.

Authored recipes win. Bounded procedural templates can compose only approved effect operators. A
development workshop may propose new recipes for review; runtime agent prose may name or describe
an existing result but cannot define its effects.

## Interfaces

Consumes:

- idempotent progression grant claims from mission, training, work, teaching, and synthesis;
- resource reservation receipts for promotion/fusion costs;
- character life state and facility capability refs.

Publishes:

- XP/level/mastery/promotion events and exact deltas;
- `CapabilitySnapshot` and context-specific effective power;
- fusion preview/commit receipts with recipe and balance proof.

## Invariants and exploits

- XP cannot exceed the current cap without a completed promotion.
- Over-level rewards diminish instead of farming unbounded low floors.
- Training consumes time, fatigue, facility/tool capacity, and opportunity.
- Teaching cannot create more transferable mastery than the teacher demonstrates.
- Fusion is input-order invariant and rejects cycles, duplicate refunds, and self-reference.
- Repeated fusion cannot grow total effect budget without a paid source.
- One active stance and action opportunity constrain moment-to-moment choices; passive effects are
  unlimited as authored and therefore require bounded individual effects and stacking rules.
- Level and mastery remain complementary; neither replaces the other.

## Roadmap

1. Add progression-v2 table, grant claim, effective-power projection, and compatibility fixtures.
2. Expand the skill catalog beyond sword fighting across combat and civic roles.
3. Add mastery, teaching, the one-stance rule, and star-stone promotion.
4. Prove deterministic two-input fusion with cycle/budget property tests.
5. Expand authored two-input recipe coverage and add a development recipe workshop.
6. Balance 6★ levels 51–70 and 7★ levels 71–99 only after late-band and postgame simulations.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | superseded | Earlier conversational caps were 10/20/30/40/50/99/999. | ADR 0063 restores the later supplied source's 70/99 caps. |
| 2026-08-29 | accepted | Supplied Markdown wins earlier conversational conflicts; caps are 10/20/30/40/50/70/99. | Use the authored table in progression-v2 and horizontal growth for Floor 100/postgame. |
| 2026-08-29 | superseded | Earlier feedback asked for any two or three skill inputs. | The later supplied compendium makes merging a consumed two-input recipe. |
| 2026-08-29 | accepted | Supplied skill rules win earlier conversational conflicts. | Use two consumed Master-10 inputs, a recipe, a catalyst, and a Novice-1 result. |
| 2026-08-29 | accepted | Level 99 should clear roughly Floor 85–90 and 4★/level 40 roughly Floor 40–45. | Add smooth readiness anchors without hard floor locks; the source cap means final floors require horizontal build quality. |
| 2026-08-29 | experiment | Heroes and monsters share affinities that can modify derived attributes and apply effects such as Fire/Burn, Wind/Cut, and Wood/Slow. | Define one typed affinity/status resolver in the wiki; keep exact roster and numbers draft pending combat simulation. |

## Open decisions

- What deterministic budget and compatibility rules cover every authored two-input pairing?
- How do unlimited passives stack without making acquisition order the only meaningful build choice?

## Existing foundations

Start with `docs/game-design.md` progression sections, ADR 0056, `HeroProgressionSchema`, journal
reward deltas, `tower-progression-preview-v1`, and current training/synthesis events. Preserve old
level-70 histories exactly. Use the [affinity wiki](../../wiki/mechanics/affinities/README.md) as the
current design workspace for shared hero/monster affinity mechanics.
