# Public archive wiki navigation implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the wiki readable, put monster race material in its intended hierarchy, and locate hero images beyond the active roster.

**Architecture:** Keep canonical Markdown routes and IDs. Derive a readable hierarchy for the existing Svelte wiki layout, with expandable groups and explicit overview links. Maintain a source-backed hero image inventory separately from runtime approvals.

**Tech Stack:** SvelteKit, TypeScript, Markdown, Vitest, Playwright, Git and Git LFS.

**Spec:** `docs/wiki-maintenance-direction.md`.

## Global constraints

American English; approved raster characters; no dependency or sealed production-contract changes.
Keep existing URLs and wiki IDs. Publish on `codex/public-archive-readme`; run the English audit before commits.

## Review focus

- Direct links to nested pages must open their containing section and group.
- Search must retain matching children and their parent context.
- A phone user must open, use, and close the index without horizontal overflow.
- Existing race-volume and Goblinoids links must still resolve after title changes.
- Image inventory entries must distinguish identities, variants, and original approval status.

## Task 1: Monster race hierarchy and titles

Files: `apps/web/src/lib/server/wiki.ts`, `wiki.spec.ts`, `docs/wiki/creatures/monster-races/*.md`.

- [ ] Add a failing registry test: all five volumes and Goblinoids have group `Monster Families and Races`; their current hrefs and wiki IDs resolve.
- [ ] Rename public volume headings to `Monster Races` with meaningful ranges, and give the source guide a readable title. Preserve document IDs and paths.
- [ ] Derive the intended navigation group and update the overview's reader-facing links.
- [ ] Run the targeted wiki registry tests and wiki validation.

## Task 2: Wiki navigation presentation

Files: `apps/web/src/routes/wiki/+layout.svelte`, focused browser navigation test.
Consumes existing `WikiNavigationEntry` fields: title, href, section, group, designStatus, pageType.

- [ ] Add browser checks for an expandable Monster Families and Races group, its overview, race volumes, and Goblinoids.
- [ ] Make parent overviews explicit, remove repeated status clutter from individual navigation rows, and improve spacing, selected states, search, and phone menu behavior.
- [ ] Preserve matching child context when searching and expand the active group for direct links.
- [ ] Run the browser checks at 1400 and 390 pixels, then inspect screenshots.

## Task 3: Complete hero image inventory

Files: `docs/readme-gallery/`, a reproducible thumbnail export tool, a dedicated `/wiki/heroes` archive route, static portrait thumbnails, and wiki home/index links.

Audit handoff: 736 named identities (200 approved, 62 older studies, 471 additional candidates, three prototype people). Publish a searchable, paginated archive with source links and explicit collection status. Keep the current runtime roster unchanged. Use small derivatives of the exact existing raster sources; preserve aspect ratios and source hashes. Add paginated GitHub galleries so the pushed branch remains browseable without the preview server. The initial archive opens on all collections; searches cover names and recorded hair/wardrobe descriptions, with a collection filter. Correct the wiki home card that currently describes a six-image historical packet as the 200-hero gallery.

- [ ] Audit tracked image paths, manifests, runtime bindings, older prototypes, and historical identity sources. Exclude animation frames and rarity borders from identity counts.
- [ ] Record every source collection, identity/variant counts, source commits, approval status, and the limits of any identification.
- [ ] Publish browsable image references and examine additional candidates for the missing heroine; retain the owner's rejection of Zuri Pell.
- [ ] Verify image references, run the English audit, and present the inventories for identification.

## Delivery

- [ ] Review combined changes; run relevant unit/browser checks, lint, typechecking, formatting, wiki validation, and the English audit.
- [ ] Commit and push the proposal branch; report exact commits, branch, preview, and working-tree status.
