# Canonical rarity-frame production record

Status: **approved visual source; not runtime-ready**.

This consolidation preserves 48 byte-identical approved images from the frozen v3 and v4 packets.
No image was opened, normalized, re-saved, cropped, composited, or otherwise transformed while
building this library. Each `provenance/source-map.json` record binds one canonical path to one
unique frozen source path with matching SHA-256 values.

## Source history and rollout

- **Legacy Neutral** retains the v3 corrected neutral comparison sheet and seven v3 high-resolution
  neutral frames. It is the preferred rollout starting family.
- **Neutral** retains the v4 gemless-neutral comparison sheet and v4 individual neutral frames.
- **Fire, Water, Earth, and Wind** retain their v3 affinity comparison sheets and v4 individual
  frame families.
- The old v3/v4 packets are historical production provenance and remain intact; this library does
  not change runtime catalogs or engine contracts.

## Final prompt provenance

The stable prompt copies retain the final source-bound prompt for each generated asset. Correction
prompts are canonical for Legacy Neutral ranks 4–7, Neutral ranks 4 and 7, Fire rank 4, Water ranks
4 and 5, and Wind rank 7. Fire, Water, Earth, and Wind ranks 1–2 are byte-identical Neutral
inheritances; their source-map records declare `inheritedFrom: neutral` and do not claim false
affinity prompts.

## Production invariants

- All sheets are 2172×724 RGB PNGs; all frames are 1024×1536 RGB PNGs.
- The bottom tray and warm-gold star count are integral to the generated frame image.
- Ranks 1–6 require completely closed dragon mouths; rank 7 alone opens both mouths.
- Affinity expression begins at rank 3 and progressively strengthens through rank 7.
- Wind rank 7 is the active v2 correction with both roaring dragon heads facing inward; the
  outward-facing v1 apex remains superseded in the v4 provenance packet.

`manifest.json` identifies approved visual-source status and explicitly records that the library is
not runtime-ready. `checksums.sha256` is ordered by manifest family and rank, while the source map
is the complete byte-level mapping and provenance authority.
