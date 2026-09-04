# Wiki Skill Visual Catalog — Final Integration Fix Report

**Date:** 2026-09-04

**Branch:** `codex/four-element-domain-tree`

**Starting commit:** `0b9399b82322d8dc1cd870fff424cd1a7fb030d5`

**Scope:** One final broad-review fix round for the permanent 456-record wiki skill visual catalog.

## Status

All six catalog findings are implemented and the focused release contract is green. The generated
directory is deterministic and zero-write in check mode, server construction enforces the complete
runtime-manifest contract without request-time WebP reads, load-more focus is preserved through the
final page, and card density follows available catalog width inside the fixed wiki shell.

The only non-green observation is an exploratory full repository `pnpm test` run in unrelated,
sealed family-affinity suites. It is recorded under Concerns and did not lead to mutation of those
authorities.

## RED-first evidence

| Finding                    | RED evidence before production changes                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Release gates              | A package probe exited 7 because `scripts.check` omitted `validate:wiki-skill-visual-catalog`; a CI probe exited 8 because the visual-assets step omitted it; the root test chain did not include the exporter spec.                                                               |
| Runtime manifest authority | `skill-visual-catalog.spec.ts` produced 10 failures / 13 passes for discarded bytes/hash and unvalidated exporter, encoder, summary, limit, total, and ordering mutations. A separately added parsed/raw split-brain mutation failed 1/1 before raw runtime bytes became an input. |
| Full managed budget        | `wiki-skill-visual-catalog-lib.spec.ts` produced 3 failures / 11 passes because the manifest had no managed-directory fields/helper and the manifest's own formatted bytes were excluded.                                                                                          |
| Load-more accessibility    | New Playwright expectations failed because focus remained on the disappearing button, no displayed range was announced, and final focus was lost.                                                                                                                                  |
| Shell-aware density        | All new width assertions began RED under viewport media queries; the fixed 22rem shell made raw viewport thresholds disagree with usable catalog width.                                                                                                                            |
| Status vocabulary          | Validator characterization showed `approved` was already accepted, but the public status table omitted it and did not distinguish Design approval from visual promotion.                                                                                                           |

The first complete focused browser RED was 8 failed. After the initial component change, the second
run isolated three remaining regressions: singleton text rendered `Showing 1–1`, removing the
temporary `tabindex` also dropped focus, and the SSR regex did not allow `aria-atomic`. The final run
passes all eight cases.

## Fixes by finding

### 1. Durable release gates

- Added `validate:wiki-skill-visual-catalog` to the root `check` chain.
- Added it to CI's `Validate visual assets` step.
- Added `test:wiki-skill-visual-catalog`, covering both
  `tools/validate-wiki.spec.ts` and `tools/wiki-skill-visual-catalog-lib.spec.ts`, and included that
  script in the root `test` chain.
- Added a durable configuration regression that reads `package.json` and `.github/workflows/ci.yml`
  and protects all three links.
- The expensive 456-image rebuild is executed once in each normal check/CI validation path; root
  unit testing uses only two-image fixtures.

### 2. Strict runtime-manifest authority

The server now imports both parsed JSON and exact raw runtime-manifest bytes. Construction rejects
any parsed/raw disagreement, unknown runtime fields, wrong schema/exporter version, or mutation to
the fixed WebP encoder contract (`webp`, quality 86, alpha quality 100, effort 4, smart subsampling,
stripped metadata).

Runtime records retain positive `bytes` and a 64-character derivative `contentHash`. The join
enforces exact record count and deterministic target order, source authority paths/hashes,
canonical↔mass fields, mass source path/slug, runtime source path/hash, derivative filename, and
public path. Summary validation covers both counts, image-byte total, per-record 130 KiB maximum,
managed-directory total, and 42 MiB ceiling.

This is structural authority validation only. Server construction hashes the three small JSON
authorities and checks their joins; it does not read 456 WebPs on startup or request. The exporter
release gate remains responsible for decoding and hashing actual derivative bytes.

### 3. Full managed-directory budget

`summary.totalBytes` remains the image-only total specified by the existing manifest semantics.
The manifest now also records:

- `managedDirectoryBytes`: image bytes plus the exact repository-formatted manifest bytes;
- `maximumManagedDirectoryBytes`: 44,040,192 bytes (42 MiB).

Formatting and the self-referential managed total are resolved deterministically to a fixed point.
Both write and check paths validate the exact formatted manifest, image record/buffer byte equality,
per-file ceiling, and managed total. A boundary test accepts exactly 42 MiB and rejects 42 MiB + 1
byte. Fixture mutations cover missing, stale/corrupt, opaque, and oversized managed WebPs.

Final generated inventory:

| Measurement                |                                    Value |
| -------------------------- | ---------------------------------------: |
| Records / WebPs            |                                456 / 456 |
| Image bytes (`totalBytes`) |                               38,597,676 |
| Formatted manifest bytes   |                                  262,549 |
| Managed logical bytes      |                               38,860,225 |
| Managed files              |                                      457 |
| Managed ceiling            |                               44,040,192 |
| Remaining budget           |                                5,179,967 |
| Largest derivative         | 112,372 (`martial:shield:the-last-wall`) |
| Per-file ceiling           |                                  133,120 |

The image bytes did not change. The manifest grew by 81 bytes and the managed total grew from
38,860,144 to 38,860,225 bytes.

### 4. Load-more accessibility

The live status now communicates matching and displayed scope (`456 skills · Showing 1–120`, then
`1–240`, `1–360`, and `1–456`; a singleton uses `Showing 1`). Each activation identifies the first
new record, reveals the next bounded batch, waits for the DOM update, and focuses that skill heading
with `{ preventScroll: true }`.

Only the current programmatic target receives `tabindex="-1"`. It remains on the final target after
the load-more button disappears, and filter/search changes clear it. Playwright proves focus and
unchanged `window.scrollY` through 120→240→360→456.

### 5. Responsive shell coordination

The catalog establishes an inline-size container. Grid rules now respond to usable content width:
four columns above 64rem, three from 52–64rem, two from 30–52rem, and one below 30rem. This preserves
the approved four-card 1440px review surface without allowing the fixed desktop sidebar to force
overcrowded cards at narrower viewports.

Focused browser measurements prove:

| Viewport | Expected/observed columns | Shell boundary purpose                            |
| -------: | ------------------------: | ------------------------------------------------- |
|      832 |                         2 | Narrow shell, content remains two-column          |
|      860 |                         2 | Last viewport before desktop sidebar              |
|      861 |                         1 | Sidebar appears and available catalog width drops |
|     1152 |                         2 | Wider shell-aware content area                    |
|     1280 |                         3 | Three-column available-width threshold            |
|     1440 |                         4 | Approved wide desktop comparison                  |
|      390 |                         1 | Phone; exact 390px document width, no overflow    |

### 6. Status vocabulary

`docs/wiki/README.md` now documents Design `approved`. The explanation explicitly says that Design
approval concerns rules, information architecture, or interaction design and does not promote
media. A page may therefore be `designStatus: approved` while its media remain
`visualStatus: candidate`. Validator tests accept that combination and reject undocumented
`designStatus: reviewed`.

## Final focused verification

| Command                                                                                             | Result                                                                                               |
| --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `corepack pnpm validate:wiki-skill-visual-catalog`                                                  | PASS; 456 sources/derivatives regenerated in memory and matched; zero-write status and manifest hash |
| `corepack pnpm validate:wiki`                                                                       | PASS; 215 pages, 25 references, 520 legacy rows → 456 targets (258/124/74)                           |
| `corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit`                           | PASS                                                                                                 |
| `corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts`                              | PASS — 15/15                                                                                         |
| `corepack pnpm test:wiki-skill-visual-catalog`                                                      | PASS — 20/20 across 2 files                                                                          |
| `corepack pnpm --filter @summonlab/web exec vitest run src/lib/server/skill-visual-catalog.spec.ts` | PASS — 24/24                                                                                         |
| `corepack pnpm --filter @summonlab/web test`                                                        | PASS — 121/121 across 23 files                                                                       |
| `corepack pnpm --filter @summonlab/web typecheck`                                                   | PASS — 0 errors, 0 warnings                                                                          |
| `corepack pnpm --filter @summonlab/web lint`                                                        | PASS                                                                                                 |
| `corepack pnpm --filter @summonlab/web test:e2e -- wiki-skill-visual-catalog.e2e.ts`                | PASS — 8/8; routine run zero-write                                                                   |
| `corepack pnpm --filter @summonlab/web build`                                                       | PASS                                                                                                 |
| `corepack pnpm validate:web-build-budget`                                                           | PASS — all measured budgets within limits                                                            |
| Targeted Prettier check over all 16 formatter-owned in-scope files with `--ignore-path /dev/null`   | PASS                                                                                                 |
| `corepack pnpm format:check`                                                                        | PRE-EXISTING FAILURE — 84 unrelated files; no in-scope file named                                    |
| `git diff --check`                                                                                  | PASS                                                                                                 |

The exact focused E2E command was used. The unrelated full 75-test E2E corpus was intentionally not
run.

## Final performance sample

A fresh built preview listened on `0.0.0.0:4189`. The public collaborator form was
`http://10.110.24.218:4189/wiki/mechanics/skills/visual-catalog`; the process was stopped after the
sample.

| Measurement                             |                        Result |
| --------------------------------------- | ----------------------------: |
| Decoded HTML                            |                 654,534 bytes |
| Encoded body                            |                  63,957 bytes |
| Cold curl first byte / total            |             0.476 s / 0.477 s |
| Warm compressed curl first byte / total |             0.033 s / 0.040 s |
| Browser DOMContentLoaded                | 93 ms navigation / 95 ms wall |
| Browser load                            |                        208 ms |
| Shared-query client state ready         |                        324 ms |
| HTTP status                             |                           200 |
| Console/page errors                     |                             0 |

The decoded response increased by 5,769 bytes and the encoded body by 547 bytes, principally from
the per-heading focus IDs and richer status markup. Client-applied shared-query readiness improved
from the prior recorded 743 ms sample to 324 ms; this is a point measurement, not a benchmark claim.

## Zero-write evidence

- A before/after `git status --porcelain=v1` comparison around
  `validate:wiki-skill-visual-catalog`, plus a manifest SHA-256 comparison, reported
  `derivative_validator_zero_write=yes`.
- The same porcelain comparison around the exact focused E2E command reported
  `routine_e2e_zero_write=yes`.
- The exporter write run regenerated only the deterministic manifest; all 456 WebP bytes remained
  unchanged.

## Concerns

- An exploratory full root `corepack pnpm test` stopped before the recursive package phase with 38
  failures in the sealed family-affinity suites. Diagnostics show the active v24.19.0 Node differs
  from the receipt-approved v24.14.1 launcher, the globally installed image-production skill root
  differs from the tracked receipt, and several filesystem-heavy tests timed out or collided under
  concurrent repository work. This is outside the focused catalog contract. The root-owned catalog
  test script is green at 20/20, and no affinity receipt, global skill, or unrelated evidence was
  changed.
- Repository-wide `corepack pnpm format:check` reports 84 pre-existing unrelated files, dominated
  by `.agents/skills/pixijs-*` plus engine/equipment/affinity sources. Every in-scope file passes a
  no-ignore targeted Prettier check except the deliberately ignored historical plan, whose existing
  style was preserved; no changed file appeared in the repository-wide warning list.
- Production builds retain the repository's existing warnings for browser-externalized
  `node:crypto`, one large shared chunk, and optional Sharp platform dependencies. The build-budget
  validator remains green.
- Visual quality triage remains owned by
  `docs/superpowers/issues/2026-09-04-skill-icon-quality-cleanup.md`; this fix did not edit or promote
  source candidates.

## Files of record

- Canonical report: `docs/superpowers/reports/2026-09-04-wiki-skill-visual-catalog.md`
- Task 6 report: `.superpowers/sdd/2026-09-04-wiki-skill-visual-catalog/task-6-report.md`
- This report: `.superpowers/sdd/2026-09-04-wiki-skill-visual-catalog/final-fix-report.md`
