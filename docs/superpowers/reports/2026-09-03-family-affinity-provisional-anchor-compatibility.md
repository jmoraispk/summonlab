# Family Affinity Provisional Anchor Compatibility

Date: 2026-09-03

Approval source: the owner-confirmed
[`2026-09-03-monster-image-single-checkpoint-goal-harness.md`](../plans/2026-09-03-monster-image-single-checkpoint-goal-harness.md)

## Capability

Canonical Fire, Earth, Wind, and Water targets may use `planned-provisional-anchor` only with a
strict `normal-verified-candidate` anchor. The anchor binds the active same-form Normal target,
candidate bytes, immutable result receipt, prompt-verified source chain, and source packet hashes.

This capability authorizes candidate generation only. It records `humanReviewPending: true`, keeps
the result ceiling at `candidate-only`, forbids runtime-catalog mutation, and cannot create an
`approved-review` decision until the Normal anchor is independently approved.

Existing `normal-approved-review` anchors and their immutable receipts remain authoritative and are
never downgraded by bulk provisional activation.

## Sealed surface

The production compatibility receipt explicitly lists the provisional dispatch status, anchor
kind, required canonical Normal-chain binding, and this approval extension. The dispatch bundle,
tracked skill surface, repository dispatch sources, and compatibility hashes are regenerated and
verified as one reviewable migration before affinity image production begins.
