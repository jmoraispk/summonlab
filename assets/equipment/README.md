# Equipment visual assets

Equipment visuals use three deliberately separate lifecycle areas:

- `experiments/` contains compact production provenance, accepted direction/calibration boards,
  and campaigns that are still awaiting review. Completed superseded candidates and generated
  review galleries are retired after their selected pixels are secured in the approved catalog.
- `approved/material-equipment-v1/` contains the owner-accepted PNG sources copied byte-for-byte
  from the selections recorded at the Equipment v3 review checkpoints. Its `manifest.json` and
  `receipts/` preserve the exact historical candidate paths, hashes, checkpoint decisions, and
  guarded promotion record even though the duplicate candidate rasters are no longer retained.
  Approved sources are inert production masters, not files loaded by the game.
- Runtime derivatives belong under `apps/web/static/runtime/equipment-v1/`. They are generated only
  from the approved manifest and may be replaced deterministically by the Equipment runtime
  exporter. Runtime generation must never read directly from `experiments/`.

The `armour-set-references/` images preserve the accepted visual identity of each complete set for
review and future production. They are reference-only: only the four individual Head, Torso, Legs,
and Boots sources under `items/` are eligible for runtime export and equipment definitions.

Approved Equipment now contains 168 exact source images across two catalogs. The material-equipment
catalog contains 140 runtime-bound items and 21 complete-set references. The source-only Greatsword
catalog adds seven two-handed Sword-family masters but does not yet add content definitions or
runtime derivatives. Runtime export therefore remains 140 bundles and 280 card/detail WebPs.
`equipment-content-v1` binds those 140 material-equipment items one-to-one to the legal definitions
used by engine-v24 Forging and authored drops. All retained Equipment PNG masters and visual
references are Git LFS objects; the optimized runtime WebPs remain ordinary Git files.

The completed `material-equipment-v1` and `material-equipment-v2` experiment trees and their
one-time production tooling were retired on 2026-09-07. The completed v3 tree retains its manifest,
targets, assignments, prompts, results, checkpoints, selections, receipts, and accepted direction
boards, but not duplicate candidate/revision rasters or generated review sheets. The separate
two-handed Greatsword campaign retains compact provenance and its accepted v2 direction board; its
seven selected candidate rasters now exist only as approved masters.

Do not edit approved pixels in place. A visual change starts as a new candidate and requires a new
reviewed promotion with collision-safe, versioned destinations. Use the promotion checker to verify
the current approved catalog without writing:

```bash
corepack pnpm tsx tools/promote-equipment-approved-sources.ts --check
```

Validate the complete approved-to-runtime chain and its deterministic closeout report with:

```bash
corepack pnpm validate:equipment-approved-sources
corepack pnpm validate:equipment-runtime-visuals
corepack pnpm validate:equipment-content-bindings
corepack pnpm validate:equipment-integration-report
```

The runtime review gallery is
`approved/material-equipment-v1/reviews/runtime-v1/index.html`; the machine-readable integration
summary is `approved/material-equipment-v1/integration-report.json`. Neither artifact authorizes
editing the approved pixels. Fine/Masterwork quality treatment, full Gathering, monster-derived
Equipment, and broad loot balancing remain deferred.
