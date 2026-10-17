# README visual direction

Review date: 2026-10-17.

## Accepted direction

- Use exactly five story sections, in this order: Home, Heroes, Enemies, Equipment, and Skills.
- Lead with village life, then heroes, followed by representative selections from the other catalogs.
- Tell the intended game story through existing approved artwork and short narrative passages.
- Keep the first Village screenshot, including its existing interface overlay. Remove the second
  resident-detail screenshot.
- Show several enemy families and selected progression stages in a native README image table.
- Show complete equipment sets and selected rank/material progressions in a native README image table.
- Show representative skills in a native README image table. Keep the expedition aftermath section removed.
- Include Asha, Nessa, and Toma as a labeled combat prototype row within Heroes, in screenshot
  order. This accepted revision supersedes the earlier request to omit combat chibis.
- Omit catalog links from the Enemies and Equipment sections; the images should stand on their own.
- Keep a small notice at the very end: the website is no longer available and development is paused
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
The legacy row preserves the four exact portraits subsequently supplied by the owner. Enemy images use
`approved-review` normal forms. Equipment images use the approved runtime manifest; skill icons use
the approved skill visual catalog. The current README embeds individual raster exports and links each image to its original full-size
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
The README now embeds all 15 previously selected monster forms, 45 equipment pieces across nine
complete sets, and 16 skill images individually. Text labels remain readable document text, and
each image links to its exact original PNG. The existing 512-pixel equipment and skill exports and
up-to-640-pixel monster exports provide sharper previews than images flattened into contact sheets.
This revision changes only README presentation and its supporting documentation; wiki pages and
game assets stay unchanged.
