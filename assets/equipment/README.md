# Equipment visual assets

Equipment visuals move through three deliberately separate lifecycle areas:

- `experiments/` contains candidates, revisions, production evidence, and review decisions. These
  files are not approved or runtime assets and must remain immutable after review closeout.
- `approved/material-equipment-v1/` contains the owner-accepted PNG sources copied byte-for-byte
  from the selections recorded at the Equipment v3 review checkpoints. Its `manifest.json` binds
  every approved file to its candidate hash and checkpoint provenance; `receipts/` records the
  guarded promotion operation. Approved sources are inert production masters, not files loaded by
  the game.
- Runtime derivatives belong under `apps/web/static/runtime/equipment-v1/`. They are generated only
  from the approved manifest and may be replaced deterministically by the Equipment runtime
  exporter. Runtime generation must never read directly from `experiments/`.

The `armour-set-references/` images preserve the accepted visual identity of each complete set for
review and future production. They are reference-only: only the four individual Head, Torso, Legs,
and Boots sources under `items/` are eligible for runtime export and equipment definitions.

The approved catalog contains 161 exact source images: 140 equippable items and 21 complete-set
references. Runtime export produces a lazy `card` and `detail` WebP for every item—140 bundles and
280 derivatives total—without exporting the set references. `equipment-content-v1` binds those 140
items one-to-one to the legal material/form definitions used by engine-v24 Forging and authored
drops.

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
