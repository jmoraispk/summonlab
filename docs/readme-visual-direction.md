# README visual direction

Review date: 2026-10-17.

## Accepted direction

- Use exactly five story sections, in this order: Home, Heroes, Enemies, Equipment, and Skills.
- Lead with village life, then heroes, followed by representative selections from the other catalogs.
- Tell the intended game story through existing project artwork and short narrative passages,
  preserving the recorded approval status of each selection.
- Keep the first Village screenshot, including its existing interface overlay. Remove the second
  resident-detail screenshot.
- Show several enemy families and selected progression stages in a native README image table.
- Show complete equipment sets and selected rank/material progressions in a native README image table.
- Show representative skills in a native README image table. Keep the expedition aftermath section removed.
- Include Asha, Nessa, and Toma as a labeled combat prototype row within Heroes, in screenshot
  order. This accepted revision supersedes the earlier request to omit combat chibis.
- Omit catalog links from the Enemies and Equipment sections; the images should stand on their own.
- Show a framed GitHub Important notice at the very end: the website is no longer available and development is paused
  for now. Do not physically archive the GitHub repository.
- Publish the proposal on `codex/public-archive-readme` for online review.

## Current proposal

The owner selected eight portraits in two rows of four. The first row contains men: Meiis Eshel,
Zelyn Eshun, Belia Corin, and Calon Vesha. The second contains women: Peria Halo, Lorar Amaren,
Delyn Nethai, and Brinia Ulenai. These labels follow the recorded identities in the hero archive.
Belu Uleno and Coryn Pellor were removed from the README selection. Seven portraits are from the
approved roster; Brinia Ulenai retains her historical candidate status.
The single Village capture introduces the Hearth before the Heroes section. The gallery of eight portraits,
combat prototype row, and legacy portrait pack sit together within Heroes. Enemy families,
equipment sets, and skills follow in native image tables.

Seven hero portrait images come from the approved summonable roster runtime manifest. Brinia Ulenai
uses a compact preview of her exact archived source; its immutable source binding and derivative
hash are recorded in [selected portrait provenance](readme-gallery/selected-heroes/provenance.json).
The legacy row preserves the four exact portraits subsequently supplied by the owner. Enemy images
retain their reviewed, candidate, or runtime status from the monster visual catalog. Equipment images
use the approved runtime manifest; skill icons use the approved skill visual catalog. The current README embeds individual raster exports and links each image to its original full-size
source. Input hashes and table layouts are recorded in `readme-gallery/provenance.json`. The earlier
JPEG contact sheets and their `readme-gallery/gallery.html` capture source remain historical artifacts.
Existing artwork is presented without inventing or revising character depictions.

The Village image is a prototype screenshot. The prose distinguishes the intended experience from
implementation coverage, and local setup instructions are collapsed beneath the five story sections.

## Hero search history

The owner described a Black woman with tangled hair, possibly wearing white. None of the four
portraits in the first proposal is the intended heroine. The full 200-portrait gallery is available
in [Approved hero gallery](readme-gallery/heroes.md).

Visual review identified Iani Morel, Raar Keshai, Lana Grelor, and Brinis Drenin as possible matches.
These were unconfirmed suggestions and were not selected.

The owner also confirmed that additional remembered heroes are absent from the 200-person gallery.
Search the older identity and wiki artwork separately; do not treat legacy or candidate art as part of
the approved summonable pool without checking its recorded status.

The historical search found 62 additional identities from retired Forge, playtest, and selection
experiments. They are indexed separately in [Historical hero gallery](readme-gallery/legacy-heroes.md),
with original source commits and review status. The owner rejected Zuri Pell as the missing heroine.
Continue the complete repository and prototype inventory rather than repeating that suggestion.

The six retained Village cutouts had moved to `docs/evidence/living-village-lab-cutouts-v1`, but their
Git LFS attribute rule still covered only the retired application path. The proposal adds the new
path rule. All six existing images now load in the live wiki; their image bytes and approval history
are unchanged.

## Complete archive follow-through

The full tracked-tree and reachable-history audit found 736 named identities: 200 approved heroes,
471 additional historical candidates, 62 earlier study and playtest identities, and three combat
prototype people. All are available in the [complete archive](readme-gallery/hero-archive.md) and the
searchable `/wiki/heroes` page, with original status and source bindings preserved.

The owner supplied four exact legacy portraits and requested a side-by-side legacy pack. These
now appear together within Heroes, beneath the eight selected portraits and the combat prototype row. The first is
Asha: its source SHA-256 exactly matches the existing owned saffron-braid source. The other three
canonical names remain unverified; descriptive labels do not invent identities. Zuri Pell remains
rejected as the remembered heroine.

The legacy pack uses compact WebP previews linked to the unchanged full-size originals. Its
[source and preview hashes](readme-gallery/legacy-pack/provenance.json) preserve attachment order
and provenance. This is archival presentation and does not change the approved runtime roster.

## Combat prototype selection

The owner requested the three combat prototypes shown in the supplied archive screenshot: Asha,
Nessa, and Toma. Their transparent runtime study cutouts are presented side-by-side using compact
WebP previews linked to the exact existing originals. [Source and preview hashes](readme-gallery/combat-prototypes/provenance.json)
preserve their existing prototype status; this README selection does not promote a summonable
identity or change gameplay artwork.

## Native artwork tables

The owner rejected the low-resolution JPEG collages and requested actual images in README tables.
The README now shows eight monster families with five T1–T5 forms in each row, 45 equipment pieces
across nine complete sets, and 28 skills in four category groups. Monster and equipment tables use the
full README width. Skills use seven ascending rank columns: F, E, D, C, B, A, and S. Combat, Magic,
Craft, and Support each have one catalog-ranked example per column. These are representative rank
progressions, not an assertion that every selected skill directly unlocks the next.

The current selection, in order, is Giants, Orcs, Trolls, Harpies, Minotaurs, Golems, Treants, and
Dragons. The first seven reflect the owner’s preferred artwork; Dragons fill the eighth row. This
supersedes the earlier Deep Ones selection. Elementals, Slimes, Arachnids, and Wolves are omitted
from the README showcase. The complete eight-family progressions include reviewed and candidate artwork; the README
caption and provenance preserve those distinctions without changing approval status. The catalog has
38 families, so the closing row reports +30 more families after eight displayed. This corrects the
proposed +26 wording to match the catalog count.

Text labels remain readable document text, and each image links to its exact original PNG. The
existing 512-pixel equipment exports and tightly padded skill derivatives provide sharp individual previews. Monster previews
fit the full original image proportionally inside a 512 × 512 transparent canvas, without cropping
or stretching. Monster images fill their cells proportionally across the full table width instead
of stopping at 128 pixels. Equipment images also fill their cells proportionally, with no fixed pixel size limit. Both align to the top of
their cells; monster captions occupy a separate row. Nonbreaking tier/form headers keep
the five monster columns from shrinking unevenly in GitHub’s narrow-screen table layout. Current bindings are recorded in `readmeInputs` in the gallery provenance;
the original `inputs` array remains the historical contact-sheet capture record.
The reproducible monster export is `python3 tools/export-readme-monsters.py`; add `--check` to
verify source hashes, previews, selection, and provenance. Canonical sources, approvals, and gameplay
assets stay unchanged.

## Skill table alignment

The owner requested larger, equally sized skill artwork with less empty space. Equal source canvas
sizes did not guarantee equal visible artwork: each rank frame had different transparent borders,
and GitHub’s automatic table columns could shrink images according to caption widths.

The README uses 28 dedicated previews exported by `python3 tools/export-readme-skills.py`.
The exporter checks the canonical composed preview, interior, and frame hashes, crops only transparent
outer borders, and scales each badge uniformly to exactly 496 pixels high on a common 448 × 512
transparent canvas. Each badge keeps its original aspect ratio, so small differences in frame width
are intentional; nothing is stretched or redrawn. The source and derivative bindings, crop bounds,
and normalized dimensions are recorded in `readmeInputs`. Add `--check` to verify reproducibility.
The original artwork links, canonical sources, wiki images, and gameplay assets are preserved.

Each category spans an image row and a separate caption row. Category labels remain centered in
both directions. The seven ascending F–S columns request 12.8% of the table width. Smaller bold
captions remain selectable text, vertically centered in their cells. Equal-length, nonbreaking rank
headers use monospace text to establish a shared minimum column width on narrow screens; this
prevents long captions from making some icons smaller. The headers read “F · Skill” through
“S · Skill.” Native horizontal scrolling keeps the table usable on phones.

GitHub-sanitized HTML measured with GitHub-style table CSS gives all 28 previews the same dimensions:
102.406 × 117.031 pixels in a 1,012-pixel article, 164.859 × 188.406 pixels in a 1,500-pixel article,
and 84.297 × 96.328 pixels in a horizontally scrolling 390-pixel viewport. Visible badge height is
496/512 of each preview’s displayed height. The wider article previously showed roughly 151–159
pixels of visible artwork height; it now shows approximately 183 pixels. All rank decorations and
artwork remain intact. These measurements supersede the earlier square-thumbnail layout.

Equipment uses all available table width through proportional `width="100%"` images instead of a
128-pixel cap. At a 1,500-pixel article width, each equipment image displays at approximately
243 × 243 pixels; at a 1,012-pixel article width, images display at approximately 153 × 153 pixels.
All nine complete sets, 45 pieces, captions, and original artwork links are preserved.
