# Material Equipment v2 planning package

Status: **owner-accepted visual profile; execution remains inert**.

This directory prepares the collision-safe successor to `material-equipment-v1`. It contains only:

- a deterministic 161-target [manifest](manifest.json);
- a non-executable [allocation plan](allocation-plan.json) with 77 root jobs, 84 gated Armour-piece
  jobs, and 21 full-set review gates;
- an approval-candidate [visual profile](visual-profile/profile.json), its hash-bound owner
  [acceptance receipt](visual-profile/acceptance.json), and local structural schemas.

The acceptance scope is `visual-profile-only`: it does not authorize packet materialization, a run,
or image generation. This directory still contains no target packets, assignments, run, Armour
review receipts, candidates, results, approved sources, or runtime exports. Existing v1 evidence is
immutable and explicitly forbidden as an output destination.

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
```

## Execution boundary

The additive v2 schemas define profile acceptance, target, assignment, result, Armour-source review,
and contract-readiness records. The deterministic renderer builds and validates all 77 root envelopes
in memory with class-scoped references, but does not materialize them. The current runner still
supports v1 only and must not persist v2 results or activate a v2 run. Before generation, Equipment
still needs reviewed packet materialization, an immutable v2 run plan and journal, a byte- and
PNG-metadata-verifying exclusive persistence path, explicit activation, and provider-capacity
evidence. That work remains Equipment-local and must not modify engine contracts or shared runtime
catalogs.

The JSON schemas are structural documentation. Acceptance also parses the profile with
`EquipmentVisualProfileV2Schema.parse`, verifies the deterministic canonical hash, and verifies all
ten referenced files byte-for-byte.
