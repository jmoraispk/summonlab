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

The route returned 648,765 uncompressed bytes. An initial unfiltered production Chromium sample
measured 43 ms response end, 87–89 ms DOMContentLoaded, 216 ms load, and observed the 120 SSR cards
by 354 ms; that sample did not itself prove hydration. The review-round shared-query sample proved
the client transition from the unfiltered 456/120 response HTML to `parry / Martial / Blade /
blade.dual-guard`, one exact result, in 743 ms. No console or page errors occurred. The prior
30-second result was a missing-role probe timeout, not stalled hydration.

## Verification summary

- Catalog/hash check: PASS, 456 exact 512×512 derivatives.
- Runtime images: 38,597,676 bytes; managed tree: 38,860,144 bytes; max file: 112,372 bytes.
- Wiki validation: PASS, 215 pages; canonical 258 Martial / 124 Magical / 74 Craft split.
- Exporter Vitest: 8/8; web Vitest: 110/110 across 23 files; typecheck: clean.
- Full web lint: initially reproduced only the known `_wikiId` error; after an explicit behavior-
  neutral discard, PASS.
- Focused production Playwright: 6/6; desktop and phone screenshots captured.
- Production build and build-budget validator: PASS; no selected source PNG is bundled.
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

## Self-review and concerns

- The catalog fix is limited to semantics and truthful pagination copy; filtering, data loading,
  layout, and source records are unchanged.
- The lint fix preserves the intentionally disabled monster visual hook and its call signature.
- Screenshots are report-owned 1440×1000 and 390×844 PNGs, not volatile Playwright artifacts.
- The 648,765-byte decoded document is substantial, but measured hydration is fast and the complete
  record set is required for immediate client filtering. This is an optimization opportunity, not
  a release blocker under the approved design.
- Existing build warnings are recorded in the canonical report. No source skill icon was edited.
- The separate `docs/superpowers/issues/2026-09-04-skill-icon-quality-cleanup.md` remains open.
