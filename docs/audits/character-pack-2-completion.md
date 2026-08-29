# Character Pack 2 completion audit

Date: **2026-08-29**

Implementation status: **complete**

Release status: **held for human visual approval**

## Delivered scope

- Ten inspiration files preserved privately with committed checksums and a component-level audit.
- A Pack 2 art-direction contract and additive `human-v4` generator.
- Deterministic 100- and 1,000-seed audits plus an exact-hash 18-person production cohort.
- Eighteen full-body human anchors, six continuity sheets, two progression edits, six monster-family
  plates, and one individual monster benchmark anchor.
- Twenty-four monster archetypes across six families, each with distinct duty, telegraph, and
  counterplay.
- A measured generation benchmark, approval-gated runtime proof, and complete Pack 2 Forge.

## Completion-criteria map

| Criterion | Evidence | Result |
| --- | --- | --- |
| Pack 1 unchanged and separately selectable | Pack 1 catalog bytes were not changed; `/forge` and `/forge/pack-2` are separately linked | Pass |
| `human-v1` through `human-v3` remain stable | fixed legacy recipe/hash assertions in `packages/characters/src/characters.spec.ts` | Pass |
| obvious Pack 2 height, build, and proportion differences | 18-person true-height, roster, settlement, and unlabeled silhouette views; exact cohort and 1,000-seed distribution tests | Implemented; reviewer judgment pending |
| feminine range parity | six feminine adults span all six builds, five roles, four height bands, and three initial star ranks; dedicated Forge parity view | Pass structurally; reviewer judgment pending |
| readable star evolution without rainbow or sexualization | Remy Esen initial/equipment/evolution comparison; restrained resonance and practical clothing contract | Implemented; reviewer judgment pending |
| maximum level is `stars × 10` | contract refinement, engine clamp, runtime control, and browser cap assertion | Pass |
| approved polished portrait before player-facing eligibility | Pack 2 catalog is `0/18` eligible and runtime selector rejects every candidate | Safety gate passes; human approval pending |
| every monster has an identifiable battlefield duty | 24 unique duty records and Forge duty/telegraph/counter cards | Pass structurally; reviewer judgment pending |
| median, p90, and p95 generation evidence | `assets/benchmarks/pack-two/report.json` and drift-checking validator | Pass |
| random manifest and procedural representation are interactive | `/forge/pack-2/runtime`; deterministic draw, local rig controls, and sub-100 ms browser gate | Pass |
| premium first reveal is cached; new generation is asynchronous | approved content-addressed runtime-pool proof makes zero generation calls; candidates are rejected | Pass |
| provenance, hashes, recognition checks, and approval state | catalogs, exact prompt records, attempt timings, SHA-256 validators, continuity inspections, and Forge provenance panels | Pass; final human state pending |
| Forge, tests, asset validation, and performance budgets | full repository check, 46 Playwright tests, Pack 2 validators, 1440px visual inspections, and refreshed web budget | Pass |

## Measured production evidence

- Human assets: 18 identities, 24 bitmaps, 31 generation attempts, seven correction attempts, and
  49,251,605 checksum-verified bytes.
- Monster taxonomy: six plates, 24 archetypes, six generation attempts, and 14,361,703
  checksum-verified bytes.
- Premium human request latency: 35.2 s median, 41.9 s p90, and 42.1 s p95.
- Correction-aware human candidate latency: 38.2 s median, 67.6 s p90, and 80.6 s p95.
- Browser interaction gate: approved cached draw through DOM flush and next frame must remain below
  100 ms.
- Existing phone interface response p95: 31.3 ms, within budget.
- Web build: 48,132 initial gzip bytes and 195,104 runtime visual bytes, both within budget.

## Validation record

Passed on 2026-08-29:

```sh
pnpm validate:pack-two-visuals
pnpm validate:pack-two-monsters
pnpm validate:pack-two-generation-benchmark
pnpm check
pnpm validate:web-build-budget
pnpm test:e2e
```

The full repository check initially identified the expected stale web-budget report after the new
routes were added. `pnpm measure:web-build-budget` refreshed the measured report; the budget gate
then passed. The integration-test command was also run, but its database suites were skipped by
their environment guard; equivalent database-backed paths, including Pack 2 review persistence,
passed in the 46-test Playwright stack.

## Required human gate

Review `/forge/pack-2`, `/forge/enemies/pack-2`, and `/forge/pack-2/runtime`. For each exact human
anchor and continuity sheet, record accept or revise notes against its hash. Review each monster
plate for duty readability and art quality. Only accepted assets should be promoted into the
runtime catalog; review submission itself does not mutate manifests or summon eligibility.
