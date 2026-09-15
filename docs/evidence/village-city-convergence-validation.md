# Village City convergence validation

Date: 2026-09-09

Status: implementation and no-database visual slice validated; database-backed campaign browser gate
blocked by unavailable Docker/PostgreSQL in this workspace.

## Delivered ownership

- `/play/[runId]` imports `CityScreen.svelte` as the canonical arrived-campaign City.
- The old `LivingHearthScene`, second five-mode enum/navigation, status header, and unused camera model
  are deleted.
- An arrived schema-13 campaign no longer falls back to a different Village renderer when its City
  projection is unavailable. It returns an explicit 503 instead of visually moving backward.
- `/living-village-lab/village` is a no-database review harness around the exact same `CityScreen`; it
  owns no action reducer, renderer, or navigation model.

## Accepted interface evidence

- The five-mode dock is the only City header on desktop and moves to the phone bottom safe area.
- A small `Day 3 / 20:15 / Night` clock overlays the map's upper-left corner.
- Dorm, Kitchen, Gate, Training, and Forge foreground people counts in the earlier compact horizontal
  treatment.
- Minimum zoom uses cover-fit bounds and clamped panning, so the runtime image always covers the
  viewport and black corners cannot be exposed.
- Facility labels are projected from content-authored anchors. Off-screen labels on cropped phone views
  remain hidden until their facility is panned into view rather than piling up at an edge.
- The circular-wall candidate 02 is promoted without further background editing.

## Asset binding

- Source: `assets/settlements/hearth-01/hearth-01-threshold-v3.png`
- Source SHA-256: `02bb8a592627641e400d56fd94863aca52f2d45f9244475f9319b343a89fa1d1`
- Runtime: `apps/web/static/runtime/settlements/hearth-01/environment.bce003169755.webp`
- Runtime SHA-256: `bce003169755e70b215698ba5f68b513802b410ca7e46592b21d425882d9f595`
- Runtime bytes: 447,374 of 1,500,000 budget (29.8%)
- Scene hash: `4dea1551545f6820778eed52e7fd37396124874d2c49b3252ec6a2c307d4d313`

## Captures

- `village-city-convergence-desktop.png` — 1440×900 deterministic shared City
- `village-city-convergence-phone.png` — 390×844 deterministic shared City
- `village-city-convergence-resident-quick-view.png` — shared resident quick actions
- `village-city-convergence-resident-details.png` — mutually exclusive resident detail sheet

These captures use the deterministic projection because the workspace cannot launch PostgreSQL. They
are visual/layout evidence, not evidence that campaign commands reached the database.

## Passing checks

- Focused City/content Vitest: 5 files, 26 tests passed.
- Shared City Playwright at desktop and 390×844: 1 passed.
- `pnpm validate:settlement-scene`: passed.
- `pnpm validate:repository-assets`: passed.
- `pnpm --filter @summonlab/web lint`: passed.
- `pnpm --filter @summonlab/web typecheck`: passed with 0 errors and 0 warnings.
- `pnpm --filter @summonlab/web build`: passed.

`pnpm test` also ran. Its first 305-test affinity-production tranche reported 290 passed and 15
failed because the installed `summonlab-image-production` family profile differs from the repository's
sealed approval receipt (`Installed image-production skill family profile drifted from approval`). No
City, settlement, content, web, or changed file appears in those failures. The suite stops at that
pre-existing external skill compatibility gate.

## Environment-only limitation

`pnpm db:start` exits with `Docker is unavailable`. Therefore `village-shell.e2e.ts`, which creates an
arrived campaign and proves authoritative training/rest writes, cannot run here. Its expectations were
migrated to the converged City (single header, map clock, occupancy, cover-fit camera, labels, modes,
resident quick view/details, authoritative action request, and desktop/phone dock), but the test is not
recorded as passed. The design status remains explicit about this release gate.
