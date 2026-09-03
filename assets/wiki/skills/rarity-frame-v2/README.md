# Individual rarity frames — review set

Status: **visual direction accepted; common-canvas validation passed; exact shared registration is
still required before promotion**.

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

The owner accepted the visual direction on 2026-09-03. All seven files are genuine 1024×1024 RGBA
PNGs, but their visible alpha bounds do not yet share one exact aperture and outer-envelope
registration. Preserve the accepted materials and ornaments while normalizing that geometry, then
approve the deterministic composite at 1024 and 96 pixels before promotion. Mass skill-art
generation must not begin until this registration gate and the provider-compatibility pilot in the
rollout plan pass.
