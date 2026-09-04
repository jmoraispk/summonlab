# Task 6 Report: Final browser and integration verification

## Status

Implemented exhaustive production Playwright coverage, corrected the two browser-contract gaps it
found, captured stable desktop/phone evidence, diagnosed the reported 649 KiB / 30-second hydration
observation, ran the full catalog verification matrix, and documented the final evidence in
`docs/superpowers/reports/2026-09-04-wiki-skill-visual-catalog.md`.

## RED / GREEN evidence

The new Playwright file was created before production edits. Its first run supplied the intended
RED: the catalog count used only `aria-live="polite"`, so `getByRole('status')` found no element; the
load-more copy also did not expose the next 120-card increment. The minimal component correction
added the status role and an exact `Load {nextBatchCount} more` label.

After that production-only change, performance and layout tests passed. The remaining failures were
strict-locator mistakes in the new test itself (a 120-element attribute assertion, fuzzy Family vs
Motif Family matching, and two visible clear buttons in the no-results state). Those selectors were
corrected separately, without further component changes. Final focused result: 6/6 passed.

The browser regression suite now covers:

- 456 total / 120 initial / 240 after the first load;
- search, Domain, Family, Motif Family, URL state, direct reload, and incompatible reset;
- no-results recovery, pointer actions, keyboard traversal/selection/activation, and details;
- all initial images lazy, meaningful alt text, and no separate rarity definition;
- four desktop columns, one phone column, stacked phone controls, and exact 390 px scroll width;
- solid `rgb(9, 8, 5)` image wells with no background image/checkerboard;
- production hydration under a 15-second regression bound with no browser errors.

## Performance diagnosis

Required preview listener:

```text
LISTEN 0 511 0.0.0.0:4189 0.0.0.0:* users:(("MainThread",pid=...,fd=24))
```

The original route returned 648,765 uncompressed bytes. After the final focus/status markup, the
fresh response is 654,534 decoded bytes and 63,957 encoded bytes. An initial production Chromium
sample measured 43 ms response end, 87–89 ms DOMContentLoaded, 216 ms load, and observed the 120 SSR
cards by 354 ms; that sample did not itself prove hydration. The review-round shared-query sample
proved the client transition from the unfiltered 456/120 response HTML to `parry / Martial / Blade /
blade.dual-guard`, one exact result, in 743 ms. The final integration sample improved to 95 ms
DOMContentLoaded, 208 ms load, and 324 ms through client-applied state. No console or page errors
occurred. The prior 30-second result was a missing-role probe timeout, not stalled hydration.

## Verification summary

- Catalog/hash check: PASS, 456 exact 512×512 derivatives.
- Runtime images: 38,597,676 bytes; formatted manifest: 262,549 bytes; managed tree: 38,860,225
  bytes; max file: 112,372 bytes.
- Wiki validation: PASS, 215 pages; canonical 258 Martial / 124 Magical / 74 Craft split.
- Exporter Vitest: 15/15; strict server authority: 24/24; durable root wiki/catalog suite: 20/20;
  web Vitest: 121/121 across 23 files; typecheck: clean.
- Full web lint: initially reproduced only the known `_wikiId` error; after an explicit behavior-
  neutral discard, PASS.
- Focused production Playwright: 8/8; desktop and phone screenshots remain stable and opt-in.
- Production build and build-budget validator: PASS; no selected source PNG is bundled.
- Targeted no-ignore Prettier check over every formatter-owned in-scope file: PASS.
- `git diff --check`: PASS.

## Review fix round 1

All Important findings and both easy Minor findings were addressed:

1. Added `scripts/run-playwright.js`, a reusable package-script wrapper that strips only a leading
   literal `--` and otherwise forwards Playwright arguments unchanged. Its RED unit test initially
   failed because the module did not exist; GREEN is 1/1. The exact mandated command changed from
   running 75 tests and failing five unrelated disabled monster-visual specs to running only the six
   catalog tests and passing 6/6.
2. Strengthened the hydration test to inspect the shared-query response HTML and prove SSR begins
   unfiltered at `456 skills` / 120 cards. It then waits for all four query controls, exact `1 skill`
   status, one card, and the exact URL after client hydration. Fresh production timing was 615 ms to
   DOMContentLoaded and 743 ms to client-applied state, with no browser errors.
3. Replaced every result-count substring assertion with exact normalized `toHaveText` assertions.
4. Gated tracked screenshot regeneration behind
   `UPDATE_WIKI_SKILL_VISUAL_CATALOG_SCREENSHOTS=1`. A routine exact E2E run produced an identical
   before/after porcelain-status snapshot: `routine_e2e_zero_write=yes`.

Fresh affected verification:

```text
corepack pnpm --filter @summonlab/web exec vitest run src/lib/run-playwright.spec.js
Test Files  1 passed (1)
Tests       1 passed (1)

corepack pnpm --filter @summonlab/web test:e2e -- wiki-skill-visual-catalog.e2e.ts
Running 6 tests using 1 worker
6 passed

corepack pnpm --filter @summonlab/web test
Test Files  23 passed (23)
Tests       110 passed (110)

corepack pnpm --filter @summonlab/web typecheck
svelte-check found 0 errors and 0 warnings

corepack pnpm --filter @summonlab/web lint
exit 0

before/after git status snapshot
routine_e2e_zero_write=yes
```

## Final integration fix round

The final broad-review suite began RED before implementation:

- exporter: 3 failed / 11 passed for missing managed-directory fields and boundary enforcement;
- server authority: 10 failed / 13 passed, followed by one focused raw-manifest split-brain RED;
- release wiring: package and CI probes exited 7 and 8 because neither gate invoked the catalog
  validator and the root suite did not own the exporter regression;
- browser: 8/8 new assertions failed before displayed ranges, focus transfer, and shell-width
  container behavior existed;
- status vocabulary: validator characterization already accepted `approved`, while the public wiki
  status table omitted it.

The final implementation now:

1. runs `validate:wiki-skill-visual-catalog` from `pnpm check` and CI's visual-assets gate, and runs
   the exporter plus wiki-validator specs from the durable root test chain;
2. retains and validates runtime record bytes and derivative content hashes, the exporter version,
   exact encoder contract, summary counts/totals/limits, deterministic order, authority hashes, and
   source/file/public-path joins without reading WebP bytes at request time;
3. preserves `summary.totalBytes` as image bytes and adds exact formatted-manifest-inclusive
   `managedDirectoryBytes` plus `maximumManagedDirectoryBytes`, with an exact-limit/+1 regression;
4. announces the matching total and displayed range, then focuses the first appended heading with
   `preventScroll` through 120→240→360→456 while retaining final focus;
5. responds to available catalog inline size rather than viewport size, with regression points at
   832, 860, 861, 1152, 1280, 1440, and 390 px;
6. documents Design `approved` independently from `visualStatus: candidate` and locks that
   vocabulary with validator tests.

Final focused evidence is 15/15 exporter, 5/5 wiki validator, 24/24 server authority, 121/121 web,
and 8/8 Playwright. Both the derivative checker and normal focused E2E preserved byte-for-byte
porcelain status/manifest state. Production build and all measured web budgets pass.

An exploratory full root `pnpm test` remains outside this focused contract and stopped in the
sealed family-affinity suites before reaching the recursive packages: the running Node v24.19.0
did not match the sealed v24.14.1 launcher, the global installed skill root did not match its
tracked receipt, and filesystem-heavy cases timed out/collided under concurrent repository work.
No family-affinity authority was changed. The new root-owned catalog suite itself passes 20/20.

Repository-wide `pnpm format:check` separately reports 84 pre-existing unrelated files. No
in-scope file appears in that list; every formatter-owned changed file passes a targeted no-ignore
Prettier check, while the ignored historical plan preserves its established formatting.

## Self-review and concerns

- The final catalog fix is limited to manifest authority, semantics, focus, and responsive density;
  filtering, data loading, and source records are unchanged.
- The lint fix preserves the intentionally disabled monster visual hook and its call signature.
- Screenshots are report-owned 1440×1000 and 390×844 PNGs, not volatile Playwright artifacts.
- The 654,534-byte decoded document is substantial, but measured hydration is fast and the complete
  record set is required for immediate client filtering. This is an optimization opportunity, not
  a release blocker under the approved design.
- Existing build warnings are recorded in the canonical report. No source skill icon was edited.
- The separate `docs/superpowers/issues/2026-09-04-skill-icon-quality-cleanup.md` remains open.
