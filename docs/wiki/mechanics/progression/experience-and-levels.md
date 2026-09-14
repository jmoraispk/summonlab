# Experience and levels

Wiki ID: `mechanics.progression.experience-levels`

Heroes share one cumulative experience total and one level from `1` through `999`. The first rules
version uses ten XP per level so tests and receipts stay easy to audit; XP quantities are tuning
data, not a promise about final pacing.

## Combat evidence

A hero qualifies through at least one applied combat effect or objective-evidence record. Damage,
protection, recovery, and objective work are valid contributions. Presence, narration, canceled or
superseded actions, and last-hit identity are not. Success, failure, and retreat may all preserve
legitimate contribution XP. Difficulty, objective completion, first clear, and bounded repetition
shape the amount.

Both `legacy-auto-v1` and `agent-readiness-v1` adapt their resolved facts into the same
`CombatContributionEvidenceV1` contract before the shared progression owner issues a receipt.

## Crafting evidence

Crafting XP is issued only when a result completes. Forging and future cooking use the same
`ProductionCompletionEvidenceV1` shape:

```text
XP = f(recipe difficulty, consumed ingredient rarity, result quality, novelty, repetition)
```

Higher difficulty or rarity never lowers an otherwise equal reward. A first successful result gets
a novelty bonus. Repeated easy work decays to a positive floor. Reservation, cancellation, or an
invalid attempt grants no completed-result XP.

## Level resolution

One receipt may cross several levels. Every crossed level grants the hero's immutable star count in
unallocated attribute points. At level 999, XP can remain cumulative but cannot create a level 1000
or extra level points. Stars never change during XP resolution.

See the exact checked comparisons in
[progression-balance-v1](../../../evidence/progression-balance-v1.json).
