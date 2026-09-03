# Individual rarity frames — review set

Status: **visual review candidates; not approved or promoted**.

This set follows the approved Option C rarity appearance in
`assets/wiki/skills/rarity-frame-v1/sources/skill-rarity-option-c-v1.png` while giving every rank a
standalone 1024×1024 RGBA asset. Each image contains only a centered hexagonal frame and its rank
medallion. The interior and exterior are transparent so skill artwork and the standard backing can
be composed later.

## Review assets

- `review/individuals/f.png` — blackened weathered iron, minimal rivets and ornament
- `review/individuals/e.png` — warm aged bronze
- `review/individuals/d.png` — cool blue-black tempered steel
- `review/individuals/c.png` — clean bright silver steel
- `review/individuals/b.png` — dark gunmetal with restrained amethyst-violet accents
- `review/individuals/a.png` — champagne electrum with restrained pointed ornament
- `review/individuals/s.png` — ornate antique gold with symmetrical upper and lower filigree
- `review/rarity-frames-v2-contact-sheet.png` — all seven candidates on charcoal

The `review/previous-attempts/` sheets preserve and expose the earlier initial, corrective, and F
provider generations that were rejected by the former green-key geometry pipeline.

## Generation record

The seven ranks were generated individually with the built-in image-generation tool, using the same
approved Option C sheet as the visual reference for geometry, materials, medallion placement, and
ornament hierarchy. Each prompt required one frame only, the exact rank letter, no skill artwork,
no backing, no labels, and transparent inner and outer regions.

The provider rendered a checkerboard rather than actual alpha. One background-extraction edit was
requested per rank, but those edits also returned RGB checkerboards. The saved review PNGs therefore
use deterministic connected-component matte removal against that checkerboard; this changes only
background transparency and scales every asset to the common 1024×1024 canvas. No visual candidate
was rejected after generation.

Review material hierarchy, ornament density, geometry consistency, and readability before treating
this set as canonical. Skill-emblem production must not begin until the seven frames are accepted or
specific revisions are requested.
