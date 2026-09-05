# Task 7 candidate-matrix handoff report

Scope: publish the complete eight-family fauna program as a deterministic, candidate-only handoff.
No candidate was approved or promoted to a runtime catalog, and the original 750-coordinate program
was not regenerated or republished.

## Published artifacts

- Canonical inventory: `assets/enemies/experiments/fauna-family-v1/inventory.json`
- Evidence mirror: `docs/evidence/fauna-family-v1/inventory.json`
- Static review gallery: `docs/evidence/fauna-family-v1/index.html`
- Final lifecycle manifest: `assets/enemies/experiments/fauna-family-v1/manifest.json`
- Deterministic exporter: `tools/export-fauna-family-handoff.ts`
- Focused exporter tests: `tools/export-fauna-family-handoff.spec.ts`

The canonical and evidence inventories are byte-identical. The gallery is organized as eight family
sections, 40 T1-T5 form sections, and 200 affinity cards in Normal, Fire, Earth, Wind, Water order.
Each card opens its original full-resolution candidate PNG; the gallery does not duplicate or alter
the raster assets.

## Lifecycle counts

| State | Global count | Per family |
| --- | ---: | ---: |
| Families | 8 | 1 |
| Forms | 40 | 5 |
| Targets | 200 | 25 |
| Assignments | 200 | 25 |
| Candidates | 200 | 25 |
| Results | 200 | 25 |
| Provenance records | 200 | 25 |
| Unresolved provider failures | 0 | 0 |
| Approved assets | 0 | 0 |
| Runtime assets | 0 | 0 |

The manifest lifecycle is `candidate-matrix-complete`. Its state ceiling and every inventory
coordinate remain `candidate-only`.

## Documentation handoff

The authored fauna expansion page and monster-race overview now link to the inventory and review
gallery and report the complete candidate matrix. The generated enemy database summary reflects
the separately produced eight-family expansion without adding 40 pages to the original 30-family,
150-form, 750-coordinate catalog.

## Original-program protection

Protected-path comparison baseline: `801433ea3`.

The original program's targets, assignments, candidates, results, review evidence, and manifest are
byte-unchanged from that baseline. The only change below
`assets/enemies/experiments/family-affinity-v1` is `production-compatibility.json`, resealed because
the shared manifest schema and sealed family dispatch bundle changed. Both original and fauna
compatibility checks pass against the new receipt. The fauna program's existing targets,
assignments, candidates, and results are also byte-unchanged from the baseline.

## Validation evidence

- `pnpm test:family-affinity-production` — 9 files, 304 tests passed.
- `pnpm typecheck:family-affinity-production` — passed with Node 24.14.1.
- `pnpm check:fauna-family-handoff` — 8 families, 40 forms, 200 candidates, 0 approved, 0 runtime.
- `pnpm check:fauna-family-production` — 200 targets, assignments, candidates, and results verified.
- `pnpm check:fauna-family-production-compatibility` — compatible.
- `pnpm check:family-affinity-production-compatibility` — compatible.
- `pnpm check:family-affinity-dispatch-bundle` — sealed bundle verified.
- `pnpm validate:wiki-monsters` — 30 original families, 150 forms, 750 coordinates, and 40
  reconciliations validated.
- `pnpm validate:wiki` — 215 wiki pages and 25 asset references validated; affinity and skill
  taxonomy checks passed.
- Focused Prettier check and `git diff --check` — passed.
- Canonical/evidence inventory byte comparison — passed.
- Gallery structure count — 8 family sections, 40 form sections, 200 candidate cards.

## Preview

From the repository root, run:

```bash
python3 -m http.server 4179 --bind 0.0.0.0
```

Then open
`http://10.110.24.218:4179/docs/evidence/fauna-family-v1/` and select any card to inspect the
full-resolution candidate.
