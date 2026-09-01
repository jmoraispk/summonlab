# Hero rarity frame v4 review evidence

## Authoring status

Status: **approved visual source — frozen by ADR 0066; runtime export pending**.

The checksum-listed active PNGs are approved visual sources. Generation references, prompts,
superseded outputs, and inspection evidence remain provenance; no runtime-ready exports are present.

## Dimensional evidence

- 35 of 35 individual PNGs are exactly 1024×1536 and RGB.
- Ranks 1–2 have identical SHA-256 values across Neutral, Fire, Water, Earth, and Wind.
- Median central hero-opening variation by family:
  - Neutral: 448–510 px, 13.84% variation;
  - Fire: 432–510 px, 18.06% variation;
  - Water: 430–510 px, 18.60% variation;
  - Earth: 430–510 px, 18.60% variation;
  - Wind: 430–510 px, 18.60% variation.
- Every widest/narrowest ratio is below the required 1.20 cap.
- The measurement method, exact per-rank readings, normalization factors, and hashes live in
  `geometry-report.json`.

## Bounded visual inspection

- The no-affinity authority contains seven aligned frames with integrated star counts 1–7.
- Neutral uses charcoal iron, tempered steel, restrained warm-gold trim, and flat forged crests. It
  contains no blue gems, affinity-colored gems, or affinity emission.
- Every approved individual source contains exactly one complete frame and one horizontal lower star tray.
- Stars retain the same warm-gold, broad, softly rounded five-point treatment and are rendered as
  part of the frame object.
- Rank 1 remains relatively rectangular; rank 2 adds a horned silhouette without an abrupt material
  color change.
- Ranks 3–7 add ornament, heraldry, guardian anatomy, elder density, and awakening in sequence.
- Fire, Water, Earth, and Wind begin affinity expression at rank 3 and increase it through rank 7.
- Dragon mouths remain visually sealed through rank 6. Rank 7 alone shows two open roaring mouths.
- Wind rank 7 v2 turns the left dragon head rightward and the right dragon head leftward so both
  open roars point inward toward the hero opening, matching the accepted Wind authority.
- Whole-frame normalization retained integrated relationships; stars were never moved separately.
- Hero openings remain broad and clear of characters, scenery, and interface text.

## Known production limitations

- All pixels are opaque RGB. Runtime transparency, exact alpha cleanup, nine-slice behavior, and
  engine sizing have not been produced or requested.
- The opening metric is a bounded image-analysis measurement for review consistency, not a runtime
  layout contract.
- Affinity sources are visual studies and do not authorize changes to canonical affinity
  semantics.
- Owner visual approval is recorded by ADR 0066. Runtime preparation remains a separate integration.

## Owner approval record

- The gemless neutral treatment is accepted through ranks 1–7.
- Internal hero-space consistency and the measured 20% cap are accepted.
- Ranks 1–2 are accepted as distinct through silhouette without affinity color.
- The closed-mouth 6★ to open-roar 7★ awakening is accepted in every family.
- Corrected inward-facing Wind rank 7 v2 is the frozen active Wind apex source.
