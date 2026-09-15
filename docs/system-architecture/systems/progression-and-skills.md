# Progression and skills

Status: **engine-v27 progression implemented; broader skill systems staged**

Primary owner: hero progression state, versioned progression rules, and the skill catalog

## Player promise

Every hero can grow to level 999 through meaningful combat or completed crafting. Immutable stars
control only how many allocatable attribute points each gained level grants. Typed training and
other authored evidence can grow attributes directly, while skill mastery continues to describe
learned execution.

## Owns

- one cumulative XP total, level `1..999`, immutable `1★..7★` rating, unallocated points, and typed
  permanent attribute growth;
- awakening tier and versioned Strength/Magic power plus Vitality/Health conversion tables;
- idempotent experience and direct-growth claims with exact before/after receipts;
- skill discovery, learning, practice, mastery, and later fusion budgets;
- server-safe progression projections in `STR`, `AGI`, `VIT`, `MAG` order.

## Does not own

- the combat or production event that supplies evidence;
- resource balances, ingredient reservation, or encounter resolution;
- summon odds, hero identity, personality, or learning-profile disclosure;
- equipment flat power, armor, accuracy, cadence, affinity ratios, or skill coefficients.

## Versioned progression

Engine-v27 binds `hero-progression-v2` state to a content-hashed `progression-rules-v1` table. The
awakening tier is `floor(level / 100)`. Power conversion reaches `5×` and Health-per-Vitality reaches
25 at tier 9. Every applicable intrinsic point uses the current tier, irrespective of source or
age. A future buff or nerf publishes a new table and hash without changing the state schema.

Every crossed level grants exactly `stars` unallocated points. Stars have no promotion state,
upgrade command, cap table, stone economy, or fusion odds. Level 999 is a hard level boundary, not a
star-dependent ceiling.

## Evidence adapters

Combat adapters accept only resolved contribution evidence—damage, protection/recovery, and
objective work—not presence or last-hit identity. Production adapters accept only completed
results, with difficulty, ingredient rarity, quality, novelty, and repetition inputs. Forging uses
the first adapter; cooking can implement the same contract later. Either macro path may earn XP for
any hero.

Both engine-v27 combat modes issue their evidence through this owner. Historical engine-v25 and
engine-v26 states remain replay-bound to their original behavior.

## Skill boundary

Hero XP and skill practice are separate. One event may issue both claims, but neither substitutes
for the other. Skills remain typed combinations of domain, operation, delivery, effects, costs, and
tradeoffs. Future mastery, teaching, one-stance, passive stacking, and two-input fusion work must
preserve this separation and issue its own versioned receipts.

## Invariants

- Level never exceeds 999 and a capped hero receives no additional level points.
- Stars never change after generation.
- A source event and evidence key cannot pay twice.
- Canceled crafts, invalid attempts, narrated intent, and combat presence alone grant no XP.
- Awakening does not multiply ratio statistics, flat equipment/effect values, skill mastery, XP, or
  craft quality.
- Historical rules and receipts never resolve through a newer table accidentally.

## Evidence and decisions

- [ADR 0073](../../decisions/0073-awakening-and-multi-path-progression.md)
- [Progression balance evidence](../../evidence/progression-balance-v1.json)
- [Progression wiki](../../wiki/mechanics/progression/README.md)
- [Overgeared comparison](../../wiki/research/attribute-systems/overgeared/README.md)
