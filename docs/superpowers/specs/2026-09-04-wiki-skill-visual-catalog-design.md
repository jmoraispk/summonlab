# Wiki Skill Visual Catalog Design

**Date:** 2026-09-04
**Status:** Approved
**Scope:** Permanent wiki presentation of the complete canonical skill catalog

## Goal

Publish every canonical skill as a compact, searchable visual record at
`/wiki/mechanics/skills/visual-catalog`. The page combines the existing 456 candidate skill
illustrations with the canonical taxonomy and mechanics text so a reader can compare art, meaning,
acquisition, and effect without opening nineteen review sheets or scanning family tables.

This is a wiki reader, not a production dashboard. It must preserve the established field-archive
design, remain useful at 390px, and avoid shipping the 806 MiB source PNG collection to a browser.

## Approved product decisions

- The visual catalog is a permanent wiki page linked from the main Skills page.
- It displays all 456 canonical skills: 258 Martial, 124 Magical, and 74 Craft.
- Desktop uses the approved four-card density. The grid reflows to three, two, and one column as
  available width decreases.
- Each card shows the skill image, name, Domain → Family path, authored labels, skill type,
  acquisition requirement, effect, motif family, and primary visual parent when one exists.
- Rarity is already communicated by the integrated frame and is not repeated as card text.
- Technical target IDs, source state, and source paths remain available in an expandable details
  section rather than competing with the authored record.
- Search and filters cover Domain, Family, and Motif Family. Family choices follow the selected
  Domain. Filters are represented in the URL query so a view can be bookmarked or shared.
- The page renders the first 120 matching records and reveals the next 120 through `Load more`.
  Images use native lazy loading and decoding.
- The image well is solid near-black. It never uses the checkerboard review background; transparent
  exterior pixels therefore read as transparency rather than white artifacts.
- Existing icon defects are not silently retouched by the wiki exporter. They are recorded and
  remediated by
  `docs/superpowers/issues/2026-09-04-skill-icon-quality-cleanup.md`.

## Source authority

The implementation joins three checked-in authorities by `targetId`:

1. `assets/wiki/skills/icon-production-v1/catalog.json` owns name, Domain, Family, labels, type,
   acquisition, effect, motif family, primary visual parent, and source status.
2. `assets/wiki/skills/icon-production-v1/mass-production-v1/manifest.json` owns the selected
   candidate image path and source hash for each of the 456 skills.
3. `apps/web/static/wiki-media/skills/visual-catalog-v1/manifest.json` owns browser-delivery image
   paths and derivative hashes.

Markdown family tables remain canonical prose views, but the visual page does not parse them. The
structured skill catalog already contains the same authored fields and prevents a second hand-kept
skill database.

The join is strict. Duplicate IDs, missing records, count drift, source hash drift, unsupported
labels or types, or an unmatched derivative fail validation. The page must never omit a record and
quietly render a partial catalog.

## Browser image publication

The 456 source files are 1024×1024 RGBA PNGs totaling approximately 806 MiB. They remain
authoritative production evidence and are not copied directly under `apps/web/static`.

A deterministic exporter writes:

```text
apps/web/static/wiki-media/skills/visual-catalog-v1/
  manifest.json
  icons/
    <skill-slug>.<source-sha256-prefix>.webp
```

Each derivative is:

- 512×512 WebP with alpha;
- resized from the exact manifest-bound candidate PNG;
- encoded by Sharp with quality 86, alpha quality 100, effort 4, and smart subsampling;
- stripped of incidental metadata;
- named with the first twelve characters of the source SHA-256;
- recorded with source path/hash, output path/hash, dimensions, and byte count.

A full dry encoding of the present catalog measured 36.8 MiB total, with a median of 84,720 bytes,
a 95th percentile of 101,376 bytes, and a maximum of 112,372 bytes. The exporter enforces 130 KiB
per derivative and 42 MiB for the complete managed directory. These ceilings leave bounded encoder
headroom while preventing accidental publication of the PNG originals.

The exporter has explicit `--write` and zero-write `--check` modes. Write mode stages the complete
managed directory and swaps it into place only after every image and manifest validates. Check mode
re-encodes all derivatives and compares exact bytes, rejects stale or unexpected files, and does not
change the repository.

The export is a delivery transformation only. It must not repaint, crop, mask, fix, regenerate, or
change the meaning of an icon.

## Page information architecture

### Introduction

The page opens with:

- the title `Skill visual catalog`;
- one concise sentence explaining that Domain → Family owns a skill while optional labels narrow
  compatibility;
- a live result count, initially `456 skills`;
- a link back to the interactive skill tree.

### Search and filters

The control row contains one native search input and three native selects:

- Domain: All, Martial, Magical, Craft;
- Family: All plus the families in the active Domain, or every family when Domain is All;
- Motif Family: All plus values compatible with the active Domain and Family.

Search matches skill name, Domain, Family, label values, acquisition, effect, motif family, and
primary visual parent name. Matching is case-insensitive and whitespace-normalized. Changing a
broader filter clears incompatible narrower values. A quiet `Clear filters` button appears only when
state differs from the unfiltered view.

The URL uses `q`, `domain`, `family`, and `motif` query keys. Invalid values are ignored and removed
on the next state change. Updating filters uses history replacement rather than creating one browser
history entry per keystroke.

### Card anatomy

Each result is a semantic `article` containing:

1. a square, solid-dark image well with the complete framed skill image centered and contained;
2. the skill name in Georgia;
3. Domain → Family and authored labels in compact monospace metadata;
4. the skill type;
5. `Acquisition` and `Effect` definition rows;
6. `Motif family` and optional `Visual parent` provenance rows;
7. a native `details` disclosure containing target ID, candidate status, source PNG path, and runtime
   derivative path.

Cards use fine dividers and the existing background/surface palette. They do not use pills, rounded
marketing cards, glass effects, gradients, drop shadows, or ornamental connector diagrams.

### Pagination and empty state

Filtering always resets the visible limit to 120. `Load more` appends the next 120 matching records
without changing filter state or scroll position. The button states the exact next batch size. After
activation, keyboard focus moves without scrolling to the first appended skill heading and remains
there when the final button disappears. The polite status reports both the matching total and the
displayed `1–N` range.

When no records match, the page preserves the control area and displays `No skills match these
filters.` with a native button to clear the current state.

## Responsive behavior

- Card density follows the catalog's available inline size, not the raw viewport around the fixed
  wiki sidebar.
- Four columns at catalog widths above 64rem.
- Three columns from 52rem through 64rem.
- Two columns from 30rem through 52rem.
- One column below 30rem.
- Controls wrap without horizontal document overflow.
- The 512px source supplies sufficient detail for the approved card size and common high-density
  desktop displays without requiring responsive source variants in this first version.
- Image width and height are declared as 512 to reserve layout space before decode.

## Accessibility

- Search, selects, reset, load-more, and details are native controls with visible labels and the
  established focus color.
- The result summary is an `aria-live="polite"` status region.
- Image alt text is `<skill name> skill emblem` because the adjacent card provides the complete
  mechanics description.
- Cards follow source order and require no custom keyboard handling.
- Color does not carry taxonomy or control state by itself.
- Reduced-motion mode removes optional image and control transitions.

## Wiki integration

Create `docs/wiki/mechanics/skills/visual-catalog.md` with wiki ID `skills.visual-catalog`, public
scope, implemented status, and candidate visual status. Add it to `docs/wiki/catalog.json` and link
it from `docs/wiki/mechanics/skills/README.md`.

The wiki page loader supplies structured visual records only for this wiki ID. The generic Markdown
renderer remains unchanged for ordinary pages. The page route renders a dedicated
`SkillVisualCatalog.svelte` component followed by the short canonical Markdown introduction and
source footer.

`apps/web/DESIGN.md` records this as the intentional dense visual-catalog exception to the wiki's
usual ledger presentation. The exception is limited to comparing hundreds of image-bearing skill
records; family pages remain flat tables and the taxonomy root remains the three-circle tree.

## Failure behavior

- Export or check fails before deployment when any source is absent, stale, undecodable, not
  1024×1024 RGBA, or mismatched to its recorded hash.
- Export or check fails when any derivative is absent, stale, too large, lacks alpha, has the wrong
  dimensions, or is not a managed WebP.
- Server construction fails when the three authorities do not join exactly to 456 unique records.
- The UI has no fabricated loading skeleton: records are server-supplied and images use native
  browser loading.
- A browser image decode failure preserves the textual card record and accessible alt text; it does
  not remove the skill from results.

## Explicit non-goals

- Editing, approving, or promoting candidate skill art.
- Repairing frames, clipping subjects, or removing stray semantic glyphs.
- Showing hero-specific mastery or level; those values belong to a hero instance, not this catalog.
- Showing rarity as duplicate text outside the integrated crest.
- Adding individual wiki pages for every skill.
- Adding sort modes, favorites, comparison trays, virtual scrolling, responsive image variants, or
  a production/review workflow.

## Acceptance criteria

- The route renders 456 strictly joined canonical records with exact domain counts 258/124/74.
- Every record exposes image, name, Domain → Family, labels, type, acquisition, effect, motif family,
  and optional parent.
- No card prints a separate rarity label.
- Four cards are visible per row at desktop review width; the page has no overflow at 390px.
- Search and all three filters work together, are URL-representable, and reset the 120-record window.
- Load more reaches all matching records.
- The browser-delivery directory stays at or below 42 MiB and no file exceeds 130 KiB.
- All source and derivative hashes validate in zero-write check mode.
- The page uses a solid dark image well and never exposes a checkerboard review surface.
- Wiki validation, focused unit tests, Svelte typecheck, Playwright coverage, and the production web
  build pass.
