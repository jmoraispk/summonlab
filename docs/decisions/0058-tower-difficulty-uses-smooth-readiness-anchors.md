# 0058 — Tower difficulty uses smooth readiness anchors

**Status:** Accepted in part; cap table superseded by ADR 0063

**Date:** 2026-08-29

## Context

The prototype's level curve ends at level 70 and approximates recommended level as
`ceil(floor × 0.7)`. The target rank caps are instead `10, 20, 30, 40, 50, 99, 999`. Applying those
caps as sudden gates would create difficulty walls and would make raw level a poor description of
party capability.

## Decision

- The tower becomes progressively harder across all one hundred floors; promotion boundaries do
  not create sudden walls.
- Initial balance anchors expect a sound 4★/approximately level-40 party to reach Floors 40–45 and
  a sound level-99 party to reach Floors 85–90.
- Levels above 99 primarily support the final push toward Floor 100 and postgame mastery.
- These anchors are guidance, not locks. A party may outperform or underperform them according to
  skill coverage, roles, equipment, knowledge, cohesion, recovery, motivation, and the quality of
  the player's training and settlement systems.
- Mission content consumes a versioned effective-power/readiness projection and declares readable
  pressure and skill tests. It does not compare only raw level.
- Exact interpolation, reward rates, and Floor-100 expectations remain versioned balance content
  that must be tested; historical level-70 content and receipts remain unchanged.

## Consequences

Progression-v2 needs an explicit cap table and diminishing direct-stat returns above level 99.
Tower content needs a new smooth curve and simulations around the anchor floors. Readiness UI should
explain preparation strengths and gaps rather than show a binary level requirement. Well-designed
systems become a legitimate source of advantage without erasing the value of growth.

ADR 0063 later restored the supplied progression document's `6★ = 70` and `7★ = 99` caps and
removed levels above 99. The smooth-difficulty and effective-readiness decisions on this page remain
in force; its `99/999` table and above-99 tuning direction do not.
