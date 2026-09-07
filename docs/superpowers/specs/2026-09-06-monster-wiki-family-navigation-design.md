# Monster Wiki Family Navigation Design

**Status:** Approved in conversation on 2026-09-06; awaiting specification review.

## Goal

Turn the canonical monster database into an image-first bestiary that visibly contains all 950
monster-affinity coordinates while preserving the useful distinction between 38 families, 190
T1–T5 forms, and five affinity variants per form.

The index becomes a fast visual scan. Family-wide material moves to 38 family pages. Detailed combat
contracts remain on the 190 form pages. This is an information-architecture and wiki-presentation
change; it does not alter enemy identities, image selections, approval state, combat balance, or
floor assignment.

## Decided hierarchy

The wiki uses three levels:

| Level | Count | Primary job | Images shown |
| --- | ---: | --- | ---: |
| Monster index | 1 | Scan and choose a family | 190 Normal images: T1–T5 for each family |
| Family pages | 38 | Understand one lineage and compare its complete visual set | 25 images each: five tiers × five affinities |
| Form pages | 190 | Read the complete contract for one T1–T5 form | Five images: Normal, Fire, Earth, Wind, Water |

This is deliberate progressive disclosure. The index owns discovery, a family page owns family
grammar and cross-tier comparison, and a form page owns form-specific detail.

## Route and source ownership

Generated Markdown and catalog entries use these stable locations:

| Page | Wiki ID | Repository source | Browser route |
| --- | --- | --- | --- |
| Monster index | `creatures.monster-database` | `docs/wiki/creatures/monsters/README.md` | `/wiki/creatures/monsters` |
| Family | `monster-family.<family-id>` | `docs/wiki/creatures/monsters/families/<family-id>.md` | `/wiki/creatures/monsters/families/<family-id>` |
| Form | `monster.<form-id>` | `docs/wiki/creatures/monsters/<form-id>.md` | `/wiki/creatures/monsters/<form-id>` |
| Reconciliation appendix | `creatures.monster-reconciliation` | `docs/wiki/creatures/monsters/reconciliation.md` | `/wiki/creatures/monsters/reconciliation` |

The monster exporter owns all four page classes and their `docs/wiki/catalog.json` entries. Family
and form links are relative in generated Markdown and resolve to the stable browser routes through
the existing wiki renderer.

## Image-first index

The monster index contains:

1. A short title block with the authoritative counts: 38 families, 190 forms, 950 affinity
   coordinates.
2. A compact family jump navigation.
3. One section per family in source order.
4. Exactly five Normal-image cards in T1–T5 order for every family.
5. On each card, only the tier, form name, and direct form link.
6. One family link and, at most, one short escalation sentence per family.
7. A compact footer link to taxonomy, reconciliation provenance, and production synchronization.

The index does not contain the current family field tables, visual-constant lists, nine-column
combat tables, affinity matrices, status semantics, or the forty-row reconciliation table.

On desktop the five tiers remain one visual row. Narrow layouts wrap into two columns and preserve
T1–T5 reading order. Images dominate the section; prose does not compete with them.

## Family pages

Each family page contains:

1. Family number, display name, classification caveat, source link, and unassigned floor state.
2. The family visual constants and escalation axis, written once for the family.
3. A compact T1–T5 comparison table with one row per form. It retains the useful content from the
   former index table: primary archetype, battlefield duty, teaching goal, signature mechanic,
   telegraph, counterplay, and lower-form interaction. Columns may be grouped responsively, but no
   information is discarded.
4. A five-by-five affinity atlas. Rows are T1–T5 forms; columns are Normal, Fire, Earth, Wind, and
   Water. Every cell links to that form page.
5. Direct links to all five form pages and a backlink to the monster index.

This makes one family page the natural home for its 25 variants. It also allows the user to compare
tier progression vertically and affinity treatment horizontally without returning to a review
gallery.

## Form pages

Each form page retains the complete form-specific combat reading and production evidence. It adds
an image-led header with the five affinity variants and clear links back to its family and the
monster index.

Family-wide visual constants and escalation prose are replaced by a concise family summary and a
link to the family page. The form's visual delta stays because it is specific to that tier. The
existing production/evidence matrix remains available below the visual and combat sections, with
the exact status semantics preserved.

The family page comparison row is a summary; the form page is the authoritative readable treatment
of battlefield duty, teaching goal, mechanic, telegraph, counterplay, and lower-form interaction.

## Reconciliation and provenance

Historical class reconciliation remains useful but no longer belongs on the visual index. The
exporter moves the current reconciliation explanation and table to the generated reconciliation
appendix. The index footer links to it without presenting it as a primary browsing path.

Legacy redirects continue to target canonical form routes. Bridge-only identities whose
reconciliation destination is not a canonical form redirect to the reconciliation appendix rather
than an index anchor.

No compact target, assignment, result, provenance, approval, runtime, or legacy-pack JSON is
deleted by this change.

## Image delivery and storage

The 750 original-family PNG masters remain exactly where they are and remain tracked through Git
LFS. The 200 fauna sources and existing fauna wiki-runtime WebP files remain unchanged.

The web wiki must not bundle or serve the full-resolution LFS PNG masters directly. A deterministic
export step creates presentation-sized, hash-addressed WebP derivatives for the 750
original-family coordinates under:

`apps/web/static/runtime/enemies/monster-wiki-v1/<family-id>/<form-id>/<affinity>.<hash>.webp`

A compact combined wiki-visual catalog binds all 950 coordinates to a browser URL:

- 750 entries point to the new original-family WebP derivatives and retain their existing
  `candidate-only`, `approved-review`, or other evidence status without implying runtime promotion.
- 200 fauna entries reuse the existing `fauna-family-v1` runtime URLs and retain `runtime` status.

The combined catalog records source path, source SHA-256, derivative path, derivative SHA-256,
dimensions, byte count, affinity, family ID, form ID, and presentation status. Derivative WebPs are
deployable runtime assets and remain in regular Git; source PNGs remain the LFS authorities. No PNG
is duplicated.

The derivative size should be sufficient for the family atlas and form header without carrying
source-master resolution. The implementation plan must set and test one deterministic maximum
dimension and quality target, and it must report the resulting aggregate byte cost before commit.

## Exporter and data contract

`pnpm export:wiki-monsters` remains the single synchronization command. It must deterministically:

1. Load the integrated 38-family, 190-form database.
2. Generate the concise index, 38 family pages, 190 form pages, and reconciliation appendix.
3. Generate or verify the 750 original-family WebP derivatives.
4. Generate the combined 950-coordinate wiki-visual catalog.
5. Refresh the existing `visual-index.json` without changing its canonical counts or evidence
   semantics.
6. Refresh all managed monster entries in `docs/wiki/catalog.json`.
7. Remove stale generated family pages or derivatives only when they are within the exporter's
   explicitly managed roots.

The visual index gains enough family binding information for the web layer to obtain the ordered
five forms and their ordered five variants without reconstructing relationships from filenames.
All count and uniqueness checks remain exact: 38 families, five forms per family, five affinities
per form, 190 Normal images on the index, and 950 unique family/form/affinity coordinates overall.

## Web presentation

The existing monster database hook is re-enabled with all 190 forms and grouped into ordered family
sections. A new family-page visual component renders the comparison and 25-image atlas. The form
visual component accepts both original-family presentation records and fauna runtime records; its
copy reflects the real evidence status rather than describing every image as owner-approved
runtime art.

Server data loading dispatches by page type or wiki ID:

- `creatures.monster-database` receives the complete ordered family index model.
- `monster-family.<family-id>` receives one family with five ordered forms and 25 visual records.
- `monster.<form-id>` receives one form with five ordered visual records.
- the reconciliation appendix renders as ordinary Markdown.

All images have form-and-affinity alt text, explicit dimensions, lazy loading below the initial
viewport, and keyboard-accessible links. The T1–T5 and Normal/Fire/Earth/Wind/Water orders are never
alphabetized.

## Validation

Unit and exporter tests must verify:

- exact page counts and managed filenames;
- exact 38 × 5 × 5 visual coverage with no duplicate coordinate;
- index sections contain five ordered Normal records per family;
- every family page binds five ordered forms and five ordered affinities per form;
- every form page binds five ordered affinities;
- generated links resolve to cataloged pages;
- all catalog source and derivative hashes, dimensions, paths, and byte counts match disk;
- original-family source PNGs remain LFS-covered;
- fauna records still bind to their existing runtime catalog;
- evidence labels are not promoted or rewritten by presentation export;
- legacy redirects do not loop and bridge-only redirects reach the appendix;
- stale generated output is detected by check mode.

Browser checks cover desktop and narrow layouts, representative original and fauna families, image
loading, family-to-form navigation, form-to-family navigation, and absence of the old long tables
from the index.

## Non-goals

- No enemy image is generated, regenerated, selected, approved, or promoted.
- No LFS source master is moved or renamed.
- No family, form, affinity, tier, combat contract, or floor assignment changes.
- No review gallery, contact sheet, or variant-approval interface is reintroduced.
- No legacy pack image appears in the canonical 950-coordinate atlas.
- The skill-icon branch and its assets remain untouched.

## Acceptance criteria

The change is complete when the monster index is a concise 38-family visual catalog showing T1–T5,
every family has a page containing its 25 variants and family-wide material, every form page shows
its five variants and detailed contract, the browser can render all 950 coordinates from deployable
WebP URLs, and deterministic checks prove that presentation work did not change source identity or
approval state.
