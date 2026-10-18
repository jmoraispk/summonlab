# Public archive wiki navigation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the wiki readable, put monster race material in its intended hierarchy, and locate hero images beyond the active roster.

**Architecture:** Keep canonical Markdown routes and IDs. Derive peer collapsible headings and direct page links for the existing Svelte wiki layout, with aligned text and explicit overview links. Maintain a source-backed hero image inventory separately from runtime approvals.

**Tech Stack:** SvelteKit, TypeScript, Markdown, Vitest, Playwright, Git and Git LFS.

**Spec:** `docs/wiki-maintenance-direction.md`.

## Global constraints

American English; approved raster characters; no dependency or sealed production-contract changes.
Keep existing URLs and wiki IDs. Publish on `codex/public-archive-readme`; run the English audit before commits.

## Review focus

- Direct page links must open their single containing heading.
- Search must retain matching children and their parent context.
- A phone user must open, use, and close the index without horizontal overflow.
- Existing race-volume and Goblinoids links must still resolve after title changes.
- Image inventory entries must distinguish identities, variants, and original approval status.

## Task 1: Monster race hierarchy and titles

Files: `apps/web/src/lib/server/wiki.ts`, `wiki.spec.ts`, `docs/wiki/creatures/monster-races/*.md`.

- [x] Add a failing registry test: all five volumes and Goblinoids have group `Monster Families and Races`; their current hrefs and wiki IDs resolve.
- [x] Rename public volume headings to `Monster Races` with meaningful ranges, and give the source guide a readable title. Preserve document IDs and paths.
- [x] Derive the intended navigation group and update the overview's reader-facing links.
- [x] Run the targeted wiki registry tests and wiki validation.

## Task 2: Wiki navigation presentation

Files: `apps/web/src/routes/wiki/+layout.svelte`, focused browser navigation test.
Consumes existing `WikiNavigationEntry` fields: title, href, section, group, designStatus, pageType.

- [x] Add browser checks for an expandable Monster Families and Races group, its overview, race volumes, and Goblinoids.
- [x] Make parent overviews explicit, remove repeated status clutter from individual navigation rows, and improve spacing, selected states, search, and phone menu behavior.
- [x] Preserve matching child context when searching and expand the active group for direct links.
- [x] Run the browser checks at 1400 and 390 pixels, then inspect screenshots.

## Task 3: Complete hero image inventory

Files: `docs/readme-gallery/`, a reproducible thumbnail export tool, a dedicated `/wiki/heroes` archive route, static portrait thumbnails, and wiki home/index links.

Audit handoff: 736 named identities (200 approved, 62 older studies, 471 additional candidates, three prototype people). Publish a searchable, paginated archive with source links and explicit collection status. Keep the current runtime roster unchanged. Use small derivatives of the exact existing raster sources; preserve aspect ratios and source hashes. Add paginated GitHub galleries so the pushed branch remains browseable without the preview server. The initial archive opens on all collections; searches cover names and recorded hair/wardrobe descriptions, with a collection filter. Correct the wiki home card that currently describes a six-image historical packet as the 200-hero gallery.

- [x] Audit tracked image paths, manifests, runtime bindings, older prototypes, and historical identity sources. Exclude animation frames and rarity borders from identity counts.
- [x] Record every source collection, identity/variant counts, source commits, approval status, and the limits of any identification.
- [x] Publish browsable image references and examine additional candidates for the missing heroine; retain the owner's rejection of Zuri Pell.
- [x] Verify image references, run the English audit, and present the inventories for identification.

## Task 4: Flatten the index after owner review

Files: `apps/web/src/routes/wiki/+layout.svelte`, `navigation.e2e.ts`.

- [x] Replace nested section/group details with peer collapsible headings and direct page links only.
- [x] Align heading and page text; remove nested indentation and decorative inset lines.
- [x] Make Monster Families and Races a peer heading containing its overview, five race volumes, and Goblinoids.
- [x] Preserve search matching children and their overview, direct-route expansion, shortcuts, and phone menu controls.
- [x] Add a regression that no details element contains another details element, verify aligned page labels, and rerun desktop/phone browser checks plus typecheck and lint.

## Delivery

- [x] Review combined changes; run relevant unit/browser checks, lint, typechecking, formatting, wiki validation, and the English audit.
- [x] Commit and push the proposal branch; report exact commits, branch, preview, and working-tree status.

## Completion evidence

Delivered on `codex/public-archive-readme`. The repository is public and is not physically archived.
The README keeps Heroes, Home, Enemies, Equipment, and Skills, the seven selected portraits, one
Village screenshot, and the unavailable-website / paused-development notice at the bottom.

The complete archive covers 736 named identities, with 200 approved, 471 historical candidates,
62 earlier study and playtest identities, and three combat prototypes. All selected originals and
thumbnails have verified hashes. Source statuses, canonical wiki IDs, and the runtime roster remain
intact. Search excerpts use American English; immutable historical target records are preserved.

The owner rejected nested navigation. Commit `2afa76fe7` implements peer collapsible headings and
direct page links with aligned text, including Monster Families and Races. The
[reviewed phone screenshot](../../evidence/public-archive-wiki/flat-index-phone.png) records that
structure at 390 pixels. Desktop and phone browser tests verify that no collapsible heading
contains another collapsible heading. Visual feedback on the revised preview remains optional.

Verification completed:

- Web unit suite: 59 files and 311 tests passed.
- Production wiki browser suite: 11 checks passed at 1400 and 390 pixels.
- Production build, bundle budgets, type checking, lint, formatting, wiki validation, and the
  tracked-file American English audit passed. Wiki validation covers 303 documents.
- All 736 source/thumbnail bindings and 31 generated GitHub gallery pages were verified; the
  first and last GitHub gallery pages and all 12 README images loaded in browser checks.
- Independent task and final integration reviews approved the completed changes.
- Main commit `109688f41` reduces phone reconnect image payloads by 265,442 bytes. The unchanged
  phone test measured 2459.4 ms locally against its 4000 ms budget; all 52 main browser tests passed.
- The full hosted [main CI run](https://github.com/jmoraispk/summonlab/actions/runs/39064173577)
  passed, including unit tests, PostgreSQL integration tests, production build and rehearsal,
  and browser tests.

The owner reports finding the favorite heroine and will provide the exact portrait or name. Her
identity remains open; the seven confirmed README selections remain in place until that arrives.
