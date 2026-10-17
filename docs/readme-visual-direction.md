# README visual direction

Review date: 2026-10-17.

## Accepted direction

- Use exactly five story sections: Heroes, Home, Enemies, Equipment, and Skills.
- Lead with heroes and village life, then show representative selections from the other catalogs.
- Tell the intended game story through existing approved artwork and short narrative passages.
- Keep the first Village screenshot, including its existing interface overlay. Remove the second
  resident-detail screenshot.
- Show several enemy families and selected progression stages together in one overview image.
- Show equipment sets and selected rank/material progressions together in one overview image.
- Add a small representative skill overview. Remove the combat chibis and expedition aftermath section.
- Omit catalog links from the Enemies and Equipment sections; the images should stand on their own.
- Keep a small notice at the very end: the website is no longer available and development is paused
  for now. Do not physically archive the GitHub repository.
- Publish the proposal on `codex/public-archive-readme` for online review.

## Current proposal

The owner selected Meiis Eshel (20), Zelyn Eshun (66), Belu Uleno (73), Peria Halo (74),
Oren Sorin (84), Lorar Amaren (85), and Delyn Nethai (186) from the approved hero gallery.
These seven approved portraits now form the opening gallery.
The single Village capture introduces the Hearth. Three compact image galleries follow: enemy
families, equipment sets, and skills.

Hero images come from the approved summonable roster runtime manifest. Enemy images use
`approved-review` normal forms. Equipment images use the approved runtime manifest; skill icons use
the approved skill visual catalog. Gallery source layouts and input hashes are recorded in
`readme-gallery/gallery.html` and `readme-gallery/provenance.json`. Existing artwork is presented
without inventing or revising character depictions.

The Village image is a prototype screenshot. The prose distinguishes the intended experience from
implementation coverage, and local setup instructions are collapsed beneath the five story sections.

## Open hero selection

The owner described a Black woman with tangled hair, possibly wearing white. None of the four
portraits in the first proposal is the intended heroine. The full 200-portrait gallery is available
in [Approved hero gallery](readme-gallery/heroes.md).

Visual review identified Iani Morel, Raar Keshai, Lana Grelor, and Brinis Drenin as possible matches.
These remain suggestions; the owner has not confirmed an identity.

The owner also confirmed that additional remembered heroes are absent from the 200-person gallery.
Search the older identity and wiki artwork separately; do not treat legacy or candidate art as part of
the approved summonable pool without checking its recorded status.

The historical search found 62 additional identities from retired Forge, playtest, and selection
experiments. They are indexed separately in [Historical hero gallery](readme-gallery/legacy-heroes.md),
with original source commits and review status. Zuri Pell is the strongest white-coat and locs match;
the owner has not yet confirmed her identity.

The six retained Village cutouts had moved to `docs/evidence/living-village-lab-cutouts-v1`, but their
Git LFS attribute rule still covered only the retired application path. The proposal adds the new
path rule. All six existing images now load in the live wiki; their image bytes and approval history
are unchanged.
