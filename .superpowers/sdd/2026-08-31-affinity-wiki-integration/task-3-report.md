# Task 3 report — four-base affinity support references

## Scope delivered

- Replaced the duplicate affinity mechanics surface with a navigation-only index whose required
  opening points to the canonical progression page.
- Published exactly four base child pages: Fire, Earth, Wind, and Water. Each contains only its
  canonical definition, status, attribute nudge, material language, and canonical link.
- Removed the Wood child page and `affinity.wood` catalog entry.
- Added accepted `affinity.earth` and `affinity.water` catalog entries in the existing affinity
  ordering: Fire, Earth, Wind, Water.
- Updated dependent attribute and equipment wording to point to the canonical rules and use
  `affinity rank` directly. The focuses/tools/accessories page now calls temporary bonuses
  temporary bonuses to affinity rank.

No skills, monster content, wiki UI, engine/runtime catalogs, or unrelated domains were changed.

## Regression-first check

Before the edit, the focused fixture test passed because it verifies the reusable contract rather
than the repository's support page content. The standalone contract provided the repository RED:

```text
docs/wiki/catalog.json: affinity catalog entry "affinity.wood" publishes retired affinity Wood.
docs/wiki/mechanics/affinities/README.md: rendered wiki content uses retired term "Resonance".
docs/wiki/mechanics/affinities/wood.md: rendered wiki content presents "Wood affinity" as current.
docs/wiki/mechanics/equipment/README.md: rendered wiki content uses retired term "Resonance".
```

The required focused test command was run before and after the edit:

```bash
SUMMONLAB_NODE_BIN=/home/joao/.nvm/versions/node/v24.19.0/bin
PATH="$SUMMONLAB_NODE_BIN:$PATH" pnpm vitest run tools/affinity-wiki-contract.spec.ts
```

It passes with 1 test file and 11 tests.

## Final verification

```bash
SUMMONLAB_NODE_BIN=/home/joao/.nvm/versions/node/v24.19.0/bin
PATH="$SUMMONLAB_NODE_BIN:$PATH"
pnpm exec prettier --check \
  docs/wiki/mechanics/affinities/README.md \
  docs/wiki/mechanics/affinities/fire.md \
  docs/wiki/mechanics/affinities/wind.md \
  docs/wiki/mechanics/affinities/earth.md \
  docs/wiki/mechanics/affinities/water.md \
  docs/wiki/mechanics/attributes.md \
  docs/wiki/mechanics/equipment/README.md \
  docs/wiki/mechanics/equipment/focuses-tools-accessories.md \
  docs/wiki/catalog.json
pnpm vitest run tools/affinity-wiki-contract.spec.ts
pnpm validate:wiki
git diff --check
```

Results:

- Prettier reported all listed files use project formatting.
- The focused contract test passed: 1 file, 11 tests.
- `pnpm validate:wiki` passed: 100 wiki pages and 22 asset references; skill taxonomy reconciled
  520 legacy rows and 495 target rows.
- A direct surface invariant check confirmed the exact required index opening, exactly four child
  pages (`earth.md`, `fire.md`, `water.md`, `wind.md`), and exactly four accepted affinity catalog
  entries in Fire/Earth/Wind/Water order.
- `git diff --check` exited 0.

## Standalone contract findings outside Task 3

`pnpm validate:wiki-affinities` still exits 1, but it reports no finding under the Task 3-owned
catalog, affinity support pages, attributes page, or equipment pages.

The remaining 52 findings are outside this task:

- Task 4 skill and UI migration: five-base claims in `MonsterDatabase.svelte` and skill/readme
  pages; the derived-Wind claim; current Wood/Metal affinity language; retired-term migration
  targets.
- Task 6 monster presentation: current Wood/Metal affinity-variant findings across monster pages,
  plus the giant-tower-dragon retired-term finding.
- Other deferred pages also include the monster-family index and visuals system five-base claims.

These were intentionally left unchanged per the assigned ownership boundary.

## Self-review

- The support index has no design-history prose and lists all four base pages plus all six exact
  dual/status pairs.
- The sole canonical mechanics link is used for the cycle, rank, dual, and awakening rules; the
  support pages do not redefine them.
- Wood is absent as an affinity page and catalog entry. No current Wood or Metal affinity wording
  remains in the Task 3-owned rendered pages; physical-material wording elsewhere was preserved.
- Catalog schema fields, status values, and affinity ordering match the neighboring entries.
