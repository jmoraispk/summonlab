# Wiki maintenance direction

Accepted owner feedback, 2026-10-17:

- Give the wiki a clear desktop index and phone menu with one level of collapsible headings, then pages.
- Do not nest collapsible sections or indent page groups.
- Consolidate the five monster race volumes, Goblinoid notes, and taxonomy into one **Monster Races** page under **Monsters**. Remove the separate Creatures and Monster Families and Races headings.
- Keep the original source-bound draft files as internal reference records and redirect former reader URLs to the consolidated page. Preserve unique authored content and distinguish source proposals from accepted combat rules.
- Preserve canonical wiki IDs, source paths, links, authored monster rules, and review status.
- Search the complete repository and its history for hero identity images, including other game
  prototypes. The 200-person summonable pool is not the complete visual archive.
- Keep approved roster portraits, historical identity anchors, candidate work, style studies, and
  animation frames distinguishable in the image inventory. Count identities separately from variants.
- Zuri Pell was ruled out as the missing heroine. The owner subsequently supplied four legacy
  portraits; the braided heroine exactly matches Asha’s existing owned source.

The eight selected README heroes use two rows of four: Meiis Eshel, Zelyn Eshun, Belia Corin,
and Calon Vesha in the men's row, followed by Peria Halo, Lorar Amaren, Delyn Nethai, and Brinia
Ulenai in the women's row. The arrangement follows their recorded identities. Brinia retains her
historical candidate status; the other seven are approved roster portraits. Belu Uleno and Coryn
Pellor were removed from the README selection. The README now orders Home, Heroes, Enemies, Equipment, and Skills, with one Village screenshot
and the paused-development notice at the bottom. Heroes also includes the owner-selected Asha,
Nessa, and Toma combat prototype row, followed by the four legacy portraits.

Deliver the wiki and image inventory updates on `codex/public-archive-readme`. Main CI repair
continues independently. Use approved raster artwork in player-facing character views.

## Complete image archive

The repository audit found 736 named identities: 200 approved heroes, 62 older study and lab identities, 471 additional historical candidates, and three realtime prototype people. Publish them in a searchable, paginated wiki image archive and linked GitHub galleries. Thumbnails derive from the exact recorded raster sources; collection labels preserve original approval boundaries. The active runtime roster stays at 200.

The audit covers the tracked tree and locally reachable Git history; it cannot account for images never committed here or unreachable history. The owner has supplied the four legacy portraits for the README; the first is Asha. The other three canonical names remain unverified.

## Navigation revision

The owner rejected the three-level index after browsing the preview. Use only peer collapsible headings and their direct page links, with aligned left edges. Preserve readable overview links, search context, active-page expansion, and phone controls. Treat the earlier nested presentation as superseded.

## Delivered structure and evidence

The flat index is implemented with peer collapsible headings and direct page links. Headings and
page labels share the same left edge; no collapsible heading contains another. The
[phone screenshot](evidence/public-archive-wiki/flat-index-phone.png) records the reviewed layout.
The searchable 736-person archive remains at `/wiki/heroes`. Final unit, production browser,
build-budget, source-hash, and language checks passed; main CI is green at `109688f41`.

## Consolidation revision

The owner accepted the flat index and requested fewer overlapping pages. The single Monster Races page replaces the public race-volume, Goblinoid, and taxonomy pages. All remaining creature pages belong to Monsters. The canonical 38-family/190-form database retains its distinct artwork and combat detail views; source-bound historical drafts remain internal references, not additional public race pages.

The Monsters heading contains four entry points: Monster bestiary, Monster Races, Fauna family
expansion, and the historical reconciliation. The 38 family and 190 form pages remain available
through the bestiary instead of appearing as hundreds of global index links. Visiting a family or
form still opens its Monsters context in the index. This keeps the accepted flat structure compact.

The consolidated page retains all thirty source race entries and their 150 visual progression
rows, plus the unique taxonomy and Goblinoid encounter evidence. Original source files and wiki IDs
remain unchanged; their catalog visibility is internal. Former reader URLs permanently redirect
to the consolidated page, preserving numbered race fragments. Internal source guidance remains a
separate reference. Current links go directly to the relevant consolidated section.

The [compact Monsters phone index](evidence/public-archive-wiki/consolidated-monsters-phone.png) records the consolidated layout. Search includes absorbed race, taxonomy, Goblinoid, and form names and returns their containing reader page or bestiary. Legacy question-section bookmarks reach a shared questions section with both original lists.

## Artwork organization revision

Accepted owner feedback: put all equipment artwork inside Equipment, all skill artwork inside Skills,
and all monster artwork inside Monsters. Remove the separate Art book heading. Remove Milestones
from browsing and remove the redundant Affinities group; Progression keeps the canonical affinity
page. Move the Living Village packet and other prototype/reference material to Other. Preserve
existing source documents and old URLs as needed for source bindings and links.

The approved equipment inventory includes 21 complete armor-set references, 140 individual runtime
items, and seven additional Greatsword artwork masters. Show all 168 images in Equipment, with
complete sets prominent and source-only Greatsword integration status explicit. Use optimized wiki
previews for artwork that has no gameplay export; do not change gameplay manifests or approvals.

The README replaces Slimes with Deep Ones. Its skill images share 512-pixel source canvases, but
GitHub column sizing and mixed caption wrapping caused unequal displayed sizes and vertical offsets.
Use consistent icon dimensions and separate label rows, with canonical names preserved.


## Preferred monsters and artwork zoom

Accepted owner feedback: put Giants, Orcs, Trolls, Harpies, Minotaurs, Golems, and Treants near the
start of the bestiary. Dragons remain the eighth README family. Keep all 38 families browsable;
move Elementals, Slimes, Arachnids, and Wolves to the end of the reader index and omit them from
the README showcase. This order is presentation only; do not reorder production authorities.

Images in the bestiary, family affinity atlas, and individual form pages open an enlarged viewer.
Provide zoom in/out, fit, scrolling, Escape/close support, and keyboard
focus restoration. Load the full-resolution repository source only when opening a viewer, with a
local preview fallback if that source is unavailable. These originals use Git LFS, so use GitHub’s
media endpoint rather than its raw endpoint, which returns pointer text. Keep the viewed region
centered when changing magnification. Keep names as links to combat detail pages.
Show complete images with preserved proportions rather than cropping to fill square cards.

## Public wiki and gallery navigation

Accepted feedback: keep the enlarged viewer, replace its thumbnail label with a small magnifying
glass, and add left/right image arrows. Browse normal forms in bestiary order, the five forms of a
family's selected affinity, or the five affinities of an individual form. Reset zoom when changing
images, preserve keyboard panning in a focused enlarged image, and return focus to the opener.

Publish the wiki separately on GitHub Pages and link it prominently from the README. The isolated
static app reuses the current wiki, galleries, and reader navigation. All 736 hero identities remain
searchable with shared query URLs, collection filters, pagination, and browser history. Keep game
routes and API endpoints out of the publication. Build and deployment details are in
[Publishing the wiki](wiki-publishing.md).

## Viewer spacing and dismissal

Accepted owner feedback: center the zoom controls, remove the original-image link and the routine
zoom/scroll instruction, and close the viewer when clicking outside its image section or in empty
image margins. Image clicks, gallery arrows, and controls remain active. A drag that begins on the
artwork must not dismiss the viewer when released outside it. Preserve Escape and opener focus.
