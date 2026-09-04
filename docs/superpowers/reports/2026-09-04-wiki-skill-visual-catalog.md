# Wiki Skill Visual Catalog — Final Verification

**Date:** 2026-09-04

**Branch:** `codex/four-element-domain-tree`

**Route:** <http://10.110.24.218:4189/wiki/mechanics/skills/visual-catalog>

**Status:** Browser behavior, delivery integrity, layout, and repository integration verified.

## Outcome

The permanent wiki route exposes the complete 456-skill candidate catalog with URL-backed search
and dependent Domain, Family, and Motif Family filters. It creates 120 cards initially, adds up to
120 per activation, exposes native provenance details, and keeps rarity out of separate metadata.
The catalog is discoverable from the Skills page and the wiki navigation.

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
  and activation, alternative text, lack of separate rarity metadata, and 120→240 progression.

## Hydration and response diagnosis

The previously reported 649 KiB response is reproducible and is not a hydration stall:

| Measurement | Result |
| --- | ---: |
| Uncompressed HTML response | 648,765 bytes |
| Browser encoded body | 63,410 bytes |
| Cold local curl first byte / total | 0.443 s / 0.445 s |
| Warm browser response end | 43 ms |
| DOMContentLoaded | 87–89 ms |
| 120 cards present and status interactive | 354 ms |
| Browser load event | 216 ms |
| Browser console/page errors | 0 |

The earlier 30-second probe targeted a role the component did not expose. Once `role="status"` was
added, both the focused production Playwright assertion and an independent browser probe settled in
well under one second. The large HTML is expected from server serialization of all 456 filterable
records; progressive rendering still limits created card/image nodes to 120. No runtime regression
or client deadlock was found.

## Derivative and build evidence

| Check | Result |
| --- | ---: |
| Canonical records | 456 |
| Runtime 512×512 WebPs | 456 |
| Derivative image bytes | 38,597,676 bytes (36.810 MiB) |
| Runtime manifest bytes | 262,468 bytes |
| Complete managed directory | 38,860,144 bytes |
| Largest derivative | 112,372 bytes |
| Per-file limit | 133,120 bytes (130 KiB) |
| Selected source PNGs | 456 files / 843,628,352 bytes (reported by `du` as 806 MiB) |
| Selected source PNGs copied into build | 0 |

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

| Command | Result |
| --- | --- |
| `corepack pnpm validate:wiki-skill-visual-catalog` | PASS — 456 records and derivatives hash-clean |
| `corepack pnpm validate:wiki` | PASS — 215 pages, 25 asset references; 520 legacy rows → 456 targets (258/124/74) |
| `corepack pnpm tsc -p tools/tsconfig.skill-icon-production.json --noEmit` | PASS |
| `corepack pnpm vitest run tools/wiki-skill-visual-catalog-lib.spec.ts` | PASS — 8/8 |
| `corepack pnpm --filter @summonlab/web test` | PASS — 109/109 across 22 files |
| `corepack pnpm --filter @summonlab/web typecheck` | PASS — 0 errors, 0 warnings |
| `corepack pnpm --filter @summonlab/web lint` | PASS — after one behavior-neutral pre-existing warning fix |
| `corepack pnpm --filter @summonlab/web test:e2e wiki-skill-visual-catalog.e2e.ts` | PASS — 6/6 |
| `corepack pnpm --filter @summonlab/web build` | PASS |
| `corepack pnpm validate:web-build-budget` | PASS — all measured budgets within limits |
| `git diff --check` | PASS |

The brief's spelling `test:e2e -- wiki-skill-visual-catalog.e2e.ts` passes a literal `--` through to
Playwright 1.60, which disables the filename filter and runs all 75 repository specs. It was run for
the mandated RED observation and proved that behavior. The working focused spelling above is the
same package script with only the erroneous separator removed; it runs the required six catalog
tests. During the accidental broad run, unrelated currently-disabled monster visual tests failed
and existing Living Village screenshots were regenerated; those out-of-scope changes were restored.

The production build retains existing warnings for browser-externalized `node:crypto`, large
repository-wide chunks, and optional Sharp platform packages. The budget validator passes and none
of those warnings originates in the skill catalog route.

## Commit ledger

- Task 1 exporter: `69458630b`, review fixes `0a704957c`, `4e558a49a`
- Task 2 derivatives: `12b6a7b16`, review fix `15b2b170d`
- Task 3 server join: `0f7b37675`, review fixes `c4ad911c4`, `50b0179c6`
- Task 4 model: `38776a803`, review fix `792f31a4f`
- Task 5 route: `fa237f9a4`
- Task 6 browser verification: the commit containing this report; its stable hash is reported in
  the delivery because a Git commit cannot embed its own hash.

## Deferred icon-quality work

The [skill icon quality cleanup issue](../issues/2026-09-04-skill-icon-quality-cleanup.md) remains the
sole visual follow-up owner for frame crossings, malformed generated frames, stray UI-like glyphs,
and ambiguous symbolic content. Task 6 did not mutate source candidates or reclassify those issues.

## Review decisions requested

1. Is the approved four-card desktop density comfortable for side-by-side comparison?
2. Does the metadata hierarchy put acquisition, effect, motif, and provenance at the right levels?
3. Which entries in the issue's symbolic-language review list should remain intentional content?
