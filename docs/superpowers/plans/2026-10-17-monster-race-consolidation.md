# Monster Race Consolidation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the single implementation task and a fresh review. Steps use checkbox syntax for tracking.

**Goal:** Publish one Monster Races page under Monsters, consolidating the five race volumes, Goblinoid notes, and taxonomy without another sidebar category.

**Architecture:** Reuse the existing monster-family index route and identity as the consolidated reader page. Preserve source-bound production drafts at their original paths as internal reference records; redirect their old public routes to the consolidated page. Group all creature navigation under Monsters while retaining the flat heading-and-pages layout.

**Tech Stack:** Markdown, TypeScript, SvelteKit, Vitest, Playwright.

**Spec:** `docs/wiki-maintenance-direction.md`, accepted consolidation revision below.

## Global Constraints

- American English; preserve proper names and source-bound identifiers.
- No nested sidebar headings or page indentation.
- Preserve all 30 race entries and 150 source progression rows, unique Goblinoid rules, taxonomy caveats, and candidate/internal status boundaries.
- Preserve immutable production source paths and source text; do not reseal production manifests for a presentation change.
- Keep distinct canonical family/form artwork and combat detail pages.
- Commit and push the proposal branch after validation; leave main unchanged.

## Review Focus

- Old race-volume and taxonomy links reach the consolidated reader page.
- All 30 race anchors and progression tables remain readable on phones.
- Internal production guidance remains outside public navigation.
- Goblinoid candidate artwork and combat evidence retain their status.
- Search, active heading expansion, aligned links, and phone index controls continue working.

### Task 1: Consolidate the creature reader surface

**Files:** Modify `docs/wiki/creatures/monster-races/README.md`, `docs/wiki/catalog.json`, `docs/wiki/README.md`, `apps/web/src/lib/server/wiki.ts`, `apps/web/src/routes/wiki/[...slug]/+page.server.ts`, `apps/web/src/lib/server/wiki.spec.ts`, `apps/web/src/routes/wiki/navigation.e2e.ts`, and `docs/wiki-maintenance-direction.md`.

**Interfaces:** Keep `getWikiPage` and catalog identities stable. Add a bounded consolidation redirect lookup used both by route loading and Markdown link resolution. Public navigation exposes only the consolidated Monster Races page for the former volume, Goblinoid, and taxonomy pages.

- [x] Write registry and route regressions for one races page in Monsters, 30 headings/150 source rows, preserved taxonomy and Goblinoid evidence, rewritten links, permanent redirects, and internal guidance visibility. Run the focused tests and observe failures.
- [x] Merge the unique reader content into the existing index Markdown with a race jump list and one source-status introduction. Retain the five original source drafts, Goblinoid source, and taxonomy source as internal catalog reference records. Update current wiki landing links and accepted direction; historical source bindings remain intact.
- [x] Implement route/link consolidation and map creature navigation to Monsters. Preserve the existing flat sidebar and unrelated canonical pages.
- [x] Adapt desktop/phone browser regressions to the consolidated page, direct race anchor navigation, old URLs, search, and index controls.
- [x] Run focused unit/browser tests, wiki validation, web typecheck/lint/build, formatting and American English checks. Review the diff.

## Execution record

Owner authorization to proceed and push is already explicit; no additional approval checkpoint is required.

- Registry regression run first: 11 expected failures before implementation; 35 tests passed after.
- Five original source volume bodies are included verbatim. The five volumes, Goblinoid source,
  and taxonomy source remain byte-identical to the prior commit. Only their catalog audience changed.
- Monsters exposes four entry points; canonical family/form pages remain reachable through the
  bestiary and retain active index context without 228 duplicate global links.
- Numbered source heading IDs remain stable. Redirects omit a replacement fragment so browsers
  preserve incoming race fragments; Markdown links without a fragment use each source's first race
  or taxonomy/Goblinoid section.
- Added heading scroll offsets so direct race jumps clear the fixed top bar.
- Full production validation and independent review follow the focused implementation checks.

- Fresh review found missing search discovery after consolidation and an ambiguous legacy questions anchor. Added containing-page search terms and a shared questions section; the reviewer verified both fixes in Chromium with no remaining actionable findings. The five search regressions failed before the fix and passed afterward.
- Final web suite: 319 tests across 59 files passed. Production build and all 11 desktop/phone navigation browser checks passed. Web typecheck reported zero errors and warnings; lint, formatting, wiki validation, and source-preservation checks passed.
- Monster generation consistency passed: 38 families, 190 canonical forms, 950 visual coordinates, and 40 reconciliations. Build budgets passed; the staged American English audit found zero violations.
