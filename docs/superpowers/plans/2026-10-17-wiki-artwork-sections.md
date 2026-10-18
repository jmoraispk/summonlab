# Wiki Artwork Sections Implementation Plan

> **For agentic workers:** Use subagent-driven development for independent README and Equipment gallery work, and a fresh final review. Steps use checkbox syntax for tracking.

**Goal:** Put artwork inside Equipment, Skills, and Monsters; simplify the wiki index and repair README skill alignment.

**Architecture:** Keep existing wiki routes and canonical source identities. Reclassify navigation by subject, remove Milestones and duplicate Affinities from browsing, and move prototype/reference pages to Other. Mount a source-bound Equipment gallery on the existing Equipment index using existing item exports and separate optimized set/reference previews.

**Tech Stack:** Markdown, SvelteKit, TypeScript, Pillow, Vitest, Playwright.

**Spec:** `docs/wiki-maintenance-direction.md`, accepted artwork organization revision.

## Global Constraints

- American English; preserve proper names, canonical IDs, approved sources, and gameplay manifests.
- Flat navigation: one collapsible heading followed by aligned page links.
- No separate Art book, Milestones, or Affinities heading.
- Affinities remain accessible through the existing Progression page; preserve unique reference material and old links.
- Complete equipment artwork inventory: 21 full sets, 140 existing runtime items, seven approved source-only Greatswords.
- README changes retain eight monster families and the accepted +30 footer.
- Validate, commit, and push scoped changes to the current proposal branch.

## Review Focus

- Long README captions must not change icon size or position.
- Source-only equipment artwork must not imply gameplay integration.
- All equipment images, skill images, and monster images remain discoverable in their subject section.
- Hidden Milestones/duplicate Affinities do not break existing links.
- Phone search, pagination, filters, and flat index controls remain usable.

### Task 1: README alignment and monster selection

- [x] Diagnose actual GitHub image dimensions and layout before editing.
- [x] Separate image/caption rows with equal displayed icon sizes; preserve names/ranks and full-size links.
- [x] Replace Slimes with reviewed Deep Ones and update image provenance and visual direction.
- [x] Verify desktop/phone GitHub layout behavior and source hashes; record any live-render limitation.

### Task 2: Equipment artwork inside Equipment

- [x] Add focused tests for the approved 168-image inventory and gallery filtering.
- [x] Export separate source-bound wiki previews for 21 complete sets and seven Greatswords; reuse the 140 item exports.
- [x] Add a searchable gallery on the Equipment index with full sets prominent and all items accessible.
- [x] Verify complete set display, rank filtering, item browsing, pending gameplay labels, and phone layout.

### Task 3: Wiki organization and delivery

- [x] Write failing navigation/route regressions for subject sections, Other, and removed duplicate headings.
- [x] Reclassify artwork navigation; remove Milestones and duplicate Affinities from browsing. Move Living Village to Other.
- [x] Update wiki home and source index to lead directly to subject artwork; retain the existing Progression affinity rules.
- [x] Run focused tests, full web unit tests, typecheck, lint, formatting, wiki validation, production browser checks, build budgets, and the staged American English audit.
- [x] Complete independent review, commit, and push.

## Execution record

The owner explicitly authorized this reorganization. Historical source records remain available without adding navigation categories.

- Equipment contains 168 approved images: 21 complete armor sets, 140 runtime items, and seven source-only Greatswords. The 28 additional wiki previews total 469,498 bytes; the exporter verifies their source bindings. Gameplay manifests and approvals are unchanged.
- The README retains eight families and the +30 footer, replacing Slimes with Deep Ones. All 28 skill sources are 512 × 512. GitHub's intrinsic column sizing and vertically centered mixed captions caused the uneven display. Separate image/caption rows render all icons at 80 × 80 with aligned tops in desktop and phone fixtures. An initial live GitHub DOM inspection established the cause; GitHub returned HTTP 403 during the final live recheck, so final layout verification used its observed table rules locally. All 113 current image/source bindings were verified.
- Web unit checks passed: 335 tests across 61 files. Typecheck reported zero errors and warnings; lint, formatting, wiki validation, and build budgets passed. The production build passed all 36 selected wiki browser checks, including desktop/phone navigation, equipment, monsters, heroes, and skills.
- Independent review found that choosing a piece near the bottom of the gallery could leave results above the phone viewport. Piece selection and pagination now focus and reveal the result count. Regression checks and the reviewer's phone recheck passed; no findings remain.
- The staged American English audit, scoped commit, and branch push complete delivery.
