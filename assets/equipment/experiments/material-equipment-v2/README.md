# Material Equipment v2 planning package

Status: **root-only run activated; 77 root images authorized**.

This directory prepares the collision-safe successor to `material-equipment-v1`. It contains only:

- a deterministic 161-target [manifest](manifest.json);
- a non-executable [allocation plan](allocation-plan.json) with 77 root jobs, 84 gated Armour-piece
  jobs, and 21 full-set review gates;
- an approval-candidate [visual profile](visual-profile/profile.json), its hash-bound owner
  [acceptance receipt](visual-profile/acceptance.json), and local structural schemas.

The profile acceptance remains `visual-profile-only`. Separate immutable run evidence now binds 77
materialized root target/assignment pairs and authorizes those roots at concurrency 16. The 84
Armour-piece targets remain unmaterialized and unauthorized behind their 21 full-set review gates.
Every terminal root result is followed by one root-orchestrator-owned, exclusive-created receipt
under the activated run's `terminal/` directory. That per-target receipt hash-binds the immutable
plan, activation, packets, and verified result without introducing a shared writer file. Workers
remain limited to the candidate and provenance-result paths in their immutable assignments.
There are no approved sources or runtime exports. Existing v1 evidence is immutable and explicitly
forbidden as an output destination.

## Root run result

`material-equipment-v2-run-001` has completed all 77 authorized root attempts. Every root has a
verified provenance result and root-orchestrator terminal receipt. Machine-checklist outcomes are
37 `candidate` (**pass**), 33 `revise` (**check**), and 7 `failed` (**no image**), yielding 70
reviewable PNGs. These labels are producer triage, not human approval or rejection.

The seven no-image targets are Bronze Mace, Bronze Shield, Coarse Hide Light Armour full set, Iron
Axe, Blacksteel Heavy Armour full set, Heartwood Staff, and Sunsteel Sword. Their single-call
assignments returned no safely bindable source; each failure remains recorded rather than silently
retried or replaced. The 84 Armour pieces remain gated, with zero review receipts and zero child
packets.

## Locked v2 changes

- Bronze replaces the old F-rank metal name.
- Ash remains the F-rank wood.
- Hard Leather is the E-rank hide.
- The primary Axe is the standard single-bit variant; double-bit war axes are deferred.
- Every isolated class has a hash-bound pose reference and cross-rank camera, pivot, scale, and
  angle lock.
- Full Armour sets use the Coarse Hide composition as a camera/display reference while remaining
  empty and self-supporting, with Head, Torso, Legs, and paired Boots readable.
- Eight percent is the composition target; five percent is the hard framing minimum.
- Once the 5% hard minimum is met, preserving the class pose is more important than adding empty
  space to reach the 8% target.

The referenced v1 images are pose, camera, or style inputs only. They remain candidates rather than
approved or runtime assets, and their material or design must not transfer into v2 targets.

## Deterministic maintenance

Run from the repository root:

```bash
corepack pnpm tsx tools/export-equipment-material-production-v2.ts
corepack pnpm tsx tools/export-equipment-image-profile-v2.ts
corepack pnpm tsx tools/export-equipment-image-contracts-v2.ts --check
corepack pnpm tsx tools/export-equipment-material-production-v2.ts --check
corepack pnpm tsx tools/export-equipment-image-profile-v2.ts --check
corepack pnpm tsx tools/equipment-image-production-v2.ts check-root-packets
corepack pnpm tsx tools/equipment-image-production-v2.ts report-readiness \
  --created-at 2026-09-02T22:15:00.000Z --checked-at 2026-09-02T22:15:03.000Z
```

## Execution boundary

The additive v2 schemas define profile acceptance, target, assignment, result, Armour-source review,
and contract-readiness records. The Equipment-local v2 path materializes and validates all 77 root
envelopes with class-scoped references, binds them into one immutable root-only run, and verifies and
exclusively persists PNG candidates and their result evidence. The v1/shared runner remains separate.
Result recording becomes terminal only after its collision-safe, per-target journal receipt is
persisted and reverified against the activated run by the root orchestrator. The orchestrator-only
`tools/record-equipment-image-terminal-v2.ts` command enforces this ownership split; it is not a
worker helper.
Only the activated roots may run; Armour pieces require a later accepted full-set receipt. No worker
may modify engine contracts, shared runtime catalogs, reviews, or approved assets.

The JSON schemas are structural documentation. Acceptance also parses the profile with
`EquipmentVisualProfileV2Schema.parse`, verifies the deterministic canonical hash, and verifies all
ten referenced files byte-for-byte.
