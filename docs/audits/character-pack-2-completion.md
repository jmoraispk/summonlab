# Character Pack 2 completion audit

> **Historical audit:** ADR 0065 retires the procedural runtime proof and renderer recorded here.
> Authored candidate assets and manifest audits remain current; deleted route references below
> describe the state at the time of this audit.

Date: **2026-08-29**

Implementation status: **complete**

Release status: **held for human visual approval**

## Delivered scope

- Ten inspiration files preserved privately with committed checksums and a component-level audit.
- A Pack 2 art-direction contract and additive `human-v4` generator.
- Deterministic 100- and 1,000-seed audits plus an exact-hash 18-person production cohort.
- Eighteen full-body human anchors, six continuity sheets, two progression edits, six monster-family
  plates, and one individual monster benchmark anchor.
- Three supplemental correction proofs for `human-v5` facial/clothing separation and monster grade
  escalation, with an exact-prompt catalog and dedicated hash-bound review surface.
- Twenty-four monster archetypes across six families, each with distinct duty, telegraph, and
  counterplay.
- A consolidated `/forge/enemies/all` archive covering all 40 Pack 1 and Pack 2 enemy archetypes,
  all ten generated family plates, and both focused enemy proof images.
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
| provenance, hashes, recognition checks, and approval state | catalogs, exact prompt records, attempt timings, SHA-256 validators, continuity inspections, Forge provenance panels, and exact-asset review controls for all 36 retained candidates | Pass; final human state pending |
| Forge, tests, asset validation, and performance budgets | full repository check, 48 Playwright tests, Pack 2 validators, 1440px visual inspections, and refreshed web budget | Pass |

## Measured production evidence

- Human assets: 18 identities, 24 bitmaps, 31 generation attempts, seven correction attempts, and
  49,251,605 checksum-verified bytes.
- Monster taxonomy: six plates, 24 archetypes, seven generation attempts, and 14,332,025
  checksum-verified bytes.
- Premium human request latency: 35.2 s median, 41.9 s p90, and 42.1 s p95.
- Correction-aware human candidate latency: 38.2 s median, 67.6 s p90, and 80.6 s p95.
- Browser interaction gate: approved cached draw through DOM flush and next frame must remain below
  100 ms.
- Existing phone interface response p95: 30.1 ms, within budget.
- Web build: 48,260 initial gzip bytes and 195,104 runtime visual bytes, both within budget.

## Validation record

Passed on 2026-08-29:

```sh
pnpm validate:pack-two-visuals
pnpm validate:pack-two-monsters
pnpm validate:pack-two-revision
pnpm validate:pack-two-generation-benchmark
pnpm check
pnpm validate:web-build-budget
pnpm test:e2e
```

The full repository check initially identified the expected stale web-budget report after the new
routes were added. `pnpm measure:web-build-budget` refreshed the measured report; the budget gate
then passed. The integration-test command was also run, but its database suites were skipped by
their environment guard; equivalent database-backed paths, including Pack 2 review persistence,
passed in the 48-test Playwright stack.

## Required human gate

Start with `/forge/enemies/all` for the complete cross-pack enemy archive. Review `/forge/pack-2`,
`/forge/pack-2/revision`, `/forge/enemies/pack-2`, and `/forge/pack-2/runtime` for the specialized
gates. For each exact human anchor, continuity sheet, Remy progression state, and supplemental
revision proof, record accept or revise notes against its hash. Review each monster plate and the
individual Stone Breaker anchor for duty readability and art quality. All 36 retained candidates
are selectable in the Forge controls. Only accepted assets should be promoted into the runtime
catalog; review submission itself does not mutate manifests or summon eligibility.
