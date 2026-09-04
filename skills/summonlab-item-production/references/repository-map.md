# Current Summonlab item repository map

This map is a routing aid, not permission to edit every listed surface. Inspect current files and
repository instructions because versions and ownership may change.

## Canonical Equipment theory

- `docs/wiki/mechanics/equipment/README.md` — catalog scope, runtime slice, production sequence,
  coverage arithmetic, and ownership.
- `docs/wiki/mechanics/equipment/materials.md` — rank ladders, material families, rank-bearing maps,
  and monster-material boundary.
- `docs/wiki/mechanics/equipment/weapons.md` — canonical weapon classes, hands, visual rules.
- `docs/wiki/mechanics/equipment/armour-and-shields.md` — four-piece Armour and full-set-first rule.
- `docs/wiki/mechanics/equipment/rarity-and-weight.md` — material rank plus craftsmanship.
- `docs/wiki/mechanics/equipment/focuses-tools-accessories.md` — Staff and deferred item families.

Read these before proposing a new material, class, slot, rank behavior, or image multiplier. Update
canonical prose when an accepted decision changes; do not use an experiment README as game truth.

## References and direction studies

- `assets/equipment/references/` — durable owner/source references and provenance notes.
- `assets/equipment/experiments/material-vs-class-calibration-2026-09-02/` — accepted two-axis
  comparison between a same-material cohort and a full Dagger rank ladder.
- `assets/equipment/experiments/rank-first-calibration-2026-09-02/` — accepted rank sheets and
  dedicated individual reconstruction proofs.

These are reference/direction evidence, not candidate, approved, or runtime sources.

## Candidate production

- `assets/equipment/experiments/material-equipment-v3/manifest.json` — completed rank-first
  production manifest.
- `assets/equipment/experiments/material-equipment-v3/worker-protocol.md` — worker ownership and
  persistence protocol.
- `assets/equipment/experiments/material-equipment-v3/review-protocol.md` — review and checkpoint
  process.
- `assets/equipment/experiments/material-equipment-v3/checkpoints/` — owner-bound decisions.
- `assets/equipment/experiments/material-equipment-v3/reviews/` — galleries, selections, audits,
  and proposal-only promotion data.
- `tools/equipment-rank-first-contract-v3.ts` and adjacent `equipment-rank-first-*`,
  `materialize-equipment-*`, `record-equipment-*`, and `closeout-equipment-*` tools — current
  example of a strict, resumable campaign.

Do not append new work to immutable completed v3 paths. Create a collision-safe new version or
experiment. A future generic item campaign may reuse the lifecycle pattern without copying obsolete
schemas or hard-coded counts.

## Approved masters and promotion

- `assets/equipment/approved/material-equipment-v1/manifest.json` — 161 approved source records:
  140 items and 21 full-set references.
- `assets/equipment/approved/material-equipment-v1/receipts/` — guarded promotion evidence.
- `tools/equipment-approved-source-contract.ts` — strict approved-source contracts.
- `tools/equipment-approved-source-promotion.ts` and
  `tools/promote-equipment-approved-sources.ts` — zero-write planning, guarded write, and check.
- `assets/equipment/README.md` — lifecycle boundaries and current validation commands.

Approved files are immutable masters. A revision begins as a new candidate and requires another
explicitly reviewed, versioned promotion.

## Runtime visuals

- `tools/export-equipment-runtime-visuals.ts` — deterministic approved-only card/detail exporter.
- `apps/web/static/runtime/equipment-v1/manifest.json` — runtime visual manifest.
- `apps/web/static/runtime/equipment-v1/` — content-hashed WebP bundles loaded lazily.
- `assets/equipment/approved/material-equipment-v1/reviews/runtime-v1/index.html` — runtime gallery.
- `packages/contracts/src/equipment-visual.ts` — runtime visual contract.

Runtime export must not read `assets/equipment/experiments/`. Full-set references do not become
runtime items.

## Content and engine

- `packages/contracts/src/equipment.ts` — ranks, material families, definitions, item instances,
  provenance, loadouts, and material lots.
- `packages/content/src/equipment.ts` — retained materials, legal forms, 140 generated definitions,
  and Standard recipes.
- `packages/engine/src/core/equipment.ts` — shared definition-backed item creation.
- `packages/engine/src/domains/settlement/equipment.ts` — inventory and equip behavior.
- `packages/engine/src/domains/settlement/forging.ts` — Standard Forging lifecycle.
- `packages/engine/src/domains/mission/equipment-drop.ts` — authored drop seam using the same item
  factory.
- `packages/contracts/src/engine/` and `packages/engine/src/core/versions.ts` — compatibility/version
  boundary. Add a new version rather than invalidating preserved schemas.

Do not introduce a second item catalog for another acquisition route. Do not add a new engine
version unless runtime state actually changes and the engine owner agrees.

## Web integration

- `apps/web/src/lib/server/equipment-runtime.ts` — Equipment projection and visual resolution.
- `apps/web/src/lib/components/EquipmentWorkshop.svelte` — material/form assay, inventory, loadout,
  and lazy art.
- `apps/web/src/routes/api/runs/[runId]/equipment/+server.ts` — gameplay Equipment endpoint.
- `apps/web/src/routes/equipment-forging.e2e.ts` — 390×844 forge/equip/reload proof.
- `apps/web/DESIGN.md` — durable visual and interaction rules.

Keep the top-level `/forge` character-portrait tool separate from gameplay Forging.

## Current Equipment validators

Run from the repository root:

```bash
corepack pnpm validate:equipment-approved-sources
corepack pnpm validate:equipment-runtime-visuals
corepack pnpm validate:equipment-content-bindings
corepack pnpm validate:equipment-integration-report
```

Useful focused validation:

```bash
corepack pnpm vitest run packages/content/src/equipment.spec.ts
corepack pnpm --filter @summonlab/engine exec vitest run src/domains/settlement/equipment.spec.ts src/domains/settlement/forging.spec.ts
corepack pnpm typecheck
PLAYWRIGHT_PORT=4175 corepack pnpm --filter @summonlab/web exec playwright test src/routes/equipment-forging.e2e.ts
git diff --check
```

Run the widest safe repository checks required by current instructions. If an unrelated sealed
production surface is environment-bound or being mutated concurrently, do not weaken it to make an
item branch green; document the exact external failure and keep item-focused evidence complete.

## Adding a different item family

Potion, Food, Tool, Accessory, monster-derived Equipment, and later quality visuals are not licensed
by the current Equipment v1 catalog merely because this map mentions them. Start from canonical
theory, create a new coverage matrix, and identify owners. Reuse the lifecycle and provenance
patterns; do not force every family into Equipment’s exact 140-definition schema or card/detail
budget.
