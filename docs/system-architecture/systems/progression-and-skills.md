# Progression, skills, and promotion

Status: **target curve accepted; mechanics require progression-v2**

Primary owner: hero capability and skill catalog

## Player promise

Heroes grow through practice, teaching, work, missions, facilities, and hard choices. A high level
means reliable accumulated development; skills and party composition determine what that power can
actually accomplish.

## Owns

- XP, level, star cap, attributes, growth choices, and promotion state;
- skill discovery, learning, mastery, and equipped capacity;
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
1★ 10 · 2★ 20 · 3★ 30 · 4★ 40 · 5★ 50 · 6★ 99 · 7★ 999
```

The tower and UI consume a versioned `EffectivePowerProjection`. Difficulty rises continuously
rather than at rank walls. Current calibration anchors are:

| Hero progression | Expected tower reach with sound systems |
| --- | --- |
| 4★, near level 40 | approximately Floors 40–45 |
| 6★, level 99 | approximately Floors 85–90 |
| 7★, above level 99 | final push toward Floor 100 and postgame |

These are balancing targets, not locks. Skill coverage, party roles, equipment, knowledge,
cohesion, recovery, motivation, and player-designed training systems can move performance around the
anchor. A badly designed company can underperform its levels; a coherent one can outperform them.
Levels 100–999 use sharply diminishing direct-stat gains. Old receipts retain the cap table and
balance version they used.

Promotion uses tower evidence, portal/neighbor resources, achievements, facilities, and time.
Synthesis essence may accelerate a path but must always have a non-synthesis alternative.

## Skill lattice

Skills are typed combinations of domain, operation, delivery, aspects, effects, costs, and
tradeoffs. A hero may know a recipe without having learned its inputs, learn a skill without high
mastery, master more skills than can be equipped, and teach only bounded portions of demonstrated
mastery.

Two Tier-1 skills may form a Tier-2 result and three Tier-1 inputs may form a Tier-3 result, but
input count alone does not grant power. The fusion rule pays an explicit budget from input tier,
catalyst, promotion capacity, costs, slots, or drawbacks. Every result preserves at least one
recognizable mechanic from each input.

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
- Skill slots and action economy prevent a giant library from becoming every build at once.
- Level and mastery remain complementary; neither replaces the other.

## Roadmap

1. Add progression-v2 table, grant claim, effective-power projection, and compatibility fixtures.
2. Expand the skill catalog beyond sword fighting across combat and civic roles.
3. Add mastery, teaching, skill slots, and promotion choices.
4. Prove deterministic two-input fusion with cycle/budget property tests.
5. Add three-input/template fusion and a development recipe workshop.
6. Balance 6★ and 7★ only after late-band and postgame simulations.

## Feedback ledger

| Date | Status | Feedback | Consequence |
| --- | --- | --- | --- |
| 2026-08-29 | accepted | Caps are 10/20/30/40/50/99/999. | Replace the formula in a new version; use effective power for content. |
| 2026-08-29 | accepted | The internal skill tree should be extensive and merge any two or three skills. | Use a hidden typed lattice with deterministic authored/template composition. |
| 2026-08-29 | accepted | Level 99 should clear roughly Floor 85–90; 4★/level 40 roughly Floor 40–45; 100+ is for Floor 100 and postgame. | Add smooth readiness anchors without hard floor locks or sudden rank walls. |

## Open decisions

- Does fusion consume the input skills, preserve them, or consume only fragments/catalysts?
- How many equipped active/passive skill slots should each promotion expose?

## Existing foundations

Start with `docs/game-design.md` progression sections, ADR 0056, `HeroProgressionSchema`, journal
reward deltas, `tower-progression-preview-v1`, and current training/synthesis events. Preserve old
level-70 histories exactly.
