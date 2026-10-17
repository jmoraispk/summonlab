# Wiki maintenance direction

Accepted owner feedback, 2026-10-17:

- Give the wiki a clear desktop index and phone menu with one level of collapsible headings, then pages.
- Do not nest collapsible sections or indent page groups. Monster Families and Races is a peer heading, not a subgroup inside Creatures.
- Nest the five monster race volumes and Goblinoids inside **Monster Families and Races**.
- Replace the reader-facing “Generator bestiary seed” titles with **Monster Races**, qualified by
  the races covered so the five volumes remain distinguishable.
- Preserve canonical wiki IDs, source paths, links, authored monster rules, and review status.
- Search the complete repository and its history for hero identity images, including other game
  prototypes. The 200-person summonable pool is not the complete visual archive.
- Keep approved roster portraits, historical identity anchors, candidate work, style studies, and
  animation frames distinguishable in the image inventory. Count identities separately from variants.
- Zuri Pell was ruled out as the missing heroine. The owner subsequently supplied four legacy
  portraits; the braided heroine exactly matches Asha’s existing owned source.

The seven selected README heroes remain Meiis Eshel, Zelyn Eshun, Belu Uleno, Peria Halo,
Oren Sorin, Lorar Amaren, and Delyn Nethai. The README retains Heroes, Home, Enemies, Equipment,
and Skills, one Village screenshot, and the paused-development notice at the bottom.

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
