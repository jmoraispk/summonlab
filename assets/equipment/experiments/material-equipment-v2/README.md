# Material Equipment v2 planning package

Status: **inert planning package; profile approval pending**.

This directory prepares the collision-safe successor to `material-equipment-v1`. It contains only:

- a deterministic 161-target [manifest](manifest.json);
- a non-executable [allocation plan](allocation-plan.json) with 77 root jobs, 84 gated Armour-piece
  jobs, and 21 full-set review gates;
- an approval-candidate [visual profile](visual-profile/profile.json) and its local schema.

It contains no profile acceptance, target packets, assignments, run, review receipts, candidates,
results, approved sources, or runtime exports. Existing v1 evidence is immutable and explicitly
forbidden as an output destination.

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
corepack pnpm tsx tools/export-equipment-material-production-v2.ts --check
corepack pnpm tsx tools/export-equipment-image-profile-v2.ts --check
```

## Execution boundary

The current Equipment execution contract intentionally supports v1 only. It must not be used to
accept this profile, build v2 packets, persist v2 results, or activate a v2 run. Before generation,
Equipment needs a separately reviewed v2 execution-contract slice that binds the new root, profile
schema, class-scoped references, 8% target/5% minimum framing rule, and empty Armour presentation.
That future integration remains Equipment-local and must not modify engine contracts or shared
runtime catalogs.

`visual-profile/profile.schema.json` is structural documentation, not sufficient approval
validation. Any future acceptance path must parse the profile with
`EquipmentVisualProfileV2Schema.parse` so repository-path, reference-binding, class-completeness,
reference-scope, and primary-Axe semantic invariants are enforced.
