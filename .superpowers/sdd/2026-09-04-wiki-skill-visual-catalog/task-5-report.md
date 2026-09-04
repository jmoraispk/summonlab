# Task 5 Report: Permanent wiki skill visual catalog

## Status

Implemented the permanent field-archive catalog at
`/wiki/mechanics/skills/visual-catalog`. The route registers canonical Markdown, loads the strict
456-record join only for `skills.visual-catalog`, and renders the dedicated searchable,
URL-representable, progressively revealed catalog before the canonical Markdown introduction and
source footer.

## RED evidence

The brief's literal command:

```text
corepack pnpm --filter @summonlab/web vitest run src/lib/server/wiki.spec.ts
```

did not invoke the binary in this workspace and failed with
`ERR_PNPM_RECURSIVE_RUN_NO_SCRIPT`. The corrected package-binary invocation was:

```text
corepack pnpm --filter @summonlab/web exec vitest run src/lib/server/wiki.spec.ts
```

That run produced the intended RED: 1 failed and 19 passed. The new test failed because
`getWikiPage('mechanics/skills/visual-catalog')` returned `null` instead of the required Wiki ID and
href.

The first `corepack pnpm validate:wiki` run supplied a second valid RED for the exact catalog
contract. It rejected the brief-required `designStatus: "approved"` because the repository
validator's design-status vocabulary omitted `approved`. The validator now admits that approved
state, and the new Markdown includes its required canonical Wiki ID declaration.

## GREEN evidence

- `corepack pnpm --filter @summonlab/web exec vitest run src/lib/server/wiki.spec.ts` — 20/20 passed
  after the route registration and scoped loader were implemented.
- Final focused run across `wiki.spec.ts`, `skill-visual-catalog.spec.ts`, and
  `skill-visual-catalog-model.spec.ts` — 3 files and 40/40 tests passed.
- `corepack pnpm validate:wiki` — validated 215 pages and 25 asset references; affinity contract
  passed; 520 legacy rows reconciled to 456 targets with domain counts 258/124/74.
- `corepack pnpm --filter @summonlab/web typecheck` — 0 errors and 0 warnings.
- Scoped ESLint over the component, wiki route server/renderer, and wiki test — passed.
- `corepack pnpm --filter @summonlab/web build` — production build completed successfully.
- `git diff --check` — passed.

The full web lint command was also sampled. Task 5's files were clean; the command still reports the
unrelated pre-existing unused `_wikiId` parameter in
`apps/web/src/lib/server/monster-database.ts:336`.

## Design self-critique

The page keeps the approved field-archive identity rather than adopting a generic dashboard:
Georgia owns the title, skill names, and mechanics; monospace owns taxonomy, counts, labels, and
provenance; all surfaces are square and flat with fine dividers. The one deliberate density risk is
the approved four-card comparison grid. A 1440px browser inspection measured four 262.75px columns,
a solid `rgb(9, 8, 5)` image well, and no horizontal overflow. A 390px inspection showed the native
control stack and single-column cards with zero document overflow.

The first visual pass exposed canonical Markdown emphasis delimiters inside effect copy. The card
now removes only those known `**` delimiters so the mechanics read as prose without introducing an
HTML injection boundary. The page does not add rarity text, checkerboards, pills, gradients,
shadows, decorative connectors, or fabricated loading states. Images retain explicit 512×512
geometry, containment, lazy loading, and async decoding.

The interaction pass confirmed the initial 120/456 window, the Magical 124-result filter and URL,
the 240-card first load-more step with 216 remaining, the no-results action, and zero 390px overflow.
Search keeps the user's raw spacing while normalizing matching and serialized query state. Initial
query hydration waits for SvelteKit navigation initialization and user changes use shallow
`replaceState` with the existing page state.

## Files

- `apps/web/src/lib/components/wiki/SkillVisualCatalog.svelte`
- `apps/web/src/routes/wiki/[...slug]/+page.server.ts`
- `apps/web/src/routes/wiki/[...slug]/+page.svelte`
- `apps/web/src/lib/server/wiki.spec.ts`
- `docs/wiki/mechanics/skills/visual-catalog.md`
- `docs/wiki/mechanics/skills/README.md`
- `docs/wiki/catalog.json`
- `apps/web/DESIGN.md`
- `tools/validate-wiki.mjs`
- `.superpowers/sdd/2026-09-04-wiki-skill-visual-catalog/task-5-report.md`

## Concerns and Task 6 handoff

- Do not treat the brief's `pnpm ... vitest` spelling as a passing validation command in this
  workspace; use `pnpm ... exec vitest` (or the package's `test:unit` script).
- The successful build retains repository-wide warnings about externalized `node:crypto`, large
  chunks, and optional non-host Sharp binaries. None originates in the Task 5 component.
- After the final query-lifecycle refinement, a production-preview Playwright probe received the
  649 KiB page response quickly but did not settle its browser-side hydration probe within 30
  seconds. The earlier clean dev-browser pass completed the required catalog interactions, and no
  final console exception was observed after initialization stopped rewriting history. Task 6
  should explicitly time hydration and exercise query initialization, filter changes, search
  clearing/focus restoration, load-more, details, no-results, 390px overflow, and reduced motion.
