# Wiki Skill Visual Catalog — Final Verification

**Date:** 2026-09-04

**Branch:** `codex/four-element-domain-tree`

**Route:** <http://10.110.24.218:4189/wiki/mechanics/skills/visual-catalog>

**Status:** Browser behavior, delivery integrity, layout, and repository integration verified.

## Outcome

The permanent wiki route exposes the complete 456-skill candidate catalog with URL-backed search
and dependent Domain, Family, and Motif Family filters. It creates 120 cards initially, adds up to
120 per activation, exposes native provenance details, and keeps rarity out of separate metadata.
The catalog is discoverable from the Skills page and the wiki navigation. The final integration
round additionally makes the generated manifest a strict runtime authority, budgets its own bytes,
wires validation into local/CI release gates, moves focus through every appended window, and bases
card density on the catalog's actual shell-constrained width.

Task 6 added an explicit result `status` role and changed the load-more label to state the exact
next batch size. Those were the only catalog behavior corrections required by the RED-first browser
suite. The pre-existing full-lint blocker in `monster-database.ts` was resolved behavior-neutrally
by explicitly discarding its intentionally unused compatibility argument.

## Browser evidence

- [Desktop screenshot (1440×1000)](assets/wiki-skill-visual-catalog-desktop.png)
- [Phone screenshot (390×844)](assets/wiki-skill-visual-catalog-phone.png)
- Desktop: four first-row cards at 262.75 px each, aligned on one row with non-overlapping bounds.
- Phone: 356 px cards in one column, four controls stacked/wrapped to one column, and an exact
  `document.documentElement.scrollWidth` of 390 px.
- Image well: computed `rgb(9, 8, 5)` with `background-image: none`; no checkerboard or
  `repeating-conic-gradient` is present.
- Initial DOM: exactly 120 `.skill-card` elements and 120 lazy images, not 456 cards.
- Browser coverage: search, Domain, Family, Motif Family, incompatible-filter reset, URL mutation,
  direct query hydration and reload, clear, no-results recovery, native details, keyboard traversal
  and activation, alternative text, lack of separate rarity metadata, and 120→240→360→456
  progression with focus retained on each first appended heading.

## Hydration and response diagnosis

The previously reported 649 KiB response is reproducible and is not a hydration stall:

| Measurement                              |                                    Result |
| ---------------------------------------- | ----------------------------------------: |
| Uncompressed HTML response               |                             654,534 bytes |
| Browser encoded body                     |                              63,957 bytes |
| Cold local curl first byte / total       |                         0.476 s / 0.477 s |
| Warm compressed curl first byte / total  |                         0.033 s / 0.040 s |
| Fresh shared-query DOMContentLoaded      |                                  93–95 ms |
| Unfiltered page's 120 SSR cards observed |                                    354 ms |
| Browser load event                       |                                    208 ms |
| Browser console/page errors              |                                         0 |
| Shared query applied by client           | 324 ms (229 ms after navigation returned) |

The strengthened hydration check proves this is a client transition rather than SSR presence. Its
shared-query response HTML contains the initial unfiltered `456 skills` status and 120 cards. The
browser then hydrates `q=parry`, `domain=Martial`, `family=Blade`, and `motif=blade.dual-guard` to
the exact `1 skill · Showing 1` status and one Double Parry card. A fresh final production sample
completed that transition in 324 ms with no console/page errors.

The earlier 30-second probe targeted a role the component did not expose. Once `role="status"` was
added, the client-applied state settled in well under one second. The large HTML is expected from
server serialization of all 456 filterable records; progressive rendering still limits initial
card/image nodes to 120. No runtime regression or client deadlock was found.

## Derivative and build evidence

| Check                                  |                                                      Result |
| -------------------------------------- | ----------------------------------------------------------: |
| Canonical records                      |                                                         456 |
| Runtime 512×512 WebPs                  |                                                         456 |
| Derivative image bytes                 |                               38,597,676 bytes (36.810 MiB) |
| Runtime manifest bytes                 |                                               262,549 bytes |
| Complete managed directory             |                                            38,860,225 bytes |
| Largest derivative                     |                                               112,372 bytes |
| Per-file limit                         |                                     133,120 bytes (130 KiB) |
| Selected source PNGs                   | 456 files / 843,628,352 bytes (reported by `du` as 806 MiB) |
| Selected source PNGs copied into build |                                                           0 |

Representative browser assets:

- `icons/craft-alchemy-antidotes.b86655d529a0.webp` — 91,570 bytes
- `icons/martial-blade-ghost-step.e3cd8bf21e3e.webp`
- `icons/martial-shield-wall-stance.9426db0298e1.webp` — 71,972 bytes
- Largest: `icons/martial-shield-the-last-wall.db81a70bf74b.webp` — 112,372 bytes

`validate:wiki-skill-visual-catalog` re-read every selected PNG and derivative, verified exact
source/runtime hashes, inventory, 512×512 geometry, alpha, and budgets without writing. The
production build contains the 456 managed WebPs under `wiki-media/skills/visual-catalog-v1` and no
skill-source PNG from the 806 MiB source directory.

## Verification matrix

| Command                                                                                             | Result                                                                            |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `corepack pnpm validate:wiki-skill-visual-catalog`                                                  | PASS — 456 records and derivatives hash-clean                                     |
| `corepack pnpm validate:wiki`                                                                       | PASS — 215 pages, 25 asset references; 520 legacy rows → 456 targets (258/124/74) |
| `corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit`                           | PASS                                                                              |
| `corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts`                              | PASS — 15/15                                                                      |
| `corepack pnpm test:wiki-skill-visual-catalog`                                                      | PASS — 20/20 across exporter and wiki-validator regressions                       |
| `corepack pnpm --filter @summonlab/web exec vitest run src/lib/server/skill-visual-catalog.spec.ts` | PASS — 24/24 strict-authority and join tests                                      |
| `corepack pnpm --filter @summonlab/web exec vitest run src/lib/run-playwright.spec.js`              | PASS — 1/1 argument-normalization test                                            |
| `corepack pnpm --filter @summonlab/web test`                                                        | PASS — 121/121 across 23 files                                                    |
| `corepack pnpm --filter @summonlab/web typecheck`                                                   | PASS — 0 errors, 0 warnings                                                       |
| `corepack pnpm --filter @summonlab/web lint`                                                        | PASS — after one behavior-neutral pre-existing warning fix                        |
| `corepack pnpm --filter @summonlab/web test:e2e -- wiki-skill-visual-catalog.e2e.ts`                | PASS — 8/8; routine run zero-write                                                |
| `corepack pnpm --filter @summonlab/web build`                                                       | PASS                                                                              |
| `corepack pnpm validate:web-build-budget`                                                           | PASS — all measured budgets within limits                                         |
| Targeted Prettier check over formatter-owned in-scope files                                         | PASS                                                                              |
| `git diff --check`                                                                                  | PASS                                                                              |

## Final integration fix round

The final broad review produced six durable corrections:

1. `pnpm check` and CI's visual-assets job now execute
   `validate:wiki-skill-visual-catalog`. The root `test` chain executes the focused exporter and
   wiki-validator suite through `test:wiki-skill-visual-catalog`; a configuration regression test
   protects all three links.
2. Server construction now consumes the exact raw runtime manifest alongside its parsed form. It
   rejects unknown fields and mutations to exporter version, every fixed encoder contract,
   record bytes/hash shape, record ordering, source/file/public-path joins, summary counts, totals,
   and both byte ceilings. It hashes only the small authority JSON inputs at construction; request
   handling never reads the 456 WebPs.
3. `totalBytes` retains its documented image-only meaning. New `managedDirectoryBytes` and
   `maximumManagedDirectoryBytes` fields make the full 42 MiB contract explicit. The exporter uses
   a deterministic fixed point over repository-formatted manifest bytes, so the recorded managed
   total exactly equals 38,597,676 image bytes + 262,549 manifest bytes = 38,860,225 bytes. A
   one-byte boundary regression covers exact-limit acceptance and overflow rejection.
4. Load-more activation reports `Showing 1–N`, focuses the first newly appended heading with
   `preventScroll`, and preserves that heading as the final focus target after the button
   disappears. Browser coverage proves 120→240→360→456 with an unchanged scroll position.
5. The grid now uses an inline-size container. Focused widths prove the intended shell transition:
   viewport 832→2 columns, 860→2, 861→1 after the fixed sidebar appears, 1152→2, 1280→3, and
   1440→4; 390 remains one column with no document overflow.
6. Wiki documentation now lists Design `approved` and explicitly separates page/design approval
   from media promotion through `visualStatus`. Validator regressions prove `approved` design plus
   `candidate` visuals is valid while an undocumented design status remains invalid.

The RED runs failed in the expected places before production edits: three exporter budget/summary
assertions, ten server authority mutations plus one raw-manifest split-brain mutation, both package
and CI gate probes, and eight initial focused browser assertions. The final focused results are
15/15 exporter, 24/24 server, 5/5 wiki validator, 121/121 web, and 8/8 browser.

An exploratory full repository `pnpm test` was also run. It stopped in the pre-existing sealed
family-affinity suites (38 failures) because the active Node process was v24.19.0 while the sealed
launcher requires the repository's v24.14.1, the globally installed skill root differed from its
tracked receipt, and concurrent filesystem-heavy tests timed out/collided. The catalog's durable
root suite is independent and green at 20/20; no family-affinity receipts or global skills were
mutated as part of this catalog fix.

Repository-wide `pnpm format:check` remains independently RED on 84 pre-existing unrelated files,
mostly vendored Pixi skill documentation and engine/equipment/affinity sources. None of this fix's
files appeared in that warning list; a no-ignore targeted check over every formatter-owned in-scope
file passes. The ignored historical plan retains its established formatting.

Review fix round 1 replaced the direct package script with a reusable forwarding wrapper. The RED
exact command passed `playwright test -- wiki-skill-visual-catalog.e2e.ts`, ran all 75 repository
specs, failed five unrelated disabled monster-visual specs, and regenerated existing evidence. The
wrapper now removes only a leading package-script separator before invoking Playwright. A focused
unit test covers no arguments, a normal filename, the literal separator form, a Playwright flag,
and a separator followed by a flag. The exact mandated command now runs only this file and passes
6/6.

Routine catalog E2E is zero-write. A byte-for-byte comparison of `git status --porcelain=v1`
before and after the exact command passed. Stable report screenshots regenerate only when
`UPDATE_WIKI_SKILL_VISUAL_CATALOG_SCREENSHOTS=1` is explicitly set; ordinary verification neither
updates nor removes them.

Explicit screenshot refresh command:

```bash
UPDATE_WIKI_SKILL_VISUAL_CATALOG_SCREENSHOTS=1 \
  corepack pnpm --filter @summonlab/web test:e2e -- wiki-skill-visual-catalog.e2e.ts
```

The production build retains existing warnings for browser-externalized `node:crypto`, large
repository-wide chunks, and optional Sharp platform packages. The budget validator passes and none
of those warnings originates in the skill catalog route.

## Commit ledger

- Task 1 exporter: `69458630b`, review fixes `0a704957c`, `4e558a49a`
- Task 2 derivatives: `12b6a7b16`, review fix `15b2b170d`
- Task 3 server join: `0f7b37675`, review fixes `c4ad911c4`, `50b0179c6`
- Task 4 model: `38776a803`, review fix `792f31a4f`
- Task 5 route: `fa237f9a4`
- Task 6 browser verification: `e6c206e14`
- Task 6 review fix round 1: the commit containing this addendum; its stable hash is reported in the
  delivery because a Git commit cannot embed its own hash.

## Deferred icon-quality work

The [skill icon quality cleanup issue](../issues/2026-09-04-skill-icon-quality-cleanup.md) remains the
sole visual follow-up owner for frame crossings, malformed generated frames, stray UI-like glyphs,
and ambiguous symbolic content. Task 6 did not mutate source candidates or reclassify those issues.

## Review decisions requested

1. Is the approved four-card desktop density comfortable for side-by-side comparison?
2. Does the metadata hierarchy put acquisition, effect, motif, and provenance at the right levels?
3. Which entries in the issue's symbolic-language review list should remain intentional content?
